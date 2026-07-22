# @ziloen/remark-math

ESM-only remark plugin for dollar-delimited and LaTeX-delimited math. It is a
drop-in alternative to `remark-math` with stricter single-dollar boundary
rules and configurable display math inside paragraph text.

## Install

```sh
npm install @ziloen/remark-math
```

## Use

```js
import remarkMath from "@ziloen/remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

const tree = unified()
  .use(remarkParse)
  .use(remarkMath, { displayMathInText: true })
  .parse("a $$b$$, \\[c\\] d");
```

This package only parses and serializes math. Combine it with a renderer such
as `rehype-katex` or `rehype-mathjax` when HTML rendering is required.

## Syntax

- `$...$` and `\\(...\\)` produce inline math.
- Text `$$...$$` and `\\[...\\]` produce inline math by default.
- Isolated `$$...$$`, fenced dollar blocks, and isolated `\\[...\\]` produce
  block math.
- Three or more dollar signs form an inline-safe fence in text and a block
  fence when isolated.
- Code, autolinks, HTML blocks, and inline HTML contents are not parsed as
  math.

Single-dollar delimiters follow the boundary behavior used by
`@vscode/markdown-it-katex`, preventing currency-like text such as
`$123, $123` from becoming math.

## API

The package has one runtime export: the default remark plugin. It also exports
the TypeScript-only `Options` type.

```ts
interface Options {
  /** Enable `$...$`. Default: `true`. */
  singleDollarTextMath?: boolean;

  /** Promote direct paragraph `$$...$$` and `\\[...\\]` to blocks. Default: `false`. */
  displayMathInText?: boolean;
}
```

When `displayMathInText` is enabled, direct display-math children split their
paragraph into surrounding paragraphs and block `math` nodes. Display math in
headings, links, table cells, emphasis, and other phrasing-only containers
remains `inlineMath` so the resulting mdast stays valid.

## Compatibility

- Node.js 16 or later at runtime.
- ESM only.
- Standard `inlineMath` and `math` mdast nodes with the same hast data used by
  the unified math ecosystem.

## License

MIT. See `NOTICE` for upstream source attribution.
