# 间距（Spacing）

> 4px 基线，覆盖 0 / 1 / 2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 px。
> 命名规则：`--space-{n}`，`n` 表示 4 的倍数（如 `--space-4` = 16px）。

```css
--space-0:   0px;
--space-px:  1px;     /* 描边、分隔线 */
--space-0_5: 2px;     /* 极细间距 */
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;    /* 默认 padding */
--space-5:   20px;
--space-6:   24px;    /* 卡片 padding */
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
--space-16:  64px;
--space-20:  80px;
--space-24:  96px;
```

## 使用规范

- **组件内边距**：默认 `--space-4`（16px），紧凑组件用 `--space-2`/`--space-3`
- **卡片/对话框**：`--space-6`（24px）
- **区块之间**：`--space-8` ~ `--space-12`
- **页面 gutter**：`--space-12` ~ `--space-16`
- 不允许使用未定义的间距值；如需新增，先扩 token 再使用
