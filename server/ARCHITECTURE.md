# Sequence Web Server Architecture

## Overview

Сервер для мультиплеерного режима игры Sequence. Обеспечивает:
- Управление сессиями игроков
- Создание и управление комнатами
- Синхронизацию игрового состояния
- Real-time коммуникацию через WebSocket

---

## Tech Stack (рекомендуемый)

- **Runtime:** Node.js 20+
- **Framework:** Express.js или Fastify
- **WebSocket:** ws или socket.io
- **Database:** Redis (для сессий) + PostgreSQL (для статистики)
- **Validation:** Zod или Joi

---

## Data Models

### Player Session

```typescript
interface PlayerSession {
  sessionId: string       // Уникальный ID сессии
  playerId: string        // Уникальный ID игрока
  playerName: string      // Имя игрока
  createdAt: number       // Timestamp создания
  lastActivity: number    // Timestamp последней активности
  currentRoomId?: string  // ID текущей комнаты (если есть)
  currentGameId?: string  // ID текущей игры (если есть)
  wsConnectionId?: string // ID WebSocket соединения
}
```

### Room

```typescript
interface Room {
  id: string
  name: string
  type: '1v1' | '2v2'
  password?: string       // Хэш пароля (bcrypt)
  status: 'waiting' | 'playing' | 'finished'
  hostId: string
  players: RoomPlayer[]
  maxPlayers: number      // 2 для 1v1, 4 для 2v2
  createdAt: number
  gameId?: string         // ID игры (после старта)
}

interface RoomPlayer {
  playerId: string
  playerName: string
  isHost: boolean
  isReady: boolean
  isAI: boolean
  team: 1 | 2
  joinedAt: number
}
```

### Game

```typescript
interface Game {
  id: string
  roomId: string
  deckSeed: number        // Seed для генерации колоды
  status: 'active' | 'finished'
  players: GamePlayer[]
  teams: Team[]
  currentTurnPlayerId: string
  turnHistory: Turn[]
  winnerId?: string
  createdAt: number
  finishedAt?: number
}

interface GamePlayer {
  playerId: string
  playerName: string
  teamColor: TeamColor
  isAI: boolean
  hand: Card[]            // Текущая рука (хранится на сервере)
}

interface Turn {
  playerId: string
  cardIndex: number
  row: number
  col: number
  timestamp: number
}

interface Team {
  color: TeamColor
  playerIds: string[]
}

type TeamColor = 'green' | 'blue' | 'red'
```

### Rematch

```typescript
interface RematchState {
  gameId: string
  active: boolean
  votes: RematchVote[]
  deadline: number        // Timestamp окончания голосования
  requiredVotes: number   // Количество голосов для старта
}

interface RematchVote {
  playerId: string
  vote: boolean           // true = за реванш
  timestamp: number
}
```

---

## Storage Strategy

### Redis (быстрые данные)

- **Sessions:** `session:{sessionId}` → PlayerSession
- **Rooms:** `room:{roomId}` → Room
- **Games:** `game:{gameId}` → Game
- **Player to Room:** `player_room:{playerId}` → roomId
- **Player Name index:** `player_name:{name}` → playerId
- **Room list:** `rooms:list` (sorted set by createdAt)

**TTL:**
- Sessions: 24 часа с обновлением при активности
- Rooms (waiting): 1 час без активности
- Rooms (playing): без TTL
- Games: 1 час после завершения

### PostgreSQL (постоянные данные)

- Статистика игроков (опционально)
- История игр (опционально)
- Аналитика

---

## API Flow

### 1. Подключение к серверу

```
Client                          Server
  |                                |
  |-- GET /ping ------------------>|
  |<-- 200 OK --------------------|
  |                                |
  |-- POST /check-name ----------->|
  |<-- { available: true } --------|
  |                                |
  |-- POST /join ----------------->|
  |<-- { sessionId, playerId } ----|
  |                                |
  |-- WS connect ?sessionId ------>|
  |<-- WS: connected --------------|
```

### 2. Создание/вход в комнату

```
Client                          Server
  |                                |
  |-- GET /rooms ----------------->|
  |<-- { rooms: [...] } -----------|
  |                                |
  |-- POST /rooms ---------------->|  (создание)
  |<-- { room } -------------------|
  |                                |
  |-- WS broadcast --------------->|
  |<-- room_updated (to all) ------|
```

### 3. Игровой процесс

```
Client A                    Server                    Client B
  |                            |                          |
  |-- POST /start ------------>|                          |
  |<-- { gameId } -------------|                          |
  |<-- WS: game_started -------|--- WS: game_started ---->|
  |                            |                          |
  |-- POST /turn ------------->|                          |
  |<-- 200 OK -----------------|                          |
  |<-- WS: turn_made ----------|--- WS: turn_made ------->|
```

---

## Game Logic on Server

### Валидация хода

Сервер должен валидировать каждый ход:

1. Проверить, что сейчас ход этого игрока
2. Проверить, что карта есть в руке игрока
3. Проверить, что ход валиден для этой карты:
   - Обычная карта → клетка совпадает и пустая
   - Two-eyed Jack → любая пустая клетка
   - One-eyed Jack → клетка с фишкой противника (не в последовательности)
4. Выполнить ход и обновить состояние
5. Проверить новые последовательности
6. Проверить условие победы
7. Выдать новую карту из колоды
8. Передать ход следующему игроку

### AI Integration

Если в игре есть AI-игроки, сервер выполняет их ходы:

```typescript
async function processAITurn(game: Game, aiPlayerId: string) {
  const aiPlayer = game.players.find(p => p.playerId === aiPlayerId)
  if (!aiPlayer || !aiPlayer.isAI) return

  // Небольшая задержка для естественности
  await delay(800 + Math.random() * 400)

  // Используем ту же AI логику, что и на клиенте
  const move = makeAIMove(
    'medium', // или настраиваемая сложность
    aiPlayer.hand,
    reconstructBoard(game),
    aiPlayer.teamColor,
    getOpponentColor(game, aiPlayer.teamColor),
    game.turnHistory.filter(t => t.playerId === aiPlayerId).length
  )

  if (move) {
    await executeMove(game, aiPlayerId, move.cardIndex, move.targetRow, move.targetCol)
  }
}
```

---

## Error Handling

### REST API Errors

```typescript
class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message)
  }
}

// Middleware
app.use((err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    })
  }
  // Generic error
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})
```

### WebSocket Errors

```typescript
ws.send(JSON.stringify({
  type: 'error',
  data: {
    code: 'INVALID_MOVE',
    message: 'Невалидный ход'
  },
  timestamp: Date.now()
}))
```

---

## Security

### Authentication

- SessionId генерируется криптографически безопасно
- Валидация sessionId на каждый запрос
- Привязка WebSocket соединения к сессии

### Input Validation

- Валидация всех входных данных через Zod/Joi
- Лимит длины имени: 2-16 символов
- Лимит длины названия комнаты: 3-30 символов
- Фильтрация недопустимых символов

### Rate Limiting

- REST API: 100 req/min на сессию
- WebSocket: 60 messages/min

### Room Password

- Хранение хэша пароля (bcrypt)
- Сравнение при входе

---

## Scaling (future)

Для масштабирования:

1. **Sticky Sessions** — привязка клиента к серверу через load balancer
2. **Redis Pub/Sub** — синхронизация между серверами
3. **Horizontal Scaling** — несколько инстансов сервера

```
                    ┌─────────────┐
                    │ Load Balancer│
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Server 1   │ │  Server 2   │ │  Server 3   │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                    ┌──────▼──────┐
                    │    Redis    │
                    │   Cluster   │
                    └─────────────┘
```

---

## Directory Structure (рекомендуемая)

```
server/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express/Fastify app setup
│   ├── config.ts             # Configuration
│   ├── routes/
│   │   ├── ping.ts
│   │   ├── auth.ts           # join, leave, check-name
│   │   ├── rooms.ts
│   │   └── games.ts
│   ├── ws/
│   │   ├── handler.ts        # WebSocket connection handler
│   │   └── events.ts         # Event handlers
│   ├── services/
│   │   ├── session.ts
│   │   ├── room.ts
│   │   ├── game.ts
│   │   └── ai.ts
│   ├── models/
│   │   └── types.ts
│   ├── storage/
│   │   └── redis.ts
│   ├── game-logic/           # Shared with client
│   │   ├── board.ts
│   │   ├── deck.ts
│   │   ├── sequence.ts
│   │   └── ai.ts
│   └── utils/
│       ├── validation.ts
│       └── errors.ts
├── package.json
├── tsconfig.json
└── .env.example
```
