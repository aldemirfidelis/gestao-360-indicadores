const fs = require('node:fs');
const path = require('node:path');

function copyPortableTree(source, destination) {
  // Sem verbatimSymlinks, cpSync transforma links relativos em caminhos
  // absolutos da pasta temporaria, que deixam de existir no runtime Docker.
  fs.cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
}

function assertPortableLinks(root) {
  const absoluteRoot = path.resolve(root);
  let links = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(file);
        const resolved = path.resolve(directory, target);
        if (path.isAbsolute(target) || !resolved.startsWith(absoluteRoot + path.sep) || !fs.existsSync(resolved)) {
          throw new Error('Link de runtime nao portavel: ' + path.relative(absoluteRoot, file));
        }
        links++;
      } else if (entry.isDirectory()) walk(file);
    }
  }
  walk(absoluteRoot);
  return links;
}

module.exports = { copyPortableTree, assertPortableLinks };
