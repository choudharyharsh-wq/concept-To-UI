"""
build_registry.py — Builds registry.json from your Figma Design System.

Strategy:
  1. Fetch /component_sets  → gives clean parent component names (e.g. "Button", "Card")
  2. Fetch /components      → gives individual variants; we pick the first variant
                              of each set to use as the importable key
  3. Also include standalone components (not part of any set)

This produces a clean registry of ~50-200 named components instead of 4000+
variant property strings that the LLM cannot reason about.

Usage:
    cd "concept to UI/server"
    python3 scripts/build_registry.py
"""

import os
import json
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

FIGMA_PAT     = os.environ.get("FIGMA_PAT", "")
DS_FILE_KEY   = os.environ.get("FIGMA_DS_FILE_KEY", "")
REGISTRY_PATH = Path(__file__).parent.parent / "figma-DS-extracts" / "registry3.json"
HEADERS       = lambda: {"X-Figma-Token": FIGMA_PAT}


def figma_get(path: str) -> dict:
    url = f"https://api.figma.com/v1{path}"
    r   = requests.get(url, headers=HEADERS(), timeout=30)
    if r.status_code == 403:
        print(f"ERROR: 403 Forbidden — check FIGMA_PAT has read access.")
        sys.exit(1)
    if r.status_code == 404:
        print(f"ERROR: 404 Not Found — check FIGMA_DS_FILE_KEY.")
        sys.exit(1)
    r.raise_for_status()
    return r.json()


def is_variant_name(name: str) -> bool:
    """Returns True if the name looks like a variant property string.
    e.g. 'Button=False', 'Size=Large, State=Default, ...'
    """
    return "=" in name


def clean_name(name: str) -> str:
    """Normalise a component name.
    'Icons/chevron-right' → 'Icons/chevron-right'
    'Buttons/Primary'     → 'Buttons/Primary'
    """
    return name.strip()


def build_registry() -> list[dict]:
    print(f"Fetching component sets from: {DS_FILE_KEY}")
    sets_data       = figma_get(f"/files/{DS_FILE_KEY}/component_sets")
    raw_sets        = sets_data.get("meta", {}).get("component_sets", [])
    print(f"  Found {len(raw_sets)} component sets")

    print(f"Fetching individual components from: {DS_FILE_KEY}")
    comps_data      = figma_get(f"/files/{DS_FILE_KEY}/components")
    raw_components  = comps_data.get("meta", {}).get("components", [])
    print(f"  Found {len(raw_components)} total component instances")

    # Build a map: containing_frame_node_id → list of component keys
    # (so we can pick the first/default variant for each set)
    set_node_to_variants: dict[str, list[dict]] = {}
    standalone: list[dict] = []

    for comp in raw_components:
        containing = comp.get("containing_frame", {}) or {}
        # Variants carry their parent set under containing_frame.containingComponentSet.
        # (Figma removed the old containing_frame.nodeType == "COMPONENT_SET" signal,
        # which silently dropped every multi-variant component from the registry.)
        comp_set      = containing.get("containingComponentSet") or {}
        containing_id = comp_set.get("nodeId", "")

        if containing_id:
            set_node_to_variants.setdefault(containing_id, []).append(comp)
        elif not is_variant_name(comp.get("name", "")):
            standalone.append(comp)

    registry = []
    seen_names: set = set()

    # ── Component sets → use clean set name + first variant key ──────────────
    for cs in raw_sets:
        name    = clean_name(cs.get("name", ""))
        node_id = cs.get("node_id", "")
        desc    = cs.get("description", "")

        if not name or is_variant_name(name):
            continue

        # Get all variants for this set, pick the first one's key
        variants = set_node_to_variants.get(node_id, [])
        if not variants:
            continue

        # Prefer a variant whose name suggests "default" state
        def default_score(v):
            n = v.get("name", "").lower()
            score = 0
            if "default" in n:   score += 10
            if "primary" in n:   score += 5
            if "false" in n:     score += 3   # e.g. "Disabled=False"
            if "enabled" in n:   score += 3
            return score

        variants_sorted = sorted(variants, key=default_score, reverse=True)
        best_key = variants_sorted[0].get("key", "")

        if not best_key or name in seen_names:
            continue

        seen_names.add(name)
        registry.append({
            "name":        name,
            "key":         best_key,
            "node_id":     node_id,          # component-set node id — join key for DS docs
            "description": desc,
            "type":        "component_set",
            "variant_count": len(variants),
        })

    # ── Standalone components (not in any set) ────────────────────────────────
    for comp in standalone:
        name = clean_name(comp.get("name", ""))
        key  = comp.get("key", "")

        if not name or not key or name in seen_names or is_variant_name(name):
            continue

        seen_names.add(name)
        registry.append({
            "name":        name,
            "key":         key,
            "node_id":     comp.get("node_id", ""),   # component node id — join key for DS docs
            "description": comp.get("description", ""),
            "type":        "standalone",
            "variant_count": 1,
        })

    # Sort alphabetically for deterministic LLM prompts
    registry.sort(key=lambda c: c["name"])
    return registry


def main():
    if not FIGMA_PAT or FIGMA_PAT == "your_personal_access_token_here":
        print("ERROR: FIGMA_PAT is not set in .env")
        sys.exit(1)
    if not DS_FILE_KEY:
        print("ERROR: FIGMA_DS_FILE_KEY is not set in .env")
        sys.exit(1)

    reg = build_registry()

    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_PATH, "w") as f:
        json.dump(reg, f, indent=2)

    print(f"\nRegistry written → {REGISTRY_PATH}")
    print(f"Total usable components: {len(reg)}")
    print(f"  Component sets:  {sum(1 for c in reg if c['type'] == 'component_set')}")
    print(f"  Standalone:      {sum(1 for c in reg if c['type'] == 'standalone')}")
    print("\nAll components:")
    for c in reg:
        variants = f" ({c['variant_count']} variants)" if c["variant_count"] > 1 else ""
        print(f"  [{c['key'][:8]}…]  {c['name']}{variants}")


if __name__ == "__main__":
    main()
