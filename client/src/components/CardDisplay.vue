<script setup lang="ts">
import type { BoardCard } from "@/types";

const props = defineProps<{
  card: BoardCard;
  size?: "small" | "medium" | "large";
}>();

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

function getRankDisplay(rank: string): string {
  if (rank === "T") return "10";
  return rank;
}
</script>

<template>
  <div v-if="card === 'CORNER'" :class="['card', 'corner', size || 'medium']">
    <span class="corner-star">&#9733;</span>
  </div>
  <div
    v-else
    :class="['card', size || 'medium']"
    :style="{ color: suitColors[card.suit] }"
  >
    <span class="rank">{{ getRankDisplay(card.rank) }}</span>
    <span class="suit">{{ suitSymbols[card.suit] }}</span>
  </div>
</template>

<style scoped>
.card {
  background: #fafafa;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  user-select: none;
}

.card.small {
  width: var(--cell-size, 28px);
  height: calc(var(--cell-size, 28px) * 1.3);
  font-size: calc(var(--cell-size, 28px) * 0.28);
  border-radius: 2px;
}

.card.medium {
  width: 40px;
  height: 52px;
  font-size: 12px;
}

.card.large {
  width: 50px;
  height: 70px;
  font-size: 16px;
}

.corner {
  background: linear-gradient(135deg, #2c3e50, #1a1a2e);
  color: #f1c40f;
}

.corner-star {
  font-size: 1.3em;
}

.rank {
  line-height: 1;
}

.suit {
  line-height: 1;
  font-size: 1.1em;
}

@media (max-width: 480px) {
  .card.large {
    width: 44px;
    height: 62px;
    font-size: 14px;
  }
}
</style>
