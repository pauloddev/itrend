// Gera public/index.html a partir de content/*.json e processa as fotos e vídeos enviados pelo painel.
// Uso: npm run build
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
const C = (n) => JSON.parse(readFileSync(join(ROOT, 'content', n + '.json'), 'utf8'));
const g = C('geral');

/* ---------------- utilidades ---------------- */
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EXT = 'target="_blank" rel="noopener noreferrer"';
const PHONE = String(g.whatsapp).replace(/\D/g, '');
const wa = (msg) => `https://wa.me/${PHONE}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
const IG = `https://www.instagram.com/${String(g.instagram).replace(/^@/, '')}/`;
const SITE = String(g.site_url || '').replace(/\/+$/, '');
const icon = (i, extra = '') => `<svg aria-hidden="true"${extra}><use href="#${esc(i)}"/></svg>`;
const btn = (href, label, kind = 'btn-wa', ico = 'i-wa') => `<a class="btn ${kind}" href="${esc(href)}" ${EXT}>${icon(ico)}<span>${esc(label)}</span></a>`;
const EMOJI = /(\s*[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+)+\s*$/u;
// título + trecho em destaque (gradiente); emojis no fim ficam fora do gradiente
const head = (titulo, destaque, cls = 'grad-text') => {
  const d = String(destaque || ''); const m = d.match(EMOJI);
  const txt = m ? d.slice(0, m.index) : d; const emo = m ? ' ' + m[0].trim() : '';
  return `${esc(titulo)}${txt ? ` <span class="${cls}">${esc(txt)}</span>` : ''}${esc(emo)}`;
};
const checks = (lista, ico = 'i-check') => (lista || []).map((l) => {
  const t = String(l.texto || ''); const sep = /^[,.;:]/.test(t) ? '' : ' ';
  return `<li>${icon(l.icone || ico)}<span><b>${esc(l.destaque)}</b>${sep}${esc(t)}</span></li>`;
}).join('');
const igLink = (s) => esc(s).replace(new RegExp('@' + g.instagram, 'g'), `<a class="inline-link" href="${IG}" ${EXT}>@${esc(g.instagram)}</a>`);
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

/* ---------------- imagens ---------------- */
const WIDTHS = [360, 600, 900, 1200];
const cache = new Map();
async function image(path, { ratio = null } = {}) {
  if (!path) return null;
  const key = path + '|' + ratio;
  if (cache.has(key)) return cache.get(key);
  let out;
  const m = path.match(/^\/img\/(.+)-(\d+)\.(jpg|png|webp)$/);
  if (m && existsSync(join(PUB, 'img', m[1] + '-' + m[2] + '.avif'))) {
    // imagem já otimizada (gerada antes): usa as variantes existentes
    const dir = join(PUB, 'img', dirname(m[1])); const stem = basename(m[1]);
    const ws = readdirSync(dir).map((f) => f.match(new RegExp('^' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)\\.avif$'))).filter(Boolean).map((x) => +x[1]).sort((a, b) => a - b);
    const fbw = ws.includes(600) ? 600 : ws[ws.length - 1];
    const meta = await sharp(join(PUB, 'img', `${m[1]}-${fbw}.${m[3]}`)).metadata();
    out = { base: '/img/' + m[1], ws, fbw, fbh: meta.height, ext: m[3] };
  } else {
    // foto enviada pelo painel: recorta na proporção e gera AVIF, WebP e JPG/PNG
    const file = join(PUB, path.replace(/^\//, ''));
    if (!existsSync(file)) { console.warn('⚠ imagem não encontrada:', path); cache.set(key, null); return null; }
    const buf = readFileSync(file);
    const hash = createHash('sha1').update(buf).update(String(ratio)).digest('hex').slice(0, 8);
    const slug = basename(file, extname(file)).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
    const meta = await sharp(buf).rotate().metadata();
    const alpha = !!meta.hasAlpha;
    let W = meta.autoOrient?.width || meta.width; let H = meta.autoOrient?.height || meta.height;
    // corrige a rotação da foto do celular antes de tudo
    let src = await sharp(buf).rotate().toBuffer();
    if (ratio && !alpha) {
      // recorta na proporção (foco automático no assunto da foto), sem perder resolução
      const [rw, rh] = ratio.split('/').map(Number);
      if (W / H > rw / rh) W = Math.round(H * rw / rh); else H = Math.round(W * rh / rw);
      src = await sharp(src).resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
    }
    const pipe = () => sharp(src);
    const maxW = Math.min(W, 1200);
    const ws = [...new Set([...WIDTHS.filter((w) => w < maxW), maxW])];
    const ext = alpha ? 'png' : 'jpg';
    const base = `/img/u/${slug}-${hash}`;
    mkdirSync(join(PUB, 'img', 'u'), { recursive: true });
    for (const w of ws) {
      const f = (e) => join(PUB, `${base}-${w}.${e}`.replace(/^\//, ''));
      if (existsSync(f('avif'))) continue;
      const r = await pipe().resize({ width: w }).toBuffer();
      await sharp(r).avif({ quality: 60, effort: 3 }).toFile(f('avif'));
      await sharp(r).webp({ quality: 82 }).toFile(f('webp'));
      if (alpha) await sharp(r).png({ compressionLevel: 9 }).toFile(f('png'));
      else await sharp(r).jpeg({ quality: 85, progressive: true, mozjpeg: true }).toFile(f('jpg'));
    }
    const fbw = ws.includes(600) ? 600 : ws[ws.length - 1];
    out = { base, ws, fbw, fbh: Math.round(H * fbw / W), ext };
    console.log('✓ foto processada:', path, '→', base);
  }
  cache.set(key, out);
  return out;
}
async function pic(path, sizes, alt, opts = {}) {
  const im = await image(path, opts);
  if (!im) return '';
  const ss = (e) => im.ws.map((w) => `${im.base}-${w}.${e} ${w}w`).join(', ');
  const load = opts.eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<picture><source type="image/avif" srcset="${ss('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${ss('webp')}" sizes="${sizes}"><img src="${im.base}-${im.fbw}.${im.ext}" width="${im.fbw}" height="${im.fbh}" alt="${esc(alt)}" ${load} decoding="async"></picture>`;
}

/* ---------------- vídeos ---------------- */
let ffmpeg = null;
try { ffmpeg = (await import('ffmpeg-static')).default; } catch { ffmpeg = null; }
function video(path) {
  if (!path) return null;
  const file = join(PUB, path.replace(/^\//, ''));
  if (!existsSync(file)) { console.warn('⚠ vídeo não encontrado:', path); return null; }
  if (path.startsWith('/video/')) {
    const poster = path.replace(/\.mp4$/i, '.jpg');
    return { src: path, poster: existsSync(join(PUB, poster.slice(1))) ? poster : '' };
  }
  // vídeo enviado pelo painel: converte para MP4 leve, sem áudio, até 20 s, e cria a capa
  const hash = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);
  const out = `/video/u/${basename(file, extname(file)).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${hash}`;
  mkdirSync(join(PUB, 'video', 'u'), { recursive: true });
  const mp4 = join(PUB, out.slice(1) + '.mp4'); const jpg = join(PUB, out.slice(1) + '.jpg');
  if (!ffmpeg) { console.warn('⚠ ffmpeg indisponível, vídeo usado como enviado:', path); return { src: path, poster: '' }; }
  try {
    if (!existsSync(mp4)) execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', file, '-t', '20', '-an', '-vf', "scale=-2:'min(960,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    if (!existsSync(jpg)) execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', '0.5', '-i', mp4, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4', jpg]);
    console.log('✓ vídeo processado:', path);
    return { src: out + '.mp4', poster: out + '.jpg' };
  } catch (e) { console.warn('⚠ falha ao converter vídeo, usando original:', path); return { src: path, poster: '' }; }
}

/* ---------------- componentes ---------------- */
const carousel = (label, slides, { autoplay = 3800, cls = '', video = false } = {}) =>
  `<div class="carousel${cls ? ' ' + cls : ''} reveal" data-carousel${video ? ' data-video' : ''} data-autoplay="${autoplay}" aria-roledescription="carrossel" aria-label="${esc(label)}">` +
  `<ul class="carousel-track">${slides.join('')}</ul>` +
  `<div class="carousel-ui"><button class="car-btn" type="button" data-prev aria-label="Anterior">${icon('i-left')}</button>` +
  `<div class="car-dots" data-dots></div><button class="car-btn" type="button" data-next aria-label="Próximo">${icon('i-right')}</button></div></div>`;
const SZ = 'min(72vw, 320px)';
const slides = async (itens) => (await Promise.all((itens || []).map(async (it) => {
  const p = await pic(it.foto, SZ, it.descricao_foto || it.nome || '', { ratio: '3/4' });
  if (!p) return '';
  const cap = it.nome ? `<figcaption><b>${esc(it.nome)}</b>${it.detalhe ? `<small>${esc(it.detalhe)}</small>` : ''}</figcaption>` : '';
  return `<li class="slide"><figure>${p}${cap}</figure></li>`;
}))).filter(Boolean);

/* ---------------- conteúdo ---------------- */
const ini = C('inicio'), cel = C('celulares'), bol = C('boleto'), up = C('upgrade'), ac = C('acessorios'), cap = C('capas'),
  vid = C('videos'), as = C('assistencia'), cli = C('clientes'), ceo = C('ceo'), ct = C('contato'), loc = C('localizacao'), fin = C('final');
const WA = wa(g.mensagem_whatsapp);
const ADDR_Q = encodeURIComponent(g.endereco_mapa);
const DAYNUM = { 'domingo': 0, 'segunda': 1, 'terça': 2, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sábado': 6, 'sabado': 6 };
const dayNum = (d) => { const k = Object.keys(DAYNUM).find((x) => String(d).toLowerCase().startsWith(x)); return k == null ? -1 : DAYNUM[k]; };
const hours = (g.horarios || []).map((h) => {
  const n = dayNum(h.dia);
  const txt = h.fechado ? 'Fechado' : `${h.abre} às ${h.fecha}`;
  const data = h.fechado ? '' : ` data-open="${toMin(h.abre)}" data-close="${toMin(h.fecha)}"`;
  return `<li data-day="${n}"${data}><span>${esc(h.dia)}</span><span>${esc(txt)}</span></li>`;
}).join('');
const EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const groups = {};
(g.horarios || []).filter((h) => !h.fechado).forEach((h) => { const k = h.abre + '-' + h.fecha; (groups[k] ||= { opens: h.abre, closes: h.fecha, dayOfWeek: [] }).dayOfWeek.push(EN[dayNum(h.dia)]); });
const resumo = (() => {
  const abbr = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'];
  const out = []; let cur = null;
  (g.horarios || []).forEach((h) => {
    const t = h.fechado ? 'fechado' : `${h.abre} às ${h.fecha}`; const n = dayNum(h.dia);
    if (cur && cur.t === t) cur.to = n; else { cur = { from: n, to: n, t }; out.push(cur); }
  });
  return out.map((r) => `${abbr[r.from]}${r.to !== r.from ? ' a ' + abbr[r.to].toLowerCase() : ''}, ${r.t}`).join(' • ');
})();

const schema = {
  '@context': 'https://schema.org', '@type': 'MobilePhoneStore', '@id': `${SITE}/#loja`, name: g.nome_loja, slogan: 'Conecte-se com o futuro',
  url: `${SITE}/`, logo: `${SITE}/img/logo-itrend.svg`, image: `${SITE}/og-image.jpg`, description: g.seo_descricao,
  telephone: '+' + PHONE.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '$1 $2 $3-$4'), email: String(g.email).toLowerCase(),
  address: { '@type': 'PostalAddress', streetAddress: `${g.endereco_rua}, ${g.bairro}`, addressLocality: g.cidade, addressRegion: g.estado, postalCode: g.cep, addressCountry: 'BR' },
  openingHoursSpecification: Object.values(groups).map((x) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: x.dayOfWeek.length === 1 ? x.dayOfWeek[0] : x.dayOfWeek, opens: x.opens, closes: x.closes })),
  paymentAccepted: (ct.pagamentos || []).map((p) => p.texto).join(', '), areaServed: `${g.cidade}, ${g.estado}`, sameAs: [IG],
};

const ICONS = readFileSync(join(ROOT, 'build', 'icons.svg'), 'utf8');
const chipIco = ['i-card', 'i-barcode', 'i-shield'];
const vidSlides = (vid.videos || []).map((v, i) => { const r = video(v.video); if (!r) return ''; return `<li class="slide vslide"><video muted playsinline preload="none" width="540" height="960"${r.poster ? ` poster="${r.poster}"` : ''} data-src="${r.src}" aria-label="${esc(v.descricao || 'Vídeo ' + (i + 1))}"></video><span class="vprog" aria-hidden="true"><i></i></span></li>`; }).filter(Boolean);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(g.seo_titulo)}</title>
  <meta name="description" content="${esc(g.seo_descricao)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SITE}/">
  <meta name="theme-color" content="#2E1DDD">
  <meta name="format-detection" content="telephone=no">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="${esc(g.nome_loja)}">
  <meta property="og:title" content="${esc(g.seo_titulo)}">
  <meta property="og:description" content="${esc(g.seo_descricao)}">
  <meta property="og:url" content="${SITE}/">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(g.nome_loja)}, loja de celulares, acessórios e assistência técnica em ${esc(g.cidade)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(g.seo_titulo)}">
  <meta name="twitter:description" content="${esc(g.seo_descricao)}">
  <meta name="twitter:image" content="${SITE}/og-image.jpg">
  <link rel="preload" href="/fonts/sora-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
</head>
<body>
<script>document.documentElement.classList.add('js')</script>
<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
<div class="scroll-progress" aria-hidden="true"><i></i></div>
${ICONS}

<header class="site-header" id="topo-header">
  <div class="container">
    <a class="brand" href="#topo" aria-label="${esc(g.nome_loja)}, voltar ao topo"><img src="/img/logo-itrend.svg" width="492" height="275" alt="${esc(g.nome_loja)}" decoding="async"></a>
    <nav class="nav" aria-label="Seções">
      <a href="#celulares">Celulares</a><a href="#acessorios">Acessórios</a><a href="#capas">Capas</a><a href="#assistencia">Assistência</a><a href="#clientes">Clientes</a><a href="#localizacao">Localização</a>
    </nav>
    <a class="btn btn-wa header-cta" href="${WA}" ${EXT}>${icon('i-wa')}<span>Atendimento</span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-mobile" aria-label="Abrir menu"><span></span></button>
  </div>
</header>
<div class="mobile-menu" id="menu-mobile" aria-hidden="true">
  <a href="#celulares">Celulares</a><a href="#boleto">Compre no boleto</a><a href="#acessorios">Acessórios</a><a href="#capas">Capas</a><a href="#assistencia">Assistência técnica</a><a href="#clientes">Clientes</a><a href="#localizacao">Localização e horário</a>
  ${btn(WA, 'Falar no WhatsApp')}
</div>

<main id="conteudo">
  <section class="hero" id="topo" aria-labelledby="hero-title">
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="eyebrow reveal">${esc(ini.etiqueta)}</span>
        <h1 class="h-display split-words" id="hero-title"><span class="hero-name">${esc(ini.titulo_marca)}</span> <span class="grad-text">${esc(ini.titulo_destaque)}</span></h1>
        <p class="brand-line reveal" style="--d:.15s">${(ini.marcas || []).map(esc).join(' <i></i> ')}</p>
        <p class="lead reveal" style="--d:.2s">${esc(ini.texto)}</p>
        <div class="btn-row reveal" style="--d:.25s">${btn(wa(ini.mensagem_whatsapp), ini.botao)}${btn(IG, ini.botao_instagram, 'btn-ghost', 'i-ig')}</div>
        <ul class="hero-trust reveal" style="--d:.3s">${(ini.selos || []).map((s) => `<li>${icon(s.icone)}${esc(s.texto)}</li>`).join('')}</ul>
      </div>
      <div class="hero-visual reveal" style="--d:.1s" aria-hidden="true">
        <div class="orb">
          <div class="orb-ring r1"><span class="dot"></span></div><div class="orb-ring r2"></div><div class="orb-ring r3"></div>
          <img class="orb-logo" src="/img/isotipo-itrend.svg" width="176" height="160" alt="" fetchpriority="high" decoding="async">
          ${(ini.chips || []).slice(0, 3).map((c, i) => `<div class="float-chip chip-${'abc'[i]}"><span class="ico${i === 1 ? ' o' : ''}">${icon(chipIco[i])}</span><span><b>${esc(c.destaque)}</b>${esc(c.texto)}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="callouts" aria-label="Destaques">
    <div class="container"><ul class="callout-grid">${(ini.chamadas || []).map((c, i) => `<li class="callout${i === 4 ? ' wide' : ''} reveal" style="--d:${(i * 0.05).toFixed(2)}s"><span class="ico${i % 2 ? ' o' : ''}">${icon(c.icone)}</span><strong>${esc(c.titulo)}</strong><span>${esc(c.texto)}</span></li>`).join('')}</ul></div>
  </section>

  <section class="section" id="celulares" aria-labelledby="cel-title">
    <div class="container">
      <div class="split">
        <div class="split-copy">
          <span class="eyebrow reveal">${esc(cel.etiqueta)}</span>
          <h2 class="h-section split-words" id="cel-title">${head(cel.titulo, cel.destaque)}</h2>
          <p class="lead reveal">${esc(cel.texto)}</p>
          <ul class="check-list reveal">${checks(cel.lista)}</ul>
          <div class="btn-row reveal">${btn(wa(cel.mensagem_whatsapp), cel.botao, 'btn-primary')}</div>
        </div>
        <figure class="showcase reveal">${await pic(cel.foto_vitrine, '(min-width: 900px) 520px, 92vw', cel.foto_vitrine_descricao, { ratio: '3/4' })}<figcaption>${icon('i-sparkle')}${esc(cel.selo_foto)}</figcaption></figure>
      </div>
      <div class="brand-cards">${(cel.marcas || []).map((m, i) => `<article class="brand-card reveal" style="--d:${(i * 0.06).toFixed(2)}s"><span class="mark${i === 1 ? ' o' : ''}">${icon(['i-sparkle', 'i-camera', 'i-chip'][i % 3])}</span><span class="tag">${esc(m.tag)}</span><h3>${esc(m.nome)}</h3><p>${esc(m.texto)}</p></article>`).join('')}</div>
    </div>
    <div class="container"><div class="sub-title reveal"><h3>${esc(cel.titulo_carrossel)}</h3></div></div>
    ${carousel('Celulares disponíveis', await slides(cel.carrossel), { autoplay: 4000 })}
  </section>

  <section class="section band band-blue" id="boleto" aria-labelledby="boleto-title">
    <div class="container next-grid">
      <div class="boleto-visual reveal">${await pic(bol.foto, '(min-width: 900px) 520px, 92vw', bol.foto_descricao)}<span class="boleto-tag">${icon('i-barcode')}${esc(bol.selo_foto)}</span></div>
      <div class="split-copy">
        <span class="eyebrow reveal">${esc(bol.etiqueta)}</span>
        <h2 class="h-section split-words" id="boleto-title">${head(bol.titulo, bol.destaque)}</h2>
        <p class="lead reveal">${esc(bol.texto)}</p>
        <ul class="next-feats reveal">${(bol.itens || []).map((x) => `<li>${icon(x.icone)}<b>${esc(x.titulo)}</b>${esc(x.texto)}</li>`).join('')}</ul>
        <div class="btn-row reveal">${btn(wa(bol.mensagem_whatsapp), bol.botao, 'btn-orange')}</div>
      </div>
    </div>
  </section>

  <section class="section" id="upgrade" aria-labelledby="up-title">
    <div class="container"><div class="split rev">
      <div class="split-copy">
        <span class="eyebrow reveal">${esc(up.etiqueta)}</span>
        <h2 class="h-section split-words" id="up-title">${head(up.titulo, up.destaque)}</h2>
        <p class="lead reveal">${esc(up.texto)}</p>
        <ul class="check-list reveal">${checks(up.lista, 'i-swap')}</ul>
        <div class="btn-row reveal">${btn(wa(up.mensagem_whatsapp), up.botao)}<a class="btn btn-ghost" href="tel:+${PHONE}">${icon('i-phone')}<span>${esc(g.telefone)}</span></a></div>
      </div>
      <figure class="flyer reveal">${await pic(up.flyer, '(min-width: 900px) 480px, 92vw', up.flyer_descricao)}</figure>
    </div></div>
  </section>

  <section class="section soft" id="acessorios" aria-labelledby="ac-title">
    <div class="container"><div class="section-head center">
      <span class="eyebrow reveal">${esc(ac.etiqueta)}</span>
      <h2 class="h-section split-words" id="ac-title">${head(ac.titulo, ac.destaque)}</h2>
      <p class="lead reveal">${esc(ac.texto)}</p>
    </div></div>
    ${(await Promise.all((ac.grupos || []).map(async (gr, i) => `<div class="container"><div class="sub-title reveal"><h3>${esc(gr.titulo)}</h3></div></div>${carousel(gr.titulo, await slides(gr.itens), { autoplay: 3600 + i * 300 })}`))).join('\n')}
    <div class="container"><div class="btn-row center reveal" style="margin-top:28px">${btn(wa(ac.mensagem_whatsapp), ac.botao, 'btn-primary')}</div></div>
  </section>

  <section class="section band band-orange" id="capas" aria-labelledby="capas-title">
    <div class="container"><div class="section-head center">
      <span class="eyebrow reveal">${esc(cap.etiqueta)}</span>
      <h2 class="h-section split-words" id="capas-title">${head(cap.titulo, cap.destaque, 'hl')}</h2>
      <p class="lead reveal">${esc(cap.texto)}</p>
      <ul class="pill-trio reveal">${(cap.pilulas || []).map((p, i) => `<li>${icon(['i-sparkle', 'i-shield', 'i-magnet'][i % 3])}${esc(p)}</li>`).join('')}</ul>
    </div></div>
    ${carousel('Modelos de capinhas', await slides(cap.itens), { autoplay: 3400 })}
    <div class="container"><div class="btn-row center reveal" style="margin-top:28px">${btn(wa(cap.mensagem_whatsapp), cap.botao, 'btn-light')}</div></div>
  </section>

  <section class="section" id="videos" aria-labelledby="vid-title">
    <div class="container"><div class="section-head center">
      <span class="eyebrow reveal">${esc(vid.etiqueta)}</span>
      <h2 class="h-section split-words" id="vid-title">${head(vid.titulo, vid.destaque)}</h2>
      <p class="lead reveal">${igLink(vid.texto)}</p>
    </div></div>
    ${carousel('Vídeos', vidSlides, { autoplay: 0, cls: 'is-video', video: true })}
  </section>

  <section class="section band band-blue" id="assistencia" aria-labelledby="as-title">
    <div class="container">
      <div class="assist-grid">
        <div class="assist-visual reveal">${await pic(as.foto, '(min-width: 900px) 420px, 80vw', as.foto_descricao)}<span class="assist-chip a">${icon('i-bolt')}${esc(as.selo_1)}</span><span class="assist-chip b">${icon('i-shield')}${esc(as.selo_2)}</span></div>
        <div class="split-copy">
          <span class="eyebrow reveal">${esc(as.etiqueta)}</span>
          <h2 class="h-section split-words" id="as-title">${head(as.titulo, as.destaque)}</h2>
          <p class="lead reveal">${esc(as.texto)}</p>
          <div class="btn-row reveal">${btn(wa(as.mensagem_whatsapp), as.botao, 'btn-orange')}</div>
        </div>
      </div>
      <ul class="serv-grid" aria-label="Serviços de assistência técnica">${(as.servicos || []).map((s, n) => `<li class="serv reveal" style="--d:${((n % 4) * 0.05).toFixed(2)}s"><span class="ico">${icon(s.icone || 'i-wrench')}</span><div><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></div></li>`).join('')}</ul>
    </div>
  </section>

  <section class="section" id="clientes" aria-labelledby="cl-title">
    <div class="container"><div class="split">
      <div class="split-copy">
        <span class="eyebrow reveal">${esc(cli.etiqueta)}</span>
        <h2 class="h-section split-words" id="cl-title">${head(cli.titulo, cli.destaque)}</h2>
        <p class="lead reveal">${esc(cli.texto)}</p>
        <ul class="check-list reveal">${checks(cli.lista)}</ul>
        <div class="btn-row reveal">${btn(wa(cli.mensagem_whatsapp), cli.botao, 'btn-primary')}</div>
      </div>
      <div class="feature-gallery reveal">
        <figure class="big">${await pic(cli.foto_destaque, '(min-width: 900px) 400px, 92vw', cli.foto_destaque_descricao, { ratio: '3/4' })}<span class="badge">${icon('i-star')}${esc(cli.selo_foto)}</span></figure>
        <figure class="small">${await pic(cli.foto_2, '(min-width: 900px) 300px, 46vw', cli.foto_2_descricao, { ratio: '3/4' })}</figure>
        <figure class="small">${await pic(cli.foto_3, '(min-width: 900px) 300px, 46vw', cli.foto_3_descricao, { ratio: '3/4' })}</figure>
      </div>
    </div></div>
    <div class="container"><div class="sub-title reveal"><h3>${esc(cli.titulo_carrossel)}</h3></div></div>
    ${carousel('Fotos de clientes', (await Promise.all((cli.carrossel || []).map(async (c) => { const p = await pic(c.foto, SZ, c.descricao_foto, { ratio: '3/4' }); return p ? `<li class="slide">${p}</li>` : ''; }))).filter(Boolean), { autoplay: 3400 })}
  </section>

  <section class="section ceo" id="ceo" aria-labelledby="ceo-title" style="padding-top:0">
    <div class="container"><article class="ceo-card reveal">
      <div class="ceo-photo">
        ${await pic(ceo.foto, '(min-width: 900px) 520px, 100vw', ceo.foto_descricao, { ratio: '3/4' })}
        ${ceo.foto_pequena ? `<figure class="ceo-inset">${await pic(ceo.foto_pequena, '(min-width: 900px) 200px, 38vw', ceo.foto_pequena_descricao, { ratio: '3/4' })}</figure>` : ''}
        <div class="ceo-name-tag"><img class="iso" src="/img/isotipo-itrend.svg" width="176" height="160" alt="" loading="lazy" decoding="async"><div><b>${esc(g.ceo_nome)}</b><span>${esc(ceo.cargo)}</span></div></div>
      </div>
      <div class="ceo-copy">
        <span class="eyebrow">${esc(ceo.etiqueta)}</span>
        <h2 class="h-section split-words" id="ceo-title">${head(ceo.titulo, ceo.destaque)}</h2>
        <p>${esc(ceo.texto)}</p>
        <blockquote>${esc(ceo.citacao)}<footer>${esc(ceo.citacao_rodape)}</footer></blockquote>
        <ul class="ceo-pills">${(ceo.pilulas || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
    </article></div>
  </section>

  <section class="section" style="padding-top:0" aria-labelledby="logo-title">
    <div class="container"><div class="logo-showcase reveal">
      <img src="/img/logo-itrend.svg" width="492" height="275" alt="${esc(g.nome_loja)}" loading="lazy" decoding="async">
      <h2 class="visually-hidden" id="logo-title">${esc(g.nome_loja)}</h2>
      <p class="lead">${(ct.logo_linhas || []).map(esc).join('<br>')}</p>
    </div></div>
  </section>

  <section class="section" id="contato" aria-labelledby="ct-title" style="padding-top:0">
    <div class="container">
      <div class="section-head center"><span class="eyebrow reveal">${esc(ct.etiqueta)}</span><h2 class="h-section split-words" id="ct-title">${head(ct.titulo, ct.destaque)}</h2></div>
      <div class="info-grid">
        <div class="panel reveal">
          <h3 class="h-card">Contato</h3>
          <ul class="contact-list">
            <li><a class="contact-item" href="${WA}" ${EXT}><span class="ico wa">${icon('i-wa')}</span><span><small>WhatsApp</small><b>${esc(g.telefone)}</b></span>${icon('i-arrow', ' class="go"')}</a></li>
            <li><a class="contact-item" href="tel:+${PHONE}"><span class="ico">${icon('i-phone')}</span><span><small>Telefone</small><b>${esc(g.telefone)}</b></span>${icon('i-arrow', ' class="go"')}</a></li>
            <li><a class="contact-item" href="mailto:${esc(String(g.email).toLowerCase())}"><span class="ico">${icon('i-mail')}</span><span><small>E-mail</small><b>${esc(g.email)}</b></span>${icon('i-arrow', ' class="go"')}</a></li>
            <li><a class="contact-item" href="${IG}" ${EXT}><span class="ico o">${icon('i-ig')}</span><span><small>Instagram oficial</small><b>@${esc(g.instagram)}</b></span>${icon('i-arrow', ' class="go"')}</a></li>
          </ul>
        </div>
        <div class="panel reveal" style="--d:.06s">
          <h3 class="h-card">Formas de pagamento</h3>
          <ul class="pay-list">${(ct.pagamentos || []).map((p) => `<li class="pay-item"><span class="ico${p.icone === 'i-barcode' ? ' o' : ''}">${icon(p.icone)}</span>${esc(p.texto)}</li>`).join('')}</ul>
          <div class="ig-banner"><div><h2>${esc(ct.banner_titulo)}</h2><p>${esc(ct.banner_texto)}</p></div><a class="btn btn-light" href="${IG}" ${EXT}>${icon('i-ig')}<span>${esc(ct.banner_botao)}</span></a></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="localizacao" aria-labelledby="loc-title" style="padding-top:0">
    <div class="container">
      <div class="section-head"><span class="eyebrow reveal">${esc(loc.etiqueta)}</span><h2 class="h-section split-words" id="loc-title">${head(loc.titulo, loc.destaque)}</h2></div>
      <div class="loc-grid">
        <div class="loc-store reveal">
          <figure class="store-photo">${await pic(loc.foto_fachada, '(min-width: 960px) 460px, 92vw', loc.foto_fachada_descricao, { ratio: '4/5' })}<figcaption>${icon('i-pin')}Nossa loja</figcaption></figure>
          <div class="store-addr"><span class="ico o">${icon('i-pin')}</span><div><b>${esc(g.endereco_rua)}</b><span>${esc(g.endereco_complemento)}</span></div></div>
        </div>
        <div class="loc-main">
          <div class="map-card reveal" data-map>
            <iframe title="Mapa com a localização da ${esc(g.nome_loja)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" tabindex="-1" src="https://maps.google.com/maps?q=${ADDR_Q}&amp;z=17&amp;hl=pt-BR&amp;output=embed"></iframe>
            <div class="map-tint"></div><div class="pin-pulse" aria-hidden="true"></div><div class="pin-shadow" aria-hidden="true"></div>
            <div class="pin3d" aria-hidden="true"><div class="bob"><div class="head"></div><div class="face"><img src="/img/isotipo-itrend.svg" width="176" height="160" alt="" loading="lazy" decoding="async"></div></div><span class="tip"></span></div>
            <div class="map-overlay">
              <div class="addr"><div><b>${esc(g.nome_loja)}</b><span>${esc(g.endereco_rua)}, ${esc(g.bairro)}</span></div></div>
              <a class="btn btn-orange btn-loc" href="https://www.google.com/maps/search/?api=1&amp;query=${ADDR_Q}" ${EXT}><span class="iso-badge"><img src="/img/isotipo-itrend.svg" width="176" height="160" alt="" loading="lazy" decoding="async"></span><span>Como chegar</span></a>
            </div>
          </div>
          <div class="panel hours reveal" data-hours>
            <div class="hours-head"><h3 class="h-card" style="display:flex;align-items:center;gap:10px">${icon('i-clock', ' style="width:24px;height:24px;color:var(--o-500)"')}Horário de funcionamento</h3><span class="status" data-status hidden></span></div>
            ${g.aviso_horario ? `<p class="hours-note">${icon('i-check')}${esc(g.aviso_horario)}</p>` : ''}
            <ul>${hours}</ul>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0" aria-labelledby="final-title">
    <div class="container"><div class="final-cta reveal">
      <img src="/img/logo-itrend-branco.svg" width="492" height="275" alt="" class="final-logo" loading="lazy" decoding="async">
      <h2 class="h-section split-words" id="final-title">${esc(fin.titulo)}</h2>
      <p class="lead">${esc(fin.texto)}</p>
      <div class="btn-row">
        <a class="btn btn-light" href="${wa(fin.mensagem_1)}" ${EXT}>${icon('i-wa', ' style="color:#17a04e"')}<span>${esc(fin.botao_1)}</span></a>
        <a class="btn btn-light" href="${wa(fin.mensagem_2)}" ${EXT}>${icon('i-wrench', ' style="color:var(--o-500)"')}<span>${esc(fin.botao_2)}</span></a>
      </div>
    </div></div>
  </section>
</main>

<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><a class="brand" href="#topo" aria-label="${esc(g.nome_loja)}, voltar ao topo"><img src="/img/logo-itrend-branco.svg" width="492" height="275" alt="${esc(g.nome_loja)}" loading="lazy" decoding="async"></a><p>${esc(g.rodape_texto)}</p></div>
      <nav class="footer-links" aria-label="Navegação do rodapé"><h3>Navegue</h3><a href="#celulares">Celulares</a><a href="#acessorios">Acessórios</a><a href="#assistencia">Assistência técnica</a><a href="#clientes">Clientes</a></nav>
      <div class="footer-links"><h3>Contato</h3><a href="${WA}" ${EXT}>${esc(g.telefone)}</a><a href="mailto:${esc(String(g.email).toLowerCase())}">${esc(g.email)}</a><a href="${IG}" ${EXT}>@${esc(g.instagram)}</a></div>
      <div class="footer-links"><h3>Endereço</h3><a href="#localizacao">${esc(g.endereco_rua)}, ${esc(g.endereco_complemento)}</a><a href="#localizacao">${esc(resumo)}</a>${g.aviso_horario ? `<span class="footer-note">${esc(g.aviso_horario)}</span>` : ""}</div>
    </div>
    <div class="footer-bottom"><span>© <span data-year>${new Date().getFullYear()}</span> ${esc(g.nome_loja)}. Todos os direitos reservados.</span><span>CEO: ${esc(g.ceo_nome)}</span>${g.nota_garantia ? `<span>${esc(g.nota_garantia)}</span>` : ''}</div>
  </div>
</footer>

<div class="fab-wrap">
  <a class="fab fab-ig" href="${IG}" ${EXT} aria-label="Instagram da ${esc(g.nome_loja)}"><span class="ico">${icon('i-ig')}</span>Instagram</a>
  <a class="fab fab-wa" href="${WA}" ${EXT} aria-label="Falar com a ${esc(g.nome_loja)} no WhatsApp"><span class="ico">${icon('i-wa')}</span>WhatsApp<span class="label-long">&nbsp;atendimento</span></a>
</div>
<script src="/main.js" defer></script>
</body>
</html>
`;

writeFileSync(join(PUB, 'index.html'), html);
// mantém robots e sitemap com a URL do site
writeFileSync(join(PUB, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${SITE}/</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n</urlset>\n`);
console.log(`✓ index.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
