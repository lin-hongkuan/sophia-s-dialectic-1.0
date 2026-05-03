import fs from 'fs/promises';
import path from 'path';

// API configuration from .env.local
const API_BASE_URL = 'https://api.linhongkuan.com/v1';
const API_KEY = 'sk-WcuXYbfydsHFUteYat0pIbkSVFQEKZStG3wMfICIXXF7N2eZ';
const IMAGE_MODEL = 'grok-imagine-image-lite';
const IMAGE_SIZE = '1024x1024';

// Voice prompts - OPTIMIZED VERSION
// Key improvements:
// 1. Fixed "square" vs "1:1.2" contradiction - now consistently portrait
// 2. Replaced negative descriptions with positive ones
// 3. Added specific visual anchors per voice kind
// 4. Added quality boosters (masterpiece, highly detailed)
// 5. Enhanced mood/temperament descriptions
const STYLE_BLOCK = `Editorial portrait illustration, museum-catalog quality, warm ivory and charcoal palette, muted ink-wash texture with subtle paper grain, soft directional studio lighting, contemplative philosophical atmosphere, painterly realism with editorial restraint, masterpiece quality, highly detailed.`;

const COMPOSITION_BLOCK = `Portrait orientation 5:6 aspect ratio, slightly taller-than-wide, head-and-shoulders or symbolic chest-up vignette, centered composition, soft key light from upper left, calm neutral background with subtle texture, quiet vertical breathing room above and below the figure.`;

const NEGATIVE_BLOCK = `no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, no distorted facial features, no extra limbs, no celebrity likeness, no cartoon style, no anime style, no plastic skin.`;

const voices = [
  {
    name: '01-自由主义女性主义',
    prompt: `${STYLE_BLOCK}
Subject: A fictional female thinker embodying liberal feminist temperament. She appears as a composed, intellectual woman in her 40s-50s, wearing understated professional attire (blouse or simple jacket). Her expression conveys quiet determination and rational clarity. Background includes subtle hints of institutional architecture or legal documents, suggesting her focus on structural reform.
Voice name (semantic anchor only, do NOT render as text): 自由主义女性主义
Voice kind: school
School / tradition: 女性主义
Role in this analysis: 平权辩手
Core concept: 形式平等
One-line stance: 先把门打开，让女性拥有和男性同等的权利、机会与选择，再谈别的。
User question being analyzed: 女性主义有道理吗？
Big question: 女性主义：平权诉求，还是世界观重写？
Analytical mode: 女性主义流派研讨会
${COMPOSITION_BLOCK}
${NEGATIVE_BLOCK}`,
  },
  {
    name: '02-激进女性主义',
    prompt: `${STYLE_BLOCK}
Subject: A fictional female thinker embodying radical feminist temperament. She appears as an intense, penetrating woman in her 30s-40s, with sharp analytical gaze. Her attire is simple but deliberate - perhaps a dark turtleneck or minimalist clothing. Her expression reveals fierce intellectual clarity mixed with controlled urgency. Background suggests structural elements - bare walls, geometric shadows, or abstract representations of institutional power.
Voice name (semantic anchor only, do NOT render as text): 激进女性主义
Voice kind: school
School / tradition: 女性主义
Role in this analysis: 结构解剖师
Core concept: 父权制
One-line stance: 问题不只是个别人不公平，而是整套性别秩序本身就建立在支配关系上。
User question being analyzed: 女性主义有道理吗？
Big question: 女性主义：平权诉求，还是世界观重写？
Analytical mode: 女性主义流派研讨会
${COMPOSITION_BLOCK}
${NEGATIVE_BLOCK}`,
  },
  {
    name: '03-交叉性女性主义',
    prompt: `${STYLE_BLOCK}
Subject: An allegorical personification of intersectionality as a concept. The figure is a woman whose form subtly merges multiple identities - her silhouette suggests overlapping layers, her gaze holds complexity and nuance. She wears elements that hint at different cultural backgrounds without stereotyping. The background features intersecting lines or overlapping translucent planes, symbolizing how multiple systems of oppression converge. Her expression is one of compassionate knowing - she sees the full picture others miss.
Voice name (semantic anchor only, do NOT render as text): 交叉性女性主义
Voice kind: concept
School / tradition: 女性主义
Role in this analysis: 复杂性提醒者
Core concept: 交叉性
One-line stance: 没有一个抽象的'女性'，只有处在不同社会交汇处的具体的人。
User question being analyzed: 女性主义有道理吗？
Big question: 女性主义：平权诉求，还是世界观重写？
Analytical mode: 女性主义流派研讨会
${COMPOSITION_BLOCK}
${NEGATIVE_BLOCK}`,
  },
  {
    name: '04-后结构女性主义',
    prompt: `${STYLE_BLOCK}
Subject: A fictional female thinker embodying post-structural feminist temperament. She appears as a woman in her 30s-50s with an air of deconstructive intelligence - someone who sees through categories. Her attire might include unexpected combinations that challenge conventional femininity. Her expression is questioning, slightly ironic, yet deeply engaged. Background could feature mirrors, fragmented reflections, or text being unwritten - suggesting the instability of identity categories.
Voice name (semantic anchor only, do NOT render as text): 后结构女性主义
Voice kind: school
School / tradition: 女性主义
Role in this analysis: 概念拆解者
Core concept: 性别表演
One-line stance: '女人'并不是一个自然透明的身份，而是被语言、制度和日常重复塑造出来的。
User question being analyzed: 女性主义有道理吗？
Big question: 女性主义：平权诉求，还是世界观重写？
Analytical mode: 女性主义流派研讨会
${COMPOSITION_BLOCK}
${NEGATIVE_BLOCK}`,
  },
  {
    name: '05-性别差异论批评',
    prompt: `${STYLE_BLOCK}
Subject: A fictional female thinker holding a conservative gender-difference stance. She appears as a thoughtful, grounded woman in her 40s-60s, dressed in classic, comfortable attire that suggests tradition without rigidity. Her expression conveys warmth, practical wisdom, and quiet conviction. Background might include domestic elements - a bookshelf, soft fabric, or natural objects - suggesting she values home, care, and embodied experience over abstract ideology.
Voice name (semantic anchor only, do NOT render as text): 性别差异论批评
Voice kind: position
School / tradition: 保守主义
Role in this analysis: 质疑者
Core concept: 性别分工
One-line stance: 女性主义常常把差异说成压迫，把家庭与照料的价值说得太低。
User question being analyzed: 女性主义有道理吗？
Big question: 女性主义：平权诉求，还是世界观重写？
Analytical mode: 女性主义流派研讨会
${COMPOSITION_BLOCK}
${NEGATIVE_BLOCK}`,
  },
];

const targetDir = path.resolve('data/reference-avatars');

async function generateAvatar(prompt, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt,
          n: 1,
          size: IMAGE_SIZE,
          response_format: 'b64_json',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (attempt < maxRetries && response.status === 503) {
          console.log(`    Attempt ${attempt} failed with 503, retrying in ${attempt * 2}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        throw new Error(`API error ${response.status}: ${error}`);
      }

      const data = await response.json();
      const item = data?.data?.[0];
      if (item?.b64_json) {
        return Buffer.from(item.b64_json, 'base64');
      }
      if (item?.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image from URL: ${imageResponse.status}`);
        }
        return Buffer.from(await imageResponse.arrayBuffer());
      }
      throw new Error('No image data in response');
    } catch (error) {
      if (attempt < maxRetries && error.message.includes('503')) {
        console.log(`    Attempt ${attempt} failed, retrying in ${attempt * 2}s...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

async function main() {
  console.log('Regenerating preloaded avatars...');
  console.log(`Target directory: ${targetDir}`);
  
  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });

  for (const voice of voices) {
    const filename = `${voice.name}-${IMAGE_MODEL}.png`;
    const filepath = path.join(targetDir, filename);
    
    console.log(`Generating ${filename}...`);
    try {
      const imageBuffer = await generateAvatar(voice.prompt);
      await fs.writeFile(filepath, imageBuffer);
      console.log(`  Saved ${filepath} (${imageBuffer.length} bytes)`);
    } catch (error) {
      console.error(`  Failed to generate ${filename}:`, error.message);
    }
  }
  
  console.log('Done.');
}

main().catch(console.error);