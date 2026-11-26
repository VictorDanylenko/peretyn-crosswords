import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
test('a fresh deployment builds every static file without a pre-existing dist directory', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'peretyn-build-'));
  // Deliberately copy source only, as a Git deployment would receive it.
  for (const dir of ['src', 'scripts']) fs.cpSync(new URL(dir, root), path.join(temp, dir), { recursive: true });
  execFileSync(process.execPath, [path.join(temp, 'scripts/build.mjs')], { cwd: os.tmpdir() });
  for (const file of ['index.html','app.js','mark.svg','generator.js','pdf.js','style.css']) {
    assert.equal(fs.readFileSync(path.join(temp,'dist',file),'utf8'),fs.readFileSync(new URL('src/'+file,root),'utf8'));
  }
  const offline = fs.readFileSync(path.join(temp,'peretyn.html'),'utf8');
  assert(offline.includes('Конструктор кросвордів'));
  assert.equal(offline.match(/data:image\/svg\+xml;base64,/g).length,2);
  assert(!fs.existsSync(path.join(temp,'dist','data.js')));
});
test('Vercel is explicitly configured as static and has no root server entrypoint', () => {
  const config = JSON.parse(fs.readFileSync(new URL('vercel.json',root),'utf8'));
  assert.equal(config.framework, null);
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert(!config.rewrites && !config.functions && !config.builds);
  assert(!fs.existsSync(new URL('server.mjs',root)));
});
