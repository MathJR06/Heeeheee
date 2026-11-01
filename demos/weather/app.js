// Weather — live data from the free Open-Meteo APIs (no API key needed)
const $ = (s) => document.querySelector(s);
const out = $("#weather");
const input = $("#city");
const list = $("#suggestions");
const CACHE_KEY = "weather-demo:v2";
const UNIT_KEY = "weather-demo:unit";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const state = { data: null, label: "", cachedAt: null, unit: store.get(UNIT_KEY) === "F" ? "F" : "C" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const conv = (c) => (state.unit === "F" ? (c * 9) / 5 + 32 : c);
const deg = (c) => `${Math.round(conv(c))}°`;

// ---------- Weather codes ----------
const LABELS = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers", 81: "Rain showers",
  82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};
function kindOf(code) {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  if (code >= 51) return "rain";
  return "cloudy";
}

// ---------- Animated SVG icons ----------
const SUN = `<g class="i-sun"><g class="i-rays">${Array.from({ length: 8 }, (_, i) => `<line x1="32" y1="8" x2="32" y2="13.5" transform="rotate(${i * 45} 32 32)"/>`).join("")}</g><circle cx="32" cy="32" r="11.5"/></g>`;
const MOON = `<path class="i-moon" d="M38 11a21 21 0 1 0 15 32A17 17 0 0 1 38 11z"/>`;
const cloud = (dark = false) => `<g class="i-cloud${dark ? " dark" : ""}"><circle cx="24" cy="38" r="10"/><circle cx="36" cy="31" r="13"/><circle cx="47" cy="39" r="8"/><rect x="14" y="38" width="41" height="10" rx="5"/></g>`;
function icon(kind, isDay = true, animated = false) {
  let g;
  switch (kind) {
    case "clear": g = isDay ? SUN : MOON; break;
    case "partly": g = `<g transform="translate(-7 -9) scale(.85)">${isDay ? SUN : MOON}</g><g transform="translate(3 4)">${cloud()}</g>`; break;
    case "cloudy": g = `<g transform="translate(-6 -7) scale(.7)" opacity=".75">${cloud(true)}</g>${cloud()}`; break;
    case "rain": g = `${cloud(true)}<g class="i-drops"><line x1="25" y1="52" x2="22.5" y2="58"/><line x1="34" y1="52" x2="31.5" y2="58"/><line x1="43" y1="52" x2="40.5" y2="58"/></g>`; break;
    case "snow": g = `${cloud()}<g class="i-flakes"><circle cx="25" cy="55" r="2.4"/><circle cx="35" cy="55" r="2.4"/><circle cx="45" cy="55" r="2.4"/></g>`; break;
    case "thunder": g = `${cloud(true)}<path class="i-bolt" d="M35 43l-8 11h6l-3 9 11-13h-6l3-7z"/>`; break;
    case "fog": g = `${cloud()}<g class="i-fog"><line x1="12" y1="53" x2="46" y2="53"/><line x1="20" y1="59" x2="54" y2="59"/></g>`; break;
  }
  return `<svg class="wx-icon${animated ? " anim" : ""}" viewBox="0 0 64 64" aria-hidden="true">${g}</svg>`;
}

// ---------- Sky background + particles ----------
function skyClass(kind, isDay) {
  if (kind === "clear" || kind === "partly") return isDay ? "sky-clear-day" : "sky-clear-night";
  if (kind === "cloudy") return isDay ? "sky-cloudy-day" : "sky-cloudy-night";
  return "sky-" + kind;
}
const r = (a, b) => a + Math.random() * (b - a);
function particles(kind, isDay) {
  let h = "";
  const rep = (n, f) => { for (let i = 0; i < n; i++) h += f(i); };
  if ((kind === "clear" || kind === "partly") && isDay) h += `<div class="glow"></div>`;
  if (!isDay && kind !== "rain" && kind !== "thunder" && kind !== "fog")
    rep(kind === "clear" ? 70 : 30, () => `<span class="star" style="left:${r(0, 100)}%;top:${r(0, 85)}%;opacity:${r(0.3, 1).toFixed(2)};animation-delay:${r(0, 3).toFixed(2)}s;transform:scale(${r(0.6, 1.4).toFixed(2)})"></span>`);
  if (kind === "partly" || kind === "cloudy" || kind === "rain" || kind === "snow" || kind === "thunder")
    rep(3, (i) => `<span class="blob" style="left:${i * 35 - 10}%;top:${r(-20, 40)}%;width:${r(220, 380)}px;height:${r(120, 200)}px;animation-duration:${r(22, 36)}s"></span>`);
  if (kind === "rain" || kind === "thunder")
    rep(70, () => `<span class="drop" style="left:${r(0, 110)}%;animation-duration:${r(0.55, 0.9).toFixed(2)}s;animation-delay:-${r(0, 1).toFixed(2)}s;opacity:${r(0.4, 1).toFixed(2)}"></span>`);
  if (kind === "snow")
    rep(60, () => { const s = r(2, 5).toFixed(1); return `<span class="flake" style="left:${r(-5, 100)}%;width:${s}px;height:${s}px;animation-duration:${r(5, 11).toFixed(1)}s;animation-delay:-${r(0, 10).toFixed(1)}s"></span>`; });
  if (kind === "thunder") h += `<div class="flash"></div>`;
  if (kind === "fog") rep(3, (i) => `<span class="mist" style="top:${20 + i * 25}%;animation-duration:${10 + i * 4}s"></span>`);
  return `<div class="fx" aria-hidden="true">${h}</div>`;
}

// ---------- Small helpers ----------
const minutes = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
const hhmm = (iso) => iso.slice(11, 16);
function tempColor(c) {
  // cold blue -> fresh green -> warm yellow -> hot orange/red
  const stops = [[-15, [125, 160, 255]], [0, [90, 200, 250]], [12, [100, 220, 160]], [20, [255, 214, 10]], [28, [255, 159, 10]], [38, [255, 69, 58]]];
  if (c <= stops[0][0]) return `rgb(${stops[0][1]})`;
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [t0, a] = stops[i - 1], [t1, b] = stops[i], f = (c - t0) / (t1 - t0);
      return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f))})`;
    }
  }
  return `rgb(${stops.at(-1)[1]})`;
}
function uvLabel(u) { return u < 3 ? "Low" : u < 6 ? "Moderate" : u < 8 ? "High" : u < 11 ? "Very high" : "Extreme"; }
function compassDir(d) { return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(d / 45) % 8]; }
function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  return d;
}
const ICON = {
  pin: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`,
  temp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/></svg>`,
  drop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h7"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 18a5 5 0 0 0-10 0M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/></svg>`,
};

// ---------- Rendering ----------
function render() {
  const { data, label, cachedAt } = state;
  const c = data.current, d = data.daily, h = data.hourly;
  const kind = kindOf(c.weather_code), isDay = c.is_day === 1;
  const now = new Date(c.time);
  const dayName = now.toLocaleDateString(undefined, { weekday: "long" });

  // Sun position along today's arc
  const rise = minutes(d.sunrise[0]), set = minutes(d.sunset[0]), cur = minutes(c.time);
  const f = Math.max(0, Math.min(1, (cur - rise) / (set - rise)));
  const sx = 60 - 48 * Math.cos(Math.PI * f), sy = 56 - 48 * Math.sin(Math.PI * f);
  const daylight = set - rise;

  // Next 24 hours
  let start = h.time.findIndex((t) => t.slice(0, 13) === c.time.slice(0, 13));
  if (start < 0) start = 0;
  const hours = h.time.slice(start, start + 25).map((t, i) => ({
    t, temp: h.temperature_2m[start + i], code: h.weather_code[start + i],
    p: h.precipitation_probability?.[start + i] ?? 0, day: h.is_day?.[start + i] ?? 1,
  }));
  const COL = 64, CH = 96, PAD = 22;
  const temps = hours.map((x) => x.temp);
  const tMin = Math.min(...temps), tMax = Math.max(...temps), tSpan = Math.max(1, tMax - tMin);
  const pts = hours.map((x, i) => [i * COL + COL / 2, PAD + (CH - PAD * 1.6) * (1 - (x.temp - tMin) / tSpan)]);
  const line = smoothPath(pts);
  const area = `${line} L${pts.at(-1)[0]},${CH} L${pts[0][0]},${CH} Z`;
  const W = hours.length * COL;

  // Week range for the bars
  const wMin = Math.min(...d.temperature_2m_min), wMax = Math.max(...d.temperature_2m_max), wSpan = Math.max(1, wMax - wMin);

  out.innerHTML = `
  <section class="sky ${skyClass(kind, isDay)} fade-in">
    ${particles(kind, isDay)}
    <div class="sky-grid">
      <div>
        <div class="sky-place">${ICON.pin}${esc(label)}</div>
        <div class="sky-time">${dayName} · ${hhmm(c.time)} local time</div>
      </div>
      ${icon(kind, isDay, true).replace('class="wx-icon', 'class="sky-icon wx-icon')}
      <div>
        <div class="sky-temp">${deg(c.temperature_2m)}</div>
        <div class="sky-desc">${LABELS[c.weather_code] || "—"}</div>
        <div class="sky-hl">H ${deg(d.temperature_2m_max[0])} · L ${deg(d.temperature_2m_min[0])}</div>
      </div>
    </div>
    ${cachedAt ? `<p class="offline-note">You're offline. Showing the forecast saved ${new Date(cachedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>` : ""}
  </section>

  <section class="tiles">
    <div class="tile fade-in" style="animation-delay:60ms">
      <div class="tile-label">${ICON.temp} Feels like</div>
      <div class="tile-value">${deg(c.apparent_temperature)}</div>
      <div class="tile-sub">${Math.abs(c.apparent_temperature - c.temperature_2m) < 1.5 ? "Similar to the actual temperature." : c.apparent_temperature < c.temperature_2m ? "Wind is making it feel colder." : "Humidity is making it feel warmer."}</div>
    </div>
    <div class="tile fade-in" style="animation-delay:110ms">
      <div class="tile-label">${ICON.wind} Wind</div>
      <div class="wind-row">
        <div class="tile-value">${Math.round(c.wind_speed_10m)}<small style="font-size:.9rem;font-weight:600;color:var(--muted)"> km/h</small></div>
        <svg class="compass" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" stroke-width="2"/>
          ${[0, 90, 180, 270].map((a) => `<line x1="32" y1="6" x2="32" y2="11" stroke="var(--muted)" stroke-width="2" transform="rotate(${a} 32 32)"/>`).join("")}
          <text x="32" y="22" text-anchor="middle" font-size="8" font-weight="700" fill="var(--muted)">N</text>
          <g class="needle" style="transform:rotate(${(c.wind_direction_10m + 180) % 360}deg)"><path d="M32 14l6 22h-12z" fill="var(--accent)"/><circle cx="32" cy="32" r="3.5" fill="var(--text)"/></g>
        </svg>
      </div>
      <div class="tile-sub">Blowing from the ${compassDir(c.wind_direction_10m)}</div>
    </div>
    <div class="tile fade-in" style="animation-delay:160ms">
      <div class="tile-label">${ICON.drop} Humidity</div>
      <div class="tile-value">${c.relative_humidity_2m}%</div>
      <div class="meter"><i style="width:${c.relative_humidity_2m}%"></i></div>
      <div class="tile-sub">${c.relative_humidity_2m > 75 ? "Damp. It might feel muggy." : c.relative_humidity_2m < 35 ? "Dry air today." : "Comfortable."}</div>
    </div>
    <div class="tile fade-in" style="animation-delay:210ms">
      <div class="tile-label">${ICON.sun} UV index</div>
      <div class="tile-value">${Math.round(d.uv_index_max[0])} <small style="font-size:.95rem;font-weight:600">${uvLabel(d.uv_index_max[0])}</small></div>
      <div class="meter uv"><b style="left:${Math.min(100, (d.uv_index_max[0] / 11) * 100)}%"></b></div>
      <div class="tile-sub">Today's peak</div>
    </div>
  </section>

  <section class="card-h fade-in" style="animation-delay:120ms">
    <h2>Next 24 hours</h2>
    <div class="hourly-scroll">
      <div class="hourly" style="width:${W}px;grid-template-columns:repeat(${hours.length},${COL}px)">
        <svg class="hourly-curve" width="${W}" height="${CH}" viewBox="0 0 ${W} ${CH}" aria-hidden="true">
          <defs>
            <linearGradient id="hc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tempColor(tMax)}"/><stop offset="1" stop-color="${tempColor(tMin)}"/></linearGradient>
            <linearGradient id="hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tempColor(tMax)}" stop-opacity=".28"/><stop offset="1" stop-color="${tempColor(tMin)}" stop-opacity="0"/></linearGradient>
          </defs>
          <path d="${area}" fill="url(#hf)"/>
          <path d="${line}" fill="none" stroke="url(#hc)" stroke-width="3" stroke-linecap="round"/>
          ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y.toFixed(1)}" r="${i === 0 ? 5 : 3}" fill="${i === 0 ? "#fff" : tempColor(hours[i].temp)}"/><text x="${x}" y="${(y - 11).toFixed(1)}">${deg(hours[i].temp)}</text>`).join("")}
        </svg>
        ${hours.map((x, i) => `<div class="hour">
          <span class="t ${i === 0 ? "now" : ""}">${i === 0 ? "Now" : hhmm(x.t)}</span>
          ${icon(kindOf(x.code), x.day === 1)}
          <span class="gap"></span>
          <span class="p">${x.p >= 10 ? x.p + "%" : ""}</span>
        </div>`).join("")}
      </div>
    </div>
  </section>

  <div class="two">
    <section class="card-h fade-in" style="animation-delay:160ms">
      <h2>7-day forecast</h2>
      <ul class="daily">
        ${d.time.map((t, i) => {
          const lo = d.temperature_2m_min[i], hi = d.temperature_2m_max[i];
          const left = ((lo - wMin) / wSpan) * 100, width = Math.max(4, ((hi - lo) / wSpan) * 100);
          const nowDot = i === 0 ? `<b style="left:${Math.min(100, Math.max(0, ((c.temperature_2m - wMin) / wSpan) * 100))}%"></b>` : "";
          const pp = d.precipitation_probability_max?.[i] ?? 0;
          return `<li>
            <span class="dn">${i === 0 ? "Today" : new Date(t + "T12:00").toLocaleDateString(undefined, { weekday: "short" })}</span>
            ${icon(kindOf(d.weather_code[i]), true)}
            <span class="pp">${pp >= 20 ? pp + "%" : ""}</span>
            <span class="lo">${deg(lo)}</span>
            <span class="range"><i style="left:${left}%;width:${width}%;background:linear-gradient(90deg,${tempColor(lo)},${tempColor(hi)})"></i>${nowDot}</span>
            <span class="hi">${deg(hi)}</span>
          </li>`;
        }).join("")}
      </ul>
    </section>

    <section class="tile fade-in" style="animation-delay:200ms;border-radius:24px">
      <div class="tile-label">${ICON.sunrise} Sunrise &amp; sunset</div>
      <svg class="sun-arc" viewBox="0 0 120 70" aria-hidden="true">
        <defs><linearGradient id="arcg" x1="0" x2="1"><stop offset="0" stop-color="#ff9f0a"/><stop offset=".5" stop-color="#ffd60a"/><stop offset="1" stop-color="#bf5af2"/></linearGradient></defs>
        <line x1="4" y1="56" x2="116" y2="56" stroke="var(--border)" stroke-width="1"/>
        <path d="M12 56 A48 48 0 0 1 108 56" fill="none" stroke="var(--border)" stroke-width="2" stroke-dasharray="3 4"/>
        <path d="M12 56 A48 48 0 0 1 108 56" fill="none" stroke="url(#arcg)" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="${(f * 100).toFixed(1)} 100"/>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="5" fill="${isDay ? "#ffd60a" : "#6b7280"}" ${isDay ? 'style="filter:drop-shadow(0 0 6px #ffd60a)"' : ""}/>
      </svg>
      <div class="row" style="justify-content:space-between;margin-top:6px">
        <div><div class="muted small">Sunrise</div><strong style="font-size:1.25rem">${hhmm(d.sunrise[0])}</strong></div>
        <div style="text-align:right"><div class="muted small">Sunset</div><strong style="font-size:1.25rem">${hhmm(d.sunset[0])}</strong></div>
      </div>
      <div class="tile-sub">${Math.floor(daylight / 60)} h ${daylight % 60} min of daylight today</div>
    </section>
  </div>`;
}

function loading() {
  out.innerHTML = `<div class="skel" style="height:340px"></div>
    <div class="tiles">${'<div class="skel" style="height:150px;border-radius:20px"></div>'.repeat(4)}</div>
    <div class="skel" style="height:220px"></div>`;
}
function error(msg, emoji = "🌧️") {
  out.innerHTML = `<div class="state fade-in"><div class="big">${emoji}</div><strong>Something went wrong</strong><p>${esc(msg)}</p></div>`;
}

// ---------- Data ----------
async function geocode(name, count = 6) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`);
  if (!res.ok) throw new Error("Search failed");
  return (await res.json()).results || [];
}
async function forecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto", forecast_days: 7,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("Forecast failed");
  return res.json();
}
const placeLabel = (p) => [p.name, p.country].filter(Boolean).join(", ");

function readCache() { try { return JSON.parse(store.get(CACHE_KEY)); } catch { return null; } }

async function show(lat, lon, label) {
  loading();
  try {
    const data = await forecast(lat, lon);
    Object.assign(state, { data, label, cachedAt: null });
    render();
    store.set(CACHE_KEY, JSON.stringify({ data, label, lat, lon, at: Date.now() }));
  } catch {
    const cached = readCache();
    if (cached) { Object.assign(state, { data: cached.data, label: cached.label, cachedAt: cached.at }); render(); }
    else error("Couldn't load the forecast. Check your connection and try again.");
  }
}

// ---------- Search with suggestions ----------
let results = [], active = -1, timer;
input.addEventListener("input", () => {
  clearTimeout(timer);
  const q = input.value.trim();
  if (q.length < 2) return hideList();
  timer = setTimeout(async () => {
    try {
      results = await geocode(q);
      if (!results.length || input.value.trim() !== q) return hideList();
      active = -1;
      list.innerHTML = results.map((p, i) => `<li role="option" data-i="${i}"><span>${esc(p.name)}</span><small>${esc([p.admin1, p.country].filter(Boolean).join(", "))}</small></li>`).join("");
      list.hidden = false;
    } catch { hideList(); }
  }, 220);
});
input.addEventListener("keydown", (e) => {
  if (list.hidden) return;
  const items = [...list.children];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("active", i === active));
  } else if (e.key === "Escape") hideList();
});
list.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li");
  if (li) { e.preventDefault(); pick(results[+li.dataset.i]); }
});
input.addEventListener("blur", () => setTimeout(hideList, 120));
function hideList() { list.hidden = true; list.innerHTML = ""; active = -1; }
function pick(p) { hideList(); input.value = ""; input.blur(); show(p.latitude, p.longitude, placeLabel(p)); }

$("#search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!list.hidden && active >= 0) return pick(results[active]);
  const q = input.value.trim();
  if (!q) return;
  loading();
  try {
    const [first] = await geocode(q, 1);
    if (!first) return error(`No place called “${q}” was found.`, "🧭");
    pick(first);
  } catch { error("Search failed. Check your connection and try again."); }
});

$("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return error("Your browser doesn't support location.", "📍");
  loading();
  navigator.geolocation.getCurrentPosition(
    (pos) => show(pos.coords.latitude, pos.coords.longitude, "Your location"),
    () => error("Location permission was denied. Try searching for a city instead.", "📍"),
    { timeout: 10000 }
  );
});

// ---------- Units ----------
function syncUnits() { document.querySelectorAll("[data-unit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit))); }
document.querySelectorAll("[data-unit]").forEach((b) => b.addEventListener("click", () => {
  state.unit = b.dataset.unit; store.set(UNIT_KEY, state.unit); syncUnits();
  if (state.data) render();
}));
syncUnits();

// ---------- Start ----------
const last = readCache();
if (last) show(last.lat, last.lon, last.label);
else show(55.6761, 12.5683, "Copenhagen, Denmark");
