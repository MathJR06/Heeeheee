// Riff: a chat app with a slash-command bot, running entirely in the browser
const $ = (s) => document.querySelector(s);
const app = $("#app"), feed = $("#feed"), input = $("#msg"), menu = $("#cmd-menu");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const started = Date.now();
let sent = 0, pollCount = 0, triviaScore = { right: 0, total: 0 }, rpsScore = { you: 0, riff: 0 };

// ---------- Channels ----------
const CHANNELS = {
  general: { topic: "Say hi, ask Riff anything", intro: "This is the start of #general. Riff is here. Type <code>/help</code> to see what it can do." },
  games: { topic: "Trivia, rock-paper-scissors and dice", intro: "Welcome to #games. Try <code>/trivia</code>, <code>/rps</code> or <code>/roll 2d20</code>." },
  polls: { topic: "Let the people decide", intro: "Make decisions together. Try <code>/poll \"Pizza tonight?\" Yes No Maybe</code>." },
};
let channel = "general";
const unread = {};
const feeds = {};
for (const [name, ch] of Object.entries(CHANNELS)) {
  const el = document.createElement("div");
  el.className = "feed-ch"; el.hidden = name !== channel;
  el.innerHTML = `<div class="intro"><div class="big-hash">#</div><h3>Welcome to #${name}</h3><p>${ch.intro}</p></div>`;
  feed.appendChild(el); feeds[name] = el;
}
const typingEl = document.createElement("div");
typingEl.className = "typing"; typingEl.innerHTML = "&nbsp;";
feed.after(typingEl);

function renderChannels() {
  $("#ch-list").innerHTML = Object.keys(CHANNELS).map((n) => `<button class="ch ${n === channel ? "active" : ""}" data-ch="${n}"><span class="h">#</span>${n}${unread[n] ? `<span class="badge">${unread[n]}</span>` : ""}</button>`).join("");
}
function switchChannel(n) {
  channel = n; unread[n] = 0;
  Object.entries(feeds).forEach(([k, el]) => (el.hidden = k !== n));
  $("#ch-name").textContent = n; $("#ch-topic").textContent = CHANNELS[n].topic;
  input.placeholder = `Message #${n}`;
  app.classList.remove("drawer");
  renderChannels(); scrollDown(false);
}
$("#ch-list").addEventListener("click", (e) => { const b = e.target.closest("[data-ch]"); if (b) switchChannel(b.dataset.ch); });
$("#menu").addEventListener("click", () => app.classList.add("drawer"));
$("#scrim").addEventListener("click", () => app.classList.remove("drawer"));

// ---------- Messages ----------
const AUTHORS = {
  bot: { name: "Riff", av: `<div class="av bot">🎸</div>`, cls: "bot", tag: true },
  you: { name: "You", av: `<div class="av you">Y</div>`, cls: "you" },
};
const timeStr = () => new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
function scrollDown(smooth = true) { feed.style.scrollBehavior = smooth ? "smooth" : "auto"; feed.scrollTop = feed.scrollHeight; }
function post(html, who = "bot", ch = channel) {
  const el = feeds[ch], a = AUTHORS[who];
  const last = el.lastElementChild;
  const first = !(last && last.classList.contains("msg") && last.dataset.who === who && Date.now() - +last.dataset.t < 5 * 60e3);
  const m = document.createElement("div");
  m.className = `msg enter${first ? " first" : ""}`;
  m.dataset.who = who; m.dataset.t = Date.now();
  m.innerHTML = `${a.av}<div class="head"><span class="who ${a.cls}">${a.name}</span>${a.tag ? '<span class="tag">BOT</span>' : ""}<span class="time">Today at ${timeStr()}</span></div>
    <div class="body"><div class="text">${html}</div><div class="reacts"></div></div>
    <div class="tools">${["👍", "❤️", "😂", "🎸", "🔥"].map((e) => `<button data-react="${e}" aria-label="React ${e}">${e}</button>`).join("")}</div>`;
  el.appendChild(m);
  if (ch !== channel) { unread[ch] = (unread[ch] || 0) + 1; renderChannels(); }
  else scrollDown();
  return m;
}
function botReply(html, delay = 500 + Math.random() * 500, ch = channel) {
  typingEl.innerHTML = `<span class="dots"><span></span><span></span><span></span></span> <b>Riff</b> is typing…`;
  return new Promise((res) => setTimeout(() => { typingEl.innerHTML = "&nbsp;"; res(post(html, "bot", ch)); }, delay));
}
function embed({ color = "var(--accent)", title = "", desc = "", fields = [], foot = "", extra = "" }) {
  return `<div class="embed" style="--ec:${color}">${title ? `<div class="e-title">${title}</div>` : ""}${desc ? `<div class="e-desc">${desc}</div>` : ""}
    ${fields.length ? `<div class="e-fields">${fields.map(([k, v]) => `<div class="e-field"><b>${k}</b>${v}</div>`).join("")}</div>` : ""}${extra}${foot ? `<div class="e-foot">${foot}</div>` : ""}</div>`;
}

// Reactions
feed.addEventListener("click", (e) => {
  const t = e.target.closest("[data-react]");
  if (t) return addReaction(t.closest(".msg"), t.dataset.react);
  const chip = e.target.closest(".react");
  if (chip) toggleReaction(chip);
});
function addReaction(msg, emoji) {
  const box = msg.querySelector(".reacts");
  const existing = [...box.children].find((c) => c.dataset.e === emoji);
  if (existing) { if (!existing.classList.contains("mine")) toggleReaction(existing); return; }
  box.insertAdjacentHTML("beforeend", `<button class="react mine" data-e="${emoji}" data-n="1">${emoji} <span>1</span></button>`);
}
function toggleReaction(chip) {
  const mine = chip.classList.toggle("mine");
  const n = +chip.dataset.n + (mine ? 1 : -1);
  if (n <= 0) return chip.remove();
  chip.dataset.n = n; chip.querySelector("span").textContent = n;
}

// ---------- Commands ----------
const parseArgs = (s) => (s.match(/"[^"]*"|\S+/g) || []).map((a) => a.replace(/^"|"$/g, ""));
const TRIVIA = [
  ["How many strings does a standard guitar have?", ["4", "5", "6", "7"], 2],
  ["What is the capital of Denmark?", ["Aarhus", "Copenhagen", "Odense", "Malmö"], 1],
  ["Which planet is known as the Red Planet?", ["Venus", "Jupiter", "Mars", "Mercury"], 2],
  ["What does HTML stand for?", ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlink Text Mode Language"], 0],
  ["What is the largest ocean on Earth?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3],
  ["How many minutes are in a day?", ["1,240", "1,440", "1,640", "2,400"], 1],
  ["Which country invented LEGO?", ["Sweden", "Germany", "Denmark", "Norway"], 2],
  ["What is the chemical symbol for gold?", ["Go", "Gd", "Au", "Ag"], 2],
  ["Which language runs natively in web browsers?", ["Python", "JavaScript", "C#", "Ruby"], 1],
  ["What is 7 × 8?", ["54", "56", "58", "64"], 1],
  ["Which of these is NOT a primary colour of light?", ["Red", "Green", "Blue", "Yellow"], 3],
  ["How many keys does a standard piano have?", ["76", "88", "92", "100"], 1],
];
const COMMANDS = {
  help: { icon: "❓", desc: "Show everything Riff can do", run: () => embed({
    title: "🎸 Riff's commands", desc: "Type <code>/</code> to open the command menu, or use any of these:",
    fields: Object.entries(COMMANDS).map(([k, c]) => [`${c.icon} /${k}`, `<span class="muted small">${c.desc}</span>`]),
    foot: "Tip: hover a message to react to it",
  }) },
  roll: { icon: "🎲", usage: "[NdM]", desc: "Roll dice, like 2d6 or 1d20", run: ([spec = "2d6"]) => {
    const m = spec.match(/^(\d{1,2})?d(\d{1,4})$/i);
    if (!m) return embed({ color: "#f43f5e", title: "Hmm, I can't roll that", desc: `Try something like <code>/roll 2d6</code> or <code>/roll 1d20</code>.` });
    const n = Math.max(1, Math.min(12, +(m[1] || 1))), sides = Math.max(2, +m[2]);
    const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    return embed({ color: "#fbbf24", title: `🎲 Rolling ${n}d${sides}`, extra: `<div class="dice">${rolls.map((r, i) => `<span class="die" style="animation-delay:${i * 60}ms">${r}</span>`).join("")}</div>`,
      foot: `Total: ${total}${n > 1 ? ` · Average: ${(total / n).toFixed(1)}` : ""}${rolls.every((r) => r === sides) ? " · 🔥 Max roll!" : ""}` });
  } },
  flip: { icon: "🪙", desc: "Flip a coin", run: () => { const h = Math.random() < 0.5; return embed({ color: "#fbbf24", title: `🪙 ${h ? "Heads" : "Tails"}!`, desc: h ? "The coin landed face up." : "The coin landed face down." }); } },
  poll: { icon: "📊", usage: '"question" options…', desc: "Start a poll with up to 6 options", run: (args) => {
    const [q, ...opts] = args;
    if (!q || opts.length < 2) return embed({ color: "#f43f5e", title: "Poll needs a question and 2+ options", desc: `Example: <code>/poll "Best pizza?" Margherita Pepperoni Hawaiian</code>` });
    const id = ++pollCount;
    return embed({ color: "#7c9cff", title: `📊 ${esc(q)}`, extra: opts.slice(0, 6).map((o, i) => `<button class="poll-opt" data-poll="${id}" data-opt="${i}" data-votes="0"><div class="bar"></div><span><span>${esc(o)}</span><span class="count">0 votes</span></span></button>`).join(""), foot: "Tap an option to vote. You can change your vote." });
  } },
  trivia: { icon: "🧠", desc: "Answer a random trivia question", run: () => {
    const [q, opts, right] = pick(TRIVIA);
    return embed({ color: "#b48cff", title: "🧠 Trivia time", desc: esc(q), extra: `<div class="btns">${opts.map((o, i) => `<button class="ebtn" data-trivia="${i}" data-right="${right}">${esc(o)}</button>`).join("")}</div>`,
      foot: triviaScore.total ? `Your score: ${triviaScore.right}/${triviaScore.total}` : "Pick an answer" });
  } },
  rps: { icon: "✊", desc: "Play rock, paper, scissors against Riff", run: () => embed({ color: "#34d399", title: "✊ Rock, paper, scissors", desc: "Choose your move:",
    extra: `<div class="btns">${[["rock", "✊ Rock"], ["paper", "✋ Paper"], ["scissors", "✌️ Scissors"]].map(([k, l]) => `<button class="ebtn" data-rps="${k}">${l}</button>`).join("")}</div>`,
    foot: `Score: You ${rpsScore.you} – ${rpsScore.riff} Riff` }) },
  remind: { icon: "⏰", usage: "<time> <message>", desc: "Remind you later (10s, 5m)", run: ([time, ...rest]) => {
    const m = (time || "").match(/^(\d+)(s|m)$/);
    if (!m || !rest.length) return embed({ color: "#f43f5e", title: "How to set a reminder", desc: `<code>/remind 10s drink water</code> (use <code>s</code> for seconds or <code>m</code> for minutes)` });
    const ms = +m[1] * (m[2] === "m" ? 60000 : 1000);
    if (ms > 60 * 60000) return embed({ color: "#f43f5e", title: "That's a long time!", desc: "Keep reminders under an hour." });
    const text = rest.join(" "), ch = channel;
    setTimeout(() => { post(`⏰ <span class="mention">@You</span> reminder: <b>${esc(text)}</b>`, "bot", ch); window.showToast?.("⏰ " + text); }, ms);
    return `👍 Got it! I'll remind you to <b>${esc(text)}</b> in ${m[1]}${m[2] === "m" ? " min" : " sec"}.`;
  } },
  "8ball": { icon: "🎱", usage: "<question>", desc: "Ask the magic 8-ball", run: (args) => args.length
    ? embed({ color: "#0ea5e9", title: `🎱 “${esc(args.join(" "))}”`, desc: `<b>${pick(["It is certain.", "Without a doubt.", "Ask again later.", "Don't count on it.", "Very doubtful.", "Signs point to yes.", "Better not tell you now.", "Most likely.", "Outlook good.", "My sources say no."])}</b>` })
    : "You have to ask a question! Like <code>/8ball Will I nail the solo?</code>" },
  stats: { icon: "📈", desc: "Show stats for this session", run: () => {
    const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
    return embed({ color: "#7c9cff", title: "📈 Session stats", fields: [["Messages sent", sent], ["Time here", `${mins} min`], ["Polls created", pollCount], ["Trivia", `${triviaScore.right}/${triviaScore.total} right`], ["Rock-paper-scissors", `${rpsScore.you}–${rpsScore.riff}`]] });
  } },
  clear: { icon: "🧹", desc: "Clear this channel", run: () => { [...feeds[channel].querySelectorAll(".msg")].forEach((m) => m.remove()); return "🧹 Swept the channel clean."; } },
};

function handle(text) {
  sent++;
  post(esc(text).replace(/@riff/gi, '<span class="mention">@Riff</span>'), "you");
  if (!text.startsWith("/")) {
    const l = text.toLowerCase();
    if (/\b(hi|hello|hey|hej|yo)\b/.test(l)) return botReply(`Hey there! 👋 I'm Riff. Type <code>/</code> to see my commands.`);
    if (l.includes("thank")) return botReply("Any time! 🎸");
    if (l.includes("guitar")) return botReply("Did someone say guitar? 🎸 Marocius is *mean* on it, apparently.");
    if (l.includes("?")) return botReply(`Good question! I'm better with commands though. Try <code>/8ball ${esc(text.slice(0, 40))}</code>`);
    return botReply(pick(["Nice! Want to play? Try <code>/trivia</code> or <code>/rps</code>.", "I mostly speak in commands. Type <code>/</code> to see them.", "🎸 *strums thoughtfully*"]));
  }
  const [name, ...args] = parseArgs(text.slice(1));
  const cmd = COMMANDS[(name || "").toLowerCase()];
  botReply(cmd ? cmd.run(args) : embed({ color: "#f43f5e", title: "Unknown command", desc: `I don't know <code>/${esc(name || "")}</code>. Type <code>/help</code> to see what I can do.` }));
}

// Interactive embeds: polls, trivia, rock-paper-scissors
feed.addEventListener("click", (e) => {
  const opt = e.target.closest(".poll-opt");
  if (opt) {
    const group = [...feed.querySelectorAll(`.poll-opt[data-poll="${opt.dataset.poll}"]`)];
    const prev = group.find((b) => b.classList.contains("voted"));
    if (prev === opt) return;
    if (prev) { prev.classList.remove("voted"); prev.dataset.votes--; }
    opt.classList.add("voted"); opt.dataset.votes++;
    const total = group.reduce((s, b) => s + +b.dataset.votes, 0);
    group.forEach((b) => {
      const pct = total ? Math.round((b.dataset.votes / total) * 100) : 0;
      b.querySelector(".bar").style.width = pct + "%";
      b.querySelector(".count").textContent = `${b.dataset.votes} vote${b.dataset.votes == 1 ? "" : "s"} · ${pct}%`;
    });
    return;
  }
  const tr = e.target.closest("[data-trivia]");
  if (tr && !tr.disabled) {
    const btns = [...tr.parentElement.children], right = +tr.dataset.right, ok = +tr.dataset.trivia === right;
    btns.forEach((b, i) => { b.disabled = true; if (i === right) b.classList.add("right"); });
    if (!ok) tr.classList.add("wrong");
    triviaScore.total++; if (ok) triviaScore.right++;
    botReply(ok ? `✅ Correct! Score: <b>${triviaScore.right}/${triviaScore.total}</b>. Another one? <code>/trivia</code>` : `❌ Not quite. It was <b>${esc(btns[right].textContent)}</b>. Score: ${triviaScore.right}/${triviaScore.total}`, 450);
    return;
  }
  const r = e.target.closest("[data-rps]");
  if (r && !r.disabled) {
    [...r.parentElement.children].forEach((b) => (b.disabled = true));
    const moves = { rock: "✊", paper: "✋", scissors: "✌️" }, beats = { rock: "scissors", paper: "rock", scissors: "paper" };
    const you = r.dataset.rps, riff = pick(Object.keys(moves));
    const result = you === riff ? "draw" : beats[you] === riff ? "win" : "lose";
    if (result === "win") rpsScore.you++; if (result === "lose") rpsScore.riff++;
    botReply(embed({ color: result === "win" ? "#4ade80" : result === "lose" ? "#f43f5e" : "#fbbf24",
      title: result === "win" ? "🎉 You win!" : result === "lose" ? "😎 Riff wins!" : "🤝 It's a draw!",
      extra: `<div class="rps-res">${moves[you]} <span class="muted" style="font-size:1rem;letter-spacing:0">vs</span> ${moves[riff]}</div>`,
      foot: `Score: You ${rpsScore.you} – ${rpsScore.riff} Riff · /rps to play again` }), 700);
  }
});

// ---------- Slash-command autocomplete ----------
let matches = [], active = 0;
function updateMenu() {
  const v = input.value;
  if (!v.startsWith("/") || v.includes(" ")) return hideMenu();
  const q = v.slice(1).toLowerCase();
  matches = Object.keys(COMMANDS).filter((k) => k.startsWith(q));
  if (!matches.length) return hideMenu();
  active = Math.min(active, matches.length - 1);
  menu.innerHTML = `<li class="lbl">Commands matching /${esc(q)}</li>` + matches.map((k, i) => {
    const c = COMMANDS[k];
    return `<li data-cmd="${k}" class="${i === active ? "active" : ""}" role="option"><span class="ci">${c.icon}</span><div><b>/${k}</b><span class="u">${esc(c.usage || "")}</span><div class="d">${c.desc}</div></div></li>`;
  }).join("");
  menu.hidden = false;
  menu.querySelector(".active")?.scrollIntoView({ block: "nearest" });
}
function hideMenu() { menu.hidden = true; active = 0; }
function complete(k) {
  const needsArgs = !!COMMANDS[k].usage && !COMMANDS[k].usage.startsWith("[");
  input.value = `/${k}${needsArgs ? " " : ""}`;
  hideMenu(); input.focus();
  if (!needsArgs) submit();
}
input.addEventListener("input", () => { active = 0; updateMenu(); });
input.addEventListener("keydown", (e) => {
  if (menu.hidden) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length; updateMenu(); }
  else if (e.key === "Tab" || (e.key === "Enter" && matches.length)) { e.preventDefault(); complete(matches[active]); }
  else if (e.key === "Escape") hideMenu();
});
menu.addEventListener("mousedown", (e) => { const li = e.target.closest("[data-cmd]"); if (li) { e.preventDefault(); complete(li.dataset.cmd); } });
input.addEventListener("blur", () => setTimeout(hideMenu, 120));
$("#slash").addEventListener("click", () => { input.value = "/"; input.focus(); updateMenu(); });

function submit() {
  const text = input.value.trim();
  if (!text) return;
  input.value = ""; hideMenu();
  handle(text);
}
$("#composer").addEventListener("submit", (e) => { e.preventDefault(); submit(); });

// ---------- Start ----------
renderChannels();
switchChannel("general");
post(`Hey! I'm <b>Riff</b> 🎸, the house bot. Type <code>/</code> to see my commands, or jump into <b>#games</b> for trivia.`, "bot", "general");
post(embed({ color: "#b48cff", title: "🧠 Warm-up question", desc: "Ready when you are. Type <code>/trivia</code> to get a question." }), "bot", "games");
