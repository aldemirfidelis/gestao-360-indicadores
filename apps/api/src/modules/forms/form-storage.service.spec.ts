import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FormStorageService } from './form-storage.service';

// PNG 1x1 real, para exercitar o caminho de gravação de verdade.
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('FormStorageService.savePhoto', () => {
  let dir: string;
  let service: FormStorageService;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'g360-forms-'));
    process.env.FORM_STORAGE_PATH = dir;
    service = new FormStorageService();
  });

  afterAll(async () => {
    delete process.env.FORM_STORAGE_PATH;
    await rm(dir, { recursive: true, force: true });
  });

  it('grava a foto e devolve chave, tamanho e hash', async () => {
    const saved = await service.savePhoto('empresa-1', { contentBase64: PNG_1x1, mimeType: 'image/png' });
    expect(saved.storageKey).toMatch(/^empresa-1\/\d{4}-\d{2}\/[0-9a-f-]+\.png$/);
    expect(saved.sizeBytes).toBeGreaterThan(0);
    expect(saved.hashSha256).toHaveLength(64);
    expect(saved.mimeType).toBe('image/png');
  });

  it('o que foi gravado é o que volta na leitura', async () => {
    const saved = await service.savePhoto('empresa-1', { contentBase64: PNG_1x1, mimeType: 'image/png' });
    const lido = await service.readPhoto(saved.storageKey);
    expect(lido).toEqual(Buffer.from(PNG_1x1, 'base64'));
  });

  it('aceita data URL, como vem do canvas do navegador', async () => {
    const saved = await service.savePhoto('empresa-1', {
      contentBase64: `data:image/png;base64,${PNG_1x1}`,
      mimeType: 'image/png',
    });
    expect(saved.sizeBytes).toBe(Buffer.from(PNG_1x1, 'base64').length);
  });

  it('isola por empresa e por mês na chave', async () => {
    const a = await service.savePhoto('empresa-a', { contentBase64: PNG_1x1, mimeType: 'image/png' });
    const b = await service.savePhoto('empresa-b', { contentBase64: PNG_1x1, mimeType: 'image/png' });
    expect(a.storageKey.startsWith('empresa-a/')).toBe(true);
    expect(b.storageKey.startsWith('empresa-b/')).toBe(true);
  });

  it('recusa formato que não é imagem', async () => {
    await expect(service.savePhoto('empresa-1', { contentBase64: PNG_1x1, mimeType: 'application/pdf' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recusa imagem vazia', async () => {
    await expect(service.savePhoto('empresa-1', { contentBase64: '', mimeType: 'image/png' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('recusa acima do limite de 6 MB', async () => {
    const grande = Buffer.alloc(7 * 1024 * 1024).toString('base64');
    await expect(service.savePhoto('empresa-1', { contentBase64: grande, mimeType: 'image/jpeg' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('chave com ../ não lê fora da pasta', async () => {
    await expect(service.readPhoto('../../etc/passwd')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chave inexistente vira 404, não estouro', async () => {
    await expect(service.readPhoto('empresa-1/2026-07/nao-existe.png')).rejects.toBeInstanceOf(NotFoundException);
  });
});
