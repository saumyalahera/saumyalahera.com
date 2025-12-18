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

/* Tiny canvas shader-esque animation (no WebGL, works everywhere) */
const canvas = document.getElementById('shader');
const ctx = canvas?.getContext('2d');

// Offscreen buffer for pixelated / "AR pixel" look
const off = document.createElement('canvas');
const offCtx = off.getContext('2d');
let pixelate = true;
let pixelArt = true; // palette + dither (pixel-art look)

let t = 0;
let running = true;
let mx = 0.5, my = 0.5;

function resize(){
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx?.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

canvas?.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mx = (e.clientX - r.left) / r.width;
  my = (e.clientY - r.top) / r.height;
});
// Click: pause/play animation. Shift+Click: toggle pixelation.
canvas?.addEventListener('click', (e) => {
  if (e.shiftKey) {
    pixelate = !pixelate;
    return;
  }
  running = !running;
});

// Keyboard: P toggles pixel-art palette/dither.
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') pixelArt = !pixelArt;
});

// --- Card hover video previews (MINIMAL) ---
document.querySelectorAll('.card[data-video]').forEach(card => {
  const src = card.dataset.video;
  if (!src) return;

  const video = document.createElement('video');
  video.className = 'card__preview';
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';

  card.prepend(video);

  card.addEventListener('mouseenter', () => {
    video.play().catch(() => {});
  });

  card.addEventListener('mouseleave', () => {
    video.pause();
    video.currentTime = 0;
  });
});

function draw(){
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
draw();
