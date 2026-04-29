# Sophia's Dialectic

A Vite + React philosophical program generator. Enter a modern anxiety or philosophical question, and Sophia turns it into a structured, long-form dialectical reading experience.

## Run locally

Prerequisites: Node.js 20+

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```env
SOPHIA_API_KEY=your_key_here
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_API_PROVIDER=OpenAI-compatible
```

3. Start the dev server:

```bash
npm run dev
```

Open `http://localhost:7878`.

## Notes

This is currently a frontend-only app. Any API key injected by Vite will be visible in the browser bundle, so use a limited key for public deployments. For production-grade secrecy, add a server-side proxy such as Cloudflare Workers or Vercel Functions.
