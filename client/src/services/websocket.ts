/**
 * WebSocket Service for real-time communication with the server
 */

import type {
  WSEvent,
  WSEventType,
  Room,
  RoomPlayer,
  RematchState,
} from "@/types/online";

type EventCallback = (data: unknown) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private serverUrl: string = "";
  private sessionId: string = "";
  private listeners = new Map<WSEventType, EventCallback[]>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isConnecting = false;

  connect(serverUrl: string, sessionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      if (this.isConnecting) {
        resolve(false);
        return;
      }

      this.isConnecting = true;
      this.serverUrl = serverUrl;
      this.sessionId = sessionId;

      // Convert http(s) to ws(s)
      const wsUrl =
        serverUrl.replace(/^http/, "ws") + `/ws?sessionId=${sessionId}`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.startPing();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WSEvent = JSON.parse(event.data);
            this.handleEvent(data);
          } catch {
            // Ignore invalid messages
          }
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.stopPing();
          this.scheduleReconnect();
        };

        this.ws.onerror = () => {
          this.isConnecting = false;
          resolve(false);
        };
      } catch {
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  private handleEvent(event: WSEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(event.data);
      }
    }
  }

  on(eventType: WSEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.push(callback);
    this.listeners.set(eventType, callbacks);
  }

  off(eventType: WSEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    if (!this.serverUrl || !this.sessionId) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.serverUrl, this.sessionId);
    }, 3000);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

// Event data types
export interface RoomUpdatedEvent {
  room: Room;
}

export interface PlayerJoinedEvent {
  player: RoomPlayer;
}

export interface PlayerLeftEvent {
  playerId: string;
  reason: "disconnect" | "leave" | "kick";
  newHostId?: string;
}

export interface GameStartedEvent {
  gameId: string;
  deckSeed: number;
  players: Array<{
    id: string;
    name: string;
    teamColor: string;
    isAI: boolean;
  }>;
  teams: Array<{
    color: string;
    playerIds: string[];
  }>;
  firstPlayerId: string;
  hands: Record<string, string[]>;
}

export interface TurnMadeEvent {
  playerId: string;
  cardPlayed: string;
  row: number;
  col: number;
  chipPlaced: { color: string; partOfSequence: boolean } | null;
  newSequences: Array<{
    teamColor: string;
    cells: Array<{ row: number; col: number }>;
  }>;
  nextPlayerId: string;
}

export interface GameFinishedEvent {
  winnerId: string;
  winnerName: string;
  winningTeamColor: string;
  finalSequences: Array<{
    teamColor: string;
    cells: Array<{ row: number; col: number }>;
  }>;
}

export interface RematchVoteEvent {
  rematchState: RematchState;
}

export interface RematchStartedEvent {
  newGameId: string;
}

export interface RematchCancelledEvent {
  reason: "timeout" | "player_declined" | "player_left";
}
