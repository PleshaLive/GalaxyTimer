// server.js (Версия без аутентификации, с CRUD для команд, обработкой VRS и API паузы)
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server: SocketIOServer } = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

app.use((req, res, next) => {
  console.log(`[LOG] ${new Date().toISOString()} ${req.method} ${req.path} ${req.ip}`);
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/teams", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "teams.html"));
});

const defaultTeam1LogoPath = "/logos/default1.png"; // Используйте относительные пути для доступности клиентом
const defaultTeam2LogoPath = "/logos/default2.png";

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
const defaultTeamStructure = { id: "", name: "", logo: "", score: 0 };
const defaultDataJsonStructure = { teams: [], players: [] };
const defaultPauseDataStructure = { pause: "", lastUpd: "" };

let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {}; // Это будет объект вида {"1": {...}, "2": {...}, ...}
let customFieldsData = {};
let dataJsonContent = { teams: [], players: [] };
let savedPauseData = {};

const dbFilePath = path.join(__dirname, "db.json");
const dataFilePath = path.join(__dirname, "data.json");

function loadDbData() {
    try {
        const defaultDbData = {
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
            pauseData: { ...defaultPauseDataStructure }
        };
        if (!fs.existsSync(dbFilePath)) {
            fs.writeFileSync(dbFilePath, JSON.stringify(defaultDbData, null, 2), "utf8");
            console.log(`[DATA] Created default db file at ${dbFilePath}`);
            savedMatches = defaultDbData.matches;
            savedMapVeto = defaultDbData.mapVeto;
            savedVRS = defaultDbData.vrs;
            customFieldsData = defaultDbData.customFields;
            savedPauseData = defaultDbData.pauseData;
        } else {
            const rawData = fs.readFileSync(dbFilePath, "utf8");
            const jsonData = JSON.parse(rawData);
            
            savedMatches = (jsonData.matches && Array.isArray(jsonData.matches)) 
                ? jsonData.matches.map((m, i) => {
                    const matchSpecificLogos = {};
                    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${i+1}`] = m?.[`FINISHED_TEAM1_LOGO_MATCH${i+1}`] || defaultTeam1LogoPath;
                    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${i+1}`] = m?.[`FINISHED_TEAM2_LOGO_MATCH${i+1}`] || defaultTeam2LogoPath;
                    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${i+1}`] = m?.[`LIVE_TEAM1_LOGO_MATCH${i+1}`] || defaultTeam1LogoPath;
                    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${i+1}`] = m?.[`LIVE_TEAM2_LOGO_MATCH${i+1}`] || defaultTeam2LogoPath;
                    return { ...defaultMatchStructure, ...(m || {}), ...matchSpecificLogos };
                }) 
                : defaultDbData.matches;

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

            savedMapVeto = { ...defaultMapVetoStructure, ...(jsonData.mapVeto || {}) };
            savedVRS = { ...defaultDbData.vrs }; // Start with default
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
            console.log("[DATA] Data loaded successfully from db.json");
        }
    } catch (error) {
        console.error("[DATA] Error loading data from db.json:", error);
        savedMatches = Array(4).fill(null).map((_, i) => {
            const matchSpecificLogos = {};
            matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
            matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
            matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${i+1}`] = defaultTeam1LogoPath;
            matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${i+1}`] = defaultTeam2LogoPath;
            return { ...defaultMatchStructure, ...matchSpecificLogos };
        });
        savedMapVeto = { ...defaultMapVetoStructure };
        savedVRS = { "1": { ...defaultVrsStructure }, "2": { ...defaultVrsStructure }, "3": { ...defaultVrsStructure }, "4": { ...defaultVrsStructure } };
        customFieldsData = { ...defaultCustomFieldsStructure };
        savedPauseData = { ...defaultPauseDataStructure };
    }
}

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

loadDbData();
loadDataJson();

async function saveDbDataAsync() {
  try {
    const dataToSave = {
      matches: savedMatches,
      mapVeto: savedMapVeto,
      vrs: savedVRS,
      customFields: customFieldsData,
      pauseData: savedPauseData
    };
    await fs.promises.writeFile(dbFilePath, JSON.stringify(dataToSave, null, 2), "utf8");
    console.log("[DATA] Data saved successfully to db.json (async)");
  } catch (error) {
    console.error("[DATA] Error saving data asynchronously to db.json:", error);
  }
}

async function saveDataJsonAsync() {
  try {
    const teamsToSave = dataJsonContent.teams.map(team => ({
      ...team,
      logo: makeRelativePath(team.logo ?? '')
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

function formatWinPoints(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num)) return value;
  return (num >= 0 ? "+" : "") + num;
}

function formatPointsWithPt(value) {
    if (value === "" || value === null || value === undefined) return "";
    const num = Number(value);
    if (isNaN(num)) {
        return value;
    }
    return `${value}pt`;
}

function makeRelativePath(absolutePath) {
    if (!absolutePath || typeof absolutePath !== 'string') return "";
    const publicPartIndex = absolutePath.toLowerCase().search(/[\\/]public[\\/]/);
    if (publicPartIndex !== -1) {
        const relativePart = absolutePath.substring(publicPartIndex + 'public/'.length);
        return "/" + relativePart.replace(/\\/g, "/");
    }
    return absolutePath.startsWith('/') ? absolutePath : "";
}

function getTeamLogoPath(match, teamKey, matchIndex) { // Добавлен matchIndex
    if (!match) return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;

    let logoPath = "";
    const statusPrefix = match.UPCOM_MATCH_STATUS === "UPCOM" ? "UPCOM_" :
                         match.LIVE_MATCH_STATUS === "LIVE" ? "LIVE_" :
                         match.FINISHED_MATCH_STATUS === "FINISHED" ? "FINISHED_" : "";
    
    if (statusPrefix) {
        logoPath = match[`${statusPrefix}${teamKey}_LOGO`];
    }
    
    // Проверяем специфичные для матча логотипы, если основной не найден или дефолтный
    if (!logoPath || logoPath.includes("default1.png") || logoPath.includes("default2.png")) {
        if (matchIndex && match[`${statusPrefix}${teamKey}_LOGO_MATCH${matchIndex}`]) {
            logoPath = match[`${statusPrefix}${teamKey}_LOGO_MATCH${matchIndex}`];
        }
    }
    
    if (!logoPath || logoPath.includes("default1.png") || logoPath.includes("default2.png")) {
        return teamKey === 'TEAM1' ? defaultTeam1LogoPath : defaultTeam2LogoPath;
    }
    return makeRelativePath(logoPath);
}


function getVRSResponse(matchId) {
    const rawVrsData = savedVRS[matchId] || defaultVrsStructure;
    const match = savedMatches[matchId - 1] || defaultMatchStructure;
    const team1Logo = getTeamLogoPath(match, 'TEAM1', matchId); // Передаем matchId
    const team2Logo = getTeamLogoPath(match, 'TEAM2', matchId); // Передаем matchId

    const emptyBlock = {
        TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team1Logo },
        TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", currentPoints: "", logo: team2Logo }
    };

    let upcomData = {};
    let finishedData = {};
    let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png";
    let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";
    const isFinished = match.FINISHED_MATCH_STATUS === "FINISHED";

    if (isFinished) {
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
                TEAM1: { winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), losePoints: "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints_win: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), currentPoints_lose: "", logo: team1Logo },
                TEAM2: { winPoints: "", losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), logo: team2Logo }
            };
        } else if (winnerName && winnerName === team2Name) {
            winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
            winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
            finishedData = {
                TEAM1: { winPoints: "", losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints_win: "", currentPoints_lose: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), logo: team1Logo },
                TEAM2: { winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints), losePoints: "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints_win: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), currentPoints_lose: "", logo: team2Logo }
            };
        } else {
            finishedData = emptyBlock;
        }
    } else {
        upcomData = {
            TEAM1: { winPoints: formatWinPoints(rawVrsData.TEAM1.winPoints), losePoints: rawVrsData.TEAM1.losePoints !== null ? -Math.abs(rawVrsData.TEAM1.losePoints) : "", rank: rawVrsData.TEAM1.rank ?? "", currentPoints: formatPointsWithPt(rawVrsData.TEAM1.currentPoints), logo: team1Logo },
            TEAM2: { winPoints: formatWinPoints(rawVrsData.TEAM2.winPoints), losePoints: rawVrsData.TEAM2.losePoints !== null ? -Math.abs(rawVrsData.TEAM2.losePoints) : "", rank: rawVrsData.TEAM2.rank ?? "", currentPoints: formatPointsWithPt(rawVrsData.TEAM2.currentPoints), logo: team2Logo }
        };
        finishedData = emptyBlock;
    }
    return { UPCOM: upcomData, FINISHED: finishedData, WIN_BG_TEAM_1: winBgTeam1, WIN_BG_TEAM_2: winBgTeam2 };
}

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
    
    const matchSpecificLogos = {};
    matchSpecificLogos[`FINISHED_TEAM1_LOGO_MATCH${index+1}`] = req.body?.[`FINISHED_TEAM1_LOGO_MATCH${index+1}`] || getTeamLogoPath(savedMatches[index], 'TEAM1', index+1);
    matchSpecificLogos[`FINISHED_TEAM2_LOGO_MATCH${index+1}`] = req.body?.[`FINISHED_TEAM2_LOGO_MATCH${index+1}`] || getTeamLogoPath(savedMatches[index], 'TEAM2', index+1);
    matchSpecificLogos[`LIVE_TEAM1_LOGO_MATCH${index+1}`] = req.body?.[`LIVE_TEAM1_LOGO_MATCH${index+1}`] || getTeamLogoPath(savedMatches[index], 'TEAM1', index+1);
    matchSpecificLogos[`LIVE_TEAM2_LOGO_MATCH${index+1}`] = req.body?.[`LIVE_TEAM2_LOGO_MATCH${index+1}`] || getTeamLogoPath(savedMatches[index], 'TEAM2', index+1);

    savedMatches[index] = { ...defaultMatchStructure, ...req.body, ...matchSpecificLogos };
    console.log(`[API] Updated match data for index ${index}.`);
    await saveDbDataAsync();
    io.emit("jsonUpdate", savedMatches);
    res.status(200).json([savedMatches[index]]);
});

app.get("/api/mapveto", (req, res) => { res.json(savedMapVeto || defaultMapVetoStructure); });
app.post("/api/mapveto", async (req, res) => {
    if (!req.body || typeof req.body.matchIndex !== 'number' || !req.body.teams || !Array.isArray(req.body.veto)) return res.status(400).json({ message: "Некорректный формат данных Map Veto." });
    savedMapVeto = { ...defaultMapVetoStructure, ...req.body };
    console.log("[API] Received updated mapveto data via POST for match:", savedMapVeto.matchIndex);
    await saveDbDataAsync();
    io.emit("mapVetoUpdate", savedMapVeto);
    res.status(200).json(savedMapVeto);
});

// НОВЫЙ ЭНДПОИНТ для загрузки всех сырых данных VRS
app.get("/api/vrs-raw", (req, res) => {
    console.log("[API] Request for all raw VRS data");
    res.json(savedVRS || {}); // Возвращаем весь объект savedVRS
});

app.get("/api/vrs/:id", (req, res) => {
    const matchId = req.params.id;
    if (!/^[1-4]$/.test(matchId)) return res.status(404).json({ error: "Некорректный номер матча" });
    console.log(`[API] Request for processed VRS data for match ${matchId}`);
    res.json([getVRSResponse(matchId)]);
});
app.put("/api/vrs/:id", async (req, res) => {
    const matchId = req.params.id;
    if (!savedVRS.hasOwnProperty(matchId)) return res.status(404).json({ message: `VRS данные для матча ${matchId} не найдены.` });
    if (!req.body || typeof req.body !== 'object' || !req.body.TEAM1 || !req.body.TEAM2) return res.status(400).json({ message: "Некорректный формат данных VRS." });
    savedVRS[matchId] = { ...defaultVrsStructure, ...req.body };
    savedVRS[matchId].TEAM1 = { ...defaultVrsStructure.TEAM1, ...(req.body.TEAM1 || {}) };
    savedVRS[matchId].TEAM2 = { ...defaultVrsStructure.TEAM2, ...(req.body.TEAM2 || {}) };
    console.log(`[API] Updated VRS data for match ${matchId}.`);
    await saveDbDataAsync();
    io.emit("vrsUpdate", savedVRS);
    res.status(200).json([savedVRS[matchId]]);
});

app.get("/api/customfields", (req, res) => { res.json([customFieldsData || defaultCustomFieldsStructure]); });
app.post("/api/customfields", async (req, res) => {
    if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: "Некорректный формат данных Custom Fields." });
    customFieldsData = { ...defaultCustomFieldsStructure, ...(Array.isArray(req.body) ? req.body[0] : req.body) };
    console.log("[API] Received updated custom fields data.");
    await saveDbDataAsync();
    io.emit("customFieldsUpdate", customFieldsData);
    res.status(200).json(customFieldsData);
});

app.get("/api/pause", (req, res) => {
    console.log("[API] Request for pause data");
    res.json([savedPauseData || defaultPauseDataStructure]);
});
app.post("/api/pause", async (req, res) => {
    if (!req.body || typeof req.body.pause === 'undefined' || typeof req.body.lastUpd === 'undefined') {
        return res.status(400).json({ message: "Некорректный формат данных паузы." });
    }
    savedPauseData = { pause: req.body.pause ?? "", lastUpd: req.body.lastUpd ?? "" };
    console.log("[API] Received updated pause data:", savedPauseData);
    await saveDbDataAsync();
    io.emit("pauseUpdate", savedPauseData);
    console.log("[SOCKET] Emitted pauseUpdate.");
    res.status(200).json(savedPauseData);
});

app.get("/api/teams", (req, res) => { res.json(dataJsonContent); });
app.post("/api/teams", async (req, res) => {
    const newName = req.body.name?.trim();
    const newLogoRelative = makeRelativePath(req.body.logo?.trim() ?? "");
    if (!newName) return res.status(400).json({ message: "Название команды не может быть пустым." });
    const newId = Date.now().toString();
    const newTeam = { id: newId, name: newName, logo: newLogoRelative, score: 0 };
    if (!Array.isArray(dataJsonContent.teams)) dataJsonContent.teams = [];
    dataJsonContent.teams.push(newTeam);
    console.log(`[API] Added new team: ${newName} (ID: ${newId}, Logo: ${newLogoRelative})`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted teamsUpdate after adding team.");
    res.status(201).json(newTeam);
});
app.put("/api/teams/:id", async (req, res) => {
    const teamId = req.params.id;
    const newName = req.body.name?.trim();
    const newLogoRelative = makeRelativePath(req.body.logo?.trim() ?? "");
    if (!newName) return res.status(400).json({ message: "Новое название команды не может быть пустым." });
    const teamIndex = dataJsonContent.teams.findIndex(t => t.id === teamId);
    if (teamIndex === -1) return res.status(404).json({ message: `Команда с ID ${teamId} не найдена.` });
    dataJsonContent.teams[teamIndex].name = newName;
    dataJsonContent.teams[teamIndex].logo = newLogoRelative;
    console.log(`[API] Updated team ${teamId} name to: ${newName}, logo to: ${newLogoRelative}`);
    await saveDataJsonAsync();
    io.emit('teamsUpdate', dataJsonContent.teams);
    console.log("[SOCKET] Emitted teamsUpdate after updating team.");
    res.status(200).json(dataJsonContent.teams[teamIndex]);
});
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

const server = http.createServer(app);
const io = new SocketIOServer(server);

io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  socket.emit("jsonUpdate", savedMatches);
  socket.emit("customFieldsUpdate", customFieldsData);
  socket.emit("vrsUpdate", savedVRS);
  socket.emit("mapVetoUpdate", savedMapVeto);
  socket.emit("teamsUpdate", dataJsonContent.teams);
  socket.emit("pauseUpdate", savedPauseData);
  socket.on("disconnect", (reason) => { console.log(`[SOCKET] Client disconnected: ${socket.id}, Reason: ${reason}`); });
  socket.on('error', (error) => { console.error(`[SOCKET] Socket error for ${socket.id}:`, error); });
});

server.listen(port, "0.0.0.0", () => { console.log(`[SERVER] Сервер запущен на http://0.0.0.0:${port}`); });

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

