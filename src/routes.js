export const routes = {
  home: { path: '/', label: 'Home', title: 'DMKD Lab' },
  research: { path: '/research/', label: 'Research', title: 'Research', description: 'Exploring the connections between data, learning, and knowledge.', image: '/images/hero/background_2.webp' },
  publications: { path: '/publications/', label: 'Publications', title: 'Publications', description: 'Research contributions, papers, and the ideas we share.' },
  news: { path: '/news/', label: 'News', title: 'News & lab life', description: 'The discoveries and everyday moments that bring our community together.' },
  members: { path: '/members/', label: 'Members', title: 'Our people.', description: 'Meet the researchers turning curiosity into discovery.' },
  apply: { path: '/apply/', label: 'Apply / Contact', title: 'Let’s connect.', description: 'Find the lab, explore opportunities, and start a conversation.', image: '/images/hero/background3.webp' },
  admin: { path: '/admin/', label: 'Administration', title: 'Lab administration.', description: 'Review membership requests and manage access to the lab.' },
};

export function routeFromPath(pathname) {
  const normalized = pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  return Object.keys(routes).find(key => (routes[key].path.replace(/\/$/, '') || '/') === normalized) || null;
}
