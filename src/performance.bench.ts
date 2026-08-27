import type { Parent, Root } from 'mdast'
import { parse, postprocess, preprocess } from 'micromark'
import type { Event } from 'micromark-util-types'
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
  iterations: 10,
  time: 300,
  warmupIterations: 3,
  warmupTime: 100,
}

const parseProcessor = unified().use(remarkParse).use(remarkMath).freeze()
const mdastOnlyParseProcessor = unified()
  .use(remarkParse)
  .use(remarkMath, { addHastData: false })
  .freeze()
const displayParseProcessor = unified()
  .use(remarkParse)
  .use(remarkMath, { displayMathInText: true })
  .freeze()
const mdastOnlyDisplayParseProcessor = unified()
  .use(remarkParse)
  .use(remarkMath, { addHastData: false, displayMathInText: true })
  .freeze()
const stringifyProcessor = unified()
  .use(remarkStringify)
  .use(remarkMath, {
    displayMathInText: true,
    singleDollarTextMath: false,
  })
  .freeze()
const mathParser = parse({ extensions: [math()] })

validateBenchmarkFixtures()

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

describe('hast metadata allocation', () => {
  const input = '$x$ '.repeat(10_000)
  const promotedInput = '$$x$$ '.repeat(10_000)

  bench(
    'default hast data: 10,000 formulas',
    () => {
      parseProcessor.parse(input)
    },
    steady,
  )

  bench(
    'without hast data: 10,000 formulas',
    () => {
      mdastOnlyParseProcessor.parse(input)
    },
    steady,
  )

  bench(
    'default hast data: 10,000 promoted formulas',
    () => {
      displayParseProcessor.parse(promotedInput)
    },
    steady,
  )

  bench(
    'without hast data: 10,000 promoted formulas',
    () => {
      mdastOnlyDisplayParseProcessor.parse(promotedInput)
    },
    steady,
  )
})

describe('multiline resolver scaling', () => {
  for (const lines of [500, 2_000, 8_000]) {
    const input = '$\n' + 'x + y\n'.repeat(lines) + '$'

    bench(
      `${lines.toLocaleString('en-US')} lines`,
      () => {
        parseMathEvents(input)
      },
      steady,
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

describe('inline fence selection', () => {
  const longTree = separatedInlineMathTree(1_000, 'x'.repeat(1_000))
  const dollarTree = separatedInlineMathTree(1_000, 'a$b$$c$$$d')

  bench(
    '1,000 formulas with 1,000 dollar-free characters',
    () => {
      stringifyProcessor.stringify(longTree)
    },
    steady,
  )

  bench(
    '1,000 formulas with dollar runs 1 through 3',
    () => {
      stringifyProcessor.stringify(dollarTree)
    },
    steady,
  )
})

describe('nested transform scaling', () => {
  const transform = mathFromMarkdown({
    displayMathInText: true,
  }).transforms?.[0]

  if (!transform) throw new Error('Expected a math AST transform')

  for (const depth of [100, 400, 1_600]) {
    const tree = deepTree(depth)
    transform(tree)

    bench(
      `${depth.toLocaleString('en-US')} stable parents`,
      () => {
        transform(tree)
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
      `word-boundary-rejected dollar: ${count.toLocaleString('en-US')} openers`,
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

describe('LaTeX text dispatch', () => {
  const count = 10_000
  const inputs = {
    inline: String.raw`\(x\) `.repeat(count),
    display: String.raw`\[x\] `.repeat(count),
    ordinaryBackslash: String.raw`\x `.repeat(count),
  }

  for (const [kind, input] of Object.entries(inputs)) {
    bench(
      `${kind}: ${count.toLocaleString('en-US')} sequences`,
      () => {
        parseMathEvents(input)
      },
      steady,
    )
  }
})

describe('adversarial dollar fence scaling', () => {
  for (const count of [50, 100, 200]) {
    const input = distinctDollarFenceInput(count)
    const bytes = input.length

    bench(
      `${count.toLocaleString('en-US')} distinct fence sizes (${bytes.toLocaleString('en-US')} bytes)`,
      () => {
        parseMathEvents(input)
      },
      scaling,
    )
  }
})

describe('flow continuation checks', () => {
  const lines = 10_000
  const inputs = {
    dollar: '$$\n' + 'x\n'.repeat(lines) + '$$',
    latex: '\\[\n' + 'x\n'.repeat(lines) + '\\]',
  }

  for (const [kind, input] of Object.entries(inputs)) {
    bench(
      `${kind}: ${lines.toLocaleString('en-US')} lines`,
      () => {
        parseMathEvents(input)
      },
      steady,
    )
  }
})

describe('block fence detection', () => {
  const transform = mathFromMarkdown().transforms?.[0]
  if (!transform) throw new Error('Expected a math AST transform')

  bench(
    '50,000 non-block inline fences: fixture only',
    () => {
      denseRawMathTree(50_000, '$x$')
    },
    steady,
  )

  bench(
    '50,000 non-block inline fences: fixture + transform',
    () => {
      transform(denseRawMathTree(50_000, '$x$'))
    },
    steady,
  )
})

describe('backslash parity tracking', () => {
  const count = 5_000
  const slashes = '\\'.repeat(32)
  const inputs = {
    dollar: ('$' + slashes + '$ ').repeat(count),
    latex: ('\\(' + slashes + '\\) ').repeat(count),
  }

  for (const [kind, input] of Object.entries(inputs)) {
    bench(
      `${kind}: ${count.toLocaleString('en-US')} formulas`,
      () => {
        parseMathEvents(input)
      },
      steady,
    )
  }
})

function parseMathEvents(value: string): Event[] {
  return postprocess(
    mathParser.document().write(preprocess()(value, undefined, true)),
  )
}

function validateBenchmarkFixtures(): void {
  assertEqual(countMathEvents('$x$ '.repeat(3), 'mathText'), 3)
  assertEqual(countMathEvents('$$x$$ '.repeat(3), 'mathTextDisplay'), 3)
  assertEqual(countMathEvents(String.raw`\(x\) `.repeat(3), 'mathText'), 3)
  assertEqual(countMathEvents('$\nx + y\n$', 'mathText'), 1)
  assertEqual(countMathEvents('$x '.repeat(3)), 0)
  assertEqual(countMathEvents(distinctDollarFenceInput(10)), 0)
  assertEqual(countMathEvents('$$\nx\n$$', 'mathFlow'), 1)
  assertEqual(countMathEvents('\\[\nx\n\\]', 'mathFlow'), 1)

  const slashes = '\\'.repeat(32)
  assertEqual(countMathEvents(('$' + slashes + '$ ').repeat(3)), 3)
  assertEqual(countMathEvents(('\\(' + slashes + '\\) ').repeat(3)), 3)
}

function assertEqual(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(
      `Invalid benchmark fixture: expected ${expected}, got ${actual}`,
    )
  }
}

function countMathEvents(
  value: string,
  expectedType?: 'mathFlow' | 'mathText' | 'mathTextDisplay',
): number {
  return parseMathEvents(value).filter(
    (event) =>
      event[0] === 'enter' &&
      (expectedType
        ? event[1].type === expectedType
        : event[1].type === 'mathFlow' ||
          event[1].type === 'mathText' ||
          event[1].type === 'mathTextDisplay'),
  ).length
}

function distinctDollarFenceInput(count: number): string {
  return Array.from(
    { length: count },
    (_, index) => '$'.repeat(index + 1) + 'x',
  ).join(' ')
}

function denseInlineMathTree(count: number, value = 'x'): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: count }, () => ({
          type: 'inlineMath' as const,
          value,
        })),
      },
    ],
  }
}

function separatedInlineMathTree(count: number, value: string): Root {
  return {
    type: 'root',
    children: Array.from({ length: count }, () => ({
      type: 'paragraph' as const,
      children: [{ type: 'inlineMath' as const, value }],
    })),
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

function denseRawMathTree(count: number, raw: string): Root {
  const position = {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 2, offset: 1 },
  }

  return {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: Array.from({ length: count }, () => ({
          type: 'inlineMath',
          value: 'x',
          data: { _rawMath: raw },
          position,
        })),
        position,
      },
    ],
  } as unknown as Root
}
