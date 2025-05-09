// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;
// Глобальный путь к логотипу по умолчанию (WEB-ПУТЬ!)
const defaultLogoPath = "https://waywayway-production.up.railway.app/logos/none.png";
// Локальный путь к "пустой" картинке для случаев, когда ресурс не должен отображаться или отсутствует
const defaultLocalFallbackPath = "C:\\projects\\NewTimer\\files\\none.png";


// --- Функции-шаблоны для Select2 ---
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

            populateTeamSelects(teamsList);
            initSelect2ForTeams();
            attachSelect2ChangeListeners();
            attachWinnerButtons();
            attachStatusChangeHandlers();

            for (let m = 1; m <= 4; m++) {
                updateTeamDisplay(m);
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
    defaultOption.textContent = "-";
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
            allowClear: false,
        };
        if (sel1.length && parent1) {
            sel1.select2({ ...commonSelect2Options, dropdownParent: parent1 });
        }
        if (sel2.length && parent2) {
            sel2.select2({ ...commonSelect2Options, dropdownParent: parent2 });
        }
    }
}

function attachSelect2ChangeListeners() {
    for (let m = 1; m <= 4; m++) {
        const sel1 = $(`#team1Select${m}`);
        const sel2 = $(`#team2Select${m}`);

        const updateAllDisplays = () => {
            updateTeamDisplay(m);
            // Эта логика должна быть в main.js или вызываться через события/коллбэки
            // для соблюдения разделения ответственности модулей.
            // Например, main.js может слушать событие 'teamChangedInMatchModule'
            // const event = new CustomEvent('teamChangedInMatchModule', { detail: { matchIndex: m } });
            // document.dispatchEvent(event);
        };

        if (sel1.length) {
            sel1.off("change.select2").on("change.select2", updateAllDisplays);
        }
        if (sel2.length) {
            sel2.off("change.select2").on("change.select2", updateAllDisplays);
        }
    }
}

export function updateTeamDisplay(matchIndex) {
    const sel1 = document.getElementById(`team1Select${matchIndex}`);
    const sel2 = document.getElementById(`team2Select${matchIndex}`);
    const logo1Img = document.getElementById(`team1Logo${matchIndex}`); // Лого над селектом
    const logo2Img = document.getElementById(`team2Logo${matchIndex}`); // Лого над селектом

    if (sel1) {
        const team1Name = sel1.value || "Team 1";
        const btn1 = document.querySelector(`.match-column[data-match="${matchIndex}"] .winner-btn[data-team="TEAM1"]`);
        if (btn1) btn1.textContent = ` ${team1Name}`; // Обновляем текст кнопки победителя (без "Winner:")

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
        if (btn2) btn2.textContent = ` ${team2Name}`; // Обновляем текст кнопки победителя

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
                        // Заполняем только если пусто или уже содержит "MATCH X" или "DECIDER" или "NEXT" (чтобы не перетирать ручной ввод)
                        if (thirdMapScoreInput && (!thirdMapScoreInput.value || 
                            thirdMapScoreInput.value.startsWith("MATCH ") || 
                            thirdMapScoreInput.value.toUpperCase() === "DECIDER" ||
                            thirdMapScoreInput.value.toUpperCase() === "NEXT" )) {
                            thirdMapScoreInput.value = `MATCH ${m}`;
                        }
                    }
                }
            }
        });
        updateStatusColor(select);
    });
}

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

// Локальная функция getScoreIcon, используется в gatherSingleMatchData
function getScoreIcon(scoreStr, lPath, rPath, mpNonePath, nonePath) {
    if (!scoreStr || typeof scoreStr !== 'string') return nonePath;
    const parts = scoreStr.split(':');
    if (parts.length === 2) {
        const score1 = parseInt(parts[0], 10);
        const score2 = parseInt(parts[1], 10);
        if (!isNaN(score1) && !isNaN(score2)) {
            if (score1 > score2) return lPath;
            if (score2 > score1) return rPath;
            return mpNonePath;
        }
    }
    return nonePath;
}

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

    const selTeam1 = document.getElementById("team1Select" + m);
    const selTeam2 = document.getElementById("team2Select" + m);
    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    const team1Logo = selTeam1 && selTeam1.selectedIndex >= 0 && selTeam1.options[selTeam1.selectedIndex]
        ? (selTeam1.options[selTeam1.selectedIndex].dataset.logo || defaultLogoPath)
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

    // Логика автозаполнения для maps.MAPn_SCORE
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE;
        const isScore1Numeric = SCORE_REGEX.test(s1);
        const isScore2Numeric = SCORE_REGEX.test(s2);

        if (isScore1Numeric && (!s2 || !isScore2Numeric)) {
            if (maps.MAP2_SCORE !== "NEXT" && maps.MAP2_SCORE !== "DECIDER") maps.MAP2_SCORE = "NEXT";
            if (maps.MAP3_SCORE !== "NEXT" && maps.MAP3_SCORE !== "DECIDER") maps.MAP3_SCORE = "DECIDER";
        } else if (isScore1Numeric && isScore2Numeric && (!maps.MAP3_SCORE || !SCORE_REGEX.test(maps.MAP3_SCORE))) {
            if (maps.MAP3_SCORE !== "NEXT" && maps.MAP3_SCORE !== "DECIDER") maps.MAP3_SCORE = "NEXT";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || s3 === "" || s3.toUpperCase() === "NEXT" || !SCORE_REGEX.test(s3) )) {
             if (s3 !== "DECIDER") maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        if (maps.MAP1_SCORE && maps.MAP1_SCORE.toUpperCase() !== "NEXT" && !maps.MAP2_SCORE) {
             maps.MAP2_SCORE = "NEXT";
        }
        if (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ") || maps.MAP3_SCORE.toUpperCase() === "DECIDER" || maps.MAP3_SCORE.toUpperCase() === "NEXT") {
            maps.MAP3_SCORE = `MATCH ${m}`;
        }
    }
    
    // Корректная логика для MPn полей
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
    let teamWinnerLogo = defaultLogoPath;
    if (statusText === "FINISHED" && winnerKey) {
        if (winnerKey === "TEAM1" && team1Name) {
            teamWinner = team1Name;
            teamWinnerLogo = team1Logo;
        } else if (winnerKey === "TEAM2" && team2Name) {
            teamWinner = team2Name;
            teamWinnerLogo = team2Logo;
        }
    }
    
    // Вспомогательная функция для чтения значений из DOM или использования дефолтных значений
    const getInputValueOrDefault = (elementId, defaultValue) => {
        const element = document.getElementById(elementId + m);
        return statusText === "UPCOM" ? (element && element.value.trim() !== "" ? element.value.trim() : defaultValue) : (elementId.includes("Rectangle") ? defaultLocalFallbackPath : "");
    };
    const getPathOrDefault = (condition, pathIfTrue, pathIfFalse = defaultLocalFallbackPath) => {
        return condition ? pathIfTrue : pathIfFalse;
    };


    const upcomObj = {
        UPCOM_MATCH_STATUS: getPathOrDefault(statusText === "UPCOM", statusText),
        UPCOM_TIME: getPathOrDefault(statusText === "UPCOM", (timeVal ? timeVal + " CEST" : "")),
        UPCOM_TEAM1: getPathOrDefault(statusText === "UPCOM", team1Name),
        UPCOM_TEAM2: getPathOrDefault(statusText === "UPCOM", team2Name),
        UPCOM_TEAM1_LOGO: getPathOrDefault(statusText === "UPCOM", team1Logo, defaultLogoPath),
        UPCOM_TEAM2_LOGO: getPathOrDefault(statusText === "UPCOM", team2Logo, defaultLogoPath),
        UPCOM_MAP1: getPathOrDefault(statusText === "UPCOM", maps.MAP1),
        UPCOM_MAP1_SCORE: getPathOrDefault(statusText === "UPCOM", maps.MAP1_SCORE),
        UPCOM_MAP2: getPathOrDefault(statusText === "UPCOM", maps.MAP2),
        UPCOM_MAP2_SCORE: getPathOrDefault(statusText === "UPCOM", maps.MAP2_SCORE),
        UPCOM_MAP3: getPathOrDefault(statusText === "UPCOM", maps.MAP3),
        UPCOM_MAP3_SCORE: getPathOrDefault(statusText === "UPCOM", maps.MAP3_SCORE),
        UPCOM_Cest: getPathOrDefault(statusText === "UPCOM" && timeVal, "cest"),
        UPCOM_RectangleUP: getInputValueOrDefault("upcomRectangleUp", "C:\\projects\\NewTimer\\files\\rectUp.png"),
        UPCOM_RectangleLOW: getInputValueOrDefault("upcomRectangleLow", "C:\\projects\\NewTimer\\files\\rectLow.png"),
        UPCOM_vs_mini: getInputValueOrDefault("upcomVsMini", "vs"),
        UPCOM_vs_big: getInputValueOrDefault("upcomVsBig", "vs"),
        UPCOM_next: getInputValueOrDefault("upcomNext", ""), // Пусто по умолчанию, если нет инпута
        UPCOM_next_photo: getInputValueOrDefault("upcomNextPhoto", "C:\\projects\\NewTimer\\files\\bg_next_upcom.png")
    };

    const liveObj = {
        LIVE_MATCH_STATUS: getPathOrDefault(statusText === "LIVE", statusText),
        LIVE_TIME: getPathOrDefault(statusText === "LIVE", timeVal),
        LIVE_TEAM1: getPathOrDefault(statusText === "LIVE", team1Name),
        LIVE_TEAM2: getPathOrDefault(statusText === "LIVE", team2Name),
        LIVE_TEAM1_LOGO: getPathOrDefault(statusText === "LIVE", team1Logo, defaultLogoPath),
        LIVE_TEAM2_LOGO: getPathOrDefault(statusText === "LIVE", team2Logo, defaultLogoPath),
        LIVE_MAP1: getPathOrDefault(statusText === "LIVE", maps.MAP1),
        LIVE_MAP1_SCORE: getPathOrDefault(statusText === "LIVE", maps.MAP1_SCORE),
        LIVE_MAP2: getPathOrDefault(statusText === "LIVE", maps.MAP2),
        LIVE_MAP2_SCORE: getPathOrDefault(statusText === "LIVE", maps.MAP2_SCORE),
        LIVE_MAP3: getPathOrDefault(statusText === "LIVE", maps.MAP3),
        LIVE_MAP3_SCORE: getPathOrDefault(statusText === "LIVE", maps.MAP3_SCORE),
        LIVE_Cest: getPathOrDefault(statusText === "LIVE", "C:\\projects\\NewTimer\\files\\ongoing.png"),
        LIVE_VS: getPathOrDefault(statusText === "LIVE", "vs"),
        LIVE_STATUS: getPathOrDefault(statusText === "LIVE", "C:\\projects\\NewTimer\\files\\live.png"),
        LIVE_BG: getPathOrDefault(statusText === "LIVE", "C:\\projects\\NewTimer\\files\\LIVEBG.png"),
        LIVE_RectangleUP: getPathOrDefault(statusText === "LIVE", "C:\\projects\\NewTimer\\files\\live_rectUp.png"),
        LIVE_RectangleLOW: getPathOrDefault(statusText === "LIVE", "C:\\projects\\NewTimer\\files\\live_rectLow.png")
    };

    const finishedObj = {
        FINISHED_MATCH_STATUS: getPathOrDefault(statusText === "FINISHED", statusText),
        FINISHED_TIME: getPathOrDefault(statusText === "FINISHED", (timeVal ? timeVal + " CEST" : "")),
        FINISHED_TEAM1: getPathOrDefault(statusText === "FINISHED", team1Name),
        FINISHED_TEAM2: getPathOrDefault(statusText === "FINISHED", team2Name),
        FINISHED_TEAM1_LOGO: getPathOrDefault(statusText === "FINISHED", team1Logo, defaultLogoPath),
        FINISHED_TEAM2_LOGO: getPathOrDefault(statusText === "FINISHED", team2Logo, defaultLogoPath),
        FINISHED_MAP1: getPathOrDefault(statusText === "FINISHED", maps.MAP1),
        FINISHED_MAP1_SCORE: getPathOrDefault(statusText === "FINISHED", maps.MAP1_SCORE),
        FINISHED_MAP2: getPathOrDefault(statusText === "FINISHED", maps.MAP2),
        FINISHED_MAP2_SCORE: getPathOrDefault(statusText === "FINISHED", maps.MAP2_SCORE),
        FINISHED_MAP3: getPathOrDefault(statusText === "FINISHED", maps.MAP3),
        FINISHED_MAP3_SCORE: getPathOrDefault(statusText === "FINISHED", maps.MAP3_SCORE),
        FIN_RectangleUP: getPathOrDefault(statusText === "FINISHED", "C:\\projects\\NewTimer\\files\\fin_rectUp.png"),
        FIN_RectangleLOW: getPathOrDefault(statusText === "FINISHED", "C:\\projects\\NewTimer\\files\\fin_rectLow.png")
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