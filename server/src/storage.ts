import type { PlayerSession, Room, Game, RematchState } from './types.js'

// In-memory storage
class Storage {
  private sessions = new Map<string, PlayerSession>()
  private sessionsByPlayerId = new Map<string, PlayerSession>()
  private playerNames = new Set<string>()
  private rooms = new Map<string, Room>()
  private games = new Map<string, Game>()
  private rematchStates = new Map<string, RematchState>()

  // Sessions
  getSession(sessionId: string): PlayerSession | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionByPlayerId(playerId: string): PlayerSession | undefined {
    return this.sessionsByPlayerId.get(playerId)
  }

  createSession(session: PlayerSession): void {
    this.sessions.set(session.sessionId, session)
    this.sessionsByPlayerId.set(session.playerId, session)
    this.playerNames.add(session.playerName.toLowerCase())
  }

  updateSession(session: PlayerSession): void {
    session.lastActivity = Date.now()
    this.sessions.set(session.sessionId, session)
    this.sessionsByPlayerId.set(session.playerId, session)
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      this.playerNames.delete(session.playerName.toLowerCase())
      this.sessionsByPlayerId.delete(session.playerId)
      this.sessions.delete(sessionId)
    }
  }

  isNameTaken(name: string): boolean {
    return this.playerNames.has(name.toLowerCase())
  }

  // Rooms
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  createRoom(room: Room): void {
    this.rooms.set(room.id, room)
  }

  updateRoom(room: Room): void {
    this.rooms.set(room.id, room)
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId)
  }

  // Games
  getGame(gameId: string): Game | undefined {
    return this.games.get(gameId)
  }

  createGame(game: Game): void {
    this.games.set(game.id, game)
  }

  updateGame(game: Game): void {
    this.games.set(game.id, game)
  }

  deleteGame(gameId: string): void {
    this.games.delete(gameId)
  }

  // Rematch
  getRematchState(gameId: string): RematchState | undefined {
    return this.rematchStates.get(gameId)
  }

  setRematchState(state: RematchState): void {
    this.rematchStates.set(state.gameId, state)
  }

  deleteRematchState(gameId: string): void {
    this.rematchStates.delete(gameId)
  }

  // Cleanup old sessions
  cleanupSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > maxAgeMs) {
        this.deleteSession(sessionId)
      }
    }
  }

  // Cleanup empty rooms
  cleanupEmptyRooms(): void {
    for (const [roomId, room] of this.rooms) {
      if (room.players.length === 0) {
        this.deleteRoom(roomId)
      }
    }
  }
}

export const storage = new Storage()
