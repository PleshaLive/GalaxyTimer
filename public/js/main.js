// public/js/main.js
// Импортируем нужные функции, включая функции для обновления кнопок победителя
// Добавляем импорт areTeamsInitialized
import { initMatches, gatherMatchesData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized } from "./matches.js";
import { initMapVeto, gatherMapVetoData } from "./mapVeto.js";
import { initVRS, gatherVRSData } from "./vrs.js";
import { saveData } from "./api.js";

// ========== Инициализация модулей ==========
// Вызываем initMatches, но не ждем его здесь, а ждем в DOMContentLoaded
initMatches(); // Начинает загрузку списка команд
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========

socket.on("jsonUpdate", (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  if (areTeamsInitialized()) { // Обновляем UI только если команды уже загружены
      updateMatchesUI(matches);
  } else {
      console.log("[SOCKET] Teams not initialized yet, delaying matches UI update.");
      // Можно добавить логику ожидания или повторной попытки позже
  }
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) {
    jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

socket.on("mapVetoUpdate", (updatedMapVeto) => {
  console.log("[SOCKET] Received mapVetoUpdate:", updatedMapVeto);
  updateMapVetoUI(updatedMapVeto);
});

socket.on("vrsUpdate", (rawVrsData) => {
  console.log("[SOCKET] Received vrsUpdate (raw):", rawVrsData);
  updateVRSUI(rawVrsData);
});

socket.on("customFieldsUpdate", (newFields) => {
  console.log("[SOCKET] Received customFieldsUpdate:", newFields);
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  if (fieldsData) {
      updateCustomFieldsUI(fieldsData);
  } else {
      console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields);
  }
});

// ========== Функции обновления UI ==========

// Обновление Matches UI (включая восстановление подсветки победителя)
function updateMatchesUI(matches) {
  console.log("[UI] Updating matches UI...");
  if (!Array.isArray(matches)) {
      console.warn("[UI] updateMatchesUI received invalid data:", matches);
      return;
  }
  matches.forEach((match, index) => {
    const matchIndex = index + 1;
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) {
        console.warn(`[UI] Match column ${matchIndex} not found for UI update.`);
        return;
    }

    // Обновляем время
    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      // Отображаем время без CEST, так как CEST добавляется при сохранении
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, '').trim(); // Убираем CEST
      timeInput.value = timeValue;
    }

    // Обновляем статус
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
        let newStatus = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
        else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

        if (newStatus && statusSelect.value !== newStatus) { // Обновляем только если статус изменился
            statusSelect.value = newStatus;
            // Обновляем классы и цвет фона
             if (typeof updateStatusColor === 'function') {
                 updateStatusColor(statusSelect);
             } else {
                 console.warn("updateStatusColor function not found");
             }
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
             matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
        } else if (!newStatus) {
            // Если статус не определен, можно сбросить на дефолтное значение
            // statusSelect.value = statusSelect.options[0].value;
            // updateStatusColor(statusSelect);
            // matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
        }
    }

    // Обновляем команды
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    // Устанавливаем значение, только если оно не пустое и опция существует
    if (team1Select && team1Name && team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`)) {
       if (team1Select.value !== team1Name) team1Select.value = team1Name;
    } else if (team1Select && team1Select.value !== "") {
        team1Select.value = ""; // Сброс на дефолтное значение "-", если имя не найдено или пустое
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    if (team2Select && team2Name && team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`)) {
       if (team2Select.value !== team2Name) team2Select.value = team2Name;
    } else if (team2Select && team2Select.value !== "") {
        team2Select.value = ""; // Сброс на дефолтное значение "-"
    }

    // Обновляем данные по картам и счёту
    let prefix = "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
    else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
    else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

    const mapRows = matchColumn.querySelectorAll(".map-row");
    mapRows.forEach((row, i) => {
      const mapKey = prefix + `MAP${i + 1}`;
      const scoreKey = prefix + `MAP${i + 1}_SCORE`;
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");

      const mapValue = match[mapKey];
      if (mapSelect && mapValue !== undefined) {
          // Проверяем, существует ли такая опция
          if (mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`)) {
              if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
          } else if (mapSelect.value !== mapSelect.options[0].value) {
              // Если опции нет, сбрасываем на дефолтную
              mapSelect.value = mapSelect.options[0].value;
          }
      } else if (mapSelect && mapSelect.value !== mapSelect.options[0].value) {
          mapSelect.value = mapSelect.options[0].value; // Сброс на дефолтное значение
      }

      const scoreValue = match[scoreKey];
      if (scoreInput && scoreValue !== undefined) {
         if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
      } else if (scoreInput && scoreInput.value !== "") {
        scoreInput.value = ""; // Очищаем поле
      }
    });

    // --- Восстановление состояния победителя ---
    let winnerTeamKey = "";
    const currentTeam1Name = team1Select ? team1Select.value : ""; // Берем текущее значение из селекта
    const currentTeam2Name = team2Select ? team2Select.value : "";
    // Победитель определяется только для FINISHED матчей по полю TEAMWINNER
    if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
       // Сравниваем с текущими именами в селектах
       if (currentTeam1Name && match.TEAMWINNER === currentTeam1Name) {
           winnerTeamKey = "TEAM1";
       } else if (currentTeam2Name && match.TEAMWINNER === currentTeam2Name) {
           winnerTeamKey = "TEAM2";
       }
    }

    if (winnerTeamKey) {
        matchColumn.setAttribute("data-winner", winnerTeamKey);
    } else {
        matchColumn.removeAttribute("data-winner");
    }

    // Обновляем лейблы и подсветку кнопок
    if (typeof updateWinnerButtonLabels === 'function') {
        updateWinnerButtonLabels(matchIndex);
    } else { console.warn(`updateWinnerButtonLabels не найдена для матча ${matchIndex}`); }
    if (typeof refreshWinnerHighlight === 'function') {
        refreshWinnerHighlight(matchIndex);
    } else {
        console.warn(`refreshWinnerHighlight не найдена для матча ${matchIndex}`);
        matchColumn.querySelectorAll(".winner-btn").forEach(b => {
            b.classList.toggle("winner-selected", b.getAttribute("data-team") === winnerTeamKey);
        });
    }
    // --- Конец восстановления состояния победителя ---

  });
   console.log("[UI] Matches UI update finished.");
}


// Обновление Map Veto UI (без изменений)
function updateMapVetoUI(mapVetoData) {
  // ... (код остался прежним)
}

// Обновление VRS UI (без изменений)
function updateVRSUI(rawVrsData) {
  // ... (код остался прежним)
}

// Обновление верхнего блока (custom fields) (без изменений)
function updateCustomFieldsUI(fields) {
 // ... (код остался прежним)
}

// ========== Загрузка данных с сервера ==========

async function loadMatchesFromServer() {
  console.log("[Data] Loading matches data from server...");
  try {
    const response = await fetch("/api/matchdata");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const matches = await response.json();
    console.log("[Data] Matches data loaded:", matches);
    // Обновляем UI только после инициализации команд
    if (areTeamsInitialized()) {
        updateMatchesUI(matches);
    } else {
        console.log("[Data] Teams not ready yet, match UI update deferred.");
        // Промис initMatches разрешится, и тогда можно будет обновить UI
        // Или можно дождаться здесь: await initMatches(); updateMatchesUI(matches);
        // Но лучше обновлять по событию jsonUpdate после инициализации
    }
  } catch (error) {
    console.error("[Data] Ошибка загрузки matchdata:", error);
  }
}

async function loadRawVRSData() {
    console.log("[Data] Loading raw VRS data...");
    try {
        const response = await fetch("/api/vrs-raw");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawVrsData = await response.json();
        console.log("[Data] Raw VRS data loaded:", rawVrsData);
        updateVRSUI(rawVrsData);
    } catch (error) {
        console.error("[Data] Ошибка загрузки raw VRS data:", error);
    }
}

async function loadMapVetoFromServer() {
    console.log("[Data] Loading map veto data...");
    try {
        const response = await fetch("/api/mapveto");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const mapVetoData = await response.json();
         console.log("[Data] Map veto data loaded:", mapVetoData);
        updateMapVetoUI(mapVetoData);
    } catch (error) {
        console.error("[Data] Ошибка загрузки map veto data:", error);
    }
}


async function loadCustomFieldsFromServer() {
  console.log("[Data] Loading custom fields data...");
  try {
    const response = await fetch("/api/customfields");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const dataArray = await response.json();
    console.log("[Data] Custom fields data loaded:", dataArray);
    if (dataArray && dataArray.length > 0) {
        updateCustomFieldsUI(dataArray[0]);
    } else {
        updateCustomFieldsUI({});
    }
  } catch (err) {
    console.error("[Data] Ошибка загрузки custom fields:", err);
  }
}

// Функция вычисления текущего дня турнира (без изменений)
function calculateTournamentDay() {
 // ... (код остался прежним)
}

// Обновляем display дня турнира (без изменений)
function updateTournamentDay() {
 // ... (код остался прежним)
}

// Привязка обработчиков изменения дат (без изменений)
const tournamentStartInput = document.getElementById("tournamentStart");
// ... (код остался прежним)

// ========== Функции сбора данных ==========

function gatherCustomFieldsData() {
 // ... (код остался прежним)
}

// Функция applyChanges (без изменений)
async function applyChanges() {
 // ... (код остался прежним)
}

// Привязка обработчика на кнопку Apply (без изменений)
const applyBtn = document.getElementById("applyButton");
// ... (код остался прежним)


// ========== Инициализация при загрузке страницы ==========

// Превращаем обработчик в async функцию
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
      // 1. Дожидаемся завершения инициализации команд (загрузка списка и заполнение селектов)
      await initMatches(); // Ждем разрешения промиса
      console.log("DOMContentLoaded: Teams initialized.");

      // 2. Теперь загружаем остальные данные
      await loadMatchesFromServer(); // Теперь updateMatchesUI внутри сработает корректно
      await loadRawVRSData();
      await loadCustomFieldsFromServer();
      await loadMapVetoFromServer();

      console.log("DOMContentLoaded: Initial data loading complete.");

  } catch (error) {
      console.error("DOMContentLoaded: Error during initialization:", error);
      // Можно показать сообщение об ошибке пользователю
  }
});

// --- Вспомогательная функция для окраски селекта статуса ---
// (Определена в matches.js и импортируется)
// function updateStatusColor(sel) { ... }
