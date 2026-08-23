/**
 * Arabic Number to Words (Tafqeet) for Libyan Dinars and Dirhams.
 * Converts numeric amounts (e.g. 145.50) into formal Arabic financial wording:
 * "فقط مائة وخمسة وأربعون ديناراً وخمسون درهماً لا غير"
 */

const ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
]

const TENS = [
  '',
  'عشرة',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
]

const HUNDREDS = [
  '',
  'مائة',
  'مئتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
]

function convertGroup(number: number): string {
  if (number === 0) return ''

  const parts: string[] = []
  const c = Math.floor(number / 100)
  const r = number % 100

  if (c > 0) {
    parts.push(HUNDREDS[c]!)
  }

  if (r > 0) {
    if (r < 20) {
      parts.push(ONES[r]!)
    } else {
      const onesDigit = r % 10
      const tensDigit = Math.floor(r / 10)
      if (onesDigit > 0) {
        parts.push(`${ONES[onesDigit]} و${TENS[tensDigit]}`)
      } else {
        parts.push(TENS[tensDigit]!)
      }
    }
  }

  return parts.join(' و')
}

export function numberToArabicWords(number: number): string {
  if (number === 0) return 'صفر'
  if (number < 0) return `سالب ${numberToArabicWords(Math.abs(number))}`

  const groups: string[] = []
  let num = Math.floor(number)

  // Millions
  const millions = Math.floor(num / 1_000_000)
  num %= 1_000_000
  if (millions > 0) {
    if (millions === 1) groups.push('مليون')
    else if (millions === 2) groups.push('مليونان')
    else if (millions >= 3 && millions <= 10) groups.push(`${convertGroup(millions)} ملايين`)
    else groups.push(`${convertGroup(millions)} مليوناً`)
  }

  // Thousands
  const thousands = Math.floor(num / 1_000)
  num %= 1_000
  if (thousands > 0) {
    if (thousands === 1) groups.push('ألف')
    else if (thousands === 2) groups.push('ألفان')
    else if (thousands >= 3 && thousands <= 10) groups.push(`${convertGroup(thousands)} آلاف`)
    else groups.push(`${convertGroup(thousands)} ألفاً`)
  }

  // Units (0-999)
  if (num > 0) {
    groups.push(convertGroup(num))
  }

  return groups.filter(Boolean).join(' و')
}

export function tafqeetLibyanDinars(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numericAmount) || numericAmount === 0) return 'فقط صفر دينار لا غير'

  const rounded = Math.round(numericAmount * 100) / 100
  const dinars = Math.floor(rounded)
  const dirhams = Math.round((rounded - dinars) * 100)

  const parts: string[] = []
  if (dinars > 0) {
    const dinarsWords = numberToArabicWords(dinars)
    if (dinars === 1) {
      parts.push('دينار واحد')
    } else if (dinars === 2) {
      parts.push('ديناران')
    } else if (dinars >= 3 && dinars <= 10) {
      parts.push(`${dinarsWords} دنانير`)
    } else {
      parts.push(`${dinarsWords} ديناراً`)
    }
  }

  if (dirhams > 0) {
    const dirhamsWords = numberToArabicWords(dirhams)
    parts.push(`${dirhamsWords} درهماً`)
  }

  const result = parts.join(' و')
  return `فقط ${result} لا غير`
}
