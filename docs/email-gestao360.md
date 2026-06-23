# E-mail do Gestão 360 (contato@gestao360.org)

Este documento explica as duas camadas do e-mail da plataforma e como provisionar a
caixa real **contato@gestao360.org**.

## 1. O que já está pronto no produto (camada de aplicação)

No **Portal Administrativo Global** (`/platform-admin`) → menu **Técnico → E-mail** o Super
Admin configura, sem mexer em código:

- **Servidor SMTP**: host, porta, TLS, usuário, senha (cifrada em AES-256-GCM), remetente
  padrão (From), nome de exibição e Reply-To. Botão **Testar envio**.
- **Remetentes do sistema**: cadastro de endereços remetentes (ex.: `contato@gestao360.org`,
  `nao-responda@gestao360.org`) com um marcado como **padrão** (★).

O envio real (convites de reunião e notificações) passou a ler essa configuração do banco,
com **fallback** para as variáveis de ambiente `SMTP_*` (compatibilidade com o que já existia).

> A senha **nunca** volta ao frontend — a tela mostra apenas um marcador `••••••`. Para
> trocar, digite a nova senha; para manter, deixe o campo como está.

### Persistência
- Tabelas `PortalEmailSetting` e `PortalMailbox` (migration `20260622193000_portal_email_config`).
- Chave de cifra: `INTEGRATIONS_SECRET` (ou, na ausência, derivada de `JWT_ACCESS_SECRET`).

## 2. Provisionar a caixa real (camada de infraestrutura)

A tela acima faz o sistema **enviar** como `contato@gestao360.org`. Para a caixa também
**receber** mensagens e permitir login, é preciso uma caixa de e-mail de verdade — isso
depende de provedor + DNS, **não** de código.

### Opção A — Provedor gerenciado (recomendado)
Mais simples e confiável (entregabilidade, antispam, DKIM automático):

- **Zoho Mail** (tem plano gratuito para domínio próprio) ou **Google Workspace** / **Microsoft 365**.
1. Criar conta no provedor e adicionar o domínio `gestao360.org`.
2. Provar a posse do domínio (registro TXT fornecido pelo provedor).
3. Criar a caixa `contato@gestao360.org` (e outras, ex.: `nao-responda@`).
4. Publicar os registros DNS indicados pelo provedor:
   - **MX** → servidores de entrada do provedor (ex.: `mx.zoho.com`, prioridade 10).
   - **SPF (TXT)** → ex.: `v=spf1 include:zoho.com ~all` (ou `include:_spf.google.com`).
   - **DKIM (TXT/CNAME)** → chave fornecida pelo provedor (assinatura das mensagens).
   - **DMARC (TXT)** em `_dmarc.gestao360.org` → ex.: `v=DMARC1; p=quarantine; rua=mailto:contato@gestao360.org`.
5. No Portal Global → E-mail, preencher o SMTP **do provedor**:
   - Zoho: `smtp.zoho.com`, porta `465` (TLS) ou `587`, usuário `contato@gestao360.org` + senha de app.
   - Google: `smtp.gmail.com`, porta `465`/`587`, usuário + **senha de app** (com 2FA).
6. Cadastrar `contato@gestao360.org` como remetente padrão e clicar **Testar envio**.

### Opção B — Servidor de e-mail no próprio droplet (avançado)
Mais trabalhoso e sensível a bloqueios de entregabilidade. Só se houver necessidade real:

1. Instalar **mailcow** (Docker) ou **Postfix + Dovecot** no droplet.
2. Garantir **PTR (DNS reverso)** do IP `159.89.91.222` apontando para `mail.gestao360.org`
   (configurável no painel da DigitalOcean) — sem PTR, a entrega cai em spam.
3. Publicar **MX**, **SPF**, **DKIM** e **DMARC** como acima, apontando para o próprio servidor.
4. Abrir as portas 25/465/587/993 no firewall (UFW) e instalar TLS (Let's Encrypt).
5. Criar a caixa `contato@gestao360.org` e usar esse SMTP no Portal Global.

> A porta 25 de saída costuma ser bloqueada por padrão na DigitalOcean; é preciso solicitar
> liberação ao suporte. Por isso a **Opção A** é a recomendada.

## 3. Checklist rápido
- [ ] Domínio `gestao360.org` adicionado no provedor e verificado
- [ ] Caixa `contato@gestao360.org` criada
- [ ] DNS: MX, SPF, DKIM, DMARC publicados e propagados
- [ ] SMTP do provedor preenchido no Portal Global → E-mail
- [ ] `contato@gestao360.org` definido como remetente padrão
- [ ] **Testar envio** retornou sucesso
