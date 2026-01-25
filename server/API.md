# Sequence Web Server API

## Overview

REST API для мультиплеерного режима игры Sequence. Все эндпоинты принимают и возвращают JSON.

## Base URL

```
https://{server-address}/api/v1
```

## Authentication

После успешного подключения к серверу клиент получает `sessionId`, который должен передаваться в заголовке:

```
Authorization: Bearer {sessionId}
```

---

## Endpoints

### Server Status

#### `GET /ping`

Проверка доступности сервера.

**Response:**
```json
{
  "success": true,
  "data": {
    "ok": true,
    "serverName": "Sequence Server",
    "version": "1.0.0",
    "timestamp": 1706180000000
  }
}
```

---

### Player Registration

#### `POST /check-name`

Проверка доступности имени игрока.

**Request:**
```json
{
  "name": "PlayerName"
}
```

**Response (available):**
```json
{
  "success": true,
  "data": {
    "available": true
  }
}
```

**Response (not available):**
```json
{
  "success": true,
  "data": {
    "available": false,
    "reason": "Имя уже занято"
  }
}
```

#### `POST /join`

Подключение к серверу с указанным именем.

**Request:**
```json
{
  "name": "PlayerName"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_abc123",
    "playerId": "player_xyz789"
  }
}
```

#### `POST /leave`

Отключение от сервера.

**Response:**
```json
{
  "success": true
}
```

---

### Rooms

#### `GET /rooms`

Получение списка доступных комнат.

**Response:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "room_123",
        "name": "Комната новичков",
        "type": "1v1",
        "hasPassword": false,
        "status": "waiting",
        "players": 1,
        "maxPlayers": 2,
        "hostName": "Player1"
      }
    ]
  }
}
```

#### `POST /rooms`

Создание новой комнаты.

**Request:**
```json
{
  "name": "Моя комната",
  "type": "1v1",
  "password": "optional_password"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Название комнаты (3-30 символов) |
| type | "1v1" \| "2v2" | Yes | Тип игры |
| password | string | No | Пароль (если нужна приватная комната) |

**Response:**
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "room_456",
      "name": "Моя комната",
      "type": "1v1",
      "hasPassword": false,
      "status": "waiting",
      "players": [
        {
          "id": "player_xyz789",
          "name": "PlayerName",
          "isHost": true,
          "isReady": true,
          "isAI": false,
          "team": 1
        }
      ],
      "maxPlayers": 2,
      "hostId": "player_xyz789"
    }
  }
}
```

#### `POST /rooms/{roomId}/join`

Присоединение к существующей комнате.

**Request:**
```json
{
  "password": "optional_if_protected"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "room": { /* Full room object */ }
  }
}
```

**Errors:**
- `400` - Комната заполнена
- `401` - Неверный пароль
- `404` - Комната не найдена

#### `POST /rooms/{roomId}/leave`

Выход из комнаты.

**Response:**
```json
{
  "success": true
}
```

#### `POST /rooms/{roomId}/ready`

Установка статуса готовности.

**Request:**
```json
{
  "ready": true
}
```

**Response:**
```json
{
  "success": true
}
```

#### `POST /rooms/{roomId}/team`

Смена команды (для 2v2).

**Request:**
```json
{
  "team": 1
}
```

**Response:**
```json
{
  "success": true
}
```

---

### Game

#### `POST /rooms/{roomId}/start`

Запуск игры (только для хоста).

**Response:**
```json
{
  "success": true,
  "data": {
    "gameId": "game_789",
    "missingPlayersFilledWithAI": true,
    "aiCount": 1
  }
}
```

#### `POST /games/{gameId}/turn`

Выполнение хода в игре.

**Request:**
```json
{
  "cardIndex": 2,
  "row": 5,
  "col": 3
}
```

**Response:**
```json
{
  "success": true
}
```

#### `POST /games/{gameId}/rematch`

Голосование за реванш.

**Request:**
```json
{
  "vote": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rematchState": {
      "active": true,
      "votes": [
        {
          "playerId": "player_xyz789",
          "vote": true,
          "timestamp": 1706180000000
        }
      ],
      "deadline": 1706180030000,
      "requiredVotes": 2
    }
  }
}
```

#### `POST /games/{gameId}/cancel-rematch`

Отмена голосования и возврат в лобби.

**Response:**
```json
{
  "success": true
}
```

---

## Error Responses

Все ошибки возвращаются в формате:

```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Успешный запрос |
| 400 | Неверный запрос (невалидные данные) |
| 401 | Не авторизован (отсутствует/неверный sessionId) |
| 403 | Доступ запрещён (нет прав на действие) |
| 404 | Ресурс не найден |
| 409 | Конфликт (например, имя занято) |
| 500 | Внутренняя ошибка сервера |

---

## Rate Limiting

- 100 запросов в минуту на сессию
- При превышении: `429 Too Many Requests`
