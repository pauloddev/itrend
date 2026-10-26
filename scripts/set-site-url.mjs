// Troca a URL do site em todos os lugares de uma vez.
// Uso: node scripts/set-site-url.mjs https://seu-projeto.vercel.app
import { readFileSync, writeFileSync } from 'node:fs';

const next = (process.argv[2] || '').trim().replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) {
  console.error('Informe a URL de produção, ex.: node scripts/set-site-url.mjs https://itrend.vercel.app');
  process.exit(1);
}
const url = (p) => new URL('../' + p, import.meta.url);
const cfgFile = url('site.config.json');
const cfg = JSON.parse(readFileSync(cfgFile, 'utf8'));
const current = cfg.SITE_URL;

const geral = JSON.parse(readFileSync(url('content/geral.json'), 'utf8'));
geral.site_url = next;
writeFileSync(url('content/geral.json'), JSON.stringify(geral, null, 2) + '\n');
console.log('content/geral.json: site_url atualizado');

for (const f of ['public/admin/config.yml']) {
  const src = readFileSync(url(f), 'utf8');
  writeFileSync(url(f), src.split(current).join(next));
  console.log(`${f}: ${src.split(current).length - 1} ocorrência(s) trocada(s)`);
}
cfg.SITE_URL = next;
writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
console.log(`SITE_URL agora é ${next}. Rode "npm run build" para gerar a página.`);
