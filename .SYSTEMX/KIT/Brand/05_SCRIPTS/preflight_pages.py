#!/usr/bin/env python3
"""Preflight six page images for dimensions, order, edge safety, and consistency."""
from __future__ import annotations
import json
import sys
from pathlib import Path
from PIL import Image, ImageStat

EXPECTED = [
    '01_Cover.png',
    '02_Brand_Overview_Typography.png',
    '03_Color_Palette_Logo_Anatomy.png',
    '04_Clear_Space_Minimum_Size_Variations.png',
    '05_Incorrect_Usage_Applications.png',
    '06_Back_Cover.png',
]

def edge_density(im: Image.Image, pct: float = 0.02) -> float:
    rgb = im.convert('RGB')
    w, h = rgb.size
    x = max(2, int(w*pct)); y = max(2, int(h*pct))
    strips = [rgb.crop((0,0,w,y)), rgb.crop((0,h-y,w,h)), rgb.crop((0,0,x,h)), rgb.crop((w-x,0,w,h))]
    total = 0; dark = 0
    for s in strips:
        for r,g,b in s.getdata():
            total += 1
            # Thin pale borders are tolerated; dark/strong content near trim is not.
            if min(r,g,b) < 120 and max(r,g,b)-min(r,g,b) > 8:
                dark += 1
    return dark / max(total,1)

def main():
    pages = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('06_OUTPUT/pages')
    report = {'pages_dir': str(pages), 'errors': [], 'warnings': [], 'pages': []}
    dims = []
    for name in EXPECTED:
        path = pages / name
        if not path.exists():
            report['errors'].append(f'Missing {name}')
            continue
        with Image.open(path) as im:
            w,h = im.size
            dims.append((w,h))
            ratio = w/h
            density = edge_density(im)
            page = {'file': name, 'width': w, 'height': h, 'aspect_ratio': ratio, 'edge_dark_density': round(density,5)}
            report['pages'].append(page)
            if h <= w:
                report['errors'].append(f'{name} is not portrait')
            if min(w,h) < 1275:
                report['errors'].append(f'{name} is below 150-DPI Letter resolution')
            if min(w,h) < 2550:
                report['warnings'].append(f'{name} is below the preferred 300-DPI Letter resolution')
            if abs(ratio - (8.5/11.0)) > 0.015:
                report['errors'].append(f'{name} does not match US Letter aspect ratio')
            if density > 0.035:
                report['warnings'].append(f'{name} has strong dark content in the outer 2% trim zone; inspect print safety')
    if dims and any(d != dims[0] for d in dims):
        report['errors'].append('Page dimensions are not identical')
    out = pages.parent / 'preflight_report.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    if report['errors']:
        raise SystemExit(2)

if __name__ == '__main__':
    main()
