/* ==========================================================================
   The notebook: the page opens on a letter written on a sheet of paper, with
   the words that lead somewhere picked out in highlighter. Beside it sits a
   paper tablet with one app per section; an app reads the same content the
   page shows, so there is nothing to keep in sync.
   Loaded before penwash.js. Remove class="nb" from <html> and the two lines
   for notebook.css / notebook.js to go back.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('nb')) return;

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = function () { return window.matchMedia('(min-width: 1180px)').matches; };
  var phone = function () { return window.matchMedia('(max-width: 819px)').matches; };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var txt = function (el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
  var make = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hash(t) { var h = 7; t = String(t || ''); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
  // the first of several containers that actually has something in it (JSON first, fallback second)
  function live() {
    for (var i = 0; i < arguments.length; i++) {
      var el = $(arguments[i]);
      if (el && el.children.length && getComputedStyle(el).display !== 'none') return el;
    }
    for (var j = 0; j < arguments.length; j++) { var e2 = $(arguments[j]); if (e2 && e2.children.length) return e2; }
    return null;
  }

  // ---- where each word and app leads -----------------------------------------------------
  var headOf = function (field) { return function () { var h = $('[data-field="section_heads.' + field + '.title"]'); return h && (h.closest('.section__head') || h); }; };
  var TARGET = {
    projects: function () { return $('#work'); },
    more: function () { return $('#more-work'); },
    research: function () { return $('#research'); },
    notes: function () { return $('#talks'); },
    experience: function () { return $('#experience'); },
    places: headOf('locations'),
    languages: headOf('duolingo'),
    games: headOf('games'),
    beverages: function () { return $('#coffee-trigger'); },
    learn: function () { return $('#learn-for-free'); },
    about: function () { return $('#about'); },
    skills: headOf('skills'),
    contact: headOf('contact')
  };
  function goTo(key) {
    var el = TARGET[key] && TARGET[key]();
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY - (phone() ? 70 : 96);
    window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? 'auto' : 'smooth' });
    el.classList.remove('nb-flash'); void el.offsetWidth; el.classList.add('nb-flash');
    setTimeout(function () { el.classList.remove('nb-flash'); }, 2400);
  }

  // ---- the highlighter ----------------------------------------------------------------------
  // One rough swipe per word, in today's ink colour. Drawn as SVG and set as a
  // background, so it follows the words across a line break.
  function swipeURL(seed, rgb, a) {
    var r = rng(seed), W = 200, H = 40, top = [], bot = [];
    var y0 = 7 + r() * 4, y1 = 35 + r() * 3, tilt = (r() - 0.5) * 4;
    for (var i = 0; i <= 8; i++) {
      var x = 4 + (W - 8) * i / 8;
      top.push([x + (r() - 0.5) * 3, y0 + tilt * i / 8 + (r() - 0.5) * 4.5]);
      bot.push([x + (r() - 0.5) * 3, y1 - tilt * i / 8 + (r() - 0.5) * 4.5]);
    }
    var f = function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); };
    var d = 'M' + f(top[0]) + ' L' + top.slice(1).map(f).join(' L') +
      ' Q' + (W + 2) + ' ' + ((y0 + y1) / 2).toFixed(1) + ' ' + f(bot[8]) +
      ' L' + bot.slice(0, 8).reverse().map(f).join(' L') +
      ' Q' + (-1 - r() * 2).toFixed(1) + ' ' + ((y0 + y1) / 2).toFixed(1) + ' ' + f(top[0]) + 'Z';
    // a second, narrower pass where the pen went over it again
    var d2 = 'M' + (W * (0.55 + r() * 0.2)).toFixed(1) + ' ' + (y0 + 3).toFixed(1) + ' L' + (W - 3) + ' ' + (y0 + 2 + tilt).toFixed(1) +
      ' L' + (W - 1) + ' ' + (y1 - 6).toFixed(1) + ' L' + (W * (0.6 + r() * 0.2)).toFixed(1) + ' ' + (y1 - 4).toFixed(1) + 'Z';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<path d="' + d + '" fill="rgba(' + rgb + ',' + a + ')"/>' +
      '<path d="' + d2 + '" fill="rgba(' + rgb + ',' + (a * 0.35).toFixed(3) + ')"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function inkRGB() {
    var v = getComputedStyle(root).getPropertyValue('--accent-ink-rgb').trim();
    return /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(v) ? v.replace(/\s+/g, '') : '76,56,240';
  }
  var lastInk = '';
  function paintSwipes() {
    var rgb = inkRGB();
    if (rgb === lastInk) return;
    lastInk = rgb;
    $$('.nb-hl').forEach(function (m, i) { m.style.setProperty('--nb-swipe', swipeURL(hash(m.textContent) + i * 13, rgb, 0.2)); });
  }

  // ---- the letter -------------------------------------------------------------------------
  // [[words|app]] become highlighted; the app is also where a click leads.
  var LETTER = [
    "Hi, I'm Saumya. I build [[graphics tools|projects]] for GPUs, and my [[research|research]] is on programming languages that make them faster and more predictable.",
    " I've made iOS and macOS apps at [[Apple, Walmart and PayPal|experience]], worked in [[university labs|notes]], and kept [[a few side projects|more]] going along the way.",
    " I've lived in a handful of [[places|places]], I'm learning a few [[languages|languages]], I keep a list of [[games|games]] I admire, and I'm particular about [[coffee and tea|beverages]].",
    " If you'd like to learn, I [[teach for free|learn]]. Or just [[say hello|contact]]."
  ].join('');
  var APP_OF = { more: 'projects' };

  function currentPlace() {
    var cards = $$('#miscellaneous .mini-card, #miscellaneous_fallback .mini-card');
    for (var i = 0; i < cards.length; i++) {
      if (/current/i.test(txt($('.mini-card__meta', cards[i])))) {
        var t = txt($('.mini-card__title', cards[i])).split(/\s[-–—]\s/)[0].toLowerCase();
        return t.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      }
    }
    return '';
  }
  function today() {
    try { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); } catch (_) { return ''; }
  }

  function buildLetter(hero) {
    var sheet = make('article', 'nb-letter');
    sheet.setAttribute('aria-label', 'Introduction');
    var paper = make('div', 'nb-letter__paper');
    sheet.appendChild(paper);
    var t1 = make('span', 'nb-tape nb-tape--l'); t1.setAttribute('aria-hidden', 'true');
    var t2 = make('span', 'nb-tape nb-tape--r'); t2.setAttribute('aria-hidden', 'true');
    sheet.appendChild(t1); sheet.appendChild(t2);

    var head = make('header', 'nb-letter__head');
    var h1 = make('h1', 'nb-letter__name');
    var name = make('span', 'nb-letter__n');
    var say = make('span', 'nb-letter__say');
    var native = make('span', 'nb-letter__native');
    native.setAttribute('lang', 'gu');
    h1.appendChild(name); h1.appendChild(say); h1.appendChild(native);
    var when = make('p', 'nb-letter__when');
    head.appendChild(h1); head.appendChild(when);
    paper.appendChild(head);

    var p = make('p', 'nb-letter__body');
    LETTER.split(/(\[\[[^\]]+\]\])/).forEach(function (part, i) {
      var m = part.match(/^\[\[([^|]+)\|([^\]]+)\]\]$/);
      if (!m) { if (part) p.appendChild(document.createTextNode(part)); return; }
      var a = make('a', 'nb-hl', m[1]);
      a.href = '#';
      a.dataset.go = m[2];
      a.dataset.app = APP_OF[m[2]] || m[2];
      a.style.setProperty('--d', (0.35 + i * 0.07).toFixed(2) + 's');
      p.appendChild(a);
    });
    paper.appendChild(p);

    var sign = make('p', 'nb-letter__sign');
    sign.appendChild(make('span', 'nb-letter__sig', 'Saumya'));
    var ps = make('span', 'nb-letter__ps');
    ps.innerHTML = 'p.s. everything here is also on the <span class="nb-ps--side">tablet beside this letter</span><span class="nb-ps--below">tablet below</span>, one app for each part of the page.';
    sign.appendChild(ps);
    paper.appendChild(sign);

    var fill = function () {
      name.textContent = txt($('.hero-name')) || 'Saumya Lahera';
      var pr = txt($('.hero__copy .accent'));
      say.textContent = pr ? ' ' + pr.replace(/^\(?/, '(').replace(/\)?\.?$/, ')') : '';
      native.textContent = txt($('.hero-native2'));
      var place = currentPlace(), d = today();
      when.textContent = [place, d].filter(Boolean).join(', ');
    };
    fill();
    if (window.MutationObserver) {
      var q = null;
      var mo = new MutationObserver(function () { clearTimeout(q); q = setTimeout(fill, 80); });
      mo.observe(hero, { childList: true, subtree: true, characterData: true });
      var misc = $('#miscellaneous'); if (misc) mo.observe(misc, { childList: true, subtree: true });
    }

    p.addEventListener('click', function (e) {
      var a = e.target.closest('.nb-hl');
      if (!a) return;
      e.preventDefault();
      goTo(a.dataset.go);
      if (wide()) openApp(a.dataset.app, true);
    });
    var hover = function (on) {
      return function (e) {
        var a = e.target.closest && e.target.closest('.nb-hl');
        if (!a) return;
        var ic = $('.nb-icon[data-app="' + a.dataset.app + '"]');
        if (ic) ic.classList.toggle('nb-icon--called', on);
      };
    };
    p.addEventListener('mouseover', hover(true));
    p.addEventListener('mouseout', hover(false));
    p.addEventListener('focusin', hover(true));
    p.addEventListener('focusout', hover(false));
    return sheet;
  }

  // ---- reading the page --------------------------------------------------------------------
  function clean(node) {
    node.querySelectorAll('[id]').forEach(function (e) { e.removeAttribute('id'); });
    node.querySelectorAll('.pw-rv').forEach(function (e) { e.classList.remove('pw-rv'); });
    return node;
  }
  function cloneLinks(from, into) {
    $$('a[href]', from).forEach(function (a) {
      if (a.getAttribute('href') === '#') return;
      var c = make('a', 'nb-link', txt(a).replace(/[→↓↗]\s*$/, '').trim() + ' →');
      c.href = a.href;
      if (a.target) { c.target = a.target; c.rel = 'noopener noreferrer'; }
      into.appendChild(c);
    });
  }
  function para(text, cls) { return text ? make('p', cls || 'nb-p', text) : null; }

  var DATA = {
    projects: function () {
      var groups = [];
      var add = function (title, box, more) {
        if (!box) return;
        var items = $$(':scope > article.card', box).map(function (card) {
          var tags = $$('.tag', card).map(txt).filter(Boolean);
          return {
            title: txt($('h3', card)),
            sub: tags.join(' · '),
            el: card,
            go: more ? 'more' : 'projects',
            page: function () {
              var f = document.createDocumentFragment();
              var v = card.getAttribute('data-video');
              if (v) {
                var vid = make('video', 'nb-media');
                vid.src = v; vid.muted = true; vid.loop = true; vid.autoplay = true; vid.playsInline = true;
                vid.setAttribute('playsinline', ''); vid.preload = 'metadata';
                vid.addEventListener('error', function () { vid.remove(); });
                f.appendChild(vid);
              }
              if (tags.length) f.appendChild(make('p', 'nb-kicker', tags.join(' · ')));
              f.appendChild(make('h3', 'nb-h', txt($('h3', card))));
              var m = para(txt($('.card__top p, p.muted', card)), 'nb-p nb-p--lede'); if (m) f.appendChild(m);
              var ul = $('ul.bullets', card);
              if (ul) { var u = make('ul', 'nb-ul'); $$('li', ul).forEach(function (li) { u.appendChild(make('li', null, txt(li))); }); f.appendChild(u); }
              var links = make('p', 'nb-links'); cloneLinks($('.card__actions', card) || make('div'), links);
              if (links.children.length) f.appendChild(links);
              return f;
            }
          };
        });
        if (items.length) groups.push({ title: title, items: items });
      };
      add(txt($('[data-field="section_heads.work.title"]')) || 'Selected work', $('#selected_work'));
      add(txt($('[data-field="section_heads.more_work.title"]')) || 'More projects', live('#more_projects', '#more_projects_fallback'), true);
      return { groups: groups };
    },
    research: function () {
      var items = $$('#research_panels .panel').map(function (pn) {
        return {
          title: txt($('h3', pn)), sub: txt($('.callout', pn)).replace(/^(\w+):\s*/, ''), el: pn,
          page: function () {
            var f = document.createDocumentFragment();
            f.appendChild(make('h3', 'nb-h', txt($('h3', pn))));
            $$(':scope > p', pn).forEach(function (q) { f.appendChild(para(txt(q))); });
            var c = $('.callout', pn);
            if (c) f.appendChild(make('p', 'nb-callout', txt(c)));
            return f;
          }
        };
      });
      return { intro: txt($('[data-field="section_heads.research.subtitle"]')), groups: [{ items: items }] };
    },
    notes: function () {
      var box = live('#other_sections', '#other_sections_fallback');
      var groups = [], g = null;
      if (!box) return { groups: groups };
      $$('.section__head, .row', box).forEach(function (el) {
        if (el.matches('.section__head')) { g = { title: txt($('h2', el)), items: [] }; groups.push(g); return; }
        if (!g) { g = { title: '', items: [] }; groups.push(g); }
        var item = {
          title: txt($('h3', el)), sub: '', el: el,
          page: function () {
            var f = document.createDocumentFragment();
            var gt = (groups.filter(function (gr) { return gr.items.indexOf(item) >= 0; })[0] || {}).title;
            if (gt) f.appendChild(make('p', 'nb-kicker', gt));
            f.appendChild(make('h3', 'nb-h', txt($('h3', el))));
            var m = para(txt($('p', el))); if (m) f.appendChild(m);
            var links = make('p', 'nb-links'); cloneLinks(el, links);
            if (links.children.length) f.appendChild(links);
            return f;
          }
        };
        g.items.push(item);
      });
      groups.forEach(function (gr) { gr.items.forEach(function (it) { it.sub = gr.title; }); });
      return { groups: groups.filter(function (gr) { return gr.items.length; }) };
    },
    experience: function () {
      var items = $$('#hero_pills .pill').map(function (pl) {
        var parts = txt(pl).split(/,\s*/);
        var img = $('img', pl);
        return { title: parts[0], sub: parts.slice(1).join(', '), icon: img && img.getAttribute('src'), el: null };
      });
      return { intro: 'Where I studied, and where I have built things.', groups: [{ items: items }], flat: true };
    },
    places: function () {
      var box = live('#miscellaneous', '#miscellaneous_fallback');
      var items = box ? $$('.mini-card', box).map(function (c) {
        var img = $('img', c);
        return {
          title: txt($('.mini-card__title', c)), sub: txt($('.mini-card__meta', c)).toLowerCase(),
          img: img && (img.currentSrc || img.src), el: c,
          page: function () {
            var f = document.createDocumentFragment();
            if (img) { var i = make('img', 'nb-media nb-media--img'); i.src = img.currentSrc || img.src; i.alt = ''; f.appendChild(i); }
            f.appendChild(make('h3', 'nb-h', txt($('.mini-card__title', c))));
            f.appendChild(make('p', 'nb-kicker', txt($('.mini-card__meta', c))));
            return f;
          }
        };
      }) : [];
      return { groups: [{ items: items }], photos: true, action: ['Explore countries', '#places-trigger'] };
    },
    languages: function () {
      var items = $$('#duolingo_grid .duo-card').map(function (c) {
        var img = $('img', c);
        return {
          title: txt($('.duo-card__title', c)), sub: txt($('.duo-card__subtitle', c)),
          img: img && (img.currentSrc || img.src), el: c,
          page: function () {
            var f = document.createDocumentFragment();
            if (img) { var i = make('img', 'nb-media nb-media--img'); i.src = img.currentSrc || img.src; i.alt = ''; f.appendChild(i); }
            f.appendChild(make('h3', 'nb-h', txt($('.duo-card__title', c))));
            var m = para(txt($('.duo-card__subtitle', c)), 'nb-p nb-p--lede'); if (m) f.appendChild(m);
            return f;
          }
        };
      });
      var streak = [txt($('.duo-streak-line')), txt($('.duo-streak-updated'))].filter(Boolean).join(' ');
      return { intro: streak, groups: [{ items: items }], action: ['Learn languages', '#lang-trigger'] };
    },
    games: function () {
      var items = $$('#games_list .pill').map(function (pl) { return { title: txt(pl), sub: '', el: null }; });
      return { intro: txt($('[data-field="section_heads.games.subtitle"]')), groups: [{ items: items }], flat: true, action: ['Games I admire', '#games-trigger'] };
    },
    skills: function () {
      var items = $$('#featured_skills .pill').map(function (pl) { return { title: txt(pl), sub: '', el: null }; });
      return { groups: [{ items: items }], flat: true, chips: true };
    },
    about: function () {
      return {
        page: function () {
          var f = document.createDocumentFragment();
          var img = $('#about .hero-avatar');
          if (img) { var i = make('img', 'nb-portrait'); i.src = img.currentSrc || img.src; i.alt = 'Saumya Lahera'; f.appendChild(i); }
          var m = para(txt($('#about_summary')), 'nb-p nb-p--lede'); if (m) f.appendChild(m);
          var sk = $$('#featured_skills .pill').map(txt);
          if (sk.length) f.appendChild(make('p', 'nb-kicker', sk.join(' · ')));
          return f;
        }
      };
    },
    learn: function () {
      return {
        page: function () {
          var f = document.createDocumentFragment();
          f.appendChild(make('h3', 'nb-h', txt($('[data-field="section_heads.learn.title"]')) || 'Learn for free'));
          var m = para(txt($('[data-field="learn.text"]'))); if (m) f.appendChild(m);
          var b = $('[data-field="learn.button_label"]');
          if (b) { var a = make('a', 'nb-btn', txt(b)); a.href = b.href; f.appendChild(a); }
          return f;
        }
      };
    },
    contact: function () {
      return {
        page: function () {
          var f = document.createDocumentFragment();
          f.appendChild(make('h3', 'nb-h', 'Say hello.'));
          var list = make('div', 'nb-contact');
          $$('#contact a').forEach(function (a) {
            var c = make('a', 'nb-row nb-row--link');
            c.href = a.href;
            if (a.target) { c.target = a.target; c.rel = 'noreferrer'; }
            c.appendChild(make('span', 'nb-row__t', txt(a)));
            var host = '';
            if (/^mailto:/.test(a.href)) host = a.href.replace(/^mailto:/, '').split('?')[0];
            else try { host = new URL(a.href).hostname.replace(/^www\./, ''); } catch (_) {}
            c.appendChild(make('span', 'nb-row__s', host));
            c.appendChild(make('span', 'nb-row__go', '↗'));
            list.appendChild(c);
          });
          f.appendChild(list);
          return f;
        }
      };
    }
  };

  // ---- the tablet --------------------------------------------------------------------------
  var GLYPH = {
    projects: '<path d="M13 19h19v14H13z"/><path d="M17 19v-4h19v14h-4"/><path d="M16 29l4-4 3 3 3-4 4 5"/>',
    research: '<path d="M17 17h14v14H17z"/><path d="M21 21h6v6h-6z"/><path d="M20 13v4M24 13v4M28 13v4M20 31v4M24 31v4M28 31v4M13 20h4M13 24h4M13 28h4M31 20h4M31 24h4M31 28h4"/>',
    notes: '<path d="M15 13h18v22H15z"/><path d="M18 19h12M18 23h12M18 27h8"/><path d="M19 11v4M24 11v4M29 11v4"/>',
    experience: '<path d="M13 19h22v14H13z"/><path d="M20 19v-4h8v4"/><path d="M13 25h22"/><path d="M22 24v3h4v-3"/>',
    places: '<path d="M24 35c-5-6-8-10-8-14a8 8 0 0 1 16 0c0 4-3 8-8 14z"/><circle cx="24" cy="21" r="2.6"/>',
    languages: '<path d="M11 13h20v13H19l-4 4v-4h-4z"/><path d="M31 19h6v11h-2v3.5L31.5 30H24v-4"/><text x="14.2" y="22.6" font-size="9.5" font-family="EB Garamond, Georgia, serif" stroke="none" fill="currentColor">Aa</text>',
    games: '<path d="M17 19h14c3 0 5 3 5 8s-2 6-4 6-3-2-5-3h-6c-2 1-3 3-5 3s-4-1-4-6 2-8 5-8z"/><path d="M19 23v5M16.5 25.5h5"/><circle cx="29" cy="24" r=".9"/><circle cx="31.5" cy="27" r=".9"/>',
    beverages: '<path d="M15 21h16v6a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z"/><path d="M31 23h2a3 3 0 0 1 0 6h-2.5"/><path d="M20 12c-1.4 2 1.4 3 0 5.5M25 12c-1.4 2 1.4 3 0 5.5"/>',
    learn: '<path d="M24 17c-3-2-7-2-10-1v17c3-1 7-1 10 1 3-2 7-2 10-1V16c-3-1-7-1-10 1z"/><path d="M24 17v17"/>',
    about: '<circle cx="24" cy="21" r="4.5"/><path d="M15.5 34c1-5 4.5-7.5 8.5-7.5s7.5 2.5 8.5 7.5"/>',
    skills: '<path d="M15 33l1.6-5.6L29 15l4 4-12.4 12.4z"/><path d="M26.5 17.5l4 4M16.6 27.4l4 4"/>',
    contact: '<path d="M13 17h22v15H13z"/><path d="M13 17l11 8.5L35 17"/>'
  };
  var APPS = [
    ['projects', 'Projects'], ['research', 'Research'], ['notes', 'Notes'],
    ['experience', 'Experience'], ['places', 'Places'], ['languages', 'Languages'],
    ['games', 'Games'], ['beverages', 'Beverages'], ['learn', 'Learn'],
    ['about', 'About'], ['skills', 'Skills'], ['contact', 'Contact']
  ];
  var NAME = {}; APPS.forEach(function (a) { NAME[a[0]] = a[1]; });

  // a hand-drawn rounded square: two passes of the pen, never quite closed
  function frameD(r, x, y, w, h, k) {
    var j = function (v) { return (v + (r() - 0.5) * 1.6).toFixed(1); };
    return 'M' + j(x + k) + ' ' + j(y) + ' L' + j(x + w - k) + ' ' + j(y) +
      ' Q' + j(x + w) + ' ' + j(y) + ' ' + j(x + w) + ' ' + j(y + k) +
      ' L' + j(x + w) + ' ' + j(y + h - k) + ' Q' + j(x + w) + ' ' + j(y + h) + ' ' + j(x + w - k) + ' ' + j(y + h) +
      ' L' + j(x + k) + ' ' + j(y + h) + ' Q' + j(x) + ' ' + j(y + h) + ' ' + j(x) + ' ' + j(y + h - k) +
      ' L' + j(x) + ' ' + j(y + k) + ' Q' + j(x) + ' ' + j(y) + ' ' + j(x + k + 3) + ' ' + j(y - 0.5);
  }
  function icon(key, label, i) {
    var b = make('button', 'nb-icon');
    b.type = 'button';
    b.dataset.app = key;
    b.style.setProperty('--i', i);
    var r = rng(hash(key) + 3);
    b.innerHTML = '<svg class="nb-icon__art" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' +
      '<path class="nb-icon__fill" d="' + frameD(r, 3, 3, 42, 42, 11) + '"/>' +
      '<path class="nb-icon__frame" d="' + frameD(r, 3, 3, 42, 42, 11) + '"/>' +
      '<path class="nb-icon__frame nb-icon__frame--2" d="' + frameD(r, 3.5, 3.4, 41, 41.5, 11) + '"/>' +
      '<g class="nb-icon__glyph">' + GLYPH[key] + '</g></svg>' +
      '<span class="nb-icon__label">' + label + '</span>';
    return b;
  }

  function deckle(w, h, seed) {
    // the edge of a sheet of handmade paper: never straight, with the odd nick
    var r = rng(seed), pts = [], m = 3;
    var edge = function (x0, y0, x1, y1, nx, ny) {
      var L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / 7));
      for (var k = 0; k < n; k++) {
        var t = k / n, o = (r() - 0.5) * 1.6 + (r() < 0.06 ? r() * 2.2 : 0);
        pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]);
      }
    };
    edge(m, m, w - m, m, 0, 1); edge(w - m, m, w - m, h - m, -1, 0);
    edge(w - m, h - m, m, h - m, 0, -1); edge(m, h - m, m, m, 1, 0);
    return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + 'Z';
  }
  function paperBack(el, seed, cls) {
    var draw = function () {
      var w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h) return;
      var old = el.querySelector(':scope > .' + cls);
      if (old && Math.abs(old._w - w) < 2 && Math.abs(old._h - h) < 2) return;
      if (old) old.remove();
      var s = document.createElementNS(NS, 'svg');
      s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
      s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      s._w = w; s._h = h;
      var d = deckle(w, h, seed);
      s.innerHTML = '<path class="nb-back__shadow" transform="translate(3 4)" d="' + d + '"/>' +
        '<path class="nb-back__fibre" transform="translate(.6 .9)" d="' + d + '"/>' +
        '<path class="nb-back__paper" d="' + d + '"/>';
      el.insertBefore(s, el.firstChild);
    };
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(el);
  }

  var tablet, screen, home, appView, appTitle, appBody, current = null, stack = [];

  function buildTablet() {
    tablet = make('aside', 'nb-tablet');
    tablet.setAttribute('aria-label', 'Tablet: one app for each part of the page');
    screen = make('div', 'nb-screen');
    tablet.appendChild(screen);

    var bar = make('div', 'nb-status');
    bar.innerHTML = '<span class="nb-status__who">saumya’s tablet</span><span class="nb-status__right"><span class="nb-status__time"></span>' +
      '<svg class="nb-status__bat" viewBox="0 0 26 12" aria-hidden="true"><path d="M1.5 2.2h20.6v7.8H1.6z"/><path d="M23.4 4.6v3"/><path d="M3.6 4.2h12v3.8h-12z" class="nb-status__charge"/></svg></span>';
    screen.appendChild(bar);

    var views = make('div', 'nb-views');
    screen.appendChild(views);

    home = make('div', 'nb-home');
    var greet = make('div', 'nb-greet');
    greet.appendChild(make('p', 'nb-greet__hi'));
    greet.appendChild(make('p', 'nb-greet__day'));
    home.appendChild(greet);
    var grid = make('div', 'nb-grid');
    APPS.forEach(function (a, i) { grid.appendChild(icon(a[0], a[1], i)); });
    home.appendChild(grid);
    views.appendChild(home);

    appView = make('section', 'nb-app');
    appView.hidden = true;
    var top = make('header', 'nb-app__top');
    var back = make('button', 'nb-app__back', '‹ back');
    back.type = 'button';
    appTitle = make('h2', 'nb-app__title');
    var close = make('button', 'nb-app__close', 'home');
    close.type = 'button';
    top.appendChild(back); top.appendChild(appTitle); top.appendChild(close);
    appView.appendChild(top);
    appBody = make('div', 'nb-app__body');
    appView.appendChild(appBody);
    views.appendChild(appView);

    var homebar = make('button', 'nb-homebar');
    homebar.type = 'button';
    homebar.setAttribute('aria-label', 'Home');
    homebar.innerHTML = '<svg viewBox="0 0 120 8" aria-hidden="true"><path d="M3 4.6 C30 3.2 60 5.2 117 3.6"/></svg>';
    screen.appendChild(homebar);

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.nb-icon');
      if (b) openApp(b.dataset.app);
    });
    back.addEventListener('click', function () { if (stack.length > 1) { stack.pop(); render(stack[stack.length - 1], true); } else goHome(); });
    close.addEventListener('click', goHome);
    homebar.addEventListener('click', goHome);
    tablet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) { e.preventDefault(); goHome(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('nb-full')) goHome();
    });

    var clock = function () {
      var d = new Date(), h = d.getHours();
      $('.nb-status__time', bar).textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      $('.nb-greet__hi', greet).textContent = h < 5 ? 'Up late.' : h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : h < 22 ? 'Good evening.' : 'Good night.';
      $('.nb-greet__day', greet).textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      $('.nb-status__charge', bar).setAttribute('d', 'M3.6 4.2h' + (4 + (24 - h) / 24 * 14).toFixed(1) + 'v3.8h-' + (4 + (24 - h) / 24 * 14).toFixed(1) + 'z');
    };
    clock();
    setInterval(clock, 30000);
    paperBack(tablet, 91, 'nb-back');
    return tablet;
  }

  function turn(el, backwards) {
    if (reduceMotion) return;
    el.classList.remove('nb-turn', 'nb-turn--back');
    void el.offsetWidth;
    el.classList.add(backwards ? 'nb-turn--back' : 'nb-turn');
  }

  function goHome() {
    if (!current) return;
    current = null; stack = [];
    appBody.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (_) {} });
    appView.hidden = true;
    home.hidden = false;
    turn(home, true);
    root.classList.remove('nb-full');
    var b = $('.nb-icon[data-app="' + (tablet.dataset.last || '') + '"]', home);
    if (b && tablet.contains(document.activeElement)) b.focus({ preventScroll: true });
  }

  function openApp(key, quiet) {
    if (!tablet) return;
    if (key === 'beverages') { var t = $('#coffee-trigger'); if (t && !quiet) t.click(); else if (t && quiet) { /* the page already went there */ } return; }
    if (!DATA[key]) return;
    current = key;
    tablet.dataset.last = key;
    stack = [{ app: key }];
    home.hidden = true;
    appView.hidden = false;
    if (phone() && !quiet) root.classList.add('nb-full');
    render(stack[0], false);
  }

  function seeOnPage(key, el) {
    var b = make('button', 'nb-see', 'see it on the page ↓');
    b.type = 'button';
    b.addEventListener('click', function () {
      if (root.classList.contains('nb-full')) goHome();
      if (el) {
        var y = el.getBoundingClientRect().top + window.scrollY - (phone() ? 70 : 110);
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
        el.classList.remove('nb-flash'); void el.offsetWidth; el.classList.add('nb-flash');
        setTimeout(function () { el.classList.remove('nb-flash'); }, 2400);
      } else goTo(key);
    });
    return b;
  }

  function render(state, backwards) {
    var key = state.app, data = DATA[key]();
    appBody.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (_) {} });
    appBody.innerHTML = '';
    appBody.scrollTop = 0;
    appView.dataset.app = key;
    appTitle.textContent = state.item ? NAME[key] : NAME[key];
    appView.classList.toggle('nb-app--page', !!state.item || !!data.page);
    var page = make('div', 'nb-pagebody');

    if (state.item) {
      page.appendChild(state.item.page());
      page.appendChild(seeOnPage(key, state.item.el));
    } else if (data.page) {
      page.appendChild(data.page());
      page.appendChild(seeOnPage(key));
    } else {
      if (data.intro) page.appendChild(make('p', 'nb-intro', data.intro));
      var n = 0;
      data.groups.forEach(function (g) {
        if (g.title && data.groups.length > 1) page.appendChild(make('p', 'nb-group', g.title));
        var list = make(data.chips ? 'p' : 'ol', data.photos ? 'nb-photos' : data.chips ? 'nb-chips' : 'nb-list');
        g.items.forEach(function (it) {
          n++;
          if (data.chips) { list.appendChild(make('span', 'nb-chip', it.title)); return; }
          var li = make('li');
          var row = make(it.page ? 'button' : 'div', 'nb-row' + (it.page ? '' : ' nb-row--still'));
          if (it.page) row.type = 'button';
          if (data.photos && it.img) {
            var im = make('img', 'nb-photo'); im.src = it.img; im.alt = ''; im.loading = 'lazy';
            row.appendChild(im);
          } else if (it.icon) {
            var ic = make('img', 'nb-row__icon'); ic.alt = ''; ic.onerror = function () { ic.style.visibility = 'hidden'; }; ic.src = it.icon;
            row.appendChild(ic);
          } else row.appendChild(make('span', 'nb-row__n', (n < 10 ? '0' : '') + n));
          var t = make('span', 'nb-row__t', it.title);
          if (it.sub) t.appendChild(make('span', 'nb-row__s', it.sub));
          row.appendChild(t);
          if (it.page) row.appendChild(make('span', 'nb-row__go', '›'));
          if (it.page) row.addEventListener('click', function () {
            stack.push({ app: key, item: it });
            render(stack[stack.length - 1], false);
          });
          li.appendChild(row);
          list.appendChild(li);
        });
        page.appendChild(list);
      });
      if (!n) page.appendChild(make('p', 'nb-intro', 'Nothing here yet.'));
      if (data.action) {
        var trg = $(data.action[1]);
        if (trg) {
          var ab = make('button', 'nb-btn', data.action[0] + ' →');
          ab.type = 'button';
          ab.addEventListener('click', function () { if (root.classList.contains('nb-full')) goHome(); trg.click(); });
          page.appendChild(ab);
        }
      }
      page.appendChild(seeOnPage(key));
    }
    appBody.appendChild(page);
    turn(page, backwards);
    if (tablet.contains(document.activeElement) || state.item) {
      var f = state.item ? $('.nb-app__back', appView) : $('.nb-row, .nb-btn, .nb-see', page);
      if (f) f.focus({ preventScroll: true });
    }
  }

  // ---- sections whose cells are pages ----------------------------------------------------
  function buildExperience() {
    var pills = $('#hero_pills');
    if (!pills) return;
    var sec = make('section', 'section nb-sec');
    sec.id = 'experience';
    var head = make('div', 'section__head');
    var h2 = make('h2', null, txt($('[data-field="hero.pills_title"]')) || 'Education & Experience');
    head.appendChild(h2);
    head.appendChild(make('p', 'muted', 'Where I studied, and where I have built things.'));
    sec.appendChild(head);
    var grid = make('div', 'nb-pages');
    grid.setAttribute('data-nb-pages', '');
    sec.appendChild(grid);
    var fill = function () {
      grid.innerHTML = '';
      $$('.pill', pills).forEach(function (pl, i) {
        var parts = txt(pl).split(/,\s*/);
        var cell = make('article', 'nb-pg nb-pg--exp');
        var img = $('img', pl);
        var school = /universit|college|school|polytechnic|institute/i.test(txt(pl));
        cell.appendChild(make('p', 'nb-pg__kind', school ? 'studied' : 'worked'));
        if (img) { var im = make('img', 'nb-pg__logo'); im.alt = ''; im.onerror = function () { im.remove(); }; im.src = img.getAttribute('src'); cell.appendChild(im); }
        cell.appendChild(make('h3', 'nb-pg__title', parts[0]));
        if (parts.length > 1) cell.appendChild(make('p', 'nb-pg__sub', parts.slice(1).join(', ')));
        cell.style.setProperty('--tilt', ((i % 2 ? 1 : -1) * (0.3 + (i % 3) * 0.2)).toFixed(2) + 'deg');
        grid.appendChild(cell);
      });
      dressPages();
    };
    fill();
    if (window.MutationObserver) {
      var q = null;
      new MutationObserver(function () { clearTimeout(q); q = setTimeout(fill, 80); }).observe(pills, { childList: true, subtree: true, characterData: true });
    }
    var research = $('#research');
    research.parentNode.insertBefore(sec, research.nextSibling);
  }

  function dressPages() {
    if (!window.pwStamp) return;
    var cells = $$('.nb-pg, #research_panels > .panel');
    cells.forEach(function (c, i) {
      c.classList.add('nb-pg');
      window.pwStamp(c, i + 40);
      if (!c.querySelector(':scope > .pw-snap-tape')) {
        var tape = make('span', 'pw-snap-tape');
        tape.setAttribute('aria-hidden', 'true');
        tape.style.setProperty('--r', ((i * 7) % 9 - 4) + 'deg');
        c.appendChild(tape);
      }
    });
  }

  // ---- put it together ---------------------------------------------------------------------
  function start() {
    var hero = $('.hero');
    if (!hero) return;
    hero.classList.add('nb-hero');
    var rp = $('#research_panels');
    if (rp) { rp.setAttribute('data-nb-pages', ''); rp.classList.add('nb-pages'); }
    buildExperience();
    var letter = buildLetter(hero);
    hero.insertBefore(letter, hero.firstChild);
    var paperEl = $('.nb-letter__paper', letter);
    paperBack(paperEl, 23, 'nb-back');
    var rules = function () {
      var body = $('.nb-letter__body', paperEl), cs = getComputedStyle(body);
      var lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
      if (!lh || !fs) return;
      var inset = parseFloat(getComputedStyle(paperEl, '::before').top) || 14;
      var T = body.offsetTop + (lh - 1.305 * fs) / 2 + 1.007 * fs + 3 - inset;
      paperEl.style.setProperty('--nb-rule-y', ((((T - lh + 1) % lh) + lh) % lh).toFixed(1) + 'px');
    };
    rules();
    if (window.ResizeObserver) new ResizeObserver(rules).observe(paperEl);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rules);
    hero.appendChild(buildTablet());
    paintSwipes();
    if (window.MutationObserver) new MutationObserver(paintSwipes).observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    setInterval(paintSwipes, 60000);
    // pages are torn once the pen (penwash) is on the page
    var later = function () { dressPages(); setTimeout(dressPages, 600); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
    document.addEventListener('DOMContentLoaded', dressPages);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('nb-ready'); }); });
    window.addEventListener('resize', function () { if (!phone()) root.classList.remove('nb-full'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
