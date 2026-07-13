# ♠ Multiplayer Texas Hold'em Poker

A real-time multiplayer Texas Hold'em poker game built with Node.js, Express, and Socket.IO.

Players can create private rooms, join with a room code, and play complete Texas Hold'em hands with betting, side pots, and hand evaluation handled entirely on the server.

---

## Features

### Multiplayer
- Private game rooms
- Room codes for joining friends
- Real-time synchronization using Socket.IO

### Poker Engine
- Complete 52-card deck
- Fisher-Yates shuffle
- Blind posting
- Dealer rotation
- Turn management
- Check
- Call
- Raise
- Fold
- All-In
- Side pot calculation
- Multiple betting rounds
- Automatic showdown

### Hand Evaluation

Supports all standard poker hands:

- High Card
- One Pair
- Two Pair
- Three of a Kind
- Straight
- Flush
- Full House
- Four of a Kind
- Straight Flush

The engine evaluates every possible 5-card combination from the player's 7 available cards and determines the strongest hand.

---

## Tech Stack

### Backend

- Node.js
- Express
- Socket.IO

### Frontend

- HTML
- CSS
- Vanilla JavaScript

---

## Project Structure

```text
poker-app/
│
├── public/
│   └── index.html
│
├── game.js
├── server.js
├── package.json
├── package-lock.json
└── .gitignore
```

---

## Installation

Clone the repository.

```bash
git clone https://github.com/chiralC/poker-app.git
```

Install dependencies.

```bash
npm install
```

Start the server.

```bash
node server.js
```

Open your browser and visit

```
http://localhost:3000
```

---

## Current Status

### Implemented

- Multiplayer rooms
- Real-time gameplay
- Betting system
- Dealer rotation
- Side pots
- Hand evaluation
- Showdown
- Winner calculation

### Planned

- Improved UI 
- Better card animations
- Chip animations
- Sound effects
- Player avatars
- Responsive layout
- Chat system
- Spectator mode
- Reconnect support
- Hand history
- Statistics

---

## Screenshots

Coming soon.

---

## Future Improvements

- Tournament mode
- AI bots
- Authentication
- Persistent player profiles
- Match history database
- Leaderboards
- Replay system

---

## License

This project is currently intended for educational and personal use.

---

## Author

Built by **Chiral C**.