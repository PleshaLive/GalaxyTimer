// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use((req, res, next) => {
  // Логирование запросов
  console.log(`[LOG] ${new Date().toISOString()} ${req.method} ${req.path} ${req.ip}`);
  next();
});
app.use(express.urlencoded({ extended: false })); // Для парсинга URL-encoded данных
app.use(express.json()); // Для парсинга JSON-данных
app.use(express.static(path.join(__dirname, "public"))); // Обслуживание статических файлов

// --- Роуты ---
app.get("/health", (req, res) => {
  // Проверка работоспособности сервера
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  // Главная страница
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/teams", (req, res) => {
  // Страница управления командами
  res.sendFile(path.join(__dirname, "public", "teams.html"));
});

// --- Структуры данных по умолчанию ---
const defaultTeam1LogoPath = "/logos/none.png"; // Используем относительный путь к заглушке
const defaultTeam2LogoPath = "/logos/none.png";
const defaultMatchStructure = {
    UPCOM_MATCH_STATUS: "UPCOM", UPCOM_TIME: "", UPCOM_TEAM1: "", UPCOM_TEAM2: "", UPCOM_TEAM1_LOGO: defaultTeam1LogoPath, UPCOM_TEAM2_LOGO: defaultTeam2LogoPath, UPCOM_MAP1: "inferno", UPCOM_MAP1_SCORE: "", UPCOM_MAP2: "mirage", UPCOM_MAP2_SCORE: "", UPCOM_MAP3: "nuke", UPCOM_MAP3_SCORE: "", UPCOM_Cest: "", UPCOM_RectangleUP: "", UPCOM_RectangleLOW: "", UPCOM_vs_mini: "", UPCOM_vs_big: "", UPCOM_next: "", UPCOM_next_photo: "",
    LIVE_MATCH_STATUS: "", LIVE_TIME: "", LIVE_TEAM1: "", LIVE_TEAM2: "", LIVE_TEAM1_LOGO: defaultTeam1LogoPath, LIVE_TEAM2_LOGO: defaultTeam2LogoPath, LIVE_MAP1: "", LIVE_MAP1_SCORE: "", LIVE_MAP2: "", LIVE_MAP2_SCORE: "", LIVE_MAP3: "", LIVE_MAP3_SCORE: "", LIVE_Cest: "", LIVE_VS: "", LIVE_STATUS: "", LIVE_BG: "", LIVE_RectangleUP: "", LIVE_RectangleLOW: "",
    FINISHED_MATCH_STATUS: "", FINISHED_TIME: "", FINISHED_TEAM1: "", FINISHED_TEAM2: "", FINISHED_TEAM1_LOGO: defaultTeam1LogoPath, FINISHED_TEAM2_LOGO: defaultTeam2LogoPath, FINISHED_MAP1: "", FINISHED_MAP1_SCORE: "", FINISHED_MAP2: "", FINISHED_MAP2_SCORE: "", FINISHED_MAP3: "", FINISHED_MAP3_SCORE: "", FIN_RectangleUP: "", FIN_RectangleLOW: "",
    MP1_UPC: "", MP2_UPC: "", MP3_UPC: "", MP1_LIVE: "", MP2_LIVE: "", MP3_LIVE: "", MP1_FIN: "", MP2_FIN: "", MP3_FIN: "", Fin_cest: "", FIN_Result: "", FIN_VICTORY: "", TEAMWINNER: "", TEAMWINNER_LOGO: defaultTeam1LogoPath,
    MAP1_TEAM1logo: defaultTeam1LogoPath, MAP2_TEAM1logo: defaultTeam1LogoPath, MAP3_TEAM1logo: defaultTeam1LogoPath, MAP1_TEAM2logo: defaultTeam2LogoPath, MAP2_TEAM2logo: defaultTeam2LogoPath, MAP3_TEAM2logo: defaultTeam2LogoPath
};
const defaultVrsStructure = { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } };
const defaultMapVetoStructure = { matchIndex: 1, teams: { TEAM1: {name: "", logo: ""}, TEAM2: {name: "", logo: ""} }, veto: Array(7).fill(null).map(() => ({action: "BAN", map: "inferno", team: "TEAM1", side: "-"})) };
const defaultCustomFieldsStructure = { upcomingMatches: "", galaxyBattle: "", tournamentStart: "", tournamentEnd: "", tournamentDay: "", groupStage: "" };
const defaultTeamStructure = { id: "", name: "", logo: "", score: 0 }; // Для data.json (команды)
const defaultPauseDataStructure = { pause: "", lastUpd: "" };
const defaultCasterStructure = { id: "", caster: "", social: "" };
const defaultSelectedCastersStructure = { caster1: null, caster2: null };

// --- Хранилища данных в памяти ---
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};
let dataJsonContent = { teams: [], players: [] }; // Для команд и игроков из data.json
let savedPauseData = {};
let savedCasters = [];
let savedSelectedCasters = { ...defaultSelectedCastersStructure };

// --- Пути к файлам ---
const dbFilePath = path.join(__dirname, "db.json"); // Основной файл БД
const dataFilePath = path.join(__dirname, "data.json"); // Файл для команд/игроков

// --- Функции загрузки и сохранения данных ---

/** Загружает данные из основного файла db.json */
function loadDbData() {
    try {
        const defaultDb = {
            matches: Array(4).fill(null).map((_, i) => {
                const matchSpecificLogos = {};
                matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
                matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
                matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
                matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
                return { ...defaultMatchStructure, ...matchSpecificLogos };
            }),
            mapVeto: { ...defaultMapVetoStructure },
            vrs: { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } },
            customFields: { ...defaultCustomFieldsStructure },
            pauseData: { ...defaultPauseDataStructure },
            casters: [],
            selectedCasters: { ...defaultSelectedCastersStructure }
        };

        if (!fs.existsSync(dbFilePath)) {
            fs.writeFileSync(dbFilePath, JSON.stringify(defaultDb, null, 2), "utf8");
            console.log(`[DATA] Created default db file at ${dbFilePath}`);
            // Присваиваем дефолтные значения переменным в памяти
            savedMatches = defaultDb.matches;
            savedMapVeto = defaultDb.mapVeto;
            savedVRS = defaultDb.vrs;
            customFieldsData = defaultDb.customFields;
            savedPauseData = defaultDb.pauseData;
            savedCasters = defaultDb.casters;
            savedSelectedCasters = defaultDb.selectedCasters;
        } else {
            const rawData = fs.readFileSync(dbFilePath, "utf8");
            const jsonData = JSON.parse(rawData || "{}"); // Обработка пустого файла

            // Загрузка матчей с объединением дефолтной структуры
            savedMatches = (jsonData.matches && Array.isArray(jsonData.matches))
                ? jsonData.matches.map((m, i) => {
                    const matchSpecificLogos = {};
                    const matchIndex = i + 1;
                    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = m?.[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] || defaultTeam1LogoPath;
                    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = m?.[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] || defaultTeam2LogoPath;
                    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = m?.[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] || defaultTeam1LogoPath;
                    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = m?.[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] || defaultTeam2LogoPath;
                    return { ...defaultMatchStructure, ...(m || {}), ...matchSpecificLogos };
                })
                : defaultDb.matches;
            // Дополнение массива матчей до 4, если нужно
            while (savedMatches.length < 4) {
                const i = savedMatches.length;
                const matchSpecificLogos = {};
                matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
                matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
                matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
                matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
                savedMatches.push({ ...defaultMatchStructure, ...matchSpecificLogos });
            }
             if (savedMatches.length > 4) savedMatches = savedMatches.slice(0, 4);

            // Загрузка остальных данных с объединением дефолтных структур
            savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
            savedVRS = { ...defaultDb.vrs }; // Начинаем с дефолта
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
            savedPauseData = { ...defaultPauseDataStructure, ...(jsonData.pauseData || {}) };
            savedCasters = Array.isArray(jsonData.casters)
                ? jsonData.casters.map(c => ({ ...defaultCasterStructure, ...c }))
                : defaultDb.casters;
            savedSelectedCasters = { ...defaultSelectedCastersStructure, ...(jsonData.selectedCasters || {}) };

            console.log("[DATA] Data loaded successfully from db.json");
        }
    } catch (error) {
        console.error("[DATA] Error loading data from db.json:", error);
        // В случае ошибки загрузки используем дефолтные значения
        savedMatches = defaultDb.matches;
        savedMapVeto = defaultDb.mapVeto;
        savedVRS = defaultDb.vrs;
        customFieldsData = defaultDb.customFields;
        savedPauseData = defaultDb.pauseData;
        savedCasters = defaultDb.casters;
        savedSelectedCasters = defaultDb.selectedCasters;
    }
}

/** Загружает данные команд/игроков из data.json */
function loadDataJson() {
    try {
        const defaultData = { teams: [], players: [] };
        if (!fs.existsSync(dataFilePath)) {
            fs.writeFileSync(dataFilePath, JSON.stringify(defaultData, null, 2), "utf8");
            console.log(`[DATA] Created default data file at ${dataFilePath}`);
            dataJsonContent = { ...defaultData };
        } else {
            const rawData = fs.readFileSync(dataFilePath, "utf8");
            const jsonData = JSON.parse(rawData || "{}"); // Обработка пустого файла
            dataJsonContent = {
                teams: Array.isArray(jsonData.teams) ? jsonData.teams.map(t => ({ ...defaultTeamStructure, ...t })) : [],
                players: Array.isArray(jsonData.players) ? jsonData.players : []
            };
            console.log("[DATA] Teams/players data loaded successfully from data.json");
        }
    } catch (error) {
        console.error("[DATA] Error loading data from data.json:", error);
        dataJsonContent = { teams: [], players: [] }; // Сброс в случае ошибки
    }
}

// Вызов функций загрузки при старте сервера
loadDbData();
loadDataJson();

/** Асинхронно сохраняет данные в основной файл db.json */
async function saveDbDataAsync() {
  try {
    const dataToSave = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData,
      pauseData: savedPauseData,
      casters: savedCasters,
      selectedCasters: savedSelectedCasters
    };
    // Используем асинхронную запись
    await fs.promises.writeFile(dbFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json (async)");
  } catch (error) {
    console.error("[DATA] Error saving data asynchronously to db.json:", error);
    // В продакшене здесь можно добавить более сложную логику обработки ошибок
  }
}

/** Асинхронно сохраняет данные команд/игроков в data.json */
async function saveDataJsonAsync() {
  try {
    // Убедимся, что логотипы команд сохранены с относительными путями
    const teamsToSave = dataJsonContent.teams.map(team => ({
      ...team,
      logo: makeRelativePath(team.logo ?? '') // Преобразуем путь перед сохранением
    }));
    const dataToSave = {
      ...dataJsonContent,
      teams: teamsToSave // Сохраняем команды с обработанными путями лого
    };
    await fs.promises.writeFile(dataFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Teams/players data saved successfully to data.json (async)");
  } catch (error) {
    console.error("[DATA] Error saving data asynchronously to data.json:", error);
  }
}

// --- Вспомогательные функции ---

/** Форматирует очки для победы/поражения (добавляет +) */
function formatWinPoints(value) {
  if (value === "" || value === null || typeof value === 'undefined') return "";
  const num = Number(value);
  if (isNaN(num)) return String(value); // Возвращаем как строку, если не число
  return (num >= 0 ? "+" : "") + num;
}

/** Форматирует очки, добавляя "pt" */
function formatPointsWithPt(value) {
    if (value === "" || value === null || typeof value === 'undefined') return "";
    const num = Number(value);
    if (isNaN(num)) {
        return String(value); // Возвращаем как строку, если не число
    }
    return `${value}pt`;
}

/** Преобразует абсолютный путь к логотипу в относительный (от папки public) */
function makeRelativePath(absolutePath) {
    if (!absolutePath || typeof absolutePath !== 'string') return "";
    // Ищем /public/ или \public\ (для Windows)
    const publicPartIndex = absolutePath.toLowerCase().search(/[\\/]public[\\/]/);
    if (publicPartIndex !== -1) {
        // Обрезаем все до /public/ включительно
        const relativePart = absolutePath.substring(publicPartIndex + 'public/'.length);
        // Заменяем обратные слеши на прямые и добавляем слеш в начало
        return "/" + relativePart.replace(/\\/g, "/");
    }
    // Если путь уже относительный (начинается с /logos), оставляем как есть
    if (absolutePath.startsWith('/logos/')) {
        return absolutePath;
    }
     // Если путь не содержит /public/ и не начинается с /logos/, возвращаем пустую строку или стандартную заглушку
    return ""; // Или defaultTeam1LogoPath;
}


/** Получает путь к логотипу команды для конкретного матча и статуса */
function getTeamLogoPath(match, teamKey, matchIndex) {
    if (!match) return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;

    let logoPath = "";
    // Определяем префикс статуса
    const statusPrefix = match.UPCOM_MATCH_STATUS === "UPCOM" ? "UPCOM_" :
                         match.LIVE_MATCH_STATUS === "LIVE" ? "LIVE_" :
                         match.FINISHED_MATCH_STATUS === "FINISHED" ? "FINISHED_" : "";

    if (statusPrefix) {
        // Сначала проверяем логотип, специфичный для статуса и матча (например, LIVE_TEAM1_LOGO_MATCH1)
        const specificMatchLogoKey = `${statusPrefix}${teamKey}_LOGO_MATCH${matchIndex}`;
        if (match[specificMatchLogoKey] && !match[specificMatchLogoKey].includes('none.png')) {
            logoPath = match[specificMatchLogoKey];
        } else {
             // Если специфичного нет, проверяем общий для статуса (например, LIVE_TEAM1_LOGO)
             const generalStatusLogoKey = `${statusPrefix}${teamKey}_LOGO`;
             if (match[generalStatusLogoKey] && !match[generalStatusLogoKey].includes('none.png')){
                 logoPath = match[generalStatusLogoKey];
             }
        }
    }

    // Если логотип не найден или это заглушка, возвращаем дефолтный
    if (!logoPath || logoPath.includes("none.png")) {
        return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;
    }
    // Всегда возвращаем относительный путь
    return makeRelativePath(logoPath);
}


/** Формирует данные VRS для ответа API /api/vrs/:id */
function getVRSResponse(matchId) {
    const rawVrsData = savedVRS[matchId] || defaultVrsStructure;
    const match = savedMatches[matchId - 1] || defaultMatchStructure;

    // Получаем актуальные пути к логотипам
    const team1Logo = getTeamLogoPath(match, 'TEAM1', matchId);
    const team2Logo = getTeamLogoPath(match, 'TEAM2', matchId);

    // Структура для пустого ответа
    const emptyBlock = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team2Logo }
    };

    let upcomData = { ...emptyBlock }; // По умолчанию для UPCOM/LIVE
    let finishedData = { ...emptyBlock }; // По умолчанию для FINISHED
    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png"; // Пути к фонам победы/поражения
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";
    const isFinished = match.FINISHED_MATCH_STATUS === "FINISHED";
    const isUpcomingOrLive = !isFinished;

    if (isUpcomingOrLive) {
         upcomData = {
             TEAM1: { winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), logo: team1Logo },
             TEAM2: { winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints), losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), logo: team2Logo }
         };
         // finishedData остается пустым (emptyBlock)
    } else { // Если статус FINISHED
        const winnerName = match.TEAMWINNER;
        const team1Name = match.FINISHED_TEAM1;
        const team2Name = match.FINISHED_TEAM2;

        // upcomData остается пустым (emptyBlock)

        if (winnerName && winnerName === team1Name) { // Team1 победила
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png";
            finishedData = {
                TEAM1: { winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), losePoints: "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints_win: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), currentPoints_lose: "", logo: team1Logo },
                TEAM2: { winPoints: "", losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), logo: team2Logo }
            };
        } else if (winnerName && winnerName === team2Name) { // Team2 победила
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
            finishedData = {
                TEAM1: { winPoints: "", losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), logo: team1Logo },
                TEAM2: { winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints), losePoints: "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints_win: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), currentPoints_lose: "", logo: team2Logo }
            };
        } else {
            // Если победитель не определен (ничья или ошибка), finishedData остается пустым
            finishedData = emptyBlock;
        }
    }
    // Возвращаем объект с данными для обоих состояний и фонами
    return { UPCOM: upcomData, FINISHED: finishedData, WIN_BG_TEAM_1: winBgTeam1, WIN_BG_TEAM_2: winBgTeam2 };
}

// --- API Эндпоинты ---

// Матчи
app.get("/api/matchdata", (req, res) => { res.json(savedMatches); });

app.get("/api/matchdata/:matchIndex", (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    res.json([savedMatches[index]]); // Возвращаем массив из одного элемента для консистентности
});

app.put("/api/matchdata/:matchIndex", async (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных матча." });

    // Сохраняем специфичные для матча логотипы
    const matchIndex = index + 1;
    const matchSpecificLogos = {};
    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = req.body?.[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] || getTeamLogoPath(savedMatches[index], 'TEAM1', matchIndex);
    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = req.body?.[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] || getTeamLogoPath(savedMatches[index], 'TEAM2', matchIndex);
    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = req.body?.[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] || getTeamLogoPath(savedMatches[index], 'TEAM1', matchIndex);
    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = req.body?.[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] || getTeamLogoPath(savedMatches[index], 'TEAM2', matchIndex);

    // Обновляем данные матча, сохраняя дефолтную структуру и специфичные лого
    savedMatches[index] = { ...defaultMatchStructure, ...req.body, ...matchSpecificLogos };
    console.log(`[API][PUT] /api/matchdata/${matchIndex} - Updated match data.`);
    await saveDbDataAsync();
    io.emit("jsonUpdate", savedMatches); // Отправляем обновленный полный список матчей
    console.log("[SOCKET] Emitted 'jsonUpdate' after match update.");
    res.status(200).json([savedMatches[index]]); // Возвращаем обновленный матч
});

// Map Veto
app.get("/api/mapveto", (req, res) => { res.json(savedMapVeto || defaultMapVetoStructure); });

app.post("/api/mapveto", async (req, res) => {
    // Простая валидация структуры
    if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
         return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
    }
    savedMapVeto = { ...defaultMapVetoStructure, ...req.body }; // Обновляем данные
    console.log("[API][POST] /api/mapveto - Received updated mapveto data for match:", savedMapVeto.matchIndex);
    await saveDbDataAsync();
    io.emit("mapVetoUpdate", savedMapVeto); // Отправляем обновление всем клиентам
    console.log("[SOCKET] Emitted 'mapVetoUpdate'.");
    res.status(200).json(savedMapVeto); // Возвращаем сохраненные данные
});

// VRS
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API][GET] /api/vrs-raw - Sending all raw VRS data");
    res.json(savedVRS || {}); // Возвращаем весь объект savedVRS
});

app.get("/api/vrs/:id", (req, res) => {
    const matchId = req.params.id;
    if (!/^[1-4]$/.test(matchId)) return res.status(404).json({ error: "Некорректный номер матча (1-4)." });
    console.log(`[API][GET] /api/vrs/${matchId} - Sending processed VRS data`);
    res.json([getVRSResponse(matchId)]); // Возвращаем обработанные данные в виде массива
});

app.put("/api/vrs/:id", async (req, res) => {
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    // Простая валидация структуры
    if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }
    // Обновляем данные VRS для конкретного матча, сохраняя структуру
    savedVRS[matchId] = { ...defaultVrsStructure }; // Начинаем с дефолта
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };

    console.log(`[API][PUT] /api/vrs/${matchId} - Updated VRS data.`);
    await saveDbDataAsync();
    io.emit("vrsUpdate", savedVRS); // Отправляем обновленные сырые данные всем клиентам
    console.log("[SOCKET] Emitted 'vrsUpdate' after VRS update.");
    res.status(200).json([savedVRS[matchId]]); // Возвращаем обновленные сырые данные
});

// Кастомные поля (Хедер)
app.get("/api/customfields", (req, res) => { res.json([customFieldsData || defaultCustomFieldsStructure]); });

app.post("/api/customfields", async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
    // Объединяем с дефолтной структурой, чтобы сохранить все поля
    customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
    console.log("[API][POST] /api/customfields - Received updated custom fields data.");
    await saveDbDataAsync();
    io.emit("customFieldsUpdate", customFieldsData); // Отправляем обновление
    console.log("[SOCKET] Emitted 'customFieldsUpdate'.");
    res.status(200).json(customFieldsData);
});

// Пауза
app.get("/api/pause", (req, res) => {
    console.log("[API][GET] /api/pause - Sending pause data");
    res.json([savedPauseData || defaultPauseDataStructure]);
});

app.post("/api/pause", async (req, res) => {
    // Проверяем наличие ожидаемых полей
    if (!req.body || typeof req.body.pause === 'undefined' || typeof req.body.lastUpd === 'undefined') {
        return res.status(400).json({ message: "Некорректный формат данных паузы (ожидаются поля 'pause' и 'lastUpd')." });
    }
    savedPauseData = { pause: req.body.pause ?? "", lastUpd: req.body.lastUpd ?? "" }; // Присваиваем, обрабатывая null/undefined
    console.log("[API][POST] /api/pause - Received updated pause data:", savedPauseData);
    await saveDbDataAsync();
    io.emit("pauseUpdate", savedPauseData); // Отправляем обновление
    console.log("[SOCKET] Emitted 'pauseUpdate'.");
    res.status(200).json(savedPauseData);
});

// Команды (используют data.json)
app.get("/api/teams", (req, res) => {
    // Возвращаем только массив команд
    res.json({ teams: dataJsonContent.teams || [] });
});

app.post("/api/teams", async (req, res) => {
    const newName = req.body.name?.trim();
    const newLogoRelative = makeRelativePath(req.body.logo?.trim() ?? ""); // Обрабатываем путь лого
    if (!newName) return res.status(400).json({ message: "Название команды не может быть пустым." });

    const newId = `team_${Date.now()}`; // Генерируем ID
    const newTeam = { ...defaultTeamStructure, id: newId, name: newName, logo: newLogoRelative };

    if (!Array.isArray(dataJsonContent.teams)) dataJsonContent.teams = [];
    dataJsonContent.teams.push(newTeam);
    console.log(`[API][POST] /api/teams - Added new team: ${newName} (ID: ${newId}, Logo: ${newLogoRelative})`);
    await saveDataJsonAsync(); // Сохраняем в data.json
    io.emit('teamsUpdate', dataJsonContent.teams); // Отправляем обновленный список команд
    console.log("[SOCKET] Emitted 'teamsUpdate' after adding team.");
    res.status(201).json(newTeam);
});

app.put("/api/teams/:id", async (req, res) => {
    const teamId = req.params.id;
    const newName = req.body.name?.trim();
    const newLogoRelative = makeRelativePath(req.body.logo?.trim() ?? "");
    if (!newName) return res.status(400).json({ message: "Новое название команды не может быть пустым." });

    const teamIndex = dataJsonContent.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return res.status(404).json({ message: `Команда с ID ${teamId} не найдена.` });

    // Обновляем данные команды
    dataJsonContent.teams[teamIndex].name = newName;
    dataJsonContent.teams[teamIndex].logo = newLogoRelative;
    console.log(`[API][PUT] /api/teams/${teamId} - Updated team name to: ${newName}, logo to: ${newLogoRelative}`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted 'teamsUpdate' after updating team.");
    res.status(200).json(dataJsonContent.teams[teamIndex]);
});

app.delete("/api/teams/:id", async (req, res) => {
    const teamId = req.params.id;
    const initialLength = dataJsonContent.teams.length;
    dataJsonContent.teams = dataJsonContent.teams.filter(t => t.id !== teamId);

    if (dataJsonContent.teams.length === initialLength) {
        return res.status(404).json({ message: `Команда с ID ${teamId} не найдена.` });
    }
    console.log(`[API][DELETE] /api/teams/${teamId} - Deleted team`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted 'teamsUpdate' after deleting team.");
    res.status(204).send(); // Успешное удаление без тела ответа
});

// --- API для Кастеров (используют db.json) ---
app.get("/api/casters", (req, res) => {
    console.log("[API][GET] /api/casters - Sending casters list");
    res.json(savedCasters || []);
});

app.post("/api/casters", async (req, res) => {
    const casterName = req.body.caster?.trim();
    const casterSocial = req.body.social?.trim() || ""; // Соц.сеть может быть пустой

    if (!casterName) {
        return res.status(400).json({ message: "Имя кастера не может быть пустым." });
    }

    // Проверка на дубликат имени
    if (savedCasters.some(c => c.caster.toLowerCase() === casterName.toLowerCase())) {
        return res.status(409).json({ message: `Кастер с именем "${casterName}" уже существует.` });
    }

    const newCaster = {
        id: `caster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Уникальный ID
        caster: casterName,
        social: casterSocial
    };
    savedCasters.push(newCaster);
    console.log(`[API][POST] /api/casters - Added new caster: ID ${newCaster.id}, Name: ${casterName}`);
    await saveDbDataAsync();
    io.emit('castersUpdate', savedCasters); // Отправляем обновленный список всем клиентам
    console.log("[SOCKET] Emitted 'castersUpdate' after adding caster.");
    res.status(201).json(newCaster); // Возвращаем созданного кастера
});

app.delete("/api/casters/:id", async (req, res) => {
    const casterId = req.params.id;
    const casterToDelete = savedCasters.find(c => c.id === casterId);

    if (!casterToDelete) {
        return res.status(404).json({ message: `Кастер с ID ${casterId} не найден.` });
    }

    const casterName = casterToDelete.caster; // Сохраняем имя для проверки в selectedCasters
    savedCasters = savedCasters.filter(c => c.id !== casterId);

    let selectedCastersChanged = false;
    // Если удаленный кастер был выбран, очищаем его из selectedCasters
    if (savedSelectedCasters.caster1 === casterName) {
        savedSelectedCasters.caster1 = null;
        selectedCastersChanged = true;
    }
    if (savedSelectedCasters.caster2 === casterName) {
        savedSelectedCasters.caster2 = null;
        selectedCastersChanged = true;
    }

    console.log(`[API][DELETE] /api/casters/${casterId} - Deleted caster '${casterName}'.`);
    await saveDbDataAsync(); // Сохраняем изменения в db.json
    io.emit('castersUpdate', savedCasters); // Отправляем обновленный список всех кастеров
    console.log("[SOCKET] Emitted 'castersUpdate' after deleting caster.");

    if(selectedCastersChanged){
         io.emit('selectedCastersUpdate', savedSelectedCasters); // Отправляем обновление выбранных, если они изменились
         console.log("[SOCKET] Emitted 'selectedCastersUpdate' after deleting caster.");
    }

    res.status(204).send(); // Успешное удаление
});


// API для выбранных кастеров
app.get("/api/selected-casters", (req, res) => {
    console.log("[API][GET] /api/selected-casters - Sending selected casters");
    res.json(savedSelectedCasters || defaultSelectedCastersStructure);
});

app.post("/api/selected-casters", async (req, res) => {
    const { caster1, caster2 } = req.body; // Ожидаем имена кастеров

    // Валидация: проверяем, существуют ли кастеры с такими именами
    if (caster1 && !savedCasters.some(c => c.caster === caster1)) {
        return res.status(400).json({ message: `Выбранный Кастер 1 ("${caster1}") не найден в общем списке.` });
    }
    if (caster2 && !savedCasters.some(c => c.caster === caster2)) {
        return res.status(400).json({ message: `Выбранный Кастер 2 ("${caster2}") не найден в общем списке.` });
    }
    // Проверка, что кастеры не одинаковые (если оба выбраны)
    if (caster1 && caster2 && caster1 === caster2) {
        return res.status(400).json({ message: "Кастер 1 и Кастер 2 не могут быть одинаковыми." });
    }

    // Обновляем сохраненные выбранные кастеры
    savedSelectedCasters = {
        caster1: caster1 || null, // Сохраняем имя или null
        caster2: caster2 || null,
    };
    console.log("[API][POST] /api/selected-casters - Updated selected casters:", savedSelectedCasters);
    await saveDbDataAsync(); // Сохраняем в db.json
    io.emit('selectedCastersUpdate', savedSelectedCasters); // Оповещаем клиентов
    console.log("[SOCKET] Emitted 'selectedCastersUpdate'.");
    res.status(200).json({ success: true, message: "Выбранные кастеры обновлены.", data: savedSelectedCasters });
});


// Отдельный JSON эндпоинт /casters для публичного использования
app.get("/casters", (req, res) => {
    const castersForPublicJson = savedCasters.map(c => ({
        caster: c.caster,
        social: c.social // Отдаем имя и соц.сеть
    }));
    console.log("[API][GET] /casters - Sending public JSON of casters");
    res.json(castersForPublicJson); // Возвращаем массив объектов
});


// --- Настройка Socket.IO ---
const server = http.createServer(app);
const io = new SocketIOServer(server);

io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Отправляем начальные данные подключившемуся клиенту
    socket.emit("jsonUpdate", savedMatches);
    socket.emit("customFieldsUpdate", customFieldsData);
    socket.emit("vrsUpdate", savedVRS);
    socket.emit("mapVetoUpdate", savedMapVeto);
    socket.emit("teamsUpdate", dataJsonContent.teams); // Список команд
    socket.emit("pauseUpdate", savedPauseData);
    socket.emit("castersUpdate", savedCasters); // Список всех кастеров
    socket.emit("selectedCastersUpdate", savedSelectedCasters); // Текущие выбранные кастеры

    // Обработка отключения
    socket.on("disconnect", (reason) => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}, Reason: ${reason}`);
    });

    // Обработка ошибок сокета
    socket.on('error', (error) => {
        console.error(`[SOCKET] Socket error for ${socket.id}:`, error);
    });
});

// --- Запуск сервера ---
server.listen(port, "0.0.0.0", () => {
    console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`);
});

// --- Graceful Shutdown ---
function gracefulShutdown() {
    console.log('[SERVER] Received kill signal, shutting down gracefully.');
    server.close(async () => {
        console.log('[SERVER] Closed out remaining connections.');
        // Опционально: Гарантированное сохранение данных перед выходом
        // await saveDbDataAsync();
        // await saveDataJsonAsync();
        process.exit(0);
    });

    // Принудительное завершение, если сервер не закрылся за 10 секунд
    setTimeout(() => {
        console.error('[SERVER] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 секунд таймаут
}

// Слушаем сигналы завершения
process.on('SIGTERM', gracefulShutdown); // kill
process.on('SIGINT', gracefulShutdown);  // Ctrl+C