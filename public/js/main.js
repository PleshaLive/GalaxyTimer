// public/js/main.js

// Импорт необходимых модулей и функций
import {
    initMatches,
    gatherSingleMatchData,
    refreshWinnerHighlight,
    // areTeamsInitialized, // Кажется, не используется в main.js напрямую
    updateStatusColor,
    updateTeamDisplay
} from "./matches.js";
import {
    initMapVeto,
    gatherMapVetoData,
    updateVetoTeamOptions,
    styleVetoActionSelect
} from "./mapVeto.js";
import {
    initVRS,
    gatherSingleVRSData,
    updateVRSTeamNames
} from "./vrs.js";
import { saveData } from "./api.js";
// Импорты для нового модуля кастеров
import {
    initCasters,
    // loadCasters, // Вызывается внутри initCasters или по сокету
    // updateCastersUIFromSocket, // Вызывается по сокету
    // updateSelectedCastersUIFromSocket, // Вызывается по сокету
    // loadSelectedCasters // Вызывается внутри initCasters или по сокету
} from "./casters.js";

// Инициализация Socket.IO клиента
const socket = io();
console.log("[Init] Socket.IO client initialized.");

// Промис для отслеживания инициализации данных команд (важно для селектов)
const initPromise = initMatches(); // Запускает загрузку списка команд, заполнение селектов и ПРИВЯЗКУ КНОПОК ПОБЕДИТЕЛЯ
initMapVeto(); // Инициализация элементов управления и логики для Map Veto
initVRS();     // Инициализация элементов управления и логики для VRS блоков
initCasters(); // Инициализация модуля кастеров (загружает данные внутри)

// --- Обработчики событий Socket.IO ---

// Получение полного обновления данных по всем матчам
socket.on("jsonUpdate", async (matches) => {
    console.log("[SOCKET] Received 'jsonUpdate' with data:", matches);
    try {
        await initPromise; // Гарантируем, что команды загружены перед обновлением UI матчей
        updateMatchesUI(matches); // Обновляем интерфейс матчей (включая подсветку победителя)
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
    updateMapVetoUI(updatedMapVeto); // Обновляем интерфейс Map Veto
    // Обновляем опции команд для соответствующего матча в Map Veto
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        // Проверяем, что функция updateVetoTeamOptions существует перед вызовом
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value); // Обновляем с учетом текущего выбранного матча в Veto
        }
    }
});

// Получение обновления "сырых" данных для VRS
socket.on("vrsUpdate", (rawVrsData) => {
    console.log("[SOCKET] Received 'vrsUpdate' (raw) with data:", rawVrsData);
    updateVRSUI(rawVrsData); // Обновляем интерфейс VRS
});

// Получение обновления кастомных полей (обычно из хедера: название турнира, даты и т.д.)
socket.on("customFieldsUpdate", (newFields) => {
    console.log("[SOCKET] Received 'customFieldsUpdate' with data:", newFields);
    // Данные могут приходить как массив из одного объекта или как сам объект
    const fieldsData = Array.isArray(newFields) && newFields.length > 0 ? newFields[0] : newFields;
    if (fieldsData && typeof fieldsData === 'object') {
        updateCustomFieldsUI(fieldsData); // Обновляем интерфейс кастомных полей
    } else {
        console.warn("[SOCKET] Received invalid or empty 'customFieldsUpdate' data:", newFields);
        updateCustomFieldsUI({}); // В случае невалидных данных, обновляем UI пустым объектом
    }
});

// Получение обновления данных о паузе в матче
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

// Получение обновления данных о ВСЕХ кастерах
socket.on("castersUpdate", (casters) => {
    console.log("[SOCKET] Received 'castersUpdate' with data:", casters);
    // Предполагается, что updateCastersUIFromSocket импортируется из casters.js и существует
    if (typeof window.updateCastersUIFromSocket === 'function') { // Используем window для глобальной доступности, если не импортировано напрямую
        window.updateCastersUIFromSocket(casters);
    } else if (typeof updateCastersUIFromSocket === 'function') { // Если импортировано
         updateCastersUIFromSocket(casters);
    }
});

// Получение обновления данных о ВЫБРАННЫХ кастерах
socket.on("selectedCastersUpdate", (selectedCasters) => {
    console.log("[SOCKET] Received 'selectedCastersUpdate' with data:", selectedCasters);
    if (typeof window.updateSelectedCastersUIFromSocket === 'function') {
        window.updateSelectedCastersUIFromSocket(selectedCasters);
    } else if (typeof updateSelectedCastersUIFromSocket === 'function') {
        updateSelectedCastersUIFromSocket(selectedCasters);
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
        // console.log(`[UI] Updating Match ${matchIndex}...`);

        // Обновление времени
        const timeInput = document.getElementById(`timeInput${matchIndex}`);
        if (timeInput) {
            let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
            timeValue = timeValue.replace(/ CEST$/i, '').trim();
            if (timeInput.value !== timeValue) timeInput.value = timeValue;
        }

        // Обновление статуса
        const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
        if (statusSelect) {
            let newStatus = "";
            if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
            else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
            else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

            if (newStatus && statusSelect.value !== newStatus) {
                statusSelect.value = newStatus;
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect); // Обновляем цвет селекта
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
            } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
                statusSelect.value = statusSelect.options[0].value; // Сброс на первую опцию (обычно пустую или UPCOM)
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (statusSelect.options[0].value) {
                    matchColumn.classList.add(`status-${statusSelect.options[0].value.toLowerCase()}`);
                }
            } else if (statusSelect.value === newStatus) { // Если статус не изменился, все равно обновить цвет
                 if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
            }
        }

        // Обновление Команды 1 с учетом Select2
        const team1SelectJQ = $(`#team1Select${matchIndex}`);
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
        if (team1SelectJQ.length) {
            const optionExists = team1SelectJQ.find(`option[value="${CSS.escape(team1Name)}"]`).length > 0;
            if (team1Name && optionExists) {
                if (team1SelectJQ.val() !== team1Name) {
                    team1SelectJQ.val(team1Name).trigger('change.select2');
                }
            } else if (team1SelectJQ.val() !== "") {
                team1SelectJQ.val("").trigger('change.select2'); // Сброс на "-"
            }
        }

        // Обновление Команды 2 с учетом Select2
        const team2SelectJQ = $(`#team2Select${matchIndex}`);
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
        if (team2SelectJQ.length) {
            const optionExists = team2SelectJQ.find(`option[value="${CSS.escape(team2Name)}"]`).length > 0;
            if (team2Name && optionExists) {
                 if (team2SelectJQ.val() !== team2Name) {
                    team2SelectJQ.val(team2Name).trigger('change.select2');
                }
            } else if (team2SelectJQ.val() !== "") {
                team2SelectJQ.val("").trigger('change.select2'); // Сброс на "-"
            }
        }
        
        // Обновляем отображение команды (логотипы над селектом и текст кнопок) 
        // ПОСЛЕ установки значений селектов и триггера 'change'
        if (typeof updateTeamDisplay === 'function') {
            updateTeamDisplay(matchIndex);
        }
        
        // Префикс для карт
        let prefix = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
        else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

        // Обновление карт
        const mapRows = matchColumn.querySelectorAll(".map-row");
        mapRows.forEach((row, i) => {
            const mapKey = prefix + `MAP${i + 1}`;
            const scoreKey = prefix + `MAP${i + 1}_SCORE`;
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
        });

        // Обновление победителя (атрибута data-winner) на основе данных с сервера
        let serverWinnerTeamKey = "";
        const currentTeam1NameVal = team1SelectJQ.length ? team1SelectJQ.val() : ""; // Получаем актуальное имя из селекта
        const currentTeam2NameVal = team2SelectJQ.length ? team2SelectJQ.val() : ""; // Получаем актуальное имя из селекта
        
        // Победитель из серверных данных устанавливается только если матч FINISHED и есть TEAMWINNER
        if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
            if (currentTeam1NameVal && match.TEAMWINNER === currentTeam1NameVal) serverWinnerTeamKey = "TEAM1";
            else if (currentTeam2NameVal && match.TEAMWINNER === currentTeam2NameVal) serverWinnerTeamKey = "TEAM2";
        }
        
        // Устанавливаем или удаляем атрибут data-winner
        // Это важно, так как refreshWinnerHighlight будет его использовать
        if (serverWinnerTeamKey) {
            matchColumn.setAttribute("data-winner", serverWinnerTeamKey);
        } else {
            // Если сервер не указал победителя для FINISHED матча, или матч не FINISHED,
            // мы не хотим сбрасывать data-winner, если он был установлен пользователем вручную.
            // Поэтому, если serverWinnerTeamKey пуст, мы НЕ удаляем data-winner.
            // Его будет контролировать attachWinnerButtons при клике.
            // Однако, если матч UPCOM или LIVE и сервер не шлет TEAMWINNER, то data-winner должен быть пуст.
            // Текущая логика refreshWinnerHighlight корректно обработает data-winner="" или отсутствующий data-winner.
            // Если матч ТОЛЬКО ЧТО стал FINISHED и сервер прислал победителя, data-winner обновится.
            // Если матч был FINISHED, но сервер перестал слать победителя, data-winner тоже сбросится.
            if (match.FINISHED_MATCH_STATUS !== "FINISHED" && !matchColumn.getAttribute("data-winner")) {
                 matchColumn.removeAttribute("data-winner");
            } else if (match.FINISHED_MATCH_STATUS === "FINISHED" && !match.TEAMWINNER) {
                 matchColumn.removeAttribute("data-winner"); // Если матч закончен, но победителя нет, сбрасываем
            }
        }

        // Обновление подсветки победителя на основе актуального data-winner
        if (typeof refreshWinnerHighlight === 'function') {
            refreshWinnerHighlight(matchIndex);
        }
    });

    // Обновляем связанные элементы после всех матчей
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }
    // console.log("[UI] All matches UI update finished.");
}

/**
 * Обновляет интерфейс Map Veto.
 */
function updateMapVetoUI(mapVetoData) {
    console.log("[UI] Attempting to update Map Veto UI. Data:", mapVetoData);
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
                const actionValueFromData = vetoItem.action || 'BAN'; // По умолчанию BAN
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
                const teamValueFromData = vetoItem.team || 'TEAM1'; // По умолчанию TEAM1
                if (teamSelect.value !== teamValueFromData) {
                    teamSelect.value = teamValueFromData;
                }
                teamSelect.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
                if (teamValueFromData === 'TEAM1') teamSelect.classList.add('team-1-selected-veto');
                if (teamValueFromData === 'TEAM2') teamSelect.classList.add('team-2-selected-veto');
            }

            if (sideSelect) {
                const sideValueFromData = vetoItem.side || '-'; // По умолчанию "-"
                if (sideSelect.value !== sideValueFromData) {
                    sideSelect.value = sideValueFromData;
                }
                updateSideSelectStyle(sideSelect);
            }
        } else {
            console.warn(`[UI] Row ${rowIndex} in Map Veto table not found.`);
        }
    });

    if (matchSelectElement?.value && typeof mapVetoData.matchIndex !== 'undefined' && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }
    console.log("[UI] Map Veto UI update finished for match", mapVetoData.matchIndex);
}

/**
 * Обновляет интерфейс VRS-блоков.
 */
function updateVRSUI(rawVrsData) {
    console.log("[UI] Attempting to update VRS UI. Data:", rawVrsData);
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
    console.log("[UI] VRS UI update finished.");
}

/** Вспомогательная функция для обновления одного поля ввода VRS. */
function updateVRSInputField(elementId, value) {
    const element = document.getElementById(elementId);
    const valueToSet = (value === null || typeof value === 'undefined') ? '' : String(value);
    if (element && element.value !== valueToSet) {
        element.value = valueToSet;
    }
}

/** Вспомогательная функция для очистки полей VRS для одного матча. */
function clearVRSFieldsForMatch(matchIndex) {
    // console.log(`[UI] Clearing VRS fields for Match ${matchIndex}`);
    const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
    fields.forEach(field => {
        updateVRSInputField(`team1${field}${matchIndex}`, '');
        updateVRSInputField(`team2${field}${matchIndex}`, '');
    });
}

/**
 * Обновляет интерфейс кастомных полей (в хедере).
 */
function updateCustomFieldsUI(fields) {
    // console.log("[UI] Attempting to update custom fields UI. Data:", fields);
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
    // console.log("[UI] Custom fields UI update finished.");
}

// --- Функции загрузки данных с сервера при инициализации страницы ---

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
        updateMapVetoUI(mapVetoData);
        if (mapVetoData && typeof mapVetoData.matchIndex !== 'undefined') {
            const matchSelectElement = document.getElementById("matchSelect");
            if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
                updateVetoTeamOptions(matchSelectElement.value);
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
        // console.log("[Data] Custom fields data loaded successfully:", dataArray);
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
        const today = new Date(); // Текущая дата для расчета
        // const today = new Date("2025-05-09"); // Для теста - конкретная дата

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
            // Удаляем только текстовые узлы, оставляем иконку
            Array.from(button.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            button.appendChild(document.createTextNode(` ${text}`)); // Добавляем текст после иконки
        } else {
            button.textContent = text; // Если иконки нет, просто ставим текст
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
                if (button.classList.contains('saved')) { // Проверяем, не изменилось ли состояние за время таймаута
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
        const matchData = gatherSingleMatchData(matchIndex); // Эта функция теперь корректно собирает победителя из data-winner
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

    // Навешиваем обработчики на кнопки сохранения матчей
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

    // Обработчик кнопки сохранения Map Veto
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

    // Обработчик кнопки сохранения хедера
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

    // Обработчик кнопки сохранения паузы
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

    // Слушатель изменения матча в Map Veto
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement) {
        matchSelectElement.addEventListener('change', () => {
            if (typeof updateVetoTeamOptions === 'function') {
                updateVetoTeamOptions(matchSelectElement.value);
            }
        });
    }

    // Слушатели для селектов команд УДАЛЕНЫ из main.js, так как они теперь обрабатываются
    // через attachSelect2ChangeListeners в matches.js.
    // Слушатели для кнопок победителя матчей теперь также в matches.js (attachWinnerButtons).
    // Слушатели для селектов статуса матчей теперь также в matches.js (attachStatusChangeHandlers).

    // Слушатели для таблицы Map Veto (остаются как есть, т.к. специфичны для этого блока)
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

    console.log("[Init] All button and select listeners (main context) attached.");
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

    // Устанавливаем активную вкладку по умолчанию, если ни одна не активна
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
            // console.log(`[Tabs] Switched to tab: ${targetTabId}`);
        } else {
            console.warn(`[Tabs] Tab panel with id "${targetTabId}" not found.`);
        }
    });
    console.log("[Init] Tabs initialized successfully.");
}

// --- Инициализация после полной загрузки DOM ---

window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded: Starting application initialization...");
    try {
        await initPromise; // Ждем инициализации команд (включая Select2 и слушатели кнопок победителя)
        console.log("DOMContentLoaded: Core module (matches/teams) initialized.");

        // Загружаем все остальные данные параллельно
        await Promise.all([
            loadMatchesFromServer(),
            loadRawVRSData(),
            loadCustomFieldsFromServer(),
            loadMapVetoFromServer(),
            loadPauseDataFromServer(),
            // Загрузка данных для кастеров (если она не происходит внутри initCasters или по сокетам)
            // Пример:
            // typeof window.loadCasters === 'function' ? window.loadCasters() : Promise.resolve(),
            // typeof window.loadSelectedCasters === 'function' ? window.loadSelectedCasters() : Promise.resolve()
        ]);
        console.log("DOMContentLoaded: All initial data loaded from server.");

        // Настраиваем слушатели и табы
        setupListeners(); // Слушатели для кнопок сохранения и элементов MapVeto, не связанных с матчами напрямую
        initTabs();

        // Первичная настройка UI после загрузки данных
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }
        
        // Применяем стили к элементам Veto (цвет BAN/PICK/DECIDER, цвет CT/T, цвет команды)
        // Это нужно сделать после загрузки данных, чтобы селекты уже имели значения
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
         document.querySelectorAll('#vetoTable .veto-side').forEach(sideSelect => {
            updateSideSelectStyle(sideSelect);
        });

        // Обновляем день турнира
        updateTournamentDay();

        console.log("DOMContentLoaded: Full application initialization complete. UI is ready.");
    } catch (error) {
        console.error("DOMContentLoaded: Critical error during initialization:", error);
        document.body.innerHTML = `<div style="color:red; background: #111; border: 1px solid red; padding: 20px; font-family: sans-serif; font-size: 16px;">Критическая ошибка при инициализации приложения: ${error.message}. Подробности смотрите в консоли разработчика (F12).</div>`;
    }
});