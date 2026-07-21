import {ok as assert} from 'devlop'
import {factorySpace} from 'micromark-factory-space'
import {markdownLineEnding} from 'micromark-util-character'
import {codes} from 'micromark-util-symbol/codes.js'
import {constants} from 'micromark-util-symbol/constants.js'
import {types} from 'micromark-util-symbol/types.js'
import type {
  Construct,
  Effects,
  State,
  TokenizeContext,
  Tokenizer
} from 'micromark-util-types'

export const mathFlow: Construct = {
  concrete: true,
  name: 'mathFlow',
  tokenize: tokenizeMathFlow
}

const nonLazyContinuation: Construct = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
}

function tokenizeMathFlow(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State
): State {
  const self = this
  const tail = self.events[self.events.length - 1]
  const initialSize =
    tail?.[1].type === types.linePrefix
      ? tail[2].sliceSerialize(tail[1], true).length
      : 0
  let sizeOpen = 0

  return start

  function start(code: number | null): State | void {
    assert(code === codes.dollarSign)
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    return sequenceOpen(code)
  }

  function sequenceOpen(code: number | null): State | void {
    if (code === codes.dollarSign) {
      effects.consume(code)
      sizeOpen++
      return sequenceOpen
    }
    if (sizeOpen < 2) return nok(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, beforeMeta, types.whitespace)(code)
  }

  function beforeMeta(code: number | null): State | void {
    if (code === codes.eof || markdownLineEnding(code)) return afterMeta(code)
    effects.enter('mathFlowFenceMeta')
    effects.enter(types.chunkString, {contentType: constants.contentTypeString})
    return meta(code)
  }

  function meta(code: number | null): State | void {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types.chunkString)
      effects.exit('mathFlowFenceMeta')
      return afterMeta(code)
    }
    if (code === codes.dollarSign) return nok(code)
    effects.consume(code)
    return meta
  }

  function afterMeta(code: number | null): State | void {
    effects.exit('mathFlowFence')
    if (code === codes.eof) return nok(code)
    if (self.interrupt) return ok(code)
    return effects.attempt(
      nonLazyContinuation,
      beforeContinuation,
      nok
    )(code)
  }

  function beforeContinuation(code: number | null): State | void {
    return effects.attempt(
      {partial: true, tokenize: tokenizeClosingFence},
      afterClose,
      contentStart
    )(code)
  }

  function contentStart(code: number | null): State | void {
    return (initialSize
      ? factorySpace(
          effects,
          beforeContent,
          types.linePrefix,
          initialSize + 1
        )
      : beforeContent)(code)
  }

  function beforeContent(code: number | null): State | void {
    if (code === codes.eof) return nok(code)
    if (markdownLineEnding(code)) {
      return effects.attempt(
        nonLazyContinuation,
        beforeContinuation,
        nok
      )(code)
    }
    effects.enter('mathFlowValue')
    return content(code)
  }

  function content(code: number | null): State | void {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit('mathFlowValue')
      return beforeContent(code)
    }
    effects.consume(code)
    return content
  }

  function afterClose(code: number | null): State | void {
    effects.exit('mathFlow')
    return ok(code)
  }

  function tokenizeClosingFence(
    effects: Effects,
    ok: State,
    nok: State
  ): State {
    let size = 0
    assert(self.parser.constructs.disable.null)
    return factorySpace(
      effects,
      beforeClose,
      types.linePrefix,
      self.parser.constructs.disable.null.includes('codeIndented')
        ? undefined
        : constants.tabSize
    )

    function beforeClose(code: number | null): State | void {
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      return closeSequence(code)
    }

    function closeSequence(code: number | null): State | void {
      if (code === codes.dollarSign) {
        size++
        effects.consume(code)
        return closeSequence
      }
      if (size < sizeOpen) return nok(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterCloseSequence, types.whitespace)(code)
    }

    function afterCloseSequence(code: number | null): State | void {
      if (code === codes.eof || markdownLineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }
      return nok(code)
    }
  }
}

function tokenizeNonLazyContinuation(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State
): State {
  const self = this
  return start

  function start(code: number | null): State | void {
    assert(markdownLineEnding(code))
    effects.enter(types.lineEnding)
    effects.consume(code)
    effects.exit(types.lineEnding)
    return lineStart
  }

  function lineStart(code: number | null): State | void {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
  }
}
