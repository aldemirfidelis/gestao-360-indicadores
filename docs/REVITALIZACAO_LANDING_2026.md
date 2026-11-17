# Revitalização da apresentação pública — Gestão 360

## Diagnóstico e fonte de verdade

Auditoria iniciada em 17/11/2026 (UTC), após o GED publicado em `49eab3a`.
Escopo: frontend público Next.js/React/Tailwind; API NestJS/Prisma/Postgres;
pacote compartilhado, catálogo do portal, módulos, permissões, páginas,
formulários, demonstração, identidade e SEO. Sem alteração nas regras do produto,
na autenticação, nos planos ou no banco. Alterações locais alheias preservadas.

A disponibilidade é determinada por `packages/shared/src/product-scope.json`,
`product-scope.ts`, `apps/api/src/app.module.ts`, `parked-product-modules.ts`,
guards de produto/plano e `scripts/package-focused-api.cjs`. Documentação antiga
descreve um escopo maior e não prevalece sobre o código ativo.

Problemas encontrados: home anuncia quatro frentes antigas e Gestão de Prêmio
suspensa; Processos, Projetos e GED ausentes; menu desaparece abaixo de 1536 px
sem substituto móvel; textos de demonstração contradizem o login direto;
canonical padrão usa domínio com acento; Open Graph anuncia 14 módulos;
JSON-LD apresenta software como gratuito e inclui frentes indisponíveis;
links de artigos apontam soluções fora do catálogo; navegação e cores públicas
inconsistentes; formulários usam React Actions com captura de erro, podendo
resetar campos mesmo quando o envio falha.

## Inventário funcional validado

| Frente | Situação real | Evidência e decisão comercial |
| --- | --- | --- |
| Meu Dia e Tarefas | Disponíveis conforme permissão | `my-day`, `tasks`; quadros, listas, calendário, cronograma, comentários/checklists e prioridades. Apresentar. |
| Gestão à Vista | Disponível | Strategy/BSC, OKRs, indicadores, desvios, planos, reuniões e resultados. Apresentar vínculos e exemplos. |
| Processos | Disponível | `processes`, governança, SIPOC, BPMN, RACI, responsabilidades, versões, vínculos e PMO. Destaque próprio. |
| Projetos | Disponível | `projects.controller.ts`: tarefas, marcos, equipe, custos, riscos, atualizações; Gantt, Curva S e snapshots de progresso. Não prometer aceite formal de entregáveis sem comprovação. |
| Análise e melhoria | Disponível | `analysis-workspace.tsx`: Ishikawa, 5 Porquês, 5W2H e PDCA; evidências e eficácia em ações. **Pareto saiu da interface em novembro e não será anunciado.** |
| Documentos / GED | Disponível | Editor visual, revisões, fluxo assinado, PDF, leitura, busca e auditoria; `documents.module.ts`. Assinatura interna, não certificado ICP-Brasil. |
| Administração | Disponível | Usuários, perfis/áreas, períodos, relatórios, histórico e governança. Motor geral de automações está suspenso. |
| Central de Atendimento | Suporte à plataforma disponível | `SupportTicketsModule`, `/central-atendimento`, ajuda e suporte. Não apresentar como CRM ou central de atendimento de clientes externos. |
| IA assistida | Condicional à configuração/permissão | `GeminiService`, `AssistantService`, atas e GED; provedores e alternativas determinísticas. Validação humana; não anunciar predição nem agentes autônomos. Demo não oferece IA. |
| Auditorias, riscos corporativos, NCs e formulários | Código implementado, módulos suspensos | `parkedModuleCodes`; não anunciar como oferta disponível. Riscos de projetos são um recurso distinto, ativo. |
| Segurança dos Alimentos / Patrimonial | Código implementado, suspenso | `food-safety`, `asset-security`; não promover recall, portaria ou biometria como disponíveis. |
| Cargos e Salários / Recrutamento | Código implementado, suspenso | `compensation`, `recruitment`; fora da oferta atual. |
| Serviço Pessoal / Ponto / Folha | Código implementado, suspenso | `personnel`, `payroll`; fora da oferta atual. |
| Suprimentos / Comunicação / Prêmio | Código implementado, suspenso | `procurement`, `inventory`, `communication`, `prize`; fora da oferta atual. |
| Beta, experimental e planejado | Sem oferta pública confirmada | Não inferir roadmap pela presença de tabelas, TODOs ou protótipos. Não anunciar disponibilidade futura. |

## Conversão e limites preservados

- `DemoLink` usa `AuthProvider.loginDemo()` e `POST /auth/demo`; acesso direto,
  dados fictícios, consulta, sessão limitada. Preservar guard, rotas e escopo.
- Trial público é **solicitação de 30 dias**, confirmado no DTO, formulário e
  termos. Não é cadastro automático. O catálogo interno possui planos com
  outros prazos; não mudá-los nem prometer 30 dias universais a qualquer plano.
- `ContactForm` → `/contato/enviar` → `POST /public/contact`: gravação no inbox
  primeiro, notificação por e-mail best-effort. Honeypot, consentimento,
  rastreamento e canais de suporte permanecem. Testes com destinatário sintético;
  nenhuma mensagem comercial real deve ser enviada durante a validação.
- Não inventar clientes, logos de clientes, métricas de adoção/ROI, depoimentos,
  certificações ou integrações. Dados visuais expressamente demonstrativos.

## Direção e implementação

Posicionamento: conectar estratégia, processos, indicadores e execução com
contexto, responsáveis e evidências. Públicos: direção, operação, qualidade e
gestão de projetos. Jornada comercial: entender → ver o produto → explorar a
demonstração → solicitar avaliação ou conversar com a equipe.

Identidade: logo oficial, marinho `#081023`/`#0f2042`, ciano institucional,
branco e neutros; Inter já instalada, hierarquia editorial, respiro e gráficos
com finalidade. Poucos efeitos, nenhuma dependência nova pesada. Interações
por teclado e toque, animação respeitando movimento reduzido.

Home: hero com produto autêntico; jornada conectada interativa; SIPOC/BPMN/RACI;
análise de causa e execução; projetos; catálogo progressivo dos módulos ativos;
apoio assistido por IA com condições explícitas; benefícios, FAQ e CTAs funcionais.
Navegação, páginas de soluções/módulos/recursos e metadados devem compartilhar
o mesmo catálogo atualizado. Rotas legais, suporte, login e conversão preservadas.

## Validação e entrega

Implementação iniciada pelo Codex e concluída pelo Claude Code em 17/11/2026,
com publicação autorizada explicitamente pelo usuário ("depois que terminar
tudo faça commit, push e deploy").

- Arquivos: home (`app/page.tsx`), navegação pública nova
  (`public-navigation.tsx`, menu de celular com retorno de foco), experiência do
  produto (`product-experience.tsx`: jornada em nove etapas, SIPOC/BPMN/RACI,
  Ishikawa/5 Porquês/5W2H/PDCA e módulos por grupo), estilos próprios
  (`public-site.css`), catálogo comercial único (`lib/marketing-catalog.ts`) usado
  por home, menus, soluções, segmentos, módulos, recursos, metadados e
  `llms.txt`; páginas de contato, conteúdos, guias, segurança, suporte,
  implantação, sobre, demonstração e trial revisadas. Imagens em
  `public/marketing/` (painel real com dados fictícios, 83 KB, e imagem social).
- Formulário: sem React Actions; envio com bloqueio de duplicidade, campos
  preservados em caso de falha, mensagens de sucesso/erro, honeypot,
  consentimento e "Trial de 30 dias" no mesmo fluxo `/contato/enviar` →
  `POST /public/contact`.
- Testes: catálogo (`marketing-catalog.test.ts`: nenhum módulo suspenso e nenhum
  link sem destino); web completo 120/120; lint e `tsc` das páginas públicas sem
  erros; build de produção da Web (Next) aprovado na cópia de ensaio.
- Navegador (Chromium, bundle de produção local com API sintética): 1440, 1024,
  768, 390 e 360 px sem rolagem horizontal; nove etapas da jornada, quatro grupos
  de módulos e quatro ferramentas de análise; e2e `public-marketing.spec.ts`
  4/4 (teclado, menu de celular, falha/repetição do formulário e falha da
  demonstração). Ponte de conversão com backend sintético: oito verificações
  e zero e-mails ou contatos reais.
- Correções finais: 19 tons de texto pequeno das telas ilustrativas escurecidos
  para contraste ≥ 4,6:1 (a auditoria apontava 2,8–4,5:1); ícones decorativos
  marcados com `aria-hidden` (o leitor de tela anunciava ícones como imagens e o
  e2e tinha seletor ambíguo).
- Evidências temporárias em `test-results/landing-revitalization/` (ignorado).
- Publicado em 17/11/2026: commit `850cf3b`, versão `0.1.0+850cf3bc`, sem
  migration. No site publicado (chamadas de API, formulário e demonstração
  interceptados no navegador): e2e 4/4, 5.848 textos sem falha de contraste,
  sem rolagem horizontal de 360 a 1440 px, sem erros de JavaScript e os 37
  endereços do sitemap com HTTP 200. Detalhes em `docs/CODEX_MEMORIA_OPERACIONAL.md`.
