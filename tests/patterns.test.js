// tests/patterns.test.js
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText, isCaps, matchesAny, INTERRUPTED, INTERRUPTED_FOR_TOOL, SLASH_COMMAND,
  CLAUDE_AGREED, ABSOLUTELY_RIGHT, CLAUDE_APOLOGIZED, HUMAN_NO, HUMAN_SWEAR,
  HUMAN_THANKS, HUMAN_DOUBLE_MARKS, TOOL_DENIED, AUTO_MODE_BLOCK, DANGER,
} from '../src/patterns.js';

const cases = [
  ['CLAUDE_AGREED', CLAUDE_AGREED,
    ["You're absolutely right, let me fix that.", 'You are correct.', 'Good catch!', 'Great question.', 'Vous avez tout à fait raison.', "Tu as raison, je corrige.", 'Bien vu.', 'Bonne remarque, voici le plan.', "C'est exact.", 'Effectivement, c\'est mieux.'],
    ['The right panel is empty.', 'Copyright notice', 'La raison sociale est SFR.', 'Je vois une bonne pratique ici.', 'Exactement 3 fichiers (en milieu de phrase)']],
  ['CLAUDE_APOLOGIZED', CLAUDE_APOLOGIZED,
    ['Sorry, my mistake.', 'I apologize for the confusion.', 'Désolé pour l\'attente.', 'Au temps pour moi.', 'Mon erreur : le chemin était faux.'],
    ['The sorrow of young Werther', 'pardonner is a verb', 'erreur 404 renvoyée']],
  ['HUMAN_NO', HUMAN_NO,
    ['Non. Utilise plutôt ceci', 'No, that\'s wrong', 'stop', 'Attends, je t\'ai déjà dit de ne pas faire ça', 'ce n\'est pas ce que j\'ai demandé'],
    ['nombre de lignes', 'Note: ok', 'Nothing to do here', "I'll wait for you"]],
  ['HUMAN_SWEAR', HUMAN_SWEAR, ['putain, non !!', 'wtf', 'c\'est de la merde', 'what the fuck'], ['shitake mushrooms', 'merdeuse (mot différent)', 'damnation']],
  ['HUMAN_THANKS', HUMAN_THANKS, ['Merci, parfait !', 'thanks', 'bravo', 'ok nickel', 'well done'], ['top 10 des erreurs', 'super-user', 'perfectionnisme', 'merciless']],
  ['HUMAN_DOUBLE_MARKS', HUMAN_DOUBLE_MARKS, ['non !!', 'quoi ??'], ['non !', 'quoi ?']],
];
for (const [name, list, pos, neg] of cases) {
  test(`${name} positifs`, () => { for (const p of pos) assert.ok(matchesAny(list, p), `devrait matcher: ${p}`); });
  test(`${name} négatifs`, () => { for (const n of neg) assert.ok(!matchesAny(list, n), `ne devrait pas matcher: ${n}`); });
}

test('ABSOLUTELY_RIGHT', () => {
  assert.ok(ABSOLUTELY_RIGHT.test("You're absolutely right."));
  assert.ok(!ABSOLUTELY_RIGHT.test("You're right."));
});

test('cleanText retire balises, collages et blocs de code', () => {
  const t = 'Regarde ça : <pasted_content id="1">' + 'x'.repeat(1000) + '</pasted_content> et dis-moi';
  assert.equal(cleanText(t), 'Regarde ça :  et dis-moi');
  assert.equal(cleanText('<system-reminder>bla</system-reminder>'), '');
  assert.equal(cleanText('<local-command-stdout>Set model</local-command-stdout>'), '');
  assert.equal(cleanText('Non. Utilise plutôt ceci :\n\x60\x60\x60js\nconst a = 1;\n\x60\x60\x60'), 'Non. Utilise plutôt ceci :'); // \x60 = backtick
  assert.equal(cleanText('<command-name>/clear</command-name><command-message>clear</command-message><command-args></command-args>'), '');
  assert.equal(cleanText(null), '');
});

test('isCaps', () => {
  assert.ok(isCaps('WHAT ARE YOU DOING'));
  assert.ok(!isCaps('OK'));
  assert.ok(!isCaps('What are you doing'));
  assert.ok(!isCaps('ARRÊTE'));           // 6 lettres mais longueur 6 < 8
  assert.ok(isCaps('ARRÊTE ÇA TOUT DE SUITE'));
  assert.ok(!isCaps('1234 5678 90'));     // moins de 4 lettres
});

test('marqueurs Claude Code exacts', () => {
  assert.ok(INTERRUPTED.test('[Request interrupted by user]'));
  assert.ok(INTERRUPTED.test('[Request interrupted by user for tool use]'));
  assert.ok(INTERRUPTED_FOR_TOOL.test('[Request interrupted by user for tool use]'));
  assert.ok(!INTERRUPTED_FOR_TOOL.test('[Request interrupted by user]'));
  assert.equal(SLASH_COMMAND.exec('<command-name>/clear</command-name>\n<command-message>clear</command-message>')[1], '/clear');
  assert.ok(TOOL_DENIED.test("The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file)."));
  assert.ok(!TOOL_DENIED.test('1 # The PR was rejected by the reviewer'));
  assert.ok(AUTO_MODE_BLOCK.test('Permission to use Bash with command sudo rm -rf / was denied by the Claude Code auto mode classifier. Reason: destructive'));
  assert.ok(!AUTO_MODE_BLOCK.test('<tool_use_error>File is in a directory that is denied by your permission settings.</tool_use_error>'));
});

test('DANGER', () => {
  assert.ok(DANGER.rmRf.test('rm -rf build && git push --force origin main'));
  assert.ok(DANGER.rmRf.test('sudo rm -Rf /tmp/x'));
  assert.ok(DANGER.rmRf.test('rm -fr node_modules'));
  assert.ok(!DANGER.rmRf.test('rm -r build'));
  assert.ok(!DANGER.rmRf.test('npm run format'));
  assert.ok(DANGER.forcePush.test('git push --force origin main'));
  assert.ok(DANGER.forcePush.test('git push -f'));
  assert.ok(DANGER.forcePush.test('git push --force-with-lease'));
  assert.ok(!DANGER.forcePush.test('git push origin main'));
  assert.ok(DANGER.resetHard.test('git reset --hard HEAD~1'));
  assert.ok(DANGER.sudo.test('sudo apt install x'));
  assert.ok(!DANGER.sudo.test('pseudo-code'));
  assert.ok(DANGER.gitCommits.test('git commit -m "x"'));
  assert.ok(!DANGER.gitCommits.test('git log'));
});
