"""Render sourced PDF figure regions for the three October 2026 additions.

Place the original PDFs in paperpdf/ as named in the manifest, then run:
    python scripts/extract_publication_figures.py
Requires PyMuPDF; source hashes protect against extracting from a different version.
"""

import hashlib
import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / 'data/publication_sources_2026.json').read_text(encoding='utf-8'))
    for entry in manifest:
        source = ROOT / entry['localFile']
        if hashlib.sha256(source.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError(f'Source PDF hash mismatch: {source.name}')
        with fitz.open(source) as document:
            for figure in entry['figures']:
                page = document[figure['page'] - 1]
                clip = fitz.Rect(figure['clip'])
                if clip.is_empty or not page.rect.contains(clip):
                    raise ValueError(f'Invalid crop: {figure["src"]}')
                output = ROOT / figure['src']
                output.parent.mkdir(parents=True, exist_ok=True)
                page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip, alpha=False).save(output)
                print(output.relative_to(ROOT))


if __name__ == '__main__':
    main()
