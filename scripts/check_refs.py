"""Vérifie les références locales du site statique.

- chaque fichier local cité (src, href, import) existe ;
- un même fichier porte le même numéro de cache `?v=` partout.
Sans dépendance : `python scripts/check_refs.py`.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "light.html", "scene.js", "audio.js"]
# Tout chemin local vers un script ou un média (avec un dossier ou « ./ »), où qu'il soit.
REF = re.compile(
    r"""(?<=["',\s(])((?:\./[\w.-]+|[\w-]+(?:/[\w.-]+)+)\.(?:js|css|jpg|jpeg|png|webp|svg|mp4|webm|pdf))"""
    r"""(\?v=(\d+))?(?=["',\s)])"""
)


def main() -> int:
    errors: list[str] = []
    versions: dict[str, set[str]] = {}
    for page in PAGES:
        text = (ROOT / page).read_text(encoding="utf-8")
        for match in REF.finditer(text):
            path, version = match.group(1), match.group(3)
            # Les modules « three/... » passent par l'import map (CDN), pas par un fichier local.
            if path.startswith(("http", "//", "#", "data:", "mailto:", "three")) or "." not in path:
                continue
            local = path.removeprefix("./")
            if not (ROOT / local).is_file():
                errors.append(f"{page} : fichier introuvable {path}")
            if version:
                versions.setdefault(local, set()).add(version)
    for path, found in sorted(versions.items()):
        if len(found) > 1:
            errors.append(f"{path} : numéros ?v= différents {sorted(found)}")
    for error in errors:
        print(error)
    print(f"{len(errors)} problème(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
