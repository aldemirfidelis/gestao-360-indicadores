# Análise técnica — Serviço Pessoal, Ponto e Biometria Facial

Data: 2026-07-13

## Resumo executivo

O módulo já possui prontuário 360°, dependentes, dossiê, admissões e
desligamentos, férias, afastamentos, ASO, escalas, batida com geolocalização,
espelho, ajustes aprovados, banco de horas, importação REP, fechamento e
relatórios. Esta entrega adiciona ao PWA Android um fluxo de cadastro e
verificação facial sem persistência de fotografias.

O sistema não deve ser divulgado como REP-P plenamente certificado apenas por
ter hash encadeado. A conformidade integral com a Portaria MTP 671 ainda exige
itens fiscais, documentais, certificação do produto e validação jurídica.

## Arquitetura facial implementada

- PWA Android existente, sem a manutenção paralela de um APK.
- Câmera frontal por `getUserMedia`, disponível em HTTPS.
- Inferência no aparelho com detector leve, 68 pontos e descritor facial de 128
  posições. Fotos e frames não são enviados à API.
- Cadastro com três amostras coerentes e template normalizado.
- Template cifrado em repouso com AES-256-GCM e tabela segregada.
- Vivacidade ativa aleatória: piscar ou virar o rosto.
- Desafio com nonce, validade de dois minutos e uso único.
- Comparação no servidor, limiar controlado e bloqueio após cinco falhas.
- Auditoria sem registrar descritor, foto ou frame.
- Batida ligada à tentativa facial, geolocalização, IP, dispositivo e hash.
- Revogação pelo titular e alternativa de ponto convencional.

## Pontos fortes encontrados

1. Separação adequada entre colaborador, perfil de DP e usuário.
2. Escopo multitenant nas consultas principais.
3. RBAC separado para ponto, equipe, gestão e serviço pessoal.
4. Marcações imutáveis no fluxo normal e ajustes separados.
5. Competência fechada bloqueia marcações e ajustes.
6. Lógica de espelho isolada e testada.
7. Integração com Meu Dia e auditoria central.
8. PWA, HTTPS, geolocalização e experiência mobile existentes.

## P0 — antes de declarar conformidade REP-P

- Implementar NSR monotônico por estabelecimento.
- Cadastrar empregador, CNPJ/CPF, estabelecimento e local de prestação.
- Gerar comprovante PDF após cada marcação com os campos da Portaria 671 e
  assinatura PAdES ICP-Brasil.
- Disponibilizar comprovantes ao trabalhador e exportação AFD/AEJ com assinatura
  CAdES destacada.
- Formalizar registro/certificação, termo técnico e sincronismo com a Hora Legal
  Brasileira.
- Fazer revisão trabalhista independente antes do uso como sistema oficial.

## P0 — biometria e LGPD

- Elaborar RIPD específico antes da ativação geral.
- O DPO/jurídico deve validar a hipótese do art. 11. Consentimento em relação de
  emprego pode não ser livre em todos os contextos.
- Definir retenção e eliminação automática após desligamento.
- Documentar controles de acesso e resposta a incidentes.
- Medir falso aceite e falsa rejeição com população e aparelhos
  representativos.
- Em alto risco, usar SDK com certificação PAD. Câmera RGB comum não elimina
  todos os ataques de apresentação.

## P1 — robustez do ponto

- Serializar batidas concorrentes do mesmo usuário no banco.
- Configurar fuso IANA por empresa/estabelecimento, em vez de offset global.
- Parametrizar geofence, precisão mínima e exceção para trabalho externo.
- Restringir espelho de equipe pela hierarquia/área do gestor.
- Substituir corpos `any` dos controllers por schemas Zod.
- Aplicar rate limit dedicado aos endpoints biométricos.
- Criar painel antifraude de falhas, aparelhos e localização anômala.

## P1 — Serviço Pessoal

- Cifrar CPF, PIS, CTPS, endereço e CID, com busca por hash quando necessária.
- Aplicar mascaramento e escopo por área no prontuário.
- Criar retenção por tipo documental e desligamento.
- Integrar alertas de experiência, ASO, férias e documentos ao scheduler.
- Completar eventos eSocial por conector homologado e reconciliável.

## P2 — experiência e operação

- Para totem Android com identificação 1:N, adotar motor dedicado. A entrega
  atual faz verificação 1:1 do usuário autenticado, mais segura e privada.
- Implementar fila offline assinada para marcação excepcional.
- Parametrizar escalas alternadas, feriados, DSR e adicional noturno.
- Criar dashboard de SLA, absenteísmo, extras e banco a vencer.
- Executar E2E real em Android/Chrome e aparelhos de baixo desempenho.

## Critérios de ativação

1. RIPD e hipótese legal aprovados pelo DPO/jurídico.
2. Aviso aos colaboradores e canal de direitos ativo.
3. Piloto voluntário com alternativa convencional sem prejuízo.
4. Limiar calibrado com taxas de erro medidas.
5. Pentest de replay, alteração de descriptor, foto, vídeo e automação.
6. Monitoramento e processo humano para desbloqueio/contestação.
7. Conformidade REP-P validada separadamente da biometria.
