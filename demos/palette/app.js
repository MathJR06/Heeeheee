// Palette Studio: HSL colour harmonies, colour naming, WCAG contrast and a live UI preview
const $ = (s) => document.querySelector(s);
const SAVED_KEY = "palette-demo:saved";
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let palette = [];       // [{ h, s, l, locked }]
let undoStack = [];
let mode = "analogous";
let format = "css";

// ---------- Colour maths ----------
const rand = (a, b) => a + Math.random() * (b - a);
const wrapH = (h) => ((h % 360) + 360) % 360;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
const hex = (c) => toHex(hslToRgb(c.h, c.s, c.l));
const hsl = (h, s, l, a = 1) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${a})`;
function hexToHsl(hx) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}
function luminance(rgb) {
  const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// ---------- Colour names ----------
const HUES = [[10, "Red"], [22, "Vermilion"], [35, "Orange"], [46, "Amber"], [58, "Gold"], [72, "Citron"], [95, "Lime"], [140, "Green"], [165, "Mint"],
  [182, "Teal"], [196, "Cyan"], [212, "Sky"], [232, "Blue"], [252, "Indigo"], [272, "Violet"], [292, "Purple"], [318, "Magenta"], [338, "Pink"], [352, "Rose"], [361, "Red"]];
function nameOf({ h, s, l }) {
  if (l > 94) return "Snow";
  if (l < 7) return "Ink";
  let base = HUES.find(([max]) => h < max)[1];
  if (s < 12) base = l > 60 ? "Silver" : l > 35 ? "Slate" : "Charcoal";
  else if (s < 28) base = { Red: "Dusty Rose", Orange: "Sand", Amber: "Khaki", Gold: "Khaki", Green: "Sage", Mint: "Sage", Blue: "Steel", Sky: "Steel", Indigo: "Storm" }[base] || "Muted " + base;
  const prefix = l < 22 ? "Deep " : l < 38 ? "Dark " : l > 82 ? "Pale " : l > 68 ? "Soft " : "";
  return prefix + base;
}

// ---------- Generation ----------
function generateOne(i, base) {
  switch (mode) {
    case "complementary": return { h: wrapH(base + [0, 0, 180, 180, 15][i] + rand(-5, 5)), s: rand(55, 85), l: [24, 52, 40, 70, 88][i] + rand(-4, 4) };
    case "triadic": return { h: wrapH(base + [0, 120, 240, 0, 240][i] + rand(-5, 5)), s: rand(55, 80), l: [30, 55, 55, 82, 18][i] + rand(-4, 4) };
    case "monochrome": return { h: wrapH(base + rand(-4, 4)), s: rand(45, 75), l: [14, 32, 50, 70, 88][i] + rand(-3, 3) };
    case "pastel": return { h: wrapH(base + i * rand(28, 50)), s: rand(55, 80), l: rand(76, 88) };
    default: return { h: wrapH(base - 40 + i * 20 + rand(-4, 4)), s: rand(55, 85), l: [18, 34, 50, 66, 84][i] + rand(-4, 4) };
  }
}
function generate() {
  pushHistory();
  const base = rand(0, 360);
  palette = palette.length
    ? palette.map((c, i) => (c.locked ? c : { ...generateOne(i, base), locked: false }))
    : Array.from({ length: 5 }, (_, i) => ({ ...generateOne(i, base), locked: false }));
  render();
}
function pushHistory() {
  if (!palette.length) return;
  undoStack.push(palette.map((c) => ({ ...c })));
  if (undoStack.length > 40) undoStack.shift();
  $("#undo").disabled = false;
}

// ---------- Swatches (nodes are reused so colours fade smoothly) ----------
const ICONS = {
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 3-4 3h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="12" cy="7" r="1.3" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.3" fill="currentColor"/></svg>`,
};
const wrap = $("#swatches");
const nodes = Array.from({ length: 5 }, (_, i) => {
  const el = document.createElement("div");
  el.className = "swatch";
  el.tabIndex = 0;
  el.dataset.i = i;
  el.innerHTML = `<div class="tools">
      <button class="tool lock" data-act="lock" aria-label="Lock colour"></button>
      <span class="tool" title="Pick a colour">${ICONS.edit}<input type="color" aria-label="Pick a colour"></span>
      <button class="tool" data-act="copy" aria-label="Copy hex">${ICONS.copy}</button>
    </div>
    <div class="meta"><div class="name"></div><div class="hex"></div></div>
    <span class="ratio"></span>`;
  wrap.appendChild(el);
  return el;
});

function render() {
  const white = [255, 255, 255], black = [12, 14, 20];
  palette.forEach((c, i) => {
    const el = nodes[i], rgb = hslToRgb(c.h, c.s, c.l), hx = toHex(rgb);
    const cw = contrast(rgb, white), cb = contrast(rgb, black);
    const best = Math.max(cw, cb);
    el.style.backgroundColor = hx;
    el.style.color = cw > cb ? "#fff" : "#0c0e14";
    el.classList.toggle("locked", c.locked);
    el.querySelector(".name").textContent = nameOf(c);
    el.querySelector(".hex").textContent = hx;
    el.querySelector(".ratio").textContent = `${best >= 7 ? "AAA" : best >= 4.5 ? "AA" : best >= 3 ? "AA Large" : "Low"} · ${best.toFixed(1)}:1`;
    el.querySelector("input[type=color]").value = hx.toLowerCase();
    const lock = el.querySelector(".lock");
    lock.innerHTML = c.locked ? ICONS.lock : ICONS.unlock;
    lock.setAttribute("aria-label", c.locked ? "Unlock colour" : "Lock colour");
    el.setAttribute("aria-label", `${nameOf(c)} ${hx}`);
  });
  renderPreview();
  renderExport();
  $("#save").classList.toggle("saved-now", isSaved());
  try { window.history.replaceState(null, "", "#" + palette.map((c) => hex(c).slice(1)).join("-")); } catch {}
}

wrap.addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (!sw || e.target.closest(".tool input")) return;
  const i = +sw.dataset.i, act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "lock") { palette[i].locked = !palette[i].locked; render(); }
  else copy(hex(palette[i]));
});
wrap.addEventListener("keydown", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw && e.target === sw && e.key === "Enter") copy(hex(palette[+sw.dataset.i]));
  if (sw && e.target === sw && e.key.toLowerCase() === "l") { palette[+sw.dataset.i].locked ^= true; render(); }
});
let pickerPushed = false;
wrap.addEventListener("input", (e) => {
  if (e.target.type !== "color") return;
  if (!pickerPushed) { pushHistory(); pickerPushed = true; }
  const i = +e.target.closest(".swatch").dataset.i;
  palette[i] = { ...hexToHsl(e.target.value), locked: true };
  render();
});
wrap.addEventListener("change", () => (pickerPushed = false));

// ---------- Live preview ----------
function themeVars(dark) {
  const byL = [...palette].sort((a, b) => a.l - b.l);
  const mids = [...palette].filter((c) => c.l > 25 && c.l < 80);
  const vivid = [...(mids.length ? mids : palette)].sort((a, b) => b.s - a.s);
  const a = vivid[0], b = vivid[1] || byL[3];
  const anchor = dark ? byL[0] : byL[4];
  let accent = { ...a };
  // keep the accent usable on the chosen background
  if (dark) accent.l = clamp(accent.l, 52, 72); else accent.l = clamp(accent.l, 38, 54);
  const aRgb = hslToRgb(accent.h, accent.s, accent.l);
  const onA = contrast(aRgb, [255, 255, 255]) > contrast(aRgb, [12, 14, 20]) ? "#fff" : "#0c0e14";
  const h = anchor.h, s = Math.min(anchor.s, 45);
  return dark ? {
    "--m-bg": hsl(h, s * 0.6, 8), "--m-surface": hsl(h, s * 0.5, 12.5), "--m-line": hsl(h, s * 0.4, 20),
    "--m-text": hsl(h, 20, 95), "--m-muted": hsl(h, 12, 68),
    "--m-a": hsl(accent.h, accent.s, accent.l), "--m-b": hsl(b.h, b.s, clamp(b.l, 45, 75)),
    "--m-a-soft": hsl(accent.h, accent.s, accent.l, 0.16), "--m-a-text": hsl(accent.h, accent.s, clamp(accent.l + 10, 60, 80)), "--m-on-a": onA,
  } : {
    "--m-bg": hsl(h, s * 0.7, 97.5), "--m-surface": "#ffffff", "--m-line": hsl(h, s * 0.5, 89),
    "--m-text": hsl(byL[0].h, Math.min(byL[0].s, 40), 12), "--m-muted": hsl(byL[0].h, 10, 40),
    "--m-a": hsl(accent.h, accent.s, accent.l), "--m-b": hsl(b.h, b.s, clamp(b.l, 40, 65)),
    "--m-a-soft": hsl(accent.h, accent.s, accent.l, 0.12), "--m-a-text": hsl(accent.h, accent.s, clamp(accent.l - 8, 28, 45)), "--m-on-a": onA,
  };
}
const heights = [45, 70, 55, 90, 65, 80, 50];
const previewsEl = $("#previews");
previewsEl.innerHTML = ["dark", "light"].map((t) => `
  <div class="mock" data-theme-mock="${t}">
    <div class="mock-nav"><div class="mock-logo"><i></i>Lumen</div><div class="mock-links"><span>Product</span><span>Pricing</span><span>Blog</span></div></div>
    <div class="mock-body">
      <span class="mock-pill">${t === "dark" ? "Dark mode" : "Light mode"}</span>
      <h3>Plan less. <span>Ship more.</span></h3>
      <p>A calm workspace for small teams. Everything you need, nothing you don't.</p>
      <div class="mock-btns"><span class="mock-btn primary">Get started</span><span class="mock-btn ghost">Book a demo</span></div>
      <div class="mock-cards">
        <div class="mock-card"><small>Weekly activity</small><strong>2,481</strong><div class="bars">${heights.map((h) => `<i style="height:${h}%"></i>`).join("")}</div></div>
        <div class="mock-card"><small>Team</small><strong>12 active</strong><div class="people">${"<i></i>".repeat(5)}</div><div class="progress"><i></i></div></div>
      </div>
    </div>
  </div>`).join("");
function renderPreview() {
  previewsEl.querySelectorAll(".mock").forEach((m) => {
    const vars = themeVars(m.dataset.themeMock === "dark");
    Object.entries(vars).forEach(([k, v]) => m.style.setProperty(k, v));
    m.querySelectorAll(".bars i").forEach((b, i) => (b.style.background = hex(palette[i % 5])));
    m.querySelectorAll(".people i").forEach((p, i) => (p.style.background = hex(palette[i])));
  });
}

// ---------- Export ----------
const exportEl = $("#export");
function exportText() {
  const list = palette.map((c) => ({ name: nameOf(c), hex: hex(c) }));
  const slug = (n) => n.toLowerCase().replace(/\s+/g, "-");
  if (format === "json") return JSON.stringify(list, null, 2);
  if (format === "tailwind") return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${list.map((c) => `        "${slug(c.name)}": "${c.hex}",`).join("\n")}\n      },\n    },\n  },\n};`;
  return `:root {\n${list.map((c, i) => `  --color-${i + 1}: ${c.hex}; /* ${c.name} */`).join("\n")}\n}`;
}
function renderExport() {
  exportEl.textContent = exportText();
  document.querySelectorAll("[data-format]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.format === format)));
}
document.querySelectorAll("[data-format]").forEach((b) => b.addEventListener("click", () => { format = b.dataset.format; renderExport(); }));
$("#copy-export").addEventListener("click", () => copy(exportEl.textContent, "Code copied"));
$("#copy-link").addEventListener("click", () => copy(location.href, "Share link copied"));
$("#download").addEventListener("click", () => {
  const c = document.createElement("canvas"), W = 1500, H = 900;
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  palette.forEach((col, i) => {
    const rgb = hslToRgb(col.h, col.s, col.l);
    ctx.fillStyle = toHex(rgb);
    ctx.fillRect((W / 5) * i, 0, W / 5 + 1, H);
    ctx.fillStyle = contrast(rgb, [255, 255, 255]) > contrast(rgb, [12, 14, 20]) ? "#fff" : "#0c0e14";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(toHex(rgb), (W / 5) * i + 32, H - 70);
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.globalAlpha = 0.75;
    ctx.fillText(nameOf(col), (W / 5) * i + 32, H - 124);
    ctx.globalAlpha = 1;
  });
  const a = document.createElement("a");
  a.download = "palette-" + palette.map((x) => hex(x).slice(1)).join("-") + ".png";
  a.href = c.toDataURL("image/png");
  a.click();
  window.showToast?.("PNG downloaded");
});

// ---------- Saved palettes ----------
const key = () => palette.map(hex).join(",");
const isSaved = () => store.get(SAVED_KEY, []).includes(key());
function renderSaved() {
  const saved = store.get(SAVED_KEY, []);
  $("#saved").innerHTML = saved.length
    ? saved.map((p, i) => `<li><button class="strip" data-load="${i}" aria-label="Load palette ${i + 1}">${p.split(",").map((h) => `<i style="background:${h}"></i>`).join("")}</button>
        <button class="icon-btn" data-del="${i}" aria-label="Delete saved palette">✕</button></li>`).join("")
    : `<li class="empty muted small">Nothing saved yet. Tap the ♡ above to keep a palette you like.</li>`;
}
$("#save").addEventListener("click", () => {
  let saved = store.get(SAVED_KEY, []);
  if (isSaved()) { saved = saved.filter((p) => p !== key()); window.showToast?.("Removed from saved"); }
  else { saved.unshift(key()); window.showToast?.("Palette saved ♥"); }
  store.set(SAVED_KEY, saved.slice(0, 30));
  renderSaved(); render();
});
$("#saved").addEventListener("click", (e) => {
  const saved = store.get(SAVED_KEY, []);
  const load = e.target.closest("[data-load]"), del = e.target.closest("[data-del]");
  if (load) { pushHistory(); palette = saved[+load.dataset.load].split(",").map((h) => ({ ...hexToHsl(h), locked: false })); render(); window.scrollTo({ top: wrap.offsetTop - 120, behavior: "smooth" }); }
  if (del) { saved.splice(+del.dataset.del, 1); store.set(SAVED_KEY, saved); renderSaved(); render(); }
});

// ---------- Controls ----------
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); window.showToast?.(msg || `Copied ${text}`); }
  catch { window.showToast?.("Couldn't copy. Select the text manually."); }
}
function setMode(m) {
  mode = m;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === m)));
}
document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { setMode(b.dataset.mode); generate(); }));
$("#generate").addEventListener("click", generate);
$("#undo").addEventListener("click", () => {
  if (!undoStack.length) return;
  palette = undoStack.pop();
  $("#undo").disabled = !undoStack.length;
  render();
});
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement.tagName;
  if (e.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) { e.preventDefault(); generate(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && tag !== "INPUT") { e.preventDefault(); $("#undo").click(); }
});

// ---------- Start ----------
setMode(mode);
$("#undo").disabled = true;
renderSaved();
const fromUrl = location.hash.slice(1).split("-").filter((h) => /^[0-9a-f]{6}$/i.test(h));
if (fromUrl.length === 5) { palette = fromUrl.map((h) => ({ ...hexToHsl("#" + h), locked: false })); render(); }
else generate();
