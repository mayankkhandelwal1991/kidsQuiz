/**
 * bot.js
 * -----------------------------------------------------------------------
 * A lightweight, dependency-free "Computer" opponent. Rather than a full
 * minimax search (which plays perfectly and is no fun to face), this uses
 * a classic heuristic ladder — it plays solidly and will punish obvious
 * mistakes, but isn't unbeatable, which suits a casual quick-match bot.
 * -----------------------------------------------------------------------
 */

import { WIN_LINES } from './utils.js';

const CENTER = 4;
const CORNERS = [0, 2, 6, 8];
const EDGES = [1, 3, 5, 7];

/** Indices of empty cells. */
function emptyCells(cells) {
  const out = [];
  for (let i = 0; i < 9; i++) if (!cells[i]) out.push(i);
  return out;
}

/** If `symbol` has a line with two marks and one empty cell, return that empty index. */
function findCompletingMove(cells, symbol) {
  for (const [a, b, c] of WIN_LINES) {
    const line = [cells[a], cells[b], cells[c]];
    const marks = line.filter((v) => v === symbol).length;
    const blanks = line.filter((v) => !v).length;
    if (marks === 2 && blanks === 1) {
      const idx = [a, b, c][line.findIndex((v) => !v)];
      return idx;
    }
  }
  return null;
}

/**
 * Compute the bot's next move (bot always plays 'O').
 * @param {object} cells - index -> '' | 'X' | 'O'
 * @returns {number} the chosen cell index, guaranteed to be empty.
 */
export function computeBotMove(cells) {
  const empties = emptyCells(cells);
  if (empties.length === 0) return -1; // board full, shouldn't be called

  // 1. Take a winning move if one exists.
  const winMove = findCompletingMove(cells, 'O');
  if (winMove !== null) return winMove;

  // 2. Block the opponent's winning move if they have one.
  const blockMove = findCompletingMove(cells, 'X');
  if (blockMove !== null) return blockMove;

  // 3. Take the center if it's open — the strongest single square.
  if (!cells[CENTER]) return CENTER;

  // 4. Occasionally "miss" a purely positional best-move to keep the bot
  // beatable and fun rather than flawless (does not apply to the win/
  // block checks above, so the bot never blunders a game-losing line).
  const playsOptimally = Math.random() < 0.75;

  // 5. Prefer an open corner (strong positionally), otherwise any open edge.
  const openCorners = CORNERS.filter((i) => empties.includes(i));
  const openEdges = EDGES.filter((i) => empties.includes(i));

  if (playsOptimally && openCorners.length) {
    return openCorners[Math.floor(Math.random() * openCorners.length)];
  }
  if (playsOptimally && openEdges.length) {
    return openEdges[Math.floor(Math.random() * openEdges.length)];
  }

  // 6. Fallback: any random empty cell.
  return empties[Math.floor(Math.random() * empties.length)];
}
