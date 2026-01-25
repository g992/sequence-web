<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import BoardCell from './BoardCell.vue'

const game = useGameStore()

const playableCellsSet = computed(() => {
  const set = new Set<string>()
  for (const cell of game.playableCells) {
    set.add(`${cell.row},${cell.col}`)
  }
  return set
})

function isCellPlayable(row: number, col: number): boolean {
  return playableCellsSet.value.has(`${row},${col}`)
}

function isLastOpponentMove(row: number, col: number): boolean {
  if (!game.lastOpponentMove) return false
  return game.lastOpponentMove.row === row && game.lastOpponentMove.col === col
}

function handleCellClick(row: number, col: number) {
  if (isCellPlayable(row, col)) {
    game.playCard(row, col)
  }
}
</script>

<template>
  <div class="game-board-container">
    <div class="game-board">
      <div v-for="(row, rowIndex) in game.board" :key="rowIndex" class="board-row">
        <BoardCell
          v-for="(cell, colIndex) in row"
          :key="colIndex"
          :cell="cell"
          :is-playable="isCellPlayable(rowIndex, colIndex)"
          :is-highlighted="isLastOpponentMove(rowIndex, colIndex)"
          @click="handleCellClick"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-board-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 4px;
}

.game-board {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #2c3e50;
  padding: 4px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

  /* Responsive sizing - fit to container */
  --cell-size: min(
    calc((100vw - 32px) / 10.5),
    calc((100vh - 180px) / 10.5),
    42px
  );
}

.board-row {
  display: flex;
  gap: 1px;
}

@media (max-width: 480px) {
  .game-board {
    padding: 3px;
    border-radius: 4px;
    --cell-size: min(
      calc((100vw - 24px) / 10.5),
      calc((100vh - 160px) / 10.5),
      36px
    );
  }
}

@media (max-height: 600px) {
  .game-board {
    --cell-size: min(
      calc((100vw - 24px) / 10.5),
      calc((100vh - 140px) / 10.5),
      32px
    );
  }
}
</style>
