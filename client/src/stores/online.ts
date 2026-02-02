import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  ConnectionStatus,
  RoomInfo,
  Room,
  RoomType,
  RematchState,
} from "@/types/online";
import type { BoardType, BoardCell } from "@/types";
import * as api from "@/services/api";
import {
  wsService,
  type RoomUpdatedEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type RematchVoteEvent,
  type RematchCancelledEvent,
  type GameStartedEvent,
  type TurnMadeEvent,
  type GameFinishedEvent,
} from "@/services/websocket";
import { useGameStore } from "@/stores/game";

export const useOnlineStore = defineStore("online", () => {
  // Connection state
  const serverUrl = ref<string>("");
  const connectionStatus = ref<ConnectionStatus>("disconnected");
  const serverName = ref<string>("");
  const serverVersion = ref<string>("");

  // Session state
  const sessionId = ref<string>("");
  const playerId = ref<string>("");
  const playerName = ref<string>("");
  const isAuthenticated = ref<boolean>(false);

  // Lobby state
  const rooms = ref<RoomInfo[]>([]);
  const isLoadingRooms = ref<boolean>(false);

  // Current room state
  const currentRoom = ref<Room | null>(null);
  const currentGameId = ref<string | null>(null);

  // Rematch state
  const rematchState = ref<RematchState | null>(null);

  // Error state
  const lastError = ref<string | null>(null);

  // Computed
  const isConnected = computed(() => connectionStatus.value === "connected");

  const isInRoom = computed(() => currentRoom.value !== null);

  const isHost = computed(() => {
    if (!currentRoom.value || !playerId.value) return false;
    return currentRoom.value.hostId === playerId.value;
  });

  const currentPlayer = computed(() => {
    if (!currentRoom.value || !playerId.value) return null;
    return (
      currentRoom.value.players.find((p) => p.id === playerId.value) || null
    );
  });

  const canStartGame = computed(() => {
    if (!isHost.value || !currentRoom.value) return false;
    // Host can always start, missing players will be filled with AI
    return true;
  });

  const missingPlayers = computed(() => {
    if (!currentRoom.value) return 0;
    return currentRoom.value.maxPlayers - currentRoom.value.players.length;
  });

  // Initialize from localStorage
  function initFromStorage() {
    const storedUrl = api.getStoredServerUrl();
    if (storedUrl) {
      serverUrl.value = storedUrl;
    }

    const storedSession = api.getStoredSession();
    if (storedSession) {
      sessionId.value = storedSession.sessionId;
      playerId.value = storedSession.playerId;
      playerName.value = storedSession.playerName;
    }
  }

  // Clear error
  function clearError() {
    lastError.value = null;
  }

  // Ping server to check availability
  async function pingServer(url: string): Promise<boolean> {
    clearError();
    connectionStatus.value = "connecting";

    try {
      const response = await api.pingServer(url);

      if (response.success && response.data) {
        serverUrl.value = url;
        serverName.value = response.data.serverName;
        serverVersion.value = response.data.version;
        connectionStatus.value = "connected";
        api.setServerUrl(url);
        return true;
      } else {
        lastError.value = response.error || "Сервер недоступен";
        connectionStatus.value = "error";
        return false;
      }
    } catch {
      lastError.value = "Не удалось подключиться к серверу";
      connectionStatus.value = "error";
      return false;
    }
  }

  // Check if name is available
  async function checkNameAvailable(
    name: string,
  ): Promise<{ available: boolean; reason?: string }> {
    clearError();

    if (!serverUrl.value) {
      return { available: false, reason: "Сервер не подключен" };
    }

    try {
      const response = await api.checkName(serverUrl.value, name);

      if (response.success && response.data) {
        return {
          available: response.data.available,
          reason: response.data.reason,
        };
      }

      return {
        available: false,
        reason: response.error || "Ошибка проверки имени",
      };
    } catch {
      return { available: false, reason: "Ошибка соединения" };
    }
  }

  // Join server with name
  async function joinServerWithName(name: string): Promise<boolean> {
    clearError();

    if (!serverUrl.value) {
      lastError.value = "Сервер не подключен";
      return false;
    }

    try {
      // First check name availability
      const nameCheck = await checkNameAvailable(name);
      if (!nameCheck.available) {
        lastError.value = nameCheck.reason || "Имя недоступно";
        return false;
      }

      // Join server
      const response = await api.joinServer(serverUrl.value, name);

      if (response.success && response.data) {
        sessionId.value = response.data.sessionId;
        playerId.value = response.data.playerId;
        playerName.value = name;
        isAuthenticated.value = true;

        // Connect WebSocket
        connectWebSocket();

        return true;
      }

      lastError.value = response.error || "Ошибка подключения";
      return false;
    } catch {
      lastError.value = "Ошибка соединения";
      return false;
    }
  }

  // Try to restore existing session or reconnect with same credentials
  // Returns: { success: boolean, hasActiveGame: boolean }
  async function tryRestoreOrReconnect(
    savedName: string,
  ): Promise<{ success: boolean; hasActiveGame: boolean }> {
    if (!serverUrl.value) return { success: false, hasActiveGame: false };

    // First, try to verify existing session by checking status
    if (sessionId.value) {
      const statusResponse = await api.getSessionStatus(serverUrl.value);

      if (statusResponse.success && statusResponse.data) {
        // Session is still valid
        isAuthenticated.value = true;
        connectWebSocket();

        // Check if there's an active game to restore
        if (statusResponse.data.gameState) {
          const gameState = statusResponse.data.gameState;
          const game = useGameStore();

          currentGameId.value = gameState.gameId;

          // Restore game state
          game.restoreOnlineGame({
            gameId: gameState.gameId,
            deckSeed: gameState.deckSeed,
            boardType: gameState.boardType,
            players: gameState.players,
            teams: gameState.teams,
            board: gameState.board as BoardCell[][],
            sequences: gameState.sequences,
            currentTurnPlayerId: gameState.currentTurnPlayerId,
            myHand: gameState.myHand,
            myPlayerId: gameState.myPlayerId,
          });

          return { success: true, hasActiveGame: true };
        }

        return { success: true, hasActiveGame: false };
      }

      // Session invalid - clear it and try to re-authenticate
      api.clearSession();
      sessionId.value = "";
      playerId.value = "";
    }

    // Try to re-authenticate with the same name
    const joinResponse = await api.joinServer(serverUrl.value, savedName);

    if (joinResponse.success && joinResponse.data) {
      sessionId.value = joinResponse.data.sessionId;
      playerId.value = joinResponse.data.playerId;
      playerName.value = savedName;
      isAuthenticated.value = true;
      connectWebSocket();
      return { success: true, hasActiveGame: false };
    }

    // If name is taken (maybe by stale session), try with a suffix
    if (joinResponse.error?.includes("taken")) {
      // Wait a moment and try again - the old session should be cleaned up
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const retryResponse = await api.joinServer(serverUrl.value, savedName);

      if (retryResponse.success && retryResponse.data) {
        sessionId.value = retryResponse.data.sessionId;
        playerId.value = retryResponse.data.playerId;
        playerName.value = savedName;
        isAuthenticated.value = true;
        connectWebSocket();
        return { success: true, hasActiveGame: false };
      }
    }

    return { success: false, hasActiveGame: false };
  }

  // WebSocket connection
  function connectWebSocket() {
    if (!serverUrl.value || !sessionId.value) return;

    wsService.connect(serverUrl.value, sessionId.value);

    // Handle room updates
    wsService.on("room_updated", (data) => {
      const event = data as RoomUpdatedEvent;
      if (currentRoom.value && event.room.id === currentRoom.value.id) {
        currentRoom.value = event.room;
      }
    });

    // Handle player joined
    wsService.on("player_joined", (data) => {
      const event = data as PlayerJoinedEvent;
      if (
        currentRoom.value &&
        !currentRoom.value.players.find((p) => p.id === event.player.id)
      ) {
        currentRoom.value.players.push(event.player);
      }
    });

    // Handle player left
    wsService.on("player_left", (data) => {
      const event = data as PlayerLeftEvent;
      if (currentRoom.value) {
        currentRoom.value.players = currentRoom.value.players.filter(
          (p) => p.id !== event.playerId,
        );
        if (event.newHostId) {
          currentRoom.value.hostId = event.newHostId;
          const newHost = currentRoom.value.players.find(
            (p) => p.id === event.newHostId,
          );
          if (newHost) {
            newHost.isHost = true;
          }
        }
      }
    });

    // Handle rematch vote
    wsService.on("rematch_vote", (data) => {
      const event = data as RematchVoteEvent;
      rematchState.value = event.rematchState;
    });

    // Handle rematch cancelled
    wsService.on("rematch_cancelled", (_data) => {
      rematchState.value = null;
    });

    // Handle game started
    wsService.on("game_started", (data) => {
      const event = data as GameStartedEvent;
      const game = useGameStore();

      // Get my hand from the hands object
      const myHand = event.hands[playerId.value] || [];

      game.initOnlineGame({
        gameId: event.gameId,
        deckSeed: event.deckSeed,
        selectedBoardType: (currentRoom.value?.boardType || "classic") as BoardType,
        serverPlayers: event.players,
        serverTeams: event.teams,
        firstPlayerId: event.firstPlayerId,
        myHand,
        myPlayerId: playerId.value,
      });

      currentGameId.value = event.gameId;
    });

    // Handle turn made
    wsService.on("turn_made", (data) => {
      const event = data as TurnMadeEvent;
      const game = useGameStore();

      game.applyOnlineTurn({
        playerId: event.playerId,
        cardPlayed: event.cardPlayed,
        row: event.row,
        col: event.col,
        chipPlaced: event.chipPlaced,
        newSequences: event.newSequences,
        nextPlayerId: event.nextPlayerId,
      });

      // If it was my turn, draw a new card
      if (event.playerId === playerId.value) {
        game.drawNewCardForOnline();
      }
    });

    // Handle game finished
    wsService.on("game_finished", (data) => {
      const event = data as GameFinishedEvent;
      const game = useGameStore();

      game.applyOnlineGameFinished({
        winnerId: event.winnerId,
        winnerName: event.winnerName,
        winningTeamColor: event.winningTeamColor,
      });
    });
  }

  function disconnectWebSocket() {
    wsService.disconnect();
  }

  // Leave server
  async function leaveServer() {
    disconnectWebSocket();
    if (serverUrl.value) {
      await api.leaveServer(serverUrl.value);
    }
    sessionId.value = "";
    playerId.value = "";
    playerName.value = "";
    isAuthenticated.value = false;
    currentRoom.value = null;
    currentGameId.value = null;
    rooms.value = [];
  }

  // Load rooms list
  async function loadRooms(): Promise<boolean> {
    clearError();

    if (!serverUrl.value) {
      lastError.value = "Сервер не подключен";
      return false;
    }

    isLoadingRooms.value = true;

    try {
      const response = await api.getRooms(serverUrl.value);

      if (response.success && response.data) {
        rooms.value = response.data.rooms;
        return true;
      }

      lastError.value = response.error || "Ошибка загрузки комнат";
      return false;
    } catch {
      lastError.value = "Ошибка соединения";
      return false;
    } finally {
      isLoadingRooms.value = false;
    }
  }

  // Create room
  async function createRoom(
    name: string,
    type: RoomType,
    boardType: BoardType,
    password?: string,
  ): Promise<boolean> {
    clearError();

    if (!serverUrl.value) {
      lastError.value = "Сервер не подключен";
      return false;
    }

    try {
      const response = await api.createRoom(
        serverUrl.value,
        name,
        type,
        boardType,
        password,
      );

      if (response.success && response.data) {
        currentRoom.value = response.data.room;
        return true;
      }

      lastError.value = response.error || "Ошибка создания комнаты";
      return false;
    } catch {
      lastError.value = "Ошибка соединения";
      return false;
    }
  }

  // Join room
  async function joinRoom(roomId: string, password?: string): Promise<boolean> {
    clearError();

    if (!serverUrl.value) {
      lastError.value = "Сервер не подключен";
      return false;
    }

    try {
      const response = await api.joinRoom(serverUrl.value, roomId, password);

      if (response.success && response.data) {
        currentRoom.value = response.data.room;
        return true;
      }

      lastError.value = response.error || "Ошибка входа в комнату";
      return false;
    } catch {
      lastError.value = "Ошибка соединения";
      return false;
    }
  }

  // Leave room
  async function leaveRoom(): Promise<boolean> {
    if (!serverUrl.value || !currentRoom.value) {
      return true;
    }

    try {
      await api.leaveRoom(serverUrl.value, currentRoom.value.id);
      currentRoom.value = null;
      currentGameId.value = null;
      return true;
    } catch {
      lastError.value = "Ошибка выхода из комнаты";
      return false;
    }
  }

  // Set ready status
  async function setReady(ready: boolean): Promise<boolean> {
    if (!serverUrl.value || !currentRoom.value) {
      return false;
    }

    try {
      const response = await api.setReady(
        serverUrl.value,
        currentRoom.value.id,
        ready,
      );

      if (response.success) {
        // Update local state (will be replaced by WebSocket update)
        const player = currentRoom.value.players.find(
          (p) => p.id === playerId.value,
        );
        if (player) {
          player.isReady = ready;
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // Change team
  async function changeTeam(team: 1 | 2): Promise<boolean> {
    if (!serverUrl.value || !currentRoom.value) {
      return false;
    }

    try {
      const response = await api.changeTeam(
        serverUrl.value,
        currentRoom.value.id,
        team,
      );

      if (response.success) {
        // Update local state
        const player = currentRoom.value.players.find(
          (p) => p.id === playerId.value,
        );
        if (player) {
          player.team = team;
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // Start game (host only)
  async function startGame(): Promise<{ success: boolean; aiCount: number }> {
    clearError();

    if (!serverUrl.value || !currentRoom.value || !isHost.value) {
      lastError.value = "Невозможно начать игру";
      return { success: false, aiCount: 0 };
    }

    try {
      const response = await api.startGame(
        serverUrl.value,
        currentRoom.value.id,
      );

      if (response.success && response.data) {
        currentGameId.value = response.data.gameId;
        if (currentRoom.value) {
          currentRoom.value.status = "playing";
        }
        return {
          success: true,
          aiCount: response.data.aiCount,
        };
      }

      lastError.value = response.error || "Ошибка запуска игры";
      return { success: false, aiCount: 0 };
    } catch {
      lastError.value = "Ошибка соединения";
      return { success: false, aiCount: 0 };
    }
  }

  // Vote for rematch
  async function voteRematch(vote: boolean): Promise<boolean> {
    if (!serverUrl.value || !currentGameId.value) {
      return false;
    }

    try {
      const response = await api.voteRematch(
        serverUrl.value,
        currentGameId.value,
        vote,
      );

      if (response.success && response.data) {
        rematchState.value = response.data.rematchState;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // Cancel rematch / go to lobby
  async function cancelRematch(): Promise<boolean> {
    if (!serverUrl.value || !currentGameId.value) {
      return false;
    }

    try {
      await api.cancelRematch(serverUrl.value, currentGameId.value);
      rematchState.value = null;
      currentGameId.value = null;
      if (currentRoom.value) {
        currentRoom.value.status = "waiting";
      }
      return true;
    } catch {
      return false;
    }
  }

  // Send game turn
  async function sendTurn(
    cardIndex: number,
    row: number,
    col: number,
  ): Promise<boolean> {
    if (!serverUrl.value || !currentGameId.value) {
      return false;
    }

    try {
      const response = await api.sendTurn(
        serverUrl.value,
        currentGameId.value,
        cardIndex,
        row,
        col,
      );
      return response.success;
    } catch {
      return false;
    }
  }

  // Reset store
  function reset() {
    disconnectWebSocket();
    connectionStatus.value = "disconnected";
    serverName.value = "";
    serverVersion.value = "";
    sessionId.value = "";
    playerId.value = "";
    playerName.value = "";
    isAuthenticated.value = false;
    rooms.value = [];
    currentRoom.value = null;
    currentGameId.value = null;
    rematchState.value = null;
    lastError.value = null;
  }

  // Disconnect from server
  function disconnect() {
    disconnectWebSocket();
    reset();
    // Keep serverUrl for reconnection
  }

  return {
    // State
    serverUrl,
    connectionStatus,
    serverName,
    serverVersion,
    sessionId,
    playerId,
    playerName,
    isAuthenticated,
    rooms,
    isLoadingRooms,
    currentRoom,
    currentGameId,
    rematchState,
    lastError,

    // Computed
    isConnected,
    isInRoom,
    isHost,
    currentPlayer,
    canStartGame,
    missingPlayers,

    // Actions
    initFromStorage,
    clearError,
    pingServer,
    checkNameAvailable,
    joinServerWithName,
    tryRestoreOrReconnect,
    leaveServer,
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    changeTeam,
    startGame,
    voteRematch,
    cancelRematch,
    sendTurn,
    reset,
    disconnect,
  };
});
