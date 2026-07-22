import { ok as assert } from 'devlop'
import { markdownLineEnding } from 'micromark-util-character'
import { codes, types } from 'micromark-util-symbol'
import type {
  Construct,
  Effects,
  Previous,
  Resolver,
  State,
  Token,
  TokenizeContext,
} from 'micromark-util-types'
import type { Options } from '../types.js'

export function mathText(options?: Options | null): Construct {
  const single = options?.singleDollarTextMath ?? true

  return {
    name: 'mathText',
    previous: previousDollar,
    resolve: resolveMathText,
    tokenize: tokenize,
  }

  function tokenize(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
  ): State {
    const self = this
    const previousCode = self.previous
    let sizeOpen = 0
    let sizeClose = 0
    let hasContent = false
    let backslashRun = 0
    let candidate: Token
    let container: Token
    let opener: Token

    return start

    function start(code: number | null): State | undefined {
      assert(code === codes.dollarSign)
      container = effects.enter('mathText')
      opener = effects.enter('mathTextSequence')
      return open(code)
    }

    function open(code: number | null): State | undefined {
      if (code === codes.dollarSign) {
        effects.consume(code)
        sizeOpen++
        return open
      }

      if (sizeOpen < 2 && !single) return nok(code)
      if (sizeOpen === 1 && isAsciiWord(previousCode)) return nok(code)

      effects.exit('mathTextSequence')
      if (sizeOpen === 2) {
        container.type = 'mathTextDisplay'
        opener.type = 'mathTextDisplaySequence'
      }

      return between(code)
    }

    function between(code: number | null): State | undefined {
      if (code === codes.eof) return nok(code)

      if (code === codes.dollarSign) {
        if (backslashRun % 2 === 1) {
          effects.enter('mathTextData')
          effects.consume(code)
          effects.exit('mathTextData')
          hasContent = true
          backslashRun = 0
          return between
        }

        candidate = effects.enter(
          sizeOpen === 2 ? 'mathTextDisplaySequence' : 'mathTextSequence',
        )
        sizeClose = 0
        return close(code)
      }

      if (code === codes.space) {
        effects.enter('space')
        effects.consume(code)
        effects.exit('space')
        hasContent = true
        backslashRun = 0
        return between
      }

      if (markdownLineEnding(code)) {
        effects.enter(types.lineEnding)
        effects.consume(code)
        effects.exit(types.lineEnding)
        hasContent = true
        backslashRun = 0
        return between
      }

      effects.enter('mathTextData')
      return data(code)
    }

    function data(code: number | null): State | undefined {
      if (
        code === codes.eof ||
        code === codes.space ||
        code === codes.dollarSign ||
        markdownLineEnding(code)
      ) {
        effects.exit('mathTextData')
        return between(code)
      }

      effects.consume(code)
      hasContent = true
      backslashRun = code === codes.backslash ? backslashRun + 1 : 0
      return data
    }

    function close(code: number | null): State | undefined {
      if (code === codes.dollarSign) {
        effects.consume(code)
        sizeClose++
        return close
      }

      if (sizeClose === sizeOpen) {
        if (
          sizeOpen === 1 &&
          (code === codes.dollarSign || isAsciiWord(code))
        ) {
          return nok(code)
        }

        effects.exit(
          sizeOpen === 2 ? 'mathTextDisplaySequence' : 'mathTextSequence',
        )
        effects.exit(sizeOpen === 2 ? 'mathTextDisplay' : 'mathText')
        return ok(code)
      }

      candidate.type = 'mathTextData'
      hasContent = true
      backslashRun = 0
      return data(code)
    }
  }
}

export function latexMathText(display: boolean): Construct {
  const exhausted = new WeakSet<TokenizeContext>()
  const closeMarker = display
    ? codes.rightSquareBracket
    : codes.rightParenthesis
  const containerType = display ? 'mathTextDisplay' : 'mathText'
  const sequenceType = display ? 'mathTextDisplaySequence' : 'mathTextSequence'

  return {
    name: display ? 'mathTextDisplayLatex' : 'mathTextLatex',
    resolve: resolveMathText,
    tokenize,
  }

  function tokenize(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
  ): State {
    const self = this
    let hasContent = false
    let backslashRun = 0
    let slashesBefore = 0
    let candidate: Token

    if (exhausted.has(self)) return nok

    return start

    function start(code: number | null): State | undefined {
      assert(code === codes.backslash)
      effects.enter(containerType)
      effects.enter(sequenceType)
      effects.consume(code)
      return openMarker
    }

    function openMarker(code: number | null): State | undefined {
      const expected = display ? codes.leftSquareBracket : codes.leftParenthesis
      if (code !== expected) return nok(code)
      effects.consume(code)
      effects.exit(sequenceType)
      return content
    }

    function content(code: number | null): State | undefined {
      if (code === codes.eof) {
        exhausted.add(self)
        return nok(code)
      }

      if (code === codes.backslash) {
        slashesBefore = backslashRun
        candidate = effects.enter(sequenceType)
        effects.consume(code)
        return afterSlash
      }

      if (code === codes.space) {
        effects.enter('space')
        effects.consume(code)
        effects.exit('space')
        hasContent = true
        backslashRun = 0
        return content
      }

      if (markdownLineEnding(code)) {
        effects.enter(types.lineEnding)
        effects.consume(code)
        effects.exit(types.lineEnding)
        hasContent = true
        backslashRun = 0
        return content
      }

      effects.enter('mathTextData')
      return data(code)
    }

    function data(code: number | null): State | undefined {
      if (
        code === codes.eof ||
        code === codes.space ||
        code === codes.backslash ||
        markdownLineEnding(code)
      ) {
        effects.exit('mathTextData')
        return content(code)
      }

      effects.consume(code)
      hasContent = true
      backslashRun = 0
      return data
    }

    function afterSlash(code: number | null): State | undefined {
      if (code === closeMarker && slashesBefore % 2 === 0) {
        if (!hasContent) return nok(code)
        effects.consume(code)
        effects.exit(sequenceType)
        effects.exit(containerType)
        return ok
      }

      candidate.type = 'mathTextData'
      effects.exit('mathTextData')
      hasContent = true
      backslashRun = slashesBefore + 1
      return content(code)
    }
  }
}

const resolveMathText: Resolver = (events) => {
  let tailExitIndex = events.length - 4
  let headEnterIndex = 3
  let enter: number | undefined

  if (
    (events[headEnterIndex][1].type === types.lineEnding ||
      events[headEnterIndex][1].type === 'space') &&
    (events[tailExitIndex][1].type === types.lineEnding ||
      events[tailExitIndex][1].type === 'space')
  ) {
    let index = headEnterIndex
    while (++index < tailExitIndex) {
      if (events[index][1].type === 'mathTextData') {
        events[tailExitIndex][1].type = 'mathTextPadding'
        events[headEnterIndex][1].type = 'mathTextPadding'
        headEnterIndex += 2
        tailExitIndex -= 2
        break
      }
    }
  }

  let index = headEnterIndex - 1
  tailExitIndex++
  while (++index <= tailExitIndex) {
    if (enter === undefined) {
      if (
        index !== tailExitIndex &&
        events[index][1].type !== types.lineEnding
      ) {
        enter = index
      }
    } else if (
      index === tailExitIndex ||
      events[index][1].type === types.lineEnding
    ) {
      events[enter][1].type = 'mathTextData'
      if (index !== enter + 2) {
        events[enter][1].end = events[index - 1][1].end
        events.splice(enter + 2, index - enter - 2)
        tailExitIndex -= index - enter - 2
        index = enter + 2
      }
      enter = undefined
    }
  }

  return events
}

const previousDollar: Previous = function (code) {
  if (code !== codes.dollarSign && code !== codes.backslash) return true
  return this.events[this.events.length - 1]?.[1].type === types.characterEscape
}

function isAsciiWord(code: number | null): boolean {
  return (
    (code !== null && code >= codes.digit0 && code <= codes.digit9) ||
    (code !== null && code >= codes.uppercaseA && code <= codes.uppercaseZ) ||
    (code !== null && code >= codes.lowercaseA && code <= codes.lowercaseZ) ||
    code === codes.underscore
  )
}
