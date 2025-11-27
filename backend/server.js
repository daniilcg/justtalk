const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Хранилище в памяти (в продакшене заменить на БД)
let users = [];
let messages = [];

// Раздаем статику фронтенда
app.use(express.static(path.join(__dirname, '../frontend')));

// API
app.use(express.json());

// Socket.io соединения
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register', (username) => {
        socket.username = username;
        if (!users.includes(username)) {
            users.push(username);
        }
        io.emit('users', users);
    });

    socket.on('getUsers', () => {
        socket.emit('users', users);
    });

    socket.on('sendMessage', (data) => {
        messages.push(data);
        io.emit('newMessage', data);
    });

    socket.on('getMessages', (data) => {
        const userMessages = messages.filter(msg => 
            (msg.from === data.from && msg.to === data.to) || 
            (msg.from === data.to && msg.to === data.from)
        );
        socket.emit('messages', userMessages);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            users = users.filter(u => u !== socket.username);
            io.emit('users', users);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
