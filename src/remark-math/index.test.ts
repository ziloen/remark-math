import {describe, expect, it} from 'vitest'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {unified} from 'unified'
import remarkMath from '../index.js'

describe('remarkMath', () => {
  it('exposes only the default runtime export', async () => {
    expect(Object.keys(await import('../index.js'))).toEqual(['default'])
  })

  it('configures display math found in paragraph text', () => {
    const source = String.raw`a $$b$$, \[c\] d`
    const inlineTree = unified().use(remarkParse).use(remarkMath).parse(source)
    const displayTree = unified()
      .use(remarkParse)
      .use(remarkMath, {displayMathInText: true})
      .parse(source)

    expect(inlineTree.children.map((node) => node.type)).toEqual(['paragraph'])
    expect(
      displayTree.children.map((node) =>
        node.type === 'math' ? `${node.type}:${node.value}` : node.type
      )
    ).toEqual(['paragraph', 'math:b', 'paragraph', 'math:c', 'paragraph'])
    expect(JSON.stringify(displayTree)).not.toContain('_displayMath')
    expect(JSON.stringify(displayTree)).not.toContain('_rawMath')
  })

  it('parses isolated display delimiters as blocks and requires closing fences', () => {
    const processor = unified().use(remarkParse).use(remarkMath)
    const tree = processor.parse(
      String.raw`$$b$$

\[
c
\]`
    )
    const unclosed = processor.parse(String.raw`$$
b`)
    const multiline = processor.parse(`$$\na\n\nb\n$$`)
    const latexMultiline = processor.parse(`\\[\na\n\nb\n\\]`)

    expect(
      tree.children.map((node) =>
        node.type === 'math' ? `${node.type}:${node.value}` : node.type
      )
    ).toEqual(['math:b', 'math:c'])
    expect(unclosed.children.every((node) => node.type !== 'math')).toBe(true)
    expect(multiline.children).toMatchObject([
      {type: 'math', value: 'a\n\nb'}
    ])
    expect(latexMultiline.children).toMatchObject([
      {type: 'math', value: 'a\n\nb'}
    ])
  })

  it('does not parse math inside inline HTML, code, or autolinks', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .parse('<span>$x$ \\(y\\)</span> and `$z$` <https://e.test/$q$>')

    expect(countMath(tree)).toBe(0)
  })

  it('tracks nested, void, self-closing, and unmatched inline HTML tags', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .parse(
        '<span><em>$x$</em></span><br>$y$ <x/>$z$ </unknown>$q$'
      )

    expect(countMath(tree)).toBe(3)
  })

  it('promotes direct paragraph children recursively and degrades nested phrasing', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath, {displayMathInText: true})
      .parse('- a $$b$$ c\n\n# h $$x$$\n\np *q $$y$$ r*')
    const list = tree.children[0]
    const heading = tree.children[1]
    const paragraph = tree.children[2]

    expect(list).toMatchObject({
      type: 'list',
      children: [
        {children: [{type: 'paragraph'}, {type: 'math'}, {type: 'paragraph'}]}
      ]
    })
    expect(heading).toMatchObject({
      type: 'heading',
      children: [{type: 'text'}, {type: 'inlineMath'}]
    })
    expect(paragraph).toMatchObject({
      type: 'paragraph',
      children: [{type: 'text'}, {type: 'emphasis', children: expect.any(Array)}]
    })
    expect(countMath(paragraph)).toBe(1)
  })

  it('promotes display fences that occupy their own source line', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .parse('before\n$$b$$\nafter\n\nbefore\n$$$c$$$\nafter')

    expect(
      tree.children.map((node) =>
        node.type === 'math' ? `math:${node.value}` : node.type
      )
    ).toEqual([
      'paragraph',
      'math:b',
      'paragraph',
      'paragraph',
      'math:c',
      'paragraph'
    ])
  })

  it('drops whitespace-only split fragments and preserves punctuation', () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkMath, {displayMathInText: true})
    const adjacent = processor.parse('$$a$$ $$b$$')
    const punctuated = processor.parse('a $$b$$, c')

    expect(adjacent.children).toMatchObject([
      {type: 'math', value: 'a'},
      {type: 'math', value: 'b'}
    ])
    expect(punctuated.children).toMatchObject([
      {type: 'paragraph', children: [{type: 'text', value: 'a '}]},
      {type: 'math', value: 'b'},
      {type: 'paragraph', children: [{type: 'text', value: ', c'}]}
    ])
  })

  it('uses singleDollarTextMath only for single-dollar syntax', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath, {singleDollarTextMath: false})
      .parse(String.raw`x $a$ $$b$$ \(c\)`)

    expect(countMath(tree)).toBe(2)
    expect(JSON.stringify(tree)).toContain('$a$')
  })

  it('provides standard hast data without bundling a renderer', async () => {
    const html = await unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process('x $a$\n\n$$\nb\n$$')

    expect(String(html)).toBe(
      '<p>x <code class="language-math math-inline">a</code></p>\n' +
        '<pre><code class="language-math math-display">b</code></pre>'
    )
  })

  it('falls back to inline parsing when a flow closer has trailing text', () => {
    const processor = unified().use(remarkParse).use(remarkMath)
    const dollar = processor.parse('$$\na\n$$ trailing')
    const latex = processor.parse('\\[\na\n\\] trailing')

    expect(countMath(dollar)).toBe(1)
    expect(countMath(latex)).toBe(1)
    expect(dollar.children[0]?.type).toBe('paragraph')
    expect(latex.children[0]?.type).toBe('paragraph')
  })

  it('retains upstream indentation, container, interruption, and fence rules', () => {
    const processor = unified().use(remarkParse).use(remarkMath)
    const indented = processor.parse('  $$\n  a\n  $$')
    const code = processor.parse('    $$\n    a\n    $$')
    const blockquote = processor.parse('> $$\n> a\n> $$')
    const list = processor.parse('- $$\n  a\n  $$')
    const interrupted = processor.parse('before\n$$\na\n$$')
    const longerClose = processor.parse('$$\na\n$$$')

    expect(indented.children[0]?.type).toBe('math')
    expect(countMath(code)).toBe(0)
    expect(countMath(blockquote)).toBe(1)
    expect(countMath(list)).toBe(1)
    expect(interrupted.children.map((node) => node.type)).toEqual([
      'paragraph',
      'math'
    ])
    expect(longerClose.children[0]).toMatchObject({type: 'math', value: 'a'})
  })

  it('applies the same flow rules to LaTeX display fences', () => {
    const processor = unified().use(remarkParse).use(remarkMath)
    const indented = processor.parse('  \\[\n  a\n  \\]')
    const interrupted = processor.parse('before\n\\[\na\n\\]')
    const mismatched = processor.parse('\\[\na\n\\)')

    expect(indented.children[0]?.type).toBe('math')
    expect(interrupted.children.map((node) => node.type)).toEqual([
      'paragraph',
      'math'
    ])
    expect(countMath(mismatched)).toBe(0)
  })

})

function countMath(node: unknown): number {
  if (!node || typeof node !== 'object') return 0
  const record = node as {type?: string; children?: unknown[]}
  const own = record.type === 'math' || record.type === 'inlineMath' ? 1 : 0
  return (
    own +
    (record.children ?? []).reduce<number>(
      (sum, child) => sum + countMath(child),
      0
    )
  )
}
