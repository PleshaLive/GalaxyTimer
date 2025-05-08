// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;
const defaultLogoPath = "/logos/none.png"; // Глобальная константа для лого по умолчанию (WEB-ПУТЬ!)

// --- Select2 Template Functions ---
/**
 * Форматирует отображение опции команды в выпадающем списке Select2.
 * @param {Object} team - Данные команды из Select2 (содержит id, text, element).
 * @returns {jQuery|string} - jQuery объект или текст для отображения.
 */
function formatTeamOption(team) {
    if (!team.id) { // Для плейсхолдера типа "- Выбрать -"
        return team.text;
    }
    // team.element - это ссылка на оригинальный <option> элемент
    const logoUrl = team.element && team.element.dataset.logo ? team.element.dataset.logo : defaultLogoPath;

    const $container = $(
        '<span class="select2-team-option">' +
        '<img src="' + logoUrl + '" class="select2-team-logo" alt="' + team.text + ' logo" onerror="this.onerror=null; this.src=\'' + defaultLogoPath + '\';" />' +
        '<span class="select2-team-name">' + team.text + '</span>' +
        '</span>'
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
        '<span class="select2-team-selection">' +
        '<img src="' + logoUrl + '" class="select2-team-logo-selected" alt="' + team.text + ' logo" onerror="this.onerror=null; this.src=\'' + defaultLogoPath + '\';" />' +
        '<span class="select2-team-name-selected">' + team.text + '</span>' +
        '</span>'
    );
    return $container;
}


// ----------------------
// Инициализация всего
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
                    if (errorData && errorData.message) errorText += ` - ${errorData.message}`;
                    else if (typeof errorData === 'string' && errorData.length > 0) errorText += ` - ${errorData.substring(0,100)}`;
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

            populateTeamSelects(teamsList); // Заполняем селекты ДО инициализации Select2
            initSelect2ForTeams(); // Инициализируем Select2 ПОСЛЕ заполнения
            
            // attachTeamLogoUpdates() больше не нужен в прежнем виде, т.к. Select2 сам обновит отображение
            // при изменении, а updateTeamDisplay будет вызываться для обновления кнопок и лого над селектом.
            // Однако, нам все еще нужен слушатель на 'change' для обновления связанных элементов UI
            attachSelect2ChangeListeners(); 

            attachWinnerButtons();
            attachStatusChangeHandlers();

            for (let m = 1; m <= 4; m++) {
                updateTeamDisplay(m); 
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById("statusSelect" + m);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }
            
            console.log("[Matches] Socket listener for 'teamsUpdate' is intentionally disabled.");
            teamsInitialized = true;
            console.log("[Matches] Teams initialization completed using external API for initial load.");
            resolve();

        } catch (err) {
            console.error("[Matches] Error during initialization with external API:", err);
            const errorDisplayElement = document.getElementById('teamsLoadingError');
            if (errorDisplayElement) {
                errorDisplayElement.textContent = `Ошибка загрузки команд: ${err.message}. Пожалуйста, проверьте консоль.`;
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
// Заполнение селектов команд
// ----------------------
export function populateTeamSelects(teamsList) {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-"; // Текст для Select2, если ничего не выбрано
    defaultOption.dataset.logo = defaultLogoPath;

    const externalApiBaseUrl = "https://waywayway-production.up.railway.app";

    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById("team1Select" + m);
        const sel2 = document.getElementById("team2Select" + m);
        if (!sel1 || !sel2) continue;

        // Сохраняем текущие значения, если они есть (Select2 их подхватит)
        const currentVal1 = $(sel1).val();
        const currentVal2 = $(sel2).val();

        // Очищаем старые опции, если Select2 уже был инициализирован и мы его перестраиваем
        if ($(sel1).data('select2')) $(sel1).select2('destroy').empty();
        else $(sel1).empty();
        if ($(sel2).data('select2')) $(sel2).select2('destroy').empty();
        else $(sel2).empty();
        
        sel1.appendChild(defaultOption.cloneNode(true));
        sel2.appendChild(defaultOption.cloneNode(true));

        teamsList.forEach(team => {
            if (!team.name) return;
            const opt = document.createElement("option");
            opt.value = team.name;
            opt.textContent = team.name;

            let logoUrl = defaultLogoPath;
            if (team.logo) {
                if (team.logo.startsWith('http://') || team.logo.startsWith('https://')) {
                    logoUrl = team.logo;
                } else if (team.logo.startsWith('/')) {
                    logoUrl = externalApiBaseUrl + team.logo;
                } else {
                    logoUrl = `${externalApiBaseUrl}/logos/${team.logo.replace(/\.png$/i, '')}.png`;
                }
            }
            opt.dataset.logo = logoUrl;
            sel1.appendChild(opt.cloneNode(true));
            sel2.appendChild(opt.cloneNode(true));
        });

        // Восстанавливаем значение, если оно было
        $(sel1).val(currentVal1 || "").trigger('change.select2'); // trigger change для Select2
        $(sel2).val(currentVal2 || "").trigger('change.select2');
    }
    console.log("[Matches] Team selects populated/repopulated. Ready for Select2 initialization.");
}

/**
 * Инициализирует Select2 для всех селектов команд.
 */
function initSelect2ForTeams() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);

        if (sel1.length) {
            sel1.select2({
                templateResult: formatTeamOption,
                templateSelection: formatTeamSelection,
                width: '100%', // или 'style' или 'resolve'
                placeholder: "-", // Текст плейсхолдера
                allowClear: true, // Позволяет очистить выбор
                dropdownParent: sel1.parent() // Важно для корректного позиционирования в сложных макетах
            });
        }
        if (sel2.length) {
            sel2.select2({
                templateResult: formatTeamOption,
                templateSelection: formatTeamSelection,
                width: '100%',
                placeholder: "-",
                allowClear: true,
                dropdownParent: sel2.parent()
            });
        }
    }
    console.log("[Matches] Select2 initialized for team selects.");
}

/**
 * Привязывает обработчики 'change' к Select2 селектам команд
 * для обновления связанных UI элементов (кнопки победителя, лого над селектом).
 */
function attachSelect2ChangeListeners() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);

        const updateListener = () => {
            updateTeamDisplay(m); // Обновляем лого над селектом и кнопки
            // Логика из main.js для обновления Veto и VRS при изменении команд
            const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
            if (typeof window.updateVetoTeamOptions === 'function' && currentVetoMatchIndex && currentVetoMatchIndex == m) {
                window.updateVetoTeamOptions(String(m));
            }
            if (typeof window.updateVRSTeamNames === 'function') window.updateVRSTeamNames();
        };

        if (sel1.length) sel1.on("change.select2", updateListener);
        if (sel2.length) sel2.on("change.select2", updateListener);
    }
}


// ----------------------
// Обновление отображения команды (логотип и текст кнопки)
// ----------------------
export function updateTeamDisplay(matchIndex) {
    const sel1 = $(`#team1Select${matchIndex}`);
    const sel2 = $(`#team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    // Обновление для Команды 1
    if (sel1.length) {
        const selectedData1 = sel1.select2('data')[0];
        const team1Name = selectedData1 && selectedData1.id ? selectedData1.text : "Team 1";
        const logoUrl1 = selectedData1 && selectedData1.element && selectedData1.element.dataset.logo ? selectedData1.element.dataset.logo : defaultLogoPath;
        
        const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (btn1) btn1.textContent = ` ${team1Name}`;

        if (logo1Img) {
            if (logo1Img.getAttribute('src') !== logoUrl1) {
                logo1Img.src = logoUrl1;
            }
            logo1Img.onerror = () => { if (logo1Img.src !== defaultLogoPath) logo1Img.src = defaultLogoPath; };
        }
    }

    // Обновление для Команды 2
    if (sel2.length) {
        const selectedData2 = sel2.select2('data')[0];
        const team2Name = selectedData2 && selectedData2.id ? selectedData2.text : "Team 2";
        const logoUrl2 = selectedData2 && selectedData2.element && selectedData2.element.dataset.logo ? selectedData2.element.dataset.logo : defaultLogoPath;

        const btn2 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM2"]`);
        if (btn2) btn2.textContent = ` ${team2Name}`;

        if (logo2Img) {
            if (logo2Img.getAttribute('src') !== logoUrl2) {
                logo2Img.src = logoUrl2;
            }
            logo2Img.onerror = () => { if (logo2Img.src !== defaultLogoPath) logo2Img.src = defaultLogoPath; };
        }
    }
}

// Удаляем старую функцию attachTeamLogoUpdates, так как Select2 сам обрабатывает изменения
// export function attachTeamLogoUpdates() { /* ... */ } // <- УДАЛИТЬ ИЛИ ЗАКОММЕНТИРОВАТЬ

// ----------------------
// Кнопки Winner и подсветка (без изменений)
// ----------------------
export function attachWinnerButtons() { /* ... без изменений ... */ }
export function refreshWinnerHighlight(matchIndex) { /* ... без изменений ... */ }

// ----------------------
// Обработчики изменения статуса (без изменений)
// ----------------------
export function attachStatusChangeHandlers() { /* ... без изменений ... */ }
export function updateStatusColor(selectElement) { /* ... без изменений ... */ }

// --------------------------------------------------
// Сбор данных ОДНОГО матча
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

    // Получаем данные из Select2
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

    // ... (остальная часть функции gatherSingleMatchData без изменений, 
    //      так как она уже использует полученные team1Name, team2Name, team1Logo, team2Logo) ...
    // Автозаполнение счета карт
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);
        const isScore3Numeric = SCORE_REGEX.test(s3);

        if (isScore1Numeric && !isScore2Numeric) { maps.MAP2_SCORE = "NEXT"; maps.MAP3_SCORE = "DECIDER"; }
        else if (isScore1Numeric && isScore2Numeric && !isScore3Numeric) { maps.MAP3_SCORE = "NEXT"; }

    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        if (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE === "DECIDER") {
            maps.MAP3_SCORE = `MATCH ${m}`;
        }
    }

    // Определение иконок счета
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

    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPath;
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) { teamWinner = team1Name; teamWinnerLogo = team1Logo; }
        else if (winnerKey === "TEAM2" && team2Name) { teamWinner = team2Name; teamWinnerLogo = team2Logo; }
    }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

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
        UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
        UPCOM_TIME: statusText === "UPCOM" ? (timeVal ? timeVal + " CEST" : "") : "",
        UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "",
        UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
        UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLogoPath,
        UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLogoPath,
        UPCOM_MAP1: statusText === "UPCOM" ? maps.MAP1 : "",
        UPCOM_MAP1_SCORE: statusText === "UPCOM" ? maps.MAP1_SCORE : "",
        UPCOM_MAP2: statusText === "UPCOM" ? maps.MAP2 : "",
        UPCOM_MAP2_SCORE: statusText === "UPCOM" ? maps.MAP2_SCORE : "",
        UPCOM_MAP3: statusText === "UPCOM" ? maps.MAP3 : "",
        UPCOM_MAP3_SCORE: statusText === "UPCOM" ? maps.MAP3_SCORE : "",
        UPCOM_Cest: upcomCestValue,
        UPCOM_RectangleUP: upcomRectUp,
        UPCOM_RectangleLOW: upcomRectLow,
        UPCOM_vs_mini: upcomVsMiniValue,
        UPCOM_vs_big: upcomVsBigValue,
        UPCOM_next: "",
        UPCOM_next_photo: upcomNextPhotoValue
    };
    const liveObj = {
        LIVE_MATCH_STATUS: statusText === "LIVE" ? statusText : "",
        LIVE_TIME: statusText === "LIVE" ? timeVal : "",
        LIVE_TEAM1: statusText === "LIVE" ? team1Name : "",
        LIVE_TEAM2: statusText === "LIVE" ? team2Name : "",
        LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogoPath,
        LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogoPath,
        LIVE_MAP1: statusText === "LIVE" ? maps.MAP1 : "",
        LIVE_MAP1_SCORE: statusText === "LIVE" ? maps.MAP1_SCORE : "",
        LIVE_MAP2: statusText === "LIVE" ? maps.MAP2 : "",
        LIVE_MAP2_SCORE: statusText === "LIVE" ? maps.MAP2_SCORE : "",
        LIVE_MAP3: statusText === "LIVE" ? maps.MAP3 : "",
        LIVE_MAP3_SCORE: statusText === "LIVE" ? maps.MAP3_SCORE : "",
        LIVE_Cest: liveCestValue,
        LIVE_VS: liveVs,
        LIVE_STATUS: liveStatusValue,
        LIVE_BG: liveBgValue,
        LIVE_RectangleUP: liveRectUp,
        LIVE_RectangleLOW: liveRectLow
    };
    const finishedObj = {
        FINISHED_MATCH_STATUS: statusText === "FINISHED" ? statusText : "",
        FINISHED_TIME: statusText === "FINISHED" ? (timeVal ? timeVal + " CEST" : "") : "",
        FINISHED_TEAM1: statusText === "FINISHED" ? team1Name : "",
        FINISHED_TEAM2: statusText === "FINISHED" ? team2Name : "",
        FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLogoPath,
        FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLogoPath,
        FINISHED_MAP1: statusText === "FINISHED" ? maps.MAP1 : "",
        FINISHED_MAP1_SCORE: statusText === "FINISHED" ? maps.MAP1_SCORE : "",
        FINISHED_MAP2: statusText === "FINISHED" ? maps.MAP2 : "",
        FINISHED_MAP2_SCORE: statusText === "FINISHED" ? maps.MAP2_SCORE : "",
        FINISHED_MAP3: statusText === "FINISHED" ? maps.MAP3 : "",
        FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "",
        FIN_RectangleUP: finRectUp,
        FIN_RectangleLOW: finRectLow
    };

    const perMapLogos = {};
    [1, 2, 3].forEach(i => {
        const sc = maps[`MAP${i}_SCORE`];
        const isNum = SCORE_REGEX.test(sc);
        const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
        perMapLogos[`MAP${i}_TEAM1logo`] = show ? team1Logo : defaultLogoPath;
        perMapLogos[`MAP${i}_TEAM2logo`] = show ? team2Logo : defaultLogoPath;
    });

    const matchLogos = {};
    const showFinishedLogos = statusText === "FINISHED";
    const showLiveLogos = statusText === "LIVE";
    matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = showFinishedLogos ? team1Logo : defaultLogoPath;
    matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = showFinishedLogos ? team2Logo : defaultLogoPath;
    matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = showLiveLogos ? team1Logo : defaultLogoPath;
    matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = showLiveLogos ? team2Logo : defaultLogoPath;
    
    const matchObj = {
        ...upcomObj, ...liveObj, ...finishedObj,
        MP1_UPC, MP2_UPC, MP3_UPC,
        MP1_LIVE, MP2_LIVE, MP3_LIVE,
        MP1_FIN, MP2_FIN, MP3_FIN,
        Fin_cest: finCest,
        FIN_Result: finResult,
        FIN_VICTORY: finVictory,
        TEAMWINNER: teamWinner,
        TEAMWINNER_LOGO: teamWinnerLogo,
        ...matchLogos, ...perMapLogos
    };
    return matchObj;
}


// ----------------------
// Помощник для иконок счета (без изменений)
// ----------------------
function getScoreIcon(scoreStr, lPath, rPath, mpNonePath, nonePath) { /* ... без изменений ... */ }