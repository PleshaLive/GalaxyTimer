// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;
const defaultLogoPath = "/logos/none.png"; // Глобальный путь к логотипу по умолчанию (WEB-ПУТЬ!)

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
    const logoUrl = team.element && team.element.dataset.logo ? team.element.dataset.logo : defaultLogoPath;
    const $container = $(
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
        console.log("[Matches] Starting teams initialization...");
        try {
            const response = await fetch("https://waywayway-production.up.railway.app/api/teams"); // Используем внешний API для списка команд
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
                console.warn("[Matches] Team list is empty or not received from the API.");
            }

            populateTeamSelects(teamsList);
            initSelect2ForTeams();
            attachSelect2ChangeListeners();
            attachWinnerButtons();
            attachStatusChangeHandlers();

            // Первичная настройка отображения для всех матчей
            for (let m = 1; m <= 4; m++) { // Предполагаем до 4 матчей
                updateTeamDisplay(m);
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById(`statusSelect${m}`);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }
            teamsInitialized = true;
            console.log("[Matches] Module initialized successfully.");
            resolve();
        } catch (err) {
            console.error("[Matches] Critical error during initialization:", err);
            const errorDisplayElement = document.getElementById('teamsLoadingError'); // Предполагается, что такой элемент есть в HTML
            if (errorDisplayElement) {
                errorDisplayElement.textContent = `Ошибка загрузки списка команд: ${err.message}. Функционал матчей может быть ограничен.`;
                errorDisplayElement.style.color = 'red';
            }
            reject(err); // Отклоняем промис, чтобы внешние обработчики знали об ошибке
        }
    });
    return teamsInitializationPromise;
}

/**
 * Возвращает true, если инициализация команд завершена.
 * @returns {boolean}
 */
export function areTeamsInitialized() {
    return teamsInitialized;
}

// ----------------------
// Заполнение селектов команд
// ----------------------
export function populateTeamSelects(teamsList) {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-"; // Текст для плейсхолдера
    defaultOption.dataset.logo = defaultLogoPath;

    const externalApiBaseUrl = "https://waywayway-production.up.railway.app"; // Базовый URL для относительных путей логотипов

    for (let m = 1; m <= 4; m++) { // Предполагаем до 4 матчей
        const team1Select = document.getElementById(`team1Select${m}`);
        const team2Select = document.getElementById(`team2Select${m}`);
        if (!team1Select || !team2Select) continue;

        const currentVal1 = $(team1Select).val(); // Сохраняем текущее значение
        const currentVal2 = $(team2Select).val();

        // Уничтожаем Select2 перед очисткой, если он уже был инициализирован
        if ($(team1Select).data('select2')) $(team1Select).select2('destroy');
        if ($(team2Select).data('select2')) $(team2Select).select2('destroy');
        
        team1Select.innerHTML = ''; // Очищаем старые опции
        team2Select.innerHTML = '';
        
        team1Select.appendChild(defaultOption.cloneNode(true));
        team2Select.appendChild(defaultOption.cloneNode(true));

        teamsList.forEach(team => {
            if (!team.name) return; // Пропускаем команды без имени
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
                    logoUrl = `${externalApiBaseUrl}/logos/${team.logo.replace(/\.png$/i, '')}.png`;
                }
            }
            option.dataset.logo = logoUrl;
            team1Select.appendChild(option.cloneNode(true));
            team2Select.appendChild(option.cloneNode(true));
        });

        // Восстанавливаем значения и триггерим событие для Select2
        $(team1Select).val(currentVal1 || "").trigger('change.select2');
        $(team2Select).val(currentVal2 || "").trigger('change.select2');
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
        // ПРАВИЛЬНО ПОЛУЧАЕМ РОДИТЕЛЕЙ
        const parent1 = sel1.parent();
        const parent2 = sel2.parent();

        const commonSelect2Options = {
            templateResult: formatTeamOption,
            templateSelection: formatTeamSelection,
            // width: '100%', // ЗАКОММЕНТИРУЙТЕ ИЛИ УДАЛИТЕ ЭТУ СТРОКУ (если она есть в JS)
            width: 'resolve', // <<<< ПОПРОБУЙТЕ ЭТУ ОПЦИЮ
            placeholder: "-",
            allowClear: false,
             // ПРОВЕРЬТЕ, ЧТО dropdownParent ПЕРЕДАЕТСЯ КОРРЕКТНО, ЕСЛИ ОН НУЖЕН
            // dropdownParent: parent1 // Пример для sel1 (или parent2 для sel2)
            // Если dropdownParent не нужен, закомментируйте эту строку
        };

        if (sel1.length) {
            // Передаем корректный dropdownParent, если он используется
            sel1.select2({...commonSelect2Options, dropdownParent: parent1 });
        }
        if (sel2.length) {
             // Передаем корректный dropdownParent, если он используется
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
        const updateListener = () => {
            updateTeamDisplay(m);
            // Обновление связанных элементов в других модулях (MapVeto, VRS)
            const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
            if (typeof window.updateVetoTeamOptions === 'function' && currentVetoMatchIndex && currentVetoMatchIndex == m) {
                window.updateVetoTeamOptions(String(m));
            }
            if (typeof window.updateVRSTeamNames === 'function') {
                window.updateVRSTeamNames();
            }
        };
        if (sel1.length) sel1.on("change.select2", updateListener);
        if (sel2.length) sel2.on("change.select2", updateListener);
    }
}

// ----------------------
// Обновление отображения команды (логотип над селектом и текст на кнопке победителя)
// ----------------------
export function updateTeamDisplay(matchIndex) {
    const team1Select = $(`#team1Select${matchIndex}`);
    const team2Select = $(`#team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    if (team1Select.length) {
        const selectedData1 = team1Select.select2('data')[0];
        const team1Name = selectedData1 && selectedData1.id ? selectedData1.text : "Team 1"; // Имя по умолчанию
        const logoUrl1 = selectedData1 && selectedData1.element && selectedData1.element.dataset.logo ? selectedData1.element.dataset.logo : defaultLogoPath;
        
        const winnerBtn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (winnerBtn1) winnerBtn1.textContent = ` ${team1Name}`; // Обновляем текст на кнопке

        if (logo1Img) {
            if (logo1Img.getAttribute('src') !== logoUrl1) logo1Img.src = logoUrl1;
            logo1Img.onerror = () => { if (logo1Img.src !== defaultLogoPath) logo1Img.src = defaultLogoPath; };
        }
    }

    if (team2Select.length) {
        const selectedData2 = team2Select.select2('data')[0];
        const team2Name = selectedData2 && selectedData2.id ? selectedData2.text : "Team 2"; // Имя по умолчанию
        const logoUrl2 = selectedData2 && selectedData2.element && selectedData2.element.dataset.logo ? selectedData2.element.dataset.logo : defaultLogoPath;

        const winnerBtn2 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM2"]`);
        if (winnerBtn2) winnerBtn2.textContent = ` ${team2Name}`; // Обновляем текст на кнопке

        if (logo2Img) {
            if (logo2Img.getAttribute('src') !== logoUrl2) logo2Img.src = logoUrl2;
            logo2Img.onerror = () => { if (logo2Img.src !== defaultLogoPath) logo2Img.src = defaultLogoPath; };
        }
    }
}

// ----------------------
// Кнопки Winner и их подсветка
// ----------------------
/**
 * Привязывает обработчики кликов к кнопкам выбора победителя.
 * Повторный клик по выбранному победителю снимает выбор.
 */
export function attachWinnerButtons() {
    // console.log("[Matches] Attaching winner button listeners (with deselection)...");
    const matchColumns = document.querySelectorAll('.match-column');

    matchColumns.forEach(matchColumn => {
        const matchIndex = matchColumn.dataset.match;
        if (!matchIndex) {
            // console.warn("[Matches] Match column found without 'data-match' attribute.", matchColumn);
            return;
        }

        const winnerBtns = matchColumn.querySelectorAll('.winner-btn');
        winnerBtns.forEach(btn => {
            // Простая проверка, чтобы не навешивать слушатель многократно, если функция вызовется снова
            if (btn.dataset.winnerListenerAttached === 'true') {
                return;
            }
            btn.dataset.winnerListenerAttached = 'true'; // Помечаем, что слушатель добавлен

            btn.addEventListener('click', () => {
                const selectedTeamKey = btn.dataset.team; // "TEAM1" or "TEAM2"
                if (!selectedTeamKey) {
                    console.warn("[Matches] Winner button clicked without 'data-team' attribute.", btn);
                    return;
                }

                const currentWinnerKey = matchColumn.getAttribute('data-winner');

                if (currentWinnerKey === selectedTeamKey) {
                    // Кликнули по уже выбранному победителю - снимаем выбор
                    matchColumn.removeAttribute('data-winner');
                    // console.log(`[Matches] Winner ${selectedTeamKey} deselected for match ${matchIndex}`);
                } else {
                    // Выбираем нового победителя
                    matchColumn.setAttribute('data-winner', selectedTeamKey);
                    // console.log(`[Matches] Winner set to ${selectedTeamKey} for match ${matchIndex}`);
                }
                refreshWinnerHighlight(matchIndex); // Обновляем подсветку в любом случае
            });
        });
    });
}

/**
 * Обновляет подсветку (класс 'winner-selected') кнопок победителя
 * на основе атрибута 'data-winner' у родительской колонки матча.
 * @param {string|number} matchIndex - Индекс матча (1-4).
 */
export function refreshWinnerHighlight(matchIndex) {
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) {
        // console.warn(`[Matches] Match column ${matchIndex} not found for refreshing winner highlight.`);
        return;
    }

    const winnerTeamKey = matchColumn.getAttribute("data-winner"); // Может быть "TEAM1", "TEAM2", или null

    const winnerBtn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
    const winnerBtn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');

    if (winnerBtn1) {
        // Метод toggle удобен: добавляет класс, если условие true, и удаляет, если false.
        winnerBtn1.classList.toggle('winner-selected', winnerTeamKey === "TEAM1");
    }
    if (winnerBtn2) {
        winnerBtn2.classList.toggle('winner-selected', winnerTeamKey === "TEAM2");
    }
    // console.log(`[Matches] Winner highlight refreshed for match ${matchIndex}. Winner: ${winnerTeamKey || 'None'}`);
}

// ----------------------
// Обработчики изменения статуса матча
// ----------------------
export function attachStatusChangeHandlers() {
    document.querySelectorAll('.status-select').forEach(select => {
        if (select.dataset.statusListenerAttached === 'true') return; // Предотвращаем дублирование
        select.dataset.statusListenerAttached = 'true';

        select.addEventListener('change', function() {
            updateStatusColor(this); // Обновляем цвет самого селекта
            const matchColumn = this.closest('.match-column');
            if (matchColumn) {
                const newStatus = this.value.toLowerCase();
                // Удаляем все классы статусов и добавляем текущий
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (newStatus) { // Добавляем, только если статус не пустой
                    matchColumn.classList.add(`status-${newStatus}`);
                }
            }
        });
        // Инициализация цвета и класса колонки при загрузке/перерисовке
        updateStatusColor(select);
        const matchColumnOnInit = select.closest('.match-column');
        if (matchColumnOnInit) {
            const currentStatus = select.value.toLowerCase();
            matchColumnOnInit.classList.remove('status-upcom', 'status-live', 'status-finished');
            if (currentStatus) {
                 matchColumnOnInit.classList.add(`status-${currentStatus}`);
            }
        }
    });
    // console.log("[Matches] Status change handlers attached.");
}

/**
 * Обновляет цвет фона селекта статуса в зависимости от выбранного значения.
 * @param {HTMLSelectElement} selectElement - Элемент select статуса.
 */
export function updateStatusColor(selectElement) {
    if (!selectElement) return;
    // Удаляем все предыдущие классы цвета
    selectElement.classList.remove('status-upcom-selected', 'status-live-selected', 'status-finished-selected');
    const status = selectElement.value; // UPCOM, LIVE, FINISHED
    if (status) { // Добавляем класс, только если статус выбран
        selectElement.classList.add(`status-${status.toLowerCase()}-selected`);
    }
}

// --------------------------------------------------
// Сбор данных одного матча для отправки на сервер
// --------------------------------------------------
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const SCORE_REGEX = /^\d+:\d+$/;
    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.error(`[Matches] Не удалось найти колонку для матча ${m} при сборе данных.`);
        return null;
    }

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
    const team1Logo = team1Data && team1Data.element && team1Data.element.dataset.logo ? team1Data.element.dataset.logo : defaultLogoPath;
    const team2Logo = team2Data && team2Data.element && team2Data.element.dataset.logo ? team2Data.element.dataset.logo : defaultLogoPath;

    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
        const mapSelect = row.querySelector(".map-name-select");
        const scoreInput = row.querySelector(".map-score-input");
        maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
        maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Автозаполнение счета карт в зависимости от статуса
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);
        if (isScore1Numeric && !isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) { // Если есть счет на 1-й, нет на 2-й и 3-й
            maps.MAP2_SCORE = "NEXT";
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "DECIDER"; // Только если 3-я карта выбрана
            else maps.MAP3_SCORE = "";
        } else if (isScore1Numeric && isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) { // Если есть счет на 1-й и 2-й, нет на 3-й
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "NEXT"; // Только если 3-я карта выбрана
             else maps.MAP3_SCORE = "";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        // Если 2 карты сыграны со счетом, а 3-я нет или не выбрана, она DECIDER (если она вообще должна была быть)
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && maps.MAP3 && maps.MAP3 !== "-" && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE && maps.MAP1 && maps.MAP1 !== "-") maps.MAP1_SCORE = "NEXT";
        if ((!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE === "DECIDER") && maps.MAP3 && maps.MAP3 !== "-") {
            maps.MAP3_SCORE = `MATCH ${m}`; // Или просто "DECIDER", если не привязано к номеру матча
        }
    }

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";
    const noneIconPath = "/images/none_score_icon.png";
    const mpLIconPath = "/images/mp_L.png";
    const mpRIconPath = "/images/mp_R.png";
    const mpNoneIconPath = "/images/mp_none.png";

    if (statusText === "UPCOM") { MP1_UPC = MP2_UPC = MP3_UPC = noneIconPath; }
    else if (statusText === "LIVE") {
        MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
        MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
        MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
    } else if (statusText === "FINISHED") {
        MP1_FIN = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
        MP2_FIN = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
        MP3_FIN = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath);
    }

    const winnerKey = column.getAttribute("data-winner") || ""; // Получаем победителя из UI
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPath;
    if (winnerKey === "TEAM1" && team1Name) { teamWinner = team1Name; teamWinnerLogo = team1Logo; }
    else if (winnerKey === "TEAM2" && team2Name) { teamWinner = team2Name; teamWinnerLogo = team2Logo; }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED" && teamWinner) { // Добавлено условие teamWinner для отображения этих полей
        finCest = "cest"; finResult = "Result"; finVictory = "VICTORY";
    }


    const liveStatusValue = statusText === "LIVE" ? "/images/live_icon.png" : defaultLogoPath;
    const liveBgValue = statusText === "LIVE" ? "/images/LIVEBG.png" : defaultLogoPath;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "/images/ongoing_icon.png" : defaultLogoPath;
    const liveRectUp = statusText === "LIVE" ? "/images/live_rectUp.png" : noneIconPath;
    const liveRectLow = statusText === "LIVE" ? "/images/live_rectLow.png" : noneIconPath;
    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? "/images/rectUp.png" : defaultLogoPath;
    const upcomRectLow = statusText === "UPCOM" ? "/images/rectLow.png" : defaultLogoPath;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "/images/bg_next_upcom.png" : "";
    const finRectUp = statusText === "FINISHED" ? "/images/fin_rectUp.png" : noneIconPath;
    const finRectLow = statusText === "FINISHED" ? "/images/fin_rectLow.png" : noneIconPath;

    const upcomObj = {
        UPCOM_MATCH_STATUS: statusText === "UPCOM" ? "UPCOM" : "", UPCOM_TIME: statusText === "UPCOM" && timeVal ? `${timeVal} CEST` : "",
        UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "", UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
        UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLogoPath, UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLogoPath,
        UPCOM_MAP1: statusText === "UPCOM" ? maps.MAP1 : "", UPCOM_MAP1_SCORE: statusText === "UPCOM" ? maps.MAP1_SCORE : "",
        UPCOM_MAP2: statusText === "UPCOM" ? maps.MAP2 : "", UPCOM_MAP2_SCORE: statusText === "UPCOM" ? maps.MAP2_SCORE : "",
        UPCOM_MAP3: statusText === "UPCOM" ? maps.MAP3 : "", UPCOM_MAP3_SCORE: statusText === "UPCOM" ? maps.MAP3_SCORE : "",
        UPCOM_Cest: upcomCestValue, UPCOM_RectangleUP: upcomRectUp, UPCOM_RectangleLOW: upcomRectLow,
        UPCOM_vs_mini: upcomVsMiniValue, UPCOM_vs_big: upcomVsBigValue, UPCOM_next: statusText === "UPCOM" && maps.MAP1_SCORE === "NEXT" ? "NEXT" : "", UPCOM_next_photo: upcomNextPhotoValue
    };
    const liveObj = {
        LIVE_MATCH_STATUS: statusText === "LIVE" ? "LIVE" : "", LIVE_TIME: statusText === "LIVE" ? timeVal : "",
        LIVE_TEAM1: statusText === "LIVE" ? team1Name : "", LIVE_TEAM2: statusText === "LIVE" ? team2Name : "",
        LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogoPath, LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogoPath,
        LIVE_MAP1: statusText === "LIVE" ? maps.MAP1 : "", LIVE_MAP1_SCORE: statusText === "LIVE" ? maps.MAP1_SCORE : "",
        LIVE_MAP2: statusText === "LIVE" ? maps.MAP2 : "", LIVE_MAP2_SCORE: statusText === "LIVE" ? maps.MAP2_SCORE : "",
        LIVE_MAP3: statusText === "LIVE" ? maps.MAP3 : "", LIVE_MAP3_SCORE: statusText === "LIVE" ? maps.MAP3_SCORE : "",
        LIVE_Cest: liveCestValue, LIVE_VS: liveVs, LIVE_STATUS: liveStatusValue, LIVE_BG: liveBgValue,
        LIVE_RectangleUP: liveRectUp, LIVE_RectangleLOW: liveRectLow
    };
    const finishedObj = {
        FINISHED_MATCH_STATUS: statusText === "FINISHED" ? "FINISHED" : "", FINISHED_TIME: statusText === "FINISHED" && timeVal ? `${timeVal} CEST` : "",
        FINISHED_TEAM1: statusText === "FINISHED" ? team1Name : "", FINISHED_TEAM2: statusText === "FINISHED" ? team2Name : "",
        FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLogoPath, FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLogoPath,
        FINISHED_MAP1: statusText === "FINISHED" ? maps.MAP1 : "", FINISHED_MAP1_SCORE: statusText === "FINISHED" ? maps.MAP1_SCORE : "",
        FINISHED_MAP2: statusText === "FINISHED" ? maps.MAP2 : "", FINISHED_MAP2_SCORE: statusText === "FINISHED" ? maps.MAP2_SCORE : "",
        FINISHED_MAP3: statusText === "FINISHED" ? maps.MAP3 : "", FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "",
        FIN_RectangleUP: finRectUp, FIN_RectangleLOW: finRectLow
    };

    const perMapLogos = {};
    [1, 2, 3].forEach(i => {
        const sc = maps[`MAP${i}_SCORE`];
        const isNum = SCORE_REGEX.test(sc);
        const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
        perMapLogos[`MAP${i}_TEAM1logo`] = show && team1Name ? team1Logo : defaultLogoPath;
        perMapLogos[`MAP${i}_TEAM2logo`] = show && team2Name ? team2Logo : defaultLogoPath;
    });

    const matchLogos = {}; // Логотипы для конкретных матчей, если нужны (например, FINISHED_TEAM1_LOGO_MATCH1)
    if (statusText === "FINISHED") {
        matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = team1Logo;
        matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = team2Logo;
    } else {
        matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = defaultLogoPath;
        matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = defaultLogoPath;
    }
    if (statusText === "LIVE") {
        matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = team1Logo;
        matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = team2Logo;
    } else {
        matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = defaultLogoPath;
        matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = defaultLogoPath;
    }

    const matchObj = {
        ...upcomObj, ...liveObj, ...finishedObj,
        MP1_UPC, MP2_UPC, MP3_UPC,
        MP1_LIVE, MP2_LIVE, MP3_LIVE,
        MP1_FIN, MP2_FIN, MP3_FIN,
        Fin_cest: finCest, FIN_Result: finResult, FIN_VICTORY: finVictory,
        TEAMWINNER: teamWinner, // Из UI (data-winner)
        TEAMWINNER_LOGO: teamWinnerLogo, // Из UI (data-winner)
        ...matchLogos, ...perMapLogos
    };
    return matchObj;
}

// ----------------------
// Помощник для иконок счета карты (L/R/None)
// ----------------------
function getScoreIcon(scoreStr, lPath, rPath, mpNonePath, nonePath) {
    if (!scoreStr || typeof scoreStr !== 'string') return nonePath;
    const parts = scoreStr.split(':');
    if (parts.length === 2) {
        const score1 = parseInt(parts[0], 10);
        const score2 = parseInt(parts[1], 10);
        if (!isNaN(score1) && !isNaN(score2)) { // Если это числовой счет
            if (score1 > score2) return lPath;  // Команда 1 выиграла
            if (score2 > score1) return rPath;  // Команда 2 выиграла
            return mpNonePath; // Ничья или счет 0:0
        }
    }
    // Если не числовой счет (например, "NEXT", "DECIDER", пустая строка)
    return nonePath;
}