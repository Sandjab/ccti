// tests/meta.test.js — aperçus de lien : sans ces balises, LinkedIn, X, Slack et Discord affichent le lien sans image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const SITE = 'https://sandjab.github.io/freudiff/';
const html = readFileSync('index.html', 'utf8');
const meta = (attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`))?.[1];

test('Open Graph et Twitter : titre, description, URL et grande image', () => {
  for (const key of ['og:title', 'og:description', 'og:image:alt']) assert.ok(meta('property', key), `${key} manquant`);
  assert.equal(meta('property', 'og:type'), 'website');
  assert.equal(meta('property', 'og:url'), SITE);
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
});

test("l'image d'aperçu est en URL absolue, existe et est déployée par la CI", () => {
  const image = meta('property', 'og:image');
  // Les robots des réseaux ne résolvent pas les URL relatives.
  assert.ok(image?.startsWith(SITE), `og:image doit commencer par ${SITE}`);
  const file = image.slice(SITE.length);
  assert.ok(existsSync(file), `${file} absent du dépôt`);
  assert.match(readFileSync('.github/workflows/ci.yml', 'utf8'), new RegExp(`cp [^\\n]*${file}`), `${file} non copié dans _site`);
});
