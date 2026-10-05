#!/usr/bin/env python3
"""Create technical logo variants from a supplied logo without redrawing it."""
from __future__ import annotations
import sys
from pathlib import Path
from collections import deque
from PIL import Image, ImageOps

def dist(a,b): return sum((a[i]-b[i])**2 for i in range(3))**0.5

def remove_connected_background(im, threshold=38):
    rgba=im.convert('RGBA'); rgb=rgba.convert('RGB'); w,h=rgb.size
    corners=[rgb.getpixel((0,0)),rgb.getpixel((w-1,0)),rgb.getpixel((0,h-1)),rgb.getpixel((w-1,h-1))]
    bg=tuple(sum(c[i] for c in corners)//4 for i in range(3))
    seen=bytearray(w*h); q=deque()
    for x in range(w): q.append((x,0)); q.append((x,h-1))
    for y in range(h): q.append((0,y)); q.append((w-1,y))
    pix=rgb.load(); alpha=Image.new('L',(w,h),255); ap=alpha.load()
    while q:
        x,y=q.popleft(); idx=y*w+x
        if seen[idx]: continue
        seen[idx]=1
        if dist(pix[x,y],bg)>threshold: continue
        ap[x,y]=0
        if x>0:q.append((x-1,y))
        if x<w-1:q.append((x+1,y))
        if y>0:q.append((x,y-1))
        if y<h-1:q.append((x,y+1))
    rgba.putalpha(alpha); return rgba

def solid(mask,color):
    out=Image.new('RGBA',mask.size,(*color,0)); fill=Image.new('RGBA',mask.size,(*color,255)); out.paste(fill,(0,0),mask); return out

def main():
    src=Path(sys.argv[1]); outdir=Path(sys.argv[2]); outdir.mkdir(parents=True,exist_ok=True)
    fg=remove_connected_background(Image.open(src))
    fg.save(outdir/'logo_full_color_transparent.png')
    gray=ImageOps.grayscale(fg.convert('RGB')).convert('RGBA'); gray.putalpha(fg.getchannel('A')); gray.save(outdir/'logo_grayscale.png')
    mask=fg.getchannel('A')
    solid(mask,(180,25,25)).save(outdir/'logo_one_color_red.png')
    solid(mask,(0,0,0)).save(outdir/'logo_black.png')
    reversed_bg=Image.new('RGBA',fg.size,(18,18,18,255)); reversed_bg.alpha_composite(solid(mask,(255,255,255))); reversed_bg.save(outdir/'logo_reversed_on_black.png')
    print(f'Created technical variants in {outdir}')
if __name__=='__main__': main()
