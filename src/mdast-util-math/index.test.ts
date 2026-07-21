import {describe, expect, it} from 'vitest'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import {unified} from 'unified'
import remarkMath from '../index.js'

describe('math mdast extensions', () => {
  it('creates upstream-compatible inline and block nodes with metadata', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .parse('Math $a$\n\n$$ meta\nb\n$$')

    expect(tree.children).toMatchObject([
      {
        type: 'paragraph',
        children: [
          {type: 'text', value: 'Math '},
          {
            type: 'inlineMath',
            value: 'a',
            data: {
              hName: 'code',
              hProperties: {className: ['language-math', 'math-inline']},
              hChildren: [{type: 'text', value: 'a'}]
            }
          }
        ]
      },
      {
        type: 'math',
        meta: 'meta',
        value: 'b',
        data: {
          hName: 'pre',
          hChildren: [
            {
              type: 'element',
              tagName: 'code',
              properties: {className: ['language-math', 'math-display']},
              children: [{type: 'text', value: 'b'}]
            }
          ]
        }
      }
    ])
  })

  it('normalizes LaTeX delimiters when stringifying', async () => {
    const output = await unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkMath)
      .process(String.raw`before \(a\) and \[b\] after`)

    expect(String(output)).toBe('before $a$ and $b$ after\n')
  })

  it('avoids a double-dollar inline fence when display promotion is enabled', () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkMath, {displayMathInText: true})
    const markdown = processor.stringify({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{type: 'inlineMath', value: 'a$b'}]
        }
      ]
    })
    const reparsed = processor.parse(markdown)

    expect(markdown).toBe('\\(a$b\\)\n')
    expect(reparsed.children[0]?.type).toBe('paragraph')
  })

  it('chooses safe inline and flow fences around dollar content', () => {
    const processor = unified().use(remarkStringify).use(remarkMath)
    const markdown = processor.stringify({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{type: 'inlineMath', value: '$a$'}]
        },
        {type: 'math', value: '$$'}
      ]
    })

    expect(markdown).toBe('$$ $a$ $$\n\n$$$\n$$\n$$$\n')
  })

  it('serializes flow metadata and normalizes unsafe inline line endings', () => {
    const processor = unified().use(remarkStringify).use(remarkMath)
    const markdown = processor.stringify({
      type: 'root',
      children: [
        {type: 'math', meta: 'meta', value: 'a'},
        {
          type: 'paragraph',
          children: [{type: 'inlineMath', value: 'a\r\n# b'}]
        }
      ]
    })

    expect(markdown).toBe('$$meta\na\n$$\n\n$a # b$\n')
  })

  it('serializes empty values and LF unsafe breaks', () => {
    const markdown = unified()
      .use(remarkStringify)
      .use(remarkMath)
      .stringify({
        type: 'root',
        children: [
          {type: 'math', value: ''},
          {
            type: 'paragraph',
            children: [
              {type: 'inlineMath', value: ''},
              {type: 'text', value: ' '},
              {type: 'inlineMath', value: 'a\n# b'}
            ]
          }
        ]
      })

    expect(markdown).toBe('$$\n$$\n\n$$ $a # b$\n')
  })

  it('removes one padding space around non-blank inline content', () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .parse(String.raw`$ a $ \( b \)`)
    const paragraph = tree.children[0]

    expect(paragraph).toMatchObject({
      type: 'paragraph',
      children: [
        {type: 'inlineMath', value: 'a'},
        {type: 'text', value: ' '},
        {type: 'inlineMath', value: 'b'}
      ]
    })
  })

  it('covers serializer option and padding edge combinations', () => {
    const double = unified()
      .use(remarkStringify)
      .use(remarkMath, {singleDollarTextMath: false})
      .stringify({
        type: 'root',
        children: [
          {type: 'paragraph', children: [{type: 'inlineMath', value: 'a'}]}
        ]
      })
    const latex = unified()
      .use(remarkStringify)
      .use(remarkMath, {displayMathInText: true})
      .stringify({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: ' '},
              {type: 'inlineMath', value: 'a$b'}
            ]
          }
        ]
      })
    const oneSidedSpace = unified()
      .use(remarkStringify)
      .use(remarkMath)
      .stringify({
        type: 'root',
        children: [
          {type: 'paragraph', children: [{type: 'inlineMath', value: ' a'}]}
        ]
      })

    expect(double).toBe('$$a$$\n')
    expect(latex).toContain('\\(a$b\\)')
    expect(oneSidedSpace).toBe('$ a$\n')
  })
})
