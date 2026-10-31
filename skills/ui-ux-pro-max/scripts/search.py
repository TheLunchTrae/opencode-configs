#!/usr/bin/env python3
"""Search the bundled UI/UX references without creating project files."""

import argparse
import json
from pathlib import Path
import sys

# Resolve sibling imports even with an embedded Python runtime or another cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True

from core import AVAILABLE_STACKS, MAX_RESULTS, search, search_stack


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="One design concern in a few keywords")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--domain", choices=(
        "style", "color", "chart", "product", "typography", "ux", "landing",
    ))
    mode.add_argument("--stack", choices=AVAILABLE_STACKS)
    parser.add_argument("--max-results", "-n", type=int, choices=range(1, 21),
                        default=MAX_RESULTS, metavar="1-20")
    args = parser.parse_args()
    if not args.query.strip():
        parser.error("query must not be empty")

    if args.stack:
        result = search_stack(args.query, args.stack, args.max_results)
    else:
        result = search(args.query, args.domain, args.max_results)
    # ASCII JSON remains portable on Windows consoles with legacy encodings.
    print(json.dumps(result, indent=2, ensure_ascii=True))
    return 1 if "error" in result else 0


if __name__ == "__main__":
    raise SystemExit(main())
