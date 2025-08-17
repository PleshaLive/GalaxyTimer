// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");
const session = require('express-session'); // <--- ДОБАВЛЕНО

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

// Настройка сессий <--- ДОБАВЛЕНО
app.use(session({
    secret: 'ЗАМЕНИТЕ_ЭТО_НА_ОЧЕНЬ_СЕКРЕТНЫЙ_КЛЮЧ_!@#$%^&*()_+', // ОБЯЗАТЕЛЬНО ЗАМЕНИТЕ ЭТОТ КЛЮЧ!
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Установите true, если используете HTTPS в продакшене
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 день
    }
}));

// --- Вспомогательная функция для проверки аутентификации --- <--- ДОБАВЛЕНО
function requireLogin(req, res, next) {
    if (req.session && req.session.loggedIn) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

// --- Роуты ---

// Роуты, не требующие аутентификации (логин, выход, проверка состояния) <--- ИЗМЕНЕНО/ДОБАВЛЕНО
app.post("/login-action", (req, res) => {
    const { username, password } = req.body;
    if (username === "God" && password === "2007") {
        req.session.loggedIn = true;
        req.session.user = username;
        res.redirect("/");
    } else {
        res.redirect("/login.html?error=1");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Ошибка при выходе из системы:", err);
            return res.status(500).send("Не удалось выйти из системы.");
        }
        res.redirect('/login.html');
    });
});

app.get("/health", (req, res) => {
  // Проверка работоспособности сервера
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Защищенный роут для главной страницы <--- ИЗМЕНЕНО
app.get("/", requireLogin, (req, res) => {
  // Главная страница
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Общедоступные страницы (пример - teams.html, другие будут обслужены express.static)
app.get("/teams", (req, res) => {
  // Страница управления командами
  res.sendFile(path.join(__dirname, "public", "teams.html"));
});

// Обслуживание статических файлов (login.html, css, js, images, timer.html и т.д.)
// Этот middleware должен быть после специфических роутов, которые он мог бы перекрыть (например, "/").
app.use(express.static(path.join(__dirname, "public")));

// --- Структуры данных по умолчанию ---
const defaultLogoPlaceholder = "C:\\projects\\vMix_score\\public\\logos\\none.png"; // Локальная заглушка
const defaultMatchStructure = {
    UPCOM_MATCH_STATUS: "UPCOM", UPCOM_TIME: "", UPCOM_TEAM1: "", UPCOM_TEAM2: "", UPCOM_TEAM1_LOGO: defaultLogoPlaceholder, UPCOM_TEAM2_LOGO: defaultLogoPlaceholder, UPCOM_MAP1: "inferno", UPCOM_MAP1_SCORE: "", UPCOM_MAP2: "mirage", UPCOM_MAP2_SCORE: "", UPCOM_MAP3: "nuke", UPCOM_MAP3_SCORE: "", UPCOM_Cest: "", UPCOM_RectangleUP: "", UPCOM_RectangleLOW: "", UPCOM_vs_mini: "", UPCOM_vs_big: "", UPCOM_next: "", UPCOM_next_photo: "",
    LIVE_MATCH_STATUS: "", LIVE_TIME: "", LIVE_TEAM1: "", LIVE_TEAM2: "", LIVE_TEAM1_LOGO: defaultLogoPlaceholder, LIVE_TEAM2_LOGO: defaultLogoPlaceholder, LIVE_MAP1: "", LIVE_MAP1_SCORE: "", LIVE_MAP2: "", LIVE_MAP2_SCORE: "", LIVE_MAP3: "", LIVE_MAP3_SCORE: "", LIVE_Cest: "", LIVE_VS: "", LIVE_STATUS: "", LIVE_BG: "", LIVE_RectangleUP: "", LIVE_RectangleLOW: "",
    FINISHED_MATCH_STATUS: "", FINISHED_TIME: "", FINISHED_TEAM1: "", FINISHED_TEAM2: "", FINISHED_TEAM1_LOGO: defaultLogoPlaceholder, FINISHED_TEAM2_LOGO: defaultLogoPlaceholder, FINISHED_MAP1: "", FINISHED_MAP1_SCORE: "", FINISHED_MAP2: "", FINISHED_MAP2_SCORE: "", FINISHED_MAP3: "", FINISHED_MAP3_SCORE: "", FIN_RectangleUP: "", FIN_RectangleLOW: "",
    MP1_UPC: "", MP2_UPC: "", MP3_UPC: "", MP1_LIVE: "", MP2_LIVE: "", MP3_LIVE: "", MP1_FIN: "", MP2_FIN: "", MP3_FIN: "", Fin_cest: "", FIN_Result: "", FIN_VICTORY: "", TEAMWINNER: "", TEAMWINNER_LOGO: defaultLogoPlaceholder,
    MAP1_TEAM1logo: defaultLogoPlaceholder, MAP2_TEAM1logo: defaultLogoPlaceholder, MAP3_TEAM1logo: defaultLogoPlaceholder, MAP1_TEAM2logo: defaultLogoPlaceholder, MAP2_TEAM2logo: defaultLogoPlaceholder, MAP3_TEAM2logo: defaultLogoPlaceholder
};
const defaultVrsStructure = { TEAM1: { winPoints: null, losePoints: null, rank: null, currentPoints: null }, TEAM2: { winPoints: null, losePoints: null, rank: null, currentPoints: null } };
const defaultMapVetoStructure = { matchIndex: 1, teams: { TEAM1: {name: "", logo: ""}, TEAM2: {name: "", logo: ""} }, veto: Array(7).fill(null).map(() => ({action: "BAN", map: "inferno", team: "TEAM1", side: "-"})) };
const defaultCustomFieldsStructure = { upcomingMatches: "", galaxyBattle: "", tournamentStart: "", tournamentEnd: "", tournamentDay: "", groupStage: "" };
const defaultTeamStructure = { id: "", name: "", logo: "", score: 0 }; // Для data.json (команды)
const defaultPauseDataStructure = { pause: "", lastUpd: "", show: false };
const defaultCasterStructure = { id: "", caster: "", social: "" };
const defaultSelectedCastersStructure = { caster1: null, caster2: null }; // Хранит только ИМЕНА выбранных кастеров

// --- Хранилища данных в памяти ---
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {};
let customFieldsData = {};
let dataJsonContent = { teams: [], players: [] }; // Для команд и игроков из data.json
let savedPauseData = {};
let savedCasters = []; // Список всех кастеров {id, caster, social}
let savedSelectedCasters = { ...defaultSelectedCastersStructure }; // Имена выбранных кастеров
let timerData = { targetTime: null }; // <-- НОВОЕ: для данных таймера

// --- Пути к файлам ---
const dbFilePath = path.join(__dirname, "db.json"); // Основной файл БД
const dataFilePath = path.join(__dirname, "data.json"); // Файл для команд/игроков

// --- Функции загрузки и сохранения данных ---

/** Загружает данные из основного файла db.json */
function loadDbData() {
    let defaultDb; // Объявляем здесь, чтобы была доступна в catch
    try {
        defaultDb = { // Инициализируем здесь
            matches: Array(4).fill(null).map((_, i) => {
                const matchSpecificLogos = {};
                const matchIndex = i + 1;
                matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                return { ...defaultMatchStructure, ...matchSpecificLogos };
            }),
            mapVeto: { ...defaultMapVetoStructure },
            vrs: { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } },
            customFields: { ...defaultCustomFieldsStructure },
            pauseData: { ...defaultPauseDataStructure },
            casters: [],
            selectedCasters: { ...defaultSelectedCastersStructure },
            timerData: { targetTime: null } // <-- НОВОЕ ПОЛЕ В DB
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
            timerData = defaultDb.timerData; // <-- ЗАГРУЗКА
        } else {
            const rawData = fs.readFileSync(dbFilePath, "utf8");
            const jsonData = JSON.parse(rawData || "{}"); // Обработка пустого файла

            // Загрузка матчей с объединением дефолтной структуры
            savedMatches = (jsonData.matches && Array.isArray(jsonData.matches))
                ? jsonData.matches.map((m, i) => {
                    const matchSpecificLogos = {};
                    const matchIndex = i + 1;
                    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = m?.[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
                    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = m?.[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
                    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = m?.[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
                    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = m?.[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
                    return { ...defaultMatchStructure, ...(m || {}), ...matchSpecificLogos };
                })
                : defaultDb.matches;
            // Дополнение массива матчей до 4, если нужно
            while (savedMatches.length < 4) {
                const i = savedMatches.length;
                const matchSpecificLogos = {};
                const matchIndex = i + 1;
                matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                savedMatches.push({ ...defaultMatchStructure, ...matchSpecificLogos });
            }
             if (savedMatches.length > 4) savedMatches = savedMatches.slice(0, 4);

            // Загрузка остальных данных с объединением дефолтных структур
            savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
            savedVRS = { ...defaultDb.vrs }; // Начинаем с дефолта
            if (jsonData.vrs && typeof jsonData.vrs === 'object') {
                 for (const key in savedVRS) {
                     if (savedVRS.hasOwnProperty(key) && jsonData.vrs[key]) { // Добавлена проверка hasOwnProperty
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
            timerData = jsonData.timerData || { targetTime: null }; // <-- ЗАГРУЗКА ИЗ JSON ИЛИ ДЕФОЛТ

            console.log("[DATA] Data loaded successfully from db.json, timerData:", timerData);
        }
    } catch (error) {
        console.error("[DATA] Error loading data from db.json:", error);
        // В случае ошибки загрузки используем дефолтные значения (defaultDb должен быть доступен)
        if (!defaultDb) { // Если defaultDb не был инициализирован из-за ранней ошибки
            // Инициализируем defaultDb здесь снова, чтобы избежать ошибки ReferenceError
            defaultDb = {
                matches: Array(4).fill(null).map((_, i) => {
                    const matchSpecificLogos = {};
                    const matchIndex = i + 1;
                    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = defaultLogoPlaceholder;
                    return { ...defaultMatchStructure, ...matchSpecificLogos };
                }),
                mapVeto: { ...defaultMapVetoStructure },
                vrs: { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } },
                customFields: { ...defaultCustomFieldsStructure },
                pauseData: { ...defaultPauseDataStructure },
                casters: [],
                selectedCasters: { ...defaultSelectedCastersStructure },
                timerData: { targetTime: null } // <-- НОВОЕ ПОЛЕ В DB (в catch)
            };
        }
        savedMatches = defaultDb.matches;
        savedMapVeto = defaultDb.mapVeto;
        savedVRS = defaultDb.vrs;
        customFieldsData = defaultDb.customFields;
        savedPauseData = defaultDb.pauseData;
        savedCasters = defaultDb.casters;
        savedSelectedCasters = defaultDb.selectedCasters;
        timerData = defaultDb.timerData; // <-- ЗАГРУЗКА В CATCH
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
      selectedCasters: savedSelectedCasters, // Сохраняем только имена
      timerData: timerData // <-- СОХРАНЕНИЕ ДАННЫХ ТАЙМЕРА
    };
    // Используем асинхронную запись
    await fs.promises.writeFile(dbFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json (async), timerData:", timerData);
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
    // Если это уже URL, возвращаем как есть
    if (absolutePath.startsWith('http://') || absolutePath.startsWith('https://')) {
        return absolutePath;
    }
    // Если это уже относительный путь, начинающийся с /logos/, возвращаем как есть
    if (absolutePath.startsWith('/logos/')) {
        return absolutePath;
    }
    // Пытаемся извлечь относительный путь из локального абсолютного пути
    const publicPartIndex = absolutePath.toLowerCase().search(/[\\/]public[\\/]/);
    if (publicPartIndex !== -1) {
        const relativePart = absolutePath.substring(publicPartIndex + 'public/'.length);
        return "/" + relativePart.replace(/\\/g, "/");
    }
    // Если не удалось определить относительный путь, возвращаем исходное значение или пустую строку
    return absolutePath; // Или можно вернуть "" или defaultLogoPlaceholder
}


/** Формирует данные VRS для ответа API /api/vrs/:id */
function getVRSResponse(matchId) {
    const rawVrsData = savedVRS[matchId] || { ...defaultVrsStructure };
    const match = savedMatches[matchId - 1] || { ...defaultMatchStructure };

    let team1Logo = defaultLogoPlaceholder;
    let team2Logo = defaultLogoPlaceholder;

    const statusPrefix = match.UPCOM_MATCH_STATUS === "UPCOM" ? "UPCOM_" :
                         match.LIVE_MATCH_STATUS === "LIVE" ? "LIVE_" :
                         match.FINISHED_MATCH_STATUS === "FINISHED" ? "FINISHED_" : "";

    if (statusPrefix) {
        team1Logo = match[`${statusPrefix}TEAM1_LOGO`] || defaultLogoPlaceholder;
        team2Logo = match[`${statusPrefix}TEAM2_LOGO`] || defaultLogoPlaceholder;
    }

    const emptyBlock = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team2Logo }
    };

    let upcomData = { ...emptyBlock };
    upcomData.TEAM1.logo = team1Logo;
    upcomData.TEAM2.logo = team2Logo;

    let finishedData = { ...emptyBlock };
    finishedData.TEAM1.logo = team1Logo;
    finishedData.TEAM2.logo = team2Logo;

    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png";
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";
    const isFinished = match.FINISHED_MATCH_STATUS === "FINISHED";
    const isUpcomingOrLive = !isFinished;

    const team1Vrs = rawVrsData.TEAM1 || defaultVrsStructure.TEAM1;
    const team2Vrs = rawVrsData.TEAM2 || defaultVrsStructure.TEAM2;

    if (isUpcomingOrLive) {
         upcomData = {
             TEAM1: { winPoints: formatWinPoints(team1Vrs.winPoints), losePoints: team1Vrs.losePoints !== null ? -Math.abs(team1Vrs.losePoints) : "", rank: team1Vrs.rank ?? "", currentPoints: formatPointsWithPt(team1Vrs.currentPoints), logo: team1Logo },
             TEAM2: { winPoints: formatWinPoints(team2Vrs.winPoints), losePoints: team2Vrs.losePoints !== null ? -Math.abs(team2Vrs.losePoints) : "", rank: team2Vrs.rank ?? "", currentPoints: formatPointsWithPt(team2Vrs.currentPoints), logo: team2Logo }
         };
        finishedData = {
            TEAM1: { ...emptyBlock.TEAM1, logo: team1Logo },
            TEAM2: { ...emptyBlock.TEAM2, logo: team2Logo }
        };
    } else { // Статус FINISHED
        const winnerName = match.TEAMWINNER;
        const team1Name = match.FINISHED_TEAM1;
        const team2Name = match.FINISHED_TEAM2;
        if (winnerName && winnerName === team1Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png";
            finishedData = {
                TEAM1: { winPoints: formatWinPoints(team1Vrs.winPoints), losePoints: "", rank: team1Vrs.rank ?? "", currentPoints_win: formatPointsWithPt(team1Vrs.currentPoints), currentPoints_lose: "", currentPoints: "", logo: team1Logo },
                TEAM2: { winPoints: "", losePoints: team2Vrs.losePoints !== null ? -Math.abs(team2Vrs.losePoints) : "", rank: team2Vrs.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(team2Vrs.currentPoints), currentPoints: "", logo: team2Logo }
            };
        } else if (winnerName && winnerName === team2Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
            finishedData = {
                TEAM1: { winPoints: "", losePoints: team1Vrs.losePoints !== null ? -Math.abs(team1Vrs.losePoints) : "", rank: team1Vrs.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(team1Vrs.currentPoints), currentPoints: "", logo: team1Logo },
                TEAM2: { winPoints: formatWinPoints(team2Vrs.winPoints), losePoints: "", rank: team2Vrs.rank ?? "", currentPoints_win: formatPointsWithPt(team2Vrs.currentPoints), currentPoints_lose: "", currentPoints: "", logo: team2Logo }
            };
        } else { // Ничья или победитель не определен
            finishedData = {
                TEAM1: { winPoints: "", losePoints: "", rank: team1Vrs.rank ?? "", currentPoints_win: "", currentPoints_lose: "", currentPoints: formatPointsWithPt(team1Vrs.currentPoints), logo: team1Logo },
                TEAM2: { winPoints: "", losePoints: "", rank: team2Vrs.rank ?? "", currentPoints_win: "", currentPoints_lose: "", currentPoints: formatPointsWithPt(team2Vrs.currentPoints), logo: team2Logo }
            };
        }
        upcomData = {
            TEAM1: { ...emptyBlock.TEAM1, logo: team1Logo },
            TEAM2: { ...emptyBlock.TEAM2, logo: team2Logo }
        };
    }
    return { UPCOM: upcomData, FINISHED: finishedData, WIN_BG_TEAM_1: winBgTeam1, WIN_BG_TEAM_2: winBgTeam2 };
}

/**
 * Формирует объект с выбранными кастерами и их социальными сетями.
 */
function getFormattedSelectedCasters() {
    const result = { caster1: null, caster1soc: null, caster2: null, caster2soc: null };
    if (savedSelectedCasters.caster1) {
        const caster1Data = savedCasters.find(c => c.caster === savedSelectedCasters.caster1);
        if (caster1Data) { result.caster1 = caster1Data.caster; result.caster1soc = caster1Data.social; }
        else { console.warn(`[Server] Ранее выбранный caster1 "${savedSelectedCasters.caster1}" не найден.`); }
    }
    if (savedSelectedCasters.caster2) {
        const caster2Data = savedCasters.find(c => c.caster === savedSelectedCasters.caster2);
        if (caster2Data) { result.caster2 = caster2Data.caster; result.caster2soc = caster2Data.social; }
        else { console.warn(`[Server] Ранее выбранный caster2 "${savedSelectedCasters.caster2}" не найден.`); }
    }
    return result;
}


// --- API Эндпоинты (Остаются общедоступными) ---

// Матчи
app.get("/api/matchdata", (req, res) => { res.json(savedMatches); });
app.get("/api/matchdata/:matchIndex", (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    res.json([savedMatches[index]]);
});
app.put("/api/matchdata/:matchIndex", async (req, res) => {
    const index = parseInt(req.params.matchIndex, 10) - 1;
    if (isNaN(index) || index < 0 || index >= savedMatches.length) return res.status(404).json({ message: `Матч ${req.params.matchIndex} не найден.` });
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных матча." });
    const matchIndex = index + 1;
    const matchSpecificLogos = {};
    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] = req.body?.[`FINISHED_TEAM1_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] = req.body?.[`FINISHED_TEAM2_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] = req.body?.[`LIVE_TEAM1_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] = req.body?.[`LIVE_TEAM2_LOGO_MATCH${matchIndex}`] || defaultLogoPlaceholder;
    savedMatches[index] = { ...defaultMatchStructure, ...req.body, ...matchSpecificLogos };
    console.log(`[API][PUT] /api/matchdata/${matchIndex} - Updated match data.`);
    await saveDbDataAsync();
    io.emit("jsonUpdate", savedMatches);
    console.log("[SOCKET] Emitted 'jsonUpdate' after match update.");
    res.status(200).json([savedMatches[index]]);
});

// Map Veto
app.get("/api/mapveto", (req, res) => { res.json(savedMapVeto || defaultMapVetoStructure); });
app.post("/api/mapveto", async (req, res) => {
    if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) {
        return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
    }
    savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
    console.log("[API][POST] /api/mapveto - Received updated mapveto data for match:", savedMapVeto.matchIndex);
    await saveDbDataAsync();
    io.emit("mapVetoUpdate", savedMapVeto);
    console.log("[SOCKET] Emitted 'mapVetoUpdate'.");
    res.status(200).json(savedMapVeto);
});

// VRS
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API][GET] /api/vrs-raw - Sending all raw VRS data");
    res.json(savedVRS || {});
});
app.get("/api/vrs/:id", (req, res) => {
    const matchId = req.params.id;
    if (!/^[1-4]$/.test(matchId)) return res.status(404).json({ error: "Некорректный номер матча (1-4)." });
    console.log(`[API][GET] /api/vrs/${matchId} - Sending processed VRS data`);
    res.json([getVRSResponse(matchId)]);
});
app.put("/api/vrs/:id", async (req, res) => {
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) {
        return res.status(400).json({ message: "Некорректный формат данных VRS." });
    }
    savedVRS[matchId] = { ...defaultVrsStructure };
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };
    console.log(`[API][PUT] /api/vrs/${matchId} - Updated VRS data.`);
    await saveDbDataAsync();
    io.emit("vrsUpdate", savedVRS);
    console.log("[SOCKET] Emitted 'vrsUpdate' after VRS update.");
    res.status(200).json([savedVRS[matchId]]);
});

// Кастомные поля
app.get("/api/customfields", (req, res) => { res.json([customFieldsData || defaultCustomFieldsStructure]); });
app.post("/api/customfields", async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
    customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
    console.log("[API][POST] /api/customfields - Received updated custom fields data.");
    await saveDbDataAsync();
    io.emit("customFieldsUpdate", customFieldsData);
    console.log("[SOCKET] Emitted 'customFieldsUpdate'.");
    res.status(200).json(customFieldsData);
});

// Пауза
app.get("/api/pause", (req, res) => {
    console.log("[API][GET] /api/pause - Sending pause data");
    const responseObj = { ...defaultPauseDataStructure, ...(savedPauseData || {}) };
    res.json([responseObj]);
});
app.post("/api/pause", async (req, res) => {
    if (!req.body || (typeof req.body.pause === 'undefined' && typeof req.body.lastUpd === 'undefined' && typeof req.body.show === 'undefined')) {
        return res.status(400).json({ message: "Некорректный формат данных паузы (ожидаются поля 'pause', 'lastUpd' и/или 'show')." });
    }
    // поддерживаем частичные обновления
    const coerceBool = (v) => {
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            return s === '1' || s === 'true' || s === 'yes' || s === 'on';
        }
        return !!v;
    };
    savedPauseData = {
        ...defaultPauseDataStructure,
        ...savedPauseData,
        ...(typeof req.body.pause !== 'undefined' ? { pause: req.body.pause ?? "" } : {}),
        ...(typeof req.body.lastUpd !== 'undefined' ? { lastUpd: req.body.lastUpd ?? "" } : {}),
        ...(typeof req.body.show !== 'undefined' ? { show: coerceBool(req.body.show) } : {})
    };
    console.log("[API][POST] /api/pause - Received updated pause data:", savedPauseData);
    await saveDbDataAsync();
    io.emit("pauseUpdate", savedPauseData);
    console.log("[SOCKET] Emitted 'pauseUpdate'.");
    res.status(200).json(savedPauseData);
});

// Команды (data.json)
app.get("/api/teams", (req, res) => {
    console.warn("[API][GET] /api/teams - WARNING: This endpoint reads from local data.json, but client is configured to fetch from external API.");
    res.json({ teams: dataJsonContent.teams || [] });
});
app.post("/api/teams", async (req, res) => {
    console.warn("[API][POST] /api/teams - WARNING: Client might not use teams added/updated via this local endpoint.");
    const teamName = req.body.name?.trim();
    const teamLogo = req.body.logo?.trim() || "";
    if (!teamName) { return res.status(400).json({ message: "Название команды не может быть пустым." }); }
    if (dataJsonContent.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
        return res.status(409).json({ message: `Команда с именем "${teamName}" уже существует в data.json.` });
    }
    const newTeam = { id: `${Date.now()}`, name: teamName, logo: teamLogo, score: 0 };
    dataJsonContent.teams.push(newTeam);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    res.status(201).json(newTeam);
});
app.put("/api/teams/:id", async (req, res) => {
    console.warn("[API][PUT] /api/teams/:id - WARNING: Client might not use teams added/updated via this local endpoint.");
    const teamId = req.params.id;
    const { name: newNameRaw, logo: newLogoRaw } = req.body;
    const newName = newNameRaw?.trim();
    const newLogo = newLogoRaw?.trim() || "";
    if (!newName) { return res.status(400).json({ message: "Название команды не может быть пустым." }); }
    const teamIndex = dataJsonContent.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) { return res.status(404).json({ message: `Команда с ID ${teamId} не найдена в data.json.` }); }
    const originalName = dataJsonContent.teams[teamIndex].name;
    if (newName.toLowerCase() !== originalName.toLowerCase() &&
        dataJsonContent.teams.some(t => t.id !== teamId && t.name.toLowerCase() === newName.toLowerCase())) {
        return res.status(409).json({ message: `Команда с именем "${newName}" уже существует в data.json.` });
    }
    dataJsonContent.teams[teamIndex].name = newName;
    dataJsonContent.teams[teamIndex].logo = newLogo;
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    res.status(200).json(dataJsonContent.teams[teamIndex]);
});
app.delete("/api/teams/:id", async (req, res) => {
    console.warn("[API][DELETE] /api/teams/:id - WARNING: Client might not use teams added/updated via this local endpoint.");
    const teamId = req.params.id;
    const initialLength = dataJsonContent.teams.length;
    dataJsonContent.teams = dataJsonContent.teams.filter(t => t.id !== teamId);
    if (dataJsonContent.teams.length === initialLength) {
        return res.status(404).json({ message: `Команда с ID ${teamId} не найдена в data.json.` });
    }
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    res.status(204).send();
});

// API для Кастеров (db.json)
app.get("/api/casters", (req, res) => {
    console.log("[API][GET] /api/casters - Sending casters list");
    res.json(savedCasters || []);
});
app.post("/api/casters", async (req, res) => {
    const casterName = req.body.caster?.trim();
    const casterSocial = req.body.social?.trim() || "";
    if (!casterName) { return res.status(400).json({ message: "Имя кастера не может быть пустым." }); }
    if (savedCasters.some(c => c.caster.toLowerCase() === casterName.toLowerCase())) {
        return res.status(409).json({ message: `Кастер с именем "${casterName}" уже существует.` });
    }
    const newCaster = { id: `caster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, caster: casterName, social: casterSocial };
    savedCasters.push(newCaster);
    console.log(`[API][POST] /api/casters - Added new caster: ID ${newCaster.id}, Name: ${casterName}`);
    await saveDbDataAsync();
    io.emit('castersUpdate', savedCasters);
    console.log("[SOCKET] Emitted 'castersUpdate' after adding caster.");
    res.status(201).json(newCaster);
});
app.put("/api/casters/:id", async (req, res) => {
    const casterId = req.params.id;
    const { caster: newNameRaw, social: newSocialRaw } = req.body;
    const newName = newNameRaw?.trim();
    const newSocial = newSocialRaw?.trim() || "";
    if (!newName) { return res.status(400).json({ message: "Имя кастера не может быть пустым." }); }
    const casterIndex = savedCasters.findIndex(c => c.id === casterId);
    if (casterIndex === -1) { return res.status(404).json({ message: `Кастер с ID ${casterId} не найден.` }); }
    const originalCaster = savedCasters[casterIndex];
    const originalName = originalCaster.caster;
    if (newName.toLowerCase() !== originalName.toLowerCase() &&
        savedCasters.some(c => c.id !== casterId && c.caster.toLowerCase() === newName.toLowerCase())) {
        return res.status(409).json({ message: `Кастер с именем "${newName}" уже существует.` });
    }
    savedCasters[casterIndex].caster = newName;
    savedCasters[casterIndex].social = newSocial;
    console.log(`[API][PUT] /api/casters/${casterId} - Updated caster. Name: ${originalName} -> ${newName}, Social updated.`);
    let selectedCastersChanged = false;
    if (originalName === savedSelectedCasters.caster1 && newName !== originalName) {
        savedSelectedCasters.caster1 = newName; selectedCastersChanged = true;
        console.log(`[Data] Updated selectedCasters.caster1 due to name change: ${originalName} -> ${newName}`);
    }
    if (originalName === savedSelectedCasters.caster2 && newName !== originalName) {
        savedSelectedCasters.caster2 = newName; selectedCastersChanged = true;
        console.log(`[Data] Updated selectedCasters.caster2 due to name change: ${originalName} -> ${newName}`);
    }
    await saveDbDataAsync();
    io.emit('castersUpdate', savedCasters);
    console.log("[SOCKET] Emitted 'castersUpdate' after editing caster.");
    if (selectedCastersChanged) {
        const formattedSelected = getFormattedSelectedCasters();
        io.emit('selectedCastersUpdate', formattedSelected);
        console.log("[SOCKET] Emitted 'selectedCastersUpdate' after editing caster (name changed).");
    }
    res.status(200).json(savedCasters[casterIndex]);
});
app.delete("/api/casters/:id", async (req, res) => {
    const casterId = req.params.id;
    const casterToDelete = savedCasters.find(c => c.id === casterId);
    if (!casterToDelete) { return res.status(404).json({ message: `Кастер с ID ${casterId} не найден.` }); }
    const casterName = casterToDelete.caster;
    savedCasters = savedCasters.filter(c => c.id !== casterId);
    let selectedCastersChanged = false;
    if (savedSelectedCasters.caster1 === casterName) {
        savedSelectedCasters.caster1 = null; selectedCastersChanged = true;
    }
    if (savedSelectedCasters.caster2 === casterName) {
        savedSelectedCasters.caster2 = null; selectedCastersChanged = true;
    }
    console.log(`[API][DELETE] /api/casters/${casterId} - Deleted caster '${casterName}'.`);
    await saveDbDataAsync();
    io.emit('castersUpdate', savedCasters);
    console.log("[SOCKET] Emitted 'castersUpdate' after deleting caster.");
    if(selectedCastersChanged){
         const formattedData = getFormattedSelectedCasters();
         io.emit('selectedCastersUpdate', formattedData);
         console.log("[SOCKET] Emitted 'selectedCastersUpdate' with new format after deleting caster.");
    }
    res.status(204).send();
});

// API для выбранных кастеров
app.get("/api/selected-casters", (req, res) => {
    console.log("[API][GET] /api/selected-casters - Sending formatted selected casters");
    const formattedData = getFormattedSelectedCasters();
    res.json([formattedData]);
});
app.post("/api/selected-casters", async (req, res) => {
    const { caster1, caster2 } = req.body;
    if (caster1 && !savedCasters.some(c => c.caster === caster1)) { return res.status(400).json({ message: `Выбранный Кастер 1 ("${caster1}") не найден.` }); }
    if (caster2 && !savedCasters.some(c => c.caster === caster2)) { return res.status(400).json({ message: `Выбранный Кастер 2 ("${caster2}") не найден.` }); }
    if (caster1 && caster2 && caster1 === caster2) { return res.status(400).json({ message: "Кастер 1 и Кастер 2 не могут быть одинаковыми." }); }
    savedSelectedCasters = { caster1: caster1 || null, caster2: caster2 || null };
    console.log("[API][POST] /api/selected-casters - Updated selected caster names in storage:", savedSelectedCasters);
    await saveDbDataAsync();
    const formattedData = getFormattedSelectedCasters();
    io.emit('selectedCastersUpdate', formattedData);
    console.log("[SOCKET] Emitted 'selectedCastersUpdate' with new format.");
    res.status(200).json({ success: true, message: "Выбранные кастеры обновлены.", data: formattedData });
});

// Отдельный JSON эндпоинт /casters для публичного использования
app.get("/casters", (req, res) => {
    const castersForPublicJson = savedCasters.map(c => ({ caster: c.caster, social: c.social }));
    console.log("[API][GET] /casters - Sending public JSON of casters");
    res.json(castersForPublicJson);
});

// НОВЫЕ ЭНДПОИНТЫ ДЛЯ ТАЙМЕРА
app.get('/timer', (req, res) => {
    console.log('[API][GET] /timer - Sending current timer data:', timerData);
    res.json(timerData);
});
app.post('/timer', async (req, res) => {
    const { targetTime } = req.body;
    if (typeof targetTime === 'number' && targetTime > 0) {
        timerData.targetTime = targetTime;
        console.log('[API][POST] /timer - Timer targetTime updated to:', new Date(targetTime).toLocaleString(), `(Timestamp: ${targetTime})`);
        await saveDbDataAsync();
        io.emit('timerStateUpdate', timerData);
        console.log("[SOCKET] Emitted 'timerStateUpdate' with data:", timerData);
        return res.json({ success: true, message: "Таймер обновлен", targetTime: timerData.targetTime });
    } else {
        console.error('[API][POST] /timer - Invalid targetTime received:', targetTime);
        return res.status(400).json({ success: false, error: 'Некорректное значение targetTime. Ожидается timestamp.' });
    }
});
app.get('/set_timer', async (req, res) => {
    const durationStr = req.query.duration;
    if (typeof durationStr === 'undefined') {
        console.log('[API][GET] /set_timer - Ошибка: Параметр duration отсутствует.');
        return res.status(400).json({ success: false, error: 'Параметр duration отсутствует' });
    }
    const duration = parseInt(durationStr, 10);
    if (isNaN(duration) || duration <= 0) {
        console.log('[API][GET] /set_timer - Ошибка: Неверное значение длительности. Получено:', durationStr);
        return res.status(400).json({ success: false, error: 'Неверное значение длительности. Ожидается положительное число миллисекунд.' });
    }
    timerData.targetTime = Date.now() + duration;
    console.log(`[API][GET] /set_timer - Таймер установлен по длительности: ${duration} мс. Новое целевое время: ${new Date(timerData.targetTime).toLocaleString()} (Timestamp: ${timerData.targetTime})`);
    try {
        await saveDbDataAsync();
        io.emit('timerStateUpdate', timerData);
        console.log("[SOCKET] Emitted 'timerStateUpdate' after /set_timer call.");
        res.json({ success: true, message: `Таймер установлен на ${duration / 1000} секунд`, targetTime: timerData.targetTime });
    } catch (error) {
        console.error("[API][GET] /set_timer - Ошибка при сохранении или отправке сокет сообщения:", error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера при обновлении таймера.' });
    }
});

// --- Настройка Socket.IO ---
const server = http.createServer(app);
const io = new SocketIOServer(server);

io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    socket.emit("jsonUpdate", savedMatches);
    socket.emit("customFieldsUpdate", customFieldsData);
    socket.emit("vrsUpdate", savedVRS);
    socket.emit("mapVetoUpdate", savedMapVeto);
    socket.emit("pauseUpdate", savedPauseData);
    socket.emit("castersUpdate", savedCasters);
    socket.emit("selectedCastersUpdate", getFormattedSelectedCasters());
    socket.emit("timerStateUpdate", timerData);

    socket.on("disconnect", (reason) => { console.log(`[SOCKET] Client disconnected: ${socket.id}, Reason: ${reason}`); });
    socket.on('error', (error) => { console.error(`[SOCKET] Socket error for ${socket.id}:`, error); });
});

// --- Запуск сервера ---
server.listen(port, "0.0.0.0", () => {
    console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`);
    console.log(`[SERVER] Страница входа: http://localhost:${port}/login.html (или ваш IP)`);
});

// Публичная страница оверлея паузы для OBS/vMix
// По умолчанию перенаправляем на 100% масштаб и якорь top-right
app.get('/pause', (req, res) => {
    const hasQuery = req.url.includes('?');
    if (hasQuery) {
        // Сохраняем любые переданные параметры и передаём их на pause.html
        const query = req.url.substring(req.url.indexOf('?'));
        return res.redirect(302, '/pause.html' + query);
    }
    return res.redirect(302, '/pause.html?scale=1&anchor=tr');
});

// --- Graceful Shutdown ---
function gracefulShutdown() {
    console.log('[SERVER] Received kill signal, shutting down gracefully.');
    server.close(async () => {
        console.log('[SERVER] Closed out remaining connections.');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('[SERVER] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);