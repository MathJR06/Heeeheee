# Personal website

A small, dark, mobile-friendly personal site built with plain HTML, CSS and JavaScript — no build step, so it runs directly on GitHub Pages.

## Files

| File | What it is |
|------|------------|
| `index.html` | Front page: intro, about, and the contact section (`#contact`) |
| `projects.html` | Project cards |
| `assets/styles.css` | All styling. Colours live at the top in `:root` |
| `assets/script.js` | Mobile menu, scroll-in animations, card glow, copy-email button |
| `404.html` | Shown by GitHub Pages for missing pages |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Make it yours

Search and replace these placeholders:

- `Your Name`, `Your City`
- `you@example.com`
- the LinkedIn link (`https://www.linkedin.com/`) and the GitHub link
- the project cards in `projects.html` (title, description, tags, and the `href`s of "Live demo" / "Code")

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit http://localhost:8000.

## Publish on GitHub Pages

1. Make sure these files are on the branch you want to publish (e.g. merge into `main`).
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch (e.g. `main`) and the folder **/ (root)**, then click **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/<repo-name>/`.
