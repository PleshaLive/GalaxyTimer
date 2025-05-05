// server.js (Версия без аутентификации, с обновленной обработкой VRS для GET /api/vrs/:id)
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

// Создаем приложение Express
const app = express();
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
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Middleware для раздачи статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, "public")));

// Роут для корневой страницы '/' - теперь всегда отдает index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


/* ====================================
   Работа с данными (in-memory + db.json)
   ==================================== */

// Определение путей к дефолтным логотипам (относительные пути)
const defaultTeam1LogoPath = "/logos/default1.png";
const defaultTeam2LogoPath = "/logos/default2.png";

// Дефолтные структуры данных
const defaultMatchStructure = {
    UPCOM_MATCH_STATUS: "UPCOM", UPCOM_TIME: "", UPCOM_TEAM1: "", UPCOM_TEAM2: "", UPCOM_TEAM1_LOGO: defaultTeam1LogoPath, UPCOM_TEAM2_LOGO: defaultTeam2LogoPath, UPCOM_MAP1: "inferno", UPCOM_MAP1_SCORE: "", UPCOM_MAP2: "mirage", UPCOM_MAP2_SCORE: "", UPCOM_MAP3: "nuke", UPCOM_MAP3_SCORE: "", UPCOM_Cest: "", UPCOM_RectangleUP: "", UPCOM_RectangleLOW: "", UPCOM_vs_mini: "", UPCOM_vs_big: "", UPCOM_next: "", UPCOM_next_photo: "",
    LIVE_MATCH_STATUS: "", LIVE_TIME: "", LIVE_TEAM1: "", LIVE_TEAM2: "", LIVE_TEAM1_LOGO: defaultTeam1LogoPath, LIVE_TEAM2_LOGO: defaultTeam2LogoPath, LIVE_MAP1: "", LIVE_MAP1_SCORE: "", LIVE_MAP2: "", LIVE_MAP2_SCORE: "", LIVE_MAP3: "", LIVE_MAP3_SCORE: "", LIVE_Cest: "", LIVE_VS: "", LIVE_STATUS: "", LIVE_BG: "", LIVE_RectangleUP: "", LIVE_RectangleLOW: "",
    FINISHED_MATCH_STATUS: "", FINISHED_TIME: "", FINISHED_TEAM1: "", FINISHED_TEAM2: "", FINISHED_TEAM1_LOGO: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO: defaultTeam2LogoPath, FINISHED_MAP1: "", FINISHED_MAP1_SCORE: "", FINISHED_MAP2: "", FINISHED_MAP2_SCORE: "", FINISHED_MAP3: "", FINISHED_MAP3_SCORE: "", FIN_RectangleUP: "", FIN_RectangleLOW: "",
    MP1_UPC: "", MP2_UPC: "", MP3_UPC: "", MP1_LIVE: "", MP2_LIVE: "", MP3_LIVE: "", MP1_FIN: "", MP2_FIN: "", MP3_FIN: "", Fin_cest: "", FIN_Result: "", FIN_VICTORY: "", TEAMWINNER: "", TEAMWINNER_LOGO: defaultTeam1LogoPath,
    FINISHED_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH1: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH1: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH2: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH2: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH3: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH3: defaultTeam2LogoPath,
    FINISHED_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath, LIVE_TEAM1_LOGO_MATCH4: defaultTeam1LogoPath, LIVE_TEAM2_LOGO_MATCH4: defaultTeam2LogoPath,
    MAP1_TEAM1logo: defaultTeam1LogoPath, MAP2_TEAM1logo: defaultTeam1LogoPath, MAP3_TEAM1logo: defaultTeam1LogoPath, MAP1_TEAM2logo: defaultTeam2LogoPath, MAP2_TEAM2logo: defaultTeam2LogoPath, MAP3_TEAM2logo: defaultTeam2LogoPath
};
const defaultVrsStructure = { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } };
const defaultMapVetoStructure = { matchIndex: 1, teams: { TEAM1: {name: "", logo: ""}, TEAM2: {name: "", logo: ""} }, veto: Array(7).fill({action: "BAN", map: "inferno", team: "TEAM1", side: "-"}) };
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
    const defaultData = {
        matches: Array(4).fill(null).map(() => ({ ...defaultMatchStructure })),
        mapVeto: { ...defaultMapVetoStructure },
        vrs: {
            "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure },
            "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure }
        },
        customFields: { ...defaultCustomFieldsStructure }
    };

    if (!fs.existsSync(dbFilePath)) {
      fs.writeFileSync(dbFilePath, JSON.stringify(defaultData, null, 2), "utf8");
      console.log(`[DATA] Created default db file at ${dbFilePath}`);
      savedMatches = defaultData.matches;
      savedMapVeto = defaultData.mapVeto;
      savedVRS = defaultData.vrs;
      customFieldsData = defaultData.customFields;
    } else {
      const rawData = fs.readFileSync(dbFilePath, "utf8");
      const jsonData = JSON.parse(rawData);
      savedMatches = (jsonData.matches && Array.isArray(jsonData.matches))
          ? jsonData.matches.map(m => ({ ...defaultMatchStructure, ...(m || {}) }))
          : defaultData.matches;
      while (savedMatches.length < 4) savedMatches.push({ ...defaultMatchStructure });
      if (savedMatches.length > 4) savedMatches = savedMatches.slice(0, 4);

      savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
      savedVRS = { ...defaultData.vrs };
      if (jsonData.vrs && typeof jsonData.vrs === 'object') {
          for (const key in savedVRS) {
              if (jsonData.vrs[key]) {
                  savedVRS[key] = { ...defaultVrsStructure, ...(jsonData.vrs[key] || {}) };
                  savedVRS[key].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(jsonData.vrs[key].TEAM1 || {}) };
                  savedVRS[key].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(jsonData.vrs[key].TEAM2 || {}) };
              }
          }
      }
      customFieldsData = { ...defaultCustomFieldsStructure, ...(jsonData.customFields || {}) };
      console.log("[DATA] Data loaded successfully from db.json");
    }
  } catch (error) {
      console.error("[DATA] Error loading data from db.json:", error);
      savedMatches = Array(4).fill(null).map(() => ({ ...defaultMatchStructure }));
      savedMapVeto = { ...defaultMapVetoStructure };
      savedVRS = { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } };
      customFieldsData = { ...defaultCustomFieldsStructure };
  }
}

loadDataFromFile();

/** Асинхронно сохраняет текущие данные в db.json. */
async function saveDataToFileAsync() {
  try {
    const dataToSave = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData
    };
    await fs.promises.writeFile(dbFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json (async)");
  } catch (error) {
      console.error("[DATA] Error saving data asynchronously to db.json:", error);
  }
}

// --- Вспомогательные функции для обработки данных ---

/** Форматирует очки для отображения (добавляет "+"). */
function formatWinPoints(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num)) return value;
  return (num >= 0 ? "+" : "") + num;
}

/** Получает путь к логотипу команды в зависимости от статуса матча. */
function getTeamLogoPath(match, teamKey) {
    if (!match) return defaultTeam1LogoPath;
    let logoPath = "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
        logoPath = teamKey === 'TEAM1' ? match.FINISHED_TEAM1_LOGO : match.FINISHED_TEAM2_LOGO;
    } else if (match.LIVE_MATCH_STATUS === "LIVE") {
        logoPath = teamKey === 'TEAM1' ? match.LIVE_TEAM1_LOGO : match.LIVE_TEAM2_LOGO;
    } else {
        logoPath = teamKey === 'TEAM1' ? match.UPCOM_TEAM1_LOGO : match.UPCOM_TEAM2_LOGO;
    }
    if (!logoPath || logoPath.toLowerCase().includes("none.png")) {
        return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;
    }
    return logoPath;
}


/**
 * Обрабатывает "сырые" данные VRS для одного матча и возвращает
 * структурированный объект для API /api/vrs/:id в зависимости от статуса матча.
 */
function getVRSResponse(matchId) {
    const rawVrsData = savedVRS[matchId] || defaultVrsStructure;
    const match = savedMatches[matchId - 1] || defaultMatchStructure;
    const team1Logo = getTeamLogoPath(match, 'TEAM1');
    const team2Logo = getTeamLogoPath(match, 'TEAM2');

    // Структура для пустого ответа (используется в разных местах)
    const emptyBlock = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team2Logo }
    };

    let upcomData = {};
    let finishedData = {};
    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png";
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";

    // Определяем, какой статус у матча
    const isFinished = match.FINISHED_MATCH_STATUS === "FINISHED";

    if (isFinished) {
        // --- Если матч ЗАВЕРШЕН ---
        // Блок UPCOM должен быть пустым (кроме лого)
        upcomData = {
             TEAM1: { ...emptyBlock.TEAM1, logo: team1Logo }, // Сохраняем лого
             TEAM2: { ...emptyBlock.TEAM2, logo: team2Logo }
        };

        // Блок FINISHED заполняется в зависимости от победителя
        const winnerName = match.TEAMWINNER;
        const team1Name = match.FINISHED_TEAM1;
        const team2Name = match.FINISHED_TEAM2;

        if (winnerName && winnerName === team1Name) { // Team1 победила
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png";
            finishedData = {
                TEAM1: {
                    winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints),
                    losePoints: "",
                    rank: rawVrsData.TEAM1.rank ?? "",
                    currentPoints_win: rawVrsData.TEAM1.currentPoints ?? "",
                    currentPoints_lose: "",
                    logo: team1Logo
                },
                TEAM2: {
                    winPoints: "",
                    losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "",
                    rank: rawVrsData.TEAM2.rank ?? "",
                    currentPoints_win: "",
                    currentPoints_lose: rawVrsData.TEAM2.currentPoints ?? "",
                    logo: team2Logo
                }
            };
        } else if (winnerName && winnerName === team2Name) { // Team2 победила
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
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
        } else { // Победитель не определен или не совпадает
             finishedData = emptyBlock; // Возвращаем пустой блок FINISHED
        }

    } else {
        // --- Если матч НЕ ЗАВЕРШЕН (UPCOM или LIVE) ---
        // Блок UPCOM заполняется данными
        upcomData = {
            TEAM1: {
                winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints),
                losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "",
                rank: rawVrsData.TEAM1.rank ?? "",
                currentPoints: rawVrsData.TEAM1.currentPoints ?? "", // Используем поле currentPoints
                logo: team1Logo
            },
            TEAM2: {
                winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints),
                losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "",
                rank: rawVrsData.TEAM2.rank ?? "",
                currentPoints: rawVrsData.TEAM2.currentPoints ?? "",
                logo: team2Logo
            }
        };
        // Блок FINISHED остается пустым
        finishedData = emptyBlock;
        // Фоны остаются дефолтными (idle)
    }

    // Возвращаем итоговую структуру
    return {
        UPCOM: upcomData,
        FINISHED: finishedData,
        WIN_BG_TEAM_1: winBgTeam1,
        WIN_BG_TEAM_2: winBgTeam2
    };
}


/* ====================================
   API эндпоинты
   ==================================== */

// --- API для матчей ---
app.get("/api/matchdata", (req, res) => { res.json(savedMatches); });
app.get("/api/matchdata/:matchIndex", (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) {
        return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
    }
    res.json([savedMatches[index]]); // Оборачиваем в массив
});
app.put("/api/matchdata/:matchIndex", async (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) {
        return res.status(404).json({ message: `Матч с индексом ${req.params.matchIndex} не найден.` });
    }
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Некорректный формат данных матча." });
    }
    savedMatches[index] = { ...defaultMatchStructure, ...req.body };
    console.log(`[API] Updated match data for index ${index}.`);
    await saveDataToFileAsync();
    io.emit("jsonUpdate", savedMatches);
    console.log("[SOCKET] Emitted jsonUpdate after single match update.");
    res.status(200).json([savedMatches[index]]); // Оборачиваем в массив
});

// --- API для Map Veto ---
app.get("/api/mapveto", (req, res) => { res.json(savedMapVeto || defaultMapVetoStructure); });
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
// GET /api/vrs/:id - Возвращает обработанные данные VRS для одного матча
app.get("/api/vrs/:id", (req, res) => {
    const matchId = req.params.id;
    if (!/^[1-4]$/.test(matchId)) {
        console.warn(`[API] Invalid match ID for GET /api/vrs: ${matchId}`);
        return res.status(404).json({ error: "Некорректный номер матча" });
    }
    console.log(`[API] Request for processed VRS data for match ${matchId}`);
    // Вызываем функцию обработки и возвращаем результат (обернутый в массив)
    res.json([getVRSResponse(matchId)]);
});

// PUT /api/vrs/:id - Обновляет "сырые" данные VRS для одного матча
app.put("/api/vrs/:id", async (req, res) => {
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) {
         return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    }
     if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }
    // Сохраняем "сырые" данные
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };

    console.log(`[API] Updated VRS data for match ${matchId}.`);
    await saveDataToFileAsync();
    // Отправляем всем клиентам ПОЛНЫЙ обновленный объект "сырых" VRS данных
    io.emit("vrsUpdate", savedVRS);
    console.log("[SOCKET] Emitted vrsUpdate after single VRS update.");
    // Возвращаем сохраненные "сырые" данные (обернутые в массив)
    res.status(200).json([savedVRS[matchId]]);
});


// --- API для custom fields ---
app.get("/api/customfields", (req, res) => { res.json([customFieldsData || defaultCustomFieldsStructure]); });
app.post("/api/customfields", async (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
    }
    customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
    console.log("[API] Received updated custom fields data.");
    await saveDataToFileAsync();
    io.emit("customFieldsUpdate", customFieldsData);
    console.log("[SOCKET] Emitted customFieldsUpdate");
    res.status(200).json(customFieldsData);
});

// --- API для списка команд ---
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
const server = http.createServer(app);
const io = new SocketIOServer(server);

io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Отправляем текущие данные при подключении
  socket.emit("jsonUpdate", savedMatches);
  socket.emit("customFieldsUpdate", customFieldsData);
  socket.emit("vrsUpdate", savedVRS); // Отправляем "сырые" VRS данные
  socket.emit("mapVetoUpdate", savedMapVeto);

  socket.on("disconnect", (reason) => { console.log(`[SOCKET] Client disconnected: ${socket.id}, Reason: ${reason}`); });
  socket.on('error', (error) => { console.error(`[SOCKET] Socket error for ${socket.id}:`, error); });
});

// Запускаем HTTP сервер
server.listen(port, "0.0.0.0", () => { console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`); });

// Обработка сигналов завершения
function gracefulShutdown() {
    console.log('[SERVER] Received kill signal, shutting down gracefully.');
    server.close(async () => {
        console.log('[SERVER] Closed out remaining connections.');
        // await saveDataToFileAsync(); // Можно раскомментировать для сохранения перед выходом
        // console.log('[SERVER] Final data save complete.');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('[SERVER] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
