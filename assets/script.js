// Mark that JS is running (used by the CSS fallback for .reveal)
document.documentElement.classList.remove("no-js");

// --- Mobile navigation toggle ---
const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  // Close the menu after tapping a link
  document.querySelectorAll(".nav-links a").forEach((link) =>
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );
}

// --- Header border once you scroll ---
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// --- Fade elements in as they scroll into view ---
const revealEls = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("visible"));
}

// --- Cursor-following glow on cards ---
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

// --- "Copy email" button ---
const copyBtn = document.querySelector("[data-copy]");
const toast = document.querySelector(".toast");
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const text = copyBtn.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Email copied to clipboard");
    } catch {
      window.location.href = `mailto:${text}`;
    }
  });
}
window.showToast = showToast;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 2200);
}

// --- Current year in the footer ---
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
