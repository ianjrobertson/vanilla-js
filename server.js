// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {}; // { roomCode: [socket1, socket2] }

io.on('connection', socket => {
  socket.on('join', roomID => {
    socket.join(roomID);
    if (!rooms[roomID]) rooms[roomID] = [];
    rooms[roomID].push(socket.id);

    const otherUser = rooms[roomID].find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('other-user', otherUser);
      socket.to(otherUser).emit('user-joined', socket.id);
    }

    socket.on('offer', payload => {
      io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', payload => {
      io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', incoming => {
      io.to(incoming.target).emit('ice-candidate', incoming.candidate);
    });

    socket.on('disconnect', () => {
      rooms[roomID] = rooms[roomID].filter(id => id !== socket.id);
      if (rooms[roomID].length === 0) delete rooms[roomID];
    });
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
