// Online multiplayer types

// Room types
export type RoomType = '1v1' | '2v2'

// Room status
export type RoomStatus = 'waiting' | 'playing' | 'finished'

// Player slot in room
export interface RoomPlayer {
  id: string
  name: string
  isHost: boolean
  isReady: boolean
  isAI: boolean
  team: 1 | 2
}

// Room info (for lobby list)
export interface RoomInfo {
  id: string
  name: string
  type: RoomType
  hasPassword: boolean
  status: RoomStatus
  players: number
  maxPlayers: number
  hostName: string
}

// Full room data (when inside room)
export interface Room {
  id: string
  name: string
  type: RoomType
  hasPassword: boolean
  status: RoomStatus
  players: RoomPlayer[]
  maxPlayers: number
  hostId: string
}

// Rematch vote state
export interface RematchVote {
  playerId: string
  vote: boolean
  timestamp: number
}

export interface RematchState {
  active: boolean
  votes: RematchVote[]
  deadline: number // timestamp when voting ends
  requiredVotes: number
}

// Server connection status
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PingResponse {
  ok: boolean
  serverName: string
  version: string
  timestamp: number
}

export interface CheckNameResponse {
  available: boolean
  reason?: string
}

export interface JoinServerResponse {
  sessionId: string
  playerId: string
}

export interface RoomListResponse {
  rooms: RoomInfo[]
}

export interface CreateRoomResponse {
  room: Room
}

export interface JoinRoomResponse {
  room: Room
}

export interface StartGameResponse {
  gameId: string
  missingPlayersFilledWithAI: boolean
  aiCount: number
}

export interface RematchResponse {
  rematchState: RematchState
}

// WebSocket event types
export type WSEventType =
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

export interface WSEvent<T = unknown> {
  type: WSEventType
  data: T
  timestamp: number
}

// Game sync types (for real-time play)
export interface GameTurnData {
  playerId: string
  cardIndex: number
  row: number
  col: number
  timestamp: number
}

export interface GameSyncState {
  gameId: string
  deckSeed: number
  currentTurnPlayerId: string
  turns: GameTurnData[]
}
