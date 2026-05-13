/* ========================================
   Qi Sun Academic Homepage - Main JavaScript
   ======================================== */

let siteConfig = null;

class NeuralNetwork {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.connections = [];
    this.nodeCount = 36;
    this.resize();
    this.init();
    window.addEventListener('resize', () => {
      this.resize();
      this.buildConnections();
    });
  }

  resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.offsetWidth;
    this.canvas.height = parent.offsetHeight;
  }

  init() {
    this.nodes = [];
    for (let i = 0; i < this.nodeCount; i += 1) {
      this.nodes.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 2 + 1.4,
        pulse: Math.random() * Math.PI * 2,
      });
    }
    this.buildConnections();
  }

  buildConnections() {
    this.connections = [];
    for (let i = 0; i < this.nodes.length; i += 1) {
      for (let j = i + 1; j < this.nodes.length; j += 1) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 190) {
          this.connections.push({ from: i, to: j, dist, spike: 0, spikeProgress: 0 });
        }
      }
    }
  }

  fireSpike() {
    if (this.connections.length === 0) return;
    const conn = this.connections[Math.floor(Math.random() * this.connections.length)];
    conn.spike = 1;
    conn.spikeProgress = 0;
  }

  update() {
    for (const node of this.nodes) {
      node.x += node.vx;
      node.y += node.vy;
      node.pulse += 0.02;
      if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;
    }

    for (const conn of this.connections) {
      if (conn.spike > 0) {
        conn.spikeProgress += 0.03;
        if (conn.spikeProgress >= 1) {
          conn.spike = 0;
          conn.spikeProgress = 0;
        }
      }
    }

    if (Math.random() < 0.035) this.fireSpike();
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const lineColor = 'rgba(79, 195, 161,';
    const nodeColor = 'rgba(242, 184, 75,';

    for (const conn of this.connections) {
      const a = this.nodes[conn.from];
      const b = this.nodes[conn.to];
      const alpha = Math.max(0.04, 0.14 - conn.dist / 1500);
      this.ctx.strokeStyle = `${lineColor} ${alpha})`;
      this.ctx.lineWidth = 0.9;
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.stroke();

      if (conn.spike > 0) {
        const px = a.x + (b.x - a.x) * conn.spikeProgress;
        const py = a.y + (b.y - a.y) * conn.spikeProgress;
        const gradient = this.ctx.createRadialGradient(px, py, 0, px, py, 10);
        gradient.addColorStop(0, `${nodeColor} 0.9)`);
        gradient.addColorStop(1, `${nodeColor} 0)`);
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 10, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    for (const node of this.nodes) {
      const glow = Math.sin(node.pulse) * 0.15 + 0.35;
      this.ctx.fillStyle = `${nodeColor} ${glow})`;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  animate() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', theme);
  const lang = document.body.getAttribute('data-lang') || 'zh';
  document.querySelectorAll('.theme-toggle').forEach((button) => {
    if (lang === 'en') {
      button.textContent = theme === 'dark' ? 'Light' : 'Dark';
    } else {
      button.textContent = theme === 'dark' ? '亮' : '暗';
    }
  });
}

function toggleTheme() {
  const current = localStorage.getItem('theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

async function loadSiteConfig() {
  if (siteConfig !== null) return siteConfig;
  try {
    const script = document.querySelector('script[src$="js/main.js"]');
    const src = script ? script.getAttribute('src') : '';
    const basePath = src ? src.replace(/js\/main\.js$/, '') : '';
    const response = await fetch(`${basePath}config.json`);
    siteConfig = response.ok ? await response.json() : {};
  } catch (error) {
    siteConfig = {};
  }
  return siteConfig;
}

function getSiteName() {
  return siteConfig?.site?.brand || siteConfig?.site?.name || 'Qi Sun';
}

function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach((anchor) => {
    anchor.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
  );
  elements.forEach((el) => observer.observe(el));
}

function initActiveNav() {
  const page = document.body.getAttribute('data-page') || 'home';
  document.querySelectorAll('.nav-links a').forEach((anchor) => {
    if (anchor.getAttribute('data-page') === page) {
      anchor.classList.add('active');
    }
  });
}

function initSpikeViz() {
  document.querySelectorAll('.spike-viz').forEach((container) => {
    if (container.children.length > 0) return;
    for (let i = 0; i < 22; i += 1) {
      const bar = document.createElement('div');
      bar.className = 'spike-bar';
      bar.style.animationDelay = `${Math.random() * 2}s`;
      bar.style.animationDuration = `${1 + Math.random() * 1.5}s`;
      container.appendChild(bar);
    }
  });
}

async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  try {
    const response = await fetch('posts/index.json');
    if (!response.ok) throw new Error('No posts index');
    const data = await response.json();
    const posts = Array.isArray(data) ? data : data.posts;
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = renderEmptyPosts();
      return;
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = posts.map(renderPostCard).join('');
    initScrollAnimations();
  } catch (error) {
    container.innerHTML = renderEmptyPosts();
  }
}

function renderPostCard(post) {
  return `
    <article class="post-card fade-in" onclick="navigateToPost('${escapeAttribute(post.slug)}')">
      <div>
        <div class="post-meta">
          <span class="post-date">${formatDate(post.date)}</span>
          <span class="post-category">${escapeHtml(post.category || '研究笔记')}</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${escapeHtml(post.excerpt || '')}</p>
        <span class="post-read-more">阅读全文</span>
      </div>
      <span class="post-arrow" aria-hidden="true">→</span>
    </article>
  `;
}

function renderEmptyPosts() {
  return `
    <div class="empty-state fade-in visible">
      <h3>研究笔记正在整理中</h3>
      <p>后续可以在 posts/index.json 中维护文章索引，在 posts/ 目录中新增对应文章 JSON。</p>
    </div>
  `;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function navigateToPost(slug) {
  window.location.href = `post.html?slug=${encodeURIComponent(slug)}`;
}

async function loadPost() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) return;

  const container = document.getElementById('post-content');
  if (!container) return;

  try {
    const response = await fetch(`posts/${encodeURIComponent(slug)}.json`);
    if (!response.ok) throw new Error('Post not found');
    const post = await response.json();
    renderSinglePost(post);
  } catch (error) {
    renderMissingPost(container);
  }
}

function renderSinglePost(post) {
  document.title = `${post.title} | ${getSiteName()}`;
  const header = document.querySelector('.post-header');
  if (header) {
    header.querySelector('h1').textContent = post.title;
    header.querySelector('.post-date').textContent = formatDate(post.date);
    header.querySelector('.post-category').textContent = post.category || '研究笔记';
  }

  const content = document.getElementById('post-content');
  if (content) {
    content.innerHTML = post.content || '<p>这篇文章还没有正文。</p>';
  }
}

function renderMissingPost(container) {
  const header = document.querySelector('.post-header');
  if (header) {
    header.querySelector('h1').textContent = '文章未找到';
    header.querySelector('.post-date').textContent = '';
    header.querySelector('.post-category').textContent = '提示';
  }
  container.innerHTML = '<p>未找到对应文章内容。请检查 posts/index.json 中的 slug 是否与 posts/ 目录下的 JSON 文件一致。</p>';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteConfig();
  initTheme();
  initMobileMenu();
  initActiveNav();
  initScrollAnimations();
  initSpikeViz();

  const canvas = document.getElementById('neural-canvas');
  if (canvas) {
    const network = new NeuralNetwork(canvas);
    network.animate();
  }

  loadPosts();
  loadPost();
});
