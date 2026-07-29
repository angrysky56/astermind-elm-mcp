import { UniversalEncoder } from '@astermind/astermind-elm';
import { describe, expect, it } from 'vitest';
import { encodeText } from '../src/text-features.js';

describe('text feature preprocessing', () => {
  it('uses the normalized representation expected by ELM text prediction', () => {
    const encoder = new UniversalEncoder({ maxLen: 30, mode: 'char' });

    const vector = encodeText(encoder, 'two letters');
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    expect(magnitude).toBeCloseTo(1, 12);
  });
});
