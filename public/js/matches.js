// public/js/matches.js

// Флаг и промис для отслеживания завершения инициализации команд
let teamsInitialized = false;
let teamsInitializationPromise = null;

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
  // Если инициализация уже идет или завершена, возвращаем существующий промис
  if (teamsInitializationPromise) {
    return teamsInitializationPromise;
  }

  // Создаем новый промис
  teamsInitializationPromise = new Promise(async (resolve, reject) => {
    console.log("[Matches] Starting teams initialization...");
    try {
      // Загружаем список команд с сервера
      const response = await fetch("/api/teams");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json(); // Парсим JSON ответ
      // Получаем массив команд, обрабатываем разные возможные структуры ответа
      const teamsList = Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);

      if (teamsList.length === 0) {
        console.warn("[Matches] Team list is empty or not received from /api/teams.");
      }

      // Заполняем селекты команд полученным списком
      populateTeamSelects(teamsList);
      // Привязываем обработчики для обновления лейблов кнопок при смене команды
      attachTeamLogoUpdates();
      // Привязываем обработчики для кнопок выбора победителя
      attachWinnerButtons();
      // Привязываем обработчики для обновления цвета селекта статуса и автозаполнения
      attachStatusChangeHandlers(); // Используем новую функцию

      // Первоначальное обновление UI для всех матчей после загрузки списка команд
      for (let m = 1; m <= 4; m++) {
        updateWinnerButtonLabels(m); // Устанавливаем текст кнопок
        refreshWinnerHighlight(m); // Сбрасываем подсветку победителя
        const statusSelectElement = document.getElementById("statusSelect" + m);
        if (statusSelectElement) {
            updateStatusColor(statusSelectElement); // Устанавливаем цвет селекта статуса
        }
      }

      teamsInitialized = true; // Устанавливаем флаг завершения инициализации
      console.log("[Matches] Teams initialization completed.");
      resolve(); // Разрешаем промис - инициализация успешна

    } catch (err) {
      // Если произошла ошибка при загрузке или обработке
      console.error("[Matches] Error during initialization:", err);
      reject(err); // Отклоняем промис - инициализация не удалась
    }
  });

  return teamsInitializationPromise; // Возвращаем созданный промис
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
  // Создаем опцию по умолчанию ("-")
  const defaultOption = document.createElement("option");
  defaultOption.value = ""; // Пустое значение
  defaultOption.textContent = "-";
  // Используем дефолтное лого (путь должен быть корректным на сервере)
  defaultOption.dataset.logo = "C:\\projects\\vMix_score\\public\\logos\\none.png";

  // Проходим по всем 4 блокам матчей
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    // Если селекты для матча не найдены, пропускаем
    if (!sel1 || !sel2) continue;

    const currentVal1 = sel1.value; // Сохраняем текущее выбранное значение (если есть)
    const currentVal2 = sel2.value;

    // Очищаем предыдущие опции
    sel1.innerHTML = "";
    sel2.innerHTML = "";

    // Добавляем опцию по умолчанию в начало
    sel1.appendChild(defaultOption.cloneNode(true));
    sel2.appendChild(defaultOption.cloneNode(true));

    // Добавляем опции для каждой команды из списка
    teamsList.forEach(team => {
      // Пропускаем команды без имени или логотипа
      if (!team.name || !team.logo) return;

      // Создаем <option> для первого селекта
      const opt1 = document.createElement("option");
      opt1.value = team.name; // Значение - имя команды
      opt1.textContent = team.name; // Текст - имя команды
      // Сохраняем путь к логотипу в data-атрибуте
      // Обрабатываем как абсолютные, так и относительные пути из data.json
      opt1.dataset.logo = team.logo.startsWith('C:')
        ? team.logo
        : "C:\\projects\\vMix_score\\public" + (team.logo.startsWith('/') ? team.logo : '/' + team.logo);
      sel1.appendChild(opt1);

      // Создаем <option> для второго селекта (можно клонировать)
      const opt2 = opt1.cloneNode(true);
      opt2.textContent = team.name; // Убедимся, что текст скопировался
      sel2.appendChild(opt2);
    });

    // Пытаемся восстановить предыдущее выбранное значение (если оно было)
    sel1.value = currentVal1 || ""; // Если было пустое, останется пустое
    sel2.value = currentVal2 || "";
  }
   console.log("[Matches] Team selects populated/repopulated.");
}

// ----------------------
// Логотипы и обновление лейблов кнопок
// ----------------------
/**
 * Привязывает обработчики событий 'change' к селектам команд
 * для обновления текста на кнопках выбора победителя.
 */
export function attachTeamLogoUpdates() {
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    if (!sel1 || !sel2) continue;
    // При изменении любого селекта обновляем текст обеих кнопок для этого матча
    sel1.addEventListener("change", () => updateWinnerButtonLabels(m));
    sel2.addEventListener("change", () => updateWinnerButtonLabels(m));
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
      const teamKey = btn.getAttribute("data-team"); // "TEAM1" или "TEAM2"
      const matchIndex = parseInt(matchColumn.dataset.match, 10);
      const currentWinner = matchColumn.getAttribute("data-winner");

      // Логика переключения: если кликнули по уже выбранной - снимаем выбор, иначе - устанавливаем
      if (currentWinner === teamKey) {
          matchColumn.removeAttribute("data-winner");
      } else {
          matchColumn.setAttribute("data-winner", teamKey);
      }
      // Обновляем визуальное состояние кнопок
      refreshWinnerHighlight(matchIndex);
    });
  });
}

/**
 * Обновляет текст на кнопках выбора победителя, используя текущие
 * выбранные имена команд в селектах.
 * @param {number} matchIndex - Индекс матча (1-4).
 */
export function updateWinnerButtonLabels(matchIndex) {
  const sel1 = document.getElementById(`team1Select${matchIndex}`);
  const sel2 = document.getElementById(`team2Select${matchIndex}`);
  // Получаем имя из .value селекта, или используем дефолтное имя
  const name1 = sel1 && sel1.value ? sel1.value : "Team 1";
  const name2 = sel2 && sel2.value ? sel2.value : "Team 2";

  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const btn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
  const btn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');
  // Устанавливаем текст кнопок
  if (btn1) btn1.textContent = `Победитель: ${name1}`;
  if (btn2) btn2.textContent = `Победитель: ${name2}`;
}

/**
 * Обновляет подсветку кнопок победителя (добавляет/удаляет класс 'winner-selected')
 * на основе атрибута 'data-winner' у родительского элемента .match-column.
 * @param {number} matchIndex - Индекс матча (1-4).
 */
export function refreshWinnerHighlight(matchIndex) {
  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  // Получаем сохраненного победителя ("TEAM1", "TEAM2" или null/undefined)
  const winner = matchColumn.getAttribute("data-winner");
  // Проходим по обеим кнопкам в колонке
  matchColumn.querySelectorAll(".winner-btn").forEach(b => {
    // Добавляем класс 'winner-selected', если data-team кнопки совпадает с сохраненным победителем
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
        updateStatusColor(sel); // Обновляем цвет самого селекта
        const matchColumn = sel.closest('.match-column');
        if (matchColumn) {
            // Обновляем класс у родителя
            matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
            if(sel.value) matchColumn.classList.add(`status-${sel.value.toLowerCase()}`);

            // Автозаполнение счета 3-й карты для UPCOM
            if (sel.value === 'UPCOM') {
                const mapRows = matchColumn.querySelectorAll('.map-row');
                if (mapRows.length >= 3) { // Убедимся, что есть 3 карты
                    const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                    if (thirdMapScoreInput) {
                        thirdMapScoreInput.value = `MATCH ${m}`; // Устанавливаем текст
                        thirdMapScoreInput.placeholder = `MATCH ${m}`; // Можно и placeholder обновить
                    }
                }
            }
            // Опционально: Очистка счета 3 карты, если статус НЕ UPCOM и был автозаполнен
            else {
                const mapRows = matchColumn.querySelectorAll('.map-row');
                if (mapRows.length >= 3) {
                    const thirdMapScoreInput = mapRows[2].querySelector('.map-score-input');
                    // Очищаем только если значение было автозаполнено
                    if (thirdMapScoreInput && thirdMapScoreInput.value === `MATCH ${m}`) {
                        thirdMapScoreInput.value = "";
                        thirdMapScoreInput.placeholder = "0:0"; // Возвращаем плейсхолдер по умолчанию
                    }
                }
            }
        }
    });
  }
}

/**
 * Устанавливает цвет фона и текста для элемента <select> статуса
 * в зависимости от выбранного значения.
 * @param {HTMLSelectElement} sel - Элемент селекта статуса.
 */
export function updateStatusColor(sel) {
    if (!sel) return; // Проверка на null
    const v = sel.value.toUpperCase(); // Получаем выбранное значение
    let color;
    // Определяем цвет фона на основе значения
    switch (v) {
        case "UPCOM":    color = "var(--color-upcom)"; break;
        case "LIVE":     color = "var(--color-live)"; break;
        case "FINISHED": color = "var(--color-text-muted)"; break;
        default:         color = "var(--color-surface-light)"; // Цвет по умолчанию
    }
    // Применяем стили
    sel.style.backgroundColor = color;
    sel.style.color = '#fff'; // Белый текст для лучшей читаемости
    sel.style.borderColor = color; // Окрашиваем рамку в тот же цвет
}


// --------------------------------------------------
// Сбор данных ОДНОГО матча
// --------------------------------------------------
/**
 * Собирает все данные для одного матча из соответствующих полей ввода и селектов.
 * @param {number} matchIndex - Индекс матча (1-4).
 * @returns {object | null} - Объект с данными матча или null, если колонка матча не найдена.
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

    // --- ИЗМЕНЕНИЕ ЛОГИКИ АВТОЗАПОЛНЕНИЯ ДЛЯ LIVE ---
     if (statusText === "LIVE") {
        const score1 = maps.MAP1_SCORE;
        const score2 = maps.MAP2_SCORE;
        const score3 = maps.MAP3_SCORE; // Текущее значение счета 3 карты

        const isScore1Numeric = SCORE_REGEX.test(score1);
        const isScore2Numeric = SCORE_REGEX.test(score2);
        const isScore3Numeric = SCORE_REGEX.test(score3); // Проверяем и 3-ю карту

        // 1. Если первая карта сыграна (счет есть), а вторая еще нет (счет не числовой)
        if (isScore1Numeric && !isScore2Numeric) {
            maps.MAP2_SCORE = "NEXT";    // Вторая карта - следующая
            maps.MAP3_SCORE = "DECIDER"; // Третья карта - решающая
            console.log(`[Gather] LIVE: Map1 (${score1}) done, Map2 not numeric. Setting Map2=NEXT, Map3=DECIDER`);
        }
        // 2. Если первая И вторая карты сыграны (счета есть)
        else if (isScore1Numeric && isScore2Numeric) {
             // И третья карта еще не сыграна (не числовой счет)
             if (!isScore3Numeric) {
                 maps.MAP3_SCORE = "NEXT"; // Третья карта - следующая
                 console.log(`[Gather] LIVE: Map1 (${score1}) & Map2 (${score2}) done, Map3 not numeric. Setting Map3=NEXT`);
             } else {
                 // Все 3 карты сыграны или введены вручную
                 console.log(`[Gather] LIVE: Map1 (${score1}), Map2 (${score2}), Map3 (${score3}) seem complete or manually set.`);
             }
        }
        // 3. Если первая карта не сыграна (нет счета или не число)
        else if (!isScore1Numeric) {
             // Можно сбросить счет 2 и 3 карты, если нужно строгое поведение,
             // но пока оставим как есть, чтобы не стирать введенные вручную данные.
             console.log(`[Gather] LIVE: Initial state or Map1 score not numeric (${score1}). No auto-fill applied.`);
        }
    }
    // --- КОНЕЦ ИЗМЕНЕНИЯ ЛОГИКИ АВТОЗАПОЛНЕНИЯ ДЛЯ LIVE ---
    else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        // Если две карты сыграны, а третья не является счетом, считаем ее решающей (DECIDER)
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        // Для предстоящих матчей, если счет первой карты не введен, ставим NEXT
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        // Устанавливаем счет 3 карты в "MATCH X" для UPCOM
        maps.MAP3_SCORE = `MATCH ${m}`;
    }

    // Определение иконок счета для разных статусов (MP*_FIN/LIVE/UPC)
    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    if (statusText === "UPCOM") MP1_UPC = MP2_UPC = MP3_UPC = "C:\\projects\\NewTimer\\files\\none.png";
    else if (statusText === "LIVE") { MP1_LIVE = getScoreIcon(maps.MAP1_SCORE); MP2_LIVE = getScoreIcon(maps.MAP2_SCORE); MP3_LIVE = getScoreIcon(maps.MAP3_SCORE); }
    else if (statusText === "FINISHED") { MP1_FIN = getScoreIcon(maps.MAP1_SCORE); MP2_FIN = getScoreIcon(maps.MAP2_SCORE); MP3_FIN = getScoreIcon(maps.MAP3_SCORE); }

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
      LIVE_TEAM1_LOGO: statusText === "LIVE" ? team1Logo : defaultLogo,
      LIVE_TEAM2_LOGO: statusText === "LIVE" ? team2Logo : defaultLogo,
      LIVE_MAP1: statusText === "LIVE" ? maps.MAP1 : "",
      LIVE_MAP1_SCORE: statusText === "LIVE" ? maps.MAP1_SCORE : "",
      LIVE_MAP2: statusText === "LIVE" ? maps.MAP2 : "",
      LIVE_MAP2_SCORE: statusText === "LIVE" ? maps.MAP2_SCORE : "", // Будет NEXT или счет
      LIVE_MAP3: statusText === "LIVE" ? maps.MAP3 : "",
      LIVE_MAP3_SCORE: statusText === "LIVE" ? maps.MAP3_SCORE : "", // Будет DECIDER, NEXT или счет
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
      FINISHED_MAP3_SCORE: statusText === "FINISHED" ? maps.MAP3_SCORE : "", // Будет DECIDER или счет
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

// ----------------------
// Помощник для иконок счета
// ----------------------
/**
 * Возвращает путь к иконке в зависимости от счета карты.
 * @param {string} scoreStr - Строка счета в формате "X:Y".
 * @returns {string} - Путь к иконке (_L.png, _R.png или _none.png).
 */
function getScoreIcon(scoreStr) {
  if (typeof scoreStr !== 'string') return "C:\\projects\\NewTimer\\files\\none.png";
  const parts = scoreStr.split(":");
  if (parts.length !== 2) return "C:\\projects\\NewTimer\\files\\mp_none.png";
  const left = parseFloat(parts[0]);
  const right = parseFloat(parts[1]);
  if (isNaN(left) || isNaN(right)) return "C:\\projects\\NewTimer\\files\\none.png";
  if (right > left) return "C:\\projects\\NewTimer\\files\\mp_R.png";
  if (left > right) return "C:\\projects\\NewTimer\\files\\mp_L.png";
  return "C:\\projects\\NewTimer\\files\\none.png";
}
