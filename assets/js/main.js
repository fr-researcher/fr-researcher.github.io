// ── Theme toggle ──────────────────────────
const btn = document.getElementById('themeToggle');
const saved = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', saved);

btn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// ── Mobile nav ────────────────────────────
const burger = document.getElementById('navBurger');
const mobileMenu = document.getElementById('navMobile');
burger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
mobileMenu.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => mobileMenu.classList.remove('open'))
);

// ── Year in footer ────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Publication filter ────────────────────
document.querySelectorAll('.pub-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pub-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.pub-card').forEach(card => {
      card.classList.toggle('hidden', filter !== 'all' && card.dataset.type !== filter);
    });
  });
});

// ── Scroll-based fade-in ──────────────────
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll(
  '.pub-card, .project-card, .cv-block, .about-grid, .contact-card, .info-card'
).forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// ── Gallery overlays (build from data-caption) ───────────────────
document.querySelectorAll('.gallery-item').forEach(item => {
  const cap = item.dataset.caption || '';
  const overlay = document.createElement('div');
  overlay.className = 'gallery-overlay';
  overlay.innerHTML = `<span>${cap}</span>`;
  item.appendChild(overlay);
});

// ── Gallery lightbox ──────────────────────
const items    = Array.from(document.querySelectorAll('.gallery-item'));
const lightbox = document.getElementById('lightbox');
const lbImg    = document.getElementById('lightboxImg');
const lbCap    = document.getElementById('lightboxCaption');
let   current  = 0;

function openLightbox(index) {
  current = index;
  const item = items[index];
  lbImg.src      = item.querySelector('img').src;
  lbImg.alt      = item.querySelector('img').alt;
  lbCap.textContent = item.dataset.caption || '';
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
function navigate(dir) {
  current = (current + dir + items.length) % items.length;
  openLightbox(current);
}

items.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));
document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev').addEventListener('click', () => navigate(-1));
document.getElementById('lightboxNext').addEventListener('click', () => navigate(1));
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowRight')  navigate(1);
  if (e.key === 'ArrowLeft')   navigate(-1);
});

// ── Active nav link on scroll ─────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a, .nav-mobile a');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 80) current = sec.id;
  });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === `#${current}`
      ? 'var(--accent)'
      : '';
  });
}, { passive: true });
