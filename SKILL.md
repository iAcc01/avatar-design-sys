---
name: avatar-design-sys
description: 基于 shadcn/ui + Lucide Icons + 自定义 token 的单项目 D2C skill，将 Figma 设计稿转换为可维护的 React + Tailwind 代码。
---

# Prerequisites

在进入下面的主流程之前，**必须先阅读并执行 `PREFLIGHT_CHECK.md`**，
只有在 `PREFLIGHT_CHECK.md` 中的所有前置项都通过后，才能进入下方的 §1。

---

# 1. 通过 Figma 链接获取上下文

- Prompt 中的 Figma 文件链接，记为 `${figma-link}`
- 执行：`npx tsx scripts/get-figma-context.ts ${figma-token} ${figma-link} ${model}`
- 产物：`_design-context/${figma-id}/figma.html`、`_design-context/${figma-id}/screenShot.png`

# 2. 获取组件结构

- 执行：`npx tsx scripts/analyze-components.ts ${figma-id}`
- 产物：`_design-context/${figma-id}/component-info.json`

# 3. 优化组件信息（shadcn + 业务组件 双源映射）

通过 `package.json` 判断当前项目是否已经接入 `shadcn/ui` 与 `tailwindcss`：

- 若**未接入**，跳到步骤 6 直接生成原生 HTML/Tailwind 代码。
- 若**已接入**，继续以下子步骤。

## 3.1 组件清单获取

- 业务组件：扫描 `references/components/`（每个子目录代表一个业务组件）。
- shadcn 组件：使用 `query-shadcn.ts` 的索引（`data/shadcn/registry.json`）。

## 3.2 组件映射规则

将 `_design-context/${figma-id}/component-info.json` 中的 `${component_x}` / `componentName` 替换为真实组件名，**优先级**：

1. `references/components/`（业务组件，最高优先级）
2. `data/shadcn/registry.json`（shadcn 标准组件）
3. 原生 HTML 元素（兜底）

对于复杂的 `Table` 节点：分析其内部结构 + screenshot，将列拆解为 `columns` + `data` 形态后回写 `component-info.json`。

# 4. 查询组件 API 文档

> 不要编造任何 API；始终检查 TypeScript 错误。

## 4.1 查询 shadcn 组件

> [用法] `npx tsx scripts/query-shadcn.ts <name1,name2,...>`
> 例：`npx tsx scripts/query-shadcn.ts button,dialog,form`

输出包含每个组件的 install 命令、依赖、源文件清单。

## 4.2 查询业务组件

> [用法] `npx tsx scripts/query-biz.ts <name1,name2,...>`
> 无参时：`npx tsx scripts/query-biz.ts` 列出全部业务组件。

# 5. 查询 Lucide 图标

在将图标导入代码之前，**必须**先用以下工具查询并确认图标存在，避免编译错误。

## 5.1 关键词推导

根据 Figma 上下文推断关键词。例如**登录表单**场景：`["login", "user", "password", "signin", "secure", "key"]`。

## 5.2 图标查询

> [用法] `npx tsx scripts/query-lucide.ts <kw1,kw2,...>`
> 例：`npx tsx scripts/query-lucide.ts lock,user,login`

输出：按相关度排序的图标 + `import { Xxx } from "lucide-react"` 片段。
- 若返回为空，回到 5.1 推导更多关键词。
- 始终使用 `lucide-react` 的命名导入，不要使用 `<i class="...">` 字体图标。

# 6. 生成代码

## 6.1 基本结构

- 默认框架：**React + TypeScript + Tailwind CSS + shadcn/ui**。
- 根据 `_design-context` 中的内容生成代码并保存到合适的源码路径。
- 组件模式：**优先使用 shadcn/ui 原生组件**，在其上叠加 Tailwind 实用类，遵从 shadcn 默认 className 写法。

## 6.2 Token 注入

确保项目入口已经引入 token CSS（`PREFLIGHT_CHECK.md` 中的步骤）。生成代码时遵循：

- **颜色**：使用 Tailwind 语义类（`bg-background` / `text-foreground` / `bg-primary` / `text-muted-foreground` / `border-border` / `ring-ring` …），不要用 hex / 任意 `bg-[#...]`。
- **间距**：使用 Tailwind 标准刻度（`p-4` `gap-6` `space-y-2`），保持与 `tokens/spacing.md` 一致（4px 基线）。
- **字号**：使用 `text-sm` / `text-base` / `text-lg` …，与 `tokens/typography.md` 字号档位一致。
- **圆角**：使用 `rounded-md` / `rounded-lg`（自动消费 `--radius`）。
- **图标**：仅使用 `lucide-react`，统一 `size={16}` 默认；交互图标用 `size={20}`。

## 6.3 实现样式（与 figma.html 对齐）

**保持布局参考 `_design-context/${figma-id}/figma.html`**，组件之间的间距和布局应与原始 HTML 布局对应。

- 默认使用相对布局（flex / grid）实现整体结构，仅在元素坐标无法用父节点排列规则表达时才使用 `position: absolute`。
- 外层容器宽度需与 Figma 根节点一致；整体高度不应超过 Figma 根节点高度。
- 文本节点必须显式设置 `line-height` / `font-size` 与 `figma.html` 保持一致，不要依赖浏览器默认行高。
- 容器之间垂直间距按 `figma.html` 中相邻节点的 `top` 差值计算，并在上下两端至少有一侧通过 `margin` 或 `gap` 精确设置；不要让 `padding` 和 `line-height` 同时贡献间距。

# 7. 询问用户是否检查结果

**问题 1 — 检查结果**（标题："检查结果"）：
是否检查生成结果，并基于对比结果尝试进行二次优化？选项：是 / 否

- 若选 "是"，进入 `RESULT_CHECK.md`。
- 若选 "否"，进入步骤 8。

# 8. 清理上下文与收集反馈

## 8.1 清理

清理 `_design-context/${figma-id}` 目录（仅在用户确认接受最终实现后执行）。

## 8.2 反馈

向用户询问本次转换的满意度（1-5 分）：

- 1：基本不可用
- 2：需要大量修改
- 3：一般，需要部分修改
- 4：只需少量调整
- 5：几乎无需修改

收集到评分后，可在仓库 README 中维护 `reportFeedback` 钩子；当前版本未强制接入上报通道。

---

## 注意事项

- **不要使用 `tail` 命令查看 `_design-context/${figma-id}` 下的任何 HTML 或 component-info JSON 文件**（输出过大）。
- **不要实现 shadcn/lucide 未提供的 API**；不要凭空生成 `lucide-react` 中不存在的图标名。
- 如果脚本依赖第三方库，请把它加入 `package.json` 的 `devDependencies` 中。
- 远程数据失败时，所有 query 脚本都会自动 fallback 到 `references/*.fallback.json`，无需额外配置。
