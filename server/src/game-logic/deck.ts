import type { Card, Suit, Rank } from '../types.js'

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']

// Seeded random number generator (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Create a full deck (2 standard decks = 104 cards)
function createFullDeck(): Card[] {
  const deck: Card[] = []

  // Two decks
  for (let i = 0; i < 2; i++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank })
      }
    }
  }

  return deck
}

// Shuffle deck using seed
export function createShuffledDeck(seed: number): Card[] {
  const deck = createFullDeck()
  const rng = mulberry32(seed)

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = deck[i]!
    deck[i] = deck[j]!
    deck[j] = temp
  }

  return deck
}

// Draw cards from deck
export function drawCards(deck: Card[], cursor: number, count: number): Card[] {
  return deck.slice(cursor, cursor + count)
}

// Cards per player based on game mode
export function getHandSize(playerCount: number): number {
  if (playerCount === 2) return 7
  if (playerCount === 3) return 6
  return 6 // 4 players
}

// Generate random seed
export function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647)
}
