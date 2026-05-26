# 排版（Typography）

> 字号体系：12 / 14 / 16 / 20 / 24 / 32 / 40 px，每档配套行高与默认字重。
> 命名规则：
>   - 字号：`--text-{name}`
>   - 行高：`--leading-{name}`
>   - 字重：`--font-{name}`

## 字号 + 行高

```css
--text-xs:   12px;   --leading-xs:   16px;   /* 辅助说明 */
--text-sm:   14px;   --leading-sm:   20px;   /* 正文小号 */
--text-base: 16px;   --leading-base: 24px;   /* 正文 */
--text-lg:   20px;   --leading-lg:   28px;   /* 副标题 */
--text-xl:   24px;   --leading-xl:   32px;   /* 标题 */
--text-2xl:  32px;   --leading-2xl:  40px;   /* 大标题 */
--text-3xl:  40px;   --leading-3xl:  48px;   /* 展示 */
```

## 字重

```css
--font-regular:  400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
```

## 字体族（Font Family）

```css
--font-sans:  -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
--font-mono:  "SF Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
```

## 使用规范

| 场景 | 字号 | 行高 | 字重 |
|------|------|------|------|
| 正文 | `--text-base` | `--leading-base` | `--font-regular` |
| 强调正文 | `--text-base` | `--leading-base` | `--font-medium` |
| 副标题 H4/H5 | `--text-lg` | `--leading-lg` | `--font-semibold` |
| 标题 H3 | `--text-xl` | `--leading-xl` | `--font-semibold` |
| 标题 H2 | `--text-2xl` | `--leading-2xl` | `--font-bold` |
| 标题 H1 | `--text-3xl` | `--leading-3xl` | `--font-bold` |
| 辅助文字/说明 | `--text-xs` | `--leading-xs` | `--font-regular` |
| 表格表头/标签 | `--text-sm` | `--leading-sm` | `--font-medium` |
