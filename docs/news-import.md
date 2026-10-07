# News archive

Source: [DMKD Lab on ResearchWho](https://lab.researchwho.com/DSWU-DMKD/news/).
Imported on 2026-10-07 after expanding both “더보기” controls and checking all 12 visible records.

`src/data/news.json` stores the source record IDs, displayed dates, photo URLs, and concise English summaries. Names retain their original Korean spelling where an official English spelling was not supplied. The source page remains linked for the full Korean announcements and presentation details.

The archive defaults to oldest first. Records dated 2025-11-21 and 2025-11-29 are sorted by date rather than their source display position. Image upload dates are not used as announcement dates. Two separate entries on 2025-11-29 are preserved.

News photos are stored under `public/images/news/`, so the published site does not depend on the old image host. `scripts/import-news-assets.py` reproduces the WebP exports using Python and Pillow. It also creates three banner assets from the user-supplied root images when those files are present: Earth and blue waves for Home, blue waves for Research, and the campus for Apply / Contact. Original banner files are left untouched.

To add news, append an entry with a unique ID, an ISO date, title, summary, category, and local image path. The page groups and sorts the records automatically.
