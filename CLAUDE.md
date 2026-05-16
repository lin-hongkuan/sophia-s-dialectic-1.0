# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm ci` — install dependencies from `package-lock.json`.
- `npm run dev` — start the Vite dev server on `127.0.0.1:7878` with a strict port.
- `npm run build` — build the app into `dist/`, then copy `dist/index.html` to `dist/404.html` for GitHub Pages SPA fallback routing.
- `npm run preview` — preview the production build on `127.0.0.1:7878` with the same local API proxy as dev.
- `npm test` — run the Node test suite through `tsx --test` for pure utilities and quality gates.
- `npm run typecheck` — run `tsc --noEmit`.
- `npm run verify` — run test, typecheck, and build in sequence.

Use `npm test` for fast utility validation and `npm run verify` as the full local validation command before handing off changes.

## High-level architecture

This is a Vite + React 18 single-page app for generating and reading Chinese philosophy analyses. `index.tsx` mounts `App.tsx`; `index.html` provides the Tailwind CDN theme, Google fonts, import map, root element, and global stylesheet link.

`App.tsx` is the main state and routing coordinator. It delegates client-side routing helpers to `utils/routing.ts`, active generation lifecycle to `hooks/useAnalysisRun.ts`, history/preset/resume state to `hooks/useHistoryLibrary.ts`, and presentation shell concerns to `components/AppShell.tsx` plus page components.

`services/sophiaService.ts` is the AI orchestration layer. It calls OpenAI-compatible `/chat/completions` and `/images/generations` through `services/api/apiClient.ts`, normalizes model JSON into the shared shapes in `types/domain.ts`, streams voice essays back through callbacks, generates voice avatars, and runs the analysis pipeline in stages: outline, route details, concurrent thought voices, then synthesis.

`types/domain.ts` defines the shared data model for analysis results, outlines, route nodes, voices, progress updates, active runs, history entries, run snapshots, and continuation context. Keep service outputs and component props aligned with these types when changing the generation schema.

The main UI components are organized by shell, page, or result section: `components/Arena.tsx` renders result-level actions and the Continuation Studio while `components/ArenaSections.tsx` contains the stable result sections; `ReasoningDisplay.tsx` and `GenerationLogPanel.tsx` show generation progress and logs; `ThoughtVoiceCard.tsx` renders each long-form voice and avatar fallback; `HistoryPage.tsx`, `ManifestoPage.tsx`, `SettingsPage.tsx`, `HomePage.tsx`, and `ResultPage.tsx` render top-level pages. `DynamicBackground.tsx` lazy-loads the React Three Fiber `BackgroundScene.tsx` after idle time.

Styling is mostly Tailwind utility classes backed by the custom `museum` palette and font families declared in `index.html`. `index.css` only contains global animation, scrolling, scrollbar, and selection styles.

## Extension points

When asked to add a new analytical mode, voice kind, or preset model, the canonical entry points are:

- **New analysis mode** (e.g. `dialectic_court`): add to `ProgramMode` in `types/domain.ts`; register the label and the prompt rules in `services/prompts.ts` (`MODE_LABELS` and the path list inside `outlineSystemPrompt`); pick an icon in `components/ArenaSections.tsx` `modeIcon`. If the mode needs a specialized rendered section (like `diagnosisFrame` / `thoughtExperiment` / `seminarMatrix`), add the field to `types/domain.ts` and a corresponding section in `ArenaSections.tsx`.
- **New voice kind** (e.g. `'fictional'`): extend `VoiceKind` in `types/domain.ts`; update `kindLabel` and `VOICE_KIND_SYMBOL` in `components/ThoughtVoiceCard.tsx`; update `VOICE_KIND_AVATAR_SUBJECT` in `services/sophiaService.ts` so avatar prompts know what to draw.
- **New preset model** (e.g. `claude`): inject env in `vite.config.ts` `define` and `.github/workflows/deploy.yml` build env; declare the type in `vite-env.d.ts`; add a row to `services/modelPresets.ts`. Document the new GitHub Variable in `DEPLOY.md` and `README.md`.
- **Editing a built-in prompt**: edit `services/prompts.ts`. The Settings page can override prompts at runtime via `sophia.settings.v1.promptOverrides`, but committed defaults live here.

`CONTRIBUTING.md` has the longer form of these procedures with concrete file paths and step ordering.

## Runtime and deployment notes

Vite exposes Sophia configuration through `process.env.*` constants in `vite.config.ts`. Important variables are `SOPHIA_API_KEY`, `SOPHIA_API_BASE_URL`, `SOPHIA_API_MODEL`, `SOPHIA_IMAGE_MODEL`, `SOPHIA_IMAGE_SIZE`, `SOPHIA_IMAGE_ASPECT_HINT`, and `SOPHIA_API_PROVIDER`.

In local dev and preview, `vite.config.ts` routes API calls through `/sophia-api` and injects the authorization header from `SOPHIA_API_KEY`, so the key is not defined into the browser bundle. In GitHub Actions builds, `GITHUB_ACTIONS=true` disables that local proxy behavior and uses the configured API values directly.

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`: pushes to `main` or manual workflow dispatch run Node 20, `npm ci`, `npm run build`, upload `dist`, and deploy via `actions/deploy-pages`. PRs and `main` pushes also run `.github/workflows/ci.yml` with test, typecheck, and build.
