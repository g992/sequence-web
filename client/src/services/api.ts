/**
 * API Service for Sequence Web multiplayer
 *
 * Currently contains stub implementations that simulate server responses.
 * Replace with real API calls when backend is ready.
 */

import type {
  ApiResponse,
  PingResponse,
  CheckNameResponse,
  JoinServerResponse,
  RoomListResponse,
  CreateRoomResponse,
  JoinRoomResponse,
  StartGameResponse,
  RematchResponse,
  RoomType,
  RoomInfo,
  Room,
  RematchState,
} from '@/types/online'

// Storage keys
const STORAGE_SERVER_URL = 'sequence-server-url'
const STORAGE_SESSION_ID = 'sequence-session-id'
const STORAGE_PLAYER_ID = 'sequence-player-id'
const STORAGE_PLAYER_NAME = 'sequence-player-name'

// Simulated delay for stubs (ms)
const STUB_DELAY = 300

// Helper to simulate async delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper to get stored server URL
export function getStoredServerUrl(): string | null {
  return localStorage.getItem(STORAGE_SERVER_URL)
}

// Helper to set server URL
export function setServerUrl(url: string): void {
  localStorage.setItem(STORAGE_SERVER_URL, url)
}

// Helper to get stored session
export function getStoredSession(): { sessionId: string; playerId: string; playerName: string } | null {
  const sessionId = localStorage.getItem(STORAGE_SESSION_ID)
  const playerId = localStorage.getItem(STORAGE_PLAYER_ID)
  const playerName = localStorage.getItem(STORAGE_PLAYER_NAME)

  if (sessionId && playerId && playerName) {
    return { sessionId, playerId, playerName }
  }
  return null
}

// Helper to store session
export function storeSession(sessionId: string, playerId: string, playerName: string): void {
  localStorage.setItem(STORAGE_SESSION_ID, sessionId)
  localStorage.setItem(STORAGE_PLAYER_ID, playerId)
  localStorage.setItem(STORAGE_PLAYER_NAME, playerName)
}

// Helper to clear session
export function clearSession(): void {
  localStorage.removeItem(STORAGE_SESSION_ID)
  localStorage.removeItem(STORAGE_PLAYER_ID)
  localStorage.removeItem(STORAGE_PLAYER_NAME)
}

/**
 * Ping server to check availability
 * STUB: Always returns success after delay
 */
export async function pingServer(serverUrl: string): Promise<ApiResponse<PingResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate server response
  // TODO: Replace with actual API call
  // return await fetch(`${serverUrl}/ping`).then(r => r.json())

  return {
    success: true,
    data: {
      ok: true,
      serverName: 'Sequence Server (Stub)',
      version: '0.1.0',
      timestamp: Date.now(),
    },
  }
}

/**
 * Check if player name is available
 * STUB: Always returns available unless name is "admin" or "test"
 */
export async function checkName(
  serverUrl: string,
  name: string,
): Promise<ApiResponse<CheckNameResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate name check
  // TODO: Replace with actual API call
  // return await fetch(`${serverUrl}/check-name`, {
  //   method: 'POST',
  //   body: JSON.stringify({ name })
  // }).then(r => r.json())

  const reserved = ['admin', 'test', 'server', 'system']
  const isReserved = reserved.includes(name.toLowerCase())

  return {
    success: true,
    data: {
      available: !isReserved,
      reason: isReserved ? 'Это имя зарезервировано' : undefined,
    },
  }
}

/**
 * Join server with player name
 * STUB: Generates random session/player IDs
 */
export async function joinServer(
  serverUrl: string,
  name: string,
): Promise<ApiResponse<JoinServerResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate join
  // TODO: Replace with actual API call

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const playerId = `player_${Math.random().toString(36).slice(2)}`

  storeSession(sessionId, playerId, name)

  return {
    success: true,
    data: {
      sessionId,
      playerId,
    },
  }
}

/**
 * Leave server / disconnect
 * STUB: Clears local session
 */
export async function leaveServer(): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate leave
  // TODO: Replace with actual API call

  clearSession()

  return {
    success: true,
  }
}

/**
 * Get list of rooms
 * STUB: Returns fake room list
 */
export async function getRooms(serverUrl: string): Promise<ApiResponse<RoomListResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate room list
  // TODO: Replace with actual API call

  const stubRooms: RoomInfo[] = [
    {
      id: 'room_1',
      name: 'Комната новичков',
      type: '1v1',
      hasPassword: false,
      status: 'waiting',
      players: 1,
      maxPlayers: 2,
      hostName: 'Игрок1',
    },
    {
      id: 'room_2',
      name: 'Командная игра',
      type: '2v2',
      hasPassword: false,
      status: 'waiting',
      players: 2,
      maxPlayers: 4,
      hostName: 'ProGamer',
    },
    {
      id: 'room_3',
      name: 'Приватная комната',
      type: '1v1',
      hasPassword: true,
      status: 'waiting',
      players: 1,
      maxPlayers: 2,
      hostName: 'VIP',
    },
  ]

  return {
    success: true,
    data: {
      rooms: stubRooms,
    },
  }
}

/**
 * Create a new room
 * STUB: Returns fake room
 */
export async function createRoom(
  serverUrl: string,
  name: string,
  type: RoomType,
  password?: string,
): Promise<ApiResponse<CreateRoomResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate room creation
  // TODO: Replace with actual API call

  const session = getStoredSession()
  if (!session) {
    return {
      success: false,
      error: 'Не авторизован',
    }
  }

  const maxPlayers = type === '1v1' ? 2 : 4

  const room: Room = {
    id: `room_${Date.now()}`,
    name,
    type,
    hasPassword: !!password,
    status: 'waiting',
    players: [
      {
        id: session.playerId,
        name: session.playerName,
        isHost: true,
        isReady: true,
        isAI: false,
        team: 1,
      },
    ],
    maxPlayers,
    hostId: session.playerId,
  }

  return {
    success: true,
    data: { room },
  }
}

/**
 * Join an existing room
 * STUB: Returns fake joined room
 */
export async function joinRoom(
  serverUrl: string,
  roomId: string,
  password?: string,
): Promise<ApiResponse<JoinRoomResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate join room
  // TODO: Replace with actual API call

  const session = getStoredSession()
  if (!session) {
    return {
      success: false,
      error: 'Не авторизован',
    }
  }

  // Fake room data
  const room: Room = {
    id: roomId,
    name: 'Тестовая комната',
    type: '1v1',
    hasPassword: !!password,
    status: 'waiting',
    players: [
      {
        id: 'host_player',
        name: 'Хост',
        isHost: true,
        isReady: true,
        isAI: false,
        team: 1,
      },
      {
        id: session.playerId,
        name: session.playerName,
        isHost: false,
        isReady: false,
        isAI: false,
        team: 2,
      },
    ],
    maxPlayers: 2,
    hostId: 'host_player',
  }

  return {
    success: true,
    data: { room },
  }
}

/**
 * Leave current room
 * STUB: Always succeeds
 */
export async function leaveRoom(serverUrl: string, roomId: string): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate leave room
  // TODO: Replace with actual API call

  return {
    success: true,
  }
}

/**
 * Set player ready status in room
 * STUB: Always succeeds
 */
export async function setReady(
  serverUrl: string,
  roomId: string,
  ready: boolean,
): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate ready toggle
  // TODO: Replace with actual API call

  return {
    success: true,
  }
}

/**
 * Change team in room (for 2v2)
 * STUB: Always succeeds
 */
export async function changeTeam(
  serverUrl: string,
  roomId: string,
  team: 1 | 2,
): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate team change
  // TODO: Replace with actual API call

  return {
    success: true,
  }
}

/**
 * Start game (host only)
 * STUB: Returns success with AI fill info
 */
export async function startGame(
  serverUrl: string,
  roomId: string,
): Promise<ApiResponse<StartGameResponse>> {
  await delay(STUB_DELAY)

  // STUB: Simulate game start
  // TODO: Replace with actual API call

  return {
    success: true,
    data: {
      gameId: `game_${Date.now()}`,
      missingPlayersFilledWithAI: false,
      aiCount: 0,
    },
  }
}

/**
 * Vote for rematch
 * STUB: Returns current rematch state
 */
export async function voteRematch(
  serverUrl: string,
  gameId: string,
  vote: boolean,
): Promise<ApiResponse<RematchResponse>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate rematch vote
  // TODO: Replace with actual API call

  const session = getStoredSession()

  const rematchState: RematchState = {
    active: true,
    votes: [
      {
        playerId: session?.playerId || 'unknown',
        vote,
        timestamp: Date.now(),
      },
    ],
    deadline: Date.now() + 30000,
    requiredVotes: 2,
  }

  return {
    success: true,
    data: { rematchState },
  }
}

/**
 * Cancel rematch voting (returns to lobby)
 * STUB: Always succeeds
 */
export async function cancelRematch(
  serverUrl: string,
  gameId: string,
): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 2)

  // STUB: Simulate cancel
  // TODO: Replace with actual API call

  return {
    success: true,
  }
}

/**
 * Send game turn to server
 * STUB: Always succeeds
 */
export async function sendTurn(
  serverUrl: string,
  gameId: string,
  cardIndex: number,
  row: number,
  col: number,
): Promise<ApiResponse<void>> {
  await delay(STUB_DELAY / 3)

  // STUB: Simulate turn
  // TODO: Replace with actual API call

  return {
    success: true,
  }
}
