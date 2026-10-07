import { routes, routeFromPath } from './routes.js';
import { icon } from './icons.js';

let renderRoute;
export function navigate(path) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) return;
  history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
  renderRoute(true);
}

export function initializeRouter({ afterRender, renderAdmin }) {
  const main = document.querySelector('#main');
  const sections = Object.fromEntries(['home','research','publications','news','members','apply'].map(key => [key, main.querySelector(`#${key}`).outerHTML]));
  const intro = main.querySelector('.intro-strip').outerHTML;
  const home = `${sections.home}${intro}<section class="section container home-directory"><div class="section-heading"><div><p class="eyebrow">DISCOVER DMKD</p><h2>A world of connected ideas.</h2></div><p class="section-description">Get to know our research and the people behind it.</p></div><div class="directory-grid">${[
    ['research','network','Explore our research','From data mining to knowledge discovery.'],
    ['members','user','Meet our people','Different paths. A shared curiosity.'],
    ['publications','book','Read our publications','Our contributions to a growing field.'],
  ].map(([key,symbol,title,description],i)=>`<a class="directory-card" href="${routes[key].path}" data-route><span class="directory-icon">${icon(symbol)}</span><span class="small-label">0${i+1} / ${routes[key].label.toUpperCase()}</span><h3>${title}</h3><p>${description}</p><span class="text-link">Discover more ${icon('northeast')}</span></a>`).join('')}</div><div class="home-news-link"><div><p class="eyebrow">BEYOND THE RESEARCH</p><h3>Stay connected with the lab.</h3></div><a class="text-link" href="/news/" data-route>News & lab life ${icon('arrow')}</a><a class="text-link" href="/apply/" data-route>Apply / Contact ${icon('arrow')}</a></div></section>`;

  function normalizeLinks(root) {
    root.querySelectorAll('a[href^="#"]').forEach(link => {
      const key = link.getAttribute('href').slice(1);
      if (routes[key]) { link.href = routes[key].path; link.dataset.route=''; }
      else if (key === 'contact') { link.href='/apply/#contact'; link.dataset.route=''; }
    });
    root.querySelectorAll('a[href^="/"]').forEach(link => {
      if (routeFromPath(new URL(link.href).pathname)) link.dataset.route='';
    });
  }
  renderRoute = (focus = false) => {
    const key = routeFromPath(location.pathname);
    const page = routes[key];
    if (!page) main.innerHTML='<section class="section container not-found"><p class="eyebrow">404 / PAGE NOT FOUND</p><h1>This page is still undiscovered.</h1><p>Choose a destination from the navigation or return to the lab home.</p><a href="/" class="button dark" data-route>Back to home</a></section>';
    else if (key === 'home') main.innerHTML=home;
    else {
      main.innerHTML=`<section class="page-masthead${page.image?' has-photo':''}${key==='apply'?' campus-masthead':''}">${page.image?`<img class="masthead-photo" src="${page.image}" alt="" fetchpriority="high"/>`:''}<div class="container"><div class="breadcrumbs"><a href="/" data-route>Home</a><span>/</span><span>${page.label}</span></div><p class="eyebrow light">DMKD LAB / ${page.label.toUpperCase()}</p><h1>${page.title}</h1><p>${page.description}</p><span class="masthead-orbit" aria-hidden="true"></span></div></section>${key==='admin'?'<section class="section container" id="admin-content" aria-live="polite"></section>':sections[key]}`;
    }
    normalizeLinks(document);
    document.title=`${page?.label || 'Page not found'} · DMKD Lab · Duksung Women’s University`;
    document.querySelectorAll('#main-nav a').forEach(link => {
      const active=routeFromPath(new URL(link.href).pathname)===key;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    document.querySelector('#main-nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');
    document.querySelector('.menu-toggle').setAttribute('aria-label','Open navigation');
    main.dataset.page=key||'404';
    afterRender(key);
    if(key==='admin')renderAdmin();
    if(focus){
      const heading=main.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});
      window.scrollTo({top:0,behavior:'instant'});
    }
    if(location.hash==='#contact')document.querySelector('#contact')?.scrollIntoView();
  };
  normalizeLinks(document);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-route]');
    if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target||link.hasAttribute('download'))return;
    event.preventDefault();navigate(link.href);
  });
  addEventListener('popstate',()=>renderRoute(true));
  // Preserve shared links to the previous one-page version.
  const legacy=location.hash.slice(1);
  if(routes[legacy]&&location.pathname==='/')history.replaceState({},'',routes[legacy].path+location.search);
  else if(legacy==='contact'&&location.pathname==='/')history.replaceState({},'','/apply/'+location.search+'#contact');
  renderRoute(false);
}
