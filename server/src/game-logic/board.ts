import type { BoardCard, BoardCell, Card, Suit, Rank, BoardType } from '../types.js'

// Classic Sequence board layout (10x10)
const BOARD_LAYOUT_CLASSIC: string[][] = [
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

// Alternative board layout
const BOARD_LAYOUT_ALTERNATIVE: string[][] = [
  ['XX', 'TC', '9C', '8C', '7C', '7H', '8H', '9H', 'TH', 'XX'],
  ['TD', '9D', '6C', '5C', '4C', '4H', '5H', '6H', 'AH', 'KS'],
  ['TD', '8D', '9S', '2C', '3C', '3H', '2H', 'KH', 'QH', 'TS'],
  ['9D', '6D', '6S', 'AS', 'KS', 'KH', 'QS', 'AS', 'QH', '9S'],
  ['8D', '5D', '5S', 'QC', 'AC', 'AH', 'KC', 'QS', 'TH', '8S'],
  ['7D', '4D', '4S', 'KC', '2S', '3S', 'AC', 'QC', '9H', '7S'],
  ['6D', '3D', '3S', 'QC', 'TC', 'TC', '2S', 'KC', '8H', '6S'],
  ['5D', '2D', '7S', '8S', '9S', 'TS', '9C', '8C', '7H', '5S'],
  ['KD', 'AD', '4S', '5S', '6S', '7S', '8S', '7C', '6H', '4S'],
  ['XX', 'AD', 'KD', 'QD', 'TD', '9D', '8D', '7D', '2H', 'XX'],
]

// Advanced board layout
const BOARD_LAYOUT_ADVANCED: string[][] = [
  ['XX', 'AH', 'KH', 'QH', 'TH', 'TC', 'QC', 'KC', 'AC', 'XX'],
  ['2D', '9H', '8H', '7H', '6H', '6C', '7C', '8C', '9C', '2S'],
  ['3D', 'TS', '5H', '4H', '3H', '3C', '4C', '5C', 'TS', '3S'],
  ['4D', 'QS', '2H', 'AS', 'KS', 'KC', 'AS', '2C', 'QS', '4S'],
  ['5D', 'KS', 'AH', 'QC', '9S', '9C', 'QC', 'AH', 'KS', '5S'],
  ['6D', 'AS', 'KH', 'TC', '8S', '8C', 'TC', 'KH', 'AS', '6S'],
  ['7D', '2S', 'QH', 'AC', '7S', '7C', 'AC', 'QH', '2S', '7S'],
  ['8D', '3S', 'TH', '9H', '6S', '6C', '9H', 'TH', '3S', '8S'],
  ['9D', '4S', '5S', '8H', '7H', '7H', '8H', '5S', '4S', '9S'],
  ['XX', 'TD', 'QD', 'KD', 'AD', 'AD', 'KD', 'QD', 'TD', 'XX'],
]

const BOARD_LAYOUTS: Record<BoardType, string[][]> = {
  classic: BOARD_LAYOUT_CLASSIC,
  alternative: BOARD_LAYOUT_ALTERNATIVE,
  advanced: BOARD_LAYOUT_ADVANCED,
}

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

export function createBoard(boardType: BoardType = 'classic'): BoardCell[][] {
  const layout = BOARD_LAYOUTS[boardType]
  const board: BoardCell[][] = []

  for (let row = 0; row < 10; row++) {
    const boardRow: BoardCell[] = []
    for (let col = 0; col < 10; col++) {
      boardRow.push({
        card: parseCard(layout[row]![col]!),
        chip: null,
        row,
        col,
      })
    }
    board.push(boardRow)
  }

  return board
}

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

export function isDeadCard(board: BoardCell[][], card: Card): boolean {
  const cells = findCellsForCard(board, card)
  return cells.every((cell) => cell.chip !== null)
}

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
