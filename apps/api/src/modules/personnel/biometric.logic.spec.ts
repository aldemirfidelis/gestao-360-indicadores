import { describe, expect, it } from 'vitest';
import { euclideanDistance, meanDescriptor, validateDescriptor, validateLiveness } from './biometric.logic';

const sample = (offset = 0) => Array.from({ length: 128 }, (_, index) => ((index % 9) + 1) / 100 + offset);

describe('biometric logic', () => {
  it('normaliza e consolida três amostras', () => {
    const descriptor = meanDescriptor([sample(), sample(0.001), sample(-0.001)]);
    expect(descriptor).toHaveLength(128);
    expect(Math.sqrt(descriptor.reduce((sum, item) => sum + item * item, 0))).toBeCloseTo(1, 5);
  });

  it('rejeita descritor malformado', () => {
    expect(() => validateDescriptor([1, 2])).toThrow();
    expect(() => validateDescriptor(Array(128).fill(0))).toThrow();
  });

  it('calcula distância e valida prova de vivacidade', () => {
    const a = validateDescriptor(sample());
    expect(euclideanDistance(a, a)).toBeCloseTo(0);
    expect(validateLiveness({ action: 'BLINK', passed: true, durationMs: 1200, frames: 8 }, 'BLINK')).toBe(true);
    expect(validateLiveness({ action: 'TURN_LEFT', passed: true, durationMs: 1200, frames: 8 }, 'BLINK')).toBe(false);
  });
});
