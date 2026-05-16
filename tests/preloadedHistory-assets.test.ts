import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const rootDir = process.cwd();
const preloadedPath = path.join(rootDir, 'data', 'preloadedHistory.ts');
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const jpgSignature = Buffer.from([255, 216, 255]);
const webpRiffSignature = Buffer.from('RIFF', 'ascii');
const webpFormatSignature = Buffer.from('WEBP', 'ascii');

const assertRasterAsset = (relativePath: string) => {
  const absolutePath = path.join(rootDir, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} should exist`);
  assert.ok(statSync(absolutePath).size > 50_000, `${relativePath} should be a real image asset`);
  const signature = readFileSync(absolutePath).subarray(0, 12);
  const isPng = signature.subarray(0, 8).equals(pngSignature);
  const isJpg = signature.subarray(0, 3).equals(jpgSignature);
  const isWebp = signature.subarray(0, 4).equals(webpRiffSignature) && signature.subarray(8, 12).equals(webpFormatSignature);

  assert.ok(isPng || isJpg || isWebp, `${relativePath} should be a supported raster image`);
};

test('preloaded history has complete local magazine images', () => {
  const source = readFileSync(preloadedPath, 'utf8');
  const magazineAssets = [
    {
      slot: 'cover',
      variableName: 'preloadedMagazineCover',
      importPath: './reference-magazine/cover-feminism-seminar.jpg',
      filePath: 'data/reference-magazine/cover-feminism-seminar.jpg',
    },
    {
      slot: 'conclusion',
      variableName: 'preloadedMagazineConclusion',
      importPath: './reference-magazine/conclusion-feminism-seminar.jpg',
      filePath: 'data/reference-magazine/conclusion-feminism-seminar.jpg',
    },
  ];

  assert.doesNotMatch(source, /"imageUrl":\s*"data:image\//, 'preloaded history should not inline large images');
  assert.doesNotMatch(source, /local-demo-asset|Local deterministic/, 'preloaded magazine images should come from the AI image pipeline');
  assert.match(source, /"magazineImages":\s*\{/, 'preloaded result should include magazineImages');

  for (const asset of magazineAssets) {
    assertRasterAsset(asset.filePath);
    assert.match(
      source,
      new RegExp(`import ${asset.variableName} from '${asset.importPath.replaceAll('.', '\\.')}';`),
      `${asset.variableName} import should point at the local demo image`,
    );
    assert.match(
      source,
      new RegExp(`"${asset.slot}": \\{[\\s\\S]*?"imageUrl": ${asset.variableName},[\\s\\S]*?"model": "grok-imagine-image-lite",[\\s\\S]*?"status": "completed"`),
      `${asset.slot} magazine image should be wired as completed`,
    );
  }
});

test('preloaded history keeps all voice avatars as local raster assets', () => {
  const source = readFileSync(preloadedPath, 'utf8');
  const avatarImports = [...source.matchAll(/import (voice\d+Avatar) from '(.+?\.(?:png|jpg|jpeg|webp))';/g)];

  assert.equal(avatarImports.length, 5, 'the preset should import five local voice avatars');
  assert.equal([...source.matchAll(/"imageUrl": voice\d+Avatar/g)].length, 5, 'each preset voice should reference an avatar import');

  for (const [, variableName, importPath] of avatarImports) {
    assert.match(source, new RegExp(`"imageUrl": ${variableName}\\b`), `${variableName} should be used by a voice`);
    assertRasterAsset(path.join('data', importPath.replace('./', '')));
  }
});
