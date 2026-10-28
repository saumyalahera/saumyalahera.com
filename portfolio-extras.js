/*
 * Renders the parts of the page that the Leabhar app edits beyond the original
 * fields (hero, selected work, research, Duolingo, games, headings, footer).
 *
 * index.html calls window.renderPortfolioExtras(d) with the Cloudflare JSON.
 * Every block is optional: when a key is missing or empty, the HTML already in
 * the page stays as the fallback, so the site never renders blank.
 */
(function () {
  function str(v) {
    return (v === undefined || v === null) ? '' : String(v).trim();
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj);
  }

  function nonEmptyArray(v) {
    return Array.isArray(v) && v.length > 0;
  }

  function isExternal(href) {
    return /^https?:\/\//i.test(href);
  }

  function makeLink(className, href, text) {
    const a = document.createElement('a');
    a.className = className;
    a.href = href;
    a.textContent = text;
    if (isExternal(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  // Plain text fields: <el data-field="hero.name">. A string in the JSON (even an
  // empty one) replaces the text; a missing key keeps the HTML fallback.
  function applyFields(d) {
    document.querySelectorAll('[data-field]').forEach((el) => {
      const v = getPath(d, el.getAttribute('data-field'));
      if (typeof v === 'string') el.textContent = v.trim();
    });
    document.querySelectorAll('[data-href]').forEach((el) => {
      const v = str(getPath(d, el.getAttribute('data-href')));
      if (v) el.setAttribute('href', v);
    });
  }

  function renderHeroButtons(d) {
    const root = document.getElementById('hero_buttons');
    const buttons = d.hero && d.hero.buttons;
    if (!root || !nonEmptyArray(buttons)) return;
    const clean = buttons.filter((b) => b && str(b.label) && str(b.href));
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 4).forEach((b) => {
      const style = str(b.style) === 'primary' ? 'primary' : 'ghost';
      root.appendChild(makeLink('btn ' + style, str(b.href), str(b.label)));
    });
  }

  function renderHeroPills(d) {
    const root = document.getElementById('hero_pills');
    const pills = d.hero && d.hero.pills;
    if (!root || !nonEmptyArray(pills)) return;
    const clean = pills.filter((p) => p && str(p.label));
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 16).forEach((p) => {
      const span = document.createElement('span');
      span.className = 'pill';
      const icon = str(p.icon);
      if (icon) {
        const img = document.createElement('img');
        img.className = 'pill__icon';
        img.src = icon;
        img.alt = '';
        span.appendChild(img);
      }
      span.appendChild(document.createTextNode(str(p.label)));
      root.appendChild(span);
    });
  }

  // Same markup as the hand-written Selected work cards: tags sit directly in
  // .card__top, followed by the title, description, bullets and an action link.
  function tagEl(tag) {
    const text = str(tag && (tag.text ?? tag.label));
    if (!text) return null;
    const variant = str(tag.variant) || 'tag';
    const href = str(tag.href);
    let el;
    if (href) {
      el = makeLink('', href, text);
    } else {
      el = document.createElement(variant === 'alt' ? 'span' : 'div');
      el.textContent = text;
    }
    el.className = 'tag';
    if (variant === 'alt') el.className += ' tag--alt';
    if (variant === 'static') el.className += ' tag--static';
    if (variant === 'link2') el.className += ' tag--link2';
    if (variant === 'link3') el.className += ' tag--link3';
    return el;
  }

  function renderSelectedWork(d) {
    const root = document.getElementById('selected_work');
    const items = d.selected_work;
    if (!root || !nonEmptyArray(items)) return;
    const clean = items.filter((p) => p && str(p.title));
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 12).forEach((p) => {
      const card = document.createElement('article');
      card.className = 'card';
      const video = str(p.video);
      if (video) card.setAttribute('data-video', video);

      const top = document.createElement('div');
      top.className = 'card__top';
      (Array.isArray(p.tags) ? p.tags : []).slice(0, 6).forEach((t) => {
        const el = tagEl(t);
        if (!el) return;
        top.appendChild(el);
        top.appendChild(document.createTextNode(' ')); // same spacing as the hand-written tags
      });
      const h3 = document.createElement('h3');
      h3.textContent = str(p.title);
      top.appendChild(h3);
      if (str(p.description)) {
        const desc = document.createElement('p');
        desc.className = 'muted';
        desc.textContent = str(p.description);
        top.appendChild(desc);
      }
      card.appendChild(top);

      const bullets = (Array.isArray(p.bullets) ? p.bullets : []).map(str).filter(Boolean);
      if (bullets.length) {
        const ul = document.createElement('ul');
        ul.className = 'bullets';
        bullets.slice(0, 8).forEach((b) => {
          const li = document.createElement('li');
          li.textContent = b;
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }

      if (str(p.action_label)) {
        const actions = document.createElement('div');
        actions.className = 'card__actions';
        if (str(p.action_href)) {
          actions.appendChild(makeLink('link', str(p.action_href), str(p.action_label)));
        } else {
          // a label with no link is a status, like "Waiting for review"
          const note = document.createElement('span');
          note.className = 'link';
          note.setAttribute('aria-disabled', 'true');
          note.textContent = str(p.action_label);
          actions.appendChild(note);
        }
        card.appendChild(actions);
      }
      root.appendChild(card);
    });
  }

  function renderResearch(d) {
    const root = document.getElementById('research_panels');
    const items = d.research_panels;
    if (!root || !nonEmptyArray(items)) return;
    const clean = items.filter((p) => p && str(p.title));
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 9).forEach((p) => {
      const panel = document.createElement('div');
      panel.className = 'panel';
      const h3 = document.createElement('h3');
      h3.textContent = str(p.title);
      panel.appendChild(h3);
      if (str(p.body)) {
        const body = document.createElement('p');
        body.textContent = str(p.body);
        panel.appendChild(body);
      }
      if (str(p.callout_text)) {
        const callout = document.createElement('div');
        callout.className = 'callout';
        if (str(p.callout_label)) {
          const strong = document.createElement('strong');
          strong.textContent = str(p.callout_label);
          callout.appendChild(strong);
          callout.appendChild(document.createTextNode(' '));
        }
        callout.appendChild(document.createTextNode(str(p.callout_text)));
        panel.appendChild(callout);
      }
      root.appendChild(panel);
    });
  }

  function renderDuolingo(d) {
    const root = document.getElementById('duolingo_grid');
    const items = d.duolingo_languages;
    if (!root || !nonEmptyArray(items)) return;
    const clean = items.filter((p) => p && str(p.title));
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 12).forEach((p) => {
      const card = document.createElement('article');
      card.className = 'mini-card duo-card';
      const text = document.createElement('div');
      text.className = 'duo-card__text';
      const title = document.createElement('div');
      title.className = 'duo-card__title';
      title.textContent = str(p.title);
      const sub = document.createElement('div');
      sub.className = 'duo-card__subtitle';
      sub.textContent = str(p.subtitle);
      text.appendChild(title);
      text.appendChild(sub);
      card.appendChild(text);
      if (str(p.image)) {
        const wrap = document.createElement('div');
        wrap.className = 'duo-card__imageWrap';
        const img = document.createElement('img');
        img.className = 'duo-card__img';
        img.src = str(p.image);
        img.alt = '';
        img.loading = 'lazy';
        wrap.appendChild(img);
        card.appendChild(wrap);
      }
      root.appendChild(card);
    });
  }

  function renderGames(d) {
    const root = document.getElementById('games_list');
    if (!root || !nonEmptyArray(d.games)) return;
    const clean = d.games.map(str).filter(Boolean);
    if (!clean.length) return;
    root.innerHTML = '';
    clean.slice(0, 30).forEach((g) => {
      const span = document.createElement('span');
      span.className = 'pill';
      span.textContent = g;
      root.appendChild(span);
    });
  }

  // Accent colour picked in the app. Mirrors AccentTheme in the app: text keeps
  // the hue but is darkened until it reads on white; fills use a pale tint.
  // "By the hour": the ink follows the visitor's local time. Kept in step with
  // AccentTheme.dayInks in the app.
  const DAY_INKS = [[0, '#2E3A8C'], [5, '#6B4FD8'], [7, '#D9467A'], [9, '#F2C230'],
                    [13, '#1F8A8A'], [17, '#E5533D'], [20, '#3D24ED'], [24, '#2E3A8C']];
  let dayTimer = null;

  function dayHex(date) {
    const h = Math.floor((date.getHours() * 60 + date.getMinutes()) / 15) / 4;
    let i = 0;
    while (i < DAY_INKS.length - 2 && DAY_INKS[i + 1][0] <= h) i++;
    const [ha, a] = DAY_INKS[i], [hb, b] = DAY_INKS[i + 1];
    const t = Math.max(0, Math.min(1, (h - ha) / (hb - ha)));
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    let out = '#';
    for (const shift of [16, 8, 0]) {
      const ca = (pa >> shift) & 255, cb = (pb >> shift) & 255;
      out += Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0');
    }
    return out;
  }

  function applyAccent(d) {
    const raw = str(d.accent_color);
    if (dayTimer) { clearInterval(dayTimer); dayTimer = null; }
    if (raw.toLowerCase() === 'time') {
      applyHex(dayHex(new Date()));
      dayTimer = setInterval(() => applyHex(dayHex(new Date())), 5 * 60 * 1000);
      return;
    }
    applyHex(raw);
  }

  function applyHex(value) {
    const m = /^#?([0-9a-f]{6})$/i.exec(str(value));
    if (!m) return;
    const v = parseInt(m[1], 16);
    const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
    let h = 0, sat = 0, l = (mx + mn) / 2;
    if (dl > 0) {
      sat = dl / (1 - Math.abs(2 * l - 1));
      if (mx === r) h = (g - b) / dl + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / dl + 2;
      else h = (r - g) / dl + 4;
      h /= 6;
    }
    const toRgb = (L) => [0, 8, 4].map((n) => {
      const k = (n + h * 12) % 12;
      const a = sat * Math.min(L, 1 - L);
      return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    });
    const contrast = (c) => {
      const lin = (x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
      return 1.05 / (0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]) + 0.05);
    };
    let L = l;
    while (L > 0.05 && contrast(toRgb(L)) < 4.5) L -= 0.02;
    const bytes = (c) => c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255));
    const ink = bytes(toRgb(L));
    const soft = bytes(toRgb(0.89));
    const root = document.documentElement.style;
    root.setProperty('--accent-ink', 'rgb(' + ink.join(',') + ')');
    root.setProperty('--accent-ink-rgb', ink.join(','));
    root.setProperty('--accent-soft-rgb', soft.join(','));
  }

  window.renderPortfolioExtras = function (d) {
    if (!d || typeof d !== 'object') return;
    const steps = [applyAccent, applyFields, renderHeroButtons, renderHeroPills, renderSelectedWork,
                   renderResearch, renderDuolingo, renderGames];
    steps.forEach((fn) => {
      try { fn(d); } catch (e) { try { console.error('portfolio extras:', e); } catch (_) {} }
    });
  };
})();
