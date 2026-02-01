import type { BoardCell, TeamColor, Sequence } from "@/types";

type Direction = [number, number];

const DIRECTIONS: Direction[] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

// Check if cell belongs to team (chip or corner)
function cellBelongsToTeam(cell: BoardCell, teamColor: TeamColor): boolean {
  if (cell.card === "CORNER") return true;
  return cell.chip?.color === teamColor;
}

// Find the maximum continuous line of chips in a direction from a starting point
function findMaxLineInDirection(
  board: BoardCell[][],
  startRow: number,
  startCol: number,
  direction: Direction,
  teamColor: TeamColor,
): Array<{ row: number; col: number }> | null {
  const [dr, dc] = direction;
  const cells: Array<{ row: number; col: number }> = [];

  // Go in the direction until we hit a boundary or non-matching cell
  let row = startRow;
  let col = startCol;

  while (row >= 0 && row < 10 && col >= 0 && col < 10) {
    const cell = board[row]?.[col];
    if (!cell || !cellBelongsToTeam(cell, teamColor)) {
      break;
    }
    cells.push({ row, col });
    row += dr;
    col += dc;
  }

  return cells.length >= 5 ? cells : null;
}

// Find the start of a line (go backwards to find the beginning)
function findLineStart(
  board: BoardCell[][],
  row: number,
  col: number,
  direction: Direction,
  teamColor: TeamColor,
): { row: number; col: number } {
  const [dr, dc] = direction;
  let startRow = row;
  let startCol = col;

  // Go backwards
  while (true) {
    const prevRow = startRow - dr;
    const prevCol = startCol - dc;

    if (prevRow < 0 || prevRow >= 10 || prevCol < 0 || prevCol >= 10) {
      break;
    }

    const cell = board[prevRow]?.[prevCol];
    if (!cell || !cellBelongsToTeam(cell, teamColor)) {
      break;
    }

    startRow = prevRow;
    startCol = prevCol;
  }

  return { row: startRow, col: startCol };
}

// Find complete line from any cell in the line
function findCompleteLine(
  board: BoardCell[][],
  row: number,
  col: number,
  direction: Direction,
  teamColor: TeamColor,
): Array<{ row: number; col: number }> | null {
  const start = findLineStart(board, row, col, direction, teamColor);
  return findMaxLineInDirection(
    board,
    start.row,
    start.col,
    direction,
    teamColor,
  );
}

interface LineInfo {
  cells: Array<{ row: number; col: number }>;
  direction: Direction;
  sequenceCount: number; // 1 for 5-9 cells, 2 for 10 cells
}

// Find all complete lines (5+ cells) for a team
function findAllLines(board: BoardCell[][], teamColor: TeamColor): LineInfo[] {
  const lines: LineInfo[] = [];
  const processedKeys = new Set<string>();

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]?.[col];
      if (!cell || !cellBelongsToTeam(cell, teamColor)) continue;

      for (const direction of DIRECTIONS) {
        // Create a unique key for this line based on start position and direction
        const start = findLineStart(board, row, col, direction, teamColor);
        const key = `${start.row},${start.col},${direction[0]},${direction[1]}`;

        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const line = findMaxLineInDirection(
          board,
          start.row,
          start.col,
          direction,
          teamColor,
        );
        if (line && line.length >= 5) {
          // 5-9 cells = 1 sequence, 10 cells = 2 sequences
          const sequenceCount = line.length >= 10 ? 2 : 1;
          lines.push({ cells: line, direction, sequenceCount });
        }
      }
    }
  }

  return lines;
}

// Detect new sequences after a move
// Returns new sequences that weren't already counted
export function findNewSequences(
  board: BoardCell[][],
  teamColor: TeamColor,
  existingSequences: Sequence[],
): Sequence[] {
  const newSequences: Sequence[] = [];
  const allLines = findAllLines(board, teamColor);

  // Count existing sequences for this team
  const existingCount = existingSequences.filter(
    (s) => s.teamColor === teamColor,
  ).length;

  // Calculate total sequences from all lines
  let totalSequenceCount = 0;
  for (const line of allLines) {
    totalSequenceCount += line.sequenceCount;
  }

  // How many new sequences?
  const newCount = totalSequenceCount - existingCount;

  if (newCount > 0) {
    // Find lines that contain new (non-blocked) cells
    for (const line of allLines) {
      const hasNewCell = line.cells.some((c) => {
        const cell = board[c.row]?.[c.col];
        if (!cell) return false;
        if (cell.card === "CORNER") return false; // Corners don't count as "new"
        return cell.chip && !cell.chip.partOfSequence;
      });

      if (hasNewCell) {
        // This line contributed to new sequence(s)
        // Add one sequence entry for each sequence this line represents
        // But we only add one Sequence object per line (it just might count for more)
        newSequences.push({
          teamColor,
          cells: line.cells,
        });

        // If this line counts as 2 sequences (10 cells), add another entry
        if (line.sequenceCount === 2 && newCount >= 2) {
          // Check if we already had 1 sequence from this line
          const existingFromThisLine = existingSequences.filter(
            (s) =>
              s.teamColor === teamColor &&
              s.cells.some((c) =>
                line.cells.some((lc) => lc.row === c.row && lc.col === c.col),
              ),
          ).length;

          if (existingFromThisLine === 0) {
            // This is a completely new 10-cell line, counts as 2
            newSequences.push({
              teamColor,
              cells: line.cells,
            });
          }
        }

        break; // Only process one new sequence per move
      }
    }
  }

  return newSequences;
}

// Mark all cells in a line as part of sequence
export function markSequenceCells(
  board: BoardCell[][],
  sequence: Sequence,
): void {
  // Find the complete line that contains this sequence
  if (sequence.cells.length === 0) return;

  const firstCell = sequence.cells[0]!;
  const teamColor = sequence.teamColor;

  // Mark all cells in the sequence
  for (const { row, col } of sequence.cells) {
    const cell = board[row]?.[col];
    if (cell?.chip) {
      cell.chip.partOfSequence = true;
    }
  }

  // Also find and mark the full line (in case sequence.cells was partial)
  for (const direction of DIRECTIONS) {
    const line = findCompleteLine(
      board,
      firstCell.row,
      firstCell.col,
      direction,
      teamColor,
    );
    if (line && line.length >= 5) {
      for (const { row, col } of line) {
        const cell = board[row]?.[col];
        if (cell?.chip) {
          cell.chip.partOfSequence = true;
        }
      }
    }
  }
}

// Check win condition (2 sequences for a team)
export function checkWinCondition(
  sequences: Sequence[],
  teamColor: TeamColor,
): boolean {
  const teamSequences = sequences.filter((s) => s.teamColor === teamColor);
  return teamSequences.length >= 2;
}

// Count sequences for a team
export function countSequences(
  sequences: Sequence[],
  teamColor: TeamColor,
): number {
  return sequences.filter((s) => s.teamColor === teamColor).length;
}

// Get total sequence count from board state (for verification)
export function countSequencesFromBoard(
  board: BoardCell[][],
  teamColor: TeamColor,
): number {
  const lines = findAllLines(board, teamColor);
  return lines.reduce((sum, line) => sum + line.sequenceCount, 0);
}
