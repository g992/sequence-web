/**
 * API Service for Sequence Web multiplayer
 * Real implementation with HTTP requests to backend server
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
} from "@/types/online";
import type { BoardType } from "@/types";

// Storage keys
const STORAGE_SERVER_URL = "sequence-server-url";
const STORAGE_SESSION_ID = "sequence-session-id";
const STORAGE_PLAYER_ID = "sequence-player-id";
const STORAGE_PLAYER_NAME = "sequence-player-name";

// Helper to get stored server URL
export function getStoredServerUrl(): string | null {
  return localStorage.getItem(STORAGE_SERVER_URL);
}

// Helper to set server URL
export function setServerUrl(url: string): void {
  localStorage.setItem(STORAGE_SERVER_URL, url);
}

// Helper to get stored session
export function getStoredSession(): {
  sessionId: string;
  playerId: string;
  playerName: string;
} | null {
  const sessionId = localStorage.getItem(STORAGE_SESSION_ID);
  const playerId = localStorage.getItem(STORAGE_PLAYER_ID);
  const playerName = localStorage.getItem(STORAGE_PLAYER_NAME);

  if (sessionId && playerId && playerName) {
    return { sessionId, playerId, playerName };
  }
  return null;
}

// Helper to store session
export function storeSession(
  sessionId: string,
  playerId: string,
  playerName: string,
): void {
  localStorage.setItem(STORAGE_SESSION_ID, sessionId);
  localStorage.setItem(STORAGE_PLAYER_ID, playerId);
  localStorage.setItem(STORAGE_PLAYER_NAME, playerName);
}

// Helper to clear session
export function clearSession(): void {
  localStorage.removeItem(STORAGE_SESSION_ID);
  localStorage.removeItem(STORAGE_PLAYER_ID);
  localStorage.removeItem(STORAGE_PLAYER_NAME);
}

// Get session ID for auth header
function getSessionId(): string | null {
  return localStorage.getItem(STORAGE_SESSION_ID);
}

// Build API URL
function apiUrl(serverUrl: string, path: string): string {
  return `${serverUrl}/api/v1${path}`;
}

// Generic fetch wrapper
async function apiFetch<T>(
  serverUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const sessionId = getSessionId();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (sessionId) {
      headers["Authorization"] = `Bearer ${sessionId}`;
    }

    const response = await fetch(apiUrl(serverUrl, path), {
      ...options,
      headers,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: "Network error",
    };
  }
}

/**
 * Ping server to check availability
 */
export async function pingServer(
  serverUrl: string,
): Promise<ApiResponse<PingResponse>> {
  return apiFetch<PingResponse>(serverUrl, "/ping");
}

/**
 * Check if player name is available
 */
export async function checkName(
  serverUrl: string,
  name: string,
): Promise<ApiResponse<CheckNameResponse>> {
  return apiFetch<CheckNameResponse>(serverUrl, "/check-name", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/**
 * Join server with player name
 */
export async function joinServer(
  serverUrl: string,
  name: string,
): Promise<ApiResponse<JoinServerResponse>> {
  const response = await apiFetch<JoinServerResponse>(serverUrl, "/join", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

  if (response.success && response.data) {
    storeSession(response.data.sessionId, response.data.playerId, name);
  }

  return response;
}

/**
 * Leave server / disconnect
 */
export async function leaveServer(
  serverUrl: string,
): Promise<ApiResponse<void>> {
  const response = await apiFetch<void>(serverUrl, "/leave", {
    method: "POST",
  });

  clearSession();

  return response;
}

/**
 * Get list of rooms
 */
export async function getRooms(
  serverUrl: string,
): Promise<ApiResponse<RoomListResponse>> {
  return apiFetch<RoomListResponse>(serverUrl, "/rooms");
}

/**
 * Create a new room
 */
export async function createRoom(
  serverUrl: string,
  name: string,
  type: RoomType,
  boardType: BoardType,
  password?: string,
): Promise<ApiResponse<CreateRoomResponse>> {
  return apiFetch<CreateRoomResponse>(serverUrl, "/rooms", {
    method: "POST",
    body: JSON.stringify({ name, type, boardType, password }),
  });
}

/**
 * Join an existing room
 */
export async function joinRoom(
  serverUrl: string,
  roomId: string,
  password?: string,
): Promise<ApiResponse<JoinRoomResponse>> {
  return apiFetch<JoinRoomResponse>(serverUrl, `/rooms/${roomId}/join`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

/**
 * Leave current room
 */
export async function leaveRoom(
  serverUrl: string,
  roomId: string,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(serverUrl, `/rooms/${roomId}/leave`, {
    method: "POST",
  });
}

/**
 * Set player ready status in room
 */
export async function setReady(
  serverUrl: string,
  roomId: string,
  ready: boolean,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(serverUrl, `/rooms/${roomId}/ready`, {
    method: "POST",
    body: JSON.stringify({ ready }),
  });
}

/**
 * Change team in room (for 2v2)
 */
export async function changeTeam(
  serverUrl: string,
  roomId: string,
  team: 1 | 2,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(serverUrl, `/rooms/${roomId}/team`, {
    method: "POST",
    body: JSON.stringify({ team }),
  });
}

/**
 * Start game (host only)
 */
export async function startGame(
  serverUrl: string,
  roomId: string,
): Promise<ApiResponse<StartGameResponse>> {
  return apiFetch<StartGameResponse>(serverUrl, `/rooms/${roomId}/start`, {
    method: "POST",
  });
}

/**
 * Vote for rematch
 */
export async function voteRematch(
  serverUrl: string,
  gameId: string,
  vote: boolean,
): Promise<ApiResponse<RematchResponse>> {
  return apiFetch<RematchResponse>(serverUrl, `/games/${gameId}/rematch`, {
    method: "POST",
    body: JSON.stringify({ vote }),
  });
}

/**
 * Cancel rematch voting (returns to lobby)
 */
export async function cancelRematch(
  serverUrl: string,
  gameId: string,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(serverUrl, `/games/${gameId}/cancel-rematch`, {
    method: "POST",
  });
}

/**
 * Send game turn to server
 */
export async function sendTurn(
  serverUrl: string,
  gameId: string,
  cardIndex: number,
  row: number,
  col: number,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(serverUrl, `/games/${gameId}/turn`, {
    method: "POST",
    body: JSON.stringify({ cardIndex, row, col }),
  });
}
