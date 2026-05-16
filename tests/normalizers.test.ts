import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeDiagnosisFrame,
  normalizeKeywords,
  normalizeQuestionFrame,
  normalizeQuestionSuggestions,
  normalizeVoicePlans,
} from '../services/analysis/normalizers';

test('normalizeQuestionSuggestions coerces, trims, filters, and caps suggestions', () => {
  assert.deepEqual(normalizeQuestionSuggestions([
    '- What counts as a good life?',
    '  Is truth always useful?  ',
    42,
    true,
    'no',
    null,
    'How should we choose?',
    'Can disagreement be productive?',
    'What remains open?',
    'Should this be dropped after the cap?',
  ]), [
    'What counts as a good life?',
    'Is truth always useful?',
    'true',
    'How should we choose?',
    'Can disagreement be productive?',
  ]);

  assert.deepEqual(normalizeQuestionSuggestions('not an array'), []);
});

test('normalizeKeywords preserves core fields and infers enrichment from long-form content', () => {
  const keywords = normalizeKeywords([
    {
      id: 'kw-care',
      term: 'Care',
      meaning: 'Attention to dependence',
      importance: 'Frames the ethical stakes',
      definition: 'A practice of responding to vulnerability.',
      misconception: 'It is not merely sentiment.',
      representativeFigures: [
        { name: 'Carol Gilligan', oneLine: 'Developed care ethics.' },
        { name: '  ', oneLine: 'ignored without a name' },
        'ignored',
      ],
      relationToQuestion: 'Shows why context matters.',
      furtherReading: ['  In a Different Voice  ', '', false],
    },
    {
      term: 'Bare keyword',
      enriched: false,
      representativeFigures: [{ name: 'Named figure', oneLine: 123 }],
    },
    'fallback keyword',
  ]);

  assert.equal(keywords.length, 3);
  assert.deepEqual(keywords[0], {
    id: 'kw-care',
    term: 'Care',
    meaning: 'Attention to dependence',
    importance: 'Frames the ethical stakes',
    definition: 'A practice of responding to vulnerability.',
    misconception: 'It is not merely sentiment.',
    representativeFigures: [{ name: 'Carol Gilligan', oneLine: 'Developed care ethics.' }],
    relationToQuestion: 'Shows why context matters.',
    lifeExample: undefined,
    challengeQuestion: undefined,
    furtherReading: ['In a Different Voice', 'false'],
    enriched: true,
  });
  assert.equal(keywords[1].id, 'keyword-2');
  assert.equal(keywords[1].enriched, false);
  assert.deepEqual(keywords[1].representativeFigures, [{ name: 'Named figure', oneLine: '123' }]);
  assert.equal(keywords[2].id, 'keyword-3');
});

test('normalizeVoicePlans limits voices, fills defaults, and normalizes kind and stance aliases', () => {
  const voices = normalizeVoicePlans([
    {
      id: 'socrates',
      name: 'Socrates',
      kind: 'philosopher',
      role: 'Questioner',
      oneLine: 'Examine every claim.',
    },
    {
      name: 99,
      kind: 'invalid-kind',
      stance: 'Inherited stance',
    },
    { kind: 'school' },
    { kind: 'concept' },
    { kind: 'position' },
    { id: 'sixth-voice' },
  ]);

  assert.equal(voices.length, 5);
  assert.deepEqual(voices[0], {
    id: 'socrates',
    name: 'Socrates',
    kind: 'philosopher',
    school: '',
    role: 'Questioner',
    coreConcept: '',
    oneLine: 'Examine every claim.',
    stance: 'Examine every claim.',
    diagnosis: '',
    prescription: '',
    thesis: '',
    critique: '',
  });
  assert.equal(voices[1].id, 'voice-2');
  assert.equal(voices[1].name, '99');
  assert.equal(voices[1].kind, 'philosopher');
  assert.equal(voices[1].oneLine, 'Inherited stance');
  assert.equal(voices[1].stance, 'Inherited stance');
  assert.equal(voices[2].role.length > 0, true);
  assert.equal(voices[4].id, 'voice-5');
});

test('normalizeQuestionFrame tolerates malformed nested values and uses topic fallbacks', () => {
  assert.deepEqual(normalizeQuestionFrame({
    original: 123,
    bigQuestion: undefined,
    plainTranslation: true,
    keywords: ['care', 7, false, null, ''],
  }, 'How should we live?', 'Ethics today'), {
    original: '123',
    bigQuestion: 'Ethics today',
    plainTranslation: 'true',
    keywords: ['care', '7', 'false'],
  });

  assert.deepEqual(normalizeQuestionFrame(null, 'Raw topic', ''), {
    original: 'Raw topic',
    bigQuestion: 'Raw topic',
    plainTranslation: '',
    keywords: [],
  });
});

test('normalizeDiagnosisFrame returns undefined for empty input and normalizes doctors defensively', () => {
  assert.equal(normalizeDiagnosisFrame({ symptomTitle: '', symptoms: [], framing: '', doctors: [] }), undefined);
  assert.equal(normalizeDiagnosisFrame(null), undefined);

  assert.deepEqual(normalizeDiagnosisFrame({
    symptomTitle: 404,
    symptoms: ['confusion', 3, false, null],
    framing: true,
    doctors: [
      { voiceId: 'voice-a', diagnosis: 1, prescription: false },
      'fallback doctor',
    ],
  }), {
    symptomTitle: '404',
    symptoms: ['confusion', '3', 'false'],
    framing: 'true',
    doctors: [
      { voiceId: 'voice-a', diagnosis: '1', prescription: 'false' },
      { voiceId: 'voice-2', diagnosis: '', prescription: '' },
    ],
  });
});
