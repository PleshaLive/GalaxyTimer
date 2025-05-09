// public/js/matches.js

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
                    errorText += ` - ${errorData.message || JSON.stringify(errorData).substring(0, 100)}`;
                } catch (e) {
                    const textResponse = await response.text().catch(() => "");
                    if (textResponse) errorText += ` - Server response: ${textResponse.substring(0, 100)}`;
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

        const currentVal1 = team1Select.value;
        const currentVal2 = team2Select.value;

        if ($(team1Select).data('select2')) $(team1Select).select2('destroy');
        if ($(team2Select).data('select2')) $(team2Select).select2('destroy');

        team1Select.innerHTML = '';
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
                } else if (team.logo.startsWith('/')) {
                    logoUrl = externalApiBaseUrl + team.logo;
                } else {
                    logoUrl = `${externalApiBaseUrl}/logos/${team.logo.replace(/\.png$/i, '')}.png`;
                }
            }
            option.dataset.logo = logoUrl;
            team1Select.appendChild(option.cloneNode(true));
            team2Select.appendChild(option.cloneNode(true));
        });

        if (currentVal1 && team1Select.querySelector(`option[value="${CSS.escape(currentVal1)}"]`)) {
            team1Select.value = currentVal1;
        } else if (team1Select.options.length > 0) {
            team1Select.value = "";
        }
        if (currentVal2 && team2Select.querySelector(`option[value="${CSS.escape(currentVal2)}"]`)) {
            team2Select.value = currentVal2;
        } else if (team2Select.options.length > 0) {
            team2Select.value = "";
        }
    }
}

/**
 * Инициализирует Select2 для всех селектов команд.
 */
function initSelect2ForTeams() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);
        if (!sel1.length && !sel2.length) continue;

        const parent1 = sel1.length ? sel1.parent() : null;
        const parent2 = sel2.length ? sel2.parent() : null;

        const commonSelect2Options = {
            templateResult: formatTeamOption,
            templateSelection: formatTeamSelection,
            width: '100%',
            placeholder: "-",
            allowClear: false, // Устанавливаем в false, так как у нас всегда есть "-"
        };
        if (sel1.length && parent1) {
            sel1.select2({ ...commonSelect2Options, dropdownParent: parent1 });
        }
        if (sel2.length && parent2) {
            sel2.select2({ ...commonSelect2Options, dropdownParent: parent2 });
        }
    }
}

/**
 * Привязывает обработчики 'change' к Select2 селектам команд для обновления UI.
 */
function attachSelect2ChangeListeners() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);

        const updateDisplayListener = () => {
            updateTeamDisplay(m);
        };

        const updateRelatedModulesListener = () => {
            // Для доступа к функциям из main.js, main.js должен экспортировать их 
            // или они должны быть доступны глобально (менее предпочтительно).
            // Если main.js экспортирует, то в matches.js их нужно импортировать.
            // Пример, если бы они были глобальны (не рекомендуется):
            // const currentVetoMatchIndex = document.getElementById("matchSelect")?.value;
            // if (typeof window.updateVetoTeamOptions === 'function' && currentVetoMatchIndex && currentVetoMatchIndex == m) {
            //     window.updateVetoTeamOptions(String(m));
            // }
            // if (typeof window.updateVRSTeamNames === 'function') {
            //     window.updateVRSTeamNames();
            // }
            // ПРАВИЛЬНЫЙ СПОСОБ: использовать кастомные события или колбэки, если модули не могут напрямую импортировать друг друга.
            // Либо, если main.js импортирует функции из matches.js, то эта логика должна быть в main.js
        };

        if (sel1.length) {
            sel1.off("change.select2").on("change.select2", function() { // Используем .off для предотвращения дублирования
                updateDisplayListener();
                updateRelatedModulesListener(); // Возможно, эту логику лучше вызывать из main.js при изменении команд
            });
        }
        if (sel2.length) {
            sel2.off("change.select2").on("change.select2", function() {
                updateDisplayListener();
                updateRelatedModulesListener();
            });
        }
    }
}

// ----------------------
// Обновление отображения команды (ЛОГО НАД СЕЛЕКТОМ и текст кнопки победителя)
// ----------------------
export function updateTeamDisplay(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`);
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`);

    if (sel1) {
        const team1Name = sel1.value || "Team 1";
        const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (btn1) btn1.textContent = ` ${team1Name}`;

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

        select.addEventListener('change', function () {
            updateStatusColor(this);
            const matchColumn = this.closest('.match-column');
            if (matchColumn) {
                const newStatus = this.value.toLowerCase();
                matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
                if (newStatus) {
                    matchColumn.classList.add(`status-${newStatus}`);
                }
                const m = matchColumn.dataset.match;
                if (this.value === 'UPCOM') {
                    const mapRows = matchColumn.querySelectorAll('.map-row');
                    if (mapRows.length >= 3) {
                        const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                        if (thirdMapScoreInput && (!thirdMapScoreInput.value || thirdMapScoreInput.value.startsWith("MATCH "))) {
                            thirdMapScoreInput.value = `MATCH ${m}`;
                        }
                    }
                }
            }
        });
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

// Эта функция является локальной для модуля matches.js
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
    return nonePath; // Используем nonePath (который mpNonePath при вызове) для нечисловых
}


/**
 * Собирает данные одного матча (версия для Select2).
 */
export function gatherSingleMatchData(matchIndex) {
    const m = matchIndex;
    const defaultLocalLogo = "C:\\projects\\vMix_score\\public\\logos\\none.png"; // Локальный путь для сборки данных, если не веб
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

    const team1Logo = selTeam1 && selTeam1.selectedIndex >= 0 && selTeam1.options[selTeam1.selectedIndex] // selTeam1.selectedIndex >= 0 to include placeholder with defaultLogoPath
        ? (selTeam1.options[selTeam1.selectedIndex].dataset.logo || defaultLogoPath) // Используем веб-путь defaultLogoPath
        : defaultLogoPath;
    const team2Logo = selTeam2 && selTeam2.selectedIndex >= 0 && selTeam2.options[selTeam2.selectedIndex]
        ? (selTeam2.options[selTeam2.selectedIndex].dataset.logo || defaultLogoPath)
        : defaultLogoPath;

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

        if (isScore1Numeric && (!s2 || !isScore2Numeric)) { // Если есть счет на 1, а на 2й нет или не число
             if (s2 !== "NEXT" && s2 !== "DECIDER") maps.MAP2_SCORE = "NEXT"; // Не перезаписывать, если уже стоит специальное значение
             if (s3 !== "NEXT" && s3 !== "DECIDER") maps.MAP3_SCORE = "DECIDER";
        } else if (isScore1Numeric && isScore2Numeric && (!s3 || !isScore3Numeric)) { // Если есть на 1 и 2, а на 3й нет
             if (s3 !== "NEXT" && s3 !== "DECIDER") maps.MAP3_SCORE = "NEXT";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || s3 === "" || s3.toUpperCase() === "NEXT")) {
            // Если есть счет на 1 и 2, а на 3й пусто, NEXT или не число, то ставим DECIDER
             if (s3 !== "DECIDER") maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        if (maps.MAP1_SCORE && maps.MAP1_SCORE.toUpperCase() !== "NEXT" && !maps.MAP2_SCORE) {
             maps.MAP2_SCORE = "NEXT"; // Если на 1й что-то введено (не NEXT), а на 2й пусто - ставим NEXT
        }
        if (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE.toUpperCase() === "DECIDER" || maps.MAP3_SCORE.toUpperCase() === "NEXT") {
            maps.MAP3_SCORE = `MATCH ${m}`;
        }
    }
    
    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    const mpLPath = "C:\\projects\\NewTimer\\files\\mp_L.png";
    const mpRPath = "C:\\projects\\NewTimer\\files\\mp_R.png";
    const mpNonePath = "C:\\projects\\NewTimer\\files\\mp_none.png";

    if (statusText === "UPCOM") {
        MP1_UPC = mpNonePath; MP2_UPC = mpNonePath; MP3_UPC = mpNonePath;
    } else if (statusText === "LIVE") {
        MP1_LIVE = getScoreIcon(maps.MAP1_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
        MP2_LIVE = getScoreIcon(maps.MAP2_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
        MP3_LIVE = getScoreIcon(maps.MAP3_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
    } else if (statusText === "FINISHED") {
        MP1_FIN = getScoreIcon(maps.MAP1_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
        MP2_FIN = getScoreIcon(maps.MAP2_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
        MP3_FIN = getScoreIcon(maps.MAP3_SCORE, mpLPath, mpRPath, mpNonePath, mpNonePath);
    }

    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

    const winnerKey = column.getAttribute("data-winner") || "";
    let teamWinner = "";
    let teamWinnerLogo = defaultLogoPath; // Используем веб-путь по умолчанию
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) {
            teamWinner = team1Name;
            teamWinnerLogo = team1Logo;
        } else if (winnerKey === "TEAM2" && team2Name) {
            teamWinner = team2Name;
            teamWinnerLogo = team2Logo;
        }
    }
    
    // Пути для изображений и текста, убедитесь, что они корректны и доступны (локальные или веб)
    // Для простоты, используем defaultLocalLogo или defaultLogoPath для тех, что не должны быть видны
    const liveStatusValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live.png" : defaultLocalLogo;
    const liveBgValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\LIVEBG.png" : defaultLocalLogo;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\ongoing.png" : defaultLocalLogo;
    const liveRectUp = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectUp.png" : defaultLocalLogo; // Использовал defaultLocalLogo для примера, если none.png не подходит
    const liveRectLow = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectLow.png" : defaultLocalLogo;

    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectUp.png" : defaultLocalLogo;
    const upcomRectLow = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectLow.png" : defaultLocalLogo;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\bg_next_upcom.png" : ""; // Пустая строка если не UPCOM

    const finRectUp = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectUp.png" : defaultLocalLogo;
    const finRectLow = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectLow.png" : defaultLocalLogo;

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
        UPCOM_next: statusText === "UPCOM" ? (document.getElementById(`upcomNext${m}`)?.value || "") : "", // Пример если есть доп поле
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