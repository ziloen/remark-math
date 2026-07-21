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
  const micromarkExtensions =
    data.micromarkExtensions ?? (data.micromarkExtensions = [])
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions ?? (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions =
    data.toMarkdownExtensions ?? (data.toMarkdownExtensions = [])

  micromarkExtensions.push(math(settings))
  fromMarkdownExtensions.push(mathFromMarkdown(settings))
  toMarkdownExtensions.push(mathToMarkdown(settings))
}
