/* Progressive enhancement for statically rendered, independently addressable product pages. */
(() => {
  'use strict';
  const image = document.querySelector('.instrument-main-image');
  const enlarged = document.querySelector('.enlarged-product-image');
  const dialog = document.querySelector('.image-dialog');
  const enlargeButton = document.querySelector('.image-enlarge');
  let switchTimer;
  document.querySelectorAll('[data-gallery-src]').forEach(button => {
    button.addEventListener('click', () => {
      if (!image || button.getAttribute('aria-pressed') === 'true') return;
      clearTimeout(switchTimer);
      document.querySelectorAll('[data-gallery-src]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      image.classList.add('is-switching');
      switchTimer = setTimeout(() => {
        image.src = button.dataset.gallerySrc;
        image.alt = button.dataset.galleryAlt;
        if (enlarged) { enlarged.src = image.src; enlarged.alt = image.alt; }
        image.classList.remove('is-switching');
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 130);
    });
  });
  enlargeButton?.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => enlargeButton?.focus());
  // Preserve the catalogue's current query and filters when returning to it.
  let returnTo;
  try { returnTo = sessionStorage.getItem('elincou-catalogue-return'); } catch {}
  if (returnTo) {
    try {
      const returnUrl = new URL(returnTo, location.href);
      if (returnUrl.origin === location.origin && returnUrl.pathname.endsWith('/products.html')) {
        document.querySelector('.back-to-products').href = returnUrl.href;
      }
    } catch { /* Fall back to the canonical portfolio URL. */ }
  }
  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(entries => {
      document.querySelector('.instrument-section-nav').classList.toggle('is-past-hero', !entries[0].isIntersecting);
    }, { rootMargin: '-70px 0px 0px 0px', threshold: 0 });
    heroObserver.observe(document.querySelector('.instrument-hero'));
    const actionObserver = new IntersectionObserver(entries => {
      document.querySelector('.mobile-product-action').classList.toggle('inline-action-visible', entries[0].isIntersecting);
    }, { threshold: 0.3 });
    actionObserver.observe(document.querySelector('.hero-enquiry .request-button'));
  } else {
    document.querySelector('.instrument-section-nav').classList.add('is-past-hero');
  }
  const links = [...document.querySelectorAll('.instrument-section-nav>div a')];
  const sections = links.map(a => document.querySelector(a.hash)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(e => e.isIntersecting).forEach(entry => {
        links.forEach(link => {
          const selected = link.hash === '#' + entry.target.id;
          link.classList.toggle('is-active', selected);
          if (selected) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-75px 0px -55% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
  }
  document.addEventListener('error', event => {
    const target = event.target;
    if (target.tagName !== 'IMG' || target.closest('header, footer')) return;
    target.hidden = true;
    const message = document.createElement('span');
    message.className = 'product-image-missing';
    message.textContent = 'Product image unavailable';
    target.after(message);
  }, true);
})();
