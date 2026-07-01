# Plano de Resposta a Incidentes de Segurança e de Dados Pessoais

> **MINUTA — requer validação jurídica e aprovação da Diretoria antes de publicar.**
> Versão 0.1 · Elaborada em 2026-07-01 · Base: LGPD Art. 48 e boas práticas (NIST IR / ISO 27035)

## 1. Objetivo

Definir o processo de detecção, contenção, erradicação, recuperação e comunicação de incidentes de
segurança da informação e de **incidentes envolvendo dados pessoais**, minimizando impactos e
cumprindo o dever de comunicação à **ANPD** e aos titulares.

## 2. Abrangência

Todos os sistemas, dados e infraestrutura da organização e da plataforma **Gestão 360**.

## 3. Definição de incidente

Evento que compromete a confidencialidade, integridade ou disponibilidade da informação. Exemplos:
acesso não autorizado, vazamento/exfiltração de dados, ransomware, indisponibilidade relevante,
perda de dispositivo com dados, phishing bem-sucedido, exposição indevida de credenciais.

## 4. Classificação de severidade

| Nível | Critério | Exemplo |
|---|---|---|
| **Crítico** | Dados pessoais sensíveis ou grande volume expostos; indisponibilidade total | Vazamento de base com CPF |
| **Alto** | Dados pessoais expostos em menor escala; comprometimento de sistema | Conta administrativa invadida |
| **Médio** | Risco contido, sem exposição confirmada de dados pessoais | Tentativa de invasão bloqueada |
| **Baixo** | Evento sem impacto a dados | Varredura de porta, spam |

## 5. Papéis e responsabilidades

- **Coordenador de Incidente (TI/Segurança):** conduz a resposta técnica.
- **Encarregado (DPO):** avalia impacto a titulares e decide sobre comunicação à ANPD.
- **Jurídico:** avalia obrigações legais/contratuais.
- **Diretoria:** decisões de negócio e comunicação institucional.
- **Comunicação:** mensagens externas, quando aplicável.

## 6. Fluxo de resposta

1. **Detecção e registro** — origem: monitoramento, logs (`AuditLog`, logs estruturados), alerta de
   usuário ou de terceiro. Registrar data/hora, quem detectou e evidências.
2. **Triagem e classificação** — atribuir severidade (seção 4) e acionar os papéis.
3. **Contenção** — isolar sistemas afetados, revogar credenciais, bloquear acessos, preservar
   evidências (não destruir logs).
4. **Erradicação** — remover a causa (vulnerabilidade, malware, acesso indevido).
5. **Recuperação** — restaurar a partir de backup íntegro; validar integridade; monitorar reincidência.
6. **Avaliação de risco a titulares** — o DPO avalia se há risco/dano relevante aos titulares.
7. **Comunicação (Art. 48)** — havendo risco relevante, **comunicar à ANPD e aos titulares em prazo
   razoável**, informando: natureza dos dados, titulares envolvidos, medidas técnicas adotadas,
   riscos e medidas de mitigação. Manter registro da decisão (inclusive quando se decide **não** comunicar).
8. **Encerramento e lições aprendidas** — relatório pós-incidente, ações corretivas e atualização de controles.

## 7. Prazos

- **Contenção inicial:** imediata (até 24h da detecção para incidentes Críticos/Altos).
- **Comunicação à ANPD/titulares:** em **prazo razoável** conforme orientação vigente da ANPD.

## 8. Registro de incidentes

Manter registro central de todos os incidentes (data, severidade, dados afetados, ações,
decisão de comunicação, responsável). *(A plataforma passará a oferecer registro de incidentes de
dados pessoais — ver `docs/lgpd/README.md`.)*

## 9. Contatos de emergência

| Papel | Nome | Contato |
|---|---|---|
| Coordenador de Incidente (TI) | _a definir_ | _a definir_ |
| Encarregado (DPO) | _a definir_ | _a definir_ |
| Jurídico | _a definir_ | _a definir_ |
| ANPD | — | https://www.gov.br/anpd |

## 10. Testes e revisão

Simulação (tabletop) **anual** e revisão do plano após cada incidente relevante.

---
*Aprovação:* _____________________ (Diretoria) — Data: ___/___/______
