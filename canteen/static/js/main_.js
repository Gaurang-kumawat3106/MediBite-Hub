/* ═══════════════════════════════════════════════════
   MediCanteen — Shared JavaScript
   Handles: search/filter, cart loader, order accordion,
            toast notifications, add-to-cart feedback
═══════════════════════════════════════════════════ */

'use strict';

/* ─── UTILS ───────────────────────────────────────── */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

/* ─── TOAST ───────────────────────────────────────── */
function showToast(msg, icon = 'fa-circle-check') {
  let container = $('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('removing');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 2800);
}

/* ─── OUTLET DETAIL: Search + Filter ─────────────── */
function initOutletSearch() {
  const searchInput    = $('#searchInput');
  const categorySelect = $('#categorySelect');
  const grid           = $('#productsGrid');
  const emptyState     = $('#emptyState');
  if (!searchInput && !categorySelect) return;

  function filterCards() {
    const query    = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const category = categorySelect ? categorySelect.value : 'all';
    const cards    = $$('.product-card', grid);
    let visible    = 0;

    cards.forEach(card => {
      const nameMatch     = card.dataset.name.includes(query);
      const catMatch      = category === 'all' || card.dataset.category === category;
      const show          = nameMatch && catMatch;
      card.style.display  = show ? '' : 'none';
      if (show) visible++;
    });

    if (emptyState) {
      emptyState.classList.toggle('visible', visible === 0);
    }
  }

  searchInput && searchInput.addEventListener('input', filterCards);
  categorySelect && categorySelect.addEventListener('change', filterCards);
}

/* ─── OUTLET DETAIL: Mobile Search Bar injection ─── */
function injectMobileSearch() {
  if (window.innerWidth > 768) return;
  const navControls = $('.nav-controls');
  if (!navControls) return;

  // Already injected?
  if ($('.mobile-search-bar')) return;

  const mobileBar = document.createElement('div');
  mobileBar.className = 'mobile-search-bar';
  mobileBar.innerHTML = navControls.innerHTML;
  navControls.after(mobileBar);

  // Sync events to new elements
  const mSearch = mobileBar.querySelector('#searchInput');
  const mSelect = mobileBar.querySelector('#categorySelect');
  if (mSearch) mSearch.addEventListener('input', () => {
    const orig = document.getElementById('searchInput');
    if (orig) orig.value = mSearch.value;
    orig && orig.dispatchEvent(new Event('input'));
  });
  if (mSelect) mSelect.addEventListener('change', () => {
    const orig = document.getElementById('categorySelect');
    if (orig) orig.value = mSelect.value;
    orig && orig.dispatchEvent(new Event('change'));
  });
}

/* ─── ADD TO CART: Feedback animation ────────────── */
function initAddToCartFeedback() {
  $$('.add-cart-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      // Visual burst
      btn.style.transform = 'scale(1.35) rotate(90deg)';
      setTimeout(() => { btn.style.transform = ''; }, 220);
      showToast('Added to cart!', 'fa-cart-shopping');
    });
  });
}

/* ─── CART: Checkout loader ───────────────────────── */
function initCheckoutLoader() {
  const checkoutBtn = $('#checkoutBtn');
  const loader      = $('#pageLoader');
  const loaderText  = $('#loaderText');
  if (!checkoutBtn || !loader) return;

  const messages = [
    'Placing your order…',
    'Confirming with outlet…',
    'Almost there…',
  ];
  let msgIdx = 0;

  checkoutBtn.addEventListener('click', function (e) {
    loader.classList.add('active');
    if (loaderText) loaderText.textContent = messages[msgIdx];
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      if (loaderText) loaderText.textContent = messages[msgIdx];
    }, 1400);
    // Safety: clear after 8s if no navigation
    setTimeout(() => {
      clearInterval(interval);
      loader.classList.remove('active');
    }, 8000);
  });
}

/* ─── CART: Remove animation ──────────────────────── */
function initRemoveAnimation() {
  $$('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const card = btn.closest('.cart-item');
      if (!card) return;
      card.style.transition = 'all 0.3s ease';
      card.style.opacity    = '0';
      card.style.transform  = 'translateX(40px)';
      // Let Django handle the actual removal; this is just visual feedback
    });
  });
}

/* ─── ORDERS: Accordion expand/collapse ───────────── */
function initOrderAccordion() {
  $$('.order-card-header').forEach(header => {
    header.addEventListener('click', function () {
      const card = header.closest('.order-card');
      const body = card.querySelector('.order-body');
      if (!body) return;

      const isOpen = body.classList.contains('open');
      // Close all
      $$('.order-body.open').forEach(b => b.classList.remove('open'));
      $$('.order-card.expanded').forEach(c => c.classList.remove('expanded'));
      // Toggle clicked
      if (!isOpen) {
        body.classList.add('open');
        card.classList.add('expanded');
      }
    });
  });

  // Auto-open first pending order
  const firstPending = $('.order-card[data-status="pending"]');
  if (firstPending) {
    const body = firstPending.querySelector('.order-body');
    if (body) {
      body.classList.add('open');
      firstPending.classList.add('expanded');
    }
  }
}

/* ─── SCROLL: Reveal on scroll ────────────────────── */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  $$('.product-card, .cart-item, .order-card').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(20px)';
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    observer.observe(el);
  });
}

/* ─── STAGGER: reset CSS animation delays after scroll ─ */
function resetAnimationDelays() {
  // Only run on page load; CSS handles initial delays
  $$('.product-card').forEach((el, i) => {
    el.style.animationDelay = `${i * 0.05}s`;
  });
}

/* ─── INIT ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initOutletSearch();
  injectMobileSearch();
  initAddToCartFeedback();
  initCheckoutLoader();
  initRemoveAnimation();
  initOrderAccordion();
  resetAnimationDelays();

  // Slight delay for scroll reveal (let CSS animations finish first)
  setTimeout(initScrollReveal, 600);
});