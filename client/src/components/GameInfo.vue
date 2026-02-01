<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import { countSequences } from "@/data/sequence";
import type { TeamColor } from "@/types";

const game = useGameStore();

const teamColors: Record<string, string> = {
  green: "#27ae60",
  blue: "#2980b9",
  red: "#c0392b",
};

const colorNames: Record<string, string> = {
  green: "Зелёный",
  blue: "Синий",
  red: "Красный",
};

const availableColors: TeamColor[] = ["green", "blue", "red"];

const teamScores = computed(() => {
  return game.teams.map((team) => ({
    color: team.color,
    sequences: countSequences(game.sequences, team.color),
    isPlayer: team.playerIds.includes(game.localPlayerId),
    isActive: game.currentPlayer?.teamColor === team.color,
  }));
});

function cyclePlayerColor() {
  const player = game.localPlayer;
  if (!player) return;

  const opponentColor = game.players.find((p) => p.id !== player.id)?.teamColor;
  const currentIndex = availableColors.indexOf(player.teamColor);

  // Find next available color (not opponent's)
  for (let i = 1; i <= availableColors.length; i++) {
    const nextColor =
      availableColors[(currentIndex + i) % availableColors.length];
    if (nextColor && nextColor !== opponentColor) {
      game.changePlayerColor(nextColor);
      break;
    }
  }
}
</script>

<template>
  <div class="game-info">
    <div
      v-for="team in teamScores"
      :key="team.color"
      :class="[
        'team-chip',
        { active: team.isActive, clickable: team.isPlayer },
      ]"
      :style="{ '--team-color': teamColors[team.color] }"
      @click="team.isPlayer ? cyclePlayerColor() : null"
    >
      <span class="team-dot"></span>
      <span class="team-score">{{ team.sequences }}/2</span>
      <span v-if="team.isPlayer" class="you-badge">вы</span>
    </div>

    <div
      v-if="game.isMyTurn && game.phase === 'playing'"
      class="turn-indicator"
    >
      Ваш ход
    </div>
  </div>
</template>

<style scoped>
.game-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.team-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #1a1a2e;
  padding: 6px 10px;
  border-radius: 16px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

.team-chip.active {
  border-color: var(--team-color);
  box-shadow: 0 0 8px var(--team-color);
}

.team-chip.clickable {
  cursor: pointer;
}

.team-chip.clickable:hover {
  background: #252542;
}

.team-chip.clickable:active {
  transform: scale(0.95);
}

.team-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--team-color);
}

.team-score {
  color: #ecf0f1;
  font-size: 13px;
  font-weight: bold;
}

.you-badge {
  position: absolute;
  top: -6px;
  right: -4px;
  background: #8e44ad;
  color: white;
  font-size: 8px;
  padding: 2px 4px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: bold;
}

.turn-indicator {
  background: #27ae60;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 4px rgba(39, 174, 96, 0.5);
  }
  50% {
    box-shadow: 0 0 12px rgba(39, 174, 96, 0.8);
  }
}

@media (max-width: 480px) {
  .team-chip {
    padding: 4px 8px;
  }

  .team-dot {
    width: 10px;
    height: 10px;
  }

  .team-score {
    font-size: 12px;
  }

  .turn-indicator {
    font-size: 10px;
    padding: 3px 8px;
  }
}
</style>
