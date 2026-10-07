"""Store the public portraits requested by the lab as local WebP assets."""
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PEOPLE = json.loads((ROOT / 'src/data/people.json').read_text(encoding='utf-8'))


def import_portrait(person):
    destination = ROOT / 'public' / person['photoUrl'].lstrip('/')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(quote(person['sourceImage'], safe=':/%'), timeout=25) as response:
        original_bytes = response.read()
    with Image.open(io.BytesIO(original_bytes)) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((900, 900), Image.Resampling.LANCZOS)
        image.save(destination, 'WEBP', quality=90, method=6)
    return f'{person["name"]}: {image.width}x{image.height}, {destination.stat().st_size:,} bytes'


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(import_portrait, PEOPLE):
            print(result, flush=True)
