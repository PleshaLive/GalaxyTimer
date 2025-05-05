// server.js (Версия без аутентификации)
const express = require("express");
const path = require("path");
const fs = require("fs");
// Убираем cookieParser и session, так как они больше не нужны
// const cookieParser = require("cookie-parser");
// const session = require("express-session");
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
app.use(express.json()); // Для обработки application/json

// Middleware для раздачи статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, "public")));

// Роут для корневой страницы '/' - теперь всегда отдает index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


/* ====================================
   Работа с данными (in-memory + db.json)
   ==================================== */

// Определение путей к дефолтным логотипам (относительные пути для использования в JSON)
const defaultTeam1LogoPath = "/logos/default1.png";
const defaultTeam2LogoPath = "/logos/default2.png";

// Дефолтные структуры данных (для инициализации и слияния при загрузке)
// Полная структура для одного матча
const defaultMatchStructure = {
    UPCOM_MATCH_STATUS: "UPCOM", UPCOM_TIME: "", UPCOM_TEAM1: "", UPCOM_TEAM2: "", UPCOM_TEAM1_LOGO: defaultTeam1LogoPath, UPCOM_TEAM2_LOGO: defaultTeam2LogoPath, UPCOM_MAP1: "inferno", UPCOM_MAP1_SCORE: "", UPCOM_MAP2: "mirage", UPCOM_MAP2_SCORE: "", UPCOM_MAP3: "nuke", UPCOM_MAP3_SCORE: "", UPCOM_Cest: "", UPCOM_RectangleUP: "", UPCOM_RectangleLOW: "", UPCOM_vs_mini: "", UPCOM_vs_big: "", UPCOM_next: "", UPCOM_next_photo: "",
    LIVE_MATCH_STATUS: "", LIVE_TIME: "", LIVE_TEAM1: "", LIVE_TEAM2: "", LIVE_TEAM1_LOGO: defaultTeam1LogoPath, LIVE_TEAM2_LOGO: defaultTeam2LogoPath, LIVE_MAP1: "", LIVE_MAP1_SCORE: "", LIVE_MAP2: "", LIVE_MAP2_SCORE: "", LIVE_MAP3: "", LIVE_MAP3_SCORE: "", LIVE_Cest: "", LIVE_VS: "", LIVE_STATUS: "", LIVE_BG: "", LIVE_RectangleUP: "", LIVE_RectangleLOW: "",
    FINISHED_MATCH_STATUS: "", FINISHED_TIME: "", FINISHED_TEAM1: "", FINISHED_TEAM2: "", FINISHED_TEAM1_LOGO: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO: defaultTeam2LogoPath, FINISHED_MAP1: "", FINISHED_MAP1_SCORE: "", FINISHED_MAP2: "", FINISHED_MAP2_SCORE: "", FINISHED_MAP3: "", FINISHED_MAP3_SCORE: "", FIN_RectangleUP: "", FIN_RectangleLOW: "",
    MP1_UPC: "", MP2_UPC: "", MP3_UPC: "", MP1_LIVE: "", MP2_LIVE: "", MP3_LIVE: "", MP1_FIN: "", MP2_FIN: "", MP3_FIN: "", Fin_cest: "", FIN_Result: "", FIN_VICTORY: "", TEAMWINNER: "", TEAMWINNER_LOGO: defaultTeam1LogoPath,
    // Ключи для логотипов матчей и карт
    FINISHED_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath,
    MAP1_TEAM1logo: defaultTeam1LogoPath, MAP2_TEAM1logo: defaultTeam1LogoPath, MAP3_TEAM1logo: defaultTeam1LogoPath, MAP1_TEAM2logo: defaultTeam2LogoPath, MAP2_TEAM2logo: defaultTeam2LogoPath, MAP3_TEAM2logo: defaultTeam2LogoPath
};
// Дефолтная структура VRS для одного матча
const defaultVrsStructure = { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } };
// Дефолтная структура Map Veto
const defaultMapVetoStructure = { matchIndex: 1, teams: { TEAM1: {name: "", logo: ""}, TEAM2: {name: "", logo: ""} }, veto: Array(7).fill({action: "BAN", map: "inferno", team: "TEAM1", side: "-"}) };
// Дефолтная структура Custom Fields
const defaultCustomFieldsStructure = { upcomingMatches: "", galaxyBattle: "", tournamentStart: "", tournamentEnd: "", tournamentDay: "", groupStage: "" };

// Переменные для хранения данных в памяти сервера
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};

// Путь к файлу базы данных JSON
const dbFilePath = path.join(__dirname, "db.json");

// --- Функции работы с файлом ---
/**
 * Загружает данные из db.json. Если файл не существует, создает его с дефолтными данными.
 * Гарантирует, что загруженные данные имеют правильную структуру.
 */
function loadDataFromFile() {
  try {
    // Создаем объект с полной дефолтной структурой данных
    const defaultData = {
        matches: Array(4).fill(null).map(() => ({ ...defaultMatchStructure })), // Массив из 4 копий дефолтной структуры матча
        mapVeto: { ...defaultMapVetoStructure }, // Копия дефолтной структуры Map Veto
        vrs: { // Объект с дефолтной структурой VRS для каждого из 4 матчей
            "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure },
            "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure }
        },
        customFields: { ...defaultCustomFieldsStructure } // Копия дефолтной структуры Custom Fields
    };

    // Проверяем, существует ли файл db.json
    if (!fs.existsSync(dbFilePath)) {
      // Если файл не существует, создаем его и записываем дефолтные данные
      fs.writeFileSync(dbFilePath, JSON.stringify(defaultData, null, 2), "utf8");
      console.log(`[DATA] Created default db file at ${dbFilePath}`);
      // Загружаем дефолтные данные в переменные в памяти
      savedMatches = defaultData.matches;
      savedMapVeto = defaultData.mapVeto;
      savedVRS = defaultData.vrs;
      customFieldsData = defaultData.customFields;
    } else {
      // Если файл существует, читаем его содержимое
      const rawData = fs.readFileSync(dbFilePath, "utf8");
      const jsonData = JSON.parse(rawData); // Парсим JSON из файла

      // Загружаем данные из файла, объединяя их с дефолтной структурой.
      // Это гарантирует, что все необходимые поля будут присутствовать, даже если их нет в файле.
      savedMatches = (jsonData.matches && Array.isArray(jsonData.matches))
          ? jsonData.matches.map(m => ({ ...defaultMatchStructure, ...(m || {}) })) // Объединяем каждый объект матча
          : defaultData.matches; // Если в файле нет matches, используем дефолтный массив
      // Гарантируем, что у нас всегда ровно 4 матча
      while (savedMatches.length < 4) savedMatches.push({ ...defaultMatchStructure });
      if (savedMatches.length > 4) savedMatches = savedMatches.slice(0, 4); // Обрезаем, если больше 4

      // Загружаем Map Veto
      savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
      // Загружаем VRS
      savedVRS = { ...defaultData.vrs }; // Начинаем с дефолтной структуры
      if (jsonData.vrs && typeof jsonData.vrs === 'object') {
          // Обновляем только существующие ключи (1-4), объединяя с дефолтной структурой
          for (const key in savedVRS) {
              if (jsonData.vrs[key]) {
                  savedVRS[key] = { ...defaultVrsStructure, ...(jsonData.vrs[key] || {}) };
                  // Глубокое объединение для TEAM1 и TEAM2
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
      // Инициализируем переменные дефолтными структурами
      savedMatches = Array(4).fill(null).map(() => ({ ...defaultMatchStructure }));
      savedMapVeto = { ...defaultMapVetoStructure };
      savedVRS = { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } };
      customFieldsData = { ...defaultCustomFieldsStructure };
  }
}

// Вызываем загрузку данных при старте сервера
loadDataFromFile();

/**
 * Асинхронно сохраняет текущие данные (savedMatches, savedMapVeto и т.д.)
 * в файл db.json. Использует асинхронную запись для предотвращения блокировки.
 */
async function saveDataToFileAsync() {
  try {
    // Создаем объект для сохранения с текущими данными из памяти
    const dataToSave = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData
    };
    // Асинхронно записываем данные в файл db.json, преобразуя объект в JSON строку
    // null, 2 используется для форматирования JSON с отступами для читаемости
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
  res.json(savedMatches); // Возвращаем массив данных всех матчей
});

// GET /api/matchdata/:matchIndex - Получить данные одного конкретного матча
app.get("/api/matchdata/:matchIndex", (req, res) => {
  const index = parseInt(req.params.matchIndex, 10) - 1; // Преобразуем индекс из строки в число (0-3)
  // Проверяем корректность индекса
  if (isNaN(index) || index < 0 || index >= savedMatches.length) {
    return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
  }
  res.json(savedMatches[index]); // Возвращаем объект одного матча
});

// PUT /api/matchdata/:matchIndex - Обновить данные одного конкретного матча
app.put("/api/matchdata/:matchIndex", async (req, res) => { // Делаем обработчик асинхронным
    const index = parseInt(req.params.matchIndex, 10) - 1; // Получаем индекс матча из URL
    // Проверка корректности индекса
    if (isNaN(index) || index < 0 || index >= savedMatches.length) {
        console.warn(`[API] Invalid match index for PUT /api/matchdata: ${req.params.matchIndex}`);
        return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
    }
    // Проверка тела запроса (должен быть объект)
    if (!req.body || typeof req.body !== 'object') {
        console.warn(`[API] Invalid data for PUT /api/matchdata/${req.params.matchIndex}:`, req.body);
        return res.status(400).json({ message: "Некорректный формат данных матча." });
    }

    // Обновляем данные матча в массиве savedMatches.
    // Используем spread-оператор для объединения дефолтной структуры с полученными данными,
    // чтобы гарантировать наличие всех полей.
    savedMatches[index] = { ...defaultMatchStructure, ...req.body };
    console.log(`[API] Updated match data for index ${index}.`);

    // Асинхронно сохраняем все данные (включая обновленный матч) в файл db.json
    await saveDataToFileAsync();

    // Отправляем всем подключенным клиентам через Socket.IO ПОЛНЫЙ обновленный массив матчей
    io.emit("jsonUpdate", savedMatches);
    console.log("[SOCKET] Emitted jsonUpdate after single match update.");

    // Возвращаем обновленный объект матча клиенту в качестве ответа
    res.status(200).json(savedMatches[index]);
});


// --- API для Map Veto ---
// GET /api/mapveto - Получить текущие данные Map Veto
app.get("/api/mapveto", (req, res) => {
    // Возвращаем сохраненные данные или дефолтную структуру, если данных нет
    res.json(savedMapVeto || defaultMapVetoStructure);
});

// POST /api/mapveto - Обновить данные Map Veto
app.post("/api/mapveto", async (req, res) => { // Делаем обработчик асинхронным
  // Валидация входящих данных
  if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
      console.warn("[API] Received invalid data for POST /api/mapveto:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
  }
  // Обновляем данные Map Veto в памяти, объединяя с дефолтной структурой
  savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
  console.log("[API] Received updated mapveto data via POST for match:", savedMapVeto.matchIndex);

  // Сохраняем все данные в файл
  await saveDataToFileAsync();

  // Отправляем обновление всем клиентам через Socket.IO
  io.emit("mapVetoUpdate", savedMapVeto);
  console.log("[SOCKET] Emitted mapVetoUpdate");
  // Возвращаем сохраненные данные клиенту
  res.status(200).json(savedMapVeto);
});

// --- API для VRS ---
// GET /api/vrs-raw - Получить "сырые" данные VRS для всех матчей
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API] Request for raw VRS data");
    res.json(savedVRS); // Возвращаем весь объект VRS
});

// PUT /api/vrs/:id - Обновить данные VRS для одного матча
app.put("/api/vrs/:id", async (req, res) => { // Делаем обработчик асинхронным
    const matchId = req.params.id; // ID матча (строка "1", "2", ...)
    // Проверяем, существует ли ключ (ID матча) в объекте savedVRS
    if (!savedVRS.hasOwnProperty(matchId)) {
         console.warn(`[API] Invalid match ID for PUT /api/vrs: ${matchId}`);
         return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    }
    // Проверяем тело запроса (должен быть объект с TEAM1 и TEAM2)
     if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        console.warn(`[API] Invalid data for PUT /api/vrs/${matchId}:`, req.body);
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }

    // Обновляем данные VRS для конкретного матча, объединяя с дефолтной структурой
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    // Дополнительно глубоко объединяем данные для TEAM1 и TEAM2
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };

    console.log(`[API] Updated VRS data for match ${matchId}.`);

    // Сохраняем все данные в файл
    await saveDataToFileAsync();

    // Отправляем всем клиентам ПОЛНЫЙ обновленный объект VRS
    io.emit("vrsUpdate", savedVRS);
    console.log("[SOCKET] Emitted vrsUpdate after single VRS update.");

    // Возвращаем обновленные данные для этого матча клиенту
    res.status(200).json(savedVRS[matchId]);
});


// --- API для custom fields (верхний блок) ---
// GET /api/customfields - Получить данные Custom Fields
app.get("/api/customfields", (req, res) => {
  // Возвращаем объект в массиве для совместимости со старым кодом клиента
  res.json([customFieldsData || defaultCustomFieldsStructure]);
});

// POST /api/customfields - Обновить данные Custom Fields
app.post("/api/customfields", async (req, res) => { // Делаем обработчик асинхронным
  // Валидация тела запроса
  if (!req.body || typeof req.body !== 'object') {
      console.warn("[API] Received invalid data for /api/customfields:", req.body);
      return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
  }
  // Обновляем данные, объединяя с дефолтной структурой
  // Обрабатываем случай, когда клиент может прислать массив (берем первый элемент)
  customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
  console.log("[API] Received updated custom fields data.");

  // Сохраняем все данные в файл
  await saveDataToFileAsync();

  // Отправляем обновление всем клиентам (отправляем сам объект, не массив)
  io.emit("customFieldsUpdate", customFieldsData);
  console.log("[SOCKET] Emitted customFieldsUpdate");
  // Возвращаем обновленный объект клиенту
  res.status(200).json(customFieldsData);
});

// --- API для списка команд из файла data.json ---
const teamsDataFile = path.join(__dirname, "data.json"); // Убедитесь, что файл data.json существует
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

// Убираем middleware для сессий из Socket.IO, т.к. аутентификации нет
/*
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});
*/

// Обработчик подключения нового клиента Socket.IO
io.on("connection", (socket) => {
  // Логируем подключение нового клиента
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Отправляем текущие данные этому клиенту сразу при подключении
  socket.emit("jsonUpdate", savedMatches);       // Данные матчей
  socket.emit("customFieldsUpdate", customFieldsData); // Данные верхнего блока
  socket.emit("vrsUpdate", savedVRS);           // Данные VRS
  socket.emit("mapVetoUpdate", savedMapVeto);     // Данные Map Veto

  // Обработчик отключения клиента
  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}, Reason: ${reason}`);
  });
  // Обработчик ошибок сокета
  socket.on('error', (error) => {
    console.error(`[SOCKET] Socket error for ${socket.id}:`, error);
  });
});

// Запускаем HTTP сервер на прослушивание указанного порта и адреса 0.0.0.0 (все доступные интерфейсы)
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
