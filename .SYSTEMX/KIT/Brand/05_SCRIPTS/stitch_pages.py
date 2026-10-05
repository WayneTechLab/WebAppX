#!/usr/bin/env python3
"""Stitch six approved page images into a US Letter PDF."""
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader

EXPECTED = [
    '01_Cover.png',
    '02_Brand_Overview_Typography.png',
    '03_Color_Palette_Logo_Anatomy.png',
    '04_Clear_Space_Minimum_Size_Variations.png',
    '05_Incorrect_Usage_Applications.png',
    '06_Back_Cover.png',
]

def main():
    p = argparse.ArgumentParser()
    p.add_argument('pages_dir', type=Path)
    p.add_argument('output_pdf', type=Path)
    p.add_argument('--title', default='Brand Guidelines')
    p.add_argument('--author', default='Wayne Tech Lab LLC.')
    args = p.parse_args()

    missing = [n for n in EXPECTED if not (args.pages_dir / n).exists()]
    if missing:
        raise SystemExit('Missing page images: ' + ', '.join(missing))

    args.output_pdf.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(args.output_pdf), pagesize=letter, pageCompression=1)
    c.setTitle(args.title)
    c.setAuthor(args.author)
    page_w, page_h = letter
    for name in EXPECTED:
        path = args.pages_dir / name
        with Image.open(path) as im:
            if im.width <= 0 or im.height <= 0:
                raise SystemExit(f'Invalid image: {path}')
        c.drawImage(ImageReader(str(path)), 0, 0, width=page_w, height=page_h, preserveAspectRatio=False, mask='auto')
        c.showPage()
    c.save()
    print(f'Created: {args.output_pdf}')

if __name__ == '__main__':
    main()
