#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://luongnv.com/trap-website/';
const issueForms = {
  bug: 'https://github.com/luongnv89/trap-website/issues/new?template=bug_report.yml',
  feature: 'https://github.com/luongnv89/trap-website/issues/new?template=feature_request.yml',
  feedback: 'https://github.com/luongnv89/trap-website/issues/new?template=feedback.yml',
};
const pages = [
  { file: 'index.html', lang: 'en', canonical: base, languageHref: 'vi/index.html', type: 'VideoGame', mustContain: ['The factory', 'Scan the illustration'], faqCount: 5 },
  { file: 'vi/index.html', lang: 'vi', canonical: `${base}vi/`, languageHref: '../index.html', type: 'VideoGame', mustContain: ['Nhà máy', 'Quét minh họa'], faqCount: 5 },
  { file: 'support/index.html', lang: 'en', canonical: `${base}support/`, languageHref: '../vi/support/', type: 'WebPage', mustContain: ['Report a bug', 'Suggest a feature', 'Send feedback'], issueForms: true },
  { file: 'vi/support/index.html', lang: 'vi', canonical: `${base}vi/support/`, languageHref: '../../support/', type: 'WebPage', mustContain: ['Báo lỗi', 'Đề xuất tính năng', 'Gửi phản hồi'], issueForms: true },
  { file: 'privacy/index.html', lang: 'en', canonical: `${base}privacy/`, languageHref: '../vi/privacy/', type: 'WebPage', mustContain: ['Current development build', 'Stored by the app'], },
  { file: 'vi/privacy/index.html', lang: 'vi', canonical: `${base}vi/privacy/`, languageHref: '../../privacy/', type: 'WebPage', mustContain: ['Bản phát triển', 'Ứng dụng lưu'], },
  { file: 'changelog/index.html', lang: 'en', canonical: `${base}changelog/`, languageHref: '../vi/changelog/', type: 'WebPage', mustContain: ['1.0.0', 'In development / unreleased'], },
  { file: 'vi/changelog/index.html', lang: 'vi', canonical: `${base}vi/changelog/`, languageHref: '../../changelog/', type: 'WebPage', mustContain: ['1.0.0', 'Đang phát triển / chưa phát hành'], },
];
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const read = (file) => readFileSync(join(root, file), 'utf8');

function localTarget(pageFile, reference) {
  const pageUrl = new URL(`${base}${pageFile}`);
  const url = new URL(reference, pageUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin !== new URL(base).origin) return null;
  const path = url.pathname.replace(/^\/trap-website\/?/, '');
  const clean = path || 'index.html';
  if (clean.endsWith('/')) return join(root, clean, 'index.html');
  return join(root, clean);
}

function localReferences(pageFile, html) {
  const found = [];
  const pattern = /<(?:a|area|link|script|img|source)\b[^>]+(?:href|src)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    const ref = match[1];
    if (ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('data:') || ref.startsWith('javascript:')) continue;
    const target = localTarget(pageFile, ref);
    if (target) found.push({ ref, target });
  }
  return found;
}

function checkFragments(pageFile, html) {
  const pattern = /href=["']([^"']*#([^"']+))["']/gi;
  for (const match of html.matchAll(pattern)) {
    const target = localTarget(pageFile, match[1]);
    if (!target || !existsSync(target)) continue;
    const targetHtml = readFileSync(target, 'utf8');
    check(new RegExp(`(?:id|name)=["']${match[2]}["']`).test(targetHtml), `${pageFile}: missing fragment target #${match[2]}`);
  }
}

for (const page of pages) {
  const html = read(page.file);
  check(new RegExp(`<html\\s+lang=["']${page.lang}["']`, 'i').test(html), `${page.file}: html lang must be ${page.lang}`);
  check(html.includes(`<link rel="canonical" href="${page.canonical}">`), `${page.file}: canonical URL is missing or wrong`);
  check(html.includes(`<link rel="alternate" hreflang="en" href="${page.lang === 'en' ? page.canonical : page.canonical.replace('/vi/', '/')}">`), `${page.file}: English hreflang is missing or wrong`);
  const viCanonical = page.lang === 'vi' ? page.canonical : `${base}${page.file === 'index.html' ? 'vi/' : `vi/${page.file.replace('/index.html', '/')}`}`;
  check(html.includes(`<link rel="alternate" hreflang="vi" href="${viCanonical}">`), `${page.file}: Vietnamese hreflang is missing or wrong`);
  const xDefault = page.lang === 'vi' ? page.canonical.replace('/vi/', '/') : page.canonical;
  check(html.includes(`<link rel="alternate" hreflang="x-default" href="${xDefault}">`), `${page.file}: x-default hreflang is missing or wrong`);
  check(/<title>[^<]+<\/title>/.test(html), `${page.file}: title is missing`);
  check(html.includes(`<meta name="description" content="`), `${page.file}: meta description is missing`);
  check(html.includes(`<meta property="og:url" content="${page.canonical}">`), `${page.file}: Open Graph URL must match canonical`);
  check(html.includes(`<meta property="og:image" content="${base}assets/social-card.png">`), `${page.file}: absolute social image is missing`);
  check(html.includes(`<meta name="twitter:image" content="${base}assets/social-card.png">`), `${page.file}: twitter image is missing`);
  check(html.includes(`href="${page.languageHref}"`), `${page.file}: language switch does not point to the equivalent page`);
  const references = localReferences(page.file, html);
  const localeRoot = page.lang === 'vi' ? 'vi/' : '';
  for (const route of ['support', 'privacy', 'changelog']) {
    const expected = join(root, localeRoot, route, 'index.html');
    check(references.some(({ target }) => target === expected), `${page.file}: missing localized ${route} navigation`);
  }
  const brandHref = html.match(/<a class="brand" href="([^"]+)"/)?.[1];
  check(brandHref && localTarget(page.file, brandHref) === join(root, localeRoot, 'index.html'), `${page.file}: brand must link to localized home`);
  check(html.includes('class="footer-links"'), `${page.file}: footer links are missing`);
  for (const marker of page.mustContain) check(html.includes(marker), `${page.file}: expected content marker missing: ${marker}`);
  if (page.faqCount !== undefined) check((html.match(/<details\b/g) ?? []).length === page.faqCount, `${page.file}: landing FAQ must contain exactly five questions`);
  if (page.issueForms) {
    for (const url of Object.values(issueForms)) check(html.includes(url), `${page.file}: issue form link missing: ${url}`);
    check(!/<form\b/i.test(html), `${page.file}: support page must not add a fake on-page form`);
  }

  const jsonScripts = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  check(jsonScripts.length === 1, `${page.file}: expected one JSON-LD script`);
  if (jsonScripts.length === 1) {
    try {
      const data = JSON.parse(jsonScripts[0][1]);
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const primary = nodes.find((node) => node['@type'] === page.type);
      check(primary, `${page.file}: JSON-LD must include ${page.type}`);
      if (primary) {
        check(primary.url === page.canonical, `${page.file}: JSON-LD URL must match canonical`);
        if (page.type === 'VideoGame') {
          check(Array.isArray(primary.gamePlatform) && primary.gamePlatform.includes('Android') && primary.gamePlatform.includes('iOS'), `${page.file}: JSON-LD planned platforms must include Android and iOS`);
        } else {
          check(primary.inLanguage === page.lang, `${page.file}: WebPage JSON-LD language must match HTML`);
        }
      }
      for (const node of nodes) {
        check(!('offers' in node) && !('aggregateRating' in node) && !('review' in node), `${page.file}: JSON-LD must not invent offers, ratings, or reviews`);
      }
      if (page.faqCount !== undefined) {
        const faq = nodes.find((node) => node['@type'] === 'FAQPage');
        check(faq && Array.isArray(faq.mainEntity) && faq.mainEntity.length === page.faqCount, `${page.file}: FAQPage JSON-LD must list exactly ${page.faqCount} questions`);
        if (faq && Array.isArray(faq.mainEntity)) {
          const summaries = [...html.matchAll(/<summary><span>([^<]+)<\/span>/g)].map((match) => match[1]);
          faq.mainEntity.forEach((entity, index) => {
            check(entity.name === summaries[index], `${page.file}: FAQPage question ${index + 1} does not match the visible summary`);
          });
        }
      }
    } catch (error) {
      errors.push(`${page.file}: JSON-LD is not valid JSON (${error.message})`);
    }
  }

  for (const { ref, target } of localReferences(page.file, html)) check(existsSync(target), `${page.file}: broken local reference ${ref}`);
  checkFragments(page.file, html);
}

const socialCard = join(root, 'assets/social-card.png');
check(existsSync(socialCard), 'assets/social-card.png is missing');
if (existsSync(socialCard)) {
  const png = readFileSync(socialCard);
  check(png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'assets/social-card.png is not a PNG');
  if (png.length >= 24) check(png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, 'assets/social-card.png must be 1200x630');
}

for (const file of ['bug_report.yml', 'feature_request.yml', 'feedback.yml']) {
  const template = join(root, '.github/ISSUE_TEMPLATE', file);
  check(existsSync(template), `.github/ISSUE_TEMPLATE/${file} is missing`);
  if (existsSync(template)) {
    const yaml = readFileSync(template, 'utf8');
    check(/^name:\s*.+/m.test(yaml), `${file}: name is missing`);
    check(/^description:\s*.+/m.test(yaml), `${file}: description is missing`);
    check(/^title:\s*.+/m.test(yaml), `${file}: title is missing`);
    check(/^body:\s*$/m.test(yaml), `${file}: body is missing`);
    check(!/^labels:/m.test(yaml), `${file}: do not reference unverified labels`);
  }
}
const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
check(/^blank_issues_enabled:\s*false\s*$/m.test(issueConfig), 'issue template config must disable blank issues');

const sitemap = read('sitemap.xml');
for (const page of pages) check(sitemap.includes(`<loc>${page.canonical}</loc>`), `sitemap.xml is missing ${page.canonical}`);
check((sitemap.match(/<loc>/g) ?? []).length === pages.length, 'sitemap.xml must contain exactly eight routes');
const robots = read('robots.txt');
check(robots.includes(`Sitemap: ${base}sitemap.xml`), 'robots.txt must point to sitemap.xml');
const llms = read('llms.txt');
for (const page of pages) check(llms.includes(page.canonical), `llms.txt is missing ${page.canonical}`);
check(llms.includes('not a guarantee of AI ranking'), 'llms.txt must state its factual, non-ranking purpose');
const readme = read('README.md');
for (const route of ['support/', 'privacy/', 'changelog/']) check(readme.includes(`${base}${route}`), `README is missing ${route} submission URL`);
check(readme.includes('privacy labels'), 'README must document store-privacy follow-up');
check(readme.includes('not a domain-root robots policy'), 'README must document project-path robots scope');

if (errors.length) {
  console.error(`Static validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Static validation passed: ${pages.length} pages, metadata/JSON-LD, local links/anchors, issue templates, sitemap/robots, and social card.`);
