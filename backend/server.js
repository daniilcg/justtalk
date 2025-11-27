const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Глобальное хранилище (в продакшене заменить на БД)
const globalStorage = {
  users: [],
  messages: [],
  calls: []
};

// Middleware
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Basic route for health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// API routes
app.post('/api/register', (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    
    // Проверка уникальности
    const existingUser = globalStorage.users.find(u => 
      u.username === username || u.email === email
    );
    
    if (existingUser) {
      return res.json({ 
        success: false, 
        error: 'Username или email уже заняты' 
      });
    }

    const newUser = {
      id: Date.now(),
      username,
      email,
      password,
      name,
      online: false,
      avatar: name.charAt(0).toUpperCase(),
      registeredAt: new Date().toISOString()
    };

    globalStorage.users.push(newUser);
    
    res.json({ 
      success: true, 
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = globalStorage.users.find(u => 
      u.email === email && u.password === password
    );
    
    if (user) {
      user.online = true;
      user.lastSeen = new Date().toISOString();
      
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          email: user.email
        }
      });
    } else {
      res.json({ 
        success: false, 
        error: 'Неверный email или пароль' 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Поиск пользователей
app.get('/api/users/search', (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.json([]);
    }

    const results = globalStorage.users
      .filter(user => 
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.name.toLowerCase().includes(query.toLowerCase())
      )
      .map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        online: user.online
      }));

    res.json(results);
  } catch (error) {
    res.status(500).json([]);
  }
});

// Онлайн пользователи
app.get('/api/users/online', (req, res) => {
  try {
    const onlineUsers = globalStorage.users
      .filter(user => user.online && user.id !== parseInt(req.query.exclude || 0))
      .map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar
      }));

    res.json(onlineUsers);
  } catch (error) {
    res.status(500).json([]);
  }
});

// Сообщения
app.get('/api/messages/:userId1/:userId2', (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    
    const messages = globalStorage.messages.filter(msg =>
      (msg.senderId == userId1 && msg.receiverId == userId2) ||
      (msg.senderId == userId2 && msg.receiverId == userId1)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json(messages);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.post('/api/messages', (req, res) => {
  try {
    const { senderId, receiverId, text } = req.body;
    
    const newMessage = {
      id: Date.now(),
      senderId: parseInt(senderId),
      receiverId: parseInt(receiverId),
      text,
      timestamp: new Date().toISOString(),
      read: false
    };

    globalStorage.messages.push(newMessage);
    
    // Отправляем уведомление через WebSocket
    io.emit('newMessage', newMessage);
    
    res.json({ success: true, message: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// WebSocket
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('userOnline', (userId) => {
    const user = globalStorage.users.find(u => u.id == userId);
    if (user) {
      user.online = true;
      user.socketId = socket.id;
    }
    
    io.emit('usersUpdate', globalStorage.users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      online: u.online
    })));
  });

  socket.on('startCall', (data) => {
    const { fromUserId, toUserId, type } = data;
    
    const callData = {
      id: Date.now(),
      fromUserId,
      toUserId,
      type,
      status: 'calling',
      timestamp: new Date().toISOString()
    };
    
    globalStorage.calls.push(callData);
    
    // Находим socket.id целевого пользователя
    const targetUser = globalStorage.users.find(u => u.id == toUserId);
    if (targetUser && targetUser.socketId) {
      socket.to(targetUser.socketId).emit('incomingCall', callData);
    }
  });

  socket.on('acceptCall', (callId) => {
    const call = globalStorage.calls.find(c => c.id == callId);
    if (call) {
      call.status = 'active';
      
      const caller = globalStorage.users.find(u => u.id == call.fromUserId);
      if (caller && caller.socketId) {
        socket.to(caller.socketId).emit('callAccepted', call);
      }
    }
  });

  socket.on('endCall', (callId) => {
    const call = globalStorage.calls.find(c => c.id == callId);
    if (call) {
      // Уведомляем обоих пользователей
      const caller = globalStorage.users.find(u => u.id == call.fromUserId);
      const receiver = globalStorage.users.find(u => u.id == call.toUserId);
      
      if (caller && caller.socketId) {
        socket.to(caller.socketId).emit('callEnded', call);
      }
      if (receiver && receiver.socketId) {
        socket.to(receiver.socketId).emit('callEnded', call);
      }
      
      // Удаляем звонок
      globalStorage.calls = globalStorage.calls.filter(c => c.id !== callId);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const user = globalStorage.users.find(u => u.socketId === socket.id);
    if (user) {
      user.online = false;
      user.socketId = null;
      
      io.emit('usersUpdate', globalStorage.users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar,
        online: u.online
      })));
    }
  });
});

// Запуск сервера
const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 JustTalk Server running on port ${PORT}`);
  console.log(`📞 Ready for global registration, messaging and calls!`);
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
