// public/js/main.js
import {
  initMatches,
  gatherSingleMatchData,
  updateWinnerButtonLabels,
  refreshWinnerHighlight,
  // areTeamsInitialized, // Не используется напрямую в main.js после initPromise
  updateStatusColor,
} from "./matches.js";
import {
  initMapVeto,
  gatherMapVetoData,
  updateVetoTeamOptions,
  styleVetoActionSelect,
} from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

const socket = io();

// --- DOM Element Cache ---
// Cache frequently accessed DOM elements to improve performance and readability
const domElements = {
  jsonOutput: document.getElementById("jsonOutput"),
  matchSelect: document.getElementById("matchSelect"),
  // Header Controls
  upcomingMatchesInput: document.getElementById("upcomingMatchesInput"),
  galaxyBattleInput: document.getElementById("galaxyBattleInput"),
  tournamentStartInput: document.getElementById("tournamentStart"),
  tournamentEndInput: document.getElementById("tournamentEnd"),
  tournamentDayDisplay: document.getElementById("tournamentDayDisplay"),
  groupStageInput: document.getElementById("groupStageInput"),
  // Pause Controls
  pauseMessageInput: document.getElementById("pauseMessageInput"),
  pauseTimeInput: document.getElementById("pauseTimeInput"),
  // Buttons
  saveHeaderButton: document.getElementById("saveHeaderButton"),
  saveMapVetoButton: document.getElementById("saveMapVetoButton"),
  savePauseButton: document.getElementById("savePauseButton"),
  // Tabs
  tabsNav: document.querySelector(".tabs-nav"),
  tabLinks: document.querySelectorAll(".tabs-nav .tab-link"),
  tabPanels: document.querySelectorAll(".tabs-content .tab-panel"),
};

const initPromise = initMatches();
initMapVeto();
initVRS(); // This will now also create the basic VRS table structure

// --- Socket Event Handlers ---
socket.on("jsonUpdate", async (matches) => {
  console.log("[SOCKET] Received jsonUpdate:", matches);
  try {
    await initPromise; // Ensure teams are loaded before updating UI
    updateMatchesUI(matches);
  } catch (error) {
    console.error("[SOCKET] Error updating matches UI after jsonUpdate:", error);
  }
  if (domElements.jsonOutput) {
    domElements.jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

socket.on("mapVetoUpdate", (updatedMapVeto) => {
  console.log("[SOCKET] Received mapVetoUpdate:", updatedMapVeto);
  updateMapVetoUI(updatedMapVeto);
  if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== "undefined") {
    if (domElements.matchSelect && typeof updateVetoTeamOptions === "function") {
      updateVetoTeamOptions(domElements.matchSelect.value);
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
  if (fieldsData && typeof fieldsData === "object") {
    updateCustomFieldsUI(fieldsData);
  } else {
    console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields);
    updateCustomFieldsUI({});
  }
});

socket.on("pauseUpdate", (pauseData) => {
  console.log("[SOCKET] Received pauseUpdate (main.js):", pauseData);
  if (pauseData) {
    if (domElements.pauseMessageInput && domElements.pauseMessageInput.value !== (pauseData.pause || "")) {
      domElements.pauseMessageInput.value = pauseData.pause || "";
    }
    if (domElements.pauseTimeInput && domElements.pauseTimeInput.value !== (pauseData.lastUpd || "")) {
      domElements.pauseTimeInput.value = pauseData.lastUpd || "";
    }
  } else {
    if (domElements.pauseMessageInput) domElements.pauseMessageInput.value = "";
    if (domElements.pauseTimeInput) domElements.pauseTimeInput.value = "";
  }
});

// --- UI Update Functions ---
function updateElementValue(element, newValue, defaultValue = "") {
  if (element && element.value !== (newValue ?? defaultValue)) {
    element.value = newValue ?? defaultValue;
  }
}

function updateElementTextContent(element, newText, defaultValue = "") {
    if (element && element.textContent !== (newText ?? defaultValue)) {
        element.textContent = newText ?? defaultValue;
    }
}


function updateMatchesUI(matches) {
  console.log("[UI] Updating matches UI...");
  if (!Array.isArray(matches)) {
    console.warn("[UI] updateMatchesUI received invalid data:", matches);
    return;
  }

  matches.forEach((match, index) => {
    const matchIndex = index + 1;
    const matchColumn = document.querySelector(
      `.match-column[data-match="${matchIndex}"]`
    );
    if (!matchColumn) {
      console.warn(`[UI] Match column ${matchIndex} not found for UI update.`);
      return;
    }

    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, "").trim();
      updateElementValue(timeInput, timeValue);
    }

    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
      let newStatus = "";
      if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
      else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
      else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

      if (newStatus && statusSelect.value !== newStatus) {
        statusSelect.value = newStatus;
      } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
         statusSelect.value = statusSelect.options[0].value;
      }
      if (typeof updateStatusColor === "function") updateStatusColor(statusSelect);
      matchColumn.classList.remove("status-upcom", "status-live", "status-finished");
      if (statusSelect.value) { // Use the actual current value of the select
          matchColumn.classList.add(`status-${statusSelect.value.toLowerCase()}`);
      }
    }

    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select) {
      const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
      if (team1Name && optionExists) {
        updateElementValue(team1Select, team1Name);
      } else if (team1Select.value !== "") {
         team1Select.value = "";
      }
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    if (team2Select) {
      const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
      if (team2Name && optionExists) {
        updateElementValue(team2Select, team2Name);
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

      if (mapSelect && typeof mapValue !== "undefined") {
        const optionExists = mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`);
        if (mapValue && optionExists) {
          updateElementValue(mapSelect, mapValue);
        } else if (mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) {
          mapSelect.value = mapSelect.options[0].value;
        } else if (!mapValue && mapSelect.value !== "" && mapSelect.options.length > 0) {
            mapSelect.value = mapSelect.options[0].value;
        }
      } else if (mapSelect && mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) {
        mapSelect.value = mapSelect.options[0].value;
      }

      const scoreValue = match[scoreKey];
      updateElementValue(scoreInput, scoreValue);
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

    if (typeof updateWinnerButtonLabels === "function") updateWinnerButtonLabels(matchIndex);
    if (typeof refreshWinnerHighlight === "function") refreshWinnerHighlight(matchIndex);
  });

  if (typeof updateVRSTeamNames === "function") updateVRSTeamNames(); // Update all VRS team names

  if (domElements.matchSelect?.value && typeof updateVetoTeamOptions === "function") {
    updateVetoTeamOptions(domElements.matchSelect.value);
  }
  console.log("[UI] Matches UI update finished.");
}

function updateMapVetoUI(mapVetoData) {
  if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
    console.warn("[UI] Invalid data for updateMapVetoUI:", mapVetoData);
    return;
  }

  if (domElements.matchSelect && typeof mapVetoData.matchIndex !== "undefined") {
    updateElementValue(domElements.matchSelect, mapVetoData.matchIndex.toString());
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
          updateElementValue(actionSelect, vetoItem.action, 'BAN');
          if (typeof styleVetoActionSelect === "function") {
            styleVetoActionSelect(actionSelect);
          }
      }
      updateElementValue(mapSelectInRow, vetoItem.map, (mapSelectInRow && mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : ""));
      updateElementValue(teamSelect, vetoItem.team, 'TEAM1');
      updateElementValue(sideSelect, vetoItem.side, '-');

    } else {
      console.warn(`[UI] Row ${rowIndex} in Map Veto table not found.`);
    }
  });

  if (domElements.matchSelect?.value && typeof updateVetoTeamOptions === "function") {
    updateVetoTeamOptions(domElements.matchSelect.value);
  }
  console.log("[UI] Map Veto UI updated for match", mapVetoData.matchIndex);
}

function updateVRSUI(rawVrsData) {
  if (!rawVrsData) {
    console.warn("[UI] Empty data for updateVRSUI");
    return;
  }
  console.log("[UI] Updating VRS UI...");
  for (let i = 1; i <= 4; i++) { // Assuming max 4 matches
    const matchVrs = rawVrsData[i];
    if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
      updateElementValue(document.getElementById(`team1WinPoints${i}`), matchVrs.TEAM1.winPoints);
      updateElementValue(document.getElementById(`team1LosePoints${i}`), matchVrs.TEAM1.losePoints);
      updateElementValue(document.getElementById(`team1Rank${i}`), matchVrs.TEAM1.rank);
      updateElementValue(document.getElementById(`team1CurrentPoints${i}`), matchVrs.TEAM1.currentPoints);

      updateElementValue(document.getElementById(`team2WinPoints${i}`), matchVrs.TEAM2.winPoints);
      updateElementValue(document.getElementById(`team2LosePoints${i}`), matchVrs.TEAM2.losePoints);
      updateElementValue(document.getElementById(`team2Rank${i}`), matchVrs.TEAM2.rank);
      updateElementValue(document.getElementById(`team2CurrentPoints${i}`), matchVrs.TEAM2.currentPoints);
    } else {
      // Clear fields if no data for this match
      const fields = ["WinPoints", "LosePoints", "Rank", "CurrentPoints"];
      fields.forEach(field => {
        updateElementValue(document.getElementById(`team1${field}${i}`), '');
        updateElementValue(document.getElementById(`team2${field}${i}`), '');
      });
    }
  }
  if (typeof updateVRSTeamNames === "function") {
    updateVRSTeamNames();
  }
  console.log("[UI] VRS UI update finished.");
}

function updateCustomFieldsUI(fields) {
  if (!fields || typeof fields !== "object") {
    console.warn("[UI] Invalid data for updateCustomFieldsUI:", fields);
    return;
  }
  console.log("[UI] Updating custom fields UI...");
  updateElementValue(domElements.upcomingMatchesInput, fields.upcomingMatches);
  updateElementValue(domElements.galaxyBattleInput, fields.galaxyBattle);
  updateElementValue(domElements.tournamentStartInput, fields.tournamentStart);
  updateElementValue(domElements.tournamentEndInput, fields.tournamentEnd);
  updateElementValue(domElements.groupStageInput, fields.groupStage);
  updateTournamentDay(); // This will also update the display
  console.log("[UI] Custom fields UI update finished.");
}

// --- Data Loading Functions ---
async function loadDataFromServer(endpoint, uiUpdater, errorMessage) {
  console.log(`[Data] Loading data from ${endpoint}...`);
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log(`[Data] Data from ${endpoint} loaded:`, data);
    if (uiUpdater) uiUpdater(data);
    return data;
  } catch (error) {
    console.error(`[Data] ${errorMessage}:`, error);
    if (uiUpdater) uiUpdater(endpoint.includes('customfields') || endpoint.includes('pause') ? {} : []); // Provide default empty data
    return null;
  }
}

async function loadMatchesFromServer() {
  await initPromise; // Ensure team data (used by initMatches) is ready
  const matches = await loadDataFromServer("/api/matchdata", updateMatchesUI, "Ошибка загрузки matchdata");
  // Additional logic after matches are loaded and UI updated, if any.
}

async function loadRawVRSData() {
  await loadDataFromServer("/api/vrs-raw", updateVRSUI, "Ошибка загрузки raw VRS data");
}

async function loadMapVetoFromServer() {
  const mapVetoData = await loadDataFromServer("/api/mapveto", updateMapVetoUI, "Ошибка загрузки map veto data");
  if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined' && domElements.matchSelect && typeof updateVetoTeamOptions === 'function') {
    updateVetoTeamOptions(domElements.matchSelect.value); // Ensure this uses the current selected match
  }
}

async function loadCustomFieldsFromServer() {
  const dataArray = await loadDataFromServer("/api/customfields", null, "Ошибка загрузки custom fields"); // No direct UI updater, handled by return
  if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
    updateCustomFieldsUI(dataArray[0]);
  } else {
    updateCustomFieldsUI({});
  }
}

async function loadPauseDataFromServer() {
  const dataArray = await loadDataFromServer("/api/pause", null, "Ошибка загрузки данных паузы");
  const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {};
  updateElementValue(domElements.pauseMessageInput, pauseData.pause);
  updateElementValue(domElements.pauseTimeInput, pauseData.lastUpd);
}


// --- Utility Functions ---
function calculateTournamentDay() {
  if (!domElements.tournamentDayDisplay || !domElements.tournamentStartInput) return;

  const startDateInput = domElements.tournamentStartInput.value;
  const endDateInput = domElements.tournamentEndInput.value;

  if (!startDateInput) {
    domElements.tournamentDayDisplay.textContent = '';
    return;
  }
  try {
    const start = new Date(startDateInput);
    const end = endDateInput ? new Date(endDateInput) : null;
    const today = new Date();

    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (end) end.setHours(0, 0, 0, 0);

    let message = '';
    if (today < start) {
      message = 'Турнир не начался';
    } else if (end && today > end) {
      message = 'Турнир завершен';
    } else {
      const diffTime = today - start;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      message = `День ${diffDays}`;
    }
    updateElementTextContent(domElements.tournamentDayDisplay, message);
  } catch (e) {
    console.error("Ошибка при расчете дня турнира:", e);
    domElements.tournamentDayDisplay.textContent = '';
  }
}

function updateTournamentDay() {
  calculateTournamentDay();
}

// --- Data Gathering Functions ---
function gatherCustomFieldsData() {
  updateTournamentDay(); // Ensure day is calculated before gathering
  return {
    upcomingMatches: domElements.upcomingMatchesInput?.value ?? "",
    galaxyBattle: domElements.galaxyBattleInput?.value ?? "",
    tournamentStart: domElements.tournamentStartInput?.value ?? "",
    tournamentEnd: domElements.tournamentEndInput?.value ?? "",
    tournamentDay: domElements.tournamentDayDisplay?.textContent ?? "",
    groupStage: domElements.groupStageInput?.value ?? "",
  };
}

function gatherPauseData() {
  return {
    pause: domElements.pauseMessageInput?.value ?? "",
    lastUpd: domElements.pauseTimeInput?.value ?? "",
  };
}

// --- Button State Management ---
let buttonTimers = {}; // To store timers for buttons

function setButtonState(button, state, message = null) {
  if (!button) return;

  const buttonId = button.id || button.dataset.matchIndex; // Get a unique ID for the button
  if (buttonTimers[buttonId]) {
    clearTimeout(buttonTimers[buttonId]); // Clear existing timer for this button
  }

  const originalText = button.dataset.originalText || button.textContent || "SAVE";
  if (!button.dataset.originalText) button.dataset.originalText = originalText;

  button.disabled = state === "saving";
  button.classList.remove("saving", "saved", "error", "idle");
  button.style.cursor = state === "saving" ? "wait" : "pointer";

  switch (state) {
    case "saving":
      button.textContent = message || "Сохранение...";
      button.classList.add("saving");
      break;
    case "saved":
      button.textContent = message || "Сохранено!";
      button.classList.add("saved");
      buttonTimers[buttonId] = setTimeout(() => {
        if (button.classList.contains("saved")) {
          button.textContent = originalText;
          button.classList.remove("saved");
          button.classList.add("idle");
        }
      }, 1500);
      break;
    case "error":
      button.textContent = message || "Ошибка!";
      button.classList.add("error");
       buttonTimers[buttonId] = setTimeout(() => {
        if (button.classList.contains("error")) {
          button.textContent = originalText;
          button.classList.remove("error");
          button.classList.add("idle");
        }
      }, 2500);
      break;
    case "idle":
    default:
      button.textContent = originalText;
      button.classList.add("idle");
      break;
  }
}

// --- Save Data Functions ---
async function handleSaveOperation(buttonElement, operationName, gatherFn, apiEndpoint, method = 'POST', apiEndpointSecondary = null, gatherFnSecondary = null, methodSecondary = 'PUT') {
    console.log(`[Save] Saving ${operationName} data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const data = gatherFn ? gatherFn() : null;
        if (gatherFn && !data && operationName !== "Header" && operationName !== "Pause") throw new Error(`Не удалось собрать данные ${operationName}.`); // Header and Pause can be empty

        if (data) await saveData(apiEndpoint, data, method);

        if (apiEndpointSecondary && gatherFnSecondary) {
            const secondaryData = gatherFnSecondary();
            if (!secondaryData) throw new Error(`Не удалось собрать вторичные данные для ${operationName}`);
            await saveData(apiEndpointSecondary, secondaryData, methodSecondary);
        }

        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving ${operationName} data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    } finally {
        // Ensure button returns to idle if not in saved/error state (e.g., if save was too quick)
        if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
            setButtonState(buttonElement, 'idle');
        }
    }
}

async function saveMatchData(matchIndex, buttonElement) {
    await handleSaveOperation(
        buttonElement,
        `Match ${matchIndex}`,
        () => gatherSingleMatchData(matchIndex),
        `/api/matchdata/${matchIndex}`,
        'PUT',
        `/api/vrs/${matchIndex}`,
        () => gatherSingleVRSData(matchIndex),
        'PUT'
    );
}

async function saveMapVetoData(buttonElement) {
    await handleSaveOperation(buttonElement, "Map Veto", gatherMapVetoData, '/api/mapveto', 'POST');
}

async function saveHeaderData(buttonElement) {
    await handleSaveOperation(buttonElement, "Header", gatherCustomFieldsData, '/api/customfields', 'POST');
}

async function savePauseData(buttonElement) {
    await handleSaveOperation(buttonElement, "Pause", gatherPauseData, '/api/pause', 'POST');
}


// --- Event Listener Setup ---
function setupListeners() {
  document.querySelectorAll(".save-match-button").forEach((button) => {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    const matchIndex = button.dataset.matchIndex;
    if (matchIndex) {
      button.addEventListener("click", () => saveMatchData(parseInt(matchIndex, 10), button));
    } else {
      console.warn("[Init] Save match button missing data-match-index.");
    }
  });

  if (domElements.saveMapVetoButton) {
    if (!domElements.saveMapVetoButton.dataset.originalText) domElements.saveMapVetoButton.dataset.originalText = domElements.saveMapVetoButton.textContent;
    domElements.saveMapVetoButton.addEventListener("click", () => saveMapVetoData(domElements.saveMapVetoButton));
  } else { console.warn("[Init] Save Map Veto button not found."); }

  if (domElements.saveHeaderButton) {
    if (!domElements.saveHeaderButton.dataset.originalText) domElements.saveHeaderButton.dataset.originalText = domElements.saveHeaderButton.textContent;
    domElements.saveHeaderButton.addEventListener("click", () => saveHeaderData(domElements.saveHeaderButton));
  } else { console.warn("[Init] Save Header button not found."); }

  if (domElements.savePauseButton) {
    if (!domElements.savePauseButton.dataset.originalText) domElements.savePauseButton.dataset.originalText = domElements.savePauseButton.textContent;
    domElements.savePauseButton.addEventListener("click", () => savePauseData(domElements.savePauseButton));
  } else { console.warn("[Init] Save Pause button not found."); }


  if (domElements.matchSelect) {
    domElements.matchSelect.addEventListener("change", () => {
      if (typeof updateVetoTeamOptions === "function") {
        updateVetoTeamOptions(domElements.matchSelect.value);
      }
    });
  }

  // Listen for changes on team selects to update Map Veto team options if the current match is selected for veto
  for (let i = 1; i <= 4; i++) { // Assuming max 4 matches
    const team1Sel = document.getElementById(`team1Select${i}`);
    const team2Sel = document.getElementById(`team2Select${i}`);
    const listener = () => {
      if (domElements.matchSelect?.value && domElements.matchSelect.value == i) { // Check if current veto match is this match
        if (typeof updateVetoTeamOptions === "function") {
          updateVetoTeamOptions(String(i));
        }
      }
    };
    if (team1Sel) team1Sel.addEventListener("change", listener);
    if (team2Sel) team2Sel.addEventListener("change", listener);
  }

  if (domElements.tournamentStartInput) domElements.tournamentStartInput.addEventListener("change", updateTournamentDay);
  if (domElements.tournamentEndInput) domElements.tournamentEndInput.addEventListener("change", updateTournamentDay);

  console.log("[Init] All button and select listeners attached.");
}

// --- Tabs Initialization ---
function initTabs() {
  if (!domElements.tabsNav || domElements.tabLinks.length === 0 || domElements.tabPanels.length === 0) {
    console.warn("[Tabs] Tab navigation elements not found. Tabs will not function.");
    return;
  }

  // Ensure first tab is active if no other is
  const activeTabLink = document.querySelector('.tabs-nav .tab-link.active');
  if (!activeTabLink && domElements.tabLinks.length > 0) {
      domElements.tabLinks[0].classList.add('active');
      const firstPanelId = domElements.tabLinks[0].dataset.tab;
      const firstPanel = document.getElementById(firstPanelId);
      if (firstPanel) firstPanel.classList.add('active');
  }


  domElements.tabsNav.addEventListener("click", (event) => {
    const clickedTab = event.target.closest(".tab-link");
    if (!clickedTab || clickedTab.classList.contains("active")) return;

    event.preventDefault();

    domElements.tabLinks.forEach((link) => link.classList.remove("active"));
    domElements.tabPanels.forEach((panel) => panel.classList.remove("active"));

    clickedTab.classList.add("active");
    const targetTabId = clickedTab.dataset.tab;
    const targetPanel = document.getElementById(targetTabId);

    if (targetPanel) {
      targetPanel.classList.add("active");
    } else {
      console.warn(`[Tabs] Tab panel with id "${targetTabId}" not found.`);
    }
  });
  console.log("[Init] Tabs initialized.");
}

// --- DOMContentLoaded Handler ---
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
    await initPromise; // Ensures team list is populated for selects
    console.log("DOMContentLoaded: Teams initialized.");

    // Parallel data loading
    await Promise.all([
      loadMatchesFromServer(), // Depends on initPromise for team names in selects
      loadRawVRSData(),
      loadCustomFieldsFromServer(),
      loadMapVetoFromServer(), // May depend on matches being loaded if matchSelect needs specific options
      loadPauseDataFromServer()
    ]);

    setupListeners();
    initTabs();
    updateTournamentDay(); // Initial calculation

    // Ensure Map Veto UI is correctly set up after all data loads
    if (domElements.matchSelect?.value && typeof updateVetoTeamOptions === "function") {
      updateVetoTeamOptions(domElements.matchSelect.value);
    }
    document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => {
        if (typeof styleVetoActionSelect === 'function') {
            styleVetoActionSelect(actionSelect);
        }
    });

    console.log("DOMContentLoaded: All initial data loaded, listeners set up, and UI enhancements complete.");
  } catch (error) {
    console.error("DOMContentLoaded: Error during initialization:", error);
  }
});