import { describe, expect, it } from 'vitest';
import {
  applyDocPlaceholders,
  buildPrefixTsQuery,
  checkRequiredSections,
  diffStats,
  diffText,
  docToPlainText,
  extractSnippet,
  listDocSections,
  markdownToDoc,
  normalizeSearchText,
  searchTokens,
} from './document-content';

describe('busca do GED', () => {
  it('normaliza acentos, caixa e espaços', () => {
    expect(normalizeSearchText('  Procedimento  de SEGURANÇA\tAção ')).toBe('procedimento de seguranca acao');
  });

  it('gera termos higienizados e consulta por prefixo', () => {
    expect(searchTokens("Higienização: mãos & EPI's (POP-001)")).toEqual(['higienizacao', 'maos', 'epi', 'pop', '001']);
    expect(buildPrefixTsQuery('Higienização das mãos')).toBe('higienizacao:* & das:* & maos:*');
    expect(buildPrefixTsQuery('  !! ')).toBeNull();
  });

  it('extrai o trecho preservando o texto original', () => {
    const text = 'Antes de iniciar, faça a higienização das mãos com sabão neutro por 40 segundos.';
    expect(extractSnippet(text, 'higienizacao', 10)).toBe('… r, faça a higienização das mãos …');
    expect(extractSnippet(text, 'inexistente')).toBeNull();
  });
});

describe('conteúdo estruturado', () => {
  const markdown = [
    '# 1. Objetivo',
    '',
    'Padronizar a **limpeza** da linha.',
    '',
    '# 2. Responsabilidades',
    '',
    '| Função | Responsabilidade |',
    '|---|---|',
    '| Operador | Executa |',
    '',
    '- Item A',
    '- Item B',
    '',
    '1. Passo um',
    '2. Passo dois',
    '---',
  ].join('\n');

  it('converte o markdown dos modelos em documento', () => {
    const doc = markdownToDoc(markdown);
    expect(doc.type).toBe('doc');
    const types = (doc.content ?? []).map((node) => node.type);
    expect(types).toEqual(['heading', 'paragraph', 'heading', 'table', 'bulletList', 'orderedList', 'horizontalRule']);
    const bold = doc.content?.[1].content?.find((node) => node.marks?.some((mark) => mark.type === 'bold'));
    expect(bold?.text).toBe('limpeza');
    const table = doc.content?.[3];
    expect(table?.content?.[0].content?.[0].type).toBe('tableHeader');
    expect(table?.content?.[1].content?.[0].type).toBe('tableCell');
  });

  it('gera texto plano legível', () => {
    const text = docToPlainText(markdownToDoc(markdown));
    expect(text).toContain('1. Objetivo');
    expect(text).toContain('Padronizar a limpeza da linha.');
    expect(text).toContain('| Operador | Executa |');
    expect(text).toContain('- Item A');
    expect(text).toContain('2. Passo dois');
  });

  it('aplica placeholders sem tocar campos desconhecidos', () => {
    const doc = markdownToDoc('Código {{document_code}} — {{campo_livre}}');
    const applied = applyDocPlaceholders(doc, { document_code: 'POP-001' });
    expect(docToPlainText(applied)).toBe('Código POP-001 — {{campo_livre}}');
  });

  it('confere seções obrigatórias do POP', () => {
    const doc = markdownToDoc(['# 1. Objetivo', 'Texto', '# 2. Aplicação', '# 3. Responsabilidades', 'Equipe', '# 6. Descrição das Atividades', 'Passos'].join('\n'));
    expect(listDocSections(doc).map((section) => section.hasContent)).toEqual([true, false, true, true]);
    const check = checkRequiredSections(doc, 'pop');
    expect(check.missing).toEqual(['Registros']);
    expect(check.empty).toEqual(['Aplicação']);
    expect(check.ok).toBe(false);
  });
});

describe('comparação entre revisões', () => {
  it('marca palavras inseridas e removidas', () => {
    const ops = diffText('Lavar as mãos por 20 segundos.\nSecar com papel.', 'Lavar as mãos por 40 segundos.\nSecar com papel.');
    expect(ops.some((op) => op.type === 'delete' && op.text.includes('20'))).toBe(true);
    expect(ops.some((op) => op.type === 'insert' && op.text.includes('40'))).toBe(true);
    expect(ops.filter((op) => op.type === 'equal').map((op) => op.text).join('')).toContain('Secar com papel.');
    expect(diffStats(ops)).toMatchObject({ inserted: 1, deleted: 1 });
  });

  it('lida com textos vazios e iguais', () => {
    const fromEmpty = diffText('', 'Novo parágrafo');
    expect(fromEmpty.some((op) => op.type === 'insert' && op.text.includes('Novo parágrafo'))).toBe(true);
    expect(fromEmpty.some((op) => op.type === 'delete' && op.text.trim())).toBe(false);
    expect(diffText('Igual', 'Igual')).toEqual([{ type: 'equal', text: 'Igual\n' }]);
  });
});
