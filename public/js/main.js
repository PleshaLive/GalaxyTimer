// public/js/main.js
// Импортируем необходимые функции из других модулей
import { initMatches, gatherSingleMatchData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js";
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions } from "./mapVeto.js"; // Импортируем updateVetoTeamOptions отсюда
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

// ========== Инициализация модулей ==========
// Начинаем инициализацию команд и сохраняем промис, чтобы дождаться его позже
const initPromise = initMatches();
// Инициализируем остальные модули (они не требуют ожидания)
initMapVeto(); // Вызов инициализации Veto (добавляет опции Match 1-4 в #matchSelect)
initVRS();

// ========== Socket.io подписки ==========
socket.on("jsonUpdate", async (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  try { await initPromise; updateMatchesUI(matches); }
  catch (error) { console.error("[SOCKET] Error updating matches UI after jsonUpdate:", error); }
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) jsonOutput.textContent = JSON.stringify(matches, null, 2);
});
socket.on("mapVetoUpdate", (updatedMapVeto) => {
    console.log("[SOCKET] Received mapVetoUpdate:", updatedMapVeto);
    updateMapVetoUI(updatedMapVeto);
    const matchSelect = document.getElementById("matchSelect");
    if(matchSelect && updatedMapVeto && matchSelect.value != updatedMapVeto.matchIndex) {
        matchSelect.value = updatedMapVeto.matchIndex;
        updateVetoTeamOptions(updatedMapVeto.matchIndex);
    } else if (updatedMapVeto?.matchIndex) {
        updateVetoTeamOptions(updatedMapVeto.matchIndex);
    }
});
socket.on("vrsUpdate", (rawVrsData) => { console.log("[SOCKET] Received vrsUpdate (raw):", rawVrsData); updateVRSUI(rawVrsData); });
socket.on("customFieldsUpdate", (newFields) => {
  console.log("[SOCKET] Received customFieldsUpdate:", newFields);
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  if (fieldsData && typeof fieldsData === 'object') { updateCustomFieldsUI(fieldsData); }
  else { console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields); updateCustomFieldsUI({}); }
});
socket.on("pauseUpdate", (pauseData) => {
    console.log("[SOCKET] Received pauseUpdate:", pauseData);
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (pauseData) {
        if (msgInput && msgInput.value !== (pauseData.pause || "")) msgInput.value = pauseData.pause || "";
        if (timeInput && timeInput.value !== (pauseData.lastUpd || "")) timeInput.value = pauseData.lastUpd || "";
    } else {
        if (msgInput) msgInput.value = "";
        if (timeInput) timeInput.value = "";
    }
});

// ========== Функции обновления UI ==========

function updateMatchesUI(matches) {
    console.log("[UI] Updating matches UI...");
    if (!Array.isArray(matches)) { /* ... */ return; }
    matches.forEach((match, index) => {
        const matchIndex = index + 1;
        const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
        if (!matchColumn) { /* ... */ return; }

        // Обновление времени, статуса, команд, карт, победителя...
        const timeInput = document.getElementById(`timeInput${matchIndex}`);
        let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
        timeValue = timeValue.replace(/ CEST$/i, '').trim();
        if (timeInput && timeInput.value !== timeValue) timeInput.value = timeValue;

        const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
         if (statusSelect) {
            let newStatus = "";
            if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
            else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
            else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";
            if (newStatus && statusSelect.value !== newStatus) {
                statusSelect.value = newStatus;
                 if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
                 matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                 matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
            } else if (!newStatus && statusSelect.value !== statusSelect.options[0].value) {
                 statusSelect.value = statusSelect.options[0].value;
                 if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
                 matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
            }
        }

        const team1Select = document.getElementById(`team1Select${matchIndex}`);
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
        if (team1Select) {
            const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
            if (team1Name && optionExists) { if (team1Select.value !== team1Name) team1Select.value = team1Name; }
            else if (team1Select.value !== "") { team1Select.value = ""; }
        }
        const team2Select = document.getElementById(`team2Select${matchIndex}`);
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
         if (team2Select) {
            const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
            if (team2Name && optionExists) { if (team2Select.value !== team2Name) team2Select.value = team2Name; }
            else if (team2Select.value !== "") { team2Select.value = ""; }
        }

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
                if (optionExists) { if (mapSelect.value !== mapValue) mapSelect.value = mapValue; }
                else if (mapSelect.value !== mapSelect.options[0].value) { mapSelect.value = mapSelect.options[0].value; }
            } else if (mapSelect && mapSelect.value !== mapSelect.options[0].value) { mapSelect.value = mapSelect.options[0].value; }
            const scoreValue = match[scoreKey];
            if (scoreInput && scoreValue !== undefined) { if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue; }
            else if (scoreInput && scoreInput.value !== "") { scoreInput.value = ""; }
        });

        let winnerTeamKey = "";
        const currentTeam1Name = team1Select ? team1Select.value : "";
        const currentTeam2Name = team2Select ? team2Select.value : "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
           if (currentTeam1Name && match.TEAMWINNER === currentTeam1Name) winnerTeamKey = "TEAM1";
           else if (currentTeam2Name && match.TEAMWINNER === currentTeam2Name) winnerTeamKey = "TEAM2";
        }
        if (winnerTeamKey) matchColumn.setAttribute("data-winner", winnerTeamKey);
        else matchColumn.removeAttribute("data-winner");

        if (typeof updateWinnerButtonLabels === 'function') updateWinnerButtonLabels(matchIndex);
        if (typeof refreshWinnerHighlight === 'function') refreshWinnerHighlight(matchIndex);
        if(typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    });
    const matchSelect = document.getElementById("matchSelect");
    if (matchSelect?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelect.value);
    }
   console.log("[UI] Matches UI update finished.");
}

function updateMapVetoUI(mapVetoData) {
    if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) { /* ... */ return; }
    const matchSelect = document.getElementById("matchSelect");
    if (matchSelect && mapVetoData.matchIndex && matchSelect.value != mapVetoData.matchIndex) {
        matchSelect.value = mapVetoData.matchIndex;
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(mapVetoData.matchIndex);
        } else { console.warn("updateVetoTeamOptions is not available"); }
    }
    mapVetoData.veto.forEach((vetoItem, idx) => {
        const rowIndex = idx + 1;
        const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
        if (row) { /* ... (код обновления строк Veto) ... */ }
        else { console.warn(`[UI] Строка ${rowIndex} в таблице Map Veto не найдена.`); }
    });
    console.log("[UI] Map Veto UI updated for match", mapVetoData.matchIndex);
}

function updateVRSUI(rawVrsData) { /* ... (код без изменений) ... */ }
function updateCustomFieldsUI(fields) { /* ... (код без изменений) ... */ }

// ========== Загрузка данных с сервера ==========
async function loadMatchesFromServer() { /* ... (код без изменений) ... */ }
async function loadRawVRSData() { /* ... (код без изменений) ... */ }
async function loadMapVetoFromServer() { /* ... (код без изменений) ... */ }
async function loadCustomFieldsFromServer() { /* ... (код без изменений) ... */ }
async function loadPauseDataFromServer() { /* ... (код без изменений) ... */ }

// ========== Вспомогательные функции ==========
function calculateTournamentDay() { /* ... (код без изменений) ... */ }
function updateTournamentDay() { /* ... (код без изменений) ... */ }
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// ========== Функции сбора данных ==========
function gatherCustomFieldsData() { /* ... (код без изменений) ... */ }
function gatherPauseData() { /* ... (код без изменений) ... */ }

// ========== Функции сохранения данных ==========
function setButtonState(button, state, message = null) { /* ... (код без изменений) ... */ }
async function saveMatchData(matchIndex, buttonElement) { /* ... (код без изменений) ... */ }
async function saveMapVetoData(buttonElement) {
    console.log(`[Save] Saving Map Veto data...`);
    setButtonState(buttonElement, 'saving');
    try {
        // Используем прямой вызов gatherMapVetoData
        const mapVetoData = gatherMapVetoData();
        if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
        console.log(`[Save] Map Veto Data:`, mapVetoData);
        await saveData('/api/mapveto', mapVetoData, 'POST');
        console.log(`[Save] Map Veto data saved successfully.`);
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving Map Veto data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
    } finally {
         if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
             setButtonState(buttonElement, 'idle');
         }
    }
}
async function saveHeaderData(buttonElement) { /* ... (код без изменений) ... */ }
async function savePauseData(buttonElement) { /* ... (код без изменений) ... */ }


// ========== Привязка обработчиков к кнопкам и селектам ==========

/** Привязывает обработчики кликов к кнопкам сохранения и селектам Veto. */
function setupListeners() { // Переименована для ясности
    // Обработчики для кнопок сохранения матчей
    document.querySelectorAll('.save-match-button').forEach(button => {
        button.dataset.originalText = button.textContent;
        const matchIndex = button.dataset.matchIndex;
        if (matchIndex) {
            button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
            console.log(`[Init] Save listener attached for Match ${matchIndex}`);
        } else {
            console.warn("[Init] Save match button found without data-match-index attribute.");
        }
    });

    // Обработчик для кнопки сохранения Map Veto
    const saveVetoButton = document.getElementById('saveMapVetoButton');
    if (saveVetoButton) {
        saveVetoButton.dataset.originalText = saveVetoButton.textContent;
        saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
        console.log("[Init] Save listener attached for Map Veto.");
    } else {
        console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found.");
    }

    // Обработчик для кнопки сохранения хедера
    const saveHeaderButton = document.getElementById('saveHeaderButton');
    if (saveHeaderButton) {
        saveHeaderButton.dataset.originalText = saveHeaderButton.textContent;
        saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
        console.log("[Init] Save listener attached for Header.");
    } else {
        console.warn("[Init] Save Header button (id='saveHeaderButton') not found.");
    }

    // Обработчик для кнопки сохранения паузы
    const savePauseButton = document.getElementById('savePauseButton');
    if (savePauseButton) {
        savePauseButton.dataset.originalText = savePauseButton.textContent;
        savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
        console.log("[Init] Save listener attached for Pause.");
    } else {
        console.warn("[Init] Save Pause button (id='savePauseButton') not found.");
    }

    // Обработчики для обновления Veto при смене матча или команд
    const matchSelect = document.getElementById("matchSelect");
    if (matchSelect) {
        // При смене матча в Veto селекте, обновляем опции команд
        matchSelect.addEventListener('change', () => updateVetoTeamOptions(matchSelect.value)); // Используем прямой вызов
        console.log("[Init] Veto listener attached for #matchSelect change.");
    }
    for (let i = 1; i <= 4; i++) {
        const team1Sel = document.getElementById(`team1Select${i}`);
        const team2Sel = document.getElementById(`team2Select${i}`);
        const listener = () => {
            // Обновляем Veto только если изменилась команда ВЫБРАННОГО для Veto матча
            if (matchSelect && matchSelect.value == i) { // Сравнение строк, т.к. value из селекта - строка
                updateVetoTeamOptions(i); // Используем прямой вызов
            }
        };
        if (team1Sel) team1Sel.addEventListener('change', listener);
        if (team2Sel) team2Sel.addEventListener('change', listener);
    }
     console.log("[Init] Veto listeners attached for team selects change.");

    console.log("[Init] All button and select listeners attached.");
}


// ========== Инициализация при загрузке страницы ==========

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
      // 1. Дожидаемся завершения инициализации команд
      await initPromise;
      console.log("DOMContentLoaded: Teams initialized.");

      // 2. Загружаем остальные данные с сервера
      await loadMatchesFromServer();
      await loadRawVRSData();
      await loadCustomFieldsFromServer();
      await loadMapVetoFromServer();
      await loadPauseDataFromServer();

      // 3. Привязываем все обработчики событий
      setupListeners(); // Вызываем общую функцию привязки

      // 4. Первичное обновление опций Veto
      const matchSelect = document.getElementById("matchSelect");
      if (matchSelect?.value && typeof updateVetoTeamOptions === 'function') { // Проверяем наличие функции
          updateVetoTeamOptions(matchSelect.value); // Используем прямой вызов
      }

      console.log("DOMContentLoaded: Initial data loading and listener setup complete.");

  } catch (error) {
      console.error("DOMContentLoaded: Error during initialization:", error);
  }
});
