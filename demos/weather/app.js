// Weather Dashboard — uses the free Open-Meteo APIs (no API key needed)
const $ = (s) => document.querySelector(s);
const out = $("#weather");
const input = $("#city");
const list = $("#suggestions");
const CACHE_KEY = "weather-demo:last";

// WMO weather codes -> label + emoji
const CODES = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm, hail", "⛈️"], 99: ["Thunderstorm, hail", "⛈️"],
};
const code = (c) => CODES[c] || ["Unknown", "🌡️"];
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

async function geocode(name, count = 5) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search failed");
  return (await res.json()).results || [];
}

async function forecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: "auto",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("Forecast failed");
  return res.json();
}

function placeLabel(p) {
  return [p.name, p.admin1, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", ");
}

function loading() {
  out.innerHTML = `<div class="panel row" style="justify-content:center;gap:14px"><div class="spinner"></div><span class="muted">Loading forecast…</span></div>`;
}
function error(msg) {
  out.innerHTML = `<div class="panel empty fade-in">⚠️ ${esc(msg)}</div>`;
}

function render(data, label, cachedAt) {
  const c = data.current;
  const [desc, icon] = code(c.weather_code);
  const d = data.daily;
  const days = d.time.map((t, i) => {
    const date = new Date(t + "T12:00");
    const name = i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const [dd, di] = code(d.weather_code[i]);
    return `<div class="day fade-in" style="animation-delay:${i * 50}ms">
      <div class="d">${name}</div><div class="i" title="${dd}">${di}</div>
      <div class="hi">${Math.round(d.temperature_2m_max[i])}°</div><div class="lo">${Math.round(d.temperature_2m_min[i])}°</div>
    </div>`;
  }).join("");

  out.innerHTML = `
    <div class="panel fade-in">
      <div class="now">
        <div class="big-icon">${icon}</div>
        <div class="temp">${Math.round(c.temperature_2m)}°C</div>
        <div><strong>${desc}</strong> <span class="place">· ${esc(label)}</span></div>
      </div>
      <div class="stats">
        <div class="stat"><span>Feels like</span><strong>${Math.round(c.apparent_temperature)}°C</strong></div>
        <div class="stat"><span>Humidity</span><strong>${c.relative_humidity_2m}%</strong></div>
        <div class="stat"><span>Wind</span><strong>${Math.round(c.wind_speed_10m)} km/h</strong></div>
        <div class="stat"><span>Rain chance today</span><strong>${d.precipitation_probability_max?.[0] ?? "–"}%</strong></div>
      </div>
      ${cachedAt ? `<p class="muted small" style="margin:16px 0 0">📦 Offline — showing saved forecast from ${new Date(cachedAt).toLocaleString()}</p>` : ""}
    </div>
    <div class="panel fade-in"><h2>7-day forecast</h2><div class="days">${days}</div></div>`;
}

async function show(lat, lon, label) {
  loading();
  try {
    const data = await forecast(lat, lon);
    render(data, label);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, label, lat, lon, at: Date.now() })); } catch {}
  } catch {
    const cached = readCache();
    if (cached) render(cached.data, cached.label, cached.at);
    else error("Couldn't load the forecast. Check your connection and try again.");
  }
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

// --- Search with autocomplete suggestions ---
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
      list.innerHTML = results.map((r, i) => `<li role="option" data-i="${i}">${esc(r.name)} <small>${esc([r.admin1, r.country].filter(Boolean).join(", "))}</small></li>`).join("");
      list.hidden = false;
    } catch { hideList(); }
  }, 250);
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
input.addEventListener("blur", () => setTimeout(hideList, 100));
function hideList() { list.hidden = true; list.innerHTML = ""; active = -1; }
function pick(p) {
  hideList();
  input.value = p.name;
  show(p.latitude, p.longitude, placeLabel(p));
}

$("#search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!list.hidden && active >= 0) return pick(results[active]);
  const q = input.value.trim();
  if (!q) return;
  loading();
  try {
    const [first] = await geocode(q, 1);
    if (!first) return error(`No place called “${q}” was found.`);
    pick(first);
  } catch {
    error("Search failed. Check your connection and try again.");
  }
});

$("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return error("Your browser doesn't support location.");
  loading();
  navigator.geolocation.getCurrentPosition(
    (pos) => show(pos.coords.latitude, pos.coords.longitude, "Your location"),
    () => error("Location permission was denied. Try searching for a city instead.")
  );
});

// --- Start with the last viewed place, or a default city ---
const last = readCache();
if (last) show(last.lat, last.lon, last.label);
else show(55.6761, 12.5683, "Copenhagen, Denmark");
