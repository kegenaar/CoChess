const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Game state management
let waitingPlayer = null;
const playerRooms = new Map(); // Track which room each player is in

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle joining a game
    socket.on('join_game', () => {
        if (waitingPlayer) {
            // Match found!
            const room = `game_${waitingPlayer.id}_${socket.id}`;
            socket.join(room);
            waitingPlayer.join(room);

            // Track both players' rooms
            playerRooms.set(socket.id, room);
            playerRooms.set(waitingPlayer.id, room);

            // Assign roles
            io.to(waitingPlayer.id).emit('init_game', {
                role: 'A',
                room: room
            });
            io.to(socket.id).emit('init_game', {
                role: 'B',
                room: room
            });

            console.log(`Game started in room ${room}`);
            waitingPlayer = null;
        } else {
            // Wait for ally
            waitingPlayer = socket;
            socket.emit('waiting_for_opponent');
            console.log(`User ${socket.id} is waiting for an ally`);
        }
    });

    // Handle moves
    socket.on('make_move', (data) => {
        // Broadcast move to the other player in the room
        socket.to(data.room).emit('opponent_move', data.move);
    });

    // Handle restart request
    socket.on('request_restart', (data) => {
        io.to(data.room).emit('restart_game');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // If player was waiting, remove them from queue
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }

        // If player was in an active game, notify their opponent
        const room = playerRooms.get(socket.id);
        if (room) {
            console.log(`Notifying room ${room} that player ${socket.id} disconnected`);
            socket.to(room).emit('opponent_disconnected');
            playerRooms.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
