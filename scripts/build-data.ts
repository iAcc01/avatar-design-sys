/**
 * build-data.ts
 *
 * 编译 tokens/ 人工源 → data/tokens/{primitives.json, semantic.json, tokens.css}
 *
 * 输入：
 *   tokens/color-palette.md     —— 解析所有 ```css ... ``` 块中的 CSS 变量
 *   tokens/spacing.md           —— 同上
 *   tokens/typography.md        —— 同上
 *   tokens/radius.md            —— 同上
 *   tokens/semantic.json        —— light/dark 两套 semantic 映射
 *
 * 输出：
 *   data/tokens/primitives.json   —— { "blue-7": "#3462ED", ... }
 *   data/tokens/semantic.json     —— 直接复制 tokens/semantic.json
 *   data/tokens/tokens.css        —— :root { --xxx: yyy; } 完整 CSS
 *   data/skill-version.json       —— { version, builtAt }
 *
 *   references/tokens.fallback.json —— 离线兜底快照（同步写入）
 */

import * as fs from 'fs';
import * as path from 'path';
import { LOCAL_TOKENS, LOCAL_DATA, LOCAL_REFERENCES, SKILL_VERSION, SKILL_NAME } from './index.js';

interface PrimitiveTokens {
  [name: string]: string;
}

interface SemanticTheme {
  [name: string]: string;
}

interface SemanticTokens {
  light: SemanticTheme;
  dark: SemanticTheme;
}

// ---- helpers ----

/** 从 markdown 中抽出所有 ```css 代码块的正文 */
function extractCssBlocks(md: string): string[] {
  const blocks: string[] = [];
  const re = /```css\s+([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

/** 从 CSS 文本中解析 `--name: value;` 形式的变量 */
function parseCssVars(css: string): PrimitiveTokens {
  const vars: PrimitiveTokens = {};
  // 行级解析，忽略注释/空行
  const lines = css.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!line) continue;
    const m = line.match(/^--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);?\s*$/);
    if (m) {
      const name = m[1].trim();
      const value = m[2].trim();
      vars[name] = value;
    }
  }
  return vars;
}

/** 把对象按 key 排序（稳定的产物输出） */
function sortObj<T extends Record<string, unknown>>(o: T): T {
  return Object.keys(o)
    .sort()
    .reduce((acc, k) => {
      (acc as Record<string, unknown>)[k] = o[k];
      return acc;
    }, {} as T);
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ---- main ----

function readPrimitives(): PrimitiveTokens {
  const sources = ['color-palette.md', 'spacing.md', 'typography.md', 'radius.md'];
  const all: PrimitiveTokens = {};
  for (const file of sources) {
    const fp = path.join(LOCAL_TOKENS, file);
    if (!fs.existsSync(fp)) {
      console.warn(`[build-data] missing ${file}, skipped`);
      continue;
    }
    const md = fs.readFileSync(fp, 'utf-8');
    const blocks = extractCssBlocks(md);
    for (const css of blocks) {
      Object.assign(all, parseCssVars(css));
    }
  }
  return all;
}

function readSemantic(): SemanticTokens {
  const fp = path.join(LOCAL_TOKENS, 'semantic.json');
  if (!fs.existsSync(fp)) {
    throw new Error(`[build-data] tokens/semantic.json not found`);
  }
  const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  // 去掉注释字段
  delete raw.$schema;
  return raw as SemanticTokens;
}

/** 把 semantic 中的 hsl/var 引用转为 CSS 友好字符串（保留 var(...) 原样） */
function emitSemanticBlock(theme: SemanticTheme): string {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(theme)) {
    lines.push(`  --${name}: ${value};`);
  }
  return lines.join('\n');
}

function emitTokensCss(primitives: PrimitiveTokens, semantic: SemanticTokens): string {
  const primLines: string[] = [];
  // 保留人工源中的语义分组顺序：primitives 按字母序输出（稳定产物）
  for (const [name, value] of Object.entries(sortObj(primitives))) {
    primLines.push(`  --${name}: ${value};`);
  }

  return [
    `/**`,
    ` * ${SKILL_NAME} v${SKILL_VERSION} — auto-generated, do not edit.`,
    ` * Source: tokens/*.md + tokens/semantic.json`,
    ` */`,
    ``,
    `:root {`,
    `  /* ---- primitive ---- */`,
    primLines.join('\n'),
    ``,
    `  /* ---- semantic (light) ---- */`,
    emitSemanticBlock(semantic.light),
    `}`,
    ``,
    `.dark, [data-theme="dark"] {`,
    `  /* ---- semantic (dark) ---- */`,
    emitSemanticBlock(semantic.dark),
    `}`,
    ``,
  ].join('\n');
}

function main() {
  console.log(`[build-data] start`);
  const primitives = readPrimitives();
  const semantic = readSemantic();

  const tokensDir = path.join(LOCAL_DATA, 'tokens');
  ensureDir(tokensDir);
  ensureDir(LOCAL_REFERENCES);

  // 1) primitives.json
  fs.writeFileSync(
    path.join(tokensDir, 'primitives.json'),
    JSON.stringify(sortObj(primitives), null, 2) + '\n'
  );
  console.log(`[build-data] wrote data/tokens/primitives.json (${Object.keys(primitives).length} vars)`);

  // 2) semantic.json
  fs.writeFileSync(
    path.join(tokensDir, 'semantic.json'),
    JSON.stringify(semantic, null, 2) + '\n'
  );
  console.log(`[build-data] wrote data/tokens/semantic.json`);

  // 3) tokens.css
  const css = emitTokensCss(primitives, semantic);
  fs.writeFileSync(path.join(tokensDir, 'tokens.css'), css);
  console.log(`[build-data] wrote data/tokens/tokens.css`);

  // 4) skill-version.json
  fs.writeFileSync(
    path.join(LOCAL_DATA, 'skill-version.json'),
    JSON.stringify(
      {
        name: SKILL_NAME,
        version: SKILL_VERSION,
        builtAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n'
  );
  console.log(`[build-data] wrote data/skill-version.json`);

  // 5) references/tokens.fallback.json （离线兜底快照）
  const fallback = {
    primitives,
    semantic,
    tokensCss: css,
  };
  fs.writeFileSync(
    path.join(LOCAL_REFERENCES, 'tokens.fallback.json'),
    JSON.stringify(fallback, null, 2) + '\n'
  );
  console.log(`[build-data] wrote references/tokens.fallback.json`);

  console.log(`[build-data] done`);
}

main();
