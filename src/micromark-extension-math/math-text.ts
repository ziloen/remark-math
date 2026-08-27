import { ok as assert } from 'devlop'
import { markdownLineEnding } from 'micromark-util-character'
import { codes, types } from 'micromark-util-symbol'
import type {
  Construct,
  Effects,
  Point,
  Previous,
  State,
  Token,
  TokenizeContext,
} from 'micromark-util-types'
import type { Options } from '../types.js'

export function mathText(options?: Options | null): Construct {
  const single = options?.singleDollarTextMath ?? true
  const exhaustedSizes = new WeakMap<TokenizeContext, Set<number>>()

  return {
    name: 'mathText',
    previous: previousDollar,
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
    let mismatchedSizes: Map<number, number> | undefined
    let backslashRun = 0
    let candidateStart: Point
    let container: Token
    let dataToken: Token | undefined
    let multiline = false
    let openerEnd: Point

    return start

    function start(code: number | null): State | undefined {
      assert(code === codes.dollarSign)
      container = effects.enter('mathText')
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
      if (exhaustedSizes.get(self)?.has(sizeOpen)) return nok(code)

      if (sizeOpen === 2) {
        container.type = 'mathTextDisplay'
      }
      openerEnd = self.now()

      return between(code)
    }

    function between(code: number | null): State | undefined {
      if (code === codes.eof) {
        const exhausted = new Set(exhaustedSizes.get(self))
        exhaustedSizes.set(self, exhausted)
        exhausted.add(sizeOpen)
        for (const [size, occurrences] of mismatchedSizes ?? []) {
          if (occurrences === 1) exhausted.add(size)
        }
        return nok(code)
      }

      if (multiline && !dataToken && !markdownLineEnding(code)) {
        dataToken = effects.enter('mathTextData')
      }

      if (code === codes.dollarSign) {
        if (backslashRun % 2 === 1) {
          effects.consume(code)
          backslashRun = 0
          return between
        }

        candidateStart = self.now()
        sizeClose = 0
        return close(code)
      }

      if (markdownLineEnding(code)) {
        consumeLineEnding(code)
        backslashRun = 0
        return between
      }

      effects.consume(code)
      backslashRun = code === codes.backslash ? backslashRun + 1 : 0
      return between
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

        if (multiline) closeMultiline()
        effects.exit(container.type)
        return ok(code)
      }

      mismatchedSizes ??= new Map()
      mismatchedSizes.set(sizeClose, (mismatchedSizes.get(sizeClose) ?? 0) + 1)
      backslashRun = 0
      return between(code)
    }

    function consumeLineEnding(code: number): void {
      const start = self.now()
      if (!multiline) {
        // Single-line math stays opaque. Multiline tokens need contiguous
        // child ranges so micromark can link the chunks across line endings.
        emitRange(
          sizeOpen === 2 ? 'mathTextDisplaySequence' : 'mathTextSequence',
          container.start,
          openerEnd,
        )
        emitRange('mathTextData', openerEnd, start)
        multiline = true
      } else {
        assert(dataToken)
        effects.exit('mathTextData')
      }

      effects.enter(types.lineEnding)
      effects.consume(code)
      effects.exit(types.lineEnding)
      dataToken = undefined
    }

    function closeMultiline(): void {
      const sequenceType =
        sizeOpen === 2 ? 'mathTextDisplaySequence' : 'mathTextSequence'
      assert(dataToken)
      if (dataToken.start.offset === candidateStart.offset) {
        dataToken.type = sequenceType
        effects.exit(sequenceType)
        return
      }

      effects.exit('mathTextData')
      // The candidate fence was consumed while data was open. Reassign its
      // range to the closing sequence now that its size is known to match.
      dataToken.end = candidateStart
      const closer = effects.enter(sequenceType)
      closer.start = candidateStart
      effects.exit(sequenceType)
    }

    function emitRange(type: Token['type'], start: Point, end: Point): void {
      if (start.offset === end.offset) return
      const token = effects.enter(type)
      token.start = start
      effects.exit(type).end = end
    }
  }
}

export function latexMathText(): Construct {
  const exhausted = new WeakMap<TokenizeContext, number>()

  return {
    name: 'mathTextLatexCombined',
    tokenize,
  }

  function tokenize(
    this: TokenizeContext,
    effects: Effects,
    ok: State,
    nok: State,
  ): State {
    const self = this
    let closeMarker: number = codes.rightParenthesis
    let containerType: 'mathText' | 'mathTextDisplay' = 'mathText'
    let exhaustedBit = 0
    let hasContent = false
    let backslashRun = 0
    let slashesBefore = 0
    let candidateStart: Point
    let container: Token
    let dataToken: Token | undefined
    let multiline = false
    let openerEnd: Point

    return start

    function start(code: number | null): State | undefined {
      assert(code === codes.backslash)
      container = effects.enter('mathText')
      effects.consume(code)
      return openMarker
    }

    function openMarker(code: number | null): State | undefined {
      const display = code === codes.leftSquareBracket
      if (!display && code !== codes.leftParenthesis) return nok(code)

      const disabled = self.parser.constructs.disable.null
      assert(disabled)
      const legacyName = display ? 'mathTextDisplayLatex' : 'mathTextLatex'
      if (disabled.includes(legacyName)) return nok(code)

      exhaustedBit = display ? 2 : 1
      if (((exhausted.get(self) ?? 0) & exhaustedBit) !== 0) return nok(code)

      if (display) {
        closeMarker = codes.rightSquareBracket
        containerType = 'mathTextDisplay'
      }
      effects.consume(code)
      container.type = containerType
      openerEnd = self.now()
      return content
    }

    function content(code: number | null): State | undefined {
      if (code === codes.eof) {
        exhausted.set(self, (exhausted.get(self) ?? 0) | exhaustedBit)
        return nok(code)
      }

      if (multiline && !dataToken && !markdownLineEnding(code)) {
        dataToken = effects.enter('mathTextData')
      }

      if (code === codes.backslash) {
        slashesBefore = backslashRun
        candidateStart = self.now()
        effects.consume(code)
        return afterSlash
      }

      if (markdownLineEnding(code)) {
        consumeLineEnding(code)
        hasContent = true
        backslashRun = 0
        return content
      }

      effects.consume(code)
      hasContent = true
      backslashRun = 0
      return content
    }

    function afterSlash(code: number | null): State | undefined {
      if (code === closeMarker && slashesBefore % 2 === 0) {
        if (!hasContent) return nok(code)
        if (multiline) {
          closeMultiline(code)
        } else {
          effects.consume(code)
        }
        effects.exit(containerType)
        return ok
      }

      hasContent = true
      backslashRun = slashesBefore + 1
      return content(code)
    }

    function consumeLineEnding(code: number): void {
      const start = self.now()
      if (!multiline) {
        // Single-line math stays opaque. Multiline tokens need contiguous
        // child ranges so micromark can link the chunks across line endings.
        emitRange(
          containerType === 'mathTextDisplay'
            ? 'mathTextDisplaySequence'
            : 'mathTextSequence',
          container.start,
          openerEnd,
        )
        emitRange('mathTextData', openerEnd, start)
        multiline = true
      } else {
        assert(dataToken)
        effects.exit('mathTextData')
      }

      effects.enter(types.lineEnding)
      effects.consume(code)
      effects.exit(types.lineEnding)
      dataToken = undefined
    }

    function closeMultiline(code: number): void {
      const sequenceType =
        containerType === 'mathTextDisplay'
          ? 'mathTextDisplaySequence'
          : 'mathTextSequence'
      assert(dataToken)
      if (dataToken.start.offset === candidateStart.offset) {
        dataToken.type = sequenceType
        effects.consume(code)
        effects.exit(sequenceType)
        return
      }

      effects.exit('mathTextData')
      // The candidate slash was consumed while data was open. Reassign it to
      // the closing sequence after the matching bracket is known.
      dataToken.end = candidateStart
      const closer = effects.enter(sequenceType)
      closer.start = candidateStart
      effects.consume(code)
      effects.exit(sequenceType)
    }

    function emitRange(type: Token['type'], start: Point, end: Point): void {
      if (start.offset === end.offset) return
      const token = effects.enter(type)
      token.start = start
      effects.exit(type).end = end
    }
  }
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
