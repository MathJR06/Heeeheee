// Habit Tracker — streaks + a hand-drawn canvas bar chart, saved in localStorage
const $ = (s) => document.querySelector(s);
const KEY = "habits-demo:v1";
const DAY = 86400000;

// Dates are stored as local "YYYY-MM-DD" keys
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); return new Date(d - n * DAY); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function sample() {
  const make = (emoji, name, chance) => {
    const done = {};
    for (let i = 1; i < 21; i++) if (Math.random() < chance) done[keyOf(daysAgo(i))] = true;
    return { id: Math.random().toString(36).slice(2), emoji, name, done };
  };
  return [make("💧", "Drink 2L of water", 0.85), make("📚", "Read 20 minutes", 0.65), make("🏃", "Exercise", 0.5)];
}

let habits;
try { habits = JSON.parse(localStorage.getItem(KEY)) || sample(); } catch { habits = sample(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(habits)); } catch {} };

function streak(h) {
  // Count back from today; if today isn't done yet, start from yesterday
  let i = h.done[keyOf(daysAgo(0))] ? 0 : 1, n = 0;
  while (h.done[keyOf(daysAgo(i))]) { n++; i++; }
  return n;
}

function renderGrid() {
  const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  const head = `<div class="habit-row head"><div></div>${days.map((d, i) =>
    `<div class="${i === 6 ? "today" : ""}">${i === 6 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}<br>${d.getDate()}</div>`).join("")}<div>Streak</div><div></div></div>`;
  const rows = habits.map((h) => `<div class="habit-row">
      <div class="habit-name"><span>${esc(h.emoji)}</span><span title="${esc(h.name)}">${esc(h.name)}</span></div>
      ${days.map((d) => { const k = keyOf(d); return `<button class="cell ${h.done[k] ? "on" : ""}" data-id="${h.id}" data-day="${k}" aria-pressed="${!!h.done[k]}" aria-label="${esc(h.name)} on ${d.toDateString()}"></button>`; }).join("")}
      <div class="streak">🔥 ${streak(h)}</div>
      <button class="icon-btn" data-remove="${h.id}" aria-label="Remove ${esc(h.name)}" title="Remove">✕</button>
    </div>`).join("");
  $("#grid").innerHTML = habits.length ? head + rows : `<p class="empty">No habits yet. Add one above!</p>`;
}

function renderStats() {
  const today = keyOf(daysAgo(0));
  $("#s-today").textContent = `${habits.filter((h) => h.done[today]).length}/${habits.length}`;
  const best = Math.max(0, ...habits.map(streak));
  $("#s-streak").textContent = `${best} day${best === 1 ? "" : "s"}`;
  let done = 0;
  for (let i = 0; i < 14; i++) done += habits.filter((h) => h.done[keyOf(daysAgo(i))]).length;
  $("#s-rate").textContent = habits.length ? Math.round((done / (habits.length * 14)) * 100) + "%" : "0%";
}

// Animated bar chart drawn on <canvas>
let anim;
function renderChart() {
  const canvas = $("#chart");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 220;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));
  const values = days.map((d) => habits.filter((h) => h.done[keyOf(d)]).length);
  const max = Math.max(1, habits.length);
  const pad = { l: 28, r: 6, t: 10, b: 28 };
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const slot = cw / days.length, bw = Math.min(28, slot * 0.6);
  const css = getComputedStyle(document.documentElement);
  const [muted, border, a1, a2] = ["--muted", "--border", "--accent", "--accent-2"].map((v) => css.getPropertyValue(v).trim());

  cancelAnimationFrame(anim);
  const start = performance.now();
  const frame = (t) => {
    const p = Math.min(1, (t - start) / 600), ease = 1 - Math.pow(1 - p, 3);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= max; i++) {
      if (max > 6 && i % 2) continue;
      const y = pad.t + ch - (i / max) * ch;
      ctx.strokeStyle = border; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y + 0.5); ctx.lineTo(w - pad.r, y + 0.5); ctx.stroke();
      ctx.fillStyle = muted; ctx.fillText(i, pad.l - 8, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    values.forEach((v, i) => {
      const x = pad.l + slot * i + (slot - bw) / 2;
      const bh = (v / max) * ch * ease;
      if (bh > 0) {
        const g = ctx.createLinearGradient(0, pad.t + ch - bh, 0, pad.t + ch);
        g.addColorStop(0, a2); g.addColorStop(1, a1);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, pad.t + ch - bh, bw, bh, [6, 6, 0, 0]) : ctx.rect(x, pad.t + ch - bh, bw, bh);
        ctx.fill();
      }
      if (slot > 26 || i % 2 === 1) { ctx.fillStyle = muted; ctx.fillText(days[i].getDate(), x + bw / 2, pad.t + ch + 8); }
    });
    if (p < 1) anim = requestAnimationFrame(frame);
  };
  anim = requestAnimationFrame(frame);
}

function renderAll() { renderGrid(); renderStats(); renderChart(); }

$("#grid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (cell) {
    const h = habits.find((x) => x.id === cell.dataset.id);
    if (h.done[cell.dataset.day]) delete h.done[cell.dataset.day]; else h.done[cell.dataset.day] = true;
    save(); renderAll();
    return;
  }
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const h = habits.find((x) => x.id === rm.dataset.remove);
    if (confirm(`Remove “${h.name}”?`)) { habits = habits.filter((x) => x !== h); save(); renderAll(); }
  }
});

$("#add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#name").value.trim();
  if (!name) return;
  habits.push({ id: Math.random().toString(36).slice(2), emoji: $("#emoji").value.trim() || "✅", name, done: {} });
  $("#name").value = "";
  save(); renderAll();
});

$("#reset").addEventListener("click", () => {
  if (!confirm("Replace your habits with fresh example data?")) return;
  habits = sample(); save(); renderAll();
});

let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderChart, 150); });
renderAll();
