const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const {
  createTable, startNewHand, startNextHand,
  call, check, fold, raise, allIn,
  isBettingRoundOver, advanceStage, runShowdown,
  getNextPlayerIndex
} = require("./game.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {}; 

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getStateForPlayer(table, playerOrder, viewerSocketId) {
  return {
    pot: table.pot,
    currentBet: table.currentBet,
    communityCards: table.communityCards,
    currentPlayerIndex: table.currentPlayerIndex,
    dealerIndex: table.dealerIndex,
    minRaise: table.minRaise,
    players: table.players.map((p, i) => ({
      name: p.name,
      chips: p.chips,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      hand: playerOrder[i] === viewerSocketId ? p.hand : (p.folded ? [] : ['hidden', 'hidden'])
    }))
  };
}

function broadcastTableState(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.table) return;
  room.playerOrder.forEach((socketId) => {
    if (socketId) {
      io.to(socketId).emit('tableState', getStateForPlayer(room.table, room.playerOrder, socketId));
    }
  });
}

function handlePlayerAction(roomCode, playerIndex) {
  const room = rooms[roomCode];
  if (!room) return;
  const table = room.table;

  if (isBettingRoundOver(table)) {
    const stage = advanceStage(table);
    if (stage === 'showdown') {
      const results = runShowdown(table);
      table.handOver = true;
      const revealedHands = table.players
        .filter(p => !p.folded)
        .map(p => ({ name: p.name, hand: p.hand }));
      io.to(roomCode).emit('handResult', { results, revealedHands });
      broadcastTableState(roomCode);
      return;
    }
  } else {
    table.currentPlayerIndex = getNextPlayerIndex(table, playerIndex);
  }

  broadcastTableState(roomCode);
}

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  socket.on('createRoom', (playerName) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      table: null,
      playerOrder: [socket.id],
      names: [playerName]
    };
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    io.to(roomCode).emit('lobbyUpdate', rooms[roomCode].names);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('joinError', 'Room does not exist');
      return;
    }
    if (room.table) {
      socket.emit('joinError', 'Game already in progress');
      return;
    }
    room.playerOrder.push(socket.id);
    room.names.push(playerName);
    socket.join(roomCode);
    socket.emit('roomJoined', roomCode);
    io.to(roomCode).emit('lobbyUpdate', room.names);
  });

  socket.on('startGame', ({ roomCode, smallBlind, bigBlind, startingChips }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.names.length < 2) {
      socket.emit('actionError', 'Need at least 2 players to start');
      return;
    }

    room.table = createTable(room.names, startingChips || 1000);
    startNewHand(room.table, 0, smallBlind || 5, bigBlind || 10);
    room.table.handOver = false;
    broadcastTableState(roomCode);
  });

  socket.on('playerAction', ({ roomCode, type, amount }) => {
    const room = rooms[roomCode];
    if (!room || !room.table) return;
    const table = room.table;

    if (table.handOver) {
      socket.emit('actionError', 'Hand is over — waiting for Next Hand');
      return;
    }

    const playerIndex = room.playerOrder.indexOf(socket.id);
    if (playerIndex !== table.currentPlayerIndex) {
      socket.emit('actionError', 'Not your turn');
      return;
    }

    let success = true;
    if (type === 'call') call(table, playerIndex);
    else if (type === 'check') success = check(table, playerIndex);
    else if (type === 'fold') fold(table, playerIndex);
    else if (type === 'raise') success = raise(table, playerIndex, amount);
    else if (type === 'allIn') allIn(table, playerIndex);
    else {
      socket.emit('actionError', 'Unknown action type');
      return;
    }

    if (!success) {
      socket.emit('actionError', 'Invalid action');
      return;
    }

    handlePlayerAction(roomCode, playerIndex);
  });

  // Inside your io.on('connection', (socket) => { ... }) loop:

socket.on('nextHand', (data) => {
    // Unify payload formatting to handle both raw strings and wrapped objects safely
    const roomCode = typeof data === 'string' ? data : data.roomCode;
    const table = rooms[roomCode] || tables[roomCode]; // Match your server's namespace
    
    if (!table) {
        return socket.emit('actionError', 'Table configuration not found.');
    }

    // 1. Advance the dealer button to the next active player
    let nextDealer = table.dealerIndex;
    const totalPlayers = table.players.length;
    for (let i = 0; i < totalPlayers; i++) {
        nextDealer = (nextDealer + 1) % totalPlayers;
        if (table.players[nextDealer].chips > 0) {
            table.dealerIndex = nextDealer;
            break;
        }
    }

    // 2. Fire the robust hand initializer we built earlier
    startNewHand(table, table.dealerIndex, table.smallBlindAmount, table.bigBlindAmount);

    // 3. CRUCIAL: Broadcast the clean state immediately so the UI resets
    io.to(roomCode).emit('tableState', serializeTableState(table));
});

  // Implemented safe dynamic index removal/cleanup to handle disconnects seamlessly
  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      const index = room.playerOrder.indexOf(socket.id);
      if (index !== -1) {
        if (room.table) {
          room.playerOrder[index] = null;
          room.table.players[index].folded = true;
          room.table.players[index].chips = 0; 
          
          if (room.table.currentPlayerIndex === index) {
            handlePlayerAction(roomCode, index);
          } else {
            broadcastTableState(roomCode);
          }
        } else {
          room.playerOrder.splice(index, 1);
          room.names.splice(index, 1);
          io.to(roomCode).emit('lobbyUpdate', room.names);
        }

        if (room.playerOrder.every(id => id === null || id === undefined)) {
          delete rooms[roomCode];
        }
        break;
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});