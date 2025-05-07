// public/js/main.js

// Импорт необходимых модулей и функций
import { initMatches, gatherSingleMatchData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js";
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions, styleVetoActionSelect } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

// Инициализация Socket.IO клиента
const socket = io();
console.log("[Init] Socket.IO client initialized.");

// Промис для отслеживания инициализации данных команд (важно для селектов)
const initPromise = initMatches(); // Запускает загрузку списка команд и заполнение селектов
initMapVeto(); // Инициализация элементов управления и логики для Map Veto
initVRS();     // Инициализация элементов управления и логики для VRS блоков

// --- Обработчики событий Socket.IO ---

// Получение полного обновления данных по всем матчам
socket.on("jsonUpdate", async (matches) => {
    console.log("[SOCKET] Received 'jsonUpdate' with data:", matches);
    try {
        await initPromise; // Гарантируем, что команды загружены перед обновлением UI
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
    updateMapVetoUI(updatedMapVeto); // Обновляем интерфейс Map Veto
    // Если в данных есть информация о матче, обновляем опции команд для него
    if (updatedMapVeto && typeof updatedMapVeto.matchIndex !== 'undefined') {
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement && typeof updateVetoTeamOptions === 'function') {
            // Обновляем опции команд (Team1/Team2) в селектах таблицы Veto
            // в соответствии с командами, выбранными для данного матча в разделе "Матчи"
            updateVetoTeamOptions(matchSelectElement.value);
        }
    }
});

// Получение обновления "сырых" данных для VRS (Valve Anti-Cheat Rating System)
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
        updateCustomFieldsUI({}); // В случае невалидных данных, обновляем UI пустым объектом (очистка полей)
    }
});

// Получение обновления данных о паузе в матче
socket.on("pauseUpdate", (pauseData) => {
    console.log("[SOCKET] Received 'pauseUpdate' (main.js) with data:", pauseData);
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');

    if (pauseData) { // Если данные о паузе пришли
        if (msgInput && msgInput.value !== (pauseData.pause || "")) {
            msgInput.value = pauseData.pause || ""; // Устанавливаем сообщение паузы
        }
        if (timeInput && timeInput.value !== (pauseData.lastUpd || "")) {
            timeInput.value = pauseData.lastUpd || ""; // Устанавливаем время последнего обновления
        }
    } else { // Если данные о паузе не пришли (например, пауза снята)
        if (msgInput) msgInput.value = ""; // Очищаем поле сообщения
        if (timeInput) timeInput.value = ""; // Очищаем поле времени
    }
});

// --- Функции обновления UI ---

/**
 * Обновляет весь интерфейс матчей на основе полученных данных.
 * @param {Array<Object>} matches - Массив объектов с данными по каждому матчу.
 */
function updateMatchesUI(matches) {
    console.log("[UI] Attempting to update matches UI. Data:", matches);
    if (!Array.isArray(matches)) {
        console.warn("[UI] updateMatchesUI received non-array data:", matches);
        return;
    }

    matches.forEach((match, index) => {
        const matchIndex = index + 1; // Индекс матча (1-4)
        const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);

        if (!matchColumn) {
            console.warn(`[UI] Match column ${matchIndex} not found for UI update.`);
            return; // Пропускаем обновление, если колонка матча не найдена
        }
        console.log(`[UI] Updating Match ${matchIndex}...`);

        // Обновление времени матча
        const timeInput = document.getElementById(`timeInput${matchIndex}`);
        if (timeInput) {
            let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
            timeValue = timeValue.replace(/ CEST$/i, '').trim(); // Удаляем " CEST", если есть
            if (timeInput.value !== timeValue) timeInput.value = timeValue;
        }

        // Обновление статуса матча (UPCOM, LIVE, FINISHED)
        const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
        if (statusSelect) {
            let newStatus = "";
            if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
            else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
            else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

            if (newStatus && statusSelect.value !== newStatus) {
                statusSelect.value = newStatus;
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect); // Обновляем цвет селекта статуса
                // Обновляем классы для стилизации всей колонки матча
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
            } else if (!newStatus && statusSelect.value !== "" && statusSelect.options.length > 0 && statusSelect.value !== statusSelect.options[0].value) {
                // Если статус не определен, сбрасываем на первую опцию (обычно "UPCOM")
                statusSelect.value = statusSelect.options[0].value;
                if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (statusSelect.options[0].value) {
                     matchColumn.classList.add(`status-${statusSelect.options[0].value.toLowerCase()}`);
                }
            }
        }

        // Обновление селекта для Команды 1
        const team1Select = document.getElementById(`team1Select${matchIndex}`);
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
        if (team1Select) {
            const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
            if (team1Name && optionExists) { // Если имя команды есть и такая опция существует
                if (team1Select.value !== team1Name) team1Select.value = team1Name;
            } else if (team1Select.value !== "" && team1Select.options.length > 0) { // Иначе сбрасываем на первую (пустую) опцию
                team1Select.value = team1Select.options[0].value; // Обычно это <option value="">- Выбрать -</option>
            }
        }

        // Обновление селекта для Команды 2
        const team2Select = document.getElementById(`team2Select${matchIndex}`);
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
        if (team2Select) {
            const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
            if (team2Name && optionExists) {
                if (team2Select.value !== team2Name) team2Select.value = team2Name;
            } else if (team2Select.value !== "" && team2Select.options.length > 0) {
                team2Select.value = team2Select.options[0].value;
            }
        }
        
        // Определение префикса для ключей данных карт в зависимости от статуса матча
        let prefix = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
        else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

        // Обновление информации по картам (название и счет)
        const mapRows = matchColumn.querySelectorAll(".map-row");
        mapRows.forEach((row, i) => {
            const mapKey = prefix + `MAP${i + 1}`; // e.g., LIVE_MAP1
            const scoreKey = prefix + `MAP${i + 1}_SCORE`; // e.g., LIVE_MAP1_SCORE
            const mapSelect = row.querySelector(".map-name-select");
            const scoreInput = row.querySelector(".map-score-input");
            const mapValue = match[mapKey]; // Название карты из данных

            if (mapSelect) {
                if (typeof mapValue !== 'undefined' && mapValue !== null) {
                    const optionExists = mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`);
                    if (mapValue && optionExists) { // Если карта указана и такая опция есть
                        if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
                    } else if (mapSelect.options.length > 0) { // Если опции нет, но есть другие - ставим первую (дефолтную)
                         if (mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value; // Обычно <option value="">- Карта -</option>
                    }
                } else if (mapSelect.options.length > 0) { // Если mapValue не определено или null, ставим дефолтную
                     if (mapSelect.value !== mapSelect.options[0].value) mapSelect.value = mapSelect.options[0].value;
                }
            }


            const scoreValue = match[scoreKey]; // Счет на карте из данных
            if (scoreInput) {
                 if (typeof scoreValue !== 'undefined' && scoreValue !== null) {
                    if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
                } else {
                    if (scoreInput.value !== "") scoreInput.value = ""; // Очищаем, если данных нет
                }
            }
        });

        // Обновление информации о победителе матча
        let winnerTeamKey = ""; // "TEAM1" или "TEAM2"
        const currentTeam1NameVal = team1Select ? team1Select.value : "";
        const currentTeam2NameVal = team2Select ? team2Select.value : "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
            if (currentTeam1NameVal && match.TEAMWINNER === currentTeam1NameVal) winnerTeamKey = "TEAM1";
            else if (currentTeam2NameVal && match.TEAMWINNER === currentTeam2NameVal) winnerTeamKey = "TEAM2";
        }
        // Установка data-атрибута для стилизации победителя
        if (winnerTeamKey) matchColumn.setAttribute("data-winner", winnerTeamKey);
        else matchColumn.removeAttribute("data-winner");

        // Обновление текста на кнопках выбора победителя и их визуального состояния
        if (typeof updateWinnerButtonLabels === 'function') updateWinnerButtonLabels(matchIndex);
        if (typeof refreshWinnerHighlight === 'function') refreshWinnerHighlight(matchIndex);
    });

    // После обновления всех матчей, обновляем имена команд в VRS блоках и опции команд для Map Veto
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value); // Обновляем селекты команд в Map Veto
    }
    console.log("[UI] All matches UI update finished.");
}

/**
 * Обновляет интерфейс Map Veto.
 * @param {Object} mapVetoData - Данные по Map Veto.
 */
function updateMapVetoUI(mapVetoData) {
    console.log("[UI] Attempting to update Map Veto UI. Data:", mapVetoData);
    if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
        console.warn("[UI] Invalid or empty data received for updateMapVetoUI:", mapVetoData);
        // Здесь можно добавить логику очистки таблицы Map Veto, если данные некорректны
        // clearMapVetoTable(); // Пример вызова функции очистки
        return;
    }
    const matchSelectElement = document.getElementById("matchSelect");

    // Устанавливаем выбранный матч в селекте Map Veto, если он пришел в данных
    if (matchSelectElement && typeof mapVetoData.matchIndex !== 'undefined' && matchSelectElement.value != mapVetoData.matchIndex) {
        matchSelectElement.value = mapVetoData.matchIndex;
    }

    // Обновляем каждую строку в таблице Map Veto
    mapVetoData.veto.forEach((vetoItem, idx) => {
        const rowIndex = idx + 1; // Индекс строки (1-7)
        const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
        if (row) {
            const actionSelect = row.querySelector(".veto-action");
            const mapSelectInRow = row.querySelector(".veto-map");
            const teamSelect = row.querySelector(".veto-team");
            const sideSelect = row.querySelector(".veto-side");

            // Обновление действия (BAN/PICK/DECIDER)
            if (actionSelect) {
                const actionValueFromData = vetoItem.action || 'BAN'; // По умолчанию 'BAN'
                if (actionSelect.value !== actionValueFromData) {
                    actionSelect.value = actionValueFromData;
                }
                if (typeof styleVetoActionSelect === 'function') {
                    styleVetoActionSelect(actionSelect); // Применяем стили к селекту (например, цвет фона)
                }
            }

            // Обновление выбранной карты
            if (mapSelectInRow) {
                 const mapValueFromData = vetoItem.map || (mapSelectInRow.options.length > 0 ? mapSelectInRow.options[0].value : ""); // По умолчанию первая опция
                if (mapSelectInRow.value !== mapValueFromData) {
                     mapSelectInRow.value = mapValueFromData;
                }
            }
            
            // Обновление команды, совершившей действие
            if (teamSelect) {
                const teamValueFromData = vetoItem.team || 'TEAM1'; // По умолчанию 'TEAM1'
                if (teamSelect.value !== teamValueFromData) {
                    teamSelect.value = teamValueFromData;
                }
                // Дополнительная стилизация для выделения выбранной команды
                teamSelect.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
                if (teamValueFromData === 'TEAM1') teamSelect.classList.add('team-1-selected-veto');
                if (teamValueFromData === 'TEAM2') teamSelect.classList.add('team-2-selected-veto');
            }

            // Обновление выбранной стороны (CT/T)
            if (sideSelect) {
                const sideValueFromData = vetoItem.side || '-'; // По умолчанию '-'
                if (sideSelect.value !== sideValueFromData) {
                    sideSelect.value = sideValueFromData;
                }
            }
        } else {
            console.warn(`[UI] Row ${rowIndex} in Map Veto table not found.`);
        }
    });
    
    // После обновления таблицы, если выбран матч, обновляем опции команд
    if (matchSelectElement?.value && typeof mapVetoData.matchIndex !== 'undefined' && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }
    console.log("[UI] Map Veto UI update finished for match", mapVetoData.matchIndex);
}

/**
 * Обновляет интерфейс VRS-блоков.
 * @param {Object} rawVrsData - "Сырые" данные VRS по всем матчам.
 */
function updateVRSUI(rawVrsData) {
    console.log("[UI] Attempting to update VRS UI. Data:", rawVrsData);
    if (!rawVrsData || typeof rawVrsData !== 'object') {
        console.warn("[UI] Invalid or empty data received for updateVRSUI. Clearing VRS fields.");
        // Очищаем все поля VRS, если данные некорректны или отсутствуют
        for (let i = 1; i <= 4; i++) clearVRSFieldsForMatch(i);
        if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames(); // Обновляем названия команд (могут стать "Команда 1 / 2")
        return;
    }
    
    for (let i = 1; i <= 4; i++) { // Для каждого из 4-х матчей
        const matchVrs = rawVrsData[i]; // Данные VRS для текущего матча
        if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) { // Если есть данные для обеих команд
            // Обновляем поля для TEAM1
            updateVRSInputField(`team1WinPoints${i}`, matchVrs.TEAM1.winPoints);
            updateVRSInputField(`team1LosePoints${i}`, matchVrs.TEAM1.losePoints);
            updateVRSInputField(`team1Rank${i}`, matchVrs.TEAM1.rank);
            updateVRSInputField(`team1CurrentPoints${i}`, matchVrs.TEAM1.currentPoints);

            // Обновляем поля для TEAM2
            updateVRSInputField(`team2WinPoints${i}`, matchVrs.TEAM2.winPoints);
            updateVRSInputField(`team2LosePoints${i}`, matchVrs.TEAM2.losePoints);
            updateVRSInputField(`team2Rank${i}`, matchVrs.TEAM2.rank);
            updateVRSInputField(`team2CurrentPoints${i}`, matchVrs.TEAM2.currentPoints);
        } else {
            // Если данных для матча нет, очищаем его поля VRS
            clearVRSFieldsForMatch(i);
        }
    }
    // Обновляем имена команд в заголовках таблиц VRS (например, "Team A" вместо "Команда 1")
    if (typeof updateVRSTeamNames === 'function') {
        updateVRSTeamNames();
    }
    console.log("[UI] VRS UI update finished.");
}

/** Вспомогательная функция для обновления одного поля ввода VRS. */
function updateVRSInputField(elementId, value) {
    const element = document.getElementById(elementId);
    const valueToSet = value ?? ''; // Если value undefined или null, ставим пустую строку
    if (element && element.value !== valueToSet) {
        element.value = valueToSet;
    }
}

/** Вспомогательная функция для очистки полей VRS для одного матча. */
function clearVRSFieldsForMatch(matchIndex) {
    console.log(`[UI] Clearing VRS fields for Match ${matchIndex}`);
    const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
    fields.forEach(field => {
        updateVRSInputField(`team1${field}${matchIndex}`, '');
        updateVRSInputField(`team2${field}${matchIndex}`, '');
    });
}

/**
 * Обновляет интерфейс кастомных полей (в хедере).
 * @param {Object} fields - Объект с кастомными полями.
 */
function updateCustomFieldsUI(fields) {
    console.log("[UI] Attempting to update custom fields UI. Data:", fields);
    if (!fields || typeof fields !== 'object') {
        console.warn("[UI] Invalid data for updateCustomFieldsUI. Clearing fields.", fields);
        // Очищаем поля, если данные некорректны
        document.getElementById("upcomingMatchesInput").value = "";
        document.getElementById("galaxyBattleInput").value = "";
        document.getElementById("tournamentStart").value = "";
        document.getElementById("tournamentEnd").value = "";
        document.getElementById("groupStageInput").value = "";
        updateTournamentDay(); // Обновляем отображение дня турнира
        return;
    }
    
    // Обновляем каждое поле, если оно существует
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
    
    updateTournamentDay(); // Пересчитываем и обновляем день турнира после изменения дат
    console.log("[UI] Custom fields UI update finished.");
}

// --- Функции загрузки данных с сервера при инициализации страницы ---

async function loadMatchesFromServer() {
    console.log("[Data] Initiating load of matches data from server...");
    try {
        const response = await fetch("/api/matchdata");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const matches = await response.json();
        console.log("[Data] Matches data loaded successfully:", matches);
        await initPromise; // Убеждаемся, что основная инициализация (команды) завершена
        updateMatchesUI(matches); // Обновляем UI с полученными данными
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
        // Если в данных есть информация о матче, обновляем опции команд
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
        const dataArray = await response.json(); // Ожидаем массив
        console.log("[Data] Custom fields data loaded successfully:", dataArray);
        // Обычно кастомные поля хранятся как один объект в массиве
        if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
            updateCustomFieldsUI(dataArray[0]);
        } else {
            console.warn("[Data] Custom fields data is empty or not in expected format. Using empty object.");
            updateCustomFieldsUI({}); // Если данных нет, используем пустой объект
        }
    } catch (err) {
        console.error("[Data] Error loading custom fields:", err);
        updateCustomFieldsUI({}); // В случае ошибки, используем пустой объект
    }
}

async function loadPauseDataFromServer() {
    console.log("[Data] Initiating load of pause data...");
    try {
        const response = await fetch("/api/pause");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const dataArray = await response.json(); // Ожидаем массив
        console.log("[Data] Pause data loaded successfully:", dataArray);
        // Данные паузы также могут быть в массиве
        const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {};
        const msgInput = document.getElementById('pauseMessageInput');
        const timeInput = document.getElementById('pauseTimeInput');
        if (msgInput) msgInput.value = pauseData.pause || "";
        if (timeInput) timeInput.value = pauseData.lastUpd || "";
    } catch (err) {
        console.error("[Data] Error loading pause data:", err);
        // В случае ошибки, очищаем поля
        const msgInput = document.getElementById('pauseMessageInput');
        const timeInput = document.getElementById('pauseTimeInput');
        if (msgInput) msgInput.value = "";
        if (timeInput) timeInput.value = "";
    }
}

// --- Функции для работы с датами турнира ---

/**
 * Рассчитывает и отображает текущий день турнира.
 */
function calculateTournamentDay() {
    const startDateInput = document.getElementById("tournamentStart")?.value;
    const endDateInput = document.getElementById("tournamentEnd")?.value;
    const displaySpan = document.getElementById("tournamentDayDisplay");

    if (!displaySpan) return; // Если элемента для отображения нет, выходим

    if (!startDateInput) { // Если дата начала не указана
        displaySpan.textContent = 'Укажите дату начала';
        displaySpan.style.color = 'var(--color-text-muted)';
        return;
    }

    try {
        const start = new Date(startDateInput);
        const end = endDateInput ? new Date(endDateInput) : null;
        const today = new Date();

        // Нормализуем даты (сбрасываем время) для корректного сравнения дней
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
            const diffTime = today - start; // Разница в миллисекундах
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1, так как первый день это "День 1"
            displaySpan.textContent = `День ${diffDays}`;
            displaySpan.style.color = 'var(--color-secondary-light)'; // Цвет для активного турнира
        }
    } catch (e) {
        console.error("Ошибка при расчете дня турнира:", e);
        displaySpan.textContent = 'Ошибка даты';
        displaySpan.style.color = 'var(--color-error)';
    }
}

/**
 * Обновляет отображение дня турнира (обычно вызывается при изменении дат).
 */
function updateTournamentDay() {
    calculateTournamentDay();
}

// Добавляем слушатели на изменение дат для автоматического обновления дня турнира
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// --- Функции сбора данных с полей ввода ---

/**
 * Собирает данные из кастомных полей (хедер).
 * @returns {Object} Объект с данными.
 */
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

/**
 * Собирает данные из полей управления паузой.
 * @returns {Object} Объект с данными паузы.
 */
function gatherPauseData() {
    const message = document.getElementById("pauseMessageInput")?.value ?? "";
    const time = document.getElementById("pauseTimeInput")?.value ?? "";
    return { pause: message, lastUpd: time };
}

// --- Управление состоянием кнопок сохранения ---

/**
 * Устанавливает состояние кнопки (например, "Сохранение...", "Сохранено!", "Ошибка!").
 * @param {HTMLElement} button - Элемент кнопки.
 * @param {'saving'|'saved'|'error'|'idle'} state - Новое состояние.
 * @param {string|null} message - Сообщение для отображения на кнопке (опционально).
 */
function setButtonState(button, state, message = null) {
    if (!button) return;

    // Сохраняем исходный текст кнопки, если он еще не сохранен
    const originalText = button.dataset.originalText || button.querySelector('i')?.nextSibling.textContent.trim() || button.textContent.trim() || 'SAVE';
    if (!button.dataset.originalText) button.dataset.originalText = originalText;
    
    const icon = button.querySelector('i');
    const originalIconClass = icon ? (button.dataset.originalIconClass || icon.className) : null;
    if (icon && !button.dataset.originalIconClass) button.dataset.originalIconClass = originalIconClass;


    button.disabled = (state === 'saving');
    button.classList.remove('saving', 'saved', 'error', 'idle');
    button.style.cursor = (state === 'saving') ? 'wait' : 'pointer';

    // Обновляем иконку и текст
    const setTextAndIcon = (text, iconClass) => {
        if (icon && iconClass) {
            icon.className = iconClass;
            button.childNodes.forEach(node => { // Удаляем старый текст, если он есть
                if (node.nodeType === Node.TEXT_NODE) node.remove();
            });
            button.appendChild(document.createTextNode(` ${text}`)); // Добавляем новый текст после иконки
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
                if (button.classList.contains('saved')) { // Проверяем, что состояние не изменилось
                    setTextAndIcon(originalText, originalIconClass);
                    button.classList.remove('saved');
                    button.classList.add('idle');
                }
            }, 1500); // Возвращаем исходное состояние через 1.5 секунды
            break;
        case 'error':
            setTextAndIcon(message || 'Ошибка!', 'fas fa-times-circle');
            button.classList.add('error');
            setTimeout(() => {
                if (button.classList.contains('error')) {
                    setTextAndIcon(originalText, originalIconClass);
                    button.classList.remove('error');
                    button.classList.add('idle');
                }
            }, 2500); // Возвращаем исходное состояние через 2.5 секунды
            break;
        case 'idle':
        default:
            setTextAndIcon(originalText, originalIconClass);
            button.classList.add('idle');
            break;
    }
}

// --- Функции сохранения данных ---

async function saveMatchData(matchIndex, buttonElement) {
    console.log(`[Save] Initiating save for Match ${matchIndex}...`);
    setButtonState(buttonElement, 'saving');
    try {
        // Собираем данные матча и VRS для этого матча
        const matchData = gatherSingleMatchData(matchIndex);
        if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}.`);
        
        const vrsData = gatherSingleVRSData(matchIndex); // VRS данные привязаны к матчу
        if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}.`);

        // Отправляем данные на сервер
        await saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT');
        await saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT'); // Сохраняем VRS данные для этого матча
        
        setButtonState(buttonElement, 'saved');
        console.log(`[Save] Data for Match ${matchIndex} saved successfully.`);
    } catch (error) {
        console.error(`[Save] Error saving data for Match ${matchIndex}:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    } finally {
        // Если состояние не 'saved' или 'error' (например, если ошибка произошла до установки этих состояний),
        // возвращаем в 'idle'. Это на случай, если промис завершился неожиданно.
        if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
            setButtonState(buttonElement, 'idle');
        }
    }
}

async function saveMapVetoData(buttonElement) {
    console.log(`[Save] Initiating save for Map Veto data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const mapVetoData = gatherMapVetoData(); // Собираем данные со всей таблицы Map Veto
        if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
        
        await saveData('/api/mapveto', mapVetoData, 'POST'); // Отправляем на сервер
        setButtonState(buttonElement, 'saved');
        console.log(`[Save] Map Veto data saved successfully.`);
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
    console.log(`[Save] Initiating save for Header (custom fields) data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const customData = gatherCustomFieldsData(); // Собираем данные из полей хедера
        await saveData('/api/customfields', customData, 'POST'); // Отправляем на сервер
        setButtonState(buttonElement, 'saved');
        console.log(`[Save] Header data saved successfully.`);
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
    console.log(`[Save] Initiating save for Pause data...`);
    setButtonState(buttonElement, 'saving');
    try {
        const pauseData = gatherPauseData(); // Собираем данные из полей паузы
        await saveData('/api/pause', pauseData, 'POST'); // Отправляем на сервер
        setButtonState(buttonElement, 'saved');
        console.log(`[Save] Pause data saved successfully.`);
    } catch (error) {
        console.error(`[Save] Error saving Pause data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'Ошибка сохранения');
    } finally {
        if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
            setButtonState(buttonElement, 'idle');
        }
    }
}

// --- Настройка слушателей событий ---

function setupListeners() {
    console.log("[Init] Setting up event listeners...");

    // Слушатели для кнопок сохранения каждого матча
    document.querySelectorAll('.save-match-button').forEach(button => {
        // Сохраняем исходный текст и иконку кнопки
        if (!button.dataset.originalText) {
            const icon = button.querySelector('i');
            button.dataset.originalText = icon ? icon.nextSibling.textContent.trim() : button.textContent.trim();
            if (icon && !button.dataset.originalIconClass) button.dataset.originalIconClass = icon.className;
        }

        const matchIndex = button.dataset.matchIndex;
        if (matchIndex) {
            button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
        } else {
            console.warn("[Init] Save match button found without 'data-match-index' attribute.");
        }
    });

    // Слушатель для кнопки сохранения Map Veto
    const saveVetoButton = document.getElementById('saveMapVetoButton');
    if (saveVetoButton) {
        if (!saveVetoButton.dataset.originalText) {
             const icon = saveVetoButton.querySelector('i');
             saveVetoButton.dataset.originalText = icon ? icon.nextSibling.textContent.trim() : saveVetoButton.textContent.trim();
             if (icon && !saveVetoButton.dataset.originalIconClass) saveVetoButton.dataset.originalIconClass = icon.className;
        }
        saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
    } else {
        console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found.");
    }

    // Слушатель для кнопки сохранения данных хедера
    const saveHeaderButton = document.getElementById('saveHeaderButton');
    if (saveHeaderButton) {
         if (!saveHeaderButton.dataset.originalText) {
            const icon = saveHeaderButton.querySelector('i');
            saveHeaderButton.dataset.originalText = icon ? icon.nextSibling.textContent.trim() : saveHeaderButton.textContent.trim();
            if (icon && !saveHeaderButton.dataset.originalIconClass) saveHeaderButton.dataset.originalIconClass = icon.className;
        }
        saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
    } else {
        console.warn("[Init] Save Header button (id='saveHeaderButton') not found.");
    }

    // Слушатель для кнопки сохранения данных паузы
    const savePauseButton = document.getElementById('savePauseButton');
    if (savePauseButton) {
        if (!savePauseButton.dataset.originalText) {
            const icon = savePauseButton.querySelector('i');
            savePauseButton.dataset.originalText = icon ? icon.nextSibling.textContent.trim() : savePauseButton.textContent.trim();
            if (icon && !savePauseButton.dataset.originalIconClass) savePauseButton.dataset.originalIconClass = icon.className;
        }
        savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
    } else {
        console.warn("[Init] Save Pause button (id='savePauseButton') not found.");
    }

    // Слушатель на изменение выбранного матча в Map Veto (для обновления опций команд)
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement) {
        matchSelectElement.addEventListener('change', () => {
            if (typeof updateVetoTeamOptions === 'function') {
                updateVetoTeamOptions(matchSelectElement.value);
            }
        });
    }

    // Слушатели на изменение команд в колонках матчей (для обновления опций в Map Veto)
    for (let i = 1; i <= 4; i++) {
        const team1Sel = document.getElementById(`team1Select${i}`);
        const team2Sel = document.getElementById(`team2Select${i}`);
        const listener = () => {
            const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
            // Если измененные команды относятся к матчу, выбранному в Map Veto
            if (currentVetoMatchIndex && currentVetoMatchIndex == i) {
                if (typeof updateVetoTeamOptions === 'function') {
                    updateVetoTeamOptions(String(i));
                }
            }
            // Также обновляем имена команд в VRS блоках при изменении команд в матче
            if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
        };
        if (team1Sel) team1Sel.addEventListener('change', listener);
        if (team2Sel) team2Sel.addEventListener('change', listener);
    }
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

    // Активируем первую вкладку и панель по умолчанию, если ни одна не активна
    const activeTab = document.querySelector('.tabs-nav .tab-link.active');
    if (!activeTab && tabLinks.length > 0) {
        tabLinks[0].classList.add('active');
        const firstPanelId = tabLinks[0].dataset.tab;
        const firstPanel = document.getElementById(firstPanelId);
        if (firstPanel) firstPanel.classList.add('active');
    }

    tabsNav.addEventListener('click', (event) => {
        const clickedTab = event.target.closest('.tab-link');
        if (!clickedTab || clickedTab.classList.contains('active')) return; // Не обрабатываем клик, если это не ссылка или она уже активна

        event.preventDefault(); // Предотвращаем стандартное поведение ссылки

        // Деактивируем все вкладки и панели
        tabLinks.forEach(link => link.classList.remove('active'));
        tabPanels.forEach(panel => panel.classList.remove('active'));

        // Активируем нажатую вкладку и соответствующую панель
        clickedTab.classList.add('active');
        const targetTabId = clickedTab.dataset.tab; // Получаем ID целевой панели из data-атрибута
        const targetPanel = document.getElementById(targetTabId);
        if (targetPanel) {
            targetPanel.classList.add('active');
            console.log(`[Tabs] Switched to tab: ${targetTabId}`);
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
        await initPromise; // Дожидаемся завершения базовой инициализации (например, загрузки команд)
        console.log("DOMContentLoaded: Core modules (teams, etc.) initialized.");

        // Параллельно загружаем все необходимые данные с сервера
        await Promise.all([
            loadMatchesFromServer(),
            loadRawVRSData(),
            loadCustomFieldsFromServer(),
            loadMapVetoFromServer(),
            loadPauseDataFromServer()
        ]);
        console.log("DOMContentLoaded: All initial data loaded from server.");
        
        setupListeners(); // Настраиваем все слушатели событий
        initTabs();       // Инициализируем систему вкладок

        // Первоначальное обновление опций команд в Map Veto (если матч уже выбран)
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
            updateVetoTeamOptions(matchSelectElement.value);
        }

        // Первоначальная стилизация селектов действий в Map Veto
        document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => {
            if (typeof styleVetoActionSelect === 'function') {
                styleVetoActionSelect(actionSelect);
            }
        });
        
        // Первоначальный расчет и отображение дня турнира
        updateTournamentDay();

        console.log("DOMContentLoaded: Full application initialization complete. UI is ready.");
    } catch (error) {
        console.error("DOMContentLoaded: Critical error during initialization:", error);
        // Здесь можно отобразить сообщение об ошибке пользователю
    }
});