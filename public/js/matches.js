// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;

// Глобальная переменная для дефолтного локального логотипа.
// Убедитесь, что этот путь правильный и файл существует.
// Двойные обратные слеши (\\\\) в строке JavaScript представляют один обратный слеш (\) в пути.
const DEFAULT_LOCAL_LOGO_PATH = "C:\\\\projects\\\\vMix_score\\\\public\\\\logos\\\\none.png";

// ----------------------
// Инициализация всего
// ----------------------
/**
 * Инициализирует блок матчей: загружает список команд, заполняет селекты,
 * привязывает обработчики событий. Возвращает Promise, который разрешается
 * после завершения инициализации.
 * @returns {Promise<void>}
 */
export async function initMatches() {
    if (teamsInitializationPromise) {
        return teamsInitializationPromise;
    }

    teamsInitializationPromise = new Promise(async (resolve, reject) => {
        console.log("[Matches] Starting teams initialization...");
        try {
            const response = await fetch("/api/teams"); // Используется локальный API
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
                console.warn("[Matches] Team list is empty or not received from /api/teams.");
            }

            populateTeamSelects(teamsList);
            attachTeamLogoUpdates();
            attachWinnerButtons();
            attachStatusChangeHandlers();

            for (let m = 1; m <= 4; m++) {
                updateWinnerButtonLabels(m);
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById("statusSelect" + m);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }

            if (typeof io !== 'undefined') {
                const socket = io();
                socket.on('teamsUpdate', (updatedTeams) => {
                    console.log('[SOCKET][Matches] Received teamsUpdate:', updatedTeams);
                    populateTeamSelects(Array.isArray(updatedTeams) ? updatedTeams : []);
                    for (let m = 1; m <= 4; m++) {
                        updateWinnerButtonLabels(m);
                    }
                });
                console.log('[Matches] Socket listener for "teamsUpdate" attached.');
            } else {
                console.warn("[Matches] Socket.IO client not found. Real-time team updates on this page might not work.");
            }

            teamsInitialized = true;
            console.log("[Matches] Teams initialization completed.");
            resolve();

        } catch (err) {
            console.error("[Matches] Error during initialization:", err);
            const errorDisplayElement = document.getElementById('teamsLoadingError'); // Предполагается, что такой элемент есть для отображения ошибок
            if (errorDisplayElement) {
                errorDisplayElement.textContent = `Ошибка загрузки команд: ${err.message}.`;
                errorDisplayElement.style.color = 'red';
            }
            reject(err);
        }
    });

    return teamsInitializationPromise;
}

/**
 * Проверяет, завершена ли инициализация списка команд.
 * @returns {boolean}
 */
export function areTeamsInitialized() {
    return teamsInitialized;
}

// ----------------------
// Заполнение селектов команд
// ----------------------
/**
 * Заполняет элементы <select> для выбора команд 1 и 2 во всех матчах.
 * @param {Array<object>} teamsList - Массив объектов команд { name: string, logo: string }.
 */
export function populateTeamSelects(teamsList) {
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-";
    defaultOption.dataset.logo = DEFAULT_LOCAL_LOGO_PATH;

    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById("team1Select" + m);
        const sel2 = document.getElementById("team2Select" + m);
        if (!sel1 || !sel2) continue;

        const currentVal1 = sel1.value;
        const currentVal2 = sel2.value;

        sel1.innerHTML = "";
        sel2.innerHTML = "";

        sel1.appendChild(defaultOption.cloneNode(true));
        sel2.appendChild(defaultOption.cloneNode(true));

        teamsList.forEach(team => {
            if (!team.name) return;

            const opt = document.createElement("option");
            opt.value = team.name;
            opt.textContent = team.name;
            
            // Логика для логотипа команды, обрабатывающая полные и относительные пути.
            // Убедитесь, что базовый путь для относительных лого "C:\\\\projects\\\\vMix_score\\\\public" корректен.
            opt.dataset.logo = team.logo 
                ? (team.logo.startsWith('C:\\') 
                    ? team.logo
                    : "C:\\\\projects\\\\vMix_score\\\\public" + (team.logo.startsWith('/') ? team.logo.replace(/\//g, '\\\\') : '\\\\' + team.logo.replace(/\//g, '\\\\')))
                : DEFAULT_LOCAL_LOGO_PATH;
            
            sel1.appendChild(opt.cloneNode(true));
            sel2.appendChild(opt.cloneNode(true));
        });

        if (sel1.querySelector(`option[value="${CSS.escape(currentVal1)}"]`)) {
            sel1.value = currentVal1;
        } else {
            sel1.value = ""; 
        }
        if (sel2.querySelector(`option[value="${CSS.escape(currentVal2)}"]`)) {
            sel2.value = currentVal2;
        } else {
            sel2.value = "";
        }
    }
    console.log("[Matches] Team selects populated/repopulated.");
}

// ----------------------
// Обновление лейблов кнопок и логотипов (если используются)
// ----------------------
export function attachTeamLogoUpdates() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById("team1Select" + m);
        const sel2 = document.getElementById("team2Select" + m);
        if (!sel1 || !sel2) continue;
        
        const updateHandler = () => updateWinnerButtonLabels(m);

        // Удаляем старые слушатели, если они были, перед добавлением новых
        sel1.removeEventListener("change", updateHandler);
        sel1.addEventListener("change", updateHandler);
        sel2.removeEventListener("change", updateHandler);
        sel2.addEventListener("change", updateHandler);
    }
}

export function updateWinnerButtonLabels(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const name1 = sel1 && sel1.value ? sel1.value : "Team 1";
    const name2 = sel2 && sel2.value ? sel2.value : "Team 2";

    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return;
    const btn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
    const btn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');
    if (btn1) btn1.textContent = `Победитель: ${name1}`;
    if (btn2) btn2.textContent = `Победитель: ${name2}`;
}

// ----------------------
// Кнопки Winner и подсветка
// ----------------------
export function attachWinnerButtons() {
    document.querySelectorAll(".winner-btn").forEach(btn => {
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

export function refreshWinnerHighlight(matchIndex) {
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return;
    const winner = matchColumn.getAttribute("data-winner");
    matchColumn.querySelectorAll(".winner-btn").forEach(b => {
        b.classList.toggle("winner-selected", b.getAttribute("data-team") === winner);
    });
}

// ----------------------
// Обработчики изменения статуса
// ----------------------
export function attachStatusChangeHandlers() {
    for (let m = 1; m <= 4; m++) {
        const sel = document.getElementById("statusSelect" + m);
        if (!sel) continue;
        
        const eventHandler = function() { // Используем function для this
            updateStatusColor(this); 
            const matchColumn = this.closest('.match-column');
            if (matchColumn) {
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if(this.value) matchColumn.classList.add(`status-${this.value.toLowerCase()}`);

                const currentMatchIndex = matchColumn.dataset.match;
                if (this.value === 'UPCOM') {
                    const mapRows = matchColumn.querySelectorAll('.map-row');
                    if (mapRows.length >= 3) { 
                        const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                        if (thirdMapScoreInput && !thirdMapScoreInput.value) { // Заполняем только если пусто
                            thirdMapScoreInput.value = `MATCH ${currentMatchIndex}`;
                            thirdMapScoreInput.placeholder = `MATCH ${currentMatchIndex}`;
                        }
                    }
                } else {
                    const mapRows = matchColumn.querySelectorAll('.map-row');
                    if (mapRows.length >= 3) {
                        const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                        if (thirdMapScoreInput && thirdMapScoreInput.value === `MATCH ${currentMatchIndex}`) {
                            thirdMapScoreInput.value = "";
                            thirdMapScoreInput.placeholder = "0:0"; 
                        }
                    }
                }
            }
        };

        if (sel.dataset.statusListenerAttached === 'true') {
            sel.removeEventListener("change", sel._eventHandlerRef); // Удаляем старый, если есть ссылка
        }
        sel.addEventListener("change", eventHandler);
        sel._eventHandlerRef = eventHandler; // Сохраняем ссылку на обработчик
        sel.dataset.statusListenerAttached = 'true';
    }
}

export function updateStatusColor(sel) {
    if (!sel) return; 
    const v = sel.value.toUpperCase(); 
    let color;
    let textColor = '#fff'; // По умолчанию белый текст

    switch (v) {
        case "UPCOM":    color = "var(--color-upcom, #FFA500)"; break;
        case "LIVE":     color = "var(--color-live, #FF0000)"; break;
        case "FINISHED": color = "var(--color-text-muted, #6c757d)"; break;
        default:         color = "var(--color-surface-light, #f8f9fa)"; textColor = '#000'; // Для светлого фона - черный текст
    }
    sel.style.backgroundColor = color;
    sel.style.color = textColor; 
    sel.style.borderColor = color; 
}

// --------------------------------------------------
// Сбор данных ОДНОГО матча
// --------------------------------------------------
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const defaultLocalLogo = DEFAULT_LOCAL_LOGO_PATH; 
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

    const selTeam1 = document.getElementById("team1Select" + m);
    const selTeam2 = document.getElementById("team2Select" + m); // ИСПРАВЛЕНО

    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    const getLogoFromSelect = (selectElement) => {
        if (selectElement && selectElement.selectedIndex >= 0 && selectElement.options[selectElement.selectedIndex]) {
            return selectElement.options[selectElement.selectedIndex].dataset.logo || defaultLocalLogo;
        }
        return defaultLocalLogo;
    };
    const team1Logo = getLogoFromSelect(selTeam1);
    const team2Logo = getLogoFromSelect(selTeam2);

    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
        const mapSelect = row.querySelector(".map-name-select");
        const scoreInput = row.querySelector(".map-score-input");
        maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
        maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Логика автозаполнения счета карт
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);

        if (isScore1Numeric && !isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP2_SCORE = "NEXT";
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "DECIDER";
            else if (maps.MAP3_SCORE === `MATCH ${m}`) maps.MAP3_SCORE = "DECIDER"; // Если было автозаполнено для UPCOM
            else maps.MAP3_SCORE = "";
        } else if (isScore1Numeric && isScore2Numeric && (!s3 || !SCORE_REGEX.test(s3))) {
            if (maps.MAP3 && maps.MAP3 !== "-") maps.MAP3_SCORE = "NEXT";
            else if (maps.MAP3_SCORE === `MATCH ${m}`) maps.MAP3_SCORE = "NEXT"; // Если было автозаполнено для UPCOM
            else maps.MAP3_SCORE = "";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && maps.MAP3 && maps.MAP3 !== "-" && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE && maps.MAP1 && maps.MAP1 !== "-") maps.MAP1_SCORE = "NEXT";
        if (maps.MAP3 && maps.MAP3 !== "-" && 
            (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE === "DECIDER" || maps.MAP3_SCORE === "NEXT")) { 
            maps.MAP3_SCORE = `MATCH ${m}`;
        } else if (!maps.MAP3 || maps.MAP3 === "-") {
            maps.MAP3_SCORE = "";
        }
    }

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";
    
    const basePathForScoreIcons = "C:\\\\projects\\\\NewTimer\\\\files";

    if (statusText === "UPCOM") {
        MP1_UPC = MP2_UPC = MP3_UPC = `${basePathForScoreIcons}\\\\none_score_icon.png`;
    } else if (statusText === "LIVE") {
        MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, basePathForScoreIcons);
        MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, basePathForScoreIcons);
        MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, basePathForScoreIcons);
    } else if (statusText === "FINISHED") {
        MP1_FIN = getScoreIcon(maps.MAP1_SCORE, basePathForScoreIcons);
        MP2_FIN = getScoreIcon(maps.MAP2_SCORE, basePathForScoreIcons);
        MP3_FIN = getScoreIcon(maps.MAP3_SCORE, basePathForScoreIcons);
    }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

    const winnerKey = column.getAttribute("data-winner") || ""; 
    let teamWinner = "";
    let teamWinnerLogo = defaultLocalLogo;
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) { 
            teamWinner = team1Name;
            teamWinnerLogo = team1Logo;
        } else if (winnerKey === "TEAM2" && team2Name) {
            teamWinner = team2Name;
            teamWinnerLogo = team2Logo;
        }
    }
    
    const basePathForMatchImages = "C:\\\\projects\\\\NewTimer\\\\files";
    const defaultMatchImageNone = `${basePathForMatchImages}\\\\none_score_icon.png`; // Заглушка для изображений матча

    const liveStatusValue = statusText === "LIVE" ? `${basePathForMatchImages}\\\\live_icon.png` : defaultLocalLogo;
    const liveBgValue = statusText === "LIVE" ? `${basePathForMatchImages}\\\\LIVEBG.png` : defaultLocalLogo;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? `${basePathForMatchImages}\\\\ongoing_icon.png` : defaultLocalLogo;
    const liveRectUp = statusText === "LIVE" ? `${basePathForMatchImages}\\\\live_rectUp.png` : defaultMatchImageNone;
    const liveRectLow = statusText === "LIVE" ? `${basePathForMatchImages}\\\\live_rectLow.png` : defaultMatchImageNone;

    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    // Для UPCOM используем defaultLocalLogo если не активно, так как это логотип-заглушка по смыслу
    const upcomRectUp = statusText === "UPCOM" ? `${basePathForMatchImages}\\\\rectUp.png` : defaultLocalLogo;
    const upcomRectLow = statusText === "UPCOM" ? `${basePathForMatchImages}\\\\rectLow.png` : defaultLocalLogo;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? `${basePathForMatchImages}\\\\bg_next_upcom.png` : "";

    const finRectUp = statusText === "FINISHED" ? `${basePathForMatchImages}\\\\fin_rectUp.png` : defaultMatchImageNone;
    const finRectLow = statusText === "FINISHED" ? `${basePathForMatchImages}\\\\fin_rectLow.png` : defaultMatchImageNone;
    
    const upcomObj = {
        UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
        UPCOM_TIME: statusText === "UPCOM" ? (timeVal ? timeVal + " CEST" : "") : "",
        UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "",
        UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
        UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLocalLogo,
        UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLocalLogo,
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
        UPCOM_next: (statusText === "UPCOM" && maps.MAP1_SCORE === "NEXT") ? "NEXT" : "",
        UPCOM_next_photo: upcomNextPhotoValue
    };

    const liveObj = {
        LIVE_MATCH_STATUS: statusText === "LIVE" ? statusText : "",
        LIVE_TIME: statusText === "LIVE" ? timeVal : "",
        LIVE_TEAM1: statusText === "LIVE" ? team1Name : "",
        LIVE_TEAM2: statusText === "LIVE" ? team2Name : "",
        LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLocalLogo,
        LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLocalLogo,
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
        FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLocalLogo,
        FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLocalLogo,
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
        perMapLogos[`MAP${i}_TEAM1logo`] = show && team1Name ? team1Logo : defaultLocalLogo;
        perMapLogos[`MAP${i}_TEAM2logo`] = show && team2Name ? team2Logo : defaultLocalLogo;
    });

    const matchLogos = {};
    matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = (statusText === "FINISHED" && team1Name) ? team1Logo : defaultLocalLogo;
    matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = (statusText === "FINISHED" && team2Name) ? team2Logo : defaultLocalLogo;
    matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = (statusText === "LIVE" && team1Name) ? team1Logo : defaultLocalLogo;
    matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = (statusText === "LIVE" && team2Name) ? team2Logo : defaultLocalLogo;
    
    const matchObj = {
        ...upcomObj,
        ...liveObj,
        ...finishedObj,
        MP1_UPC, MP2_UPC, MP3_UPC,
        MP1_LIVE, MP2_LIVE, MP3_LIVE,
        MP1_FIN, MP2_FIN, MP3_FIN,
        Fin_cest: finCest,
        FIN_Result: finResult,
        FIN_VICTORY: finVictory,
        TEAMWINNER: teamWinner,
        TEAMWINNER_LOGO: teamWinnerLogo,
        ...matchLogos,
        ...perMapLogos
    };

    return matchObj;
}

// ----------------------
// Помощник для иконок счета
// ----------------------
function getScoreIcon(scoreStr, basePath) {
    const safeBasePath = basePath.endsWith("\\\\") ? basePath : basePath + "\\\\";

    const noneIcon = `${safeBasePath}none_score_icon.png`; 
    const mpNoneIcon = `${safeBasePath}mp_none.png`;
    const mpLIcon = `${safeBasePath}mp_L.png`;
    const mpRIcon = `${safeBasePath}mp_R.png`;

    if (typeof scoreStr !== 'string' || !scoreStr.trim()) return noneIcon;
    if (scoreStr === "NEXT" || scoreStr === "DECIDER" || scoreStr.startsWith("MATCH ")) return noneIcon;

    const parts = scoreStr.split(":");
    if (parts.length !== 2) return mpNoneIcon;

    const left = parseInt(parts[0], 10);
    const right = parseInt(parts[1], 10);

    if (isNaN(left) || isNaN(right)) return noneIcon;
    if (right > left) return mpRIcon;
    if (left > right) return mpLIcon;
    
    return mpNoneIcon;
}