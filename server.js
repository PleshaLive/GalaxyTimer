// server.js (Версия без аутентификации, с CRUD для команд и обработкой VRS)
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

// Роут для страницы управления командами
app.get("/teams", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "teams.html"));
});


/* ====================================
   Работа с данными (in-memory + db.json + data.json)
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
const defaultTeamStructure = { id: "", name: "", logo: "", score: 0 };
const defaultDataJsonStructure = { teams: [], players: [] };

// Переменные для хранения данных в памяти сервера
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};
let dataJsonContent = { teams: [], players: [] }; // Данные из data.json

// Пути к файлам данных
const dbFilePath = path.join(__dirname, "db.json");
const dataFilePath = path.join(__dirname, "data.json");

// --- Функции работы с файлом ---
/** Загружает данные из db.json */
function loadDbData() {
    try {
        const defaultDbData = {
            matches: Array(4).fill(null).map(() => ({ ...defaultMatchStructure })),
            mapVeto: { ...defaultMapVetoStructure },
            vrs: { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } },
            customFields: { ...defaultCustomFieldsStructure }
        };
        if (!fs.existsSync(dbFilePath)) {
            fs.writeFileSync(dbFilePath, JSON.stringify(defaultDbData, null, 2), "utf8");
            console.log(`[DATA] Created default db file at ${dbFilePath}`);
            savedMatches = defaultDbData.matches;
            savedMapVeto = defaultDbData.mapVeto;
            savedVRS = defaultDbData.vrs;
            customFieldsData = defaultDbData.customFields;
        } else {
            const rawData = fs.readFileSync(dbFilePath, "utf8");
            const jsonData = JSON.parse(rawData);
            savedMatches = (jsonData.matches && Array.isArray(jsonData.matches)) ? jsonData.matches.map(m => ({ ...defaultMatchStructure, ...(m || {}) })) : defaultDbData.matches;
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

/** Загружает данные из data.json */
function loadDataJson() {
    try {
        if (!fs.existsSync(dataFilePath)) {
            fs.writeFileSync(dataFilePath, JSON.stringify(defaultDataJsonStructure, null, 2), "utf8");
            console.log(`[DATA] Created default data file at ${dataFilePath}`);
            dataJsonContent = { ...defaultDataJsonStructure };
        } else {
            const rawData = fs.readFileSync(dataFilePath, "utf8");
            const jsonData = JSON.parse(rawData);
            dataJsonContent = {
                teams: Array.isArray(jsonData.teams) ? jsonData.teams.map(t => ({ ...defaultTeamStructure, ...t })) : [],
                players: Array.isArray(jsonData.players) ? jsonData.players : []
            };
            console.log("[DATA] Data loaded successfully from data.json");
        }
    } catch (error) {
        console.error("[DATA] Error loading data from data.json:", error);
        dataJsonContent = { ...defaultDataJsonStructure };
    }
}

// Вызываем загрузку обоих файлов при старте
loadDbData();
loadDataJson();

/** Асинхронно сохраняет данные в db.json. */
async function saveDbDataAsync() {
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

/** Асинхронно сохраняет данные в data.json */
async function saveDataJsonAsync() {
  try {
    // Перед сохранением убедимся, что logo - это относительный путь
    const teamsToSave = dataJsonContent.teams.map(team => ({
        ...team,
        logo: makeRelativePath(team.logo) // Преобразуем путь логотипа
    }));
    const dataToSave = {
        ...dataJsonContent,
        teams: teamsToSave
    };
    await fs.promises.writeFile(dataFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to data.json (async)");
  } catch (error) {
      console.error("[DATA] Error saving data asynchronously to data.json:", error);
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

/** Добавляет "pt" к числовому значению, если оно не пустое. */
function formatPointsWithPt(value) {
    if (value === "" || value === null || value === undefined) return "";
    const num = Number(value);
    if (isNaN(num)) {
        return value; // Возвращаем как есть, если не число
    }
    return `${value}pt`; // Добавляем "pt"
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
    // Преобразуем абсолютный путь C:\... в относительный /logos/...
    return makeRelativePath(logoPath);
}

/** Преобразует абсолютный путь к логотипу в относительный. */
function makeRelativePath(absolutePath) {
    if (!absolutePath || typeof absolutePath !== 'string') return "";
    // Ищем 'public\' или 'public/' (независимо от регистра)
    const publicPartIndex = absolutePath.toLowerCase().search(/[\\/]public[\\/]/);
    if (publicPartIndex !== -1) {
        // Находим начало имени папки после 'public'
        const relativePart = absolutePath.substring(publicPartIndex + 'public/'.length);
        // Заменяем обратные слеши на прямые и добавляем ведущий слеш
        return "/" + relativePart.replace(/\\/g, "/");
    }
    // Если путь уже относительный или не содержит 'public', возвращаем как есть (если начинается со /)
    return absolutePath.startsWith('/') ? absolutePath : "";
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

    // Структура для пустого ответа
    const emptyBlock = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team2Logo }
    };

    let upcomData = {};
    let finishedData = {};
    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png"; // Используем абсолютные пути для фонов vMix
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";

    const isFinished = match.FINISHED_MATCH_STATUS === "FINISHED";

    if (isFinished) {
        // --- Если матч ЗАВЕРШЕН ---
        upcomData = {
             TEAM1: { ...emptyBlock.TEAM1, logo: team1Logo },
             TEAM2: { ...emptyBlock.TEAM2, logo: team2Logo }
        };
        const winnerName = match.TEAMWINNER;
        const team1Name = match.FINISHED_TEAM1;
        const team2Name = match.FINISHED_TEAM2;

        if (winnerName && winnerName === team1Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png";
            finishedData = {
                TEAM1: {
                    winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), losePoints: "", rank: rawVrsData.TEAM1.rank ?? "",
                    currentPoints_win: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), currentPoints_lose: "", logo: team1Logo
                },
                TEAM2: {
                    winPoints: "", losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", rank: rawVrsData.TEAM2.rank ?? "",
                    currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), logo: team2Logo
                }
            };
        } else if (winnerName && winnerName === team2Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
            finishedData = {
                TEAM1: {
                    winPoints: "", losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", rank: rawVrsData.TEAM1.rank ?? "",
                    currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), logo: team1Logo
                },
                TEAM2: {
                    winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints), losePoints: "", rank: rawVrsData.TEAM2.rank ?? "",
                    currentPoints_win: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), currentPoints_lose: "", logo: team2Logo
                }
            };
        } else {
             finishedData = emptyBlock;
        }
    } else {
        // --- Если матч НЕ ЗАВЕРШЕН (UPCOM или LIVE) ---
        upcomData = {
            TEAM1: {
                winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints),
                losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "",
                rank: rawVrsData.TEAM1.rank ?? "",
                currentPoints: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), // Добавляем 'pt' и здесь
                logo: team1Logo
            },
            TEAM2: {
                winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints),
                losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "",
                rank: rawVrsData.TEAM2.rank ?? "",
                currentPoints: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), // Добавляем 'pt' и здесь
                logo: team2Logo
            }
        };
        finishedData = emptyBlock;
    }

    return { UPCOM: upcomData, FINISHED: finishedData, WIN_BG_TEAM_1: winBgTeam1, WIN_BG_TEAM_2: winBgTeam2 };
}


/* ====================================
   API эндпоинты
   ==================================== */

// --- API для матчей, Veto, VRS, Custom Fields (работают с db.json) ---
app.get("/api/matchdata", (req, res) => { res.json(savedMatches); });
app.get("/api/matchdata/:matchIndex", (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    res.json([savedMatches[index]]); // Возвращаем в массиве
});
app.put("/api/matchdata/:matchIndex", async (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных матча." });
    savedMatches[index] = { ...defaultMatchStructure, ...req.body };
    console.log(`[API] Updated match data for index ${index}.`);
    await saveDbDataAsync(); // Сохраняем в db.json
    io.emit("jsonUpdate", savedMatches);
    res.status(200).json([savedMatches[index]]); // Возвращаем в массиве
});

app.get("/api/mapveto", (req, res) => { res.json(savedMapVeto || defaultMapVetoStructure); });
app.post("/api/mapveto", async (req, res) => {
    if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
    savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
    console.log("[API] Received updated mapveto data via POST for match:", savedMapVeto.matchIndex);
    await saveDbDataAsync(); // Сохраняем в db.json
    io.emit("mapVetoUpdate", savedMapVeto);
    res.status(200).json(savedMapVeto);
});

app.get("/api/vrs/:id", (req, res) => { // Обработка VRS для GET
    const matchId = req.params.id;
    if (!/^[1-4]$/.test(matchId)) return res.status(404).json({ error: "Некорректный номер матча" });
    console.log(`[API] Request for processed VRS data for match ${matchId}`);
    res.json([getVRSResponse(matchId)]); // Возвращаем обработанные данные в массиве
});
app.put("/api/vrs/:id", async (req, res) => { // Сохранение сырых VRS данных
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) return res.status(400).json({ message: "Некорректный формат данных VRS." });
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };
    console.log(`[API] Updated VRS data for match ${matchId}.`);
    await saveDbDataAsync(); // Сохраняем в db.json
    io.emit("vrsUpdate", savedVRS); // Отправляем сырые данные всем
    res.status(200).json([savedVRS[matchId]]); // Возвращаем сырые данные в массиве
});

app.get("/api/customfields", (req, res) => { res.json([customFieldsData || defaultCustomFieldsStructure]); });
app.post("/api/customfields", async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
    customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
    console.log("[API] Received updated custom fields data.");
    await saveDbDataAsync(); // Сохраняем в db.json
    io.emit("customFieldsUpdate", customFieldsData);
    res.status(200).json(customFieldsData);
});

// --- API для команд (работают с data.json) ---

// GET /api/teams - Получить список команд (и игроков) из data.json
app.get("/api/teams", (req, res) => {
  res.json(dataJsonContent);
});

// POST /api/teams - Добавить новую команду в data.json
app.post("/api/teams", async (req, res) => {
    const newName = req.body.name?.trim();
    if (!newName) return res.status(400).json({ message: "Название команды не может быть пустым." });
    const newId = Date.now().toString();
    const newTeam = { id: newId, name: newName, logo: "", score: 0 };
    if (!Array.isArray(dataJsonContent.teams)) dataJsonContent.teams = [];
    dataJsonContent.teams.push(newTeam);
    console.log(`[API] Added new team: ${newName} (ID: ${newId})`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted teamsUpdate after adding team.");
    res.status(201).json(newTeam);
});

// PUT /api/teams/:id - Обновить имя существующей команды в data.json
app.put("/api/teams/:id", async (req, res) => {
    const teamId = req.params.id;
    const newName = req.body.name?.trim();
    if (!newName) return res.status(400).json({ message: "Новое название команды не может быть пустым." });
    const teamIndex = dataJsonContent.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return res.status(404).json({ message: `Команда с ID ${teamId} не найдена.` });
    dataJsonContent.teams[teamIndex].name = newName;
    console.log(`[API] Updated team ${teamId} name to: ${newName}`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted teamsUpdate after updating team.");
    res.status(200).json(dataJsonContent.teams[teamIndex]);
});

// DELETE /api/teams/:id - Удалить команду из data.json
app.delete("/api/teams/:id", async (req, res) => {
    const teamId = req.params.id;
    const initialLength = dataJsonContent.teams.length;
    dataJsonContent.teams = dataJsonContent.teams.filter(t => t.id !== teamId);
    if (dataJsonContent.teams.length === initialLength) return res.status(404).json({ message: `Команда с ID ${teamId} не найдена.` });
    console.log(`[API] Deleted team ${teamId}`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted teamsUpdate after deleting team.");
    res.status(204).send();
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
  socket.emit("teamsUpdate", dataJsonContent.teams); // Отправляем список команд

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
        // await saveDbDataAsync(); // Можно раскомментировать для сохранения перед выходом
        // await saveDataJsonAsync();
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
