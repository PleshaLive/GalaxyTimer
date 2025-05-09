// public/js/matches.js

// ----------------------
// Инициализация всего
// ----------------------



export function initMatches() {
  // Загружаем список команд и инициализируем селекты
  fetch("/api/teams")
    .then(res => res.json())
    .then(data => {
      const teamsList = data.teams || data;
      populateTeamSelects(teamsList);
      attachTeamLogoUpdates();
      attachWinnerButtons();
      attachStatusColorUpdates();

      // После инициализации селектов и кнопок обновляем лейблы, подсветку и цвета статусов
      for (let m = 1; m <= 4; m++) {
        updateWinnerButtonLabels(m);
        refreshWinnerHighlight(m);
        const sel = document.getElementById("statusSelect" + m);
        if (sel) updateStatusColor(sel);
      }
    })
    .catch(err => console.error("Ошибка загрузки /api/teams:", err));
// loadState();       // убрано, чтобы не загружать данные из localStorage
// bindSaveListeners(); // убрано, чтобы не сохранять изменения в localStorage
// window.addEventListener("beforeunload", saveState);
}

// ----------------------
// Заполнение селектов команд
// ----------------------
export function populateTeamSelects(teamsList) {
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    if (!sel1 || !sel2) continue;
    sel1.innerHTML = "";
    sel2.innerHTML = "";
    teamsList.forEach(team => {
      const opt1 = document.createElement("option");
      opt1.value = team.name;
      opt1.textContent = team.name;
      opt1.dataset.logo = "C:\\projects\\vMix_score\\public" + team.logo;
      sel1.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = team.name;
      opt2.textContent = team.name;
      opt2.dataset.logo = "C:\\projects\\vMix_score\\public" + team.logo;
      sel2.appendChild(opt2);
    });
  }
}

// ----------------------
// Логотипы и обновление лейблов кнопок
// ----------------------
export function attachTeamLogoUpdates() {
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    if (!sel1 || !sel2) continue;

    sel1.addEventListener("change", () => {
      updateTeamLogoPreview(m, 1);
      updateWinnerButtonLabels(m);
    });
    sel2.addEventListener("change", () => {
      updateTeamLogoPreview(m, 2);
      updateWinnerButtonLabels(m);
    });

    // Начальное заполнение превью
    updateTeamLogoPreview(m, 1);
    updateTeamLogoPreview(m, 2);
  }
}

export function updateTeamLogoPreview(matchIndex, teamIndex) {
  const sel = document.getElementById(`team${teamIndex}Select${matchIndex}`);
  const preview = document.getElementById(`team${teamIndex}LogoPreview${matchIndex}`);
  if (!sel || !preview) return;
  const logo = sel.options[sel.selectedIndex].dataset.logo || "";
  preview.src = logo;
}

// ----------------------
// Кнопки Winner и подсветка
// ----------------------
export function attachWinnerButtons() {
  document.querySelectorAll(".winner-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchColumn = btn.closest(".match-column");
      const team = btn.getAttribute("data-team"); // "TEAM1" или "TEAM2"
      const matchIndex = parseInt(matchColumn.dataset.match, 10);

      // Сохраняем выбранного победителя
      matchColumn.setAttribute("data-winner", team);

      // Обновляем лейблы и подсветку
      updateWinnerButtonLabels(matchIndex);
      refreshWinnerHighlight(matchIndex);
    });
  });
}

function updateWinnerButtonLabels(matchIndex) {
  const sel1 = document.getElementById(`team1Select${matchIndex}`);
  const sel2 = document.getElementById(`team2Select${matchIndex}`);
  const name1 = sel1 ? sel1.value : "Team1";
  const name2 = sel2 ? sel2.value : "Team2";

  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const btn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
  const btn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');
  if (btn1) btn1.textContent = `Winner: ${name1}`;
  if (btn2) btn2.textContent = `Winner: ${name2}`;
}

function refreshWinnerHighlight(matchIndex) {
  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const winner = matchColumn.getAttribute("data-winner");
  matchColumn.querySelectorAll(".winner-btn").forEach(b => {
    b.classList.toggle("winner-selected", b.getAttribute("data-team") === winner);
  });
}

// ----------------------
// Окраска селекта статуса
// ----------------------
function attachStatusColorUpdates() {
  for (let m = 1; m <= 4; m++) {
    const sel = document.getElementById("statusSelect" + m);
    if (!sel) continue;
    sel.addEventListener("change", () => updateStatusColor(sel));
    updateStatusColor(sel);
  }
}

function updateStatusColor(sel) {
  const v = sel.value.toUpperCase();
  let color;
  switch (v) {
    case "UPCOM":    color = "#746EC8"; break;
    case "LIVE":     color = "#C45052"; break;
    case "FINISHED": color = "#535353"; break;
    default:         color = "";
  }
  sel.style.backgroundColor = color;
  sel.style.color = "#fff";
}

// ----------------------
// Сбор данных матчей
// ----------------------
export function gatherMatchesData() {
  const defaultLogo = "C:\\projects\\vMix_score\\public\\logos\\none.png";
  const matches = [];
  // Регекс для проверки формата "число:число"
  const SCORE_REGEX = /^\d+:\d+$/;

  for (let m = 1; m <= 4; m++) {
    const column      = document.querySelector(`.match-column[data-match="${m}"]`);
    const statusSelect= document.getElementById("statusSelect" + m);
    const statusText  = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeVal     = document.getElementById("timeInput" + m).value.trim();
    const selTeam1    = document.getElementById("team1Select" + m);
    const selTeam2    = document.getElementById("team2Select" + m);
    const team1Name   = selTeam1 ? selTeam1.value : "";
    const team2Name   = selTeam2 ? selTeam2.value : "";
    const team1Logo   = selTeam1
      ? selTeam1.options[selTeam1.selectedIndex].dataset.logo
      : defaultLogo;
    const team2Logo   = selTeam2
      ? selTeam2.options[selTeam2.selectedIndex].dataset.logo
      : defaultLogo;

    // Сбор "сырых" данных по картам
    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
      const mapSelect  = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");
      maps[`MAP${i+1}`]       = mapSelect  ? mapSelect.value       : "";
      maps[`MAP${i+1}_SCORE`] = scoreInput ? scoreInput.value.trim(): "";
    });
    if (statusText === "LIVE") {
      const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
      if (s1 && !s2) {
        maps.MAP2_SCORE = "NEXT";
        maps.MAP3_SCORE = "DECIDER";
      } else if (s1 && s2 && !s3) {
        maps.MAP3_SCORE = "NEXT";
      }
    }
    if (statusText === "FINISHED") {
      const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
      if (s1 && s2 && !s3) {
        maps.MAP3_SCORE = "DECIDER";
      }
    }
    if (statusText === "UPCOM") {
      if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
      if (maps.MAP1_SCORE !== "NEXT" && !maps.MAP2_SCORE) maps.MAP2_SCORE = "NEXT";
      maps.MAP3_SCORE = `MATCH ${m}`;
    }

    // Дополнительные поля из формы
    function getVal(id) {
      const el = document.getElementById(id + m);
      return el ? el.value.trim() : "";
    }
    const upcomCest         = getVal("upcomCest");
    const upcomRectangleUp  = getVal("upcomRectangleUp")  || "C:\\projects\\NewTimer\\files\\rectUp.png";
    const upcomRectangleLow = getVal("upcomRectangleLow") || "C:\\projects\\NewTimer\\files\\rectLow.png";
    const upcomVsMini       = getVal("upcomVsMini")       || "vs";
    const upcomVsBig        = getVal("upcomVsBig")        || "vs";
    const upcomNext         = getVal("upcomNext");
    const upcomNextPhoto    = getVal("upcomNextPhoto")    || "C:\\projects\\NewTimer\\files\\bg_next_upcom.png";

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    if (statusText === "UPCOM") {
      MP1_UPC = MP2_UPC = MP3_UPC = "C:\\projects\\NewTimer\\files\\none.png";
    } else if (statusText === "LIVE") {
      MP1_LIVE = getScoreIcon(maps.MAP1_SCORE);
      MP2_LIVE = getScoreIcon(maps.MAP2_SCORE);
      MP3_LIVE = getScoreIcon(maps.MAP3_SCORE);
    } else if (statusText === "FINISHED") {
      MP1_FIN = getScoreIcon(maps.MAP1_SCORE);
      MP2_FIN = getScoreIcon(maps.MAP2_SCORE);
      MP3_FIN = getScoreIcon(maps.MAP3_SCORE);
    }

    let finCest="", finResult="", finVictory="";
    if (statusText === "FINISHED") {
      finCest    = "cest";
      finResult  = "Result";
      finVictory = "VICTORY";
    }

    const winner = column.getAttribute("data-winner") || "";
    let teamWinner="", teamWinnerLogo=defaultLogo;
    if (statusText === "FINISHED") {
      if (winner==="TEAM1") {
        teamWinner     = team1Name;
        teamWinnerLogo = team1Logo;
      }
      else if (winner==="TEAM2") {
        teamWinner     = team2Name;
        teamWinnerLogo = team2Logo;
      }
    }

    const liveStatusValue = statusText === "LIVE"
      ? "C:\\projects\\NewTimer\\files\\live.png"
      : defaultLogo;
    const liveBgValue = statusText === "LIVE"
      ? "C:\\projects\\NewTimer\\files\\LIVEBG.png"
      : defaultLogo;
    const liveVs = statusText === "LIVE" ? "vs" : "";

    const upcomObj = {
      UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
      UPCOM_TIME:         statusText === "UPCOM" ? timeVal : "",
      UPCOM_TEAM1:        statusText === "UPCOM" ? team1Name : "",
      UPCOM_TEAM2:        statusText === "UPCOM" ? team2Name : "",
      UPCOM_TEAM1_LOGO:   statusText === "UPCOM" ? team1Logo : defaultLogo,
      UPCOM_TEAM2_LOGO:   statusText === "UPCOM" ? team2Logo : defaultLogo,
      UPCOM_MAP1:         statusText === "UPCOM" ? maps.MAP1 : "",
      UPCOM_MAP1_SCORE:   statusText === "UPCOM" ? maps.MAP1_SCORE : "",
      UPCOM_MAP2:         statusText === "UPCOM" ? maps.MAP2 : "",
      UPCOM_MAP2_SCORE:   statusText === "UPCOM" ? maps.MAP2_SCORE : "",
      UPCOM_MAP3:         statusText === "UPCOM" ? maps.MAP3 : "",
      UPCOM_MAP3_SCORE:   statusText === "UPCOM" ? maps.MAP3_SCORE : "",
      UPCOM_Cest: statusText === "UPCOM" ? "cest" : "",
      UPCOM_RectangleUP:  statusText === "UPCOM" ? upcomRectangleUp : defaultLogo,
      UPCOM_RectangleLOW: statusText === "UPCOM" ? upcomRectangleLow : defaultLogo,
      UPCOM_vs_mini:      statusText === "UPCOM" ? upcomVsMini : "",
      UPCOM_vs_big:       statusText === "UPCOM" ? upcomVsBig : "",
      UPCOM_next:         statusText === "UPCOM" ? upcomNext : "",
      UPCOM_next_photo:   statusText === "UPCOM" ? upcomNextPhoto : ""
    };

    const liveObj = {
      LIVE_MATCH_STATUS: statusText === "LIVE" ? statusText : "",
      LIVE_TIME:         statusText === "LIVE" ? timeVal : "",
      LIVE_TEAM1:        statusText === "LIVE" ? team1Name : "",
      LIVE_TEAM2:        statusText === "LIVE" ? team2Name : "",
      LIVE_TEAM1_LOGO:   statusText === "LIVE" ? team1Logo : defaultLogo,
      LIVE_TEAM2_LOGO:   statusText === "LIVE" ? team2Logo : defaultLogo,
      LIVE_MAP1:         statusText === "LIVE" ? maps.MAP1 : "",
      LIVE_MAP1_SCORE:   statusText === "LIVE" ? maps.MAP1_SCORE : "",
      LIVE_MAP2:         statusText === "LIVE" ? maps.MAP2 : "",
      LIVE_MAP2_SCORE:   statusText === "LIVE" ? maps.MAP2_SCORE : "",
      LIVE_MAP3:         statusText === "LIVE" ? maps.MAP3 : "",
      LIVE_MAP3_SCORE:   statusText === "LIVE" ? maps.MAP3_SCORE : "",
      LIVE_Cest:         statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\ongoing.png" : defaultLogo,
      LIVE_VS:           statusText === "LIVE" ? "vs" : "",
      LIVE_STATUS:       statusText === "LIVE" ? liveStatusValue : defaultLogo,
      LIVE_BG:           statusText === "LIVE" ? liveBgValue : defaultLogo,
      LIVE_RectangleUP:  statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png",
      LIVE_RectangleLOW: statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png"
    };

    const finishedObj = {
      FINISHED_MATCH_STATUS: statusText === "FINISHED" ? statusText : "",
      FINISHED_TIME:         statusText === "FINISHED" ? timeVal : "",
      FINISHED_TEAM1:        statusText === "FINISHED" ? team1Name : "",
      FINISHED_TEAM2:        statusText === "FINISHED" ? team2Name : "",
      FINISHED_TEAM1_LOGO:   statusText === "FINISHED" ? team1Logo : defaultLogo,
      FINISHED_TEAM2_LOGO:   statusText === "FINISHED" ? team2Logo : defaultLogo,
      FINISHED_MAP1:         statusText === "FINISHED" ? maps.MAP1 : "",
      FINISHED_MAP1_SCORE:   statusText === "FINISHED" ? maps.MAP1_SCORE : "",
      FINISHED_MAP2:         statusText === "FINISHED" ? maps.MAP2 : "",
      FINISHED_MAP2_SCORE:   statusText === "FINISHED" ? maps.MAP2_SCORE : "",
      FINISHED_MAP3:         statusText === "FINISHED" ? maps.MAP3 : "",
      FINISHED_MAP3_SCORE:   statusText === "FINISHED" ? maps.MAP3_SCORE : "",
      FIN_RectangleUP:       statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png",
      FIN_RectangleLOW:      statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png"
    };

    const finishedLogo1 = SCORE_REGEX.test(maps.MAP1_SCORE) ? team1Logo : defaultLogo;
    const finishedLogo2 = SCORE_REGEX.test(maps.MAP1_SCORE) ? team2Logo : defaultLogo;
    const liveLogo1     = (statusText==="LIVE" && SCORE_REGEX.test(maps.MAP1_SCORE)) ? team1Logo : defaultLogo;
    const liveLogo2     = (statusText==="LIVE" && SCORE_REGEX.test(maps.MAP1_SCORE)) ? team2Logo : defaultLogo;

    // 9) Динамические лого уровня карт: показываем только если LIVE или FINISHED + числовой счёт
    const perMapLogos = {};
    [1,2,3].forEach(i => {
      const sc = maps[`MAP${i}_SCORE`];
      const isNum = SCORE_REGEX.test(sc);
      // true только в LIVE или FINISHED и если sc соответствует "число:число"
      const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
      perMapLogos[`MAP${i}_TEAM1_LOGO_MATCH${m}`] = show ? team1Logo : defaultLogo;
      perMapLogos[`MAP${i}_TEAM2_LOGO_MATCH${m}`] = show ? team2Logo : defaultLogo;
    });


    const matchObj = {
      ...upcomObj,
      ...liveObj,
      ...finishedObj,
      MP1_UPC, MP2_UPC, MP3_UPC,
      MP1_LIVE, MP2_LIVE, MP3_LIVE,
      MP1_FIN, MP2_FIN, MP3_FIN,
      Fin_cest: finCest,
      FIN_Result: finResult,
      FIN_VICTORY: finVictory,
      TEAMWINNER: teamWinner,
      TEAMWINNER_LOGO: teamWinnerLogo
    };

    // --- 10) Вставьте сразу перед matches.push(matchObj) ---
    // матчные лого
    matchObj[`FINISHED_TEAM1_LOGO_MATCH${m}`] = finishedLogo1;
    matchObj[`FINISHED_TEAM2_LOGO_MATCH${m}`] = finishedLogo2;
    matchObj[`LIVE_TEAM1_LOGO_MATCH${m}`]     = liveLogo1;
    matchObj[`LIVE_TEAM2_LOGO_MATCH${m}`]     = liveLogo2;

    // картовые лого в формате MAPn_TEAMxlogo
    matchObj.MAP1_TEAM1logo = perMapLogos[`MAP1_TEAM1_LOGO_MATCH${m}`];
    matchObj.MAP2_TEAM1logo = perMapLogos[`MAP2_TEAM1_LOGO_MATCH${m}`];
    matchObj.MAP3_TEAM1logo = perMapLogos[`MAP3_TEAM1_LOGO_MATCH${m}`];
    matchObj.MAP1_TEAM2logo = perMapLogos[`MAP1_TEAM2_LOGO_MATCH${m}`];
    matchObj.MAP2_TEAM2logo = perMapLogos[`MAP2_TEAM2_LOGO_MATCH${m}`];
    matchObj.MAP3_TEAM2logo = perMapLogos[`MAP3_TEAM2_LOGO_MATCH${m}`];
    
    matches.push(matchObj);
  }

  return matches;
}

// ----------------------
// Помощник для иконок счета
// ----------------------
function getScoreIcon(scoreStr) {
  const parts = scoreStr.split(":");
  if (parts.length !== 2) return "C:\\projects\\NewTimer\\files\\mp_none.png";
  const left = parseFloat(parts[0]);
  const right = parseFloat(parts[1]);
  if (isNaN(left) || isNaN(right)) return "C:\\projects\\NewTimer\\files\\mp_none.png";
  if (right > left) return "C:\\projects\\NewTimer\\files\\mp_R.png";
  if (left > right) return "C:\\projects\\NewTimer\\files\\mp_L.png";
  return "C:\\projects\\NewTimer\\files\\mp_none.png";
}

// ----------------------
// 1) Сохраняем состояние всего интерфейса
// ----------------------
// function saveState() { ... }


// ----------------------
// 2) Загружаем сохранённое
// ----------------------
// function loadState() { ... }

// ----------------------
// 3) Привязываем автосохранение ко всем изменениям
// ----------------------
function bindSaveListeners() {
  // любое изменение селектов/инпутов
  document.querySelectorAll("select, input").forEach(el => {
    el.addEventListener("change", saveState);
  });
  // клик по кнопкам‑winner
  document.querySelectorAll(".winner-btn").forEach(btn => {
    btn.addEventListener("click", saveState);
  });
  // VRS‑инпуты
  document.querySelectorAll(".vrs-input").forEach(i => {
    i.addEventListener("change", saveState);
  });
  // veto‑селекты
  document.querySelectorAll(".veto-action, .veto-map, .veto-team, .veto-side")
    .forEach(s => s.addEventListener("change", saveState));
}
