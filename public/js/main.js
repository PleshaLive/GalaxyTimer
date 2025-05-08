// public/js/main.js

// Импорт необходимых модулей и функций
import {
    initMatches,
    gatherSingleMatchData,
    refreshWinnerHighlight,
    // areTeamsInitialized, // Не используется напрямую здесь
    updateStatusColor,
    updateTeamDisplay
} from "./matches.js";
import {
    initMapVeto,
    gatherMapVetoData,
    updateVetoTeamOptions,
    styleVetoActionSelect,
    updateMapVetoDisplay // <-- Импортируем новую функцию для дисплея команд Veto
} from "./mapVeto.js";
import {
    initVRS,
    gatherSingleVRSData,
    updateVRSTeamNames
} from "./vrs.js";
import { saveData } from "./api.js";
// Импорты для модуля кастеров
import {
    initCasters,
    updateCastersUIFromSocket,
    updateSelectedCastersUIFromSocket
    // Функции загрузки кастеров (loadCasters, loadSelectedCasters) обычно вызываются внутри initCasters или по событиям сокета
} from "./casters.js";

// Инициализация Socket.IO клиента
const socket = io();
console.log("[Init] Socket.IO client initialized.");

// Промис для отслеживания инициализации данных команд (важно для селектов)
const initPromise = initMatches(); // Запускает загрузку команд, Select2, слушателей
initMapVeto(); // Инициализация элементов управления и логики для Map Veto
initVRS();     // Инициализация элементов управления и логики для VRS блоков
initCasters(); // Инициализация модуля кастеров

// --- Обработчики событий Socket.IO ---

// Получение полного обновления данных по всем матчам
socket.on("jsonUpdate", async (matches) => {
    console.log("[SOCKET] Received 'jsonUpdate' with data:", matches);
    try {
        await initPromise; // Гарантируем, что команды загружены перед обновлением UI матчей
        updateMatchesUI(matches); // Обновляем интерфейс матчей
    } catch (error) {
        console.error("[SOCKET] Error updating matches UI after 'jsonUpdate':", error);
    }
    // Отображение полученного JSON на вкладке "JSON"
    const jsonOutput = document.getElementById("jsonOutput");
    if (jsonOutput) {
        jsonOutput.textContent = JSON.stringify(matches, null, 2);
    }
});

// Получение обновления данных для Map Veto
socket.on("mapVetoUpdate", (updatedMapVeto) => {
    console.log("[SOCKET] Received 'mapVetoUpdate' with data:", updatedMapVeto);
    updateMapVetoUI(updatedMapVeto); // Обновляем интерфейс Map Veto (таблицу)

    // Обновляем опции и дисплей команд для соответствующего матча в Map Veto
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        // Проверяем, что функции существуют перед вызовом
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value); // Обновляем опции в таблице Veto
        }
        if (matchSelectElement && typeof updateMapVetoDisplay === 'function') {
             updateMapVetoDisplay(matchSelectElement.value); // Обновляем дисплей НАД таблицей Veto
        }
    }
});

// Получение обновления "сырых" данных для VRS
socket.on("vrsUpdate", (rawVrsData) => {
    console.log("[SOCKET] Received 'vrsUpdate' (raw) with data:", rawVrsData);
    updateVRSUI(rawVrsData); // Обновляем интерфейс VRS
});

// Получение обновления кастомных полей (хедер)
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

// Получение обновления данных о паузе
socket.on("pauseUpdate", (pauseData) => {
    console.log("[SOCKET] Received 'pauseUpdate' (main.js) with data:", pauseData);
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

// Получение обновления данных о ВСЕХ кастерах
socket.on("castersUpdate", (casters) => {
    console.log("[SOCKET] Received 'castersUpdate' with data:", casters);
    if (typeof updateCastersUIFromSocket === 'function') {
       updateCastersUIFromSocket(casters);
    } else {
        console.warn("Function 'updateCastersUIFromSocket' not found or not imported correctly from casters.js");
    }
});

// Получение обновления данных о ВЫБРАННЫХ кастерах
socket.on("selectedCastersUpdate", (selectedCasters) => {
    console.log("[SOCKET] Received 'selectedCastersUpdate' with data:", selectedCasters);
    if (typeof updateSelectedCastersUIFromSocket === 'function') {
        updateSelectedCastersUIFromSocket(selectedCasters);
    } else {
        console.warn("Function 'updateSelectedCastersUIFromSocket' not found or not imported correctly from casters.js");
    }
});


// --- Функция стилизации селекта выбора стороны в Map Veto ---
/**
 * Обновляет CSS классы для элемента select выбора стороны в MapVeto.
 * @param {HTMLSelectElement} selectElement - Элемент select.
 */
function updateSideSelectStyle(selectElement) {
    if (!selectElement) return;
    const selectedValue = selectElement.value;
    selectElement.classList.remove('side-is-ct', 'side-is-t'); // Удаляем существующие классы сторон

    if (selectedValue === 'CT') {
        selectElement.classList.add('side-is-ct'); // Добавляем класс для CT
    } else if (selectedValue === 'T') {
        selectElement.classList.add('side-is-t');  // Добавляем класс для T
    }
    // Если выбрано "-", классы не добавляются
}

// --- Функции обновления UI ---

/**
 * Обновляет весь интерфейс матчей на основе полученных данных.
 * Учитывает использование Select2 для выбора команд.
 * @param {Array<Object>} matches - Массив объектов с данными по каждому матчу.
 */
function updateMatchesUI(matches) {
    console.log("[UI] Attempting to update matches UI. Data:", matches);
    if (!Array.isArray(matches)) {
        console.warn("[UI] updateMatchesUI received non-array data:", matches); return;
    }
    matches.forEach((match, index) => {
        const matchIndex = index + 1;
        const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
        if (!matchColumn) { console.warn(`[UI] Match column ${matchIndex} not found.`); return; }

        // Время
        const timeInput = document.getElementById(`timeInput${matchIndex}`);
        if (timeInput) {
            let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
            timeValue = timeValue.replace(/ CEST$/i, '').trim();
            if (timeInput.value !== timeValue) timeInput.value = timeValue;
        }
        // Статус
        const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
        if (statusSelect) {
            let newStatus = "";
            if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
            else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
            else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

            const currentStatusClass = Array.from(matchColumn.classList).find(cls => cls.startsWith('status-'));

            if (newStatus && statusSelect.value !== newStatus) {
                statusSelect.value = newStatus;
                updateStatusColor(statusSelect); // Обновляем цвет селекта
                if (currentStatusClass) matchColumn.classList.remove(currentStatusClass);
                matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
            } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
                statusSelect.value = statusSelect.options[0].value; // Сброс на первую опцию
                updateStatusColor(statusSelect);
                if (currentStatusClass) matchColumn.classList.remove(currentStatusClass);
                if (statusSelect.options[0].value) matchColumn.classList.add(`status-${statusSelect.options[0].value.toLowerCase()}`);
            } else if (statusSelect.value === newStatus) { // Если статус не изменился, все равно обновить цвет/класс
                 updateStatusColor(statusSelect);
                 const expectedClass = `status-${newStatus.toLowerCase()}`;
                 if (currentStatusClass !== expectedClass) {
                     if (currentStatusClass) matchColumn.classList.remove(currentStatusClass);
                     if (newStatus) matchColumn.classList.add(expectedClass);
                 }
            }
             // Сохраняем data-атрибуты, которые могли быть перезаписаны при смене класса
             matchColumn.dataset.match = matchIndex;
             if (match.TEAMWINNER) { // Восстанавливаем data-winner если он был в данных
                let winnerKeyRestored = "";
                 const t1NameRestored = $(`#team1Select${matchIndex}`).val();
                 const t2NameRestored = $(`#team2Select${matchIndex}`).val();
                 if(t1NameRestored && match.TEAMWINNER === t1NameRestored) winnerKeyRestored = "TEAM1";
                 else if(t2NameRestored && match.TEAMWINNER === t2NameRestored) winnerKeyRestored = "TEAM2";
                 if(winnerKeyRestored) matchColumn.dataset.winner = winnerKeyRestored;
                 else matchColumn.removeAttribute("data-winner"); // Если победитель из данных не совпал с именами, убираем
             } else if (match.FINISHED_MATCH_STATUS !== "FINISHED") { // Если матч не закончен, победителя быть не должно
                 matchColumn.removeAttribute("data-winner");
             } // Если FINISHED, но нет TEAMWINNER, data-winner не трогаем, он мог быть установлен вручную
        }
        // Команды (Select2)
        const team1SelectJQ = $(`#team1Select${matchIndex}`);
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
        if (team1SelectJQ.length) {
            const optionExists = team1SelectJQ.find(`option[value="${CSS.escape(team1Name)}"]`).length > 0;
            if (team1Name && optionExists && team1SelectJQ.val() !== team1Name) team1SelectJQ.val(team1Name).trigger('change.select2');
            else if (!team1Name && team1SelectJQ.val() !== "") team1SelectJQ.val("").trigger('change.select2');
        }
        const team2SelectJQ = $(`#team2Select${matchIndex}`);
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
        if (team2SelectJQ.length) {
            const optionExists = team2SelectJQ.find(`option[value="${CSS.escape(team2Name)}"]`).length > 0;
            if (team2Name && optionExists && team2SelectJQ.val() !== team2Name) team2SelectJQ.val(team2Name).trigger('change.select2');
            else if (!team2Name && team2SelectJQ.val() !== "") team2SelectJQ.val("").trigger('change.select2');
        }
        // Обновляем лого над селектами и текст кнопок победителя
        updateTeamDisplay(matchIndex);
        // Карты
        let prefix = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
        else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";
        const mapRows = matchColumn.querySelectorAll(".map-row");
        mapRows.forEach((row, i) => {
            const mapKey = prefix + `MAP${i + 1}`, scoreKey = prefix + `MAP${i + 1}_SCORE`;
            const mapSelect = row.querySelector(".map-name-select"), scoreInput = row.querySelector(".map-score-input");
            const mapValue = match[mapKey], scoreValue = match[scoreKey];
            if (mapSelect) {
                 if (typeof mapValue !== 'undefined' && mapValue !== null) {
                    const optExists = Array.from(mapSelect.options).some(opt => opt.value === mapValue);
                    if (mapValue && optExists && mapSelect.value !== mapValue) mapSelect.value = mapValue;
                    else if (!mapValue && mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value;
                 } else if (mapSelect.options.length > 0 && mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value;
            }
            if (scoreInput) {
                if (typeof scoreValue !== 'undefined' && scoreValue !== null && scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
                else if ((typeof scoreValue === 'undefined' || scoreValue === null) && scoreInput.value !== "") scoreInput.value = "";
            }
        });
        // Победитель (логика установки атрибута data-winner перенесена выше, после обновления статуса)
        refreshWinnerHighlight(matchIndex); // Обновляем подсветку кнопки
    });
    // Обновляем связанные UI после всех матчей
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value) {
        if(typeof updateVetoTeamOptions === 'function') updateVetoTeamOptions(matchSelectElement.value);
        if(typeof updateMapVetoDisplay === 'function') updateMapVetoDisplay(matchSelectElement.value); // Обновляем и дисплей Veto
    }
}


/** Обновляет UI таблицы Map Veto */
function updateMapVetoUI(mapVetoData) {
    console.log("[UI] Attempting to update Map Veto UI. Data:", mapVetoData);
    if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
        console.warn("[UI] Invalid or empty data received for updateMapVetoUI:", mapVetoData); return;
    }
    const matchSelectElement = document.getElementById("matchSelect");
    // Обновляем выбор матча, если данные пришли для другого матча
    if (matchSelectElement && typeof mapVetoData.matchIndex !== 'undefined' && matchSelectElement.value != mapVetoData.matchIndex) {
        matchSelectElement.value = mapVetoData.matchIndex;
    }
    mapVetoData.veto.forEach((vetoItem, idx) => {
        const rowIndex = idx + 1;
        const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
        if (row) {
            const actionSelect = row.querySelector(".veto-action"), mapSelectInRow = row.querySelector(".veto-map");
            const teamSelect = row.querySelector(".veto-team"), sideSelect = row.querySelector(".veto-side");
            // Action
            if (actionSelect) {
                const actionValue = vetoItem.action || 'BAN'; if (actionSelect.value !== actionValue) actionSelect.value = actionValue;
                if (typeof styleVetoActionSelect === 'function') styleVetoActionSelect(actionSelect);
            }
            // Map
            if (mapSelectInRow) {
                const mapValue = vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : "");
                if (mapSelectInRow.value !== mapValue) mapSelectInRow.value = mapValue;
            }
            // Team
            if (teamSelect) {
                const teamValue = vetoItem.team || 'TEAM1'; if (teamSelect.value !== teamValue) teamSelect.value = teamValue;
                teamSelect.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
                if (teamValue === 'TEAM1') teamSelect.classList.add('team-1-selected-veto');
                if (teamValue === 'TEAM2') teamSelect.classList.add('team-2-selected-veto');
            }
            // Side
            if (sideSelect) {
                const sideValue = vetoItem.side || '-'; if (sideSelect.value !== sideValue) sideSelect.value = sideValue;
                updateSideSelectStyle(sideSelect);
            }
        } else console.warn(`[UI] Row ${rowIndex} in Map Veto table not found.`);
    });
    // Обновляем тексты команд в селектах ПОСЛЕ обновления значений строк
    if (matchSelectElement?.value && typeof mapVetoData.matchIndex !== 'undefined' && typeof updateVetoTeamOptions === 'function') {
       updateVetoTeamOptions(matchSelectElement.value);
    }
    console.log("[UI] Map Veto UI (table) update finished for match", mapVetoData.matchIndex);
}


/** Обновляет UI VRS-блоков */
function updateVRSUI(rawVrsData) {
    console.log("[UI] Attempting to update VRS UI. Data:", rawVrsData);
    if (!rawVrsData || typeof rawVrsData !== 'object') {
        console.warn("[UI] Invalid or empty data received for updateVRSUI. Clearing VRS fields.");
        for (let i = 1; i <= 4; i++) clearVRSFieldsForMatch(i);
        if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames(); return;
    }
    for (let i = 1; i <= 4; i++) {
        const matchVrs = rawVrsData[i];
        if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
            updateVRSInputField(`team1WinPoints${i}`, matchVrs.TEAM1.winPoints); updateVRSInputField(`team1LosePoints${i}`, matchVrs.TEAM1.losePoints);
            updateVRSInputField(`team1Rank${i}`, matchVrs.TEAM1.rank); updateVRSInputField(`team1CurrentPoints${i}`, matchVrs.TEAM1.currentPoints);
            updateVRSInputField(`team2WinPoints${i}`, matchVrs.TEAM2.winPoints); updateVRSInputField(`team2LosePoints${i}`, matchVrs.TEAM2.losePoints);
            updateVRSInputField(`team2Rank${i}`, matchVrs.TEAM2.rank); updateVRSInputField(`team2CurrentPoints${i}`, matchVrs.TEAM2.currentPoints);
        } else clearVRSFieldsForMatch(i);
    }
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    console.log("[UI] VRS UI update finished.");
}
/** Вспомогательная функция для обновления одного поля ввода VRS. */
function updateVRSInputField(elementId, value) {
    const element = document.getElementById(elementId);
    const valueToSet = (value === null || typeof value === 'undefined') ? '' : String(value);
    if (element && element.value !== valueToSet) element.value = valueToSet;
}
/** Вспомогательная функция для очистки полей VRS для одного матча. */
function clearVRSFieldsForMatch(matchIndex) {
    const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
    fields.forEach(field => { updateVRSInputField(`team1${field}${matchIndex}`, ''); updateVRSInputField(`team2${field}${matchIndex}`, ''); });
}

/** Обновляет UI кастомных полей (хедер) */
function updateCustomFieldsUI(fields) {
    if (!fields || typeof fields !== 'object') {
        console.warn("[UI] Invalid data for updateCustomFieldsUI. Clearing fields.", fields);
        ['upcomingMatchesInput', 'galaxyBattleInput', 'tournamentStart', 'tournamentEnd', 'groupStageInput'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = "";
        });
        updateTournamentDay(); return;
    }
    const updateField = (id, value) => { const el = document.getElementById(id); if (el && el.value !== (value || "")) el.value = value || ""; };
    updateField("upcomingMatchesInput", fields.upcomingMatches); updateField("galaxyBattleInput", fields.galaxyBattle);
    updateField("tournamentStart", fields.tournamentStart); updateField("tournamentEnd", fields.tournamentEnd);
    updateField("groupStageInput", fields.groupStage);
    updateTournamentDay();
}

// --- Функции загрузки данных с сервера при инициализации ---

async function loadMatchesFromServer() {
    console.log("[Data] Initiating load of matches data from server...");
    try {
        const response = await fetch("/api/matchdata");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const matches = await response.json();
        console.log("[Data] Matches data loaded successfully:", matches);
        await initPromise; // Убеждаемся, что команды и Select2 инициализированы
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
        console.log("[Data] Raw VRS data loaded successfully:", rawVrsData);
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
        console.log("[Data] Map veto data loaded successfully:", mapVetoData);
        updateMapVetoUI(mapVetoData); // Обновляем таблицу
        // Обновляем опции и дисплей команд ПОСЛЕ обновления таблицы
        if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined') {
            const matchSelectElement = document.getElementById("matchSelect");
             if (matchSelectElement) { // Обновляем для текущего выбранного матча
                 if(typeof updateVetoTeamOptions === 'function') updateVetoTeamOptions(matchSelectElement.value);
                 // Дисплей обновится при DOMContentLoaded или при смене матча
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
        console.log("[Data] Pause data loaded successfully:", dataArray);
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
        const today = new Date(); // Текущая дата
        // const today = new Date("2025-05-08"); // Для теста

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

function updateTournamentDay() { calculateTournamentDay(); }
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// --- Функции сбора данных с полей ввода ---

function gatherCustomFieldsData() {
    updateTournamentDay(); // Обновляем день турнира перед сбором данных
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
            Array.from(button.childNodes).forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.remove(); });
            button.appendChild(document.createTextNode(` ${text}`));
        } else button.textContent = text;
    };
    switch (state) {
        case 'saving': setTextAndIcon(message || 'Сохранение...', 'fas fa-spinner fa-spin'); button.classList.add('saving'); break;
        case 'saved': setTextAndIcon(message || 'Сохранено!', 'fas fa-check'); button.classList.add('saved'); setTimeout(() => { if (button.classList.contains('saved')) { setTextAndIcon(originalText, originalIconClass || ''); button.classList.remove('saved'); button.classList.add('idle'); } }, 1500); break;
        case 'error': setTextAndIcon(message || 'Ошибка!', 'fas fa-times-circle'); button.classList.add('error'); setTimeout(() => { if (button.classList.contains('error')) { setTextAndIcon(originalText, originalIconClass || ''); button.classList.remove('error'); button.classList.add('idle'); } }, 2500); break;
        case 'idle': default: setTextAndIcon(originalText, originalIconClass || ''); button.classList.add('idle'); break;
    }
}

// --- Функции сохранения данных ---

async function saveMatchData(matchIndex, buttonElement) {
    console.log(`[Save] Initiating save for Match ${matchIndex}...`);
    setButtonState(buttonElement, 'saving');
    try {
        const matchData = gatherSingleMatchData(matchIndex);
        if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}.`);
        const vrsData = gatherSingleVRSData(matchIndex);
        if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}.`);
        await Promise.all([
            saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT'),
            saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT')
        ]);
        setButtonState(buttonElement, 'saved');
        console.log(`[Save] Data for Match ${matchIndex} saved successfully.`);
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
        console.log(`[Save] Map Veto data saved successfully.`);
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
        console.log(`[Save] Header data saved successfully.`);
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
        console.log(`[Save] Pause data saved successfully.`);
    } catch (error) {
        console.error(`[Save] Error saving Pause data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    }
}

// --- Настройка слушателей событий ---

function setupListeners() {
    console.log("[Init] Setting up event listeners...");

    // Кнопки сохранения матчей
    document.querySelectorAll('.save-match-button').forEach(button => {
        if (button.dataset.saveListenerAttached !== 'true') {
            const matchIndex = button.dataset.matchIndex;
            if (matchIndex) {
                 if (!button.dataset.originalText) { // Сохраняем текст/иконку при первой настройке
                    const icon = button.querySelector('i');
                    button.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : button.textContent.trim();
                    if (icon && !button.dataset.originalIconClass) button.dataset.originalIconClass = icon.className;
                 }
                button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
                button.dataset.saveListenerAttached = 'true';
            } else console.warn("[Init] Save match button missing 'data-match-index'.");
        }
    });

    // Кнопка сохранения Map Veto
    const saveVetoButton = document.getElementById('saveMapVetoButton');
    if (saveVetoButton && saveVetoButton.dataset.saveListenerAttached !== 'true') {
         if (!saveVetoButton.dataset.originalText) {
             const icon = saveVetoButton.querySelector('i');
             saveVetoButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : saveVetoButton.textContent.trim();
             if (icon && !saveVetoButton.dataset.originalIconClass) saveVetoButton.dataset.originalIconClass = icon.className;
         }
        saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
        saveVetoButton.dataset.saveListenerAttached = 'true';
    } else if (!saveVetoButton) console.warn("[Init] Button #saveMapVetoButton not found.");

    // Кнопка сохранения хедера
    const saveHeaderButton = document.getElementById('saveHeaderButton');
    if (saveHeaderButton && saveHeaderButton.dataset.saveListenerAttached !== 'true') {
        if (!saveHeaderButton.dataset.originalText) {
            const icon = saveHeaderButton.querySelector('i');
            saveHeaderButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : saveHeaderButton.textContent.trim();
            if (icon && !saveHeaderButton.dataset.originalIconClass) saveHeaderButton.dataset.originalIconClass = icon.className;
        }
        saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
        saveHeaderButton.dataset.saveListenerAttached = 'true';
    } else if (!saveHeaderButton) console.warn("[Init] Button #saveHeaderButton not found.");

    // Кнопка сохранения паузы
    const savePauseButton = document.getElementById('savePauseButton');
    if (savePauseButton && savePauseButton.dataset.saveListenerAttached !== 'true') {
         if (!savePauseButton.dataset.originalText) {
            const icon = savePauseButton.querySelector('i');
            savePauseButton.dataset.originalText = icon ? icon.nextSibling?.textContent?.trim() : savePauseButton.textContent.trim();
            if (icon && !savePauseButton.dataset.originalIconClass) savePauseButton.dataset.originalIconClass = icon.className;
         }
        savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
        savePauseButton.dataset.saveListenerAttached = 'true';
    } else if (!savePauseButton) console.warn("[Init] Button #savePauseButton not found.");

    // Слушатель изменения матча в Map Veto
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement && matchSelectElement.dataset.changeListenerAttached !== 'true') {
        const handleMatchSelectChange = () => {
            const selectedMatchIndex = matchSelectElement.value;
            console.log(`[MapVeto] Match selection changed to: ${selectedMatchIndex}`);
            // Обновляем опции команд ВНУТРИ таблицы вето
            if (typeof updateVetoTeamOptions === 'function') updateVetoTeamOptions(selectedMatchIndex);
            else console.warn("updateVetoTeamOptions function not found");
            // Обновляем дисплей команд НАД таблицей вето
            if (typeof updateMapVetoDisplay === 'function') updateMapVetoDisplay(selectedMatchIndex);
            else console.warn("updateMapVetoDisplay function not found");
        };
        matchSelectElement.addEventListener('change', handleMatchSelectChange);
        matchSelectElement.dataset.changeListenerAttached = 'true';
    }

    // Слушатели для таблицы Map Veto
    document.querySelectorAll('#vetoTable .veto-side').forEach(selectElement => {
        if (!selectElement.hasAttribute('data-side-listener-added')) {
            selectElement.addEventListener('change', () => updateSideSelectStyle(selectElement));
            selectElement.setAttribute('data-side-listener-added', 'true');
        }
    });
    document.querySelectorAll('#vetoTable .veto-action').forEach(selectElement => {
        if (!selectElement.hasAttribute('data-action-listener-added')) {
            selectElement.addEventListener('change', () => { if (typeof styleVetoActionSelect === 'function') styleVetoActionSelect(selectElement); });
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

    console.log("[Init] All button and select listeners (main context) attached.");
}

// --- Инициализация вкладок (табов) ---
function initTabs() {
    const tabsNav = document.querySelector('.tabs-nav');
    const tabLinks = document.querySelectorAll('.tabs-nav .tab-link');
    const tabPanels = document.querySelectorAll('.tabs-content .tab-panel');
    if (!tabsNav || tabLinks.length === 0 || tabPanels.length === 0) {
        console.warn('[Tabs] Tab navigation elements not found.'); return;
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
        if (targetPanel) targetPanel.classList.add('active');
        else console.warn(`[Tabs] Tab panel with id "${targetTabId}" not found.`);
    });
    console.log("[Init] Tabs initialized successfully.");
}

// --- Инициализация после полной загрузки DOM ---
window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded: Starting application initialization...");
    try {
        await initPromise; // Ждем инициализации команд
        console.log("DOMContentLoaded: Core module (matches/teams) initialized.");

        // Загружаем все остальные данные параллельно
        await Promise.all([
            loadMatchesFromServer(), loadRawVRSData(), loadCustomFieldsFromServer(),
            loadMapVetoFromServer(), loadPauseDataFromServer(),
        ]);
        console.log("DOMContentLoaded: All initial data loaded from server.");

        // Настраиваем слушатели и табы
        setupListeners();
        initTabs();

        // --- Первичная настройка UI после загрузки ВСЕХ данных ---
        const initialMatchSelect = document.getElementById("matchSelect");
        // 1. Обновляем опции и дисплей команд в Veto для выбранного матча
        if (initialMatchSelect?.value) {
            if (typeof updateVetoTeamOptions === 'function') updateVetoTeamOptions(initialMatchSelect.value);
            else console.warn("Initial call: updateVetoTeamOptions function not found");

            // ---> ВАЖНО: Вызов для первоначального отображения команд над таблицей Veto
            if (typeof updateMapVetoDisplay === 'function') {
                console.log(`[Init] Calling initial updateMapVetoDisplay for Match ${initialMatchSelect.value}`);
                updateMapVetoDisplay(initialMatchSelect.value);
            } else console.warn("Initial call: updateMapVetoDisplay function not found");
        }
        // 2. Применяем стили к Veto таблице
        document.querySelectorAll('#vetoTable .veto-action').forEach(s => { if(typeof styleVetoActionSelect === 'function') styleVetoActionSelect(s); });
        document.querySelectorAll('#vetoTable .veto-team').forEach(s => { s.classList.remove('team-1-selected-veto','team-2-selected-veto'); if(s.value==='TEAM1') s.classList.add('team-1-selected-veto'); if(s.value==='TEAM2') s.classList.add('team-2-selected-veto'); });
        document.querySelectorAll('#vetoTable .veto-side').forEach(updateSideSelectStyle);
        // 3. Обновляем день турнира
        updateTournamentDay();

        console.log("DOMContentLoaded: Full application initialization complete. UI is ready.");
    } catch (error) {
        console.error("DOMContentLoaded: Critical error during initialization:", error);
        document.body.innerHTML = `<div style="color:red; background: #111; border: 1px solid red; padding: 20px; font-family: sans-serif;">Критическая ошибка: ${error.message}. См. консоль (F12).</div>`;
    }
});