"""Vérifie que les textes du site ne dérivent pas.

- `textes.js` a les mêmes clés en français et en anglais ;
- chaque clé utilisée par index.html (`T[lang].cle`) et light.html (`data-i18n`) existe ;
- le texte par défaut d'un élément `data-i18n` de light.html (affiché sans JavaScript)
  est identique au français de `textes.js`.
Sans dépendance : `python scripts/check_textes.py`.
"""

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = "window.PORTFOLIO_TEXTES = "


def load_textes() -> dict:
    text = (ROOT / "textes.js").read_text(encoding="utf-8")
    start = text.index(PREFIX) + len(PREFIX)
    return json.loads(text[start:].rstrip().rstrip(";"))


def main() -> int:
    textes = load_textes()
    fr, en = textes["fr"], textes["en"]
    errors = [f"clé sans traduction anglaise : {k}" for k in fr if k not in en]
    errors += [f"clé sans texte français : {k}" for k in en if k not in fr]

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    for key in sorted(set(re.findall(r"T\[lang\]\.(\w+)", index))):
        if key not in fr:
            errors.append(f"index.html : clé inconnue {key}")

    light = (ROOT / "light.html").read_text(encoding="utf-8")
    element = re.compile(r'<(\w+)[^>]*?data-i18n="(\w+)"[^>]*>([^<]*)</\1>')
    for _tag, key, default in element.findall(light):
        if key not in fr:
            errors.append(f"light.html : clé inconnue {key}")
        elif html.unescape(default) != fr[key]:
            errors.append(f"light.html : texte par défaut différent de textes.js pour {key}")
    for key in re.findall(r'data-cap="(\w+)"', light):
        if key not in fr:
            errors.append(f"light.html : légende inconnue {key}")

    for error in errors:
        print(error)
    print(f"{len(fr)} clés, {len(errors)} problème(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
