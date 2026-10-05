#!/usr/bin/env python3
from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

EXPECTED = [
    '01_Cover.png','02_Brand_Overview_Typography.png','03_Color_Palette_Logo_Anatomy.png',
    '04_Clear_Space_Minimum_Size_Variations.png','05_Incorrect_Usage_Applications.png','06_Back_Cover.png'
]

def main():
    pages = Path(sys.argv[1])
    out = Path(sys.argv[2])
    thumbs=[]
    for name in EXPECTED:
        im=Image.open(pages/name).convert('RGB')
        im.thumbnail((640,828))
        card=Image.new('RGB',(680,900),'white')
        card.paste(im,((680-im.width)//2,20))
        d=ImageDraw.Draw(card)
        d.text((20,860),name,fill='black')
        thumbs.append(card)
    sheet=Image.new('RGB',(680*3,900*2),(235,235,235))
    for i,im in enumerate(thumbs):
        sheet.paste(im,((i%3)*680,(i//3)*900))
    out.parent.mkdir(parents=True,exist_ok=True)
    sheet.save(out,quality=92)
    print(f'Created: {out}')
if __name__=='__main__': main()
