# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Settings page (`/settings`) with runtime model switching, BYO LLM (custom base URL / API key / model), prompt editor for outline / voice / synthesis system prompts, and runtime knobs for temperature / voice concurrency / voice max tokens.
- GitHub Variables driven model presets: `SOPHIA_PRESET_GPT_MODEL`, `SOPHIA_PRESET_MIMO_MODEL`, `SOPHIA_PRESET_GROK_MODEL`. Unconfigured presets surface as a greyed "未配置" card in Settings.
- Topic reframe flow: when the input does not look like a philosophy-ready question (e.g. "奥特曼"), Sophia returns three philosophical reframings for the user to confirm before committing the long generation.
- Generation log panel: every stage / voice step / streaming progress / token usage event is appended to a scrolling log, with auto-stick-to-bottom and a "回到最新" button when the user scrolls up.
- Token-budget panel: per-stage and per-model token usage is collected client-side, persisted to `localStorage` (`sophia.tokens.v1`), exportable as CSV.
- Connection-test button on Settings page: pings the active provider and reports localized success / latency / error.
- `validateUserPrompt` utility shared by the home input and Continuation Studio with mode-aware hints.
- `prefers-reduced-motion` media query honoring user motion preferences.
- TypeScript type declarations for `process.env.SOPHIA_*` (in `vite-env.d.ts`).
- `.env.local.example`, `.nvmrc`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, GitHub issue / PR templates.
- Project metadata: `engines.node: ">=20"`, `license: "MIT"` in `package.json`.

### Changed
- Localized API error messages: `401` → "API key 无效或过期"; `403` → "该 key 无该模型权限"; `404` → "模型名错误或服务未上线"; `429` → "配额或限流"; `5xx` → "上游服务波动"; etc.
- Extracted all system prompts to `services/prompts.ts`; outline / voice / synthesis prompts updated for off-topic reframe handling, anti-hallucination, and tighter tension targeting.
- `services/sophiaService.ts` no longer freezes API config at module load; each request resolves the active config from the runtime store, with env values as fallback.
- Stage labels (`STAGE_LABEL` / `STAGE_ORDER`) extracted to `constants.ts`, reused by `ReasoningDisplay`, `HistoryPage`, `ActiveRunBanner`.
- Random IDs use `crypto.randomUUID()` with a `Math.random()` fallback for older browsers.
- Manifesto background pattern moved from a CN-blocked `transparenttextures.com` URL to an inline SVG noise.

### Removed
- Dead `components/PhilosopherCard.tsx` shim (was a no-op `export { default } from './ThoughtVoiceCard'` with zero references).

### Fixed
- Inconsistent stage label wording (`等待` vs `等待提问`, `出错` vs `遇到错误`) across status banners.

## Earlier history

The following milestones were captured before this changelog was started; see git history for full detail:

- `715d08c` — voice continuation flow and improved mobile reading experience.
- `d7f54f2` — `DynamicBackground` front-occlusion plus Arena styling refinements.
- `aa40301` — `DynamicBackground` cleanup and camera responsiveness.
- `a64b784` — `ManifestoPage` principles and methodology refresh.
- `31a93e8` — clean SPA routes for GitHub Pages SPA fallback.
