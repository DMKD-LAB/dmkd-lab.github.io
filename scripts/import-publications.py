"""Import the lab's public bibliography using only Python's standard library.

Save paper.html and conference.html from the source URLs into the supplied
directory, then run: python scripts/import-publications.py <directory>
The browser DOM was checked against these card classes before import.
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://lab.researchwho.com/DSWU-DMKD/'


class Element:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []

    def text(self):
        return ''.join(child if isinstance(child, str) else child.text() for child in self.children)

    def find_all(self, predicate):
        result = []
        for child in self.children:
            if isinstance(child, Element):
                if predicate(child):
                    result.append(child)
                result.extend(child.find_all(predicate))
        return result

    def by_class(self, name):
        return self.find_all(lambda el: name in el.attrs.get('class', '').split())


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Element()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.current.children.append(Element(tag, attrs, self.current))

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def clean(text):
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def safe_link(value):
    value = value.strip()
    parsed = urlsplit(value)
    return value if parsed.scheme in {'http', 'https'} and parsed.netloc and not re.search(r'\s', value) else ''


def extract(path, section, category):
    cards = Document(path.read_text(encoding='utf-8')).root.by_class('lab-page-service-object')
    records = []
    for card in cards:
        heading = clean(card.by_class('lab-page-service-title-text')[0].text())
        number, title = re.fullmatch(r'#(\d+)\.\s*(.+)', heading).groups()
        descriptions = [clean(el.text()) for el in card.by_class('lab-page-service-description-text')]
        if category == 'Journal':
            date_index = next(i for i, value in enumerate(descriptions) if re.match(r'\d{4}', value))
            date, venue = descriptions[date_index].split(' · ', 1)
            authors = descriptions[0] if date_index else ''
            notes = descriptions[date_index + 1:]
        else:
            venue, date = descriptions[1:3]
            authors = descriptions[0]
            notes = descriptions[3:]
        year = re.match(r'\d{4}', date)
        assert year, (section, number, date)
        links = [(clean(a.text()), safe_link(a.attrs.get('href', ''))) for a in card.find_all(lambda el: el.tag == 'a')]
        links = [(label, url) for label, url in links if url]
        paper = next((url for label, url in links if '원문' in label), '')
        doi = next((url for label, url in links if 'doi.org/' in url), '')
        if not doi:
            for note in notes:
                match = re.search(r'(?:www\.)?doi\.org/(10\.\S+)', note)
                if match:
                    doi = 'https://doi.org/' + match.group(1)
                    break
        # Some conference cards display their paper URL as text rather than a link.
        plain_urls = [safe_link(note) for note in notes if note.startswith(('https://', 'http://'))]
        paper = paper or doi or next((url for url in plain_urls if url), '')
        tags = [clean(el.text()) for block in card.by_class('lab-page-service-additional-card') for el in block.children if isinstance(el, Element) and el.tag == 'div']
        source_id = card.attrs['id']
        records.append({
            'id': f'{section}-{source_id}', 'sourceNumber': int(number), 'title': title,
            'authors': authors, 'venue': venue, 'date': date, 'year': int(year.group()),
            'type': category, 'url': paper, 'doiUrl': doi, 'tags': tags,
            'notes': notes, 'sourceUrl': f'{SOURCE}{section}/#{source_id}',
        })
    return records


if __name__ == '__main__':
    directory = Path(sys.argv[1])
    records = extract(directory / 'paper.html', 'paper', 'Journal') + extract(directory / 'conference.html', 'conference', 'Conference')
    assert len({item['id'] for item in records}) == len(records)
    records.sort(key=lambda item: item['year'], reverse=True)
    (ROOT / 'src/data/publications.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(records)} source records; years {min(p["year"] for p in records)}–{max(p["year"] for p in records)}.')
    for category in ['Journal', 'Conference']:
        print(category, sum(p['type'] == category for p in records))
