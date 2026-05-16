import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const envPath = path.resolve(projectRoot, '.env.local');
const targetDir = path.resolve(projectRoot, 'data', 'reference-magazine');

const loadLocalEnv = async () => {
  try {
    const content = await fs.readFile(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
};

const extFromMime = (mime) => {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
};

const extFromBuffer = (buffer) => {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return null;
};

const removeStaleVariants = async (filenameBase) => {
  await Promise.all(['png', 'jpg', 'webp'].map((ext) =>
    fs.rm(path.join(targetDir, `${filenameBase}.${ext}`), { force: true }),
  ));
};

const saveImage = async (imageUrl, filenameBase) => {
  const dataMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    const buffer = Buffer.from(dataMatch[2], 'base64');
    const ext = extFromBuffer(buffer) || extFromMime(dataMatch[1]);
    const filepath = path.join(targetDir, `${filenameBase}.${ext}`);
    await removeStaleVariants(filenameBase);
    await fs.writeFile(filepath, buffer);
    return { filepath, bytes: buffer.length };
  }

  if (/^https?:\/\//.test(imageUrl)) {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Image fetch failed ${response.status} for ${filenameBase}`);
    const mime = response.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = extFromBuffer(buffer) || extFromMime(mime);
    const filepath = path.join(targetDir, `${filenameBase}.${ext}`);
    await removeStaleVariants(filenameBase);
    await fs.writeFile(filepath, buffer);
    return { filepath, bytes: buffer.length };
  }

  throw new Error(`Unsupported imageUrl format for ${filenameBase}`);
};

const requestImage = async (prompt, cfg, label, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(`${cfg.apiBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.imageModel,
        prompt,
        n: 1,
        size: cfg.imageSize,
        response_format: 'b64_json',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const item = data?.data?.[0];
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item?.url) return item.url;
      throw new Error(`No image data returned for ${label}`);
    }

    const body = await response.text();
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxRetries) {
      throw new Error(`${label} image API error ${response.status}: ${body}`);
    }

    const delayMs = Math.min(10000, attempt * 2500);
    console.log(`${label}: attempt ${attempt} failed with ${response.status}; retrying in ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`${label}: max retries exceeded`);
};

await loadLocalEnv();

const cfg = {
  apiBaseUrl: (process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/+$/, ''),
  apiKey: process.env.SOPHIA_API_KEY || '',
  imageModel: process.env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite',
  imageSize: process.env.SOPHIA_IMAGE_SIZE || '1024x1024',
};

if (!cfg.apiKey) {
  throw new Error('SOPHIA_API_KEY is required to regenerate preloaded magazine images.');
}

const sharedStyle = [
  'Create a refined philosophy magazine editorial illustration for a Chinese long-form analysis.',
  'The topic is whether feminism is reasonable, framed as a school seminar with five positions: liberal feminism, radical feminism, intersectional feminism, post-structural feminism, and a gender-difference critique.',
  'Style: museum-editorial, tactile paper grain, painterly realism with restrained symbolic objects, warm ivory, charcoal, muted teal, deep red, ochre, and olive accents.',
  'No readable text, no Chinese characters, no subtitles, no typography, no logos, no UI, no watermark.',
  'Horizontal editorial plate, complete central composition, suitable for a 16:9 magazine image crop.',
].join('\n');

const prompts = [
  {
    label: 'cover',
    filenameBase: 'cover-feminism-seminar',
    prompt: [
      sharedStyle,
      'Opening plate: five distinct symbolic study desks or empty chairs around a shared round table, connected by fine threads of light to a central unresolved question represented by a blank luminous page.',
      'Mood: intellectually tense but calm, inviting the reader into debate before conclusions are drawn.',
      'Composition: the round table is central, five colored accents correspond to the five schools, background has layered papers and institutional shadows, no people and no words.',
    ].join('\n'),
  },
  {
    label: 'conclusion',
    filenameBase: 'conclusion-feminism-seminar',
    prompt: [
      sharedStyle,
      'Closing plate: five colored argument threads converge toward an open doorway or window from a seminar room into ordinary daily life, with books, a coat, a cup, and domestic light as symbolic objects.',
      'Mood: reflective and unresolved, showing that the debate returns to work, family, bodies, care, and public life rather than ending as a slogan.',
      'Composition: central convergence point, open frame in the background, generous negative space, no people and no words.',
    ].join('\n'),
  },
];

await fs.mkdir(targetDir, { recursive: true });
console.log(`Generating preloaded magazine images with ${cfg.imageModel} at ${cfg.imageSize}`);

for (const item of prompts) {
  console.log(`Generating ${item.label} image...`);
  const imageUrl = await requestImage(item.prompt, cfg, item.label);
  const saved = await saveImage(imageUrl, item.filenameBase);
  console.log(`Saved ${path.relative(projectRoot, saved.filepath)} (${saved.bytes} bytes)`);
}
