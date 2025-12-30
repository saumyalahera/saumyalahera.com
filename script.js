const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

const menuBtn = document.querySelector('.menu');
const links = document.querySelector('.links');

if(menuBtn && links){
  menuBtn.addEventListener('click', () => {
    const open = menuBtn.getAttribute('aria-expanded') === 'true';
    menuBtn.setAttribute('aria-expanded', String(!open));
    links.style.display = open ? 'none' : 'flex';
    links.style.flexDirection = 'column';
    links.style.position = 'absolute';
    links.style.right = '22px';
    links.style.top = '62px';
    links.style.padding = '12px';
    links.style.background = 'rgba(11,11,16,.92)';
    links.style.border = '1px solid rgba(255,255,255,.10)';
    links.style.borderRadius = '14px';
    links.style.backdropFilter = 'blur(14px)';
  });
}

/* Tiny canvas shader-esque animation (2D default; optional WebGL GLSL override) */
let canvas = document.getElementById('shader');
let ctx = null;   // 2D
let gl = null;    // WebGL

function ensure2D() {
  if (!canvas) return null;

  // If we were running WebGL, stop it before taking a 2D context.
  if (gl || __glState) {
    try { stopWebGLShader(); } catch (_) {}
    gl = null;
  }

  if (!ctx) {
    // NOTE: creating a 2D context prevents WebGL on the same canvas.
    ctx = canvas.getContext('2d');
  }

  // Critical: apply DPR transform after switching/cloning
  try { resize(); } catch (_) {}

  return ctx;
}

function replaceCanvasPreservingLayout() {
  if (!canvas) return;
  const parent = canvas.parentNode;
  if (!parent) return;

  // Clone the element to get a fresh canvas without an existing context.
  const fresh = canvas.cloneNode(false);
  fresh.id = canvas.id; // keep id="shader"
  fresh.className = canvas.className;
  // Keep explicit attributes if present
  if (canvas.getAttribute('width')) fresh.setAttribute('width', canvas.getAttribute('width'));
  if (canvas.getAttribute('height')) fresh.setAttribute('height', canvas.getAttribute('height'));

  parent.replaceChild(fresh, canvas);
  canvas = fresh;
  ctx = null;
  gl = null;

  // Rebind pointer events on the new canvas
  bindCanvasInput();
  resize();
}

function ensureWebGL() {
  if (!canvas) return null;

  // If we already created a 2D ctx, we must swap the canvas to allow WebGL.
  if (ctx && !gl) {
    replaceCanvasPreservingLayout();
  }

  if (!gl) {
    gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false })
      || canvas.getContext('experimental-webgl');
  }
  return gl;
}

// Offscreen buffer for pixelated / "AR pixel" look
const off = document.createElement('canvas');
const offCtx = off.getContext('2d');
let pixelate = true;
let pixelArt = true; // palette + dither (pixel-art look)

let t = 0;
let running = true;
let mx = 0.5, my = 0.5;
let __defaultShaderEnabled = true;

// ------------------------------------------------------------
// Custom shader override (from Cloudflare JSON)
// If `shader_fragment` exists in data.json, run it.
// The custom code is expected to be plain JS that draws into the same
// `canvas/ctx/off/offCtx` variables (like your previous injected draw() snippet).
// ------------------------------------------------------------
let __customShaderApplied = false;

// --- WebGL GLSL runner -------------------------------------------------
let __glState = null;

function looksLikeGLSL(code) {
  const s = String(code || '').trim();
  if (!s) return false;
  // Heuristics: GLSL usually has precision/uniform/void main and no `function` keyword.
  const glslHints = /(precision\s+\w+\s+float\s*;|uniform\s+|void\s+main\s*\(|gl_FragColor\s*=)/;
  const jsHints = /(function\s+|=>|document\.|window\.|ctx\.|offCtx\.|requestAnimationFrame\s*\()/;
  return glslHints.test(s) && !jsHints.test(s);
}

function compileShader(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || 'Unknown shader compile error';
    gl.deleteShader(sh);
    throw new Error(info);
  }
  return sh;
}

function createProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'Unknown program link error';
    gl.deleteProgram(prog);
    throw new Error(info);
  }
  return prog;
}

function startWebGLShader(fragmentSource) {
  const glx = ensureWebGL();
  if (!glx) throw new Error('WebGL not available');

  // Fullscreen triangle (no attributes needed)
  const vsSrc = `attribute vec2 aPos;\nvoid main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // Allow users to omit precision; we’ll inject a safe default.
  const fsHeader = `precision highp float;\nuniform vec2 iResolution;\nuniform float iTime;\nuniform vec2 iMouse;\n`;
  const fsSrc = fragmentSource.includes('precision') ? fragmentSource : (fsHeader + fragmentSource);

  const prog = createProgram(glx, vsSrc, fsSrc);

  const buf = glx.createBuffer();
  glx.bindBuffer(glx.ARRAY_BUFFER, buf);
  // triangle covering clip space
  glx.bufferData(glx.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     3, -1,
    -1,  3
  ]), glx.STATIC_DRAW);

  const aPos = glx.getAttribLocation(prog, 'aPos');
  glx.useProgram(prog);
  glx.enableVertexAttribArray(aPos);
  glx.vertexAttribPointer(aPos, 2, glx.FLOAT, false, 0, 0);

  const uRes = glx.getUniformLocation(prog, 'iResolution');
  const uTime = glx.getUniformLocation(prog, 'iTime');
  const uMouse = glx.getUniformLocation(prog, 'iMouse');

  __glState = {
    gl: glx,
    prog,
    buf,
    uRes,
    uTime,
    uMouse,
    start: performance.now(),
    raf: 0,
  };

  resize();

  const tick = () => {
    if (!__glState) return;
    const now = performance.now();
    const secs = (now - __glState.start) / 1000;

    __glState.gl.useProgram(__glState.prog);
    if (__glState.uRes) __glState.gl.uniform2f(__glState.uRes, canvas.width, canvas.height);
    if (__glState.uTime) __glState.gl.uniform1f(__glState.uTime, secs);
    if (__glState.uMouse) __glState.gl.uniform2f(__glState.uMouse, mx * canvas.width, (1.0 - my) * canvas.height);

    __glState.gl.drawArrays(__glState.gl.TRIANGLES, 0, 3);
    __glState.raf = requestAnimationFrame(tick);
  };

  cancelAnimationFrame(__glState.raf);
  __glState.raf = requestAnimationFrame(tick);
}

function stopWebGLShader() {
  if (!__glState) return;
  try { cancelAnimationFrame(__glState.raf); } catch(_) {}
  try {
    const glx = __glState.gl;
    if (__glState.prog) glx.deleteProgram(__glState.prog);
    if (__glState.buf) glx.deleteBuffer(__glState.buf);
  } catch(_) {}
  __glState = null;
}

function applyCustomShader(rawCode){
  const code = (typeof rawCode === 'string') ? rawCode.trim() : '';
  if (!code) return false;
  if (__customShaderApplied) return true;

  // Stop default loop before switching
  __defaultShaderEnabled = false;

  // Clear the canvas once so the transition is clean
  try {
    const w = canvas?.clientWidth || 0;
    const h = canvas?.clientHeight || 0;
    if (ctx) ctx.clearRect(0, 0, w, h);
  } catch (_) {}

  try {
    window.__PORTFOLIO_ACTIVE_SHADER__ = 'custom';
    window.__PORTFOLIO_SHADER_ERROR__ = '';

    // If it looks like GLSL, run WebGL.
    if (looksLikeGLSL(code)) {
      // Ensure we are not running an old WebGL program
      stopWebGLShader();
      startWebGLShader(code);
      __customShaderApplied = true;
      return true;
    }

    // Otherwise treat as JS that draws into 2D.
    ensure2D();

    const fn = new Function(
      'canvas','ctx','off','offCtx','mx','my','t','running','pixelate','pixelArt',
      code
    );
    fn(canvas, ctx, off, offCtx, mx, my, t, running, pixelate, pixelArt);

    __customShaderApplied = true;
    return true;
  } catch (e) {
    const msg = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
    window.__PORTFOLIO_SHADER_ERROR__ = msg;
    try { console.error('Custom shader failed:', msg); } catch (_) {}

    // If WebGL failed, clean it up.
    stopWebGLShader();

    window.__PORTFOLIO_ACTIVE_SHADER__ = 'default';
    __customShaderApplied = false;
    startDefaultShader();
    return false;
  }
}

// Try from global (set by index.html) first; fetch is fallback.
async function tryApplyShaderFromJSON(){
  try {
    const r = await fetch('https://portfolio-json.laherasaumya.workers.dev/data.json', { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();

    // Apply shader if present
    applyCustomShader(d.shader_fragment);
  } catch (_) {
    // ignore; keep default
  }
}

// Listen for index.html publishing the shader from JSON
window.addEventListener('portfolio:shader', (e) => {
  const code = e?.detail;
  applyCustomShader(code);
});

// If index.html already set the global before script.js runs, apply immediately
if (typeof window.__PORTFOLIO_SHADER_FRAGMENT__ === 'string') {
  applyCustomShader(window.__PORTFOLIO_SHADER_FRAGMENT__);
}

function resize(){
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  // 2D scale
  if (ctx) {
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // WebGL viewport
  if (gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}
window.addEventListener('resize', resize);
resize();

function bindCanvasInput() {
  if (!canvas) return;

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width;
    my = (e.clientY - r.top) / r.height;
  });

  // Click: pause/play animation. Shift+Click: toggle pixelation.
  canvas.addEventListener('click', (e) => {
    if (e.shiftKey) {
      pixelate = !pixelate;
      return;
    }
    running = !running;
  });
}

bindCanvasInput();

// Keyboard: P toggles pixel-art palette/dither.
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') pixelArt = !pixelArt;
});

// --- Card hover video previews (works for dynamic cards too) ---
function attachVideoPreview(card) {
  // No real hover on touch devices; iOS can fire mouseenter without mouseleave.
  // Mobile uses the Preview button flow instead.
  if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

  if (!card || !(card instanceof Element)) return;
  if (!card.matches('.card[data-video]')) return;

  // Avoid duplicating previews if this runs multiple times
  if (card.querySelector('video.card__preview')) return;

  const src = card.getAttribute('data-video');
  if (!src) return;

  const video = document.createElement('video');
  video.className = 'card__preview';
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';

  // If the video can't load, remove it so you don't see a blank layer
  video.addEventListener('error', () => {
    video.remove();
  });

  card.prepend(video);

  // Hover play/pause
  card.addEventListener('mouseenter', () => {
    // Ensure we attempt to load before playing
    try { video.load(); } catch (_) {}
    video.play().catch(() => {});
  });

  card.addEventListener('mouseleave', () => {
    try { video.pause(); } catch(_) {}
    try { video.currentTime = 0; } catch(_) {}
  });
}

function initVideoPreviews(root = document) {
  root.querySelectorAll('.card[data-video]').forEach(attachVideoPreview);
}

// Initial pass for static HTML cards
initVideoPreviews();

// Observe for cards injected later (e.g., rendered from Cloudflare JSON)
const previewObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;

      // If the added node is a card or contains cards
      if (node.matches?.('.card[data-video]')) attachVideoPreview(node);
      node.querySelectorAll?.('.card[data-video]').forEach(attachVideoPreview);
    }
  }
});

previewObserver.observe(document.documentElement, { childList: true, subtree: true });

function draw(){
  if(!__defaultShaderEnabled) return;
  ensure2D();
  if(!canvas || !ctx || !offCtx) return;

  const w = canvas.clientWidth, h = canvas.clientHeight;

  // Pixel size: subtle by default; gets chunkier as you move right.
  // For pixel-art, a slightly chunkier base helps the "sprite" feel.
  const base = pixelArt ? 5 : 3;
  const pxSize = pixelate ? Math.max(base, Math.round(base + mx * 10)) : 1;
  const bw = Math.max(1, Math.floor(w / pxSize));
  const bh = Math.max(1, Math.floor(h / pxSize));

  // Render into a low-res buffer for a crisp pixelated look.
  off.width = bw;
  off.height = bh;

  const b = offCtx;
  b.setTransform(1,0,0,1,0,0);
  b.clearRect(0,0,bw,bh);

  // background (radial glow)
  const g = b.createRadialGradient(bw*mx, bh*my, 1, bw*0.5, bh*0.5, Math.max(bw,bh));
  g.addColorStop(0, `rgba(80,140,255,0.35)`);   // deep blue core
  g.addColorStop(0.45, `rgba(140,200,120,0.22)`); // muted green mid
  g.addColorStop(1, `rgba(0,0,0,0)`);
  b.fillStyle = g;
  b.fillRect(0,0,bw,bh);

  // "pixel AR" scanlines / flow field
  const lines = 90;
  for(let i=0;i<lines;i++){
    const p = i/(lines-1);
    const y = bh*p;
    const amp = 1.2 + 4.2*mx;
    const freq = 0.04 + 0.14*my;
    b.beginPath();
    for(let x=0;x<=bw;x+=1){
      const wave = Math.sin((x*freq) + t*0.03 + p*8.0) * amp;
      b.lineTo(x, y + wave);
    }
    const a = 0.06 + 0.22*(1-p);
    b.strokeStyle = `rgba(200,220,255,${a})`;
    b.lineWidth = 1;
    b.stroke();
  }

  // Pixel "spark" blobs
  for(let k=0;k<8;k++){
    const px = (0.1 + 0.8*Math.sin(t*0.006 + k*1.7)*0.5 + 0.5) * bw;
    const py = (0.2 + 0.7*Math.cos(t*0.004 + k*1.2)*0.5 + 0.5) * bh;
    const r = 1.2 + 2.6*Math.abs(Math.sin(t*0.007 + k));
    b.beginPath();
    b.arc(px, py, r, 0, Math.PI*2);
    b.fillStyle = k%2===0
      ? 'rgba(120,190,120,0.22)'   // muted green
      : 'rgba(90,150,255,0.22)';   // deep pixel blue
    b.fill();
  }

  // Pixel-art postprocess: palette quantization + ordered dithering
  // Keeps it subtle and readable for a portfolio background.
  if (pixelArt) {
    const img = b.getImageData(0, 0, bw, bh);
    const data = img.data;

    // 4x4 Bayer matrix (0..15). Adds a classic pixel-art dither texture.
    const bayer4 = [
      0,  8,  2, 10,
      12, 4, 14,  6,
      3, 11,  1,  9,
      15, 7, 13,  5
    ];

    // Palette levels per channel (higher = smoother). 5–7 is a good "pixel-art" sweet spot.
    const levels = 5; // fewer levels = richer, darker pixel-art look

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (y * bw + x) * 4;

        // Dither amount in [-0.5..0.5] scaled to ~8/255.
        const d = (bayer4[(x & 3) + ((y & 3) << 2)] / 15 - 0.5) * 10;

        // Apply a tiny dither before quantization.
        let r = data[i] + d;
        let g = data[i + 1] + d;
        let bch = data[i + 2] + d;

        // Quantize each channel.
        r = Math.round((r / 255) * (levels - 1)) * (255 / (levels - 1));
        g = Math.round((g / 255) * (levels - 1)) * (255 / (levels - 1));
        bch = Math.round((bch / 255) * (levels - 1)) * (255 / (levels - 1));

        // Clamp.
        data[i]     = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, bch));
      }
    }

    b.putImageData(img, 0, 0);
  }

  // Composite to the main canvas with crisp nearest-neighbor scaling.
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(off, 0, 0, w, h);

  if(running) t += 1;
  requestAnimationFrame(draw);
}
function startDefaultShader(){
  stopWebGLShader();

  // Force 2D mode + correct DPR scaling BEFORE drawing
  ensure2D();

  __defaultShaderEnabled = true;
  __customShaderApplied = false;
  window.__PORTFOLIO_ACTIVE_SHADER__ = 'default';

  resize();
  draw();
}

startDefaultShader();

// Attempt override after DOM is ready (and after initial layout)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // small delay helps ensure canvas has correct size
    setTimeout(tryApplyShaderFromJSON, 50);
  });
} else {
  setTimeout(tryApplyShaderFromJSON, 50);
}

// Mobile: add Preview button to cards with data-video (tap-to-play)
(function addTapPreviewButtons(){
  // Only enable on phones/tablets
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) return;

  let active = null; // { card, btn, layer, video, src }

  function hardStop(entry){
    if (!entry) return;
    const { card, btn, layer, video } = entry;

    if (video) {
      try { video.pause(); } catch(_) {}
      try { video.currentTime = 0; } catch(_) {}
      // Hard stop: drop src, load, then remove element (most reliable on iOS)
      try { video.removeAttribute('src'); } catch(_) {}
      try { video.src = ''; } catch(_) {}
      try { video.load(); } catch(_) {}
      try { video.remove(); } catch(_) {}
    }

    if (layer) {
      layer.innerHTML = '';
      layer.style.display = 'none';
    }
    if (card) card.classList.remove('card--previewing');
    if (btn) btn.textContent = 'Preview';
  }

  function ensureButton(card){
    if (!card || !(card instanceof Element)) return;
    if (!card.matches('.card[data-video]')) return;
    if (card.querySelector('.card__previewBtn')) return;

    const src = card.getAttribute('data-video');
    if (!src) return;

    const layer = document.createElement('div');
    layer.className = 'card__previewLayer';
    layer.style.display = 'none';

    // Layer only; create the <video> on-demand when user taps Preview.
    card.appendChild(layer);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card__previewBtn';
    btn.textContent = 'Preview';

    btn.addEventListener('click', async () => {
      const isOpen = card.classList.contains('card--previewing');

      if (isOpen) {
        // Close: stop and remove the active video for this card
        const currentVideo = layer.querySelector('video');
        hardStop({ card, btn, layer, video: currentVideo });
        if (active && active.card === card) active = null;
        return;
      }

      // If another card is open, stop it first
      if (active && active.card !== card) {
        const prevLayer = active.layer;
        const prevVideo = prevLayer ? prevLayer.querySelector('video') : null;
        hardStop({ card: active.card, btn: active.btn, layer: prevLayer, video: prevVideo });
        active = null;
      }

      // Create a fresh video element every time we open (most reliable stop/play on iOS)
      layer.innerHTML = '';
      const video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.disablePictureInPicture = true;
      video.setAttribute('disablepictureinpicture', '');
      video.preload = 'metadata';
      video.src = src;
      layer.appendChild(video);

      active = { card, btn, layer, video, src };
      card.classList.add('card--previewing');
      layer.style.display = 'block';
      btn.textContent = 'Close';

      try { await video.play(); } catch (_) {}
    });

    card.appendChild(btn);
  }

  function init(root = document){
    root.querySelectorAll('.card[data-video]').forEach(ensureButton);
  }

  // initial + JSON-injected cards
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.card[data-video]')) ensureButton(node);
        node.querySelectorAll?.('.card[data-video]').forEach(ensureButton);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    if (!active) return;
    const v = active.layer ? active.layer.querySelector('video') : active.video;
    hardStop({ card: active.card, btn: active.btn, layer: active.layer, video: v });
    active = null;
  });
})();
