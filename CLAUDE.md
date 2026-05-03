# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm ci` — install dependencies from `package-lock.json`.
- `npm run dev` — start the Vite dev server on `127.0.0.1:7878` with a strict port.
- `npm run build` — build the app into `dist/`, then copy `dist/index.html` to `dist/404.html` for GitHub Pages SPA fallback routing.
- `npm run preview` — preview the production build on `127.0.0.1:7878` with the same local API proxy as dev.

There are no lint or test scripts configured in `package.json`, and no project test runner config is present. A single-test command is not applicable until a test runner is added; use `npm run build` as the available local validation command.

## High-level architecture

This is a Vite + React 18 single-page app for generating and reading Chinese philosophy analyses. `index.tsx` mounts `App.tsx`; `index.html` provides the Tailwind CDN theme, Google fonts, import map, root element, and global stylesheet link.

`App.tsx` is the main state and routing coordinator. It implements client-side routing with `window.history` for `/`, `/history`, `/history/sample`, `/manifesto`, and `/history/:id`; manages active generation runs; persists generated history in `localStorage`; loads the preloaded sample from `data/preloadedHistory.ts`; and passes generated results into the presentation components.

`services/sophiaService.ts` is the AI orchestration layer. It calls OpenAI-compatible `/chat/completions` and `/images/generations` endpoints, normalizes model JSON into the shared shapes in `types.ts`, streams voice essays back through callbacks, generates voice avatars, and runs the analysis pipeline in stages: outline, route details, concurrent thought voices, then synthesis.

`types.ts` defines the shared data model for analysis results, outlines, route nodes, voices, progress updates, active runs, history entries, and continuation context. Keep service outputs and component props aligned with these types when changing the generation schema.

The main UI components are organized by page or result section: `components/Arena.tsx` renders a completed or streaming analysis result; `ReasoningDisplay.tsx` shows generation progress; `ThoughtVoiceCard.tsx` renders each long-form voice and avatar fallback; `HistoryPage.tsx` renders saved runs; `ManifestoPage.tsx` renders the manifesto page; `ActiveRunBanner.tsx` surfaces in-progress runs; and `DynamicBackground.tsx` provides the React Three Fiber background.

Styling is mostly Tailwind utility classes backed by the custom `museum` palette and font families declared in `index.html`. `index.css` only contains global animation, scrolling, scrollbar, and selection styles.

## Extension points

When asked to add a new analytical mode, voice kind, or preset model, the canonical entry points are:

- **New analysis mode** (e.g. `dialectic_court`): add to `ProgramMode` in `types.ts`; register the label and the prompt rules in `services/prompts.ts` (`MODE_LABELS` and the path list inside `outlineSystemPrompt`); pick an icon in `components/Arena.tsx` `modeIcon`. If the mode needs a specialized rendered section (like `diagnosisFrame` / `thoughtExperiment` / `seminarMatrix`), add the field to `types.ts` and a corresponding section in `Arena.tsx`.
- **New voice kind** (e.g. `'fictional'`): extend `VoiceKind` in `types.ts`; update `kindLabel` and `VOICE_KIND_SYMBOL` in `components/ThoughtVoiceCard.tsx`; update `VOICE_KIND_AVATAR_SUBJECT` in `services/sophiaService.ts` so avatar prompts know what to draw.
- **New preset model** (e.g. `claude`): inject env in `vite.config.ts` `define` and `.github/workflows/deploy.yml` build env; declare the type in `vite-env.d.ts`; add a row to `services/modelPresets.ts`. Document the new GitHub Variable in `DEPLOY.md` and `README.md`.
- **Editing a built-in prompt**: edit `services/prompts.ts`. The Settings page can override prompts at runtime via `sophia.settings.v1.promptOverrides`, but committed defaults live here.

`CONTRIBUTING.md` has the longer form of these procedures with concrete file paths and step ordering.

## Runtime and deployment notes

Vite exposes Sophia configuration through `process.env.*` constants in `vite.config.ts`. Important variables are `SOPHIA_API_KEY`, `SOPHIA_API_BASE_URL`, `SOPHIA_API_MODEL`, `SOPHIA_IMAGE_MODEL`, `SOPHIA_IMAGE_SIZE`, `SOPHIA_IMAGE_ASPECT_HINT`, and `SOPHIA_API_PROVIDER`.

In local dev and preview, `vite.config.ts` routes API calls through `/sophia-api` and injects the authorization header from `SOPHIA_API_KEY`, so the key is not defined into the browser bundle. In GitHub Actions builds, `GITHUB_ACTIONS=true` disables that local proxy behavior and uses the configured API values directly.

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`: pushes to `main` or manual workflow dispatch run Node 20, `npm ci`, `npm run build`, upload `dist`, and deploy via `actions/deploy-pages`.