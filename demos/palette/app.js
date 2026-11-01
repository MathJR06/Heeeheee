// Palette Studio — HSL colour harmonies + WCAG contrast checking
const $ = (s) => document.querySelector(s);
const wrap = $("#swatches");
const modeSel = $("#mode");
const exportEl = $("#export");
let format = "css";

// palette: array of { h, s, l, locked }
let palette = [];

const rand = (min, max) => min + Math.random() * (max - min);
const wrapHue = (h) => ((h % 360) + 360) % 360;

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

// WCAG relative luminance + contrast ratio
function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

function generateHues(mode, base) {
  switch (mode) {
    case "complementary": return [0, 0, 180, 180, 30].map((o) => base + o);
    case "triadic": return [0, 120, 240, 0, 120].map((o) => base + o);
    case "monochrome": return [0, 0, 0, 0, 0].map(() => base);
    case "random": return [0, 0, 0, 0, 0].map(() => rand(0, 360));
    default: return [-40, -20, 0, 20, 40].map((o) => base + o);
  }
}

function generate() {
  const mode = modeSel.value;
  const base = rand(0, 360);
  const hues = generateHues(mode, base);
  const lights = mode === "monochrome" ? [18, 34, 50, 66, 82] : [22, 40, 55, 68, 84].sort(() => Math.random() - 0.5);
  palette = hues.map((h, i) =>
    palette[i]?.locked ? palette[i] : { h: wrapHue(h + rand(-6, 6)), s: rand(55, 85), l: lights[i] + rand(-4, 4), locked: false }
  );
  render();
}

function render() {
  const white = [255, 255, 255], black = [11, 13, 18];
  wrap.innerHTML = palette.map((c, i) => {
    const rgb = hslToRgb(c.h, c.s, c.l);
    const hex = toHex(rgb);
    const cw = contrast(rgb, white), cb = contrast(rgb, black);
    const textOnIt = cw > cb ? "#fff" : "#0b0d12";
    const best = Math.max(cw, cb);
    const badge = (label, ok) => `<span class="badge ${ok ? "" : "fail"}">${label}</span>`;
    return `<div class="swatch fade-in ${c.locked ? "locked" : ""}" style="background:${hex};color:${textOnIt};animation-delay:${i * 40}ms" data-i="${i}" tabindex="0" role="button" aria-label="Copy ${hex}">
      <button class="lock" data-lock="${i}" aria-label="${c.locked ? "Unlock" : "Lock"} colour" title="${c.locked ? "Unlock" : "Lock"}">${c.locked ? "🔒" : "🔓"}</button>
      <div>
        <div class="hex">${hex}</div>
        <div class="meta">hsl(${Math.round(c.h)}, ${Math.round(c.s)}%, ${Math.round(c.l)}%) · ${best.toFixed(1)}:1</div>
      </div>
      <div class="badges">${badge("AA", best >= 4.5)}${badge("AAA", best >= 7)}</div>
    </div>`;
  }).join("");
  renderExport();
  try { history.replaceState(null, "", "#" + hexes().map((h) => h.slice(1)).join("-")); } catch {}
}

const hexes = () => palette.map((c) => toHex(hslToRgb(c.h, c.s, c.l)));

function renderExport() {
  const hx = hexes();
  if (format === "json") exportEl.textContent = JSON.stringify(hx, null, 2);
  else if (format === "url") exportEl.textContent = location.href.split("#")[0] + "#" + hx.map((h) => h.slice(1)).join("-");
  else exportEl.textContent = ":root {\n" + hx.map((h, i) => `  --color-${i + 1}: ${h};`).join("\n") + "\n}";
}

wrap.addEventListener("click", (e) => {
  const lock = e.target.closest("[data-lock]");
  if (lock) {
    const c = palette[+lock.dataset.lock];
    c.locked = !c.locked;
    return render();
  }
  const sw = e.target.closest(".swatch");
  if (sw) copy(hexes()[+sw.dataset.i]);
});
wrap.addEventListener("keydown", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw && e.target === sw && e.key === "Enter") copy(hexes()[+sw.dataset.i]);
});

document.querySelectorAll("[data-format]").forEach((b) =>
  b.addEventListener("click", () => { format = b.dataset.format; renderExport(); copy(exportEl.textContent, "Copied to clipboard"); })
);

async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); window.showToast?.(msg || `Copied ${text}`); }
  catch { window.showToast?.("Couldn't copy — select the text manually"); }
}

$("#generate").addEventListener("click", generate);
modeSel.addEventListener("change", generate);
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    generate();
  }
});

// Load a palette from the URL (#RRGGBB-RRGGBB-…) or generate a fresh one
const fromUrl = location.hash.slice(1).split("-").filter((h) => /^[0-9a-f]{6}$/i.test(h));
if (fromUrl.length === 5) { palette = fromUrl.map((h) => ({ ...hexToHsl("#" + h), locked: false })); render(); }
else generate();
