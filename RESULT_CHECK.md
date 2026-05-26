# 1. 检查渲染结果

生成代码后，将实际渲染结果与原始 Figma 设计稿对比，验证渲染质量。

## 1.1 启动开发服务器

- 如果开发服务器尚未运行，请先启动：
  ```bash
  npm run dev
  ```
- 如果已经运行，继续下一步。

## 1.2 截取渲染页面截图

- Figma 导出的设计稿为 1x 分辨率，渲染截图必须与之保持一致，避免 DPR 差异导致对比失真。
- 只截取目标组件所在的 DOM 节点，而非整页。
- 使用 `deviceScaleFactor: 1`（关键）。
- 视口宽度与 Figma 设计稿一致（通常 1440）。
- 使用 `Math.round(box.x/y)` + Figma 原图 `width/height` 作为 `clip` 参数显式传入 `page.screenshot`，不要直接使用 `el.screenshot()`。

```bash
node -e "const {chromium}=require('playwright');(async()=>{
  const b=await chromium.launch();
  const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const p=await c.newPage();
  await p.goto('<page-url>');
  await p.waitForLoadState('networkidle');
  const el=await p.\$('<selector>');
  const box=await el.boundingBox();
  await p.screenshot({
    path:'_design-context/${figma-id}/render-result.png',
    clip:{ x:Math.round(box.x), y:Math.round(box.y), width:<figma-width>, height:<figma-height> }
  });
  await b.close();
})();"
```

> 若项目中未安装 `playwright`，请先安装：`npm i -D playwright && npx playwright install chromium`。

### 最低要求

- 截图保存路径：`_design-context/${figma-id}/render-result.png`
- 截图尺寸必须与 `_design-context/${figma-id}/screenShot.png`（Figma 原图）**完全一致**（宽/高都相同）。

## 1.3 对比渲染结果与 Figma 设计稿

> [用法] `npx tsx scripts/compare-images.ts <imagePath1> <imagePath2> <figma-link> <model>`
> 差异图会输出到 `imagePath1` 所在目录下的 `diff.png`。

脚本会输出 2 个维度的相似度：

- **像素相似度**：像素级对比
- **SSIM 相似度**：结构相似性

如果脚本提示 "尺寸不一致" 或 "宽高比差异较大"，请回到 1.2 重新截图。

# 2. 渲染结果不符合预期（< 90%）的处理

**问题 2 — 是否继续？**（标题："是否继续？"）
是否根据差异继续修改实现？选项：是 / 否

如果用户选择 "是"，则继续下一步。

## 修复时的约束

- 不通过新增 `position: absolute` + 硬编码 `top/left` 的方式来修复偏移问题。
- 应回到 SKILL.md §6.3，将受影响区块改为 flex / gap / margin 的相对布局，通过调整 `margin` / `gap` / `padding` / `line-height` 来对齐。
- 仅当该元素本来就是角标、蒙版、浮层时，才允许保留或新增 `absolute`。

## 根据 diff.png 形态判断方向

- **下半部分整体性红蓝双影沿 Y 轴成对分布**：存在累计纵向偏移，需按 SKILL.md §6.3 的要求核对每个节点的 `line-height`、`font-size`、`margin` / `gap` 与 `figma.html` 是否一致，逐段消除多出的间距。
- **差异仅集中在文字 / 图标边缘的细红边**：字体抗锯齿差异，无需修改实现。
- **大块色差**：检查对应节点的 `background` / `src` 是否正确；若是颜色 token 错误（例如把 `bg-primary` 写成了 `bg-[#xxx]`），改为正确的 Tailwind 语义类。

## 查询组件文档辅助修复

> [shadcn] `npx tsx scripts/query-shadcn.ts <name1,name2,...>`
> 例：`npx tsx scripts/query-shadcn.ts button,dialog`

> [业务组件] `npx tsx scripts/query-biz.ts <name1,name2,...>`

> [图标] `npx tsx scripts/query-lucide.ts <kw1,kw2,...>`

确认所用组件 / 图标存在且 props 正确。
