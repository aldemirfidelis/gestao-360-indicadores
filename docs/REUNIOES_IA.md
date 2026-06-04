# Reunioes e IA - FASE 5

Nota tecnica da primeira entrega da FASE 5. O recorte escolhido foi a lacuna
citada no fluxo principal: resumo/minuta de ata por IA em reunioes.

## Objetivo

Adicionar uma forma segura de gerar uma minuta revisavel da ata de reuniao,
usando o contexto real ja registrado no sistema:

- indicador tratado;
- desvio/tratativa;
- analise de causa;
- pauta;
- participantes internos e externos;
- decisoes;
- planos e tarefas vinculadas.

A minuta nao e salva automaticamente. Ela aparece como rascunho editavel na
tela, para revisao humana antes de envio ou registro oficial.

## Backend

### Endpoint

```text
POST /meetings/:id/ai/minutes
```

Permissao usada:

```text
meetings:update
```

Motivo: a minuta extrai dados sensiveis da reuniao. Quem nao pode editar a
reuniao tambem nao deve conseguir gerar uma ata via IA.

### Provedor

O endpoint reaproveita `GeminiService`, ja exportado por `AiModule`.

- Com `GEMINI_API_KEY`: tenta gerar JSON estruturado via Gemini.
- Sem `GEMINI_API_KEY` ou em erro: usa fallback deterministico local.

Nao ha nova migration.

### Saida

```ts
{
  provider: 'gemini' | 'deterministic';
  generatedAt: string;
  summary: string;
  minutes: string;
  decisions: string[];
  actionItems: Array<{
    description: string;
    owner: string | null;
    dueDate: string | null;
    priority: string | null;
    source: string;
  }>;
  risks: string[];
  nextSteps: string[];
  markdown: string;
}
```

## Frontend

Em `/meetings/[id]`, a coluna direita ganhou o card **Minuta por IA** para
usuarios com `meetings:update`.

Fluxo:

1. Usuario clica em "Gerar minuta".
2. Backend monta contexto da reuniao e chama Gemini ou fallback local.
3. O rascunho aparece em textarea editavel.
4. Usuario pode copiar a minuta.
5. Nada e persistido automaticamente.

## Seguranca

O metodo reutiliza `getById`, que ja aplica:

- isolamento por `companyId`;
- bloqueio por area quando a reuniao deriva de indicador/desvio;
- fallback para reunioes gerais sem area.

Depois disso, o metodo chama `assertWriteArea(..., 'edit')`, mantendo a mesma
regra de edicao das reunioes.

## Testes

Cobertura em `apps/api/src/modules/meetings/meetings.service.spec.ts`:

- fallback deterministico sem Gemini;
- enforcement de escrita na area antes da geracao;
- uso de Gemini quando disponivel;
- normalizacao da resposta para o formato da UI.

Comando focado:

```bash
pnpm --filter @g360/api exec vitest run src/modules/meetings
```
