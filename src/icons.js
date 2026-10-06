const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  northeast: '<path d="M6 18 18 6M6 6h12v12"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 5 5 3-3 5 5"/>',
  book: '<path d="M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  network: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="21" cy="20" r="2"/><path d="m5.5 5.5 4.4 4.4m4.4 0 4.1-3.5M10 14l-4 4m8-4 5 4"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;

export function networkArt() {
  const nodes = [];
  for (let i = 0; i < 67; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / 67);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    nodes.push({ x: 270 + 202 * Math.sin(phi) * Math.cos(theta), y: 255 + 190 * Math.cos(phi), z: Math.sin(phi) * Math.sin(theta) });
  }
  const edges = nodes.flatMap((a, i) => nodes.slice(i + 1).flatMap((b) => Math.hypot(a.x - b.x, a.y - b.y) < 87 && Math.abs(a.z - b.z) < 0.85 ? [`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" opacity="${0.12 + (a.z + 1) * 0.12}"/>`] : []));
  return `<svg class="network-art" viewBox="0 0 540 520" fill="none" role="img" aria-label="An interconnected network of data points forming a sphere">
    <defs>
      <radialGradient id="sphere-glow"><stop stop-color="#93b8ff" stop-opacity=".18"/><stop offset="1" stop-color="#99eacf" stop-opacity="0"/></radialGradient>
      <linearGradient id="network-spectrum" x1="70" y1="65" x2="470" y2="425" gradientUnits="userSpaceOnUse"><stop stop-color="#d1a5ff"/><stop offset=".48" stop-color="#91c3ff"/><stop offset="1" stop-color="#8df1ca"/></linearGradient>
      <radialGradient id="sphere-surface" cx=".28" cy=".2" r=".85"><stop stop-color="#c4a1ff" stop-opacity=".09"/><stop offset=".55" stop-color="#80b6ff" stop-opacity=".035"/><stop offset="1" stop-color="#83e9ce" stop-opacity=".07"/></radialGradient>
    </defs>
    <circle cx="270" cy="255" r="250" fill="url(#sphere-glow)"/>
    <circle cx="270" cy="255" r="207" fill="url(#sphere-surface)" stroke="url(#network-spectrum)" stroke-opacity=".12"/>
    <ellipse cx="270" cy="255" rx="246" ry="71" transform="rotate(-28 270 255)" stroke="url(#network-spectrum)" stroke-opacity=".18"/>
    <g stroke="url(#network-spectrum)">${edges.join('')}</g>
    ${nodes.map((n,i) => `<circle class="data-node" style="animation-delay:${i * 0.12}s" cx="${n.x}" cy="${n.y}" r="${2 + (n.z + 1) * 1.8}" fill="${n.x < 220 ? '#c3a3f3' : n.y < 240 ? '#a2ccfa' : '#9befd5'}" opacity="${0.4 + (n.z + 1) * 0.3}"/>`).join('')}
    <circle cx="270" cy="255" r="224" stroke="url(#network-spectrum)" stroke-opacity=".24" stroke-dasharray="2 8"/>
    <path d="M15 255h42m426 0h42M270 12v20m0 446v24" stroke="#b8b2e2" stroke-opacity=".35"/>
  </svg>`;
}
