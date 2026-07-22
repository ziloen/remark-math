import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { bench, describe } from 'vitest'
import realWorldFixture from '../../test/fixtures/real-world-math.md?raw'
import remarkMath from '../index.js'

const processor = unified().use(remarkParse).use(remarkMath).freeze()
const slash = String.fromCharCode(92)
const benchmarkOptions = {
  iterations: 3,
  time: 200,
  warmupIterations: 1,
  warmupTime: 0,
}
const inputs = {
  plain: 'a'.repeat(9600),
  valid: (slash + '(x' + slash + ') ').repeat(1600),
  unclosedInlineSmall: (slash + '(a').repeat(400),
  unclosedInlineLarge: (slash + '(a').repeat(3200),
  unclosedDisplaySmall: (slash + '[a').repeat(400),
  unclosedDisplayLarge: (slash + '[a').repeat(3200),
}

describe('LaTeX math parsing', () => {
  bench(
    'plain text (9.6 kB)',
    () => {
      processor.parse(inputs.plain)
    },
    benchmarkOptions,
  )

  bench(
    'valid inline math (9.6 kB)',
    () => {
      processor.parse(inputs.valid)
    },
    benchmarkOptions,
  )

  bench(
    'real-world nested Markdown (14 kB)',
    () => {
      processor.parse(realWorldFixture)
    },
    benchmarkOptions,
  )

  bench(
    'unclosed inline math (1.2 kB)',
    () => {
      processor.parse(inputs.unclosedInlineSmall)
    },
    benchmarkOptions,
  )

  bench(
    'unclosed inline math (9.6 kB)',
    () => {
      processor.parse(inputs.unclosedInlineLarge)
    },
    benchmarkOptions,
  )

  bench(
    'unclosed display math (1.2 kB)',
    () => {
      processor.parse(inputs.unclosedDisplaySmall)
    },
    benchmarkOptions,
  )

  bench(
    'unclosed display math (9.6 kB)',
    () => {
      processor.parse(inputs.unclosedDisplayLarge)
    },
    benchmarkOptions,
  )
})
