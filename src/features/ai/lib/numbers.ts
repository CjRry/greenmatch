/** Number helpers shared by the rule-based parsers: Chinese numerals and full-width text. */

const DIGIT: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

/** Characters that can be part of a Chinese numeral up to 99 (一、兩、十、十五、二十三). */
export const CN_NUM = '[零〇一二兩两三四五六七八九十]+'

/** 「十」→10, 「十五」→15, 「二十」→20, 「二十三」→23, 「兩」→2. NaN when it is not a numeral. */
export function cnToNumber(s: string): number {
  if (!s) return NaN
  if (!s.includes('十')) {
    let n = 0
    for (const ch of s) {
      if (!(ch in DIGIT)) return NaN
      n = n * 10 + DIGIT[ch]
    }
    return n
  }
  const [head, tail] = s.split('十')
  const tens = head === '' ? 1 : DIGIT[head]
  if (tens === undefined) return NaN
  if (tail === '') return tens * 10
  const ones = DIGIT[tail]
  if (ones === undefined) return NaN
  return tens * 10 + ones
}

/** An Arabic or Chinese numeral token as a number. */
export function toNumber(token: string): number {
  const t = token.replace(/,/g, '')
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : cnToNumber(t)
}

/** Full-width digits, punctuation and spaces to ASCII, and thousands separators removed, so the regexes stay simple. */
export function normalizeText(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/％/g, '%')
    .replace(/＄/g, '$')
    .replace(/　/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/(?<=\d),(?=\d{3})/g, '')
}
