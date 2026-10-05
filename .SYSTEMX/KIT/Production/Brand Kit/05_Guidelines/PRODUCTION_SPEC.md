# Production Specification

- Approved source: 1536 x 1024 px, RGB PNG.
- Approved source SHA-256: `2e91ce076c3178621d6606ab4f3dfd6dab4772ff89b639405a185fea0772bceb`.
- Primary 4K exports: 4096 x 2731 px, preserving the 3:2 master ratio.
- Square symbol export: 4096 x 4096 px.
- Raster scaling: Lanczos resampling, no generative redraw.
- Transparent assets: recovered from the white source and preserved as independent layers.
- Layered masters: SVG and OpenRaster (`.ora`).
- Print conversion: convert to CMYK only at the final vendor stage using the vendor's ICC profile.
- Recommended print raster resolution: 300 PPI at final output size.
