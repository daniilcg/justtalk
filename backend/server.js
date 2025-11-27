// Глобальное хранилище на сервере
const serverStorage = {
  users: [
    {
      id: 1,
      name: 'Алексей',
      email: 'alex@example.com',
      password: '123456',
      online: false,
      avatar: 'A'
    },
    {
      id: 2, 
      name: 'Мария',
      email: 'maria@example.com',
      password: '123456', 
      online: false,
      avatar: 'M'
    },
    {
      id: 3,
      name: 'Иван',
      email: 'ivan@example.com',
      password: '123456',
      online: false,
      avatar: 'I'
    }
  ],
  messages: [] // Все сообщения между всеми пользователями
};

// API для работы с пользователями
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  
  const existingUser = serverStorage.users.find(u => u.email === email);
  if (existingUser) {
    return res.json({ success: false, error: 'User already exists' });
  }

  const newUser = {
    id: Date.now(),
    name,
    email, 
    password,
    online: true,
    avatar: name.charAt(0).toUpperCase()
  };

  serverStorage.users.push(newUser);
  res.json({ success: true, user: newUser });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = serverStorage.users.find(u => u.email === email && u.password === password);
  
  if (user) {
    user.online = true;
    res.json({ success: true, user });
  } else {
    res.json({ success: false, error: 'Invalid credentials' });
  }
});

// API для сообщений
app.get('/api/messages/:userId1/:userId2', (req, res) => {
  const { userId1, userId2 } = req.params;
  const userMessages = serverStorage.messages.filter(msg =>
    (msg.from == userId1 && msg.to == userId2) ||
    (msg.from == userId2 && msg.to == userId1)
  );
  res.json(userMessages);
});

app.post('/api/messages', (req, res) => {
  const { from, to, text } = req.body;
  const newMessage = {
    id: Date.now(),
    from,
    to, 
    text,
    timestamp: new Date().toISOString()
  };
  
  serverStorage.messages.push(newMessage);
  res.json({ success: true, message: newMessage });
});

// Socket.io для реального времени
io.on('connection', (socket) => {
  socket.on('userOnline', (userId) => {
    const user = serverStorage.users.find(u => u.id == userId);
    if (user) user.online = true;
    io.emit('usersUpdate', serverStorage.users);
  });

  socket.on('newMessage', (message) => {
    serverStorage.messages.push(message);
    io.emit('messageReceived', message);
  });

  socket.on('disconnect', () => {
    // Помечаем пользователя офлайн
    io.emit('usersUpdate', serverStorage.users);
  });
});
