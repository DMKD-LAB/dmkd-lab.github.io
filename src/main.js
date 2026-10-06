import './style.css';
import './theme.css';
import './pages.css';
import './typography.css';
import './editorial.css';
import logo from '../logo.png';
import githubIcon from '../free-icon-github-logo-25231.png';
import linkedinIcon from '../free-icon-linkedin-3991775.png';
import scholarIcon from '../icons8-google-학술-검색-50.png';
import { lab, programs, studentPrograms, publications, news, faculty } from './content.js';
import { icon } from './icons.js';
import { initializeHero } from './hero.js';
import { escapeHtml as e, safeUrl } from './validation.js';
import { assetUrl, loadPublicData } from './api.js';
import { initializeMembers, openMemberArea } from './members.js';
import { initializeRouter, navigate } from './router.js';
import { renderAdminPage } from './admin.js';

const mapQuery = encodeURIComponent('덕성여자대학교 차미리사관');
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
const external = 'target="_blank" rel="noopener noreferrer"';
let publicData = { profiles: [], photos: [] };
let activeProgram = 'all';
let loadFailed = false;

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <div class="header-inner container">
      <a href="#home" class="brand" aria-label="DMKD Lab home"><img src="${logo}" alt="DMKD Lab" width="185" height="81"/><span>DUKSUNG WOMEN’S UNIVERSITY</span></a>
      <button class="menu-toggle icon-button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-nav">${icon('menu')}</button>
      <nav id="main-nav" aria-label="Main navigation">
        ${[['home','Home'],['research','Research'],['publications','Publications'],['news','News'],['members','Members'],['apply','Apply / Contact']].map(([id,label])=>`<a href="#${id}" ${id==='home'?'class="active" aria-current="location"':''}>${label}</a>`).join('')}
        <button class="member-access" data-member-open>${icon('user')}<span>Member login</span></button>
      </nav>
    </div>
  </header>
  <main id="main">
    <section id="home" class="hero">
      <div class="hero-slides" aria-hidden="true">
        <div class="hero-slide active" data-caption="A world of possibility" style="--position:center 57%;--mobile-position:62% center"><img src="/images/hero/background_1.webp" alt="" width="1920" height="1278" fetchpriority="high"/></div>
        <div class="hero-slide" data-caption="Patterns into perspective" style="--position:center 49%"><img src="/images/hero/background_2.webp" alt="" width="1440" height="1920" decoding="async"/></div>
        <div class="hero-slide" data-caption="Rooted in curiosity" style="--position:center 57%;--mobile-position:62% center"><img src="/images/hero/background3.webp" alt="" width="1736" height="1142" decoding="async"/></div>
      </div>
      <div class="hero-grid container">
        <div class="hero-copy">
          <p class="eyebrow light"><span class="status-dot"></span> DATA MINING & KNOWLEDGE DISCOVERY</p>
          <h1>From data.<br>To <span>discovery.</span></h1>
          <p class="hero-description">Finding meaningful connections.<br>Opening new possibilities through data.</p>
          <div class="hero-actions"><a class="button primary" href="#research">Explore our research ${icon('arrow')}</a><a class="text-link light" href="#members">Meet the people ${icon('northeast')}</a></div>
        </div>
      </div>
      <div class="hero-bottom container"><div><span class="hero-location">DMKD LAB <span class="divider">/</span> SEOUL, SOUTH KOREA</span><span class="hero-slide-caption">01 / 03 · A world of possibility</span></div><div class="hero-controls" role="group" aria-label="Home background images"><button data-slide="0" aria-label="Show Earth at night background" aria-pressed="true"></button><button data-slide="1" aria-label="Show blue waves background" aria-pressed="false"></button><button data-slide="2" aria-label="Show campus background" aria-pressed="false"></button><button data-slideshow-toggle aria-label="Pause background slideshow">${icon('pause')}</button></div></div>
    </section>
    <div class="intro-strip"><div class="container"><span>Curiosity, connected.</span><p>A research community at <strong>Duksung Women’s University</strong>.</p><a href="#apply" aria-label="Find DMKD Lab">${icon('northeast')}</a></div></div>

    <section id="research" class="section container">
      <div class="section-heading"><div><p class="eyebrow">01 / RESEARCH</p><h2>Questions worth exploring.</h2></div><p class="section-description">From patterns in data to the knowledge they reveal.<br>A space for learning, inquiry, and discovery.</p></div>
      <div class="research-grid">
        <article class="research-card"><div class="research-art art-data"><div class="data-bars">${[36,62,45,84,58,100,72,91,53,79,62,95].map((v)=>`<i style="--height:${v}%"></i>`).join('')}</div><span class="art-index">01</span></div><div class="research-body"><p class="eyebrow">PATTERNS & POSSIBILITIES</p><h3>Data Mining</h3><p>Uncovering useful patterns and relationships in complex data.</p><div class="topic-tags"><span>Patterns</span><span>Data analysis</span></div></div></article>
        <article class="research-card"><div class="research-art art-learning"><div class="learning-orbits"><i></i><i></i><i></i><b></b></div><span class="art-index">02</span></div><div class="research-body"><p class="eyebrow">LEARNING FROM DATA</p><h3>Machine Learning</h3><p>Exploring how computational models learn, adapt, and generalize.</p><div class="topic-tags"><span>Learning</span><span>Intelligence</span></div></div></article>
        <article class="research-card"><div class="research-art art-knowledge"><div class="knowledge-nodes">${icon('network')}</div><span class="art-index">03</span></div><div class="research-body"><p class="eyebrow">CONNECTIONS & INSIGHT</p><h3>Knowledge Discovery</h3><p>Turning information into interpretable connections and new understanding.</p><div class="topic-tags"><span>Connections</span><span>Understanding</span></div></div></article>
      </div>
      <p class="section-note">Specific projects and research updates will be shared here as they become available.</p>
    </section>

    <section id="publications" class="section section-tint"><div class="container">
      <div class="section-heading"><div><p class="eyebrow">02 / PUBLICATIONS</p><h2>Knowledge, shared.</h2></div><span class="section-description">Our papers and research contributions.</span></div>
      <div class="publication-toolbar"><label class="search-field">${icon('search')}<input id="publication-search" type="search" placeholder="Search title, author, or venue" aria-label="Search publications"/></label><select id="publication-year" aria-label="Filter publications by year"><option value="all">All years</option>${[...new Set(publications.map(p=>p.year))].sort((a,b)=>b-a).map(y=>`<option value="${e(y)}">${e(y)}</option>`).join('')}</select></div>
      <div id="publication-list"></div>
    </div></section>

    <section id="news" class="section container">
      <div class="section-heading"><div><p class="eyebrow">03 / NEWS & LAB LIFE</p><h2>A closer look at the lab.</h2></div><span class="section-description">Ideas, moments, and milestones along the way.</span></div>
      <div class="news-toolbar"><nav class="news-year-links" aria-label="News by year">${[...new Set(news.map(n=>n.date.slice(0,4)))].sort().map(year=>`<a href="#news-year-${year}">${year}</a>`).join('')}</nav><label class="news-sort">Reading order <select id="news-order" aria-label="News reading order"><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label></div>
      <div id="news-list"></div>
      <p class="news-source-note">Explore the full announcements in our <a href="https://lab.researchwho.com/DSWU-DMKD/news/" ${external}>original news archive ${icon('northeast')}</a>.</p>
      <div class="subsection-heading gallery-heading"><div><p class="eyebrow">BEHIND THE RESEARCH</p><h3>Life at DMKD</h3></div><button class="text-link" data-member-open>Share a lab moment ${icon('upload')}</button></div>
      <div id="gallery-list" class="gallery-grid"></div>
    </section>

    <section id="members" class="section section-tint"><div class="container">
      <div class="section-heading"><div><p class="eyebrow">04 / OUR PEOPLE</p><h2>Different minds.<br>Shared curiosity.</h2></div><div><p class="section-description">Meet the people behind the questions.</p><button class="text-link" data-member-open>Already a member? Edit your profile ${icon('arrow')}</button></div></div>
      <div class="filter-tabs" role="group" aria-label="Filter members by program"><button class="filter-tab active" data-program="all" aria-pressed="true">All members</button>${programs.map(p=>`<button class="filter-tab" data-program="${p.value}" aria-pressed="false">${p.short}</button>`).join('')}</div>
      <div id="member-list" aria-live="polite"></div>
    </div></section>

    <section id="apply" class="section container">
      <div class="apply-banner"><div><p class="eyebrow light">05 / JOIN THE CONVERSATION</p><h2>Your curiosity<br>belongs here.</h2><p>Interested in exploring data and discovery with us?<br>Get to know the lab and start a conversation.</p><a href="#contact" class="button primary">Get in touch ${icon('arrow')}</a></div><div class="apply-programs">${studentPrograms.map((p,i)=>`<div><span>0${i+1}</span><h3>${p.value==='ms'?'Master’s research':p.value==='bsms'?'Integrated B.S.–M.S.':'Undergraduate research'}</h3>${icon('northeast')}</div>`).join('')}<p>Contact the lab for current opportunities and requirements.</p></div></div>
      <div id="contact" class="contact-grid"><div><p class="eyebrow">FIND US</p><h2>Let’s connect.</h2><div class="address-block">${icon('pin')}<div><h3>${e(lab.university)}</h3><p>${e(lab.room)}<br>${e(lab.address)}</p></div></div>${lab.contactEmail?`<a class="text-link" href="mailto:${e(lab.contactEmail)}">${icon('mail')} ${e(lab.contactEmail)}</a>`:'<p class="contact-note">For research inquiries, visit our lab or check back for our contact email.</p>'}<a class="text-link" href="${mapUrl}" ${external}>Open in Google Maps ${icon('northeast')}</a></div><div class="map-panel"><iframe title="Google Maps: ChaMirisa Memorial Building, Duksung Women’s University" src="https://maps.google.com/maps?q=${mapQuery}&z=17&hl=en&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><div class="map-caption">${icon('pin')} ChaMirisa Memorial Building · Room 350</div></div></div>
    </section>
  </main>
  <footer><div class="container footer-main"><a href="#home" class="footer-brand"><img src="${logo}" alt="DMKD Lab" width="168" height="74"/><span>Data Mining & Knowledge Discovery</span></a><p>${e(lab.university)}<br>Seoul, Republic of Korea</p><a href="#home" class="text-link">Back to home ${icon('northeast')}</a></div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} DMKD Lab. All rights reserved.</span><div class="footer-member-links"><a class="text-link" href="/admin/" data-route>Administration ${icon('user')}</a><button class="text-link" data-member-open>Member area ${icon('arrow')}</button></div></div></footer>`;

export function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 5000);
}

function emptyState(title, description, symbol='book', compact=false) {
  return `<div class="empty-state ${compact?'compact':''}"><span class="empty-icon">${icon(symbol)}</span><h3>${e(title)}</h3><p>${e(description)}</p></div>`;
}

function renderPublications() {
  if(!document.querySelector('#publication-list'))return;
  const query = document.querySelector('#publication-search').value.toLowerCase().trim();
  const year = document.querySelector('#publication-year').value;
  const results = publications.filter(p => `${p.title} ${p.authors} ${p.venue}`.toLowerCase().includes(query) && (year === 'all' || String(p.year) === year));
  document.querySelector('#publication-list').innerHTML = results.length ? results.map(p => `<article class="publication-row"><span class="publication-year">${e(p.year)}</span><div><span class="small-label">${e(p.type)}</span><h3>${e(p.title)}</h3><p>${e(p.authors)}</p><span class="publication-venue">${e(p.venue)}</span></div><div class="paper-links">${safeUrl(p.url)?`<a class="text-link" href="${e(safeUrl(p.url))}" ${external}>Paper ${icon('northeast')}</a>`:''}${safeUrl(p.codeUrl)?`<a class="text-link" href="${e(safeUrl(p.codeUrl))}" ${external}>Code ${icon('northeast')}</a>`:''}</div></article>`).join('') : emptyState(publications.length?'No matching publications':'The next chapter is being written.',publications.length?'Try another search or choose a different year.':'Publications will appear here when they are added.');
}

function renderNews() {
  if(!document.querySelector('#news-list'))return;
  const direction = document.querySelector('#news-order')?.value === 'newest' ? -1 : 1;
  const ordered = [...news].sort((a,b)=>direction*a.date.localeCompare(b.date));
  const years = [...new Set(ordered.map(n=>n.date.slice(0,4)))];
  document.querySelector('#news-list').innerHTML = news.length ? years.map(year=>{
    const entries=ordered.filter(n=>n.date.startsWith(year));
    return `<section class="news-year-group" id="news-year-${year}" aria-labelledby="news-heading-${year}"><div class="news-year-heading"><h3 id="news-heading-${year}">${year}</h3><p>${entries.length} ${entries.length===1?'story':'stories'}</p></div><div class="news-cards">${entries.map(n=>`<article class="news-card" id="${e(n.id)}"><button class="news-image-button" data-news-photo="${e(n.id)}" aria-label="View photo: ${e(n.title)}"><img src="${e(n.image)}" alt="${e(n.title)}" loading="lazy" decoding="async" width="800" height="540"/></button><div class="news-card-body"><div class="news-card-meta"><time datetime="${e(n.date)}">${e(new Date(`${n.date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}))}</time><span class="small-label">${e(n.category)}</span></div><h4>${e(n.title)}</h4><p>${e(n.summary)}</p></div></article>`).join('')}</div></section>`;
  }).join('') : emptyState('Good things are taking shape.','Check back for research updates, lab news, and shared milestones.','spark');
}

export function memberCard(profile) {
  const photo = profile.avatar_path ? assetUrl(profile.avatar_path) : safeUrl(profile.photoUrl);
  const name = profile.full_name || profile.name;
  const position=programs.find(p=>p.value===profile.program);
  const socials = [
    ['LinkedIn', profile.linkedin_url || profile.linkedinUrl, linkedinIcon],
    ['Google Scholar', profile.scholar_url || profile.scholarUrl, scholarIcon],
    ['GitHub', profile.github_url || profile.githubUrl, githubIcon],
  ].filter(([,url])=>safeUrl(url));
  return `<article class="member-card"><div class="member-photo">${photo?`<img src="${e(photo)}" alt="Portrait of ${e(name)}" loading="lazy"/>`:`<span class="avatar-initials">${e(name?.split(/\s+/).slice(0,2).map(s=>s[0]).join('') || 'DM')}</span>`}</div><div class="member-details"><p class="small-label">${e(profile.title || position?.profileLabel || position?.short || '')}</p><h3>${e(name)}</h3><div class="interest-tags">${(profile.interests||[]).map(k=>`<span>${e(k)}</span>`).join('')}</div>${socials.length?`<div class="social-links">${socials.map(([label,url,img])=>`<a href="${e(safeUrl(url))}" ${external} aria-label="${e(name)} on ${label}"><img src="${img}" alt=""/></a>`).join('')}</div>`:''}${profile.public_email||profile.email?`<a class="member-email" href="mailto:${e(profile.public_email||profile.email)}">${icon('mail')}${e(profile.public_email||profile.email)}</a>`:''}</div></article>`;
}

function renderPeople() {
  if(!document.querySelector('#member-list'))return;
  document.querySelector('#member-list').innerHTML = loadFailed ? `<div class="load-error">Member profiles could not be loaded. <button class="text-link" data-retry>Try again ${icon('arrow')}</button></div>` : programs.filter(p=>activeProgram==='all'||p.value===activeProgram).map(p=>{
    const people = [...(p.value==='faculty'?faculty:[]),...publicData.profiles.filter(m=>m.program===p.value)];
    return `<div class="member-group" data-member-group="${p.value}"><div class="group-heading"><h3>${p.label} <span>${people.length.toString().padStart(2,'0')}</span></h3><p>${p.description}</p></div>${people.length?`<div class="member-grid">${people.map(memberCard).join('')}</div>`:`<div class="member-empty">${icon('user')}<span>${p.value==='faculty'?'Faculty profiles will appear here once added.':'Profiles will appear here as members join.'}</span></div>`}</div>`;
  }).join('');
}

function renderGallery() {
  if(!document.querySelector('#gallery-list'))return;
  document.querySelector('#gallery-list').innerHTML = loadFailed ? '<div class="load-error">Lab photos could not be loaded. <button class="text-link" data-retry>Try again</button></div>' : publicData.photos.length ? publicData.photos.map(photo=>`<figure class="gallery-photo"><button class="photo-open" data-photo="${e(photo.id)}" aria-label="View photo: ${e(photo.caption)}"><img src="${e(assetUrl(photo.image_path))}" alt="${e(photo.caption)}" loading="lazy"/></button><figcaption>${e(photo.caption)}</figcaption></figure>`).join('') : `<div class="gallery-empty">${icon('image')}<div><h3>Every discovery has a story.</h3><p>Lab photos will appear here when members share their first moments.</p></div><button class="text-link" data-member-open>Member login ${icon('arrow')}</button></div>`;
}

export async function refreshPublicData() {
  try { publicData = await loadPublicData(); loadFailed = false; }
  catch { loadFailed = true; }
  renderPeople(); renderGallery();
}

document.querySelector('.menu-toggle').addEventListener('click', (event)=>{
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  button.setAttribute('aria-label', expanded?'Close navigation':'Open navigation');
  document.querySelector('#main-nav').classList.toggle('open', expanded);
});
document.addEventListener('click', (event)=>{
  if(event.target.closest('[data-member-open]')) {
    document.querySelector('#main-nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');
    document.querySelector('.menu-toggle').setAttribute('aria-label','Open navigation');
    openMemberArea();
  }
  if(event.target.closest('[data-retry]')) refreshPublicData();
  const filter = event.target.closest('[data-program]');
  if(filter){activeProgram=filter.dataset.program;document.querySelectorAll('[data-program]').forEach(b=>{b.classList.toggle('active',b===filter);b.setAttribute('aria-pressed',String(b===filter));});renderPeople();}
  if(event.target.closest('#main-nav a')) {document.querySelector('#main-nav').classList.remove('open');document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');document.querySelector('.menu-toggle').setAttribute('aria-label','Open navigation');}
  const photoButton = event.target.closest('[data-photo]');
  if(photoButton){
    const photo = publicData.photos.find(p=>p.id===photoButton.dataset.photo);
    const modal = document.createElement('dialog');modal.className='photo-modal';modal.setAttribute('aria-label','Lab photo');modal.innerHTML=`<button class="icon-button close-dialog" aria-label="Close photo">${icon('close')}</button><img src="${e(assetUrl(photo.image_path))}" alt="${e(photo.caption)}"/><p>${e(photo.caption)}</p>`;document.body.append(modal);modal.showModal();modal.querySelector('button').onclick=()=>modal.close();modal.addEventListener('close',()=>modal.remove());
  }
  const newsPhotoButton = event.target.closest('[data-news-photo]');
  if(newsPhotoButton){
    const item=news.find(n=>n.id===newsPhotoButton.dataset.newsPhoto);
    if(!item)return;
    const modal=document.createElement('dialog');modal.className='photo-modal news-photo-modal';modal.setAttribute('aria-label',item.title);modal.innerHTML=`<button class="icon-button close-dialog" aria-label="Close photo">${icon('close')}</button><img src="${e(item.image)}" alt="${e(item.title)}"/><p>${e(item.title)}</p>`;document.body.append(modal);modal.showModal();modal.querySelector('button').onclick=()=>modal.close();modal.addEventListener('close',()=>{modal.remove();newsPhotoButton.focus();});
  }
});
initializeRouter({
  afterRender(){
    activeProgram='all';renderPublications();renderNews();renderPeople();renderGallery();
    initializeHero();
    document.querySelector('#publication-search')?.addEventListener('input',renderPublications);
    document.querySelector('#publication-year')?.addEventListener('change',renderPublications);
    document.querySelector('#news-order')?.addEventListener('change',renderNews);
  },
  renderAdmin:()=>renderAdminPage({toast,refreshPublicData}),
});
initializeMembers({ refreshPublicData, toast, memberCard, navigate, onAccountChange:()=>{
  if(document.querySelector('#admin-content'))renderAdminPage({toast,refreshPublicData});
} });
refreshPublicData();
