// Markdown Notes: a private, local-only notes app with a small Markdown renderer
const $ = (s) => document.querySelector(s);
const KEY = "notes-demo:v2";
const els = { app: $("#app"), list: $("#list"), title: $("#title"), body: $("#body"), preview: $("#preview"), panes: $("#panes"), meta: $("#meta"), status: $("#status"), filter: $("#filter") };
const COLORS = { none: "", blue: "#7c9cff", purple: "#b48cff", green: "#4ade80", amber: "#fbbf24", rose: "#fb7185" };

const now = Date.now();
const SAMPLE = [
  { title: "Welcome to Notes 👋", color: "blue", pinned: true, body: `This is a small, **private** notes app. Everything you write stays in *this* browser. Nothing is sent anywhere.

## Try it out
- [x] Open the app
- [ ] Tick this box in **Read** view
- [ ] Pin a note, give it a colour, or press **Focus**
- [ ] Open this page in two tabs and watch them sync

> Tip: select some text and press **Ctrl+B** to make it bold, or use the toolbar.

### Markdown works too
Write \`inline code\`, [links](https://www.markdownguide.org/basic-syntax/), lists and code blocks:

\`\`\`js
const idea = "build it anyway";
console.log(idea);
\`\`\`
` },
  { title: "Songs to learn on guitar", color: "rose", body: `## This month
1. Wonderwall, but properly this time
2. Blackbird (fingerpicking 😬)
3. Something with a solo

## Practice routine
- [x] 10 min chord changes
- [ ] 10 min scales
- [ ] Play one song start to finish

---
*Mean on the guitar, working on it.*` },
  { title: "Project ideas", color: "amber", body: `Things I know nothing about (yet):

- A **weather app** with animated skies ✅
- A **colour palette** tool ✅
- A tiny game in the browser
- Something with maps 🗺️

> The best way to learn is to build the thing.` },
].map((n, i) => ({ id: "s" + i, pinned: false, ...n, updated: now - i * 3600e3 * 7 }));

const store = {
  load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(s) && s.length) return s; } catch {} return SAMPLE.map((n) => ({ ...n })); },
  save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } },
};
let notes = store.load();
let currentId = sorted()[0]?.id;
let view = matchMedia("(max-width: 900px)").matches ? "preview" : "split";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const current = () => notes.find((n) => n.id === currentId);
function sorted() { return [...notes].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated)); }

// ---------- Tiny, safe Markdown renderer ----------
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
}
function markdown(src) {
  const lines = src.replace(/\r/g, "").split("\n");
  let html = "", list = null, para = [], task = 0;
  const flush = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (line.startsWith("```")) {
      flush(); close();
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      html += `<pre><code>${esc(code.join("\n"))}</code></pre>`;
    } else if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      flush(); close(); html += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flush(); close(); html += "<hr>";
    } else if ((m = line.match(/^>\s?(.*)/))) {
      flush(); close(); html += `<blockquote>${inline(m[1])}</blockquote>`;
    } else if ((m = line.match(/^\s*([-*]|\d+\.)\s+(.*)/))) {
      flush();
      const type = /\d/.test(m[1]) ? "ol" : "ul";
      if (list !== type) { close(); html += `<${type}>`; list = type; }
      const t = m[2].match(/^\[( |x)\]\s+(.*)/i);
      html += t
        ? `<li class="task${t[1].trim() ? " done" : ""}"><input type="checkbox" data-task="${task++}" ${t[1].trim() ? "checked" : ""} aria-label="Toggle task"><span>${inline(t[2])}</span></li>`
        : `<li>${inline(m[2])}</li>`;
    } else if (!line.trim()) { flush(); close(); }
    else { close(); para.push(line.trim()); }
  }
  flush(); close();
  return html || '<p class="empty-prev">Nothing here yet. Start writing on the left.</p>';
}
const plain = (s) => s.replace(/```[\s\S]*?```/g, "").replace(/[#>*_`~\-\[\]()]/g, " ").replace(/\s+/g, " ").trim();

// ---------- Rendering ----------
const PIN = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6zM11 13h2v8h-2z"/></svg>`;
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function renderList() {
  const q = els.filter.value.trim().toLowerCase();
  const hl = (s) => { const e = esc(s); if (!q) return e; const i = e.toLowerCase().indexOf(esc(q)); return i < 0 ? e : e.slice(0, i) + "<mark>" + e.slice(i, i + esc(q).length) + "</mark>" + e.slice(i + esc(q).length); };
  const shown = sorted().filter((n) => !q || (n.title + " " + n.body).toLowerCase().includes(q));
  const item = (n) => `<button class="item ${n.id === currentId ? "active" : ""}" data-id="${n.id}" style="--c:${COLORS[n.color || "none"] || "transparent"}">
      <strong>${n.pinned ? PIN : ""}<span>${hl(n.title || "Untitled")}</span></strong>
      <span class="ex">${hl(plain(n.body).slice(0, 80) || "Empty note")}</span>
      <span class="when">${ago(n.updated)}</span>
    </button>`;
  const pinned = shown.filter((n) => n.pinned), rest = shown.filter((n) => !n.pinned);
  els.list.innerHTML = !shown.length ? `<div class="none">No notes match “${esc(q)}”</div>`
    : (pinned.length ? `<div class="group">Pinned</div>${pinned.map(item).join("")}` : "") +
      (rest.length ? `${pinned.length ? '<div class="group">Notes</div>' : ""}${rest.map(item).join("")}` : "");
}
function renderMeta() {
  const n = current(); if (!n) return;
  const words = plain(n.body).split(" ").filter(Boolean).length;
  const tasks = (n.body.match(/^\s*[-*]\s+\[( |x)\]/gim) || []);
  const done = tasks.filter((t) => /\[x\]/i.test(t)).length;
  els.meta.innerHTML = `<span>Edited ${ago(n.updated).toLowerCase()}</span><span>${words} word${words === 1 ? "" : "s"}</span><span>${Math.max(1, Math.round(words / 220))} min read</span>${tasks.length ? `<span>✓ ${done}/${tasks.length} tasks</span>` : ""}`;
  $("#pin").classList.toggle("active", !!n.pinned);
  $("#pin").setAttribute("aria-pressed", String(!!n.pinned));
  document.querySelectorAll("#colors button").forEach((b) => b.setAttribute("aria-checked", String((n.color || "none") === b.dataset.c)));
}
function renderPreview() { if (view !== "write") els.preview.innerHTML = markdown(els.body.value); }
function renderEditor() {
  const n = current(); if (!n) return;
  els.title.value = n.title;
  els.body.value = n.body;
  renderPreview(); renderMeta();
}
function setView(v) {
  view = v;
  els.panes.className = "panes " + v;
  document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
  renderPreview();
}

// ---------- Saving ----------
let saveTimer;
function touch() {
  const n = current();
  n.title = els.title.value; n.body = els.body.value; n.updated = Date.now();
  renderPreview(); renderMeta();
  els.status.textContent = "Saving…"; els.status.parentElement.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 350);
}
function save() {
  const ok = store.save(notes);
  els.status.textContent = ok ? "Saved in this browser" : "Couldn't save. Storage may be disabled.";
  els.status.parentElement.classList.remove("saving");
  renderList();
}

// ---------- Formatting toolbar ----------
function wrapSel(before, after = before, placeholder = "text") {
  const ta = els.body, { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e) || placeholder;
  ta.setRangeText(before + sel + after, s, e, "end");
  ta.setSelectionRange(s + before.length, s + before.length + sel.length);
  ta.focus(); touch();
}
function prefixLines(prefix, numbered = false) {
  const ta = els.body, v = ta.value;
  const s = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let e = v.indexOf("\n", ta.selectionEnd); if (e < 0) e = v.length;
  const block = v.slice(s, e).split("\n").map((l, i) => {
    const p = numbered ? `${i + 1}. ` : prefix;
    return l.startsWith(p) ? l.slice(p.length) : p + l.replace(/^(#{1,3} |> |- \[ \] |- )/, "");
  }).join("\n");
  ta.setRangeText(block, s, e, "select");
  ta.focus(); touch();
}
const FMT = {
  bold: () => wrapSel("**"), italic: () => wrapSel("*"), strike: () => wrapSel("~~"),
  h1: () => prefixLines("# "), h2: () => prefixLines("## "), ul: () => prefixLines("- "), task: () => prefixLines("- [ ] "), quote: () => prefixLines("> "),
  code: () => { const ta = els.body; ta.value.slice(ta.selectionStart, ta.selectionEnd).includes("\n") ? wrapSel("```\n", "\n```", "code") : wrapSel("`", "`", "code"); },
  link: () => { const ta = els.body, s = ta.selectionStart, sel = ta.value.slice(s, ta.selectionEnd) || "link text"; ta.setRangeText(`[${sel}](https://)`, s, ta.selectionEnd, "end"); const p = s + sel.length + 3; ta.setSelectionRange(p, p + 8); ta.focus(); touch(); },
};
$("#fmt").addEventListener("mousedown", (e) => e.preventDefault()); // keep the textarea selection
$("#fmt").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fmt]"); if (!b) return;
  if (view === "preview") setView(matchMedia("(max-width: 900px)").matches ? "write" : "split");
  FMT[b.dataset.fmt]();
});
els.body.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); FMT.bold(); }
  else if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); FMT.italic(); }
  else if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); FMT.link(); }
  else if (e.key === "Enter") {
    // continue lists automatically
    const ta = els.body, v = ta.value, s = ta.selectionStart;
    const lineStart = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(lineStart, s);
    const m = line.match(/^(\s*)([-*] \[[ x]\] |[-*] |(\d+)\. )(.*)$/i);
    if (!m) return;
    e.preventDefault();
    if (!m[4].trim()) { ta.setRangeText("", lineStart, s, "end"); touch(); return; }
    const next = m[3] ? `${+m[3] + 1}. ` : m[2].replace(/\[x\]/i, "[ ]");
    ta.setRangeText("\n" + m[1] + next, s, ta.selectionEnd, "end"); touch();
  } else if (e.key === "Tab") { e.preventDefault(); els.body.setRangeText("  ", els.body.selectionStart, els.body.selectionEnd, "end"); touch(); }
});

// Tick tasks straight from the preview
els.preview.addEventListener("change", (e) => {
  const box = e.target.closest("[data-task]"); if (!box) return;
  let i = -1;
  els.body.value = els.body.value.replace(/^(\s*[-*]\s+)\[( |x)\]/gim, (all, pre, mark) => (++i === +box.dataset.task ? `${pre}[${mark.trim() ? " " : "x"}]` : all));
  touch();
});

// ---------- Events ----------
els.title.addEventListener("input", touch);
els.body.addEventListener("input", touch);
els.filter.addEventListener("input", renderList);
els.list.addEventListener("click", (e) => {
  const it = e.target.closest("[data-id]"); if (!it) return;
  currentId = it.dataset.id; renderList(); renderEditor();
});
function newNote() {
  const n = { id: uid(), title: "", body: "", color: "none", pinned: false, updated: Date.now() };
  notes.push(n); currentId = n.id; els.filter.value = "";
  save(); renderEditor();
  if (view === "preview") setView(matchMedia("(max-width: 900px)").matches ? "write" : "split");
  els.title.focus();
}
$("#new-note").addEventListener("click", newNote);
document.addEventListener("keydown", (e) => { if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); newNote(); } if (e.key === "Escape" && els.app.classList.contains("focus")) $("#focus").click(); });
$("#delete").addEventListener("click", () => {
  const n = current(); if (!n || !confirm(`Delete “${n.title || "Untitled"}”? This can't be undone.`)) return;
  notes = notes.filter((x) => x.id !== n.id);
  if (!notes.length) notes.push({ id: uid(), title: "", body: "", color: "none", pinned: false, updated: Date.now() });
  currentId = sorted()[0].id; save(); renderEditor();
});
$("#pin").addEventListener("click", () => { const n = current(); n.pinned = !n.pinned; save(); renderMeta(); });
$("#colors").innerHTML = Object.entries(COLORS).map(([k, v]) => `<button role="radio" data-c="${k}" style="--c:${v || "var(--muted)"}" aria-label="${k === "none" ? "No colour" : k}" title="${k === "none" ? "No colour" : k}"></button>`).join("");
$("#colors").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (!b) return; current().color = b.dataset.c; save(); renderMeta(); });
$("#download").addEventListener("click", () => {
  const n = current();
  const blob = new Blob([`# ${n.title || "Untitled"}\n\n${n.body}`], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (n.title || "note").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".md";
  a.click(); URL.revokeObjectURL(a.href);
  window.showToast?.("Note downloaded");
});
$("#focus").addEventListener("click", () => {
  const on = els.app.classList.toggle("focus");
  $("#focus").classList.toggle("active", on);
  window.showToast?.(on ? "Focus mode. Press Esc to exit" : "Focus mode off");
});
document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// Sync between tabs
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  notes = store.load();
  if (!current()) currentId = sorted()[0].id;
  renderList();
  if (document.activeElement !== els.body && document.activeElement !== els.title) renderEditor(); else renderMeta();
  els.status.textContent = "Synced from another tab";
});
setInterval(() => { renderList(); renderMeta(); }, 60000);

renderList(); renderEditor(); setView(view);
