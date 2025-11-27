const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Раздаем статику фронтенда
app.use(express.static(path.join(__dirname, '../frontend')));

// API роуты для бэкенда
app.get('/api', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Все остальные запросы на фронтенд
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
});
