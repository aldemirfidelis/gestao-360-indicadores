#!/usr/bin/env node
import { request } from 'node:https';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://gestao360.org').replace(/\/$/, '');
const key = process.env.INDEXNOW_KEY;
const endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';

if (!key || key === 'configure-indexnow-key') {
  console.log('[indexnow] skipped: INDEXNOW_KEY not configured');
  process.exit(0);
}

function get(url) {
  return new Promise((resolve, reject) => {
    request(url, { method: 'GET', timeout: 20_000 }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
    }).on('error', reject).end();
  });
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(payload),
      },
      timeout: 20_000,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const sitemap = await get(`${siteUrl}/sitemap.xml`);
if (sitemap.statusCode < 200 || sitemap.statusCode >= 300) {
  console.log(`[indexnow] sitemap unavailable: HTTP ${sitemap.statusCode}`);
  process.exit(0);
}

const urls = Array.from(sitemap.data.matchAll(/<loc>(.*?)<\/loc>/g)).map((match) => match[1]).filter((url) => url.startsWith(siteUrl));
if (urls.length === 0) {
  console.log('[indexnow] skipped: no public URLs found in sitemap');
  process.exit(0);
}

const body = {
  host: new URL(siteUrl).host,
  key,
  keyLocation: `${siteUrl}/indexnow-key.txt`,
  urlList: urls,
};

let last;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  last = await postJson(endpoint, body).catch((error) => ({ statusCode: 0, data: error.message }));
  console.log(`[indexnow] attempt=${attempt} status=${last.statusCode} urls=${urls.length}`);
  if (last.statusCode >= 200 && last.statusCode < 300) break;
  await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
}

if (!last || last.statusCode < 200 || last.statusCode >= 300) {
  console.log(`[indexnow] failed: ${last?.data || 'unknown error'}`);
  process.exit(0);
}
