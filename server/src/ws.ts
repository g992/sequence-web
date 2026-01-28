import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { WSEvent, WSEventType } from './types.js'
import { storage } from './storage.js'

interface ExtendedWebSocket extends WebSocket {
  sessionId?: string
  playerId?: string
  isAlive?: boolean
}

class WebSocketManager {
  private wss: WebSocketServer | null = null
  private connections = new Map<string, ExtendedWebSocket>() // playerId -> WebSocket

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' })

    this.wss.on('connection', (ws: ExtendedWebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const sessionId = url.searchParams.get('sessionId')

      if (!sessionId) {
        ws.close(4001, 'Missing sessionId')
        return
      }

      const session = storage.getSession(sessionId)
      if (!session) {
        ws.close(4002, 'Invalid session')
        return
      }

      ws.sessionId = sessionId
      ws.playerId = session.playerId
      ws.isAlive = true

      // Store connection
      this.connections.set(session.playerId, ws)

      // Send connected event
      this.send(ws, 'connected', { playerId: session.playerId })

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleMessage(ws, message)
        } catch {
          // Ignore invalid messages
        }
      })

      // Handle pong
      ws.on('pong', () => {
        ws.isAlive = true
      })

      // Handle close
      ws.on('close', () => {
        if (ws.playerId) {
          this.connections.delete(ws.playerId)
        }
      })

      // Handle error
      ws.on('error', () => {
        if (ws.playerId) {
          this.connections.delete(ws.playerId)
        }
      })
    })

    // Heartbeat interval
    setInterval(() => {
      this.wss?.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate()
        }
        ws.isAlive = false
        ws.ping()
      })
    }, 30000)
  }

  private handleMessage(ws: ExtendedWebSocket, message: { type: string }): void {
    if (message.type === 'ping') {
      this.send(ws, 'pong', {})
    }
  }

  private send<T>(ws: WebSocket, type: WSEventType, data: T): void {
    if (ws.readyState === WebSocket.OPEN) {
      const event: WSEvent<T> = {
        type,
        data,
        timestamp: Date.now(),
      }
      ws.send(JSON.stringify(event))
    }
  }

  // Send to specific player
  sendToPlayer<T>(playerId: string, type: WSEventType, data: T): void {
    const ws = this.connections.get(playerId)
    if (ws) {
      this.send(ws, type, data)
    }
  }

  // Send to all players in a room
  sendToRoom<T>(roomId: string, type: WSEventType, data: T): void {
    const room = storage.getRoom(roomId)
    if (!room) return

    for (const player of room.players) {
      if (!player.isAI) {
        this.sendToPlayer(player.playerId, type, data)
      }
    }
  }

  // Send to all players in a game
  sendToGame<T>(gameId: string, type: WSEventType, data: T): void {
    const game = storage.getGame(gameId)
    if (!game) return

    for (const player of game.players) {
      if (!player.isAI) {
        this.sendToPlayer(player.playerId, type, data)
      }
    }
  }

  // Check if player is connected
  isPlayerConnected(playerId: string): boolean {
    const ws = this.connections.get(playerId)
    return ws?.readyState === WebSocket.OPEN
  }
}

export const wsManager = new WebSocketManager()
