# MuviDB Video Studio

Standalone React/Vite/Tailwind editor for building 9:16 MuviDB reels (movie picks, coming-soon announcements, spotlights) for [muvidb.com](https://muvidb.com).

## Run The Editor

```bash
pnpm install
pnpm run dev
```

Open the local Vite URL, edit scenes, backgrounds, text, fonts, layers, durations, and transitions.

## Export A Video

Click `Export Video` in the editor. The timeline is recorded in the browser in real time (a 30s reel takes 30s) and downloads as an MP4 or WebM depending on browser support. Chrome and Edge are recommended.

`Export JSON` downloads the full project config, which you can re-import later or feed to the optional native renderer.

## Optional: Native Renderer (macOS only)

`render.swift` renders the exported JSON to a high-quality MP4 using AVFoundation. It requires macOS and will not run on Windows or Linux:

```bash
swift render.swift config.json
```

It writes `output/muvidb-reel.mp4` and `output/cover.png`.

## Folder Shape

- `src/App.jsx` is the React editor and owns all editor state, canvas preview, and browser-side recording.
- `src/defaultConfig.js` is the default editable reel template.
- `config.default.json` is the same template for the native renderer.
- `public/assets` is served to the browser preview (fonts, logo, background videos).
- `assets` is used by the Swift renderer.
- `render.swift` creates the final MP4 and cover image (macOS only).
