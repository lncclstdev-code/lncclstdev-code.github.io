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

  /* ---------- Hero: packets hopping across a wireless mesh ---------- */
  const canvas = document.getElementById('mesh');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const COLOR = {
    link: css.getPropertyValue('--accent').trim() || '#5C8374',
    node: css.getPropertyValue('--accent-light').trim() || '#9EC8B9',
    fill: css.getPropertyValue('--secondary').trim() || '#1B4242',
  };

  let w = 0, h = 0, nodes = [], packets = [], raf = 0, last = 0, spawnIn = 0;

  const rand = (a, b) => a + Math.random() * (b - a);

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Jittered grid keeps nodes evenly spread without clumping.
    const cell = Math.max(90, Math.sqrt((w * h) / 28));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    nodes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push({
          x: (c + 0.5) * cell + rand(-0.3, 0.3) * cell,
          y: (r + 0.5) * cell + rand(-0.3, 0.3) * cell,
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

  function send(from, prev, hops) {
    const options = nodes[from].links.filter((n) => n !== prev);
    if (!options.length) return;
    packets.push({
      from,
      to: options[(Math.random() * options.length) | 0],
      t: 0,
      speed: rand(0.0007, 0.0012),
      hops,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = COLOR.link;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    nodes.forEach((a, i) => {
      a.links.forEach((j) => {
        if (j > i) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
        }
      });
    });
    ctx.stroke();

    ctx.globalAlpha = 1;
    nodes.forEach((n) => {
      if (n.pulse > 0.02) {
        ctx.strokeStyle = COLOR.node;
        ctx.globalAlpha = n.pulse * 0.6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5 + (1 - n.pulse) * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.fill;
      ctx.strokeStyle = COLOR.link;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    packets.forEach((p) => {
      const a = nodes[p.from], b = nodes[p.to];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      const tx = a.x + (b.x - a.x) * Math.max(0, p.t - 0.12);
      const ty = a.y + (b.y - a.y) * Math.max(0, p.t - 0.12);
      ctx.strokeStyle = COLOR.node;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.node;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
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
      p.t += p.speed * dt;
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