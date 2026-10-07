import { icon } from './icons.js';

let dispose = () => {};

export function initializeHero() {
  dispose();
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const slides = [...hero.querySelectorAll('.hero-slide')];
  const selectors = [...hero.querySelectorAll('[data-slide]')];
  const toggle = hero.querySelector('[data-slideshow-toggle]');
  const caption = hero.querySelector('.hero-slide-caption');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let current = 0;
  let paused = motion.matches;
  let hovered = false;
  let focused = false;
  let timer;

  const schedule = () => {
    clearTimeout(timer);
    if (!paused && !hovered && !focused && !document.hidden) {
      timer = setTimeout(() => select((current + 1) % slides.length), 8000);
    }
  };
  const select = index => {
    current = index;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    selectors.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    caption.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')} · ${slides[index].dataset.caption}`;
    schedule();
  };
  const reflectPlayback = () => {
    toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} background slideshow`);
    toggle.innerHTML = icon(paused ? 'play' : 'pause');
    schedule();
  };

  selectors.forEach((button, index) => button.addEventListener('click', () => select(index), { signal: events.signal }));
  toggle.addEventListener('click', () => { paused = !paused; reflectPlayback(); }, { signal: events.signal });
  hero.addEventListener('mouseenter', () => { hovered = true; schedule(); }, { signal: events.signal });
  hero.addEventListener('mouseleave', () => { hovered = false; schedule(); }, { signal: events.signal });
  hero.addEventListener('focusin', () => { focused = true; schedule(); }, { signal: events.signal });
  hero.addEventListener('focusout', event => { focused = hero.contains(event.relatedTarget); schedule(); }, { signal: events.signal });
  document.addEventListener('visibilitychange', schedule, { signal: events.signal });
  motion.addEventListener('change', () => { paused = motion.matches; reflectPlayback(); }, { signal: events.signal });
  reflectPlayback();
  select(0);
  dispose = () => { clearTimeout(timer); events.abort(); };
}
