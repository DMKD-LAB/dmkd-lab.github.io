import { escapeHtml as e, safeUrl } from './validation.js';
import { icon } from './icons.js';

const external = 'target="_blank" rel="noopener noreferrer"';
const statusPattern = /^(accepted|accpeted|submitted)/i;

export function publicationRow(p) {
  const notes = p.notes || [];
  const badges = [...(p.tags || []), ...notes.filter(note => statusPattern.test(note))];
  const extraNotes = notes.filter(note => !statusPattern.test(note) && !safeUrl(note) && !note.startsWith('(DOI)'));
  const links = [
    ['Paper', safeUrl(p.url || p.doiUrl)],
    ['DOI', safeUrl(p.doiUrl)],
    ...notes.filter(note => safeUrl(note)).map(note => [note.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Paper', safeUrl(note)]),
    ['Code', safeUrl(p.codeUrl)],
    ['Source', safeUrl(p.sourceUrl)],
  ].filter(([,url], index, all) => url && all.findIndex(([,other]) => other === url) === index);
  return `<article class="publication-row" id="${e(p.id)}">
    <div class="publication-date"><span class="publication-year">${e(p.year)}</span><span>${e(p.date)}</span></div>
    <div class="publication-content"><div class="publication-badges"><span class="small-label">${e(p.type)} · #${e(p.sourceNumber)}</span>${badges.map(badge=>`<span class="publication-badge${statusPattern.test(badge)?' status-badge':''}">${e(badge.replace(/^Accpeted/i,'Accepted'))}</span>`).join('')}</div>
      <h3>${e(p.title)}</h3>${p.authors?`<p class="publication-authors">${e(p.authors)}</p>`:''}<p class="publication-venue">${e(p.venue)}</p>
      ${extraNotes.length?`<p class="publication-notes">${extraNotes.map(e).join(' · ')}</p>`:''}
    </div>
    <div class="paper-links">${links.map(([label,url])=>`<a class="text-link" href="${e(url)}" ${external} aria-label="${label}: ${e(p.title)}">${label} ${icon('northeast')}</a>`).join('')}</div>
  </article>`;
}
