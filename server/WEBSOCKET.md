# Sequence Web WebSocket Protocol

## Overview

WebSocket используется для real-time коммуникации во время игры. Соединение устанавливается после успешной авторизации через REST API.

## Connection

```
wss://{server-address}/ws?sessionId={sessionId}
```

После успешного подключения сервер отправляет событие `connected`.

---

## Message Format

Все сообщения передаются в формате JSON:

```json
{
  "type": "event_type",
  "data": { /* payload */ },
  "timestamp": 1706180000000
}
```

---

## Server Events (Server → Client)

### `connected`

Успешное подключение к WebSocket.

```json
{
  "type": "connected",
  "data": {
    "playerId": "player_xyz789"
  },
  "timestamp": 1706180000000
}
```

### `room_updated`

Обновление состояния комнаты (игроки, статусы).

```json
{
  "type": "room_updated",
  "data": {
    "room": {
      "id": "room_123",
      "name": "Комната",
      "type": "1v1",
      "hasPassword": false,
      "status": "waiting",
      "players": [
        {
          "id": "player_1",
          "name": "Host",
          "isHost": true,
          "isReady": true,
          "isAI": false,
          "team": 1
        },
        {
          "id": "player_2",
          "name": "Guest",
          "isHost": false,
          "isReady": false,
          "isAI": false,
          "team": 2
        }
      ],
      "maxPlayers": 2,
      "hostId": "player_1"
    }
  },
  "timestamp": 1706180000000
}
```

### `player_joined`

Игрок присоединился к комнате.

```json
{
  "type": "player_joined",
  "data": {
    "player": {
      "id": "player_2",
      "name": "NewPlayer",
      "isHost": false,
      "isReady": false,
      "isAI": false,
      "team": 2
    }
  },
  "timestamp": 1706180000000
}
```

### `player_left`

Игрок покинул комнату.

```json
{
  "type": "player_left",
  "data": {
    "playerId": "player_2",
    "reason": "disconnect" | "leave" | "kick",
    "newHostId": "player_3"
  },
  "timestamp": 1706180000000
}
```

### `game_started`

Игра началась.

```json
{
  "type": "game_started",
  "data": {
    "gameId": "game_789",
    "deckSeed": 12345,
    "players": [
      {
        "id": "player_1",
        "name": "Host",
        "teamColor": "green",
        "isAI": false
      },
      {
        "id": "player_2",
        "name": "Guest",
        "teamColor": "blue",
        "isAI": false
      }
    ],
    "teams": [
      { "color": "green", "playerIds": ["player_1"] },
      { "color": "blue", "playerIds": ["player_2"] }
    ],
    "firstPlayerId": "player_1",
    "hands": {
      "player_1": ["AS", "2H", "3D", "4C", "5S", "6H", "7D"]
    }
  },
  "timestamp": 1706180000000
}
```

**Note:** `hands` содержит только карты текущего игрока.

### `game_state`

Полное состояние игры (для реконнекта).

```json
{
  "type": "game_state",
  "data": {
    "gameId": "game_789",
    "deckSeed": 12345,
    "currentTurnPlayerId": "player_1",
    "board": [
      [
        { "card": "CORNER", "chip": null },
        { "card": { "suit": "spades", "rank": "2" }, "chip": { "color": "green", "partOfSequence": false } }
      ]
    ],
    "sequences": [],
    "hands": {
      "player_1": ["AS", "2H", "3D", "4C", "5S", "6H", "7D"]
    },
    "turnHistory": [
      {
        "playerId": "player_2",
        "cardIndex": 3,
        "row": 0,
        "col": 1,
        "timestamp": 1706179500000
      }
    ]
  },
  "timestamp": 1706180000000
}
```

### `turn_made`

Игрок сделал ход.

```json
{
  "type": "turn_made",
  "data": {
    "playerId": "player_1",
    "cardPlayed": { "suit": "hearts", "rank": "K" },
    "row": 5,
    "col": 3,
    "chipPlaced": { "color": "green", "partOfSequence": false },
    "newSequences": [],
    "nextPlayerId": "player_2"
  },
  "timestamp": 1706180000000
}
```

### `game_finished`

Игра завершена.

```json
{
  "type": "game_finished",
  "data": {
    "winnerId": "player_1",
    "winnerName": "Host",
    "winningTeamColor": "green",
    "finalSequences": [
      {
        "teamColor": "green",
        "cells": [
          { "row": 0, "col": 0 },
          { "row": 1, "col": 1 },
          { "row": 2, "col": 2 },
          { "row": 3, "col": 3 },
          { "row": 4, "col": 4 }
        ]
      }
    ]
  },
  "timestamp": 1706180000000
}
```

### `rematch_vote`

Обновление голосования за реванш.

```json
{
  "type": "rematch_vote",
  "data": {
    "rematchState": {
      "active": true,
      "votes": [
        { "playerId": "player_1", "vote": true, "timestamp": 1706180000000 }
      ],
      "deadline": 1706180030000,
      "requiredVotes": 2
    }
  },
  "timestamp": 1706180000000
}
```

### `rematch_started`

Реванш начинается (все проголосовали за).

```json
{
  "type": "rematch_started",
  "data": {
    "newGameId": "game_790"
  },
  "timestamp": 1706180000000
}
```

### `rematch_cancelled`

Реванш отменён (время вышло или игрок отказался).

```json
{
  "type": "rematch_cancelled",
  "data": {
    "reason": "timeout" | "player_declined" | "player_left"
  },
  "timestamp": 1706180000000
}
```

### `error`

Ошибка.

```json
{
  "type": "error",
  "data": {
    "code": "INVALID_TURN",
    "message": "Сейчас не ваш ход"
  },
  "timestamp": 1706180000000
}
```

---

## Client Events (Client → Server)

Клиент обычно использует REST API для действий. WebSocket используется только для:

### `ping`

Поддержание соединения (каждые 30 секунд).

```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong",
  "timestamp": 1706180000000
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Неверный или истёкший sessionId |
| `ROOM_NOT_FOUND` | Комната не найдена |
| `GAME_NOT_FOUND` | Игра не найдена |
| `NOT_YOUR_TURN` | Сейчас не ваш ход |
| `INVALID_MOVE` | Невалидный ход |
| `ALREADY_IN_ROOM` | Уже находитесь в комнате |
| `ROOM_FULL` | Комната заполнена |
| `NOT_HOST` | Действие доступно только хосту |

---

## Connection States

1. **Disconnected** - Нет соединения
2. **Connecting** - Установка соединения
3. **Connected** - Активное соединение
4. **Reconnecting** - Переподключение после разрыва

При разрыве соединения клиент должен:
1. Попытаться переподключиться с тем же `sessionId`
2. При успехе запросить текущее состояние игры через REST API
3. При неудаче показать ошибку и предложить вернуться в меню

---

## Heartbeat

- Клиент отправляет `ping` каждые 30 секунд
- Сервер отвечает `pong`
- Если нет `pong` в течение 10 секунд — переподключение
- Сервер закрывает соединение после 60 секунд без активности
