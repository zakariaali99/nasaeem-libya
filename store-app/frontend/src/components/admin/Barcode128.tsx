/**
 * Code 128B Barcode Pattern Table (ASCII 32 to 127 + control codes)
 * Each pattern has 6 elements representing alternating bar/space widths (sum = 11 modules).
 */
const PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0: ' ' (Space)
  [2, 2, 2, 1, 2, 2], // 1: '!'
  [2, 2, 2, 2, 2, 1], // 2: '"'
  [1, 2, 1, 2, 2, 3], // 3: '#'
  [1, 2, 1, 3, 2, 2], // 4: '$'
  [1, 3, 1, 2, 2, 2], // 5: '%'
  [1, 2, 2, 2, 1, 3], // 6: '&'
  [1, 2, 2, 3, 1, 2], // 7: '\''
  [1, 3, 2, 2, 1, 2], // 8: '('
  [2, 2, 1, 2, 1, 3], // 9: ')'
  [2, 2, 1, 3, 1, 2], // 10: '*'
  [2, 3, 1, 2, 1, 2], // 11: '+'
  [1, 1, 2, 2, 3, 2], // 12: ','
  [1, 2, 2, 1, 3, 2], // 13: '-'
  [1, 2, 2, 2, 3, 1], // 14: '.'
  [1, 1, 3, 2, 2, 2], // 15: '/'
  [1, 2, 3, 1, 2, 2], // 16: '0'
  [1, 2, 3, 2, 2, 1], // 17: '1'
  [2, 2, 3, 2, 1, 1], // 18: '2'
  [2, 2, 1, 1, 3, 2], // 19: '3'
  [2, 2, 1, 2, 3, 1], // 20: '4'
  [2, 1, 3, 2, 1, 2], // 21: '5'
  [2, 2, 3, 1, 1, 2], // 22: '6'
  [3, 1, 2, 1, 3, 1], // 23: '7'
  [3, 1, 1, 2, 2, 2], // 24: '8'
  [3, 2, 1, 1, 2, 2], // 25: '9'
  [3, 2, 1, 2, 2, 1], // 26: ':'
  [3, 1, 2, 2, 1, 2], // 27: ';'
  [3, 2, 2, 1, 1, 2], // 28: '<'
  [3, 2, 2, 2, 1, 1], // 29: '='
  [2, 1, 2, 1, 2, 3], // 30: '>'
  [2, 1, 2, 3, 2, 1], // 31: '?'
  [2, 3, 2, 1, 2, 1], // 32: '@'
  [1, 1, 1, 3, 2, 3], // 33: 'A'
  [1, 3, 1, 1, 2, 3], // 34: 'B'
  [1, 3, 1, 3, 2, 1], // 35: 'C'
  [1, 1, 2, 3, 1, 3], // 36: 'D'
  [1, 3, 2, 1, 1, 3], // 37: 'E'
  [1, 3, 2, 3, 1, 1], // 38: 'F'
  [2, 1, 1, 3, 1, 3], // 39: 'G'
  [2, 3, 1, 1, 1, 3], // 40: 'H'
  [2, 3, 1, 3, 1, 1], // 41: 'I'
  [1, 1, 2, 1, 3, 3], // 42: 'J'
  [1, 1, 2, 3, 3, 1], // 43: 'K'
  [1, 3, 2, 1, 3, 1], // 44: 'L'
  [1, 1, 3, 1, 2, 3], // 45: 'M'
  [1, 1, 3, 3, 2, 1], // 46: 'N'
  [1, 3, 3, 1, 2, 1], // 47: 'O'
  [3, 1, 3, 1, 2, 1], // 48: 'P'
  [2, 1, 1, 3, 3, 1], // 49: 'Q'
  [2, 3, 1, 1, 3, 1], // 50: 'R'
  [2, 1, 3, 1, 1, 3], // 51: 'S'
  [2, 1, 3, 3, 1, 1], // 52: 'T'
  [2, 1, 3, 1, 3, 1], // 53: 'U'
  [3, 1, 1, 1, 2, 3], // 54: 'V'
  [3, 1, 1, 3, 2, 1], // 55: 'W'
  [3, 3, 1, 1, 2, 1], // 56: 'X'
  [3, 1, 2, 1, 1, 3], // 57: 'Y'
  [3, 1, 2, 3, 1, 1], // 58: 'Z'
  [3, 3, 2, 1, 1, 1], // 59: '['
  [3, 1, 4, 1, 1, 1], // 60: '\\'
  [2, 2, 1, 4, 1, 1], // 61: ']'
  [4, 3, 1, 1, 1, 1], // 62: '^'
  [1, 1, 1, 2, 2, 4], // 63: '_'
  [1, 1, 1, 4, 2, 2], // 64: '`'
  [1, 2, 1, 1, 2, 4], // 65: 'a'
  [1, 2, 1, 4, 2, 1], // 66: 'b'
  [1, 4, 1, 1, 2, 2], // 67: 'c'
  [1, 4, 1, 2, 2, 1], // 68: 'd'
  [1, 1, 2, 2, 1, 4], // 69: 'e'
  [1, 1, 2, 4, 1, 2], // 70: 'f'
  [1, 2, 2, 1, 1, 4], // 71: 'g'
  [1, 2, 2, 4, 1, 1], // 72: 'h'
  [1, 4, 2, 1, 1, 2], // 73: 'i'
  [1, 4, 2, 2, 1, 1], // 74: 'j'
  [2, 4, 1, 2, 1, 1], // 75: 'k'
  [2, 2, 1, 1, 1, 4], // 76: 'l'
  [4, 1, 3, 1, 1, 1], // 77: 'm'
  [2, 4, 1, 1, 1, 2], // 78: 'n'
  [1, 3, 4, 1, 1, 1], // 79: 'o'
  [1, 1, 1, 2, 4, 2], // 80: 'p'
  [1, 2, 1, 1, 4, 2], // 81: 'q'
  [1, 2, 1, 2, 4, 1], // 82: 'r'
  [1, 1, 4, 2, 1, 2], // 83: 's'
  [1, 2, 4, 1, 1, 2], // 84: 't'
  [1, 2, 4, 2, 1, 1], // 85: 'u'
  [4, 1, 1, 2, 1, 2], // 86: 'v'
  [4, 2, 1, 1, 1, 2], // 87: 'w'
  [4, 2, 1, 2, 1, 1], // 88: 'x'
  [2, 1, 2, 1, 4, 1], // 89: 'y'
  [2, 1, 4, 1, 2, 1], // 90: 'z'
  [4, 1, 2, 1, 2, 1], // 91: '{'
  [1, 1, 1, 1, 4, 3], // 92: '|'
  [1, 1, 1, 3, 4, 1], // 93: '}'
  [1, 3, 1, 1, 4, 1], // 94: '~'
  [1, 1, 4, 1, 1, 3], // 95: DEL
  [1, 1, 4, 3, 1, 1], // 96: FNC3
  [4, 1, 1, 1, 1, 3], // 97: FNC2
  [4, 1, 1, 3, 1, 1], // 98: SHIFT
  [1, 1, 3, 1, 4, 1], // 99: CODE C
  [1, 1, 4, 1, 3, 1], // 100: CODE B
  [3, 1, 1, 1, 4, 1], // 101: FNC4
  [4, 1, 1, 1, 3, 1], // 102: START A
  [2, 1, 1, 4, 1, 2], // 103: START A
  [2, 1, 1, 2, 1, 4], // 104: START B
  [2, 1, 1, 2, 3, 2], // 105: START C
]

const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2] // 106: STOP (13 modules)
const START_B = 104

interface Barcode128Props {
  value: string
  height?: number
  barWidth?: number
  showText?: boolean
  className?: string
}

export function Barcode128({
  value,
  height = 50,
  barWidth = 2,
  showText = true,
  className = '',
}: Barcode128Props) {
  const cleanValue = value.replace(/[^\x20-\x7E]/g, '')

  // Calculate Code 128B checksum and modules
  const codes: number[] = [START_B]
  let checkSum = START_B

  for (let i = 0; i < cleanValue.length; i++) {
    const code = cleanValue.charCodeAt(i) - 32
    codes.push(code)
    checkSum += code * (i + 1)
  }

  codes.push(checkSum % 103)

  // Generate bar sequences: true = bar, false = space
  const modules: boolean[] = []

  // Quiet zone at start (10 modules)
  for (let i = 0; i < 10; i++) modules.push(false)

  // Character patterns
  for (const code of codes) {
    const pattern = PATTERNS[code]
    if (pattern) {
      for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
        const isBar = pIdx % 2 === 0
        const width = pattern[pIdx]!
        for (let w = 0; w < width; w++) {
          modules.push(isBar)
        }
      }
    }
  }

  // Stop character pattern
  for (let pIdx = 0; pIdx < STOP_PATTERN.length; pIdx++) {
    const isBar = pIdx % 2 === 0
    const width = STOP_PATTERN[pIdx]!
    for (let w = 0; w < width; w++) {
      modules.push(isBar)
    }
  }

  // Quiet zone at end (10 modules)
  for (let i = 0; i < 10; i++) modules.push(false)

  const totalWidth = modules.length * barWidth

  // Group continuous bars into rectangles for smaller SVG DOM
  const rects: { x: number; width: number }[] = []
  let inBar = false
  let barStart = 0

  for (let i = 0; i < modules.length; i++) {
    if (modules[i]) {
      if (!inBar) {
        inBar = true
        barStart = i * barWidth
      }
    } else {
      if (inBar) {
        inBar = false
        rects.push({ x: barStart, width: i * barWidth - barStart })
      }
    }
  }
  if (inBar) {
    rects.push({ x: barStart, width: modules.length * barWidth - barStart })
  }

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width={totalWidth}
        height={height}
        className="max-w-full h-auto text-foreground"
        shapeRendering="crispEdges"
        aria-label={`باركود: ${cleanValue}`}
      >
        <rect width={totalWidth} height={height} fill="transparent" />
        {rects.map((r, idx) => (
          <rect key={idx} x={r.x} y={0} width={r.width} height={height} fill="currentColor" />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-xs font-bold tracking-widest text-foreground mt-1">
          *{cleanValue}*
        </span>
      )}
    </div>
  )
}
