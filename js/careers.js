/* Preview interactions only. No candidate data is stored or transmitted. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const form = $('#application-form');
  const roleSelect = $('#application-role');
  const interest = $('#interest');
  const tabs = [$('#tab-role'), $('#tab-general')];
  let mode = 'general';

  function setMode(next, focusTab = false) {
    mode = next;
    tabs.forEach((tab, index) => {
      const selected = (index === 0 ? 'role' : 'general') === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });
    $('#role-field').hidden = mode !== 'role';
    roleSelect.required = mode === 'role';
    roleSelect.disabled = mode !== 'role';
    $('#interest-field').hidden = mode === 'role';
    interest.required = mode === 'general';
    interest.disabled = mode !== 'general';
    $('#application-panel').setAttribute('aria-labelledby', mode === 'role' ? 'tab-role' : 'tab-general');
    $('#form-overline').textContent = mode === 'role' ? 'YOUR NEXT OPPORTUNITY' : 'AN OPEN INTRODUCTION';
    $('#form-title').textContent = mode === 'role' ? 'Take the next step.' : 'Let’s get to know you.';
    $('#form-intro').textContent = mode === 'role' ? 'Share your experience and tell us why this role feels right.' : 'Tell us what you do best and where you’d like to go next.';
    $('#submit-label').textContent = mode === 'role' ? 'Preview role application' : 'Preview general application';
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setMode(index === 0 ? 'role' : 'general'));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      setMode(event.key === 'Home' ? 'role' : event.key === 'End' ? 'general' : mode === 'role' ? 'general' : 'role', true);
    });
  });
  document.querySelectorAll('[data-general]').forEach(link => link.addEventListener('click', () => setMode('general')));
  document.querySelectorAll('[data-apply]').forEach(button => button.addEventListener('click', () => {
    setMode('role');
    roleSelect.value = button.dataset.apply;
    $('#application').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    $('#first-name').focus({ preventScroll: true });
  }));
  $('#team-filter').addEventListener('change', event => {
    let visible = 0;
    document.querySelectorAll('.role').forEach(role => {
      role.hidden = event.target.value !== 'all' && role.dataset.team !== event.target.value;
      if (!role.hidden) visible++;
      else role.open = false;
    });
    $('#role-count').textContent = `${visible} example ${visible === 1 ? 'opportunity' : 'opportunities'}`;
  });
  document.querySelectorAll('.role').forEach(role => role.addEventListener('toggle', () => {
    if (role.open) document.querySelectorAll('.role').forEach(other => { if (other !== role) other.open = false; });
  }));

  const cv = $('#cv');
  function showFile() {
    const file = cv.files[0];
    let error = '';
    if (file && !/\.(pdf|doc|docx)$/i.test(file.name)) error = 'Choose a PDF, DOC or DOCX file.';
    else if (file && file.size > 5 * 1024 * 1024) error = 'This file is too large. Choose a CV smaller than 5 MB.';
    else if (file && file.size === 0) error = 'This file is empty. Choose a different CV.';
    cv.setCustomValidity(error);
    $('#file-error').textContent = error;
    $('#file-selected').hidden = !file;
    $('#file-status').textContent = file ? `${file.name} · ${file.size < 1048576 ? Math.max(1, Math.round(file.size / 1024)) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB'}` : '';
    $('#upload-title').textContent = file ? error ? 'Choose another file' : 'CV selected — choose a file to replace it' : 'Choose a file or drop it here';
    cv.setAttribute('aria-invalid', String(Boolean(error)));
  }
  cv.addEventListener('change', showFile);
  $('#remove-file').addEventListener('click', () => { cv.value = ''; showFile(); cv.focus(); });
  const zone = $('#upload-zone');
  ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, () => zone.classList.remove('is-dragging')));
  zone.addEventListener('drop', event => {
    event.preventDefault();
    if (!event.dataTransfer.files.length) return;
    const transfer = new DataTransfer();
    transfer.items.add(event.dataTransfer.files[0]);
    cv.files = transfer.files;
    showFile();
  });
  const dialog = $('#application-preview');
  form.addEventListener('submit', event => {
    event.preventDefault();
    showFile();
    if (!form.reportValidity()) return;
    $('#preview-role').textContent = mode === 'role' ? roleSelect.value : `General application · ${interest.value}`;
    $('#preview-name').textContent = `${$('#first-name').value.trim()} ${$('#last-name').value.trim()}`;
    $('#preview-email').textContent = $('#email').value;
    $('#preview-file').textContent = cv.files[0].name;
    dialog.showModal();
  });
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  $('#back-to-form').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(section => { section.classList.add('is-observed'); observer.observe(section); });
  }
  setMode('general');
})();
