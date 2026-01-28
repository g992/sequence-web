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

// Sequence (5 chips in a row)
export interface Sequence {
  teamColor: TeamColor
  cells: Array<{ row: number; col: number }>
}

// Room types
export type RoomType = '1v1' | '2v2'
export type RoomStatus = 'waiting' | 'playing' | 'finished'

// Player session
export interface PlayerSession {
  sessionId: string
  playerId: string
  playerName: string
  createdAt: number
  lastActivity: number
  currentRoomId?: string
  currentGameId?: string
}

// Room player
export interface RoomPlayer {
  playerId: string
  playerName: string
  isHost: boolean
  isReady: boolean
  isAI: boolean
  team: 1 | 2
  joinedAt: number
}

// Room
export interface Room {
  id: string
  name: string
  type: RoomType
  boardType: BoardType
  password?: string
  status: RoomStatus
  hostId: string
  players: RoomPlayer[]
  maxPlayers: number
  createdAt: number
  gameId?: string
}

// Game player
export interface GamePlayer {
  playerId: string
  playerName: string
  teamColor: TeamColor
  isAI: boolean
  hand: Card[]
}

// Turn record
export interface Turn {
  playerId: string
  cardIndex: number
  row: number
  col: number
  cardPlayed: Card
  timestamp: number
}

// Game
export interface Game {
  id: string
  roomId: string
  deckSeed: number
  boardType: BoardType
  status: 'active' | 'finished'
  players: GamePlayer[]
  teams: Array<{ color: TeamColor; playerIds: string[] }>
  board: BoardCell[][]
  sequences: Sequence[]
  currentTurnPlayerId: string
  deckCursor: number
  shuffledDeck: Card[]
  turnHistory: Turn[]
  winnerId?: string
  createdAt: number
  finishedAt?: number
}

// Rematch state
export interface RematchVote {
  playerId: string
  vote: boolean
  timestamp: number
}

export interface RematchState {
  gameId: string
  active: boolean
  votes: RematchVote[]
  deadline: number
  requiredVotes: number
}

// WebSocket event types
export type WSEventType =
  | 'connected'
  | 'room_updated'
  | 'player_joined'
  | 'player_left'
  | 'game_started'
  | 'game_state'
  | 'turn_made'
  | 'game_finished'
  | 'rematch_vote'
  | 'rematch_started'
  | 'rematch_cancelled'
  | 'error'
  | 'pong'

export interface WSEvent<T = unknown> {
  type: WSEventType
  data: T
  timestamp: number
}

// AI difficulty
export type AIDifficulty = 'easy' | 'medium' | 'hard'

// Helpers
export function isOneEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'spades' || card.suit === 'hearts')
}

export function isTwoEyedJack(card: Card): boolean {
  return card.rank === 'J' && (card.suit === 'diamonds' || card.suit === 'clubs')
}

export function cardToString(card: Card): string {
  const suitChar = card.suit[0]!.toUpperCase()
  return `${card.rank}${suitChar}`
}

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
