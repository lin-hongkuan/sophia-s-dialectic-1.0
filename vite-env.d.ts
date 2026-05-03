/// <reference types="vite/client" />

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

// Vite injects these via `define` (vite.config.ts). They land on `process.env.*`
// in the browser bundle even though there's no Node `process` at runtime — they're
// pure compile-time string substitutions, so the typings here mirror that contract.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SOPHIA_API_KEY: string;
      SOPHIA_API_BASE_URL: string;
      SOPHIA_API_MODEL: string;
      SOPHIA_IMAGE_MODEL: string;
      SOPHIA_IMAGE_SIZE: string;
      SOPHIA_IMAGE_ASPECT_HINT: string;
      SOPHIA_API_PROVIDER: string;
      SOPHIA_API_CONFIGURED: 'true' | 'false';
      SOPHIA_PRESET_GPT_MODEL: string;
      SOPHIA_PRESET_MIMO_MODEL: string;
      SOPHIA_PRESET_GROK_MODEL: string;
    }
  }
}

export {};
