import {ok as assert} from 'devlop'
import {factorySpace} from 'micromark-factory-space'
import {markdownLineEnding} from 'micromark-util-character'
import {codes, constants, types} from 'micromark-util-symbol'
import type {
  Construct,
  Effects,
  State,
  TokenizeContext
} from 'micromark-util-types'

export const latexMathFlow: Construct = {
  concrete: true,
  name: 'mathFlowLatex',
  tokenize
}

const continuation: Construct = {partial: true, tokenize: tokenizeContinuation}

function tokenize(
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

  return start

  function start(code: number | null): State | undefined {
    assert(code === codes.backslash)
    effects.enter('mathFlow')
    effects.enter('mathFlowFence')
    effects.enter('mathFlowFenceSequence')
    effects.consume(code)
    return openBracket
  }

  function openBracket(code: number | null): State | undefined {
    if (code !== codes.leftSquareBracket) return nok(code)
    effects.consume(code)
    effects.exit('mathFlowFenceSequence')
    return factorySpace(effects, afterOpen, types.whitespace)
  }

  function afterOpen(code: number | null): State | undefined {
    if (!markdownLineEnding(code)) return nok(code)
    effects.exit('mathFlowFence')
    if (self.interrupt) return ok(code)
    return effects.attempt(continuation, beforeContinuation, nok)(code)
  }

  function beforeContinuation(code: number | null): State | undefined {
    return effects.attempt(
      {partial: true, tokenize: tokenizeClose},
      afterClose,
      contentStart
    )(code)
  }

  function contentStart(code: number | null): State | undefined {
    return (initialSize
      ? factorySpace(
          effects,
          beforeContent,
          types.linePrefix,
          initialSize + 1
        )
      : beforeContent)(code)
  }

  function beforeContent(code: number | null): State | undefined {
    if (code === codes.eof) return nok(code)
    if (markdownLineEnding(code)) {
      return effects.attempt(continuation, beforeContinuation, nok)(code)
    }
    effects.enter('mathFlowValue')
    return content(code)
  }

  function content(code: number | null): State | undefined {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit('mathFlowValue')
      return beforeContent(code)
    }
    effects.consume(code)
    return content
  }

  function afterClose(code: number | null): State | undefined {
    effects.exit('mathFlow')
    return ok(code)
  }

  function tokenizeClose(
    effects: Effects,
    ok: State,
    nok: State
  ): State {
    assert(self.parser.constructs.disable.null)
    return factorySpace(
      effects,
      closeBackslash,
      types.linePrefix,
      self.parser.constructs.disable.null.includes('codeIndented')
        ? undefined
        : constants.tabSize
    )

    function closeBackslash(code: number | null): State | undefined {
      if (code !== codes.backslash) return nok(code)
      effects.enter('mathFlowFence')
      effects.enter('mathFlowFenceSequence')
      effects.consume(code)
      return closeBracket
    }

    function closeBracket(code: number | null): State | undefined {
      if (code !== codes.rightSquareBracket) return nok(code)
      effects.consume(code)
      effects.exit('mathFlowFenceSequence')
      return factorySpace(effects, afterSequence, types.whitespace)
    }

    function afterSequence(code: number | null): State | undefined {
      if (code === codes.eof || markdownLineEnding(code)) {
        effects.exit('mathFlowFence')
        return ok(code)
      }
      return nok(code)
    }
  }
}

function tokenizeContinuation(
  this: TokenizeContext,
  effects: Effects,
  ok: State,
  nok: State
): State {
  const self = this
  return start

  function start(code: number | null): State | undefined {
    assert(markdownLineEnding(code))
    effects.enter(types.lineEnding)
    effects.consume(code)
    effects.exit(types.lineEnding)
    return lineStart
  }

  function lineStart(code: number | null): State | undefined {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code)
  }
}
