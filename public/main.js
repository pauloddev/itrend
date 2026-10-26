/* iTrend · interações (sem dependências) */
(() => {
  'use strict';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- Header + barra de progresso ---------- */
  const header = document.getElementById('topo-header');
  const bar = document.querySelector('.scroll-progress i');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    }
  };
  onScroll();
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu-mobile');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('is-open') && !menu.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });

  /* ---------- Títulos: quebra em palavras para animar ---------- */
  document.querySelectorAll('.split-words').forEach((h) => {
    if (h.getAttribute('aria-label') == null) h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const wrap = (node) => {
      const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      w.style.setProperty('--i', i++);
      return w;
    };
    const process = (parent) => {
      Array.from(parent.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = wrap(); const s = document.createElement('span'); s.textContent = part; w.appendChild(s); frag.appendChild(w);
          });
          parent.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.classList.contains('grad-text')) {
          // gradiente: cada palavra recebe o seu trecho da transição de cor
          const light = !!n.closest('.band-blue, .ceo-copy');
          const [c0, c1] = light ? [[255, 208, 176], [254, 102, 3]] : [[46, 29, 221], [254, 102, 3]];
          const mix = (t) => `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t)).join(',')})`;
          const words = n.textContent.trim().split(/\s+/);
          const frag = document.createDocumentFragment();
          words.forEach((word, k) => {
            if (k) frag.appendChild(document.createTextNode(' '));
            const w = wrap(); const s = document.createElement('span'); s.className = 'grad-text'; s.textContent = word;
            s.style.backgroundImage = `linear-gradient(100deg, ${mix(k / words.length)}, ${mix((k + 1) / words.length)})`;
            w.appendChild(s); frag.appendChild(w);
          });
          parent.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.classList.contains('hero-name')) {
          const w = wrap(); w.style.display = 'block'; parent.replaceChild(w, n); const s = document.createElement('span'); s.appendChild(n); w.appendChild(s);
        } else if (n.nodeType === 1) {
          process(n);
        }
      });
    };
    process(h);
  });

  /* ---------- Reveal ao rolar (textos, blocos e faixas coloridas) ---------- */
  const reveals = document.querySelectorAll('.reveal, .split-words, .band');
  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Contadores ---------- */
  const fmt = new Intl.NumberFormat('pt-BR');
  const runCount = (el) => {
    const to = Number(el.dataset.to); const pre = el.dataset.prefix || '';
    if (reduceMotion) { el.textContent = pre + fmt.format(to); return; }
    const dur = 1200; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur); const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = pre + fmt.format(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (hasIO) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { runCount(en.target); cio.unobserve(en.target); } });
    }, { threshold: 0.6 });
    document.querySelectorAll('.count').forEach((c) => cio.observe(c));
  }

  /* ---------- Carrossel com destaque central (fotos e vídeos) ---------- */
  document.querySelectorAll('[data-carousel]').forEach((root) => {
    const track = root.querySelector('.carousel-track');
    const slides = Array.from(track.children);
    const dotsWrap = root.querySelector('[data-dots]');
    const isVideo = root.hasAttribute('data-video');
    let active = -1; let timer = null; let userTouched = false; let inView = false;

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Ir para o item ${i + 1} de ${slides.length}`);
      b.addEventListener('click', () => { stop(); go(i); });
      dotsWrap.appendChild(b);
      return b;
    });

    const centerOf = (el) => el.offsetLeft + el.offsetWidth / 2;
    const go = (i, behavior) => {
      const n = (i + slides.length) % slides.length;
      track.scrollTo({ left: centerOf(slides[n]) - track.clientWidth / 2, behavior: behavior || (reduceMotion ? 'auto' : 'smooth') });
    };

    /* vídeos: só o do centro toca, sem som; ao terminar, passa para o próximo */
    const vids = isVideo ? slides.map((s) => s.querySelector('video')) : [];
    const load = (v) => { if (v && !v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = 'auto'; } };
    let raf2 = 0;
    const progress = () => {
      const v = vids[active];
      if (v && v.duration) slides[active].style.setProperty('--vp', (v.currentTime / v.duration).toFixed(3));
      raf2 = requestAnimationFrame(progress);
    };
    const playActive = () => {
      if (!isVideo) return;
      vids.forEach((v, i) => { if (i !== active && v && !v.paused) v.pause(); });
      const v = vids[active]; if (!v) return;
      [active - 1, active + 1].forEach((k) => { const nv = vids[(k + vids.length) % vids.length]; if (nv && !nv.src && nv.dataset.src) { nv.src = nv.dataset.src; nv.preload = 'metadata'; } });
      if (!inView) { v.pause(); return; }
      load(v); v.muted = true; v.currentTime = 0;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      cancelAnimationFrame(raf2); raf2 = requestAnimationFrame(progress);
    };
    vids.forEach((v, i) => {
      if (!v) return;
      v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
      v.addEventListener('ended', () => { if (i === active) go(active + 1); });
    });

    const update = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0; let bestD = Infinity;
      slides.forEach((s, i) => { const d = Math.abs(centerOf(s) - mid); if (d < bestD) { bestD = d; best = i; } });
      if (best === active) return;
      active = best;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === best));
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === best)));
      playActive();
    };
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', () => { const a = active; active = -1; update(); go(a, 'auto'); });

    root.querySelector('[data-prev]').addEventListener('click', () => { stop(); go(active - 1); });
    root.querySelector('[data-next]').addEventListener('click', () => { stop(); go(active + 1); });
    track.addEventListener('pointerdown', stop, { passive: true });
    track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { stop(); go(active - 1); }
      if (e.key === 'ArrowRight') { stop(); go(active + 1); }
    });
    slides.forEach((s) => s.addEventListener('click', () => { const i = slides.indexOf(s); if (i !== active) { stop(); go(i); } }));

    function stop() { userTouched = true; clearInterval(timer); timer = null; }
    const delay = Number(root.dataset.autoplay || 0);
    const start = () => {
      if (!delay || reduceMotion || userTouched || timer) return;
      timer = setInterval(() => go(active + 1), delay);
    };
    root.addEventListener('mouseenter', () => { clearInterval(timer); timer = null; });
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', () => { clearInterval(timer); timer = null; });

    requestAnimationFrame(() => { go(Math.min(1, slides.length - 1), 'auto'); update(); });

    if (hasIO) {
      new IntersectionObserver((en) => {
        en.forEach((e) => {
          inView = e.isIntersecting;
          if (inView) { start(); playActive(); }
          else { clearInterval(timer); timer = null; vids.forEach((v) => v && v.pause()); cancelAnimationFrame(raf2); }
        });
      }, { threshold: 0.3 }).observe(root);
    } else { inView = true; }
  });

  /* ---------- Horário: destaca o dia e mostra aberto/fechado (horário de Boa Vista) ---------- */
  const hours = document.querySelector('[data-hours]');
  if (hours) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Boa_Vista', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t).value;
      const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      const mins = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
      const row = hours.querySelector(`[data-day="${dayIdx}"]`);
      if (row) row.classList.add('today');
      const close = dayIdx === 0 ? 12 * 60 : 18 * 60 + 30; // dom. até 12:00, seg. a sáb. até 18:30
      const open = mins >= 8 * 60 && mins < close;
      const st = hours.querySelector('[data-status]');
      st.textContent = open ? 'Aberto agora' : 'Fechado agora';
      st.classList.add(open ? 'open' : 'closed');
      st.hidden = false;
    } catch (e) { /* sem destaque se o navegador não suportar */ }
  }

  /* ---------- Ano no rodapé ---------- */
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = String(new Date().getFullYear());
})();
