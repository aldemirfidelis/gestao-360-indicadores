import { describe, expect, it } from 'vitest';
import { PINO_REDACT_PATHS, redactDeep } from './redact';

describe('redactDeep - biometric payloads', () => {
  it('removes kiosk tokens, facial descriptors and challenge secrets at any depth', () => {
    const sentinels = [
      'device-token-must-never-be-stored',
      'descriptor-must-never-be-stored',
      'nonce-must-never-be-stored',
      'challenge-secret-must-never-be-stored',
      'liveness-proof-must-never-be-stored',
    ];
    const payload = {
      ordinaryField: 'preserve-this-value',
      deviceToken: sentinels[0],
      nested: {
        descriptors: [[sentinels[1]]],
        nonce_hash: sentinels[2],
        challenge: { secret: sentinels[3] },
      },
      attempts: [{ faceEmbedding: sentinels[1] }, { liveness_proof: sentinels[4] }],
      biometric_payload: { vector: sentinels[1] },
    };

    const redacted = redactDeep(payload) as Record<string, any>;
    const serialized = JSON.stringify(redacted);

    for (const secret of sentinels) expect(serialized).not.toContain(secret);
    expect(redacted.ordinaryField).toBe('preserve-this-value');
    expect(redacted.deviceToken).toBe('[redacted]');
    expect(redacted.nested.descriptors).toBe('[redacted]');
    expect(redacted.nested.nonce_hash).toBe('[redacted]');
    expect(redacted.nested.challenge).toBe('[redacted]');
    expect(redacted.attempts[0].faceEmbedding).toBe('[redacted]');
    expect(redacted.attempts[1].liveness_proof).toBe('[redacted]');
    expect(redacted.biometric_payload).toBe('[redacted]');
  });

  it('covers the known biometric fields in the pino defense-in-depth paths', () => {
    for (const field of ['deviceToken', 'descriptor', 'descriptors', 'nonce', 'challengeId', 'livenessProof']) {
      expect(PINO_REDACT_PATHS).toContain(field);
      expect(PINO_REDACT_PATHS).toContain(`*.${field}`);
      expect(PINO_REDACT_PATHS).toContain(`req.body.${field}`);
    }
  });
});
