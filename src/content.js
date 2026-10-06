// Add verified lab content here. Empty collections intentionally publish no examples.
export const lab = {
  name: 'DMKD Lab',
  university: "Duksung Women's University",
  fullName: 'Data Mining & Knowledge Discovery',
  contactEmail: '',
  address: '33, Samyang-ro 144-gil, Dobong-gu, Seoul, Republic of Korea',
  room: 'Room 350, ChaMirisa Memorial Building',
};

// { id, title, authors, venue, year, type: 'Conference' | 'Journal', url, codeUrl? }
export const publications = [];
// { id, title, date: 'YYYY-MM-DD', category, summary, url? }
export const news = [];
// Optional faculty: { name, title, interests: [], photoUrl, email, scholarUrl, linkedinUrl, githubUrl }
export const faculty = [];

export const studentPrograms = [
  { value: 'ms', label: 'M.S. Students', short: 'M.S.', description: 'Graduate research, deeper questions.' },
  { value: 'bsms', label: 'Integrated B.S.–M.S.', short: 'B.S.–M.S.', description: 'Connecting undergraduate and graduate research.' },
  { value: 'undergraduate', label: 'Undergraduate Researchers', short: 'Undergraduate', description: 'A first step into discovery.' },
];
export const programs = [
  { value: 'faculty', label: 'Faculty / Professors', short: 'Faculty', profileLabel: 'Professor', description: 'Research direction, mentorship, and academic leadership.' },
  ...studentPrograms,
];
export const suggestedKeywords = ['Data Mining', 'Machine Learning', 'Deep Learning', 'Knowledge Discovery', 'Graph Learning', 'Natural Language Processing', 'Computer Vision', 'Explainable AI', 'Recommendation Systems', 'Time Series'];
