// The ship's password. One lock, several triggers (see sim.js: seal). Pure rules, no DOM, so they run in tests.
//
// Reading a password, deliberately lenient so a correct password is never refused:
//  - only keyboard characters (printable ASCII, space included) are allowed; anything else is rejected outright,
//    so "length" and "special character" are never ambiguous (an emoji is two characters to a browser)
//  - spaces at either end are trimmed; spaces inside are kept
//  - words (JERRY, layers, sins, archdevils) are found anywhere, in any capitals
//  - Roman numerals must be in capitals (or any lowercase "i" would count as page I), found anywhere
//  - unlocking is an exact, case-sensitive match after trimming

export const HELL_LAYERS = [['AVERNUS', 'I'], ['DIS', 'II'], ['MINAUROS', 'III'], ['PHLEGETHOS', 'IV'], ['STYGIA', 'V'],
  ['MALBOLGE', 'VI'], ['MALADOMINI', 'VII'], ['CANIA', 'VIII'], ['NESSUS', 'IX']];
export const SINS = ['PRIDE', 'GREED', 'WRATH', 'ENVY', 'LUST', 'GLUTTONY', 'SLOTH'];
export const ARCHDEVILS = ['ASMODEUS', 'MAMMON', 'LEVISTUS', 'GERYON', 'DISPATER', 'BELIAL', 'ZARIEL', 'BAALZEBUL',
  'MEPHISTOPHELES', 'GLASYA', 'FIERNA', 'BEL', 'RHUN'];
export const PAGE_NUMERALS = ['I', 'II', 'III', 'IV'];
export const DIGIT_SUM = 42;
export const FIRST_RULES = 3, RULES_PER_LOCKDOWN = 2;
export const WRONG_TRIES = 5;

export const cleanPassword = s => String(s == null ? '' : s).normalize('NFC').trim();
export const keyboardOnly = s => /^[\x20-\x7E]*$/.test(s);
const digitSum = p => [...p].reduce((n, c) => n + (c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : 0), 0);

// ctx.pages: the rune board pages (0-3) shown at any time since this lock opened
export const RULES = [
  { id: 'jerry', text: 'It must include the word JERRY.', test: p => p.toUpperCase().includes('JERRY') },
  { id: 'case', text: 'It must include an uppercase letter and a special character.', test: p => /[A-Z]/.test(p) && /[^A-Za-z0-9 ]/.test(p) },
  { id: 'hell', text: 'It must include your favourite layer of Hell, and that layer\'s number in Roman numerals (in capitals).',
    test: p => HELL_LAYERS.some(([name, num]) => p.toUpperCase().includes(name) && p.includes(num)) },
  { id: 'length', text: 'It must include its own length, as a number.', test: p => p.includes(String(p.length)) },
  { id: 'sin', text: 'It must include your greatest of the seven deadly sins.', test: p => SINS.some(s => p.toUpperCase().includes(s)) },
  { id: 'devil', text: 'It must include the name of an archdevil.', test: p => ARCHDEVILS.some(s => p.toUpperCase().includes(s)) },
  { id: 'digits', text: `Its digits must add up to ${DIGIT_SUM}.`, test: p => digitSum(p) === DIGIT_SUM },
  { id: 'page', text: 'It must include the rune board page, in Roman numerals (in capitals).',
    test: (p, ctx) => (ctx.pages || []).some(i => p.includes(PAGE_NUMERALS[i])) },
];
export const ruleCap = n => Math.max(1, Math.min(RULES.length, n));

// Check a candidate against the first `cap` rules. Returns { ok, ascii, results: [{id, text, ok}] }.
export function checkPassword(raw, cap, ctx = {}) {
  const p = cleanPassword(raw), ascii = keyboardOnly(p);
  const results = RULES.slice(0, ruleCap(cap)).map(r => ({ id: r.id, text: r.text, ok: ascii && !!r.test(p, ctx) }));
  return { ok: ascii && p.length > 0 && results.every(r => r.ok), ascii, results, value: p };
}
export const passwordMatches = (stored, raw) => stored != null && cleanPassword(raw) === stored;
