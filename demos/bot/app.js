// Chat Bot Playground — a command bot that runs in the browser
const $ = (s) => document.querySelector(s);
const box = $("#messages");
const input = $("#msg");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let polls = 0;

function add(html, who = "bot") {
  const el = document.createElement("div");
  el.className = "msg " + who;
  el.innerHTML = who === "bot"
    ? `<div class="avatar">🤖</div><div><div class="name">Helper Bot</div><div class="bubble">${html}</div></div>`
    : `<div class="bubble">${html}</div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

// Show a "typing…" indicator, then the reply
function reply(html, delay = 450 + Math.random() * 400) {
  const t = add(`<span class="typing"><span></span><span></span><span></span></span>`);
  setTimeout(() => { t.remove(); add(html); }, delay);
}

// Split args, keeping "quoted strings" together
const parseArgs = (s) => (s.match(/"[^"]*"|\S+/g) || []).map((a) => a.replace(/^"|"$/g, ""));

const commands = {
  help: {
    desc: "Show all commands",
    run: () => `Here's what I can do:<ul>${Object.entries(commands).map(([k, c]) => `<li><code>/${k}${c.usage ? " " + esc(c.usage) : ""}</code>: ${c.desc}</li>`).join("")}</ul>`,
  },
  roll: {
    usage: "[NdM]", desc: "Roll dice, e.g. 2d6",
    run: ([spec = "1d6"]) => {
      const m = spec.match(/^(\d{1,2})?d(\d{1,4})$/i);
      if (!m) return `I don't understand <code>${esc(spec)}</code>. Try <code>/roll 2d6</code>.`;
      const n = Math.max(1, Math.min(20, +(m[1] || 1))), sides = Math.max(2, +m[2]);
      const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
      return `🎲 Rolled <strong>${n}d${sides}</strong>: ${rolls.join(" + ")} = <strong>${rolls.reduce((a, b) => a + b, 0)}</strong>`;
    },
  },
  flip: { desc: "Flip a coin", run: () => `🪙 It's <strong>${pick(["heads", "tails"])}</strong>!` },
  poll: {
    usage: '"question" option1 option2 …', desc: "Start a poll people can vote in",
    run: (args) => {
      const [q, ...opts] = args;
      if (!q || opts.length < 2) return `Usage: <code>/poll "Question?" option1 option2</code>`;
      const id = ++polls;
      return `📊 <strong>${esc(q)}</strong>${opts.slice(0, 6).map((o, i) =>
        `<button class="poll-opt" data-poll="${id}" data-opt="${i}" data-votes="0"><div class="bar"></div><span><span>${esc(o)}</span><span class="count"></span></span></button>`).join("")}`;
    },
  },
  remind: {
    usage: "<time> <message>", desc: "Remind you later (e.g. 10s, 2m)",
    run: ([time, ...rest]) => {
      const m = (time || "").match(/^(\d+)(s|m)$/);
      if (!m || !rest.length) return `Usage: <code>/remind 10s drink water</code> (seconds <code>s</code> or minutes <code>m</code>)`;
      const ms = +m[1] * (m[2] === "m" ? 60000 : 1000);
      if (ms > 30 * 60000) return "That's a bit long for a demo! Keep it under 30 minutes.";
      const text = rest.join(" ");
      setTimeout(() => { add(`⏰ Reminder: <strong>${esc(text)}</strong>`); window.showToast?.("⏰ " + text); }, ms);
      return `👍 OK! I'll remind you to <strong>${esc(text)}</strong> in ${m[1]}${m[2]}.`;
    },
  },
  "8ball": {
    usage: "<question>", desc: "Ask the magic 8-ball",
    run: (args) => args.length
      ? `🎱 ${pick(["It is certain.", "Without a doubt.", "Ask again later.", "Don't count on it.", "Very doubtful.", "Signs point to yes.", "Better not tell you now.", "Most likely."])}`
      : "You have to ask a question! <code>/8ball Will I win?</code>",
  },
  stats: {
    desc: "Show stats for this chat",
    run: () => {
      const mine = box.querySelectorAll(".msg.me").length;
      const mins = Math.max(1, Math.round((Date.now() - started) / 60000));
      return `📈 You've sent <strong>${mine}</strong> message${mine === 1 ? "" : "s"} in about ${mins} minute${mins === 1 ? "" : "s"}. ${polls} poll${polls === 1 ? "" : "s"} created.`;
    },
  },
  clear: { desc: "Clear the chat", run: () => { box.innerHTML = ""; return "🧹 Chat cleared."; } },
};
const started = Date.now();

function handle(text) {
  add(esc(text), "me");
  if (!text.startsWith("/")) {
    const lower = text.toLowerCase();
    if (/\b(hi|hello|hey|hej)\b/.test(lower)) return reply("Hey there! 👋 Type <code>/help</code> to see what I can do.");
    if (lower.includes("thank")) return reply("Any time! 😊");
    return reply(pick(["Interesting! Try a command like <code>/roll</code> or <code>/poll</code>.", "I'm a command bot, so start your message with <code>/</code>. Type <code>/help</code> for a list."]));
  }
  const [name, ...args] = parseArgs(text.slice(1));
  const cmd = commands[(name || "").toLowerCase()];
  reply(cmd ? cmd.run(args) : `Unknown command <code>/${esc(name || "")}</code>. Type <code>/help</code> for a list.`);
}

// Poll voting
box.addEventListener("click", (e) => {
  const btn = e.target.closest(".poll-opt");
  if (!btn) return;
  const group = [...box.querySelectorAll(`.poll-opt[data-poll="${btn.dataset.poll}"]`)];
  const prev = group.find((b) => b.classList.contains("voted"));
  if (prev === btn) return;
  if (prev) { prev.classList.remove("voted"); prev.dataset.votes--; }
  btn.classList.add("voted"); btn.dataset.votes++;
  const total = group.reduce((s, b) => s + +b.dataset.votes, 0);
  group.forEach((b) => {
    const pct = total ? Math.round((b.dataset.votes / total) * 100) : 0;
    b.querySelector(".bar").style.width = pct + "%";
    b.querySelector(".count").textContent = `${b.dataset.votes} · ${pct}%`;
  });
});

$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  handle(text);
});
document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => handle(b.dataset.cmd)));

add("Hi! I'm Helper Bot 👋 Type <code>/help</code> or tap a shortcut below to try a command.");
