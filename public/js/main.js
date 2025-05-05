// public/js/main.js
// Импортируем нужные функции, включая updateStatusColor
import { initMatches, gatherMatchesData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js"; // <--- ДОБАВЛЕНО updateStatusColor
import { initMapVeto, gatherMapVetoData } from "./mapVeto.js";
import { initVRS, gatherVRSData } from "./vrs.js";
import { saveData } from "./api.js";

// ========== Инициализация модулей ==========
initMatches(); // Начинает загрузку списка команд
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========

socket.on("jsonUpdate", (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  // Ждем инициализации команд перед обновлением UI
  if (areTeamsInitialized()) {
      updateMatchesUI(matches);
  } else {
      console.log("[SOCKET] Teams not initialized yet, delaying matches UI update.");
      // Можно дождаться промиса инициализации, если нужно гарантировать обновление
      initMatches().then(() => updateMatchesUI(matches));
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
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, '').trim();
      timeInput.value = timeValue;
    }

    // Обновляем статус
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
        let newStatus = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
        else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

        if (newStatus && statusSelect.value !== newStatus) {
            statusSelect.value = newStatus;
            // Обновляем классы и цвет фона - ТЕПЕРЬ updateStatusColor ДОСТУПНА
             if (typeof updateStatusColor === 'function') {
                 updateStatusColor(statusSelect); // Вызов функции из matches.js
             } else {
                 // Эта ветка больше не должна выполняться, но оставим для отладки
                 console.error("updateStatusColor function is still not found!");
             }
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
             matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
        } else if (!newStatus && statusSelect.value !== statusSelect.options[0].value) {
             // Если статус не определен, сбрасываем на дефолтное значение
             statusSelect.value = statusSelect.options[0].value;
             if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
        }
    }

    // Обновляем команды
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select) { // Проверяем наличие селекта
        // Ищем опцию по значению
        const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
        if (team1Name && optionExists) {
            if (team1Select.value !== team1Name) team1Select.value = team1Name;
        } else if (team1Select.value !== "") {
            team1Select.value = ""; // Сброс на "-"
        }
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
     if (team2Select) { // Проверяем наличие селекта
        const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
        if (team2Name && optionExists) {
            if (team2Select.value !== team2Name) team2Select.value = team2Name;
        } else if (team2Select.value !== "") {
            team2Select.value = ""; // Сброс на "-"
        }
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
          const optionExists = mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`);
          if (optionExists) {
              if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
          } else if (mapSelect.value !== mapSelect.options[0].value) {
              mapSelect.value = mapSelect.options[0].value;
          }
      } else if (mapSelect && mapSelect.value !== mapSelect.options[0].value) {
          mapSelect.value = mapSelect.options[0].value;
      }

      const scoreValue = match[scoreKey];
      if (scoreInput && scoreValue !== undefined) {
         if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
      } else if (scoreInput && scoreInput.value !== "") {
        scoreInput.value = "";
      }
    });

    // --- Восстановление состояния победителя ---
    let winnerTeamKey = "";
    const currentTeam1Name = team1Select ? team1Select.value : "";
    const currentTeam2Name = team2Select ? team2Select.value : "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
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


// Обновление Map Veto UI
function updateMapVetoUI(mapVetoData) {
  if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
      console.warn("[UI] Получены некорректные данные для updateMapVetoUI:", mapVetoData);
      return;
  }
  const matchSelect = document.getElementById("matchSelect");
  if (matchSelect && mapVetoData.matchIndex && matchSelect.value != mapVetoData.matchIndex) { // Обновляем только если значение отличается
      matchSelect.value = mapVetoData.matchIndex;
  }

  mapVetoData.veto.forEach((vetoItem, idx) => {
    const row = document.querySelector(`#vetoTable tr[data-index="${idx + 1}"]`);
    if (row) {
      const actionSelect = row.querySelector(".veto-action");
      const mapSelect = row.querySelector(".veto-map");
      const teamSelect = row.querySelector(".veto-team");
      const sideSelect = row.querySelector(".veto-side");

      if (actionSelect && actionSelect.value !== (vetoItem.action || 'BAN')) actionSelect.value = vetoItem.action || 'BAN';
      if (mapSelect && mapSelect.value !== (vetoItem.map || mapSelect.options[0].value)) mapSelect.value = vetoItem.map || mapSelect.options[0].value;
      if (teamSelect && teamSelect.value !== (vetoItem.team || 'TEAM1')) teamSelect.value = vetoItem.team || 'TEAM1';
      if (sideSelect && sideSelect.value !== (vetoItem.side || '-')) sideSelect.value = vetoItem.side || '-';
    }
  });
   console.log("[UI] Map Veto UI updated for match", mapVetoData.matchIndex);
}

// Обновление VRS UI
function updateVRSUI(rawVrsData) {
  if (!rawVrsData) {
      console.warn("[UI] Получены пустые данные для updateVRSUI");
      return;
  }
  console.log("[UI] Updating VRS UI...");
  for (let i = 1; i <= 4; i++) {
    const matchVrs = rawVrsData[i];
    if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
      const team1Win = document.getElementById(`team1WinPoints${i}`);
      if (team1Win && team1Win.value !== (matchVrs.TEAM1.winPoints || '')) team1Win.value = matchVrs.TEAM1.winPoints ?? ''; // Используем ?? для null/undefined
      const team1Lose = document.getElementById(`team1LosePoints${i}`);
      if (team1Lose && team1Lose.value !== (matchVrs.TEAM1.losePoints || '')) team1Lose.value = matchVrs.TEAM1.losePoints ?? '';
      const team1Rank = document.getElementById(`team1Rank${i}`);
      if (team1Rank && team1Rank.value !== (matchVrs.TEAM1.rank || '')) team1Rank.value = matchVrs.TEAM1.rank ?? '';
      const team1Current = document.getElementById(`team1CurrentPoints${i}`);
      if (team1Current && team1Current.value !== (matchVrs.TEAM1.currentPoints || '')) team1Current.value = matchVrs.TEAM1.currentPoints ?? '';

      const team2Win = document.getElementById(`team2WinPoints${i}`);
      if (team2Win && team2Win.value !== (matchVrs.TEAM2.winPoints || '')) team2Win.value = matchVrs.TEAM2.winPoints ?? '';
      const team2Lose = document.getElementById(`team2LosePoints${i}`);
      if (team2Lose && team2Lose.value !== (matchVrs.TEAM2.losePoints || '')) team2Lose.value = matchVrs.TEAM2.losePoints ?? '';
      const team2Rank = document.getElementById(`team2Rank${i}`);
      if (team2Rank && team2Rank.value !== (matchVrs.TEAM2.rank || '')) team2Rank.value = matchVrs.TEAM2.rank ?? '';
      const team2Current = document.getElementById(`team2CurrentPoints${i}`);
      if (team2Current && team2Current.value !== (matchVrs.TEAM2.currentPoints || '')) team2Current.value = matchVrs.TEAM2.currentPoints ?? '';
    } else {
        // Можно добавить логику очистки полей, если данных для матча нет
        // console.warn(`[UI] No VRS data for match ${i}`);
    }
  }
   console.log("[UI] VRS UI update finished.");
}

// Обновление верхнего блока (custom fields)
function updateCustomFieldsUI(fields) {
  if (!fields) return;
  console.log("[UI] Updating custom fields UI...");
  const upcoming = document.getElementById("upcomingMatchesInput");
  if (upcoming && upcoming.value !== (fields.upcomingMatches || "")) upcoming.value = fields.upcomingMatches || "";

  const galaxy = document.getElementById("galaxyBattleInput");
  if (galaxy && galaxy.value !== (fields.galaxyBattle || "")) galaxy.value = fields.galaxyBattle || "";

  const startDate = document.getElementById("tournamentStart");
  if (startDate && startDate.value !== (fields.tournamentStart || "")) startDate.value = fields.tournamentStart || "";

  const endDate = document.getElementById("tournamentEnd");
  if (endDate && endDate.value !== (fields.tournamentEnd || "")) endDate.value = fields.tournamentEnd || "";

  const groupStage = document.getElementById("groupStageInput");
  if (groupStage && groupStage.value !== (fields.groupStage || "")) groupStage.value = fields.groupStage || "";

  // Обновляем день турнира после установки дат
  updateTournamentDay();
  console.log("[UI] Custom fields UI update finished.");
}

// ========== Загрузка данных с сервера ==========

async function loadMatchesFromServer() {
  console.log("[Data] Loading matches data from server...");
  try {
    const response = await fetch("/api/matchdata");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const matches = await response.json();
    console.log("[Data] Matches data loaded:", matches);
    if (areTeamsInitialized()) {
        updateMatchesUI(matches);
    } else {
        console.log("[Data] Teams not ready yet, match UI update deferred.");
        // Ждем инициализации и обновляем
        await initMatches();
        updateMatchesUI(matches);
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

// Функция вычисления текущего дня турнира
function calculateTournamentDay() {
  const startDateValue = document.getElementById("tournamentStart")?.value; // Добавим ?. для безопасности
  const endDateValue = document.getElementById("tournamentEnd")?.value;
  const displaySpan = document.getElementById("tournamentDayDisplay");

  if (!displaySpan) return; // Выходим, если нет элемента для отображения

  if (!startDateValue) {
      displaySpan.textContent = '';
      return;
  }

  try {
      const start = new Date(startDateValue);
      const end = endDateValue ? new Date(endDateValue) : null;
      const today = new Date();

      start.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (end) end.setHours(0, 0, 0, 0);

      if (today < start) {
          displaySpan.textContent = 'Турнир не начался';
      } else if (end && today > end) {
          displaySpan.textContent = 'Турнир завершен';
      } else {
          const diffTime = today - start;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          displaySpan.textContent = `День ${diffDays}`;
      }
  } catch (e) {
      console.error("Ошибка при расчете дня турнира:", e);
      displaySpan.textContent = '';
  }
}


// Обновляем display дня турнира
function updateTournamentDay() {
    calculateTournamentDay();
}

// Привязка обработчиков изменения дат
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// ========== Функции сбора данных ==========

function gatherCustomFieldsData() {
  updateTournamentDay(); // Обновляем день перед сбором
  return {
    upcomingMatches: document.getElementById("upcomingMatchesInput")?.value ?? "",
    galaxyBattle: document.getElementById("galaxyBattleInput")?.value ?? "",
    tournamentStart: document.getElementById("tournamentStart")?.value ?? "",
    tournamentEnd: document.getElementById("tournamentEnd")?.value ?? "",
    tournamentDay: document.getElementById("tournamentDayDisplay")?.textContent ?? "",
    groupStage: document.getElementById("groupStageInput")?.value ?? ""
  };
}

// Функция applyChanges
async function applyChanges() {
  console.log("Нажата кнопка APPLY. Начинаем сбор и отправку данных...");
  const applyButton = document.getElementById("applyButton"); // Найдем кнопку заранее

  // Опционально: Блокируем кнопку на время сохранения
  if (applyButton) {
      applyButton.disabled = true;
      applyButton.textContent = "SAVING...";
      applyButton.style.cursor = "wait";
  }

  try {
    // 1. Сбор данных Custom Fields
    const customData = gatherCustomFieldsData();
    console.log("Собраны Custom Fields:", customData);
    await saveData("/api/customfields", customData);
    console.log("Custom Fields сохранены.");

    // 2. Сбор данных Matches
    const matchesData = gatherMatchesData();
    console.log("Собраны Matches Data:", matchesData);
    await saveData("/api/matchdata", matchesData);
    console.log("Matches Data сохранены.");

    // 3. Сбор данных Map Veto
    const mapVetoData = gatherMapVetoData();
    console.log("Собраны Map Veto Data:", mapVetoData);
    await saveData("/api/mapveto", mapVetoData);
    console.log("Map Veto Data сохранены.");

    // 4. Сбор данных VRS
    const vrsData = gatherVRSData();
    console.log("Собраны VRS Data:", vrsData);
    await saveData("/api/vrs", vrsData);
    console.log("VRS Data сохранены.");

    console.log("Изменения успешно применены и отправлены на сервер.");

    // Показываем подтверждение
    if(applyButton){
        applyButton.textContent = "SAVED!";
        applyButton.style.backgroundColor = "var(--color-success)";
        setTimeout(() => {
            applyButton.textContent = "APPLY";
            applyButton.style.backgroundColor = ""; // Возвращаем исходный стиль
        }, 1500);
    }

  } catch (error) {
    console.error("Ошибка при применении изменений:", error);
    // Сообщаем об ошибке
     if(applyButton){
        applyButton.textContent = "ERROR!";
        applyButton.style.backgroundColor = "var(--color-error)";
        setTimeout(() => {
            applyButton.textContent = "APPLY";
            applyButton.style.backgroundColor = "";
        }, 2500);
    }
  } finally {
      // Разблокируем кнопку в любом случае
      if (applyButton) {
          applyButton.disabled = false;
          applyButton.style.cursor = "pointer";
          // Убедимся, что текст вернулся к APPLY, если не было подтверждения
          if (applyButton.textContent !== "APPLY" && applyButton.textContent !== "SAVED!" && applyButton.textContent !== "ERROR!") {
               applyButton.textContent = "APPLY";
               applyButton.style.backgroundColor = "";
          }
      }
  }
}

// Привязка обработчика на кнопку Apply
const applyBtn = document.getElementById("applyButton");
if (applyBtn) {
    applyBtn.addEventListener("click", applyChanges);
    console.log("Обработчик клика для кнопки APPLY успешно привязан.");
} else {
    console.error("Кнопка Apply (id='applyButton') не найдена на странице!");
}


// ========== Инициализация при загрузке страницы ==========

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
      // 1. Дожидаемся завершения инициализации команд
      await initMatches(); // Ждет разрешения промиса из matches.js
      console.log("DOMContentLoaded: Teams initialized.");

      // 2. Загружаем остальные данные
      await loadMatchesFromServer();
      await loadRawVRSData();
      await loadCustomFieldsFromServer();
      await loadMapVetoFromServer();

      console.log("DOMContentLoaded: Initial data loading complete.");

  } catch (error) {
      console.error("DOMContentLoaded: Error during initialization:", error);
  }
});
