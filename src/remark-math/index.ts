import type {Processor} from 'unified'
import {
  mathFromMarkdown,
  mathToMarkdown
} from '../mdast-util-math/index.js'
import {math} from '../micromark-extension-math/index.js'
import type {Options} from '../types.js'

const emptyOptions: Readonly<Options> = {}

export default function remarkMath(
  this: Processor,
  options?: Readonly<Options> | null
): undefined {
  const settings = options ?? emptyOptions
  const data = this.data()

  add('micromarkExtensions', math(settings))
  add('fromMarkdownExtensions', mathFromMarkdown(settings))
  add('toMarkdownExtensions', mathToMarkdown(settings))

  function add(
    field:
      | 'micromarkExtensions'
      | 'fromMarkdownExtensions'
      | 'toMarkdownExtensions',
    value: unknown
  ): void {
    const list = (data[field] ?? (data[field] = [])) as unknown[]
    list.push(value)
  }
}
