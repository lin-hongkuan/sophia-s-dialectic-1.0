import assert from 'node:assert/strict';
import test from 'node:test';
import { extractGeneratedImageUrl } from '../services/sophiaService';

const pngBase64 = 'iVBORw0KGgo' + 'A'.repeat(256);

test('extractGeneratedImageUrl reads Responses image_generation_call result payloads', () => {
  const payload = {
    id: 'resp_123',
    output: [
      { type: 'message', content: [{ type: 'output_text', text: 'completed' }] },
      { type: 'image_generation_call', result: pngBase64 },
    ],
  };

  assert.equal(
    extractGeneratedImageUrl(payload),
    `data:image/png;base64,${pngBase64}`,
  );
});

test('extractGeneratedImageUrl reads Responses output_image content URLs', () => {
  const payload = {
    output: [{
      type: 'message',
      content: [{
        type: 'output_image',
        image_url: 'https://cdn.example.test/avatar.png',
      }],
    }],
  };

  assert.equal(extractGeneratedImageUrl(payload), 'https://cdn.example.test/avatar.png');
});

test('extractGeneratedImageUrl reads markdown image links from output_text', () => {
  const payload = {
    output_text: 'Here is the avatar: ![avatar](data:image/png;base64,QUJDREVGRw==)',
  };

  assert.equal(extractGeneratedImageUrl(payload), 'data:image/png;base64,QUJDREVGRw==');
});
