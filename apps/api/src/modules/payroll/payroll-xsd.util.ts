/**
 * Validação de XML de evento eSocial contra os XSDs OFICIAIS.
 *
 * Os XSDs oficiais NÃO são distribuídos com o software (são baixados do portal
 * do eSocial pela empresa). O operador aponta a pasta com os .xsd na env
 * `PAYROLL_ESOCIAL_XSD_DIR` e mapeia o arquivo principal por tipo de evento.
 * Sem a pasta configurada, a validação é PULADA (sinalizada), nunca fingida.
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { validateXML } from 'xmllint-wasm';

/** Nome do XSD principal por tipo de evento, sob PAYROLL_ESOCIAL_XSD_DIR. */
const XSD_FILE_ENV_PREFIX = 'PAYROLL_ESOCIAL_XSD_';

export interface XsdValidationResult {
  validated: boolean; // false = pulada (sem XSD configurado)
  valid: boolean;
  errors: string[];
}

function xsdDir(): string | null {
  const dir = process.env.PAYROLL_ESOCIAL_XSD_DIR;
  return dir && dir.trim() ? dir.trim() : null;
}

/** Arquivo XSD principal do tipo (env específica ou convenção <TIPO>.xsd). */
function mainXsdFileFor(eventType: string): string {
  const envKey = `${XSD_FILE_ENV_PREFIX}${eventType.replace(/-/g, '_')}`;
  return process.env[envKey] || `${eventType}.xsd`;
}

/**
 * Valida um XML contra o XSD do tipo de evento. Carrega todos os .xsd da pasta
 * como preload (os leiautes do eSocial têm imports entre si).
 */
export async function validateEsocialXsd(xml: string, eventType: string): Promise<XsdValidationResult> {
  const dir = xsdDir();
  if (!dir) return { validated: false, valid: true, errors: [] };

  let files: string[];
  try {
    files = (await readdir(dir)).filter((file) => file.toLowerCase().endsWith('.xsd'));
  } catch {
    return { validated: false, valid: true, errors: [`Pasta de XSD não acessível: ${dir}`] };
  }
  const mainFile = mainXsdFileFor(eventType);
  if (!files.includes(mainFile)) {
    return { validated: false, valid: true, errors: [`XSD principal ausente para ${eventType} (esperado ${mainFile} em ${dir}).`] };
  }

  const preload = await Promise.all(
    files.map(async (file) => ({ fileName: file, contents: await readFile(join(dir, file), 'utf8') })),
  );
  const mainContents = preload.find((entry) => entry.fileName === mainFile)!.contents;

  try {
    const result = await validateXML({
      xml: [{ fileName: 'evento.xml', contents: xml }],
      schema: [mainContents],
      preload,
    } as Parameters<typeof validateXML>[0]);
    const errors = (result.errors ?? []).map((error) => (typeof error === 'string' ? error : error.message));
    return { validated: true, valid: result.valid, errors };
  } catch (error) {
    return { validated: true, valid: false, errors: [`Falha ao validar XSD: ${(error as Error).message}`] };
  }
}

/** Validação síncrona de disponibilidade (para status/telas). */
export function xsdConfigured(): boolean {
  return xsdDir() !== null;
}
