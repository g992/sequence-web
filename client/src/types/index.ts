// Card suits
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

// Card ranks (T = 10)
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K'

// Board types
export type BoardType = 'classic' | 'alternative' | 'advanced'

// Card representation
export interface Card {
  suit: Suit
  rank: Rank
}

// Special card for board corners
export type BoardCard = Card | 'CORNER'

// Team colors
export type TeamColor = 'green' | 'blue' | 'red'

// Chip on the board
export interface Chip {
  color: TeamColor
  partOfSequence: boolean
}

// Single board cell
export interface BoardCell {
  card: BoardCard
  chip: Chip | null
  row: number
  col: number
}

// Player
export interface Player {
  id: string
  name: string
  teamColor: TeamColor
  isHost: boolean
  connected: boolean
}

// Team
export interface Team {
  color: TeamColor
  playerIds: string[]
}

// Sequence (5 chips in a row)
export interface Sequence {
  teamColor: TeamColor
  cells: Array<{ row: number; col: number }>
}

// Game phase
export type GamePhase = 'lobby' | 'playing' | 'finished'

// Game mode
export type GameMode = '1v1' | '2v2' | 'local'

// Deck state (seeded for sync)
export interface DeckState {
  seed: number
  cursor: number
}

// Full game state
export interface GameState {
  phase: GamePhase
  mode: GameMode
  players: Player[]
  teams: Team[]
  deck: DeckState
  hands: Record<string, Card[]>
  board: BoardCell[][]
  boardType: BoardType
  sequences: Sequence[]
  currentTurnPlayerId: string | null
  winnerId: string | null
}

// Jack types
export type JackType = 'one-eyed' | 'two-eyed'

// Check if card is a one-eyed jack (removes opponent chip)
export function isOneEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'spades' || card.suit === 'hearts')
}

// Check if card is a two-eyed jack (wild placement)
export function isTwoEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'diamonds' || card.suit === 'clubs')
}

// Card to string (e.g., "AS" for Ace of Spades)
export function cardToString(card: Card): string {
  const suitChar = card.suit[0]!.toUpperCase()
  return `${card.rank}${suitChar}`
}

// String to card
export function stringToCard(str: string): Card {
  const rank = str[0] as Rank
  const suitChar = str[1]!.toLowerCase()
  const suitMap: Record<string, Suit> = {
    s: 'spades',
    h: 'hearts',
    d: 'diamonds',
    c: 'clubs',
  }
  return { rank, suit: suitMap[suitChar]! }
}
