import type { BoardCell, TeamColor, Sequence } from '../types.js'

type Direction = [number, number]

const DIRECTIONS: Direction[] = [
  [0, 1],  // horizontal
  [1, 0],  // vertical
  [1, 1],  // diagonal down-right
  [1, -1], // diagonal down-left
]

function cellBelongsToTeam(cell: BoardCell, teamColor: TeamColor): boolean {
  if (cell.card === 'CORNER') return true
  return cell.chip?.color === teamColor
}

function findMaxLineInDirection(
  board: BoardCell[][],
  startRow: number,
  startCol: number,
  direction: Direction,
  teamColor: TeamColor,
): Array<{ row: number; col: number }> | null {
  const [dr, dc] = direction
  const cells: Array<{ row: number; col: number }> = []

  let row = startRow
  let col = startCol

  while (row >= 0 && row < 10 && col >= 0 && col < 10) {
    const cell = board[row]?.[col]
    if (!cell || !cellBelongsToTeam(cell, teamColor)) {
      break
    }
    cells.push({ row, col })
    row += dr
    col += dc
  }

  return cells.length >= 5 ? cells : null
}

function findLineStart(
  board: BoardCell[][],
  row: number,
  col: number,
  direction: Direction,
  teamColor: TeamColor,
): { row: number; col: number } {
  const [dr, dc] = direction
  let startRow = row
  let startCol = col

  while (true) {
    const prevRow = startRow - dr
    const prevCol = startCol - dc

    if (prevRow < 0 || prevRow >= 10 || prevCol < 0 || prevCol >= 10) {
      break
    }

    const cell = board[prevRow]?.[prevCol]
    if (!cell || !cellBelongsToTeam(cell, teamColor)) {
      break
    }

    startRow = prevRow
    startCol = prevCol
  }

  return { row: startRow, col: startCol }
}

function findCompleteLine(
  board: BoardCell[][],
  row: number,
  col: number,
  direction: Direction,
  teamColor: TeamColor,
): Array<{ row: number; col: number }> | null {
  const start = findLineStart(board, row, col, direction, teamColor)
  return findMaxLineInDirection(board, start.row, start.col, direction, teamColor)
}

interface LineInfo {
  cells: Array<{ row: number; col: number }>
  direction: Direction
  sequenceCount: number
}

function findAllLines(board: BoardCell[][], teamColor: TeamColor): LineInfo[] {
  const lines: LineInfo[] = []
  const processedKeys = new Set<string>()

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]?.[col]
      if (!cell || !cellBelongsToTeam(cell, teamColor)) continue

      for (const direction of DIRECTIONS) {
        const start = findLineStart(board, row, col, direction, teamColor)
        const key = `${start.row},${start.col},${direction[0]},${direction[1]}`

        if (processedKeys.has(key)) continue
        processedKeys.add(key)

        const line = findMaxLineInDirection(board, start.row, start.col, direction, teamColor)
        if (line && line.length >= 5) {
          const sequenceCount = line.length >= 10 ? 2 : 1
          lines.push({ cells: line, direction, sequenceCount })
        }
      }
    }
  }

  return lines
}

export function findNewSequences(
  board: BoardCell[][],
  teamColor: TeamColor,
  existingSequences: Sequence[],
): Sequence[] {
  const newSequences: Sequence[] = []
  const allLines = findAllLines(board, teamColor)

  const existingCount = existingSequences.filter((s) => s.teamColor === teamColor).length

  let totalSequenceCount = 0
  for (const line of allLines) {
    totalSequenceCount += line.sequenceCount
  }

  const newCount = totalSequenceCount - existingCount

  if (newCount > 0) {
    for (const line of allLines) {
      const hasNewCell = line.cells.some((c) => {
        const cell = board[c.row]?.[c.col]
        if (!cell) return false
        if (cell.card === 'CORNER') return false
        return cell.chip && !cell.chip.partOfSequence
      })

      if (hasNewCell) {
        newSequences.push({
          teamColor,
          cells: line.cells,
        })

        if (line.sequenceCount === 2 && newCount >= 2) {
          const existingFromThisLine = existingSequences.filter(
            (s) =>
              s.teamColor === teamColor &&
              s.cells.some((c) => line.cells.some((lc) => lc.row === c.row && lc.col === c.col)),
          ).length

          if (existingFromThisLine === 0) {
            newSequences.push({
              teamColor,
              cells: line.cells,
            })
          }
        }

        break
      }
    }
  }

  return newSequences
}

export function markSequenceCells(board: BoardCell[][], sequence: Sequence): void {
  if (sequence.cells.length === 0) return

  const firstCell = sequence.cells[0]!
  const teamColor = sequence.teamColor

  for (const { row, col } of sequence.cells) {
    const cell = board[row]?.[col]
    if (cell?.chip) {
      cell.chip.partOfSequence = true
    }
  }

  for (const direction of DIRECTIONS) {
    const line = findCompleteLine(board, firstCell.row, firstCell.col, direction, teamColor)
    if (line && line.length >= 5) {
      for (const { row, col } of line) {
        const cell = board[row]?.[col]
        if (cell?.chip) {
          cell.chip.partOfSequence = true
        }
      }
    }
  }
}

export function checkWinCondition(sequences: Sequence[], teamColor: TeamColor): boolean {
  const teamSequences = sequences.filter((s) => s.teamColor === teamColor)
  return teamSequences.length >= 2
}

export function countSequences(sequences: Sequence[], teamColor: TeamColor): number {
  return sequences.filter((s) => s.teamColor === teamColor).length
}
