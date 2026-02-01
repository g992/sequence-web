<script setup lang="ts">
import { computed } from "vue";
import type { BoardCell } from "@/types";
import CardDisplay from "./CardDisplay.vue";

const props = defineProps<{
  cell: BoardCell;
  isPlayable: boolean;
  isHighlighted: boolean;
}>();

const emit = defineEmits<{
  click: [row: number, col: number];
}>();

const chipColors: Record<string, string> = {
  green: "#27ae60",
  blue: "#2980b9",
  red: "#c0392b",
};

const suitSymbols: Record<string, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
};

const suitColors: Record<string, string> = {
  spades: "#1a1a2e",
  hearts: "#c0392b",
  diamonds: "#c0392b",
  clubs: "#1a1a2e",
};

const cardInfo = computed(() => {
  if (props.cell.card === "CORNER") return null;
  const rank = props.cell.card.rank === "T" ? "10" : props.cell.card.rank;
  const suit = suitSymbols[props.cell.card.suit];
  const color = suitColors[props.cell.card.suit];
  return { rank, suit, color };
});

function handleClick() {
  emit("click", props.cell.row, props.cell.col);
}
</script>

<template>
  <div
    :class="[
      'board-cell',
      {
        playable: isPlayable,
        highlighted: isHighlighted,
        'has-chip': cell.chip,
        'part-of-sequence': cell.chip?.partOfSequence,
      },
    ]"
    @click="handleClick"
  >
    <CardDisplay :card="cell.card" size="small" />

    <div
      v-if="cell.chip"
      class="chip"
      :style="{ backgroundColor: chipColors[cell.chip.color] }"
    >
      <span v-if="cell.chip.partOfSequence" class="sequence-mark"
        >&#10003;</span
      >
    </div>

    <!-- Card info in corner when covered by chip -->
    <div
      v-if="cell.chip && cardInfo"
      class="card-info-badge"
      :style="{ color: cardInfo.color }"
    >
      <span class="badge-rank">{{ cardInfo.rank }}</span>
      <span class="badge-suit">{{ cardInfo.suit }}</span>
    </div>

    <div v-if="cell.card === 'CORNER'" class="corner-chip"></div>
  </div>
</template>

<style scoped>
.board-cell {
  position: relative;
  width: var(--cell-size, 36px);
  height: calc(var(--cell-size, 36px) * 1.3);
  cursor: default;
  transition: transform 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.board-cell.playable {
  cursor: pointer;
}

.board-cell.playable::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid #f1c40f;
  border-radius: 3px;
  pointer-events: none;
  animation: pulse 1s ease-in-out infinite;
  z-index: 5;
}

.board-cell.highlighted::before {
  content: "";
  position: absolute;
  inset: -2px;
  border: 2px solid #e74c3c;
  border-radius: 4px;
  pointer-events: none;
  animation: highlight-pulse 1.5s ease-in-out infinite;
  z-index: 4;
}

.board-cell.playable:hover {
  transform: scale(1.05);
  z-index: 10;
}

.board-cell.playable:active {
  transform: scale(0.95);
}

.chip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(var(--cell-size, 36px) * 0.55);
  height: calc(var(--cell-size, 36px) * 0.55);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: chip-appear 0.2s ease-out;
  z-index: 3;
}

.chip .sequence-mark {
  color: white;
  font-size: calc(var(--cell-size, 36px) * 0.35);
  font-weight: bold;
}

.corner-chip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(var(--cell-size, 36px) * 0.55);
  height: calc(var(--cell-size, 36px) * 0.55);
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    #27ae60 0%,
    #27ae60 50%,
    #2980b9 50%,
    #2980b9 100%
  );
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  z-index: 3;
}

.card-info-badge {
  position: absolute;
  top: 1px;
  left: 1px;
  padding: 0 2px;
  font-size: calc(var(--cell-size, 36px) * 0.22);
  font-weight: bold;
  line-height: 1.1;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 4;
}

.badge-rank {
  line-height: 1;
}

.badge-suit {
  line-height: 1;
  font-size: 0.9em;
}

.part-of-sequence .chip {
  box-shadow:
    0 0 8px 2px currentColor,
    0 2px 4px rgba(0, 0, 0, 0.4);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes highlight-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 8px #e74c3c;
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 16px #e74c3c;
  }
}

@keyframes chip-appear {
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}
</style>
