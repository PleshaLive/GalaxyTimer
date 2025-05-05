// server.js (Версия без аутентификации, с обработкой VRS для GET /api/vrs/:id)
const express = require("express");
const path = require("path");
const fs = require("fs");
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
    // Ключи для логотипов матчей и карт с дефолтными значениями
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
/** Загружает данные из db.json или создает файл с дефолтными данными. */
function loadDataFromFile() {
  try {
    // Создаем объект с полной дефолтной структурой данных
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
      // Загружаем VRS, гарантируя наличие ключей 1-4 и структуру TEAM1/TEAM2
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

/** Асинхронно сохраняет текущие данные (savedMatches, savedMapVeto и т.д.) в db.json. */
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

// --- Вспомогательные функции для обработки данных ---

/** Форматирует очки для отображения (добавляет "+"). */
function formatWinPoints(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num)) return value; // Возвращаем как есть, если не число
  return (num >= 0 ? "+" : "") + num;
}

/** Получает путь к логотипу команды в зависимости от статуса матча. */
function getTeamLogoPath(match, teamKey) { // teamKey: 'TEAM1' или 'TEAM2'
    if (!match) return defaultTeam1LogoPath; // Безопасность

    let logoPath = "";
    // Определяем, какой логотип использовать в зависимости от статуса матча
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
        logoPath = teamKey === 'TEAM1' ? match.FINISHED_TEAM1_LOGO : match.FINISHED_TEAM2_LOGO;
    } else if (match.LIVE_MATCH_STATUS === "LIVE") {
        logoPath = teamKey === 'TEAM1' ? match.LIVE_TEAM1_LOGO : match.LIVE_TEAM2_LOGO;
    } else { // UPCOM или неопределенный статус
        logoPath = teamKey === 'TEAM1' ? match.UPCOM_TEAM1_LOGO : match.UPCOM_TEAM2_LOGO;
    }

    // Возвращаем дефолтное лого, если путь пустой или указывает на none.png
    if (!logoPath || logoPath.toLowerCase().includes("none.png")) {
        return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;
    }
    // Возвращаем найденный путь к логотипу
    return logoPath;
}


/**
 * Обрабатывает "сырые" данные VRS для одного матча и возвращает
 * структурированный объект для API /api/vrs/:id в зависимости от статуса матча.
 */
function getVRSResponse(matchId) {
    // Получаем "сырые" данные VRS для нужного матча или используем дефолтную структуру
    const rawVrsData = savedVRS[matchId] || defaultVrsStructure;
    // Получаем данные соответствующего матча для определения статуса и имен команд
    const match = savedMatches[matchId - 1] || defaultMatchStructure;

    // Получаем актуальные пути к логотипам команд
    const team1Logo = getTeamLogoPath(match, 'TEAM1');
    const team2Logo = getTeamLogoPath(match, 'TEAM2');

    // Структура для случая, когда матч не завершен (используется для блока FINISHED в этом случае)
    const emptyFin = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", logo: team2Logo }
    };
    // Структура данных для статусов UPCOM/LIVE
    const upcomData = {
        TEAM1: {
            winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), // Очки за победу с "+"
            losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", // Очки за поражение (отрицательные)
            rank: rawVrsData.TEAM1.rank ?? "", // Ранг или пустая строка
            currentPoints: rawVrsData.TEAM1.currentPoints ?? "", // Текущие очки
            logo: team1Logo // Логотип
        },
        TEAM2: {
            winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints),
            losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "",
            rank: rawVrsData.TEAM2.rank ?? "",
            currentPoints: rawVrsData.TEAM2.currentPoints ?? "",
            logo: team2Logo
        }
    };

    // Переменные для фона победы/поражения и данных для блока FINISHED
    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png"; // Путь к фону по умолчанию
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";
    let finishedData = emptyFin; // По умолчанию блок FINISHED пустой

    // Если матч завершен (FINISHED), формируем данные для блока FINISHED
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
        const winnerName = match.TEAMWINNER; // Имя победителя из данных матча
        const team1Name = match.FINISHED_TEAM1; // Имя команды 1 из данных матча
        const team2Name = match.FINISHED_TEAM2; // Имя команды 2 из данных матча

        // Если победила команда 1
        if (winnerName && winnerName === team1Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png"; // Фон победы
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png"; // Фон поражения
            finishedData = {
                TEAM1: {
                    winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), // Показываем очки за победу
                    losePoints: "", // Скрываем очки за поражение
                    rank: rawVrsData.TEAM1.rank ?? "",
                    currentPoints_win: rawVrsData.TEAM1.currentPoints ?? "", // Показываем итоговые очки
                    currentPoints_lose: "",
                    logo: team1Logo
                },
                TEAM2: {
                    winPoints: "", // Скрываем очки за победу
                    losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", // Показываем очки за поражение
                    rank: rawVrsData.TEAM2.rank ?? "",
                    currentPoints_win: "",
                    currentPoints_lose: rawVrsData.TEAM2.currentPoints ?? "", // Показываем итоговые очки
                    logo: team2Logo
                }
            };
        }
        // Если победила команда 2
        else if (winnerName && winnerName === team2Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png"; // Фон поражения
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png"; // Фон победы
            finishedData = {
                TEAM1: {
                    winPoints: "",
                    losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "",
                    rank: rawVrsData.TEAM1.rank ?? "",
                    currentPoints_win: "",
                    currentPoints_lose: rawVrsData.TEAM1.currentPoints ?? "",
                    logo: team1Logo
                },
                TEAM2: {
                    winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints),
                    losePoints: "",
                    rank: rawVrsData.TEAM2.rank ?? "",
                    currentPoints_win: rawVrsData.TEAM2.currentPoints ?? "",
                    currentPoints_lose: "",
                    logo: team2Logo
                }
            };
        }
        // Если победитель не указан или не совпадает, finishedData останется emptyFin
    }

    // Возвращаем итоговую структуру с данными для обоих статусов и фонами
    return {
        UPCOM: upcomData,       // Данные для отображения в UPCOM/LIVE
        FINISHED: finishedData, // Данные для отображения в FINISHED
        WIN_BG_TEAM_1: winBgTeam1, // Фон для команды 1
        WIN_BG_TEAM_2: winBgTeam2  // Фон для команды 2
    };
}


/* ====================================
   API эндпоинты
   ==================================== */

// --- API для матчей ---
// GET /api/matchdata - Получить данные всех матчей
app.get("/api/matchdata", (req, res) => {
  res.json(savedMatches);
});

// GET /api/matchdata/:matchIndex - Получить данные одного конкретного матча
app.get("/api/matchdata/:matchIndex", (req, res) => {
  const index = parseInt(req.params.matchIndex, 10) - 1;
  if (isNaN(index) || index < 0 || index >= savedMatches.length) {
    return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
  }
  // Возвращаем данные одного матча в виде массива из одного элемента
  res.json([savedMatches[index]]);
});

// PUT /api/matchdata/:matchIndex - Обновить данные одного конкретного матча
app.put("/api/matchdata/:matchIndex", async (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) {
        return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
    }
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Некорректный формат данных матча." });
    }
    // Обновляем данные матча, объединяя с дефолтной структурой
    savedMatches[index] = { ...defaultMatchStructure, ...req.body };
    console.log(`[API] Updated match data for index ${index}.`);
    // Асинхронно сохраняем все данные в файл
    await saveDataToFileAsync();
    // Отправляем всем клиентам полный обновленный массив матчей
    io.emit("jsonUpdate", savedMatches);
    console.log("[SOCKET] Emitted jsonUpdate after single match update.");
    // Возвращаем обновленный объект матча в виде массива из одного элемента
    res.status(200).json([savedMatches[index]]);
});


// --- API для Map Veto ---
// GET /api/mapveto - Получить данные Map Veto
app.get("/api/mapveto", (req, res) => {
    res.json(savedMapVeto || defaultMapVetoStructure);
});

// POST /api/mapveto - Обновить данные Map Veto
app.post("/api/mapveto", async (req, res) => {
  if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
      return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
  }
  savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
  console.log("[API] Received updated mapveto data via POST for match:", savedMapVeto.matchIndex);
  await saveDataToFileAsync();
  io.emit("mapVetoUpdate", savedMapVeto);
  console.log("[SOCKET] Emitted mapVetoUpdate");
  res.status(200).json(savedMapVeto);
});

// --- API для VRS ---
// УДАЛЕН GET /api/vrs-raw

// ВОЗВРАЩЕН GET /api/vrs/:id с обработкой данных
app.get("/api/vrs/:id", (req, res) => {
    const matchId = req.params.id;
    // Проверяем, что ID матча корректен (1-4)
    if (!/^[1-4]$/.test(matchId)) {
        console.warn(`[API] Invalid match ID for GET /api/vrs: ${matchId}`);
        return res.status(404).json({ error: "Некорректный номер матча" });
    }
    console.log(`[API] Request for processed VRS data for match ${matchId}`);
    // Вызываем функцию обработки getVRSResponse и возвращаем результат (обернутый в массив)
    res.json([getVRSResponse(matchId)]);
});


// PUT /api/vrs/:id - Обновить "сырые" данные VRS для одного матча
app.put("/api/vrs/:id", async (req, res) => {
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) {
         return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    }
     if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }
    // Сохраняем "сырые" данные, полученные от клиента, объединяя с дефолтной структурой
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };

    console.log(`[API] Updated VRS data for match ${matchId}.`);
    await saveDataToFileAsync();

    // Отправляем всем клиентам ПОЛНЫЙ обновленный объект "сырых" VRS данных
    io.emit("vrsUpdate", savedVRS);
    console.log("[SOCKET] Emitted vrsUpdate after single VRS update.");

    // Возвращаем сохраненные "сырые" данные для этого матча (обернутые в массив)
    res.status(200).json([savedVRS[matchId]]);
});


// --- API для custom fields ---
// GET /api/customfields - Получить данные Custom Fields
app.get("/api/customfields", (req, res) => {
  // Возвращаем объект в массиве для совместимости
  res.json([customFieldsData || defaultCustomFieldsStructure]);
});

// POST /api/customfields - Обновить данные Custom Fields
app.post("/api/customfields", async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
  }
  customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
  console.log("[API] Received updated custom fields data.");
  await saveDataToFileAsync();
  io.emit("customFieldsUpdate", customFieldsData);
  console.log("[SOCKET] Emitted customFieldsUpdate");
  // Возвращаем обновленный объект (не массив)
  res.status(200).json(customFieldsData);
});

// --- API для списка команд из файла data.json ---
const teamsDataFile = path.join(__dirname, "data.json");
app.get("/api/teams", (req, res) => {
  fs.readFile(teamsDataFile, "utf8", (err, data) => {
    if (err) {
      console.error("[API] Ошибка чтения data.json:", err);
      return res.status(500).json({ teams: [], players: [], error: "Не удалось прочитать файл команд." });
    }
    try {
      const teamsData = JSON.parse(data);
      if (!Array.isArray(teamsData.teams)) {
          console.error("[API] data.json не содержит массив 'teams'.");
          return res.status(500).json({ teams: [], players: [], error: "Некорректный формат файла команд." });
      }
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

// Обработчик подключения нового клиента Socket.IO
io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Отправляем текущие данные этому клиенту сразу при подключении
  socket.emit("jsonUpdate", savedMatches);       // Данные матчей
  socket.emit("customFieldsUpdate", customFieldsData); // Данные верхнего блока
  socket.emit("vrsUpdate", savedVRS);           // "Сырые" данные VRS
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
