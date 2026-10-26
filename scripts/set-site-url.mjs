// Troca a URL do site (SITE_URL) em todos os arquivos de uma vez.
// Uso: node scripts/set-site-url.mjs https://seu-projeto.vercel.app
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = new URL('../site.config.json', import.meta.url);
const FILES = ['public/index.html', 'public/robots.txt', 'public/sitemap.xml'];

const next = (process.argv[2] || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) {
  console.error('Informe a URL de produção, ex.: node scripts/set-site-url.mjs https://itrend.vercel.app');
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));
const current = config.SITE_URL;
for (const f of FILES) {
  const path = new URL('../' + f, import.meta.url);
  const src = readFileSync(path, 'utf8');
  const out = src.split(current).join(next);
  writeFileSync(path, out);
  console.log(`${f}: ${src.split(current).length - 1} ocorrência(s) trocada(s)`);
}
config.SITE_URL = next;
writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');
console.log(`SITE_URL agora é ${next}`);
