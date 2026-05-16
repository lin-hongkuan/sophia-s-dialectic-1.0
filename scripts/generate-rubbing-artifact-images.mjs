import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const envPath = path.resolve(projectRoot, '.env.local');
const targetDir = path.resolve(projectRoot, 'public', 'rubbing-artifacts');
const force = process.argv.includes('--force');

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

const extFromBuffer = (buffer) => {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return 'png';
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options = {}, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestImage = async (prompt, cfg, label, maxRetries = 5) => {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(`${cfg.apiBaseUrl}/images/generations`, {
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
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delayMs = Math.min(10000, attempt * 2500);
      console.log(`${label}: attempt ${attempt} failed before response; retrying in ${delayMs}ms`);
      await wait(delayMs);
      continue;
    }

    if (response.ok) {
      const data = await response.json();
      const item = data?.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
      if (item?.url) {
        const imageResponse = await fetchWithTimeout(item.url);
        if (!imageResponse.ok) throw new Error(`${label}: image URL fetch failed ${imageResponse.status}`);
        return Buffer.from(await imageResponse.arrayBuffer());
      }
      throw new Error(`${label}: image API returned no usable image data`);
    }

    const body = await response.text();
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxRetries) {
      throw new Error(`${label}: image API error ${response.status}: ${body}`);
    }

    const delayMs = Math.min(10000, attempt * 2500);
    console.log(`${label}: attempt ${attempt} failed with ${response.status}; retrying in ${delayMs}ms`);
    await wait(delayMs);
  }

  throw new Error(`${label}: max retries exceeded`);
};

const sharedStyle = [
  'Use case: stylized-concept',
  'Asset type: static game collectible image for a museum rubbing puzzle completion card',
  'Style/medium: museum-editorial painterly realism, tactile catalog plate, refined object study, softly aged paper grain, complete single artifact, not fantasy art.',
  'Composition/framing: square image, artifact centered on a quiet low plinth or archival cloth, generous breathing room, object fully visible, suitable for cropping inside a compact UI card.',
  'Lighting/mood: soft directional gallery light, calm scholarly mood, subtle shadow, restrained but vivid.',
  'Color palette: warm ivory, charcoal, muted mineral blue, oxide red, aged bronze, porcelain white accents where appropriate.',
  'Constraints: no readable text, no Chinese characters, no labels, no logos, no UI, no watermark, no people unless explicitly requested, no busy background.',
].join('\n');

const artifacts = [
  {
    id: 'amphora',
    title: '希腊双耳瓶',
    subject: 'Ancient Greek black-figure amphora, terracotta clay body, twin handles, narrow neck and rounded belly, subtle mythic black-figure ornament treated as non-readable decoration.',
  },
  {
    id: 'cauldron',
    title: '青铜鼎',
    subject: 'Ancient Chinese bronze ding cauldron, three sturdy legs, twin loop handles, oxidized bronze patina, ceremonial weight and authority.',
  },
  {
    id: 'violin',
    title: '小提琴',
    subject: 'Seventeenth-century violin, warm varnished wood, f-holes, bridge, strings and bow nearby, intimate chamber-music artifact rather than performance scene.',
  },
  {
    id: 'pocket-watch',
    title: '怀表',
    subject: 'Nineteenth-century pocket watch opened at an angle, metal case, chain, visible dial and mechanical detail, no readable numerals or words.',
  },
  {
    id: 'handheld-fan',
    title: '折扇',
    subject: 'Decorative handheld folding accessory opened into a semicircle, fine wooden ribs, pale paper surface with simple abstract ornamental marks, elegant archival still life.',
  },
  {
    id: 'ionic-column',
    title: '爱奥尼柱',
    subject: 'Ionic column capital fragment, carved pale stone, paired volutes, fluted shaft hint, classical architecture artifact presented as a museum fragment.',
  },
  {
    id: 'philosopher-bust',
    title: '哲人胸像',
    subject: 'Classical philosopher bust, marble head and shoulders on a simple base, thoughtful idealized face, chipped archival surface, no inscription.',
  },
  {
    id: 'porcelain-vase',
    title: '瓷瓶',
    subject: 'Chinese porcelain vase, slender neck, rounded shoulder, glossy glaze, quiet blue-and-white ornamental rhythm without readable symbols.',
  },
];

await loadLocalEnv();

const cfg = {
  apiBaseUrl: (process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/+$/, ''),
  apiKey: process.env.SOPHIA_API_KEY || '',
  imageModel: process.env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite',
  imageSize: process.env.SOPHIA_IMAGE_SIZE || '1024x1024',
};

if (!cfg.apiKey) {
  throw new Error('SOPHIA_API_KEY is required to generate rubbing artifact images.');
}

await fs.mkdir(targetDir, { recursive: true });
console.log(`Generating rubbing artifact images with ${cfg.imageModel} at ${cfg.imageSize}`);

const manifest = {
  generatedAt: new Date().toISOString(),
  model: cfg.imageModel,
  size: cfg.imageSize,
  assets: [],
};

for (const artifact of artifacts) {
  const prompt = [
    sharedStyle,
    'Primary request: create a polished collectible image for the artifact described below.',
    `Subject: ${artifact.subject}`,
  ].join('\n');

  const existing = await fs.readdir(targetDir).catch(() => []);
  const existingFile = existing.find((name) => name.startsWith(`${artifact.id}.`));
  if (existingFile && !force) {
    console.log(`Skipping ${artifact.id}; ${existingFile} already exists. Use --force to regenerate.`);
    manifest.assets.push({
      id: artifact.id,
      title: artifact.title,
      file: `/rubbing-artifacts/${existingFile}`,
      prompt,
      skipped: true,
    });
    continue;
  }

  console.log(`Generating ${artifact.id}...`);
  try {
    const buffer = await requestImage(prompt, cfg, artifact.id);
    const ext = extFromBuffer(buffer);
    const filepath = path.join(targetDir, `${artifact.id}.${ext}`);
    await Promise.all(['png', 'jpg', 'webp'].map((staleExt) =>
      fs.rm(path.join(targetDir, `${artifact.id}.${staleExt}`), { force: true }),
    ));
    await fs.writeFile(filepath, buffer);
    manifest.assets.push({
      id: artifact.id,
      title: artifact.title,
      file: `/rubbing-artifacts/${artifact.id}.${ext}`,
      prompt,
    });
    console.log(`Saved ${path.relative(projectRoot, filepath)} (${buffer.length} bytes)`);
  } catch (error) {
    console.error(`${artifact.id}: failed after retries:`, error);
    manifest.assets.push({
      id: artifact.id,
      title: artifact.title,
      file: '',
      prompt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await fs.writeFile(
  path.join(targetDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
