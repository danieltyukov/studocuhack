#!/usr/bin/env python3
"""Renames a font family in place, so a subset never ships under a reserved name.

Subsetting is a modification, and the SIL Open Font Licence reserves the
original family name for unmodified files, so every record a user or a system
could read the family from has to change. That is more records than the obvious
one: a font manager shows nameID 1, but nameID 18 is what some systems show,
nameID 6 is what a PDF embeds, and the fvar instances carry their own
PostScript names that no name-table walk of IDs 1 to 25 would reach.

Three records are deliberately left alone, because the OFL requires them to
survive rather than permitting them to change:

    0  copyright notice
    7  trademark
    8  manufacturer

Those are attribution, not the font's name, and rewriting them would strip the
credit the licence exists to preserve.

The targeted rules below are backed by a sweep for the original family anywhere
else, and then by an assertion: if the reserved name survives in any record it
should not, this exits non-zero rather than writing a file that cannot be
redistributed.
"""

import sys

from fontTools.ttLib import TTFont

# Attribution. The licence requires these to stay as the upstream author wrote
# them, so they are never rewritten and never swept.
ATTRIBUTION_IDS = frozenset({0, 7, 8})


def _instance_names(font: TTFont) -> tuple[frozenset[int], dict[int, int]]:
    """Style and axis name IDs to leave alone, and PostScript IDs to rewrite.

    An fvar instance's subfamily name is "Regular" or "Bold"; rewriting it to
    the family name would leave a font whose styles are all called the same
    thing. Its PostScript name, on the other hand, is a full name and does
    carry the family.
    """
    keep: set[int] = set()
    postscript: dict[int, int] = {}
    if "fvar" not in font:
        return frozenset(keep), postscript

    for axis in font["fvar"].axes:
        keep.add(axis.axisNameID)
    for instance in font["fvar"].instances:
        keep.add(instance.subfamilyNameID)
        ps_id = getattr(instance, "postscriptNameID", 0xFFFF)
        # 0xFFFF means the instance has no PostScript name record of its own.
        if ps_id != 0xFFFF:
            postscript[ps_id] = instance.subfamilyNameID
    return frozenset(keep), postscript


def rename(path: str, family: str, original: str) -> None:
    compact = family.replace(" ", "").replace("-", "")
    original_compact = original.replace(" ", "")

    font = TTFont(path)
    name = font["name"]
    keep_ids, postscript_ids = _instance_names(font)

    def style_of(subfamily_id: int) -> str:
        return (name.getDebugName(subfamily_id) or "Regular").replace(" ", "")

    for record in list(name.names):
        nid = record.nameID
        if nid in ATTRIBUTION_IDS:
            continue
        where = (record.platformID, record.platEncID, record.langID)

        if nid in postscript_ids:
            name.setName(f"{compact}-{style_of(postscript_ids[nid])}", nid, *where)
        elif nid in (1, 4, 16, 18, 21):
            # family, full name, typographic family, compatible full, WWS family
            name.setName(family, nid, *where)
        elif nid == 3:  # unique identifier
            name.setName(f"{family};studocuhack", nid, *where)
        elif nid == 6:  # PostScript name
            name.setName(f"{compact}-Regular", nid, *where)
        elif nid == 25:  # variations PostScript name prefix
            name.setName(compact, nid, *where)
        elif nid not in keep_ids:
            # Anything upstream adds later that mentions the family.
            text = str(record)
            swept = text.replace(original, family).replace(original_compact, compact)
            if swept != text:
                name.setName(swept, nid, *where)

    survivors = [
        (r.nameID, str(r))
        for r in name.names
        if r.nameID not in ATTRIBUTION_IDS
        and (original in str(r) or original_compact in str(r))
    ]
    if survivors:
        for nid, text in survivors:
            print(f"reserved name survives in nameID {nid}: {text!r}", file=sys.stderr)
        raise SystemExit(1)

    font.save(path)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage: rename-font.py <font.ttf> <new family> <original family>", file=sys.stderr)
        raise SystemExit(2)
    rename(sys.argv[1], sys.argv[2], sys.argv[3])
