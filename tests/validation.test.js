import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeUrl, validateSocialUrl, normalizeKeywords, validateImage } from '../src/validation.js';

test('untrusted profile text and links cannot become executable HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@github.com', '//evil.test']) assert.equal(safeUrl(url), '');
});
test('profile URLs accept only HTTPS on the intended service', () => {
  assert.equal(validateSocialUrl('https://github.com/dmkd', 'github'), 'https://github.com/dmkd');
  assert.equal(validateSocialUrl('https://scholar.google.com/citations?user=123', 'scholar'), 'https://scholar.google.com/citations?user=123');
  assert.equal(validateSocialUrl('', 'linkedin'), '');
  for (const url of ['https://github.com.evil.test/user','http://github.com/user','https://github.com@evil.test/user','javascript:alert(1)']) assert.throws(()=>validateSocialUrl(url,'github'));
});
test('keywords trim, deduplicate, and enforce count and length limits', () => {
  assert.deepEqual(normalizeKeywords([' AI ', '', 'AI', 'Data Mining']), ['AI','Data Mining']);
  assert.throws(()=>normalizeKeywords(Array.from({length:9},(_,i)=>`Interest ${i}`)));
  assert.throws(()=>normalizeKeywords(['x'.repeat(41)]));
});
test('uploads reject non-images, empty images, and oversized files', () => {
  assert.doesNotThrow(()=>validateImage({type:'image/jpeg',size:1024}));
  assert.throws(()=>validateImage({type:'image/svg+xml',size:1000}));
  assert.throws(()=>validateImage({type:'image/png',size:0}));
  assert.throws(()=>validateImage({type:'image/png',size:6*1024*1024}));
});
