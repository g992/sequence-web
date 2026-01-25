<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { isDeadCard } from '@/data/board'
import CardDisplay from './CardDisplay.vue'

const game = useGameStore()

function isCardDead(index: number): boolean {
  const card = game.localHand[index]
  if (!card || card.rank === 'J') return false
  return isDeadCard(game.board, card)
}

function handleCardClick(index: number) {
  if (game.isMyTurn) {
    game.selectCard(index)
  }
}

function handleDoubleClick(index: number) {
  if (game.isMyTurn && isCardDead(index)) {
    game.discardDeadCard(index)
  }
}

function isNewCard(index: number): boolean {
  const card = game.localHand[index]
  const animCard = game.newCardAnimation
  if (!card || !animCard) return false
  return card.suit === animCard.suit && card.rank === animCard.rank
}
</script>

<template>
  <div class="player-hand">
    <div class="cards">
      <div
        v-for="(card, index) in game.localHand"
        :key="`${card.suit}-${card.rank}-${index}`"
        :class="[
          'hand-card',
          {
            selected: game.selectedCardIndex === index,
            dead: isCardDead(index),
            disabled: !game.isMyTurn,
            'new-card': isNewCard(index),
          },
        ]"
        :style="{ '--card-index': index }"
        @click="handleCardClick(index)"
        @dblclick="handleDoubleClick(index)"
      >
        <CardDisplay :card="card" size="large" />
        <span v-if="isCardDead(index)" class="dead-badge" title="Двойной клик для сброса">X</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-hand {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.cards {
  display: flex;
  gap: 6px;
  padding: 8px 4px;
}

.hand-card {
  position: relative;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;
  transform-origin: bottom center;
}

.hand-card:hover:not(.disabled) {
  transform: translateY(-12px) scale(1.05);
  z-index: 10;
}

.hand-card.selected {
  transform: translateY(-20px) scale(1.08);
  z-index: 20;
}

.hand-card.selected::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 3px solid #f1c40f;
  border-radius: 6px;
  pointer-events: none;
  box-shadow: 0 0 12px rgba(241, 196, 15, 0.6);
}

.hand-card.dead {
  opacity: 0.5;
}

.hand-card.disabled {
  cursor: not-allowed;
}

.hand-card.disabled:not(.selected) {
  opacity: 0.8;
}

.dead-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  background: #e74c3c;
  color: white;
  font-size: 10px;
  font-weight: bold;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

/* New card arrival animation */
.hand-card.new-card {
  animation: card-arrive 0.4s ease-out;
}

@keyframes card-arrive {
  0% {
    transform: translateY(-60px) scale(0.8);
    opacity: 0;
  }
  50% {
    transform: translateY(10px) scale(1.05);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .player-hand {
    padding: 4px 0;
  }

  .cards {
    gap: 4px;
    padding: 6px 2px;
  }

  .hand-card:hover:not(.disabled) {
    transform: translateY(-8px) scale(1.03);
  }

  .hand-card.selected {
    transform: translateY(-14px) scale(1.05);
  }
}
</style>
