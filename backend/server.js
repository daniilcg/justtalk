// Глобальные переменные
let currentUser = null;
let currentContact = null;
let socket = null;
let localStream = null;
let isInCall = false;
let currentCall = null;

// API функции
async function register(event) {
  event.preventDefault();
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const username = document.getElementById('registerUsername').value;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, name })
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      showMainApp(result.user);
      showMessage('Регистрация успешна!', 'success');
    } else {
      showMessage(result.error, 'error');
    }
  } catch (error) {
    showMessage('Ошибка регистрации', 'error');
  }
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('currentUser', JSON.stringify(result.user));
      showMainApp(result.user);
    } else {
      showMessage(result.error, 'error');
    }
  } catch (error) {
    showMessage('Ошибка входа', 'error');
  }
}

// Поиск пользователей глобально
async function searchUsers(query) {
  if (!query) {
    renderUsers([]);
    return;
  }

  try {
    const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`);
    const users = await response.json();
    renderUsers(users);
  } catch (error) {
    console.error('Search error:', error);
  }
}

// WebSocket соединение
function connectWebSocket(userId) {
  socket = io();
  
  socket.emit('userOnline', userId);
  
  socket.on('usersUpdate', (users) => {
    // Обновляем список контактов
    if (!document.getElementById('searchInput').value) {
      renderUsers(users.filter(user => user.id !== currentUser.id));
    }
  });
  
  socket.on('newMessage', (message) => {
    if (currentContact && 
        (message.senderId === currentContact.id || message.receiverId === currentContact.id)) {
      loadMessages();
    }
  });
  
  socket.on('incomingCall', (callData) => {
    showIncomingCallModal(callData);
  });
}

// Функции звонков
async function startCall(type) {
  if (!currentContact) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video',
      audio: true
    });
    
    currentCall = {
      id: Date.now(),
      type: type,
      with: currentContact.id
    };
    
    socket.emit('startCall', {
      fromUserId: currentUser.id,
      toUserId: currentContact.id,
      type: type
    });
    
    showCallInterface();
    
  } catch (error) {
    alert('Ошибка доступа к камере/микрофону: ' + error.message);
  }
}

function showIncomingCallModal(callData) {
  // Показываем модальное окно с входящим звонком
  const caller = globalStorage.users.find(u => u.id === callData.fromUserId);
  if (confirm(`${caller.name} звонит вам. Принять звонок?`)) {
    acceptCall(callData.id);
  }
}

function acceptCall(callId) {
  socket.emit('acceptCall', callId);
  showCallInterface();
}
