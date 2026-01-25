import type { BoardCard, BoardCell, Card, Suit, Rank } from '@/types'

// Standard Sequence board layout (10x10)
// Each card appears exactly twice on the board (except Jacks which are not on board)
// Corners are free spaces that count as wild for any sequence
const BOARD_LAYOUT: string[][] = [
  ['XX', '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'XX'],
  ['6C', '5C', '4C', '3C', '2C', 'AH', 'KH', 'QH', 'TH', 'TS'],
  ['7C', 'AS', '2D', '3D', '4D', '5D', '6D', '7D', '9H', 'QS'],
  ['8C', 'KS', '6C', '5C', '4C', '3C', '2C', '8D', '8H', 'KS'],
  ['9C', 'QS', '7C', '6H', '5H', '4H', 'AH', '9D', '7H', 'AS'],
  ['TC', 'TS', '8C', '7H', '2H', '3H', 'KH', 'TD', '6H', '2D'],
  ['QC', '9S', '9C', '8H', '9H', 'TH', 'QH', 'QD', '5H', '3D'],
  ['KC', '8S', 'TC', 'QC', 'KC', 'AC', 'AD', 'KD', '4H', '4D'],
  ['AC', '7S', '6S', '5S', '4S', '3S', '2S', 'AD', '3H', '5D'],
  ['XX', 'AD', 'KD', 'QD', 'TD', '9D', '8D', '7D', '2H', 'XX'],
]

function parseCard(str: string): BoardCard {
  if (str === 'XX') return 'CORNER'

  const rank = str[0] as Rank
  const suitChar = str[1]!
  const suitMap: Record<string, Suit> = {
    S: 'spades',
    H: 'hearts',
    D: 'diamonds',
    C: 'clubs',
  }

  return {
    rank,
    suit: suitMap[suitChar]!,
  }
}

export function createBoard(): BoardCell[][] {
  const board: BoardCell[][] = []

  for (let row = 0; row < 10; row++) {
    const boardRow: BoardCell[] = []
    for (let col = 0; col < 10; col++) {
      boardRow.push({
        card: parseCard(BOARD_LAYOUT[row]![col]!),
        chip: null,
        row,
        col,
      })
    }
    board.push(boardRow)
  }

  return board
}

// Get all cells that match a card (for highlighting playable positions)
export function findCellsForCard(board: BoardCell[][], card: Card): BoardCell[] {
  const cells: BoardCell[] = []

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]![col]!
      if (cell.card !== 'CORNER') {
        if (cell.card.rank === card.rank && cell.card.suit === card.suit) {
          cells.push(cell)
        }
      }
    }
  }

  return cells
}

// Check if a card is "dead" (both positions are occupied)
export function isDeadCard(board: BoardCell[][], card: Card): boolean {
  const cells = findCellsForCard(board, card)
  return cells.every((cell) => cell.chip !== null)
}

// Get all empty cells (for two-eyed jack)
export function getEmptyCells(board: BoardCell[][]): BoardCell[] {
  const cells: BoardCell[] = []

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]![col]!
      if (cell.chip === null && cell.card !== 'CORNER') {
        cells.push(cell)
      }
    }
  }

  return cells
}

// Get all opponent chips that can be removed (for one-eyed jack)
export function getRemovableChips(
  board: BoardCell[][],
  opponentColors: string[],
): BoardCell[] {
  const cells: BoardCell[] = []

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = board[row]![col]!
      if (
        cell.chip &&
        opponentColors.includes(cell.chip.color) &&
        !cell.chip.partOfSequence
      ) {
        cells.push(cell)
      }
    }
  }

  return cells
}

// Export raw layout for debugging
export { BOARD_LAYOUT }
