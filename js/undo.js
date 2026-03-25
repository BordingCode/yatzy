// ═══════════════════════════════════════════
// UNDO SYSTEM
// ═══════════════════════════════════════════
let undoStack = [];

function saveUndoState() {
  undoStack.push({
    players: JSON.parse(JSON.stringify(players.map(p => ({
      name: p.name,
      scores: p.scores
    })))),
    currentPlayer: currentPlayer,
    viewingPlayer: viewingPlayer
  });
}

function undoLastMove() {
  if (undoStack.length === 0) return;

  const state = undoStack.pop();

  // Restore player scores
  state.players.forEach((p, i) => {
    players[i].scores = p.scores;
  });

  // Restore to previous player's turn
  currentPlayer = state.currentPlayer;
  viewingPlayer = state.viewingPlayer;

  // Reset dice for a fresh turn
  dice = [1, 1, 1, 1, 1];
  held = [false, false, false, false, false];
  rollsLeft = 3;
  hasRolled = false;
  rollHistory = [];
  lastPlacedCell = null;

  renderAll();
}

function canUndo() {
  return undoStack.length > 0;
}

function clearUndoStack() {
  undoStack = [];
}
