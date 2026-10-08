(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Mobile navigation ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-nav');

  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Highlight the current section in the nav ---------- */
  const links = [...document.querySelectorAll('.primary-nav a[href^="#"]')];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => {
          if (a.getAttribute('href') === '#' + entry.target.id) {
            a.setAttribute('aria-current', 'true');
          } else {
            a.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Hero: pixel packets hopping across a wireless mesh ---------- */
  const canvas = document.getElementById('mesh');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const css = getComputedStyle(document.documentElement);
  const COLOR = {
    link: css.getPropertyValue('--accent').trim() || '#5C8374',
    node: css.getPropertyValue('--accent-light').trim() || '#9EC8B9',
    fill: css.getPropertyValue('--secondary').trim() || '#1B4242',
  };

  const PX = 4; // one "pixel" in CSS px
  const snap = (v) => Math.round(v / PX) * PX;

  let w = 0, h = 0, nodes = [], packets = [], raf = 0, last = 0, spawnIn = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Jittered grid keeps nodes evenly spread without clumping.
    const cell = Math.max(90, Math.sqrt((w * h) / 28));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          x: snap((c + 0.5) * cell + rand(-0.3, 0.3) * cell),
          y: snap((r + 0.5) * cell + rand(-0.3, 0.3) * cell),
          pulse: 0,
          links: [],
        });
      }
    }
    const reach = cell * 1.45;
    nodes.forEach((a, i) => {
      nodes.forEach((b, j) => {
        if (i < j && Math.hypot(a.x - b.x, a.y - b.y) < reach) {
          a.links.push(j);
          b.links.push(i);
        }
      });
    });
    packets = [];
  }

  // Links are drawn as right-angle "circuit traces": horizontal first, then vertical,
  // always from the lower node index to the higher one so both directions share one path.
  function pointOn(from, to, t) {
    const reversed = from > to;
    const a = nodes[reversed ? to : from];
    const b = nodes[reversed ? from : to];
    const u = reversed ? 1 - t : t;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = u * (Math.abs(dx) + Math.abs(dy));
    if (d <= Math.abs(dx)) return [a.x + Math.sign(dx) * d, a.y];
    return [b.x, a.y + Math.sign(dy) * (d - Math.abs(dx))];
  }

  function pathLength(from, to) {
    const a = nodes[from], b = nodes[to];
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function send(from, prev, hops) {
    const options = nodes[from].links.filter((n) => n !== prev);
    if (!options.length) return;
    const to = options[(Math.random() * options.length) | 0];
    packets.push({
      from,
      to,
      t: 0,
      len: Math.max(pathLength(from, to), 1),
      speed: rand(0.08, 0.14), // px per ms
      hops,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Traces
    ctx.fillStyle = COLOR.link;
    ctx.globalAlpha = 0.45;
    nodes.forEach((a, i) => {
      a.links.forEach((j) => {
        if (j < i) return;
        const b = nodes[j];
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
        ctx.fillRect(x0, a.y - 1, x1 - x0, 2); // horizontal leg at a.y
        ctx.fillRect(b.x - 1, y0, 2, y1 - y0); // vertical leg at b.x
      });
    });

    // Nodes (square pads) and pulse rings
    ctx.globalAlpha = 1;
    nodes.forEach((n) => {
      if (n.pulse > 0.02) {
        const r = 8 + Math.round((1 - n.pulse) * 4) * PX;
        ctx.strokeStyle = COLOR.node;
        ctx.globalAlpha = n.pulse * 0.7;
        ctx.lineWidth = 2;
        ctx.strokeRect(n.x - r, n.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.link;
      ctx.fillRect(n.x - 6, n.y - 6, 12, 12);
      ctx.fillStyle = COLOR.fill;
      ctx.fillRect(n.x - 4, n.y - 4, 8, 8);
    });

    // Packets: a square head with a short stepped tail
    packets.forEach((p) => {
      ctx.fillStyle = COLOR.node;
      for (let k = 3; k >= 0; k--) {
        const tt = Math.max(0, p.t - (k * 10) / p.len);
        const [x, y] = pointOn(p.from, p.to, tt);
        ctx.globalAlpha = k === 0 ? 1 : 0.5 - k * 0.12;
        const s = k === 0 ? 8 : 6;
        ctx.fillRect(snap(x) - s / 2, snap(y) - s / 2, s, s);
      }
    });
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(now - last, 50);
    last = now;

    spawnIn -= dt;
    if (spawnIn <= 0 && packets.length < 6 && nodes.length) {
      send((Math.random() * nodes.length) | 0, -1, 0);
      spawnIn = rand(500, 1100);
    }

    nodes.forEach((n) => { n.pulse = Math.max(0, n.pulse - dt / 900); });

    packets = packets.filter((p) => {
      p.t += (p.speed * dt) / p.len;
      if (p.t < 1) return true;
      nodes[p.to].pulse = 1;
      if (p.hops < 4 && Math.random() < 0.8) send(p.to, p.from, p.hops + 1);
      return false;
    });

    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || reduceMotion.matches) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function refresh() {
    stop();
    build();
    draw();
    if (!reduceMotion.matches && !document.hidden && visible) start();
  }

  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible && !document.hidden ? start() : stop();
    }).observe(canvas);
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : visible && start()));
  reduceMotion.addEventListener('change', refresh);

  let resizeTimer;
  let lastWidth = canvas.clientWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Ignore height-only changes (mobile address bar) to avoid rebuilding the mesh.
      if (canvas.clientWidth !== lastWidth) {
        lastWidth = canvas.clientWidth;
        refresh();
      }
    }, 150);
  });

  refresh();
})();