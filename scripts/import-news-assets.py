"""Download the public news photos identified in the source page's DOM.

Run with Python and Pillow. The checked-in WebP files need no Python at build time.
"""
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
NEWS = json.loads((ROOT / "src/data/news.json").read_text(encoding="utf-8"))


def export_webp(source, destination, size):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail(size, Image.Resampling.LANCZOS)
        image.save(destination, "WEBP", quality=86, method=6)
        return f"{destination.relative_to(ROOT)}: {image.width}x{image.height}, {destination.stat().st_size:,} bytes"


def import_news(item):
    destination = ROOT / "public" / item["image"].lstrip("/")
    with urlopen(item["sourceImage"], timeout=45) as response:
        return export_webp(io.BytesIO(response.read()), destination, (1600, 1600))


if __name__ == "__main__":
    for original in ["background_1.jpg", "background_2.jpg", "background3.png"]:
        path = ROOT / original
        if path.exists():
            print(export_webp(path, ROOT / "public/images/hero" / f"{path.stem}.webp", (1920, 1920)))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(import_news, NEWS):
            print(result)
