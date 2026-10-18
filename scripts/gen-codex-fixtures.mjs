// scripts/gen-codex-fixtures.mjs — fixtures synthétiques CXTI (spec CXTI § 6), écrites d'après le
// code source de Codex. Aucune donnée réelle. Relancer : npm run fixtures:codex
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const usage = (input, cached, output, cacheWrite = 0) => ({ input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: cacheWrite, output_tokens: output, reasoning_output_tokens: 0, total_tokens: input + output });
const tokens = (total, last) => ({ type: 'token_count', info: { total_token_usage: total, last_token_usage: last, model_context_window: 258400 }, rate_limits: null });
const ctx = (model, approval, sandbox, mode = 'default') => ({ turn_id: 't', cwd: '/x', approval_policy: approval, sandbox_policy: { type: sandbox }, model, collaboration_mode: { mode, settings: { model, reasoning_effort: null, developer_instructions: '' } } });
const meta = (extra) => ({ id: 'x', timestamp: '2026-10-01T00:00:00.000Z', originator: 'codex-tui', model_provider: 'openai', ...extra });
const user = (text) => ({ type: 'message', role: 'user', content: [{ type: 'input_text', text }] });
const say = (text) => ({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
const call = (name, args) => ({ type: 'function_call', name, arguments: JSON.stringify(args), call_id: 'c' });
const out = (output) => ({ type: 'function_call_output', call_id: 'c', output });
const userItem = (text) => ({ type: 'item_completed', thread_id: 'x', turn_id: 't', item: { type: 'UserMessage', id: 'u', content: [{ type: 'text', text, text_elements: [] }] }, started_at_ms: 0, completed_at_ms: 0 });

// Chaque ligne : [horodatage UTC, type, payload, metadata?] ou une chaîne brute (ligne corrompue).
// L'ordinal est le rang de la ligne dans le fichier. Heures de Paris = UTC + 2 en octobre.
const FILES = {
  // A — legacy, alpha : plan mode, 2 tours, outils, refus, interruption, token_count piégés
  'tests/fixtures-codex/sessions/2026/10/05/rollout-2026-10-05T22-00-00-a1.jsonl': [
    ['2026-10-05T20:00:00.000Z', 'session_meta', meta({ cwd: '/Users/test/Dev/alpha', cli_version: '0.150.0', source: 'cli', thread_source: 'user', history_mode: 'legacy' })],
    ['2026-10-05T20:00:00.100Z', 'event_msg', { type: 'task_started', turn_id: 't1', started_at: 0 }],
    ['2026-10-05T20:00:00.200Z', 'response_item', user('<environment_context>\n  <cwd>/Users/test/Dev/alpha</cwd>\n</environment_context>')],
    ['2026-10-05T20:00:00.300Z', 'turn_context', ctx('gpt-5.2-codex', 'on-request', 'workspace-write', 'plan')],
    ['2026-10-05T20:00:05.000Z', 'response_item', user('Peux-tu ajouter un test pour le parseur ?')],
    ['2026-10-05T20:00:05.000Z', 'event_msg', { type: 'user_message', message: 'Peux-tu ajouter un test pour le parseur ?', images: [] }],
    ['2026-10-05T20:00:10.000Z', 'response_item', call('exec_command', { cmd: 'rm -rf build && git commit -m x' })],
    ['2026-10-05T20:00:11.000Z', 'response_item', out('Exit code: 0')],
    ['2026-10-05T20:00:12.000Z', 'response_item', call('shell', { command: ['bash', '-lc', 'git push --force'] })],
    ['2026-10-05T20:00:13.000Z', 'response_item', out('exec command rejected by user')],
    ['2026-10-05T20:00:14.000Z', 'response_item', { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch', call_id: 'p' }],
    ['2026-10-05T20:00:15.000Z', 'event_msg', { type: 'token_count', info: null, rate_limits: null }],
    ['2026-10-05T20:00:20.000Z', 'event_msg', tokens(usage(1_000_000, 400_000, 50_000), usage(1_000_000, 400_000, 50_000))],
    ['2026-10-05T20:00:20.100Z', 'event_msg', tokens(usage(1_000_000, 400_000, 50_000), usage(1_000_000, 400_000, 50_000))],
    ['2026-10-05T20:00:30.000Z', 'response_item', say("You're absolutely right! Sorry about that.")],
    ['2026-10-05T20:00:30.100Z', 'event_msg', { type: 'agent_message', message: "You're absolutely right! Sorry about that." }],
    ['2026-10-05T20:00:31.000Z', 'event_msg', { type: 'context_compacted' }],
    ['2026-10-05T20:01:00.000Z', 'event_msg', { type: 'task_complete', turn_id: 't1', duration_ms: 60_000 }],
    // tour 2 : le message humain précède le turn_context de son tour
    ['2026-10-05T20:30:00.000Z', 'event_msg', { type: 'task_started', turn_id: 't2', started_at: 0 }],
    ['2026-10-05T20:30:00.200Z', 'event_msg', { type: 'user_message', message: 'NON, ARRÊTE TOUT', images: [] }],
    ['2026-10-05T20:30:00.300Z', 'turn_context', ctx('gpt-5.2-codex', 'never', 'danger-full-access')],
    ['2026-10-05T20:30:05.000Z', 'response_item', call('request_user_input', { questions: [] })],
    ['2026-10-05T20:30:10.000Z', 'event_msg', tokens(usage(3_000_000, 2_000_000, 150_000), usage(2_000_000, 1_600_000, 100_000))],
    ['2026-10-05T20:30:11.000Z', 'event_msg', tokens({ input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 258_400 }, usage(0, 0, 0))],
    ['2026-10-05T20:30:15.000Z', 'event_msg', { type: 'turn_aborted', turn_id: 't2', reason: 'interrupted', duration_ms: 5_000 }],
  ],
  // C — sous-agent de A, legacy : les lignes d'ordinal < 3 sont l'historique copié du parent
  'tests/fixtures-codex/sessions/2026/10/05/rollout-2026-10-05T22-10-00-c3.jsonl': [
    ['2026-10-05T20:10:00.000Z', 'session_meta', meta({ cwd: '/Users/test/Dev/alpha', cli_version: '0.150.0', source: { subagent: { thread_spawn: { parent_thread_id: 'a1', depth: 1 } } }, thread_source: 'subagent', history_mode: 'legacy', subagent_history_start_ordinal: 3 })],
    ['2026-10-05T20:00:05.000Z', 'event_msg', { type: 'user_message', message: 'Peux-tu ajouter un test pour le parseur ?', images: [] }],
    ['2026-10-05T20:00:20.000Z', 'event_msg', tokens(usage(1_000_000, 400_000, 50_000), usage(1_000_000, 400_000, 50_000))],
    ['2026-10-05T20:10:01.000Z', 'turn_context', ctx('gpt-5.1-codex-mini', 'on-request', 'workspace-write')],
    ['2026-10-05T20:10:02.000Z', 'response_item', call('exec_command', { cmd: 'sudo ls /var/log' })],
    ['2026-10-05T20:10:03.000Z', 'response_item', say('Done, you are right that the logs rotate.')],
    ['2026-10-05T20:10:04.000Z', 'event_msg', tokens(usage(200_000, 0, 10_000), usage(200_000, 0, 10_000))],
    ['2026-10-05T20:10:05.000Z', 'event_msg', { type: 'task_complete', turn_id: 's1', duration_ms: 30_000 }],
  ],
  // B — paginated, beta, gpt-6-astra : message humain via item_completed, réponse livrée en double
  'tests/fixtures-codex/sessions/2026/10/06/rollout-2026-10-07T01-29-00-b2.jsonl': [
    ['2026-10-06T23:29:00.000Z', 'session_meta', meta({ cwd: '/Users/test/Dev/beta', cli_version: '0.153.4', source: 'cli', thread_source: 'user', history_mode: 'paginated' })],
    ['2026-10-06T23:29:00.100Z', 'event_msg', { type: 'task_started', turn_id: 't1', started_at: 0, collaboration_mode_kind: 'default' }],
    ['2026-10-06T23:29:00.200Z', 'turn_context', ctx('gpt-6-astra', 'on-request', 'workspace-write')],
    ['2026-10-06T23:30:00.000Z', 'response_item', user('merci, parfait')],
    ['2026-10-06T23:30:00.000Z', 'event_msg', { type: 'user_message', message: 'merci, parfait', images: [] }],
    ['2026-10-06T23:30:00.000Z', 'event_msg', userItem('merci, parfait')],
    ['2026-10-06T23:30:20.000Z', 'response_item', say('Sorry, my mistake.')],
    ['2026-10-06T23:30:20.100Z', 'response_item', say('Sorry, my mistake.'), { delivered_assistant_message: 'codex:code-mode-delivery:v1:x' }],
    ['2026-10-06T23:30:25.000Z', 'event_msg', tokens(usage(100_000, 0, 10_000, 40_000), usage(100_000, 0, 10_000, 40_000))],
    ['2026-10-06T23:31:00.000Z', 'compacted', { message: 'résumé', replacement_history: [] }],
    ['2026-10-06T23:32:00.000Z', 'event_msg', { type: 'task_complete', turn_id: 't1', duration_ms: 120_000 }],
  ],
  // D — session interne (guardian) : rien ne compte
  'tests/fixtures-codex/sessions/2026/10/07/rollout-2026-10-07T12-00-00-d4.jsonl': [
    ['2026-10-07T10:00:00.000Z', 'session_meta', meta({ cwd: '/Users/test/Dev/gamma', cli_version: '0.99.0', source: { internal: 'guardian' }, thread_source: 'guardian_review', history_mode: 'paginated' })],
    ['2026-10-07T10:00:01.000Z', 'turn_context', ctx('gpt-5.4', 'never', 'danger-full-access')],
    ['2026-10-07T10:00:02.000Z', 'event_msg', userItem('Review this command')],
    ['2026-10-07T10:00:03.000Z', 'event_msg', tokens(usage(50_000, 0, 1_000), usage(50_000, 0, 1_000))],
  ],
  // E — session vide (legacy implicite), avec une ligne corrompue
  'tests/fixtures-codex/sessions/2026/10/08/rollout-2026-10-08T11-00-00-e5.jsonl': [
    ['2026-10-08T09:00:00.000Z', 'session_meta', meta({ cwd: '/Users/test/Dev/beta', cli_version: '0.149.2', source: 'exec', thread_source: 'user' })],
    ['2026-10-08T09:00:01.000Z', 'turn_context', ctx('gpt-5.2-codex', 'on-request', 'read-only')],
    '{"type":"event_msg","payload":{"type":"user_message"',
  ],
};
const RAW = {
  'tests/fixtures-codex/sessions/2026/09/01/rollout-2026-09-01T10-00-00-f6.jsonl.zst': 'not really zstd',
  'tests/fixtures-codex/history.jsonl': '{"session_id":"a1","ts":1,"text":"ignored"}\n',
  'tests/fixtures-codex/session_index.jsonl': '{"id":"a1","thread_name":"ignored","updated_at":"2026-10-05"}\n',
  'tests/fixtures-codex-zst/sessions/2026/09/01/rollout-2026-09-01T10-00-00-f7.jsonl.zst': 'not really zstd',
};

await rm('tests/fixtures-codex', { recursive: true, force: true });
await rm('tests/fixtures-codex-zst', { recursive: true, force: true });
for (const [file, lines] of Object.entries(FILES)) {
  await mkdir(path.dirname(file), { recursive: true });
  const text = lines.map((l, ordinal) => (typeof l === 'string' ? l
    : JSON.stringify({ timestamp: l[0], ordinal, type: l[1], payload: l[2], ...(l[3] ? { metadata: l[3] } : {}) }))).join('\n') + '\n';
  await writeFile(file, text);
}
for (const [file, text] of Object.entries(RAW)) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); }
console.log(`${Object.keys(FILES).length + Object.keys(RAW).length} fichiers écrits`);
