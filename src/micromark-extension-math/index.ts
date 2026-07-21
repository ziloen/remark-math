import {codes} from 'micromark-util-symbol/codes.js'
import type {Extension} from 'micromark-util-types'
import type {Options} from '../types.js'
import {latexMathFlow} from './latex-flow.js'
import {mathFlow} from './math-flow.js'
import {latexMathText, mathText} from './math-text.js'

export function math(options?: Options | null): Extension {
  return {
    flow: {
      [codes.backslash]: latexMathFlow,
      [codes.dollarSign]: mathFlow
    },
    text: {
      [codes.dollarSign]: mathText(options),
      [codes.backslash]: [latexMathText(false), latexMathText(true)]
    }
  }
}
