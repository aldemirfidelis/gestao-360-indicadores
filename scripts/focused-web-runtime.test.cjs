const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { copyPortableTree, assertPortableLinks } = require('./focused-web-runtime.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-runtime-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('copia preserva links relativos e funciona apos remover a origem', t => {
  const root = fixture(t), source = path.join(root, 'temporary'), output = path.join(root, 'runtime');
  fs.mkdirSync(path.join(source, 'modules'), { recursive: true });
  fs.writeFileSync(path.join(source, 'modules/dependency.js'), 'module.exports = 360;');
  fs.symlinkSync('./modules/dependency.js', path.join(source, 'entry.js'));
  copyPortableTree(source, output);
  fs.rmSync(source, { recursive: true });
  assert.equal(assertPortableLinks(output), 1);
  assert.equal(fs.readlinkSync(path.join(output, 'entry.js')), './modules/dependency.js');
  assert.equal(require(path.join(output, 'entry.js')), 360);
});
test('rejeita dependencia absoluta da pasta temporaria', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'dependency.js'), '');
  fs.symlinkSync(path.join(root, 'dependency.js'), path.join(root, 'entry.js'));
  assert.throws(() => assertPortableLinks(root), /nao portavel/);
});
test('rejeita dependencia fora do pacote e link quebrado', t => {
  const root = fixture(t), output = path.join(root, 'runtime');
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(root, 'external.js'), '');
  fs.symlinkSync('../external.js', path.join(output, 'entry.js'));
  assert.throws(() => assertPortableLinks(output), /nao portavel/);
  fs.unlinkSync(path.join(output, 'entry.js'));
  fs.symlinkSync('./missing.js', path.join(output, 'entry.js'));
  assert.throws(() => assertPortableLinks(output), /nao portavel/);
});
