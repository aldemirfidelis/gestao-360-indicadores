export const FACE_DESCRIPTOR_SIZE = 128;
export const DEFAULT_FACE_THRESHOLD = 0.48;

export function validateDescriptor(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_SIZE) throw new Error('Descritor facial inválido.');
  const descriptor = value.map(Number);
  if (descriptor.some((item) => !Number.isFinite(item) || Math.abs(item) > 10)) throw new Error('Descritor facial inválido.');
  const norm = Math.sqrt(descriptor.reduce((sum, item) => sum + item * item, 0));
  if (norm < 0.1) throw new Error('Descritor facial inválido.');
  return descriptor.map((item) => item / norm);
}

export function meanDescriptor(samples: unknown[]): number[] {
  if (!Array.isArray(samples) || samples.length < 3 || samples.length > 5) throw new Error('Capture de 3 a 5 amostras faciais.');
  const normalized = samples.map(validateDescriptor);
  for (let i = 1; i < normalized.length; i++) {
    if (euclideanDistance(normalized[0], normalized[i]) > 0.58) throw new Error('As amostras não parecem pertencer à mesma pessoa.');
  }
  return validateDescriptor(Array.from({ length: FACE_DESCRIPTOR_SIZE }, (_, index) => (
    normalized.reduce((sum, sample) => sum + sample[index], 0) / normalized.length
  )));
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== FACE_DESCRIPTOR_SIZE || b.length !== FACE_DESCRIPTOR_SIZE) return Number.POSITIVE_INFINITY;
  return Math.sqrt(a.reduce((sum, item, index) => sum + (item - b[index]) ** 2, 0));
}

