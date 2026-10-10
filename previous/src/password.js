// The ship's password. One lock, several triggers (see sim.js: seal). Pure rules, no DOM, so they run in tests.
//
// The Watch starts on the factory password, JerryRulz!, which meets the three base rules. Every security update
// (LOCKDOWN) descends one layer of Hell: the crew enter the CURRENT password, then set a new one that meets every
// rule so far plus that layer's.
//
// Reading a password, deliberately lenient so a correct password is never refused:
//  - only keyboard characters (printable ASCII, space included, and the degree sign) are allowed
//  - spaces at either end are trimmed; spaces inside are kept
//  - words (JERRY, sins, IAGREE) are found anywhere, in any capitals
//  - unlocking is an exact, case-sensitive match after trimming

export const DEFAULT_PASSWORD = 'JerryRulz!';
export const SINS = ['PRIDE', 'GREED', 'WRATH', 'ENVY', 'LUST', 'GLUTTONY', 'SLOTH'];
export const BASE_RULES = 3, RULES_PER_LOCKDOWN = 1;
export const WRONG_TRIES = 5;

export const cleanPassword = s => String(s == null ? '' : s).normalize('NFC').trim();
export const keyboardOnly = s => /^[\x20-\x7E°]*$/.test(s);
const isPrime = n => { if (n < 2 || !Number.isInteger(n)) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const numbersIn = p => [...p.matchAll(/\d+/g)].map(m => +m[0]);

// absolute zero, in any of the usual scales and roundings
const ABS_ZERO = [/-273(\.15|\.1|\.2)?(?!\d)/, /(?<![\d.])0(\.0+)? ?°? ?K/i, /-(459(\.67|\.6|\.7)?|460)(?!\d)/];
const absoluteZero = p => ABS_ZERO.some(r => r.test(p));
// a sum written out wrong: 2+2=5
function wrongSum(p) {
  for (const m of p.matchAll(/(\d+(?:\.\d+)?)\s*([-+*xX])\s*(\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/g)) {
    const a = +m[1], b = +m[3], c = +m[4], v = m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b;
    if (Math.abs(v - c) > 1e-9) return true;
  }
  return false;
}

// Each rule: test(p) -> true, or a string saying what is still wrong (shown under the rule as a hint).
export const RULES = [
  { id: 'capital', text: 'It must include a capital letter.', test: p => /[A-Z]/.test(p) },
  { id: 'special', text: 'It must include a special character.', test: p => /[^A-Za-z0-9 ]/.test(p) },
  { id: 'jerry', text: 'It must include JERRY.', test: p => p.toUpperCase().includes('JERRY') },
  { id: 'chain', layer: ['AVERNUS', 'I'], text: 'Chain the 1: the digit 1 must appear exactly once, with ### somewhere before it and ### somewhere after it.',
    test: p => {
      const n = p.split('1').length - 1;
      if (n !== 1) return n ? `There are ${n} ones.` : false;
      return /###.*1.*###/.test(p) || 'The 1 must have ### before it and ### after it.';
    } },
  { id: 'neighbour', layer: ['DIS', 'II'], text: 'Trust no neighbour: no letter may sit next to the same letter. Capitals count as different.',
    test: p => { const m = p.match(/([A-Za-z])\1/); return !m || `"${m[0]}" sit together.`; } },
  { id: 'price', layer: ['MINAUROS', 'III'], text: "Mammon's price: a $ followed by a number bigger than the password's length.",
    test: p => [...p.matchAll(/\$(\d+)/g)].some(m => +m[1] > p.length) || (/\$\d/.test(p) ? `The length is ${p.length}.` : false) },
  { id: 'vice', layer: ['PHLEGETHOS', 'IV'], text: 'Your greatest vice: it must include one of the seven deadly sins.',
    test: p => SINS.some(s => p.toUpperCase().includes(s)) },
  { id: 'zero', layer: ['STYGIA', 'V'], text: 'The coldest there is: it must include absolute zero.',
    test: p => absoluteZero(p) || (/-\d/.test(p) ? 'Colder. Absolute zero is colder than anything in Stygia.' : false) },
  { id: 'six', layer: ['MALBOLGE', 'VI'], text: 'The digit 6 must appear exactly three times.',
    test: p => { const n = p.split('6').length - 1; return n === 3 || (n ? `There ${n === 1 ? 'is 1 six' : `are ${n} sixes`}.` : false); } },
  { id: 'lie', layer: ['MALADOMINI', 'VII'], text: "Baalzebul's lie: it must include a sum that is wrong, like 2+2=5.",
    test: p => wrongSum(p) },
  { id: 'prime', layer: ['CANIA', 'VIII'], text: "It must include a prime number greater than 20, end with the password's length, and that length must be odd.",
    test: p => {
      const miss = [];
      if (!numbersIn(p).some(n => n > 20 && isPrime(n))) miss.push('no prime over 20');
      if (!p.endsWith(String(p.length))) miss.push(`it does not end with its length (${p.length})`);
      if (p.length % 2 === 0) miss.push(`the length (${p.length}) is even`);
      return !miss.length || (miss.length < 3 ? 'Still: ' + miss.join(', ') + '.' : false);
    } },
  { id: 'agree', layer: ['NESSUS', 'IX'], text: 'Sign the contract: it must include IAGREE.', test: p => p.toUpperCase().includes('IAGREE') },
];
export const LAYERS = RULES.filter(r => r.layer).map(r => r.layer);
export const ruleCap = n => Math.max(1, Math.min(RULES.length, n));
// how many layers down the rules have gone (0 at the gate)
export const layerOf = cap => Math.max(0, ruleCap(cap) - BASE_RULES);

// Check a candidate against the first `cap` rules. Returns { ok, ascii, results: [{id, text, ok, hint}] }.
export function checkPassword(raw, cap) {
  const p = cleanPassword(raw), ascii = keyboardOnly(p);
  const results = RULES.slice(0, ruleCap(cap)).map(r => {
    const v = ascii && p ? r.test(p) : false;
    return { id: r.id, text: r.text, layer: r.layer || null, ok: v === true, hint: typeof v === 'string' ? v : '' };
  });
  return { ok: ascii && p.length > 0 && results.every(r => r.ok), ascii, results, value: p };
}
export const passwordMatches = (stored, raw) => stored != null && cleanPassword(raw) === stored;

// After a wrong try: two neighbouring characters of the real password are shown. Prefers a pair not yet shown.
export function revealPair(pw, shown, rnd) {
  if (!pw || pw.length < 2) return pw ? [0] : [];
  const all = [];
  for (let i = 0; i + 1 < pw.length; i++) all.push(i);
  const fresh = all.filter(i => !shown.includes(i) && !shown.includes(i + 1));
  const some = all.filter(i => !shown.includes(i) || !shown.includes(i + 1));
  const pool = fresh.length ? fresh : some.length ? some : all;
  const i = pool[Math.floor(rnd() * pool.length)];
  return [i, i + 1];
}
export const maskPassword = (pw, shown) => [...(pw || '')].map((c, i) => shown.includes(i) ? c : '_');
