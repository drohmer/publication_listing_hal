"""Synchronise src/ et scripts/ vers chaque exemple dans examples/.

Usage: python build_examples.py
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).parent
EXAMPLES_DIR = ROOT / "examples"
SOURCES = {
    "src": ROOT / "src",
    "scripts": ROOT / "scripts",
}


def sync_to_example(example: Path) -> None:
    for dest_name, src_path in SOURCES.items():
        dest = example / dest_name
        shutil.copytree(src_path, dest, dirs_exist_ok=True)
        print(f"  {src_path.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")


def main() -> None:
    examples = sorted(p for p in EXAMPLES_DIR.iterdir() if p.is_dir())
    if not examples:
        print("Aucun exemple trouvé dans examples/")
        return

    for example in examples:
        print(f"\n[{example.name}]")
        sync_to_example(example)

    print("\nTerminé.")


if __name__ == "__main__":
    main()
