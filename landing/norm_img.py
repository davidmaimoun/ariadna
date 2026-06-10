#!/usr/bin/env python3
"""
make_16x10.py  —  Normalize AriaDNA screenshots to a clean 16:10 ratio.

Why: the landing page shows each screenshot inside a 16:10 browser mockup.
If the source image isn't 16:10, CSS either crops it (object-fit:cover) or
leaves borders (object-fit:contain). Fixing the FILES to 16:10 removes the
problem entirely — cover and contain then look identical: full frame, no crop.

Two modes (set MODE below):
  "pad"  -> never lose anything. Keeps the whole screenshot and adds a matching
            background so the canvas becomes 16:10. (Recommended for UI shots.)
  "crop" -> fills 16:10 by trimming the longer side from the center. No borders,
            but edges may be cut. Use only if your shots have safe margins.

Usage:
  1) pip install pillow
  2) put your screenshots in ./in   (or change SRC_DIR)
  3) python make_16x10.py
  4) grab the results in ./out  (same filenames)

Tip: target height 800 -> output 1280x800, which matches the mockup exactly.
"""

from PIL import Image
import os

# ─────────── settings ───────────
SRC_DIR   = "in"          # folder with your original screenshots
OUT_DIR   = "out"         # where normalized images are written
MODE      = "pad"         # "pad" (no loss) or "crop" (fill, may trim)
TARGET_W  = 1280          # output width  (16:10 -> height 800)
TARGET_H  = 800           # output height
BG        = (11, 26, 74)  # pad background = #0b1a4a (matches the mockup card)
RATIO     = TARGET_W / TARGET_H   # 1.6

# Your 6 files (rename here if yours differ). Any file in SRC_DIR is processed
# anyway; this list is just to report which ones were found.
EXPECTED = [
    "seq_viewer_cut.png",
    "multi_al.png",
    "tree_viewer.png",
    "heatmap.png",
    "sanger.png",
    "vcf.png",
]


def fit_pad(img):
    """Scale the whole image to fit inside TARGET, then center it on a BG canvas."""
    img = img.convert("RGB")
    w, h = img.size
    scale = min(TARGET_W / w, TARGET_H / h)
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGB", (TARGET_W, TARGET_H), BG)
    canvas.paste(resized, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2))
    return canvas


def fit_crop(img):
    """Scale to cover TARGET, then center-crop to exactly TARGET (no borders)."""
    img = img.convert("RGB")
    w, h = img.size
    scale = max(TARGET_W / w, TARGET_H / h)
    new_w, new_h = round(w * scale), round(h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - TARGET_W) // 2
    top  = (new_h - TARGET_H) // 2
    return resized.crop((left, top, left + TARGET_W, top + TARGET_H))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isdir(SRC_DIR):
        print(f"!! Source folder '{SRC_DIR}' not found. Create it and add your PNGs.")
        return

    files = [f for f in os.listdir(SRC_DIR)
             if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
    if not files:
        print(f"!! No images found in '{SRC_DIR}'.")
        return

    transform = fit_pad if MODE == "pad" else fit_crop
    print(f"Mode: {MODE}  ->  {TARGET_W}x{TARGET_H} (ratio {RATIO:.2f})\n")

    for name in sorted(files):
        src = os.path.join(SRC_DIR, name)
        try:
            with Image.open(src) as im:
                ow, oh = im.size
                out = transform(im)
                dst = os.path.join(OUT_DIR, name)
                out.save(dst, "PNG", optimize=True)
                print(f"  ✓ {name:24s} {ow}x{oh}  ->  {TARGET_W}x{TARGET_H}")
        except Exception as e:
            print(f"  ✗ {name:24s} ERROR: {e}")

    missing = [f for f in EXPECTED if f not in files]
    if missing:
        print("\n  (note) expected but not found:", ", ".join(missing))

    print(f"\nDone. Normalized images are in ./{OUT_DIR}/")
    print("Copy them into your site's /assets/ folder (same names) and the")
    print("mockups will be full-frame with no crop and no borders.")


if __name__ == "__main__":
    main()