"""
build_ds_index.py — Merge the DSmd documentation with registry3.json into a
single, LLM-usable design-system index: figma-DS-extracts/ds_index.json.

Strategy:
  1. LLM-extract structured specs from each component-bearing doc in DSmd/
     (description, properties, variants, use_cases, rules) using a TOP model.
  2. Join each extracted component to registry3.json to attach the importable
     Figma `key` — primary join on node_id, fallback on normalised name.
  3. Extract design foundations (colours, typography, spacing) into a tokens block.
  4. Write ds_index.json with coverage metadata.

The model is deliberately NOT the pipeline's Haiku — this is a one-time, quality-
first build. Override with env DS_INDEX_MODEL.

Usage:
    cd "concept to UI/server"
    python3 scripts/build_ds_index.py
"""

import os
import re
import sys
import json
import difflib
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langchain_anthropic import ChatAnthropic

SERVER_DIR = Path(__file__).parent.parent
load_dotenv(SERVER_DIR / ".env", override=True)

DSMD_DIR      = SERVER_DIR.parent / "DSmd"
REGISTRY_PATH = SERVER_DIR / "figma-DS-extracts" / "registry3.json"
OUTPUT_PATH   = SERVER_DIR / "figma-DS-extracts" / "ds_index.json"
MODEL         = os.getenv("DS_INDEX_MODEL", "claude-opus-4-5")

# Files that document reusable UI components, with a category hint.
COMPONENT_FILES = {
    "atoms.md":      "atom",
    "atoms2.md":     "atom",
    "molecules.md":  "molecule",
    "molecules2.md": "molecule",
    "organisms.md":  "organism",
    "patterns.md":   "pattern",
}
# Files that document design foundations / tokens.
FOUNDATION_FILES = ["colors.md", "type-scale.md", "spacing-radius-strokes-effects.md", "atoms-rules.md"]


# ── Schemas ───────────────────────────────────────────────────────────────────
class PropertySpec(BaseModel):
    name:    str = Field(description="Property name, e.g. 'Variant', 'Size', 'L - icon'")
    type:    str = Field(default="", description="Variant | Boolean | Text | Number | etc.")
    default: str = Field(default="", description="Default value if stated")
    options: List[str] = Field(default_factory=list, description="Allowed values")
    notes:   str = Field(default="", description="What this property controls")


class VariantSpec(BaseModel):
    name:         str = Field(description="Variant name, e.g. 'Error', 'Large'")
    semantic_use: str = Field(default="", description="When/why to use this variant")
    example:      str = Field(default="", description="Example content/message if given")


class UseCaseSpec(BaseModel):
    context: str = Field(description="The situation/screen context")
    variant: str = Field(default="", description="Which variant to use here")
    config:  str = Field(default="", description="Property config, e.g. 'L-icon=True, R-icon=False'")


class ComponentSpec(BaseModel):
    name:        str = Field(description="Exact component name WITHOUT numbering prefixes (e.g. 'Nudge', 'App bar')")
    node_id:     str = Field(default="", description="Figma Node ID from the doc if present, e.g. '22619:189447'")
    description: str = Field(default="", description="Concise 1-2 sentence description of the component")
    properties:  List[PropertySpec] = Field(default_factory=list)
    variants:    List[VariantSpec]  = Field(default_factory=list)
    use_cases:   List[UseCaseSpec]  = Field(default_factory=list)
    rules:       List[str] = Field(default_factory=list, description="Do/don't usage guidance, one short string each")


class ComponentSpecList(BaseModel):
    components: List[ComponentSpec] = Field(default_factory=list)


class Token(BaseModel):
    name:  str = Field(description="Token name, e.g. 'Primary', 'Heading/H1', 'space-4'")
    value: str = Field(default="", description="Value, e.g. '#5B2EFF', '24px / 32px', '16px'")
    usage: str = Field(default="", description="When to use it")


class Foundations(BaseModel):
    colors:      List[Token] = Field(default_factory=list)
    typography:  List[Token] = Field(default_factory=list)
    spacing:     List[Token] = Field(default_factory=list)
    radius:      List[Token] = Field(default_factory=list)
    effects:     List[Token] = Field(default_factory=list)
    global_rules: List[str]  = Field(default_factory=list, description="System-wide layout/spacing rules")


# ── LLM ───────────────────────────────────────────────────────────────────────
def llm(max_tokens: int = 32000):
    return ChatAnthropic(model=MODEL, temperature=0, max_tokens=max_tokens)


COMP_SYS = (
    "You extract a design-system component catalog from documentation into structured JSON. "
    "Extract ONLY reusable UI components (atoms, molecules, organisms, patterns). "
    "Do NOT extract: foundational token tables, icon-name lists, logo/illustration asset catalogs, "
    "or pure rules pages — skip those entirely. "
    "For each component capture its exact name (strip any leading numbering like '3a.' and parenthetical "
    "annotations), the Figma Node ID if the doc states one, a concise description, its properties "
    "(name/type/default/options/notes), variants (name/semantic use/example), use cases "
    "(context/variant/config), and rules (each do/don't as a short standalone string). "
    "Be complete and faithful to the documentation. Never invent properties or values that aren't stated."
)

FOUND_SYS = (
    "You extract design-system FOUNDATIONS (design tokens) from documentation into structured JSON: "
    "colors, typography/type-scale, spacing, radius, and effects, plus any system-wide layout rules. "
    "Capture concrete token names and values exactly as documented. Do not invent values."
)


def extract_components(path: Path, category: str) -> List[dict]:
    text = path.read_text()
    chain = llm().with_structured_output(ComponentSpecList)
    result: ComponentSpecList = chain.invoke([
        {"role": "system", "content": COMP_SYS},
        {"role": "user", "content": f"Category hint for this file: {category}.\n\nDocument:\n\n{text}"},
    ])
    out = []
    for c in result.components:
        d = c.model_dump()
        d["category"] = category
        out.append(d)
    return out


def extract_foundations() -> dict:
    blobs = []
    for fn in FOUNDATION_FILES:
        p = DSMD_DIR / fn
        if p.exists():
            blobs.append(f"=== {fn} ===\n{p.read_text()}")
    if not blobs:
        return {}
    chain = llm().with_structured_output(Foundations)
    result: Foundations = chain.invoke([
        {"role": "system", "content": FOUND_SYS},
        {"role": "user", "content": "\n\n".join(blobs)},
    ])
    return result.model_dump()


# ── Join to registry ──────────────────────────────────────────────────────────
def normalize(name: str) -> str:
    n = name.lower().strip()
    n = re.sub(r"^[.\s]*\d+[a-z]?[.)]\s*", "", n)  # strip "3a. " / "1) "
    n = re.sub(r"\*\(.*?\)\*", "", n)               # strip *(...)*
    n = re.sub(r"\(.*?\)", "", n)                    # strip (...)
    n = re.sub(r"\s+", " ", n).strip(" .")
    return n


def join_to_registry(components: List[dict], registry: List[dict]) -> List[dict]:
    by_node = {c["node_id"]: c for c in registry if c.get("node_id")}
    by_norm = {}
    for c in registry:
        by_norm.setdefault(normalize(c["name"]), c)
    norm_keys = list(by_norm.keys())

    merged = []
    for spec in components:
        reg = None
        method = "unmatched"

        nid = (spec.get("node_id") or "").strip()
        if nid and nid in by_node:
            reg, method = by_node[nid], "node_id"
        else:
            nn = normalize(spec["name"])
            if nn in by_norm:
                reg, method = by_norm[nn], "name_exact"
            else:
                close = difflib.get_close_matches(nn, norm_keys, n=1, cutoff=0.82)
                if close:
                    reg, method = by_norm[close[0]], "name_fuzzy"

        merged.append({
            "name":          spec["name"],
            "category":      spec.get("category", ""),
            "key":           reg["key"] if reg else "",
            "node_id":       reg["node_id"] if reg else nid,
            "variant_count": reg["variant_count"] if reg else None,
            "description":   spec.get("description", ""),
            "properties":    spec.get("properties", []),
            "variants":      spec.get("variants", []),
            "use_cases":     spec.get("use_cases", []),
            "rules":         spec.get("rules", []),
            "_match": {
                "matched":       reg is not None,
                "method":        method,
                "registry_name": reg["name"] if reg else None,
            },
        })
    return merged


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY not set in .env"); sys.exit(1)
    if not REGISTRY_PATH.exists():
        print(f"ERROR: {REGISTRY_PATH} not found — run build_registry.py first"); sys.exit(1)

    registry = json.load(open(REGISTRY_PATH))
    print(f"Loaded registry: {len(registry)} components")
    print(f"Extraction model: {MODEL}\n")

    all_components: List[dict] = []
    for fn, cat in COMPONENT_FILES.items():
        p = DSMD_DIR / fn
        if not p.exists():
            print(f"  [SKIP] {fn} not found"); continue
        try:
            comps = extract_components(p, cat)
            print(f"  [{fn}] extracted {len(comps)} components")
            all_components.extend(comps)
        except Exception as e:
            print(f"  [ERROR] {fn}: {e!r}")

    print("\nExtracting foundations…")
    try:
        foundations = extract_foundations()
        print(f"  colors={len(foundations.get('colors',[]))} "
              f"typography={len(foundations.get('typography',[]))} "
              f"spacing={len(foundations.get('spacing',[]))}")
    except Exception as e:
        print(f"  [ERROR] foundations: {e!r}"); foundations = {}

    merged = join_to_registry(all_components, registry)

    # Coverage stats
    from collections import Counter
    methods = Counter(c["_match"]["method"] for c in merged)
    with_key = sum(1 for c in merged if c["key"])

    index = {
        "_meta": {
            "model": MODEL,
            "components": len(merged),
            "components_with_importable_key": with_key,
            "match_methods": dict(methods),
            "registry_size": len(registry),
        },
        "components": sorted(merged, key=lambda c: c["name"].lower()),
        "foundations": foundations,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(index, f, indent=2)

    print(f"\nIndex written → {OUTPUT_PATH}")
    print(f"  components:            {len(merged)}")
    print(f"  with importable key:   {with_key}")
    print(f"  match methods:         {dict(methods)}")


if __name__ == "__main__":
    main()
