<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useOnlineStore } from "@/stores/online";
import { useGameStore } from "@/stores/game";
import { getBoardTypeLabel } from "@/data/board";

const router = useRouter();
const online = useOnlineStore();
const game = useGameStore();

// UI state
const isStarting = ref(false);
const showAIWarning = ref(false);
const aiCount = ref(0);

onMounted(() => {
  // Check if in room
  if (!online.currentRoom) {
    router.push("/lobby");
    return;
  }
});

onUnmounted(() => {
  // Cleanup if needed
});

// Watch for game starting (for non-host players)
watch(
  () => game.phase,
  (newPhase) => {
    if (newPhase === "playing" && online.currentGameId) {
      router.push("/game");
    }
  }
);

const room = computed(() => online.currentRoom);

const playersTeam1 = computed(() => {
  if (!room.value) return [];
  return room.value.players.filter((p) => p.team === 1);
});

const playersTeam2 = computed(() => {
  if (!room.value) return [];
  return room.value.players.filter((p) => p.team === 2);
});

const isTeamGame = computed(() => room.value?.type === "2v2");

const allPlayersReady = computed(() => {
  if (!room.value) return false;
  return room.value.players.every((p) => p.isReady);
});

async function handleLeaveRoom() {
  await online.leaveRoom();
  router.push("/lobby");
}

async function toggleReady() {
  if (!online.currentPlayer) return;
  await online.setReady(!online.currentPlayer.isReady);
}

async function handleChangeTeam(team: 1 | 2) {
  await online.changeTeam(team);
}

async function handleStartGame() {
  if (!online.isHost) return;

  // Check if we need to fill with AI
  const missing = online.missingPlayers;

  if (missing > 0) {
    aiCount.value = missing;
    showAIWarning.value = true;
    return;
  }

  await startGameConfirmed();
}

async function startGameConfirmed() {
  showAIWarning.value = false;
  isStarting.value = true;

  const result = await online.startGame();

  if (result.success) {
    // TODO: Initialize game state from server and navigate
    // For now, we'll just navigate to game
    router.push("/game");
  }

  isStarting.value = false;
}

function cancelStart() {
  showAIWarning.value = false;
}

function getPlayerStatusClass(isReady: boolean, isHost: boolean): string {
  if (isHost) return "host";
  return isReady ? "ready" : "not-ready";
}
</script>

<template>
  <div class="room-view">
    <header class="room-header">
      <button
        class="back-btn"
        @click="handleLeaveRoom"
        title="Выйти из комнаты"
      >
        &#8592;
      </button>
      <div class="header-info">
        <h1>{{ room?.name || "Комната" }}</h1>
        <div class="room-info-tags">
          <span class="room-type">{{
            room?.type === "2v2" ? "Команды 2 на 2" : "1 на 1"
          }}</span>
          <span class="room-board-type">{{
            room?.boardType ? getBoardTypeLabel(room.boardType) : ""
          }}</span>
        </div>
      </div>
      <div class="room-status-badge" :class="room?.status">
        {{ room?.status === "waiting" ? "Ожидание" : "В игре" }}
      </div>
    </header>

    <main class="room-content">
      <!-- Error message -->
      <div v-if="online.lastError" class="error-message">
        {{ online.lastError }}
        <button class="error-close" @click="online.clearError">×</button>
      </div>

      <!-- Team display -->
      <div class="teams-container" :class="{ 'single-column': !isTeamGame }">
        <!-- Team 1 / All players for 1v1 -->
        <div class="team-section team-1">
          <h3 v-if="isTeamGame">Команда 1</h3>
          <h3 v-else>Игроки</h3>

          <div class="players-list">
            <div
              v-for="player in isTeamGame ? playersTeam1 : room?.players || []"
              :key="player.id"
              class="player-slot"
              :class="getPlayerStatusClass(player.isReady, player.isHost)"
            >
              <div class="player-info">
                <span class="player-name">
                  {{ player.name }}
                  <span v-if="player.isAI" class="ai-badge">ИИ</span>
                </span>
                <span v-if="player.isHost" class="host-badge">Хост</span>
              </div>
              <div class="player-status">
                <span v-if="player.isReady" class="ready-icon">&#10003;</span>
                <span v-else class="waiting-icon">...</span>
              </div>
            </div>

            <!-- Empty slots -->
            <div
              v-for="i in isTeamGame
                ? Math.max(0, 2 - playersTeam1.length)
                : Math.max(
                    0,
                    (room?.maxPlayers || 2) - (room?.players.length || 0),
                  )"
              :key="'empty-1-' + i"
              class="player-slot empty"
            >
              <span class="empty-text">Ожидание игрока...</span>
            </div>
          </div>

          <!-- Join team button (for 2v2) -->
          <button
            v-if="isTeamGame && online.currentPlayer?.team !== 1"
            class="join-team-btn"
            @click="handleChangeTeam(1)"
          >
            Перейти в команду 1
          </button>
        </div>

        <!-- Team 2 (only for 2v2) -->
        <div v-if="isTeamGame" class="team-section team-2">
          <h3>Команда 2</h3>

          <div class="players-list">
            <div
              v-for="player in playersTeam2"
              :key="player.id"
              class="player-slot"
              :class="getPlayerStatusClass(player.isReady, player.isHost)"
            >
              <div class="player-info">
                <span class="player-name">
                  {{ player.name }}
                  <span v-if="player.isAI" class="ai-badge">ИИ</span>
                </span>
                <span v-if="player.isHost" class="host-badge">Хост</span>
              </div>
              <div class="player-status">
                <span v-if="player.isReady" class="ready-icon">&#10003;</span>
                <span v-else class="waiting-icon">...</span>
              </div>
            </div>

            <!-- Empty slots -->
            <div
              v-for="i in Math.max(0, 2 - playersTeam2.length)"
              :key="'empty-2-' + i"
              class="player-slot empty"
            >
              <span class="empty-text">Ожидание игрока...</span>
            </div>
          </div>

          <!-- Join team button -->
          <button
            v-if="online.currentPlayer?.team !== 2"
            class="join-team-btn"
            @click="handleChangeTeam(2)"
          >
            Перейти в команду 2
          </button>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="room-actions">
        <!-- Ready button (for non-host) -->
        <button
          v-if="!online.isHost"
          class="action-btn ready-btn"
          :class="{ active: online.currentPlayer?.isReady }"
          @click="toggleReady"
        >
          {{ online.currentPlayer?.isReady ? "Не готов" : "Готов" }}
        </button>

        <!-- Start button (for host) -->
        <button
          v-if="online.isHost"
          class="action-btn start-btn"
          :disabled="isStarting"
          @click="handleStartGame"
        >
          {{ isStarting ? "Запуск..." : "Начать игру" }}
        </button>

        <!-- Info about missing players -->
        <p
          v-if="online.isHost && online.missingPlayers > 0"
          class="missing-info"
        >
          Не хватает {{ online.missingPlayers }} игрок(а). При старте они будут
          заменены ИИ.
        </p>
      </div>
    </main>

    <!-- AI Warning Modal -->
    <div v-if="showAIWarning" class="modal-overlay" @click.self="cancelStart">
      <div class="modal-content">
        <h2>Начать с ИИ?</h2>
        <p class="warning-text">
          Не хватает {{ aiCount }} игрок(а). Недостающие места будут заняты ИИ.
        </p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="cancelStart">Отмена</button>
          <button class="confirm-btn" @click="startGameConfirmed">
            Начать
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-view {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a1a2e;
  border-bottom: 1px solid #2c3e50;
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

.header-info {
  flex: 1;
}

.header-info h1 {
  margin: 0;
  font-size: 18px;
  color: #ecf0f1;
}

.room-info-tags {
  display: flex;
  gap: 8px;
  align-items: center;
}

.room-type {
  font-size: 12px;
  color: #7f8c8d;
}

.room-board-type {
  font-size: 11px;
  color: #95a5a6;
  background: #2c3e50;
  padding: 2px 8px;
  border-radius: 4px;
}

.room-status-badge {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: bold;
}

.room-status-badge.waiting {
  background: rgba(39, 174, 96, 0.2);
  color: #27ae60;
}

.room-status-badge.playing {
  background: rgba(241, 196, 15, 0.2);
  color: #f1c40f;
}

.room-content {
  flex: 1;
  padding: 20px 16px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-message {
  background: rgba(231, 76, 60, 0.2);
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
}

.error-close {
  background: none;
  border: none;
  color: #e74c3c;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
}

.teams-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.teams-container.single-column {
  grid-template-columns: 1fr;
}

.team-section {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 16px;
}

.team-section h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #ecf0f1;
}

.team-1 h3 {
  color: #27ae60;
}

.team-2 h3 {
  color: #3498db;
}

.players-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #0f0f1a;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  transition: border-color 0.2s ease;
}

.player-slot.host {
  border-color: #f1c40f;
}

.player-slot.ready {
  border-color: #27ae60;
}

.player-slot.not-ready {
  border-color: #7f8c8d;
}

.player-slot.empty {
  border-style: dashed;
  justify-content: center;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.player-name {
  font-size: 14px;
  font-weight: bold;
  color: #ecf0f1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-badge {
  background: #8e44ad;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
}

.host-badge {
  font-size: 11px;
  color: #f1c40f;
}

.player-status {
  font-size: 18px;
}

.ready-icon {
  color: #27ae60;
}

.waiting-icon {
  color: #7f8c8d;
}

.empty-text {
  color: #7f8c8d;
  font-size: 13px;
}

.join-team-btn {
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  background: #2c3e50;
  border: none;
  border-radius: 8px;
  color: #95a5a6;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.join-team-btn:hover {
  background: #34495e;
  color: #ecf0f1;
}

.room-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 20px;
}

.action-btn {
  width: 100%;
  max-width: 300px;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ready-btn {
  background: #2c3e50;
  color: #95a5a6;
}

.ready-btn:hover {
  background: #34495e;
  color: #ecf0f1;
}

.ready-btn.active {
  background: #27ae60;
  color: white;
}

.ready-btn.active:hover {
  background: #229954;
}

.start-btn {
  background: linear-gradient(135deg, #8e44ad, #9b59b6);
  color: white;
}

.start-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #9b59b6, #a569bd);
}

.start-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.missing-info {
  text-align: center;
  color: #f39c12;
  font-size: 13px;
  margin: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  text-align: center;
}

.modal-content h2 {
  margin: 0 0 16px;
  color: #ecf0f1;
  font-size: 20px;
}

.warning-text {
  color: #f39c12;
  font-size: 14px;
  margin: 0 0 20px;
}

.modal-actions {
  display: flex;
  gap: 10px;
}

.cancel-btn {
  flex: 1;
  padding: 12px;
  background: #2c3e50;
  border: none;
  border-radius: 8px;
  color: #95a5a6;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.cancel-btn:hover {
  background: #34495e;
}

.confirm-btn {
  flex: 1;
  padding: 12px;
  background: #27ae60;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s ease;
}

.confirm-btn:hover {
  background: #2ecc71;
}

@media (max-width: 480px) {
  .teams-container {
    grid-template-columns: 1fr;
  }

  .room-header {
    padding: 10px 12px;
  }

  .header-info h1 {
    font-size: 16px;
  }
}
</style>
