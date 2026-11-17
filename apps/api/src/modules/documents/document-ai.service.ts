import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocumentConfidentiality } from '@prisma/client';
import { checkRequiredSections, diffStats, diffText, markdownToDoc, type DocNode } from '@g360/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { GeminiService } from '../ai/gemini.service';

function lines(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cell(value: string | null | undefined) {
  return (value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim() || '—';
}

function snapshotName(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const value = snapshot as Record<string, unknown>;
  return String(value.name ?? value.label ?? value.title ?? '').trim() || null;
}

/**
 * IA do GED (usa o serviço de IA da plataforma). Todas as funções têm saída
 * determinística quando a IA não está configurada, e documentos confidenciais
 * nunca são enviados ao provedor de IA.
 */
@Injectable()
export class DocumentAiService {
  private readonly logger = new Logger(DocumentAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  private async ask(prompt: string, maxOutputTokens = 2048): Promise<string | null> {
    try {
      const answer = await this.gemini.generateText(prompt, { temperature: 0.2, maxOutputTokens });
      return answer?.trim() || null;
    } catch (error) {
      this.logger.warn(`IA indisponível para o GED: ${(error as Error).message}`);
      return null;
    }
  }

  private assertAiAllowed(doc: { confidentiality?: string | null }) {
    if (doc.confidentiality === DocumentConfidentiality.CONFIDENTIAL) {
      throw new ForbiddenException('Documentos confidenciais não são enviados para a IA.');
    }
  }

  /** Rascunho de POP/IT a partir do processo mapeado (SIPOC, atividades, RACI). */
  async draftFromProcess(me: AuthPayload, body: any) {
    const processId = String(body?.processId ?? '').trim();
    if (!processId) throw new BadRequestException('Escolha o processo.');
    const kind = String(body?.sigla ?? 'POP').toUpperCase() === 'IT' ? 'IT' : 'POP';
    const process = await this.prisma.process.findFirst({
      where: { id: processId, companyId: me.companyId, deletedAt: null },
      include: {
        owner: { select: { name: true } },
        orgNode: { select: { name: true } },
        steps: { orderBy: { order: 'asc' } },
        activities: { where: { active: true }, orderBy: { elementId: 'asc' }, include: { owner: { select: { name: true } }, orgNode: { select: { name: true } } } },
        artifacts: { include: { raciRows: { orderBy: { position: 'asc' }, include: { assignments: true, activity: { select: { name: true } }, processStep: { select: { name: true } } } } } },
      },
    });
    if (!process) throw new NotFoundException('Processo não encontrado.');

    const activities = process.activities.length
      ? process.activities.map((activity) => ({
          name: activity.name,
          description: activity.description,
          responsible: activity.owner?.name ?? activity.orgNode?.name ?? null,
          minutes: activity.expectedMinutes,
          systems: activity.systems,
        }))
      : process.steps.map((step) => ({ name: step.name, description: step.description, responsible: step.responsible, minutes: null as number | null, systems: null as string | null }));

    const responsibilities: Array<[string, string]> = [];
    if (process.owner?.name) responsibilities.push([process.owner.name, `Dono do processo: garante a aplicação deste ${kind === 'IT' ? 'instrução' : 'procedimento'}`]);
    for (const artifact of process.artifacts) {
      for (const row of artifact.raciRows) {
        const activity = row.activity?.name ?? row.processStep?.name ?? row.name;
        for (const assignment of row.assignments) {
          const who = snapshotName(assignment.subjectSnapshot);
          if (!who) continue;
          const role = assignment.role === 'R' ? 'Executa' : assignment.role === 'A' ? 'Aprova e responde por' : assignment.role === 'C' ? 'É consultado em' : 'É informado sobre';
          responsibilities.push([who, `${role}: ${activity}`]);
        }
      }
    }
    const responsibilityRows = responsibilities.length
      ? [...new Map(responsibilities.map((row) => [`${row[0]}|${row[1]}`, row])).values()].slice(0, 40).map(([who, what]) => `| ${cell(who)} | ${cell(what)} |`)
      : ['| [Cargo/função] | [O que executa/garante] |'];

    const activityBlocks = activities.length
      ? activities.map((activity, index) =>
          [
            `## ${kind === 'IT' ? `Passo ${index + 1} - ${activity.name}` : `6.${index + 1} ${activity.name}`}`,
            '',
            activity.description?.trim() || '[Descreva o passo a passo, parâmetros, limites e critérios de aceitação.]',
            '',
            activity.responsible ? `- **Responsável:** ${activity.responsible}` : null,
            activity.minutes ? `- **Tempo previsto:** ${activity.minutes} min` : null,
            activity.systems ? `- **Sistemas:** ${activity.systems}` : null,
          ].filter((line) => line !== null).join('\n'),
        )
      : ['## 6.1 [Etapa 1]', '', '[Descreva o passo a passo.]'];

    const sipoc = [
      '| Fornecedores | Entradas | Saídas | Clientes |',
      '|---|---|---|---|',
      `| ${cell(lines(process.suppliers).join(', '))} | ${cell(lines(process.inputs).join(', '))} | ${cell(lines(process.outputs).join(', '))} | ${cell(lines(process.customers).join(', '))} |`,
    ].join('\n');

    const processRef = `${process.code ? `${process.code} - ` : ''}${process.name}`;
    const draft =
      kind === 'IT'
        ? [
            '# 1. Objetivo',
            '',
            process.objective?.trim() || `Orientar a execução padronizada das tarefas do processo ${processRef}.`,
            '',
            '# 2. Segurança',
            '',
            '- **EPIs obrigatórios:** [listar]',
            '- **Riscos da tarefa:** [listar riscos e cuidados]',
            '',
            '# 3. Materiais e Ferramentas',
            '',
            '- [Item 1]',
            '',
            '# 4. Passo a passo',
            '',
            ...activityBlocks.flatMap((block) => [block, '']),
            '# 5. Pontos de Atenção',
            '',
            '- **Nunca** [ação proibida].',
            '- **Sempre** [ação obrigatória].',
            '',
            '# 6. Em Caso de Anormalidade',
            '',
            '[Quem acionar e como registrar.]',
          ].join('\n')
        : [
            '# 1. Objetivo',
            '',
            process.objective?.trim() || `Padronizar a execução do processo ${processRef}, garantindo segurança, qualidade e repetibilidade.`,
            '',
            '# 2. Aplicação',
            '',
            `Este procedimento aplica-se ${process.orgNode?.name ? `à área ${process.orgNode.name}` : 'às áreas envolvidas no processo'} na execução do processo ${processRef}.`,
            '',
            '# 3. Documentos de Referência',
            '',
            `- Processo ${processRef} (mapeado no Gestão 360)`,
            '- [Norma ou legislação aplicável]',
            '',
            '# 4. Definições',
            '',
            '- **[Termo]:** [definição]',
            '',
            '# 5. Responsabilidades',
            '',
            '| Função / Pessoa | Responsabilidade |',
            '|---|---|',
            ...responsibilityRows,
            '',
            '# 6. Descrição das Atividades',
            '',
            ...activityBlocks.flatMap((block) => [block, '']),
            '# 7. Entradas e Saídas (SIPOC)',
            '',
            sipoc,
            '',
            '# 8. Recursos Necessários',
            '',
            '- [Equipamentos, EPIs, materiais e sistemas]',
            '',
            '# 9. Controle de Desvios',
            '',
            '[O que fazer quando o padrão não puder ser cumprido: registro, comunicação e disposição.]',
            '',
            '# 10. Registros',
            '',
            '| Registro | Onde é mantido | Retenção |',
            '|---|---|---|',
            '| [Nome do registro] | [Local/sistema] | [Prazo] |',
          ].join('\n');

    let markdown = draft;
    let usedAi = false;
    if (body?.useAi !== false) {
      const improved = await this.ask(
        [
          `Você é especialista em sistemas de gestão da qualidade (ISO 9001). Reescreva o rascunho de ${kind === 'IT' ? 'Instrução de Trabalho' : 'Procedimento Operacional Padrão (POP)'} abaixo em português do Brasil, com linguagem clara, objetiva e no imperativo para as atividades.`,
          'Regras obrigatórias:',
          '- Mantenha exatamente os mesmos títulos (#, ##) e a mesma numeração.',
          '- Mantenha as tabelas em markdown com | e a linha separadora |---|.',
          '- NÃO invente parâmetros, valores, normas, nomes de pessoas, equipamentos ou sistemas. Onde faltar informação, deixe o marcador entre colchetes, como [definir].',
          '- Responda somente com o documento em markdown, sem comentários antes ou depois.',
          '',
          'RASCUNHO:',
          draft,
        ].join('\n'),
        3000,
      );
      if (improved) {
        const cleaned = improved.replace(/^```(?:markdown)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const check = checkRequiredSections(markdownToDoc(cleaned), kind);
        if (cleaned.includes('# ') && check.missing.length === 0) {
          markdown = cleaned;
          usedAi = true;
        }
      }
    }
    return { markdown, usedAi, process: { id: process.id, name: process.name, code: process.code } };
  }

  /** Resumo do que mudou entre duas revisões (texto plano). */
  async summarizeChanges(doc: { confidentiality?: string | null; title: string }, before: string, after: string, labels: { from: string; to: string }) {
    const ops = diffText(before, after);
    const stats = diffStats(ops);
    const changes = ops
      .filter((op) => op.type !== 'equal' && op.text.trim())
      .slice(0, 60)
      .map((op) => `${op.type === 'insert' ? '+' : '-'} ${op.text.trim().slice(0, 300)}`);
    const fallback = stats.inserted + stats.deleted === 0
      ? 'Não há diferença de texto entre as revisões.'
      : `${stats.inserted} palavra(s) incluída(s) e ${stats.deleted} removida(s) entre ${labels.from} e ${labels.to}.`;
    if (!changes.length || doc.confidentiality === DocumentConfidentiality.CONFIDENTIAL) return { summary: fallback, usedAi: false, stats };
    const answer = await this.ask(
      [
        `Resuma em até 5 tópicos curtos, em português do Brasil, o que mudou no documento "${doc.title}" da ${labels.from} para a ${labels.to}, para quem precisa ler a nova revisão.`,
        'Use somente as diferenças abaixo (+ incluído, - removido). Não invente nada. Responda só com os tópicos, cada um começando com "- ".',
        '',
        changes.join('\n').slice(0, 8000),
      ].join('\n'),
      700,
    );
    return { summary: answer ?? fallback, usedAi: Boolean(answer), stats };
  }

  /** Seções obrigatórias e sugestões de redação para o tipo do documento. */
  async qualityCheck(doc: { confidentiality?: string | null; title: string }, sigla: string | null, content: DocNode, text: string) {
    const sections = checkRequiredSections(content, sigla);
    if (doc.confidentiality === DocumentConfidentiality.CONFIDENTIAL || text.trim().length < 80) {
      return { ...sections, suggestions: [] as string[], usedAi: false };
    }
    const answer = await this.ask(
      [
        `Revise o documento "${doc.title}" como auditor de sistema de gestão da qualidade.`,
        'Liste de 3 a 6 sugestões objetivas de melhoria (clareza, responsabilidades, critérios mensuráveis, termos ambíguos, registros). Não reescreva o documento.',
        'Responda só com as sugestões, uma por linha, começando com "- ".',
        '',
        text.slice(0, 12_000),
      ].join('\n'),
      700,
    );
    const suggestions = (answer ?? '')
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 3)
      .slice(0, 8);
    return { ...sections, suggestions, usedAi: Boolean(answer) };
  }

  assertAllowed(doc: { confidentiality?: string | null }) {
    this.assertAiAllowed(doc);
  }
}
