#!/usr/bin/env python
"""i18n key consistency check for desktop translations."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRANSLATIONS_FILE = PROJECT_ROOT / "desktop" / "src" / "i18n" / "translations.ts"


def _extract_keys(section: str, content: str) -> set[str]:
    marker = f"{section}: {{"
    start = content.find(marker)
    if start == -1:
        raise RuntimeError(f"Missing section marker: {marker}")
    block = content[start + len(marker) :]

    depth = 1
    index = 0
    while index < len(block) and depth > 0:
        char = block[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        index += 1

    if depth != 0:
        raise RuntimeError(f"Unbalanced braces in section: {section}")

    section_body = block[: index - 1]
    keys: set[str] = set()
    for line in section_body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        if ":" not in stripped:
            continue
        key = stripped.split(":", 1)[0].strip()
        if key and key.replace("_", "").replace("-", "").isalnum():
            keys.add(key)
    return keys


def main() -> int:
    content = TRANSLATIONS_FILE.read_text(encoding="utf-8")

    zh_keys = _extract_keys("zh", content)
    en_keys = _extract_keys("en", content)

    zh_only = sorted(zh_keys - en_keys)
    en_only = sorted(en_keys - zh_keys)

    if zh_only or en_only:
        print("i18n check: failed")
        if zh_only:
            print(f"- zh only keys: {', '.join(zh_only)}")
        if en_only:
            print(f"- en only keys: {', '.join(en_only)}")
        return 1

    print("i18n check: ok")
    print(f"- keys count: {len(zh_keys)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
