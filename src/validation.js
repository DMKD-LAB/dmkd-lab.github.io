export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function validateSocialUrl(value, service) {
  if (!value.trim()) return '';
  const url = safeUrl(value.trim());
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Use a complete HTTPS link, beginning with https://.');
  const hostname = new URL(url).hostname.toLowerCase();
  const valid = {
    linkedin: hostname === 'linkedin.com' || hostname === 'www.linkedin.com',
    scholar: hostname === 'scholar.google.com',
    github: hostname === 'github.com' || hostname === 'www.github.com',
  };
  if (!valid[service]) throw new Error(`Please enter a valid ${service === 'scholar' ? 'Google Scholar' : service} profile link.`);
  return url;
}

export function normalizeKeywords(values) {
  const keywords = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (keywords.length > 8) throw new Error('Choose up to 8 research interests.');
  if (keywords.some((v) => v.length > 40)) throw new Error('Each research interest must be 40 characters or fewer.');
  return keywords;
}

export function validateImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than 5 MB.');
}

// Decode and re-encode to verify image content, resize large phone photos, and remove metadata.
export async function prepareImage(file, maxDimension = 1600) {
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob) throw new Error('This image could not be processed. Try another photo.');
    return blob;
  } finally { bitmap.close(); }
}
