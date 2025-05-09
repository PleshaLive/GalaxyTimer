// public/js/main.js

// Import необходимых модулей и функций
import { initMatches, gatherSingleMatchData, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor, updateTeamDisplay } from "./matches.js"; // Assuming this is your NEW matches.js
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions, styleVetoActionSelect, updateMapVetoDisplay } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";
import { initCasters, loadCasters, updateCastersUIFromSocket, updateSelectedCastersUIFromSocket, loadSelectedCasters } from "./casters.js";
import { initTimerControls } from "./timerControl.js";

// Инициализация Socket.IO клиента
const socket = io();
console.log("[Init] Socket.IO client initialized.");

// --- Глобальные переменные для мини-таймера на главной странице ---
let mainPageMiniTimerIntervalId = null;
let mainPageMiniTimerTargetTime = null;

// --- КОНСТАНТА ДЛЯ ИКОНКИ СЧЕТА КАРТ ПО УМОЛЧАНИЮ (ДЛЯ ОТОБРАЖЕНИЯ) ---
// This path should be the web-accessible path to your default "none" icon,
// or the same path structure as used in your matches.js if paths are consistent.
// Using the one from your new matches.js getScoreIcon if it were to return a default for display
const DEFAULT_DISPLAY_MP_NONE_ICON = "C:\\projects\\NewTimer\\files\\mp_none.png";


// --- Промис для отслеживания инициализации данных команд (важно для селектов) ---
const initPromise = initMatches();
initMapVeto();
initVRS();
initCasters();


// --- Вспомогательная функция для форматирования времени мини-таймера ---
function formatMainPageMiniTimerTime(distance) {
    if (typeof distance !== 'number' || distance < 0) distance = 0;

    const hours = Math.floor(distance / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    const milliseconds = String(distance % 1000).padStart(3, '0');

    let displayText;
    if (hours > 0) {
        displayText = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else {
        displayText = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + ':' + milliseconds.substring(0, 2);
    }
    return displayText;
}

// --- Функция для обновления мини-таймера на главной странице ---
function updateMainPageMiniTimerDisplay() {
    const displayEl = document.getElementById('miniTimerPreviewDisplay');
    const statusEl = document.getElementById('miniTimerPreviewStatus');

    if (!displayEl || !statusEl) {
        if (mainPageMiniTimerIntervalId) {
            clearInterval(mainPageMiniTimerIntervalId);
            mainPageMiniTimerIntervalId = null;
        }
        return;
    }

    if (mainPageMiniTimerTargetTime === null || mainPageMiniTimerTargetTime <= Date.now()) {
        displayEl.textContent = formatMainPageMiniTimerTime(0);
        statusEl.textContent = "(остановлен)";
        displayEl.style.color = 'var(--color-text-muted)';
        if (mainPageMiniTimerIntervalId) {
            clearInterval(mainPageMiniTimerIntervalId);
            mainPageMiniTimerIntervalId = null;
        }
        return;
    }

    displayEl.style.color = 'var(--color-primary-light)';
    const now = Date.now();
    const distance = mainPageMiniTimerTargetTime - now;

    displayEl.textContent = formatMainPageMiniTimerTime(distance);
    statusEl.textContent = "идёт отсчёт";

    if (!mainPageMiniTimerIntervalId) {
        mainPageMiniTimerIntervalId = setInterval(updateMainPageMiniTimerDisplay, 100);
    }
}

// --- Обработчики событий Socket.IO ---
socket.on("jsonUpdate", async (matches) => {
    console.log("[SOCKET] Received 'jsonUpdate' with data:", matches);
    try {
        await initPromise;
        updateMatchesUI(matches); // This is where the MP fields will be used
    } catch (error) {
        console.error("[SOCKET] Error updating matches UI after 'jsonUpdate':", error);
    }
    const jsonOutput = document.getElementById("jsonOutput");
    if (jsonOutput) {
        jsonOutput.textContent = JSON.stringify(matches, null, 2);
    }
});

socket.on("mapVetoUpdate", (updatedMapVeto) => {
    console.log("[SOCKET] Received 'mapVetoUpdate' with data:", updatedMapVeto);
    updateMapVetoUI(updatedMapVeto);
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }
    }
});

socket.on("vrsUpdate", (rawVrsData) => {
    console.log("[SOCKET] Received 'vrsUpdate' (raw) with data:", rawVrsData);
    updateVRSUI(rawVrsData);
});

socket.on("customFieldsUpdate", (newFields) => {
    console.log("[SOCKET] Received 'customFieldsUpdate' with data:", newFields);
    const fieldsData = Array.isArray(newFields) && newFields.length > 0 ? newFields[0] : newFields;
    if (fieldsData && typeof fieldsData === 'object') {
        updateCustomFieldsUI(fieldsData);
    } else {
        console.warn("[SOCKET] Received invalid or empty 'customFieldsUpdate' data:", newFields);
        updateCustomFieldsUI({});
    }
});

socket.on("pauseUpdate", (pauseData) => {
    console.log("[SOCKET] Received 'pauseUpdate' (main.js) with data:", pauseData);
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    if (pauseData) {
        if (msgInput && msgInput.value !== (pauseData.pause || "")) {
            msgInput.value = pauseData.pause || "";
        }
        if (timeInput && timeInput.value !== (pauseData.lastUpd || "")) {
            timeInput.value = pauseData.lastUpd || "";
        }
    } else {
        if (msgInput) msgInput.value = "";
        if (timeInput) timeInput.value = "";
    }
});

socket.on("castersUpdate", (casters) => {
    console.log("[SOCKET] Received 'castersUpdate' with data:", casters);
    if (typeof updateCastersUIFromSocket === 'function') {
        updateCastersUIFromSocket(casters);
    }
});

socket.on("selectedCastersUpdate", (selectedCasters) => {
    console.log("[SOCKET] Received 'selectedCastersUpdate' with data:", selectedCasters);
    if (typeof updateSelectedCastersUIFromSocket === 'function') {
        updateSelectedCastersUIFromSocket(selectedCasters);
    }
});

socket.on("timerStateUpdate", (timerData) => {
    console.log("[SOCKET][MainJS] Received 'timerStateUpdate' for mini preview with data:", timerData);
    if (timerData && typeof timerData.targetTime === 'number' && timerData.targetTime > 0) {
        mainPageMiniTimerTargetTime = timerData.targetTime;
    } else {
        mainPageMiniTimerTargetTime = null;
    }
    updateMainPageMiniTimerDisplay();
});


// --- Функция стилизации селекта выбора стороны в Map Veto ---
function updateSideSelectStyle(selectElement) {
    if (!selectElement) return;
    const selectedValue = selectElement.value;
    selectElement.classList.remove('side-is-ct', 'side-is-t');
    if (selectedValue === 'CT') {
        selectElement.classList.add('side-is-ct');
    } else if (selectedValue === 'T') {
        selectElement.classList.add('side-is-t');
    }
}

// --- Функции обновления UI ---
function updateMatchesUI(matches) {
    console.log("[UI] Attempting to update matches UI. Data:", matches);
    if (!Array.isArray(matches)) {
        console.warn("[UI] updateMatchesUI received non-array data:", matches);
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
                matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
            } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
                statusSelect.value = statusSelect.options[0].value;
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (statusSelect.options[0].value) {
                    matchColumn.classList.add(`status-${statusSelect.options[0].value.toLowerCase()}`);
                }
            } else if (statusSelect.value === newStatus) {
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
            }
        }

        const team1Select = document.getElementById(`team1Select${matchIndex}`);
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
        if (team1Select) {
            const optionExists = Array.from(team1Select.options).some(opt => opt.value === team1Name);
            let valueChanged = false;
            if (team1Name && optionExists) {
                if (team1Select.value !== team1Name) {
                    team1Select.value = team1Name;
                    valueChanged = true;
                }
            } else if (team1Select.value !== "" && team1Select.options.length > 0) {
                team1Select.value = team1Select.options[0].value;
                valueChanged = true;
            }
            if (valueChanged || (team1Name && team1Select.value === team1Name)) {
                $(team1Select).trigger('change.select2');
            }
        }

        const team2Select = document.getElementById(`team2Select${matchIndex}`);
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
        if (team2Select) {
            const optionExists = Array.from(team2Select.options).some(opt => opt.value === team2Name);
            let valueChanged = false;
            if (team2Name && optionExists) {
                if (team2Select.value !== team2Name) {
                    team2Select.value = team2Name;
                    valueChanged = true;
                }
            } else if (team2Select.value !== "" && team2Select.options.length > 0) {
                team2Select.value = team2Select.options[0].value;
                valueChanged = true;
            }
            if (valueChanged || (team2Name && team2Select.value === team2Name)) {
                $(team2Select).trigger('change.select2');
            }
        }

        let prefix = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
        else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

        const mapRows = matchColumn.querySelectorAll(".map-row");
        mapRows.forEach((row, i) => {
            const mapIndexInRow = i + 1;
            const mapKey = prefix + `MAP${mapIndexInRow}`;
            const scoreKey = prefix + `MAP${mapIndexInRow}_SCORE`;
            
            const mapSelect = row.querySelector(".map-name-select");
            const scoreInput = row.querySelector(".map-score-input");
            const mapValue = match[mapKey];

            if (mapSelect) {
                if (typeof mapValue !== 'undefined' && mapValue !== null) {
                    const optionExists = Array.from(mapSelect.options).some(opt => opt.value === mapValue);
                    if (mapValue && optionExists) {
                        if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
                    } else if (mapSelect.options.length > 0) {
                        if (mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value;
                    }
                } else if (mapSelect.options.length > 0) {
                    if (mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value;
                }
            }

            const scoreValue = match[scoreKey];
            if (scoreInput) {
                if (typeof scoreValue !== 'undefined' && scoreValue !== null) {
                    if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
                } else {
                    if (scoreInput.value !== "") scoreInput.value = "";
                }
            }

            // --- MODIFICATION FOR MP_ ICONS START ---
            const mapScoreIconElement = row.querySelector(".map-score-icon"); // ASSUMED CLASS for the <img> tag
            if (mapScoreIconElement) {
                let iconPathToDisplay = ""; // Will hold the path like "C:\...\mp_L.png" or ""

                // The 'match' object from the server should contain MPn_UPC, MPn_LIVE, MPn_FIN fields.
                // These fields are populated by the server (ideally using logic similar to your new matches.js).
                // Only one set (UPC, LIVE, or FIN) should contain actual paths for a given map, others should be "".
                const field_FIN = match[`MP${mapIndexInRow}_FIN`];
                const field_LIVE = match[`MP${mapIndexInRow}_LIVE`];
                const field_UPC = match[`MP${mapIndexInRow}_UPC`];

                if (field_FIN && field_FIN !== "") {
                    iconPathToDisplay = field_FIN;
                } else if (field_LIVE && field_LIVE !== "") {
                    iconPathToDisplay = field_LIVE;
                } else if (field_UPC && field_UPC !== "") {
                    // Your new matches.js sets MPn_UPC to its mpNonePath if status is UPCOM.
                    iconPathToDisplay = field_UPC;
                }
                
                // If iconPathToDisplay is an empty string (meaning no specific icon for this map's state),
                // use the fallback default "none" icon. Otherwise, use the found path.
                mapScoreIconElement.src = iconPathToDisplay || DEFAULT_DISPLAY_MP_NONE_ICON;

                // Optional: if an empty path "" should hide the icon instead of showing default:
                // if (iconPathToDisplay && iconPathToDisplay !== "") {
                //    mapScoreIconElement.src = iconPathToDisplay;
                //    mapScoreIconElement.style.display = ''; // Or 'inline', 'block'
                // } else {
                //    mapScoreIconElement.src = ''; // Clear src
                //    mapScoreIconElement.style.display = 'none';
                // }
            }
            // --- MODIFICATION FOR MP_ ICONS END ---
        });

        let winnerTeamKey = "";
        const currentTeam1NameVal = team1Select ? team1Select.value : "";
        const currentTeam2NameVal = team2Select ? team2Select.value : "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
            if (currentTeam1NameVal && match.TEAMWINNER === currentTeam1NameVal) winnerTeamKey = "TEAM1";
            else if (currentTeam2NameVal && match.TEAMWINNER === currentTeam2NameVal) winnerTeamKey = "TEAM2";
        }
        if (winnerTeamKey) matchColumn.setAttribute("data-winner", winnerTeamKey);
        else matchColumn.removeAttribute("data-winner");

        if (typeof refreshWinnerHighlight === 'function') refreshWinnerHighlight(matchIndex);
    });

    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value) {
        const currentVetoMatch = matchSelectElement.value;
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(currentVetoMatch);
        }
        if (typeof updateMapVetoDisplay === 'function') {
            updateMapVetoDisplay(currentVetoMatch);
        }
    }
}

function updateMapVetoUI(mapVetoData) {
    if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
        console.warn("[UI] Invalid or empty data received for updateMapVetoUI:", mapVetoData);
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

            if (mapSelectInRow) {
                const mapValueFromData = vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : "");
                if (mapSelectInRow.value !== mapValueFromData) {
                    mapSelectInRow.value = mapValueFromData;
                }
            }

            if (teamSelect) {
                const teamValueFromData = vetoItem.team || 'TEAM1';
                if (teamSelect.value !== teamValueFromData) {
                    teamSelect.value = teamValueFromData;
                }
                teamSelect.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
                if (teamValueFromData === 'TEAM1') teamSelect.classList.add('team-1-selected-veto');
                if (teamValueFromData === 'TEAM2') teamSelect.classList.add('team-2-selected-veto');
            }

            if (sideSelect) {
                const sideValueFromData = vetoItem.side || '-';
                if (sideSelect.value !== sideValueFromData) {
                    sideSelect.value = sideValueFromData;
                }
                updateSideSelectStyle(sideSelect);
            }
        } else {
            console.warn(`[UI] Row ${rowIndex} in Map Veto table not found.`);
        }
    });

    if (matchSelectElement?.value && typeof mapVetoData.matchIndex !== 'undefined') {
        const currentVetoMatch = matchSelectElement.value;
        if (typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(currentVetoMatch);
        }
        if (typeof updateMapVetoDisplay === 'function') {
            updateMapVetoDisplay(currentVetoMatch);
        }
    }
}

function updateVRSUI(rawVrsData) {
    if (!rawVrsData || typeof rawVrsData !== 'object') {
        console.warn("[UI] Invalid or empty data received for updateVRSUI. Clearing VRS fields.");
        for (let i = 1; i <= 4; i++) clearVRSFieldsForMatch(i);
        if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
        return;
    }

    for (let i = 1; i <= 4; i++) {
        const matchVrs = rawVrsData[i];
        if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
            updateVRSInputField(`team1WinPoints${i}`, matchVrs.TEAM1.winPoints);
            updateVRSInputField(`team1LosePoints${i}`, matchVrs.TEAM1.losePoints);
            updateVRSInputField(`team1Rank${i}`, matchVrs.TEAM1.rank);
            updateVRSInputField(`team1CurrentPoints${i}`, matchVrs.TEAM1.currentPoints);

            updateVRSInputField(`team2WinPoints${i}`, matchVrs.TEAM2.winPoints);
            updateVRSInputField(`team2LosePoints${i}`, matchVrs.TEAM2.losePoints);
            updateVRSInputField(`team2Rank${i}`, matchVrs.TEAM2.rank);
            updateVRSInputField(`team2CurrentPoints${i}`, matchVrs.TEAM2.currentPoints);
        } else {
            clearVRSFieldsForMatch(i);
        }
    }
    if (typeof updateVRSTeamNames === 'function') {
        updateVRSTeamNames();
    }
}

function updateVRSInputField(elementId, value) {
    const element = document.getElementById(elementId);
    const valueToSet = (value === null || typeof value === 'undefined') ? '' : String(value);
    if (element && element.value !== valueToSet) {
        element.value = valueToSet;
    }
}

function clearVRSFieldsForMatch(matchIndex) {
    const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
    fields.forEach(field => {
        updateVRSInputField(`team1${field}${matchIndex}`, '');
        updateVRSInputField(`team2${field}${matchIndex}`, '');
    });
}

function updateCustomFieldsUI(fields) {
    if (!fields || typeof fields !== 'object') {
        console.warn("[UI] Invalid data for updateCustomFieldsUI. Clearing fields.", fields);
        const upcoming = document.getElementById("upcomingMatchesInput");
        const galaxy = document.getElementById("galaxyBattleInput");
        const startDate = document.getElementById("tournamentStart");
        const endDate = document.getElementById("tournamentEnd");
        const groupStage = document.getElementById("groupStageInput");
        if(upcoming) upcoming.value = "";
        if(galaxy) galaxy.value = "";
        if(startDate) startDate.value = "";
        if(endDate) endDate.value = "";
        if(groupStage) groupStage.value = "";
        updateTournamentDay();
        return;
    }

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
}

// --- Функции загрузки данных с сервера при инициализации страницы ---
async function loadMatchesFromServer() {
    console.log("[Data] Initiating load of matches data from server...");
    try {
        const response = await fetch("/api/matchdata");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const matches = await response.json();
        await initPromise;
        updateMatchesUI(matches);
    } catch (error) {
        console.error("[Data] Error loading matchdata:", error);
    }
}
async function loadRawVRSData() {
    console.log("[Data] Initiating load of raw VRS data...");
    try {
        const response = await fetch("/api/vrs-raw");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const rawVrsData = await response.json();
        updateVRSUI(rawVrsData);
    } catch (error) {
        console.error("[Data] Error loading raw VRS data:", error);
    }
}
async function loadMapVetoFromServer() {
    console.log("[Data] Initiating load of map veto data...");
    try {
        const response = await fetch("/api/mapveto");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const mapVetoData = await response.json();
        updateMapVetoUI(mapVetoData);
        
        if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined') {
            const matchSelectElement = document.getElementById("matchSelect");
            if (matchSelectElement && matchSelectElement.value != mapVetoData.matchIndex) {
                // Potential UI sync logic
            }
        }
    } catch (error) {
        console.error("[Data] Error loading map veto data:", error);
    }
}
async function loadCustomFieldsFromServer() {
    console.log("[Data] Initiating load of custom fields data...");
    try {
        const response = await fetch("/api/customfields");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const dataArray = await response.json();
        if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
            updateCustomFieldsUI(dataArray[0]);
        } else {
            console.warn("[Data] Custom fields data is empty or not in expected format. Using empty object.");
            updateCustomFieldsUI({});
        }
    } catch (err) {
        console.error("[Data] Error loading custom fields:", err);
        updateCustomFieldsUI({});
    }
}
async function loadPauseDataFromServer() {
    console.log("[Data] Initiating load of pause data...");
    try {
        const response = await fetch("/api/pause");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const dataArray = await response.json();
        const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {};
        const msgInput = document.getElementById('pauseMessageInput');
        const timeInput = document.getElementById('pauseTimeInput');
        if (msgInput) msgInput.value = pauseData.pause || "";
        if (timeInput) timeInput.value = pauseData.lastUpd || "";
    } catch (err) {
        console.error("[Data] Error loading pause data:", err);
        const msgInput = document.getElementById('pauseMessageInput');
        const timeInput = document.getElementById('pauseTimeInput');
        if (msgInput) msgInput.value = "";
        if (timeInput) timeInput.value = "";
    }
}

// --- Функции для работы с датами турнира ---
function calculateTournamentDay() {
    const startDateInput = document.getElementById("tournamentStart")?.value;
    const endDateInput = document.getElementById("tournamentEnd")?.value;
    const displaySpan = document.getElementById("tournamentDayDisplay");
    if (!displaySpan) return;
    if (!startDateInput) {
        displaySpan.textContent = 'Укажите дату начала';
        displaySpan.style.color = 'var(--color-text-muted)';
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
            displaySpan.style.color = 'var(--color-warning)';
        } else if (end && today > end) {
            displaySpan.textContent = 'Турнир завершен';
            displaySpan.style.color = 'var(--color-success)';
        } else {
            const diffTime = today - start;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            displaySpan.textContent = `День ${diffDays}`;
            displaySpan.style.color = 'var(--color-secondary-light)';
        }
    } catch (e) {
        console.error("Ошибка при расчете дня турнира:", e);
        displaySpan.textContent = 'Ошибка даты';
        displaySpan.style.color = 'var(--color-error)';
    }
}
function updateTournamentDay() {
    calculateTournamentDay();
}

// --- Функции сбора данных с полей ввода ---
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

// --- Управление состоянием кнопок сохранения ---
export function setButtonState(button, state, message = null) {
    if (!button) return;
    const originalText = button.dataset.originalText || button.querySelector('i')?.nextSibling?.textContent?.trim() || button.textContent.trim() || 'SAVE';
    if (!button.dataset.originalText) button.dataset.originalText = originalText;
    const icon = button.querySelector('i');
    const originalIconClass = icon ? (button.dataset.originalIconClass || icon.className) : null;
    if (icon && !button.dataset.originalIconClass) button.dataset.originalIconClass = originalIconClass;
    button.disabled = (state === 'saving');
    button.classList.remove('saving', 'saved', 'error', 'idle');
    button.style.cursor = (state === 'saving') ? 'wait' : 'pointer';
    const setTextAndIcon = (text, iconClass) => {
        if (icon && iconClass) {
            icon.className = iconClass;
            Array.from(button.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            button.appendChild(document.createTextNode(` ${text}`));
        } else {
            button.textContent = text;
        }
    };
    switch (state) {
        case 'saving':
            setTextAndIcon(message || 'Сохранение...', 'fas fa-spinner fa-spin');
            button.classList.add('saving');
            break;
        case 'saved':
            setTextAndIcon(message || 'Сохранено!', 'fas fa-check');
            button.classList.add('saved');
            setTimeout(() => {
                if (button.classList.contains('saved')) {
                    setTextAndIcon(originalText, originalIconClass || '');
                    button.classList.remove('saved');
                    button.classList.add('idle');
                }
            }, 1500);
            break;
        case 'error':
            setTextAndIcon(message || 'Ошибка!', 'fas fa-times-circle');
            button.classList.add('error');
            setTimeout(() => {
                if (button.classList.contains('error')) {
                    setTextAndIcon(originalText, originalIconClass || '');
                    button.classList.remove('error');
                    button.classList.add('idle');
                }
            }, 2500);
            break;
        case 'idle':
        default:
            setTextAndIcon(originalText, originalIconClass || '');
            button.classList.add('idle');
            break;
    }
}

// --- Функции сохранения данных ---
async function saveMatchData(matchIndex, buttonElement) {
    console.log(`[Save] Initiating save for Match ${matchIndex}...`);
    setButtonState(buttonElement, 'saving');
    try {
        // gatherSingleMatchData IS IMPORTED FROM YOUR NEW matches.js
        // It will produce MP fields as per your new matches.js logic.
        const matchData = gatherSingleMatchData(matchIndex); 
        if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}.`);
        const vrsData = gatherSingleVRSData(matchIndex);
        if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}.`);
        await Promise.all([
            saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT'),
            saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT')
        ]);
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving data for Match ${matchIndex}:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    }
}
async function saveMapVetoData(buttonElement) {
    console.log(`[Save] Initiating save for Map Veto data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const mapVetoData = gatherMapVetoData();
        if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
        await saveData('/api/mapveto', mapVetoData, 'POST');
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving Map Veto data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    }
}
async function saveHeaderData(buttonElement) {
    console.log(`[Save] Initiating save for Header (custom fields) data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const customData = gatherCustomFieldsData();
        await saveData('/api/customfields', customData, 'POST');
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving Header data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    }
}
async function savePauseData(buttonElement) {
    console.log(`[Save] Initiating save for Pause data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const pauseData = gatherPauseData();
        await saveData('/api/pause', pauseData, 'POST');
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        console.error(`[Save] Error saving Pause data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    }
}

// --- Настройка слушателей событий ---
function setupListeners() {
    console.log("[Init] Setting up event listeners...");

    document.querySelectorAll('.save-match-button').forEach(button => {
        if (!button.dataset.originalText) {
            const icon = button.querySelector('i');
            button.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : button.textContent.trim();
            if (icon && !button.dataset.originalIconClass) button.dataset.originalIconClass = icon.className;
        }
        const matchIndex = button.dataset.matchIndex;
        if (matchIndex) {
            button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
        } else {
            console.warn("[Init] Save match button found without 'data-match-index' attribute.");
        }
    });

    const saveVetoButton = document.getElementById('saveMapVetoButton');
    if (saveVetoButton) {
        if (!saveVetoButton.dataset.originalText) {
            const icon = saveVetoButton.querySelector('i');
            saveVetoButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : saveVetoButton.textContent.trim();
            if (icon && !saveVetoButton.dataset.originalIconClass) saveVetoButton.dataset.originalIconClass = icon.className;
        }
        saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
    } else {
        console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found.");
    }

    const saveHeaderButton = document.getElementById('saveHeaderButton');
    if (saveHeaderButton) {
        if (!saveHeaderButton.dataset.originalText) {
            const icon = saveHeaderButton.querySelector('i');
            saveHeaderButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : saveHeaderButton.textContent.trim();
            if (icon && !saveHeaderButton.dataset.originalIconClass) saveHeaderButton.dataset.originalIconClass = icon.className;
        }
        saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
    } else {
        console.warn("[Init] Save Header button (id='saveHeaderButton') not found.");
    }

    const savePauseButton = document.getElementById('savePauseButton');
    if (savePauseButton) {
        if (!savePauseButton.dataset.originalText) {
            const icon = savePauseButton.querySelector('i');
            savePauseButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : savePauseButton.textContent.trim();
            if (icon && !savePauseButton.dataset.originalIconClass) savePauseButton.dataset.originalIconClass = icon.className;
        }
        savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
    } else {
        console.warn("[Init] Save Pause button (id='savePauseButton') not found.");
    }

    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement) {
        matchSelectElement.addEventListener('change', () => {
            const currentMatchIndex = matchSelectElement.value;
            if (typeof updateVetoTeamOptions === 'function') {
                updateVetoTeamOptions(currentMatchIndex);
            }
            if (typeof updateMapVetoDisplay === 'function') {
                updateMapVetoDisplay(currentMatchIndex);
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
                if (typeof updateMapVetoDisplay === 'function') {
                    updateMapVetoDisplay(String(i));
                }
            }
            if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
        };
        if (team1Sel) team1Sel.addEventListener('change', listener);
        if (team2Sel) team2Sel.addEventListener('change', listener);
    }

    document.querySelectorAll('#vetoTable .veto-side').forEach(selectElement => {
        if (!selectElement.hasAttribute('data-side-listener-added')) {
            selectElement.addEventListener('change', () => {
                updateSideSelectStyle(selectElement);
            });
            selectElement.setAttribute('data-side-listener-added', 'true');
        }
    });

    document.querySelectorAll('#vetoTable .veto-action').forEach(selectElement => {
        if (!selectElement.hasAttribute('data-action-listener-added')) {
            selectElement.addEventListener('change', () => {
                if (typeof styleVetoActionSelect === 'function') {
                    styleVetoActionSelect(selectElement);
                }
            });
            selectElement.setAttribute('data-action-listener-added', 'true');
        }
    });

    document.querySelectorAll('#vetoTable .veto-team').forEach(selectElement => {
        if (!selectElement.hasAttribute('data-team-listener-added')) {
            selectElement.addEventListener('change', () => {
                selectElement.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
                if (selectElement.value === 'TEAM1') selectElement.classList.add('team-1-selected-veto');
                if (selectElement.value === 'TEAM2') selectElement.classList.add('team-2-selected-veto');
            });
            selectElement.setAttribute('data-team-listener-added', 'true');
        }
    });
    
    const tournamentStartInput = document.getElementById("tournamentStart");
    const tournamentEndInput = document.getElementById("tournamentEnd");
    if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
    if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

    console.log("[Init] All button and select listeners attached.");
}

// --- Инициализация вкладок (табов) ---
function initTabs() {
    const tabsNav = document.querySelector('.tabs-nav');
    const tabLinks = document.querySelectorAll('.tabs-nav .tab-link');
    const tabPanels = document.querySelectorAll('.tabs-content .tab-panel');

    if (!tabsNav || tabLinks.length === 0 || tabPanels.length === 0) {
        console.warn('[Tabs] Tab navigation elements not found. Tabs will not function.');
        return;
    }

    const activeTab = document.querySelector('.tabs-nav .tab-link.active');
    if (!activeTab && tabLinks.length > 0) {
        tabLinks[0].classList.add('active');
        const firstPanelId = tabLinks[0].dataset.tab;
        const firstPanel = document.getElementById(firstPanelId);
        if (firstPanel) firstPanel.classList.add('active');
    }

    tabsNav.addEventListener('click', (event) => {
        const clickedTab = event.target.closest('.tab-link');
        if (!clickedTab || clickedTab.classList.contains('active')) return;
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
}

// --- Инициализация после полной загрузки DOM ---
window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded: Starting application initialization...");
    try {
        await initPromise;
        console.log("DOMContentLoaded: Core module (matches/teams) initialized.");

        await Promise.all([
            loadMatchesFromServer(),
            loadRawVRSData(),
            loadCustomFieldsFromServer(),
            loadMapVetoFromServer(),
            loadPauseDataFromServer()
        ]);
        console.log("DOMContentLoaded: All initial data loaded from server.");

        setupListeners();
        initTabs();
        initTimerControls();

        fetch('/timer')
            .then(response => response.json())
            .then(data => {
                console.log("[MainJS] Initial timer data for mini preview:", data);
                if (data && typeof data.targetTime === 'number' && data.targetTime > 0) {
                    mainPageMiniTimerTargetTime = data.targetTime;
                } else {
                    mainPageMiniTimerTargetTime = null;
                }
                updateMainPageMiniTimerDisplay();
            })
            .catch(err => {
                console.error('[MainJS] Error fetching initial timer state for mini preview:', err);
                mainPageMiniTimerTargetTime = null;
                updateMainPageMiniTimerDisplay();
            });
        
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement?.value) {
            const currentVetoMatch = matchSelectElement.value;
            if (typeof updateVetoTeamOptions === 'function') {
                updateVetoTeamOptions(currentVetoMatch);
            }
            if (typeof updateMapVetoDisplay === 'function') {
                updateMapVetoDisplay(currentVetoMatch);
            }
        }
        
        document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => {
            if (typeof styleVetoActionSelect === 'function') {
                styleVetoActionSelect(actionSelect);
            }
        });
        document.querySelectorAll('#vetoTable .veto-team').forEach(teamSelect => {
            teamSelect.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
            if (teamSelect.value === 'TEAM1') teamSelect.classList.add('team-1-selected-veto');
            if (teamSelect.value === 'TEAM2') teamSelect.classList.add('team-2-selected-veto');
        });
        updateTournamentDay();

        console.log("DOMContentLoaded: Full application initialization complete. UI is ready.");
    } catch (error) {
        console.error("DOMContentLoaded: Critical error during initialization:", error);
        document.body.innerHTML = `<div style="color:red; padding: 20px; font-family: sans-serif;">Критическая ошибка при инициализации приложения: ${error.message}. Проверьте консоль для деталей.</div>`;
    }
});