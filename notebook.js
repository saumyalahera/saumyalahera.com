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
  // a box drawn by hand around a highlighted phrase: four strokes that wobble a little,
  // overshoot at a corner or two, and never quite meet
  function boxURL(seed) {
    var r = rng(seed), W = 200, H = 40, j = function (n) { return (r() - 0.5) * n; };
    var x0 = 3 + j(2), x1 = W - 3 + j(2), y0 = 3 + j(2.4), y1 = H - 3 + j(2.4);
    var side = function (ax, ay, bx, by, o1, o2) {
      var dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      var sx = ax - ux * o1, sy = ay - uy * o1, ex = bx + ux * o2, ey = by + uy * o2;
      var mx = (sx + ex) / 2 - uy * j(2.6), my = (sy + ey) / 2 + ux * j(2.6);
      return 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1);
    };
    var o = function () { return r() < 0.45 ? 1 + r() * 2.6 : -r() * 1.2; };
    var d = side(x0, y0 + j(1.5), x1, y0 + j(1.5), o(), o()) + side(x1 + j(1.2), y0, x1 + j(1.2), y1, o(), o()) +
      side(x1, y1 + j(1.5), x0, y1 + j(1.5), o(), o()) + side(x0 + j(1.2), y1, x0 + j(1.2), y0, o(), o());
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<path d="' + d + '" fill="none" stroke="rgba(26,26,24,.86)" stroke-width="1.15" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
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
    if (lastInk) return;
    lastInk = 'done';
    // each part of the site has its own colour of highlighter
    $$('.nb-hl').forEach(function (m, i) {
      // one fluorescent green highlighter for the whole page
      var c = '57,255,20';
      m.style.setProperty('--nb-swipe', swipeURL(hash(m.textContent) + i * 13, c, 0.34));
      m.style.setProperty('--nb-box', boxURL(hash(m.textContent) * 3 + i * 29));
    });
  }

  // ---- the introduction: a page from a 1930s magazine ------------------------------------
  // Three columns, as the magazines set them: an advertisement on the left, an
  // editorial column in the middle, and a second advertisement on the right.
  // [[words|app]] become highlighted; the app is also where a click leads.
  var APP_OF = { more: 'projects' };

  function currentPlace() {
    var cards = $$('#miscellaneous .mini-card, #miscellaneous_fallback .mini-card');
    for (var i = 0; i < cards.length; i++) {
      if (/current/i.test(txt($('.mini-card__meta', cards[i])))) {
        var t = txt($('.mini-card__title', cards[i])).split(/\s[-–—]\s/)[0].toLowerCase();
        return t.replace(/\b\w/g, function (c) { return c.toUpperCase(); }).split(', ').map(function (w, k) { return k && w.length <= 3 ? w.toUpperCase() : w; }).join(', ');
      }
    }
    return '';
  }

  // prose with [[highlighted|app]] words; the first word can open with a raised initial
  function prose(cls, text, opening) {
    var p = make('p', cls);
    var first = true;
    text.split(/(\[\[[^\]]+\]\])/).forEach(function (part) {
      var m = part.match(/^\[\[([^|]+)\|([^\]]+)\]\]$/);
      if (!m) {
        if (!part) return;
        if (first && opening) {
          var w = part.match(/^(\S+)(.*)$/);
          if (w) {
            if (opening === 'drop') {
              var d = make('span', 'nb-drop', w[1].charAt(0));
              p.appendChild(d);
              p.appendChild(make('span', 'nb-sc', w[1].slice(1)));
            } else p.appendChild(make('span', 'nb-sc nb-sc--lead', w[1]));
            part = w[2];
          }
        }
        first = false;
        p.appendChild(document.createTextNode(part));
        return;
      }
      first = false;
      var a = make('a', 'nb-hl', m[1]);
      a.href = '#';
      a.dataset.go = m[2];
      a.dataset.app = APP_OF[m[2]] || m[2];
      p.appendChild(a);
    });
    return p;
  }

  function buildLetter(hero) {
    var sheet = make('article', 'nb-letter');
    sheet.setAttribute('aria-label', 'Introduction');
    var paper = make('div', 'nb-letter__paper');
    sheet.appendChild(paper);

    var folio = make('p', 'nb-folio');
    folio.setAttribute('aria-hidden', 'true');
    paper.appendChild(folio);

    var cols = make('div', 'nb-mag');
    paper.appendChild(cols);

    // ---- column one: the introduction, set like a 1930s advertisement
    var c1 = make('section', 'nb-mag__col nb-mag__col--ad');
    c1.appendChild(make('p', 'nb-thin nb-thin--s', 'This Distinguished Little Portfolio Is'));
    var h1 = make('h1', 'nb-letter__name nb-big');
    var nm = make('span', 'nb-big__name');
    h1.appendChild(make('span', 'nb-big__pre', 'The work of '));
    h1.appendChild(nm);
    c1.appendChild(h1);
    var say = make('p', 'nb-thin nb-thin--m');
    c1.appendChild(say);
    var nat = make('p', 'nb-native');
    nat.lang = 'gu';
    c1.appendChild(nat);
    c1.appendChild(prose('nb-copy', "Hi, I'm Saumya. I build [[graphics tools|projects]] for GPUs, and my [[research|research]] is on programming languages that make them faster and more predictable.", 'lead'));
    c1.appendChild(prose('nb-copy', "I've made iOS and macOS apps at [[Apple, Walmart and PayPal|experience]], and if you'd like to learn, I [[teach for free|learn]]. Or just [[say hello|contact]]."));
    var rc = make('div', 'nb-recipe');
    rc.innerHTML = '<p class="nb-recipe__by"><b>A recipe from my notebook</b></p>' +
      '<p class="nb-recipe__t">“Tile-Local” Pass Fusion</p>' +
      '<p class="nb-recipe__x">Keep each pass in tile memory; fuse the ones that share a tile; drop the transient textures. Serves sixty frames a second.</p>';
    c1.appendChild(rc);
    var sig = make('p', 'nb-sig');
    sig.innerHTML = '<span class="nb-sig__s">Saumya</span><span class="nb-sig__t">Engineer</span>';
    cols.appendChild(c1);

    // ---- column two: an editorial column
    var c2 = make('section', 'nb-mag__col nb-mag__col--ed');
    c2.appendChild(make('h2', 'nb-thin nb-thin--h', 'Research Notes'));
    c2.appendChild(make('p', 'nb-deck', 'Languages for the GPU—A Patient Pursuit'));
    var art = make('span', 'nb-cut');
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<svg viewBox="0 0 64 64">' + GLYPH.research + '</svg>';
    c2.appendChild(prose('nb-copy', 'The cure for slow pictures, I suspect, lies in the compiler. My [[research|research]] is on languages and compilers for the GPU, so that graphics run faster and more predictably.', 'drop'));
    var titles = $$('#research_panels .panel h3').map(txt).filter(Boolean);
    if (titles.length) {
      var list = titles.map(function (t) { return t.split(/:/)[0]; });
      var last = list.pop();
      c2.appendChild(prose('nb-copy', 'This season: ' + (list.length ? list.join(', ') + ' and ' : '') + last + ', among my [[graphics tools|projects]] and [[side projects|more]].'));
    }
    c2.appendChild(prose('nb-copy', "Before this, I made apps at [[Apple, Walmart and PayPal|experience]] and built research tools in [[university labs|notes]] at Carnegie Mellon.", 'drop'));
    c2.appendChild(prose('nb-copy', "I’ve lived in a few [[places|places]], am learning [[languages|languages]], collect [[games|games]] I admire and fuss over [[coffee and tea|beverages]]."));
    cols.appendChild(c2);

    // ---- column three: an advertisement for the lessons
    var c3 = make('section', 'nb-mag__col nb-mag__col--ad2');
    var brand = make('a', 'nb-brand', 'Free Lessons');
    brand.href = '#learn-for-free';
    brand.dataset.go = 'learn'; brand.dataset.app = 'learn';
    c3.appendChild(brand);
    var addr = make('p', 'nb-addr');
    addr.innerHTML = '<span>iOS development</span><span>Mathematics</span><span>Programming</span><span>Project building</span>';
    c3.appendChild(addr);
    c3.appendChild(make('p', 'nb-thin nb-thin--x', 'The Patient Mentor in Swift & Metal'));
    var tall = make('div', 'nb-tall');
    tall.innerHTML = PLATE;   // a fashion plate, drawn like the ones in the old magazines
    tall.appendChild(make('span', 'nb-price', '0.00'));
    c3.appendChild(tall);
    var with_ = make('p', 'nb-with');
    with_.innerHTML = 'With the “Apple Developer” fee <span>—I cover it for selected students</span>';
    c3.appendChild(with_);
    var apply = make('a', 'nb-apply', 'Apply for free mentorship →');
    apply.dataset.go = 'learn'; apply.dataset.app = 'learn';
    var lb = $('[data-field="learn.button_label"]');
    apply.href = lb ? lb.href : '#learn-for-free';
    c3.appendChild(apply);

    // a second, smaller notice at the foot of the column, boxed as small ads were
    var box = make('div', 'nb-box');
    box.innerHTML = '<p class="nb-box__k">Correspondence</p>' +
      '<p class="nb-thin nb-box__t">Write to Me</p>' +
      '<p class="nb-box__x">About GPUs, compilers or a first iOS app. I answer every letter myself.</p>';
    var hello = make('a', 'nb-apply', 'Say hello →');
    hello.href = '#contact'; hello.dataset.go = 'contact'; hello.dataset.app = 'contact';
    box.appendChild(hello);
    c3.appendChild(box);
    cols.appendChild(c3);
    [[c1, 31, 'town'], [c2, 47, 'observatory'], [c3, 0]].forEach(function (o) {
      var body = make('div', 'nb-mag__body');
      while (o[0].firstChild) body.appendChild(o[0].firstChild);
      o[0].appendChild(body);
      if (o[1]) o[0].appendChild(spot(o[1], o[2]));
      else { var foot = make('div', 'nb-mag__body'); o[0].appendChild(tall); [with_, apply, box].forEach(function (e) { foot.appendChild(e); }); o[0].appendChild(foot); }
    });
    c1.appendChild(sig);

    var fill = function () {
      var full = txt($('.hero-name')) || 'Saumya Lahera';
      nm.textContent = full;
      var pr = txt($('.hero__copy .accent')).replace(/^\(|\)\.?$/g, '');
      say.textContent = pr ? 'It’s said “' + pr + '”' : '';
      nat.textContent = txt($('.hero-native2'));
      var place = currentPlace() || 'Palo Alto', d = new Date();
      folio.innerHTML = '<span class="nb-folio__name">' + full + '</span><span class="nb-folio__mid">' + place + ' · ' +
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</span><span class="nb-folio__n">' + d.getDate() + '</span>';
    };
    fill();
    if (window.MutationObserver) {
      var q = null;
      var mo = new MutationObserver(function () { clearTimeout(q); q = setTimeout(fill, 80); });
      mo.observe(hero, { childList: true, subtree: true, characterData: true });
      var misc = $('#miscellaneous'); if (misc) mo.observe(misc, { childList: true, subtree: true });
    }
    var fa = $('.footer-avatar'), ab = $('#about .hero-avatar');

    paper.addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]');
      if (!a) return;
      if (a.classList.contains('nb-apply') && !/^#/.test(a.getAttribute('href'))) return;   // the real mail link
      e.preventDefault();
      goTo(a.dataset.go);
      if (wide()) openApp(a.dataset.app, true);
    });
    var hover = function (on) {
      return function (e) {
        var a = e.target.closest && e.target.closest('[data-app]');
        if (!a) return;
        var ic = $('.nb-icon[data-app="' + a.dataset.app + '"]');
        if (ic) ic.classList.toggle('nb-icon--called', on);
      };
    };
    paper.addEventListener('mouseover', hover(true));
    paper.addEventListener('mouseout', hover(false));
    paper.addEventListener('focusin', hover(true));
    paper.addEventListener('focusout', hover(false));
    return sheet;
  }

  // A photograph as the presses printed it: a screen of ink dots at 45 degrees,
  // each as large as the picture is dark there.
  var PLATE = "<svg class=\"nb-plate\" viewBox=\"0 0 200 470\" preserveAspectRatio=\"xMidYMax meet\" role=\"img\" aria-label=\"A gentleman in a checked jacket, drawn as a 1930s fashion plate\"><defs><filter id=\"pl-grain\" x=\"0\" y=\"0\" width=\"100%\" height=\"100%\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"1.6\" numOctaves=\"2\" seed=\"4\" result=\"n\"/><feColorMatrix in=\"n\" type=\"matrix\" values=\"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.9 1.55\" result=\"m\"/><feComposite in=\"SourceGraphic\" in2=\"m\" operator=\"in\"/></filter><filter id=\"pl-ink\" x=\"-5%\" y=\"-5%\" width=\"110%\" height=\"110%\"><feTurbulence type=\"fractalNoise\" baseFrequency=\".8\" numOctaves=\"1\" seed=\"2\" result=\"t\"/><feDisplacementMap in=\"SourceGraphic\" in2=\"t\" scale=\"1.2\"/></filter><pattern id=\"pl-check\" width=\"6.4\" height=\"6.4\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(42)\"><rect width=\"6.4\" height=\"6.4\" fill=\"#fff\"/><rect x=\"0\" y=\"0\" width=\"3\" height=\"3\" fill=\"#1a1a1a\"/><rect x=\"3\" y=\"0\" width=\".7\" height=\"6.4\" fill=\"#1a1a1a\" opacity=\".45\"/><rect x=\"0\" y=\"3\" width=\"6.4\" height=\".7\" fill=\"#1a1a1a\" opacity=\".45\"/></pattern><pattern id=\"pl-stripe\" width=\"3.4\" height=\"3.4\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(70)\"><rect width=\"3.4\" height=\"3.4\" fill=\"#fff\"/><rect width=\"1.5\" height=\"3.4\" fill=\"#1a1a1a\"/></pattern></defs><g filter=\"url(#pl-ink)\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><g filter=\"url(#pl-grain)\"><path d=\"M128 86 C152 90 166 106 170 132 L180 266 C172 276 162 272 152 282 C150 250 146 220 144 196 L140 120 Z\" fill=\"#55534e\"/></g><path d=\"M128 86 C152 90 166 106 170 132 L180 266 C172 276 162 272 152 282\" fill=\"none\" stroke=\"#1f1f1d\" stroke-width=\"1.1\"/><path d=\"M158 140 C160 180 163 222 166 262\" fill=\"none\" stroke=\"#1f1f1d\" stroke-width=\".8\" opacity=\".7\"/><g filter=\"url(#pl-grain)\"><path d=\"M92 222 L138 220 C146 300 152 380 156 448 L120 452 L114 320 L106 452 L76 448 C80 380 86 300 92 222 Z\" fill=\"#5d5b56\"/></g><path d=\"M92 222 C86 300 80 380 76 448 M138 220 C146 300 152 380 156 448\" fill=\"none\" stroke=\"#1f1f1d\" stroke-width=\"1\"/><path d=\"M114 248 L114 320 M130 236 C136 310 140 380 142 448 M98 238 C94 310 90 380 90 448\" fill=\"none\" stroke=\"#1f1f1d\" stroke-width=\".7\" opacity=\".55\"/><path d=\"M74 448 C72 455 80 459 94 459 C104 459 108 455 105 450 Z\" fill=\"#141414\"/><path d=\"M121 452 C120 458 128 462 142 462 C154 462 158 457 155 449 Z\" fill=\"#141414\"/><path d=\"M88 90 C100 84 120 82 136 86 C142 92 142 104 140 120 L138 172 C140 194 146 212 150 230 C130 238 104 238 84 232 C88 210 92 194 92 174 L88 120 C86 104 86 96 88 90 Z\" fill=\"url(#pl-check)\" stroke=\"#1f1f1d\" stroke-width=\"1.1\"/><path d=\"M110 84 L104 120 L114 146 L114 232 M122 84 L126 116 L114 146\" fill=\"none\" stroke=\"#141414\" stroke-width=\"1.1\"/><path d=\"M104 120 L110 86 L116 100 Z\" fill=\"#fff\" stroke=\"#141414\" stroke-width=\".9\"/><path d=\"M126 116 L122 86 L116 100 Z\" fill=\"#fff\" stroke=\"#141414\" stroke-width=\".9\"/><path d=\"M91 170 L139 168 L139 178 L91 180 Z\" fill=\"#141414\"/><path d=\"M118 169 L118 179 M122 169 L122 179 M126 169 L126 179\" stroke=\"#fff\" stroke-width=\".9\"/><path d=\"M90 94 C78 102 70 118 68 136 C68 146 74 150 82 146 C92 138 98 124 106 112 L110 104 C104 98 96 94 90 94 Z\" fill=\"url(#pl-check)\" stroke=\"#1f1f1d\" stroke-width=\"1.1\"/><path d=\"M102 114 C106 104 114 98 122 98 C127 100 125 107 118 111 C113 114 108 117 102 114 Z\" fill=\"#141414\"/><path d=\"M103 113 L99 118\" stroke=\"#141414\" stroke-width=\"2.4\"/><path d=\"M108 66 L118 66 L120 84 L106 84 Z\" fill=\"#fff\" stroke=\"#1f1f1d\" stroke-width=\".9\"/><path d=\"M100 44 C100 32 110 26 120 28 C128 30 130 40 128 52 C126 62 120 70 112 70 C106 70 102 64 100 58 C98 54 99 48 100 44 Z\" fill=\"#fff\" stroke=\"#1f1f1d\" stroke-width=\"1\"/><path d=\"M120 30 C130 32 132 44 128 54 C124 50 122 42 120 38 Z\" fill=\"#141414\"/><path d=\"M101 56 C104 66 110 71 116 70 C122 69 126 62 128 54 C124 60 120 62 116 62 C110 62 106 60 101 56 Z\" fill=\"#2a2a28\"/><path d=\"M104 41 L110 40\" stroke=\"#141414\" stroke-width=\"1\"/><path d=\"M105 45 L109 45\" stroke=\"#141414\" stroke-width=\"1.3\"/><path d=\"M100 47 L98 53 L101 54\" fill=\"none\" stroke=\"#1f1f1d\" stroke-width=\".8\"/><path d=\"M90 32 C100 29 122 27 138 30 C140 33 128 36 112 36 C100 36 92 35 90 32 Z\" fill=\"#141414\"/><path d=\"M102 31 C102 20 108 13 118 13 C127 13 131 20 130 30 Z\" fill=\"#3a3936\" stroke=\"#141414\" stroke-width=\"1\"/><path d=\"M102 27 L130 26 L130 30 L102 31 Z\" fill=\"url(#pl-stripe)\" stroke=\"#141414\" stroke-width=\".6\"/><path d=\"M114 14 C116 18 117 22 116 26\" fill=\"none\" stroke=\"#141414\" stroke-width=\".8\"/></g></svg>";

  function halftone(cv, src, fy) {
    var img = new Image();
    img.onload = function () {
      var draw = function () {
        var w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!w || !h) return;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        var ctx = cv.getContext('2d');
        var sc = document.createElement('canvas'); sc.width = w; sc.height = h;
        var sx = sc.getContext('2d');
        var s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
        sx.drawImage(img, (w - iw) / 2, (h - ih) * (fy == null ? 0.4 : fy), iw, ih);
        var px;
        try { px = sx.getImageData(0, 0, w, h).data; } catch (_) { px = null; }
        if (!px) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, (w - iw) / 2, (h - ih) * (fy == null ? 0.4 : fy), iw, ih);
          cv.classList.add('nb-ht--photo');
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#141414';
        var cell = 3.1, ang = Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(w, h);
        for (var u = -R; u < R; u += cell) {
          for (var v = -R; v < R; v += cell) {
            var x = u * ca - v * sa + w / 2, y = u * sa + v * ca + h / 2;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            var i = ((y | 0) * w + (x | 0)) * 4;
            var L = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
            var dark = Math.pow(1 - L, 1.3) * 1.05 - 0.05;
            if (dark <= 0.02) continue;
            ctx.beginPath();
            ctx.arc(x, y, Math.min(cell * 0.7, cell * 0.66 * Math.sqrt(dark)), 0, 6.283);
            ctx.fill();
          }
        }
      };
      draw();
      if (window.ResizeObserver) { var lw = 0, lh = 0; new ResizeObserver(function () { if (Math.abs(cv.clientWidth - lw) > 2 || Math.abs(cv.clientHeight - lh) > 2) { lw = cv.clientWidth; lh = cv.clientHeight; draw(); } }).observe(cv); }
    };
    img.onerror = function () { if (!img._again) { img._again = true; img.src = 'assets/avatar.jpg'; } };
    img.src = src;
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
    settings: function () { return { page: settingsPage }; },
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
  // Each app is a small pen drawing over a wash of its own colour, the way the
  // rest of the site is drawn. Hatching (class h) is the shading.
  var COLOR = {
    projects: '206,150,52', more: '206,150,52', research: '52,128,138', notes: '96,104,160',
    experience: '190,96,84', places: '72,122,186', languages: '134,100,180', games: '214,112,64',
    beverages: '146,100,62', learn: '104,146,62', about: '176,108,142', skills: '110,116,124', contact: '194,82,124'
  };
  var GLYPH = {
    music: '<path d="M10 46h34v8H10z"/><ellipse cx="27" cy="45" rx="14" ry="2.6"/><path d="M33 44l4-9 6-4"/><path d="M43 31q4-12 13-20M43 31q10 0 15-6"/><path d="M56 11q4 7 2 14"/>',
    projects: '<path d="M15 14L52 11.5 54.5 36"/><path d="M8 20L50 16.5 52.6 44 11 47.6Z"/><path d="M31 24.5L32.7 44.6"/><path d="M38.6 21.6L47.4 20.9 48.2 31.2 39.4 31.9Z"/><path class="h" d="M40.6 23.6l5-.4M40.8 26l5-.4M41 28.4l5-.4"/><path d="M34 34.5q2.5-2 5 0t5 0 5 0M34 37.8q2.5-2 5 0t5 0 5 0"/><path d="M14 30.5l13-1.1M14.3 35l13-1.1M14.6 39.5l9-.8"/><path class="h" d="M52 40l3 3M52.4 36.4l3 3"/>',
    research: '<path d="M13 32L43 18.5 46.6 26.3 16.6 39.8Z"/><path d="M43 18.5L49.5 15.4 53.4 23.4 46.6 26.3"/><path d="M13 32L8.5 34 10.4 38 16.6 39.8"/><path class="h" d="M20 36.8l1.4 2.2M24 35l1.4 2.2M28 33.2l1.4 2.2M32 31.4l1.4 2.2M36 29.6l1.4 2.2"/><path d="M30 33L21 56M30 33L39.5 56M30 33L30.5 56"/><path d="M50 6v4M48 8h4M57 13v3M55.5 14.5h3M41 6.5v2.4M39.8 7.7h2.4"/>',
    notes: '<path d="M7 45Q19 39 32 45Q45 39 57 45L57 22Q45 16 32 22Q19 16 7 22Z"/><path d="M32 22L32 45"/><path d="M11 27Q19 23.5 28 27M11 31Q19 27.5 28 31M11 35Q18 31.5 25 35M36 27Q44 23.5 53 27M36 31Q42 28 47 30.4"/><path d="M42 42C47 28 52 16 59 6C52 11 45 22 42 42Z"/><path class="h" d="M45 31l4-1.6M46.6 26l4-1.8M48.6 21l3.8-2"/><path class="h" d="M7 45l-1 3.5Q19 42.5 32 48.5Q45 42.5 58 48.5L57 45"/>',
    experience: '<path d="M9 24L32 11 55 24Z"/><circle cx="32" cy="19.2" r="2.4"/><path d="M11 24h42v4.5H11z"/><path d="M16 28.5v17M19.4 28.5v17M27.3 28.5v17M30.7 28.5v17M33.3 28.5v17M36.7 28.5v17M44.6 28.5v17M48 28.5v17"/><path class="h" d="M17.4 31v12M28.7 31v12M34.7 31v12M46 31v12"/><path d="M9 45.5h46v3.5H9zM6.5 49h51v3.5h-51z"/>',
    places: '<circle cx="32" cy="28" r="14.5"/><ellipse cx="32" cy="28" rx="6.2" ry="14.5"/><path d="M17.5 28h29M19.5 20.5Q32 24 44.5 20.5M19.5 35.5Q32 32 44.5 35.5"/><path d="M14 33A18.5 18.5 0 0 0 44.5 42.5"/><path d="M47.6 17A18.5 18.5 0 0 0 26 9.8"/><path d="M32 46.5v5.5M23 54.5q9-5 18 0"/><path class="h" d="M39 39.5l3-3M41.5 36.3l2.6-2.6M43.5 32.6l1.8-1.8"/>',
    languages: '<path d="M10 22Q32 14 54 22L54 38Q32 30 10 38Z"/><path d="M10 22q-6 2-4 8.4 2 5.2 4 7.6M54 22q6 2 4 8.4-2 5.2-4 7.6"/><path class="h" d="M6.5 27l3 1.2M6.8 31l3 1.2M57.5 27l-3 1.2M57.2 31l-3 1.2"/><text x="20.5" y="32.5" font-size="12.5" font-family="Cedarville Cursive, cursive" stroke="none" fill="currentColor">hola</text><path d="M22 46q4-2 8 0M34 46q4-2 8 0" class="h"/>',
    games: '<path d="M10 27L23 20.5 36 27 23 33.5Z"/><path d="M10 27v14.5L23 48V33.5M36 27v14.5L23 48"/><circle cx="23" cy="27" r="1.5"/><circle cx="15.5" cy="34" r="1.2"/><circle cx="18" cy="41" r="1.2"/><path class="h" d="M26 37.5l2.4 6.8M29.6 35.7l2.4 6.8M33 33.9l2.2 6.4"/><path d="M38 35.5L50.5 31 55 43.5 42.5 48Z"/><circle cx="44" cy="37" r="1.2"/><circle cx="49.5" cy="42.4" r="1.2"/><circle cx="46.8" cy="39.7" r="1.2"/>',
    beverages: '<path d="M14 29h31q0 15-15.5 15T14 29Z"/><path d="M45 32q8.5-.5 6.6 6.4-1.8 4.6-9.6 2.6"/><path d="M7 46Q32 54.5 57 46Q32 41.5 7 46Z"/><path class="h" d="M37 32.5l2.6 2.6M38.6 37l-.1.1M35 37.4l2 2M31.6 39.6l1.6 1.6"/><path d="M23 25q-3.5-4 0-8t0-8M30.5 25q-3.5-4 0-8t0-8M38 25q-3.5-4 0-7.4"/>',
    learn: '<path d="M9 41h44v7.5H9zM12 33.5h39V41H12z"/><path d="M14 41v7.5M48 33.5V41M17 33.5V41"/><path class="h" d="M43 43v3.6M46 43v3.6M40 43v3.6"/><path d="M31.5 33.5q-8.5 0-8.5-7.4 0-7.6 7.4-6.4 1.2 1 2.4 0 7.2-1.2 7.2 6.4 0 7.4-8.5 7.4Z"/><path d="M32 19.6q0-3.4 2.2-5.6M33.6 16.4q4.4-3.2 7.8-1-3.4 3.4-7.8 1Z"/><path class="h" d="M35.5 23.5q2.2 2.6 1.6 6"/>',
    about: '<ellipse cx="32" cy="32" rx="15" ry="19"/><ellipse cx="32" cy="32" rx="11.8" ry="15.6"/><path d="M24 14L32 5 40 14"/><circle cx="32" cy="27" r="5.4"/><path d="M22.5 45.5q1.6-10.4 9.5-10.4t9.5 10.4"/><path class="h" d="M35.6 25l1.8 1.8M36.2 28.6l1.4 1.4M38 38.6l1.8 2.2M36 39.5l1.6 2"/>',
    skills: '<path d="M17.5 33h29"/><path d="M19 33v14.5q0 4.5 4.5 4.5h17q4.5 0 4.5-4.5V33"/><path class="h" d="M39.5 37v11M42.4 36v12"/><path d="M24 33L17 9.5l2.8-1.2L27 32"/><path d="M17 9.5l1-3.2 1.8 2"/><path d="M33 33L34.5 12"/><path d="M34.5 12q-1.8-3 0-6.5 2 3.5 0 6.5Z"/><path d="M39.5 33L47 14.5"/><path d="M47 14.5q-.6-3.6 2.4-5.8.8 4-2.4 5.8Z"/><path d="M23 40h11M23 44h7" class="h"/>',
    contact: '<path d="M8 19h48v29H8z"/><path d="M8 19l24 17 24-17M8 48l18-15M56 48L38 33"/><circle class="seal" cx="32" cy="36" r="5.4"/><path d="M32 33.2l.9 1.9 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3Z"/><path class="h" d="M50 42l3 3M47 44.5l2.6 2.6"/>'
  };
  var APPS = [
    ['projects', 'Projects'], ['research', 'Research'], ['notes', 'Notes'],
    ['experience', 'Experience'], ['places', 'Places'], ['languages', 'Languages'],
    ['games', 'Games'], ['beverages', 'Beverages'], ['learn', 'Learn'],
    ['about', 'About'], ['skills', 'Skills'], ['contact', 'Contact']
  ];
  var NAME = { settings: 'Settings' }; APPS.forEach(function (a) { NAME[a[0]] = a[1]; });

  // a wash of watercolour: an uneven blob, a little darker at its edge
  function blobD(r, cx, cy, rad) {
    var n = 11, pts = [], a0 = r() * 6.28;
    for (var k = 0; k < n; k++) {
      var a = a0 + k / n * 6.283, rr = rad * (0.78 + r() * 0.38);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.86]);
    }
    var mid = function (p, q) { return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    var f = function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); };
    var d = 'M' + f(mid(pts[n - 1], pts[0]));
    for (var i = 0; i < n; i++) d += ' Q' + f(pts[i]) + ' ' + f(mid(pts[i], pts[(i + 1) % n]));
    return d + 'Z';
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
  function paperBack(el, seed, cls, letter) {
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
      var extra = '';
      if (letter) {
        // where a cup once stood
        var rr = rng(seed + 9), cx = w - (w < 500 ? 60 : 110), cy = h - (w < 500 ? 46 : 70), R0 = w < 500 ? 30 : 42, ring = [];
        for (var k = 0; k <= 40; k++) {
          var a = k / 40 * 6.283, q = R0 + (rr() - 0.5) * 1.6;
          ring.push((cx + Math.cos(a) * q).toFixed(1) + ' ' + (cy + Math.sin(a) * q * 0.96).toFixed(1));
        }
        extra += '<path class="nb-back__ring" d="M' + ring.join(' L') + '"/>' +
          '<path class="nb-back__ring nb-back__ring--2" d="M' + ring.slice(4, 26).join(' L') + '" transform="translate(2 1.5)"/>';
      }
      s.innerHTML = (letter ? '' : '<path class="nb-back__shadow" transform="translate(3 4)" d="' + d + '"/>') +
        '<path class="nb-back__fibre" transform="translate(.6 .9)" d="' + d + '"/>' +
        '<path class="nb-back__paper" d="' + d + '"/>' + extra;
      el.insertBefore(s, el.firstChild);
    };
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(el);
  }

  // an Art Deco tile: a square with its corners stepped in
  function tileD(x, y, s, n) {
    return 'M' + (x + n) + ' ' + y + 'H' + (x + s - n) + 'V' + (y + n) + 'H' + (x + s) + 'V' + (y + s - n) + 'H' + (x + s - n) + 'V' + (y + s) +
      'H' + (x + n) + 'V' + (y + s - n) + 'H' + x + 'V' + (y + n) + 'H' + (x + n) + 'Z';
  }
  // ---- the icons, drawn with the same pen as the castle (penwash's Pen) -------------------
  // Each one is a little ink sketch on a 100 x 100 sheet, standing on a ground line.
  var F = { cls: 'pw-ink pw-fine' };
  function star(pen, x, y, s) { pen.line(x - s, y, x + s, y, F); pen.line(x, y - s, x, y + s, F); }
  function ellipse(P, cx, cy, rx, ry, a0, a1) { return P.ring(cx, cy, rx, ry, 24, a0, a1); }
  var PEN_ICON = {
    blank: function () {},
    music: function (pen, r, P) {      // a gramophone, its horn open to the sky
      pen.line(6, 90, 94, 90);
      pen.rect(16, 68, 52, 20);
      pen.line(20, 74, 64, 74, F);
      pen.line(22, 88, 22, 92); pen.line(62, 88, 62, 92);
      pen.path(P.ring(42, 66, 23, 4.2, 26));
      pen.path(P.ring(42, 66, 4, 1, 10), F);
      pen.path([[58, 66], [60, 56], [56, 48]]);
      pen.path([[54, 50], [60, 42], [66, 32], [70, 18]]);
      pen.path([[58, 52], [68, 46], [80, 38], [92, 34]]);
      pen.path(P.ring(82, 25, 11.5, 10.5, 26));
      pen.line(60, 46, 77, 29, F); pen.line(63, 40, 72, 22, F); pen.line(64, 47, 86, 33, F);
      pen.line(20, 36, 20, 22); pen.path(P.ring(17.5, 36.5, 3, 2.2, 12)); pen.line(20, 22, 27, 25, F);
      pen.line(32, 30, 32, 18); pen.line(40, 28, 40, 16); pen.line(32, 18, 40, 16);
      pen.path(P.ring(29.5, 30.5, 3, 2.2, 12)); pen.path(P.ring(37.5, 28.5, 3, 2.2, 12));
    },
    projects: function (pen, r, P) {   // a workshop with a smoking chimney
      pen.line(6, 90, 94, 90);
      pen.rect(20, 54, 46, 36);
      pen.stones(20, 54, 46, 36, 8);
      pen.gable(20, 54, 46, 22);
      pen.rect(54, 30, 7, 16);
      pen.scribble(66, 18, 9, 5, 2, 1.4);
      pen.window(27, 62, 9, 11, 'square');
      pen.rect(44, 70, 10, 20, F);
      pen.tree(82, 90, 44);
    },
    research: function (pen, r, P) {   // an observatory under the stars
      pen.line(6, 90, 94, 90);
      pen.rect(28, 58, 44, 32);
      pen.bricks(28, 58, 44, 32);
      pen.path(ellipse(P, 50, 58, 23, 22, Math.PI, Math.PI * 2), { tremor: 0.2 });
      pen.line(46, 37, 50, 58, F); pen.line(54, 37, 52, 58, F);
      pen.path([[50, 46], [80, 22], [83, 26], [53, 50]], { tremor: 0.15 });
      pen.window(44, 72, 10, 18, 'arch');
      star(pen, 16, 22, 4); star(pen, 88, 10, 3); star(pen, 70, 8, 2);
    },
    notes: function (pen, r, P) {      // an open notebook and a quill
      pen.path([[8, 80], [28, 72], [50, 78]], { tremor: 0.2 });
      pen.path([[50, 78], [72, 72], [92, 80]], { tremor: 0.2 });
      pen.path([[8, 80], [8, 44], [28, 38], [50, 44], [72, 38], [92, 44], [92, 80]], { tremor: 0.3 });
      pen.line(50, 44, 50, 78);
      for (var y = 50; y < 72; y += 5) { pen.line(14, y + 1, 44, y - 1, F); if (y < 62) pen.line(56, y - 1, 86, y + 1, F); }
      pen.path([[64, 70], [74, 46], [86, 16]], { tremor: 0.2 });
      pen.path([[74, 46], [70, 34], [80, 14], [86, 16], [84, 32], [74, 46]], { tremor: 0.25 });
      for (var t = 0; t < 6; t++) pen.line(75 + t * 1.6, 42 - t * 4.5, 81 + t * 0.6, 40 - t * 4.5, F);
    },
    experience: function (pen, r, P) { // a hall of columns on its steps
      pen.line(6, 90, 94, 90); pen.line(12, 85, 88, 85); pen.line(16, 80, 84, 80);
      for (var i = 0; i < 4; i++) {
        var x = 23 + i * 16;
        pen.line(x, 46, x, 80); pen.line(x + 6, 46, x + 6, 80);
        pen.line(x + 3, 48, x + 3, 78, F);
        pen.line(x - 2, 46, x + 8, 46, F);
      }
      pen.rect(16, 38, 68, 8);
      pen.gable(16, 38, 68, 18);
      pen.flag(50, 20, 10, 1);
    },
    places: function (pen, r, P) {     // a balloon over the hills
      pen.path(ellipse(P, 50, 34, 24, 26, Math.PI * 0.82, Math.PI * 2.18), { tremor: 0.2 });
      pen.path([[30, 49], [44, 70]], { tremor: 0.1 }); pen.path([[70, 49], [56, 70]], { tremor: 0.1 });
      pen.path([[50, 8], [40, 30], [44, 70]], F); pen.path([[50, 8], [60, 30], [56, 70]], F);
      pen.path(ellipse(P, 50, 36, 24, 4, 0, Math.PI), F);
      pen.rect(43, 70, 14, 9); pen.planks(43, 70, 14, 9, 3.5, false);
      pen.path([[4, 92], [20, 84], [36, 88], [56, 80], [76, 86], [96, 82]], { tremor: 0.3 });
      pen.bird(84, 22, 4); pen.bird(14, 30, 3.5);
    },
    languages: function (pen, r, P) {  // a signpost pointing three ways
      pen.line(48, 92, 48, 14); pen.line(53, 92, 53, 16);
      pen.path([[18, 22], [62, 22], [70, 28], [62, 34], [18, 34], [18, 22]], { tremor: 0.15 });
      pen.path([[86, 42], [36, 42], [28, 48], [36, 54], [86, 54], [86, 42]], { tremor: 0.15 });
      pen.path([[22, 62], [66, 62], [74, 68], [66, 74], [22, 74], [22, 62]], { tremor: 0.15 });
      pen.path([[24, 29], [30, 26], [34, 30], [40, 26], [46, 29], [54, 27]], F);
      pen.path([[40, 49], [48, 46], [54, 50], [62, 46], [72, 49], [80, 47]], F);
      pen.path([[28, 69], [36, 66], [42, 70], [50, 66], [58, 69]], F);
      pen.path([[30, 92], [70, 92]], { tremor: 0.3 });
      for (var g = 0; g < 7; g++) pen.line(36 + g * 5, 92, 34 + g * 5 + r() * 3, 86 + r() * 2, F);
    },
    games: function (pen, r, P) {      // a castle rook, as on the board
      pen.line(14, 90, 86, 90);
      pen.rect(24, 80, 52, 10);
      pen.path([[32, 80], [36, 40], [64, 40], [68, 80]], { tremor: 0.2 });
      pen.bricks(36, 44, 28, 34);
      pen.rect(28, 30, 44, 10);
      pen.path([[28, 30], [28, 18], [36, 18], [36, 24], [46, 24], [46, 18], [54, 18], [54, 24], [64, 24], [64, 18], [72, 18], [72, 30]], { tremor: 0.15 });
      pen.window(46, 52, 8, 14, 'arch');
      pen.flag(50, 18, 12, 1);
    },
    beverages: function (pen, r, P) {  // a teacup, steaming
      pen.path(ellipse(P, 50, 84, 36, 6), { tremor: 0.15 });
      pen.path(ellipse(P, 50, 84, 16, 2.5), F);
      pen.path(ellipse(P, 50, 52, 26, 5), { tremor: 0.15 });
      pen.path([[24, 52], [28, 70], [40, 80], [60, 80], [72, 70], [76, 52]], { tremor: 0.2 });
      pen.path(ellipse(P, 80, 62, 8, 9, -Math.PI * 0.6, Math.PI * 0.6), { tremor: 0.15 });
      pen.hatch(60, 56, 12, 20, 3, 0.8);
      for (var s = 0; s < 3; s++) {
        var x = 38 + s * 12, pts = [];
        for (var k = 0; k <= 6; k++) pts.push([x + Math.sin(k * 1.2 + s) * 3, 44 - k * 5]);
        pen.path(pts, F);
      }
    },
    learn: function (pen, r, P) {      // a schoolhouse with its bell tower
      pen.line(6, 90, 94, 90);
      pen.rect(14, 58, 72, 32);
      pen.planks(14, 58, 72, 32, 5, true);
      pen.gable(14, 58, 72, 16);
      pen.rect(42, 28, 16, 16);
      pen.window(46, 31, 8, 10, 'arch');
      pen.cone(40, 28, 20, 18, 1);
      pen.window(20, 64, 9, 11, 'square'); pen.window(71, 64, 9, 11, 'square');
      pen.rect(45, 72, 10, 18, F);
    },
    about: function (pen, r, P) {      // a portrait hung on a nail
      pen.line(50, 8, 32, 22, F); pen.line(50, 8, 68, 22, F);
      pen.path(ellipse(P, 50, 54, 30, 38), { tremor: 0.2 });
      pen.path(ellipse(P, 50, 54, 25, 33), F);
      pen.path(ellipse(P, 50, 46, 9, 11), { tremor: 0.2 });
      pen.path([[30, 82], [36, 66], [50, 60], [64, 66], [70, 82]], { tremor: 0.2 });
      pen.hatch(28, 26, 12, 40, 3.2, 0.9);
      pen.hatch(60, 26, 12, 40, 3.2, 0.9);
    },
    skills: function (pen, r, P) {     // a jar of brushes and pens
      pen.path([[30, 50], [30, 86], [34, 90], [66, 90], [70, 86], [70, 50]], { tremor: 0.2 });
      pen.path(ellipse(P, 50, 50, 20, 4), { tremor: 0.15 });
      pen.hatch(56, 56, 12, 32, 3, 0.8);
      pen.line(40, 50, 30, 14); pen.fill([[30, 14], [27, 6], [33, 12]]);
      pen.line(50, 50, 52, 10); pen.path([[52, 10], [49, 4], [55, 4], [52, 10]], { tremor: 0.1 });
      pen.line(58, 50, 74, 18); pen.fill([[74, 18], [79, 10], [76, 20]]);
      pen.line(46, 50, 42, 22, F);
    },
    contact: function (pen, r, P) {    // a letter, sealed, and a bird to carry it
      pen.rect(12, 44, 76, 46);
      pen.path([[12, 44], [50, 72], [88, 44]], { tremor: 0.2 });
      pen.line(12, 90, 40, 66, F); pen.line(88, 90, 60, 66, F);
      pen.rect(70, 50, 12, 14, F);
      pen.fill(P.ring(50, 72, 5, 5, 10), { cls: 'pw-hue-fill' });
      pen.bird(30, 22, 6); pen.bird(48, 14, 4);
    }
  };
  // the home button: a round seal with a small castle on it
  PEN_ICON.seal = function (pen, r, P) {
    pen.path(P.ring(30, 30, 27, 27, 40), { tremor: 0.15 });
    pen.path(P.ring(30, 30, 23.5, 23.5, 36), F);
    pen.line(14, 42, 46, 42, F);
    pen.rect(25, 24, 10, 18);
    pen.window(28, 32, 4, 7, 'arch');
    pen.cone(24, 24, 12, 11, 1);
    pen.rect(17, 31, 7, 11, F); pen.cone(16, 31, 9, 7, 0);
    pen.rect(36, 31, 7, 11, F); pen.cone(35, 31, 9, 7, 0);
  };
  function penIcon(key, seed, vb) {
    var P = window.pwPen;
    if (!P || !PEN_ICON[key]) return null;
    var r = P.rng(seed), svg = P.svgEl(vb || '0 0 100 100', 'nb-ink');
    if (vb) { PEN_ICON[key](new P.Pen(svg, r), r, P); return svg; }
    var tile = new P.Pen(svg, r), j = function () { return (r() - 0.5) * 3.2; };
    var c = [[4 + j(), 5 + j()], [96 + j(), 4 + j()], [95 + j(), 96 + j()], [5 + j(), 95 + j()]];
    for (var k = 0; k < 4; k++) tile.line(c[k][0], c[k][1], c[(k + 1) % 4][0], c[(k + 1) % 4][1], { tremor: 0.7 });
    tile.line(c[0][0] + 4, c[0][1] + 4.5, c[1][0] - 4, c[1][1] + 4, { cls: 'pw-ink pw-fine', tremor: 0.5 });
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(15 14) scale(.7)');
    svg.appendChild(g);
    var pen = new P.Pen(g, r);
    pen.n = tile.n;
    PEN_ICON[key](pen, r, P);
    return svg;
  }
  // a spot drawing from the site's own sketchbook, scaled into whatever space is left;
  // drawn once the pen (penwash, which loads after this file) is on the page
  function spot(seed, kind) {
    var box = make('div', 'nb-spot');
    box.setAttribute('aria-hidden', 'true');
    box.dataset.seed = seed; box.dataset.kind = kind;
    return box;
  }
  function inkUp() {
    var P = window.pwPen;
    if (!P || inkUp.done) return;
    inkUp.done = true;
    $$('.nb-icon').forEach(function (b, i) { inkIcon(b, 11 + i * 7); });
    var seal = $('.nb-seal'), sv = penIcon('seal', 9, '0 0 60 60');
    if (seal && sv) seal.appendChild(sv);
    var cut = $('.nb-cut'), sc = penIcon('research', 5);
    if (cut && sc) { cut.innerHTML = ''; cut.appendChild(sc); }
    $$('.nb-spot').forEach(function (box) {
      var v = P.vignette(+box.dataset.seed, box.dataset.kind), svg = $('svg', v);
      if (svg) svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
      box.appendChild(v);
    });
  }

  function icon(key, label, i) {
    var b = make('button', 'nb-icon');
    b.type = 'button';
    b.dataset.app = key;
    b.style.setProperty('--i', i);
    b.innerHTML = '<svg class="nb-icon__art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
      '<g class="nb-icon__glyph">' + GLYPH[key] + '</g></svg>' +
      '<span class="nb-icon__label">' + label + '</span>';
    return b;
  }
  function gearD(cx, cy, r1, r2, n) {
    var d = '';
    for (var k = 0; k < n * 2; k++) {
      var a0 = (k / (n * 2)) * 6.283, a1 = ((k + 1) / (n * 2)) * 6.283, r = k % 2 ? r1 : r2;
      d += (k ? 'L' : 'M') + (cx + Math.cos(a0 + 0.06) * r).toFixed(2) + ' ' + (cy + Math.sin(a0 + 0.06) * r).toFixed(2) +
        'L' + (cx + Math.cos(a1 - 0.06) * r).toFixed(2) + ' ' + (cy + Math.sin(a1 - 0.06) * r).toFixed(2);
    }
    return d + 'Z';
  }
  var DOCK = {
    lock: '<path d="M6 11h12v9H6z"/><path d="M8.6 11V8a3.4 3.4 0 0 1 6.8 0v3"/><path d="M12 14.4v2.4"/>',
    home: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    settings: '<path d="' + gearD(12, 12, 6.4, 8.6, 8) + '"/><circle cx="12" cy="12" r="2.6"/>'
  };

  // ---- the tablet's own settings, kept in this browser -------------------------------------
  var THEMES = [['paper', 'Paper'], ['ivory', 'Ivory'], ['night', 'Night'], ['blueprint', 'Blueprint']];
  var INKS = [['theme', 'As the paper'], ['red', 'Vermilion'], ['blue', 'Ultramarine'], ['green', 'Viridian'], ['gold', 'Ochre']];
  var PREF_KEY = 'nb-tablet-prefs';
  var DEFAULTS = { theme: 'paper', clock: 'numerals', hours: '12', picture: 'castle', autolock: '0', ink: 'theme', size: 'm', sound: 'off', hidden: '' };
  var prefs = {};
  for (var dk in DEFAULTS) prefs[dk] = DEFAULTS[dk];
  try { var saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); for (var pk in saved) if (pk in prefs) prefs[pk] = String(saved[pk]); } catch (_) {}
  if (!/^(paper|ivory|night|blueprint)$/.test(prefs.theme)) prefs.theme = 'paper';
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) {} }
  function hiddenApps() { return prefs.hidden ? prefs.hidden.split(',') : []; }
  function applyPrefs() {
    if (!tablet) return;
    tablet.dataset.theme = prefs.theme;
    tablet.dataset.clock = prefs.clock;
    tablet.dataset.picture = prefs.picture;
    tablet.dataset.ink = prefs.ink;
    tablet.dataset.size = prefs.size;
    if (tablet._clock) tablet._clock();
  }

  // the turn of a page, made from a breath of noise; only when the reader asks for sound
  var audio = null;
  function rustle() {
    if (prefs.sound !== 'on') return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var n = Math.floor(audio.sampleRate * 0.22), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) { var t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * (0.6 + 0.4 * Math.sin(t * 40)); }
      var src = audio.createBufferSource(); src.buffer = buf;
      var bp = audio.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
      var g = audio.createGain(); g.gain.value = 0.16;
      src.connect(bp); bp.connect(g); g.connect(audio.destination); src.start();
    } catch (_) {}
  }

  function settingsPage() {
    var f = document.createDocumentFragment();
    var chapter = function (n, title) {
      var c = make('p', 'nb-set__ch');
      c.innerHTML = '<span class="nb-set__n">' + n + '</span>' + title;
      f.appendChild(c);
    };
    var group = function (title, key, options, kind) {
      var g = make('div', 'nb-set');
      var h = make('p', 'nb-set__h', title);
      h.id = 'nb-set-' + key;
      g.appendChild(h);
      var row = make('div', kind === 'swatch' ? 'nb-swatches' : kind === 'ink' ? 'nb-inks' : 'nb-seg');
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-labelledby', h.id);
      options.forEach(function (o) {
        var b = make('button', kind === 'swatch' ? 'nb-swatch' : kind === 'ink' ? 'nb-inkpot' : 'nb-seg__b');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(prefs[key] === o[0]));
        if (kind === 'swatch') {
          b.dataset.theme = o[0];
          b.innerHTML = '<span class="nb-swatch__case"><span class="nb-swatch__screen"><span class="nb-swatch__ink"></span></span></span><span class="nb-swatch__name">' + o[1] + '</span>';
        } else if (kind === 'ink') {
          b.dataset.ink = o[0];
          b.innerHTML = '<span class="nb-inkpot__blot" aria-hidden="true"></span><span class="nb-inkpot__name">' + o[1] + '</span>';
        } else b.textContent = o[1];
        b.addEventListener('click', function () {
          prefs[key] = o[0];
          savePrefs(); applyPrefs();
          $$('button', row).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
          if (key === 'sound') rustle();
        });
        row.appendChild(b);
      });
      g.appendChild(row);
      f.appendChild(g);
    };

    // the owner's card at the top, like the plate inside a book's cover
    var card = make('div', 'nb-owner');
    card.innerHTML = '<span class="nb-owner__seal" aria-hidden="true"></span>' +
      '<span class="nb-owner__txt"><span class="nb-owner__k">This almanac belongs to</span>' +
      '<span class="nb-owner__name">Saumya Lahera</span>' +
      '<span class="nb-owner__ed">Reader’s edition · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></span>';
    var sv = penIcon('seal', 9, '0 0 60 60');
    if (sv) $('.nb-owner__seal', card).appendChild(sv);
    f.appendChild(card);

    chapter('I', 'Appearance');
    group('Paper', 'theme', THEMES, 'swatch');
    group('Ink', 'ink', INKS, 'ink');
    group('Type', 'size', [['s', 'Small'], ['m', 'Regular'], ['l', 'Large']]);

    chapter('II', 'Lock screen');
    group('Clock', 'clock', [['numerals', 'Numerals'], ['dial', 'Dial']]);
    group('Hours', 'hours', [['12', '12-hour'], ['24', '24-hour']]);
    group('Picture', 'picture', [['castle', 'The castle'], ['plain', 'Plain']]);
    group('Lock by itself after', 'autolock', [['0', 'Never'], ['1', '1 min'], ['5', '5 min']]);

    chapter('III', 'Sound');
    group('A page turns when an app opens', 'sound', [['off', 'Silent'], ['on', 'Rustle']]);

    chapter('IV', 'About this almanac');
    var about = make('dl', 'nb-about');
    var upd = txt($('.footer-websiteupdate')).replace(/^last updated:?\s*/i, '').replace(/\s*via the app\s*$/i, '');
    var um = upd.match(/^([A-Za-z]{3,9})\.?,?\s*(\d{1,2}),?\s+(\d{4})/);
    if (um) upd = um[2] + ' ' + um[1].charAt(0).toUpperCase() + um[1].slice(1).toLowerCase() + ' ' + um[3];
    [['Owner', 'Saumya Lahera'], ['Apps', String(shownApps().length) + (pager && pager.children.length > 1 ? ', over ' + pager.children.length + ' pages' : '')],
     ['Paper', NAME_OF(THEMES, prefs.theme)], ['Pages last set', upd || 'Today']].forEach(function (r) {
      about.appendChild(make('dt', '', r[0]));
      about.appendChild(make('dd', r[0] === 'Apps' ? 'nb-about__apps' : '', r[1]));
    });
    f.appendChild(about);

    var acts = make('div', 'nb-set__acts');
    var lockNow = make('button', 'nb-btn', 'Lock now');
    lockNow.type = 'button';
    lockNow.addEventListener('click', function () { if (tablet._lock) tablet._lock(); });
    var reset = make('button', 'nb-btn nb-btn--quiet', 'Restore the defaults');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      for (var k in DEFAULTS) prefs[k] = DEFAULTS[k];
      savePrefs(); applyPrefs();
      openApp('settings', true);
    });
    acts.appendChild(lockNow); acts.appendChild(reset);
    f.appendChild(acts);
    f.appendChild(make('p', 'nb-intro nb-set__note', 'These settings stay in this browser.'));
    return f;
  }
  function NAME_OF(list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return key; }

  function dialSVG() {
    var t = '';
    for (var k = 0; k < 60; k++) {
      var a = k / 60 * 6.283, big = k % 5 === 0, r0 = big ? 78 : 82, r1 = 86;
      t += '<path d="M' + (100 + Math.sin(a) * r0).toFixed(1) + ' ' + (100 - Math.cos(a) * r0).toFixed(1) + 'L' + (100 + Math.sin(a) * r1).toFixed(1) + ' ' + (100 - Math.cos(a) * r1).toFixed(1) + '" class="' + (big ? 'nb-dial__big' : 'nb-dial__tick') + '"/>';
    }
    var rays = '';
    for (var j = 0; j < 24; j++) {
      var b = j / 24 * 6.283;
      rays += '<path d="M' + (100 + Math.sin(b) * 16).toFixed(1) + ' ' + (100 - Math.cos(b) * 16).toFixed(1) + 'L' + (100 + Math.sin(b) * 56).toFixed(1) + ' ' + (100 - Math.cos(b) * 56).toFixed(1) + '"/>';
    }
    var num = [['XII', 100, 40], ['III', 162, 106], ['VI', 100, 170], ['IX', 38, 106]].map(function (n) {
      return '<text x="' + n[1] + '" y="' + n[2] + '" text-anchor="middle">' + n[0] + '</text>';
    }).join('');
    return '<svg class="nb-dial" viewBox="0 0 200 200" aria-hidden="true">' +
      '<circle cx="100" cy="100" r="94" class="nb-dial__ring"/><circle cx="100" cy="100" r="89" class="nb-dial__ring nb-dial__ring--thin"/>' +
      '<g class="nb-dial__rays">' + rays + '</g>' + t + '<g class="nb-dial__num">' + num + '</g>' +
      '<g class="nb-dial__h"><path d="M100 112L96.6 100 100 58 103.4 100Z"/><path d="M100 70l-5 -7 5 -9 5 9Z"/></g>' +
      '<g class="nb-dial__m"><path d="M100 116L98.4 100 100 30 101.6 100Z"/></g>' +
      '<g class="nb-dial__s"><path d="M100 122V26"/><circle cx="100" cy="100" r="3.2"/></g></svg>';
  }

  var tablet, screen, home, appView, appTitle, appBody, current = null, stack = [];
  // ---- apps of my own, and the music shelf, both set from the Leabhar app ---------------------
  // index.html hands over data.json as window.__PORTFOLIO_DATA__ and a 'portfolio:data' event.
  var XAPPS = {};          // key -> the app's record from data.json
  var MUSIC = null;        // the music shelf, when there is one
  var BUILTIN = APPS.length;
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'; }
  function safeURL(u) { u = String(u || '').trim(); return /^(https?:|mailto:|data:image\/|assets\/|\.\/|\/)/i.test(u) || /^[\w.-]+\/[\w./-]+$/.test(u) ? u : ''; }
  function paras(box, text) {
    String(text || '').split(/\n\s*\n/).forEach(function (p) { if (p.trim()) box.appendChild(make('p', 'nb-x__p', p.trim())); });
  }
  function outLink(label, href, cls) {
    var a = make('a', cls || 'nb-btn', label);
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }

  // the icon: my own picture on a hand-drawn tile, or one of the pen drawings
  function customIcon(key, a, i) {
    var href = a.kind === 'link' ? safeURL(a.link) : '';
    var b = make(href ? 'a' : 'button', 'nb-icon nb-icon--x');
    if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button';
    b.dataset.app = key;
    b.dataset.glyph = PEN_ICON[a.glyph] ? a.glyph : 'notes';
    b.style.setProperty('--i', i);
    var pic = safeURL(a.icon);
    if (pic) b.dataset.pic = pic;
    b.innerHTML = '<svg class="nb-icon__art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
      (pic ? '' : '<g class="nb-icon__glyph">' + (GLYPH[b.dataset.glyph] || '') + '</g>') + '</svg>' +
      '<span class="nb-icon__label"></span>';
    $('.nb-icon__label', b).textContent = a.name || 'App';
    if (a.kind === 'link') b.setAttribute('aria-label', (a.name || 'App') + ' (opens in a new tab)');
    if (pic) placePic(b.firstChild, pic, '0 0 64 64', 7, 7, 50);
    if (window.pwPen && inkUp.done) inkIcon(b, 11 + i * 7);
    return b;
  }
  function placePic(svg, pic, vb, x, y, s) {
    var NSs = 'http://www.w3.org/2000/svg', id = 'nbx' + Math.random().toString(36).slice(2, 8);
    var cp = document.createElementNS(NSs, 'clipPath'); cp.id = id;
    var rr = document.createElementNS(NSs, 'rect');
    rr.setAttribute('x', x); rr.setAttribute('y', y); rr.setAttribute('width', s); rr.setAttribute('height', s); rr.setAttribute('rx', s * 0.06);
    cp.appendChild(rr); svg.appendChild(cp);
    var im = document.createElementNS(NSs, 'image');
    im.setAttribute('href', pic);
    im.setAttribute('x', x); im.setAttribute('y', y); im.setAttribute('width', s); im.setAttribute('height', s);
    im.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    im.setAttribute('clip-path', 'url(#' + id + ')');
    im.setAttribute('class', 'nb-x__pic');
    svg.appendChild(im);
  }
  // swap a placeholder icon for the pen-drawn one
  function inkIcon(b, seed) {
    var pic = b.dataset.pic, key = b.dataset.glyph || b.dataset.app;
    var ink = penIcon(pic ? 'blank' : key, seed), old = $('.nb-icon__art', b);
    if (!ink || !old) return;
    if (pic) placePic(ink, pic, '0 0 100 100', 15, 14, 70);
    ink.setAttribute('class', 'nb-icon__art nb-ink');
    b.replaceChild(ink, old);
  }

  function customPage(a) {
    return function () {
      var box = make('div', 'nb-x');
      var pic = safeURL(a.image), link = safeURL(a.link);
      if (a.kind === 'appstore') {
        box.classList.add('nb-x--store');
        var head = make('div', 'nb-x__store');
        var ic = make('span', 'nb-x__storeicon');
        if (safeURL(a.icon)) { var im = make('img'); im.alt = ''; im.src = safeURL(a.icon); ic.appendChild(im); }
        else { var sv = penIcon(PEN_ICON[a.glyph] ? a.glyph : 'notes', 23); if (sv) ic.appendChild(sv); }
        head.appendChild(ic);
        var t = make('div', 'nb-x__storetxt');
        t.appendChild(make('h3', 'nb-x__name', a.name || 'App'));
        if (a.title) t.appendChild(make('p', 'nb-x__tag', a.title));
        head.appendChild(t);
        box.appendChild(head);
        if (link) box.appendChild(outLink('View on the App Store ↗', link, 'nb-btn nb-x__get'));
        paras(box, a.text);
        return box;
      }
      if (pic) { var p = make('img', 'nb-x__img'); p.alt = ''; p.loading = 'lazy'; p.onerror = function () { p.remove(); }; p.src = pic; box.appendChild(p); }
      box.appendChild(make('h3', 'nb-x__title', a.title || a.name || ''));
      paras(box, a.text);
      if (link) box.appendChild(outLink((a.link_label || 'Read more') + ' ↗', link));
      return box;
    };
  }

  // ---- the music shelf -------------------------------------------------------------------------
  function embedOf(u) {
    var m;
    u = String(u || '').trim();
    if ((m = u.match(/^https?:\/\/(?:embed\.)?music\.apple\.com\/(.+)$/i))) return { src: 'https://embed.music.apple.com/' + m[1], h: /[?&]i=|\/song\//.test(u) ? 175 : 450, who: 'Apple Music' };
    if ((m = u.match(/^https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i))) return { src: 'https://www.youtube-nocookie.com/embed/' + m[1], h: 210, who: 'YouTube' };
    if ((m = u.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/i))) return { src: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2], h: m[1] === 'track' ? 152 : 380, who: 'Spotify' };
    return null;
  }
  var player = null, playing = -1;
  function tracks() { return (MUSIC && MUSIC.tracks || []).filter(function (t) { return t && (safeURL(t.audio) || safeURL(t.link)); }); }
  function howOf(t) {
    var link = safeURL(t.link);
    if (t.open === 'link' && link) return 'link';
    if (safeURL(t.audio)) return 'audio';
    if (embedOf(link)) return 'embed';
    return link ? 'link' : 'audio';
  }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function nowPlaying() {
    var np = $('.nb-np', tablet), list = tracks(), t = list[playing];
    if (np) {
      np.hidden = !t;
      if (t) {
        $('.nb-np__t', np).textContent = t.title + (t.artist ? ' · ' + t.artist : '');
        $('.nb-np__b', np).textContent = player && !player.paused ? 'Pause' : 'Play';
      }
    }
    $$('.nb-song[data-how="audio"]', tablet).forEach(function (row) {
      var on = +row.dataset.i === playing;
      row.classList.toggle('nb-song--on', on);
      $('.nb-song__b', row).textContent = on && player && !player.paused ? '❚❚' : '▶';
      $('.nb-song__b', row).setAttribute('aria-label', (on && player && !player.paused ? 'Pause ' : 'Play ') + row.dataset.title);
      var bar = $('.nb-song__bar i', row);
      if (bar) bar.style.width = on && player && player.duration ? (player.currentTime / player.duration * 100).toFixed(2) + '%' : '0';
      var tm = $('.nb-song__time', row);
      if (tm) tm.textContent = on && player ? fmt(player.currentTime) + ' / ' + fmt(player.duration) : '';
    });
  }
  function play(i) {
    var list = tracks();
    if (!list[i] || howOf(list[i]) !== 'audio') return;
    if (!player) {
      player = new Audio();
      player.preload = 'none';
      ['play', 'pause', 'timeupdate', 'loadedmetadata'].forEach(function (ev) { player.addEventListener(ev, nowPlaying); });
      player.addEventListener('ended', function () {
        var all = tracks();
        for (var k = playing + 1; k < all.length; k++) if (howOf(all[k]) === 'audio') { play(k); return; }
        playing = -1; nowPlaying();
      });
      player.addEventListener('error', function () { var r = $('.nb-song[data-i="' + playing + '"]', tablet); if (r) r.classList.add('nb-song--err'); });
    }
    if (i === playing) { if (player.paused) player.play().catch(function () {}); else player.pause(); return; }
    playing = i;
    player.src = safeURL(list[i].audio);
    player.play().catch(function () {});
    nowPlaying();
  }
  function musicPage() {
    var box = make('div', 'nb-music');
    if (MUSIC.intro) box.appendChild(make('p', 'nb-intro', MUSIC.intro));
    var pls = (MUSIC.playlists || []).filter(function (p) { return p.url; });
    if (pls.length) {
      box.appendChild(make('p', 'nb-set__ch', 'Playlists'));
      var ol = make('ol', 'nb-list nb-pl');
      pls.forEach(function (p, i) {
        var li = make('li'), e = embedOf(p.url);
        var row = make('button', 'nb-row');
        row.type = 'button';
        row.setAttribute('aria-expanded', 'false');
        row.appendChild(make('span', 'nb-row__n', (i < 9 ? '0' : '') + (i + 1)));
        var t = make('span', 'nb-row__t', p.title || 'Playlist');
        t.appendChild(make('span', 'nb-row__s', p.note || (e ? e.who : 'Opens in a new tab')));
        row.appendChild(t);
        row.appendChild(make('span', 'nb-row__go', e ? '+' : '↗'));
        li.appendChild(row);
        row.addEventListener('click', function () {
          if (!e) { window.open(p.url, '_blank', 'noopener'); return; }
          var open = row.getAttribute('aria-expanded') === 'true', fr = $('iframe', li);
          row.setAttribute('aria-expanded', String(!open));
          $('.nb-row__go', row).textContent = open ? '+' : '−';
          if (open) { if (fr) fr.remove(); return; }
          fr = make('iframe', 'nb-embed');
          fr.src = e.src; fr.height = e.h; fr.loading = 'lazy'; fr.title = (p.title || 'Playlist') + ' on ' + e.who;
          fr.setAttribute('allow', 'autoplay *; encrypted-media *; fullscreen *; clipboard-write');
          fr.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
          if (player && !player.paused) player.pause();
          li.appendChild(fr);
        });
        ol.appendChild(li);
      });
      box.appendChild(ol);
      box.appendChild(make('p', 'nb-x__fine', 'Previews play for everyone; whole songs when you’re signed in to Apple Music or Spotify.'));
    }
    var list = tracks();
    if (list.length) {
      box.appendChild(make('p', 'nb-set__ch', 'Songs'));
      var songs = make('ol', 'nb-songs');
      list.forEach(function (t, i) {
        var how = howOf(t), link = safeURL(t.link);
        var li = make('li', 'nb-song');
        li.dataset.i = i; li.dataset.title = t.title || 'Untitled'; li.dataset.how = how;
        var b;
        if (how === 'link') {
          b = outLink('↗', link, 'nb-song__b nb-song__b--out');
          b.setAttribute('aria-label', 'Open ' + (t.title || 'the song') + ' (new tab)');
        } else {
          b = make('button', 'nb-song__b', '▶');
          b.type = 'button';
          b.setAttribute('aria-label', 'Play ' + (t.title || 'the song'));
          if (how === 'audio') b.addEventListener('click', function () { play(i); });
          else b.addEventListener('click', function () { toggleEmbed(li, b, embedOf(link), t.title); });
        }
        li.appendChild(b);
        var tx = make('span', 'nb-song__txt');
        tx.appendChild(make('span', 'nb-song__t', t.title || 'Untitled'));
        if (t.artist) tx.appendChild(make('span', 'nb-song__a', t.artist));
        var bar = make('span', 'nb-song__bar'); bar.appendChild(make('i'));
        bar.addEventListener('click', function (ev) {
          if (playing !== i || !player || !player.duration) return;
          var r = bar.getBoundingClientRect();
          player.currentTime = (ev.clientX - r.left) / r.width * player.duration;
        });
        tx.appendChild(bar);
        li.appendChild(tx);
        li.appendChild(make('span', 'nb-song__time'));
        if (how === 'embed') tx.appendChild(make('span', 'nb-song__via', 'on ' + embedOf(link).who));
        if (how === 'link') tx.appendChild(make('span', 'nb-song__via', 'opens ' + (link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])));
        if (how === 'audio' && link) li.appendChild(outLink('↗', link, 'nb-song__out'));
        songs.appendChild(li);
      });
      box.appendChild(songs);
    }
    if (!pls.length && !list.length) box.appendChild(make('p', 'nb-intro', 'Nothing on the shelf yet.'));
    function toggleEmbed(li, b, e, title) {
      var fr = $('iframe', li);
      if (fr) { fr.remove(); b.textContent = '▶'; li.classList.remove('nb-song--on'); return; }
      $$('.nb-song iframe', box).forEach(function (f) { var r = f.closest('.nb-song'); f.remove(); r.classList.remove('nb-song--on'); $('.nb-song__b', r).textContent = '▶'; });
      if (player && !player.paused) player.pause();
      fr = make('iframe', 'nb-embed nb-embed--song');
      fr.src = e.src + (e.who === 'YouTube' ? '?autoplay=1' : ''); fr.height = e.h; fr.title = (title || 'Song') + ' on ' + e.who;
      fr.setAttribute('allow', 'autoplay *; encrypted-media *; fullscreen *; clipboard-write');
      if (e.who !== 'YouTube') fr.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
      else fr.setAttribute('allowfullscreen', '');
      li.appendChild(fr);
      li.classList.add('nb-song--on');
      b.textContent = '■';
    }
    setTimeout(nowPlaying, 0);
    return box;
  }

  function takeData(d) {
    if (!d || !tablet) return;
    homeIcons.filter(function (b) { return b.classList.contains('nb-icon--x'); }).forEach(function (b) { if (b.parentNode) b.parentNode.removeChild(b); });
    homeIcons = homeIcons.filter(function (b) { return !b.classList.contains('nb-icon--x'); });
    APPS.length = BUILTIN;
    XAPPS = {};
    var seen = {};
    var add = function (key, name, a) {
      APPS.push([key, name]);
      NAME[key] = name;
      homeIcons.push(customIcon(key, a, APPS.length - 1));
    };
    MUSIC = d.music && d.music.enabled !== false && ((d.music.playlists || []).length || (d.music.tracks || []).length) ? d.music : null;
    if (MUSIC) {
      DATA.music = function () { return { page: musicPage }; };
      add('music', 'Music', { name: 'Music', glyph: 'music' });
    }
    HIDDEN = {};
    (Array.isArray(d.tablet_hidden) ? d.tablet_hidden : []).forEach(function (k) { if (k) HIDDEN[String(k)] = 1; });
    (Array.isArray(d.tablet_apps) ? d.tablet_apps : []).forEach(function (a) {
      if (!a || !a.name || a.hidden === true) return;
      var key = 'x-' + slug(a.name);
      while (seen[key] || NAME[key] && !/^x-/.test(key)) key += '-';
      seen[key] = 1;
      XAPPS[key] = a;
      if (a.kind !== 'link') DATA[key] = (function (f) { return function () { return { page: f }; }; })(customPage(a));
      add(key, a.name, a);
    });
    layoutPages(true);
    spotIndex = null;
    applyPrefs();
    if (current === 'settings') openApp('settings', true);
  }


  // ---- the home screen in pages, swiped left and right ------------------------------------------
  var homeIcons = [], pager = null, dots = null, perPage = 0, recent = [], HIDDEN = {};
  function shown(key) { return !HIDDEN[key]; }
  function shownApps() { return APPS.filter(function (a) { return shown(a[0]); }); }
  function pageW() { return pager ? pager.clientWidth || 1 : 1; }
  function pageNow() { return pager ? Math.round(pager.scrollLeft / pageW()) : 0; }
  function goPage(i, instant) {
    if (!pager) return;
    var n = pager.children.length;
    i = Math.max(0, Math.min(n - 1, i));
    pager.scrollTo({ left: i * pageW(), behavior: instant || reduceMotion ? 'auto' : 'smooth' });
  }
  function paintDots() {
    if (!dots) return;
    var n = pager.children.length, at = pageNow();
    if (dots.children.length !== n) {
      dots.innerHTML = '';
      for (var k = 0; k < n; k++) {
        var d = make('button', 'nb-dot');
        d.type = 'button';
        d.setAttribute('aria-label', 'Page ' + (k + 1) + ' of ' + n);
        d.addEventListener('click', (function (j) { return function () { goPage(j); }; })(k));
        dots.appendChild(d);
      }
    }
    dots.hidden = n < 2;
    $$('.nb-dot', dots).forEach(function (d, k) { d.setAttribute('aria-current', String(k === at)); });
  }
  function layoutPages(force) {
    if (!pager) return;
    var vis = homeIcons.filter(function (b) { if (shown(b.dataset.app)) return true; if (b.parentNode) b.parentNode.removeChild(b); return false; });
    var h = pager.clientHeight, probe = vis[0];
    var rowH = probe && probe.offsetHeight ? probe.offsetHeight + 16 : 112;
    var rows = h ? Math.max(2, Math.min(5, Math.floor((h - 12 + 16) / rowH))) : 4;
    var per = rows * 3;
    if (!force && per === perPage && pager._count === vis.length) return;
    var at = pageNow();
    perPage = per; pager._count = vis.length;
    var pages = Math.max(1, Math.ceil(vis.length / per));
    var keep = [];
    for (var p = 0; p < pages; p++) {
      var g = pager.children[p] || make('div', 'nb-grid nb-page');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', 'Apps, page ' + (p + 1) + ' of ' + pages);
      vis.slice(p * per, (p + 1) * per).forEach(function (b, i) { b.style.setProperty('--i', i); g.appendChild(b); });
      keep.push(g);
    }
    while (pager.children.length > pages) pager.removeChild(pager.lastChild);
    keep.forEach(function (g) { if (!g.parentNode) pager.appendChild(g); });
    goPage(Math.min(at, pages - 1), true);
    paintDots();
  }
  function wirePager() {
    var raf = 0;
    pager.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(paintDots); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(function () { layoutPages(); goPage(pageNow(), true); }).observe(pager);
    // a mouse can drag the pages too, the way a finger does
    var x0 = 0, s0 = 0, dragging = false, down = false, eaten = false;
    pager.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragging = false; x0 = e.clientX; s0 = pager.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 6) { dragging = true; pager.classList.add('nb-dragging'); }
      if (dragging) pager.scrollLeft = s0 - dx;
    });
    window.addEventListener('pointerup', function (e) {
      if (!down) return;
      down = false;
      if (!dragging) return;
      var dx = e.clientX - x0, from = Math.round(s0 / pageW());
      eaten = true; setTimeout(function () { eaten = false; }, 0);
      pager.classList.remove('nb-dragging');
      goPage(dx < -pageW() * 0.12 ? from + 1 : dx > pageW() * 0.12 ? from - 1 : from);
    });
    pager.addEventListener('click', function (e) { if (eaten) { e.stopPropagation(); e.preventDefault(); } }, true);
    home.addEventListener('keydown', function (e) {
      if (!e.target.closest || !e.target.closest('.nb-pager')) return;
      if (e.key === 'PageDown') { e.preventDefault(); goPage(pageNow() + 1); }
      if (e.key === 'PageUp') { e.preventDefault(); goPage(pageNow() - 1); }
    });
  }

  // ---- spotlight: pull down on the home screen, or tap Search ------------------------------------
  var spotEl = null, spotIn = null, spotRes = null, spotIndex = null;
  function buildIndex() {
    var out = [];
    shownApps().forEach(function (a) {
      var key = a[0];
      if (MUSIC && key === 'music') {
        (MUSIC.playlists || []).forEach(function (p) { if (p.title) out.push({ key: key, title: p.title, sub: p.note || 'Playlist' }); });
        tracks().forEach(function (t, i) {
          var how = howOf(t);
          out.push({ key: key, title: t.title || 'Untitled', sub: t.artist || 'Song', act: how === 'audio' ? function () { play(i); } : how === 'link' ? function () { window.open(safeURL(t.link), '_blank'); } : null });
        });
        return;
      }
      if (XAPPS[key]) {
        var x = XAPPS[key];
        if (x.title && x.kind !== 'link') out.push({ key: key, title: x.title, sub: x.kind === 'appstore' ? 'App Store' : '' });
        return;
      }
      if (!DATA[key]) return;
      var d;
      try { d = DATA[key](); } catch (_) { return; }
      if (!d || !d.groups) return;
      d.groups.forEach(function (g) {
        (g.items || []).forEach(function (it) {
          if (it.title) out.push({ key: key, title: it.title, sub: it.sub || g.title || '', item: it.page ? it : null });
        });
      });
    });
    return out;
  }
  function marked(cls, text, q) {
    var el = make('span', cls), i = q ? text.toLowerCase().indexOf(q) : -1;
    if (i < 0) { el.textContent = text; return el; }
    el.appendChild(document.createTextNode(text.slice(0, i)));
    el.appendChild(make('mark', null, text.slice(i, i + q.length)));
    el.appendChild(document.createTextNode(text.slice(i + q.length)));
    return el;
  }
  function miniApp(key, q) {
    var b = make('button', 'nb-sp__app');
    b.type = 'button';
    var src = homeIcons.filter(function (x) { return x.dataset.app === key; })[0];
    var art = src && $('.nb-icon__art', src);
    if (art) { var c = art.cloneNode(true); c.removeAttribute('id'); b.appendChild(c); }
    b.appendChild(marked('nb-sp__appname', NAME[key] || key, q));
    b.addEventListener('click', function () { closeSpot(); launch(key); });
    return b;
  }
  function launch(key, it) {
    var x = XAPPS[key];
    if (x && x.kind === 'link') {
      var a = homeIcons.filter(function (b) { return b.dataset.app === key; })[0];
      if (a && a.tagName === 'A') a.click(); else if (safeURL(x.link)) window.open(safeURL(x.link), '_blank');
      return;
    }
    openApp(key);
    if (it && it.item && current === key) { stack.push({ app: key, item: it.item }); render(stack[stack.length - 1], false); }
    if (it && it.act) it.act();
  }
  function spotSearch() {
    var q = spotIn.value.trim().toLowerCase();
    spotRes.innerHTML = '';
    var head = function (t) { spotRes.appendChild(make('p', 'nb-sp__h', t)); };
    var apps;
    if (!q) {
      apps = recent.concat(shownApps().map(function (a) { return a[0]; })).filter(function (k, i, arr) { return shown(k) && arr.indexOf(k) === i; }).slice(0, 4);
      head('Suggestions');
    } else {
      apps = shownApps().filter(function (a) { return a[1].toLowerCase().indexOf(q) >= 0; }).map(function (a) { return a[0]; });
      if (apps.length) head('Apps');
    }
    if (apps.length) {
      var row = make('div', 'nb-sp__apps');
      apps.slice(0, 8).forEach(function (k) { row.appendChild(miniApp(k, q)); });
      spotRes.appendChild(row);
    }
    if (!q) return;
    spotIndex = spotIndex || buildIndex();
    var hits = spotIndex.filter(function (r) { return (r.title + ' ' + r.sub).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (b.title.toLowerCase().indexOf(q) === 0) - (a.title.toLowerCase().indexOf(q) === 0); })
      .slice(0, 30);
    if (hits.length) {
      head('In the almanac');
      var ol = make('ol', 'nb-sp__list');
      hits.forEach(function (r) {
        var li = make('li'), b = make('button', 'nb-sp__hit');
        b.type = 'button';
        var t = make('span', 'nb-sp__txt');
        t.appendChild(marked('nb-sp__t', r.title, q));
        if (r.sub && r.sub !== r.title) t.appendChild(marked('nb-sp__s', r.sub, q));
        b.appendChild(t);
        b.appendChild(make('span', 'nb-sp__in', NAME[r.key] || ''));
        b.addEventListener('click', function () { closeSpot(); launch(r.key, r); });
        li.appendChild(b); ol.appendChild(li);
      });
      spotRes.appendChild(ol);
    }
    if (!apps.length && !hits.length) spotRes.appendChild(make('p', 'nb-sp__none', 'Nothing called “' + spotIn.value.trim() + '” in the almanac.'));
  }
  function openSpot() {
    if (!spotEl || current || tablet.classList.contains('nb-locked')) return;
    spotIndex = null;
    spotEl.hidden = false;
    tablet.classList.add('nb-spot-open');
    spotIn.value = '';
    spotSearch();
    setTimeout(function () { spotIn.focus({ preventScroll: true }); }, 30);
  }
  function closeSpot() {
    if (!spotEl || spotEl.hidden) return;
    spotEl.hidden = true;
    tablet.classList.remove('nb-spot-open');
  }
  function buildSpot(views) {
    spotEl = make('div', 'nb-spotlight');
    spotEl.hidden = true;
    spotEl.setAttribute('role', 'dialog');
    spotEl.setAttribute('aria-label', 'Search the almanac');
    spotEl.innerHTML = '<div class="nb-sp__bar"><label class="nb-sp__field"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.6"/><path d="M10.2 10.2L14 14"/></svg>' +
      '<input type="search" placeholder="Search" aria-label="Search the almanac" autocomplete="off" spellcheck="false" enterkeyhint="go"></label>' +
      '<button type="button" class="nb-sp__cancel">Cancel</button></div><div class="nb-sp__res"></div>';
    spotIn = $('input', spotEl); spotRes = $('.nb-sp__res', spotEl);
    spotIn.addEventListener('input', spotSearch);
    spotIn.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSpot(); var f = $('.nb-find', home); if (f) f.focus({ preventScroll: true }); }
      if (e.key === 'Enter') { var first = $('button', spotRes); if (first) { e.preventDefault(); first.click(); } }
      if (e.key === 'ArrowDown') { var f2 = $('button', spotRes); if (f2) { e.preventDefault(); f2.focus(); } }
    });
    spotEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeSpot(); } });
    $('.nb-sp__cancel', spotEl).addEventListener('click', closeSpot);
    views.appendChild(spotEl);
    // pull down on the home screen, like on a phone
    var y0 = null, x0 = 0;
    home.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }, { passive: true });
    home.addEventListener('touchmove', function (e) {
      if (y0 == null) return;
      var dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
      if (dy > 46 && dy > dx * 1.5) { y0 = null; openSpot(); }
    }, { passive: true });
    home.addEventListener('touchend', function () { y0 = null; }, { passive: true });
    // and "/" opens it from the keyboard while the tablet is in hand
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var a = document.activeElement;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      if (!(tablet.contains(a) || tablet.matches(':hover'))) return;
      if (current || tablet.classList.contains('nb-locked')) return;
      e.preventDefault(); openSpot();
    });
  }

  function buildTablet() {
    tablet = make('aside', 'nb-tablet');
    tablet.setAttribute('aria-label', 'Tablet: one app for each part of the page');
    var bezel = make('div', 'nb-bezel');
    tablet.appendChild(bezel);
    screen = make('div', 'nb-screen');
    bezel.appendChild(screen);

    var bar = make('div', 'nb-status');
    bar.innerHTML = '<span class="nb-status__who"><i>The</i> Lahera Almanac</span><span class="nb-status__right" hidden><span class="nb-status__time"></span>' +
      '<svg class="nb-status__bat" viewBox="0 0 26 12" aria-hidden="true"><path d="M1.5 2.2h20.6v7.8H1.6z"/><path d="M23.4 4.6v3"/><path d="M3.6 4.2h12v3.8h-12z" class="nb-status__charge"/></svg></span>';
    screen.appendChild(bar);

    var views = make('div', 'nb-views');
    screen.appendChild(views);

    home = make('div', 'nb-home');
    var greet = make('div', 'nb-greet');
    greet.appendChild(make('p', 'nb-greet__day'));
    greet.appendChild(make('p', 'nb-greet__hi'));
    greet.insertAdjacentHTML('beforeend', '<svg class="nb-greet__rule" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5H86M114 5H200"/><path d="M100 0.8L104.2 5 100 9.2 95.8 5Z"/><path d="M90 5h2M108 5h2"/></svg>');
    home.appendChild(greet);
    var np = make('p', 'nb-np');
    np.hidden = true;
    np.innerHTML = '<span class="nb-np__k">Now playing</span><button type="button" class="nb-np__t"></button><button type="button" class="nb-np__b">Pause</button>';
    $('.nb-np__t', np).addEventListener('click', function () { openApp('music'); });
    $('.nb-np__b', np).addEventListener('click', function () { if (player) { if (player.paused) player.play().catch(function () {}); else player.pause(); } });
    home.appendChild(np);
    pager = make('div', 'nb-pager');
    APPS.forEach(function (a, i) { homeIcons.push(icon(a[0], a[1], i)); });
    home.appendChild(pager);
    var hfoot = make('div', 'nb-hfoot');
    hfoot.innerHTML = '<button type="button" class="nb-find"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.8" cy="6.8" r="4.6"/><path d="M10.2 10.2L14 14"/></svg><span>Search</span></button><span class="nb-dots"></span>';
    dots = $('.nb-dots', hfoot);
    $('.nb-find', hfoot).addEventListener('click', openSpot);
    home.appendChild(hfoot);
    views.appendChild(home);
    layoutPages(true);
    wirePager();
    var grid = pager;

    appView = make('section', 'nb-app');
    appView.hidden = true;
    var top = make('header', 'nb-app__top');
    var back = make('button', 'nb-app__back', '‹ Back');
    back.type = 'button';
    appTitle = make('h2', 'nb-app__title');
    var close = make('button', 'nb-app__close', 'Home');
    close.type = 'button';
    top.appendChild(back); top.appendChild(appTitle); top.appendChild(close);
    appView.appendChild(top);
    appBody = make('div', 'nb-app__body');
    appView.appendChild(appBody);
    views.appendChild(appView);
    buildSpot(views);

    // the lock screen: the castle, under today's sky
    var lock = make('div', 'nb-lock');
    lock.setAttribute('role', 'button');
    lock.setAttribute('tabindex', '0');
    lock.setAttribute('aria-label', 'Unlock the tablet');
    lock.innerHTML = '<div class="nb-lock__art"></div><div class="nb-lock__top"><p class="nb-lock__time"></p>' + dialSVG() + '<p class="nb-lock__date"></p></div>' +
      '<p class="nb-lock__hint"><svg viewBox="0 0 20 14" aria-hidden="true"><path d="M3 11.5L10 4.5 17 11.5"/></svg><span>Touch to open</span></p>';
    var media = $('.hero__media');
    if (media) $('.nb-lock__art', lock).appendChild(media);
    screen.insertBefore(lock, views);
    tablet.classList.add('nb-locked');
    var unlock = function () {
      if (!tablet.classList.contains('nb-locked')) return;
      tablet.classList.remove('nb-locked');
      tablet.classList.add('nb-unlocking');
      layoutPages();
      touched = Date.now();
      setTimeout(function () { tablet.classList.remove('nb-unlocking'); }, 900);
    };
    var lockIt = function () {
      closeSpot();
      if (current) goHome();
      root.classList.remove('nb-full');
      tablet.classList.add('nb-locked');
    };
    tablet._unlock = unlock;
    tablet._lock = lockIt;
    lock.addEventListener('click', unlock);
    lock.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlock(); } });
    var y0 = null;
    lock.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    lock.addEventListener('touchmove', function (e) { if (y0 != null && y0 - e.touches[0].clientY > 30) { y0 = null; unlock(); } }, { passive: true });

    // the dock: lock, home, settings
    var dock = make('nav', 'nb-dock');
    dock.setAttribute('aria-label', 'Tablet');
    [['lock', 'Lock'], ['home', 'Home'], ['settings', 'Settings']].forEach(function (d) {
      var b = make('button', 'nb-dock__b nb-dock__b--' + d[0]);
      b.type = 'button';
      b.innerHTML = d[0] === 'home' ? '<span class="nb-seal" aria-hidden="true"></span><span class="nb-sr">Home</span>' : '<span>' + d[1] + '</span>';
      if (d[0] === 'home') b.setAttribute('aria-label', 'Home');
      b.addEventListener('click', function () {
        if (d[0] === 'lock') lockIt();
        else if (d[0] === 'home') { if (tablet.classList.contains('nb-locked')) unlock(); else goHome(); }
        else openApp('settings');
      });
      dock.appendChild(b);
    });
    screen.appendChild(dock);

    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.nb-icon');
      if (!b) return;
      if (b.tagName === 'A') return;   // a website: the link itself opens it in a new tab
      openApp(b.dataset.app);
    });
    back.addEventListener('click', function () { if (stack.length > 1) { stack.pop(); render(stack[stack.length - 1], true); } else goHome(); });
    close.addEventListener('click', goHome);
    tablet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) { e.preventDefault(); goHome(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('nb-full')) goHome();
    });

    // it locks by itself when left alone, if asked to
    var touched = Date.now();
    ['pointerdown', 'keydown', 'wheel'].forEach(function (ev) { tablet.addEventListener(ev, function () { touched = Date.now(); }, { passive: true }); });
    setInterval(function () {
      var mins = +prefs.autolock;
      if (mins && !tablet.classList.contains('nb-locked') && Date.now() - touched > mins * 60000) lockIt();
    }, 5000);

    var dialH = $('.nb-dial__h', lock), dialM = $('.nb-dial__m', lock), dialS = $('.nb-dial__s', lock);
    var clock = function () {
      var d = new Date(), h = d.getHours(), h12 = prefs.hours !== '24';
      var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: h12 });
      $('.nb-status__time', bar).textContent = t;
      $('.nb-lock__time', screen).textContent = t.replace(/\s?[AP]M$/i, '');
      $('.nb-lock__date', screen).textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      $('.nb-greet__hi', greet).textContent = h < 5 ? 'Up Late' : h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : h < 22 ? 'Good Evening' : 'Good Night';
      $('.nb-greet__day', greet).textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      $('.nb-status__charge', bar).setAttribute('d', 'M3.6 4.2h' + (4 + (24 - h) / 24 * 14).toFixed(1) + 'v3.8h-' + (4 + (24 - h) / 24 * 14).toFixed(1) + 'z');
      var s = d.getSeconds(), m = d.getMinutes() + s / 60, hh = (h % 12) + m / 60;
      dialH.setAttribute('transform', 'rotate(' + (hh * 30).toFixed(2) + ' 100 100)');
      dialM.setAttribute('transform', 'rotate(' + (m * 6).toFixed(2) + ' 100 100)');
      dialS.setAttribute('transform', 'rotate(' + (s * 6) + ' 100 100)');
    };
    tablet._clock = clock;
    clock();
    setInterval(clock, 1000);
    applyPrefs();
    return tablet;
  }

  function turn(el, backwards) {
    rustle();
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
    if (tablet._unlock) tablet._unlock();
    closeSpot();
    if (key !== 'settings') { recent = [key].concat(recent.filter(function (k) { return k !== key; })).slice(0, 4); }
    current = key;
    tablet.dataset.last = key;
    stack = [{ app: key }];
    home.hidden = true;
    appView.hidden = false;
    // on a phone the app opens inside the tablet too, and the page stays where it is
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
      if (TARGET[key]) page.appendChild(seeOnPage(key));
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
    // a wobble for the pen, a bleed for the washes
    document.body.insertAdjacentHTML('afterbegin', '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
      '<filter id="nb-wobble" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.4"/></filter>' +
      '<filter id="nb-wash" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="8" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" result="d"/><feGaussianBlur in="d" stdDeviation=".6"/></filter>' +
      '</defs></svg>');
    var rp = $('#research_panels');
    if (rp) { rp.setAttribute('data-nb-pages', ''); rp.classList.add('nb-pages'); }
    buildExperience();
    var letter = buildLetter(hero);
    hero.insertBefore(letter, hero.firstChild);
    var paperEl = $('.nb-letter__paper', letter);
    hero.appendChild(buildTablet());
    if (window.__PORTFOLIO_DATA__) takeData(window.__PORTFOLIO_DATA__);
    window.addEventListener('portfolio:data', function (e) { takeData(e.detail); });
    paintSwipes();
    if (window.MutationObserver) new MutationObserver(paintSwipes).observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    setInterval(paintSwipes, 60000);
    // pages are torn once the pen (penwash) is on the page
    var later = function () { dressPages(); setTimeout(dressPages, 600); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);
    document.addEventListener('DOMContentLoaded', dressPages);
    inkUp();
    document.addEventListener('DOMContentLoaded', inkUp);
    window.addEventListener('load', inkUp);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('nb-ready'); }); });
    window.addEventListener('resize', function () { if (!phone()) root.classList.remove('nb-full'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
