// scripts/build.mjs — inline CSS + modules ES (réécrits en IIFE) → dist/ccti.html (spec § 7.3).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MODULES = ['src/patterns.js', 'src/pricing.js', 'src/analyzer.js', 'src/profile.js', 'src/i18n/fr.js', 'src/i18n/en.js',
  'src/i18n.js', 'src/card.js', 'src/files.js', 'src/demo.js', 'src/render.js', 'src/worker-factory.js', 'src/main.js'];
const WORKER_MODULES = ['src/patterns.js', 'src/pricing.js', 'src/analyzer.js', 'src/worker-core.js', 'src/worker.js'];

const modName = (p) => '__m_' + p.replace(/^src\//, '').replace(/\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_');
const resolveRel = (file, from) => path.posix.normalize(path.posix.join(path.posix.dirname(file), from));

function wrap(file, src) {
  const names = [];
  let body = src;
  body = body.replace(/^export default /m, () => { names.push('default'); return 'const __default = '; });
  body = body.replace(/^export (const|let|function|class|async function) (\w+)/gm, (_, kw, name) => { names.push(name); return `${kw} ${name}`; });
  body = body.replace(/^import (\w+) from '([^']+)';?/gm, (_, name, from) => `const ${name} = ${modName(resolveRel(file, from))}.default;`);
  body = body.replace(/^import \{([^}]+)\} from '([^']+)';?/gm, (_, list, from) => {
    const ids = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${ids.join(', ')} } = ${modName(resolveRel(file, from))};`;
  });
  body = body.replace(/function createModuleWorker\(\) \{\n[\s\S]*?\n\}/, "function createModuleWorker() { throw new Error('bundled: no module worker'); }");
  if (/\bimport\.meta\b/.test(body)) throw new Error(`${file}: import.meta interdit dans le bundle`);
  const ret = names.map((n) => (n === 'default' ? 'default: __default' : n)).join(', ');
  return `const ${modName(file)} = (() => {\n${body}\nreturn { ${ret} };\n})();\n`;
}
async function bundle(list) { let out = ''; for (const f of list) out += wrap(f, await readFile(f, 'utf8')); return out; }
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const workerSrc = safe(await bundle(WORKER_MODULES));
const mainSrc = safe(await bundle(MODULES));
const css = await readFile('src/styles.css', 'utf8');
let html = await readFile('index.html', 'utf8');
// Remplacement par fonction : avec une chaîne, `$\`` et `$$` dans le code inliné seraient interprétés par String.replace.
html = html.replace('<link rel="stylesheet" href="src/styles.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script>\nglobalThis.CCTI_WORKER_SRC = ${JSON.stringify(workerSrc)};\n${mainSrc}\n</script>`);
if (html.includes('src="src/main.js"') || html.includes('href="src/styles.css"')) throw new Error('inline incomplet');
await mkdir('dist', { recursive: true });
await writeFile('dist/ccti.html', html);
console.log(`dist/ccti.html : ${(html.length / 1024).toFixed(0)} Ko`);
