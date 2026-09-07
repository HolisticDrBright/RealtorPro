import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

if (process.platform === 'darwin') {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const source = path.join(dir, 'keychain.swift');
  const digest = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  const out = path.join(dir, '.build');
  const binary = path.join(out, 'realtorpro-keychain');
  const stamp = path.join(out, 'source.sha256');
  if (!fs.existsSync(binary) || !fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== digest) {
    fs.mkdirSync(out, { recursive: true, mode: 0o700 });
    const temp = path.join(out, `keychain-${randomUUID()}`);
    try {
      console.log('Preparing secure macOS Keychain support…');
      execFileSync('/usr/bin/xcrun', ['swiftc', source, '-framework', 'Security', '-o', temp], { stdio: 'pipe', timeout: 60000 });
      fs.chmodSync(temp, 0o700);
      fs.renameSync(temp, binary);
      fs.writeFileSync(stamp, digest, { mode: 0o600 });
    } catch {
      console.error('Mac Keychain setup failed. Install Apple Command Line Tools with xcode-select --install, finish the installer, then run npm run setup again.');
      process.exitCode = 1;
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
}
