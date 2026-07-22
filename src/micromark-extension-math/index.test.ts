import { parse, postprocess, preprocess } from 'micromark'
import type { Event, Extension } from 'micromark-util-types'
import { describe, expect, it } from 'vitest'
import type { Options } from '../types.js'
import { math } from './index.js'

function mathTokens(
  value: string,
  options?: Options,
  extension: Extension = math(options),
): string[] {
  const parser = parse({ extensions: [extension] })
  const events = postprocess(
    parser.document().write(preprocess()(value, undefined, true)),
  )

  return events
    .filter(
      (event: Event) =>
        event[0] === 'enter' &&
        (event[1].type === 'mathText' || event[1].type === 'mathTextDisplay'),
    )
    .map((event: Event) => event[2].sliceSerialize(event[1]))
}

function flowTokens(value: string, disableIndented = false): string[] {
  const parser = parse({
    extensions: [
      math(),
      ...(disableIndented ? [{ disable: { null: ['codeIndented'] } }] : []),
    ],
  })
  const events = postprocess(
    parser.document().write(preprocess()(value, undefined, true)),
  )
  return events
    .filter(
      (event: Event) => event[0] === 'enter' && event[1].type === 'mathFlow',
    )
    .map((event: Event) => event[2].sliceSerialize(event[1]))
}

describe('math syntax', () => {
  it('uses VS Code dollar boundary rules', () => {
    expect(mathTokens('$x$ ($y$), $123, $123')).toEqual(['$x$', '$y$'])
    expect(mathTokens('a$x$ $x$y _$z$')).toEqual([])
    expect(mathTokens('中$x$文')).toEqual(['$x$'])
  })

  it('supports LaTeX delimiters with backslash parity', () => {
    expect(mathTokens(String.raw`\(x\) \[y\]`)).toEqual([
      String.raw`\(x\)`,
      String.raw`\[y\]`,
    ])
    expect(mathTokens(String.raw`\\(x\\)`)).toEqual([])
    expect(mathTokens(String.raw`\\\(x\\\)`)).toEqual([String.raw`\(x\\\)`])
  })

  it('keeps repeated unclosed LaTeX delimiters as text', () => {
    expect(mathTokens(String.raw`\(a`.repeat(200))).toEqual([])
    expect(mathTokens(String.raw`\[a`.repeat(200))).toEqual([])
  })

  it('scopes exhausted LaTeX closers to their text context and kind', () => {
    const extension = math()

    expect(
      mathTokens(String.raw`\(open

\(closed\)`),
    ).toEqual([String.raw`\(closed\)`])
    expect(mathTokens(String.raw`\(open \[display\]`)).toEqual([
      String.raw`\[display\]`,
    ])
    expect(mathTokens(String.raw`\[open \(inline\)`)).toEqual([
      String.raw`\(inline\)`,
    ])
    expect(mathTokens(String.raw`\(open`, undefined, extension)).toEqual([])
    expect(mathTokens(String.raw`\(closed\)`, undefined, extension)).toEqual([
      String.raw`\(closed\)`,
    ])
  })

  it('supports configured fence sizes and rejects empty or unclosed content', () => {
    expect(mathTokens('$a$ $$b$$ $$$c$$$')).toEqual(['$a$', '$$b$$', '$$$c$$$'])
    expect(
      mathTokens('$a$ $$b$$ $$$c$$$', { singleDollarTextMath: false }),
    ).toEqual(['$$b$$', '$$$c$$$'])
    expect(mathTokens(String.raw`$$ \(\) \[\] $$$$$$`)).toEqual([])
    expect(mathTokens(String.raw`$ $ \( \) \[ \]`)).toEqual([
      '$ $',
      String.raw`\( \)`,
      String.raw`\[ \]`,
    ])
    expect(mathTokens(String.raw`$a \(b \[c`)).toEqual([])
  })

  it('skips escaped dollar closers and permits soft line endings', () => {
    expect(mathTokens(String.raw`$a\$ b$`)).toEqual([String.raw`$a\$ b$`])
    expect(mathTokens(String.raw`$a\\$ b$`)).toEqual([String.raw`$a\\$`])
    expect(mathTokens('$a\nb$')).toEqual(['$a\nb$'])
    expect(mathTokens('`$a$`')).toEqual([])
  })

  it('falls through from same-line LaTeX flow and honors disabled indented code', () => {
    expect(mathTokens(String.raw`\[a\]`)).toEqual([String.raw`\[a\]`])
    expect(flowTokens('    $$\n    a\n    $$', true)).toHaveLength(1)
    expect(flowTokens('    \\[\n    a\n    \\]', true)).toHaveLength(1)
  })

  it('rejects lazy block container continuations', () => {
    expect(flowTokens('> $$\na\n> $$')).toEqual([])
    expect(flowTokens('> \\[\na\n> \\]')).toEqual([])
  })
})
