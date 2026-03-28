// ═══════════════════════════════════════════
// DICE RENDERING
// ═══════════════════════════════════════════
const PIP_MAP = {
  1: [0,0,0,0,1,0,0,0,0],
  2: [0,0,1,0,0,0,1,0,0],
  3: [0,0,1,0,1,0,1,0,0],
  4: [1,0,1,0,0,0,1,0,1],
  5: [1,0,1,0,1,0,1,0,1],
  6: [1,0,1,1,0,1,1,0,1],
};

function renderDie(value) {
  const pips = PIP_MAP[value] || PIP_MAP[1];
  return pips.map(p => `<div class="pip${p ? '' : ' hide'}"></div>`).join('');
}

function renderDice() {
  const row = document.getElementById('diceRow');
  row.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const d = document.createElement('div');
    d.className = 'die' + (held[i] ? ' held' : '') + (!hasRolled ? ' disabled' : '');
    d.innerHTML = renderDie(dice[i]);
    d.addEventListener('click', () => toggleHold(i));
    row.appendChild(d);
  }
}

function toggleHold(i) {
  if (!hasRolled || rollsLeft === 0) return;
  held[i] = !held[i];
  renderDice();
  renderScorecard(); // Update col 5 previews when hold state changes
}

// ═══════════════════════════════════════════
// ROLLING
// ═══════════════════════════════════════════
function rollDice() {
  if (rollsLeft <= 0) return;
  clearUndoStack();

  const rolledIndices = [];

  for (let i = 0; i < 5; i++) {
    if (!held[i]) {
      dice[i] = Math.floor(Math.random() * 6) + 1;
      rolledIndices.push(i);
    }
  }

  rollHistory.push(rolledIndices);
  rollsLeft--;
  hasRolled = true;

  // Sound & haptics
  playRollSound();
  vibrate([30, 20, 30]);

  // Animate rolled dice with stagger
  renderDice();
  const dieEls = document.querySelectorAll('.die');
  rolledIndices.forEach((idx, i) => {
    if (dieEls[idx]) {
      dieEls[idx].classList.add('rolling', `roll-delay-${i + 1}`);
      setTimeout(() => {
        dieEls[idx].classList.remove('rolling', `roll-delay-${i + 1}`);
      }, 400);
    }
  });

  renderRollBtn();
  renderScorecard();
  renderUndoBtn();
}

function renderRollBtn() {
  const btn = document.getElementById('rollBtn');
  if (!hasRolled) {
    btn.textContent = 'Rul';
    btn.disabled = false;
  } else if (rollsLeft > 0) {
    btn.textContent = `Rul igen (${rollsLeft} tilbage)`;
    btn.disabled = false;
  } else {
    btn.textContent = 'Ingen rul tilbage';
    btn.disabled = true;
  }
}

// ═══════════════════════════════════════════
// SOUND (Web Audio API)
// ═══════════════════════════════════════════
let audioCtx = null;
const SOUND_KEY = 'yatzy_sound_on';

function isSoundOn() {
  const val = localStorage.getItem(SOUND_KEY);
  return val === null ? true : val === 'true';
}

function toggleSound() {
  const on = !isSoundOn();
  localStorage.setItem(SOUND_KEY, String(on));
  updateSoundBtn();
}

function updateSoundBtn() {
  const btn = document.getElementById('soundBtn');
  if (btn) {
    btn.textContent = isSoundOn() ? '\u{1F50A}' : '\u{1F507}';
    btn.classList.toggle('active', isSoundOn());
  }
}

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playRollSound() {
  if (!isSoundOn()) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const duration = 0.28;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Noise burst with rapid decay — sounds like dice on wood
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5) * 0.6;
      // Add some low-frequency thump
      data[i] += Math.sin(t * Math.PI * 120) * Math.pow(1 - t, 4) * 0.3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = 0.25;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  } catch(e) { /* silent fail */ }
}

function playPlaceSound() {
  if (!isSoundOn()) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const duration = 0.1;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Short wooden tap
      data[i] = Math.sin(t * Math.PI * 300) * Math.pow(1 - t, 5) * 0.4;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = 0.2;

    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch(e) { /* silent fail */ }
}

// ═══════════════════════════════════════════
// HAPTICS
// ═══════════════════════════════════════════
function vibrate(pattern) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}
