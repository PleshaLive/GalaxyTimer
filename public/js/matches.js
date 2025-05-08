// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;

// ----------------------
// Инициализация всего
// ----------------------
/**
 * Инициализирует блок матчей: загружает список команд с ВНЕШНЕГО API,
 * заполняет селекты, привязывает обработчики событий.
 * Возвращает Promise, который разрешается после завершения инициализации.
 * @returns {Promise<void>}
 */
export async function initMatches() {
    // Если инициализация уже идет или завершена, возвращаем существующий промис
    if (teamsInitializationPromise) {
        return teamsInitializationPromise;
    }

    // Создаем новый промис
    teamsInitializationPromise = new Promise(async (resolve, reject) => {
        console.log("[Matches] Starting teams initialization from external API...");
        try {
            // Загружаем список команд с ВНЕШНЕГО сервера
            const response = await fetch("https://waywayway-production.up.railway.app/api/teams");
            if (!response.ok) {
                let errorText = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorText += ` - ${errorData.message}`;
                    } else if (typeof errorData === 'string' && errorData.length > 0) {
                        errorText += ` - ${errorData.substring(0,100)}`;
                    }
                } catch (e) {
                    const textResponse = await response.text().catch(() => "");
                    if(textResponse){
                        errorText += ` - Server response: ${textResponse.substring(0,100)}`;
                    }
                }
                throw new Error(errorText);
            }
            const data = await response.json();
            const teamsList = Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);

            if (teamsList.length === 0) {
                console.warn("[Matches] Team list is empty or not received from the external API (https://waywayway-production.up.railway.app/api/teams).");
            }

            populateTeamSelects(teamsList);
            attachTeamLogoUpdates(); // Настраивает слушатели, которые вызовут updateTeamDisplay
            attachWinnerButtons();
            attachStatusChangeHandlers();

            // Первоначальное обновление UI для всех матчей после загрузки списка команд
            for (let m = 1; m <= 4; m++) {
                updateTeamDisplay(m); // Устанавливаем текст кнопок и логотипы
                refreshWinnerHighlight(m);
                const statusSelectElement = document.getElementById("statusSelect" + m);
                if (statusSelectElement) {
                    updateStatusColor(statusSelectElement);
                }
            }
            
            console.log("[Matches] Socket listener for 'teamsUpdate' is intentionally disabled to rely solely on the external API for team data.");

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
    defaultOption.dataset.logo = "/logos/none.png"; // ИСПОЛЬЗУЙТЕ WEB-ДОСТУПНЫЙ ПУТЬ

    const externalApiBaseUrl = "https://waywayway-production.up.railway.app";

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

            const opt1 = document.createElement("option");
            opt1.value = team.name;
            opt1.textContent = team.name;

            let logoUrl = defaultOption.dataset.logo; 
            if (team.logo) {
                if (team.logo.startsWith('http://') || team.logo.startsWith('https://')) {
                    logoUrl = team.logo;
                } else if (team.logo.startsWith('/')) {
                    logoUrl = externalApiBaseUrl + team.logo;
                } else {
                    // Если это просто имя файла, можно попытаться сформировать URL, 
                    // но для надежности лучше, если API вернет полный или относительный web-путь
                    // console.warn(`[Matches] Unexpected logo format for team ${team.name}: ${team.logo}. Using default.`);
                    // Пока оставляем заглушку, если формат неизвестен
                     logoUrl = `${externalApiBaseUrl}/logos/${team.logo}`; // Пример, если это только имя файла
                }
            }
            opt1.dataset.logo = logoUrl;
            sel1.appendChild(opt1);
            sel2.appendChild(opt1.cloneNode(true)); // Клонируем с dataset.logo
        });

        if (currentVal1 && sel1.querySelector(`option[value="${CSS.escape(currentVal1)}"]`)) {
            sel1.value = currentVal1;
        } else if (sel1.options.length > 0) {
            sel1.value = "";
        }
        if (currentVal2 && sel2.querySelector(`option[value="${CSS.escape(currentVal2)}"]`)) {
            sel2.value = currentVal2;
        } else if (sel2.options.length > 0) {
            sel2.value = "";
        }
    }
    console.log("[Matches] Team selects populated/repopulated with external API URLs.");
}


// ----------------------
// Обновление отображения команды (логотип и текст кнопки)
// ----------------------
/**
 * Обновляет текст на кнопках выбора победителя и src у логотипов,
 * используя текущие выбранные имена и лого команд в селектах.
 * @param {number} matchIndex - Индекс матча (1-4).
 */
export function updateTeamDisplay(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    const defaultLogoSrc = "/logos/none.png"; // Web-доступный путь к логотипу по умолчанию

    if (sel1) {
        const team1Name = sel1.value ? sel1.value : "Team 1";
        const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (btn1) btn1.textContent = ` ${team1Name}`;

        if (logo1Img) {
            const selectedOption1 = sel1.options[sel1.selectedIndex];
            const logoUrl1 = (selectedOption1 && selectedOption1.dataset.logo) ? selectedOption1.dataset.logo : defaultLogoSrc;
            if (logo1Img.src !== logoUrl1) {
                logo1Img.src = logoUrl1;
            }
            logo1Img.onerror = () => { if (logo1Img.src !== defaultLogoSrc) logo1Img.src = defaultLogoSrc; };
        }
    }

    if (sel2) {
        const team2Name = sel2.value ? sel2.value : "Team 2";
        const btn2 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM2"]`);
        if (btn2) btn2.textContent = ` ${team2Name}`;

        if (logo2Img) {
            const selectedOption2 = sel2.options[sel2.selectedIndex];
            const logoUrl2 = (selectedOption2 && selectedOption2.dataset.logo) ? selectedOption2.dataset.logo : defaultLogoSrc;
            if (logo2Img.src !== logoUrl2) {
                logo2Img.src = logoUrl2;
            }
            logo2Img.onerror = () => { if (logo2Img.src !== defaultLogoSrc) logo2Img.src = defaultLogoSrc; };
        }
    }
}


/**
 * Привязывает обработчики событий 'change' к селектам команд
 * для обновления отображения команды (логотип и текст кнопки победителя).
 */
export function attachTeamLogoUpdates() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = document.getElementById(`team1Select${m}`);
        const sel2 = document.getElementById(`team2Select${m}`);
        if (!sel1 || !sel2) continue;

        const updateListener = () => updateTeamDisplay(m);
        sel1.addEventListener("change", updateListener);
        sel2.addEventListener("change", updateListener);
        // Первоначальное обновление будет вызвано в initMatches после populateTeamSelects
    }
}

// ----------------------
// Кнопки Winner и подсветка
// ----------------------
/**
 * Привязывает обработчики кликов к кнопкам выбора победителя.
 * Устанавливает/снимает атрибут data-winner и обновляет подсветку.
 */
export function attachWinnerButtons() {
    document.querySelectorAll(".winner-btn").forEach(btn => {
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
 * Обновляет подсветку кнопок победителя (добавляет/удаляет класс 'winner-selected')
 * на основе атрибута 'data-winner' у родительского элемента .match-column.
 * @param {number} matchIndex - Индекс матча (1-4).
 */
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
/**
 * Привязывает обработчики 'change' к селектам статуса для обновления
 * их цвета, CSS-класса родителя и автозаполнения счета 3-й карты для UPCOM.
 */
export function attachStatusChangeHandlers() {
    for (let m = 1; m <= 4; m++) {
        const sel = document.getElementById("statusSelect" + m);
        if (!sel) continue;
        sel.addEventListener("change", () => {
            updateStatusColor(sel);
            const matchColumn = sel.closest('.match-column');
            if (matchColumn) {
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if(sel.value) matchColumn.classList.add(`status-${sel.value.toLowerCase()}`);

                if (sel.value === 'UPCOM') {
                    const mapRows = matchColumn.querySelectorAll('.map-row');
                    if (mapRows.length >= 3) {
                        const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                        if (thirdMapScoreInput) {
                            thirdMapScoreInput.value = `MATCH ${m}`;
                            thirdMapScoreInput.placeholder = `MATCH ${m}`;
                        }
                    }
                } else {
                    const mapRows = matchColumn.querySelectorAll('.map-row');
                    if (mapRows.length >= 3) {
                        const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                        if (thirdMapScoreInput && thirdMapScoreInput.value === `MATCH ${m}`) {
                            thirdMapScoreInput.value = "";
                            thirdMapScoreInput.placeholder = "-:-"; // Стандартный плейсхолдер
                        }
                    }
                }
            }
        });
    }
}

/**
 * Устанавливает цвет фона и текста для элемента <select> статуса
 * в зависимости от выбранного значения, используя CSS классы.
 * @param {HTMLSelectElement} selectElement - Элемент селекта статуса.
 */
export function updateStatusColor(selectElement) {
    if (!selectElement) {
        console.warn("[updateStatusColor] Element not provided.");
        return;
    }
    
    const selectedValue = selectElement.value.toUpperCase();

    selectElement.classList.remove(
        'status-upcom-selected',
        'status-live-selected',
        'status-finished-selected'
    );
    selectElement.style.backgroundColor = ''; // Сброс инлайновых стилей, если были
    selectElement.style.color = '';
    selectElement.style.borderColor = '';

    switch (selectedValue) {
        case "UPCOM":
            selectElement.classList.add('status-upcom-selected');
            break;
        case "LIVE":
            selectElement.classList.add('status-live-selected');
            break;
        case "FINISHED":
            selectElement.classList.add('status-finished-selected');
            break;
        default:
            // No specific class for default/empty value
            break;
    }
}


// --------------------------------------------------
// Сбор данных ОДНОГО матча
// --------------------------------------------------
/**
 * Собирает все данные для одного матча из соответствующих полей ввода и селектов.
 * Использует URL логотипов, сохраненные в data-атрибутах селектов.
 * @param {number} matchIndex - Индекс матча (1-4).
 * @returns {object | null} - Объект с данными матча или null, если колонка матча не найдена.
 */
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const defaultLogoPlaceholder = "/logos/none.png"; // Web-доступный путь
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
    const selTeam2 = document.getElementById("team2Select" + m);
    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    const team1Logo = selTeam1?.options[selTeam1.selectedIndex]?.dataset.logo || defaultLogoPlaceholder;
    const team2Logo = selTeam2?.options[selTeam2.selectedIndex]?.dataset.logo || defaultLogoPlaceholder;

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
        const isScore3Numeric = SCORE_REGEX.test(s3);

        if (isScore1Numeric && !isScore2Numeric) {
            maps.MAP2_SCORE = "NEXT";
            maps.MAP3_SCORE = "DECIDER";
        } else if (isScore1Numeric && isScore2Numeric && !isScore3Numeric) {
            maps.MAP3_SCORE = "NEXT";
        }
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

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    // Используем web-доступные пути для иконок, если они отличаются от none.png
    const noneIconPath = "/logos/none_score_icon.png"; // Пример, замените на ваш путь к "пустой" иконке счета
    const mpLIconPath = "/logos/mp_L.png"; // Пример
    const mpRIconPath = "/logos/mp_R.png"; // Пример
    const mpNoneIconPath = "/logos/mp_none.png"; // Пример

    if (statusText === "UPCOM") MP1_UPC = MP2_UPC = MP3_UPC = noneIconPath;
    else if (statusText === "LIVE") { MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); }
    else if (statusText === "FINISHED") { MP1_FIN = getScoreIcon(maps.MAP1_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); MP2_FIN = getScoreIcon(maps.MAP2_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); MP3_FIN = getScoreIcon(maps.MAP3_SCORE, mpLIconPath, mpRIconPath, mpNoneIconPath, noneIconPath); }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPlaceholder;
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) {
            teamWinner = team1Name;
            teamWinnerLogo = team1Logo;
        } else if (winnerKey === "TEAM2" && team2Name) {
            teamWinner = team2Name;
            teamWinnerLogo = team2Logo;
        }
    }
    
    // Замените локальные пути на web-доступные или относительные пути для других изображений
    const liveStatusValue = statusText === "LIVE" ? "/images/live_icon.png" : defaultLogoPlaceholder; // Пример
    const liveBgValue = statusText === "LIVE" ? "/images/LIVEBG.png" : defaultLogoPlaceholder; // Пример
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "/images/ongoing_icon.png" : defaultLogoPlaceholder; // Пример
    const liveRectUp = statusText === "LIVE" ? "/images/live_rectUp.png" : noneIconPath; // Пример
    const liveRectLow = statusText === "LIVE" ? "/images/live_rectLow.png" : noneIconPath; // Пример

    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? "/images/rectUp.png" : defaultLogoPlaceholder; // Пример
    const upcomRectLow = statusText === "UPCOM" ? "/images/rectLow.png" : defaultLogoPlaceholder; // Пример
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "/images/bg_next_upcom.png" : ""; // Пример

    const finRectUp = statusText === "FINISHED" ? "/images/fin_rectUp.png" : noneIconPath; // Пример
    const finRectLow = statusText === "FINISHED" ? "/images/fin_rectLow.png" : noneIconPath; // Пример


    const upcomObj = {
        UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
        UPCOM_TIME: statusText === "UPCOM" ? (timeVal ? timeVal + " CEST" : "") : "",
        UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "",
        UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
        UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLogoPlaceholder,
        UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLogoPlaceholder,
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
        LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogoPlaceholder,
        LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogoPlaceholder,
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
        FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLogoPlaceholder,
        FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLogoPlaceholder,
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
        perMapLogos[`MAP${i}_TEAM1logo`] = show ? team1Logo : defaultLogoPlaceholder;
        perMapLogos[`MAP${i}_TEAM2logo`] = show ? team2Logo : defaultLogoPlaceholder;
    });

    const matchLogos = {};
    const showFinishedLogos = statusText === "FINISHED";
    const showLiveLogos = statusText === "LIVE";
    matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = showFinishedLogos ? team1Logo : defaultLogoPlaceholder;
    matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = showFinishedLogos ? team2Logo : defaultLogoPlaceholder;
    matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = showLiveLogos ? team1Logo : defaultLogoPlaceholder;
    matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = showLiveLogos ? team2Logo : defaultLogoPlaceholder;

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
/**
 * Возвращает путь к иконке в зависимости от счета карты.
 * @param {string} scoreStr - Строка счета в формате "X:Y".
 * @param {string} lPath - Путь к иконке mp_L.png.
 * @param {string} rPath - Путь к иконке mp_R.png.
 * @param {string} mpNonePath - Путь к иконке mp_none.png (для некорректного формата).
 * @param {string} nonePath - Путь к иконке none.png (для нечисловых, ничьей, 0:0).
 * @returns {string} - Путь к иконке.
 */
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