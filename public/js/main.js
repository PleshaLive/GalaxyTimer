// public/js/main.js
// Assuming the imported functions from other files are compatible or updated accordingly.
// The core logic of this file related to DOM manipulation should largely remain the same
// if IDs and essential class structures are preserved in the new HTML.

import { initMatches, gatherSingleMatchData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js";
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions, styleVetoActionSelect } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

const socket = io();

// Initialize modules
const initPromise = initMatches(); // Assuming this populates team selects etc.
initMapVeto(); // Assuming this populates map selects in veto etc.
initVRS(); // Assuming this sets up VRS blocks

// Socket.IO event listeners
socket.on("jsonUpdate", async (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  try {
    await initPromise; // Ensure dependent initializations are complete
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
    // If team names in Veto table depend on match selection, ensure they are updated.
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            // updateVetoTeamOptions might need to be called after matchSelectElement.value is set by updateMapVetoUI
            // Or ensure updateMapVetoUI calls it if it changes the matchSelect value.
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
  // Ensure newFields is an object, not an array. API might send [{...}]
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  if (fieldsData && typeof fieldsData === 'object') {
    updateCustomFieldsUI(fieldsData);
  } else {
    console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields);
    updateCustomFieldsUI({}); // Reset or handle error
  }
});

socket.on("pauseUpdate", (pauseData) => {
  console.log("[SOCKET] Received pauseUpdate (main.js):", pauseData);
  const msgInput = document.getElementById('pauseMessageInput');
  const timeInput = document.getElementById('pauseTimeInput');

  // API might send [{...}] or {...}
  const actualPauseData = Array.isArray(pauseData) ? pauseData[0] : pauseData;

  if (actualPauseData) {
    if (msgInput && msgInput.value !== (actualPauseData.pause || "")) msgInput.value = actualPauseData.pause || "";
    if (timeInput && timeInput.value !== (actualPauseData.lastUpd || "")) timeInput.value = actualPauseData.lastUpd || "";
  } else {
    if (msgInput) msgInput.value = "";
    if (timeInput) timeInput.value = "";
  }
});


// UI Update Functions
function updateMatchesUI(matches) {
  console.log("[UI] Updating matches UI...");
  if (!Array.isArray(matches)) {
    console.warn("[UI] updateMatchesUI received invalid data:", matches);
    return;
  }

  matches.forEach((match, index) => {
    const matchIndex = index + 1; // Assuming matches are 1-indexed in DOM
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) {
      console.warn(`[UI] Match column ${matchIndex} not found for UI update.`);
      return;
    }

    // Time Input
    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, '').trim(); // Remove timezone if present
      if (timeInput.value !== timeValue) timeInput.value = timeValue;
    }

    // Status Select
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
      let newStatus = "";
      if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
      else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
      else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

      if (newStatus && statusSelect.value !== newStatus) {
        statusSelect.value = newStatus;
        // updateStatusColor is imported from matches.js, ensure it works with Tailwind classes
        if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
      } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
        // Reset to default if no status provided
        statusSelect.value = statusSelect.options[0].value;
        if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
      }
       // The visual update for match column border (e.g., .status-live) is now handled by CSS based on the class added by updateStatusColor
    }

    // Team Selects
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select) {
        // Check if option exists. Use CSS.escape for special characters in names.
        const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
        if (team1Name && optionExists) {
            if (team1Select.value !== team1Name) team1Select.value = team1Name;
        } else if (team1Name && !optionExists) {
            // Optionally add the team if it's missing and you want to preserve it
            // console.warn(`[UI] Team ${team1Name} not in select for match ${matchIndex}. Consider adding it dynamically or ensuring lists are complete.`);
            // For now, if not found, set to default/empty
            if (team1Select.value !== "") team1Select.value = "";
        } else if (team1Select.value !== "") { // No team name from data, reset select
            team1Select.value = "";
        }
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    if (team2Select) {
        const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
        if (team2Name && optionExists) {
            if (team2Select.value !== team2Name) team2Select.value = team2Name;
        } else if (team2Name && !optionExists) {
            // console.warn(`[UI] Team ${team2Name} not in select for match ${matchIndex}.`);
            if (team2Select.value !== "") team2Select.value = "";
        } else if (team2Select.value !== "") {
            team2Select.value = "";
        }
    }
    
    // Determine current status prefix for map/score keys
    let prefix = "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
    else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
    else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

    // Map and Score Inputs (assuming 3 maps per match as in new HTML)
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
        } else if (mapSelect.options.length > 0 && mapSelect.value !== "" && mapSelect.value !== mapSelect.options[0].value) { 
            // If mapValue is not found or is empty, reset to default ("- Карта -")
            mapSelect.value = mapSelect.options[0].value; // Assuming first option is placeholder
        } else if (!mapValue && mapSelect.value !== "" && mapSelect.options.length > 0) {
             mapSelect.value = mapSelect.options[0].value;
        }
      } else if (mapSelect && mapSelect.options.length > 0 && mapSelect.value !== "" && mapSelect.value !== mapSelect.options[0].value) {
         mapSelect.value = mapSelect.options[0].value;
      }


      const scoreValue = match[scoreKey];
      if (scoreInput && typeof scoreValue !== 'undefined') {
        if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
      } else if (scoreInput && scoreInput.value !== "") {
        scoreInput.value = "";
      }
    });

    // Winner update
    let winnerTeamKey = ""; // This will be "TEAM1" or "TEAM2"
    const currentTeam1Name = team1Select ? team1Select.value : "";
    const currentTeam2Name = team2Select ? team2Select.value : "";

    if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
        if (currentTeam1Name && match.TEAMWINNER === currentTeam1Name) {
            winnerTeamKey = "TEAM1";
        } else if (currentTeam2Name && match.TEAMWINNER === currentTeam2Name) {
            winnerTeamKey = "TEAM2";
        }
    }
    // Update data-winner attribute on match-column for CSS styling if needed
    if (winnerTeamKey) {
        matchColumn.setAttribute("data-winner", winnerTeamKey);
    } else {
        matchColumn.removeAttribute("data-winner");
    }
    
    // Update winner button labels and highlights (imported functions)
    if (typeof updateWinnerButtonLabels === 'function') updateWinnerButtonLabels(matchIndex);
    if (typeof refreshWinnerHighlight === 'function') refreshWinnerHighlight(matchIndex); // This will use data-winner

    // Update VRS Team Names if the function exists and is needed here
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames(); // This might be better called once after all matches
  });

  // After updating all matches, if map veto depends on a specific match's teams, update it.
  const matchSelectElement = document.getElementById("matchSelect");
  if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
    updateVetoTeamOptions(matchSelectElement.value);
  }
  console.log("[UI] Matches UI update finished.");
}

function updateMapVetoUI(mapVetoData) {
  // Ensure mapVetoData is the object, not an array like [{...}]
  const actualMapVetoData = Array.isArray(mapVetoData) ? mapVetoData[0] : mapVetoData;

  if (!actualMapVetoData || !actualMapVetoData.veto || !Array.isArray(actualMapVetoData.veto)) {
    console.warn("[UI] Получены некорректные данные для updateMapVetoUI:", actualMapVetoData);
    // Potentially clear the table or show an error
    return;
  }
  const matchSelectElement = document.getElementById("matchSelect");

  // Update selected match for Veto
  if (matchSelectElement && typeof actualMapVetoData.matchIndex !== 'undefined' && matchSelectElement.value != actualMapVetoData.matchIndex) {
    matchSelectElement.value = actualMapVetoData.matchIndex;
  }

  // Update Veto table rows
  actualMapVetoData.veto.forEach((vetoItem, idx) => {
    const rowIndex = idx + 1; // Veto items are 0-indexed, table rows 1-indexed
    const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
    if (row) {
      const actionSelect = row.querySelector(".veto-action");
      const mapSelectInRow = row.querySelector(".veto-map");
      const teamSelect = row.querySelector(".veto-team");
      const sideSelect = row.querySelector(".veto-side");

      if (actionSelect) {
        const actionValueFromData = vetoItem.action || 'BAN'; // Default to BAN
        if (actionSelect.value !== actionValueFromData) {
          actionSelect.value = actionValueFromData;
        }
        // styleVetoActionSelect is imported from mapVeto.js, ensure it works with new classes
        if (typeof styleVetoActionSelect === 'function') {
            styleVetoActionSelect(actionSelect);
        }
      }

      if (mapSelectInRow) {
        const mapValueFromData = vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : ""); // Default to placeholder
        if (mapSelectInRow.value !== mapValueFromData) {
            mapSelectInRow.value = mapValueFromData;
        }
      }
      
      if (teamSelect) {
        const teamValueFromData = vetoItem.team || 'TEAM1'; // Default to TEAM1
        if (teamSelect.value !== teamValueFromData) {
            teamSelect.value = teamValueFromData;
        }
        // The styling for selected team in veto table is now in style.css based on .team-1-selected-veto / .team-2-selected-veto
        // updateVetoTeamOptions should handle applying these classes based on teamSelect.value
      }

      if (sideSelect) {
        const sideValueFromData = vetoItem.side || '-'; // Default to '-'
        if (sideSelect.value !== sideValueFromData) {
            sideSelect.value = sideValueFromData;
        }
      }
    } else {
      console.warn(`[UI] Строка ${rowIndex} в таблице Map Veto не найдена.`);
    }
  });
  
  // Crucial: After updating table values, refresh team options/styling for the selected match
  if (matchSelectElement?.value && typeof actualMapVetoData.matchIndex !== 'undefined' && typeof updateVetoTeamOptions === 'function') {
    updateVetoTeamOptions(matchSelectElement.value);
  }
  console.log("[UI] Map Veto UI updated for match", actualMapVetoData.matchIndex);
}

function updateVRSUI(rawVrsData) {
  // Ensure rawVrsData is the object, not an array like [{...}]
  const actualVrsData = Array.isArray(rawVrsData) ? rawVrsData[0] : rawVrsData;

  if (!actualVrsData) {
    console.warn("[UI] Получены пустые данные для updateVRSUI");
    // Potentially clear VRS fields
    return;
  }
  console.log("[UI] Updating VRS UI...");

  // Assuming VRS data is an object where keys are match indices (1, 2, 3, 4)
  for (let i = 1; i <= 4; i++) { // Assuming 4 matches
    const matchVrs = actualVrsData[i]; // e.g., rawVrsData['1'], rawVrsData['2']
    
    if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
      // Team 1 VRS data
      const team1Win = document.getElementById(`team1WinPoints${i}`);
      if (team1Win && team1Win.value !== (matchVrs.TEAM1.winPoints ?? '')) team1Win.value = matchVrs.TEAM1.winPoints ?? '';
      const team1Lose = document.getElementById(`team1LosePoints${i}`);
      if (team1Lose && team1Lose.value !== (matchVrs.TEAM1.losePoints ?? '')) team1Lose.value = matchVrs.TEAM1.losePoints ?? '';
      const team1Rank = document.getElementById(`team1Rank${i}`);
      if (team1Rank && team1Rank.value !== (matchVrs.TEAM1.rank ?? '')) team1Rank.value = matchVrs.TEAM1.rank ?? '';
      const team1Current = document.getElementById(`team1CurrentPoints${i}`);
      if (team1Current && team1Current.value !== (matchVrs.TEAM1.currentPoints ?? '')) team1Current.value = matchVrs.TEAM1.currentPoints ?? '';

      // Team 2 VRS data
      const team2Win = document.getElementById(`team2WinPoints${i}`);
      if (team2Win && team2Win.value !== (matchVrs.TEAM2.winPoints ?? '')) team2Win.value = matchVrs.TEAM2.winPoints ?? '';
      const team2Lose = document.getElementById(`team2LosePoints${i}`);
      if (team2Lose && team2Lose.value !== (matchVrs.TEAM2.losePoints ?? '')) team2Lose.value = matchVrs.TEAM2.losePoints ?? '';
      const team2Rank = document.getElementById(`team2Rank${i}`);
      if (team2Rank && team2Rank.value !== (matchVrs.TEAM2.rank ?? '')) team2Rank.value = matchVrs.TEAM2.rank ?? '';
      const team2Current = document.getElementById(`team2CurrentPoints${i}`);
      if (team2Current && team2Current.value !== (matchVrs.TEAM2.currentPoints ?? '')) team2Current.value = matchVrs.TEAM2.currentPoints ?? '';
    } else {
      // Clear fields if no data for this match index
      const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
      fields.forEach(field => {
        const el1 = document.getElementById(`team1${field}${i}`);
        if (el1 && el1.value !== '') el1.value = '';
        const el2 = document.getElementById(`team2${field}${i}`);
        if (el2 && el2.value !== '') el2.value = '';
      });
    }
  }
  // Update VRS Team Names (e.g., in table headers if they are dynamic)
  if (typeof updateVRSTeamNames === 'function') {
    updateVRSTeamNames();
  }
  console.log("[UI] VRS UI update finished.");
}

function updateCustomFieldsUI(fields) {
  if (!fields || typeof fields !== 'object') {
    console.warn("[UI] Invalid data received for updateCustomFieldsUI:", fields);
    // Potentially clear fields
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

  // After updating dates, recalculate tournament day
  updateTournamentDay(); 
  console.log("[UI] Custom fields UI update finished.");
}

// Data Loading Functions (fetch from server)
async function loadMatchesFromServer() {
  console.log("[Data] Loading matches data from server...");
  try {
    const response = await fetch("/api/matchdata");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const matches = await response.json();
    console.log("[Data] Matches data loaded:", matches);
    await initPromise; // Ensure dependent initializations are complete
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
    const rawVrsData = await response.json(); // Expecting an object, not array
    console.log("[Data] Raw VRS data loaded:", rawVrsData);
    updateVRSUI(rawVrsData);
  } catch (error) {
    console.error("[Data] Ошибка загрузки raw VRS data:", error);
    updateVRSUI({}); // Clear UI on error
  }
}

async function loadMapVetoFromServer() {
  console.log("[Data] Loading map veto data...");
  try {
    const response = await fetch("/api/mapveto");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const mapVetoData = await response.json(); // Expecting an object, not array
    console.log("[Data] Map veto data loaded:", mapVetoData);
    updateMapVetoUI(mapVetoData); // mapVetoData should be { matchIndex: X, veto: [...] }
    
    // This logic is also in updateMapVetoUI, but can be here as a fallback
    // if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined') {
    //     const matchSelectElement = document.getElementById("matchSelect");
    //     if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
    //          updateVetoTeamOptions(matchSelectElement.value); // Ensure this uses the updated value
    //     }
    // }
  } catch (error) {
    console.error("[Data] Ошибка загрузки map veto data:", error);
    // updateMapVetoUI({}); // Optionally clear UI
  }
}

async function loadCustomFieldsFromServer() {
  console.log("[Data] Loading custom fields data...");
  try {
    const response = await fetch("/api/customfields");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const dataArray = await response.json(); // API sends an array: [{...}]
    console.log("[Data] Custom fields data loaded:", dataArray);
    // Expecting an array with one object inside
    if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
      updateCustomFieldsUI(dataArray[0]);
    } else {
      updateCustomFieldsUI({}); // Reset or handle empty/invalid data
    }
  } catch (err) {
    console.error("[Data] Ошибка загрузки custom fields:", err);
    updateCustomFieldsUI({}); // Reset UI on error
  }
}

async function loadPauseDataFromServer() {
  console.log("[Data] Loading pause data...");
  try {
    const response = await fetch("/api/pause");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const dataArray = await response.json(); // API might send an array: [{...}]
    console.log("[Data] Pause data loaded:", dataArray);
    
    const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {};
    
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (msgInput) msgInput.value = pauseData.pause || "";
    if (timeInput) timeInput.value = pauseData.lastUpd || "";
  } catch (err) {
    console.error("[Data] Ошибка загрузки данных паузы:", err);
    // Clear fields on error
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (msgInput) msgInput.value = "";
    if (timeInput) timeInput.value = "";
  }
}


// Utility Functions
function calculateTournamentDay() {
  const startDateInput = document.getElementById("tournamentStart")?.value;
  const endDateInput = document.getElementById("tournamentEnd")?.value;
  const displaySpan = document.getElementById("tournamentDayDisplay");

  if (!displaySpan) return; // Target element not found

  if (!startDateInput) {
    displaySpan.textContent = 'Укажите дату старта';
    return;
  }

  try {
    const start = new Date(startDateInput);
    const end = endDateInput ? new Date(endDateInput) : null;
    const today = new Date();

    // Normalize dates to midnight for day comparison
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime())) { // Check for invalid date
        displaySpan.textContent = 'Неверная дата старта';
        return;
    }
    if (end && isNaN(end.getTime())) { // Check for invalid end date
        displaySpan.textContent = 'Неверная дата конца';
        // continue to calculate based on start date if possible
    }


    if (today < start) {
      displaySpan.textContent = 'Турнир не начался';
    } else if (end && today > end) {
      displaySpan.textContent = 'Турнир завершен';
    } else {
      // Calculate difference in days
      const diffTime = Math.abs(today - start); // Use Math.abs for safety
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Day 1 on start date
      displaySpan.textContent = `День ${diffDays}`;
    }
  } catch (e) {
    console.error("Ошибка при расчете дня турнира:", e);
    displaySpan.textContent = 'Ошибка даты'; // Error message
  }
}

function updateTournamentDay() {
  calculateTournamentDay();
}

// Attach listeners for tournament date changes
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);


// Data Gathering Functions
function gatherCustomFieldsData() {
  updateTournamentDay(); // Ensure day is calculated before gathering
  return {
    upcomingMatches: document.getElementById("upcomingMatchesInput")?.value ?? "",
    galaxyBattle: document.getElementById("galaxyBattleInput")?.value ?? "",
    tournamentStart: document.getElementById("tournamentStart")?.value ?? "",
    tournamentEnd: document.getElementById("tournamentEnd")?.value ?? "",
    tournamentDay: document.getElementById("tournamentDayDisplay")?.textContent ?? "", // Get calculated day
    groupStage: document.getElementById("groupStageInput")?.value ?? ""
  };
}

function gatherPauseData() {
  const message = document.getElementById("pauseMessageInput")?.value ?? "";
  const time = document.getElementById("pauseTimeInput")?.value ?? "";
  return { pause: message, lastUpd: time };
}

// Button State Management
function setButtonState(button, state, message = null) {
  if (!button) return;
  const originalText = button.dataset.originalText || button.textContent || 'SAVE';
  if (!button.dataset.originalText) button.dataset.originalText = originalText;

  button.disabled = (state === 'saving');
  
  // Remove all state classes, then add the current one
  button.classList.remove('saving', 'saved', 'error', 'idle');
  // Tailwind handles cursor changes via disabled:cursor-not-allowed on the button class
  // button.style.cursor = (state === 'saving') ? 'wait' : 'pointer'; 

  switch (state) {
    case 'saving':
      button.textContent = message || 'Сохранение...';
      button.classList.add('saving');
      break;
    case 'saved':
      button.textContent = message || 'Сохранено!';
      button.classList.add('saved');
      setTimeout(() => {
        if (button.classList.contains('saved')) { // Check if still in saved state
          button.textContent = originalText;
          button.classList.remove('saved');
          button.classList.add('idle');
        }
      }, 1500);
      break;
    case 'error':
      button.textContent = message || 'Ошибка!';
      button.classList.add('error');
      // Keep error state a bit longer for visibility
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

// Save Data Functions
async function saveMatchData(matchIndex, buttonElement) {
  console.log(`[Save] Saving data for Match ${matchIndex}...`);
  setButtonState(buttonElement, 'saving');
  try {
    const matchData = gatherSingleMatchData(matchIndex); // From matches.js
    if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}`);
    
    const vrsData = gatherSingleVRSData(matchIndex); // From vrs.js
    if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}`);

    // API expects match data at /api/matchdata/:match_id (e.g., /api/matchdata/1)
    // And VRS data at /api/vrs/:match_id
    await saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT');
    await saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT');
    
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving data for Match ${matchIndex}:`, error);
    setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
  } finally {
    // Ensure button returns to idle if not saved/error after timeout logic (e.g., if save was too fast)
    if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
      setButtonState(buttonElement, 'idle');
    }
  }
}

async function saveMapVetoData(buttonElement) {
  console.log(`[Save] Saving Map Veto data...`);
  setButtonState(buttonElement, 'saving');
  try {
    const mapVetoData = gatherMapVetoData(); // From mapVeto.js
    if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
    
    // API expects map veto data at /api/mapveto (POST to update/create)
    await saveData('/api/mapveto', mapVetoData, 'POST');
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving Map Veto data:`, error);
    setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
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
    // API expects custom fields data at /api/customfields (POST to update/create)
    // The API expects an array with one object: [{...}]
    await saveData('/api/customfields', [customData], 'POST'); 
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving Header data:`, error);
    setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
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
    // API expects pause data at /api/pause (POST to update/create)
    // The API expects an array with one object: [{...}]
    await saveData('/api/pause', [pauseData], 'POST');
    setButtonState(buttonElement, 'saved');
  } catch (error) {
    console.error(`[Save] Error saving Pause data:`, error);
    setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
  } finally {
    if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
      setButtonState(buttonElement, 'idle');
    }
  }
}


// Setup Event Listeners
function setupListeners() {
  // Save Match Buttons
  document.querySelectorAll('.save-match-button').forEach(button => {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent; // Store original text
    const matchIndex = button.dataset.matchIndex;
    if (matchIndex) {
      button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
    } else {
      console.warn("[Init] Save match button found without data-match-index attribute.");
    }
  });

  // Save Map Veto Button
  const saveVetoButton = document.getElementById('saveMapVetoButton');
  if (saveVetoButton) {
    if (!saveVetoButton.dataset.originalText) saveVetoButton.dataset.originalText = saveVetoButton.textContent;
    saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
  } else {
    console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found.");
  }

  // Save Header Button
  const saveHeaderButton = document.getElementById('saveHeaderButton');
  if (saveHeaderButton) {
    if (!saveHeaderButton.dataset.originalText) saveHeaderButton.dataset.originalText = saveHeaderButton.textContent;
    saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
  } else {
    console.warn("[Init] Save Header button (id='saveHeaderButton') not found.");
  }
  
  // Save Pause Button
  const savePauseButton = document.getElementById('savePauseButton');
  if (savePauseButton) {
    if (!savePauseButton.dataset.originalText) savePauseButton.dataset.originalText = savePauseButton.textContent;
    savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
  } else {
    console.warn("[Init] Save Pause button (id='savePauseButton') not found.");
  }

  // Match select for Veto - updates team options in Veto table
  const matchSelectElement = document.getElementById("matchSelect");
  if (matchSelectElement) {
    matchSelectElement.addEventListener('change', () => {
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }
    });
  }

  // Team selects in Match columns - if they change, Veto table team names might need update
  for (let i = 1; i <= 4; i++) { // Assuming 4 matches
    const team1Sel = document.getElementById(`team1Select${i}`);
    const team2Sel = document.getElementById(`team2Select${i}`);
    const listener = () => {
      const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
      // If the changed match is the one selected for Veto, update Veto team options
      if (currentVetoMatchIndex && currentVetoMatchIndex == i) { // Ensure comparison is correct (string vs number)
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(String(i)); // Pass match index as string if that's what updateVetoTeamOptions expects
        }
      }
    };
    if (team1Sel) team1Sel.addEventListener('change', listener);
    if (team2Sel) team2Sel.addEventListener('change', listener);
  }
  console.log("[Init] All button and select listeners attached.");
}

// Tab Functionality
function initTabs() {
    const tabsNav = document.querySelector('.tabs-nav');
    const tabLinks = document.querySelectorAll('.tabs-nav .tab-link');
    const tabPanels = document.querySelectorAll('.tabs-content .tab-panel');

    if (!tabsNav || tabLinks.length === 0 || tabPanels.length === 0) {
        console.warn('[Tabs] Tab navigation elements not found. Tabs will not function.');
        return;
    }

    // Ensure one tab is active on load if none is explicitly set
    const activeTab = document.querySelector('.tabs-nav .tab-link.active');
    if (!activeTab && tabLinks.length > 0) {
        tabLinks[0].classList.add('active');
        const firstPanelId = tabLinks[0].dataset.tab;
        const firstPanel = document.getElementById(firstPanelId);
        if (firstPanel) firstPanel.classList.add('active');
    } else if (activeTab) { // If one is active, ensure its panel is also active
        const activePanelId = activeTab.dataset.tab;
        const activePanel = document.getElementById(activePanelId);
        if (activePanel) activePanel.classList.add('active');
    }


    tabsNav.addEventListener('click', (event) => {
        const clickedTab = event.target.closest('.tab-link');
        if (!clickedTab) return; // Click was not on a tab link
        if (clickedTab.classList.contains('active')) return; // Clicked on already active tab

        event.preventDefault(); // Prevent potential default anchor behavior

        // Deactivate all tabs and panels
        tabLinks.forEach(link => link.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // Activate clicked tab and corresponding panel
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


// DOMContentLoaded - Main execution start
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
    await initPromise; // Wait for initial data like team lists to be ready
    console.log("DOMContentLoaded: Teams and basic data initialized.");

    // Load all data from server concurrently
    await Promise.all([
        loadMatchesFromServer(),
        loadRawVRSData(),
        loadCustomFieldsFromServer(),
        loadMapVetoFromServer(),
        loadPauseDataFromServer()
    ]);
    
    // Setup event listeners for buttons, selects etc.
    setupListeners();
    // Initialize tab functionality
    initTabs();

    // Initial call to update Veto team options based on the default selected match (if any)
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }

    // Initial styling for veto action selects already in the DOM
    document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => {
        if (typeof styleVetoActionSelect === 'function') {
            styleVetoActionSelect(actionSelect);
        }
    });
    
    // Initial calculation of tournament day
    updateTournamentDay();

    console.log("DOMContentLoaded: Initial data loading, listener setup, and tabs initialization complete.");
  } catch (error) {
    console.error("DOMContentLoaded: Error during initialization:", error);
  }
});
