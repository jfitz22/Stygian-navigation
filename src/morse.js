// Morse code: the Fleet Officer's book has the table; questions come over the wire in dots and dashes.
// Used for the departments' every-other reload and for the green beacon's clearance. Pure, no DOM.
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
};
// Letters split by spaces, words by ' / '.
export const toMorse = text => String(text).toUpperCase().split(/\s+/).map(w => [...w].map(c => MORSE[c] || '').filter(Boolean).join(' ')).join(' / ');

// Short questions (six words at most) with one-word answers; the right one is first here.
export const QUESTIONS = [
  ['WHAT COLOUR IS FIRE', 'RED', 'BLUE', 'GREEN'],
  ['IS THE SEA COLD', 'YES', 'NO', 'DRY'],
  ['WHAT FALLS FROM CLOUDS', 'RAIN', 'ROCK', 'GOLD'],
  ['WHAT DO SHIPS FLOAT ON', 'WATER', 'SAND', 'SMOKE'],
  ['WHAT IS FROZEN WATER', 'ICE', 'SALT', 'IRON'],
  ['HOW MANY LEGS HAS A CAT', 'FOUR', 'TWO', 'SIX'],
  ['WHAT BURNS IN A FURNACE', 'COAL', 'SNOW', 'GLASS'],
  ['WHAT COLOUR IS SNOW', 'WHITE', 'BLACK', 'RED'],
  ['WHAT DOES A BEACON GIVE', 'LIGHT', 'BREAD', 'RAIN'],
  ['WHAT SINKS SHIPS', 'SHELLS', 'SONGS', 'MAPS'],
  ['HOW MANY DAYS IN A WEEK', 'SEVEN', 'FIVE', 'NINE'],
  ['WHAT GROWS ON A DEVILS HEAD', 'HORNS', 'HATS', 'FERNS'],
  ['WHAT IS ONE PLUS ONE', 'TWO', 'THREE', 'TEN'],
  ['WHERE DO FISH LIVE', 'SEA', 'TREES', 'SKY'],
  ['WHAT SHINES AT NIGHT', 'MOON', 'MUD', 'COAL'],
  ['WHAT DO WE BREATHE', 'AIR', 'TAR', 'ASH'],
];
// A question with its three answers shuffled: { q, opts: [word], answer: index }
export function pickQuestion(rng) {
  const [q, ...words] = QUESTIONS[Math.floor(rng() * QUESTIONS.length)];
  const order = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { q, opts: order.map(i => words[i]), answer: order.indexOf(0) };
}
