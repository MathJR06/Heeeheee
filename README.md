# Personal website

A small, dark, mobile-friendly personal site built with plain HTML, CSS and JavaScript — no build step, so it runs directly on GitHub Pages.

## Files

| File | What it is |
|------|------------|
| `index.html` | Front page: intro, about, and the contact section (`#contact`) |
| `projects.html` | Project cards |
| `assets/styles.css` | All styling. Colours live at the top in `:root` |
| `assets/script.js` | Mobile menu, scroll-in animations, card glow, copy-email button |
| `demos/` | The projects, one folder each (`weather`, `palette`, `notes`, `bot`, `habits`), each with its own `index.html`, `style.css` and `app.js`. Shared styles are in `demos/demo.css` |
| `assets/previews/` | Screenshots used on the project cards |
| `404.html` | Shown by GitHub Pages for missing pages |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Editing

All the text is plain HTML in `index.html` and `projects.html`. Colours are set at the top of `assets/styles.css`.

The demos run entirely in the browser, so no server or API keys are needed. The weather demo uses the free [Open-Meteo](https://open-meteo.com/) API, and its default city is set at the bottom of `demos/weather/app.js`. The "Code" links point at the `main` branch, so publish from `main` (or update the links).

## Preview locally

Open `index.html` in a browser, or run `python3 -m http.server` in this folder and visit http://localhost:8000.

## Publish on GitHub Pages

1. Make sure these files are on the branch you want to publish (e.g. merge into `main`).
2. On GitHub, open the repository → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose the branch (e.g. `main`) and the folder **/ (root)**, then click **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/<repo-name>/`.
