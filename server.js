// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

// Создаем приложение Express
const app = express();
const port = process.env.PORT || 3000; // Используем переменную окружения для порта

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[LOG] ${new Date().toISOString()} ${req.method} ${req.path} ${req.ip}`);
  next();
});

// Health-check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json()); // JSON парсер должен быть до роутов API

// Настройка сессий
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "322223", // Лучше использовать переменную окружения
  resave: false,
  saveUninitialized: false,
  cookie: {
      secure: process.env.NODE_ENV === 'production', // true для HTTPS в production
      httpOnly: true, // Рекомендуется для безопасности
      maxAge: 24 * 60 * 60 * 1000 // Например, 1 день
  }
});
app.use(sessionMiddleware);

// Роуты для логина
app.get("/login", (req, res) => {
  if (req.session.authenticated) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  // Используйте переменные окружения для учетных данных
  const adminUser = process.env.ADMIN_USER || "StarGalaxy";
  const adminPass = process.env.ADMIN_PASS || "FuckTheWorld1996";

  if (username === adminUser && password === adminPass) {
    req.session.authenticated = true;
    req.session.username = username; // Сохраняем имя пользователя в сессии
    console.log(`[AUTH] User ${username} logged in successfully.`);
    return res.redirect("/");
  }
  console.log(`[AUTH] Failed login attempt for username: ${username}`);
  res.redirect("/login?error=1");
});

// Роут для выхода
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("[AUTH] Error destroying session:", err);
            return res.redirect('/'); // Или показать страницу ошибки
        }
        res.clearCookie('connect.sid'); // Очищаем cookie сессии
        res.redirect('/login');
    });
});


// Middleware авторизации
app.use((req, res, next) => {
  // Разрешаем доступ к статическим файлам, API, логину/выходу и health-check
  const allowedPaths = ["/login", "/logout", "/health", "/login.css"];
  const isAllowed = allowedPaths.includes(req.path) ||
                    req.path.startsWith('/api/') ||
                    req.path.startsWith('/socket.io/') || // Разрешаем доступ к socket.io
                    // Проверяем, является ли запрос запросом к статическому файлу в /public
                    (req.method === 'GET' && !req.path.endsWith('.html')); // Упрощенная проверка статики

  if (isAllowed || req.session.authenticated) {
    return next();
  }
  console.log(`[AUTH] Unauthorized access attempt to ${req.path}, redirecting to login.`);
  res.redirect("/login");
});


// Статические файлы (после middleware авторизации, чтобы защитить index.html)
app.use(express.static(path.join(__dirname, "public")));

// Роут для корневого пути (отдаем index.html только авторизованным)
app.get("/", (req, res) => {
  // Middleware авторизации уже проверил сессию
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


/* ====================================
   Работа с данными: matches, mapVeto, VRS, customFields
   ==================================== */

const defaultTeam1Logo = path.join("public", "logos", "default1.png").replace(/\\/g, "/"); // Используем относительные пути
const defaultTeam2Logo = path.join("public", "logos", "default2.png").replace(/\\/g, "/");

// Данные хранятся в памяти
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};

// Путь к файлу базы данных (db.json)
const dbFilePath = path.join(__dirname, "db.json");

// --- Функции работы с файлом ---
function loadDataFromFile() {
  try {
    if (!fs.existsSync(dbFilePath)) {
      // Создаем файл с дефолтной структурой, если его нет
      const defaultData = {
        matches: [],
        mapVeto: { matchIndex: 1, teams: {}, veto: [] }, // Добавим структуру по умолчанию
        vrs: { // Добавим структуру по умолчанию для 4 матчей
            "1": { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } },
            "2": { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } },
            "3": { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } },
            "4": { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } }
        },
        customFields: {
            upcomingMatches: "", galaxyBattle: "", tournamentStart: "", tournamentEnd: "", tournamentDay: "", groupStage: ""
        }
      };
      fs.writeFileSync(dbFilePath, JSON.stringify(defaultData, null, 2), "utf8");
      console.log(`[DATA] Created default db file at ${dbFilePath}`);
      // Загружаем дефолтные данные в память
      savedMatches = defaultData.matches;
      savedMapVeto = defaultData.mapVeto;
      savedVRS = defaultData.vrs;
      customFieldsData = defaultData.customFields;
    } else {
      const rawData = fs.readFileSync(dbFilePath, "utf8");
      const jsonData = JSON.parse(rawData);
      // Загружаем данные, предоставляя пустые значения по умолчанию, если ключи отсутствуют
      savedMatches = jsonData.matches || [];
      savedMapVeto = jsonData.mapVeto || { matchIndex: 1, teams: {}, veto: [] };
      savedVRS = jsonData.vrs || { /* структура по умолчанию, как выше */ };
      customFieldsData = jsonData.customFields || { /* структура по умолчанию, как выше */};
      console.log("[DATA] Data loaded successfully from db.json");
    }
  } catch (error) {
      console.error("[DATA] Error loading data from db.json:", error);
      // В случае ошибки загрузки, инициализируем пустыми данными, чтобы сервер не упал
      savedMatches = [];
      savedMapVeto = { matchIndex: 1, teams: {}, veto: [] };
      savedVRS = { /* структура по умолчанию */ };
      customFieldsData = { /* структура по умолчанию */ };
  }
}

// Вызываем загрузку данных при старте сервера
loadDataFromFile();

// Функция сохранения данных в db.json
function saveDataToFile() {
  try {
    const jsonData = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData
    };
    fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json");
  } catch (error) {
      console.error("[DATA] Error saving data to db.json:", error);
  }
}

// Функция форматирования winPoints (без изменений)
function formatWinPoints(value) {
  // ... (код остался прежним)
}

// Функция выбора логотипа (без изменений, но пути теперь относительные)
function getLogo(match, team) {
 // ... (код остался прежним, но использует относительные defaultTeam*Logo)
}

/* ====================================
   API эндпоинты
   ==================================== */

// --- API для матчей ---
app.get("/api/matchdata", (req, res) => {
  res.json(savedMatches);
});

app.get("/api/matchdata/:matchIndex", (req, res) => {
  const index = parseInt(req.params.matchIndex, 10) - 1;
  if (isNaN(index) || index < 0 || index >= savedMatches.length) {
    return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
  }
  res.json([savedMatches[index]]); // Возвращаем массив с одним элементом для консистентности
});

app.post("/api/matchdata", (req, res) => {
  if (!Array.isArray(req.body)) {
      console.warn("[API] Received non-array data for /api/matchdata");
      return res.status(400).json({ message: "Ожидался массив данных матчей." });
  }
  savedMatches = req.body;
  console.log("[API] Received updated matchdata:", savedMatches.length, "matches");

  // Логика обновления VRS на основе завершенных матчей убрана,
  // так как расчет очков должен быть явным действием или отдельной логикой.
  // Оставим только сохранение данных матчей.

  saveDataToFile();

  // Эмитим событие "jsonUpdate" всем клиентам
  io.emit("jsonUpdate", savedMatches);
  console.log("[SOCKET] Emitted jsonUpdate");

  res.status(200).json(savedMatches); // Отправляем успешный ответ
});

// --- API для Map Veto ---
app.get("/api/mapveto", (req, res) => {
    // Возвращаем сохраненные данные или дефолтную структуру, если данных нет
    res.json(savedMapVeto || { matchIndex: 1, teams: {}, veto: [] });
});

app.post("/api/mapveto", (req, res) => {
  // Добавить валидацию входящих данных req.body
  if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
      console.warn("[API] Received invalid data for /api/mapveto:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
  }
  savedMapVeto = req.body;
  console.log("[API] Received updated mapveto data for match:", savedMapVeto.matchIndex);
  saveDataToFile();
  // Отправляем обновление Map Veto всем клиентам
  io.emit("mapVetoUpdate", savedMapVeto);
  console.log("[SOCKET] Emitted mapVetoUpdate");
  res.status(200).json(savedMapVeto);
});

// --- API для VRS ---

// НОВЫЙ Эндпоинт для получения "сырых" VRS данных
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API] Request for raw VRS data");
    res.json(savedVRS); // Просто возвращаем сохраненный объект VRS
});

// СТАРЫЙ Эндпоинт /api/vrs/:id (можно удалить или оставить для обратной совместимости, если нужен)
// Он больше не используется для основной загрузки данных в UI
/*
app.get("/api/vrs/:id", (req, res) => {
  const matchId = parseInt(req.params.id, 10);
  if (isNaN(matchId) || matchId < 1 || matchId > 4) {
    return res.status(404).json({ error: "Некорректный номер матча" });
  }
  console.log(`[API] Request for processed VRS data for match ${matchId}`);
  res.json([getVRSResponse(matchId)]); // Возвращаем массив для консистентности
});
*/

// POST для сохранения VRS данных (остается без изменений)
app.post("/api/vrs", (req, res) => {
  // Добавить валидацию входящих данных req.body
  if (!req.body || typeof req.body !== 'object') {
      console.warn("[API] Received invalid data for /api/vrs:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных VRS." });
  }
  savedVRS = req.body;
  console.log("[API] Received updated VRS data.");
  saveDataToFile();
  // Эмитим событие "vrsUpdate" с "сырыми" данными
  io.emit("vrsUpdate", savedVRS);
  console.log("[SOCKET] Emitted vrsUpdate");
  res.status(200).json(savedVRS);
});

// --- API для custom fields ---
app.get("/api/customfields", (req, res) => {
  // Возвращаем объект в массиве, как ожидает клиент
  res.json([customFieldsData || {}]);
});

app.post("/api/customfields", (req, res) => {
  // Добавить валидацию входящих данных req.body
  if (!req.body || typeof req.body !== 'object') {
      console.warn("[API] Received invalid data for /api/customfields:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
  }
  // Убедимся, что customFieldsData это объект, а не массив
  customFieldsData = Array.isArray(req.body) ? req.body[0] : req.body;
  console.log("[API] Received updated custom fields data.");
  saveDataToFile();
  // Оповещаем всех клиентов об обновлении
  io.emit("customFieldsUpdate", customFieldsData);
  console.log("[SOCKET] Emitted customFieldsUpdate");
  res.status(200).json(customFieldsData);
});

// --- API для списка команд из файла data.json ---
const teamsDataFile = path.join(__dirname, "data.json");
app.get("/api/teams", (req, res) => {
  fs.readFile(teamsDataFile, "utf8", (err, data) => {
    if (err) {
      console.error("[API] Ошибка чтения data.json:", err);
      return res.status(500).json({ error: "Не удалось прочитать файл команд." });
    }
    try {
      const teamsData = JSON.parse(data);
      // Возвращаем весь объект, клиент разберет data.teams
      res.json(teamsData);
    } catch (e) {
      console.error("[API] Ошибка парсинга data.json:", e);
      res.status(500).json({ error: "Ошибка парсинга JSON файла команд." });
    }
  });
});

/* ====================================
   Socket.io и запуск сервера
   ==================================== */
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    // Настройки CORS, если клиент и сервер на разных доменах/портах
    /* cors: {
        origin: "http://localhost:8080", // Адрес вашего фронтенда
        methods: ["GET", "POST"]
    } */
});

// Передаем сессию в Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});


io.on("connection", (socket) => {
  const session = socket.request.session;
  const username = session?.username || 'anonymous'; // Получаем имя пользователя из сессии

  // Проверяем аутентификацию при подключении сокета
  if (!session?.authenticated) {
      console.log(`[SOCKET] Unauthorized connection attempt from ${socket.id}. Disconnecting.`);
      socket.disconnect(true); // Отключаем неавторизованных пользователей
      return;
  }

  console.log(`[SOCKET] Client connected: ${socket.id}, User: ${username}`);

  // Отправляем текущие данные сразу при подключении авторизованному клиенту
  socket.emit("jsonUpdate", savedMatches);
  socket.emit("customFieldsUpdate", customFieldsData);
  socket.emit("vrsUpdate", savedVRS); // Отправляем сырые VRS данные
  socket.emit("mapVetoUpdate", savedMapVeto);

  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}, User: ${username}, Reason: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`[SOCKET] Socket error for ${socket.id}, User: ${username}:`, error);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`);
});

// Обработка сигналов для корректного завершения работы
process.on('SIGTERM', () => {
    console.log('[SERVER] SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('[SERVER] HTTP server closed');
        // Здесь можно добавить логику сохранения данных перед выходом, если нужно
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[SERVER] SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('[SERVER] HTTP server closed');
        process.exit(0);
    });
});
