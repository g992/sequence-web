import express from 'express'
import { createServer } from 'http'
import { v4 as uuidv4 } from 'uuid'
import { storage } from './storage.js'
import { wsManager } from './ws.js'
import { createBoard } from './game-logic/board.js'
import { createShuffledDeck, drawCards, getHandSize, generateSeed } from './game-logic/deck.js'
import { findNewSequences, markSequenceCells, checkWinCondition } from './game-logic/sequence.js'
import { makeAIMove } from './game-logic/ai.js'
import type {
  Room,
  RoomPlayer,
  Game,
  GamePlayer,
  TeamColor,
  Card,
  RematchState,
  cardToString,
} from './types.js'
import { isOneEyedJack, isTwoEyedJack } from './types.js'

const app = express()
const server = createServer(app)

// Middleware
app.use(express.json())

// No CORS - allow all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const sessionId = authHeader.slice(7)
  const session = storage.getSession(sessionId)
  if (!session) {
    return res.status(401).json({ success: false, error: 'Invalid session' })
  }

  storage.updateSession(session)
  ;(req as any).session = session
  next()
}

// Helper to send API response
function sendSuccess<T>(res: express.Response, data?: T) {
  res.json({ success: true, data })
}

function sendError(res: express.Response, error: string, status: number = 400) {
  res.status(status).json({ success: false, error })
}

// ===================
// ROUTES
// ===================

// Health check / Ping
app.get('/api/v1/ping', (req, res) => {
  sendSuccess(res, {
    ok: true,
    serverName: 'Sequence Web Server',
    version: '1.0.0',
    timestamp: Date.now(),
  })
})

// Check name availability
app.post('/api/v1/check-name', (req, res) => {
  const { name } = req.body

  if (!name || typeof name !== 'string') {
    return sendError(res, 'Name is required')
  }

  const trimmedName = name.trim()

  if (trimmedName.length < 2) {
    return sendSuccess(res, { available: false, reason: 'Minimum 2 characters' })
  }

  if (trimmedName.length > 16) {
    return sendSuccess(res, { available: false, reason: 'Maximum 16 characters' })
  }

  const reserved = ['admin', 'test', 'server', 'system', 'bot', 'ai']
  if (reserved.includes(trimmedName.toLowerCase())) {
    return sendSuccess(res, { available: false, reason: 'Name is reserved' })
  }

  if (storage.isNameTaken(trimmedName)) {
    return sendSuccess(res, { available: false, reason: 'Name is already taken' })
  }

  sendSuccess(res, { available: true })
})

// Join server
app.post('/api/v1/join', (req, res) => {
  const { name } = req.body

  if (!name || typeof name !== 'string') {
    return sendError(res, 'Name is required')
  }

  const trimmedName = name.trim()

  if (trimmedName.length < 2 || trimmedName.length > 16) {
    return sendError(res, 'Invalid name length')
  }

  if (storage.isNameTaken(trimmedName)) {
    return sendError(res, 'Name is already taken', 409)
  }

  const sessionId = uuidv4()
  const playerId = uuidv4()

  storage.createSession({
    sessionId,
    playerId,
    playerName: trimmedName,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  })

  sendSuccess(res, { sessionId, playerId })
})

// Leave server
app.post('/api/v1/leave', authMiddleware, (req, res) => {
  const session = (req as any).session

  // Leave room if in one
  if (session.currentRoomId) {
    const room = storage.getRoom(session.currentRoomId)
    if (room) {
      leaveRoom(session.playerId, room)
    }
  }

  storage.deleteSession(session.sessionId)
  sendSuccess(res)
})

// Get current session status (for reconnection)
app.get('/api/v1/session/status', authMiddleware, (req, res) => {
  const session = (req as any).session

  const result: {
    currentRoomId: string | null
    currentGameId: string | null
    gameState: object | null
  } = {
    currentRoomId: session.currentRoomId || null,
    currentGameId: session.currentGameId || null,
    gameState: null,
  }

  // If player has an active game, return the game state
  if (session.currentGameId) {
    const game = storage.getGame(session.currentGameId)
    if (game && game.status === 'active') {
      const player = game.players.find(p => p.playerId === session.playerId)
      if (player) {
        const room = storage.getRoom(game.roomId)
        result.gameState = {
          gameId: game.id,
          deckSeed: game.deckSeed,
          boardType: game.boardType,
          players: game.players.map(p => ({
            id: p.playerId,
            name: p.playerName,
            teamColor: p.teamColor,
            isAI: p.isAI,
          })),
          teams: game.teams,
          board: game.board,
          sequences: game.sequences,
          currentTurnPlayerId: game.currentTurnPlayerId,
          myHand: player.hand.map(cardToStringFn),
          myPlayerId: session.playerId,
          roomName: room?.name || 'Unknown',
        }
      }
    } else {
      // Game doesn't exist or is finished, clear from session
      session.currentGameId = undefined
      storage.updateSession(session)
    }
  }

  sendSuccess(res, result)
})

// Get rooms list
app.get('/api/v1/rooms', authMiddleware, (req, res) => {
  const rooms = storage.getAllRooms()
    .filter(room => room.status !== 'finished')
    .map(room => ({
      id: room.id,
      name: room.name,
      type: room.type,
      boardType: room.boardType,
      hasPassword: !!room.password,
      status: room.status,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      hostName: room.players.find(p => p.isHost)?.playerName || 'Unknown',
    }))

  sendSuccess(res, { rooms })
})

// Create room
app.post('/api/v1/rooms', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { name, type, boardType, password } = req.body

  if (!name || typeof name !== 'string') {
    return sendError(res, 'Room name is required')
  }

  if (type !== '1v1' && type !== '2v2') {
    return sendError(res, 'Invalid room type')
  }

  if (!boardType || (boardType !== 'classic' && boardType !== 'alternative' && boardType !== 'advanced')) {
    return sendError(res, 'Invalid board type')
  }

  if (session.currentRoomId) {
    return sendError(res, 'Already in a room')
  }

  const roomId = uuidv4()
  const maxPlayers = type === '1v1' ? 2 : 4

  const room: Room = {
    id: roomId,
    name: name.trim().slice(0, 30),
    type,
    boardType,
    password: password || undefined,
    status: 'waiting',
    hostId: session.playerId,
    players: [
      {
        playerId: session.playerId,
        playerName: session.playerName,
        isHost: true,
        isReady: true,
        isAI: false,
        team: 1,
        joinedAt: Date.now(),
      },
    ],
    maxPlayers,
    createdAt: Date.now(),
  }

  storage.createRoom(room)
  session.currentRoomId = roomId
  storage.updateSession(session)

  sendSuccess(res, { room: sanitizeRoom(room) })
})

// Join room
app.post('/api/v1/rooms/:roomId/join', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { roomId } = req.params
  const { password } = req.body

  const room = storage.getRoom(roomId)
  if (!room) {
    return sendError(res, 'Room not found', 404)
  }

  if (room.status !== 'waiting') {
    return sendError(res, 'Room is not accepting players')
  }

  if (room.players.length >= room.maxPlayers) {
    return sendError(res, 'Room is full')
  }

  if (room.password && room.password !== password) {
    return sendError(res, 'Wrong password', 401)
  }

  if (session.currentRoomId) {
    return sendError(res, 'Already in a room')
  }

  // Determine team
  const team1Count = room.players.filter(p => p.team === 1).length
  const team2Count = room.players.filter(p => p.team === 2).length
  const team = team1Count <= team2Count ? 1 : 2

  const player: RoomPlayer = {
    playerId: session.playerId,
    playerName: session.playerName,
    isHost: false,
    isReady: false,
    isAI: false,
    team: team as 1 | 2,
    joinedAt: Date.now(),
  }

  room.players.push(player)
  storage.updateRoom(room)

  session.currentRoomId = roomId
  storage.updateSession(session)

  // Notify other players
  wsManager.sendToRoom(roomId, 'player_joined', {
    player: {
      id: player.playerId,
      name: player.playerName,
      isHost: player.isHost,
      isReady: player.isReady,
      isAI: player.isAI,
      team: player.team,
    },
  })
  wsManager.sendToRoom(roomId, 'room_updated', { room: sanitizeRoom(room) })

  sendSuccess(res, { room: sanitizeRoom(room) })
})

// Leave room
app.post('/api/v1/rooms/:roomId/leave', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { roomId } = req.params

  const room = storage.getRoom(roomId)
  if (!room) {
    return sendError(res, 'Room not found', 404)
  }

  leaveRoom(session.playerId, room)

  session.currentRoomId = undefined
  storage.updateSession(session)

  sendSuccess(res)
})

// Set ready status
app.post('/api/v1/rooms/:roomId/ready', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { roomId } = req.params
  const { ready } = req.body

  const room = storage.getRoom(roomId)
  if (!room) {
    return sendError(res, 'Room not found', 404)
  }

  const player = room.players.find(p => p.playerId === session.playerId)
  if (!player) {
    return sendError(res, 'Not in room')
  }

  player.isReady = !!ready
  storage.updateRoom(room)

  wsManager.sendToRoom(roomId, 'room_updated', { room: sanitizeRoom(room) })

  sendSuccess(res)
})

// Change team
app.post('/api/v1/rooms/:roomId/team', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { roomId } = req.params
  const { team } = req.body

  if (team !== 1 && team !== 2) {
    return sendError(res, 'Invalid team')
  }

  const room = storage.getRoom(roomId)
  if (!room) {
    return sendError(res, 'Room not found', 404)
  }

  if (room.type !== '2v2') {
    return sendError(res, 'Team change only allowed in 2v2')
  }

  const player = room.players.find(p => p.playerId === session.playerId)
  if (!player) {
    return sendError(res, 'Not in room')
  }

  // Check team balance
  const teamCount = room.players.filter(p => p.team === team && p.playerId !== session.playerId).length
  if (teamCount >= 2) {
    return sendError(res, 'Team is full')
  }

  player.team = team
  storage.updateRoom(room)

  wsManager.sendToRoom(roomId, 'room_updated', { room: sanitizeRoom(room) })

  sendSuccess(res)
})

// Start game
app.post('/api/v1/rooms/:roomId/start', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { roomId } = req.params

  const room = storage.getRoom(roomId)
  if (!room) {
    return sendError(res, 'Room not found', 404)
  }

  if (room.hostId !== session.playerId) {
    return sendError(res, 'Only host can start game', 403)
  }

  if (room.status !== 'waiting') {
    return sendError(res, 'Room is not in waiting state')
  }

  // Fill with AI if needed
  const missingPlayers = room.maxPlayers - room.players.length
  let aiCount = 0

  for (let i = 0; i < missingPlayers; i++) {
    const team1Count = room.players.filter(p => p.team === 1).length
    const team2Count = room.players.filter(p => p.team === 2).length
    const team = team1Count <= team2Count ? 1 : 2

    room.players.push({
      playerId: `ai_${uuidv4()}`,
      playerName: `Bot ${i + 1}`,
      isHost: false,
      isReady: true,
      isAI: true,
      team: team as 1 | 2,
      joinedAt: Date.now(),
    })
    aiCount++
  }

  // Create game
  const game = createGame(room)
  room.status = 'playing'
  room.gameId = game.id
  storage.updateRoom(room)

  // Update sessions
  for (const player of room.players) {
    if (!player.isAI) {
      const playerSession = storage.getSessionByPlayerId(player.playerId)
      if (playerSession) {
        playerSession.currentGameId = game.id
        storage.updateSession(playerSession)
      }
    }
  }

  // Send game started to all players
  for (const player of game.players) {
    if (!player.isAI) {
      wsManager.sendToPlayer(player.playerId, 'game_started', {
        gameId: game.id,
        deckSeed: game.deckSeed,
        players: game.players.map(p => ({
          id: p.playerId,
          name: p.playerName,
          teamColor: p.teamColor,
          isAI: p.isAI,
        })),
        teams: game.teams,
        firstPlayerId: game.currentTurnPlayerId,
        hands: {
          [player.playerId]: player.hand.map(cardToStringFn),
        },
      })
    }
  }

  // If first player is AI, make their move
  const firstPlayer = game.players.find(p => p.playerId === game.currentTurnPlayerId)
  if (firstPlayer?.isAI) {
    setTimeout(() => processAITurn(game.id), 1000)
  }

  sendSuccess(res, {
    gameId: game.id,
    missingPlayersFilledWithAI: aiCount > 0,
    aiCount,
  })
})

// Make turn
app.post('/api/v1/games/:gameId/turn', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { gameId } = req.params
  const { cardIndex, row, col } = req.body

  const game = storage.getGame(gameId)
  if (!game) {
    return sendError(res, 'Game not found', 404)
  }

  if (game.status !== 'active') {
    return sendError(res, 'Game is not active')
  }

  if (game.currentTurnPlayerId !== session.playerId) {
    return sendError(res, 'Not your turn')
  }

  const player = game.players.find(p => p.playerId === session.playerId)
  if (!player) {
    return sendError(res, 'Player not in game')
  }

  const result = executeTurn(game, session.playerId, cardIndex, row, col)
  if (!result.success) {
    return sendError(res, result.error || 'Invalid move')
  }

  // Check for AI turn
  const currentPlayer = game.players.find(p => p.playerId === game.currentTurnPlayerId)
  if (currentPlayer?.isAI && game.status === 'active') {
    setTimeout(() => processAITurn(game.id), 800 + Math.random() * 400)
  }

  sendSuccess(res)
})

// Vote rematch
app.post('/api/v1/games/:gameId/rematch', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { gameId } = req.params
  const { vote } = req.body

  const game = storage.getGame(gameId)
  if (!game) {
    return sendError(res, 'Game not found', 404)
  }

  if (game.status !== 'finished') {
    return sendError(res, 'Game is not finished')
  }

  let rematchState = storage.getRematchState(gameId)
  if (!rematchState) {
    const humanPlayers = game.players.filter(p => !p.isAI)
    rematchState = {
      gameId,
      active: true,
      votes: [],
      deadline: Date.now() + 30000,
      requiredVotes: humanPlayers.length,
    }
  }

  // Add or update vote
  const existingVote = rematchState.votes.find(v => v.playerId === session.playerId)
  if (existingVote) {
    existingVote.vote = !!vote
    existingVote.timestamp = Date.now()
  } else {
    rematchState.votes.push({
      playerId: session.playerId,
      vote: !!vote,
      timestamp: Date.now(),
    })
  }

  storage.setRematchState(rematchState)

  // Notify all players
  wsManager.sendToGame(gameId, 'rematch_vote', { rematchState })

  // Check if all voted yes
  const yesVotes = rematchState.votes.filter(v => v.vote).length
  if (yesVotes >= rematchState.requiredVotes) {
    // Start new game
    const room = storage.getRoom(game.roomId)
    if (room) {
      room.status = 'waiting'
      storage.updateRoom(room)

      const newGame = createGame(room)
      room.status = 'playing'
      room.gameId = newGame.id
      storage.updateRoom(room)

      // Update sessions
      for (const player of room.players) {
        if (!player.isAI) {
          const playerSession = storage.getSessionByPlayerId(player.playerId)
          if (playerSession) {
            playerSession.currentGameId = newGame.id
            storage.updateSession(playerSession)
          }
        }
      }

      // Notify players
      wsManager.sendToGame(gameId, 'rematch_started', { newGameId: newGame.id })

      // Send game started
      for (const player of newGame.players) {
        if (!player.isAI) {
          wsManager.sendToPlayer(player.playerId, 'game_started', {
            gameId: newGame.id,
            deckSeed: newGame.deckSeed,
            players: newGame.players.map(p => ({
              id: p.playerId,
              name: p.playerName,
              teamColor: p.teamColor,
              isAI: p.isAI,
            })),
            teams: newGame.teams,
            firstPlayerId: newGame.currentTurnPlayerId,
            hands: {
              [player.playerId]: player.hand.map(cardToStringFn),
            },
          })
        }
      }

      // If first player is AI, make their move
      const firstPlayer = newGame.players.find(p => p.playerId === newGame.currentTurnPlayerId)
      if (firstPlayer?.isAI) {
        setTimeout(() => processAITurn(newGame.id), 1000)
      }

      storage.deleteRematchState(gameId)
    }
  }

  sendSuccess(res, { rematchState })
})

// Cancel rematch
app.post('/api/v1/games/:gameId/cancel-rematch', authMiddleware, (req, res) => {
  const session = (req as any).session
  const { gameId } = req.params

  const game = storage.getGame(gameId)
  if (!game) {
    return sendError(res, 'Game not found', 404)
  }

  storage.deleteRematchState(gameId)
  wsManager.sendToGame(gameId, 'rematch_cancelled', { reason: 'player_declined' })

  // Update room status
  const room = storage.getRoom(game.roomId)
  if (room) {
    room.status = 'waiting'
    // Remove AI players
    room.players = room.players.filter(p => !p.isAI)
    storage.updateRoom(room)
  }

  // Clear game from session
  session.currentGameId = undefined
  storage.updateSession(session)

  sendSuccess(res)
})

// ===================
// HELPER FUNCTIONS
// ===================

function sanitizeRoom(room: Room): {
  id: string
  name: string
  type: string
  boardType: string
  hasPassword: boolean
  status: string
  players: Array<{
    id: string
    name: string
    isHost: boolean
    isReady: boolean
    isAI: boolean
    team: 1 | 2
  }>
  maxPlayers: number
  hostId: string
} {
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    boardType: room.boardType,
    hasPassword: !!room.password,
    status: room.status,
    players: room.players.map(p => ({
      id: p.playerId,
      name: p.playerName,
      isHost: p.isHost,
      isReady: p.isReady,
      isAI: p.isAI,
      team: p.team,
    })),
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
  }
}

function cardToStringFn(card: Card): string {
  const suitChar = card.suit[0]!.toUpperCase()
  return `${card.rank}${suitChar}`
}

function leaveRoom(playerId: string, room: Room): void {
  const playerIndex = room.players.findIndex(p => p.playerId === playerId)
  if (playerIndex === -1) return

  const wasHost = room.players[playerIndex]!.isHost
  room.players.splice(playerIndex, 1)

  if (room.players.length === 0) {
    storage.deleteRoom(room.id)
    return
  }

  // Transfer host if needed
  if (wasHost) {
    const newHost = room.players.find(p => !p.isAI)
    if (newHost) {
      newHost.isHost = true
      room.hostId = newHost.playerId
    }
  }

  storage.updateRoom(room)

  wsManager.sendToRoom(room.id, 'player_left', {
    playerId,
    reason: 'leave',
    newHostId: room.hostId,
  })
  wsManager.sendToRoom(room.id, 'room_updated', { room: sanitizeRoom(room) })
}

function createGame(room: Room): Game {
  const gameId = uuidv4()
  const deckSeed = generateSeed()
  const shuffledDeck = createShuffledDeck(deckSeed)
  const board = createBoard(room.boardType)

  // Assign team colors
  const team1Color: TeamColor = 'green'
  const team2Color: TeamColor = 'blue'

  const gamePlayers: GamePlayer[] = []
  let deckCursor = 0
  const handSize = getHandSize(room.players.length)

  for (const roomPlayer of room.players) {
    const teamColor = roomPlayer.team === 1 ? team1Color : team2Color
    const hand = drawCards(shuffledDeck, deckCursor, handSize)
    deckCursor += handSize

    gamePlayers.push({
      playerId: roomPlayer.playerId,
      playerName: roomPlayer.playerName,
      teamColor,
      isAI: roomPlayer.isAI,
      hand,
    })
  }

  const game: Game = {
    id: gameId,
    roomId: room.id,
    deckSeed,
    boardType: room.boardType,
    status: 'active',
    players: gamePlayers,
    teams: [
      { color: team1Color, playerIds: room.players.filter(p => p.team === 1).map(p => p.playerId) },
      { color: team2Color, playerIds: room.players.filter(p => p.team === 2).map(p => p.playerId) },
    ],
    board,
    sequences: [],
    currentTurnPlayerId: gamePlayers[0]!.playerId,
    deckCursor,
    shuffledDeck,
    turnHistory: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }

  storage.createGame(game)
  return game
}

interface TurnResult {
  success: boolean
  error?: string
}

function executeTurn(game: Game, playerId: string, cardIndex: number, row: number, col: number): TurnResult {
  const player = game.players.find(p => p.playerId === playerId)
  if (!player) return { success: false, error: 'Player not found' }

  const card = player.hand[cardIndex]
  if (!card) return { success: false, error: 'Invalid card index' }

  const cell = game.board[row]?.[col]
  if (!cell) return { success: false, error: 'Invalid cell' }

  // Validate move
  if (isTwoEyedJack(card)) {
    if (cell.chip !== null || cell.card === 'CORNER') {
      return { success: false, error: 'Invalid target for two-eyed jack' }
    }
  } else if (isOneEyedJack(card)) {
    if (!cell.chip || cell.chip.color === player.teamColor || cell.chip.partOfSequence) {
      return { success: false, error: 'Invalid target for one-eyed jack' }
    }
  } else {
    if (cell.card === 'CORNER') {
      return { success: false, error: 'Cannot play on corner' }
    }
    if (cell.chip !== null) {
      return { success: false, error: 'Cell is occupied' }
    }
    const cellCard = cell.card as Card
    if (cellCard.rank !== card.rank || cellCard.suit !== card.suit) {
      return { success: false, error: 'Card does not match cell' }
    }
  }

  // Execute move
  const cardPlayed = { ...card }

  if (isOneEyedJack(card)) {
    cell.chip = null
  } else {
    cell.chip = {
      color: player.teamColor,
      partOfSequence: false,
    }
  }

  // Check for new sequences
  const newSequences = findNewSequences(game.board, player.teamColor, game.sequences)
  for (const seq of newSequences) {
    markSequenceCells(game.board, seq)
    game.sequences.push(seq)
  }

  // Check win condition
  let gameFinished = false
  if (checkWinCondition(game.sequences, player.teamColor)) {
    game.status = 'finished'
    game.winnerId = playerId
    game.finishedAt = Date.now()
    gameFinished = true
  }

  // Remove played card and draw new one
  player.hand.splice(cardIndex, 1)
  if (game.deckCursor < game.shuffledDeck.length) {
    const newCard = game.shuffledDeck[game.deckCursor]
    if (newCard) {
      player.hand.push(newCard)
      game.deckCursor++
    }
  }

  // Record turn
  game.turnHistory.push({
    playerId,
    cardIndex,
    row,
    col,
    cardPlayed,
    timestamp: Date.now(),
  })

  // Next turn
  if (!gameFinished) {
    const currentIndex = game.players.findIndex(p => p.playerId === game.currentTurnPlayerId)
    const nextIndex = (currentIndex + 1) % game.players.length
    game.currentTurnPlayerId = game.players[nextIndex]!.playerId
  }

  // Update last activity time
  game.lastActivityAt = Date.now()

  storage.updateGame(game)

  // Notify players
  wsManager.sendToGame(game.id, 'turn_made', {
    playerId,
    cardPlayed: cardToStringFn(cardPlayed),
    row,
    col,
    chipPlaced: cell.chip,
    newSequences: newSequences,
    nextPlayerId: game.currentTurnPlayerId,
  })

  if (gameFinished) {
    const winner = game.players.find(p => p.playerId === game.winnerId)
    wsManager.sendToGame(game.id, 'game_finished', {
      winnerId: game.winnerId,
      winnerName: winner?.playerName || 'Unknown',
      winningTeamColor: winner?.teamColor,
      finalSequences: game.sequences,
    })
  }

  return { success: true }
}

function processAITurn(gameId: string): void {
  const game = storage.getGame(gameId)
  if (!game || game.status !== 'active') return

  const aiPlayer = game.players.find(p => p.playerId === game.currentTurnPlayerId)
  if (!aiPlayer || !aiPlayer.isAI) return

  // Find opponent color
  const opponentTeam = game.teams.find(t => !t.playerIds.includes(aiPlayer.playerId))
  const opponentColor = opponentTeam?.color || 'green'

  const aiTurnCount = game.turnHistory.filter(t => t.playerId === aiPlayer.playerId).length

  const move = makeAIMove(
    'medium',
    aiPlayer.hand,
    game.board,
    aiPlayer.teamColor,
    opponentColor,
    aiTurnCount,
  )

  if (move) {
    executeTurn(game, aiPlayer.playerId, move.cardIndex, move.targetRow, move.targetCol)

    // Check if next player is also AI
    const updatedGame = storage.getGame(gameId)
    if (updatedGame && updatedGame.status === 'active') {
      const nextPlayer = updatedGame.players.find(p => p.playerId === updatedGame.currentTurnPlayerId)
      if (nextPlayer?.isAI) {
        setTimeout(() => processAITurn(gameId), 800 + Math.random() * 400)
      }
    }
  }
}

// Initialize WebSocket
wsManager.init(server)

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Sequence Web Server running on port ${PORT}`)
})

// Cleanup interval
setInterval(() => {
  storage.cleanupSessions()
  storage.cleanupEmptyRooms()
  // Cleanup games with no connected players after 360 seconds of inactivity
  storage.cleanupInactiveGames(360000, (playerId) => wsManager.isPlayerConnected(playerId))
}, 60000)
