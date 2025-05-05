// public/js/main.js
// Импортируем нужные функции, включая функции для обновления кнопок победителя
import { initMatches, gatherMatchesData, updateWinnerButtonLabels, refreshWinnerHighlight } from "./matches.js";
import { initMapVeto, gatherMapVetoData } from "./mapVeto.js";
// Убираем импорт loadAllVRS, если переходим на "сырые" данные
// import { initVRS, loadAllVRS, gatherVRSData } from "./vrs.js";
import { initVRS, gatherVRSData } from "./vrs.js"; // Оставляем initVRS и gatherVRSData
import { saveData } from "./api.js";

// Инициализация модулей
initMatches();
initMapVeto();
initVRS();

// ========== Socket.io подписки ==========

// Обновление матчей (Matches 1–4)
socket.on("jsonUpdate", (matches) => {
  console.log("Получено обновление JSON (Matches):", matches);
  updateMatchesUI(matches); // Обновляем UI матчей
  // Для отладки можно выводить данные в отдельном блоке
  const jsonOutput = document.getElementById("jsonOutput");
  if (jsonOutput) {
    jsonOutput.textContent = JSON.stringify(matches, null, 2);
  }
});

// Обновление Map Veto
socket.on("mapVetoUpdate", (updatedMapVeto) => {
  console.log("Получены обновления Map Veto:", updatedMapVeto);
  updateMapVetoUI(updatedMapVeto);
});

// Обновление VRS (Принимаем "сырые" данные)
socket.on("vrsUpdate", (rawVrsData) => {
  console.log("Получены обновления VRS (raw):", rawVrsData);
  updateVRSUI(rawVrsData); // Обновляем UI напрямую из сырых данных
});

// Обновление верхнего блока (custom fields)
socket.on("customFieldsUpdate", (newFields) => {
  console.log("Получены обновления customFields:", newFields);
  // Убедимся, что newFields это объект, а не массив
  const fieldsData = Array.isArray(newFields) ? newFields[0] : newFields;
  if (fieldsData) {
      updateCustomFieldsUI(fieldsData);
  } else {
      console.warn("Получены некорректные customFieldsUpdate:", newFields);
  }
});

// ========== Функции обновления UI ==========

// Обновление Matches UI (включая восстановление подсветки победителя)
function updateMatchesUI(matches) {
  matches.forEach((match, index) => {
    const matchIndex = index + 1;
    const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
    if (!matchColumn) return; // Пропускаем, если колонка не найдена

    // Обновляем время
    const timeInput = document.getElementById(`timeInput${matchIndex}`);
    if (timeInput) {
      timeInput.value = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
    }
    // Обновляем статус
    const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
    if (statusSelect) {
        let newStatus = "";
        if (match.FINISHED_MATCH_STATUS === "FINISHED") {
            newStatus = "FINISHED";
        } else if (match.LIVE_MATCH_STATUS === "LIVE") {
            newStatus = "LIVE";
        } else if (match.UPCOM_MATCH_STATUS === "UPCOM") {
            newStatus = "UPCOM";
        }
        if (newStatus) {
            statusSelect.value = newStatus;
            // Обновляем классы и цвет фона (если функция доступна)
             if (typeof updateStatusColor === 'function') { // Проверяем доступность функции
                 updateStatusColor(statusSelect);
             }
             matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
             matchColumn.classList.add(`status-${newStatus.toLowerCase()}`);
        }
    }
    // Обновляем команды
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team1Name = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || "";
    if (team1Select && team1Name) {
      team1Select.value = team1Name;
    }
    const team2Select = document.getElementById(`team2Select${matchIndex}`);
    const team2Name = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || "";
    if (team2Select && team2Name) {
      team2Select.value = team2Name;
    }

    // Обновляем данные по картам и счёту
    let prefix = "";
    if (match.FINISHED_MATCH_STATUS === "FINISHED") {
      prefix = "FINISHED_";
    } else if (match.LIVE_MATCH_STATUS === "LIVE") {
      prefix = "LIVE_";
    } else if (match.UPCOM_MATCH_STATUS === "UPCOM") {
      prefix = "UPCOM_";
    }

    const mapRows = matchColumn.querySelectorAll(".map-row");
    mapRows.forEach((row, i) => {
      const mapKey = prefix + `MAP${i + 1}`;
      const scoreKey = prefix + `MAP${i + 1}_SCORE`;
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");
      if (mapSelect && match[mapKey] !== undefined) {
        mapSelect.value = match[mapKey];
      } else if (mapSelect) {
        mapSelect.value = mapSelect.options[0].value; // Сброс на дефолтное значение, если нет данных
      }
      if (scoreInput && match[scoreKey] !== undefined) {
        scoreInput.value = match[scoreKey];
      } else if (scoreInput) {
        scoreInput.value = ""; // Очищаем поле, если нет данных
      }
    });

    // --- Восстановление состояния победителя ---
    let winnerTeamKey = "";
    // Победитель определяется только для FINISHED матчей по полю TEAMWINNER
    if (match.FINISHED_MATCH_STATUS === "FINISHED" && match.TEAMWINNER) {
       if (match.TEAMWINNER === team1Name) { // Сравниваем с актуальным именем команды
           winnerTeamKey = "TEAM1";
       } else if (match.TEAMWINNER === team2Name) {
           winnerTeamKey = "TEAM2";
       }
    }

    // Устанавливаем data-winner только если он определен
    if (winnerTeamKey) {
        matchColumn.setAttribute("data-winner", winnerTeamKey);
    } else {
        // Если победитель не определен (матч не FINISHED или нет данных TEAMWINNER)
        matchColumn.removeAttribute("data-winner");
    }

    // Обновляем лейблы и подсветку кнопок (вызываем функции из matches.js)
    // Убедимся, что функции существуют перед вызовом
    if (typeof updateWinnerButtonLabels === 'function') {
        updateWinnerButtonLabels(matchIndex);
    } else {
        console.warn(`Функция updateWinnerButtonLabels не найдена для матча ${matchIndex}`);
    }
    if (typeof refreshWinnerHighlight === 'function') {
        refreshWinnerHighlight(matchIndex);
    } else {
        console.warn(`Функция refreshWinnerHighlight не найдена для матча ${matchIndex}`);
         // Запасная логика обновления подсветки, если импорт не сработал
        matchColumn.querySelectorAll(".winner-btn").forEach(b => {
            b.classList.toggle("winner-selected", b.getAttribute("data-team") === winnerTeamKey);
        });
    }
    // --- Конец восстановления состояния победителя ---

  });
}


// Обновление Map Veto UI
function updateMapVetoUI(mapVetoData) {
  if (!mapVetoData || !mapVetoData.veto || !Array.isArray(mapVetoData.veto)) {
      console.warn("Получены некорректные данные для updateMapVetoUI:", mapVetoData);
      return;
  }
  // Обновляем селект выбора матча
  const matchSelect = document.getElementById("matchSelect");
  if (matchSelect && mapVetoData.matchIndex) {
      matchSelect.value = mapVetoData.matchIndex;
  }

  // Обновляем таблицу вето
  mapVetoData.veto.forEach((vetoItem, idx) => {
    const row = document.querySelector(`#vetoTable tr[data-index="${idx + 1}"]`);
    if (row) {
      const actionSelect = row.querySelector(".veto-action");
      const mapSelect = row.querySelector(".veto-map");
      const teamSelect = row.querySelector(".veto-team");
      const sideSelect = row.querySelector(".veto-side");

      if (actionSelect) actionSelect.value = vetoItem.action || 'BAN'; // Значение по умолчанию
      if (mapSelect) mapSelect.value = vetoItem.map || mapSelect.options[0].value; // Значение по умолчанию
      if (teamSelect) teamSelect.value = vetoItem.team || 'TEAM1'; // Значение по умолчанию
      if (sideSelect) sideSelect.value = vetoItem.side || '-'; // Значение по умолчанию
    }
  });
}

// Обновление VRS UI (принимает "сырые" данные из db.json)
function updateVRSUI(rawVrsData) {
  if (!rawVrsData) {
      console.warn("Получены пустые данные для updateVRSUI");
      return;
  }
  for (let i = 1; i <= 4; i++) {
    const matchVrs = rawVrsData[i]; // Получаем данные для конкретного матча
    if (matchVrs && matchVrs.TEAM1 && matchVrs.TEAM2) {
      // Обновляем инпуты напрямую из полученных данных
      // Используем || '' для обработки null/undefined значений
      const team1Win = document.getElementById(`team1WinPoints${i}`);
      if (team1Win) team1Win.value = matchVrs.TEAM1.winPoints || '';
      const team1Lose = document.getElementById(`team1LosePoints${i}`);
      if (team1Lose) team1Lose.value = matchVrs.TEAM1.losePoints || '';
      const team1Rank = document.getElementById(`team1Rank${i}`);
      if (team1Rank) team1Rank.value = matchVrs.TEAM1.rank || '';
      const team1Current = document.getElementById(`team1CurrentPoints${i}`);
      if (team1Current) team1Current.value = matchVrs.TEAM1.currentPoints || '';

      const team2Win = document.getElementById(`team2WinPoints${i}`);
      if (team2Win) team2Win.value = matchVrs.TEAM2.winPoints || '';
      const team2Lose = document.getElementById(`team2LosePoints${i}`);
      if (team2Lose) team2Lose.value = matchVrs.TEAM2.losePoints || '';
      const team2Rank = document.getElementById(`team2Rank${i}`);
      if (team2Rank) team2Rank.value = matchVrs.TEAM2.rank || '';
      const team2Current = document.getElementById(`team2CurrentPoints${i}`);
      if (team2Current) team2Current.value = matchVrs.TEAM2.currentPoints || '';
    } else {
        // Если данных для матча i нет, можно очистить поля или оставить как есть
        console.warn(`Нет данных VRS для матча ${i} в rawVrsData`);
    }
  }
}

// Обновление верхнего блока (custom fields)
function updateCustomFieldsUI(fields) {
  if (!fields) return; // Добавим проверку на null/undefined
  const upcoming = document.getElementById("upcomingMatchesInput");
  if (upcoming) {
    upcoming.value = fields.upcomingMatches || "";
  }
  const galaxy = document.getElementById("galaxyBattleInput");
  if (galaxy) {
    galaxy.value = fields.galaxyBattle || "";
  }
  const startDate = document.getElementById("tournamentStart");
  if (startDate) { // Проверяем только наличие элемента
    startDate.value = fields.tournamentStart || ""; // Устанавливаем значение или пустую строку
  }
  const endDate = document.getElementById("tournamentEnd");
  if (endDate) {
    endDate.value = fields.tournamentEnd || "";
  }
  const dayDisplay = document.getElementById("tournamentDayDisplay");
  if (dayDisplay) {
    // Пересчитываем день турнира на основе загруженных дат
    updateTournamentDay(); // Вызываем функцию пересчета
  }
  const groupStage = document.getElementById("groupStageInput");
  if (groupStage) {
    groupStage.value = fields.groupStage || "";
  }
}

// ========== Загрузка данных с сервера ==========

async function loadMatchesFromServer() {
  try {
    const response = await fetch("/api/matchdata");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const matches = await response.json();
    updateMatchesUI(matches);
  } catch (error) {
    console.error("Ошибка загрузки matchdata:", error);
  }
}

// Новая функция для загрузки "сырых" VRS данных
async function loadRawVRSData() {
    try {
        const response = await fetch("/api/vrs-raw"); // Запрос к новому эндпоинту
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const rawVrsData = await response.json();
        console.log("Загружены сырые VRS данные:", rawVrsData);
        updateVRSUI(rawVrsData); // Обновляем UI сырыми данными
    } catch (error) {
        console.error("Ошибка загрузки raw VRS data:", error);
    }
}

async function loadMapVetoFromServer() {
    try {
        const response = await fetch("/api/mapveto");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const mapVetoData = await response.json();
        updateMapVetoUI(mapVetoData);
    } catch (error) {
        console.error("Ошибка загрузки map veto data:", error);
    }
}


async function loadCustomFieldsFromServer() {
  try {
    const response = await fetch("/api/customfields");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const dataArray = await response.json();
    // Сервер возвращает массив [customFieldsData], берем первый элемент
    if (dataArray && dataArray.length > 0) {
        updateCustomFieldsUI(dataArray[0]);
    } else {
        // Если данных нет, можно инициализировать UI пустыми значениями
        updateCustomFieldsUI({});
    }
  } catch (err) {
    console.error("Ошибка загрузки custom fields:", err);
  }
}

/* Убираем updateAggregatedVRS, так как эндпоинт /api/vrs-all не определен
async function updateAggregatedVRS() {
  // ...
}
*/

// Функция вычисления текущего дня турнира (без изменений)
function calculateTournamentDay() {
  const startDateValue = document.getElementById("tournamentStart").value;
  const endDateValue = document.getElementById("tournamentEnd").value; // Добавим дату конца
  const displaySpan = document.getElementById("tournamentDayDisplay");

  if (!startDateValue || !displaySpan) {
      if(displaySpan) displaySpan.textContent = ''; // Очищаем, если нет даты начала
      return "";
  }

  try {
      const start = new Date(startDateValue);
      const end = endDateValue ? new Date(endDateValue) : null;
      const today = new Date();

      // Обнуляем время для корректного сравнения дат
      start.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      if (end) {
          end.setHours(0, 0, 0, 0);
      }

      if (today < start) {
          displaySpan.textContent = 'Турнир не начался';
      } else if (end && today > end) {
          displaySpan.textContent = 'Турнир завершен';
      } else {
          const diffTime = today - start;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 т.к. первый день это день 1
          displaySpan.textContent = `День ${diffDays}`;
      }
  } catch (e) {
      console.error("Ошибка при расчете дня турнира:", e);
      displaySpan.textContent = ''; // Очищаем в случае ошибки
  }
}


// Обновляем display дня турнира
function updateTournamentDay() {
    calculateTournamentDay(); // Просто вызываем функцию расчета и обновления
}

// Привязка обработчиков изменения дат
const tournamentStartInput = document.getElementById("tournamentStart");
const tournamentEndInput = document.getElementById("tournamentEnd");
if (tournamentStartInput) {
    tournamentStartInput.addEventListener("change", updateTournamentDay);
}
if (tournamentEndInput) {
    tournamentEndInput.addEventListener("change", updateTournamentDay);
}

// ========== Функции сбора данных ==========

function gatherCustomFieldsData() {
  // Пересчитываем день турнира перед сбором данных
  updateTournamentDay();
  return {
    upcomingMatches: document.getElementById("upcomingMatchesInput").value,
    galaxyBattle: document.getElementById("galaxyBattleInput").value,
    tournamentStart: document.getElementById("tournamentStart").value,
    tournamentEnd: document.getElementById("tournamentEnd").value,
    tournamentDay: document.getElementById("tournamentDayDisplay").textContent, // Берем актуальное значение
    groupStage: document.getElementById("groupStageInput").value
  };
}

// Функция applyChanges – собирает данные всех блоков и отправляет их на сервер
async function applyChanges() {
  console.log("Нажата кнопка APPLY. Начинаем сбор и отправку данных...");
  try {
    // 1. Сбор данных Custom Fields (верхний блок)
    const customData = gatherCustomFieldsData();
    console.log("Собраны Custom Fields:", customData);
    await saveData("/api/customfields", customData);
    console.log("Custom Fields сохранены.");

    // 2. Сбор данных Matches (статус, время, команды, карты, счет)
    const matchesData = gatherMatchesData();
    console.log("Собраны Matches Data:", matchesData);
    await saveData("/api/matchdata", matchesData);
    console.log("Matches Data сохранены.");

    // 3. Сбор данных Map Veto
    const mapVetoData = gatherMapVetoData();
    console.log("Собраны Map Veto Data:", mapVetoData);
    await saveData("/api/mapveto", mapVetoData);
    console.log("Map Veto Data сохранены.");

    // 4. Сбор данных VRS
    const vrsData = gatherVRSData();
    console.log("Собраны VRS Data:", vrsData);
    await saveData("/api/vrs", vrsData); // Отправляем на существующий эндпоинт для сохранения
    console.log("VRS Data сохранены.");


    // После успешного сохранения всех данных, можно запросить их снова для обновления UI,
    // но это должно происходить через Socket.IO события jsonUpdate, customFieldsUpdate, vrsUpdate, mapVetoUpdate
    // Поэтому явные вызовы load*FromServer() здесь не обязательны, если сервер корректно эмитит события после POST запросов.
    // loadMatchesFromServer();
    // loadRawVRSData(); // Загружаем сырые данные для консистентности
    // loadCustomFieldsFromServer();
    // loadMapVetoFromServer();

    console.log("Изменения успешно применены и отправлены на сервер.");
    // Можно добавить визуальное подтверждение для пользователя
    const applyButton = document.getElementById("applyButton");
    if(applyButton){
        applyButton.textContent = "SAVED!";
        applyButton.style.backgroundColor = "var(--color-success)";
        setTimeout(() => {
            applyButton.textContent = "APPLY";
            applyButton.style.backgroundColor = ""; // Возвращаем исходный градиент
        }, 1500);
    }

  } catch (error) {
    console.error("Ошибка при применении изменений:", error);
    // Сообщить пользователю об ошибке
     const applyButton = document.getElementById("applyButton");
    if(applyButton){
        applyButton.textContent = "ERROR!";
        applyButton.style.backgroundColor = "var(--color-error)";
        setTimeout(() => {
            applyButton.textContent = "APPLY";
            applyButton.style.backgroundColor = "";
        }, 2500);
    }
  }
}

// Привязка обработчика на кнопку Apply
const applyBtn = document.getElementById("applyButton");
if (applyBtn) {
    applyBtn.addEventListener("click", applyChanges);
} else {
    console.error("Кнопка Apply не найдена!");
}


// ========== Инициализация при загрузке страницы ==========

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: Загрузка начальных данных...");
  // Убираем setTimeout
  loadMatchesFromServer();
  loadRawVRSData(); // Загружаем "сырые" VRS данные
  loadCustomFieldsFromServer();
  loadMapVetoFromServer(); // Добавляем загрузку Map Veto
  console.log("Начальная загрузка данных инициирована.");
});

// --- Вспомогательная функция для окраски селекта статуса ---
// (Перенесено из анонимного скрипта в index.html для доступности из updateMatchesUI)
function updateStatusColor(sel) {
  if (!sel) return;
  const v = sel.value.toUpperCase();
  let color;
  switch (v) {
    case "UPCOM":    color = "var(--color-upcom)"; break; // Используем CSS переменные
    case "LIVE":     color = "var(--color-live)"; break;
    case "FINISHED": color = "var(--color-text-muted)"; break; // Можно использовать цвет для finished
    default:         color = "var(--color-surface-light)"; // Цвет по умолчанию
  }
  // Применяем цвет фона и текста
  sel.style.backgroundColor = color;
  sel.style.color = (v === 'UPCOM' || v === 'LIVE' || v === 'FINISHED') ? '#fff' : 'var(--color-text)'; // Белый текст для статусов
  sel.style.borderColor = color; // Можно и рамку окрасить
}

// Привязываем обновление цвета к селектам статуса при инициализации
function attachStatusColorUpdates() {
    for (let m = 1; m <= 4; m++) {
        const sel = document.getElementById("statusSelect" + m);
        if (!sel) continue;
        sel.addEventListener("change", () => updateStatusColor(sel));
        updateStatusColor(sel); // Применяем цвет при загрузке
    }
}

// Вызываем attachStatusColorUpdates после инициализации матчей
// Это можно сделать внутри initMatches в matches.js или здесь после вызова initMatches()
// Но лучше оставить в matches.js, как было сделано ранее.

