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
// Здесь используем жестко заданный порт, т.к. на Railway работает именно так
const port = 3000;

// Для отладки логируем все входящие запросы
app.use((req, res, next) => {
  console.log(`[LOG] ${req.method} ${req.path}`);
  next();
});

// Health-check (используйте его в настройках Railway для проверки работоспособности)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// Middleware: парсеры формы и куков
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Настройка сессий (для авторизации)
app.use(session({
  secret: "322223",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // для HTTPS установить true
}));

// Роут для страницы логина (файл login.html должен быть в папке public)
app.get("/login", (req, res) => {
  if (req.session.authenticated) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "StarGalaxy" && password === "FuckTheWorld1996") {
    req.session.authenticated = true;
    return res.redirect("/");
  }
  res.redirect("/login?error=1");
});

// Роут для корневого пути — если пользователь не аутентифицирован, перенаправляем на /login;
// иначе отдаем index.html (он должен лежать в папке public)
app.get("/", (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect("/login");
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Middleware авторизации: все запросы, кроме /api, /login, /login.css, /health, проходят
app.use((req, res, next) => {
  if (
    req.path.startsWith("/api/") ||
    req.session.authenticated ||
    req.path === "/login" ||
    req.path === "/login.css" ||
    req.path === "/health"
  ) {
    return next();
  }
  res.redirect("/login");
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ====================================
   Работа с данными: matches, mapVeto, VRS, customFields
   ==================================== */

// Дефолтные пути для логотипов (оставляем без изменений)
const defaultTeam1Logo = "C:\\projects\\vMix_score\\public\\logos\\default1.png";
const defaultTeam2Logo = "C:\\projects\\vMix_score\\public\\logos\\default2.png";

// Данные хранятся в памяти
let savedMatches = [];
let savedMapVeto = {};
let savedVRS = {
  1: {
    TEAM1: { winPoints: 35, losePoints: -35, rank: 4, currentPoints: 84 },
    TEAM2: { winPoints: 35, losePoints: -35, rank: 2, currentPoints: 80 }
  },
  2: {
    TEAM1: { winPoints: 35, losePoints: -35, rank: 5, currentPoints: 75 },
    TEAM2: { winPoints: 35, losePoints: -35, rank: 1, currentPoints: 90 }
  },
  3: {
    TEAM1: { winPoints: 40, losePoints: -20, rank: 6, currentPoints: 60 },
    TEAM2: { winPoints: 40, losePoints: -20, rank: 3, currentPoints: 85 }
  },
  4: {
    TEAM1: { winPoints: 25, losePoints: -25, rank: 7, currentPoints: 50 },
    TEAM2: { winPoints: 25, losePoints: -25, rank: 8, currentPoints: 40 }
  }
};

// Дополнительные данные – верхний блок (custom fields)
let customFieldsData = {};

// Путь к файлу базы данных (db.json)
const dbFilePath = path.join(__dirname, "db.json");

// Функция загрузки данных из db.json (если файла нет, создаётся новый)
function loadDataFromFile() {
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify({
      matches: [],
      mapVeto: {},
      vrs: {},
      customFields: {}   // Добавляем поле для custom fields
    }, null, 2));
  }
  const rawData = fs.readFileSync(dbFilePath, "utf8");
  const jsonData = JSON.parse(rawData);
  savedMatches = jsonData.matches || [];
  savedMapVeto = jsonData.mapVeto || {};
  savedVRS = jsonData.vrs || {};
  customFieldsData = jsonData.customFields || {}; // Загружаем custom fields
}
loadDataFromFile();

// Функция сохранения данных в db.json
function saveDataToFile() {
  const jsonData = {
    matches: savedMatches,
    mapVeto: savedMapVeto,
    vrs: savedVRS,
    customFields: customFieldsData  // Сохраняем custom fields
  };
  fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), "utf8");
}

// Функция форматирования winPoints
function formatWinPoints(value) {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (isNaN(num)) return value;
  return (num >= 0 ? "+" : "") + num;
}

/**
 * Функция выбора логотипа для команды.
 */
function getLogo(match, team) {
  let rawLogo;
  if (match.FINISHED_MATCH_STATUS === "FINISHED") {
    rawLogo = (team === "TEAM1") ? match.FINISHED_TEAM1_LOGO : match.FINISHED_TEAM2_LOGO;
  } else {
    rawLogo = (team === "TEAM1") ? match.UPCOM_TEAM1_LOGO : match.UPCOM_TEAM2_LOGO;
  }
  if (!rawLogo) {
    return (team === "TEAM1") ? defaultTeam1Logo : defaultTeam2Logo;
  }
  const normalized = rawLogo.replace(/\\/g, "/").toLowerCase();
  if (normalized.endsWith("none.png")) {
    return (team === "TEAM1") ? defaultTeam1Logo : defaultTeam2Logo;
  }
  return rawLogo;
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
  res.json([savedMatches[index]]);
});

app.post("/api/matchdata", (req, res) => {
  savedMatches = Array.isArray(req.body) ? req.body : [req.body];
  console.log("Получены matchdata:", savedMatches);
  
  // Если матч завершён, обновляем VRS
  savedMatches.forEach((match, idx) => {
    const matchId = idx + 1;
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
      const winner = match.TEAMWINNER;
      const vrsData = savedVRS[matchId];
      if (!vrsData) return;
      if (winner === match.FINISHED_TEAM1) {
        vrsData.TEAM1.currentPoints += vrsData.TEAM1.winPoints;
        vrsData.TEAM2.currentPoints += vrsData.TEAM2.losePoints;
      } else if (winner === match.FINISHED_TEAM2) {
        vrsData.TEAM2.currentPoints += vrsData.TEAM2.winPoints;
        vrsData.TEAM1.currentPoints += vrsData.TEAM1.losePoints;
      }
      console.log(`Обновлены VRS для матча ${matchId}:`, vrsData);
    }
  });
  
  saveDataToFile();
  
  // Эмитим событие "jsonUpdate" с актуальными данными матчей
  io.emit("jsonUpdate", savedMatches);
  
  res.json(savedMatches);
});

// --- API для Map Veto ---
app.get("/api/mapveto", (req, res) => res.json(savedMapVeto));

app.post("/api/mapveto", (req, res) => {
  savedMapVeto = req.body;
  console.log("Получены данные mapveto:", savedMapVeto);
  saveDataToFile();
  // Отправляем обновление Map Veto всем клиентам
  io.emit("mapVetoUpdate", savedMapVeto);
  res.json(savedMapVeto);
});

// --- API для VRS ---
function getVRSResponse(matchId) {
  const vrsData = savedVRS[matchId] || {
    TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints: "" },
    TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints: "" }
  };
  const match = savedMatches[matchId - 1] || {};
  const team1Logo = getLogo(match, "TEAM1");
  const team2Logo = getLogo(match, "TEAM2");
  
  const emptyFin = {
    TEAM1: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", logo: team1Logo },
    TEAM2: { winPoints: "", losePoints: "", rank: "", currentPoints_win: "", currentPoints_lose: "", logo: team2Logo }
  };
  
  let winBgTeam1 = "C:\\projects\\NewTimer\\files\\idle.png";
  let winBgTeam2 = "C:\\projects\\NewTimer\\files\\idle.png";
  
  if (match.FINISHED_MATCH_STATUS === "FINISHED") {
    if (match.TEAMWINNER === match.FINISHED_TEAM1) {
      winBgTeam1 = "C:\\projects\\NewTimer\\files\\win.png";
      winBgTeam2 = "C:\\projects\\NewTimer\\files\\lose.png";
      return {
        UPCOM: emptyFin,
        FINISHED: {
          TEAM1: {
            winPoints: formatWinPoints(vrsData.TEAM1.winPoints),
            losePoints: "",  // оставляем пустым, если матч завершён
            rank: vrsData.TEAM1.rank,
            currentPoints_win: vrsData.TEAM1.currentPoints,
            currentPoints_lose: "",
            logo: team1Logo
          },
          TEAM2: {
            winPoints: "",
            losePoints: -Math.abs(vrsData.TEAM2.losePoints),
            rank: vrsData.TEAM2.rank,
            currentPoints_win: "",
            currentPoints_lose: vrsData.TEAM2.currentPoints,
            logo: team2Logo
          }
        },
        WIN_BG_TEAM_1: winBgTeam1,
        WIN_BG_TEAM_2: winBgTeam2
      };
    } else if (match.TEAMWINNER === match.FINISHED_TEAM2) {
      winBgTeam1 = "C:\\projects\\NewTimer\\files\\lose.png";
      winBgTeam2 = "C:\\projects\\NewTimer\\files\\win.png";
      return {
        UPCOM: emptyFin,
        FINISHED: {
          TEAM1: {
            winPoints: "",
            losePoints: -Math.abs(vrsData.TEAM1.losePoints),
            rank: vrsData.TEAM1.rank,
            currentPoints_win: "",
            currentPoints_lose: vrsData.TEAM1.currentPoints,
            logo: team1Logo
          },
          TEAM2: {
            winPoints: formatWinPoints(vrsData.TEAM2.winPoints),
            losePoints: "",
            rank: vrsData.TEAM2.rank,
            currentPoints_win: vrsData.TEAM2.currentPoints,
            currentPoints_lose: "",
            logo: team2Logo
          }
        },
        WIN_BG_TEAM_1: winBgTeam1,
        WIN_BG_TEAM_2: winBgTeam2
      };
    } else {
      return {
        UPCOM: emptyFin,
        FINISHED: emptyFin,
        WIN_BG_TEAM_1: winBgTeam1,
        WIN_BG_TEAM_2: winBgTeam2
      };
    }
  }
  
  return {
    UPCOM: {
      TEAM1: {
        winPoints: formatWinPoints(vrsData.TEAM1.winPoints),
        losePoints: -Math.abs(vrsData.TEAM1.losePoints), // гарантируем отрицательное значение
        rank: vrsData.TEAM1.rank,
        currentPoints: vrsData.TEAM1.currentPoints,
        logo: team1Logo
      },
      TEAM2: {
        winPoints: formatWinPoints(vrsData.TEAM2.winPoints),
        losePoints: -Math.abs(vrsData.TEAM2.losePoints),
        rank: vrsData.TEAM2.rank,
        currentPoints: vrsData.TEAM2.currentPoints,
        logo: team2Logo
      }
    },
    FINISHED: emptyFin,
    WIN_BG_TEAM_1: "C:\\projects\\NewTimer\\files\\idle.png",
    WIN_BG_TEAM_2: "C:\\projects\\NewTimer\\files\\idle.png"
  };
}

app.get("/api/vrs/:id", (req, res) => {
  const matchId = parseInt(req.params.id, 10);
  if (isNaN(matchId) || matchId < 1 || matchId > 4) {
    return res.status(404).json({ error: "Некорректный номер матча" });
  }
  res.json([getVRSResponse(matchId)]);
});

app.post("/api/vrs", (req, res) => {
  savedVRS = req.body;
  console.log("Получены данные VRS:", savedVRS);
  saveDataToFile();
  // Эмитим событие "vrsUpdate" для всех клиентов
  io.emit("vrsUpdate", savedVRS);
  res.json(savedVRS);
});

// --- API для custom fields ---
// GET custom fields
app.get("/api/customfields", (req, res) => {
  res.json([customFieldsData]);
});
// POST custom fields
app.post("/api/customfields", (req, res) => {
  customFieldsData = req.body;
  console.log("Получены custom fields:", customFieldsData);
  saveDataToFile();
  // Оповещаем всех клиентов
  io.emit("customFieldsUpdate", customFieldsData);
  res.json(customFieldsData);
});

// --- API для списка команд из файла data.json ---
const teamsDataFile = path.join(__dirname, "data.json");
app.get("/api/teams", (req, res) => {
  fs.readFile(teamsDataFile, "utf8", (err, data) => {
    if (err) {
      console.error("Ошибка чтения data.json:", err);
      return res.status(500).json({ error: "Не удалось прочитать файл команд." });
    }
    try {
      const teamsData = JSON.parse(data);
      res.json(teamsData);
    } catch (e) {
      console.error("Ошибка парсинга JSON:", e);
      res.status(500).json({ error: "Ошибка парсинга JSON." });
    }
  });
});

/* ====================================
   Socket.io и запуск сервера
   ==================================== */
const server = http.createServer(app);
const io = new SocketIOServer(server);

io.on("connection", (socket) => {
  console.log("Клиент подключён");
  // Отправляем текущие данные матчей сразу при подключении
  socket.emit("jsonUpdate", savedMatches);
  // Отправляем custom fields, чтобы верхний блок отобразил актуальные значения
  socket.emit("customFieldsUpdate", customFieldsData);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Сервер запущен на http://0.0.0.0:${port}`);
});
