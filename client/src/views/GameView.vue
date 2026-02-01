<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useGameStore } from "@/stores/game";
import { useOnlineStore } from "@/stores/online";
import GameBoard from "@/components/GameBoard.vue";
import PlayerHand from "@/components/PlayerHand.vue";
import GameInfo from "@/components/GameInfo.vue";
import CardDisplay from "@/components/CardDisplay.vue";

const router = useRouter();
const game = useGameStore();
const online = useOnlineStore();

// Rematch state
const rematchTimer = ref<number>(0);
const hasVotedRematch = ref(false);
let rematchInterval: ReturnType<typeof setInterval> | null = null;

// Check if this is an online game
const isOnlineGame = computed(() => online.currentGameId !== null);

// Loading state for online games
const isWaitingForGameState = ref(false);

onMounted(() => {
  // For online games, wait for game state to be initialized via WebSocket
  if (online.currentGameId !== null) {
    if (game.phase === "lobby" || game.players.length === 0) {
      isWaitingForGameState.value = true;

      // Wait for game state to be initialized (max 5 seconds)
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (game.phase === "playing" && game.players.length > 0) {
          isWaitingForGameState.value = false;
          clearInterval(checkInterval);
        } else if (attempts >= 50) {
          // 5 seconds passed, give up and go back to room
          clearInterval(checkInterval);
          router.push("/room");
        }
      }, 100);
    }
  } else {
    // Offline game: redirect to home if not initialized
    if (game.phase === "lobby" && game.players.length === 0) {
      router.push("/");
    }
  }
});

onUnmounted(() => {
  if (rematchInterval) {
    clearInterval(rematchInterval);
  }
});

function handleBackToMenu() {
  if (isOnlineGame.value) {
    online.leaveRoom();
    router.push("/lobby");
  } else {
    game.resetGame();
    router.push("/");
  }
}

function handlePlayAgain() {
  const difficulty = game.aiDifficulty;
  game.resetGame();
  if (difficulty) {
    game.initAIGame(difficulty);
  }
  game.startGame();
}

// Online rematch functions
async function handleVoteRematch() {
  if (!isOnlineGame.value) return;

  hasVotedRematch.value = true;
  await online.voteRematch(true);

  // Start countdown timer
  if (online.rematchState) {
    startRematchTimer(online.rematchState.deadline);
  }
}

async function handleGoToLobby() {
  if (!isOnlineGame.value) {
    game.resetGame();
    router.push("/");
    return;
  }

  await online.cancelRematch();
  router.push("/lobby");
}

function startRematchTimer(deadline: number) {
  if (rematchInterval) {
    clearInterval(rematchInterval);
  }

  const updateTimer = () => {
    const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    rematchTimer.value = remaining;

    if (remaining <= 0) {
      if (rematchInterval) {
        clearInterval(rematchInterval);
        rematchInterval = null;
      }
      // Timer expired, go back to lobby
      handleGoToLobby();
    }
  };

  updateTimer();
  rematchInterval = setInterval(updateTimer, 1000);
}

// Computed
const rematchVoteCount = computed(() => {
  if (!online.rematchState) return 0;
  return online.rematchState.votes.filter((v) => v.vote).length;
});

const rematchRequired = computed(() => {
  return online.rematchState?.requiredVotes || 2;
});

const difficultyLabels: Record<string, string> = {
  easy: "Легкий",
  medium: "Средний",
  hard: "Сложный",
};

const winnerName = computed(() => {
  const winner = game.players.find((p) => p.id === game.winnerId);
  return winner?.name || "";
});
</script>

<template>
  <div class="game-view">
    <!-- Loading state for online games -->
    <div v-if="isWaitingForGameState" class="game-loading">
      <div class="loading-spinner"></div>
      <span>Загрузка игры...</span>
    </div>

    <template v-else>
    <header class="game-header">
      <button class="back-btn" @click="handleBackToMenu" title="Меню">
        &#8592;
      </button>

      <GameInfo />

      <div class="header-right">
        <span v-if="game.aiDifficulty" class="difficulty-badge">
          {{ difficultyLabels[game.aiDifficulty] }}
        </span>
      </div>
    </header>

    <main class="game-main">
      <GameBoard />

      <!-- AI Thinking Indicator -->
      <div v-if="game.isAIThinking" class="ai-thinking">
        <div class="thinking-spinner"></div>
        <span>ИИ думает...</span>
      </div>

      <!-- Winner overlay -->
      <div v-if="game.phase === 'finished'" class="winner-overlay">
        <div class="winner-content">
          <span class="winner-icon">&#127942;</span>
          <span class="winner-text">{{ winnerName }} победил!</span>

          <!-- Offline: simple play again -->
          <button
            v-if="!isOnlineGame"
            class="play-again-btn"
            @click="handlePlayAgain"
          >
            Играть снова
          </button>

          <!-- Online: rematch voting -->
          <div v-else class="rematch-section">
            <!-- Rematch timer and progress -->
            <div
              v-if="hasVotedRematch || online.rematchState?.active"
              class="rematch-status"
            >
              <div class="rematch-votes">
                Голосов: {{ rematchVoteCount }}/{{ rematchRequired }}
              </div>
              <div v-if="rematchTimer > 0" class="rematch-timer">
                {{ rematchTimer }} сек
              </div>
            </div>

            <!-- Action buttons -->
            <div class="winner-actions">
              <button
                v-if="!hasVotedRematch"
                class="rematch-btn"
                @click="handleVoteRematch"
              >
                Реванш
              </button>
              <button v-else class="rematch-btn voted" disabled>
                Ожидание...
              </button>

              <button class="lobby-btn" @click="handleGoToLobby">
                В лобби
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="game-footer">
      <!-- Recent cards fan -->
      <div v-if="game.recentCards.length > 0" class="recent-cards">
        <div
          v-for="(played, index) in game.recentCards"
          :key="played.timestamp"
          class="recent-card"
          :style="{
            '--index': index,
            '--total': game.recentCards.length,
          }"
        >
          <CardDisplay :card="played.card" size="small" />
        </div>
      </div>

      <PlayerHand />
    </footer>
    </template>
  </div>
</template>

<style scoped>
.game-view {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
  overflow: hidden;
}

.game-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #95a5a6;
  font-size: 16px;
}

.game-loading .loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2c3e50;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: #1a1a2e;
  border-bottom: 1px solid #2c3e50;
  flex-shrink: 0;
}

.back-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 1px solid #7f8c8d;
  border-radius: 8px;
  color: #95a5a6;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  border-color: #ecf0f1;
  color: #ecf0f1;
}

.header-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.difficulty-badge {
  background: #2c3e50;
  color: #95a5a6;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
}

.game-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  padding: 8px;
}

.ai-thinking {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(142, 68, 173, 0.95);
  color: white;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  animation: fade-in 0.3s ease;
  z-index: 100;
}

.thinking-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.winner-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  animation: fade-in 0.3s ease;
}

.winner-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: #1a1a2e;
  border-radius: 16px;
  border: 2px solid #f1c40f;
}

.winner-icon {
  font-size: 48px;
}

.winner-text {
  font-size: 20px;
  font-weight: bold;
  color: #f1c40f;
}

.play-again-btn {
  padding: 10px 24px;
  background: #27ae60;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s ease;
}

.play-again-btn:hover {
  background: #2ecc71;
}

/* Online rematch styles */
.rematch-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.rematch-status {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #95a5a6;
  font-size: 14px;
}

.rematch-votes {
  color: #3498db;
}

.rematch-timer {
  background: #2c3e50;
  padding: 4px 10px;
  border-radius: 6px;
  color: #f39c12;
  font-weight: bold;
}

.winner-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.rematch-btn {
  flex: 1;
  padding: 12px 20px;
  background: #8e44ad;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s ease;
}

.rematch-btn:hover:not(:disabled) {
  background: #9b59b6;
}

.rematch-btn.voted {
  background: #2c3e50;
  color: #95a5a6;
  cursor: default;
}

.lobby-btn {
  flex: 1;
  padding: 12px 20px;
  background: #34495e;
  border: none;
  border-radius: 8px;
  color: #ecf0f1;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.lobby-btn:hover {
  background: #3d566e;
}

.game-footer {
  position: relative;
  padding: 0 8px 8px;
  flex-shrink: 0;
}

/* Recent cards fan */
.recent-cards {
  position: absolute;
  left: 12px;
  bottom: calc(100% + 8px);
  display: flex;
  z-index: 50;
}

.recent-card {
  position: relative;
  transform-origin: bottom center;
  transform: rotate(calc((var(--index) - (var(--total) - 1) / 2) * 15deg))
    translateY(calc(var(--index) * -2px));
  margin-left: -16px;
  opacity: 0.7;
  transition: all 0.3s ease;
}

.recent-card:first-child {
  margin-left: 0;
}

.recent-card:last-child {
  opacity: 1;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .game-header {
    padding: 6px 8px;
  }

  .back-btn {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .difficulty-badge {
    font-size: 10px;
    padding: 3px 8px;
  }

  .game-main {
    padding: 4px;
  }
}
</style>
