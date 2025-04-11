// public/js/main.js
import { initMatches, gatherMatchesData } from "./matches.js";
import { initMapVeto, gatherMapVetoData, updateMapVetoUI } from "./mapVeto.js";
import { initVRS, loadAllVRS, gatherVRSData, updateVRSUI } from "./vrs.js";
import { saveData } from "./api.js";

// Инициализация модулей
initMatches();
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========
// Предполагается, что socket.io подключён в index.html и переменная socket доступна глобально
async function loadMapVetoFromServer() {
  try {
    const response = await fetch("/api/mapveto");
    const mapVetoData = await response.json();
    updateMapVetoUI(mapVetoData);
  } catch (error) {
    console.error("Ошибка загрузки Map Veto:", error);
  }
}

socket.on("jsonUpdate", (matches) => {
  console.log("Получено обновление JSON (Matches):", matches);
  updateMatchesUI(matches);
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) {
    jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

socket.on("mapVetoUpdate", (updatedMapVeto) => {
  console.log("Получены обновления Map Veto:", updatedMapVeto);
  updateMapVetoUI(updatedMapVeto);
});

socket.on("vrsUpdate", (vrsData) => {
  console.log("Получены обновления VRS:", vrsData);
  updateVRSUI(vrsData);
});

socket.on("customFieldsUpdate", (newFields) => {
  console.log("Получены обновления customFields:", newFields);
  updateCustomFieldsUI(newFields);
});

// ========== Функции обновления UI ==========

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

function updateMatchesUI(matches) {
  matches.forEach((match, index) => {
    const matchIndex = index + 1;
    // Время матча
    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      timeInput.value = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
    }
    // Статус матча
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
      if (match.FINISHED_MATCH_STATUS === "FINISHED") {
        statusSelect.value = "FINISHED";
      } else if (match.LIVE_MATCH_STATUS === "LIVE") {
        statusSelect.value = "LIVE";
      } else if (match.UPCOM_MATCH_STATUS === "UPCOM") {
        statusSelect.value = "UPCOM";
      }
      updateStatusColor(statusSelect);
    }
    // Команды
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    if (team1Select) {
      team1Select.value = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    }
    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    if (team2Select) {
      team2Select.value = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    }

    // Winner (данные сохраняются в data-winner атрибуте родительского элемента match-column)
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (matchColumn) {
      if (match.TEAMWINNER === "TEAM1" || match.TEAMWINNER === "TEAM2") {
        matchColumn.setAttribute("data-winner", match.TEAMWINNER);
      } else {
        if (team1Select && team1Select.value === match.TEAMWINNER) {
          matchColumn.setAttribute("data-winner", "TEAM1");
        } else if (team2Select && team2Select.value === match.TEAMWINNER) {
          matchColumn.setAttribute("data-winner", "TEAM2");
        } else {
          matchColumn.setAttribute("data-winner", "");
        }
      }
      // Функция для обновления подсветки кнопок winner
      refreshWinnerHighlight(matchIndex);
    }

    // Карты и счёт
    let prefix = "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
      prefix = "FINISHED_";
    } else if (match.LIVE_MATCH_STATUS === "LIVE") {
      prefix = "LIVE_";
    } else if (match.UPCOM_MATCH_STATUS === "UPCOM") {
      prefix = "UPCOM_";
    }
    const mapRows = matchColumn.querySelectorAll(".map-row");
    mapRows.forEach((row, i) => {
      const mapKey = prefix + `MAP${i + 1}`;
      const scoreKey = prefix + `MAP${i + 1}_SCORE`;
      console.log(`Матч ${matchIndex}: ${mapKey} =`, match[mapKey], "  ", `${scoreKey} =`, match[scoreKey]);
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");
      if (mapSelect && typeof match[mapKey] !== "undefined") {
        mapSelect.value = match[mapKey];
      }
      if (scoreInput && typeof match[scoreKey] !== "undefined") {
        scoreInput.value = match[scoreKey];
      }
    });
  });
}

function updateCustomFieldsUI(fields) {
  const upcoming = document.getElementById("upcomingMatchesInput");
  if (upcoming) upcoming.value = fields.upcomingMatches || "";
  const galaxy = document.getElementById("galaxyBattleInput");
  if (galaxy) galaxy.value = fields.galaxyBattle || "";
  const startDate = document.getElementById("tournamentStart");
  if (startDate) startDate.value = fields.tournamentStart || "";
  const endDate = document.getElementById("tournamentEnd");
  if (endDate) endDate.value = fields.tournamentEnd || "";
  const dayDisplay = document.getElementById("tournamentDayDisplay");
  if (dayDisplay) dayDisplay.textContent = fields.tournamentDay || "";
  const groupStage = document.getElementById("groupStageInput");
  if (groupStage) groupStage.value = fields.groupStage || "";
}

// Загрузка данных с сервера
async function loadMatchesFromServer() {
  try {
    const response = await fetch("/api/matchdata");
    const matches = await response.json();
    updateMatchesUI(matches);
  } catch (error) {
    console.error("Ошибка загрузки matchdata:", error);
  }
}

async function loadCustomFieldsFromServer() {
  try {
    const response = await fetch("/api/customfields");
    const [data] = await response.json();
    updateCustomFieldsUI(data);
  } catch (error) {
    console.error("Ошибка загрузки custom fields:", error);
  }
}

async function updateAggregatedVRS() {
  try {
    const res = await fetch("/api/vrs-all");
    if (!res.ok) return;
    const allVRS = await res.json();
    console.log("Агрегированные VRS:", allVRS);
    const aggregatedBlock = document.getElementById("aggregatedVRS");
    if (aggregatedBlock) {
      aggregatedBlock.textContent = JSON.stringify(allVRS, null, 2);
    }
  } catch (error) {
    console.error("Ошибка загрузки агрегированных VRS:", error);
  }
}

function calculateTournamentDay() {
  const startDateValue = document.getElementById("tournamentStart").value;
  if (!startDateValue) return "";
  const startDate = new Date(startDateValue);
  const today = new Date();
  const diffTime = today - startDate;
  let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays < 1 ? "" : "DAY " + diffDays;
}

function updateTournamentDay() {
  const display = document.getElementById("tournamentDayDisplay");
  if (display) display.textContent = calculateTournamentDay();
}

document.getElementById("tournamentStart").addEventListener("change", updateTournamentDay);
document.getElementById("tournamentEnd").addEventListener("change", updateTournamentDay);

// Функция сборки данных верхнего блока
function gatherCustomFieldsData() {
  return {
    upcomingMatches: document.getElementById("upcomingMatchesInput").value,
    galaxyBattle: document.getElementById("galaxyBattleInput").value,
    tournamentStart: document.getElementById("tournamentStart").value,
    tournamentEnd: document.getElementById("tournamentEnd").value,
    tournamentDay: document.getElementById("tournamentDayDisplay").textContent,
    groupStage: document.getElementById("groupStageInput").value
  };
}

// Функция, которая соберёт данные из всех блоков и отправит их на сервер
async function applyChanges() {
  try {
    const matchesData = gatherMatchesData();
    await saveData("/api/matchdata", matchesData);
    const mapVetoData = gatherMapVetoData();
    await saveData("/api/mapveto", mapVetoData);
    const vrsData = gatherVRSData();
    await saveData("/api/vrs", vrsData);
    const customData = gatherCustomFieldsData();
    await saveData("/api/customfields", customData);

    // После сохранения обновляем данные из сервера
    loadMatchesFromServer();
    loadAllVRS();
    updateAggregatedVRS();

    console.log("Изменения успешно применены");
  } catch (error) {
    console.error("Ошибка при применении изменений:", error);
  }
}

document.getElementById("applyButton").addEventListener("click", applyChanges);

// Инициализация при загрузке страницы
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    loadMatchesFromServer();
    loadMapVetoFromServer();
    loadAllVRS();
    loadCustomFieldsFromServer();
  }, 500);
});

// --- Вспомогательная функция для Winner (она может быть также импортирована из matches.js) ---
function refreshWinnerHighlight(matchIndex) {
  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const winner = matchColumn.getAttribute("data-winner");
  matchColumn.querySelectorAll(".winner-btn").forEach(btn => {
    btn.classList.toggle("winner-selected", btn.getAttribute("data-team") === winner);
  });
}
