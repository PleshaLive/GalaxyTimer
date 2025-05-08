// public/js/main.js

// Импорт необходимых модулей и функций
// Заменяем updateWinnerButtonLabels на updateTeamDisplay
import { initMatches, gatherSingleMatchData, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor, updateTeamDisplay, choicesInstances } from "./matches.js"; // Добавили choicesInstances для доступа
import { initMapVeto, gatherMapVetoData, updateVetoTeamOptions, styleVetoActionSelect } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";
import { initCasters, updateCastersUIFromSocket, updateSelectedCastersUIFromSocket } from "./casters.js"; // Убрали неиспользуемые импорты

// Инициализация Socket.IO клиента
const socket = io();
console.log("[Init] Socket.IO client initialized.");

// Промис для отслеживания инициализации данных команд
const initPromise = initMatches();
initMapVeto();
initVRS();
initCasters();

// --- Обработчики событий Socket.IO ---
// ... (обработчики jsonUpdate, mapVetoUpdate, vrsUpdate, customFieldsUpdate, pauseUpdate, castersUpdate, selectedCastersUpdate - без изменений) ...
socket.on("jsonUpdate", async (matches) => {
    console.log("[SOCKET] Received 'jsonUpdate' with data:", matches);
    try {
        await initPromise; // Гарантируем, что команды и Choices.js инициализированы
        updateMatchesUI(matches); // Обновляем интерфейс матчей
    } catch (error) {
        console.error("[SOCKET] Error updating matches UI after 'jsonUpdate':", error);
    }
    const jsonOutput = document.getElementById("jsonOutput");
    if (jsonOutput) {
        jsonOutput.textContent = JSON.stringify(matches, null, 2);
    }
});

// ... (остальные обработчики сокетов без изменений) ...

// --- Функция стилизации селекта выбора стороны в Map Veto (без изменений) ---
function updateSideSelectStyle(selectElement) { /* ... */ }

// --- Функции обновления UI ---

/**
 * Обновляет весь интерфейс матчей на основе полученных данных.
 * Использует Choices.js API для установки значений селектов команд.
 */
function updateMatchesUI(matches) {
    console.log("[UI] Attempting to update matches UI (with Choices.js). Data:", matches);
    if (!Array.isArray(matches)) {
        console.warn("[UI] updateMatchesUI received non-array data:", matches);
        return;
    }

    matches.forEach((match, index) => {
        const matchIndex = index + 1;
        const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
        if (!matchColumn) { /* ... */ return; }
        // console.log(`[UI] Updating Match ${matchIndex}...`); // Можно раскомментировать для детальной отладки

        // Обновление времени (без изменений)
        const timeInput = document.getElementById(`timeInput${matchIndex}`);
        if (timeInput) { /* ... */ }

        // Обновление статуса (без изменений)
        const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
        if (statusSelect) { /* ... */ }

        // Обновление Команд с использованием Choices.js API
        const team1SelectId = `team1Select${matchIndex}`;
        const team2SelectId = `team2Select${matchIndex}`;
        const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || ""; // "" если не задано
        const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || ""; // "" если не задано

        const choiceInstance1 = choicesInstances[team1SelectId];
        if (choiceInstance1) {
            const currentValue1 = choiceInstance1.getValue(true);
            // Устанавливаем значение, только если оно отличается и существует в списке опций
            // (setValue сам обработает отсутствие значения, но можно добавить проверку для надежности)
            if (currentValue1 !== team1Name) {
                 // console.log(`[UI Update ${matchIndex}] Setting Team 1: ${team1Name}`);
                 // Передаем массив с одним значением и делаем это "тихо" (true), чтобы не вызвать событие change повторно
                 choiceInstance1.setValue([team1Name], true); 
            }
        } else { // Fallback, если Choices.js не инициализирован
             const sel = document.getElementById(team1SelectId);
             if(sel && sel.value !== team1Name) sel.value = team1Name;
        }

        const choiceInstance2 = choicesInstances[team2SelectId];
        if (choiceInstance2) {
            const currentValue2 = choiceInstance2.getValue(true);
            if (currentValue2 !== team2Name) {
                 // console.log(`[UI Update ${matchIndex}] Setting Team 2: ${team2Name}`);
                 choiceInstance2.setValue([team2Name], true); 
            }
        } else {
             const sel = document.getElementById(team2SelectId);
             if(sel && sel.value !== team2Name) sel.value = team2Name;
        }

        // Обновляем статический логотип и текст кнопки ПОСЛЕ установки значений селектов
        if (typeof updateTeamDisplay === 'function') {
            updateTeamDisplay(matchIndex);
        }

        // Обновление карт (без изменений)
        let prefix = ""; /* ... */
        const mapRows = matchColumn.querySelectorAll(".map-row");
        mapRows.forEach((row, i) => { /* ... */ });

        // Обновление победителя (без изменений)
        let winnerTeamKey = ""; /* ... */
        if (winnerTeamKey) matchColumn.setAttribute("data-winner", winnerTeamKey);
        else matchColumn.removeAttribute("data-winner");

        // Обновление подсветки победителя (без изменений)
        if (typeof refreshWinnerHighlight === 'function') refreshWinnerHighlight(matchIndex);
    });

    // Обновляем зависимые элементы (без изменений)
    if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
    const matchSelectElement = document.getElementById("matchSelect");
    if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
        updateVetoTeamOptions(matchSelectElement.value);
    }
    console.log("[UI] All matches UI update finished (with Choices.js).");
}

// ... (остальные функции update: updateMapVetoUI, updateVRSUI, updateCustomFieldsUI - без изменений) ...
// ... (функции загрузки данных: loadMatchesFromServer и т.д. - без изменений) ...
// ... (функции для дат турнира - без изменений) ...
// ... (функции сбора данных: gather*, setButtonState - без изменений) ...
// ... (функции сохранения данных: save* - без изменений) ...
// ... (функция setupListeners - без изменений, т.к. слушатели для select команд теперь в matches.js) ...
// ... (функция initTabs - без изменений) ...

// --- Инициализация после полной загрузки DOM ---
window.addEventListener("DOMContentLoaded", async () => {
    console.log("DOMContentLoaded: Starting application initialization...");
    try {
        // Дожидаемся инициализации Matches (включая Choices.js)
        await initPromise; 
        console.log("DOMContentLoaded: Core module (matches/teams with Choices.js) initialized.");

        // Загружаем остальные данные
        await Promise.all([
            loadMatchesFromServer(), // Загрузит данные и вызовет updateMatchesUI, который установит значения в Choices.js
            loadRawVRSData(),
            loadCustomFieldsFromServer(),
            loadMapVetoFromServer(),
            loadPauseDataFromServer()
        ]);
        console.log("DOMContentLoaded: All initial data loaded from server.");

        setupListeners(); // Настраиваем слушатели для кнопок и ДРУГИХ селектов (кроме team-select)
        initTabs();

        // Первоначальная стилизация Veto (без изменений)
        const matchSelectElement = document.getElementById("matchSelect");
        if (matchSelectElement?.value && typeof updateVetoTeamOptions === 'function') {
             updateVetoTeamOptions(matchSelectElement.value);
        }
        document.querySelectorAll('#vetoTable .veto-action').forEach(actionSelect => { /* ... */ });
        document.querySelectorAll('#vetoTable .veto-team').forEach(teamSelect => { /* ... */ });
        updateTournamentDay();

        console.log("DOMContentLoaded: Full application initialization complete. UI is ready.");
    } catch (error) {
        console.error("DOMContentLoaded: Critical error during initialization:", error);
        document.body.innerHTML = `<div style="color:red; padding: 20px;">Критическая ошибка при инициализации приложения: ${error.message}</div>`;
    }
});