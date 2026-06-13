// ═══════════════════════════════════════════
// SCORECARD RENDERING
// ═══════════════════════════════════════════
function renderScorecard() {
  const table = document.getElementById('scorecard');
  const p = viewingPlayer;
  const isCurrentP = p === currentPlayer;
  const canPlace = isCurrentP && hasRolled;

  let html = '<thead><tr><th class="corner"></th>';
  for (let c = 0; c < TOTAL_COLS; c++) {
    html += `<th class="col-header">&times;${MULTIPLIERS[c]}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Upper section
  for (let r = 0; r < UPPER_COUNT; r++) {
    html += renderRow(p, r, canPlace);
  }

  // Sum row
  html += '<tr class="sum-row"><th class="row-label">Sum</th>';
  for (let c = 0; c < TOTAL_COLS; c++) {
    html += `<td>${getUpperSum(p, c)}</td>`;
  }
  html += '</tr>';

  // Bonus row
  html += '<tr class="bonus-row"><th class="row-label">Bonus</th>';
  for (let c = 0; c < TOTAL_COLS; c++) {
    const bonus = getBonus(p, c);
    if (bonus === null) {
      const need = BONUS_THRESHOLD - getUpperSum(p, c);
      html += `<td class="no-bonus">${need > 0 ? need + ' mangler' : ''}</td>`;
    } else if (bonus > 0) {
      html += `<td>+${bonus}</td>`;
    } else {
      html += `<td class="no-bonus">0</td>`;
    }
  }
  html += '</tr>';

  // Lower section
  for (let r = UPPER_COUNT; r < TOTAL_ROWS; r++) {
    html += renderRow(p, r, canPlace);
  }

  // Column base sum row
  html += '<tr class="sum-row"><th class="row-label">Kolonnesum</th>';
  for (let c = 0; c < TOTAL_COLS; c++) {
    html += `<td>${getColBaseSum(p, c)}</td>`;
  }
  html += '</tr>';

  // Total row (base sum x multiplier)
  html += '<tr class="total-row"><th class="row-label">Total (&times;)</th>';
  for (let c = 0; c < TOTAL_COLS; c++) {
    html += `<td>${getColTotal(p, c)}</td>`;
  }
  html += '</tr>';

  // Grand total
  html += '<tr class="total-row"><th class="row-label">Grand Total</th>';
  html += `<td colspan="${TOTAL_COLS}" style="text-align:center;font-size:1rem">${getGrandTotal(p)}</td>`;
  html += '</tr>';

  html += '</tbody>';
  table.innerHTML = html;
  void table.offsetHeight; // Force reflow for mobile browsers

  // Add click handlers for valid cells
  if (canPlace) {
    table.querySelectorAll('td.valid').forEach(td => {
      td.addEventListener('click', () => {
        const r = parseInt(td.dataset.row);
        const c = parseInt(td.dataset.col);
        placeScore(r, c);
      });
    });
  }
}

function renderRow(p, r, canPlace) {
  let html = `<tr><th class="row-label">${ROW_NAMES[r]}</th>`;
  for (let c = 0; c < TOTAL_COLS; c++) {
    const val = players[p].scores[r][c];
    const isJustPlaced = lastPlacedCell &&
      lastPlacedCell.row === r && lastPlacedCell.col === c && lastPlacedCell.player === p;
    if (val !== null) {
      const classes = ['score-cell', 'filled'];
      if (val === 0) classes.push('zero-score');
      if (isJustPlaced) classes.push('just-placed');
      html += `<td class="${classes.join(' ')}">${val}</td>`;
    } else if (canPlace && isValidCell(p, r, c)) {
      const potential = getPotentialScore(r, c);
      html += `<td class="score-cell valid${potential === 0 ? ' zero-score' : ''}" data-row="${r}" data-col="${c}">${potential}</td>`;
    } else {
      html += `<td class="score-cell"></td>`;
    }
  }
  html += '</tr>';
  return html;
}

// ═══════════════════════════════════════════
// PLAYER TABS
// ═══════════════════════════════════════════
function renderTabs() {
  const tabs = document.getElementById('playerTabs');
  tabs.innerHTML = '';
  players.forEach((p, i) => {
    const tab = document.createElement('div');
    tab.className = 'player-tab' + (i === viewingPlayer ? ' active' : '');
    const total = getGrandTotal(i);
    tab.innerHTML = `${p.name}<span class="tab-score">${total}</span>`;
    if (i === currentPlayer) tab.style.borderColor = 'var(--accent-dim)';
    tab.addEventListener('click', () => {
      viewingPlayer = i;
      renderTabs();
      renderScorecard();
    });
    tabs.appendChild(tab);
  });
}

function renderTurnInfo() {
  const info = document.getElementById('turnInfo');
  info.textContent = `${players[currentPlayer].name}s tur`;
}

function renderUndoBtn() {
  const btn = document.getElementById('undoBtn');
  if (btn) {
    btn.disabled = !canUndo();
  }
}

// ═══════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════
function renderAll() {
  renderDice();
  renderRollBtn();
  renderTabs();
  renderTurnInfo();
  renderScorecard();
  renderUndoBtn();
  updateSoundBtn();
}

// ═══════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showEndScreen() {
  showScreen('endScreen');
  const sorted = players.map((p, i) => ({ name: p.name, total: getGrandTotal(i) }))
    .sort((a, b) => b.total - a.total);

  document.getElementById('endSubtitle').textContent =
    players.length > 1 ? `${sorted[0].name} vinder!` : 'Endelig score';

  const container = document.getElementById('endScores');
  container.innerHTML = '';
  sorted.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'end-score-row' + (i === 0 ? ' winner' : '');
    row.innerHTML = `<span class="end-score-name">${i + 1}. ${p.name}</span><span class="end-score-val">${p.total}</span>`;
    container.appendChild(row);
  });

  const newIndices = saveGameHighscores();
  renderHighscoreBox('endHighscores', newIndices);
}

// ═══════════════════════════════════════════
// HIGHSCORE RENDERING
// ═══════════════════════════════════════════
function renderHighscoreBox(containerId, highlightIndices) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const list = getHighscores();
  let html = '<div class="highscore-title">Rekorder</div>';
  if (!list.length) {
    html += '<div class="highscore-empty">Ingen scores endnu</div>';
  } else {
    html += '<ul class="highscore-list">';
    list.forEach((e, i) => {
      const isNew = highlightIndices && highlightIndices.includes(i);
      html += `<li class="${isNew ? 'hs-new' : ''}">
        <span class="hs-rank">${i + 1}.</span>
        <span class="hs-name">${e.name}${e.mode ? `<span class="hs-mode">${e.mode}</span>` : ''}</span>
        <span class="hs-score">${e.score}</span>
        <span class="hs-date">${e.date || ''}</span>
      </li>`;
    });
    html += '</ul>';
  }
  if (list.length) {
    html += '<button class="hs-clear" onclick="clearHighscores()">Ryd scores</button>';
  }
  container.innerHTML = html;
}

// ═══════════════════════════════════════════
// START SCREEN
// ═══════════════════════════════════════════
function makeNameInput(id, placeholder, value) {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = value;
  input.id = id;
  return input;
}

function updatePlayerInputs() {
  const mode = (document.getElementById('gameMode') || {}).value || 'solo';
  const cpuOpts = document.getElementById('cpuOptions');
  const multiOpts = document.getElementById('multiOptions');
  if (cpuOpts) cpuOpts.style.display = mode === 'cpu' ? '' : 'none';
  if (multiOpts) multiOpts.style.display = mode === 'multi' ? '' : 'none';

  const container = document.getElementById('playerInputs');
  container.innerHTML = '';

  if (mode === 'solo') {
    container.appendChild(makeNameInput('pname0', 'Dit navn', 'Spiller 1'));
  } else if (mode === 'cpu') {
    container.appendChild(makeNameInput('pname0', 'Dit navn', 'Dig'));
  } else {
    const n = parseInt(document.getElementById('playerCount').value);
    for (let i = 0; i < n; i++) {
      container.appendChild(makeNameInput(`pname${i}`, `Spiller ${i + 1} navn`, `Spiller ${i + 1}`));
    }
  }
}

// ═══════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════
const THEME_KEY = 'yatzy_theme';

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY) || '';
  applyTheme(theme);
  const select = document.getElementById('themeSelect');
  if (select) select.value = theme;
}

// Primary colour per theme for the browser/PWA toolbar tint
const THEME_COLORS = {
  '': '#5C3A1E',          // Brætspil (board game)
  'elegant': '#16213E',   // Elegant Mørk
  'casino': '#1A0A0A',    // Casino
  'light': '#F5F3EE',     // Lys & Moderne
  'retro': '#000800'      // Retro Arcade
};

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS['']);
}

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
document.getElementById('gameMode').addEventListener('change', updatePlayerInputs);
document.getElementById('playerCount').addEventListener('change', updatePlayerInputs);
document.getElementById('startBtn').addEventListener('click', startGame);

// ── Rules panel ──
function openRules() { document.getElementById('rulesOverlay').classList.add('active'); }
function closeRules() { document.getElementById('rulesOverlay').classList.remove('active'); }
document.getElementById('rulesBtn').addEventListener('click', openRules);
document.getElementById('helpBtn').addEventListener('click', openRules);
document.getElementById('rulesCloseBtn').addEventListener('click', closeRules);
document.getElementById('rulesGotItBtn').addEventListener('click', closeRules);
document.getElementById('rulesOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'rulesOverlay') closeRules();
});
document.getElementById('rollBtn').addEventListener('click', rollDice);
document.getElementById('undoBtn').addEventListener('click', undoLastMove);
document.getElementById('soundBtn').addEventListener('click', toggleSound);
document.getElementById('themeSelect').addEventListener('change', (e) => {
  applyTheme(e.target.value);
});
document.getElementById('playAgainBtn').addEventListener('click', () => {
  showScreen('startScreen');
  updatePlayerInputs();
  renderHighscoreBox('startHighscores');
});

// Init
loadTheme();
updatePlayerInputs();
renderHighscoreBox('startHighscores');
updateSoundBtn();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
