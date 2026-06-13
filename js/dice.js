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
  if (typeof aiThinking !== 'undefined' && aiThinking) return;
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

  // Animate rolled dice: tumble through random faces, then settle on the real value.
  renderDice();
  animateRoll(rolledIndices);

  renderRollBtn();
  renderScorecard();
  renderUndoBtn();
}

// Tumble each rolling die through random faces before settling on the real value.
// Staggered start (~60ms) gives a visible cascade; uses animationend so later
// dice in the cascade aren't cut short by a single flat timeout.
const TUMBLE_FACE_MS = 50;   // how often the shown face changes while tumbling
const TUMBLE_DURATION = 300; // how long each die tumbles
const TUMBLE_STAGGER = 60;   // delay between consecutive dice starting

function animateRoll(rolledIndices) {
  const dieEls = document.querySelectorAll('.die');

  rolledIndices.forEach((idx, i) => {
    const el = dieEls[idx];
    if (!el) return;
    const startDelay = i * TUMBLE_STAGGER;

    setTimeout(() => {
      // Re-fetch in case the DOM changed; bail if this die no longer exists
      const live = document.querySelectorAll('.die')[idx];
      if (!live) return;

      live.classList.add('rolling');

      // Clear the rolling class when the CSS animation actually ends
      const onEnd = () => {
        live.classList.remove('rolling');
        live.removeEventListener('animationend', onEnd);
      };
      live.addEventListener('animationend', onEnd);

      // Cycle through random faces during the tumble
      const ticks = Math.floor(TUMBLE_DURATION / TUMBLE_FACE_MS);
      let n = 0;
      const faceTimer = setInterval(() => {
        n++;
        const cur = document.querySelectorAll('.die')[idx];
        if (!cur || n >= ticks) {
          clearInterval(faceTimer);
          // Settle on the real value
          if (cur) cur.innerHTML = renderDie(dice[idx]);
          return;
        }
        cur.innerHTML = renderDie(Math.floor(Math.random() * 6) + 1);
      }, TUMBLE_FACE_MS);

      // Safety net: ensure rolling class is gone even if animationend is missed
      setTimeout(onEnd, TUMBLE_DURATION + 120);
    }, startDelay);
  });
}

function renderRollBtn() {
  const btn = document.getElementById('rollBtn');
  // During the computer's turn, the human can't roll
  if (typeof isCpuTurn === 'function' && isCpuTurn()) {
    btn.textContent = 'Computeren tænker…';
    btn.disabled = true;
    return;
  }
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
