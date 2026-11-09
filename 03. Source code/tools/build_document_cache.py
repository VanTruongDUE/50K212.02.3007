"""Create searchable local Markdown copies of the project Office documents."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from markitdown import MarkItDown
from openpyxl import load_workbook


PROJECT_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = PROJECT_DIR.parent
CACHE_DIR = PROJECT_DIR / ".context-cache"
MANIFEST = CACHE_DIR / "manifest.json"
SOURCE_FOLDERS = ("01. Thu thập yêu cầu", "02. Phân tích và thiết kế hệ thống")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def convert_xlsx(path: Path) -> str:
    workbook = load_workbook(path, read_only=True, data_only=False)
    sections = []
    try:
        for sheet in workbook:
            lines = [f"# {sheet.title}"]
            for row in sheet:
                for cell in row:
                    if cell.value is not None:
                        value = " ".join(str(cell.value).split())
                        lines.append(f"- **{cell.coordinate}**: {value}")
            sections.append("\n".join(lines))
    finally:
        workbook.close()
    return "\n\n".join(sections)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    current = {}
    converter = MarkItDown()

    for folder_name in SOURCE_FOLDERS:
        folder = REPO_DIR / folder_name
        for source in sorted(folder.iterdir()):
            if source.suffix.lower() not in {".docx", ".xlsx"} or source.name.startswith("~$"):
                continue

            relative = source.relative_to(REPO_DIR)
            key = relative.as_posix()
            output = CACHE_DIR / relative.with_suffix(".md")
            fingerprint = sha256(source)
            current[key] = {
                "sha256": fingerprint,
                "cache": output.relative_to(CACHE_DIR).as_posix(),
                "format": "cells-v1" if source.suffix.lower() == ".xlsx" else "markitdown-v1",
            }

            if previous.get(key) == current[key] and output.exists():
                print(f"Unchanged: {key}")
                continue

            markdown = convert_xlsx(source) if source.suffix.lower() == ".xlsx" else converter.convert(str(source)).markdown
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(f"<!-- Generated from {key}; verify important details in the original. -->\n\n{markdown}", encoding="utf-8")
            print(f"Updated: {key}")

    CACHE_DIR.mkdir(exist_ok=True)
    MANIFEST.write_text(json.dumps(current, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stale = sorted(set(previous) - set(current))
    if stale:
        print("Source removed; old cache files need review:", ", ".join(stale))


if __name__ == "__main__":
    main()
