// ═══════════════════════════════════════════
// COMPUTER OPPONENT (heuristic)
// A single-heuristic AI for solo "vs computer" play.
// Reuses the existing CALC[]/getPotentialScore engine and the
// forced-order column rules (isValidCell, calcScoreForCol5).
//
// Turn flow (driven by ui.js when it is the AI player's turn):
//   1. roll, then choose holds by expected value, repeat up to 3 rolls
//   2. place into the highest-scoring LEGAL cell
// Each step is animated with a short delay so the human can watch.
// ═══════════════════════════════════════════

// gameMode: 'solo' | 'cpu' | 'multi'   (set by startGame in game.js)
// cpuPlayerIndex: which player slot is the computer (-1 if none)
// cpuLevel: 'normal' | 'easy'

function isCpuTurn() {
  return typeof gameMode !== 'undefined' && gameMode === 'cpu' &&
         currentPlayer === cpuPlayerIndex && !isPlayerDone(currentPlayer);
}

// ── Decide which dice to hold given the current dice array ──
// Returns a boolean[5] of which dice to keep.
function aiChooseHolds(d) {
  const c = counts(d);

  // Largest matching set (highest face wins ties)
  let bestFace = 0, bestCount = 0;
  for (let face = 6; face >= 1; face--) {
    if (c[face] > bestCount) { bestCount = c[face]; bestFace = face; }
  }

  // Straight detection: how many distinct values in a run
  const distinct = [];
  for (let face = 1; face <= 6; face++) if (c[face] >= 1) distinct.push(face);
  let runLen = 0, runStart = 0, bestRunLen = 0, bestRunStart = 0;
  for (let face = 1; face <= 6; face++) {
    if (c[face] >= 1) {
      if (runLen === 0) runStart = face;
      runLen++;
      if (runLen > bestRunLen) { bestRunLen = runLen; bestRunStart = runStart; }
    } else {
      runLen = 0;
    }
  }

  const hold = [false, false, false, false, false];

  // Chase a straight only with 3+ in sequence and no strong set (4+ of a kind)
  if (bestRunLen >= 3 && bestCount < 4) {
    const runEnd = bestRunStart + bestRunLen - 1;
    // keep one die of each value in the run; hold high upper-section faces too
    const usedInRun = {};
    for (let i = 0; i < 5; i++) {
      const v = d[i];
      if (v >= bestRunStart && v <= runEnd && !usedInRun[v]) {
        hold[i] = true;
        usedInRun[v] = true;
      }
    }
    return hold;
  }

  // Otherwise: keep the largest matching set...
  if (bestCount >= 2) {
    for (let i = 0; i < 5; i++) if (d[i] === bestFace) hold[i] = true;
  }

  // ...and additionally keep loose 5s and 6s for the upper bonus
  for (let i = 0; i < 5; i++) {
    if (!hold[i] && (d[i] === 6 || d[i] === 5)) hold[i] = true;
  }

  // If nothing got held (e.g. all singles 1-4), keep the highest single
  if (!hold.some(h => h)) {
    let hi = 0, hiIdx = 0;
    for (let i = 0; i < 5; i++) if (d[i] > hi) { hi = d[i]; hiIdx = i; }
    hold[hiIdx] = true;
  }

  return hold;
}

// ── Choose the best legal placement for the current dice ──
// Returns {row, col, score} or null.
function aiChoosePlacement() {
  const p = currentPlayer;
  let best = null;

  for (let col = 0; col < TOTAL_COLS; col++) {
    for (let row = 0; row < TOTAL_ROWS; row++) {
      if (!isValidCell(p, row, col)) continue;
      const score = getPotentialScore(row, col);
      // Reward via the column multiplier so high-factor columns are preferred,
      // and add a small bonus-progress nudge for upper rows that help reach 63.
      let value = score * MULTIPLIERS[col];
      if (row < UPPER_COUNT && score > 0) value += 1; // tiny tie-break toward upper fills
      if (best === null || value > best.value) {
        best = { row, col, score, value };
      }
    }
  }
  return best;
}

// ── Run a full computer turn (async, animated) ──
let aiThinking = false;

function runCpuTurn() {
  if (aiThinking || !isCpuTurn()) return;
  aiThinking = true;
  // Disable manual interaction visually handled in ui via aiThinking flag
  setTimeout(cpuRollStep, 600);
}

function cpuRollStep() {
  if (!isCpuTurn()) { aiThinking = false; return; }

  rollDice(); // uses current `held`, advances rollsLeft, animates

  // After the roll animation settles, decide
  setTimeout(() => {
    if (!isCpuTurn()) { aiThinking = false; return; }

    if (rollsLeft > 0) {
      // Easy mode: occasionally make a sub-optimal hold (skip holding entirely)
      const beLazy = (cpuLevel === 'easy') && Math.random() < 0.35;
      if (!beLazy) {
        held = aiChooseHolds(dice);
      } else {
        held = [false, false, false, false, false];
      }
      renderDice();
      renderScorecard();
      setTimeout(cpuRollStep, 750);
    } else {
      // Out of rolls — place the score
      const choice = aiChoosePlacement();
      setTimeout(() => {
        if (!isCpuTurn()) { aiThinking = false; return; }
        aiThinking = false;
        if (choice) {
          window._aiPlacing = true;
          placeScore(choice.row, choice.col); // triggers nextTurn -> renderAll
          window._aiPlacing = false;
        }
      }, 700);
    }
  }, 550);
}
