/* Static, source-backed portfolio preview. No CMS credentials reach the browser. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const categories = ['Biochemistry', 'ESR', 'Hematology', 'Hemostasis', 'Immunology', 'Microbiology', 'PCR', 'Urinalysis'];
  const installationTypes = ['Integrated', 'Stand Alone'];
  const featured = ['cx-9000-series', 'cx-6000-series', 'genexpert-system', 'bc-7600-series', 'bs-1000m', 'chorus-evo'];
  const parameters = new URLSearchParams(location.search);
  const state = {
    query: parameters.get('q') || '',
    categories: new Set(parameters.getAll('category').filter(c => categories.includes(c))),
    installations: new Set(parameters.getAll('installation').filter(c => installationTypes.includes(c))),
    sort: ['featured', 'az', 'za', 'category', 'manufacturer'].includes(parameters.get('sort')) ? parameters.get('sort') : 'featured',
    compared: new Set(),
    products: []
  };
  let detailTrigger = null;
  let compareTrigger = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
  const plain = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const cleanHtml = html => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'SUP', 'SUB', 'H2', 'H3', 'H4', 'IMG', 'A', 'SPAN']);
    for (const element of [...doc.body.querySelectorAll('*')].reverse()) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM'].includes(element.tagName)) { element.remove(); continue; }
      if (!allowed.has(element.tagName)) { element.replaceWith(...element.childNodes); continue; }
      for (const attribute of [...element.attributes]) {
        const valid = (element.tagName === 'IMG' && ['src', 'alt'].includes(attribute.name)) ||
          (element.tagName === 'A' && attribute.name === 'href') ||
          (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan'].includes(attribute.name));
        if (!valid) element.removeAttribute(attribute.name);
      }
      if (element.tagName === 'IMG') {
        const src = safeUrl(element.getAttribute('src'));
        if (!src) element.remove();
        else { element.src = src; element.loading = 'lazy'; }
      }
      if (element.tagName === 'A') {
        const href = safeUrl(element.getAttribute('href'));
        if (!href) element.removeAttribute('href');
        else { element.href = href; element.target = '_blank'; element.rel = 'noopener noreferrer'; }
      }
    }
    return doc.body.innerHTML;
  };
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const getProduct = slug => state.products.find(p => p.slug === slug);
  const isSearching = p => !state.query || p.searchText.includes(normalize(state.query.trim()));
  const matchesCategory = p => !state.categories.size || p.categories.some(c => state.categories.has(c));
  const matchesInstallation = p => !state.installations.size || p.installationTypes.some(c => state.installations.has(c));

  function updateUrl() {
    const url = new URL(location.href);
    for (const key of ['q', 'category', 'installation', 'sort']) url.searchParams.delete(key);
    if (state.query) url.searchParams.set('q', state.query);
    state.categories.forEach(c => url.searchParams.append('category', c));
    state.installations.forEach(c => url.searchParams.append('installation', c));
    if (state.sort !== 'featured') url.searchParams.set('sort', state.sort);
    history.replaceState(null, '', url);
  }

  function buildFilters() {
    const renderGroup = (values, group) => values.map((name, index) => `<label class="filter-option"><input type="checkbox" data-filter="${group}" value="${escape(name)}" id="filter-${group}-${index}"><span>${escape(name)}</span><span class="filter-number" data-count="${group}:${escape(name)}"></span></label>`).join('');
    $('#category-filters').innerHTML = renderGroup(categories, 'categories');
    $('#installation-filters').innerHTML = renderGroup(installationTypes, 'installations');
    $('#filter-controls').addEventListener('change', event => {
      const input = event.target.closest('[data-filter]');
      if (!input) return;
      if (input.checked) state[input.dataset.filter].add(input.value);
      else state[input.dataset.filter].delete(input.value);
      render();
    });
  }

  function renderFilters() {
    for (const input of document.querySelectorAll('[data-filter]')) input.checked = state[input.dataset.filter].has(input.value);
    for (const count of document.querySelectorAll('[data-count]')) {
      const [group, name] = count.dataset.count.split(':');
      const match = p => isSearching(p) && (group === 'categories' ? matchesInstallation(p) && p.categories.includes(name) : matchesCategory(p) && p.installationTypes.includes(name));
      count.textContent = String(state.products.filter(match).length).padStart(2, '0');
    }
    const chips = [];
    if (state.query) chips.push(`<button class="filter-chip" data-remove-query>Search: ${escape(state.query)} ${icon('cross')}</button>`);
    for (const group of ['categories', 'installations']) for (const value of state[group]) chips.push(`<button class="filter-chip" data-remove-filter="${group}" data-value="${escape(value)}">${escape(value)} ${icon('cross')}</button>`);
    $('#active-filters').innerHTML = chips.join('');
    const count = state.categories.size + state.installations.size;
    $('#mobile-filter-count').textContent = count ? `(${count})` : '';
    $('#reset-filters').disabled = !count && !state.query;
  }

  function imageMarkup(product, className = '') {
    return product.image ? `<img class="${className}" src="${escape(product.image)}" alt="${escape(product.title)} diagnostic instrument" loading="lazy" decoding="async" width="500" height="400">` : `<span class="image-fallback">${icon('globe')}<span>IMAGE NOT AVAILABLE</span></span>`;
  }

  function card(product, index) {
    const compared = state.compared.has(product.slug);
    return `<article class="product-card ${compared ? 'is-compared' : ''}" style="--i:${index}" data-product="${escape(product.slug)}">
      <div class="product-visual"><span class="product-category">${escape(product.categories.join(' / ') || 'DIAGNOSTICS')}</span>
        <button class="product-open-image" data-open-product="${escape(product.slug)}" aria-label="View ${escape(product.title)}">${imageMarkup(product)}</button>
        <span class="card-number" aria-hidden="true">EL / ${String(product.portfolioIndex).padStart(2, '0')}</span><span class="quick-view-hint">${icon('arrow')}</span>
      </div>
      <div class="product-copy"><span class="product-manufacturer">${escape(product.manufacturer || 'ELINCOU PORTFOLIO')}</span>
        <h3 class="product-title"><button data-open-product="${escape(product.slug)}">${escape(product.title)}</button></h3>
        <p class="product-description">${escape(product.shortDescription)}</p>
        <span class="product-setup">${product.installationTypes.length ? '<i class="setup-dot" aria-hidden="true"></i>' : ''}${escape(product.installationTypes.join(' / '))}</span>
        <div class="product-actions"><button class="details-button" data-open-product="${escape(product.slug)}" aria-label="Explore ${escape(product.title)}">Explore instrument ${icon('arrow')}</button>
          <label class="compare-check"><input type="checkbox" data-compare="${escape(product.slug)}" aria-label="Compare ${escape(product.title)}" ${compared ? 'checked' : ''} ${state.compared.size >= 3 && !compared ? 'disabled' : ''}>Compare</label>
        </div>
      </div></article>`;
  }

  function render() {
    const products = state.products.filter(p => isSearching(p) && matchesCategory(p) && matchesInstallation(p));
    products.sort((a, b) => {
      if (state.sort === 'az') return a.title.localeCompare(b.title);
      if (state.sort === 'za') return b.title.localeCompare(a.title);
      if (state.sort === 'category') return (a.categories[0] || 'Z').localeCompare(b.categories[0] || 'Z') || a.title.localeCompare(b.title);
      if (state.sort === 'manufacturer') return a.manufacturer.localeCompare(b.manufacturer) || a.title.localeCompare(b.title);
      const rank = p => featured.includes(p.slug) ? featured.indexOf(p.slug) : 100 + p.portfolioIndex;
      return rank(a) - rank(b);
    });
    $('#product-grid').innerHTML = products.map(card).join('');
    $('#product-grid').setAttribute('aria-busy', 'false');
    $('#results-count').innerHTML = `<strong>${String(products.length).padStart(2, '0')}</strong> of ${state.products.length} instruments`;
    $('#empty-state').hidden = products.length > 0;
    $('#apply-mobile-filters').innerHTML = `Show ${products.length} instrument${products.length === 1 ? '' : 's'} ${icon('arrow')}`;
    renderFilters();
    updateUrl();
  }

  function reset() {
    state.query = '';
    state.categories.clear();
    state.installations.clear();
    $('#product-search').value = '';
    render();
  }

  function updateCompare() {
    for (const input of document.querySelectorAll('[data-compare]')) {
      const selected = state.compared.has(input.dataset.compare);
      input.checked = selected;
      input.disabled = state.compared.size >= 3 && !selected;
      input.closest('.product-card')?.classList.toggle('is-compared', selected);
    }
    const selected = [...state.compared].map(getProduct);
    $('#compare-tray').hidden = !selected.length;
    $('#compare-summary').textContent = `${selected.length} of 3 instruments selected`;
    $('#compare-count').textContent = selected.length;
    $('#open-compare').disabled = selected.length < 2;
    $('#compare-thumbnails').innerHTML = selected.map(p => `<button data-remove-compare="${escape(p.slug)}" aria-label="Remove ${escape(p.title)} from comparison">${p.image ? `<img src="${escape(p.image)}" alt="">` : icon('globe')}<span aria-hidden="true">×</span></button>`).join('');
    $('#compare-status').textContent = selected.length === 3 ? 'Three instruments selected. Remove one to choose another.' : `${selected.length} instruments selected for comparison. Select at least two.`;
    document.body.style.paddingBottom = selected.length ? '100px' : '';
  }

  function specsList(product) {
    const doc = new DOMParser().parseFromString(product.specifications || '', 'text/html');
    return [...doc.querySelectorAll('li')].map(li => li.textContent.trim()).filter(Boolean);
  }

  function openProduct(slug, trigger) {
    const p = getProduct(slug);
    if (!p) return;
    detailTrigger = trigger;
    const tabs = [];
    if (plain(p.extraInformation)) tabs.push({ label: 'Overview', html: p.extraInformation });
    if (plain(p.specifications)) tabs.push({ label: 'Specifications', html: p.specifications });
    if (plain(p.seriesTable)) tabs.push({ label: 'Compare the series', html: p.seriesTable });
    if (!tabs.length) tabs.push({ label: 'Overview', html: p.description });
    const video = safeUrl(p.videoExternalUrl || p.youtubeUrl || p.videoUrl);
    if (video) tabs.push({ label: 'Product video', html: `<p>Take a closer look at ${escape(p.title)}.</p><p><a href="${escape(video)}" target="_blank" rel="noopener noreferrer">Watch the manufacturer’s product video ↗</a></p>` });
    $('#product-detail').innerHTML = `<div class="detail-top"><div class="detail-image">${imageMarkup(p)}</div><div class="detail-summary"><span class="eyebrow">${escape(p.manufacturer)} / ${escape(p.categories.join(' / ') || 'DIAGNOSTICS')}</span><h2 id="dialog-title">${escape(p.title)}</h2><div class="detail-description">${cleanHtml(p.description)}</div><div class="detail-tags">${p.installationTypes.map(t => `<span>${escape(t)}</span>`).join('')}</div><a class="primary-button" href="index.html#contact">Enquire about this instrument ${icon('arrow')}</a>${safeUrl(p.manufacturerUrl) ? `<a class="manufacturer-link" href="${escape(safeUrl(p.manufacturerUrl))}" target="_blank" rel="noopener noreferrer">Visit manufacturer’s website ↗</a>` : ''}</div></div>
      <div class="detail-body"><div class="detail-tabs" role="tablist" aria-label="Product information">${tabs.map((t, i) => `<button role="tab" id="detail-tab-${i}" aria-controls="detail-panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-tab="${i}">${escape(t.label)}</button>`).join('')}</div>${tabs.map((t, i) => `<div class="detail-panel" id="detail-panel-${i}" role="tabpanel" tabindex="0" aria-labelledby="detail-tab-${i}" ${i ? 'hidden' : ''}>${cleanHtml(t.html)}</div>`).join('')}</div>`;
    $('#product-dialog').showModal();
    $('#product-dialog').scrollTop = 0;
  }

  function selectTab(button) {
    for (const tab of document.querySelectorAll('[data-tab]')) {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`#detail-panel-${tab.dataset.tab}`).hidden = !selected;
    }
    button.focus();
  }

  function openComparison(trigger) {
    if (state.compared.size < 2) return;
    compareTrigger = trigger;
    const products = [...state.compared].map(getProduct);
    const row = (label, renderer) => `<tr><th scope="row">${label}</th>${products.map(p => `<td>${renderer(p)}</td>`).join('')}</tr>`;
    $('#comparison-table').innerHTML = `<table class="comparison-table"><caption class="sr-only">Comparison of selected diagnostic instruments</caption><thead><tr><th scope="col">Your shortlist</th>${products.map(p => `<td class="comparison-product">${imageMarkup(p)}<small>${escape(p.manufacturer)}</small><h3>${escape(p.title)}</h3></td>`).join('')}</tr></thead><tbody>${row('Discipline', p => escape(p.categories.join(', ') || 'Not specified'))}${row('Installation', p => escape(p.installationTypes.join(', ') || 'Ask our team'))}${row('At a glance', p => `<p>${escape(p.shortDescription)}</p>`)}${row('Key specifications', p => { const specs = specsList(p).slice(0, 6); return specs.length ? `<ul>${specs.map(s => `<li>${escape(s)}</li>`).join('')}</ul>` : '<p>Refer to manufacturer’s documentation for detailed specifications.</p>'; })}${row('Further information', p => safeUrl(p.manufacturerUrl) ? `<a href="${escape(p.manufacturerUrl)}" target="_blank" rel="noopener noreferrer">Manufacturer details ↗</a>` : 'Contact Elincou')}</tbody></table>`;
    $('#compare-dialog').showModal();
  }

  async function loadProducts() {
    $('#load-error').hidden = true;
    $('#empty-state').hidden = true;
    $('#product-grid').setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('data/products.json');
      if (!response.ok) throw new Error(`Portfolio returned ${response.status}`);
      const products = await response.json();
      if (!Array.isArray(products) || products.length !== 34) throw new Error('Unexpected portfolio data');
      state.products = products.map((p, index) => ({
        ...p,
        portfolioIndex: index + 1,
        shortDescription: plain(p.description),
        searchText: normalize([p.title, p.manufacturer, ...p.categories, ...p.installationTypes, plain(p.description)].join(' '))
      }));
      render();
      if (parameters.get('product')) openProduct(parameters.get('product'), null);
    } catch (error) {
      $('#product-grid').innerHTML = '';
      $('#product-grid').setAttribute('aria-busy', 'false');
      $('#results-count').textContent = 'Portfolio unavailable';
      $('#load-error').hidden = false;
      console.error('Unable to load the Elincou product portfolio.', error);
    }
  }

  buildFilters();
  $('#product-search').value = state.query;
  $('#product-sort').value = state.sort;
  $('#product-search').addEventListener('input', event => { state.query = event.target.value; render(); });
  $('#product-sort').addEventListener('change', event => { state.sort = event.target.value; render(); });
  $('#reset-filters').addEventListener('click', reset);
  $('#empty-reset').addEventListener('click', reset);
  $('#reload-products').addEventListener('click', loadProducts);
  $('#clear-compare').addEventListener('click', () => { state.compared.clear(); updateCompare(); });
  $('#open-compare').addEventListener('click', event => openComparison(event.currentTarget));
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-open-product]');
    if (open) openProduct(open.dataset.openProduct, open);
    const remove = event.target.closest('[data-remove-filter]');
    if (remove) { state[remove.dataset.removeFilter].delete(remove.dataset.value); render(); }
    if (event.target.closest('[data-remove-query]')) { state.query = ''; $('#product-search').value = ''; render(); }
    const removeCompare = event.target.closest('[data-remove-compare]');
    if (removeCompare) { state.compared.delete(removeCompare.dataset.removeCompare); updateCompare(); }
    const tab = event.target.closest('[data-tab]');
    if (tab) selectTab(tab);
  });
  document.addEventListener('change', event => {
    const input = event.target.closest('[data-compare]');
    if (!input) return;
    if (input.checked && state.compared.size < 3) state.compared.add(input.dataset.compare);
    else state.compared.delete(input.dataset.compare);
    updateCompare();
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault(); $('#product-search').focus(); $('#catalogue').scrollIntoView({ block: 'start' });
    }
    const current = event.target.closest('[data-tab]');
    if (current && ['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const tabs = [...document.querySelectorAll('[data-tab]')];
      let index = tabs.indexOf(current);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[index]);
    }
  });
  document.addEventListener('error', event => {
    if (event.target.tagName !== 'IMG' || event.target.closest('header, footer')) return;
    event.target.outerHTML = `<span class="image-fallback">${icon('globe')}<span>IMAGE UNAVAILABLE</span></span>`;
  }, true);
  for (const dialog of document.querySelectorAll('dialog')) {
    $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (dialog.id === 'product-dialog') detailTrigger?.focus();
      if (dialog.id === 'compare-dialog') compareTrigger?.focus();
      if (dialog.id === 'filter-dialog') {
        $('.filter-sidebar').append($('#filter-controls'));
        $('#mobile-filter-button').setAttribute('aria-expanded', 'false');
        $('#mobile-filter-button').focus();
      }
    });
  }
  $('#mobile-filter-button').setAttribute('aria-haspopup', 'dialog');
  $('#mobile-filter-button').setAttribute('aria-expanded', 'false');
  $('#mobile-filter-button').addEventListener('click', () => {
    $('#mobile-filter-mount').append($('#filter-controls'));
    $('#filter-dialog').showModal();
    $('#mobile-filter-button').setAttribute('aria-expanded', 'true');
  });
  $('#apply-mobile-filters').addEventListener('click', () => $('#filter-dialog').close());
  matchMedia('(min-width: 901px)').addEventListener('change', event => { if (event.matches && $('#filter-dialog').open) $('#filter-dialog').close(); });
  // Gentle instrument response, without moving the page or delaying access to products.
  if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    const stage = $('#instrument-stage');
    let frame;
    stage.addEventListener('pointermove', event => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = stage.getBoundingClientRect();
        $('.hero-instrument').style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .018}px, ${(event.clientY - rect.top - rect.height / 2) * .018}px)`;
      });
    });
    stage.addEventListener('pointerleave', () => { cancelAnimationFrame(frame); $('.hero-instrument').style.transform = ''; });
  }
  loadProducts();
})();
