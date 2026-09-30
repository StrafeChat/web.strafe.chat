// Behaviour for the developer docs: fill in this instance's URLs, copy buttons on code
// blocks, the sidebar drawer on small screens, the "on this page" highlight, and a small
// client-side search over the pages (from /docs/search.json). No dependencies.
(function () {
  'use strict';

  // ---- this instance's endpoints -------------------------------------------------------
  // Mirrors the app's runtimeConfig: /config.js (written at container start) wins, then the
  // deployed layout (api and gateway live under this origin), then the dev defaults.
  function instanceUrls() {
    var cfg = (window.__STRAFE_CONFIG__ || {});
    var origin = window.location.origin;
    var isDev = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
    var api = (cfg.apiUrl || '').replace(/\/+$/, '') || (isDev ? 'http://localhost:4000' : origin + '/api');
    var gateway = cfg.stargateUrl || (isDev ? 'ws://localhost:4001/events' : origin.replace(/^http/, 'ws') + '/gateway/events');
    return { api: api, gateway: gateway, web: origin, cdn: (cfg.cdnUrl || '').replace(/\/+$/, '') || (isDev ? 'http://localhost:4010' : origin + '/cdn') };
  }
  function fillInstance() {
    var urls = instanceUrls();
    var nodes = document.querySelectorAll('[data-instance]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-instance');
      var suffix = nodes[i].getAttribute('data-suffix') || '';
      if (urls[key]) nodes[i].textContent = urls[key] + suffix;
    }
  }

  // ---- copy buttons --------------------------------------------------------------------
  function copyButtons() {
    var buttons = document.querySelectorAll('.code .copy');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var pre = btn.closest('.code').querySelector('pre');
        var text = pre ? pre.textContent : '';
        var done = function () {
          btn.textContent = 'Copied';
          btn.classList.add('done');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('done');
          }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
      });
    });
  }

  // ---- sidebar drawer ------------------------------------------------------------------
  function drawer() {
    var btn = document.getElementById('menu-btn');
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('backdrop');
    if (!btn || !sidebar || !backdrop) return;
    function set(open) {
      sidebar.classList.toggle('open', open);
      backdrop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', function () { set(!sidebar.classList.contains('open')); });
    backdrop.addEventListener('click', function () { set(false); });
    sidebar.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  }

  // ---- on-this-page highlight ----------------------------------------------------------
  function tocHighlight() {
    var links = document.querySelectorAll('.toc a');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    Array.prototype.forEach.call(links, function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var headings = Array.prototype.filter.call(document.querySelectorAll('.prose h2, .prose h3'), function (h) { return byId[h.id]; });
    var current = null;
    function activate(id) {
      if (current === id) return;
      current = id;
      Array.prototype.forEach.call(links, function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + id); });
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) activate(entry.target.id); });
    }, { rootMargin: '-70px 0px -70% 0px', threshold: 0 });
    headings.forEach(function (h) { observer.observe(h); });
  }

  // ---- search --------------------------------------------------------------------------
  function search() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    if (!input || !results) return;
    var index = null;
    var selected = -1;
    function load() {
      if (index) return Promise.resolve(index);
      return fetch('/docs/search.json').then(function (r) { return r.json(); }).then(function (data) { index = data; return data; });
    }
    function snippet(text, q) {
      var i = text.toLowerCase().indexOf(q);
      if (i < 0) return text.slice(0, 90);
      var start = Math.max(0, i - 40);
      return (start > 0 ? '…' : '') + text.slice(start, i + q.length + 60) + '…';
    }
    function render(hits, q) {
      selected = -1;
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      if (!hits.length) { results.innerHTML = '<div class="r-empty">No matches.</div>'; results.hidden = false; return; }
      results.innerHTML = hits.map(function (h) {
        return '<a href="' + h.url + '"><div class="r-title">' + escapeHtml(h.title) + '</div><div class="r-sub">' + escapeHtml(h.sub) + '</div></a>';
      }).join('');
      results.hidden = false;
    }
    function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { render([], ''); return; }
      load().then(function (pages) {
        var hits = [];
        pages.forEach(function (p) {
          if (p.title.toLowerCase().indexOf(q) >= 0) hits.push({ url: p.url, title: p.title, sub: p.description || 'Page', score: 3 });
          p.headings.forEach(function (h) {
            if (h.text.toLowerCase().indexOf(q) >= 0) hits.push({ url: p.url + '#' + h.id, title: h.text, sub: p.title, score: 2 });
          });
          var i = p.text.toLowerCase().indexOf(q);
          if (i >= 0 && hits.filter(function (x) { return x.url.indexOf(p.url) === 0; }).length < 2) {
            hits.push({ url: p.url, title: p.title, sub: snippet(p.text, q), score: 1 });
          }
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        render(hits.slice(0, 12), q);
      });
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', function () { if (input.value.trim()) run(); });
    input.addEventListener('keydown', function (e) {
      var links = results.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!links.length) return;
        e.preventDefault();
        selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        Array.prototype.forEach.call(links, function (a, i) { a.classList.toggle('selected', i === selected); });
      } else if (e.key === 'Enter') {
        var target = links[selected] || links[0];
        if (target) window.location.href = target.getAttribute('href');
      } else if (e.key === 'Escape') {
        results.hidden = true;
        input.blur();
      }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#search')) results.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  function init() {
    fillInstance();
    copyButtons();
    drawer();
    tocHighlight();
    search();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
