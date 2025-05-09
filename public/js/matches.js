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
    const defaultLogo = "C:\\projects\\vMix_score\\public\\logos\\none.png";
    const SCORE_REGEX = /^\d+:\d+$/; // Регулярное выражение для счета "число:число"

    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.error(`Не удалось найти колонку для матча ${m} при сборе данных.`);
        return null;
    }

    // Получаем значения из основных полей
    const statusSelect = document.getElementById("statusSelect" + m);
    const statusText = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeInput = document.getElementById("timeInput" + m);
    const timeVal = timeInput ? timeInput.value.trim() : "";

    const selTeam1 = document.getElementById("team1Select" + m);
    const selTeam2 = document.getElementById("team2Select" + m);
    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    // Получаем лого из data-атрибута ВЫБРАННОЙ опции, или дефолтное
    const team1Logo = selTeam1 && selTeam1.selectedIndex > 0 && selTeam1.options[selTeam1.selectedIndex]
        ? selTeam1.options[selTeam1.selectedIndex].dataset.logo || defaultLogo
        : defaultLogo;
    const team2Logo = selTeam2 && selTeam2.selectedIndex > 0 && selTeam2.options[selTeam2.selectedIndex]
        ? selTeam2.options[selTeam2.selectedIndex].dataset.logo || defaultLogo
        : defaultLogo;

    // Сбор данных по картам (имя и счет)
    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");
      maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
      maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Автозаполнение счета карт ("NEXT", "DECIDER", "MATCH X") в зависимости от статуса
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
        // Устанавливаем счет 3 карты в "MATCH X" для UPCOM, только если он не был введен вручную
        if (!maps.MAP3_SCORE || maps.MAP3_SCORE.startsWith("MATCH ")) { // Проверяем, не был ли он уже установлен или изменен
             maps.MAP3_SCORE = `MATCH ${m}`;
        }
    }

    // --- НАЧАЛО БЛОКА ИЗМЕНЕНИЙ ДЛЯ MP* ПЕРЕМЕННЫХ ---
    // Заменяем этот блок на логику из "Кода А"
    const mpLPath = "C:\\projects\\NewTimer\\files\\mp_L.png";
    const mpRPath = "C:\\projects\\NewTimer\\files\\mp_R.png";
    const mpNonePath = "C:\\projects\\NewTimer\\files\\mp_none.png"; // Этот путь используется для UPCOM и как fallback в getScoreIcon

    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

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
    // --- КОНЕЦ БЛОКА ИЗМЕНЕНИЙ ДЛЯ MP* ПЕРЕМЕННЫХ ---

    // Определение текстовых полей для статуса FINISHED
    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") { finCest = "cest"; finResult = "Result"; finVictory = "VICTORY"; }

    // Определение победителя (TEAMWINNER) на основе атрибута data-winner
    const winnerKey = column.getAttribute("data-winner") || ""; // "TEAM1", "TEAM2" или ""
    let teamWinner = "";
    let teamWinnerLogo = defaultLogo;
    // Победитель определяется только если статус FINISHED и кнопка была нажата
    if (statusText === "FINISHED" && winnerKey) {
      if (winnerKey === "TEAM1" && team1Name) { // Проверяем, что имя команды выбрано
          teamWinner = team1Name;
          teamWinnerLogo = team1Logo;
      } else if (winnerKey === "TEAM2" && team2Name) {
          teamWinner = team2Name;
          teamWinnerLogo = team2Logo;
      }
    }

    // Определение путей к изображениям и текстам для статуса LIVE
    const liveStatusValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live.png" : defaultLogo;
    const liveBgValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\LIVEBG.png" : defaultLogo;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\ongoing.png" : defaultLogo;
    const liveRectUp = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png";
    const liveRectLow = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png";

    // Определение путей к изображениям и текстам для статуса UPCOM
    const upcomCestValue = statusText === "UPCOM" && timeVal ? "cest" : ""; // Показываем cest только если есть время
    const upcomRectUp = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectUp.png" : defaultLogo;
    const upcomRectLow = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectLow.png" : defaultLogo;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\bg_next_upcom.png" : "";

    // Определение путей к изображениям для статуса FINISHED
    const finRectUp = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png";
    const finRectLow = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png";

    // Формирование объектов с данными для каждого возможного статуса
const upcomObj = {
      UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
      UPCOM_TIME: statusText === "UPCOM" ? (timeVal ? timeVal + " CEST" : "") : "",
      UPCOM_TEAM1: statusText === "UPCOM" ? team1Name : "",
      UPCOM_TEAM2: statusText === "UPCOM" ? team2Name : "",
      UPCOM_TEAM1_LOGO: statusText === "UPCOM" ? team1Logo : defaultLogo,
      UPCOM_TEAM2_LOGO: statusText === "UPCOM" ? team2Logo : defaultLogo,
      UPCOM_MAP1: statusText === "UPCOM" ? maps.MAP1 : "",
      UPCOM_MAP1_SCORE: statusText === "UPCOM" ? maps.MAP1_SCORE : "",
      UPCOM_MAP2: statusText === "UPCOM" ? maps.MAP2 : "",
      UPCOM_MAP2_SCORE: statusText === "UPCOM" ? maps.MAP2_SCORE : "",
      UPCOM_MAP3: statusText === "UPCOM" ? maps.MAP3 : "",
      UPCOM_MAP3_SCORE: statusText === "UPCOM" ? `MATCH ${m}` : "",
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
      LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogo,
      LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogo,
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
      FINISHED_TEAM1_LOGO: statusText === "FINISHED" ? team1Logo : defaultLogo,
      FINISHED_TEAM2_LOGO: statusText === "FINISHED" ? team2Logo : defaultLogo,
      FINISHED_MAP1: statusText === "FINISHED" ? maps.MAP1 : "",
      FINISHED_MAP1_SCORE: statusText === "FINISHED" ? maps.MAP1_SCORE : "",
      FINISHED_MAP2: statusText === "FINISHED" ? maps.MAP2 : "",
      FINISHED_MAP2_SCORE: statusText === "FINISHED" ? maps.MAP2_SCORE : "",
      FINISHED_MAP3: statusText === "FINISHED" ? maps.MAP3 : "",
      FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "",
      FIN_RectangleUP: finRectUp,
      FIN_RectangleLOW: finRectLow
    };

    // Динамические логотипы уровня карт
    const perMapLogos = {};
     [1, 2, 3].forEach(i => {
         const sc = maps[`MAP${i}_SCORE`];
         const isNum = SCORE_REGEX.test(sc);
         const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
         perMapLogos[`MAP${i}_TEAM1logo`] = show ? team1Logo : defaultLogo;
         perMapLogos[`MAP${i}_TEAM2logo`] = show ? team2Logo : defaultLogo;
       });

    // Динамические логотипы уровня матча
    const matchLogos = {};
    const showFinishedLogos = statusText === "FINISHED";
    const showLiveLogos = statusText === "LIVE";
    matchLogos[`FINISHED_TEAM1_LOGO_MATCH${m}`] = showFinishedLogos ? team1Logo : defaultLogo;
    matchLogos[`FINISHED_TEAM2_LOGO_MATCH${m}`] = showFinishedLogos ? team2Logo : defaultLogo;
    matchLogos[`LIVE_TEAM1_LOGO_MATCH${m}`] = showLiveLogos ? team1Logo : defaultLogo;
    matchLogos[`LIVE_TEAM2_LOGO_MATCH${m}`] = showLiveLogos ? team2Logo : defaultLogo;

    // Собираем итоговый объект матча
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