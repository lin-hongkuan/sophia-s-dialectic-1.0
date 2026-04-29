// One-shot script: generate reference avatars for the preloaded sample voices
// using grok-imagine-image-lite. Outputs to public/reference-avatars/*.jpg
// Run with: node scripts/generate-reference-avatars.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const outputDir = resolve(projectRoot, 'public', 'reference-avatars');
mkdirSync(outputDir, { recursive: true });

const envText = readFileSync(resolve(projectRoot, '.env.local'), 'utf-8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return idx === -1 ? [line.trim(), ''] : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const apiKey = env.SOPHIA_API_KEY;
const baseUrl = (env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/$/, '');
const imageModel = env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite';
if (!apiKey) {
  console.error('SOPHIA_API_KEY missing in .env.local');
  process.exit(1);
}

const STYLE = 'Sophia editorial portrait style: square museum-catalog avatar, warm ivory and charcoal palette, muted ink-wash texture, subtle paper grain, soft directional light, restrained philosophical atmosphere, elegant, non-cartoon, non-photorealistic, no text, no logos, no UI elements.';
const NEGATIVE = 'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.';

const buildPrompt = (voice) => [
  STYLE,
  `Subject: a fictional, representative thinker embodying the temperament of this school of thought; symbolic, archetypal, never a real person.`,
  `Voice name (semantic anchor only, do NOT render as text): ${voice.name}`,
  `Voice kind: school`,
  `Role in this analysis: ${voice.role}`,
  `Core concept: ${voice.coreConcept}`,
  `One-line stance: ${voice.oneLine}`,
  `User question being analyzed: 我们应该生孩子吗？`,
  `Big question: 在不确定的世界里，生育是一种责任、冒险，还是自我安慰？`,
  `Analytical mode: 两难困境 + 圆桌辩论`,
  `Mood / atmosphere: ${voice.mood}`,
  'Composition: square 1:1 framing, head-and-shoulders or symbolic chest-up vignette, centered, soft directional light, calm museum-catalog atmosphere.',
  NEGATIVE,
].join('\n');

const voices = [
  {
    slug: 'antinatalism',
    name: '反出生主义',
    role: '质询者',
    coreConcept: '未经同意的风险',
    oneLine: '让一个人来到世界，需要被证明是正当的。',
    mood: 'sober, ethically severe, withdrawn yet attentive; quiet weight of unresolved consent; ink-wash shadow tones with restrained ivory highlights.',
  },
  {
    slug: 'existentialism',
    name: '存在主义',
    role: '辩护者',
    coreConcept: '意义的创造',
    oneLine: '生命没有预设保证，但意义可以在存在中被创造。',
    mood: 'lucid, resolute, quietly hopeful in the absence of guarantees; warm ivory light glancing off charcoal shadow; the figure poised on the edge of choice.',
  },
];

const generate = async (voice) => {
  const prompt = buildPrompt(voice);
  console.log(`\nGenerating avatar for ${voice.name} ...`);
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Image API failed ${response.status}: ${body}`);
  }

  const data = await response.json();
  const item = data?.data?.[0];
  if (!item) throw new Error('Image API returned no data');

  let buffer;
  let extension = 'jpg';
  if (item.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64');
  } else if (item.url) {
    console.log(`  fetching ${item.url}`);
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Image fetch failed ${imgRes.status}`);
    const arrayBuffer = await imgRes.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    const contentType = imgRes.headers.get('content-type') || '';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('webp')) extension = 'webp';
    else extension = 'jpg';
  } else {
    throw new Error('Image API returned neither b64_json nor url');
  }

  const filename = `${voice.slug}-${imageModel}.${extension}`;
  const filepath = resolve(outputDir, filename);
  writeFileSync(filepath, buffer);
  console.log(`  saved ${filepath} (${buffer.length} bytes)`);
  return { ...voice, prompt, filename, bytes: buffer.length };
};

const results = [];
for (const voice of voices) {
  // Sequential to keep load reasonable.
  // eslint-disable-next-line no-await-in-loop
  results.push(await generate(voice));
}

console.log('\n--- summary ---');
for (const r of results) {
  console.log(`${r.name}\n  file: public/reference-avatars/${r.filename}\n  prompt:\n${r.prompt}\n`);
}
