// scripts/gen-fixtures.mjs — génère tests/fixtures/projects/** : sessions JSONL
// synthétiques au format Claude Code (spec § 3). Déterministe. Aucune donnée réelle.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('tests/fixtures/projects');
let seq = 0;
const uid = () => `u-${String(++seq).padStart(5, '0')}`;
const text = (t) => ({ type: 'text', text: t });
const tool = (id, name, input) => ({ type: 'tool_use', id, name, input });

function session({ cwd, sessionId, version = '2.1.133' }) {
  const lines = [];
  const base = (type, ts, extra = {}) => ({
    parentUuid: null, isSidechain: false, userType: 'external', cwd, sessionId, version,
    gitBranch: 'main', type, uuid: uid(), ...(ts ? { timestamp: ts } : {}), ...extra,
  });
  return {
    lines,
    perm: (mode, ts) => lines.push({ type: 'permission-mode', permissionMode: mode, sessionId, ...(ts ? { timestamp: ts } : {}) }),
    user: (content, ts, extra = {}) => lines.push(base('user', ts, { message: { role: 'user', content }, ...extra })),
    toolResult: (toolUseId, content, ts, isError = false) => lines.push(base('user', ts, {
      message: { role: 'user', content: [{ tool_use_id: toolUseId, type: 'tool_result', content, ...(isError ? { is_error: true } : {}) }] },
      toolUseResult: content,
    })),
    // usage = [input, output, cacheRead, cacheWrite]
    asst: (blocks, ts, { id, model, usage, stop = 'end_turn' }) => lines.push(base('assistant', ts, {
      requestId: `req_${id}`,
      message: {
        id, role: 'assistant', ...(model ? { model } : {}), content: blocks, stop_reason: stop,
        usage: { input_tokens: usage[0], output_tokens: usage[1], cache_read_input_tokens: usage[2] || 0, cache_creation_input_tokens: usage[3] || 0, service_tier: 'standard' },
      },
    })),
    system: (subtype, ts, extra = {}) => lines.push(base('system', ts, { subtype, isMeta: true, ...extra })),
    raw: (s) => lines.push(s),
  };
}
const dump = (lines) => lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n';

const ALPHA = { slug: '-Users-test-Dev-alpha', cwd: '/Users/test/Dev/alpha' };
const BETA = { slug: '-Users-test-Dev-beta', cwd: '/Users/test/Dev/beta' };
const files = []; // { rel, content }
const add = (proj, name, s) => files.push({ rel: path.join(proj.slug, name), content: dump(s.lines) });

// s1 — FR, plan mode puis default, 3 messages humains, tour multi-lignes (m2), excuse, merci.
{
  const s = session({ cwd: ALPHA.cwd, sessionId: 'a1111111-0000-0000-0000-000000000001' });
  s.perm('plan', '2026-10-05T07:00:00Z');
  s.user('Fais un plan pour ajouter un bouton', '2026-10-05T07:00:10Z');
  s.asst([text('Bonne remarque, voici le plan.')], '2026-10-05T07:00:20Z', { id: 'm1', model: 'claude-opus-4-7', usage: [1000, 200, 5000, 100] });
  s.perm('default', '2026-10-05T07:01:00Z');
  s.user('ok vas-y', '2026-10-05T07:01:10Z');
  s.asst([tool('t1', 'Bash', { command: 'git commit -m x' })], '2026-10-05T07:01:30Z', { id: 'm2', model: 'claude-opus-4-7', usage: [2000, 300, 0, 0], stop: 'tool_use' });
  s.asst([text("C'est fait. Désolé pour l'attente.")], '2026-10-05T07:01:31Z', { id: 'm2', model: 'claude-opus-4-7', usage: [2000, 300, 0, 0], stop: 'tool_use' });
  s.toolResult('t1', '[main abc] x', '2026-10-05T07:01:32Z');
  s.user('Merci, parfait !', '2026-10-05T07:02:00Z');
  s.system('turn_duration', '2026-10-05T07:02:05Z', { durationMs: 60000, messageCount: 5 });
  add(ALPHA, 'a1111111-0000-0000-0000-000000000001.jsonl', s);
}
// s2 — session fantôme : aucun message humain, une commande slash.
{
  const s = session({ cwd: ALPHA.cwd, sessionId: 'a2222222-0000-0000-0000-000000000002' });
  s.perm('auto', '2026-10-06T08:00:00Z');
  s.user('<system-reminder>contexte</system-reminder>', '2026-10-06T08:00:01Z', { isMeta: true });
  s.user('<command-name>/clear</command-name>\n<command-message>clear</command-message>\n<command-args></command-args>', '2026-10-06T08:00:02Z');
  add(ALPHA, 'a2222222-0000-0000-0000-000000000002.jsonl', s);
}
// s3 — EN, rage-quit sur majuscules, « You're absolutely right ».
{
  const s = session({ cwd: ALPHA.cwd, sessionId: 'a3333333-0000-0000-0000-000000000003' });
  s.user('Add a test for the parser', '2026-10-07T12:00:00Z');
  s.asst([text("You're absolutely right, good catch.")], '2026-10-07T12:00:10Z', { id: 'm3', model: 'claude-sonnet-4-6', usage: [500, 100, 0, 0] });
  s.user("No, that's wrong. Not what I asked", '2026-10-07T12:00:30Z');
  s.asst([text('Sorry, my mistake.')], '2026-10-07T12:00:40Z', { id: 'm4', model: 'claude-sonnet-4-6', usage: [600, 50, 0, 0] });
  s.user('WHAT ARE YOU DOING', '2026-10-07T12:01:00Z');
  add(ALPHA, 'a3333333-0000-0000-0000-000000000003.jsonl', s);
}
// s4 — auto, AskUserQuestion répondue puis refusée, ligne corrompue, modèle inconnu, tour multi-lignes, 2 sous-agents.
{
  const sid = 'a4444444-0000-0000-0000-000000000004';
  const s = session({ cwd: ALPHA.cwd, sessionId: sid });
  s.perm('auto', '2026-10-08T15:00:00Z');
  s.user('Refactor the module and ask me if unsure', '2026-10-08T15:00:05Z');
  s.asst([tool('q1', 'AskUserQuestion', { questions: [] })], '2026-10-08T15:00:10Z', { id: 'm5', model: 'claude-fable-5', usage: [10000, 1000, 50000, 2000], stop: 'tool_use' });
  s.toolResult('q1', 'User answered: Option A', '2026-10-08T15:00:30Z');
  s.asst([tool('q2', 'AskUserQuestion', { questions: [] })], '2026-10-08T15:00:40Z', { id: 'm6', model: 'claude-fable-5', usage: [100, 10, 0, 0], stop: 'tool_use' });
  s.toolResult('q2', "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.", '2026-10-08T15:00:50Z', true);
  s.raw('{"type":"assistant","message":{"id":"m7"');
  s.asst([text('Done.')], '2026-10-08T15:01:00Z', { id: 'm8', model: 'claude-weird-9', usage: [100, 100, 0, 0], stop: 'tool_use' });
  s.asst([tool('ag1', 'Agent', { prompt: 'do it' })], '2026-10-08T15:01:01Z', { id: 'm8', model: 'claude-weird-9', usage: [100, 100, 0, 0], stop: 'tool_use' });
  s.toolResult('ag1', 'agent result', '2026-10-08T15:02:00Z');
  s.user('thanks', '2026-10-08T15:03:00Z');
  add(ALPHA, `${sid}.jsonl`, s);
  const a = session({ cwd: ALPHA.cwd, sessionId: sid, version: '2.1.137' });
  a.user('You are a subagent, do X', '2026-10-08T15:01:05Z');
  a.asst([tool('b1', 'Bash', { command: 'rm -rf /tmp/x' })], '2026-10-08T15:01:10Z', { id: 'm9', model: 'claude-haiku-4-5', usage: [300, 30, 0, 0], stop: 'tool_use' });
  a.toolResult('b1', '', '2026-10-08T15:01:20Z');
  a.asst([text("You're absolutely right")], '2026-10-08T15:01:30Z', { id: 'm10', model: 'claude-haiku-4-5', usage: [100, 10, 0, 0] });
  files.push({ rel: path.join(ALPHA.slug, sid, 'subagents', 'agent-aaa.jsonl'), content: dump(a.lines) });
  const b = session({ cwd: ALPHA.cwd, sessionId: sid, version: '2.1.137' });
  b.asst([text('ok')], '2026-10-08T15:01:40Z', { id: 'm11', model: 'claude-opus-4-7', usage: [50, 5, 0, 0] });
  b.system('turn_duration', '2026-10-08T15:01:45Z', { durationMs: 30000, messageCount: 1 });
  files.push({ rel: path.join(ALPHA.slug, sid, 'subagents', 'agent-bbb.jsonl'), content: dump(b.lines) });
}
// s5 — nuit, mode auto, rm -rf + push --force, juron, rage-quit, 3 messages entre 2 h et 6 h.
{
  const s = session({ cwd: BETA.cwd, sessionId: 'b5555555-0000-0000-0000-000000000005' });
  s.perm('auto', '2026-10-09T21:30:00Z');
  s.user('vas-y', '2026-10-09T21:30:05Z');
  s.asst([tool('d1', 'Bash', { command: 'rm -rf build && git push --force origin main' })], '2026-10-09T21:30:20Z', { id: 'm12', model: 'claude-opus-4-8', usage: [3000, 400, 10000, 500], stop: 'tool_use' });
  s.toolResult('d1', 'ok', '2026-10-09T21:30:25Z');
  s.user('continue', '2026-10-10T00:30:00Z');
  s.user('encore', '2026-10-10T00:31:00Z');
  s.user('putain, non !!', '2026-10-10T00:32:00Z');
  s.asst([text('Vous avez raison, je corrige.')], '2026-10-10T00:33:00Z', { id: 'm13', model: 'claude-opus-4-8', usage: [100, 10, 0, 0] });
  add(BETA, 'b5555555-0000-0000-0000-000000000005.jsonl', s);
}
// s6 — commande slash, sortie locale, collage, interruption, bloc de code, system-reminder joint.
{
  const s = session({ cwd: BETA.cwd, sessionId: 'b6666666-0000-0000-0000-000000000006' });
  s.user('<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args></command-args>', '2026-10-11T10:00:00Z');
  s.user('<local-command-stdout>Set model</local-command-stdout>', '2026-10-11T10:00:01Z');
  s.user('Regarde ça : <pasted_content id="1">' + 'x'.repeat(1000) + '</pasted_content> et dis-moi', '2026-10-11T10:00:10Z');
  s.asst([text('Je regarde.')], '2026-10-11T10:00:20Z', { id: 'm14', model: 'claude-sonnet-4-6', usage: [200, 20, 0, 0] });
  s.user([text('[Request interrupted by user for tool use]')], '2026-10-11T10:00:25Z');
  s.user([text('Non. Utilise plutôt ceci :\n\x60\x60\x60js\nconst a = 1;\n\x60\x60\x60'), text('<system-reminder>ignored</system-reminder>')], '2026-10-11T10:00:30Z'); // \x60 = backtick
  s.asst([text("Effectivement, c'est mieux.")], '2026-10-11T10:00:40Z', { id: 'm15', model: 'claude-sonnet-4-6', usage: [300, 30, 0, 0] });
  s.user('parfait', '2026-10-11T10:01:00Z');
  add(BETA, 'b6666666-0000-0000-0000-000000000006.jsonl', s);
}
// s7 — acceptEdits, premier prompt long (727 car.), EnterPlanMode/ExitPlanMode.
{
  const s = session({ cwd: BETA.cwd, sessionId: 'b7777777-0000-0000-0000-000000000007' });
  s.perm('acceptEdits', '2026-10-12T07:59:00Z');
  s.user('Voici le contexte complet : ' + 'blabla '.repeat(100), '2026-10-12T08:00:00Z');
  s.asst([tool('p1', 'EnterPlanMode', {})], '2026-10-12T08:00:10Z', { id: 'm16', model: 'claude-opus-4-7', usage: [5000, 500, 0, 1000], stop: 'tool_use' });
  s.toolResult('p1', 'Entered plan mode', '2026-10-12T08:00:15Z');
  s.asst([tool('p2', 'ExitPlanMode', {})], '2026-10-12T08:00:20Z', { id: 'm17', model: 'claude-opus-4-7', usage: [100, 10, 0, 0], stop: 'tool_use' });
  s.toolResult('p2', 'Exited plan mode', '2026-10-12T08:00:25Z');
  s.user('go', '2026-10-12T08:05:00Z');
  s.user('ok', '2026-10-12T08:06:00Z');
  add(BETA, 'b7777777-0000-0000-0000-000000000007.jsonl', s);
}
// s8 — sudo rm -rf bloqué par l'auto mode, repli modèle, turn_duration, tour sans timestamp ni modèle, version plus récente.
{
  const s = session({ cwd: BETA.cwd, sessionId: 'b8888888-0000-0000-0000-000000000008', version: '2.1.204' });
  s.user('fais le ménage', '2026-10-12T09:00:00Z');
  s.asst([tool('b2', 'Bash', { command: 'sudo rm -rf /' })], '2026-10-12T09:00:10Z', { id: 'm18', model: 'claude-haiku-4-5', usage: [100, 10, 0, 0], stop: 'tool_use' });
  s.toolResult('b2', 'Permission to use Bash with command sudo rm -rf / was denied by the Claude Code auto mode classifier. Reason: destructive', '2026-10-12T09:00:15Z', true);
  s.system('model_refusal_fallback', '2026-10-12T09:00:20Z', { originalModel: 'claude-haiku-4-5', fallbackModel: 'claude-sonnet-4-6' });
  s.system('turn_duration', '2026-10-12T09:00:25Z', { durationMs: 90000, messageCount: 3 });
  s.asst([text("I apologize, I can't do that.")], null, { id: 'm19', usage: [100, 10, 0, 0] });
  s.user('ok merci', '2026-10-12T09:01:00Z');
  add(BETA, 'b8888888-0000-0000-0000-000000000008.jsonl', s);
}

await rm(ROOT, { recursive: true, force: true });
for (const f of files) {
  const full = path.join(ROOT, f.rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, f.content);
}
await mkdir(path.join(ROOT, ALPHA.slug, 'memory'), { recursive: true });
await writeFile(path.join(ROOT, ALPHA.slug, 'memory', 'notes.md'), '# ignoré par Freudiff\n');
console.log(`${files.length} fichiers écrits sous ${ROOT}`);
