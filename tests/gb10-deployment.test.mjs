import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const installer = JSON.parse(readFileSync(new URL('../config/installer.json', import.meta.url)));
const model = installer.managedModel;

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'santa-gb10-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  const log = path.join(dir, 'calls');
  writeFileSync(log, '');
  const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, LOG: log };
  const stub = (name, commands) => writeFileSync(path.join(bin, name), '#!/bin/bash\nset -eu\n' + commands, { mode: 0o700 });
  const run = (script, ...args) => {
    writeFileSync(log, '');
    const result = spawnSync('bash', [script, ...args], { env, encoding: 'utf8', timeout: 5000 });
    return { ...result, calls: readFileSync(log, 'utf8') };
  };
  return { dir, env, stub, run };
}

test('prefetch and managed vLLM startup reuse a complete pinned cache without download', t => {
  const { dir, env, stub, run } = fixture(t);
  const snapshot = path.join(dir, '.cache/huggingface/hub', 'models--' + model.repository.replace('/', '--'), 'snapshots', model.revision);
  mkdirSync(snapshot, { recursive: true });
  const shard = 'model-00001-of-00001.safetensors';
  for (const name of ['chat_template.jinja', 'config.json', 'generation_config.json', 'hf_quant_config.json',
    'merges.txt', 'preprocessor_config.json', 'processor_config.json', 'tokenizer.json',
    'tokenizer_config.json', 'video_preprocessor_config.json', 'vocab.json', shard]) {
    writeFileSync(path.join(snapshot, name), 'fixture');
  }
  writeFileSync(path.join(snapshot, 'model.safetensors.index.json'), JSON.stringify({ weight_map: { weight: shard } }));
  Object.assign(env, { HOME: dir, MISSING_SHARD: path.join(snapshot, shard) });
  stub('docker', `printf '%s\\n' "$*" >> "$LOG"
case "$1 $2" in
  'image inspect') exit 0 ;;
  'container inspect') exit 1 ;;
  'network inspect') [[ "$*" != *IPAM* ]] || echo 172.17.0.1
    [[ "$*" != *Driver* ]] || echo bridge ;;
  'run -d') exit 0 ;;
  'run --rm') printf '%s' fixture > "$MISSING_SHARD" ;;
  *) exit 6 ;;
esac
`);
  stub('ss', 'exit 0\n');
  stub('curl', `printf '%s\\n' '${JSON.stringify({ data: [{ id: model.repository, max_model_len: 65536 }] })}'\n`);
  const script = 'deploy/install-gb10-model.sh';

  const staged = run(script, '--prefetch');
  assert.equal(staged.status, 0, staged.stderr);
  assert.match(staged.stdout, /Reusing the pinned .* weights/);
  assert.doesNotMatch(staged.calls, /pull|run |network |start /);

  const installed = run(script);
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.calls, /run -d .*--pull=never.*--max-model-len 65536/);
  assert.doesNotMatch(installed.calls, /(^|\n)pull |run --rm/);

  rmSync(env.MISSING_SHARD);
  const repaired = run(script, '--prefetch');
  assert.equal(repaired.status, 0, repaired.stderr);
  assert.match(repaired.calls, /run --rm .*snapshot_download/);
  assert.doesNotMatch(repaired.calls, /run -d/);
});

test('GB10 startup recovers a missing dashboard forward even without the shutdown marker', t => {
  const { dir, env, stub, run } = fixture(t);
  const deploy = path.join(dir, 'deploy');
  mkdirSync(deploy);
  mkdirSync(path.join(dir, 'dist'));
  mkdirSync(path.join(dir, 'node_modules'));
  writeFileSync(path.join(dir, 'dist/index.html'), '');
  const startup = path.join(deploy, 'start-workshop.sh');
  for (const name of ['start-workshop.sh', 'gb10-sandbox-boot.sh']) {
    copyFileSync(new URL('../deploy/' + name, import.meta.url), path.join(deploy, name));
  }
  Object.assign(env, { SANTA_SANDBOX: 'santa-test', SANTA_DATA: path.join(dir, 'data'), SANTA_GB10_BOOT_STATE: dir });
  stub('node', 'printf "node %s\\n" "${1##*/}" >> "$LOG"\n');
  stub('nemoclaw', 'printf "nemoclaw %s\\n" "$*" >> "$LOG"\nexit "${RECOVERY_EXIT:-0}"\n');
  const managed = run(startup);
  assert.equal(managed.status, 0, managed.stderr);
  assert.equal(managed.calls, 'node check-gb10.mjs\nnemoclaw santa-test recover\nnode private-index.mjs\n');

  env.RECOVERY_EXIT = '7';
  const failed = run(startup);
  assert.equal(failed.status, 7);
  assert.doesNotMatch(failed.calls, /private-index/);

  delete env.SANTA_GB10_BOOT_STATE;
  const unmanaged = run(startup);
  assert.equal(unmanaged.status, 0, unmanaged.stderr);
  assert.doesNotMatch(unmanaged.calls, /recover/);
});
