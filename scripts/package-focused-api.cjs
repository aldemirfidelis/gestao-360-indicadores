// Copia apenas arquivos compilados alcançáveis pelo boot e pelo seed dedicado.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../apps/api');
const source = path.join(root, 'dist');
const destination = path.join(root, 'dist-active');
const seen = new Set();
const { isProductModuleActive, PRODUCT_SCOPE } = require('../packages/shared/dist');
function visit(file) {
  if (seen.has(file)) return;
  if (!fs.existsSync(file)) throw new Error('Dependência compilada ausente: ' + file);
  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    // O loader de módulos em espera só executa estas dependências se reativados.
    if (file.endsWith('parked-product-modules.js') && (
      (match[1].startsWith('./modules/documents/') && !isProductModuleActive('documents')) ||
      (match[1].startsWith('./modules/automations/') && !isProductModuleActive('automations'))
    )) continue;
    // Encaminhamento opcional explicitamente protegido pelo escopo do produto.
    if (file.endsWith('traceability.service.js') && match[1].startsWith('../automations/') && !isProductModuleActive('automations')) continue;
    let dep = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(dep) || fs.statSync(dep).isDirectory()) dep += '.js';
    visit(dep);
  }
}
visit(path.join(source, 'src/main.js'));
// Entradas dinâmicas também entram no pacote quando reativadas no registro.
for (const [code, folder] of PRODUCT_SCOPE.backendModules) {
  if (isProductModuleActive(code)) visit(path.join(source, `src/modules/${folder}/${folder}.module.js`));
}
visit(path.join(source, 'prisma/seed-focused-demo.js'));
if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true });
for (const file of seen) {
  const target = path.join(destination, path.relative(source, file));
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(file, target);
  if (fs.existsSync(file + '.map')) fs.copyFileSync(file + '.map', target + '.map');
}
console.log(`API: ${seen.size} arquivos compilados incluídos no pacote ativo.`);
