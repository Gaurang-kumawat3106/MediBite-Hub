// customer_home.js

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll Reveal ──────────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        revealObserver.unobserve(entry.target); // fire once
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => revealObserver.observe(el));


  // ── Hero text stagger ──────────────────────────────────────
  const heroEls = document.querySelectorAll('.hero-tag, .hero h1, .hero p');
  heroEls.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(22px)';
    el.style.transition = `opacity 0.65s ease ${i * 0.12}s, transform 0.65s ease ${i * 0.12}s`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  });


  // ── 3D Tilt — desktop only ─────────────────────────────────
  const isMobile = window.matchMedia('(hover: none)').matches;

  if (!isMobile) {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
      let rafId;

      card.addEventListener('mousemove', e => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width  - 0.5;
          const y = (e.clientY - rect.top)  / rect.height - 0.5;
          const rX =  y * -10;
          const rY =  x *  10;
          card.style.transform = `perspective(800px) rotateX(${rX}deg) rotateY(${rY}deg) scale(1.03)`;
        });
      });

      card.addEventListener('mouseleave', () => {
        cancelAnimationFrame(rafId);
        card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s ease, box-shadow 0.3s ease';
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
        setTimeout(() => { card.style.transition = ''; }, 500);
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
      });
    });
  }


  // ── Mobile touch ripple ────────────────────────────────────
  if (isMobile) {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('touchstart', () => {
        card.style.transition = 'transform 0.15s ease, border-color 0.3s ease';
        card.style.transform = 'scale(0.97)';
      }, { passive: true });

      card.addEventListener('touchend', () => {
        card.style.transform = 'scale(1)';
      }, { passive: true });
    });
  }


  // ── Nav active state on scroll ─────────────────────────────
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 10
      ? '0 4px 30px rgba(0,0,0,0.4)'
      : 'none';
  }, { passive: true });

});