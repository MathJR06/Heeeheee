// Habit Tracker: streaks, a progress ring, a GitHub-style heatmap and a stacked bar chart
const $ = (s) => document.querySelector(s);
const KEY = "habits-demo:v2";
const DAY = 86400000;
const COLORS = ["#7c9cff", "#b48cff", "#34d399", "#fbbf24", "#fb7185", "#22d3ee", "#f97316"];
const EMOJIS = ["🎸", "💧", "📚", "🏃", "🧘", "🥗", "😴", "✍️", "💻", "🚶", "🧹", "🌱"];

const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const TODAY = () => keyOf(daysAgo(0));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function sample() {
  const make = (emoji, name, color, chance, ramp) => {
    const done = {};
    for (let i = 1; i < 365; i++) {
      const p = chance * (ramp ? Math.max(0.15, 1 - i / 400) : 1);
      if (Math.random() < p) done[keyOf(daysAgo(i))] = true;
    }
    return { id: Math.random().toString(36).slice(2), emoji, name, color, done };
  };
  return [
    make("🎸", "Practise guitar", "#fb7185", 0.82, true),
    make("💧", "Drink 2 litres of water", "#22d3ee", 0.75, false),
    make("📚", "Read 20 minutes", "#7c9cff", 0.6, true),
    make("🏃", "Move for 30 minutes", "#34d399", 0.5, false),
  ];
}

let habits;
try { habits = JSON.parse(localStorage.getItem(KEY)) || sample(); } catch { habits = sample(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(habits)); } catch {} };

function streak(h) {
  let i = h.done[TODAY()] ? 0 : 1, n = 0;
  while (h.done[keyOf(daysAgo(i))]) { n++; i++; }
  return n;
}
function bestStreak(h) {
  const days = Object.keys(h.done).sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const t = new Date(k + "T12:00").getTime();
    run = prev && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return best;
}
const rate = (h, n) => { let c = 0; for (let i = 0; i < n; i++) if (h.done[keyOf(daysAgo(i))]) c++; return c / n; };

// ---------- Today header ----------
function renderToday() {
  const hour = new Date().getHours();
  const doneToday = habits.filter((h) => h.done[TODAY()]).length, total = habits.length;
  const pct = total ? Math.round((doneToday / total) * 100) : 0;
  $("#greet").textContent = hour < 5 ? "Up late? 🌙" : hour < 12 ? "Good morning ☀️" : hour < 18 ? "Good afternoon 👋" : "Good evening 🌆";
  $("#today-title").textContent = !total ? "Add your first habit" : doneToday === total ? "All done today. Amazing! 🎉" : doneToday === 0 ? "Let's get going" : `${total - doneToday} to go. Keep it up!`;
  $("#today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  $("#ring-fg").setAttribute("stroke-dasharray", `${pct} 100`);
  $("#ring-pct").textContent = pct + "%";
  $("#ring-sub").textContent = `${doneToday} of ${total} today`;
  const best = habits.reduce((m, h) => Math.max(m, streak(h)), 0);
  const checkins = habits.reduce((s, h) => s + Object.keys(h.done).length, 0);
  const r30 = total ? Math.round((habits.reduce((s, h) => s + rate(h, 30), 0) / total) * 100) : 0;
  $("#chips").innerHTML = `<span class="chip">🔥 <b>${best}</b> day best streak</span><span class="chip">✅ <b>${checkins}</b> check-ins</span><span class="chip">📈 <b>${r30}%</b> last 30 days</span>`;
}

// ---------- Habit cards ----------
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
function renderGrid() {
  const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  $("#grid").innerHTML = habits.map((h) => {
    const done = !!h.done[TODAY()], s = streak(h), r = Math.round(rate(h, 30) * 100);
    return `<article class="habit ${done ? "done" : ""}" style="--hc:${h.color};--hc-soft:${hexA(h.color, 0.16)};--hc-line:${hexA(h.color, 0.55)}" data-id="${h.id}">
      <button class="h-del" data-del="${h.id}" aria-label="Remove ${esc(h.name)}" title="Remove">✕</button>
      <div class="h-top">
        <div class="h-emoji">${esc(h.emoji)}</div>
        <div style="min-width:0">
          <div class="h-name">${esc(h.name)}</div>
          <div class="h-streak">${s ? `🔥 <b>${s}</b> day streak` : "Start a streak today"} · best ${bestStreak(h)}</div>
        </div>
        <button class="check" data-toggle="${h.id}" data-day="${TODAY()}" aria-pressed="${done}" aria-label="Mark ${esc(h.name)} done today">${CHECK}</button>
      </div>
      <div class="week">${days.map((d, i) => { const k = keyOf(d); return `<button class="day ${h.done[k] ? "on" : ""} ${i === 6 ? "today" : ""}" data-toggle="${h.id}" data-day="${k}" aria-pressed="${!!h.done[k]}" aria-label="${esc(h.name)} on ${d.toDateString()}"><i></i><span>${d.toLocaleDateString(undefined, { weekday: "narrow" })}</span></button>`; }).join("")}</div>
      <div class="h-foot"><span>30 days</span><span class="h-bar"><i style="width:${r}%"></i></span><span>${r}%</span></div>
    </article>`;
  }).join("") + `<button class="add-card" id="add-open"><div><span>＋</span>New habit</div></button>`;
}

// ---------- Heatmap ----------
function renderHeat() {
  const weeks = innerWidth < 700 ? 26 : 53, today = daysAgo(0);
  const start = daysAgo(weeks * 7 - 1 + ((today.getDay() + 6) % 7) - 6); // align columns to Mondays
  let html = "", lastMonth = -1, total = 0;
  const max = Math.max(1, habits.length);
  for (let w = 0; w < weeks; w++) {
    const colStart = new Date(start); colStart.setDate(start.getDate() + w * 7);
    const m = colStart.getMonth();
    html += `<span class="m" style="grid-column:${w + 1}">${m !== lastMonth ? colStart.toLocaleDateString(undefined, { month: "short" }) : ""}</span>`;
    lastMonth = m;
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart); day.setDate(colStart.getDate() + d);
      const k = keyOf(day), n = habits.filter((h) => h.done[k]).length;
      total += n;
      const lvl = n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
      html += `<span class="c ${day > today ? "future" : `l${lvl}`}" style="grid-column:${w + 1};grid-row:${d + 2}" title="${day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${n} habit${n === 1 ? "" : "s"}"></span>`;
    }
  }
  $("#heat").innerHTML = html;
  $("#heat-total").textContent = `${total} check-ins in the last ${weeks > 30 ? "year" : "6 months"}`;
  const sc = $(".heat-scroll"); sc.scrollLeft = sc.scrollWidth;
}

// ---------- Stacked bar chart ----------
let anim;
function renderChart() {
  const canvas = $("#chart"), dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = 220;
  if (!w) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));
  const max = Math.max(1, habits.length);
  const pad = { l: 26, r: 4, t: 8, b: 26 }, cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
  const slot = cw / 14, bw = Math.min(30, slot * 0.62);
  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue("--muted").trim(), border = css.getPropertyValue("--border").trim();
  cancelAnimationFrame(anim);
  const t0 = performance.now();
  const frame = (t) => {
    const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "12px Inter, system-ui, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 0; i <= max; i++) {
      if (max > 6 && i % 2) continue;
      const y = pad.t + ch - (i / max) * ch;
      ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(pad.l, y + 0.5); ctx.lineTo(w - pad.r, y + 0.5); ctx.stroke();
      ctx.fillStyle = muted; ctx.fillText(i, pad.l - 8, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    days.forEach((d, i) => {
      const x = pad.l + slot * i + (slot - bw) / 2, k = keyOf(d);
      const done = habits.filter((hb) => hb.done[k]);
      let y = pad.t + ch;
      done.forEach((hb, j) => {
        const seg = (ch / max) * e - 2;
        ctx.fillStyle = hb.color;
        ctx.beginPath();
        const top = j === done.length - 1;
        if (ctx.roundRect) ctx.roundRect(x, y - seg, bw, seg, top ? [6, 6, 2, 2] : 2); else ctx.rect(x, y - seg, bw, seg);
        ctx.fill();
        y -= seg + 2;
      });
      if (slot > 24 || i % 2) { ctx.fillStyle = i === 13 ? "#e7e9ee" : muted; ctx.fillText(i === 13 ? "Today" : d.getDate(), x + bw / 2, pad.t + ch + 8); }
    });
    if (p < 1) anim = requestAnimationFrame(frame);
  };
  anim = requestAnimationFrame(frame);
  $("#chart-legend").innerHTML = habits.map((hb) => `<span><i style="background:${hb.color}"></i>${esc(hb.name)}</span>`).join("");
}

// ---------- Confetti ----------
function confetti() {
  const c = $("#confetti"), ctx = c.getContext("2d"), dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const t0 = performance.now();
  (function tick(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (t - t0 < 2800) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

function renderAll() { renderToday(); renderGrid(); renderHeat(); renderChart(); }

// ---------- Events ----------
$("#grid").addEventListener("click", (e) => {
  const t = e.target.closest("[data-toggle]");
  if (t) {
    const h = habits.find((x) => x.id === t.dataset.toggle), k = t.dataset.day;
    const before = habits.every((x) => x.done[TODAY()]);
    if (h.done[k]) delete h.done[k]; else h.done[k] = true;
    save(); renderAll();
    if (!before && habits.length && habits.every((x) => x.done[TODAY()]) && !matchMedia("(prefers-reduced-motion: reduce)").matches) confetti();
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del) {
    const h = habits.find((x) => x.id === del.dataset.del);
    if (confirm(`Remove “${h.name}” and its history?`)) { habits = habits.filter((x) => x !== h); save(); renderAll(); }
    return;
  }
  if (e.target.closest("#add-open")) openSheet();
});

let pickEmoji = EMOJIS[0], pickColor = COLORS[0];
function renderPickers() {
  $("#emoji-pick").innerHTML = EMOJIS.map((em) => `<button type="button" role="radio" aria-checked="${em === pickEmoji}" data-emoji="${em}">${em}</button>`).join("");
  $("#color-pick").innerHTML = COLORS.map((c) => `<button type="button" role="radio" aria-checked="${c === pickColor}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("");
}
function openSheet() {
  pickEmoji = EMOJIS[habits.length % EMOJIS.length]; pickColor = COLORS[habits.length % COLORS.length];
  renderPickers(); $("#name").value = "";
  const sheet = $("#sheet");
  if (sheet.showModal) sheet.showModal(); else sheet.setAttribute("open", "");
  $("#name").focus();
}
$("#emoji-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-emoji]"); if (b) { pickEmoji = b.dataset.emoji; renderPickers(); } });
$("#color-pick").addEventListener("click", (e) => { const b = e.target.closest("[data-color]"); if (b) { pickColor = b.dataset.color; renderPickers(); } });
$("#sheet").addEventListener("close", () => {
  if ($("#sheet").returnValue !== "ok") return;
  const name = $("#name").value.trim();
  if (!name) return;
  habits.push({ id: Math.random().toString(36).slice(2), emoji: pickEmoji, name, color: pickColor, done: {} });
  save(); renderAll();
  window.showToast?.(`Added “${name}”`);
});
$("#reset").addEventListener("click", () => {
  if (!confirm("Replace your habits with fresh example data?")) return;
  habits = sample(); save(); renderAll();
});
let rt;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { renderChart(); renderHeat(); }, 150); });
renderAll();
