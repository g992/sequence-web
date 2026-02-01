import type { BoardCell, Card, TeamColor } from "@/types";
import { isOneEyedJack, isTwoEyedJack } from "@/types";
import { findCellsForCard, getEmptyCells, getRemovableChips } from "./board";

export type AIDifficulty = "easy" | "medium" | "hard";

interface AIMove {
  cardIndex: number;
  targetRow: number;
  targetCol: number;
}

interface LineAnalysis {
  cells: Array<{ row: number; col: number; hasChip: boolean }>;
  chipCount: number;
  emptyCount: number;
  direction: [number, number];
  // Positions where we can extend the line
  extensionPoints: Array<{ row: number; col: number }>;
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

// Check if cell belongs to team
function cellBelongsToTeam(cell: BoardCell, teamColor: TeamColor): boolean {
  if (cell.card === "CORNER") return true;
  return cell.chip?.color === teamColor;
}

// Check if cell is empty (no chip, not corner)
function isCellEmpty(cell: BoardCell): boolean {
  return cell.chip === null && cell.card !== "CORNER";
}

// Check if cell is blocked by enemy
function isBlockedByEnemy(cell: BoardCell, teamColor: TeamColor): boolean {
  return cell.chip !== null && cell.chip.color !== teamColor;
}

// Analyze a potential line of 10 cells in a direction
function analyzeLineFromStart(
  board: BoardCell[][],
  startRow: number,
  startCol: number,
  direction: [number, number],
  teamColor: TeamColor,
  maxLength: number = 10,
): LineAnalysis | null {
  const [dr, dc] = direction;
  const cells: LineAnalysis["cells"] = [];
  const extensionPoints: Array<{ row: number; col: number }> = [];
  let chipCount = 0;
  let emptyCount = 0;

  for (let i = 0; i < maxLength; i++) {
    const row = startRow + dr * i;
    const col = startCol + dc * i;

    if (row < 0 || row >= 10 || col < 0 || col >= 10) break;

    const cell = board[row]?.[col];
    if (!cell) break;

    // If blocked by enemy, line ends here
    if (isBlockedByEnemy(cell, teamColor)) break;

    const hasChip = cellBelongsToTeam(cell, teamColor);
    cells.push({ row, col, hasChip });

    if (hasChip) {
      chipCount++;
    } else if (isCellEmpty(cell)) {
      emptyCount++;
      extensionPoints.push({ row, col });
    }
  }

  if (cells.length < 5) return null;

  return { cells, chipCount, emptyCount, direction, extensionPoints };
}

// Find all potential lines for a team (including partially built)
function findPotentialLines(
  board: BoardCell[][],
  teamColor: TeamColor,
): LineAnalysis[] {
  const lines: LineAnalysis[] = [];
  const processedKeys = new Set<string>();

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      for (const direction of DIRECTIONS) {
        const key = `${row},${col},${direction[0]},${direction[1]}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const line = analyzeLineFromStart(
          board,
          row,
          col,
          direction,
          teamColor,
        );
        if (line && line.chipCount >= 2) {
          lines.push(line);
        }
      }
    }
  }

  // Sort by chip count (more chips = better)
  return lines.sort((a, b) => b.chipCount - a.chipCount);
}

// Find existing complete lines (5+ consecutive chips)
function findExistingLines(
  board: BoardCell[][],
  teamColor: TeamColor,
): Array<{ cells: Array<{ row: number; col: number }>; length: number }> {
  const lines: Array<{
    cells: Array<{ row: number; col: number }>;
    length: number;
  }> = [];
  const processedKeys = new Set<string>();

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]?.[col];
      if (!cell || !cellBelongsToTeam(cell, teamColor)) continue;

      for (const direction of DIRECTIONS) {
        // Find start of this line
        const [dr, dc] = direction;
        let startRow = row;
        let startCol = col;

        while (true) {
          const prevRow = startRow - dr;
          const prevCol = startCol - dc;
          if (prevRow < 0 || prevRow >= 10 || prevCol < 0 || prevCol >= 10)
            break;
          const prevCell = board[prevRow]?.[prevCol];
          if (!prevCell || !cellBelongsToTeam(prevCell, teamColor)) break;
          startRow = prevRow;
          startCol = prevCol;
        }

        const key = `${startRow},${startCol},${direction[0]},${direction[1]}`;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        // Count consecutive chips
        const cells: Array<{ row: number; col: number }> = [];
        let r = startRow;
        let c = startCol;

        while (r >= 0 && r < 10 && c >= 0 && c < 10) {
          const lineCell = board[r]?.[c];
          if (!lineCell || !cellBelongsToTeam(lineCell, teamColor)) break;
          cells.push({ row: r, col: c });
          r += dr;
          c += dc;
        }

        if (cells.length >= 5) {
          lines.push({ cells, length: cells.length });
        }
      }
    }
  }

  return lines;
}

// Find a card in hand that can be played at a specific position
function findCardForPosition(
  hand: Card[],
  board: BoardCell[][],
  targetRow: number,
  targetCol: number,
): number {
  const targetCell = board[targetRow]?.[targetCol];
  if (!targetCell || targetCell.card === "CORNER") return -1;

  const cellCard = targetCell.card;

  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;

    // Two-eyed jack can go anywhere empty
    if (isTwoEyedJack(card)) {
      return i;
    }

    // Normal card - check if it matches
    if (card.rank === cellCard.rank && card.suit === cellCard.suit) {
      return i;
    }
  }

  return -1;
}

// Get all valid moves for a card
function getValidMovesForCard(
  card: Card,
  board: BoardCell[][],
  playerColor: TeamColor,
): Array<{ row: number; col: number }> {
  if (isTwoEyedJack(card)) {
    return getEmptyCells(board).map((c) => ({ row: c.row, col: c.col }));
  }

  if (isOneEyedJack(card)) {
    return getRemovableChips(board, [playerColor]).map((c) => ({
      row: c.row,
      col: c.col,
    }));
  }

  return findCellsForCard(board, card)
    .filter((c) => c.chip === null)
    .map((c) => ({ row: c.row, col: c.col }));
}

// Random element from array
function randomFrom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get all possible moves for AI
function getAllPossibleMoves(
  hand: Card[],
  board: BoardCell[][],
  playerColor: TeamColor,
): AIMove[] {
  const allMoves: AIMove[] = [];
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    const moves = getValidMovesForCard(card, board, playerColor);
    for (const move of moves) {
      allMoves.push({ cardIndex: i, targetRow: move.row, targetCol: move.col });
    }
  }
  return allMoves;
}

// ===================
// AI DIFFICULTY LEVELS
// ===================

// Level 1: Easy AI
// - Every even turn: tries to find/continue a sequence
// - Every odd turn: plays randomly
function makeEasyMove(
  hand: Card[],
  board: BoardCell[][],
  aiColor: TeamColor,
  playerColor: TeamColor,
  turnNumber: number,
): AIMove | null {
  const allMoves = getAllPossibleMoves(hand, board, playerColor);
  if (allMoves.length === 0) return null;

  const isEvenTurn = turnNumber % 2 === 0;

  // Handle one-eyed jack - remove random player chip
  const oneEyedJackIndex = hand.findIndex((c) => isOneEyedJack(c));
  if (oneEyedJackIndex !== -1) {
    const removable = getRemovableChips(board, [playerColor]);
    if (removable.length > 0) {
      const target = randomFrom(removable)!;
      return {
        cardIndex: oneEyedJackIndex,
        targetRow: target.row,
        targetCol: target.col,
      };
    }
  }

  if (isEvenTurn) {
    // Try to continue a sequence
    const lines = findPotentialLines(board, aiColor);

    for (const line of lines) {
      for (const ext of line.extensionPoints) {
        const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
        if (cardIdx !== -1) {
          return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
        }
      }
    }
  }

  // Random move
  return randomFrom(allMoves) ?? null;
}

// Level 2: Medium AI
// - Always tries to continue/build sequences
// - Prioritizes extending existing lines towards 5, then towards 10
function makeMediumMove(
  hand: Card[],
  board: BoardCell[][],
  aiColor: TeamColor,
  playerColor: TeamColor,
): AIMove | null {
  const allMoves = getAllPossibleMoves(hand, board, playerColor);
  if (allMoves.length === 0) return null;

  // Check if we have a line with 5-9 chips - try to extend to 10
  const existingLines = findExistingLines(board, aiColor);
  for (const line of existingLines) {
    if (line.length >= 5 && line.length < 10) {
      // Try to extend this line
      const firstCell = line.cells[0]!;
      const lastCell = line.cells[line.cells.length - 1]!;

      for (const direction of DIRECTIONS) {
        // Check both ends
        const [dr, dc] = direction;
        const beforeRow = firstCell.row - dr;
        const beforeCol = firstCell.col - dc;
        const afterRow = lastCell.row + dr;
        const afterCol = lastCell.col + dc;

        for (const pos of [
          { row: beforeRow, col: beforeCol },
          { row: afterRow, col: afterCol },
        ]) {
          if (pos.row < 0 || pos.row >= 10 || pos.col < 0 || pos.col >= 10)
            continue;
          const cell = board[pos.row]?.[pos.col];
          if (cell && isCellEmpty(cell)) {
            const cardIdx = findCardForPosition(hand, board, pos.row, pos.col);
            if (cardIdx !== -1) {
              return {
                cardIndex: cardIdx,
                targetRow: pos.row,
                targetCol: pos.col,
              };
            }
          }
        }
      }
    }
  }

  // Try to build towards 5
  const potentialLines = findPotentialLines(board, aiColor);
  for (const line of potentialLines) {
    // Prioritize lines that are close to completion
    if (line.chipCount >= 3) {
      for (const ext of line.extensionPoints) {
        const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
        if (cardIdx !== -1) {
          return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
        }
      }
    }
  }

  // Try any extension
  for (const line of potentialLines) {
    for (const ext of line.extensionPoints) {
      const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
      if (cardIdx !== -1) {
        return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
      }
    }
  }

  return randomFrom(allMoves) ?? null;
}

// Level 3: Hard AI
// - Builds sequences + actively blocks player
// - Uses one-eyed jacks strategically
// - Prioritizes winning moves, then blocking moves
function makeHardMove(
  hand: Card[],
  board: BoardCell[][],
  aiColor: TeamColor,
  playerColor: TeamColor,
): AIMove | null {
  const allMoves = getAllPossibleMoves(hand, board, playerColor);
  if (allMoves.length === 0) return null;

  // Priority 1: Complete a winning move (get to 10 chips or second separate sequence)
  const aiExistingLines = findExistingLines(board, aiColor);
  for (const line of aiExistingLines) {
    if (line.length >= 5 && line.length < 10) {
      // Try to extend to 10 for instant win
      const firstCell = line.cells[0]!;
      const lastCell = line.cells[line.cells.length - 1]!;

      for (const direction of DIRECTIONS) {
        const [dr, dc] = direction;
        const positions = [
          { row: firstCell.row - dr, col: firstCell.col - dc },
          { row: lastCell.row + dr, col: lastCell.col + dc },
        ];

        for (const pos of positions) {
          if (pos.row < 0 || pos.row >= 10 || pos.col < 0 || pos.col >= 10)
            continue;
          const cell = board[pos.row]?.[pos.col];
          if (cell && isCellEmpty(cell)) {
            const cardIdx = findCardForPosition(hand, board, pos.row, pos.col);
            if (cardIdx !== -1) {
              return {
                cardIndex: cardIdx,
                targetRow: pos.row,
                targetCol: pos.col,
              };
            }
          }
        }
      }
    }
  }

  // Priority 2: Complete own sequence (get to 5)
  const aiPotentialLines = findPotentialLines(board, aiColor);
  for (const line of aiPotentialLines) {
    if (line.chipCount === 4 && line.extensionPoints.length > 0) {
      const ext = line.extensionPoints[0]!;
      const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
      if (cardIdx !== -1) {
        return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
      }
    }
  }

  // Priority 3: Block player's near-complete sequences
  const playerPotentialLines = findPotentialLines(board, playerColor);

  // Use one-eyed jack to break player's sequences
  const oneEyedJackIndex = hand.findIndex((c) => isOneEyedJack(c));
  if (oneEyedJackIndex !== -1) {
    for (const line of playerPotentialLines) {
      if (line.chipCount >= 4) {
        // Find a chip to remove
        for (const cell of line.cells) {
          if (cell.hasChip) {
            const boardCell = board[cell.row]?.[cell.col];
            if (
              boardCell?.chip &&
              boardCell.chip.color === playerColor &&
              !boardCell.chip.partOfSequence
            ) {
              return {
                cardIndex: oneEyedJackIndex,
                targetRow: cell.row,
                targetCol: cell.col,
              };
            }
          }
        }
      }
    }
  }

  // Block by placing our chip in player's path
  for (const line of playerPotentialLines) {
    if (line.chipCount >= 3) {
      for (const ext of line.extensionPoints) {
        const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
        if (cardIdx !== -1 && !isOneEyedJack(hand[cardIdx]!)) {
          return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
        }
      }
    }
  }

  // Priority 4: Build own sequences
  for (const line of aiPotentialLines) {
    for (const ext of line.extensionPoints) {
      const cardIdx = findCardForPosition(hand, board, ext.row, ext.col);
      if (cardIdx !== -1) {
        return { cardIndex: cardIdx, targetRow: ext.row, targetCol: ext.col };
      }
    }
  }

  return randomFrom(allMoves) ?? null;
}

// Main AI move function
export function makeAIMove(
  difficulty: AIDifficulty,
  hand: Card[],
  board: BoardCell[][],
  aiColor: TeamColor,
  playerColor: TeamColor,
  turnNumber: number,
): AIMove | null {
  switch (difficulty) {
    case "easy":
      return makeEasyMove(hand, board, aiColor, playerColor, turnNumber);
    case "medium":
      return makeMediumMove(hand, board, aiColor, playerColor);
    case "hard":
      return makeHardMove(hand, board, aiColor, playerColor);
    default:
      return null;
  }
}
