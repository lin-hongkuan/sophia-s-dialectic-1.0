import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const dataDir = resolve(projectRoot, 'data');
const avatarDir = resolve(dataDir, 'reference-avatars');

process.chdir(projectRoot);
process.env.GITHUB_ACTIONS = 'true';
process.env.SOPHIA_IMAGE_ASPECT_HINT = process.env.SOPHIA_IMAGE_ASPECT_HINT || 'portrait 1:1.2 aspect ratio';

// CLI: positional args = topic; --provider=<id> overrides the active text-model preset
// (preset:gpt | preset:mimo | preset:grok). Avatar model is always the env default.
const validProviders = new Set(['preset:gpt', 'preset:mimo', 'preset:grok', 'custom']);
const cliArgs = process.argv.slice(2);
const positionalArgs = [];
let providerOverride = null;
for (const arg of cliArgs) {
  if (arg.startsWith('--provider=')) {
    const value = arg.slice('--provider='.length);
    if (!validProviders.has(value)) {
      throw new Error(`Invalid --provider value: ${value}. Expected one of: ${[...validProviders].join(', ')}`);
    }
    providerOverride = value;
  } else {
    positionalArgs.push(arg);
  }
}
const topic = positionalArgs.join(' ').trim() || '女性主义有道理吗？';
const generatedAt = new Date().toISOString();

const slugify = (value, fallback) => {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
};

const extFromMime = (mime) => {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
};

const saveAvatar = async (voice, index) => {
  const avatar = voice.avatar;
  if (!avatar?.imageUrl) return null;

  let buffer;
  let ext = 'png';

  const dataMatch = avatar.imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    ext = extFromMime(dataMatch[1]);
    buffer = Buffer.from(dataMatch[2], 'base64');
  } else if (/^https?:\/\//.test(avatar.imageUrl)) {
    const response = await fetch(avatar.imageUrl);
    if (!response.ok) throw new Error(`Avatar fetch failed ${response.status} for ${voice.name}`);
    const mime = response.headers.get('content-type') || 'image/png';
    ext = extFromMime(mime);
    buffer = Buffer.from(await response.arrayBuffer());
  } else {
    return null;
  }

  const modelSlug = slugify(avatar.model || 'image-model', 'image-model');
  const voiceSlug = slugify(voice.name || voice.id, `voice-${index + 1}`);
  const filename = `${String(index + 1).padStart(2, '0')}-${voiceSlug}-${modelSlug}.${ext}`;
  const filePath = resolve(avatarDir, filename);
  writeFileSync(filePath, buffer);

  return {
    identifier: `voice${index + 1}Avatar`,
    importPath: `./${relative(dataDir, filePath).replace(/\\/g, '/')}`,
    placeholder: `__REFERENCE_AVATAR_${index + 1}__`,
    bytes: buffer.length,
  };
};

const toTsObject = (value, avatarImports) => {
  let source = JSON.stringify(value, null, 2);
  for (const avatarImport of avatarImports) {
    source = source.replace(`"${avatarImport.placeholder}"`, avatarImport.identifier);
  }
  return source;
};

const server = await createServer({
  root: projectRoot,
  mode: 'development',
  logLevel: 'warn',
  appType: 'custom',
  server: { middlewareMode: true },
});

try {
  mkdirSync(avatarDir, { recursive: true });

  const { analyzeTopic } = await server.ssrLoadModule('/services/sophiaService.ts');

  if (providerOverride) {
    const sophiaConfig = await server.ssrLoadModule('/services/sophiaConfig.ts');
    sophiaConfig.updateSettings({ activeProviderId: providerOverride });
    const resolved = sophiaConfig.getActiveConfig();
    console.log(`Provider override: ${providerOverride} → text model "${resolved.apiModel}", avatar model "${resolved.avatarImageModel}"`);
  }

  console.log(`Generating full-chain reference sample for: ${topic}`);

  const result = await analyzeTopic(topic, {
    onProgress: (progress) => {
      const current = progress.currentVoiceName ? ` · ${progress.currentVoiceName}` : '';
      console.log(`[${progress.stage}] ${progress.completedVoices}/${progress.totalVoices}${current}`);
    },
    onOutline: (outline) => {
      console.log(`Outline: ${outline.philosophical_title} (${outline.modeLabel})`);
    },
    onVoiceComplete: (voice) => {
      console.log(`Voice complete: ${voice.name}`);
    },
  });

  result.createdAt = generatedAt;
  result.reasoning_trace = [
    ...(Array.isArray(result.reasoning_trace) ? result.reasoning_trace : []),
    `Full-chain API regenerated reference sample at ${generatedAt}`,
  ];

  const avatarImports = [];
  for (let index = 0; index < result.voices.length; index += 1) {
    const avatarImport = await saveAvatar(result.voices[index], index);
    if (avatarImport) {
      result.voices[index].avatar.imageUrl = avatarImport.placeholder;
      avatarImports.push(avatarImport);
      console.log(`Avatar saved: ${avatarImport.importPath} (${avatarImport.bytes} bytes)`);
    }
  }

  const entry = {
    id: 'preset-feminism',
    topic: result.topic,
    title: result.philosophical_title,
    mode: result.mode,
    modeLabel: result.modeLabel,
    createdAt: generatedAt,
    isPreset: true,
    generatedByChain: true,
    result,
  };

  const imports = [
    "import { HistoryEntry } from '../types';",
    ...avatarImports.map((avatarImport) => `import ${avatarImport.identifier} from '${avatarImport.importPath}';`),
  ].join('\n');

  const content = `${imports}\n\nexport const PRELOADED_HISTORY_ENTRY: HistoryEntry = ${toTsObject(entry, avatarImports)};\n`;
  writeFileSync(resolve(dataDir, 'preloadedHistory.ts'), content);
  console.log('Updated data/preloadedHistory.ts');
} finally {
  await server.close();
}
