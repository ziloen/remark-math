import {ok as assert} from 'devlop'
import type {Element, ElementContent} from 'hast'
import type {
  Nodes,
  Paragraph,
  Parent,
  PhrasingContent,
  Root,
  RootContent
} from 'mdast'
import type {
  CompileContext,
  Extension,
  Handle,
  Transform
} from 'mdast-util-from-markdown'
import type {
  Handle as ToMarkdownHandle,
  Options as ToMarkdownExtension
} from 'mdast-util-to-markdown'
import type {Token} from 'micromark-util-types'
import {longestStreak} from 'longest-streak'
import type {InlineMath, Math, Options} from '../types.js'

interface InternalMathData {
  _displayMath?: boolean
  _rawMath?: string
  hChildren?: ElementContent[]
  hName?: string
  hProperties?: {className: string[]}
}

export function mathFromMarkdown(options?: Options | null): Extension {
  const enterMathText: Handle = function (token): void {
    enterInline.call(this, token, false)
  }
  const enterDisplayMathText: Handle = function (token): void {
    enterInline.call(this, token, true)
  }

  return {
    enter: {
      mathFlow: enterMathFlow,
      mathFlowFenceMeta: enterMathFlowMeta,
      mathText: enterMathText,
      mathTextDisplay: enterDisplayMathText
    },
    exit: {
      mathFlow: exitMathFlow,
      mathFlowFence: exitMathFlowFence,
      mathFlowFenceMeta: exitMathFlowMeta,
      mathFlowValue: exitMathData,
      mathText: exitInline,
      mathTextDisplay: exitInline,
      mathTextData: exitMathData
    },
    transforms: [transformMath(options)]
  }
}

const enterMathFlow: Handle = function (token): void {
  const code: Element = {
    type: 'element',
    tagName: 'code',
    properties: {className: ['language-math', 'math-display']},
    children: []
  }
  this.enter(
    {
      type: 'math',
      meta: null,
      value: '',
      data: {hName: 'pre', hChildren: [code]}
    } as Math,
    token
  )
}

const enterMathFlowMeta: Handle = function (): void {
  this.buffer()
}

const exitMathFlowMeta: Handle = function (): void {
  const value = this.resume()
  const node = this.stack[this.stack.length - 1] as Math
  assert(node.type === 'math')
  node.meta = value
}

const exitMathFlowFence: Handle = function (): void {
  if (this.data.mathFlowInside) return
  this.buffer()
  this.data.mathFlowInside = true
}

const exitMathFlow: Handle = function (token): void {
  const value = this.resume().replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, '')
  const node = this.stack[this.stack.length - 1] as Math
  assert(node.type === 'math')
  this.exit(token)
  node.value = value
  const data = node.data as InternalMathData
  const code = data.hChildren?.[0]
  assert(code?.type === 'element' && code.tagName === 'code')
  code.children.push({type: 'text', value})
  this.data.mathFlowInside = undefined
}

export function mathToMarkdown(options?: Options | null): ToMarkdownExtension {
  const single = options?.singleDollarTextMath ?? true
  const displayMathInText = options?.displayMathInText ?? false

  const math: ToMarkdownHandle = (node: Math, _parent, state, info): string => {
    const raw = node.value
    const tracker = state.createTracker(info)
    const sequence = '$'.repeat(Math.max(longestStreak(raw, '$') + 1, 2))
    const exit = state.enter('mathFlow')
    let value = tracker.move(sequence)

    if (node.meta) {
      const exitMeta = state.enter('mathFlowMeta')
      value += tracker.move(
        state.safe(node.meta, {
          after: '\n',
          before: value,
          encode: ['$'],
          ...tracker.current()
        })
      )
      exitMeta()
    }

    value += tracker.move('\n')
    if (raw) value += tracker.move(raw + '\n')
    value += tracker.move(sequence)
    exit()
    return value
  }

  const inlineMath: ToMarkdownHandle = (
    node: InlineMath,
    parent,
    state
  ): string => {
    let value = node.value
    let size = single ? 1 : 2

    while (true) {
      if (displayMathInText && size === 2) {
        size++
        continue
      }

      const unsafeFence = new RegExp(
        '(^|[^$])' + '\\$'.repeat(size) + '([^$]|$)'
      ).test(value)
      if (!unsafeFence) break
      size++
    }

    const sequence = '$'.repeat(size)

    if (
      displayMathInText &&
      size > 1 &&
      parent?.type === 'paragraph' &&
      parent.children.filter(
        (child) => child.type !== 'text' || child.value.trim() !== ''
      ).length === 1
    ) {
      return '\\(' + value + '\\)'
    }

    if (
      /[^ \r\n]/.test(value) &&
      ((/^[ \r\n]/.test(value) && /[ \r\n]$/.test(value)) ||
        /^\$|\$$/.test(value))
    ) {
      value = ' ' + value + ' '
    }

    let index = -1
    while (++index < state.unsafe.length) {
      const pattern = state.unsafe[index]
      if (!pattern.atBreak) continue
      const expression = state.compilePattern(pattern)
      let match: RegExpExecArray | null
      while ((match = expression.exec(value))) {
        let position = match.index
        if (
          value.codePointAt(position) === 10 &&
          value.codePointAt(position - 1) === 13
        ) {
          position--
        }
        value = value.slice(0, position) + ' ' + value.slice(match.index + 1)
      }
    }

    return sequence + value + sequence
  }

  const inlineMathHandler = inlineMath as ToMarkdownHandle & {
    peek?: () => string
  }
  inlineMathHandler.peek = (): string => '$'

  return {
    unsafe: [
      {character: '\r', inConstruct: 'mathFlowMeta'},
      {character: '\n', inConstruct: 'mathFlowMeta'},
      {
        character: '$',
        after: single ? undefined : '\\$',
        inConstruct: 'phrasing'
      },
      {character: '$', inConstruct: 'mathFlowMeta'},
      {atBreak: true, character: '$', after: '\\$'}
    ],
    handlers: {math, inlineMath: inlineMathHandler}
  }
}

function enterInline(
  this: CompileContext,
  token: Token,
  display: boolean
): void {
  this.enter(
    {
      type: 'inlineMath',
      value: '',
      data: {
        _displayMath: display || undefined,
        _rawMath: this.sliceSerialize(token),
        hName: 'code',
        hProperties: {className: ['language-math', 'math-inline']},
        hChildren: []
      }
    } as InlineMath,
    token
  )
  this.buffer()
}

const exitInline: Handle = function (token): void {
  const value = this.resume()
  const node = this.stack[this.stack.length - 1] as InlineMath
  assert(node.type === 'inlineMath')
  this.exit(token)
  node.value = value
  const data = node.data as InternalMathData
  assert(data.hChildren)
  data.hChildren.push({type: 'text', value})
}

const exitMathData: Handle = function (token): void {
  this.config.enter.data.call(this, token)
  this.config.exit.data.call(this, token)
}

function transformMath(options?: Options | null): Transform {
  const displayMathInText = options?.displayMathInText ?? false

  return function transform(tree: Root): Root {
    restoreInlineHtmlMath(tree)
    transformParent(tree, displayMathInText)
    return tree
  }
}

function transformParent(parent: Parent, displayMathInText: boolean): void {
  const children: Nodes[] = []

  for (const child of parent.children as Nodes[]) {
    if (child.type === 'paragraph') {
      children.push(...splitParagraph(child, displayMathInText))
      continue
    }

    if ('children' in child) transformParent(child, displayMathInText)
    cleanNested(child as RootContent | PhrasingContent)
    children.push(child)
  }

  parent.children = children as typeof parent.children
}

function restoreInlineHtmlMath(root: Root): void {
  visitPhrasingParents(root)
}

function visitPhrasingParents(node: Parent): void {
  if (node.type === 'paragraph' || node.type === 'heading') {
    const tags: string[] = []
    node.children = processHtmlChildren(node.children, tags) as typeof node.children
    return
  }

  for (const child of node.children as Nodes[]) {
    if ('children' in child) visitPhrasingParents(child)
  }
}

function processHtmlChildren(children: Nodes[], tags: string[]): Nodes[] {
  const result: Nodes[] = []

  for (const child of children) {
    let next: Nodes = child

    if (child.type === 'html') {
      updateHtmlStack(child.value, tags)
    } else if (child.type === 'inlineMath' && tags.length > 0) {
      const data = child.data as InternalMathData | undefined
      next = {
        type: 'text',
        value: (data as InternalMathData)._rawMath as string,
        position: child.position
      }
    } else if ('children' in child) {
      child.children = processHtmlChildren(
        child.children as Nodes[],
        tags
      ) as typeof child.children
    }

    const previous = result[result.length - 1]
    if (previous?.type === 'text' && next.type === 'text') {
      previous.value += next.value
      previous.position!.end = next.position!.end
    } else {
      result.push(next)
    }
  }

  return result
}

const voidHtmlElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

function updateHtmlStack(value: string, tags: string[]): void {
  const expression = /<(\/)?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?(\/?)>/g
  let match: RegExpExecArray | null

  while ((match = expression.exec(value))) {
    const name = match[2].toLowerCase()
    if (match[1]) {
      const index = tags.lastIndexOf(name)
      if (index !== -1) tags.splice(index)
    } else if (!match[3] && !voidHtmlElements.has(name)) {
      tags.push(name)
    }
  }
}

function splitParagraph(
  paragraph: Paragraph,
  displayMathInText: boolean
): RootContent[] {
  const result: RootContent[] = []
  let phrasing: PhrasingContent[] = []
  let stripLeadingBoundary = false

  const flush = (): void => {
    if (!hasVisibleContent(phrasing)) {
      phrasing = []
      return
    }

    const node: Paragraph = {type: 'paragraph', children: phrasing}
    const first = phrasing[0]
    const last = phrasing[phrasing.length - 1]
    node.position = {start: first.position!.start, end: last.position!.end}
    result.push(node)
    phrasing = []
  }

  for (let index = 0; index < paragraph.children.length; index++) {
    let child = paragraph.children[index]
    if (stripLeadingBoundary && child.type === 'text') {
      child = {
        ...child,
        value: child.value.replace(/^[ \t]*(?:\r?\n|\r)[ \t]*/, '')
      }
      stripLeadingBoundary = false
    }

    const data = child.type === 'inlineMath'
      ? (child.data as InternalMathData | undefined)
      : undefined

    const isolatedDisplay =
      child.type === 'inlineMath' &&
      isBlockFence(data?._rawMath) &&
      isIsolatedLine(paragraph, index)

    if (
      child.type === 'inlineMath' &&
      ((data?._displayMath && displayMathInText) || isolatedDisplay)
    ) {
      if (isolatedDisplay) {
        stripTrailingBoundary(phrasing)
        stripLeadingBoundary = true
      }
      flush()
      result.push(promote(child))
      continue
    }

    cleanNested(child)
    phrasing.push(child)
  }

  flush()
  if (result.length === 1 && result[0].type === 'paragraph') {
    result[0].position = paragraph.position
  }
  return result
}

function isBlockFence(raw: string | undefined): boolean {
  const value = raw as string
  return value.startsWith('\\[') || /^\${2,}/.test(value)
}

function isIsolatedLine(paragraph: Paragraph, index: number): boolean {
  const child = paragraph.children[index]
  const previous = paragraph.children[index - 1]
  const next = paragraph.children[index + 1]
  const startsLine =
    !previous ||
    (previous.type === 'text' &&
      previous.value.slice(previous.value.lastIndexOf('\n') + 1).trim() === '')
  const firstLineBreak = next?.type === 'text' ? next.value.indexOf('\n') : -1
  const endsLine =
    !next ||
    (next.type === 'text' &&
      next.value
        .slice(0, firstLineBreak === -1 ? next.value.length : firstLineBreak)
        .trim() === '')

  return startsLine && endsLine && child.type === 'inlineMath'
}

function stripTrailingBoundary(children: PhrasingContent[]): void {
  const last = children[children.length - 1]
  if (last?.type !== 'text') return
  last.value = last.value.replace(/[ \t]*(?:\r?\n|\r)[ \t]*$/, '')
  children.length -= Number(last.value === '')
}

function promote(node: InlineMath): Math {
  const code: Element = {
    type: 'element',
    tagName: 'code',
    properties: {className: ['language-math', 'math-display']},
    children: [{type: 'text', value: node.value}]
  }
  return {
    type: 'math',
    meta: null,
    value: node.value,
    data: {hName: 'pre', hChildren: [code]},
    position: node.position
  }
}

function cleanNested(node: RootContent | PhrasingContent): void {
  if (node.type === 'inlineMath') {
    const data = node.data as InternalMathData
    delete data._displayMath
    delete data._rawMath
    return
  }

  if ('children' in node) {
    for (const child of node.children) cleanNested(child)
  }
}

function hasVisibleContent(children: PhrasingContent[]): boolean {
  return children.some((child) => child.type !== 'text' || child.value.trim() !== '')
}

declare module 'mdast-util-from-markdown' {
  interface CompileData {
    mathFlowInside?: boolean
  }
}

declare module 'mdast-util-to-markdown' {
  interface ConstructNameMap {
    mathFlow: 'mathFlow'
    mathFlowMeta: 'mathFlowMeta'
  }
}
