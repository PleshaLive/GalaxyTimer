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
// Используем переменную окружения для порта или 3000 по умолчанию
const port = process.env.PORT || 3000;

// Логирование входящих запросов
app.use((req, res, next) => {
  console.log(`[LOG] ${new Date().toISOString()} ${req.method} ${req.path} ${req.ip}`);
  next();
});

// Эндпоинт для проверки работоспособности сервера (Health Check)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Middleware для обработки данных форм и JSON
app.use(express.urlencoded({ extended: false })); // Для application/x-www-form-urlencoded
app.use(cookieParser()); // Для работы с cookies
app.use(express.json()); // Для обработки application/json

// Настройка сессий
const sessionMiddleware = session({
  // Секрет лучше хранить в переменных окружения и сделать его сложнее
  secret: process.env.SESSION_SECRET || "your_very_strong_and_secret_session_key", // !!! ЗАМЕНИТЕ ЭТОТ СЕКРЕТ !!!
  resave: false, // Не пересохранять сессию, если она не изменилась
  saveUninitialized: false, // Не сохранять пустые сессии
  cookie: {
      secure: process.env.NODE_ENV === 'production', // Использовать secure cookies (HTTPS) в продакшене
      httpOnly: true, // Защита от XSS: cookie недоступны из JavaScript на клиенте
      maxAge: 24 * 60 * 60 * 1000 // Время жизни сессии (например, 1 день)
  }
});
app.use(sessionMiddleware); // Применяем middleware сессий

// Роуты для аутентификации (логин/выход)
app.get("/login", (req, res) => {
  // Если пользователь уже аутентифицирован, перенаправляем на главную
  if (req.session.authenticated) return res.redirect("/");
  // Отдаем страницу логина
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  // Получаем учетные данные администратора из переменных окружения или используем дефолтные
  const adminUser = process.env.ADMIN_USER || "StarGalaxy";
  const adminPass = process.env.ADMIN_PASS || "FuckTheWorld1996"; // !!! Настоятельно рекомендуется сменить пароль

  // Проверяем учетные данные
  if (username === adminUser && password === adminPass) {
    // Успешный вход: устанавливаем флаг в сессии и сохраняем имя пользователя
    req.session.authenticated = true;
    req.session.username = username;
    console.log(`[AUTH] User ${username} logged in successfully.`);
    // Перенаправляем на главную страницу
    return res.redirect("/");
  }
  // Неудачный вход: логируем попытку и перенаправляем обратно на логин с флагом ошибки
  console.log(`[AUTH] Failed login attempt for username: ${username}`);
  res.redirect("/login?error=1");
});

app.get('/logout', (req, res) => {
    const username = req.session.username || 'unknown user';
    // Уничтожаем сессию
    req.session.destroy(err => {
        if (err) {
            console.error("[AUTH] Error destroying session:", err);
        }
        console.log(`[AUTH] User ${username} logged out.`);
        // Очищаем cookie сессии у клиента
        res.clearCookie('connect.sid'); // Имя cookie по умолчанию для express-session
        // Перенаправляем на страницу логина
        res.redirect('/login');
    });
});


// Middleware для проверки авторизации для всех последующих роутов
app.use((req, res, next) => {
  // Список путей, доступных без авторизации
  const allowedPaths = ["/login", "/logout", "/health", "/login.css"];
  // Проверка, является ли запрос запросом к API или Socket.IO
  const isApiOrSocket = req.path.startsWith('/api/') || req.path.startsWith('/socket.io/');
  // Упрощенная проверка статических файлов (все GET, кроме / и .html)
  const isStaticAsset = req.method === 'GET' && req.path !== '/' && !req.path.endsWith('.html');
  // Разрешаем доступ к логотипам
  const isLogoRequest = req.path.startsWith('/logos/');

  // Если путь разрешен, или это API/Socket.IO, или статика, или логотип, или пользователь авторизован - пропускаем дальше
  if (allowedPaths.includes(req.path) || isApiOrSocket || isStaticAsset || isLogoRequest || req.session.authenticated) {
    return next();
  }

  // Если доступ запрещен - перенаправляем на логин
  console.log(`[AUTH] Unauthorized access attempt to ${req.path} by ${req.ip}, redirecting to login.`);
  res.redirect("/login");
});


// Middleware для раздачи статических файлов из папки 'public'
// Должен быть ПОСЛЕ middleware авторизации, чтобы защитить index.html
app.use(express.static(path.join(__dirname, "public")));

// Роут для корневой страницы '/'
app.get("/", (req, res) => {
  if (!req.session.authenticated) { // Дополнительная проверка на всякий случай
      return res.redirect('/login');
  }
  // Отдаем главный HTML файл
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


/* ====================================
   Работа с данными (in-memory + db.json)
   ==================================== */

// Определение путей к дефолтным логотипам (относительные пути для использования в JSON)
const defaultTeam1LogoPath = "/logos/default1.png";
const defaultTeam2LogoPath = "/logos/default2.png";

// Дефолтные структуры данных (для инициализации и слияния при загрузке)
const defaultMatchStructure = {
    UPCOM_MATCH_STATUS: "UPCOM", UPCOM_TIME: "", UPCOM_TEAM1: "", UPCOM_TEAM2: "", UPCOM_TEAM1_LOGO: defaultTeam1LogoPath, UPCOM_TEAM2_LOGO: defaultTeam2LogoPath, UPCOM_MAP1: "inferno", UPCOM_MAP1_SCORE: "", UPCOM_MAP2: "mirage", UPCOM_MAP2_SCORE: "", UPCOM_MAP3: "nuke", UPCOM_MAP3_SCORE: "", UPCOM_Cest: "", UPCOM_RectangleUP: "", UPCOM_RectangleLOW: "", UPCOM_vs_mini: "", UPCOM_vs_big: "", UPCOM_next: "", UPCOM_next_photo: "",
    LIVE_MATCH_STATUS: "", LIVE_TIME: "", LIVE_TEAM1: "", LIVE_TEAM2: "", LIVE_TEAM1_LOGO: defaultTeam1LogoPath, LIVE_TEAM2_LOGO: defaultTeam2LogoPath, LIVE_MAP1: "", LIVE_MAP1_SCORE: "", LIVE_MAP2: "", LIVE_MAP2_SCORE: "", LIVE_MAP3: "", LIVE_MAP3_SCORE: "", LIVE_Cest: "", LIVE_VS: "", LIVE_STATUS: "", LIVE_BG: "", LIVE_RectangleUP: "", LIVE_RectangleLOW: "",
    FINISHED_MATCH_STATUS: "", FINISHED_TIME: "", FINISHED_TEAM1: "", FINISHED_TEAM2: "", FINISHED_TEAM1_LOGO: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO: defaultTeam2LogoPath, FINISHED_MAP1: "", FINISHED_MAP1_SCORE: "", FINISHED_MAP2: "", FINISHED_MAP2_SCORE: "", FINISHED_MAP3: "", FINISHED_MAP3_SCORE: "", FIN_RectangleUP: "", FIN_RectangleLOW: "",
    MP1_UPC: "", MP2_UPC: "", MP3_UPC: "", MP1_LIVE: "", MP2_LIVE: "", MP3_LIVE: "", MP1_FIN: "", MP2_FIN: "", MP3_FIN: "", Fin_cest: "", FIN_Result: "", FIN_VICTORY: "", TEAMWINNER: "", TEAMWINNER_LOGO: defaultTeam1LogoPath,
    // Добавляем ключи для логотипов матчей и карт с дефолтными значениями
    FINISHED_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath,
    MAP1_TEAM1logo: defaultTeam1LogoPath, MAP2_TEAM1logo: defaultTeam1LogoPath, MAP3_TEAM1logo: defaultTeam1LogoPath, MAP1_TEAM2logo: defaultTeam2LogoPath, MAP2_TEAM2logo: defaultTeam2LogoPath, MAP3_TEAM2logo: defaultTeam2LogoPath
};
const defaultVrsStructure = { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } };
const defaultMapVetoStructure = { matchIndex: 1, teams: { TEAM1: {name: "", logo: ""}, TEAM2: {name: "", logo: ""} }, veto: Array(7).fill({action: "BAN", map: "inferno", team: "TEAM1", side: "-"}) };
const defaultCustomFieldsStructure = { upcomingMatches: "", galaxyBattle: "", tournamentStart: "", tournamentEnd: "", tournamentDay: "", groupStage: "" };

// Переменные для хранения данных в памяти
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};

// Путь к файлу базы данных
const dbFilePath = path.join(__dirname, "db.json");

// --- Функции работы с файлом ---
/** Загружает данные из db.json или создает файл с дефолтными данными. */
function loadDataFromFile() {
  try {
    // Создаем объект с полной дефолтной структурой
    const defaultData = {
        matches: Array(4).fill(null).map(() => ({ ...defaultMatchStructure })),
        mapVeto: { ...defaultMapVetoStructure },
        vrs: {
            "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure },
            "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure }
        },
        customFields: { ...defaultCustomFieldsStructure }
    };

    // Если файл не существует, создаем его с дефолтными данными
    if (!fs.existsSync(dbFilePath)) {
      fs.writeFileSync(dbFilePath, JSON.stringify(defaultData, null, 2), "utf8");
      console.log(`[DATA] Created default db file at ${dbFilePath}`);
      // Загружаем дефолтные данные в переменные
      savedMatches = defaultData.matches;
      savedMapVeto = defaultData.mapVeto;
      savedVRS = defaultData.vrs;
      customFieldsData = defaultData.customFields;
    } else {
      // Если файл существует, читаем его
      const rawData = fs.readFileSync(dbFilePath, "utf8");
      const jsonData = JSON.parse(rawData); // Парсим JSON

      // Загружаем данные, объединяя с дефолтной структурой для гарантии наличия всех полей
      // Используем || [], чтобы избежать ошибок, если jsonData.matches не массив
      savedMatches = (jsonData.matches && Array.isArray(jsonData.matches))
          ? jsonData.matches.map(m => ({ ...defaultMatchStructure, ...(m || {}) })) // Объединяем каждый матч
          : defaultData.matches;
      // Гарантируем, что у нас ровно 4 матча
      while (savedMatches.length < 4) savedMatches.push({ ...defaultMatchStructure });
      if (savedMatches.length > 4) savedMatches = savedMatches.slice(0, 4);

      // Загружаем Map Veto, объединяя с дефолтной структурой
      savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
      // Загружаем VRS, гарантируя наличие ключей 1-4 и структуру TEAM1/TEAM2
      savedVRS = { ...defaultData.vrs }; // Начинаем с дефолтной
      if (jsonData.vrs && typeof jsonData.vrs === 'object') {
          for (const key in savedVRS) { // Обновляем только существующие ключи (1-4)
              if (jsonData.vrs[key]) {
                  savedVRS[key] = { ...defaultVrsStructure, ...(jsonData.vrs[key] || {}) };
                  savedVRS[key].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(jsonData.vrs[key].TEAM1 || {}) };
                  savedVRS[key].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(jsonData.vrs[key].TEAM2 || {}) };
              }
          }
      }
      // Загружаем Custom Fields
      customFieldsData = { ...defaultCustomFieldsStructure, ...(jsonData.customFields || {}) };
      console.log("[DATA] Data loaded successfully from db.json");
    }
  } catch (error) {
      // Обработка ошибок чтения файла или парсинга JSON
      console.error("[DATA] Error loading data from db.json:", error);
      // В случае ошибки используем дефолтные данные, чтобы сервер мог продолжить работу
      savedMatches = Array(4).fill(null).map(() => ({ ...defaultMatchStructure }));
      savedMapVeto = { ...defaultMapVetoStructure };
      savedVRS = { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } };
      customFieldsData = { ...defaultCustomFieldsStructure };
  }
}

// Вызываем загрузку данных при старте сервера
loadDataFromFile();

/** Асинхронно сохраняет текущие данные (savedMatches, savedMapVeto и т.д.) в db.json. */
async function saveDataToFileAsync() {
  try {
    // Создаем объект для сохранения
    const dataToSave = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData
    };
    // Асинхронно записываем данные в файл
    await fs.promises.writeFile(dbFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json (async)");
  } catch (error) {
      // Обработка ошибок записи файла
      console.error("[DATA] Error saving data asynchronously to db.json:", error);
  }
}

/* ====================================
   API эндпоинты
   ==================================== */

// --- API для матчей ---
// GET /api/matchdata - Получить данные всех матчей
app.get("/api/matchdata", (req, res) => {
  res.json(savedMatches);
});

// GET /api/matchdata/:matchIndex - Получить данные одного матча
app.get("/api/matchdata/:matchIndex", (req, res) => {
  const index = parseInt(req.params.matchIndex, 10) - 1;
  if (isNaN(index) || index < 0 || index >= savedMatches.length) {
    return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
  }
  res.json(savedMatches[index]); // Возвращаем объект одного матча
});

// PUT /api/matchdata/:matchIndex - Обновить данные одного матча
app.put("/api/matchdata/:matchIndex", async (req, res) => { // Делаем async
    const index = parseInt(req.params.matchIndex, 10) - 1;
    // Проверка корректности индекса
    if (isNaN(index) || index < 0 || index >= savedMatches.length) {
        console.warn(`[API] Invalid match index for PUT /api/matchdata: ${req.params.matchIndex}`);
        return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
    }
    // Проверка тела запроса
    if (!req.body || typeof req.body !== 'object') {
        console.warn(`[API] Invalid data for PUT /api/matchdata/${req.params.matchIndex}:`, req.body);
        return res.status(400).json({ message: "Некорректный формат данных матча." });
    }

    // Обновляем данные матча в массиве, объединяя с дефолтной структурой для полноты
    savedMatches[index] = { ...defaultMatchStructure, ...req.body };
    console.log(`[API] Updated match data for index ${index}.`);

    // Асинхронно сохраняем все данные в файл
    await saveDataToFileAsync();

    // Отправляем всем клиентам ПОЛНЫЙ обновленный массив матчей
    io.emit("jsonUpdate", savedMatches);
    console.log("[SOCKET] Emitted jsonUpdate after single match update.");

    // Возвращаем обновленный объект матча клиенту
    res.status(200).json(savedMatches[index]);
});


// --- API для Map Veto ---
// GET /api/mapveto - Получить данные Map Veto
app.get("/api/mapveto", (req, res) => {
    // Возвращаем сохраненные данные или дефолтную структуру
    res.json(savedMapVeto || defaultMapVetoStructure);
});

// POST /api/mapveto - Обновить данные Map Veto
app.post("/api/mapveto", async (req, res) => { // Делаем async
  // Валидация входящих данных
  if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
      console.warn("[API] Received invalid data for POST /api/mapveto:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
  }
  // Обновляем данные, объединяя с дефолтной структурой
  savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
  console.log("[API] Received updated mapveto data via POST for match:", savedMapVeto.matchIndex);

  // Сохраняем в файл
  await saveDataToFileAsync();

  // Отправляем обновление клиентам
  io.emit("mapVetoUpdate", savedMapVeto);
  console.log("[SOCKET] Emitted mapVetoUpdate");
  // Возвращаем сохраненные данные
  res.status(200).json(savedMapVeto);
});

// --- API для VRS ---
// GET /api/vrs-raw - Получить "сырые" данные VRS для всех матчей
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API] Request for raw VRS data");
    res.json(savedVRS); // Возвращаем весь объект VRS
});

// PUT /api/vrs/:id - Обновить данные VRS для одного матча
app.put("/api/vrs/:id", async (req, res) => { // Делаем async
    const matchId = req.params.id; // ID матча (строка "1", "2", ...)
    // Проверяем, существует ли ключ для этого матча
    if (!savedVRS.hasOwnProperty(matchId)) {
         console.warn(`[API] Invalid match ID for PUT /api/vrs: ${matchId}`);
         return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    }
    // Проверяем тело запроса
     if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        console.warn(`[API] Invalid data for PUT /api/vrs/${matchId}:`, req.body);
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }

    // Обновляем данные VRS для конкретного матча, объединяя с дефолтной структурой
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    // Дополнительно объединяем данные для TEAM1 и TEAM2
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };

    console.log(`[API] Updated VRS data for match ${matchId}.`);

    // Сохраняем в файл
    await saveDataToFileAsync();

    // Отправляем всем клиентам ПОЛНЫЙ обновленный объект VRS
    io.emit("vrsUpdate", savedVRS);
    console.log("[SOCKET] Emitted vrsUpdate after single VRS update.");

    // Возвращаем обновленные данные для этого матча
    res.status(200).json(savedVRS[matchId]);
});


// --- API для custom fields ---
// GET /api/customfields - Получить данные Custom Fields
app.get("/api/customfields", (req, res) => {
  // Возвращаем объект в массиве, как ожидает старый клиентский код
  res.json([customFieldsData || defaultCustomFieldsStructure]);
});

// POST /api/customfields - Обновить данные Custom Fields
app.post("/api/customfields", async (req, res) => { // Делаем async
  // Валидация
  if (!req.body || typeof req.body !== 'object') {
      console.warn("[API] Received invalid data for /api/customfields:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
  }
  // Обновляем данные, объединяя с дефолтной структурой
  // Обрабатываем случай, когда клиент может прислать массив
  customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
  console.log("[API] Received updated custom fields data.");

  // Сохраняем в файл
  await saveDataToFileAsync();

  // Отправляем обновление клиентам (отправляем объект, не массив)
  io.emit("customFieldsUpdate", customFieldsData);
  console.log("[SOCKET] Emitted customFieldsUpdate");
  // Возвращаем обновленный объект
  res.status(200).json(customFieldsData);
});

// --- API для списка команд из файла data.json ---
const teamsDataFile = path.join(__dirname, "data.json"); // Убедитесь, что файл data.json существует и доступен
app.get("/api/teams", (req, res) => {
  fs.readFile(teamsDataFile, "utf8", (err, data) => {
    // Обработка ошибки чтения файла
    if (err) {
      console.error("[API] Ошибка чтения data.json:", err);
      // Возвращаем пустой список команд и ошибку
      return res.status(500).json({ teams: [], players: [], error: "Не удалось прочитать файл команд." });
    }
    // Обработка ошибки парсинга JSON
    try {
      const teamsData = JSON.parse(data);
      // Проверяем наличие массива teams в JSON
      if (!Array.isArray(teamsData.teams)) {
          console.error("[API] data.json не содержит массив 'teams'.");
          return res.status(500).json({ teams: [], players: [], error: "Некорректный формат файла команд." });
      }
      // Возвращаем полный объект из data.json
      res.json(teamsData);
    } catch (e) {
      console.error("[API] Ошибка парсинга data.json:", e);
      res.status(500).json({ teams: [], players: [], error: "Ошибка парсинга JSON файла команд." });
    }
  });
});

/* ====================================
   Socket.io и запуск сервера
   ==================================== */
// Создаем HTTP сервер на основе Express приложения
const server = http.createServer(app);
// Создаем Socket.IO сервер, привязанный к HTTP серверу
const io = new SocketIOServer(server);

// Используем middleware сессий для Socket.IO, чтобы иметь доступ к сессии в обработчиках сокетов
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Обработчик подключения нового клиента Socket.IO
io.on("connection", (socket) => {
  // Получаем доступ к сессии из запроса сокета
  const session = socket.request.session;
  // Получаем имя пользователя из сессии или используем 'anonymous'
  const username = session?.username || 'anonymous';

  // Проверяем, аутентифицирован ли пользователь в сессии
  if (!session?.authenticated) {
      // Если нет - логируем попытку и отключаем сокет
      console.log(`[SOCKET] Unauthorized connection attempt from ${socket.id}. Disconnecting.`);
      socket.disconnect(true);
      return;
  }

  // Логируем успешное подключение авторизованного пользователя
  console.log(`[SOCKET] Client connected: ${socket.id}, User: ${username}`);

  // Отправляем текущие данные этому клиенту сразу при подключении
  socket.emit("jsonUpdate", savedMatches);       // Данные матчей
  socket.emit("customFieldsUpdate", customFieldsData); // Данные верхнего блока
  socket.emit("vrsUpdate", savedVRS);           // Данные VRS
  socket.emit("mapVetoUpdate", savedMapVeto);     // Данные Map Veto

  // Обработчик отключения клиента
  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}, User: ${username}, Reason: ${reason}`);
  });
  // Обработчик ошибок сокета
  socket.on('error', (error) => {
    console.error(`[SOCKET] Socket error for ${socket.id}, User: ${username}:`, error);
  });
});

// Запускаем HTTP сервер на прослушивание указанного порта и адреса
server.listen(port, "0.0.0.0", () => {
  console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`);
});

// Обработка сигналов завершения для корректной остановки сервера
function gracefulShutdown() {
    console.log('[SERVER] Received kill signal, shutting down gracefully.');
    // Закрываем HTTP сервер (перестаем принимать новые соединения)
    server.close(async () => { // Используем async для ожидания сохранения
        console.log('[SERVER] Closed out remaining connections.');
        // Опционально: дожидаемся последнего сохранения данных перед выходом
        // await saveDataToFileAsync();
        // console.log('[SERVER] Final data save complete.');
        // Завершаем процесс Node.js
        process.exit(0);
    });

    // Устанавливаем таймаут: если сервер не закрылся за 10 секунд, принудительно выходим
    setTimeout(() => {
        console.error('[SERVER] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 секунд
}
// Привязываем обработчик к сигналам SIGTERM (обычно от systemd или Docker) и SIGINT (Ctrl+C)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
