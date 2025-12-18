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
canvas?.addEventListener('click', () => running = !running);

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
  if(!canvas || !ctx) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;

  // background
  ctx.clearRect(0,0,w,h);
  const g = ctx.createRadialGradient(w*mx, h*my, 10, w*0.5, h*0.5, Math.max(w,h));
  g.addColorStop(0, `rgba(122,240,255,${0.18})`);
  g.addColorStop(0.45, `rgba(182,255,106,${0.12})`);
  g.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // flowing lines
  const lines = 120;
  for(let i=0;i<lines;i++){
    const p = i/(lines-1);
    const y = h*(p);
    const amp = 14 + 40*mx;
    const freq = 0.008 + 0.02*my;
    ctx.beginPath();
    for(let x=0;x<=w;x+=10){
      const nx = x/w;
      const wave = Math.sin((x*freq) + t*0.015 + p*6.0) * amp;
      ctx.lineTo(x, y + wave);
    }
    const a = 0.05 + 0.20*(1-p);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // glowing blobs
  for(let k=0;k<7;k++){
    const px = (0.1 + 0.8*Math.sin(t*0.003 + k*1.7)*0.5 + 0.5) * w;
    const py = (0.2 + 0.7*Math.cos(t*0.002 + k*1.2)*0.5 + 0.5) * h;
    const r = 18 + 24*Math.sin(t*0.004 + k);
    ctx.beginPath();
    ctx.arc(px, py, Math.abs(r), 0, Math.PI*2);
    ctx.fillStyle = k%2===0 ? 'rgba(182,255,106,0.10)' : 'rgba(122,240,255,0.10)';
    ctx.fill();
  }

  if(running) t += 1;
  requestAnimationFrame(draw);
}
draw();
