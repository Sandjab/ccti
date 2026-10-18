// scripts/lib/bundle.mjs — réécrit un module ES en IIFE pour le fichier autonome (spec § 7.3 ;
// spec .zst § 2). Partagé par scripts/build.mjs et les tests.
import path from 'node:path';

export const modName = (p) => '__m_' + p.replace(/^src\//, '').replace(/\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_');
const resolveRel = (file, from) => path.posix.normalize(path.posix.join(path.posix.dirname(file), from));

export function wrap(file, src) {
  const names = [];
  let body = src;
  body = body.replace(/^export default /m, () => { names.push('default'); return 'const __default = '; });
  body = body.replace(/^export (const|let|var|function|class|async function) (\w+)/gm, (_, kw, name) => { names.push(name); return `${kw} ${name}`; });
  // `export { A, B };` (fzstd) : la ligne disparaît, les noms sont exportés.
  body = body.replace(/^export \{([^}]+)\};?[ \t]*$/gm, (_, list) => { names.push(...list.split(',').map((s) => s.trim()).filter(Boolean)); return ''; });
  body = body.replace(/^import (\w+) from '([^']+)';?/gm, (_, name, from) => `const ${name} = ${modName(resolveRel(file, from))}.default;`);
  body = body.replace(/^import \{([^}]+)\} from '([^']+)';?/gm, (_, list, from) => {
    const ids = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${ids.join(', ')} } = ${modName(resolveRel(file, from))};`;
  });
  body = body.replace(/function createModuleWorker\(\) \{\n[\s\S]*?\n\}/, "function createModuleWorker() { throw new Error('bundled: no module worker'); }");
  // Garde-fou : un export non réécrit casserait le script classique du fichier autonome.
  if (/^export\b/m.test(body) || names.some((n) => !/^\w+$/.test(n))) throw new Error(`${file} : forme d'export non prise en charge`);
  if (/\bimport\.meta\b/.test(body)) throw new Error(`${file}: import.meta interdit dans le bundle`);
  const ret = names.map((n) => (n === 'default' ? 'default: __default' : n)).join(', ');
  return `const ${modName(file)} = (() => {\n${body}\nreturn { ${ret} };\n})();\n`;
}
