// public/js/main.js
// Импортируем необходимые функции из других модулей
import { initMatches, gatherSingleMatchData, updateWinnerButtonLabels, refreshWinnerHighlight, areTeamsInitialized, updateStatusColor } from "./matches.js";
import { initMapVeto, gatherMapVetoData } from "./mapVeto.js";
import { initVRS, gatherSingleVRSData, updateVRSTeamNames } from "./vrs.js";
import { saveData } from "./api.js";

// ========== Инициализация модулей ==========
// Начинаем инициализацию команд и сохраняем промис, чтобы дождаться его позже
const initPromise = initMatches();
// Инициализируем остальные модули (они не требуют ожидания)
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========

// Обработчик события 'jsonUpdate' (обновление данных всех матчей)
socket.on("jsonUpdate", async (matches) => { // Делаем обработчик асинхронным
  console.log("[SOCKET] Received jsonUpdate:", matches);
  try {
      // Ждем завершения инициализации команд перед обновлением UI
      await initPromise;
      // Обновляем интерфейс матчей
      updateMatchesUI(matches);
  } catch (error) {
      // Логируем ошибку, если обновление UI не удалось
      console.error("[SOCKET] Error updating matches UI after jsonUpdate:", error);
  }
  // Обновляем блок JSON для отладки (если он есть)
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) {
    jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

// Обработчик события 'mapVetoUpdate'
socket.on("mapVetoUpdate", (updatedMapVeto) => {
  console.log("[SOCKET] Received mapVetoUpdate:", updatedMapVeto);
  // Обновляем интерфейс Map Veto
  updateMapVetoUI(updatedMapVeto);
});

// Обработчик события 'vrsUpdate' (обновление данных VRS)
socket.on("vrsUpdate", (rawVrsData) => {
  console.log("[SOCKET] Received vrsUpdate (raw):", rawVrsData);
  // Обновляем интерфейс VRS
  updateVRSUI(rawVrsData);
});

// Обработчик события 'customFieldsUpdate' (обновление верхнего блока)
socket.on("customFieldsUpdate", (newFields) => {
  console.log("[SOCKET] Received customFieldsUpdate:", newFields);
  // Получаем данные (сервер может прислать объект в массиве)
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  // Проверяем, что получили объект
  if (fieldsData && typeof fieldsData === 'object') {
      // Обновляем интерфейс верхнего блока
      updateCustomFieldsUI(fieldsData);
  } else {
      // Предупреждение, если данные некорректны
      console.warn("[SOCKET] Received invalid customFieldsUpdate:", newFields);
      // Можно обновить UI пустыми значениями
      updateCustomFieldsUI({});
  }
});

// Обработчик для обновления полей паузы
socket.on("pauseUpdate", (pauseData) => {
    console.log("[SOCKET] Received pauseUpdate:", pauseData);
    const msgInput = document.getElementById('pauseMessageInput');
    const timeInput = document.getElementById('pauseTimeInput');
    // Обновляем поля, только если данные существуют
    if (pauseData) {
        if (msgInput && msgInput.value !== (pauseData.pause || "")) msgInput.value = pauseData.pause || "";
        if (timeInput && timeInput.value !== (pauseData.lastUpd || "")) timeInput.value = pauseData.lastUpd || "";
    } else { // Очищаем поля, если пришли пустые данные
        if (msgInput) msgInput.value = "";
        if (timeInput) timeInput.value = "";
    }
});

// ========== Функции обновления UI ==========

/**
 * Обновляет интерфейс для всех карточек матчей на основе полученных данных.
 * @param {Array<object>} matches - Массив объектов с данными матчей.
 */
function updateMatchesUI(matches) {
  console.log("[UI] Updating matches UI...");
  if (!Array.isArray(matches)) {
      console.warn("[UI] updateMatchesUI received invalid data:", matches);
      return;
  }
  // Проходим по каждому объекту матча в массиве
  matches.forEach((match, index) => {
    const matchIndex = index + 1; // Индекс матча (1-4)
    // Находим соответствующую колонку матча в HTML
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) {
        // Предупреждение, если колонка не найдена
        console.warn(`[UI] Match column ${matchIndex} not found for UI update.`);
        return; // Пропускаем этот матч
    }

    // --- Обновление времени матча ---
    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      // Получаем время из данных, убираем " CEST" если есть
      let timeValue = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      timeValue = timeValue.replace(/ CEST$/i, '').trim();
      // Обновляем значение input, только если оно отличается
      if (timeInput.value !== timeValue) timeInput.value = timeValue;
    }

    // --- Обновление статуса матча ---
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
        let newStatus = ""; // Определяем статус на основе данных
        if (match.FINISHED_MATCH_STATUS === "FINISHED") newStatus = "FINISHED";
        else if (match.LIVE_MATCH_STATUS === "LIVE") newStatus = "LIVE";
        else if (match.UPCOM_MATCH_STATUS === "UPCOM") newStatus = "UPCOM";

        // Обновляем значение селекта и стили, только если статус изменился
        if (newStatus && statusSelect.value !== newStatus) {
            statusSelect.value = newStatus;
             // Вызываем функцию для обновления цвета (она должна быть импортирована)
             if (typeof updateStatusColor === 'function') {
                 updateStatusColor(statusSelect);
             } else { console.error("updateStatusColor function is not available!"); }
             // Обновляем CSS класс у родительской колонки
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
             matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
        } else if (!newStatus && statusSelect.value !== statusSelect.options[0].value) {
             // Если статус не определен в данных, сбрасываем на дефолтное значение
             statusSelect.value = statusSelect.options[0].value; // Предполагаем, что первая опция - дефолтная
             if (typeof updateStatusColor === 'function') updateStatusColor(statusSelect);
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
        }
    }

    // --- Обновление команд ---
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    // Получаем имя команды из данных, или пустую строку
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select) {
        // Проверяем, существует ли опция с таким именем
        const optionExists = team1Select.querySelector(`option[value="${CSS.escape(team1Name)}"]`);
        // Устанавливаем значение, если имя не пустое и опция существует
        if (team1Name && optionExists) {
            if (team1Select.value !== team1Name) team1Select.value = team1Name;
        } else if (team1Select.value !== "") {
            // Иначе сбрасываем на пустую опцию ("-")
            team1Select.value = "";
        }
    }

    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
     if (team2Select) {
        const optionExists = team2Select.querySelector(`option[value="${CSS.escape(team2Name)}"]`);
        if (team2Name && optionExists) {
            if (team2Select.value !== team2Name) team2Select.value = team2Name;
        } else if (team2Select.value !== "") {
            // Иначе сбрасываем на пустую опцию ("-")
            team2Select.value = "";
        }
    }

    // --- Обновление данных по картам и счёту ---
    let prefix = ""; // Префикс ключа в зависимости от статуса
    if (match.FINISHED_MATCH_STATUS === "FINISHED") prefix = "FINISHED_";
    else if (match.LIVE_MATCH_STATUS === "LIVE") prefix = "LIVE_";
    else if (match.UPCOM_MATCH_STATUS === "UPCOM") prefix = "UPCOM_";

    // Проходим по всем строкам карт (.map-row)
    const mapRows = matchColumn.querySelectorAll(".map-row");
    mapRows.forEach((row, i) => {
      const mapKey = prefix + `MAP${i + 1}`; // Ключ для имени карты
      const scoreKey = prefix + `MAP${i + 1}_SCORE`; // Ключ для счета карты
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");

      // Обновляем селект карты
      const mapValue = match[mapKey]; // Получаем имя карты из данных
      if (mapSelect && mapValue !== undefined) {
          // Проверяем наличие опции с таким значением
          const optionExists = mapSelect.querySelector(`option[value="${CSS.escape(mapValue)}"]`);
          if (optionExists) {
              // Устанавливаем значение, если оно отличается
              if (mapSelect.value !== mapValue) mapSelect.value = mapValue;
          } else if (mapSelect.value !== mapSelect.options[0].value) {
              // Сбрасываем на дефолтное, если опции нет
              mapSelect.value = mapSelect.options[0].value;
          }
      } else if (mapSelect && mapSelect.value !== mapSelect.options[0].value) {
          // Сбрасываем на дефолтное, если данных нет
          mapSelect.value = mapSelect.options[0].value;
      }

      // Обновляем поле счета
      const scoreValue = match[scoreKey]; // Получаем счет из данных
      if (scoreInput && scoreValue !== undefined) {
         // Устанавливаем значение, если оно отличается
         if (scoreInput.value !== scoreValue) scoreInput.value = scoreValue;
      } else if (scoreInput && scoreInput.value !== "") {
        // Очищаем поле, если данных нет
        scoreInput.value = "";
      }
    });

    // --- Восстановление состояния победителя ---
    let winnerTeamKey = "";
    // Получаем текущие имена команд из селектов (они уже обновлены)
    const currentTeam1Name = team1Select ? team1Select.value : "";
    const currentTeam2Name = team2Select ? team2Select.value : "";
    // Победитель определяется только для FINISHED матчей по полю TEAMWINNER
    if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
       // Сравниваем сохраненного победителя с текущими именами в селектах
       if (currentTeam1Name && match.TEAMWINNER === currentTeam1Name) {
           winnerTeamKey = "TEAM1";
       } else if (currentTeam2Name && match.TEAMWINNER === currentTeam2Name) {
           winnerTeamKey = "TEAM2";
       }
    }

    // Устанавливаем или удаляем атрибут data-winner
    if (winnerTeamKey) {
        matchColumn.setAttribute("data-winner", winnerTeamKey);
    } else {
        matchColumn.removeAttribute("data-winner");
    }

    // Обновляем лейблы и подсветку кнопок победителя
    if (typeof updateWinnerButtonLabels === 'function') {
        updateWinnerButtonLabels(matchIndex);
    } else { console.warn(`updateWinnerButtonLabels не найдена для матча ${matchIndex}`); }
    if (typeof refreshWinnerHighlight === 'function') {
        refreshWinnerHighlight(matchIndex);
    } else {
        console.warn(`refreshWinnerHighlight не найдена для матча ${matchIndex}`);
        // Запасная логика подсветки
        matchColumn.querySelectorAll(".winner-btn").forEach(b => {
            b.classList.toggle("winner-selected", b.getAttribute("data-team") === winnerTeamKey);
        });
    }
    // --- Конец восстановления состояния победителя ---

    // Обновляем имена команд в соответствующей таблице VRS
    if(typeof updateVRSTeamNames === 'function') {
        updateVRSTeamNames(); // Обновляем имена во всех VRS таблицах
    }

  });
   console.log("[UI] Matches UI update finished.");
}

/**
 * Обновляет интерфейс блока Map Veto.
 * @param {object} mapVetoData - Объект с данными Map Veto.
 */
function updateMapVetoUI(mapVetoData) {
    // Проверка на корректность данных
    if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
      console.warn("[UI] Получены некорректные данные для updateMapVetoUI:", mapVetoData);
      return;
    }
    // Обновляем селект выбора матча
    const matchSelect = document.getElementById("matchSelect");
    if (matchSelect && mapVetoData.matchIndex && matchSelect.value != mapVetoData.matchIndex) { // Обновляем только если значение отличается
        matchSelect.value = mapVetoData.matchIndex;
    }

    // Обновляем каждую строку таблицы вето
    mapVetoData.veto.forEach((vetoItem, idx) => {
        const rowIndex = idx + 1;
        const row = document.querySelector(`#vetoTable tr[data-index="${rowIndex}"]`);
        if (row) {
            const actionSelect = row.querySelector(".veto-action");
            const mapSelect = row.querySelector(".veto-map");
            const teamSelect = row.querySelector(".veto-team");
            const sideSelect = row.querySelector(".veto-side");

            // Устанавливаем значения селектов, используя значения по умолчанию, если данных нет
            if (actionSelect && actionSelect.value !== (vetoItem.action || 'BAN')) actionSelect.value = vetoItem.action || 'BAN';
            if (mapSelect && mapSelect.value !== (vetoItem.map || mapSelect.options[0].value)) mapSelect.value = vetoItem.map || mapSelect.options[0].value;
            if (teamSelect && teamSelect.value !== (vetoItem.team || 'TEAM1')) teamSelect.value = vetoItem.team || 'TEAM1';
            if (sideSelect && sideSelect.value !== (vetoItem.side || '-')) sideSelect.value = vetoItem.side || '-';
        } else {
            console.warn(`[UI] Строка ${rowIndex} в таблице Map Veto не найдена.`);
        }
    });
    console.log("[UI] Map Veto UI updated for match", mapVetoData.matchIndex);
}

/**
 * Обновляет интерфейс таблиц VRS на основе "сырых" данных.
 * @param {object} rawVrsData - Объект с данными VRS для всех матчей ({ "1": {...}, "2": {...}, ... }).
 */
function updateVRSUI(rawVrsData) {
    if (!rawVrsData) {
      console.warn("[UI] Получены пустые данные для updateVRSUI");
      return;
    }
    console.log("[UI] Updating VRS UI...");
    // Проходим по всем 4 матчам
    for (let i = 1; i <= 4; i++) {
        const matchVrs = rawVrsData[i]; // Данные VRS для текущего матча
        // Проверяем наличие данных для матча и для обеих команд
        if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
            // Обновляем поля для Team 1
            const team1Win = document.getElementById(`team1WinPoints${i}`);
            // Используем ?? '' для обработки null/undefined и установки пустой строки
            if (team1Win && team1Win.value !== (matchVrs.TEAM1.winPoints ?? '')) team1Win.value = matchVrs.TEAM1.winPoints ?? '';
            const team1Lose = document.getElementById(`team1LosePoints${i}`);
            if (team1Lose && team1Lose.value !== (matchVrs.TEAM1.losePoints ?? '')) team1Lose.value = matchVrs.TEAM1.losePoints ?? '';
            const team1Rank = document.getElementById(`team1Rank${i}`);
            if (team1Rank && team1Rank.value !== (matchVrs.TEAM1.rank ?? '')) team1Rank.value = matchVrs.TEAM1.rank ?? '';
            const team1Current = document.getElementById(`team1CurrentPoints${i}`);
            if (team1Current && team1Current.value !== (matchVrs.TEAM1.currentPoints ?? '')) team1Current.value = matchVrs.TEAM1.currentPoints ?? '';

            // Обновляем поля для Team 2
            const team2Win = document.getElementById(`team2WinPoints${i}`);
            if (team2Win && team2Win.value !== (matchVrs.TEAM2.winPoints ?? '')) team2Win.value = matchVrs.TEAM2.winPoints ?? '';
            const team2Lose = document.getElementById(`team2LosePoints${i}`);
            if (team2Lose && team2Lose.value !== (matchVrs.TEAM2.losePoints ?? '')) team2Lose.value = matchVrs.TEAM2.losePoints ?? '';
            const team2Rank = document.getElementById(`team2Rank${i}`);
            if (team2Rank && team2Rank.value !== (matchVrs.TEAM2.rank ?? '')) team2Rank.value = matchVrs.TEAM2.rank ?? '';
            const team2Current = document.getElementById(`team2CurrentPoints${i}`);
            if (team2Current && team2Current.value !== (matchVrs.TEAM2.currentPoints ?? '')) team2Current.value = matchVrs.TEAM2.currentPoints ?? '';
        } else {
            // Если данных для матча i нет, очищаем поля ввода
            const fields = ['WinPoints', 'LosePoints', 'Rank', 'CurrentPoints'];
            fields.forEach(field => {
                const el1 = document.getElementById(`team1${field}${i}`);
                if (el1 && el1.value !== '') el1.value = ''; // Очищаем, если не пусто
                const el2 = document.getElementById(`team2${field}${i}`);
                if (el2 && el2.value !== '') el2.value = '';
            });
        }
    }
    // Обновляем имена команд в таблицах VRS после обновления данных очков
    if(typeof updateVRSTeamNames === 'function') {
        updateVRSTeamNames();
    }
    console.log("[UI] VRS UI update finished.");
}

/**
 * Обновляет поля ввода в верхнем блоке управления.
 * @param {object} fields - Объект с данными Custom Fields.
 */
function updateCustomFieldsUI(fields) {
     if (!fields || typeof fields !== 'object') {
         console.warn("[UI] Invalid data received for updateCustomFieldsUI:", fields);
         return; // Выходим, если данные некорректны
     }
    console.log("[UI] Updating custom fields UI...");
    const upcoming = document.getElementById("upcomingMatchesInput");
    // Обновляем значение, только если оно отличается от текущего
    if (upcoming && upcoming.value !== (fields.upcomingMatches || "")) upcoming.value = fields.upcomingMatches || "";

    const galaxy = document.getElementById("galaxyBattleInput");
    if (galaxy && galaxy.value !== (fields.galaxyBattle || "")) galaxy.value = fields.galaxyBattle || "";

    const startDate = document.getElementById("tournamentStart");
    if (startDate && startDate.value !== (fields.tournamentStart || "")) startDate.value = fields.tournamentStart || "";

    const endDate = document.getElementById("tournamentEnd");
    if (endDate && endDate.value !== (fields.tournamentEnd || "")) endDate.value = fields.tournamentEnd || "";

    const groupStage = document.getElementById("groupStageInput");
    if (groupStage && groupStage.value !== (fields.groupStage || "")) groupStage.value = fields.groupStage || "";

    // Обновляем отображение дня турнира после установки дат
    updateTournamentDay();
    console.log("[UI] Custom fields UI update finished.");
}

// ========== Загрузка данных с сервера ==========

/** Загружает данные всех матчей с сервера и обновляет UI. */
async function loadMatchesFromServer() {
    console.log("[Data] Loading matches data from server...");
    try {
        const response = await fetch("/api/matchdata");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const matches = await response.json();
        console.log("[Data] Matches data loaded:", matches);
        await initPromise; // Убедимся что команды инициализированы
        updateMatchesUI(matches); // Обновляем UI
    } catch (error) {
        console.error("[Data] Ошибка загрузки matchdata:", error);
    }
}

/** Загружает "сырые" данные VRS с сервера и обновляет UI. */
async function loadRawVRSData() {
    console.log("[Data] Loading raw VRS data...");
    try {
        const response = await fetch("/api/vrs-raw");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawVrsData = await response.json();
        console.log("[Data] Raw VRS data loaded:", rawVrsData);
        updateVRSUI(rawVrsData); // Обновляем UI
    } catch (error) {
        console.error("[Data] Ошибка загрузки raw VRS data:", error);
    }
}

/** Загружает данные Map Veto с сервера и обновляет UI. */
async function loadMapVetoFromServer() {
     console.log("[Data] Loading map veto data...");
    try {
        const response = await fetch("/api/mapveto");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const mapVetoData = await response.json();
         console.log("[Data] Map veto data loaded:", mapVetoData);
        updateMapVetoUI(mapVetoData); // Обновляем UI
    } catch (error) {
        console.error("[Data] Ошибка загрузки map veto data:", error);
    }
}

/** Загружает данные Custom Fields с сервера и обновляет UI. */
async function loadCustomFieldsFromServer() {
     console.log("[Data] Loading custom fields data...");
    try {
        const response = await fetch("/api/customfields");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const dataArray = await response.json(); // Ожидаем массив
        console.log("[Data] Custom fields data loaded:", dataArray);
        // Берем первый элемент массива, если он есть и является объектом
        if (dataArray && dataArray.length > 0 && typeof dataArray[0] === 'object') {
            updateCustomFieldsUI(dataArray[0]);
        } else {
            // Иначе инициализируем пустым объектом
            updateCustomFieldsUI({});
        }
    } catch (err) {
        console.error("[Data] Ошибка загрузки custom fields:", err);
        updateCustomFieldsUI({}); // Инициализируем пустым объектом в случае ошибки
    }
}

/** Загружает данные паузы с сервера и обновляет UI. */
async function loadPauseDataFromServer() {
     console.log("[Data] Loading pause data...");
    try {
        const response = await fetch("/api/pause"); // Запрос к эндпоинту паузы
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const dataArray = await response.json(); // Ожидаем массив [{...}]
        console.log("[Data] Pause data loaded:", dataArray);
        const pauseData = (dataArray && dataArray.length > 0) ? dataArray[0] : {}; // Берем первый элемент или пустой объект

        // Обновляем поля ввода
        const msgInput = document.getElementById('pauseMessageInput');
        const timeInput = document.getElementById('pauseTimeInput');
        if (msgInput) msgInput.value = pauseData.pause || "";
        if (timeInput) timeInput.value = pauseData.lastUpd || "";

    } catch (err) {
        console.error("[Data] Ошибка загрузки данных паузы:", err);
        // Можно очистить поля при ошибке
         const msgInput = document.getElementById('pauseMessageInput');
         const timeInput = document.getElementById('pauseTimeInput');
         if (msgInput) msgInput.value = "";
         if (timeInput) timeInput.value = "";
    }
}


// ========== Вспомогательные функции ==========

/** Вычисляет и отображает текущий день турнира. */
function calculateTournamentDay() {
    const startDateInput = document.getElementById("tournamentStart")?.value;
    const endDateInput = document.getElementById("tournamentEnd")?.value;
    const displaySpan = document.getElementById("tournamentDayDisplay");

    if (!displaySpan) return; // Выходим, если нет элемента для отображения

    if (!startDateInput) { // Если дата начала не введена
        displaySpan.textContent = ''; // Очищаем текст
        return;
    }

    try {
        // Преобразуем строки дат в объекты Date
        const start = new Date(startDateInput);
        const end = endDateInput ? new Date(endDateInput) : null;
        const today = new Date();

        // Устанавливаем время на начало дня для корректного сравнения дат
        start.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (end) end.setHours(0, 0, 0, 0);

        // Определяем статус турнира относительно текущей даты
        if (today < start) {
            displaySpan.textContent = 'Турнир не начался';
        } else if (end && today > end) {
            displaySpan.textContent = 'Турнир завершен';
        } else {
            // Рассчитываем разницу в днях
            const diffTime = today - start; // Разница в миллисекундах
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1, так как первый день - это день 1
            displaySpan.textContent = `День ${diffDays}`; // Отображаем результат
        }
    } catch (e) {
        // Обработка ошибок при парсинге дат
        console.error("Ошибка при расчете дня турнира:", e);
        displaySpan.textContent = ''; // Очищаем в случае ошибки
    }
}

/** Обновляет отображение дня турнира, вызывая calculateTournamentDay. */
function updateTournamentDay() {
    calculateTournamentDay();
}

// Привязка обработчиков изменения дат к функции обновления дня турнира
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) tournamentStartInput.addEventListener("change", updateTournamentDay);
if (tournamentEndInput) tournamentEndInput.addEventListener("change", updateTournamentDay);

// ========== Функции сбора данных ==========

/** Собирает данные из верхнего блока управления (Custom Fields). */
function gatherCustomFieldsData() {
     updateTournamentDay(); // Обновляем день турнира перед сбором
    // Возвращаем объект с данными, используя ?. и ?? для безопасности
    return {
        upcomingMatches: document.getElementById("upcomingMatchesInput")?.value ?? "",
        galaxyBattle: document.getElementById("galaxyBattleInput")?.value ?? "",
        tournamentStart: document.getElementById("tournamentStart")?.value ?? "",
        tournamentEnd: document.getElementById("tournamentEnd")?.value ?? "",
        tournamentDay: document.getElementById("tournamentDayDisplay")?.textContent ?? "",
        groupStage: document.getElementById("groupStageInput")?.value ?? ""
    };
}

/** Собирает данные из полей паузы. */
function gatherPauseData() {
    const message = document.getElementById("pauseMessageInput")?.value ?? "";
    const time = document.getElementById("pauseTimeInput")?.value ?? "";
    return {
        pause: message,
        lastUpd: time // Используем ключ как в JSON примере
    };
}


// ========== Функции сохранения данных ==========

/**
 * Управляет визуальным состоянием кнопки сохранения (текст, цвет, блокировка).
 * @param {HTMLButtonElement} button - Элемент кнопки.
 * @param {'idle' | 'saving' | 'saved' | 'error'} state - Новое состояние кнопки.
 * @param {string | null} [message=null] - Сообщение для отображения на кнопке (опционально).
 */
function setButtonState(button, state, message = null) {
    if (!button) return; // Проверка на существование кнопки
    // Сохраняем или получаем исходный текст кнопки из data-атрибута
    const originalText = button.dataset.originalText || 'SAVE'; // Используем SAVE как дефолт
    button.disabled = (state === 'saving'); // Блокируем кнопку в состоянии 'saving'
    // Сначала убираем все классы состояний
    button.classList.remove('saving', 'saved', 'error');
    // Устанавливаем стиль курсора
    button.style.cursor = (state === 'saving') ? 'wait' : 'pointer';
    // Сбрасываем цвет фона на стандартный
    button.style.backgroundColor = "";

    // Устанавливаем текст и класс в зависимости от состояния
    switch (state) {
        case 'saving':
            button.textContent = message || 'SAVING...';
            button.classList.add('saving');
            break;
        case 'saved':
            button.textContent = message || 'SAVED!';
            button.classList.add('saved');
            // Возвращаем исходный текст через 1.5 секунды
            setTimeout(() => {
                // Проверяем, не изменилось ли состояние за это время
                if (button.classList.contains('saved')) {
                     button.textContent = originalText; // Возвращаем исходный текст
                     button.classList.remove('saved');
                }
            }, 1500);
            break;
        case 'error':
            button.textContent = message || 'ERROR!';
            button.classList.add('error');
             // Возвращаем исходный текст через 2.5 секунды
            setTimeout(() => {
                 if (button.classList.contains('error')) {
                    button.textContent = originalText; // Возвращаем исходный текст
                    button.classList.remove('error');
                 }
            }, 2500);
            break;
        case 'idle': // Возврат в исходное состояние
        default:
            button.textContent = originalText; // Восстанавливаем исходный текст
            break;
    }
}


/**
 * Собирает и отправляет данные одного матча и его VRS на сервер.
 * @param {number} matchIndex - Индекс матча (1-4).
 * @param {HTMLButtonElement} buttonElement - Кнопка, по которой кликнули.
 */
async function saveMatchData(matchIndex, buttonElement) {
    console.log(`[Save] Saving data for Match ${matchIndex}...`);
    setButtonState(buttonElement, 'saving'); // Устанавливаем состояние "сохранение"

    try {
        // 1. Сбор данных матча
        const matchData = gatherSingleMatchData(matchIndex);
        if (!matchData) throw new Error(`Не удалось собрать данные для матча ${matchIndex}`);
        console.log(`[Save] Match ${matchIndex} Data:`, matchData);

        // 2. Сбор данных VRS для матча
        const vrsData = gatherSingleVRSData(matchIndex);
        if (!vrsData) throw new Error(`Не удалось собрать VRS данные для матча ${matchIndex}`);
        console.log(`[Save] Match ${matchIndex} VRS Data:`, vrsData);

        // 3. Отправка данных матча на сервер методом PUT
        await saveData(`/api/matchdata/${matchIndex}`, matchData, 'PUT');
        console.log(`[Save] Match ${matchIndex} data saved successfully.`);

        // 4. Отправка данных VRS на сервер методом PUT
        await saveData(`/api/vrs/${matchIndex}`, vrsData, 'PUT');
        console.log(`[Save] Match ${matchIndex} VRS data saved successfully.`);

        // 5. Опционально: Сохранение Custom Fields (верхний блок)
        // const customData = gatherCustomFieldsData();
        // await saveData("/api/customfields", customData, 'POST');
        // console.log("[Save] Custom Fields data saved.");

        // Устанавливаем состояние "сохранено"
        setButtonState(buttonElement, 'saved');

    } catch (error) {
        // В случае ошибки выводим сообщение и устанавливаем состояние "ошибка"
        console.error(`[Save] Error saving data for Match ${matchIndex}:`, error);
        setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
    } finally {
         // Гарантируем, что кнопка разблокирована, если она не в состоянии 'saved' или 'error'
         if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
             setButtonState(buttonElement, 'idle'); // Возвращаем в исходное состояние
         }
    }
}

/**
 * Собирает и отправляет данные Map Veto на сервер.
 * @param {HTMLButtonElement} buttonElement - Кнопка сохранения Map Veto.
 */
async function saveMapVetoData(buttonElement) {
    console.log(`[Save] Saving Map Veto data...`);
    setButtonState(buttonElement, 'saving'); // Устанавливаем состояние "сохранение"
    try {
        // Сбор данных Map Veto
        const mapVetoData = gatherMapVetoData();
        if (!mapVetoData) throw new Error("Не удалось собрать данные Map Veto.");
        console.log(`[Save] Map Veto Data:`, mapVetoData);
        // Отправка данных на сервер методом POST
        await saveData('/api/mapveto', mapVetoData, 'POST');
        console.log(`[Save] Map Veto data saved successfully.`);
        // Устанавливаем состояние "сохранено"
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        // В случае ошибки выводим сообщение и устанавливаем состояние "ошибка"
        console.error(`[Save] Error saving Map Veto data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
    } finally {
         // Гарантируем, что кнопка разблокирована
         if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
             setButtonState(buttonElement, 'idle');
         }
    }
}

/**
 * Собирает и отправляет данные из верхнего блока (Custom Fields) на сервер.
 * @param {HTMLButtonElement} buttonElement - Кнопка сохранения хедера.
 */
async function saveHeaderData(buttonElement) {
    console.log(`[Save] Saving Header data...`);
    setButtonState(buttonElement, 'saving'); // Устанавливаем состояние "сохранение"
    try {
        const customData = gatherCustomFieldsData(); // Собираем данные хедера
        console.log(`[Save] Header Data:`, customData);
        // Отправляем данные на сервер методом POST
        await saveData('/api/customfields', customData, 'POST');
        console.log(`[Save] Header data saved successfully.`);
        // Устанавливаем состояние "сохранено"
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        // В случае ошибки выводим сообщение и устанавливаем состояние "ошибка"
        console.error(`[Save] Error saving Header data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
    } finally {
         // Гарантируем, что кнопка разблокирована
         if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
             setButtonState(buttonElement, 'idle');
         }
    }
}

/**
 * Собирает и отправляет данные паузы на сервер.
 * @param {HTMLButtonElement} buttonElement - Кнопка сохранения паузы.
 */
async function savePauseData(buttonElement) {
    console.log(`[Save] Saving Pause data...`);
    setButtonState(buttonElement, 'saving'); // Устанавливаем состояние "сохранение"
    try {
        const pauseData = gatherPauseData(); // Собираем данные паузы
        console.log(`[Save] Pause Data:`, pauseData);
        // Отправляем POST запрос на новый эндпоинт /api/pause
        await saveData('/api/pause', pauseData, 'POST');
        console.log(`[Save] Pause data saved successfully.`);
        // Устанавливаем состояние "сохранено"
        setButtonState(buttonElement, 'saved');
    } catch (error) {
        // В случае ошибки выводим сообщение и устанавливаем состояние "ошибка"
        console.error(`[Save] Error saving Pause data:`, error);
        setButtonState(buttonElement, 'error', error.message || 'SAVE ERROR');
    } finally {
         // Гарантируем, что кнопка разблокирована
         if (!buttonElement.classList.contains('saved') && !buttonElement.classList.contains('error')) {
             setButtonState(buttonElement, 'idle');
         }
    }
}


// ========== Привязка обработчиков к кнопкам ==========

/** Привязывает обработчики кликов к кнопкам сохранения. */
function setupSaveButtonListeners() {
    // Обработчики для кнопок сохранения матчей
    document.querySelectorAll('.save-match-button').forEach(button => {
        // Сохраняем исходный текст кнопки в data-атрибут
        button.dataset.originalText = button.textContent;
        // Получаем индекс матча из data-атрибута кнопки
        const matchIndex = button.dataset.matchIndex;
        if (matchIndex) {
            // Привязываем обработчик клика, передавая индекс матча и саму кнопку
            button.addEventListener('click', () => saveMatchData(parseInt(matchIndex, 10), button));
            console.log(`[Init] Save listener attached for Match ${matchIndex}`);
        } else {
            // Предупреждение, если у кнопки нет атрибута с индексом матча
            console.warn("[Init] Save match button found without data-match-index attribute.");
        }
    });

    // Обработчик для кнопки сохранения Map Veto
    const saveVetoButton = document.getElementById('saveMapVetoButton');
    if (saveVetoButton) {
        saveVetoButton.dataset.originalText = saveVetoButton.textContent; // Сохраняем исходный текст
        // Привязываем обработчик клика, передавая кнопку
        saveVetoButton.addEventListener('click', () => saveMapVetoData(saveVetoButton));
        console.log("[Init] Save listener attached for Map Veto.");
    } else {
        // Предупреждение, если кнопка не найдена по ID
        console.warn("[Init] Save Map Veto button (id='saveMapVetoButton') not found.");
    }

    // Обработчик для кнопки сохранения хедера
    const saveHeaderButton = document.getElementById('saveHeaderButton');
    if (saveHeaderButton) {
        saveHeaderButton.dataset.originalText = saveHeaderButton.textContent; // Сохраняем исходный текст
        // Привязываем обработчик клика, передавая кнопку
        saveHeaderButton.addEventListener('click', () => saveHeaderData(saveHeaderButton));
        console.log("[Init] Save listener attached for Header.");
    } else {
        // Предупреждение, если кнопка не найдена по ID
        console.warn("[Init] Save Header button (id='saveHeaderButton') not found.");
    }

    // Обработчик для кнопки сохранения паузы
    const savePauseButton = document.getElementById('savePauseButton');
    if (savePauseButton) {
        savePauseButton.dataset.originalText = savePauseButton.textContent; // Сохраняем исходный текст
        // Привязываем обработчик клика, передавая кнопку
        savePauseButton.addEventListener('click', () => savePauseData(savePauseButton));
        console.log("[Init] Save listener attached for Pause.");
    } else {
        // Предупреждение, если кнопка не найдена по ID
        console.warn("[Init] Save Pause button (id='savePauseButton') not found.");
    }
}


// ========== Инициализация при загрузке страницы ==========

window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOMContentLoaded: Starting initialization...");
  try {
      // 1. Дожидаемся завершения инициализации команд (загрузка списка и заполнение селектов)
      await initPromise; // Ждем разрешения промиса из matches.js
      console.log("DOMContentLoaded: Teams initialized.");

      // 2. Загружаем остальные данные с сервера
      // Порядок важен: сначала матчи, потом остальное, что может от них зависеть
      await loadMatchesFromServer();
      await loadRawVRSData(); // Загружаем сырые данные VRS
      await loadCustomFieldsFromServer(); // Загружаем данные хедера
      await loadMapVetoFromServer();
      await loadPauseDataFromServer(); // Загружаем данные паузы

      // 3. Привязываем обработчики ко ВСЕМ кнопкам сохранения (теперь, когда все загружено)
      setupSaveButtonListeners();

      console.log("DOMContentLoaded: Initial data loading and listener setup complete.");

  } catch (error) {
      // Логируем ошибку, если что-то пошло не так во время инициализации
      console.error("DOMContentLoaded: Error during initialization:", error);
      // Можно показать сообщение об ошибке пользователю на странице
  }
});
