'use strict';
// Inventário estático: não acessa banco, credenciais nem serviços externos.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const scope = JSON.parse(fs.readFileSync(path.join(root, 'packages/shared/src/product-scope.json'), 'utf8'));
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(dir + '/' + entry.name) : [dir + '/' + entry.name]);
const blocked = (route, prefixes) => prefixes.some(prefix => route === prefix || route.startsWith(prefix + '/'));
const decorators = node => ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
const callName = decorator => ts.isCallExpression(decorator.expression) ? decorator.expression.expression.getText() : decorator.expression.getText();
const args = decorator => ts.isCallExpression(decorator.expression) ? decorator.expression.arguments : [];
const literal = node => node && ts.isStringLiteralLike(node) ? node.text : '';
const safe = text => text.replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
const modules = fs.readdirSync(path.join(root, 'apps/api/src/modules'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
const routes = [];
for (const file of walk('apps/api/src/modules').filter(file => file.endsWith('.controller.ts'))) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  for (const item of source.statements.filter(ts.isClassDeclaration)) {
    const classDecorators = decorators(item);
    const controller = classDecorators.find(item => callName(item) === 'Controller');
    if (!controller) continue;
    const prefix = literal(args(controller)[0]);
    for (const member of item.members.filter(ts.isMethodDeclaration)) {
      const metadata = decorators(member);
      const route = metadata.find(item => ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head'].includes(callName(item)));
      if (!route) continue;
      const endpoint = '/' + [prefix, literal(args(route)[0])].filter(Boolean).join('/');
      const permission = [...metadata, ...classDecorators].find(item => callName(item) === 'RequirePermissions');
      const publicRoute = [...metadata, ...classDecorators].some(item => callName(item) === 'Public');
      routes.push({ module: file.split('/')[4], file, line: source.getLineAndCharacterOfPosition(member.getStart()).line + 1, method: callName(route).toUpperCase(), endpoint, permissions: permission ? args(permission).map(item => item.getText(source)).join(', ') : publicRoute ? 'Pública; conferir autenticação específica' : 'JWT/guardas de classe; conferir fonte', parked: blocked(endpoint, scope.parkedApiRoutes) });
    }
  }
}
const pages = walk('apps/web/app').filter(file => /\/page\.tsx$/.test(file)).map(file => {
  const route = '/' + file.replace('apps/web/app/', '').replace(/\/page\.tsx$/, '').split('/').filter(part => !part.startsWith('(')).join('/');
  return { route: route === '/page.tsx' ? '/' : route, file, parked: blocked(route, scope.parkedWebRoutes) };
}).sort((a, b) => a.route.localeCompare(b.route));
const schema = fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8');
const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map(match => match[1]);
const migrations = fs.readdirSync(path.join(root, 'apps/api/prisma/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
let out = '# Inventário extraído do código\n\nReferência: 16/11/2026, árvore local da implementação SIPOC/BPMN/RACI. Gerado por `node scripts/generate-functional-inventory.cjs`.\n\n';
out += `Foram encontrados **${modules.length} diretórios de módulos**, **${routes.length} operações HTTP decoradas**, **${pages.length} páginas**, **${models.length} modelos Prisma** e **${migrations} migrations**. Contagens descrevem fonte, não recursos licenciados ou publicados.\n\n`;
out += 'A coluna Suspensa compara o caminho com `product-scope.json`. Além disso, dependem de carregamento do módulo, licença, PortalGate, JWT, permissões, escopo de área e estado do registro. Prefixos/decoradores calculados exigem consulta ao arquivo. APIs internas de infraestrutura podem continuar carregadas em módulos parcialmente suspensos. Não é uma prova de que cada endpoint foi testado.\n\n';
out += '## API por módulo\n\nTodos os caminhos recebem `/api` no servidor. Permissões múltiplas do decorator usam OR; as verificações específicas dos serviços continuam aplicáveis.\n\n';
for (const module of modules) {
  const items = routes.filter(route => route.module === module);
  out += `### ${module}\n\nFonte: [diretório](../apps/api/src/modules/${module}). ${items.length} operações encontradas.\n\n`;
  if (!items.length) { out += 'Serviços/infraestrutura sem controller HTTP direto neste diretório.\n\n'; continue; }
  out += '| Método | Caminho | Permissão declarada | Suspensa por caminho | Fonte |\n|---|---|---|---|---|\n';
  for (const item of items) out += `| ${item.method} | \`${item.endpoint}\` | ${safe(item.permissions)} | ${item.parked ? 'Sim' : 'Não'} | [controller](../${item.file}#L${item.line}) |\n`;
  out += '\n';
}
out += '## Páginas do frontend\n\n| Rota | Suspensa por caminho | Arquivo |\n|---|---|---|\n';
for (const item of pages) out += `| \`${item.route}\` | ${item.parked ? 'Sim' : 'Não'} | [page](../${item.file}) |\n`;
out += '\n## Entidades persistidas\n\nOs nomes abaixo estão no schema. Campos, FKs, índices e enums são a fonte de verdade em [schema.prisma](../apps/api/prisma/schema.prisma).\n\n' + models.map(name => '`' + name + '`').join(', ') + '.\n';
fs.writeFileSync(path.join(root, 'docs/INVENTARIO_ROTAS_CODIGO.md'), out);
console.log(JSON.stringify({ modules: modules.length, operations: routes.length, pages: pages.length, models: models.length, migrations }));
