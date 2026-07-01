# Política Geral de Proteção de Dados Pessoais

> **MINUTA — requer validação jurídica e aprovação da Diretoria antes de publicar.**
> Versão 0.1 · Elaborada em 2026-07-01 · Base legal: Lei nº 13.709/2018 (LGPD)
> Documento vinculado à [Política de Segurança da Informação e Privacidade](./politica-seguranca-informacao-privacidade.md).

## 1. Objetivo

Definir como a organização e a plataforma **Gestão 360** tratam dados pessoais, em conformidade
com a LGPD, garantindo os direitos dos titulares e a segurança das operações de tratamento.

## 2. Definições (Art. 5º da LGPD)

- **Dado pessoal:** informação relacionada a pessoa natural identificada ou identificável.
- **Dado pessoal sensível:** origem racial/étnica, convicção religiosa, opinião política, saúde,
  vida sexual, dado genético ou biométrico.
- **Titular:** pessoa a quem os dados se referem.
- **Controlador:** quem decide sobre o tratamento.
- **Operador:** quem trata dados em nome do controlador.
- **Encarregado (DPO):** canal de comunicação entre controlador, titulares e ANPD.

## 3. Papéis (controlador × operador)

A organização pode atuar como **controladora** dos dados de seus colaboradores e clientes.
Em ambientes corporativos hospedados no Gestão 360, a **organização cliente é a controladora** e o
**Gestão 360 atua como operador**, tratando os dados conforme as instruções contratuais.

## 4. Bases legais (Art. 7º e 11)

Todo tratamento deve apoiar-se em ao menos uma base legal, tais como: cumprimento de obrigação
legal/regulatória, execução de contrato, legítimo interesse, consentimento, exercício regular de
direitos, proteção da vida ou tutela da saúde. Dados sensíveis exigem base específica do Art. 11.

## 5. Princípios (Art. 6º)

Finalidade, adequação, necessidade (minimização), livre acesso, qualidade dos dados,
transparência, segurança, prevenção, não discriminação, responsabilização e prestação de contas.

## 6. Ciclo de vida e minimização

Coletar apenas o necessário à finalidade declarada; limitar o acesso; definir prazos de retenção;
eliminar ou anonimizar quando a finalidade se exaure. A plataforma dispõe de **regras de retenção**
para documentos e formulários (`DocumentRetentionRule`, `FormRetentionPolicy`).

## 7. Direitos dos titulares (Art. 18)

Confirmação e acesso, correção, anonimização/bloqueio/eliminação, portabilidade, informação sobre
compartilhamento, revogação de consentimento e revisão de decisões automatizadas. Os pedidos são
recebidos pelo canal de privacidade (ver página pública **/lgpd** e contato do Encarregado) e
respondidos nos prazos legais.

## 8. Registro das Operações de Tratamento (RoPA — Art. 37)

A organização mantém **Registro das Operações de Tratamento** contendo, por operação: finalidade,
base legal, categorias de titulares e de dados, compartilhamentos/suboperadores, prazo de retenção
e medidas de segurança. *(A plataforma passará a oferecer um módulo de RoPA — ver `docs/lgpd/README.md`.)*

## 9. Compartilhamento e transferência internacional (Art. 33)

Compartilhamentos são mapeados no RoPA. **Há transferência internacional de dados**, pois a
infraestrutura utiliza a **DigitalOcean (fora do Brasil)**; tais transferências devem estar
amparadas por instrumento adequado (ex.: cláusulas-padrão/DPA do provedor) — **confirmar a região
do datacenter e a formalização do DPA**.

## 10. Segurança e incidentes

Aplicam-se os controles técnicos descritos na Política de SI. Incidentes envolvendo dados pessoais
seguem o [Plano de Resposta a Incidentes](./plano-resposta-incidentes.md), incluindo avaliação de
risco e eventual comunicação à **ANPD** e aos titulares (Art. 48).

## 11. Encarregado (DPO)

A organização nomeia formalmente um **Encarregado** e divulga seu contato (ver página **/lgpd**).
Compete a ele receber comunicações de titulares e da ANPD, orientar e prestar contas.

## 12. Relatório de Impacto (RIPD/DPIA)

Elaborado quando o tratamento puder gerar alto risco aos titulares (ex.: dados sensíveis em larga
escala, decisões automatizadas, monitoramento sistemático).

## 13. Revisão

Revisão mínima **anual** ou diante de mudança legal/regulatória, novo tratamento ou incidente relevante.

---
*Aprovação:* _____________________ (Diretoria) — Data: ___/___/______
