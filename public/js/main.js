// public/js/main.js
// Импортируем необходимые функции из других модулей
import { initMatches, gatherSingleMatchData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js";
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions, styleVetoActionSelect } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

// Инициализация Socket.IO клиента
const socket = io();

// ========== Инициализация модулей ==========
const initPromise = initMatches();
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========

socket.on("jsonUpdate", async (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  try {
    await initPromise;
    updateMatchesUI(matches);
  } catch (error) {
    console.error("[SOCKET] Error updating matches UI after jsonUpdate:", error);
  }
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) {
    jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

socket.on("mapVetoUpdate", (updatedMapVeto) => {
    console.log("[SOCKET] Received mapVetoUpdate:", updatedMapVeto);
    updateMapVetoUI(updatedMapVeto);
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }
    }
});

socket.on("vrsUpdate", (rawVrsData) => {
  console.log("[SOCKET] Received vrsUpdate (raw):", rawVrsData);
  updateVRSUI(rawVrsData);
});

socket.on("customFieldsUpdate", (newFields) => {
  console.log("[SOCKET] Received customFieldsUpdate:", newFields);
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  if (fieldsData && typeof fieldsData === 'object') {
    updateCustomFieldsUI(fieldsData);
  } else {
    console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields);
    updateCustomFieldsUI({});
  }
});

socket.on("pauseUpdate", (pauseData) => {
  console.log("[SOCKET] Received pauseUpdate (main.js):", pauseData);
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

    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, '').trim();
      if (timeInput.value !== timeValue) timeInput.value = timeValue;
    }

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
        if(newStatus) matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
      } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
        statusSelect.value = statusSelect.options[0].value;
        if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
        matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
         if (statusSelect.options[0].value) {
            matchColumn.classList.add(`status-${statusSelect.options[0].value.toLowerCase()}`);
        }
      }
    }

    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select) {
      const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
      if (team1Name && optionExists) {
        if (team1Select.value !== team1Name) team1Select.value = team1Name;
      } else if (team1Select.value !== "") {
        team1Select.value = "";
      }
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    if (team2Select) {
      const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
      if (team2Name && optionExists) {
        if (team2Select.value !== team2Name) team2Select.value = team2Name;
      } else if (team2Select.value !== "") {
        team2Select.value = "";
      }
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

      if (mapSelect && typeof mapValue !== 'undefined') {
        const optionExists = mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`);
        if (mapValue && optionExists) {
          if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
        } else if (mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) {
          mapSelect.value = mapSelect.options[0].value;
        } else if (!mapValue && mapSelect.value !== "" && mapSelect.options.length > 0) {
            mapSelect.value = mapSelect.options[0].value;
        }
      } else if (mapSelect && mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) {
        mapSelect.value = mapSelect.options[0].value;
      }

      const scoreValue = match[scoreKey];
      if (scoreInput && typeof scoreValue !== 'undefined') {
        if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
      } else if (scoreInput && scoreInput.value !== "") {
        scoreInput.value = "";
      }
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

    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
  });

  const matchSelectElement = document.getElementById("matchSelect");
  if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
    updateVetoTeamOptions(matchSelectElement.value);
  }
  console.log("[UI] Matches UI update finished.");
}

function updateMapVetoUI(mapVetoData) {
  if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
    console.warn("[UI] Получены некорректные данные для updateMapVetoUI:", mapVetoData);
    return;
  }
  const matchSelectElement = document.getElementById("matchSelect");

  if (matchSelectElement && typeof mapVetoData.matchIndex !== 'undefined' && matchSelectElement.value != mapVetoData.matchIndex) {
    matchSelectElement.value = mapVetoData.matchIndex;
  }

  mapVetoData.veto.forEach((vetoItem, idx) => {
    const rowIndex = idx + 1;
    const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
    if (row) {
      const actionSelect = row.querySelector(".veto-action");
      const mapSelectInRow = row.querySelector(".veto-map");
      const teamSelect = row.querySelector(".veto-team");
      const sideSelect = row.querySelector(".veto-side");

      if (actionSelect) {
        const actionValueFromData = vetoItem.action || 'BAN';
        if (actionSelect.value !== actionValueFromData) {
          actionSelect.value = actionValueFromData;
        }
        if (typeof styleVetoActionSelect === 'function') {
            styleVetoActionSelect(actionSelect);
        }
      }

      if (mapSelectInRow && mapSelectInRow.value !== (vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : ""))) {
        mapSelectInRow.value = vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : "");
      }
      
      if (teamSelect) {
        const teamValueFromData = vetoItem.team || 'TEAM1';
        if (teamSelect.value !== teamValueFromData) {
          teamSelect.value = teamValueFromData;
        }
      }
      if (sideSelect && sideSelect.value !== (vetoItem.side || '-')) {
        sideSelect.value = vetoItem.side || '-';
      }
    } else {
      console.warn(`[UI] Строка ${rowIndex} в таблице Map Veto не найдена.`);
    }
  });
  
  if (matchSelectElement?.value && typeof mapVetoData.matchIndex !== 'undefined' && typeof updateVetoTeamOptions === 'function') {
    updateVetoTeamOptions(matchSelectElement.value);
  }
  console.log("[UI] Map Veto UI updated for match", mapVetoData.matchIndex);
}

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
      if (team1Win && team1Win.value !== (matchVrs.TEAM1.winPoints ?? '')) team1Win.value = matchVrs.TEAM1.winPoints ?? '';
      const team1Lose = document.getElementById(`team1LosePoints${i}`);
      if (team1Lose && team1Lose.value !== (matchVrs.TEAM1.losePoints ?? '')) team1Lose.value = matchVrs.TEAM1.losePoints ?? '';
      const team1Rank = document.getElementById(`team1Rank${i}`);
      if (team1Rank && team1Rank.value !== (matchVrs.TEAM1.rank ?? '')) team1Rank.value = matchVrs.TEAM1.rank ?? '';
      const team1Current = document.getElementById(`team1CurrentPoints${i}`);
      if (team1Current && team1Current.value !== (matchVrs.TEAM1.currentPoints ?? '')) team1Current.value = matchVrs.TEAM1.currentPoints ?? '';

      const team2Win = document.getElementById(`team2WinPoints${i}`);
      if (team2Win && team2Win.value !== (matchVrs.TEAM2.winPoints ?? '')) team2Win.value = matchVrs.TEAM2.winPoints ?? '';
      const team2Lose = document.getElementById(`team2LosePoints${i}`);
      if (team2Lose && team2Lose.value !== (matchVrs.TEAM2.losePoints ?? '')) team2Lose.value = matchVrs.TEAM2.losePoints ?? '';
      const team2Rank = document.getElementById(`team2Rank${i}`);
      if (team2Rank && team2Rank.value !== (matchVrs.TEAM2.rank ?? '')) team2Rank.value = matchVrs.TEAM2.rank ?? '';
      const team2Current = document.getElementById(`team2CurrentPoints${i}`);
      if (team2Current && team2Current.value !== (matchVrs.TEAM2.currentPoints ?? '')) team2Current.value = matchVrs.TEAM2.currentPoints ?? '';
    } else {
      const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
      fields.forEach(field => {
        const el1 = document.getElementById(`team1${field}${i}`);
        if (el1 && el1.value !== '') el1.value = '';
        const el2 = document.getElementById(`team2${field}${i}`);
        if (el2 && el2.value !== '') el2.value = '';
      });
    }
  }
  if (typeof updateVRSTeamNames === 'function') {
    updateVRSTeamNames();
  }
  console.log("[UI] VRS UI update finished.");
}

function updateCustomFieldsUI(fields) {
  if (!fields || typeof fields !== 'object') {
    console.warn("[UI] Invalid data received for updateCustomFieldsUI:", fields);
    return;
  }
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
    await initPromise;
    updateMatchesUI(matches);
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

    if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
             updateVetoTeamOptions(matchSelectElement.value);
        }
    }
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
    if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
      updateCustomFieldsUI(dataArray[0]);
    } else {
      updateCustomFieldsUI({});
    }
  } catch (err) {
    console.error("[Data] Ошибка загрузки custom fields:", err);
    updateCustomFieldsUI({});
  }
}
async function loadPauseDataFromServer() {
  console.log("[Data] Loading pause data...");
  try {
    const response = await fetch("/api/pause");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const dataArray = await response.json();
    console.log("[Data] Pause data loaded:", dataArray);
    const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {};
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (msgInput) msgInput.value = pauseData.pause || "";
    if (timeInput) timeInput.value = pauseData.lastUpd || "";
  } catch (err) {
    console.error("[Data] Ошибка загрузки данных паузы:", err);
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (msgInput) msgInput.value = "";
    if (timeInput) timeInput.value = "";
  }
}

// ========== Вспомогательные функции ==========
function calculateTournamentDay() {
  const startDateInput = document.getElementById("tournamentStart")?.value;
  const endDateInput = document.getElementById("tournamentEnd")?.value;
  const displaySpan = document.getElementById("tournamentDayDisplay");
  if (!displaySpan) return;
  if (!startDateInput) {
    displaySpan.textContent = '';
    return;
  }
  try {
    const start = new Date(startDateInput);
    const end = endDateInput ? new Date(endDateInput) : null;
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
function updateTournamentDay() {
  calculateTournamentDay();
}
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// ========== Функции сбора данных ==========
function gatherCustomFieldsData() {
  updateTournamentDay();
  return {
    upcomingMatches: document.getElementById("upcomingMatchesInput")?.value ?? "",
    galaxyBattle: document.getElementById("galaxyBattleInput")?.value ?? "",
    tournamentStart: document.getElementById("tournamentStart")?.value ?? "",
    tournamentEnd: document.getElementById("tournamentEnd")?.value ?? "",
    tournamentDay: document.getElementById("tournamentDayDisplay")?.textContent ?? "",
    groupStage: document.getElementById("groupStageInput")?.value ?? ""
  };
}
function gatherPauseData() {
  const message = document.getElementById("pauseMessageInput")?.value ?? "";
  const time = document.getElementById("pauseTimeInput")?.value ?? "";
  return { pause: message, lastUpd: time };
}

// ========== Функции сохранения данных ==========
function setButtonState(button, state, message = null) {
  if (!button) return;
  const originalText = button.dataset.originalText || button.textContent || 'SAVE';
  if (!button.dataset.originalText) button.dataset.originalText = originalText;

  button.disabled = (state === 'saving');
  button.classList.remove('saving', 'saved', 'error', 'idle');
  button.style.cursor = (state === 'saving') ? 'wait' : 'pointer';

  switch (state) {
    case 'saving':
      button.textContent = message || 'SAVING...';
      button.classList.add('saving');
      break;
    case 'saved':
      button.textContent = message || 'SAVED!';
      button.classList.add('saved');
      setTimeout(() => {
        if (button.classList.contains('saved')) {
          button.textContent = originalText;
          button.classList.remove('saved');
          button.classList.add('idle');
        }
      }, 1500);
      break;
    case 'error':
      button.textContent = message || 'ERROR!';
      button.classList.add('error');
      setTimeout(() => {
        if (button.classList.contains('error')) {
           button.textContent = originalText;
           button.classList.remove('error');
           button.classList.add('idle');
        }
      }, 2500);
      break;
    case 'idle':
    default:
      button.textContent = originalText;
      button.classList.add('idle');
      break;
  }
}

async function saveMatchData(matchIndex, buttonElement) {
  console.log(`[Save] Saving data for Match ${matchIndex}...`);
  setButtonState(buttonElement, 'saving');
  try {
    const matchData = gatherSingleMatchData(matchIndex);
    if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}`);
    const vrsData = gatherSingleVRSData(matchIndex);
    if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}`);
    await saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT');
    await saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT');
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving data for Match ${matchIndex}:`, error);
    setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
  } finally {
    if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
      setButtonState(buttonElement, 'idle');
    }
  }
}
async function saveMapVetoData(buttonElement) {
  console.log(`[Save] Saving Map Veto data...`);
  setButtonState(buttonElement, 'saving');
  try {
    const mapVetoData = gatherMapVetoData();
    if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
    await saveData('/api/mapveto', mapVetoData, 'POST');
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
async function saveHeaderData(buttonElement) {
  console.log(`[Save] Saving Header data...`);
  setButtonState(buttonElement, 'saving');
  try {
    const customData = gatherCustomFieldsData();
    await saveData('/api/customfields', customData, 'POST');
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving Header data:`, error);
    setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
  } finally {
    if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
      setButtonState(buttonElement, 'idle');
    }
  }
}
async function savePauseData(buttonElement) {
  console.log(`[Save] Saving Pause data...`);
  setButtonState(buttonElement, 'saving');
  try {
    const pauseData = gatherPauseData();
    await saveData('/api/pause', pauseData, 'POST');
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving Pause data:`, error);
    setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
  } finally {
    if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
      setButtonState(buttonElement, 'idle');
    }
  }
}

// ========== Привязка обработчиков к кнопкам и селектам ==========
function setupListeners() {
  document.querySelectorAll('.save-match-button').forEach(button => {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    const matchIndex = button.dataset.matchIndex;
    if (matchIndex) {
      button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
    } else { console.warn("[Init] Save match button found without data-match-index attribute."); }
  });

  const saveVetoButton = document.getElementById('saveMapVetoButton');
  if (saveVetoButton) {
    if (!saveVetoButton.dataset.originalText) saveVetoButton.dataset.originalText = saveVetoButton.textContent;
    saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
  } else { console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found."); }

  const saveHeaderButton = document.getElementById('saveHeaderButton');
  if (saveHeaderButton) {
    if (!saveHeaderButton.dataset.originalText) saveHeaderButton.dataset.originalText = saveHeaderButton.textContent;
    saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
  } else { console.warn("[Init] Save Header button (id='saveHeaderButton') not found."); }

  const savePauseButton = document.getElementById('savePauseButton');
  if (savePauseButton) {
    if (!savePauseButton.dataset.originalText) savePauseButton.dataset.originalText = savePauseButton.textContent;
    savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
  } else { console.warn("[Init] Save Pause button (id='savePauseButton') not found."); }

  const matchSelectElement = document.getElementById("matchSelect");
  if (matchSelectElement) {
    matchSelectElement.addEventListener('change', () => {
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }
    });
  }
  for (let i = 1; i <= 4; i++) {
    const team1Sel = document.getElementById(`team1Select${i}`);
    const team2Sel = document.getElementById(`team2Select${i}`);
    const listener = () => {
      const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
      if (currentVetoMatchIndex && currentVetoMatchIndex == i) {
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(String(i));
        }
      }
    };
    if (team1Sel) team1Sel.addEventListener('change', listener);
    if (team2Sel) team2Sel.addEventListener('change', listener);
  }
  console.log("[Init] All button and select listeners attached.");
}

// ========== ЛОГИКА ДЛЯ ВКЛАДОК ==========
function initTabs() {
    const tabsNav = document.querySelector('.tabs-nav');
    const tabLinks = document.querySelectorAll('.tabs-nav .tab-link');
    const tabPanels = document.querySelectorAll('.tabs-content .tab-panel');

    if (!tabsNav || tabLinks.length === 0 || tabPanels.length === 0) {
        console.warn('[Tabs] Tab navigation elements not found. Tabs will not function.');
        return;
    }

    // Устанавливаем первую вкладку активной по умолчанию, если ни одна не активна
    // (хотя это уже должно быть сделано классами 'active' в HTML)
    const activeTab = document.querySelector('.tabs-nav .tab-link.active');
    if (!activeTab && tabLinks.length > 0) {
        tabLinks[0].classList.add('active');
        const firstPanelId = tabLinks[0].dataset.tab;
        const firstPanel = document.getElementById(firstPanelId);
        if (firstPanel) firstPanel.classList.add('active');
    }


    tabsNav.addEventListener('click', (event) => {
        const clickedTab = event.target.closest('.tab-link');
        if (!clickedTab) return; // Клик не по ссылке вкладки
        if (clickedTab.classList.contains('active')) return; // Не делаем ничего, если вкладка уже активна

        event.preventDefault();

        tabLinks.forEach(link => link.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        clickedTab.classList.add('active');

        const targetTabId = clickedTab.dataset.tab;
        const targetPanel = document.getElementById(targetTabId);
        if (targetPanel) {
            targetPanel.classList.add('active');
        } else {
            console.warn(`[Tabs] Tab panel with id "${targetTabId}" not found.`);
        }
    });
    console.log("[Init] Tabs initialized.");
}

// ========== Инициализация при загрузке страницы ==========
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
    await initPromise;
    console.log("DOMContentLoaded: Teams initialized.");

    await Promise.all([
        loadMatchesFromServer(),
        loadRawVRSData(),
        loadCustomFieldsFromServer(),
        loadMapVetoFromServer(),
        loadPauseDataFromServer()
    ]);
    
    setupListeners();
    initTabs(); // Инициализируем вкладки

    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }
    // Применим стили к .veto-action селектам после загрузки всего
    document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => {
        if (typeof styleVetoActionSelect === 'function') {
            styleVetoActionSelect(actionSelect);
        }
    });

    console.log("DOMContentLoaded: Initial data loading, listener setup, and tabs initialization complete.");
  } catch (error) {
    console.error("DOMContentLoaded: Error during initialization:", error);
  }
});