# Política Geral de Segurança da Informação e Privacidade

> **MINUTA — requer validação jurídica e aprovação da Diretoria antes de publicar.**
> Versão 0.1 · Elaborada em 2026-07-01 · Responsável pela revisão: Encarregado (DPO) / TI
> Documento vinculado à [Política de Proteção de Dados Pessoais](./politica-protecao-dados-pessoais.md)
> e ao [Plano de Resposta a Incidentes](./plano-resposta-incidentes.md).

## 1. Objetivo

Estabelecer as diretrizes de Segurança da Informação (SI) e privacidade aplicáveis a todos os
ativos de informação da organização e à plataforma **Gestão 360**, assegurando a
**confidencialidade, integridade e disponibilidade** dos dados e o cumprimento da Lei nº 13.709/2018 (LGPD).

## 2. Abrangência

Aplica-se a todos os colaboradores, estagiários, prestadores de serviço, fornecedores e
terceiros com acesso a informações, sistemas ou infraestrutura da organização, em qualquer meio
(eletrônico, físico ou verbal).

## 3. Princípios

- **Menor privilégio:** acesso concedido estritamente conforme a necessidade da função.
- **Necessidade de conhecer:** informação disponível apenas a quem dela precisa.
- **Defesa em profundidade:** múltiplas camadas de controle (rede, aplicação, dados, pessoas).
- **Privacidade desde a concepção (privacy by design/default):** proteção de dados considerada
  em todo projeto e mudança.
- **Responsabilização e prestação de contas (accountability):** controles documentados e auditáveis.

## 4. Classificação da informação

| Nível | Descrição | Exemplos |
|---|---|---|
| Público | Divulgação livre | Material de marketing, site institucional |
| Interno | Uso interno | Procedimentos, comunicados |
| Confidencial | Acesso restrito | Indicadores estratégicos, contratos |
| Dados pessoais / sensíveis | Protegidos pela LGPD | CPF, dados de RH, saúde, biometria |

## 5. Controles técnicos vigentes na plataforma Gestão 360

Os controles abaixo **já implementados** sustentam esta política (ver `docs/SEGURANCA.md` e
`docs/SECURITY-AUDIT.md`):

- **Criptografia em trânsito:** TLS/HTTPS em todo o tráfego (proxy Caddy), cabeçalho HSTS e
  conexão ao banco com `sslmode=require`.
- **Criptografia em repouso:** banco gerenciado (DigitalOcean Managed PostgreSQL) cifrado pelo
  provedor; **credenciais de integração cifradas com AES-256-GCM** na aplicação.
- **Controle de acesso:** autenticação por JWT e **autorização RBAC granular por permissão**, com
  isolamento entre empresas (multitenancy).
- **Proteção de perímetro:** firewall (UFW) e `fail2ban` no servidor; SSH apenas por chave.
- **Registro e auditoria:** logging estruturado com identificador de requisição, trilha de
  auditoria (`AuditLog`) e logs de visualização/download de documentos, com **redação automática
  de dados sensíveis** (senha, token, CPF, CNPJ, RG, PIX, cartão) nos logs.
- **Backup e continuidade:** backups lógicos por operação e backups automáticos/PITR do banco
  gerenciado.

## 6. Responsabilidades

- **Diretoria:** aprovar a política e prover recursos.
- **TI/Segurança:** operar e monitorar os controles; tratar vulnerabilidades.
- **Encarregado (DPO):** zelar pela conformidade LGPD e ser canal com titulares e a ANPD.
- **Gestores:** garantir a aderência de suas equipes.
- **Colaboradores:** cumprir a política, proteger credenciais e reportar incidentes.

## 7. Gestão de acessos

Concessão, revisão periódica e revogação imediata no desligamento. Senhas seguem política de
complexidade; contas administrativas exigem justificativa e são auditadas.

## 8. Uso aceitável

É vedado: compartilhar credenciais; instalar software não autorizado; extrair dados pessoais sem
base legal; contornar controles de segurança. O uso dos ativos pode ser monitorado nos limites
legais.

## 9. Gestão de incidentes

Todo evento suspeito deve ser reportado imediatamente conforme o
[Plano de Resposta a Incidentes](./plano-resposta-incidentes.md).

## 10. Gestão de terceiros e suboperadores

Fornecedores com acesso a dados pessoais devem firmar cláusulas de proteção de dados. A relação
de suboperadores (ex.: provedor de nuvem, e-mail, IA) é mantida em registro próprio e revisada
periodicamente.

## 11. Sanções

O descumprimento sujeita o infrator a medidas disciplinares e contratuais cabíveis, sem prejuízo
das responsabilidades civis e penais.

## 12. Revisão

Revisão mínima **anual** ou quando houver mudança relevante de legislação, tecnologia ou processo.

---
*Aprovação:* _____________________ (Diretoria) — Data: ___/___/______
