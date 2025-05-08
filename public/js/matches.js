// public/js/matches.js

// Импорты (если нужны для других модулей, например, VRS)
import { updateVRSTeamNames } from "./vrs.js"; // Убедитесь, что этот импорт корректен
import { updateVetoTeamOptions } from "./mapVeto.js"; // Убедитесь, что этот импорт корректен

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;
const defaultLogoPath = "/logos/none.png"; // Глобальная константа (WEB-ПУТЬ!)

// Хранилище для экземпляров Choices.js
const choicesInstances = {}; // { team1Select1: instance, team2Select1: instance, ... }

// ----------------------
// Инициализация и работа с Choices.js
// ----------------------

/**
 * Форматирует список команд для использования с Choices.js.
 * @param {Array<object>} teamsList - Список команд от API { name: string, logo: string }.
 * @returns {Array<object>} - Форматированный список для Choices.js.
 */
function formatTeamsForChoices(teamsList) {
    const externalApiBaseUrl = "https://waywayway-production.up.railway.app";
    const choicesData = [
        { value: '', label: '-', selected: false, disabled: false, customProperties: { logoUrl: defaultLogoPath } }
    ];

    teamsList.forEach(team => {
        if (!team.name) return;

        let logoUrl = defaultLogoPath;
        if (team.logo) {
            if (team.logo.startsWith('http://') || team.logo.startsWith('https://')) {
                logoUrl = team.logo;
            } else if (team.logo.startsWith('/')) {
                logoUrl = externalApiBaseUrl + team.logo;
            } else {
                // Пытаемся собрать URL, предполагая, что это имя файла
                logoUrl = `${externalApiBaseUrl}/logos/${team.logo.replace(/\.png$/i, '')}.png`;
            }
        }
        // Простая проверка URL на базовую корректность (опционально)
        try {
             new URL(logoUrl); // Проверит, валидный ли URL (может выбросить исключение)
        } catch (_) {
            // console.warn(`[Choices Format] Invalid logo URL generated for ${team.name}: ${logoUrl}. Using default.`);
            logoUrl = defaultLogoPath; // Используем дефолт, если URL некорректный
        }


        choicesData.push({
            value: team.name,
            label: team.name,
            selected: false,
            disabled: false,
            customProperties: {
                logoUrl: logoUrl // Сохраняем URL логотипа здесь
            }
        });
    });
    return choicesData;
}

/**
 * Инициализирует Choices.js для указанного select элемента.
 * @param {string} selectId - ID элемента <select>.
 * @param {Array<object>} choicesData - Данные для Choices.js.
 */
function initializeChoices(selectId, choicesData) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) {
        console.warn(`[Choices Init] Element with ID ${selectId} not found.`);
        return;
    }

    // Удаляем предыдущий экземпляр, если он был
    if (choicesInstances[selectId]) {
        try {
            choicesInstances[selectId].destroy();
        } catch(e) { console.error(`Error destroying previous Choices instance for ${selectId}`, e); }
    }

    try {
        const choices = new Choices(selectElement, {
            choices: choicesData,
            searchEnabled: true,
            itemSelectText: '',
            allowHTML: false, // Оставляем false для безопасности
            classNames: {
                 containerOuter: 'choices team-choices-container', // Добавляем класс для общей стилизации
            },
            // Шаблоны для отображения логотипов
            callbackOnCreateTemplates: function (template) {
                return {
                    item: (classNames, data) => { // Элемент в поле ввода (выбранный)
                        return template(`
                          <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable}" data-item data-id="${data.id}" data-value="${data.value}" ${data.active ? 'aria-selected="true"' : ''} ${data.disabled ? 'aria-disabled="true"' : ''}>
                            ${data.customProperties && data.customProperties.logoUrl && data.value !== '' ? `<img class="choices-logo choices-logo-item" src="${data.customProperties.logoUrl}" alt="">` : ''}
                            <span>${data.label}</span>
                          </div>
                        `);
                    },
                    choice: (classNames, data) => { // Элемент в выпадающем списке
                        return template(`
                          <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : classNames.itemSelectable}" data-select-text="${this.config.itemSelectText}" data-choice data-id="${data.id}" data-value="${data.value}" ${data.disabled ? 'aria-disabled="true"' : 'data-choice-selectable'} role="option">
                             ${data.customProperties && data.customProperties.logoUrl && data.value !== '' ? `<img class="choices-logo choices-logo-choice" src="${data.customProperties.logoUrl}" alt="">` : ''}
                             <span>${data.label}</span>
                          </div>
                        `);
                    },
                };
            }
        });

        // Сохраняем экземпляр
        choicesInstances[selectId] = choices;

         // Добавляем слушатель события change ПОСЛЕ инициализации
         selectElement.addEventListener('change', () => {
             const matchIndexStr = selectId.match(/\d+$/)?.[0]; // Извлекаем индекс матча из ID
             if (matchIndexStr) {
                 const matchIndex = parseInt(matchIndexStr, 10);
                 // Обновляем статический логотип и текст кнопки
                 updateTeamDisplay(matchIndex);
                 // Обновляем зависимые элементы (VRS, Veto)
                 if (typeof updateVRSTeamNames === 'function') updateVRSTeamNames();
                 const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
                 if (currentVetoMatchIndex && currentVetoMatchIndex == matchIndex) {
                     if (typeof updateVetoTeamOptions === 'function') updateVetoTeamOptions(String(matchIndex));
                 }
             }
         }, false);

    } catch(error) {
        console.error(`[Choices Init] Failed to initialize Choices.js for ${selectId}:`, error);
    }
}

/**
 * Инициализирует блок матчей.
 */
export async function initMatches() {
    if (teamsInitializationPromise) {
        return teamsInitializationPromise;
    }
    teamsInitializationPromise = new Promise(async (resolve, reject) => {
        console.log("[Matches] Starting teams initialization (Choices.js integration)...");
        try {
            const response = await fetch("https://waywayway-production.up.railway.app/api/teams");
            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                 try { /* ... обработка текста ошибки ... */ } catch(e){}
                throw new Error(errorText);
            }
            const data = await response.json();
            const teamsList = Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);
            console.log("[Matches] Raw teams list fetched:", teamsList);

            const choicesData = formatTeamsForChoices(teamsList);
            console.log("[Matches] Teams list formatted for Choices:", choicesData);

            for (let m = 1; m <= 4; m++) {
                initializeChoices(`team1Select${m}`, choicesData);
                initializeChoices(`team2Select${m}`, choicesData);
            }
            console.log("[Matches] Choices.js initialized for all team selects.");

            // attachTeamLogoUpdates(); // БОЛЬШЕ НЕ НУЖНА
            attachWinnerButtons();
            attachStatusChangeHandlers();

            for (let m = 1; m <= 4; m++) {
                updateTeamDisplay(m); // Первоначальная установка стат. лого и кнопок
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById("statusSelect" + m);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }

            teamsInitialized = true;
            console.log("[Matches] Teams initialization completed (with Choices.js).");
            resolve();

        } catch (err) {
            console.error("[Matches] Error during initialization (Choices.js):", err);
            reject(err);
        }
    });
    return teamsInitializationPromise;
}

/**
 * Проверяет, завершена ли инициализация.
 */
export function areTeamsInitialized() {
    return teamsInitialized;
}

// ----------------------
// Обновление отображения команды (статический лого и кнопка)
// ----------------------
/**
 * Обновляет статическое лого над селектом и текст кнопки победителя.
 */
export function updateTeamDisplay(matchIndex) {
    const sel1Id = `team1Select${matchIndex}`;
    const sel2Id = `team2Select${matchIndex}`;
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    const choiceInstance1 = choicesInstances[sel1Id];
    const choiceInstance2 = choicesInstances[sel2Id];

    // Получаем значение и лого из Choices.js или напрямую, если Choices не инициализирован
    let team1Name = "";
    let logoUrl1 = defaultLogoPath;
    if (choiceInstance1) {
        team1Name = choiceInstance1.getValue(true) || ""; // getValue(true) возвращает значение
        const selectedItem = choiceInstance1.store.getItemByValue(team1Name);
        if (selectedItem?.customProperties?.logoUrl) {
            logoUrl1 = selectedItem.customProperties.logoUrl;
        }
    } else {
        const sel1 = document.getElementById(sel1Id);
        team1Name = sel1 ? sel1.value : "";
        logoUrl1 = sel1?.options[sel1.selectedIndex]?.dataset.logo || defaultLogoPath;
    }

    let team2Name = "";
    let logoUrl2 = defaultLogoPath;
    if (choiceInstance2) {
        team2Name = choiceInstance2.getValue(true) || "";
        const selectedItem = choiceInstance2.store.getItemByValue(team2Name);
        if (selectedItem?.customProperties?.logoUrl) {
            logoUrl2 = selectedItem.customProperties.logoUrl;
        }
    } else {
        const sel2 = document.getElementById(sel2Id);
        team2Name = sel2 ? sel2.value : "";
        logoUrl2 = sel2?.options[sel2.selectedIndex]?.dataset.logo || defaultLogoPath;
    }

    // Обновляем статический логотип
    if (logo1Img) {
        if (logo1Img.getAttribute('src') !== logoUrl1) {
            logo1Img.src = logoUrl1;
        }
        logo1Img.onerror = () => { if (logo1Img.src !== defaultLogoPath) logo1Img.src = defaultLogoPath; };
    }
    if (logo2Img) {
        if (logo2Img.getAttribute('src') !== logoUrl2) {
            logo2Img.src = logoUrl2;
        }
        logo2Img.onerror = () => { if (logo2Img.src !== defaultLogoPath) logo2Img.src = defaultLogoPath; };
    }

    // Обновляем текст кнопки победителя
    const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
    const btn2 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM2"]`);
    if (btn1) btn1.textContent = ` ${team1Name || 'Team 1'}`;
    if (btn2) btn2.textContent = ` ${team2Name || 'Team 2'}`;
}

// Функция attachTeamLogoUpdates() БОЛЬШЕ НЕ НУЖНА

// ----------------------
// Кнопки Winner и подсветка (без изменений)
// ----------------------
export function attachWinnerButtons() { /* ... код без изменений ... */ }
export function refreshWinnerHighlight(matchIndex) { /* ... код без изменений ... */ }

// ----------------------
// Обработчики изменения статуса (без изменений)
// ----------------------
export function attachStatusChangeHandlers() { /* ... код без изменений ... */ }
export function updateStatusColor(selectElement) { /* ... код без изменений ... */ }

// --------------------------------------------------
// Сбор данных ОДНОГО матча (с учетом Choices.js)
// --------------------------------------------------
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const SCORE_REGEX = /^\d+:\d+$/;

    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.error(`Не удалось найти колонку для матча ${m} при сборе данных.`);
        return null;
    }

    const statusSelect = document.getElementById("statusSelect" + m);
    const statusText = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeInput = document.getElementById("timeInput" + m);
    const timeVal = timeInput ? timeInput.value.trim() : "";

    // Получаем значения и лого через Choices API
    const sel1Id = `team1Select${m}`;
    const sel2Id = `team2Select${m}`;
    const choiceInstance1 = choicesInstances[sel1Id];
    const choiceInstance2 = choicesInstances[sel2Id];
    const team1Name = choiceInstance1 ? (choiceInstance1.getValue(true) || "") : "";
    const team2Name = choiceInstance2 ? (choiceInstance2.getValue(true) || "") : "";

    let team1Logo = defaultLogoPath;
    if (choiceInstance1 && team1Name) {
        const item = choiceInstance1.store.getItemByValue(team1Name);
        if (item?.customProperties?.logoUrl) team1Logo = item.customProperties.logoUrl;
    }
    let team2Logo = defaultLogoPath;
    if (choiceInstance2 && team2Name) {
        const item = choiceInstance2.store.getItemByValue(team2Name);
        if (item?.customProperties?.logoUrl) team2Logo = item.customProperties.logoUrl;
    }

    // Сбор данных по картам (без изменений)
    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
        const mapSelect = row.querySelector(".map-name-select");
        const scoreInput = row.querySelector(".map-score-input");
        maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
        maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Автозаполнение счета карт (без изменений)
    if (statusText === "LIVE") { /* ... */ }
    else if (statusText === "FINISHED") { /* ... */ }
    else if (statusText === "UPCOM") { /* ... */ }

    // Определение иконок счета (без изменений, но убедитесь что пути верные)
    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";
    const noneIconPath = "/images/none_score_icon.png"; // ПРИМЕР
    const mpLIconPath = "/images/mp_L.png";             // ПРИМЕР
    const mpRIconPath = "/images/mp_R.png";             // ПРИМЕР
    const mpNoneIconPath = "/images/mp_none.png";       // ПРИМЕР
    if (statusText === "UPCOM") { MP1_UPC = MP2_UPC = MP3_UPC = noneIconPath; }
    else if (statusText === "LIVE") { /* ... вызов getScoreIcon ... */ }
    else if (statusText === "FINISHED") { /* ... вызов getScoreIcon ... */ }

    // Определение победителя (без изменений в логике, использует team1Name/team2Name)
    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPath;
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) { teamWinner = team1Name; teamWinnerLogo = team1Logo; }
        else if (winnerKey === "TEAM2" && team2Name) { teamWinner = team2Name; teamWinnerLogo = team2Logo; }
    }

    // Определение других полей (без изменений, но убедитесь что пути верные)
    let finCest = "", finResult = "", finVictory = ""; /* ... */
    const liveStatusValue = statusText === "LIVE" ? "/images/live_icon.png" : defaultLogoPath; // ПРИМЕР
    /* ... остальные переменные путей ... */

    // Формирование объектов данных (используются обновленные team1Name, team2Name, team1Logo, team2Logo, teamWinnerLogo)
    const upcomObj = { /* ... */ };
    const liveObj = { /* ... */ };
    const finishedObj = { /* ... */ };
    const perMapLogos = {}; /* ... */
    const matchLogos = {}; /* ... */

    // Сборка итогового объекта
    const matchObj = {
        ...upcomObj, ...liveObj, ...finishedObj,
        MP1_UPC, MP2_UPC, MP3_UPC,
        MP1_LIVE, MP2_LIVE, MP3_LIVE,
        MP1_FIN, MP2_FIN, MP3_FIN,
        Fin_cest: finCest, FIN_Result: finResult, FIN_VICTORY: finVictory,
        TEAMWINNER: teamWinner, TEAMWINNER_LOGO: teamWinnerLogo,
        ...matchLogos, ...perMapLogos
    };

    return matchObj;
}

// ----------------------
// Помощник для иконок счета (без изменений)
// ----------------------
function getScoreIcon(scoreStr, lPath, rPath, mpNonePath, nonePath) {
    if (typeof scoreStr !== 'string') return nonePath;
    const parts = scoreStr.split(":");
    if (parts.length !== 2) return mpNonePath;
    const left = parseFloat(parts[0]);
    const right = parseFloat(parts[1]);
    if (isNaN(left) || isNaN(right)) return nonePath;
    if (right > left) return rPath;
    if (left > right) return lPath;
    return nonePath;
}