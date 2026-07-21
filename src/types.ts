import type {Data, Literal} from 'mdast'

export interface Options {
  singleDollarTextMath?: boolean
  displayMathInText?: boolean
}

export interface Math extends Literal {
  type: 'math'
  meta?: string | null | undefined
  data?: MathData | undefined
}

export interface MathData extends Data {}

export interface InlineMath extends Literal {
  type: 'inlineMath'
  data?: InlineMathData | undefined
}

export interface InlineMathData extends Data {}

declare module 'mdast' {
  interface BlockContentMap {
    math: Math
  }

  interface PhrasingContentMap {
    inlineMath: InlineMath
  }

  interface RootContentMap {
    inlineMath: InlineMath
    math: Math
  }
}

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mathFlow: 'mathFlow'
    mathFlowFence: 'mathFlowFence'
    mathFlowFenceMeta: 'mathFlowFenceMeta'
    mathFlowFenceSequence: 'mathFlowFenceSequence'
    mathFlowValue: 'mathFlowValue'
    mathText: 'mathText'
    mathTextData: 'mathTextData'
    mathTextDisplay: 'mathTextDisplay'
    mathTextDisplaySequence: 'mathTextDisplaySequence'
    mathTextPadding: 'mathTextPadding'
    mathTextSequence: 'mathTextSequence'
  }
}
