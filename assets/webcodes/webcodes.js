// Hand-drawn pencil outlines, like PencilFrame in the app: a firm line
// and a fainter second pass, each with a little seeded wobble.
(function () {
  function rand(seed) {
    let s = seed * 9301 + 49297;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }

  function wobblyRect(w, h, seed, wobble) {
    const r = rand(seed);
    const j = () => (r() - 0.5) * 2 * wobble;
    const corners = [[1, 1], [w - 1, 1], [w - 1, h - 1], [1, h - 1]];
    let d = "";
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(2, Math.round(len / 60));
      const sx = x0 + j(), sy = y0 + j();
      if (i === 0) d += `M${sx.toFixed(1)} ${sy.toFixed(1)}`;
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const x = x0 + (x1 - x0) * t + (k === steps ? 0 : j());
        const y = y0 + (y1 - y0) * t + (k === steps ? 0 : j());
        const mx = x0 + (x1 - x0) * (t - 0.5 / steps) + j();
        const my = y0 + (y1 - y0) * (t - 0.5 / steps) + j();
        d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    }
    return d + " Z";
  }

  function draw(el, i) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const seed = Number(el.dataset.seed || i + 1);
    let svg = el.querySelector(":scope > svg.edge");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "edge");
      svg.setAttribute("aria-hidden", "true");
      el.appendChild(svg);
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const dashed = el.classList.contains("dashed");
    if (el.classList.contains("shot")) {
      // Screenshots get one fine, light line so the frame doesn't outweigh the screen.
      svg.innerHTML = `<path d="${wobblyRect(w, h, seed, 0.5)}" stroke-width=".7" opacity=".4"/>`;
      return;
    }
    svg.innerHTML =
      `<path d="${wobblyRect(w, h, seed, 0.9)}" stroke-width="1.1"${dashed ? ' stroke-dasharray="3 5"' : ""}/>` +
      (dashed ? "" : `<path d="${wobblyRect(w, h, seed + 7, 1.4)}" stroke-width=".5" opacity=".5"/>`);
  }

  function drawAll() { document.querySelectorAll(".pencil").forEach(draw); }
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(drawAll, 80); });
  window.addEventListener("load", drawAll);
  if (document.fonts) document.fonts.ready.then(drawAll);
  drawAll();
})();
