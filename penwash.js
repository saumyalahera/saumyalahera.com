/* ==========================================================================
   Pen & wash: a new look for the page, painted in code.
   - A watercolour engine (thin glazes of a deformed shape, layered dozens of
     times, with back-runs and granulation) paints the washes.
   - A pen engine draws loose ink lines with a hand's tremor and overshoot.
   The page content itself is not copied; every element (and every id the
   site's data scripts fill in) stays where it is. Remove the <link> and
   <script> to go back.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('pw-js');
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- randomness ----------------------------------------------------------
  function rng(seed) {
    var s = (seed * 2654435761) >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function gauss(r) {
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---- palette: ink diluted to three strengths ------------------------------------
  var GREY = { light: [150, 150, 148], mid: [104, 104, 102], dark: [62, 62, 60] };

  // ---- watercolour -----------------------------------------------------------
  // A shape is a polygon whose points each carry their own "wetness" (v).
  // Deforming splits every edge and pushes the midpoint out at random,
  // scaled by the edge length and that wetness: repeated, it gives the
  // ragged, soft-and-hard edge of a real wash.

  function basePoly(cx, cy, rx, ry, rot, r, n) {
    n = n || 10;
    var pts = [], c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, k = 0.85 + r() * 0.3;
      var x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push({ x: cx + x * c - y * s, y: cy + x * s + y * c, v: 0.4 + r() * 1.1 });
    }
    return pts;
  }

  function deform(pts, depth, amt, r) {
    for (var d = 0; d < depth; d++) {
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        out.push(a);
        var len = Math.hypot(b.x - a.x, b.y - a.y), v = (a.v + b.v) / 2;
        var m = gauss(r) * len * amt * v, ang = r() * Math.PI * 2;
        out.push({ x: (a.x + b.x) / 2 + Math.cos(ang) * m, y: (a.y + b.y) / 2 + Math.sin(ang) * m, v: v * (0.85 + r() * 0.3) });
      }
      pts = out;
    }
    return pts;
  }

  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  // One wash: ~30 glazes of the same wet shape, each slightly different.
  function wash(ctx, o, r) {
    var col = o.color, layers = o.layers || 30, alpha = (o.alpha || 0.035) * (o.raw ? 1 : 0.62);
    var base = o.pts ? deform(o.pts, 2, o.wet || 0.2, r) : deform(basePoly(o.cx, o.cy, o.rx, o.ry, o.rot, r, o.n), 3, o.wet || 0.42, r);
    ctx.fillStyle = 'rgb(' + col.join(',') + ')';
    ctx.strokeStyle = 'rgb(' + col.map(function (c) { return Math.round(c * 0.8); }).join(',') + ')';
    for (var l = 0; l < layers; l++) {
      var p = deform(base, 3, o.spread || 0.22, r);
      polyPath(ctx, p);
      ctx.globalAlpha = alpha;
      ctx.fill();
      // pigment gathers at the drying edge
      if (l % 4 === 0) { ctx.globalAlpha = alpha * 0.55; ctx.lineWidth = 1.1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }

  // Back-runs: where water crept back into drying paint and lifted it.
  function backruns(ctx, o, r) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < o.count; i++) {
      var x = o.cx + gauss(r) * o.rx * 0.5, y = o.cy + gauss(r) * o.ry * 0.5, rad = o.size * (0.3 + r() * 0.7);
      var blob = deform(basePoly(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, r, 7), 3, 0.35, r);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.08 + r() * 0.1) + ')';
      polyPath(ctx, blob); ctx.fill();
    }
    ctx.restore();
  }

  // Granulation and paper tooth: specks of pigment caught, specks of paper left.
  function granulate(ctx, w, h, r, density) {
    var n = Math.floor(w * h / (density || 140));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < n; i++) { ctx.globalAlpha = 0.12 + r() * 0.2; ctx.fillRect(r() * w, r() * h, 1.2, 1.2); }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#2a2a28';
    for (i = 0; i < n / 3; i++) { ctx.globalAlpha = 0.05 + r() * 0.06; ctx.fillRect(r() * w, r() * h, 1, 1); }
    ctx.restore();
  }

  // ---- pen ------------------------------------------------------------------
  // Lines are drawn as smoothed polylines with a slight tremor; straight
  // strokes overshoot their corners the way a quick sketch does.

  function tremble(pts, r, amt) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var steps = Math.max(1, Math.round(len / 9));
      for (var k = 0; k < steps; k++) {
        var t = k / steps;
        out.push([a[0] + (b[0] - a[0]) * t + gauss(r) * amt, a[1] + (b[1] - a[1]) * t + gauss(r) * amt]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function smooth(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    if (pts.length < 3) return d + ' L' + pts[1][0].toFixed(1) + ' ' + pts[1][1].toFixed(1);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    var l = pts[pts.length - 1];
    return d + ' L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1);
  }

  function Pen(svg, r) {
    this.svg = svg; this.r = r; this.n = 0;
  }
  Pen.prototype.path = function (pts, o) {
    o = o || {};
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', smooth(tremble(pts, this.r, o.tremor == null ? 0.55 : o.tremor)));
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', o.cls || 'pw-ink');
    p.style.setProperty('--i', this.n++);
    if (o.w) p.style.strokeWidth = o.w;
    this.svg.appendChild(p);
    return p;
  };
  // a straight stroke that overshoots both ends a little
  Pen.prototype.line = function (x1, y1, x2, y2, o) {
    var r = this.r, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    var o1 = (r() * 0.08) * L, o2 = (0.02 + r() * 0.1) * L;
    return this.path([[x1 - dx / L * o1, y1 - dy / L * o1], [x2 + dx / L * o2, y2 + dy / L * o2]], o);
  };
  Pen.prototype.hatch = function (x, y, w, h, gap, ang, o) {
    var r = this.r, c = Math.cos(ang), s = Math.sin(ang);
    for (var t = -w - h; t < w + h; t += gap * (0.8 + r() * 0.4)) {
      // clip each stroke to the box
      var pts = [];
      for (var k = -1; k <= 1; k += 2) {
        var px = x + w / 2 + c * t + -s * k * (w + h), py = y + h / 2 + s * t + c * k * (w + h);
        pts.push([px, py]);
      }
      var seg = clipLine(pts[0], pts[1], x, y, w, h);
      if (seg && Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) > 4) this.path(seg, Object.assign({ tremor: 0.35, cls: 'pw-ink pw-fine' }, o));
    }
  };
  function clipLine(a, b, x, y, w, h) {
    var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1];
    var p = [-dx, dx, -dy, dy], q = [a[0] - x, x + w - a[0], a[1] - y, y + h - a[1]];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; continue; }
      var t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
      else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }
  // a loose looping scribble around an ellipse: foliage, smoke, clouds
  Pen.prototype.scribble = function (cx, cy, rx, ry, turns, loop, o) {
    var r = this.r, pts = [], N = turns * 70, ph = r() * 6;
    for (var i = 0; i <= N; i++) {
      var t = i / N * Math.PI * 2 * turns, k = 1 + (r() - 0.5) * 0.08 + Math.sin(t * 0.37 + ph) * 0.12;
      pts.push([cx + Math.cos(t) * rx * k + Math.cos(t * 9) * loop, cy + Math.sin(t) * ry * k + Math.sin(t * 9) * loop]);
    }
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', smooth(pts));
    p.setAttribute('pathLength', '1');
    p.setAttribute('class', (o && o.cls) || 'pw-ink pw-fine');
    p.style.setProperty('--i', this.n++);
    this.svg.appendChild(p);
  };

  function svgEl(vb, cls) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', vb);
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    return s;
  }

  function paintCanvas(w, h, scale) {
    var c = document.createElement('canvas');
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    return { c: c, ctx: ctx };
  }

  // ---- the cover painting ------------------------------------------------------
  // A loose village street on a summer day, kept abstract: the sky is a
  // few blooms of ultramarine with paper left white for cloud, the land a
  // couple of warm washes, and the pen only suggests roofs, posts and a road.

  var W = 1000, H = 700;

  // a hard-edged shape (a wall, a roof) loosely filled: the wash spills
  // a little past the pen line, as it does when painted quickly
  function box(pts, r, j) {
    j = j == null ? 1 : j;
    return pts.map(function (p) { return { x: p[0] + (r() - 0.5) * 10 * j, y: p[1] + (r() - 0.5) * 8 * j, v: 0.5 + r() * 0.6 }; });
  }

  function coverWashes(ctx, r, shadows) {
    // the shadow side of every wall, laid in tight to the pen line
    shadows.forEach(function (s) {
      wash(ctx, { pts: box(s, r, 0.25), color: GREY.mid, alpha: 0.05, layers: 6, wet: 0.05, spread: 0.04, raw: true }, r);
    });
    // the dark under the bridge arches and a little ground
    wash(ctx, { cx: 720, cy: 524, rx: 280, ry: 10, color: GREY.mid, alpha: 0.012, layers: 14, wet: 0.2, spread: 0.1 }, r);
    wash(ctx, { cx: 790, cy: 625, rx: 200, ry: 22, rot: -0.12, color: GREY.light, alpha: 0.01, layers: 14, wet: 0.2, spread: 0.1 }, r);
    granulate(ctx, W, H, r, 160);
  }

  // A hill town in pen: a tall tower, a bridge on two arches carrying a
  // second one, a third beside it, a row of houses, stone steps, washing
  // strung between the towers, a kite, birds. Returns where the shadows fall.
  function coverInk(pen) {
    var r = pen.r, tr = rng(31), sh = [];
    var G = 520;
    // ground, broken where the eye skips
    pen.path([[430, G], [560, G - 2], [700, G + 1]], { tremor: 0.4 });
    pen.path([[760, G + 1], [880, G - 1], [1000, G + 2]], { tremor: 0.4 });
    // the bridge and the steps up to it
    pen.bridge(612, 400, 186, 120);
    pen.stair(470, G, 70, 92, 8);
    // three towers
    var a = tower(pen, 566, G, 420, tr, sh);
    var b = tower(pen, 705, 400, 270, tr, sh);
    var c = tower(pen, 858, G, 370, tr, sh);
    // a row of houses leaning on the last tower
    var x = 912;
    [[44, 64, 'stones'], [40, 82, 'bricks']].forEach(function (hd, i) {
      var w = hd[0], h = hd[1], top = G - h;
      pen.rect(x, top, w, h);
      if (hd[2] === 'stones') pen.stones(x, top, w, h, 7); else pen.bricks(x, top, w, h);
      pen.window(x + 8, top + 14, 9, 12, 'square'); pen.window(x + w - 17, top + 14, 9, 12, 'square');
      if (h > 70) { pen.window(x + 8, top + 44, 9, 12, 'square'); pen.window(x + w - 17, top + 44, 9, 12, 'arch'); }
      pen.rect(x + w / 2 - 5, G - 20, 10, 20, { cls: 'pw-ink pw-fine' });
      pen.gable(x, top, w, 24 + i * 6);
      pen.rect(x + w * 0.62, top - 30, 7, 16, { cls: 'pw-ink pw-fine' });
      sh.push([[x + w * 0.7, top + 2], [x + w - 1, top + 2], [x + w - 1, G - 2], [x + w * 0.7, G - 2]]);
      x += w + 6;
    });
    // washing strung between the towers, a kite and birds
    pen.washing(a.right + 2, a.top + 110, b.left - 2, b.top + 80);
    pen.washing(b.right + 2, b.top + 60, c.left - 2, c.top + 90);
    pen.kite(800, 120, 14);
    pen.bird(655, 120, 6); pen.bird(684, 102, 5); pen.bird(940, 150, 5); pen.bird(905, 128, 4); pen.bird(520, 90, 4);
    pen.tree(455, G - 2, 150);
    // posts and a fence along the lane
    [452, 478, 503, 527].forEach(function (px, i) {
      var y = 560 + i * 4, h = 34 - i * 4;
      pen.line(px, y, px + (r() - 0.5) * 2, y - h);
      pen.line(px + 5, y - h + 1, px + 5, y - 2, { cls: 'pw-ink pw-fine' });
    });
    pen.path([[440, 548], [490, 543], [535, 535]], { cls: 'pw-ink pw-fine' });
    // the road running out of the town
    pen.path([[560, 700], [620, 610], [690, 548], [722, G + 2]], { tremor: 0.7 });
    pen.path([[1000, 676], [900, 600], [820, 548], [790, G + 2]], { tremor: 0.7 });
    pen.hatch(560, 652, 120, 40, 7, -0.25);
    return sh;
  }

  // A soft mask (alpha only) made from one wash, used to let the shader
  // sit in the sky as if it were painted there.
  function maskURL(seed, w, h) {
    var p = paintCanvas(w, h, 1), r = rng(seed);
    wash(p.ctx, { cx: w / 2, cy: h / 2, rx: w * 0.36, ry: h * 0.34, color: [0, 0, 0], alpha: 0.07, layers: 26, raw: true }, r);
    return p.c.toDataURL('image/png');
  }

  function buildCover() {
    var media = document.querySelector('.hero__media');
    if (!media) return;
    media.classList.add('pw-cover');
    var stage = document.createElement('div');
    stage.className = 'pw-stage';
    var wl = document.createElement('div'); wl.className = 'pw-layer pw-washes';
    var il = document.createElement('div'); il.className = 'pw-layer pw-inks';
    stage.appendChild(wl);

    // the shader lives in the sky, behind the ink
    var shader = media.querySelector('#shader');
    if (shader) {
      var sky = document.createElement('div');
      sky.className = 'pw-sky';
      sky.style.setProperty('--pw-sky-mask', 'url("' + maskURL(77, 600, 300) + '")');
      sky.appendChild(shader);
      stage.appendChild(sky);
      skyShader(sky);
    }
    stage.appendChild(il);
    media.insertBefore(stage, media.firstChild);

    var r = rng(2024);
    var scale = Math.min(2, (window.devicePixelRatio || 1)) * Math.min(1.2, Math.max(0.6, stage.clientWidth / W || 1));
    var p = paintCanvas(W, H, scale);
    p.c.className = 'pw-canvas';
    wl.appendChild(p.c);
    // paint after the first frame so the page shows at once
    var svg = svgEl('0 0 ' + W + ' ' + H, 'pw-svg');
    il.appendChild(svg);
    var shadows = coverInk(new Pen(svg, rng(7)));
    requestAnimationFrame(function () {
      coverWashes(p.ctx, r, shadows);
      wl.classList.add('pw-dry');
    });

    requestAnimationFrame(function () { requestAnimationFrame(function () { il.classList.add('pw-drawn'); }); });

    // the layers drift apart a touch under the pointer, and with the scroll
    if (reduceMotion) return;
    var tx = 0, ty = 0, x = 0, y = 0, sy = 0, running = false;
    function tick() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      wl.style.transform = 'translate3d(' + (x * -10).toFixed(2) + 'px,' + (y * -8 + sy * 0.05).toFixed(2) + 'px,0)';
      il.style.transform = 'translate3d(' + (x * 7).toFixed(2) + 'px,' + (y * 5 - sy * 0.02).toFixed(2) + 'px,0)';
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.002) requestAnimationFrame(tick); else running = false;
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(tick); } }
    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; kick();
      }, { passive: true });
    }
    window.addEventListener('scroll', function () {
      var v = window.scrollY;
      if (v > innerHeight * 1.2) return;
      sy = v; ty += 0.0001; kick();
    }, { passive: true });
  }

  // ---- pen architecture --------------------------------------------------------
  // Little buildings drawn the way a pen sketch builds them up: walls with
  // overshooting corners, a texture (stones, planks, bricks), windows inked
  // solid, roofs with shingles, balconies with railings, flags, washing
  // lines, birds. Each drawing also records where its shadows fall so the
  // wash can be laid in afterwards.

  Pen.prototype.fill = function (pts, o) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', smooth(tremble(pts.concat([pts[0]]), this.r, (o && o.tremor) || 0.3)) + ' Z');
    p.setAttribute('class', 'pw-fill');
    p.style.setProperty('--i', this.n++);
    this.svg.appendChild(p);
    return p;
  };
  Pen.prototype.rect = function (x, y, w, h, o) {
    this.line(x, y, x + w, y, o); this.line(x + w, y, x + w, y + h, o);
    this.line(x + w, y + h, x, y + h, o); this.line(x, y + h, x, y, o);
  };
  // a small closed stone, slightly irregular
  Pen.prototype.stone = function (cx, cy, rx, ry) {
    var r = this.r, pts = [], n = 7, ph = r() * 6;
    for (var i = 0; i <= n; i++) {
      var a = ph + i / n * Math.PI * 2, k = 0.8 + r() * 0.35;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    this.path(pts, { tremor: 0.15, cls: 'pw-ink pw-fine' });
  };
  Pen.prototype.stones = function (x, y, w, h, size) {
    var r = this.r;
    for (var yy = y + size * 0.7; yy < y + h - size * 0.4; yy += size * 1.15) {
      for (var xx = x + size * (0.6 + r() * 0.5); xx < x + w - size * 0.5; xx += size * (1.3 + r() * 0.6)) {
        if (r() < 0.82) this.stone(xx, yy + (r() - 0.5) * 2, size * (0.45 + r() * 0.2), size * (0.32 + r() * 0.12));
      }
    }
  };
  Pen.prototype.planks = function (x, y, w, h, gap, horizontal) {
    if (horizontal) for (var yy = y + gap; yy < y + h - 1; yy += gap) this.line(x + 1, yy, x + w - 1, yy, { cls: 'pw-ink pw-fine', tremor: 0.25 });
    else for (var xx = x + gap; xx < x + w - 1; xx += gap) this.line(xx, y + 1, xx, y + h - 1, { cls: 'pw-ink pw-fine', tremor: 0.25 });
  };
  Pen.prototype.bricks = function (x, y, w, h) {
    var row = 0;
    for (var yy = y + 6; yy < y + h - 2; yy += 6, row++) {
      this.line(x + 1, yy, x + w - 1, yy, { cls: 'pw-ink pw-fine', tremor: 0.2 });
      for (var xx = x + (row % 2 ? 5 : 10); xx < x + w - 3; xx += 11) this.line(xx, yy - 6, xx, yy, { cls: 'pw-ink pw-fine', tremor: 0.1 });
    }
  };
  // windows: inked solid, arched or square, sometimes with a sill and bars
  Pen.prototype.window = function (x, y, w, h, kind) {
    var r = this.r;
    if (kind === 'arch') {
      var pts = [[x, y + h], [x, y + w / 2]];
      for (var a = 0; a <= 8; a++) { var t = Math.PI + a / 8 * Math.PI; pts.push([x + w / 2 + Math.cos(t) * w / 2, y + w / 2 + Math.sin(t) * w / 2]); }
      pts.push([x + w, y + h]);
      this.fill(pts);
      this.line(x - 2, y + h + 1.5, x + w + 2, y + h + 1.5, { cls: 'pw-ink pw-fine' });
    } else if (kind === 'round') {
      var c = [];
      for (var k = 0; k <= 10; k++) { var b = k / 10 * Math.PI * 2; c.push([x + w / 2 + Math.cos(b) * w / 2, y + w / 2 + Math.sin(b) * w / 2]); }
      this.path(c, { tremor: 0.2 });
      this.fill(c.map(function (p) { return [x + w / 2 + (p[0] - x - w / 2) * 0.55, y + w / 2 + (p[1] - y - w / 2) * 0.55]; }));
    } else {
      this.rect(x, y, w, h, { cls: 'pw-ink pw-fine' });
      this.fill([[x + 1.5, y + 1.5], [x + w - 1.5, y + 1.5], [x + w - 1.5, y + h - 1.5], [x + 1.5, y + h - 1.5]]);
      if (r() < 0.5) this.line(x + w / 2, y + 1, x + w / 2, y + h - 1, { cls: 'pw-ink pw-paper' });
      this.line(x - 2, y + h + 1.5, x + w + 2, y + h + 1.5, { cls: 'pw-ink pw-fine' });
    }
  };
  Pen.prototype.flag = function (x, y, h, dir) {
    this.line(x, y, x, y - h, { cls: 'pw-ink pw-fine' });
    this.fill([[x, y - h], [x + 11 * dir, y - h + 3], [x, y - h + 7]]);
  };
  // a cone roof with rows of shingles and a finial
  Pen.prototype.cone = function (x, y, w, h, flagDir) {
    var cx = x + w / 2, top = y - h;
    this.line(x - 3, y, cx, top); this.line(cx, top, x + w + 3, y); this.line(x - 4, y, x + w + 4, y);
    for (var t = 0.22; t < 0.95; t += 0.16) {
      var yy = top + h * t, half = (w / 2 + 3) * t, pts = [];
      for (var k = 0; k <= 6; k++) pts.push([cx - half + 2 * half * k / 6, yy + Math.sin(k / 6 * Math.PI) * 2.2]);
      this.path(pts, { cls: 'pw-ink pw-fine', tremor: 0.2 });
    }
    if (flagDir) this.flag(cx, top, 18, flagDir);
  };
  Pen.prototype.gable = function (x, y, w, h) {
    var cx = x + w / 2;
    this.line(x - 5, y, cx, y - h); this.line(cx, y - h, x + w + 5, y); this.line(x - 5, y, x + w + 5, y);
    for (var yy = y - h + 6; yy < y - 2; yy += 4.5) {
      var t = (yy - (y - h)) / h, half = (w / 2 + 5) * t;
      this.line(cx - half + 1, yy, cx + half - 1, yy, { cls: 'pw-ink pw-fine', tremor: 0.15 });
    }
  };
  // a balcony sticking out of a wall: deck, posts, rail and a bracket
  Pen.prototype.balcony = function (x, y, w, dir) {
    var x2 = x + w * dir, lo = Math.min(x, x2), hi = Math.max(x, x2);
    this.line(lo, y, hi, y); this.line(lo, y + 4, hi, y + 4);
    this.line(lo, y - 12, hi, y - 12, { cls: 'pw-ink pw-fine' });
    for (var px = lo + 2; px <= hi - 1; px += 5) this.line(px, y - 12, px, y, { cls: 'pw-ink pw-fine', tremor: 0.1 });
    this.line(x2 - dir * 4, y + 4, x + dir * 2, y + 22, { cls: 'pw-ink pw-fine' });
  };
  // a line hung with washing, sagging between two points
  Pen.prototype.washing = function (x1, y1, x2, y2) {
    var r = this.r, sag = 14 + r() * 10, pts = [];
    for (var k = 0; k <= 12; k++) { var t = k / 12; pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag]); }
    this.path(pts, { cls: 'pw-ink pw-fine', tremor: 0.15 });
    var items = 3 + Math.floor(r() * 3);
    for (var i = 0; i < items; i++) {
      var t = (i + 0.7) / (items + 0.6), px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * sag;
      var w = 7 + r() * 6, h = 9 + r() * 9;
      if (r() < 0.5) this.path([[px, py], [px - 1, py + h], [px + w * 0.45, py + h - 2], [px + w * 0.5, py + 4], [px + w * 0.55, py + h - 2], [px + w + 1, py + h], [px + w, py]], { cls: 'pw-ink pw-fine', tremor: 0.2 });
      else this.path([[px, py], [px - 1, py + h], [px + w, py + h + 1], [px + w, py]], { cls: 'pw-ink pw-fine', tremor: 0.25 });
    }
  };
  Pen.prototype.bird = function (x, y, s) {
    this.path([[x - s, y - s * 0.4], [x - s * 0.4, y - s * 0.5], [x, y], [x + s * 0.5, y - s * 0.6], [x + s * 1.1, y - s * 0.5]], { cls: 'pw-ink pw-fine', tremor: 0.08 });
  };
  Pen.prototype.kite = function (x, y, s) {
    this.path([[x, y - s], [x + s * 0.6, y], [x, y + s * 1.2], [x - s * 0.6, y], [x, y - s]], { tremor: 0.15 });
    this.line(x, y - s, x, y + s * 1.2, { cls: 'pw-ink pw-fine' }); this.line(x - s * 0.6, y, x + s * 0.6, y, { cls: 'pw-ink pw-fine' });
    var r = this.r, pts = [[x, y + s * 1.2]];
    for (var k = 1; k <= 8; k++) pts.push([x + Math.sin(k * 0.9) * 5 + k * 1.5, y + s * 1.2 + k * 8]);
    this.path(pts, { cls: 'pw-ink pw-fine', tremor: 0.3 });
  };
  Pen.prototype.tree = function (x, y, h) {
    var self = this, r = this.r;
    (function branch(x0, y0, len, ang, depth) {
      var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      self.path([[x0, y0], [(x0 + x1) / 2 + (r() - 0.5) * 3, (y0 + y1) / 2], [x1, y1]], { cls: depth < 2 ? 'pw-ink' : 'pw-ink pw-fine', tremor: 0.2 });
      if (depth >= 4) return;
      var n = 2 + (r() < 0.3 ? 1 : 0);
      for (var i = 0; i < n; i++) branch(x1, y1, len * (0.62 + r() * 0.15), ang + (i - (n - 1) / 2) * (0.5 + r() * 0.3), depth + 1);
    })(x, y, h * 0.38, -Math.PI / 2, 0);
  };
  // a run of steps built of rough stones
  Pen.prototype.stair = function (x, y, w, h, steps) {
    var sw = w / steps, sh = h / steps, pts = [[x, y]];
    for (var i = 0; i < steps; i++) { pts.push([x + i * sw, y - (i + 1) * sh]); pts.push([x + (i + 1) * sw, y - (i + 1) * sh]); }
    this.path(pts, { tremor: 0.3 });
    for (i = 0; i < steps; i++) this.stones(x + i * sw, y - (i + 1) * sh, w - i * sw, sh, 6);
  };
  // two arches carrying a deck: the bridge in the reference drawing
  Pen.prototype.bridge = function (x, y, w, h) {
    this.rect(x, y, w, 10); this.line(x - 6, y, x + w + 6, y);
    this.planks(x, y + 10, w, h - 10, 5, true);
    var aw = w * 0.3, gaps = [x + w * 0.12, x + w * 0.58];
    var self = this;
    gaps.forEach(function (ax) {
      var top = y + 26, bot = y + h, rr = aw / 2, outer = [], inner = [];
      outer.push([ax, bot]);
      for (var a = 0; a <= 10; a++) { var t = Math.PI + a / 10 * Math.PI; outer.push([ax + rr + Math.cos(t) * rr, top + rr + Math.sin(t) * rr]); }
      outer.push([ax + aw, bot]);
      self.path(outer, { tremor: 0.3 });
      self.fill([[ax + 3, bot], [ax + 3, top + rr]].concat(outer.slice(2, -2).map(function (p) { return [ax + rr + (p[0] - ax - rr) * 0.86, top + rr + (p[1] - top - rr) * 0.86 + 2]; })).concat([[ax + aw - 3, top + rr], [ax + aw - 3, bot]])).setAttribute('class', 'pw-fill pw-paperfill');
      for (var s = 0; s <= 12; s++) {
        var b = Math.PI + s / 12 * Math.PI, px = ax + rr + Math.cos(b) * (rr - 3), py = top + rr + Math.sin(b) * (rr - 3);
        self.stone(px, py, 3.2, 2.6);
      }
      for (var yy = top + rr + 6; yy < bot - 3; yy += 7) { self.stone(ax + 3, yy, 2.6, 3.2); self.stone(ax + aw - 3, yy, 2.6, 3.2); }
    });
  };

  // A stacked tower: storeys of different widths and textures, each with
  // windows, sometimes a balcony; a roof on top with a flag.
  function tower(pen, cx, baseY, maxH, r, shadows) {
    var y = baseY, storeys = 4 + Math.floor(r() * 3), used = 0, tops = [], cap = maxH - 46;
    var w = 58 + r() * 20, x = cx - w / 2;
    for (var s = 0; s < storeys && used < cap - 20; s++) {
      var h = 34 + r() * 26;
      if (used + h > cap) h = Math.max(28, cap - used);
      var top = y - h;
      pen.rect(x, top, w, h);
      var tex = ['stones', 'planks', 'bricks', 'plain'][Math.floor(r() * 4)];
      if (tex === 'stones') pen.stones(x, top, w, h, 7);
      else if (tex === 'planks') pen.planks(x, top, w, h, 4.5, r() < 0.5);
      else if (tex === 'bricks') pen.bricks(x, top, w, h);
      var kind = ['arch', 'square', 'square', 'round'][Math.floor(r() * 4)];
      var cols = w > 66 ? 3 : 2, ww = kind === 'round' ? 11 : 9, gap = (w - cols * ww) / (cols + 1);
      var wh = kind === 'arch' ? 14 : 10, rows = h > 54 ? 2 : 1;
      for (var row = 0; row < rows; row++) {
        for (var c = 0; c < cols; c++) pen.window(x + gap + c * (ww + gap), top + 8 + row * (h / rows), ww, Math.min(wh, h / rows - 12), kind);
      }
      // a ledge under each storey, the stone course the eye reads as a floor
      pen.line(x - 3, y - 1, x + w + 3, y - 1, { cls: 'pw-ink pw-fine' });
      shadows.push([[x + w * 0.7, top + 2], [x + w - 1, top + 2], [x + w - 1, y - 2], [x + w * 0.7, y - 2]]);
      // now and then a little turret corbelled out of the corner
      if (s > 0 && r() < 0.35) {
        var tl = r() < 0.5, tw = 14 + r() * 6, tx = tl ? x - tw + 4 : x + w - 4, th = Math.min(h - 6, 30);
        pen.rect(tx, top + 4, tw, th, { cls: 'pw-ink pw-fine' });
        pen.path([[tx, top + 4 + th], [tx + tw / 2, top + th + 16], [tx + tw, top + 4 + th]], { cls: 'pw-ink pw-fine', tremor: 0.2 });
        pen.window(tx + tw / 2 - 2.5, top + 10, 5, 10, 'square');
        pen.cone(tx, top + 4, tw, 22 + r() * 10, 0);
      }
      if (r() < 0.55) {
        var dir = r() < 0.5 ? -1 : 1, bx = dir < 0 ? x : x + w;
        pen.balcony(bx, top + h * 0.45, 22 + r() * 14, dir);
        tops.push([bx + dir * 28, top + h * 0.45 - 12]);
      }
      tops.push([dir < 0 ? x : x + w, top + 8]);
      used += h; y = top;
      // the next storey sits a little off-centre, narrower or wider
      var nw = Math.max(40, w + (r() - 0.6) * 22);
      x = Math.min(Math.max(x + (w - nw) / 2 + (r() - 0.5) * 14, cx - 60), cx + 60 - nw);
      w = nw;
    }
    if (r() < 0.6) pen.cone(x - 2, y, w + 4, 40 + r() * 30, r() < 0.5 ? 1 : -1);
    else { pen.gable(x, y, w, 26 + r() * 10); pen.flag(x + w / 2, y - 30, 16, 1); }
    shadows.push([[x + w * 0.55, y - 30], [x + w, y - 2], [x + w * 0.55, y - 2]]);
    return { top: y, left: x, right: x + w, anchors: tops };
  }

  function birds(pen, r, x, y, w, h, n) {
    for (var i = 0; i < n; i++) pen.bird(x + r() * w, y + r() * h, 4 + r() * 3);
  }

  // Each chapter gets its own little place, all on 400 x 460.
  var SCENES = [
    function (pen, r, sh) { // two towers on an arched bridge, with steps and washing
      pen.bridge(110, 330, 230, 110);
      pen.stair(30, 440, 90, 110, 9);
      var a = tower(pen, 160, 330, 260, r, sh), b = tower(pen, 290, 330, 230, r, sh);
      pen.washing(a.right + 4, a.top + 70, b.left - 4, b.top + 60);
      pen.washing(a.right + 4, 250, b.left - 4, 240);
      pen.kite(230, 70, 12);
      pen.tree(370, 440, 70);
      birds(pen, r, 200, 40, 160, 80, 4);
      pen.line(0, 440, 400, 440);
    },
    function (pen, r, sh) { // a single tall tower on a stone hill
      pen.path([[20, 440], [90, 420], [140, 395], [260, 395], [320, 420], [390, 440]], { tremor: 0.5 });
      pen.stones(130, 398, 140, 34, 8);
      var t = tower(pen, 200, 397, 330, r, sh);
      pen.line(t.right, t.top + 120, t.right + 30, t.top + 120, { cls: 'pw-ink pw-fine' });
      pen.line(t.right + 26, t.top + 120, t.right + 26, t.top + 160, { cls: 'pw-ink pw-fine' });
      pen.rect(t.right + 18, t.top + 160, 16, 12, { cls: 'pw-ink pw-fine' });
      birds(pen, r, 40, 60, 120, 100, 5);
      pen.tree(70, 432, 60);
    },
    function (pen, r, sh) { // a crooked street of narrow houses
      var x = 30;
      for (var i = 0; i < 4; i++) {
        var w = 70 + r() * 14, h = 120 + r() * 120, top = 440 - h;
        pen.rect(x, top, w, h);
        if (i % 2) pen.planks(x, top, w, h, 5, true); else pen.stones(x, top, w, h, 7);
        for (var yy = top + 16; yy < 420; yy += 34) { pen.window(x + 12, yy, 10, 14, 'square'); pen.window(x + w - 22, yy, 10, 14, 'square'); }
        pen.gable(x, top, w, 26 + r() * 12);
        pen.rect(x + w * 0.6, top - 34, 8, 16, { cls: 'pw-ink pw-fine' });
        sh.push([[x + w * 0.65, top], [x + w, top], [x + w, 440], [x + w * 0.65, 440]]);
        if (i < 3) pen.washing(x + w, top + 40, x + w + 24, top + 50);
        x += w + 18 + r() * 6;
      }
      birds(pen, r, 60, 30, 260, 60, 4);
      pen.line(0, 440, 400, 440);
    },
    function (pen, r, sh) { // a gate between two turrets
      pen.rect(110, 300, 180, 140); pen.stones(110, 300, 180, 140, 8);
      for (var c = 0; c < 9; c++) pen.rect(112 + c * 20, 288, 12, 12, { cls: 'pw-ink pw-fine' });
      pen.window(170, 360, 60, 80, 'arch');
      var a = tower(pen, 95, 440, 290, r, sh), b = tower(pen, 305, 440, 270, r, sh);
      pen.washing(a.right, a.top + 50, b.left, b.top + 40);
      birds(pen, r, 150, 60, 120, 80, 4);
      pen.line(0, 440, 400, 440);
    },
    function (pen, r, sh) { // a lighthouse-like tower above water
      var t = tower(pen, 220, 410, 340, r, sh);
      pen.path([[60, 410], [160, 404], [300, 408], [380, 412]], { tremor: 0.5 });
      for (var k = 0; k < 7; k++) pen.line(40 + r() * 300, 420 + k * 5, 70 + r() * 300, 420 + k * 5, { cls: 'pw-ink pw-fine' });
      pen.path([[60, 404], [70, 392], [120, 392], [130, 404], [60, 404]], { tremor: 0.3 });
      pen.line(95, 392, 95, 350); pen.fill([[95, 352], [118, 386], [95, 386]]);
      birds(pen, r, 40, 40, 120, 120, 5);
    },
    function (pen, r, sh) { // a clock tower with a round face
      var t = tower(pen, 200, 440, 300, r, sh);
      var cx = (t.left + t.right) / 2, cy = t.top + 34, face = [];
      for (var k = 0; k <= 16; k++) { var a = k / 16 * Math.PI * 2; face.push([cx + Math.cos(a) * 15, cy + Math.sin(a) * 15]); }
      pen.fill(face).setAttribute('class', 'pw-fill pw-paperfill');
      pen.path(face, { tremor: 0.2 });
      pen.line(cx, cy, cx + 1, cy - 10); pen.line(cx, cy, cx + 7, cy + 3, { cls: 'pw-ink pw-fine' });
      for (k = 0; k < 12; k++) { var b = k / 12 * Math.PI * 2; pen.line(cx + Math.cos(b) * 12, cy + Math.sin(b) * 12, cx + Math.cos(b) * 14, cy + Math.sin(b) * 14, { cls: 'pw-ink pw-fine', tremor: 0 }); }
      pen.line(0, 440, 400, 440);
      pen.tree(70, 440, 90); pen.tree(340, 440, 60);
      birds(pen, r, 230, 40, 120, 80, 3);
    }
  ];

  function bloomFor(section, i) {
    var holder = document.createElement('div');
    holder.className = 'pw-bloom pw-scene ' + (i % 2 ? 'pw-bloom--left' : 'pw-bloom--right');
    holder.setAttribute('aria-hidden', 'true');
    section.insertBefore(holder, section.firstChild);
    var paint = function () {
      var r = rng(500 + i * 37), shadows = [];
      var svg = svgEl('0 0 400 460', 'pw-svg');
      SCENES[i % SCENES.length](new Pen(svg, r), r, shadows);
      // spread the drawing over the same time however busy the scene is
      var kids = svg.children, nk = kids.length || 1;
      for (var k = 0; k < kids.length; k++) kids[k].style.setProperty('--t', (k / nk).toFixed(3));
      var p = paintCanvas(400, 460, Math.min(1.5, window.devicePixelRatio || 1));
      var wr = rng(900 + i);
      // the shadow sides laid in grey
      shadows.forEach(function (s) {
        wash(p.ctx, { pts: box(s, wr, 0.25), color: GREY.mid, alpha: 0.05, layers: 6, wet: 0.05, spread: 0.04, raw: true }, wr);
      });
      wash(p.ctx, { cx: 200, cy: 448, rx: 190, ry: 10, color: GREY.mid, alpha: 0.035, layers: 12, wet: 0.2, spread: 0.1 }, wr);
      granulate(p.ctx, 400, 460, wr, 200);
      p.c.className = 'pw-canvas';
      holder.appendChild(p.c);
      holder.appendChild(svg);
      holder.classList.add('pw-ready');
    };
    return { el: holder, paint: paint };
  }

  // ---- the app's shader --------------------------------------------------------
  // The sky only shows a shader when the app sends one of its own.
  function skyShader(sky) {
    function show() { sky.classList.add('pw-sky--on'); document.documentElement.classList.add('pw-has-shader'); }
    window.addEventListener('portfolio:shader', function (e) {
      if (e && typeof e.detail === 'string' && e.detail.trim()) show();
    });
    var check = function () { setTimeout(function () { if (window.__PORTFOLIO_ACTIVE_SHADER__ === 'custom') show(); }, 600); };
    if (document.readyState === 'complete') check(); else window.addEventListener('load', check);
  }

  // ---- page furniture -------------------------------------------------------
  function headText(section) {
    var h = section.querySelector('.section__head h2');
    return h ? h.textContent.trim() : '';
  }

  function buildNav() {
    var nav = document.createElement('nav');
    nav.className = 'pw-nav';
    nav.setAttribute('aria-label', 'Sections');
    var home = document.createElement('a');
    home.className = 'pw-nav__home';
    home.href = '#top';
    home.textContent = (document.querySelector('.hero-name') || {}).textContent || 'Home';
    nav.appendChild(home);
    var list = document.createElement('div');
    list.className = 'pw-nav__links';
    [['#work', 'Work'], ['#more-work', 'Projects'], ['#research', 'Research'], ['#talks', 'Notes'], ['#about', 'About'], ['#learn-for-free', 'Learn']].forEach(function (l) {
      if (!document.querySelector(l[0])) return;
      var a = document.createElement('a');
      a.href = l[0]; a.textContent = l[1];
      list.appendChild(a);
    });
    nav.appendChild(list);
    document.body.insertBefore(nav, document.body.firstChild);

    // tuck away while reading down, come back when scrolling up
    var last = 0, hidden = false;
    window.addEventListener('scroll', function () {
      var y = window.scrollY, down = y > last + 4, up = y < last - 4;
      if (down && y > 140 && !hidden) { nav.classList.add('pw-nav--away'); hidden = true; }
      else if (up && hidden) { nav.classList.remove('pw-nav--away'); hidden = false; }
      nav.classList.toggle('pw-nav--paper', y > 40);
      if (down || up) last = y;
    }, { passive: true });
  }

  function chapters() {
    var blooms = [];
    var list = document.querySelectorAll('main > .section');
    var n = 0;
    list.forEach(function (s, i) {
      s.classList.add('pw-chapter');
      var head = s.querySelector('.section__head');
      if (head) head.classList.add('pw-lead');
      var h2 = head && head.querySelector('h2');
      if (h2) h2.classList.add('pw-h-major');
      if (head && !head.querySelector('.pw-num')) {
        var num = document.createElement('span');
        num.className = 'pw-num';
        num.setAttribute('aria-hidden', 'true');
        num.textContent = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'][n++] || '';
        head.insertBefore(num, head.firstChild);
      }
      blooms.push(bloomFor(s, i));
    });
    return blooms;
  }

  // Short pen lines between list entries and under action links are CSS;
  // the shared stroke is made here once so every one looks drawn.
  function penStrokeURL(seed, w, h) {
    var r = rng(seed), pts = [], N = 30;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      pts.push([2 + t * (w - 6), h / 2 + Math.sin(t * 3.1 + seed) * 0.9 + gauss(r) * 0.25 + (t < 0.05 ? (0.05 - t) * 30 : 0)]);
    }
    var d = smooth(pts);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><path d="' + d + '" fill="none" stroke="#2c2b24" stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".75"/></svg>';
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function strokes() {
    root.style.setProperty('--pw-pen-1', penStrokeURL(3, 300, 8));
    root.style.setProperty('--pw-pen-2', penStrokeURL(9, 300, 8));
    root.style.setProperty('--pw-pen-long', penStrokeURL(21, 1200, 8));
    // a watercolour-edged mask for photos and portraits
    var p = paintCanvas(300, 300, 1), r = rng(55);
    wash(p.ctx, { cx: 150, cy: 150, rx: 128, ry: 128, color: [0, 0, 0], alpha: 0.09, layers: 24, wet: 0.3, spread: 0.16, raw: true }, r);
    root.style.setProperty('--pw-mask-round', 'url("' + p.c.toDataURL('image/png') + '")');
    var q = paintCanvas(400, 300, 1), r2 = rng(66);
    wash(q.ctx, { cx: 200, cy: 150, rx: 190, ry: 140, color: [0, 0, 0], alpha: 0.09, layers: 24, wet: 0.25, spread: 0.12, n: 14, raw: true }, r2);
    root.style.setProperty('--pw-mask-rect', 'url("' + q.c.toDataURL('image/png') + '")');
    // four hover washes for entries
    [GREY.light, GREY.mid, GREY.light, GREY.mid].forEach(function (col, k) {
      var c = paintCanvas(420, 300, 1), rr = rng(90 + k);
      wash(c.ctx, { cx: 210, cy: 150, rx: 170, ry: 115, color: col, alpha: 0.022, layers: 24 }, rr);
      backruns(c.ctx, { cx: 210, cy: 150, rx: 150, ry: 100, count: 6, size: 22 }, rr);
      root.style.setProperty('--pw-wash-' + k, 'url("' + c.c.toDataURL('image/png') + '")');
    });
  }

  function tintEntries() {
    var k = 0;
    document.querySelectorAll('.card, .panel').forEach(function (el) {
      if (el.dataset.pwTint) return;
      el.dataset.pwTint = '1';
      el.style.setProperty('--pw-wash', 'var(--pw-wash-' + (k++ % 4) + ')');
    });
  }

  // ---- things arrive gently -----------------------------------------------------
  var io = null;
  function watch(el) {
    if (el.dataset.pwSeen) return;
    el.dataset.pwSeen = '1';
    if (!io) { el.classList.add('pw-in'); return; }
    el.classList.add('pw-rv');
    io.observe(el);
  }
  function reveal(blooms) {
    if (!reduceMotion && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target, i = 0;
          if (el.parentElement && /\b(grid|split|mini-grid|duo-grid)\b/.test(el.parentElement.className)) {
            i = Array.prototype.indexOf.call(el.parentElement.children, el) % 3;
          }
          el.style.setProperty('--d', (i * 90) + 'ms');
          el.classList.add('pw-in');
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    }
    var sel = '.section__head, .card, .panel, .row, .mini-card, .about, .pillrow__wrap, .lang-trigger, .section__foot, .pw-bloom';
    document.querySelectorAll(sel).forEach(function (el) { if (!el.closest('[role="dialog"]')) watch(el); });

    // Blooms are painted only as they come near, so the page loads light.
    var bo = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var b = blooms.filter(function (x) { return x.el === e.target; })[0];
        if (b && !b.done) { b.done = true; b.paint(); }
        bo.unobserve(e.target);
      });
    }, { rootMargin: '400px 0px' }) : null;
    blooms.forEach(function (b) { if (bo) bo.observe(b.el); else { b.done = true; b.paint(); } });

    // Content the site's data scripts add later gets the same treatment.
    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () {
        tintEntries();
        document.querySelectorAll(sel).forEach(function (el) { if (!el.closest('[role="dialog"]')) watch(el); });
      });
      mo.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    }
  }

  // ---- sections as lists ------------------------------------------------------------
  // Every group of entries becomes a numbered list: one line per entry with
  // its title and a one-line summary. Clicking a line opens it in place,
  // with the project's video (or a small pen drawing when there is none)
  // beside the details and links. The entries stay where the data scripts
  // put them; what opens underneath is a copy.

  var ENTRY = 'article.card, .panel, .row';
  var BOXES = 'main .grid, main .split, main .list';
  var actionKey = 0;

  function hashStr(t) { var h = 7; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }

  // A wide pen skyline for entries without a video: a few towers and
  // houses on a line of ground, different for every title.
  function vignette(seed) {
    var holder = document.createElement('div');
    holder.className = 'pw-vignette';
    var r = rng(seed), sh = [], G = 330;
    var svg = svgEl('0 0 640 400', 'pw-svg');
    var pen = new Pen(svg, r);
    pen.path([[20, G], [220, G - 1], [420, G + 1], [620, G]], { tremor: 0.4 });
    var x = 70 + r() * 30, n = 0;
    while (x < 600 && n < 6) {
      var kind = r();
      if (kind < 0.55) {
        var t = tower(pen, x, G, 150 + r() * 150, r, sh);
        x = t.right + 30 + r() * 30;
      } else {
        var w = 50 + r() * 26, h = 50 + r() * 40, top = G - h;
        pen.rect(x - w / 2, top, w, h);
        if (r() < 0.5) pen.stones(x - w / 2, top, w, h, 7); else pen.planks(x - w / 2, top, w, h, 5, true);
        pen.window(x - w / 2 + 9, top + 14, 9, 12, 'square'); pen.window(x + w / 2 - 18, top + 14, 9, 12, 'square');
        pen.rect(x - 5, G - 18, 10, 18, { cls: 'pw-ink pw-fine' });
        pen.gable(x - w / 2, top, w, 22 + r() * 12);
        sh.push([[x + w * 0.2, top + 2], [x + w / 2 - 1, top + 2], [x + w / 2 - 1, G - 2], [x + w * 0.2, G - 2]]);
        x += w / 2 + 40 + r() * 30;
      }
      n++;
    }
    for (var k = 0; k < 5; k++) pen.line(40 + r() * 480, G + 12 + k * 9, 90 + r() * 520, G + 12 + k * 9, { cls: 'pw-ink pw-fine' });
    if (r() < 0.6) pen.kite(80 + r() * 480, 60 + r() * 40, 11);
    birds(pen, r, 60, 30, 520, 60, 3 + Math.floor(r() * 3));
    if (r() < 0.6) pen.tree(r() < 0.5 ? 40 : 610, G, 90 + r() * 40);
    var kids = svg.children, nk = kids.length || 1;
    for (k = 0; k < kids.length; k++) kids[k].style.setProperty('--t', (k / nk).toFixed(3));
    var p = paintCanvas(640, 400, Math.min(1.5, window.devicePixelRatio || 1)), wr = rng(seed + 1);
    sh.forEach(function (s) {
      wash(p.ctx, { pts: box(s, wr, 0.25), color: GREY.mid, alpha: 0.05, layers: 6, wet: 0.05, spread: 0.04, raw: true }, wr);
    });
    p.c.className = 'pw-canvas';
    holder.appendChild(p.c);
    holder.appendChild(svg);
    return holder;
  }

  function previewOf(entry) {
    var inner = document.createElement('div');
    inner.className = 'pw-pv__inner';
    var media = document.createElement('div');
    media.className = 'pw-pv__media';
    var title = ((entry.querySelector('h3') || {}).textContent || '').trim();
    var src = entry.getAttribute('data-video');
    var drawing = function () {
      media.className = 'pw-pv__media pw-pv__media--ink';
      media.innerHTML = '';
      var v = vignette(hashStr(title) % 997 + 11);
      media.appendChild(v);
      requestAnimationFrame(function () { requestAnimationFrame(function () { v.classList.add('pw-go'); }); });
    };
    if (src) {
      var video = document.createElement('video');
      video.src = src; video.muted = true; video.loop = true; video.autoplay = true;
      video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'metadata';
      video.addEventListener('error', drawing);
      media.className = 'pw-pv__media pw-pv__media--video';
      media.appendChild(video);
      video.play && video.play().catch(function () {});
    } else drawing();
    inner.appendChild(media);

    // the entry's own content, copied; buttons in the copy press the real ones
    entry.querySelectorAll('button, [role="button"], a:not([href]), a[href="#"]').forEach(function (b) {
      if (!b.dataset.pwKey) b.dataset.pwKey = String(++actionKey);
    });
    var body = document.createElement('div');
    body.className = 'pw-pv__body';
    Array.prototype.forEach.call(entry.childNodes, function (n) {
      if (n.nodeType === 1 && n.matches('video, .card__previewBtn, .card__previewLayer, .pw-item__n, .pw-item__x, br')) return;
      body.appendChild(n.cloneNode(true));
    });
    body.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
    body.querySelectorAll('.pw-rv').forEach(function (el) { el.classList.remove('pw-rv'); });
    body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pw-key]');
      if (!t) return;
      var real = entry.querySelector('[data-pw-key="' + t.dataset.pwKey + '"]');
      if (real) { e.preventDefault(); real.click(); }
    });
    inner.appendChild(body);
    return inner;
  }

  function stopVideos(el) { el.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (_) {} }); }

  function openItem(box, it) {
    var pane = box.querySelector(':scope > .pw-pv');
    var was = box.querySelector(':scope > .pw-item.pw-open');
    if (was) { was.classList.remove('pw-open'); was.setAttribute('aria-expanded', 'false'); }
    stopVideos(pane);
    pane.classList.remove('pw-pv--on');
    pane.innerHTML = '';
    if (was === it) return;            // a second click folds it away
    it.classList.add('pw-open'); it.setAttribute('aria-expanded', 'true');
    var inner = previewOf(it);
    if (!inner.querySelector('.pw-pv__body').textContent.trim()) inner.classList.add('pw-pv__inner--solo');
    pane.appendChild(inner);
    if (it.nextSibling !== pane) box.insertBefore(pane, it.nextSibling);
    requestAnimationFrame(function () {
      pane.classList.add('pw-pv--on');
      var b = it.getBoundingClientRect();
      if (b.top < 70 || b.top > innerHeight * 0.55) window.scrollTo({ top: window.scrollY + b.top - 90, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function indexify(box) {
    if (box.closest('[role="dialog"]') || box.matches(DECKS)) return;
    var items = Array.prototype.filter.call(box.children, function (c) { return c.matches(ENTRY); });
    if (!items.length) return;
    box.classList.add('pw-index');
    var pane = box.querySelector(':scope > .pw-pv');
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'pw-pv';
      pane.setAttribute('aria-live', 'polite');
      box.appendChild(pane);
    }
    items.forEach(function (it, k) {
      var n = it.querySelector(':scope > .pw-item__n');
      if (!n) {
        n = document.createElement('span');
        n.className = 'pw-item__n';
        n.setAttribute('aria-hidden', 'true');
        it.insertBefore(n, it.firstChild);
        var x = document.createElement('span');
        x.className = 'pw-item__x';
        x.setAttribute('aria-hidden', 'true');
        it.appendChild(x);
      }
      n.textContent = (k + 1 < 10 ? '0' : '') + (k + 1);
      if (it.dataset.pwItem) return;
      it.dataset.pwItem = '1';
      it.classList.add('pw-item');
      it.setAttribute('tabindex', '0');
      it.setAttribute('role', 'button');
      it.setAttribute('aria-expanded', 'false');
      it.addEventListener('click', function (e) {
        if (e.target.closest('a[href]:not([href="#"]), button')) return;
        openItem(box, it);
      });
      it.addEventListener('keydown', function (e) {
        if (e.target !== it || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); openItem(box, it);
      });
    });
    var open = box.querySelector(':scope > .pw-item.pw-open');
    if (open && !pane.firstChild) { open.classList.remove('pw-open'); open.setAttribute('aria-expanded', 'false'); }
  }

  function indexes() {
    var all = function () { document.querySelectorAll(BOXES).forEach(indexify); };
    all();
    if ('MutationObserver' in window) {
      var queued = false;
      new MutationObserver(function (ms) {
        // ignore the preview's own changes
        if (ms.every(function (m) { return m.target.closest && m.target.closest('.pw-pv'); })) return;
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; all(); });
      }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    }
  }

  // ---- projects as postcards -----------------------------------------------------------
  // Each project is a postcard laid open: the picture side on the left (its
  // video, or a pen drawing when there is none) and the written side on the
  // right, with a stamp and a postmark carrying the project's status. The
  // card's own content is not moved; the picture, stamp and postmark are
  // added around it.

  var DECKS = '#selected_work, #more_projects, #more_projects_fallback';

  function shortTitle(t) { return t.split(/[:—(]| - /)[0].trim(); }

  function stampArt(seed) {
    var r = rng(seed), svg = svgEl('0 0 120 150', 'pw-svg');
    var pen = new Pen(svg, r);
    pen.line(6, 138, 114, 138);
    tower(pen, 60, 138, 132, r, []);
    birds(pen, r, 10, 10, 30, 20, 2);
    return svg;
  }

  var pcSeen = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target.querySelector('video');
      if (e.isIntersecting) {
        var ink = e.target.querySelector('.pw-vignette');
        if (ink) ink.classList.add('pw-go');
      } else if (v) { try { v.pause(); } catch (_) {} }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }) : null;

  function postcard(card, k) {
    if (card.dataset.pc) return;
    card.dataset.pc = '1';
    card.classList.add('pc');
    var title = ((card.querySelector('h3') || {}).textContent || '').trim();
    var seed = hashStr(title) % 997 + 11;

    // the picture side
    var pic = document.createElement('div');
    pic.className = 'pc-pic';
    pic.setAttribute('aria-hidden', 'true');
    var frame = document.createElement('div');
    frame.className = 'pc-pic__frame';
    var src = card.getAttribute('data-video');
    var drawing = function () {
      frame.innerHTML = '';
      frame.classList.remove('pc-pic__frame--video');
      var v = vignette(seed);
      frame.appendChild(v);
      if (!pcSeen) v.classList.add('pw-go');
    };
    if (src) {
      var video = document.createElement('video');
      video.src = src; video.muted = true; video.loop = true;
      video.playsInline = true; video.setAttribute('playsinline', ''); video.preload = 'metadata';
      video.addEventListener('error', function () { drawing(); if (pcSeen) setTimeout(function () { frame.querySelector('.pw-vignette') && frame.querySelector('.pw-vignette').classList.add('pw-go'); }, 60); });
      frame.classList.add('pc-pic__frame--video');
      frame.appendChild(video);
      // pen art covers the video until it plays
      var art = vignette(seed);
      art.classList.add('pc-pic__art');
      if (!pcSeen) art.classList.add('pw-go');
      frame.appendChild(art);
      // videos only run while the pointer is on the card; on touch, a tap on the picture toggles it
      var play = function () { try { video.play().catch(function () {}); } catch (_) {} card.classList.add('pc--playing'); };
      var stop = function () { try { video.pause(); video.currentTime = 0; } catch (_) {} card.classList.remove('pc--playing'); };
      card.addEventListener('mouseenter', play);
      card.addEventListener('mouseleave', stop);
      pic.addEventListener('click', function () { if (matchMedia('(hover: hover)').matches) return; video.paused ? play() : stop(); });
    } else drawing();
    pic.appendChild(frame);
    var cap = document.createElement('div');
    cap.className = 'pc-pic__cap';
    cap.textContent = shortTitle(title);
    pic.appendChild(cap);
    card.insertBefore(pic, card.firstChild);

    // the stamp and the postmark
    var tags = card.querySelectorAll('.tag');
    var status = '';
    Array.prototype.some.call(tags, function (t) {
      if (/tag--alt/.test(t.className) && !t.matches('a')) { status = t.textContent.trim(); return true; }
      return false;
    });
    var corner = document.createElement('div');
    corner.className = 'pc-corner';
    corner.setAttribute('aria-hidden', 'true');
    var stamp = document.createElement('div');
    stamp.className = 'pc-stamp';
    var inner = document.createElement('div');
    inner.className = 'pc-stamp__in';
    inner.appendChild(stampArt(seed + 3));
    var val = document.createElement('span');
    val.className = 'pc-stamp__val';
    val.textContent = (k + 1 < 10 ? '0' : '') + (k + 1);
    inner.appendChild(val);
    stamp.appendChild(inner);
    corner.appendChild(stamp);
    var mark = document.createElement('div');
    mark.className = status ? 'pc-mark' : 'pc-mark pc-mark--blank';
    mark.innerHTML = '<svg class="pc-mark__waves" viewBox="0 0 120 40" preserveAspectRatio="none"><path d="M0 8 Q15 2 30 8 T60 8 T90 8 T120 8"/><path d="M0 20 Q15 14 30 20 T60 20 T90 20 T120 20"/><path d="M0 32 Q15 26 30 32 T60 32 T90 32 T120 32"/></svg><span class="pc-mark__ring"><span>' + (status || 'Sent') + '</span></span>';
    corner.appendChild(mark);
    card.insertBefore(corner, pic.nextSibling);
    card.style.setProperty('--pc-tilt', ((k % 2 ? 1 : -1) * (0.5 + (seed % 7) * 0.17)).toFixed(2) + 'deg');
    // about half are held up with a strip of tape
    if (seed % 2) {
      var tape = document.createElement('span');
      tape.className = 'pc-tape';
      tape.setAttribute('aria-hidden', 'true');
      tape.style.setProperty('--pc-tape', (((seed >> 3) % 9) - 4) + 'deg');
      card.insertBefore(tape, card.firstChild);
    }
    if (pcSeen) pcSeen.observe(card);
  }

  function postcards() {
    var all = function () {
      document.querySelectorAll(DECKS).forEach(function (deck) {
        if (deck.closest('[role="dialog"]')) return;
        var cards = Array.prototype.filter.call(deck.children, function (c) { return c.matches('article.card'); });
        if (!cards.length) return;
        deck.classList.add('pc-deck');
        var seen = {}, n = 0;
        cards.forEach(function (c) {
          var t = ((c.querySelector('h3') || {}).textContent || '').trim();
          if (t && seen[t]) { c.dataset.pc = 'dup'; return; }
          seen[t] = 1; postcard(c, n++);
        });
      });
    };
    all();
    if ('MutationObserver' in window) {
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; all(); });
      }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    }
  }

  // ---- a pen line under every section ------------------------------------------------
  // Drawn edge to edge across the window: a slow wobble with a slight
  // tremor, a second fainter pass beside it, inked in as it scrolls into view.
  function rulePath(r) {
    var pts = [], N = 60, ph = r() * 6, a1 = 1 + r() * 1.6, a2 = 0.4 + r() * 0.6;
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      pts.push([t * 1000, 7 + Math.sin(t * Math.PI * 1.4 + ph) * a1 + Math.sin(t * Math.PI * 7 + ph * 2) * a2 * 0.5 + (r() - 0.5) * 0.5]);
    }
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(2);
    for (i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ' Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(2) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(2);
    }
    return d;
  }

  function sectionRules() {
    var secs = document.querySelectorAll('main > section, body > section');
    secs.forEach(function (sec, i) {
      if (sec.querySelector(':scope > .pw-rule')) return;
      var r = rng(4100 + i * 13);
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'pw-rule');
      svg.setAttribute('viewBox', '0 0 1000 14');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      ['pw-rule__main', 'pw-rule__ghost'].forEach(function (cls) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', rulePath(r));
        p.setAttribute('pathLength', '1');
        p.setAttribute('class', cls);
        svg.appendChild(p);
      });
      if (sec.classList.contains('marquee')) {
        // the marquee clips and fades its own edges, so its line sits just below it
        if (sec.nextElementSibling && sec.nextElementSibling.classList.contains('pw-rule')) return;
        svg.classList.add('pw-rule--after');
        sec.after(svg);
      } else sec.appendChild(svg);
      if (io) { svg.classList.add('pw-rv'); io.observe(svg); }
    });
  }

  function start() {
    strokes();
    buildNav();
    buildCover();
    var blooms = chapters();
    tintEntries();
    postcards();
    indexes();
    reveal(blooms);
    sectionRules();
    root.classList.add('pw-on');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
