#!/usr/bin/env python3
"""Read-only by default: regenerate only marked BCQ fragments with --apply."""
import argparse
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
config = json.loads(Path(__file__).with_name("quality-guarantee.json").read_text(encoding="utf-8"))
parser = argparse.ArgumentParser()
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
pending = []
for page in config["pages"]:
    path = root / page["path"]
    before = path.read_bytes().decode("utf-8")
    after = before
    fragment = config["fragments"][page["variant"]]
    expected = {"CSS": config["css"], "HERO": fragment["hero"]}
    if page["detail"]:
        expected["DETAIL"] = fragment["detail"]
    for name, markup in expected.items():
        start = "<!-- BCQ:" + name + ":BEGIN -->"
        end = "<!-- BCQ:" + name + ":END -->"
        if after.count(start) != 1 or after.count(end) != 1:
            raise SystemExit("Missing/duplicate marker: " + page["path"] + " " + name)
        block = start + "\n" + markup + "\n" + end
        after = re.sub(re.escape(start) + r"[\s\S]*?" + re.escape(end),
                       lambda _: block, after, count=1)
    if before != after:
        pending.append((path, after))
if pending and not args.apply:
    raise SystemExit("STALE fragments: " + ", ".join(str(p.relative_to(root)) for p, _ in pending))
if args.apply:
    for path, content in pending:
        path.write_bytes(content.encode("utf-8"))
print(f"BCQ: {len(config['pages'])} pages; {len(pending)} updated" if args.apply else f"BCQ: {len(config['pages'])} pages match manifest")
