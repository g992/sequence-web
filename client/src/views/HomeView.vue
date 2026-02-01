<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useGameStore } from "@/stores/game";
import { useOnlineStore } from "@/stores/online";
import type { AIDifficulty } from "@/data/ai";
import type { BoardType } from "@/types";
import { getBoardTypeLabel, getBoardTypeDescription } from "@/data/board";

const router = useRouter();
const game = useGameStore();
const online = useOnlineStore();

const showDifficultySelect = ref(false);
const showBoardTypeSelect = ref(false);
const selectedDifficulty = ref<AIDifficulty | null>(null);
const selectedBoardType = ref<BoardType>("classic");
const hasSaved = ref(false);

// Online state
const serverAddress = ref("");
const playerNameInput = ref("");
const isCheckingServer = ref(false);
const isCheckingName = ref(false);
const isJoiningServer = ref(false);
const nameError = ref<string | null>(null);
const isAutoRestoring = ref(false);

// Server status
const serverChecked = computed(() => online.connectionStatus === "connected");
const serverError = computed(() => online.connectionStatus === "error");

onMounted(async () => {
  hasSaved.value = game.hasSavedGame();
  online.initFromStorage();

  // Restore server address if previously saved
  if (online.serverUrl) {
    serverAddress.value = online.serverUrl;
  }

  // Restore player name if previously saved
  if (online.playerName) {
    playerNameInput.value = online.playerName;
  }

  // Auto-restore session if we have saved credentials
  if (online.serverUrl && online.sessionId && online.playerName) {
    isAutoRestoring.value = true;

    // Try to ping server
    const pingSuccess = await online.pingServer(online.serverUrl);

    if (pingSuccess) {
      // Server is available, try to connect WebSocket and go to lobby
      online.isAuthenticated = true;

      // Connect WebSocket
      await new Promise<void>((resolve) => {
        const wsUrl = online.serverUrl;
        const wsSessionId = online.sessionId;
        if (wsUrl && wsSessionId) {
          import("@/services/websocket").then(({ wsService }) => {
            wsService.connect(wsUrl, wsSessionId);
            resolve();
          });
        } else {
          resolve();
        }
      });

      // Navigate to lobby
      router.push("/lobby");
    }

    isAutoRestoring.value = false;
  }
});

function openDifficultySelect() {
  showDifficultySelect.value = true;
  showBoardTypeSelect.value = false;
  selectedDifficulty.value = null;
}

function selectDifficulty(difficulty: AIDifficulty) {
  selectedDifficulty.value = difficulty;
  showDifficultySelect.value = false;
  showBoardTypeSelect.value = true;
  selectedBoardType.value = "classic";
}

function startAIGame() {
  if (!selectedDifficulty.value) return;
  game.initAIGame(selectedDifficulty.value, selectedBoardType.value);
  game.startGame();
  router.push("/game");
}

function continueGame() {
  if (game.loadGame()) {
    router.push("/game");
  }
}

function cancelDifficultySelect() {
  showDifficultySelect.value = false;
}

function cancelBoardTypeSelect() {
  showBoardTypeSelect.value = false;
  showDifficultySelect.value = true;
}

function backToMenu() {
  showDifficultySelect.value = false;
  showBoardTypeSelect.value = false;
  selectedDifficulty.value = null;
}

// Online functions
async function checkServer() {
  if (!serverAddress.value.trim()) return;

  isCheckingServer.value = true;
  online.clearError();

  let url = serverAddress.value.trim();
  // Add protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // Remove trailing slash
  url = url.replace(/\/$/, "");

  await online.pingServer(url);
  isCheckingServer.value = false;
}

async function checkName() {
  if (!playerNameInput.value.trim()) {
    nameError.value = "Введите имя";
    return;
  }

  if (playerNameInput.value.trim().length < 2) {
    nameError.value = "Минимум 2 символа";
    return;
  }

  if (playerNameInput.value.trim().length > 16) {
    nameError.value = "Максимум 16 символов";
    return;
  }

  isCheckingName.value = true;
  nameError.value = null;

  const result = await online.checkNameAvailable(playerNameInput.value.trim());

  isCheckingName.value = false;

  if (!result.available) {
    nameError.value = result.reason || "Имя недоступно";
  }
}

async function handlePlayOnline() {
  if (!playerNameInput.value.trim() || nameError.value) return;

  isJoiningServer.value = true;

  const success = await online.joinServerWithName(playerNameInput.value.trim());

  isJoiningServer.value = false;

  if (success) {
    router.push("/lobby");
  }
}

function disconnectServer() {
  online.disconnect();
  serverAddress.value = "";
  playerNameInput.value = "";
  nameError.value = null;
}

const difficulties: Array<{ id: AIDifficulty; name: string; desc: string }> = [
  {
    id: "easy",
    name: "Легкий",
    desc: "ИИ играет случайно, иногда строит последовательности",
  },
  {
    id: "medium",
    name: "Средний",
    desc: "ИИ всегда старается продолжить свои последовательности",
  },
  {
    id: "hard",
    name: "Сложный",
    desc: "ИИ строит последовательности и блокирует ваши",
  },
];

const boardTypes: BoardType[] = ["classic", "alternative", "advanced"];
</script>

<template>
  <div class="home">
    <div class="logo">
      <h1>Sequence</h1>
      <p class="subtitle">Настольная игра</p>
    </div>

    <!-- Auto-restore loading -->
    <div v-if="isAutoRestoring" class="auto-restore">
      <div class="loading-spinner"></div>
      <span>Восстановление сессии...</span>
    </div>

    <!-- Main Menu -->
    <div v-if="!showDifficultySelect && !showBoardTypeSelect && !isAutoRestoring" class="menu">
      <button class="menu-btn primary" @click="openDifficultySelect">
        <span class="btn-icon">&#129302;</span>
        <span class="btn-text">
          <span class="btn-title">Играть с ИИ</span>
          <span class="btn-desc">Оффлайн игра с компьютером</span>
        </span>
      </button>

      <button v-if="hasSaved" class="menu-btn continue" @click="continueGame">
        <span class="btn-icon">&#9654;</span>
        <span class="btn-text">
          <span class="btn-title">Продолжить</span>
          <span class="btn-desc">Вернуться к сохранённой игре</span>
        </span>
      </button>

      <!-- Online Section -->
      <div class="online-section">
        <h3 class="section-title">Онлайн игра</h3>

        <!-- Server connection -->
        <div class="server-input-group">
          <input
            v-model="serverAddress"
            type="text"
            placeholder="Адрес сервера (example.com)"
            class="server-input"
            :disabled="serverChecked"
            @keyup.enter="checkServer"
          />
          <button
            v-if="!serverChecked"
            class="check-btn"
            :disabled="!serverAddress.trim() || isCheckingServer"
            @click="checkServer"
          >
            {{ isCheckingServer ? "..." : "Проверить" }}
          </button>
          <button v-else class="disconnect-btn" @click="disconnectServer">
            &#10005;
          </button>
        </div>

        <!-- Server status -->
        <div v-if="serverChecked" class="server-status connected">
          <span class="status-icon">&#10003;</span>
          <span class="status-text"
            >{{ online.serverName }} (v{{ online.serverVersion }})</span
          >
        </div>
        <div v-else-if="serverError" class="server-status error">
          <span class="status-icon">&#10007;</span>
          <span class="status-text">{{
            online.lastError || "Сервер недоступен"
          }}</span>
        </div>

        <!-- Player name input (shown after server connected) -->
        <div v-if="serverChecked" class="name-input-group">
          <input
            v-model="playerNameInput"
            type="text"
            placeholder="Ваше имя"
            class="name-input"
            maxlength="16"
            @blur="checkName"
            @keyup.enter="handlePlayOnline"
          />
          <span v-if="nameError" class="name-error">{{ nameError }}</span>
        </div>

        <!-- Play online button -->
        <button
          v-if="serverChecked"
          class="menu-btn online"
          :disabled="!playerNameInput.trim() || !!nameError || isJoiningServer"
          @click="handlePlayOnline"
        >
          <span class="btn-icon">&#127760;</span>
          <span class="btn-text">
            <span class="btn-title">{{
              isJoiningServer ? "Подключение..." : "Играть онлайн"
            }}</span>
            <span class="btn-desc">Присоединиться к серверу</span>
          </span>
        </button>
      </div>
    </div>

    <!-- Difficulty Selection -->
    <div v-else-if="showDifficultySelect" class="difficulty-select">
      <h2>Выберите сложность</h2>

      <div class="difficulty-options">
        <button
          v-for="diff in difficulties"
          :key="diff.id"
          :class="['difficulty-btn', diff.id]"
          @click="selectDifficulty(diff.id)"
        >
          <span class="diff-name">{{ diff.name }}</span>
          <span class="diff-desc">{{ diff.desc }}</span>
        </button>
      </div>

      <button class="back-link" @click="cancelDifficultySelect">
        &#8592; Назад
      </button>
    </div>

    <!-- Board Type Selection -->
    <div v-else-if="showBoardTypeSelect" class="board-select">
      <h2>Выберите тип поля</h2>

      <div class="board-options">
        <button
          v-for="boardType in boardTypes"
          :key="boardType"
          :class="['board-btn', { active: selectedBoardType === boardType }]"
          @click="selectedBoardType = boardType"
        >
          <span class="board-name">{{ getBoardTypeLabel(boardType) }}</span>
          <span class="board-desc">{{
            getBoardTypeDescription(boardType)
          }}</span>
        </button>
      </div>

      <div class="board-actions">
        <button class="back-link" @click="cancelBoardTypeSelect">
          &#8592; Назад
        </button>
        <button class="start-btn" @click="startAIGame">Начать игру</button>
      </div>
    </div>

    <div v-if="!isAutoRestoring" class="rules">
      <h3>Как играть</h3>
      <ul>
        <li>
          Сыграйте карту, чтобы поставить фишку на соответствующую позицию
        </li>
        <li>
          Соберите 5 фишек в ряд (по горизонтали, вертикали или диагонали)
        </li>
        <li>Угловые клетки — универсальные, считаются для всех</li>
        <li>Двуглазые валеты (&#9830; &#9827;) — ставьте фишку куда угодно</li>
        <li>Одноглазые валеты (&#9824; &#9829;) — уберите фишку противника</li>
        <li>Соберите 2 последовательности для победы!</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  gap: 24px;
}

.logo {
  text-align: center;
}

.logo h1 {
  font-size: 40px;
  color: #f1c40f;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.subtitle {
  color: #95a5a6;
  margin: 4px 0 0;
  font-size: 16px;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 300px;
}

.menu-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #1a1a2e;
  border: 2px solid #2c3e50;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
}

.menu-btn:hover {
  border-color: #f1c40f;
  transform: translateX(4px);
}

.menu-btn:active {
  transform: scale(0.98);
}

.menu-btn.primary {
  background: linear-gradient(135deg, #8e44ad, #9b59b6);
  border-color: #8e44ad;
}

.menu-btn.primary:hover {
  border-color: #a569bd;
}

.menu-btn.continue {
  background: linear-gradient(135deg, #27ae60, #229954);
  border-color: #27ae60;
}

.menu-btn.continue:hover {
  border-color: #2ecc71;
}

.menu-btn.online {
  background: linear-gradient(135deg, #2980b9, #3498db);
  border-color: #2980b9;
}

.menu-btn.online:hover:not(:disabled) {
  border-color: #5dade2;
}

.menu-btn.online:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 24px;
  width: 32px;
  text-align: center;
  flex-shrink: 0;
}

.btn-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.btn-title {
  color: #ecf0f1;
  font-size: 15px;
  font-weight: bold;
}

.btn-desc {
  color: rgba(236, 240, 241, 0.7);
  font-size: 11px;
}

/* Difficulty Selection */
.difficulty-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}

.difficulty-select h2 {
  color: #ecf0f1;
  margin: 0;
  font-size: 20px;
}

.difficulty-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.difficulty-btn {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  background: #1a1a2e;
  border: 2px solid #2c3e50;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.difficulty-btn:hover {
  transform: translateX(4px);
}

.difficulty-btn:active {
  transform: scale(0.98);
}

.difficulty-btn.easy {
  border-left: 4px solid #27ae60;
}

.difficulty-btn.easy:hover {
  border-color: #27ae60;
}

.difficulty-btn.medium {
  border-left: 4px solid #f39c12;
}

.difficulty-btn.medium:hover {
  border-color: #f39c12;
}

.difficulty-btn.hard {
  border-left: 4px solid #e74c3c;
}

.difficulty-btn.hard:hover {
  border-color: #e74c3c;
}

.diff-name {
  color: #ecf0f1;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 2px;
}

.diff-desc {
  color: #95a5a6;
  font-size: 12px;
}

.back-link {
  background: transparent;
  border: none;
  color: #7f8c8d;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 16px;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: #ecf0f1;
}

/* Board Type Selection */
.board-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}

.board-select h2 {
  color: #ecf0f1;
  margin: 0;
  font-size: 20px;
}

.board-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.board-btn {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  background: #1a1a2e;
  border: 2px solid #2c3e50;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.board-btn:hover {
  border-color: #3498db;
  transform: translateX(4px);
}

.board-btn.active {
  border-color: #f1c40f;
  background: rgba(241, 196, 15, 0.1);
}

.board-btn:active {
  transform: scale(0.98);
}

.board-name {
  color: #ecf0f1;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 2px;
}

.board-desc {
  color: #95a5a6;
  font-size: 12px;
}

.board-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
}

.start-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #27ae60, #229954);
  border: 2px solid #27ae60;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s ease;
}

.start-btn:hover {
  border-color: #2ecc71;
  transform: translateX(4px);
}

.start-btn:active {
  transform: scale(0.98);
}

/* Online Section */
.online-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #2c3e50;
  width: 100%;
}

.section-title {
  color: #7f8c8d;
  font-size: 12px;
  font-weight: normal;
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.server-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.server-input {
  flex: 1;
  padding: 10px 12px;
  background: #1a1a2e;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  color: #ecf0f1;
  font-size: 14px;
}

.server-input:focus {
  outline: none;
  border-color: #3498db;
}

.server-input:disabled {
  background: #0f0f1a;
  color: #7f8c8d;
}

.check-btn {
  padding: 10px 16px;
  background: #3498db;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
  white-space: nowrap;
}

.check-btn:hover:not(:disabled) {
  background: #2980b9;
}

.check-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.disconnect-btn {
  width: 40px;
  padding: 0;
  background: #e74c3c;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease;
}

.disconnect-btn:hover {
  background: #c0392b;
}

.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.server-status.connected {
  background: rgba(39, 174, 96, 0.15);
  color: #27ae60;
}

.server-status.error {
  background: rgba(231, 76, 60, 0.15);
  color: #e74c3c;
}

.status-icon {
  font-size: 14px;
}

.name-input-group {
  margin-bottom: 12px;
}

.name-input {
  width: 100%;
  padding: 10px 12px;
  background: #1a1a2e;
  border: 1px solid #2c3e50;
  border-radius: 8px;
  color: #ecf0f1;
  font-size: 14px;
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: #3498db;
}

.name-error {
  display: block;
  color: #e74c3c;
  font-size: 12px;
  margin-top: 4px;
}

/* Auto-restore loading */
.auto-restore {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #95a5a6;
  font-size: 14px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #2c3e50;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.rules {
  max-width: 340px;
  background: #1a1a2e;
  padding: 16px;
  border-radius: 12px;
}

.rules h3 {
  color: #ecf0f1;
  margin: 0 0 10px;
  font-size: 14px;
}

.rules ul {
  margin: 0;
  padding-left: 18px;
  color: #95a5a6;
  font-size: 12px;
  line-height: 1.5;
}

.rules li {
  margin-bottom: 3px;
}

@media (max-width: 380px) {
  .logo h1 {
    font-size: 32px;
  }

  .rules {
    padding: 12px;
  }

  .rules ul {
    font-size: 11px;
  }
}
</style>
