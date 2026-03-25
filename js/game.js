// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const ROW_NAMES = [
  'Ettere','Toere','Treere','Firere','Femmere','Seksere',
  'Et par','To par','Tre ens','Fire ens',
  'Lille straight','Stor straight','Fuldt hus','Chancen','Yatzy'
];
const UPPER_COUNT = 6;
const TOTAL_ROWS = 15;
const TOTAL_COLS = 5;
const BONUS_THRESHOLD = 63;
const BONUS_POINTS = 50;
const MULTIPLIERS = [1, 2, 3, 4, 5];

// ═══════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════
let players = [];
let currentPlayer = 0;
let dice = [1, 1, 1, 1, 1];
let held = [false, false, false, false, false];
let rollsLeft = 3;
let hasRolled = false;
let rollHistory = [];
let viewingPlayer = 0;
let lastPlacedCell = null; // {row, col} for flash animation

// ═══════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════
function counts(dice) {
  const c = [0,0,0,0,0,0,0];
  dice.forEach(d => c[d]++);
  return c;
}

function calcN(dice, n) {
  return dice.filter(d => d === n).length * n;
}

function calcOnePair(dice) {
  const c = counts(dice);
  for (let i = 6; i >= 1; i--) {
    if (c[i] >= 2) return i * 2;
  }
  return 0;
}

function calcTwoPairs(dice) {
  const c = counts(dice);
  const pairs = [];
  for (let i = 6; i >= 1; i--) {
    if (c[i] >= 2) pairs.push(i);
  }
  if (pairs.length >= 2) return pairs[0] * 2 + pairs[1] * 2;
  return 0;
}

function calcThreeOfAKind(dice) {
  const c = counts(dice);
  for (let i = 6; i >= 1; i--) {
    if (c[i] >= 3) return i * 3;
  }
  return 0;
}

function calcFourOfAKind(dice) {
  const c = counts(dice);
  for (let i = 6; i >= 1; i--) {
    if (c[i] >= 4) return i * 4;
  }
  return 0;
}

function calcSmallStraight(dice) {
  const s = [...dice].sort().join('');
  return s === '12345' ? 15 : 0;
}

function calcLargeStraight(dice) {
  const s = [...dice].sort().join('');
  return s === '23456' ? 20 : 0;
}

function calcFullHouse(dice) {
  const c = counts(dice);
  let three = false, two = false;
  for (let i = 1; i <= 6; i++) {
    if (c[i] === 3) three = true;
    if (c[i] === 2) two = true;
  }
  return (three && two) ? dice.reduce((a, b) => a + b, 0) : 0;
}

function calcChance(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

function calcYatzy(dice) {
  if (dice.length < 5) return 0;
  const c = counts(dice);
  for (let i = 1; i <= 6; i++) {
    if (c[i] === 5) return 50;
  }
  return 0;
}

const CALC = [
  d => calcN(d, 1), d => calcN(d, 2), d => calcN(d, 3),
  d => calcN(d, 4), d => calcN(d, 5), d => calcN(d, 6),
  calcOnePair, calcTwoPairs, calcThreeOfAKind, calcFourOfAKind,
  calcSmallStraight, calcLargeStraight, calcFullHouse, calcChance, calcYatzy
];

// ═══════════════════════════════════════════
// COLUMN 5 LOGIC (fixed)
// ═══════════════════════════════════════════
function getCol5Dice() {
  // First roll only: all 5 dice count (same throw)
  if (rollHistory.length <= 1) return [...dice];
  // After re-rolls: only currently held dice count
  return dice.filter((_, i) => held[i]);
}

function calcScoreForCol5(rowIdx) {
  const col5dice = getCol5Dice();
  if (col5dice.length === 0) return 0;
  return CALC[rowIdx](col5dice);
}

// ═══════════════════════════════════════════
// VALID CELL DETECTION
// ═══════════════════════════════════════════
function getNextRow3(p) {
  for (let r = 0; r < TOTAL_ROWS; r++) {
    if (players[p].scores[r][2] === null) return r;
  }
  return -1;
}

function getNextRow4(p) {
  for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
    if (players[p].scores[r][3] === null) return r;
  }
  return -1;
}

function isValidCell(p, row, col) {
  if (players[p].scores[row][col] !== null) return false;
  if (col === 2) return row === getNextRow3(p);
  if (col === 3) return row === getNextRow4(p);
  return true;
}

function getPotentialScore(row, col) {
  if (col === 4) {
    return calcScoreForCol5(row);
  }
  return CALC[row](dice);
}

// ═══════════════════════════════════════════
// BONUS & TOTALS
// ═══════════════════════════════════════════
function getUpperSum(p, col) {
  let sum = 0;
  for (let r = 0; r < UPPER_COUNT; r++) {
    if (players[p].scores[r][col] !== null) sum += players[p].scores[r][col];
  }
  return sum;
}

function getUpperComplete(p, col) {
  for (let r = 0; r < UPPER_COUNT; r++) {
    if (players[p].scores[r][col] === null) return false;
  }
  return true;
}

function getBonus(p, col) {
  if (!getUpperComplete(p, col)) return null;
  return getUpperSum(p, col) >= BONUS_THRESHOLD ? BONUS_POINTS : 0;
}

function getColBaseSum(p, col) {
  let sum = 0;
  for (let r = 0; r < TOTAL_ROWS; r++) {
    if (players[p].scores[r][col] !== null) sum += players[p].scores[r][col];
  }
  const bonus = getBonus(p, col);
  if (bonus) sum += bonus;
  return sum;
}

function getColTotal(p, col) {
  return getColBaseSum(p, col) * MULTIPLIERS[col];
}

function getGrandTotal(p) {
  let sum = 0;
  for (let c = 0; c < TOTAL_COLS; c++) sum += getColTotal(p, c);
  return sum;
}

function isPlayerDone(p) {
  for (let r = 0; r < TOTAL_ROWS; r++)
    for (let c = 0; c < TOTAL_COLS; c++)
      if (players[p].scores[r][c] === null) return false;
  return true;
}

function isGameOver() {
  return players.every((_, i) => isPlayerDone(i));
}

// ═══════════════════════════════════════════
// PLACE SCORE
// ═══════════════════════════════════════════
function placeScore(row, col) {
  const p = currentPlayer;
  if (players[p].scores[row][col] !== null) return;
  if (!isValidCell(p, row, col)) return;

  // Save undo state before placing
  saveUndoState();

  const score = getPotentialScore(row, col);
  players[p].scores[row][col] = score;
  lastPlacedCell = { row, col, player: p };

  // Sound & haptics
  playPlaceSound();
  vibrate(15);

  nextTurn();
}

function nextTurn() {
  if (isGameOver()) {
    showEndScreen();
    return;
  }

  // Find next player who isn't done
  let next = (currentPlayer + 1) % players.length;
  while (isPlayerDone(next)) {
    next = (next + 1) % players.length;
  }

  currentPlayer = next;
  viewingPlayer = next;
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  hasRolled = false;
  rollHistory = [];

  renderAll();
}

// ═══════════════════════════════════════════
// START GAME
// ═══════════════════════════════════════════
function startGame() {
  const n = parseInt(document.getElementById('playerCount').value);
  players = [];
  for (let i = 0; i < n; i++) {
    const name = document.getElementById(`pname${i}`).value.trim() || `Spiller ${i + 1}`;
    const scores = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      scores.push(new Array(TOTAL_COLS).fill(null));
    }
    players.push({ name, scores });
  }

  currentPlayer = 0;
  viewingPlayer = 0;
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  hasRolled = false;
  rollHistory = [];
  lastPlacedCell = null;
  clearUndoStack();

  showScreen('gameScreen');
  renderAll();
}

// ═══════════════════════════════════════════
// HIGHSCORES (localStorage)
// ═══════════════════════════════════════════
const HS_KEY = 'yatzy_bording_highscores';
const HS_MAX = 10;

function getHighscores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch { return []; }
}

function saveHighscore(name, score) {
  const list = getHighscores();
  const entry = { name, score, date: new Date().toLocaleDateString('da-DK') };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  if (list.length > HS_MAX) list.length = HS_MAX;
  localStorage.setItem(HS_KEY, JSON.stringify(list));
  return list.findIndex(e => e === entry);
}

function saveGameHighscores() {
  const newIndices = [];
  players.forEach((p, i) => {
    const total = getGrandTotal(i);
    const idx = saveHighscore(p.name, total);
    newIndices.push(idx);
  });
  return newIndices;
}

function clearHighscores() {
  localStorage.removeItem(HS_KEY);
  renderHighscoreBox('startHighscores');
  renderHighscoreBox('endHighscores');
}
