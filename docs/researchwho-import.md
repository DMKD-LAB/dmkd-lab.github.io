# Publications and member directory

Imported on 2026-10-07 at the lab's request, after inspecting the public pages' DOM:

- [Journal](https://lab.researchwho.com/DSWU-DMKD/paper/): 60 source entries, numbered 60 through 1.
- [Conference](https://lab.researchwho.com/DSWU-DMKD/conference/): 25 source entries, numbered 25 through 1.
- [Patents](https://lab.researchwho.com/DSWU-DMKD/patent/): no records; no placeholder patent was added.
- [Members](https://lab.researchwho.com/DSWU-DMKD/member/): Professor Jehyeok Rew and Alumni Kabeen Kim, Minhye Lee, Goeun Lee, and Serim Park.

## Bibliography

`src/data/publications.json` retains each source ID, number, category, title, author string, displayed date, venue, notes, indexing tags, and links. Records sort by year descending and retain source order within a year. The source's Journal category includes some conference proceedings; its classification is intentionally preserved. Counts describe source entries, not deduplicated publications.

Near-duplicate records and different publication stages remain separate, including Journal #56/#54, #52/#45, #51/#46, and #42/#41. Accepted and Submitted labels remain visible; they do not become claims that a paper was published. The source misspelling “Accpeted” is displayed as “Accepted,” while the raw data is retained. HTML entities and extra whitespace are decoded for readability. Original Korean and English titles and author names are not translated or reconstructed.

Journal #23 (`paper-object-198`) has no author field in the source; it remains blank. A missing or malformed direct paper link is not invented. Plain-text DOI URLs are recognized, and the DOI hostname is normalized to HTTPS where the source omitted the scheme. Conference paper links displayed as plain text are made clickable. Journal #48 has both a source-provided article link and a different explicit PDF URL; both are retained under their respective link labels. Original source record links remain available on every entry.

To reproduce the import, save the two complete public HTML responses as `paper.html` and `conference.html` in a temporary directory, then run `python scripts/import-publications.py <directory>`. This script uses Python's standard library and does not run source-page scripts. No scraping or third-party service is required at site build time.

## People and portraits

`src/data/people.json` contains only the requested professor and alumni. Student accounts already managed through Supabase remain independent. No Auth account or membership permission was created by the import.

Names, interests, source profile links, portrait URLs, and the original department strings are retained. Department names are also rendered in English for the website. No missing email, graduation year, degree, or employment information is invented. Serim Park's source image is a generic profile placeholder and is identified as such in alt text; Minhye Lee's original image is only 96 × 96 pixels and has not been upscaled.

`scripts/import-member-assets.py` downloads the five known public images, preserves orientation, and exports WebP assets under `public/images/members/`. The published directory uses these local images rather than hotlinking the source host. Static imported profiles remain visible if member updates cannot be fetched. If an imported person later publishes a Supabase profile, remove their static record when replacing it to avoid duplicate entries.
