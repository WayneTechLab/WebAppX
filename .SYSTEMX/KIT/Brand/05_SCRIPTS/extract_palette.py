#!/usr/bin/env python3
"""Extract an approximate palette from a logo. Results must be human-reviewed."""
from __future__ import annotations
import json, sys
from pathlib import Path
from PIL import Image

def rgb_hex(rgb): return '#%02X%02X%02X' % rgb

def main():
    path=Path(sys.argv[1])
    out=Path(sys.argv[2]) if len(sys.argv)>2 else path.with_suffix('.palette.json')
    im=Image.open(path).convert('RGBA')
    im.thumbnail((800,800))
    pixels=[]
    for r,g,b,a in im.getdata():
        if a<64: continue
        if r>245 and g>245 and b>245: continue
        pixels.append((r,g,b))
    if not pixels: raise SystemExit('No non-background pixels found')
    sample=Image.new('RGB',(len(pixels),1)); sample.putdata(pixels)
    q=sample.quantize(colors=10,method=Image.Quantize.MEDIANCUT).convert('RGB')
    counts=q.getcolors(maxcolors=10000000) or []
    colors=[]
    for count,rgb in sorted(counts,reverse=True):
        if rgb not in colors: colors.append(rgb)
    data={'source':str(path),'note':'Approximate raster sampling; confirm against official brand values.','colors':[{'hex':rgb_hex(c),'rgb':c} for c in colors[:10]]}
    out.write_text(json.dumps(data,indent=2),encoding='utf-8')
    print(json.dumps(data,indent=2))
if __name__=='__main__': main()
