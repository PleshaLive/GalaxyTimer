// public/js/matches.js

// Импорт необходимых модулей и функций (если они есть в других файлах)
// import { someFunction } from './helpers.js';

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;
const defaultLogoPath = "https://waywayway-production.up.railway.app/logos/none.png"; // Глобальный путь к логотипу по умолчанию (WEB-ПУТЬ!)

// --- Функции-шаблоны для Select2 ---
/**
 * Форматирует отображение опции команды в выпадающем списке Select2.
 * @param {Object} team - Данные команды из Select2.
 * @returns {jQuery|string} - jQuery объект или текст для отображения.
 */
function formatTeamOption(team) {
    if (!team.id) { // Для плейсхолдера типа "- Выбрать -"
        return team.text;
    }
    // Используем data-logo из option, если он есть, иначе дефолтный
    const logoUrl = team.element && team.element.dataset.logo ? team.element.dataset.logo : defaultLogoPath;
    const $container = $(
        `<span class="select2-team-option">
            <img src="${logoUrl}" class="select2-team-logo" alt="${team.text} logo" onerror="this.onerror=null; this.src='${defaultLogoPath}';" />
            <span class="select2-team-name">${team.text}</span>
        </span>`
    );
    return $container;
}

/**
 * Форматирует отображение выбранной команды в основном поле Select2.
 * @param {Object} team - Данные выбранной команды из Select2.
 * @returns {jQuery|string} - jQuery объект или текст для отображения.
 */
function formatTeamSelection(team) {
    if (!team.id) {
        return team.text; // Для плейсхолдера
    }
     // Используем data-logo из option, если он есть, иначе дефолтный
    const logoUrl = team.element && team.element.dataset.logo ? team.element.dataset.logo : defaultLogoPath;
    const $container = $(
        // ВАЖНО: обертка .select2-team-selection нужна для CSS
        `<span class="select2-team-selection">
            <img src="${logoUrl}" class="select2-team-logo-selected" alt="${team.text} logo" onerror="this.onerror=null; this.src='${defaultLogoPath}';" />
            <span class="select2-team-name-selected">${team.text}</span>
        </span>`
    );
    return $container;
}


// ----------------------
// Инициализация модуля матчей
// ----------------------
export async function initMatches() {
    if (teamsInitializationPromise) {
        return teamsInitializationPromise;
    }

    teamsInitializationPromise = new Promise(async (resolve, reject) => {
        console.log("[Matches] Starting teams initialization from external API...");
        try {
            const response = await fetch("https://waywayway-production.up.railway.app/api/teams");
            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                 try {
                     const errorData = await response.json();
                     errorText += ` - ${errorData.message || JSON.stringify(errorData).substring(0,100)}`;
                 } catch (e) {
                     const textResponse = await response.text().catch(() => "");
                     if(textResponse) errorText += ` - Server response: ${textResponse.substring(0,100)}`;
                 }
                throw new Error(errorText);
            }
            const data = await response.json();
            const teamsList = Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);

            if (teamsList.length === 0) {
                console.warn("[Matches] Team list is empty or not received from the external API.");
            }

            populateTeamSelects(teamsList); // Заполняем обычные селекты
            initSelect2ForTeams(); // Инициализируем Select2 поверх них
            attachSelect2ChangeListeners(); // Привязываем слушатели к Select2
            attachWinnerButtons();
            attachStatusChangeHandlers();

            // Первичная настройка отображения (логотипы над селектом, текст кнопок, подсветка)
            for (let m = 1; m <= 4; m++) {
                updateTeamDisplay(m); // Обновит лого над селектом и текст кнопки победителя
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById(`statusSelect${m}`);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }
            teamsInitialized = true;
            console.log("[Matches] Module initialized successfully with Select2.");
            resolve();
        } catch (err) {
            console.error("[Matches] Critical error during initialization:", err);
            const errorDisplayElement = document.getElementById('teamsLoadingError');
            if (errorDisplayElement) {
                errorDisplayElement.textContent = `Ошибка загрузки команд: ${err.message}.`;
                errorDisplayElement.style.color = 'red';
            }
            reject(err);
        }
    });
    return teamsInitializationPromise;
}

export function areTeamsInitialized() {
    return teamsInitialized;
}

// ----------------------
// Заполнение селектов команд (перед инициализацией Select2)
// ----------------------
export function populateTeamSelects(teamsList) {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-"; // Текст для плейсхолдера
    defaultOption.dataset.logo = defaultLogoPath;

    const externalApiBaseUrl = "https://waywayway-production.up.railway.app";

    for (let m = 1; m <= 4; m++) {
        const team1Select = document.getElementById(`team1Select${m}`);
        const team2Select = document.getElementById(`team2Select${m}`);
        if (!team1Select || !team2Select) continue;

        // Сохраняем текущее значение перед очисткой
        const currentVal1 = team1Select.value;
        const currentVal2 = team2Select.value;

        // Уничтожаем Select2 перед очисткой, если он уже был инициализирован
        if ($(team1Select).data('select2')) $(team1Select).select2('destroy');
        if ($(team2Select).data('select2')) $(team2Select).select2('destroy');

        team1Select.innerHTML = ''; // Очищаем старые опции
        team2Select.innerHTML = '';

        team1Select.appendChild(defaultOption.cloneNode(true));
        team2Select.appendChild(defaultOption.cloneNode(true));

        teamsList.forEach(team => {
            if (!team.name) return;
            const option = document.createElement("option");
            option.value = team.name;
            option.textContent = team.name;

            let logoUrl = defaultLogoPath;
            if (team.logo) {
                if (team.logo.startsWith('http://') || team.logo.startsWith('https://')) {
                    logoUrl = team.logo;
                } else if (team.logo.startsWith('/')) { // Если путь относительный от корня API
                    logoUrl = externalApiBaseUrl + team.logo;
                } else { // Если просто имя файла
                    logoUrl = `${externalApiBaseUrl}/logos/${team.logo.replace(/\.png$/i, '')}.png`; // Предполагаем структуру
                }
            }
            option.dataset.logo = logoUrl; // Сохраняем URL лого в data-атрибуте
            team1Select.appendChild(option.cloneNode(true));
            team2Select.appendChild(option.cloneNode(true));
        });

        // Восстанавливаем значения
        if (currentVal1 && team1Select.querySelector(`option[value="${CSS.escape(currentVal1)}"]`)) {
           team1Select.value = currentVal1;
        } else if (team1Select.options.length > 0) {
           team1Select.value = ""; // Сброс на "-"
        }
        if (currentVal2 && team2Select.querySelector(`option[value="${CSS.escape(currentVal2)}"]`)) {
           team2Select.value = currentVal2;
        } else if (team2Select.options.length > 0) {
           team2Select.value = ""; // Сброс на "-"
        }
    }
    // console.log("[Matches] Team selects populated.");
}

/**
 * Инициализирует Select2 для всех селектов команд.
 */
function initSelect2ForTeams() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);
        const parent1 = sel1.parent(); // Получаем родителя ДО инициализации
        const parent2 = sel2.parent();

        const commonSelect2Options = {
            templateResult: formatTeamOption,
            templateSelection: formatTeamSelection,
            width: '100%',
            placeholder: "-",
            allowClear: false,
            // dropdownParent: parent1 // Раскомментируйте, если нужно и не ломает верстку
        };
        if (sel1.length) {
             sel1.select2({...commonSelect2Options, dropdownParent: parent1 });
        }
        if (sel2.length) {
             sel2.select2({...commonSelect2Options, dropdownParent: parent2 });
        }
    }
     // console.log("[Matches] Select2 initialized for team selects.");
}

/**
 * Привязывает обработчики 'change' к Select2 селектам команд для обновления UI.
 */
function attachSelect2ChangeListeners() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);

        // Обработчик для обновления лого над селектом и текста кнопки победителя
        const updateDisplayListener = () => {
             updateTeamDisplay(m); // Эта функция теперь обновит <img> над селектом и текст кнопки
        };

        // Обработчик для обновления связанных элементов (MapVeto, VRS)
        const updateRelatedModulesListener = () => {
            const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
             // Используем window. для доступа к функциям из других модулей, если они глобальны
             // или импортируйте их напрямую, если настроена сборка модулей
            if (typeof window.updateVetoTeamOptions === 'function' && currentVetoMatchIndex && currentVetoMatchIndex == m) {
                window.updateVetoTeamOptions(String(m));
            }
            if (typeof window.updateVRSTeamNames === 'function') {
                window.updateVRSTeamNames();
            }
        };

        if (sel1.length) {
            sel1.on("change.select2", updateDisplayListener);
            sel1.on("change.select2", updateRelatedModulesListener);
        }
        if (sel2.length) {
            sel2.on("change.select2", updateDisplayListener);
            sel2.on("change.select2", updateRelatedModulesListener);
        }
    }
}

// ----------------------
// Обновление отображения команды (ЛОГО НАД СЕЛЕКТОМ и текст кнопки победителя)
// НЕ обновляет сам Select2, это делает Select2 при выборе опции
// ----------------------
export function updateTeamDisplay(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    if (sel1) {
        const team1Name = sel1.value || "Team 1"; // Используем имя из value селекта
        const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (btn1) btn1.textContent = ` ${team1Name}`; // Обновляем текст на кнопке

        if (logo1Img) {
            const selectedOption1 = sel1.options[sel1.selectedIndex];
            const logoUrl1 = (selectedOption1 && selectedOption1.dataset.logo) ? selectedOption1.dataset.logo : defaultLogoPath;
            if (logo1Img.getAttribute('src') !== logoUrl1) {
                logo1Img.src = logoUrl1;
            }
            logo1Img.onerror = () => { if (logo1Img.src !== defaultLogoPath) logo1Img.src = defaultLogoPath; };
        }
    }

    if (sel2) {
        const team2Name = sel2.value || "Team 2";
        const btn2 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM2"]`);
        if (btn2) btn2.textContent = ` ${team2Name}`;

        if (logo2Img) {
            const selectedOption2 = sel2.options[sel2.selectedIndex];
            const logoUrl2 = (selectedOption2 && selectedOption2.dataset.logo) ? selectedOption2.dataset.logo : defaultLogoPath;
            if (logo2Img.getAttribute('src') !== logoUrl2) {
                logo2Img.src = logoUrl2;
            }
            logo2Img.onerror = () => { if (logo2Img.src !== defaultLogoPath) logo2Img.src = defaultLogoPath; };
        }
    }
}

/**
 * Привязывает обработчики кликов к кнопкам выбора победителя.
 */
export function attachWinnerButtons() {
    document.querySelectorAll(".winner-btn").forEach(btn => {
        // Проверяем, не добавлен ли уже слушатель
        if (btn.dataset.winnerListenerAttached === 'true') return;
        btn.dataset.winnerListenerAttached = 'true';

        btn.addEventListener("click", () => {
            const matchColumn = btn.closest(".match-column");
            if (!matchColumn) return;
            const teamKey = btn.getAttribute("data-team");
            const matchIndex = parseInt(matchColumn.dataset.match, 10);
            const currentWinner = matchColumn.getAttribute("data-winner");

            if (currentWinner === teamKey) {
                matchColumn.removeAttribute("data-winner");
            } else {
                matchColumn.setAttribute("data-winner", teamKey);
            }
            refreshWinnerHighlight(matchIndex);
        });
    });
}

/**
 * Обновляет подсветку кнопок победителя.
 */
export function refreshWinnerHighlight(matchIndex) {
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return;
    const winner = matchColumn.getAttribute("data-winner");
    matchColumn.querySelectorAll(".winner-btn").forEach(b => {
        b.classList.toggle("winner-selected", b.getAttribute("data-team") === winner);
    });
}

/**
 * Привязывает обработчики 'change' к селектам статуса.
 */
export function attachStatusChangeHandlers() {
    document.querySelectorAll('.status-select').forEach(select => {
        if (select.dataset.statusListenerAttached === 'true') return;
        select.dataset.statusListenerAttached = 'true';

        select.addEventListener('change', function() {
            updateStatusColor(this);
            const matchColumn = this.closest('.match-column');
            if (matchColumn) {
                const newStatus = this.value.toLowerCase();
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (newStatus) {
                    matchColumn.classList.add(`status-${newStatus}`);
                }
                 // Логика для автозаполнения MATCH X для UPCOM (если нужна)
                 const m = matchColumn.dataset.match;
                 if (this.value === 'UPCOM') {
                     const mapRows = matchColumn.querySelectorAll('.map-row');
                     if (mapRows.length >= 3) {
                         const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                         if (thirdMapScoreInput && !thirdMapScoreInput.value) { // Заполняем, только если пусто
                             thirdMapScoreInput.value = `MATCH ${m}`;
                         }
                     }
                 } else {
                     // Можно добавить логику очистки, если статус меняется с UPCOM
                 }
            }
        });
        // Первоначальное обновление цвета при загрузке
        updateStatusColor(select);
    });
}

/**
 * Устанавливает цвет фона и текста для селекта статуса.
 */
export function updateStatusColor(selectElement) {
    if (!selectElement) return;
    selectElement.classList.remove(
        'status-upcom-selected',
        'status-live-selected',
        'status-finished-selected'
    );
    const status = selectElement.value;
    if (status) {
        selectElement.classList.add(`status-${status.toLowerCase()}-selected`);
    }
}

/**
 * Собирает данные одного матча (версия для Select2).
 */
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const SCORE_REGEX = /^\d+:\d+$/;
    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.error(`[Matches] Не удалось найти колонку для матча ${m} при сборе данных.`);
        return null;
    }

    // --- НАЧАЛО ИЗМЕНЕНИЙ ДЛЯ ЛОКАЛЬНЫХ ПУТЕЙ ---
    // Базовый путь Windows. В строке JavaScript обратные слеши должны быть экранированы.
    // Эта JS-строка "C:\\\\projects\\\\NewTimer\\\\files" представляет собой реальный путь "C:\projects\NewTimer\files".
    const localBasePath = "C:\\\\projects\\\\NewTimer\\\\files"; 

    // Функция для генерации локальных путей Windows.
    // Цель: получить JS-строку вида "C:\projects\NewTimer\files\icon.png",
    // которая при сериализации в JSON станет "C:\\projects\\NewTimer\\files\\icon.png".
    const toLocal = (fileName) => {
        // localBasePath (JS-строка) уже имеет правильное экранирование для представления пути.
        // fileName (JS-строка), например, "icon.png".
        // Нам нужен один обратный слеш "\" как разделитель. В строке JavaScript он записывается как "\\".
        return `${localBasePath}\\\\${fileName}`;
    };

    // Убедитесь, что имена файлов (например, "none_score_icon.png") 
    // точно соответствуют именам файлов в вашей папке C:\projects\NewTimer\files.
    // Если для FIN_RectangleUP в вашем JSON сейчас приходит путь к "none.png",
    // то здесь должно быть toLocal("none.png"). Адаптируйте имена файлов ниже под ваши нужды.
    const localNoneIconPath = toLocal("none_score_icon.png"); 
    const localMpLIconPath = toLocal("mp_L.png");
    const localMpRIconPath = toLocal("mp_R.png");
    const localMpNoneIconPath = toLocal("mp_none.png");
    // --- КОНЕЦ ИЗМЕНЕНИЙ ДЛЯ ЛОКАЛЬНЫХ ПУТЕЙ ---

    const statusSelect = document.getElementById(`statusSelect${m}`);
    const statusText = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeInput = document.getElementById(`timeInput${m}`);
    const timeVal = timeInput ? timeInput.value.trim() : "";

    const selTeam1 = $(`#team1Select${m}`);
    const selTeam2 = $(`#team2Select${m}`);
    const team1Data = selTeam1.length ? selTeam1.select2('data')[0] : null;
    const team2Data = selTeam2.length ? selTeam2.select2('data')[0] : null;

    const team1Name = team1Data && team1Data.id ? team1Data.text : "";
    const team2Name = team2Data && team2Data.id ? team2Data.text : "";
    const team1Logo = team1Data && team1Data.element && team1Data.element.dataset.logo ? team1Data.element.dataset.logo : defaultLogoPath; // Остается URL
    const team2Logo = team2Data && team2Data.element && team2Data.element.dataset.logo ? team2Data.element.dataset.logo : defaultLogoPath; // Остается URL

    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
        const mapSelect = row.querySelector(".map-name-select");
        const scoreInput = row.querySelector(".map-score-input");
        maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
        maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);
        if (isScore1Numeric && !isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP2_SCORE = "NEXT";
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "DECIDER";
            else maps.MAP3_SCORE = "";
        } else if (isScore1Numeric && isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) {
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "NEXT";
            else maps.MAP3_SCORE = "";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && maps.MAP3 && maps.MAP3 !== "-" && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE && maps.MAP1 && maps.MAP1 !== "-") maps.MAP1_SCORE = "NEXT";
        if ((!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE === "DECIDER") && maps.MAP3 && maps.MAP3 !== "-") {
            maps.MAP3_SCORE = `MATCH ${m}`;
        }
    }

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    if (statusText === "UPCOM") { MP1_UPC = MP2_UPC = MP3_UPC = localNoneIconPath; }
    else if (statusText === "LIVE") { MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); }
    else if (statusText === "FINISHED") { MP1_FIN = getScoreIcon(maps.MAP1_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); MP2_FIN = getScoreIcon(maps.MAP2_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); MP3_FIN = getScoreIcon(maps.MAP3_SCORE, localMpLIconPath, localMpRIconPath, localMpNoneIconPath, localNoneIconPath); }

    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPath; // Остается URL
    if (winnerKey === "TEAM1" && team1Name) { teamWinner = team1Name; teamWinnerLogo = team1Logo; }
    else if (winnerKey === "TEAM2" && team2Name) { teamWinner = team2Name; teamWinnerLogo = team2Logo; }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED" && teamWinner) {
        finCest = "cest"; finResult = "Result"; finVictory = "VICTORY";
    }

    // --- ПУТИ К ИЗОБРАЖЕНИЯМ С ИСПОЛЬЗОВАНИЕМ toLocal ---
    // defaultLogoPath (URL) используется как заглушка для лого-связанных полей или где это имело смысл в исходной логике.
    // localNoneIconPath (локальный путь) используется как заглушка для не-логотипных изображений.

    const liveStatusValue = statusText === "LIVE" ? toLocal("live_icon.png") : defaultLogoPath;
    const liveBgValue = statusText === "LIVE" ? toLocal("LIVEBG.png") : defaultLogoPath;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? toLocal("ongoing_icon.png") : defaultLogoPath;
    const liveRectUp = statusText === "LIVE" ? toLocal("live_rectUp.png") : localNoneIconPath;
    const liveRectLow = statusText === "LIVE" ? toLocal("live_rectLow.png") : localNoneIconPath;

    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? toLocal("rectUp.png") : defaultLogoPath;
    const upcomRectLow = statusText === "UPCOM" ? toLocal("rectLow.png") : defaultLogoPath;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? toLocal("bg_next_upcom.png") : "";

    const finRectUp = statusText === "FINISHED" ? toLocal("fin_rectUp.png") : localNoneIconPath;
    const finRectLow = statusText === "FINISHED" ? toLocal("fin_rectLow.png") : localNoneIconPath;
    // --- КОНЕЦ ИЗМЕНЕНИЙ ПУТЕЙ ---

    const upcomObj = { UPCOM_MATCH_STATUS: statusText === "UPCOM" ? "UPCOM" : "", UPCOM_TIME: statusText === "UPCOM" && timeVal ? `${timeVal} CEST` : "", UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "", UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "", UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLogoPath, UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLogoPath, UPCOM_MAP1: statusText === "UPCOM" ? maps.MAP1 : "", UPCOM_MAP1_SCORE: statusText === "UPCOM" ? maps.MAP1_SCORE : "", UPCOM_MAP2: statusText === "UPCOM" ? maps.MAP2 : "", UPCOM_MAP2_SCORE: statusText === "UPCOM" ? maps.MAP2_SCORE : "", UPCOM_MAP3: statusText === "UPCOM" ? maps.MAP3 : "", UPCOM_MAP3_SCORE: statusText === "UPCOM" ? maps.MAP3_SCORE : "", UPCOM_Cest: upcomCestValue, UPCOM_RectangleUP: upcomRectUp, UPCOM_RectangleLOW: upcomRectLow, UPCOM_vs_mini: upcomVsMiniValue, UPCOM_vs_big: upcomVsBigValue, UPCOM_next: statusText === "UPCOM" && maps.MAP1_SCORE === "NEXT" ? "NEXT" : "", UPCOM_next_photo: upcomNextPhotoValue };
    const liveObj = { LIVE_MATCH_STATUS: statusText === "LIVE" ? "LIVE" : "", LIVE_TIME: statusText === "LIVE" ? timeVal : "", LIVE_TEAM1: statusText === "LIVE" ? team1Name : "", LIVE_TEAM2: statusText === "LIVE" ? team2Name : "", LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogoPath, LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogoPath, LIVE_MAP1: statusText === "LIVE" ? maps.MAP1 : "", LIVE_MAP1_SCORE: statusText === "LIVE" ? maps.MAP1_SCORE : "", LIVE_MAP2: statusText === "LIVE" ? maps.MAP2 : "", LIVE_MAP2_SCORE: statusText === "LIVE" ? maps.MAP2_SCORE : "", LIVE_MAP3: statusText === "LIVE" ? maps.MAP3 : "", LIVE_MAP3_SCORE: statusText === "LIVE" ? maps.MAP3_SCORE : "", LIVE_Cest: liveCestValue, LIVE_VS: liveVs, LIVE_STATUS: liveStatusValue, LIVE_BG: liveBgValue, LIVE_RectangleUP: liveRectUp, LIVE_RectangleLOW: liveRectLow };
    const finishedObj = { FINISHED_MATCH_STATUS: statusText === "FINISHED" ? "FINISHED" : "", FINISHED_TIME: statusText === "FINISHED" && timeVal ? `${timeVal} CEST` : "", FINISHED_TEAM1: statusText === "FINISHED" ? team1Name : "", FINISHED_TEAM2: statusText === "FINISHED" ? team2Name : "", FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLogoPath, FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLogoPath, FINISHED_MAP1: statusText === "FINISHED" ? maps.MAP1 : "", FINISHED_MAP1_SCORE: statusText === "FINISHED" ? maps.MAP1_SCORE : "", FINISHED_MAP2: statusText === "FINISHED" ? maps.MAP2 : "", FINISHED_MAP2_SCORE: statusText === "FINISHED" ? maps.MAP2_SCORE : "", FINISHED_MAP3: statusText === "FINISHED" ? maps.MAP3 : "", FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "", FIN_RectangleUP: finRectUp, FIN_RectangleLOW: finRectLow };
    
    const perMapLogos = {}; [1, 2, 3].forEach(i => { const sc = maps[`MAP${i}_SCORE`]; const isNum = SCORE_REGEX.test(sc); const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum; perMapLogos[`MAP${i}_TEAM1logo`] = show && team1Name ? team1Logo : defaultLogoPath; perMapLogos[`MAP${i}_TEAM2logo`] = show && team2Name ? team2Logo : defaultLogoPath; });
    const matchLogos = {}; if (statusText === "FINISHED") { matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = team1Logo; matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = team2Logo; } else { matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = defaultLogoPath; matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = defaultLogoPath; } if (statusText === "LIVE") { matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = team1Logo; matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = team2Logo; } else { matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = defaultLogoPath; matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = defaultLogoPath; }
    
    const matchObj = { ...upcomObj, ...liveObj, ...finishedObj, MP1_UPC, MP2_UPC, MP3_UPC, MP1_LIVE, MP2_LIVE, MP3_LIVE, MP1_FIN, MP2_FIN, MP3_FIN, Fin_cest: finCest, FIN_Result: finResult, FIN_VICTORY: finVictory, TEAMWINNER: teamWinner, TEAMWINNER_LOGO: teamWinnerLogo, ...matchLogos, ...perMapLogos };

    return matchObj;
}

/**
 * Помощник для иконок счета карты (L/R/None).
 */
function getScoreIcon(scoreStr, lPath, rPath, mpNonePath, nonePath) {
    if (!scoreStr || typeof scoreStr !== 'string') return nonePath;
    const parts = scoreStr.split(':');
    if (parts.length === 2) {
        const score1 = parseInt(parts[0], 10);
        const score2 = parseInt(parts[1], 10);
        if (!isNaN(score1) && !isNaN(score2)) {
            if (score1 > score2) return lPath;
            if (score2 > score1) return rPath;
            return mpNonePath; // Используем mp_none для ничьей или 0:0
        }
    }
    return nonePath; // Используем none для нечисловых (NEXT, DECIDER, пустая строка)
}