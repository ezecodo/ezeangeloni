// Eze's other work, shown as planets in the Cronovisor's galaxy (links.json), edited from the admin's links tab.
// Text (in one of three type styles) or an uploaded image (a logo), plus a description and its stack. Lives only on the VPS, like frases.json.
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { sniff, PUBLIC_ROOT } from './frases.js';

// per galaxy root, like frases.json: links.json and links/ beside it
const jsonOf = (root) => path.join(root, 'links.json');
const dirOf = (root) => path.join(root, 'links');
const FONTS = ['malvinas', 'serif', 'mono'];
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function bad(msg) { return Object.assign(new Error(msg), { status: 400 }); }

export function cleanLinks(list) {
  if (!Array.isArray(list)) throw bad('links must be a list');
  if (list.length > 12) throw bad('12 links at most');
  return list.map((l, i) => {
    const url = String(l?.url || '').trim();
    const label = String(l?.label || '').trim().slice(0, 80);
    const image = l?.image ? String(l.image) : '';
    if (!/^https?:\/\/[^\s"<>]+$/.test(url)) throw bad(`link ${i + 1}: the address must start with https://`);
    if (image && !/^\/(links|img)\/[\w.-]+$/.test(image)) throw bad(`link ${i + 1}: unknown image`);
    if (!label && !image) throw bad(`link ${i + 1}: needs a text or an image`);
    const out = { label, url };
    if (image) out.image = image;
    else out.font = FONTS.includes(l.font) ? l.font : 'serif';
    const description = String(l?.description || '').trim().slice(0, 900);
    if (description) out.description = description;
    const tags = (Array.isArray(l?.tags) ? l.tags : String(l?.tags || '').split(','))
      .map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 10);
    if (tags.length) out.tags = tags;
    return out;
  });
}

export async function saveLinks(list, root = PUBLIC_ROOT) {
  const links = cleanLinks(list);
  const tmp = jsonOf(root) + '.tmp';
  await fs.writeFile(tmp, JSON.stringify({ links }, null, 2) + '\n');
  await fs.rename(tmp, jsonOf(root));
  return links;
}

export async function storeLinkImage(buf, root = PUBLIC_ROOT) {
  const LINKS_DIR = dirOf(root);
  const type = sniff(buf);
  if (!type) throw Object.assign(new Error('the image must be a png, jpg or webp'), { status: 415 });
  await fs.mkdir(LINKS_DIR, { recursive: true });
  let stamp = Math.floor(Date.now() / 1000);
  while (existsSync(path.join(LINKS_DIR, `${stamp}.${EXT[type]}`))) stamp++;
  const name = `${stamp}.${EXT[type]}`;
  await fs.writeFile(path.join(LINKS_DIR, name), buf, { flag: 'wx' });
  return `/links/${name}`;
}
