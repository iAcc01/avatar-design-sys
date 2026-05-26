# 圆角（Radius）

> 4 档圆角阶梯，覆盖从极小元素到大容器；`--radius` 为基础值，shadcn 组件通过 calc 派生。
> 命名规则：`--radius-{name}`，shadcn 兼容 `--radius`（默认 = `--radius-md`）。

```css
--radius-none: 0px;
--radius-sm:   4px;     /* 输入框、Tag、小按钮 */
--radius-md:   8px;     /* 默认按钮、卡片 */
--radius-lg:   12px;    /* 大卡片、对话框 */
--radius-xl:   16px;    /* 容器、面板 */
--radius-full: 9999px;  /* 胶囊形 / 圆形头像 */

/* shadcn 兼容入口（建议保留） */
--radius:      8px;     /* = --radius-md */
```

## 使用规范

| 场景 | Token |
|------|-------|
| 头像、徽标、状态点 | `--radius-full` |
| 输入框、Tag、Chip | `--radius-sm` |
| 按钮（默认） | `--radius-md` |
| 卡片（默认） | `--radius-md` |
| 卡片（大）、对话框 | `--radius-lg` |
| 大容器、抽屉、模态框 | `--radius-xl` |

## shadcn 桥接

shadcn 组件源码使用 `rounded-lg`（= `var(--radius)`）/ `rounded-md`（= `calc(var(--radius) - 2px)`）/ `rounded-sm`（= `calc(var(--radius) - 4px)`）。
通过将 `--radius` 映射到 `--radius-md = 8px`，shadcn 默认按钮/卡片即得到品牌一致的圆角。
