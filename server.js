const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const app = express();

// Настраиваем Express и Socket.IO
const server = http.createServer(app);
const io = require('socket.io')(server);  // Интеграция Socket.IO с сервером Express&#8203;:contentReference[oaicite:0]{index=0}

// Мидлвэр для разбора JSON тела запросов (встроенный в Express 4+)&#8203;:contentReference[oaicite:1]{index=1}
app.use(express.json());

// Загружаем список команд из data.json
let teams = [];
try {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf-8'));
  if (Array.isArray(data)) {
    // Если data.json содержит массив (просто список команд)
    teams = data;
  } else if (data.teams) {
    // Если файл содержит объект с полем teams
    teams = data.teams;
  }
} catch (err) {
  console.error("Ошибка чтения data.json:", err);
}

// Загружаем или инициализируем список матчей
let matches = [];
const matchesFile = path.join(__dirname, 'matches.json');
if (fs.existsSync(matchesFile)) {
  try {
    matches = JSON.parse(fs.readFileSync(matchesFile, 'utf-8'));
  } catch (err) {
    console.error("Ошибка чтения matches.json, будет использован пустой список матчей.", err);
    matches = [];
  }
} else {
  // Если файла нет, инициализируем демо-матчи
  matches = [
    {
      id: 1,
      team1: "NAVI Junior",
      team2: "9INE",
      time: "10:00 CEST",
      status: "FINISHED",
      winner: 2,  // 1 = team1, 2 = team2, null = не определён
      maps: ["Mirage"],        // список карт, сыгранных или выбранных
      vrs: [ { score1: 12, score2: 16 } ],  // результаты по картам (соответствуют списку maps)
      customFields: [ { name: "Comment", value: "Quarterfinal" } ]
    },
    {
      id: 2,
      team1: "",
      team2: "",
      time: "17:00 CEST",
      status: "UPCOM",   // UPCOM = предстоящий, LIVE = в процессе, FINISHED = завершён
      winner: null,
      maps: [],          // пока нет карт
      vrs: [],           // пока нет результатов
      customFields: []   // нет дополнительных полей
    }
  ];
  // Сохраняем инициализированные матчи в файл matches.json
  fs.writeFileSync(matchesFile, JSON.stringify(matches, null, 2));
}

// Статически раздаём содержимое папки public (HTML, CSS, JS файлы)
app.use(express.static(path.join(__dirname, 'public')));

// API: получить список команд
app.get('/api/teams', (req, res) => {
  res.json(teams);
});

// API: получить список матчей
app.get('/api/matches', (req, res) => {
  res.json(matches);
});

// API: сохранить/обновить данные матча (создание нового матча также возможно)
app.post('/api/matches/:id', (req, res) => {
  const matchId = parseInt(req.params.id);
  const updatedMatch = req.body;
  updatedMatch.id = matchId;  // убеждаемся, что id соответствует пути

  // Ищем матч с таким ID
  const index = matches.findIndex(m => m.id === matchId);
  if (index === -1) {
    // Если матч не найден, трактуем как создание нового
    matches.push(updatedMatch);
  } else {
    // Обновляем существующий матч
    matches[index] = updatedMatch;
  }

  // Сохраняем изменения в файл
  try {
    fs.writeFileSync(matchesFile, JSON.stringify(matches, null, 2));
  } catch (err) {
    console.error("Ошибка сохранения matches.json:", err);
  }

  // Отправляем обновлённые данные всем подключённым клиентам через Socket.IO
  io.sockets.emit('matchUpdated', updatedMatch);  // оповещение всех клиентов&#8203;:contentReference[oaicite:2]{index=2}

  // Отвечаем успешным результатом (обновлённым матчем)
  res.json(updatedMatch);
});

// Подключение нового клиента через Socket.IO
io.on('connection', (socket) => {
  console.log("Клиент подключился:", socket.id);

  // Опционально, можно сразу отправить новые клиенту текущие данные:
  // socket.emit('initialData', { teams, matches });

  socket.on('disconnect', () => {
    console.log("Клиент отключился:", socket.id);
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
