const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Хранилище (в продакшене заменить на БД)
let users = [];
let messages = [];

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// API для регистрации/логина
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  // Логика регистрации
  res.json({ success: true, user: { id: Date.now(), name, email } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  // Логика входа
  res.json({ success: true, user: { id: 1, name: 'User', email } });
});

// Socket.io для сообщений и звонков
io.on('connection', (socket) => {
  socket.on('register', (user) => {
    socket.userId = user.id;
    users.push(user);
    io.emit('users', users);
  });

  socket.on('sendMessage', (data) => {
    messages.push(data);
    io.emit('newMessage', data);
  });

  socket.on('callUser', (data) => {
    socket.to(data.to).emit('incomingCall', data);
  });

  socket.on('disconnect', () => {
    users = users.filter(u => u.id !== socket.userId);
    io.emit('users', users);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
