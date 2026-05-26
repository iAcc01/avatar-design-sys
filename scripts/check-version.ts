/**
 * check-version.ts
 *
 * 比较本地 skill 版本与远程 main/tag 版本。
 *
 * 用法：
 *   npx tsx scripts/check-version.ts
 *   D2C_REF=v0.2.0 npx tsx scripts/check-version.ts
 */

import { fetchJson, SKILL_NAME, SKILL_VERSION, BASE_URL } from './index.js';

interface SkillVersion {
  name: string;
  version: string;
  builtAt: string;
}

async function main() {
  console.log(`local: ${SKILL_NAME}@${SKILL_VERSION}`);
  try {
    const remote = await fetchJson<SkillVersion>('skill-version.json');
    console.log(`remote: ${remote.name}@${remote.version} (built ${remote.builtAt})`);
    console.log(`source: ${BASE_URL}/skill-version.json`);
    if (remote.version === SKILL_VERSION) {
      console.log(`✓ up to date`);
    } else {
      console.log(`⚠ version mismatch — pull latest tokens / data via:`);
      console.log(`  npm run pull`);
    }
  } catch (e) {
    console.error(`failed to fetch remote version: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
