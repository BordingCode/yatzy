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
    viewingPlayer: viewingPlayer,
    dice: [...dice],
    held: [...held],
    rollsLeft: rollsLeft,
    hasRolled: hasRolled,
    rollHistory: JSON.parse(JSON.stringify(rollHistory))
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

  // Restore exact dice state (no free rolls)
  dice = state.dice;
  held = state.held;
  rollsLeft = state.rollsLeft;
  hasRolled = state.hasRolled;
  rollHistory = state.rollHistory;
  lastPlacedCell = null;

  renderAll();
}

function canUndo() {
  return undoStack.length > 0;
}

function clearUndoStack() {
  undoStack = [];
}
