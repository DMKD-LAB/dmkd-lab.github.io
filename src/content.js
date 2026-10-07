import newsArchive from './data/news.json' with { type: 'json' };
import publicationArchive from './data/publications.json' with { type: 'json' };
import importedPeople from './data/people.json' with { type: 'json' };

// Add verified lab content here. Empty collections intentionally publish no examples.
export const lab = {
  name: 'DMKD Lab',
  university: "Duksung Women's University",
  fullName: 'Data Mining & Knowledge Discovery',
  contactEmail: '',
  address: '33, Samyang-ro 144-gil, Dobong-gu, Seoul, Republic of Korea',
  room: 'Room 350, ChaMirisa Memorial Building',
};

// Source titles and author spellings are preserved in the bibliography.
export const publications = publicationArchive;
// { id, title, date: 'YYYY-MM-DD', category, summary, image, sourceId, sourceImage }
export const news = newsArchive;
export const faculty = importedPeople.filter(person => person.program === 'faculty');
export const alumni = importedPeople.filter(person => person.program === 'alumni');

export const studentPrograms = [
  { value: 'ms', label: 'M.S. Students', short: 'M.S.', description: 'Graduate research, deeper questions.' },
  { value: 'bsms', label: 'Integrated B.S.–M.S.', short: 'B.S.–M.S.', description: 'Connecting undergraduate and graduate research.' },
  { value: 'undergraduate', label: 'Undergraduate Researchers', short: 'Undergraduate', description: 'A first step into discovery.' },
];
export const programs = [
  { value: 'faculty', label: 'Faculty / Professors', short: 'Faculty', profileLabel: 'Professor', description: 'Research direction, mentorship, and academic leadership.' },
  ...studentPrograms,
  { value: 'alumni', label: 'Alumni', short: 'Alumni', profileLabel: 'Alumni', description: 'Continuing the journey beyond our lab.' },
];
export const suggestedKeywords = ['Data Mining', 'Machine Learning', 'Deep Learning', 'Knowledge Discovery', 'Graph Learning', 'Natural Language Processing', 'Computer Vision', 'Explainable AI', 'Recommendation Systems', 'Time Series'];
