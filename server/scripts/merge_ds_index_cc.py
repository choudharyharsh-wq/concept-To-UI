"""
merge_ds_index_cc.py — Join the per-doc component extractions (produced by Claude
Code subagents into figma-DS-extracts/_intermediate/) with registry3.json to
attach importable Figma keys, then write ds_index-usingCC.json.

Matching:
  1. node_id exact  -> method "node_id"
  2. normalised name exact -> method "name_exact"
  3. normalised name fuzzy (high-confidence, ratio >= 0.90) -> method "name_fuzzy"
  4. else -> unmatched (key="", variant_count=null)
"""
import json
import re
import difflib
from pathlib import Path

BASE = Path(__file__).parent.parent / "figma-DS-extracts"
INTER = BASE / "_intermediate"
REGISTRY = BASE / "registry3.json"
OUTPUT = BASE / "ds_index-usingCC.json"

COMPONENT_FILES = ["atoms.json", "atoms2.json", "molecules.json",
                   "molecules2.json", "organisms.json", "patterns.json"]
FUZZY_THRESHOLD = 0.94


def _strip_numbering(s: str) -> str:
    return re.sub(r"^\s*\d+[a-z]?(\.\d+)*[.)]?\s+", "", s.strip())


def norm_keep(name: str) -> str:
    """Normalise but KEEP parenthetical content as words, drop punctuation.
    So 'Radio with Text (Stack)' -> 'radio with text stack', which matches the
    registry's 'Radio with text - Stack'. This disambiguates Stack/Unit pairs."""
    s = _strip_numbering(name)
    s = s.replace("(", " ").replace(")", " ")
    s = re.sub(r"[-/_.\[\]+*]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()


def norm_strip(name: str) -> str:
    """Normalise and DROP parenthetical annotations entirely
    ('Tab Unit (Base)' -> 'tab unit'). Secondary form for the join."""
    s = _strip_numbering(name)
    s = re.sub(r"\*?\([^)]*\)\*?", "", s)
    s = s.strip(" ._[]")
    s = re.sub(r"[-/_.\[\]+*]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.lower().strip()


def main():
    registry = json.loads(REGISTRY.read_text())
    by_node = {}
    by_keep = {}
    by_strip = {}
    for e in registry:
        nid = (e.get("node_id") or "").strip()
        if nid:
            by_node.setdefault(nid, e)
        k = norm_keep(e.get("name", ""))
        if k:
            by_keep.setdefault(k, e)
        s = norm_strip(e.get("name", ""))
        if s:
            by_strip.setdefault(s, e)
    keep_keys = list(by_keep.keys())

    components = []
    for fname in COMPONENT_FILES:
        data = json.loads((INTER / fname).read_text())
        for c in data["components"]:
            components.append(c)

    out_components = []
    methods = {"node_id": 0, "name_exact": 0, "name_fuzzy": 0, "unmatched": 0}

    for c in components:
        node_id = (c.get("node_id") or "").strip()
        match_entry = None
        method = "unmatched"

        # 1. node_id exact
        if node_id and node_id in by_node:
            match_entry = by_node[node_id]
            method = "node_id"
        else:
            nk = norm_keep(c["name"])
            ns = norm_strip(c["name"])
            # 2. name exact — try the fuller (paren-kept) form first so that
            #    Stack/Unit variants resolve to the correct registry entry.
            if nk and nk in by_keep:
                match_entry = by_keep[nk]
                method = "name_exact"
            elif ns and ns in by_strip:
                match_entry = by_strip[ns]
                method = "name_exact"
            else:
                # 3. fuzzy, high confidence only
                best = difflib.get_close_matches(nk, keep_keys, n=1, cutoff=FUZZY_THRESHOLD)
                if best:
                    match_entry = by_keep[best[0]]
                    method = "name_fuzzy"

        matched = match_entry is not None
        methods[method] += 1

        key = match_entry["key"] if matched else ""
        # prefer the doc's node_id; fall back to the registry node_id on a name match
        resolved_node_id = node_id or (match_entry.get("node_id", "") if matched else "")
        variant_count = match_entry.get("variant_count") if matched else None

        out_components.append({
            "name": c["name"],
            "category": c.get("category", ""),
            "key": key,
            "node_id": resolved_node_id,
            "variant_count": variant_count,
            "description": c.get("description", ""),
            "properties": c.get("properties", []),
            "variants": c.get("variants", []),
            "use_cases": c.get("use_cases", []),
            "rules": c.get("rules", []),
            "_match": {
                "matched": matched,
                "method": method,
                "registry_name": match_entry["name"] if matched else None,
            },
        })

    out_components.sort(key=lambda x: x["name"].lower())

    foundations = json.loads((INTER / "foundations.json").read_text())

    with_key = sum(1 for c in out_components if c["key"])
    result = {
        "_meta": {
            "components": len(out_components),
            "components_with_importable_key": with_key,
            "match_methods": methods,
        },
        "components": out_components,
        "foundations": foundations,
    }

    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False))

    # validate parseable
    json.loads(OUTPUT.read_text())

    print(f"WROTE {OUTPUT}")
    print(f"total components: {len(out_components)}")
    print(f"with importable key: {with_key}")
    print(f"match methods: {methods}")
    print("\nUNMATCHED / fuzzy (review):")
    for c in out_components:
        if c["_match"]["method"] in ("unmatched", "name_fuzzy"):
            print(f"  [{c['_match']['method']}] {c['name']!r} (cat={c['category']}, node_id={c['node_id'] or '-'}) -> registry={c['_match']['registry_name']!r}")


if __name__ == "__main__":
    main()
