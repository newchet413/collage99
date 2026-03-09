# collage99

A lightweight collage maker that runs directly in the browser.

## Features
- Upload multiple images
- Preset templates (Instagram Post/Story, Pinterest, Facebook cover)
- Side-by-side templates for 2/4/6/8 photos (with and without text space)
- Control columns, tile gap, and aspect ratio
- Canvas size presets + custom width/height controls
- Background color and canvas padding controls
- Drag each image to reposition
- Drag and drop tiles to reorder
- Undo/redo history (buttons + keyboard shortcuts)
- Text overlays (add/select/edit/move/delete)
- Zoom each image per tile
- Save/load collage project as JSON
- Shuffle or clear layout
- Export final collage as PNG
- Batched image ingest + cached export decoding for large sets
- Keyboard-first tile editing (move/zoom/reorder/remove)

## Run
Open `index.html` in your browser.

If you prefer a local server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Lint
Install deps once:

```powershell
npm install
```

Run all linters:

```powershell
npm run lint
```

Run browser end-to-end tests:

```powershell
npm run test:e2e
```

Install Playwright Chromium once:

```powershell
npx playwright install chromium
```

## Keyboard shortcuts
- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + S`: Save project JSON
- `Ctrl/Cmd + E`: Export PNG

Tile keyboard controls (focus a tile first):
- `Arrow keys`: Move image
- `Shift + Arrow keys`: Move faster
- `+` / `-`: Zoom in/out
- `Alt + Arrow Left/Right`: Reorder tile
- `Delete` or `Backspace`: Remove tile

Text overlay controls:
- Add text with the `Add Text` button
- Click text to select it, then edit content/size/color in controls
- Drag text directly on the collage
- `Delete Text` button removes selected text

## Deploy Online
### GitHub Pages (auto-deploy on push)
This repo includes a workflow at `.github/workflows/pages.yml` that deploys `index.html`, `styles.css`, and `app.js` to Pages.

One-time GitHub setup:
1. Push this repo to GitHub.
2. Open `Settings -> Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` (or run workflow manually from `Actions` tab).
5. Your site will be published at your Pages URL.

### Netlify
This repo includes `netlify.toml`.

Deploy:
1. In Netlify, choose `Add new site -> Import an existing project`.
2. Select this repository.
3. Keep defaults (publish directory is repo root).
4. Deploy.

### Vercel
This repo includes `vercel.json`.

Deploy:
1. In Vercel, choose `Add New -> Project`.
2. Import this repository.
3. Framework preset: `Other` (static site).
4. Deploy.
