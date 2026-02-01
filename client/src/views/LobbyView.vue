<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useOnlineStore } from "@/stores/online";
import type { RoomType } from "@/types/online";
import type { BoardType } from "@/types";
import { getBoardTypeLabel, getBoardTypeDescription } from "@/data/board";

const router = useRouter();
const online = useOnlineStore();

// UI state
const showCreateRoom = ref(false);
const newRoomName = ref("");
const newRoomType = ref<RoomType>("1v1");
const newBoardType = ref<BoardType>("classic");
const newRoomPassword = ref("");
const isCreating = ref(false);
const joinPasswordInput = ref("");
const joiningRoomId = ref<string | null>(null);
const showPasswordDialog = ref(false);
const passwordRoomId = ref<string | null>(null);

const boardTypes: BoardType[] = ["classic", "alternative", "advanced"];

// Refresh interval
let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  // Check if authenticated
  if (!online.isAuthenticated) {
    router.push("/");
    return;
  }

  // Load rooms
  await online.loadRooms();

  // Auto-refresh rooms every 5 seconds
  refreshInterval = setInterval(() => {
    online.loadRooms();
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

function handleBackToMenu() {
  online.leaveServer();
  router.push("/");
}

function openCreateRoom() {
  newRoomName.value = `Комната ${online.playerName}`;
  newRoomType.value = "1v1";
  newBoardType.value = "classic";
  newRoomPassword.value = "";
  showCreateRoom.value = true;
}

function closeCreateRoom() {
  showCreateRoom.value = false;
}

async function handleCreateRoom() {
  if (!newRoomName.value.trim()) return;

  isCreating.value = true;

  const success = await online.createRoom(
    newRoomName.value.trim(),
    newRoomType.value,
    newBoardType.value,
    newRoomPassword.value || undefined,
  );

  isCreating.value = false;

  if (success) {
    router.push("/room");
  }
}

async function handleJoinRoom(roomId: string, hasPassword: boolean) {
  if (hasPassword) {
    passwordRoomId.value = roomId;
    joinPasswordInput.value = "";
    showPasswordDialog.value = true;
    return;
  }

  joiningRoomId.value = roomId;
  const success = await online.joinRoom(roomId);
  joiningRoomId.value = null;

  if (success) {
    router.push("/room");
  }
}

async function handleJoinWithPassword() {
  if (!passwordRoomId.value) return;

  joiningRoomId.value = passwordRoomId.value;
  showPasswordDialog.value = false;

  const success = await online.joinRoom(
    passwordRoomId.value,
    joinPasswordInput.value,
  );
  joiningRoomId.value = null;
  passwordRoomId.value = null;

  if (success) {
    router.push("/room");
  }
}

function closePasswordDialog() {
  showPasswordDialog.value = false;
  passwordRoomId.value = null;
  joinPasswordInput.value = "";
}

async function refreshRooms() {
  await online.loadRooms();
}

function getRoomTypeLabel(type: RoomType): string {
  return type === "1v1" ? "1 на 1" : "2 на 2";
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "waiting":
      return "Ожидание";
    case "playing":
      return "В игре";
    case "finished":
      return "Завершена";
    default:
      return status;
  }
}
</script>

<template>
  <div class="lobby">
    <header class="lobby-header">
      <button class="back-btn" @click="handleBackToMenu" title="Выйти">
        &#8592;
      </button>
      <div class="header-info">
        <h1>Лобби</h1>
        <span class="server-name">{{ online.serverName }}</span>
      </div>
      <div class="player-info">
        <span class="player-name">{{ online.playerName }}</span>
      </div>
    </header>

    <main class="lobby-content">
      <!-- Error message -->
      <div v-if="online.lastError" class="error-message">
        {{ online.lastError }}
        <button class="error-close" @click="online.clearError">×</button>
      </div>

      <!-- Room list header -->
      <div class="rooms-header">
        <h2>Комнаты</h2>
        <div class="rooms-actions">
          <button
            class="refresh-btn"
            @click="refreshRooms"
            :disabled="online.isLoadingRooms"
          >
            &#8635;
          </button>
          <button class="create-btn" @click="openCreateRoom">
            + Создать комнату
          </button>
        </div>
      </div>

      <!-- Room list -->
      <div class="rooms-list" :class="{ loading: online.isLoadingRooms }">
        <div
          v-if="online.rooms.length === 0 && !online.isLoadingRooms"
          class="no-rooms"
        >
          Нет доступных комнат. Создайте свою!
        </div>

        <div
          v-for="room in online.rooms"
          :key="room.id"
          class="room-card"
          :class="{ 'in-game': room.status === 'playing' }"
        >
          <div class="room-main">
            <div class="room-name">
              {{ room.name }}
              <span
                v-if="room.hasPassword"
                class="lock-icon"
                title="Защищено паролем"
              >
                &#128274;
              </span>
            </div>
            <div class="room-info">
              <span class="room-type">{{ getRoomTypeLabel(room.type) }}</span>
              <span class="room-board">{{
                getBoardTypeLabel(room.boardType)
              }}</span>
              <span class="room-host">Хост: {{ room.hostName }}</span>
            </div>
          </div>

          <div class="room-status">
            <span class="players-count">
              {{ room.players }}/{{ room.maxPlayers }}
            </span>
            <span class="status-badge" :class="room.status">
              {{ getStatusLabel(room.status) }}
            </span>
          </div>

          <button
            v-if="room.status === 'waiting'"
            class="join-btn"
            :disabled="joiningRoomId === room.id"
            @click="handleJoinRoom(room.id, room.hasPassword)"
          >
            {{ joiningRoomId === room.id ? "..." : "Войти" }}
          </button>
          <span v-else class="join-disabled">В игре</span>
        </div>
      </div>
    </main>

    <!-- Create Room Modal -->
    <div
      v-if="showCreateRoom"
      class="modal-overlay"
      @click.self="closeCreateRoom"
    >
      <div class="modal-content">
        <h2>Создать комнату</h2>

        <div class="form-group">
          <label>Название</label>
          <input
            v-model="newRoomName"
            type="text"
            placeholder="Название комнаты"
            maxlength="30"
          />
        </div>

        <div class="form-group">
          <label>Тип игры</label>
          <div class="type-selector">
            <button
              :class="['type-btn', { active: newRoomType === '1v1' }]"
              @click="newRoomType = '1v1'"
            >
              1 на 1
            </button>
            <button
              :class="['type-btn', { active: newRoomType === '2v2' }]"
              @click="newRoomType = '2v2'"
            >
              2 на 2
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Тип поля</label>
          <div class="board-selector">
            <button
              v-for="boardType in boardTypes"
              :key="boardType"
              :class="[
                'board-type-btn',
                { active: newBoardType === boardType },
              ]"
              @click="newBoardType = boardType"
            >
              <span class="board-type-name">{{
                getBoardTypeLabel(boardType)
              }}</span>
              <span class="board-type-desc">{{
                getBoardTypeDescription(boardType)
              }}</span>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Пароль (необязательно)</label>
          <input
            v-model="newRoomPassword"
            type="password"
            placeholder="Оставьте пустым для открытой комнаты"
          />
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeCreateRoom">Отмена</button>
          <button
            class="confirm-btn"
            :disabled="!newRoomName.trim() || isCreating"
            @click="handleCreateRoom"
          >
            {{ isCreating ? "Создание..." : "Создать" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Password Dialog -->
    <div
      v-if="showPasswordDialog"
      class="modal-overlay"
      @click.self="closePasswordDialog"
    >
      <div class="modal-content modal-small">
        <h2>Введите пароль</h2>

        <div class="form-group">
          <input
            v-model="joinPasswordInput"
            type="password"
            placeholder="Пароль комнаты"
            @keyup.enter="handleJoinWithPassword"
          />
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closePasswordDialog">
            Отмена
          </button>
          <button class="confirm-btn" @click="handleJoinWithPassword">
            Войти
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lobby {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #0f0f1a;
}

.lobby-header {
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
  font-size: 20px;
  color: #f1c40f;
}

.server-name {
  font-size: 12px;
  color: #7f8c8d;
}

.player-info {
  background: #2c3e50;
  padding: 6px 12px;
  border-radius: 8px;
}

.player-name {
  color: #27ae60;
  font-weight: bold;
  font-size: 14px;
}

.lobby-content {
  flex: 1;
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.error-message {
  background: rgba(231, 76, 60, 0.2);
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
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

.rooms-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.rooms-header h2 {
  margin: 0;
  font-size: 18px;
  color: #ecf0f1;
}

.rooms-actions {
  display: flex;
  gap: 8px;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: #2c3e50;
  border: none;
  border-radius: 8px;
  color: #95a5a6;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: #34495e;
  color: #ecf0f1;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-btn {
  padding: 8px 16px;
  background: #27ae60;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s ease;
}

.create-btn:hover {
  background: #2ecc71;
}

.rooms-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rooms-list.loading {
  opacity: 0.6;
  pointer-events: none;
}

.no-rooms {
  text-align: center;
  color: #7f8c8d;
  padding: 40px 20px;
  background: #1a1a2e;
  border-radius: 12px;
}

.room-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #1a1a2e;
  border: 1px solid #2c3e50;
  border-radius: 12px;
  transition: border-color 0.2s ease;
}

.room-card:hover {
  border-color: #3498db;
}

.room-card.in-game {
  opacity: 0.7;
}

.room-main {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-size: 16px;
  font-weight: bold;
  color: #ecf0f1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.lock-icon {
  font-size: 12px;
  color: #f39c12;
}

.room-info {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: #7f8c8d;
}

.room-type {
  background: #2c3e50;
  padding: 2px 8px;
  border-radius: 4px;
}

.room-board {
  background: #34495e;
  padding: 2px 8px;
  border-radius: 4px;
  color: #95a5a6;
}

.room-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.players-count {
  font-size: 14px;
  color: #95a5a6;
  font-weight: bold;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-badge.waiting {
  background: rgba(39, 174, 96, 0.2);
  color: #27ae60;
}

.status-badge.playing {
  background: rgba(241, 196, 15, 0.2);
  color: #f1c40f;
}

.join-btn {
  padding: 8px 16px;
  background: #3498db;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background 0.2s ease;
  min-width: 70px;
}

.join-btn:hover:not(:disabled) {
  background: #2980b9;
}

.join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.join-disabled {
  color: #7f8c8d;
  font-size: 12px;
  min-width: 70px;
  text-align: center;
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
  max-width: 400px;
}

.modal-content.modal-small {
  max-width: 320px;
}

.modal-content h2 {
  margin: 0 0 20px;
  color: #ecf0f1;
  font-size: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #95a5a6;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  background: #0f0f1a;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  color: #ecf0f1;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #3498db;
}

.type-selector {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 10px;
  background: #0f0f1a;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  color: #95a5a6;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.type-btn:hover {
  border-color: #3498db;
}

.type-btn.active {
  background: #3498db;
  border-color: #3498db;
  color: white;
}

.board-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board-type-btn {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  background: #0f0f1a;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.board-type-btn:hover {
  border-color: #3498db;
}

.board-type-btn.active {
  background: rgba(52, 152, 219, 0.15);
  border-color: #3498db;
}

.board-type-name {
  color: #ecf0f1;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 2px;
}

.board-type-desc {
  color: #7f8c8d;
  font-size: 11px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
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

.confirm-btn:hover:not(:disabled) {
  background: #2ecc71;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .lobby-header {
    padding: 10px 12px;
  }

  .header-info h1 {
    font-size: 18px;
  }

  .room-card {
    flex-wrap: wrap;
  }

  .room-status {
    flex-direction: row;
    gap: 8px;
  }

  .join-btn,
  .join-disabled {
    width: 100%;
    margin-top: 8px;
  }
}
</style>
