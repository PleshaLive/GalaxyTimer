// public/js/main.js

import { initMatches, gatherMatchesData, updateMatchUI } from "./matches.js";
import { initMapVeto, gatherMapVetoData } from "./mapVeto.js";
import { initVRS, loadAllVRS, gatherVRSData } from "./vrs.js";
import { saveData } from "./api.js";

// Флаг, показывающий, что пользователь активно редактирует данные.
let isEditing = false;

// При инициализации добавляем обработчики фокуса и blur ко всем input и select
document.querySelectorAll("input, select").forEach(el => {
  el.addEventListener("focus", () => {
    isEditing = true;
    console.log("Редактирование началось");
  });
  el.addEventListener("blur", () => {
    isEditing = false;
    console.log("Редактирование закончено — обновляю данные");
    // После окончания редактирования сразу обновляем данные с сервера
    loadMatchesFromServer();
  });
});

// Инициализация модулей
initMatches();
initMapVeto();
initVRS();

// Функция загрузки данных с сервера и обновления UI
async function loadMatchesFromServer() {
  try {
    const response = await fetch("/api/matchdata");
    const matches = await response.json();

    // Обновляем поля для каждого матча – например, время, статус, селекты команд
    matches.forEach((match, index) => {
      const matchIndex = index + 1;

      // Обновляем поле времени
      const timeInput = document.getElementById(`timeInput${matchIndex}`);
      if (timeInput) {
        timeInput.value = match.UPCOM_TIME || match.LIVE_TIME || match.FINISHED_TIME || "";
      }

      // Обновляем статус матча
      const statusSelect = document.getElementById(`statusSelect${matchIndex}`);
      if (statusSelect) {
        if (match.FINISHED_MATCH_STATUS === "FINISHED") {
          statusSelect.value = "FINISHED";
        } else if (match.LIVE_MATCH_STATUS === "LIVE") {
          statusSelect.value = "LIVE";
        } else if (match.UPCOM_MATCH_STATUS === "UPCOM") {
          statusSelect.value = "UPCOM";
        }
        // Если у вас есть функция для обновления цвета статуса, вызовите её здесь:
        // updateStatusColor(statusSelect);
      }

      // Обновляем селекты команд
      const team1Select = document.getElementById(`team1Select${matchIndex}`);
      if (team1Select) {
        team1Select.value = match.UPCOM_TEAM1 || match.LIVE_TEAM1 || match.FINISHED_TEAM1 || team1Select.value;
      }
      const team2Select = document.getElementById(`team2Select${matchIndex}`);
      if (team2Select) {
        team2Select.value = match.UPCOM_TEAM2 || match.LIVE_TEAM2 || match.FINISHED_TEAM2 || team2Select.value;
      }

      // Если ранее обновлялись кнопки-победителя, можно вызвать:
      // updateWinnerButtonLabels(matchIndex);
      // refreshWinnerHighlight(matchIndex);
    });
  } catch (error) {
    console.error("Ошибка загрузки matchdata:", error);
  }
}

// Вызываем загрузку данных при загрузке страницы
window.addEventListener("DOMContentLoaded", () => {
  loadMatchesFromServer();
  loadAllVRS();
});

// Функция автосохранения с использованием debounce (500 мс)
let autoSaveTimeout;
function autoSave() {
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    try {
      const matchesData = gatherMatchesData();
      const savedMatches = await saveData("/api/matchdata", matchesData);

      const mapVetoData = gatherMapVetoData();
      const savedVeto = await saveData("/api/mapveto", mapVetoData);

      const vrsData = gatherVRSData();
      const savedVRS = await saveData("/api/vrs", vrsData);

      // Обновляем VRS после сохранения
      loadAllVRS();

      console.log("Автосохранение прошло успешно", { savedMatches, savedVeto, savedVRS });
    } catch (err) {
      console.error("Ошибка автосохранения:", err);
    }
  }, 500);
}

// Привязываем автосохранение ко всем input и select элементам
document.querySelectorAll("input, select").forEach(element => {
  element.addEventListener("change", autoSave);
});

// Подключаем socket.io и обновляем данные (если пользователь не редактирует)
const socket = io();
socket.on("reload", async () => {
  console.log("Получено событие обновления");
  if (!isEditing) {
    // Задержка даёт время серверу сохранить данные (например, 1500 мс)
    setTimeout(async () => {
      await loadMatchesFromServer();
    }, 1500);
  } else {
    console.log("Сейчас пользователь редактирует форму — обновление отложено");
  }
});
