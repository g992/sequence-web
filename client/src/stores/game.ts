import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type {
  GamePhase,
  Player,
  Team,
  Card,
  BoardCell,
  Sequence,
  TeamColor,
  BoardType,
} from "@/types";
import { isOneEyedJack, isTwoEyedJack } from "@/types";
import {
  createBoard,
  findCellsForCard,
  isDeadCard,
  getEmptyCells,
  getRemovableChips,
} from "@/data/board";
import {
  createShuffledDeck,
  drawCards,
  getHandSize,
  generateSeed,
} from "@/data/deck";
import {
  findNewSequences,
  markSequenceCells,
  checkWinCondition,
} from "@/data/sequence";
import { makeAIMove, type AIDifficulty } from "@/data/ai";

const STORAGE_KEY = "sequence-game-state";

interface PlayedCard {
  card: Card;
  playerId: string;
  row: number;
  col: number;
  timestamp: number;
}

interface SavedGameState {
  phase: GamePhase;
  players: Player[];
  teams: Team[];
  board: BoardCell[][];
  boardType: BoardType;
  sequences: Sequence[];
  currentTurnPlayerId: string | null;
  winnerId: string | null;
  localPlayerId: string;
  deckSeed: number;
  deckCursor: number;
  hands: Record<string, Card[]>;
  aiDifficulty: AIDifficulty | null;
  aiTurnCount: number;
  lastPlayedCards: PlayedCard[];
  lastOpponentMove: { row: number; col: number } | null;
}

export const useGameStore = defineStore("game", () => {
  // State
  const phase = ref<GamePhase>("lobby");
  const players = ref<Player[]>([]);
  const teams = ref<Team[]>([]);
  const board = ref<BoardCell[][]>([]);
  const boardType = ref<BoardType>("classic");
  const sequences = ref<Sequence[]>([]);
  const currentTurnPlayerId = ref<string | null>(null);
  const winnerId = ref<string | null>(null);
  const localPlayerId = ref<string>("");

  // Deck state
  const deckSeed = ref<number>(0);
  const deckCursor = ref<number>(0);
  const shuffledDeck = ref<Card[]>([]);

  // Hands (player id -> cards)
  const hands = ref<Record<string, Card[]>>({});

  // Selected card for current move
  const selectedCardIndex = ref<number | null>(null);

  // AI state
  const aiDifficulty = ref<AIDifficulty | null>(null);
  const aiTurnCount = ref<number>(0);
  const isAIThinking = ref<boolean>(false);

  // Online game state
  const isOnlineGame = ref<boolean>(false);
  const onlineGameId = ref<string | null>(null);

  // History for UI
  const lastPlayedCards = ref<PlayedCard[]>([]);
  const lastOpponentMove = ref<{ row: number; col: number } | null>(null);

  // New card animation
  const newCardAnimation = ref<Card | null>(null);

  // Computed
  const currentPlayer = computed(() =>
    players.value.find((p) => p.id === currentTurnPlayerId.value),
  );

  const localPlayer = computed(() =>
    players.value.find((p) => p.id === localPlayerId.value),
  );

  const localHand = computed(() => hands.value[localPlayerId.value] || []);

  const isMyTurn = computed(
    () => currentTurnPlayerId.value === localPlayerId.value,
  );

  const isAIGame = computed(() => aiDifficulty.value !== null);

  const isAITurn = computed(
    () => isAIGame.value && currentTurnPlayerId.value === "ai",
  );

  const selectedCard = computed(() => {
    if (selectedCardIndex.value === null) return null;
    return localHand.value[selectedCardIndex.value] || null;
  });

  const playableCells = computed(() => {
    if (!selectedCard.value || !isMyTurn.value) return [];

    const card = selectedCard.value;

    // Two-eyed jack: any empty cell
    if (isTwoEyedJack(card)) {
      return getEmptyCells(board.value);
    }

    // One-eyed jack: opponent chips not in sequence
    if (isOneEyedJack(card)) {
      const myTeam = teams.value.find((t) =>
        t.playerIds.includes(localPlayerId.value),
      );
      const opponentColors = teams.value
        .filter((t) => t.color !== myTeam?.color)
        .map((t) => t.color);
      return getRemovableChips(board.value, opponentColors);
    }

    // Normal card: find matching cells without chips
    return findCellsForCard(board.value, card).filter(
      (cell) => cell.chip === null,
    );
  });

  // Get last 3 played cards
  const recentCards = computed(() => {
    return lastPlayedCards.value.slice(-3);
  });

  // Save state to localStorage
  function saveGame() {
    if (phase.value === "lobby") return;

    const state: SavedGameState = {
      phase: phase.value,
      players: players.value,
      teams: teams.value,
      board: board.value,
      boardType: boardType.value,
      sequences: sequences.value,
      currentTurnPlayerId: currentTurnPlayerId.value,
      winnerId: winnerId.value,
      localPlayerId: localPlayerId.value,
      deckSeed: deckSeed.value,
      deckCursor: deckCursor.value,
      hands: hands.value,
      aiDifficulty: aiDifficulty.value,
      aiTurnCount: aiTurnCount.value,
      lastPlayedCards: lastPlayedCards.value,
      lastOpponentMove: lastOpponentMove.value,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Load state from localStorage
  function loadGame(): boolean {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {
      const state: SavedGameState = JSON.parse(saved);

      phase.value = state.phase;
      players.value = state.players;
      teams.value = state.teams;
      board.value = state.board;
      boardType.value = state.boardType || "classic";
      sequences.value = state.sequences;
      currentTurnPlayerId.value = state.currentTurnPlayerId;
      winnerId.value = state.winnerId;
      localPlayerId.value = state.localPlayerId;
      deckSeed.value = state.deckSeed;
      deckCursor.value = state.deckCursor;
      hands.value = state.hands;
      aiDifficulty.value = state.aiDifficulty;
      aiTurnCount.value = state.aiTurnCount;
      lastPlayedCards.value = state.lastPlayedCards || [];
      lastOpponentMove.value = state.lastOpponentMove || null;

      // Reconstruct deck from seed
      shuffledDeck.value = createShuffledDeck(deckSeed.value);

      return true;
    } catch {
      return false;
    }
  }

  // Clear saved game
  function clearSavedGame() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Check if there's a saved game
  function hasSavedGame(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  // Initialize AI game
  function initAIGame(
    difficulty: AIDifficulty,
    selectedBoardType: BoardType = "classic",
  ) {
    aiDifficulty.value = difficulty;
    aiTurnCount.value = 0;
    phase.value = "lobby";
    boardType.value = selectedBoardType;
    board.value = createBoard(selectedBoardType);
    sequences.value = [];
    winnerId.value = null;
    lastPlayedCards.value = [];
    lastOpponentMove.value = null;

    localPlayerId.value = "player";
    players.value = [
      {
        id: "player",
        name: "Вы",
        teamColor: "green",
        isHost: true,
        connected: true,
      },
      {
        id: "ai",
        name: "ИИ",
        teamColor: "blue",
        isHost: false,
        connected: true,
      },
    ];
    teams.value = [
      { color: "green", playerIds: ["player"] },
      { color: "blue", playerIds: ["ai"] },
    ];
  }

  // Change player team color
  function changePlayerColor(newColor: TeamColor) {
    const player = localPlayer.value;
    if (!player) return;

    // Can't choose opponent's color
    const opponentColor = players.value.find(
      (p) => p.id !== player.id,
    )?.teamColor;
    if (newColor === opponentColor) return;

    // Update player color
    player.teamColor = newColor;

    // Update team
    const oldTeam = teams.value.find((t) => t.playerIds.includes(player.id));
    if (oldTeam) {
      oldTeam.playerIds = oldTeam.playerIds.filter((id) => id !== player.id);
    }

    let newTeam = teams.value.find((t) => t.color === newColor);
    if (!newTeam) {
      newTeam = { color: newColor, playerIds: [] };
      teams.value.push(newTeam);
    }
    newTeam.playerIds.push(player.id);

    saveGame();
  }

  function startGame() {
    if (phase.value !== "lobby") return;

    // Initialize deck
    deckSeed.value = generateSeed();
    shuffledDeck.value = createShuffledDeck(deckSeed.value);
    deckCursor.value = 0;

    // Deal hands
    const handSize = getHandSize(players.value.length);
    hands.value = {};

    for (const player of players.value) {
      hands.value[player.id] = drawCards(
        shuffledDeck.value,
        deckCursor.value,
        handSize,
      );
      deckCursor.value += handSize;
    }

    // First player starts
    currentTurnPlayerId.value = players.value[0]?.id ?? null;
    phase.value = "playing";
    selectedCardIndex.value = null;
    lastPlayedCards.value = [];
    lastOpponentMove.value = null;

    saveGame();
  }

  function selectCard(index: number) {
    if (!isMyTurn.value) return;
    if (index < 0 || index >= localHand.value.length) return;

    selectedCardIndex.value = selectedCardIndex.value === index ? null : index;
  }

  // Internal function to execute a move (used by both player and AI)
  function executeMove(
    playerId: string,
    cardIndex: number,
    row: number,
    col: number,
  ): Card | null {
    const playerHand = hands.value[playerId];
    if (!playerHand) return null;

    const card = playerHand[cardIndex];
    const cell = board.value[row]?.[col];
    const player = players.value.find((p) => p.id === playerId);
    if (!player || !card || !cell) return null;

    // Execute move
    if (isOneEyedJack(card)) {
      // Remove opponent chip
      cell.chip = null;
    } else {
      // Place chip
      cell.chip = {
        color: player.teamColor,
        partOfSequence: false,
      };
    }

    // Track last opponent move
    if (playerId !== localPlayerId.value) {
      lastOpponentMove.value = { row, col };
    }

    // Add to played cards history
    lastPlayedCards.value.push({
      card: { ...card },
      playerId,
      row,
      col,
      timestamp: Date.now(),
    });

    // Keep only last 10 cards in history
    if (lastPlayedCards.value.length > 10) {
      lastPlayedCards.value = lastPlayedCards.value.slice(-10);
    }

    // Check for new sequences
    const newSeqs = findNewSequences(
      board.value,
      player.teamColor,
      sequences.value,
    );
    for (const seq of newSeqs) {
      markSequenceCells(board.value, seq);
      sequences.value.push(seq);
    }

    // Check win condition
    if (checkWinCondition(sequences.value, player.teamColor)) {
      winnerId.value = player.id;
      phase.value = "finished";
    }

    // Remove played card and draw new one
    const playedCard = { ...card };
    playerHand.splice(cardIndex, 1);
    const nextCard = shuffledDeck.value[deckCursor.value];
    if (deckCursor.value < shuffledDeck.value.length && nextCard) {
      playerHand.push(nextCard);
      deckCursor.value++;

      // Trigger new card animation for player
      if (playerId === localPlayerId.value) {
        newCardAnimation.value = nextCard;
        setTimeout(() => {
          newCardAnimation.value = null;
        }, 500);
      }
    }

    return playedCard;
  }

  function playCard(row: number, col: number) {
    if (!isMyTurn.value || selectedCardIndex.value === null) return;

    // Validate move
    const isValidTarget = playableCells.value.some(
      (c) => c.row === row && c.col === col,
    );
    if (!isValidTarget) return;

    executeMove(localPlayerId.value, selectedCardIndex.value, row, col);

    // Clear selection
    selectedCardIndex.value = null;

    // Next turn (if game not finished)
    if (phase.value === "playing") {
      nextTurn();
    }

    saveGame();

    // Trigger AI turn if needed
    if (isAITurn.value && phase.value === "playing") {
      scheduleAITurn();
    }
  }

  function discardDeadCard(index: number) {
    if (!isMyTurn.value) return;

    const card = localHand.value[index];
    if (!card) return;

    // Check if card is dead (both positions occupied)
    if (!isDeadCard(board.value, card)) return;

    // Jacks are never dead
    if (card.rank === "J") return;

    // Remove card and draw new one
    const playerId = localPlayerId.value;
    const playerHand = hands.value[playerId];
    if (playerHand) {
      playerHand.splice(index, 1);
      const nextCard = shuffledDeck.value[deckCursor.value];
      if (deckCursor.value < shuffledDeck.value.length && nextCard) {
        playerHand.push(nextCard);
        deckCursor.value++;

        // Trigger new card animation
        newCardAnimation.value = nextCard;
        setTimeout(() => {
          newCardAnimation.value = null;
        }, 500);
      }
    }

    selectedCardIndex.value = null;
    saveGame();
  }

  function nextTurn() {
    const currentIndex = players.value.findIndex(
      (p) => p.id === currentTurnPlayerId.value,
    );
    const nextIndex = (currentIndex + 1) % players.value.length;
    currentTurnPlayerId.value = players.value[nextIndex]?.id ?? null;
  }

  // AI turn logic
  function scheduleAITurn() {
    if (!isAITurn.value || phase.value !== "playing") return;

    isAIThinking.value = true;

    // Add delay to make AI feel more natural
    setTimeout(
      () => {
        executeAITurn();
      },
      800 + Math.random() * 400,
    );
  }

  function executeAITurn() {
    if (!aiDifficulty.value || phase.value !== "playing") {
      isAIThinking.value = false;
      return;
    }

    const aiHand = hands.value["ai"];
    if (!aiHand || aiHand.length === 0) {
      isAIThinking.value = false;
      return;
    }

    const aiColor: TeamColor = "blue";
    const playerColor: TeamColor = "green";

    const move = makeAIMove(
      aiDifficulty.value,
      aiHand,
      board.value,
      aiColor,
      playerColor,
      aiTurnCount.value,
    );

    if (move) {
      executeMove("ai", move.cardIndex, move.targetRow, move.targetCol);
      aiTurnCount.value++;
    }

    isAIThinking.value = false;

    // Next turn
    if (phase.value === "playing") {
      nextTurn();
    }

    saveGame();
  }

  function resetGame() {
    phase.value = "lobby";
    boardType.value = "classic";
    board.value = createBoard();
    sequences.value = [];
    hands.value = {};
    selectedCardIndex.value = null;
    currentTurnPlayerId.value = null;
    winnerId.value = null;
    deckCursor.value = 0;
    aiDifficulty.value = null;
    aiTurnCount.value = 0;
    isAIThinking.value = false;
    lastPlayedCards.value = [];
    lastOpponentMove.value = null;
    newCardAnimation.value = null;
    isOnlineGame.value = false;
    onlineGameId.value = null;
    clearSavedGame();
  }

  // Initialize game from online server data
  function initOnlineGame(data: {
    gameId: string;
    deckSeed: number;
    selectedBoardType: BoardType;
    serverPlayers: Array<{
      id: string;
      name: string;
      teamColor: string;
      isAI: boolean;
    }>;
    serverTeams: Array<{
      color: string;
      playerIds: string[];
    }>;
    firstPlayerId: string;
    myHand: string[];
    myPlayerId: string;
  }) {
    // Reset state
    phase.value = "playing";
    boardType.value = data.selectedBoardType;
    board.value = createBoard(data.selectedBoardType);
    sequences.value = [];
    winnerId.value = null;
    lastPlayedCards.value = [];
    lastOpponentMove.value = null;
    aiDifficulty.value = null; // Not an AI game

    // Set online game flag
    isOnlineGame.value = true;
    onlineGameId.value = data.gameId;

    // Set deck
    deckSeed.value = data.deckSeed;
    shuffledDeck.value = createShuffledDeck(data.deckSeed);

    // Set local player
    localPlayerId.value = data.myPlayerId;

    // Set players
    players.value = data.serverPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      teamColor: p.teamColor as TeamColor,
      isHost: false,
      connected: true,
    }));

    // Set teams
    teams.value = data.serverTeams.map((t) => ({
      color: t.color as TeamColor,
      playerIds: t.playerIds,
    }));

    // Set first turn
    currentTurnPlayerId.value = data.firstPlayerId;

    // Parse hand strings to Card objects
    hands.value = {};
    hands.value[data.myPlayerId] = data.myHand.map((cardStr) => {
      const rank = cardStr.slice(0, -1);
      const suitChar = cardStr.slice(-1).toLowerCase();
      const suitMap: Record<string, string> = {
        s: "spades",
        h: "hearts",
        d: "diamonds",
        c: "clubs",
      };
      return {
        rank: rank as Card["rank"],
        suit: suitMap[suitChar] as Card["suit"],
      };
    });

    // Calculate deck cursor based on hand size
    const handSize = getHandSize(data.serverPlayers.length);
    deckCursor.value = handSize * data.serverPlayers.length;

    selectedCardIndex.value = null;
  }

  // Restore game state from server (for reconnection)
  function restoreOnlineGame(data: {
    gameId: string;
    deckSeed: number;
    boardType: string;
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
    board: BoardCell[][];
    sequences: Array<{
      teamColor: string;
      cells: Array<{ row: number; col: number }>;
    }>;
    currentTurnPlayerId: string;
    myHand: string[];
    myPlayerId: string;
  }) {
    // Set state
    phase.value = "playing";
    boardType.value = data.boardType as BoardType;
    winnerId.value = null;
    lastPlayedCards.value = [];
    lastOpponentMove.value = null;
    aiDifficulty.value = null;

    // Set online game flag
    isOnlineGame.value = true;
    onlineGameId.value = data.gameId;

    // Set deck
    deckSeed.value = data.deckSeed;
    shuffledDeck.value = createShuffledDeck(data.deckSeed);

    // Set local player
    localPlayerId.value = data.myPlayerId;

    // Set players
    players.value = data.players.map((p) => ({
      id: p.id,
      name: p.name,
      teamColor: p.teamColor as TeamColor,
      isHost: false,
      connected: true,
    }));

    // Set teams
    teams.value = data.teams.map((t) => ({
      color: t.color as TeamColor,
      playerIds: t.playerIds,
    }));

    // Restore board state from server
    board.value = data.board;

    // Restore sequences
    sequences.value = data.sequences.map((s) => ({
      teamColor: s.teamColor as TeamColor,
      cells: s.cells,
    }));

    // Set current turn
    currentTurnPlayerId.value = data.currentTurnPlayerId;

    // Parse hand strings to Card objects
    hands.value = {};
    hands.value[data.myPlayerId] = data.myHand.map((cardStr) => {
      const rank = cardStr.slice(0, -1);
      const suitChar = cardStr.slice(-1).toLowerCase();
      const suitMap: Record<string, string> = {
        s: "spades",
        h: "hearts",
        d: "diamonds",
        c: "clubs",
      };
      return {
        rank: rank as Card["rank"],
        suit: suitMap[suitChar] as Card["suit"],
      };
    });

    // Calculate deck cursor
    const handSize = getHandSize(data.players.length);
    deckCursor.value = handSize * data.players.length;

    selectedCardIndex.value = null;
  }

  // Apply a turn from the server (for online games)
  function applyOnlineTurn(data: {
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
  }) {
    const cell = board.value[data.row]?.[data.col];
    if (!cell) return;

    // Apply chip change
    if (data.chipPlaced) {
      cell.chip = {
        color: data.chipPlaced.color as TeamColor,
        partOfSequence: data.chipPlaced.partOfSequence,
      };
    } else {
      cell.chip = null;
    }

    // Track opponent move
    if (data.playerId !== localPlayerId.value) {
      lastOpponentMove.value = { row: data.row, col: data.col };
    }

    // Parse played card
    const cardStr = data.cardPlayed;
    const rank = cardStr.slice(0, -1);
    const suitChar = cardStr.slice(-1).toLowerCase();
    const suitMap: Record<string, string> = {
      s: "spades",
      h: "hearts",
      d: "diamonds",
      c: "clubs",
    };
    const playedCard: Card = {
      rank: rank as Card["rank"],
      suit: suitMap[suitChar] as Card["suit"],
    };

    // Add to history
    lastPlayedCards.value.push({
      card: playedCard,
      playerId: data.playerId,
      row: data.row,
      col: data.col,
      timestamp: Date.now(),
    });
    if (lastPlayedCards.value.length > 10) {
      lastPlayedCards.value = lastPlayedCards.value.slice(-10);
    }

    // Apply new sequences
    for (const seq of data.newSequences) {
      const newSeq: Sequence = {
        teamColor: seq.teamColor as TeamColor,
        cells: seq.cells,
      };
      markSequenceCells(board.value, newSeq);
      sequences.value.push(newSeq);
    }

    // Update turn
    currentTurnPlayerId.value = data.nextPlayerId;
  }

  // Handle game finished from server
  function applyOnlineGameFinished(data: {
    winnerId: string;
    winnerName: string;
    winningTeamColor: string;
  }) {
    winnerId.value = data.winnerId;
    phase.value = "finished";
  }

  // Draw new card for local player after their turn
  function drawNewCardForOnline() {
    const myHand = hands.value[localPlayerId.value];
    if (!myHand) return;

    const nextCard = shuffledDeck.value[deckCursor.value];
    if (deckCursor.value < shuffledDeck.value.length && nextCard) {
      myHand.push(nextCard);
      deckCursor.value++;

      newCardAnimation.value = nextCard;
      setTimeout(() => {
        newCardAnimation.value = null;
      }, 500);
    }
  }

  // Remove card from hand (for online play when submitting turn)
  function removeCardFromHand(cardIndex: number) {
    const myHand = hands.value[localPlayerId.value];
    if (!myHand) return;
    myHand.splice(cardIndex, 1);
    selectedCardIndex.value = null;
  }

  // Watch for AI turn
  watch(
    [currentTurnPlayerId, phase],
    () => {
      if (isAITurn.value && phase.value === "playing" && !isAIThinking.value) {
        scheduleAITurn();
      }
    },
    { immediate: true },
  );

  return {
    // State
    phase,
    players,
    teams,
    board,
    boardType,
    sequences,
    currentTurnPlayerId,
    winnerId,
    localPlayerId,
    hands,
    selectedCardIndex,
    aiDifficulty,
    isAIThinking,
    lastPlayedCards,
    lastOpponentMove,
    newCardAnimation,
    isOnlineGame,
    onlineGameId,

    // Computed
    currentPlayer,
    localPlayer,
    localHand,
    isMyTurn,
    isAIGame,
    isAITurn,
    selectedCard,
    playableCells,
    recentCards,

    // Actions
    initAIGame,
    startGame,
    selectCard,
    playCard,
    discardDeadCard,
    resetGame,
    saveGame,
    loadGame,
    hasSavedGame,
    clearSavedGame,
    changePlayerColor,
    initOnlineGame,
    restoreOnlineGame,
    applyOnlineTurn,
    applyOnlineGameFinished,
    drawNewCardForOnline,
    removeCardFromHand,
  };
});
