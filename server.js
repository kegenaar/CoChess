const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Game state management
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle joining a game
    socket.on('join_game', () => {
        if (waitingPlayer) {
            // Match found!
            const room = `game_${waitingPlayer.id}_${socket.id}`;
            socket.join(room);
            waitingPlayer.join(room);

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
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        // Ideally, we should notify the ally in the room that the player left
        // For simplicity, we'll leave it as is for now, or maybe emit 'ally_disconnected'
    });
});

const PORT = process.env.PORT || 3001;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
