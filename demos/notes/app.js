// Markdown Notes — local-only notes with a tiny Markdown renderer
const $ = (s) => document.querySelector(s);
const KEY = "notes-demo:v1";
const els = { list: $("#list"), title: $("#title"), body: $("#body"), preview: $("#preview"), panes: $("#panes"), status: $("#status"), filter: $("#filter") };

const WELCOME = `# Welcome 👋

This is a **Markdown** notes app. Everything is saved in *your* browser.

## Things you can do
- Write with \`**bold**\`, \`*italic*\` and \`inline code\`
- Make [links](https://www.markdownguide.org/basic-syntax/)
- [x] Tick off tasks
- [ ] Open this page in two tabs and watch them sync

> Tip: switch between **Write**, **Preview** and **Split** above.

\`\`\`js
console.log("Code blocks work too");
\`\`\`
`;

let notes = load();
let currentId = notes[0]?.id;
let view = matchMedia("(max-width: 860px)").matches ? "write" : "split";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return [{ id: uid(), title: "Welcome", body: WELCOME, updated: Date.now() }];
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(notes)); els.status.textContent = "Saved in this browser"; }
  catch { els.status.textContent = "⚠️ Couldn't save — storage may be disabled"; }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const current = () => notes.find((n) => n.id === currentId);

// ---------- Tiny, safe Markdown renderer ----------
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}
function markdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  let html = "", list = null, para = [];
  const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (line.startsWith("```")) {
      flushPara(); closeList();
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      html += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
    } else if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      flushPara(); closeList();
      html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara(); closeList(); html += "<hr>";
    } else if ((m = line.match(/^>\s?(.*)/))) {
      flushPara(); closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`;
    } else if ((m = line.match(/^\s*([-*]|\d+\.)\s+(.*)/))) {
      flushPara();
      const type = /\d/.test(m[1]) ? "ol" : "ul";
      if (list !== type) { closeList(); html += `<${type}>`; list = type; }
      const task = m[2].match(/^\[( |x)\]\s+(.*)/i);
      html += task
        ? `<li class="task"><input type="checkbox" disabled ${task[1].trim() ? "checked" : ""}> ${inline(task[2])}</li>`
        : `<li>${inline(m[2])}</li>`;
    } else if (!line.trim()) {
      flushPara(); closeList();
    } else {
      closeList(); para.push(line.trim());
    }
  }
  flushPara(); closeList();
  return html || '<p class="muted">Nothing to preview yet.</p>';
}

// ---------- UI ----------
function renderList() {
  const q = els.filter.value.trim().toLowerCase();
  const shown = [...notes].sort((a, b) => b.updated - a.updated)
    .filter((n) => !q || (n.title + " " + n.body).toLowerCase().includes(q));
  els.list.innerHTML = shown.length
    ? shown.map((n) => `<li class="${n.id === currentId ? "active" : ""}" data-id="${n.id}">
        <strong>${esc(n.title || "Untitled")}</strong><span>${new Date(n.updated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span></li>`).join("")
    : `<li class="empty">No notes found</li>`;
}
function renderEditor() {
  const n = current();
  if (!n) return;
  els.title.value = n.title;
  els.body.value = n.body;
  els.preview.innerHTML = markdown(n.body);
}
function setView(v) {
  view = v;
  els.panes.className = "panes " + v;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  if (v !== "write") els.preview.innerHTML = markdown(els.body.value);
}

let saveTimer;
function onEdit() {
  const n = current();
  n.title = els.title.value;
  n.body = els.body.value;
  n.updated = Date.now();
  if (view !== "write") els.preview.innerHTML = markdown(n.body);
  els.status.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { save(); renderList(); }, 300);
}

els.title.addEventListener("input", onEdit);
els.body.addEventListener("input", onEdit);
els.filter.addEventListener("input", renderList);
els.list.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  currentId = li.dataset.id;
  renderList(); renderEditor();
});
$("#new-note").addEventListener("click", () => {
  const n = { id: uid(), title: "", body: "", updated: Date.now() };
  notes.push(n); currentId = n.id;
  save(); renderList(); renderEditor();
  if (view === "preview") setView("write");
  els.title.focus();
});
$("#delete").addEventListener("click", () => {
  const n = current();
  if (!n || !confirm(`Delete “${n.title || "Untitled"}”?`)) return;
  notes = notes.filter((x) => x.id !== n.id);
  if (!notes.length) notes.push({ id: uid(), title: "", body: "", updated: Date.now() });
  currentId = [...notes].sort((a, b) => b.updated - a.updated)[0].id;
  save(); renderList(); renderEditor();
});
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// Sync between tabs: the "storage" event fires in other tabs when we save
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  notes = load();
  if (!current()) currentId = notes[0].id;
  renderList();
  if (document.activeElement !== els.body && document.activeElement !== els.title) renderEditor();
  els.status.textContent = "Synced from another tab";
});

renderList(); renderEditor(); setView(view);
