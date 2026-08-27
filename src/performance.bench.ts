import type { Parent, Root } from 'mdast'
import { parse, postprocess, preprocess } from 'micromark'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { bench, describe } from 'vitest'
import remarkMath from './index.js'
import { mathFromMarkdown } from './mdast-util-math/index.js'
import { math } from './micromark-extension-math/index.js'

const steady = {
  iterations: 5,
  time: 300,
  warmupIterations: 2,
  warmupTime: 100,
}

const scaling = {
  iterations: 3,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
}

const parseProcessor = unified().use(remarkParse).use(remarkMath).freeze()
const stringifyProcessor = unified()
  .use(remarkStringify)
  .use(remarkMath, {
    displayMathInText: true,
    singleDollarTextMath: false,
  })
  .freeze()

describe('dense formula parsing', () => {
  for (const count of [1_000, 10_000]) {
    const inputs = {
      dollar: '$x$ '.repeat(count),
      doubleDollar: '$$x$$ '.repeat(count),
      latex: String.raw`\(x\) `.repeat(count),
    }

    for (const [kind, input] of Object.entries(inputs)) {
      bench(
        `${kind}: ${count.toLocaleString('en-US')} formulas`,
        () => {
          parseProcessor.parse(input)
        },
        count === 1_000 ? steady : scaling,
      )
    }
  }
})

describe('multiline resolver scaling', () => {
  for (const lines of [500, 2_000, 8_000]) {
    const input = '$\n' + 'x + y\n'.repeat(lines) + '$'

    bench(
      `${lines.toLocaleString('en-US')} lines`,
      () => {
        parseMathEvents(input)
      },
      scaling,
    )
  }
})

describe('inline math serialization scaling', () => {
  for (const count of [500, 2_000, 8_000]) {
    const tree = denseInlineMathTree(count)

    bench(
      `${count.toLocaleString('en-US')} siblings`,
      () => {
        stringifyProcessor.stringify(tree)
      },
      scaling,
    )
  }
})

describe('nested transform scaling', () => {
  const transform = mathFromMarkdown({
    displayMathInText: true,
  }).transforms?.[0]

  if (!transform) throw new Error('Expected a math AST transform')

  for (const depth of [100, 400, 1_600]) {
    bench(
      `${depth.toLocaleString('en-US')} parents`,
      () => {
        transform(deepTree(depth))
      },
      scaling,
    )
  }
})

describe('failed opener scaling', () => {
  for (const count of [250, 1_000, 4_000]) {
    const unclosedDollar = '$x '.repeat(count)
    const ordinaryBackslash = String.raw`\x `.repeat(count)

    bench(
      `unclosed dollar: ${count.toLocaleString('en-US')} openers`,
      () => {
        parseMathEvents(unclosedDollar)
      },
      scaling,
    )

    bench(
      `ordinary backslash: ${count.toLocaleString('en-US')} characters`,
      () => {
        parseMathEvents(ordinaryBackslash)
      },
      scaling,
    )
  }
})

function parseMathEvents(value: string): void {
  const parser = parse({ extensions: [math()] })
  postprocess(parser.document().write(preprocess()(value, undefined, true)))
}

function denseInlineMathTree(count: number): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: count }, () => ({
          type: 'inlineMath' as const,
          value: 'x',
        })),
      },
    ],
  }
}

function deepTree(depth: number): Root {
  let child = {
    type: 'paragraph',
    children: [
      {
        type: 'inlineMath',
        value: 'x',
        data: { _displayMath: true, _rawMath: '$$x$$' },
      },
    ],
  } as unknown as Parent

  for (let index = 0; index < depth; index++) {
    child = { type: 'blockquote', children: [child] } as Parent
  }

  return { type: 'root', children: [child] } as Root
}
