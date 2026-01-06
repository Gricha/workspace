#!/usr/bin/env bun

import { $ } from 'bun';
import { mkdir, cp, rm } from 'fs/promises';
import { join } from 'path';

const TARGETS = [
  { target: 'bun-linux-x64', name: 'perry-linux-x64', archive: 'tar.gz' },
  { target: 'bun-linux-arm64', name: 'perry-linux-arm64', archive: 'tar.gz' },
  { target: 'bun-darwin-x64', name: 'perry-darwin-x64', archive: 'tar.gz' },
  { target: 'bun-darwin-arm64', name: 'perry-darwin-arm64', archive: 'tar.gz' },
  { target: 'bun-windows-x64', name: 'perry-windows-x64.exe', archive: 'zip' },
];

const ROOT = join(import.meta.dir, '..');
const DIST_DIR = join(ROOT, 'dist-binaries');
const WEB_DIR = join(ROOT, 'dist', 'agent', 'web');

async function main() {
  const version = process.env.VERSION || (await getVersion());
  console.log(`Building binaries for version ${version}`);

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  await $`bun run build:ts`.cwd(ROOT);
  await $`bun run build:web`.cwd(ROOT);

  for (const { target, name, archive } of TARGETS) {
    console.log(`\nBuilding ${name}...`);

    const stagingDir = join(DIST_DIR, `perry-${version}-${target.replace('bun-', '')}`);
    await mkdir(stagingDir, { recursive: true });

    const binaryPath = join(stagingDir, name.replace('.exe', '') + (name.endsWith('.exe') ? '.exe' : ''));

    await $`bun build ./src/index.ts --compile --target=${target} --minify --outfile=${binaryPath}`.cwd(ROOT);

    await cp(WEB_DIR, join(stagingDir, 'web'), { recursive: true });

    const archiveName =
      archive === 'tar.gz'
        ? `perry-${version}-${target.replace('bun-', '')}.tar.gz`
        : `perry-${version}-${target.replace('bun-', '')}.zip`;

    const archivePath = join(DIST_DIR, archiveName);

    if (archive === 'tar.gz') {
      await $`tar -czvf ${archivePath} -C ${DIST_DIR} ${`perry-${version}-${target.replace('bun-', '')}`}`;
    } else {
      await $`zip -r ${archivePath} ${`perry-${version}-${target.replace('bun-', '')}`}`.cwd(DIST_DIR);
    }

    console.log(`  Created ${archiveName}`);
  }

  await generateChecksums(version);

  console.log(`\nBuild complete! Archives in ${DIST_DIR}`);
}

async function getVersion(): Promise<string> {
  const pkg = await Bun.file(join(ROOT, 'package.json')).json();
  return pkg.version;
}

async function generateChecksums(version: string) {
  console.log('\nGenerating checksums...');
  const checksumFile = join(DIST_DIR, `perry-${version}-checksums.txt`);

  const result = await $`sha256sum perry-${version}-*.tar.gz perry-${version}-*.zip 2>/dev/null || shasum -a 256 perry-${version}-*.tar.gz perry-${version}-*.zip`.cwd(DIST_DIR).text();

  await Bun.write(checksumFile, result);
  console.log(`  Created perry-${version}-checksums.txt`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
