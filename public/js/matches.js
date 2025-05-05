// public/js/matches.js

// ----------------------
// Инициализация всего
// ----------------------
export function initMatches() {
  // Загружаем список команд и инициализируем селекты
  fetch("/api/teams")
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
      // Убедимся, что data.teams это массив
      const teamsList = Array.isArray(data.teams) ? data.teams : (Array.isArray(data) ? data : []);
      if (teamsList.length === 0) {
          console.warn("Список команд пуст или не получен.");
      }
      populateTeamSelects(teamsList);
      attachTeamLogoUpdates(); // Обновление лейблов кнопок происходит здесь
      attachWinnerButtons();
      attachStatusColorUpdates(); // Привязываем обновление цвета статусов

      // Первоначальное обновление UI после загрузки списка команд
      for (let m = 1; m <= 4; m++) {
        updateWinnerButtonLabels(m); // Обновляем текст кнопок
        refreshWinnerHighlight(m); // Снимаем подсветку по умолчанию
        const sel = document.getElementById("statusSelect" + m);
        if (sel) updateStatusColor(sel); // Применяем цвет статуса
      }
    })
    .catch(err => console.error("Ошибка загрузки /api/teams:", err));
}

// ----------------------
// Заполнение селектов команд
// ----------------------
export function populateTeamSelects(teamsList) {
  // Добавим опцию "Пусто" или "Выберите команду"
  const defaultOption = document.createElement("option");
  defaultOption.value = ""; // Пустое значение
  defaultOption.textContent = "-"; // Или "Выберите команду"
  defaultOption.dataset.logo = "C:\\projects\\vMix_score\\public\\logos\\none.png"; // Лого по умолчанию

  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    if (!sel1 || !sel2) continue;

    // Очищаем предыдущие опции
    sel1.innerHTML = "";
    sel2.innerHTML = "";

    // Добавляем опцию по умолчанию
    sel1.appendChild(defaultOption.cloneNode(true));
    sel2.appendChild(defaultOption.cloneNode(true));

    // Заполняем командами
    teamsList.forEach(team => {
      if (!team.name || !team.logo) return; // Пропускаем команды без имени или лого

      const opt1 = document.createElement("option");
      opt1.value = team.name;
      opt1.textContent = team.name;
      // Убедимся, что путь к лого корректный
      opt1.dataset.logo = team.logo.startsWith('/')
        ? "C:\\projects\\vMix_score\\public" + team.logo
        : "C:\\projects\\vMix_score\\public\\" + team.logo; // Добавляем слеш, если его нет
      sel1.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = team.name;
      opt2.textContent = team.name;
      opt2.dataset.logo = opt1.dataset.logo; // Используем тот же путь
      sel2.appendChild(opt2);
    });

    // Устанавливаем значение по умолчанию (пустое)
    sel1.value = "";
    sel2.value = "";
  }
}

// ----------------------
// Логотипы и обновление лейблов кнопок
// ----------------------
export function attachTeamLogoUpdates() {
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById("team1Select" + m);
    const sel2 = document.getElementById("team2Select" + m);
    if (!sel1 || !sel2) continue;

    sel1.addEventListener("change", () => {
      // updateTeamLogoPreview(m, 1); // Превью лого пока не используется в HTML
      updateWinnerButtonLabels(m);
    });
    sel2.addEventListener("change", () => {
      // updateTeamLogoPreview(m, 2); // Превью лого пока не используется в HTML
      updateWinnerButtonLabels(m);
    });

    // Начальное обновление лейблов (вызывается в initMatches)
    // updateWinnerButtonLabels(m);
  }
}

// Обновление превью лого (если оно будет добавлено в HTML)
/*
export function updateTeamLogoPreview(matchIndex, teamIndex) {
  const sel = document.getElementById(`team${teamIndex}Select${matchIndex}`);
  const preview = document.getElementById(`team${teamIndex}LogoPreview${matchIndex}`); // Нужен img элемент с таким ID
  if (!sel || !preview) return;
  const selectedOption = sel.options[sel.selectedIndex];
  const logoPath = selectedOption ? selectedOption.dataset.logo : "C:\\projects\\vMix_score\\public\\logos\\none.png";
  // Важно: Браузер не может напрямую отображать локальные пути C:\...
  // Для отображения логотипа нужно использовать относительные URL (/logos/...)
  // Этот код останется для логики, но превью в браузере работать не будет с C:\ путями.
  // preview.src = logoPath; // Это не сработает в браузере
  console.log(`Логотип для Team ${teamIndex} Матч ${matchIndex}: ${logoPath}`);
}
*/

// ----------------------
// Кнопки Winner и подсветка
// ----------------------
export function attachWinnerButtons() {
  document.querySelectorAll(".winner-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const matchColumn = btn.closest(".match-column");
      if (!matchColumn) return;
      const teamKey = btn.getAttribute("data-team"); // "TEAM1" или "TEAM2"
      const matchIndex = parseInt(matchColumn.dataset.match, 10);
      const currentWinner = matchColumn.getAttribute("data-winner");

      // Если кликнули по уже выбранной кнопке - снимаем выбор
      if (currentWinner === teamKey) {
          matchColumn.removeAttribute("data-winner");
      } else {
          // Устанавливаем нового победителя
          matchColumn.setAttribute("data-winner", teamKey);
      }

      // Обновляем подсветку
      refreshWinnerHighlight(matchIndex);
      // Лейблы обновлять не нужно при клике, они зависят от селектов команд
    });
  });
}

// Обновляет текст кнопок победителя в соответствии с выбранными командами
export function updateWinnerButtonLabels(matchIndex) {
  const sel1 = document.getElementById(`team1Select${matchIndex}`);
  const sel2 = document.getElementById(`team2Select${matchIndex}`);
  // Получаем текст выбранной опции или дефолтное имя
  const name1 = sel1 && sel1.value ? sel1.value : "Team 1";
  const name2 = sel2 && sel2.value ? sel2.value : "Team 2";

  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const btn1 = matchColumn.querySelector('.winner-btn[data-team="TEAM1"]');
  const btn2 = matchColumn.querySelector('.winner-btn[data-team="TEAM2"]');
  if (btn1) btn1.textContent = `Победитель: ${name1}`;
  if (btn2) btn2.textContent = `Победитель: ${name2}`;
}

// Обновляет класс 'winner-selected' на кнопках победителя
export function refreshWinnerHighlight(matchIndex) {
  const matchColumn = document.querySelector(`.match-column[data-match="${matchIndex}"]`);
  if (!matchColumn) return;
  const winner = matchColumn.getAttribute("data-winner"); // "TEAM1", "TEAM2" или null
  matchColumn.querySelectorAll(".winner-btn").forEach(b => {
    b.classList.toggle("winner-selected", b.getAttribute("data-team") === winner);
  });
}

// ----------------------
// Окраска селекта статуса
// ----------------------
export function attachStatusColorUpdates() {
  for (let m = 1; m <= 4; m++) {
    const sel = document.getElementById("statusSelect" + m);
    if (!sel) continue;
    sel.addEventListener("change", () => {
        updateStatusColor(sel);
        // Также обновляем класс у родителя .match-column
        const matchColumn = sel.closest('.match-column');
        if (matchColumn) {
            matchColumn.classList.remove('status-upcom', 'status-live', 'status-finished');
            matchColumn.classList.add(`status-${sel.value.toLowerCase()}`);
        }
    });
    // updateStatusColor(sel); // Первоначальная окраска происходит в initMatches
  }
}

// Функция окраски селекта статуса (доступна глобально в модуле)
export function updateStatusColor(sel) {
    if (!sel) return;
    const v = sel.value.toUpperCase();
    let color;
    // Используем CSS переменные для цветов
    switch (v) {
        case "UPCOM":    color = "var(--color-upcom)"; break;
        case "LIVE":     color = "var(--color-live)"; break;
        case "FINISHED": color = "var(--color-text-muted)"; break; // Можно использовать цвет для finished
        default:         color = "var(--color-surface-light)"; // Цвет по умолчанию
    }
    sel.style.backgroundColor = color;
    sel.style.color = '#fff'; // Всегда белый текст для лучшей читаемости на цветном фоне
    sel.style.borderColor = color; // Можно и рамку окрасить
}


// ----------------------
// Сбор данных матчей
// ----------------------
export function gatherMatchesData() {
  const defaultLogo = "C:\\projects\\vMix_score\\public\\logos\\none.png";
  const matches = [];
  const SCORE_REGEX = /^\d+:\d+$/;

  for (let m = 1; m <= 4; m++) {
    const column = document.querySelector(`.match-column[data-match="${m}"]`);
    if (!column) {
        console.warn(`Match column ${m} not found during data gathering.`);
        continue; // Пропускаем итерацию, если колонка не найдена
    }
    const statusSelect = document.getElementById("statusSelect" + m);
    const statusText = statusSelect ? statusSelect.value.toUpperCase() : "";
    const timeInput = document.getElementById("timeInput" + m);
    const timeVal = timeInput ? timeInput.value.trim() : "";

    const selTeam1 = document.getElementById("team1Select" + m);
    const selTeam2 = document.getElementById("team2Select" + m);
    const team1Name = selTeam1 ? selTeam1.value : "";
    const team2Name = selTeam2 ? selTeam2.value : "";

    // Получаем лого из dataset ВЫБРАННОЙ опции
    const team1Logo = selTeam1 && selTeam1.selectedIndex >= 0
        ? selTeam1.options[selTeam1.selectedIndex].dataset.logo || defaultLogo
        : defaultLogo;
    const team2Logo = selTeam2 && selTeam2.selectedIndex >= 0
        ? selTeam2.options[selTeam2.selectedIndex].dataset.logo || defaultLogo
        : defaultLogo;

    // Сбор данных по картам
    const maps = {};
    column.querySelectorAll(".map-row").forEach((row, i) => {
      const mapSelect = row.querySelector(".map-name-select");
      const scoreInput = row.querySelector(".map-score-input");
      maps[`MAP${i + 1}`] = mapSelect ? mapSelect.value : "";
      maps[`MAP${i + 1}_SCORE`] = scoreInput ? scoreInput.value.trim() : "";
    });

    // Автозаполнение счета "NEXT" / "DECIDER" / "MATCH X" (логика сохранена)
    if (statusText === "LIVE") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        if (s1 && SCORE_REGEX.test(s1) && !s2) { // Если первая карта сыграна, а вторая нет
            maps.MAP2_SCORE = "NEXT";
            maps.MAP3_SCORE = "DECIDER";
        } else if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && !s3) { // Если две карты сыграны, а третья нет
            maps.MAP3_SCORE = "NEXT";
        }
    } else if (statusText === "FINISHED") {
        const s1 = maps.MAP1_SCORE, s2 = maps.MAP2_SCORE, s3 = maps.MAP3_SCORE;
        // Если две карты сыграны и третья пустая или не числовая, ставим DECIDER
        if (s1 && SCORE_REGEX.test(s1) && s2 && SCORE_REGEX.test(s2) && (!s3 || !SCORE_REGEX.test(s3))) {
            maps.MAP3_SCORE = "DECIDER";
        }
    } else if (statusText === "UPCOM") {
        if (!maps.MAP1_SCORE) maps.MAP1_SCORE = "NEXT";
        // Убрано автозаполнение NEXT для второй карты, если первая не NEXT
        // if (maps.MAP1_SCORE !== "NEXT" && !maps.MAP2_SCORE) maps.MAP2_SCORE = "NEXT";
        maps.MAP3_SCORE = `MATCH ${m}`; // Оставляем только для третьей карты
    }


    // Определение иконок счета MP*_FIN/LIVE/UPC (логика сохранена)
    let MP1_UPC = "", MP2_UPC = "", MP3_UPC = "";
    let MP1_LIVE = "", MP2_LIVE = "", MP3_LIVE = "";
    let MP1_FIN = "", MP2_FIN = "", MP3_FIN = "";

    if (statusText === "UPCOM") {
      MP1_UPC = MP2_UPC = MP3_UPC = "C:\\projects\\NewTimer\\files\\none.png";
    } else if (statusText === "LIVE") {
      MP1_LIVE = getScoreIcon(maps.MAP1_SCORE);
      MP2_LIVE = getScoreIcon(maps.MAP2_SCORE);
      MP3_LIVE = getScoreIcon(maps.MAP3_SCORE);
    } else if (statusText === "FINISHED") {
      MP1_FIN = getScoreIcon(maps.MAP1_SCORE);
      MP2_FIN = getScoreIcon(maps.MAP2_SCORE);
      MP3_FIN = getScoreIcon(maps.MAP3_SCORE);
    }

    // Определение полей FIN_* (логика сохранена)
    let finCest = "", finResult = "", finVictory = "";
    if (statusText === "FINISHED") {
      finCest = "cest";
      finResult = "Result";
      finVictory = "VICTORY";
    }

    // Определение победителя TEAMWINNER (используем data-winner)
    const winnerKey = column.getAttribute("data-winner") || ""; // "TEAM1" или "TEAM2" или ""
    let teamWinner = "";
    let teamWinnerLogo = defaultLogo;
    if (statusText === "FINISHED" && winnerKey) {
      if (winnerKey === "TEAM1") {
        teamWinner = team1Name;
        teamWinnerLogo = team1Logo;
      } else if (winnerKey === "TEAM2") {
        teamWinner = team2Name;
        teamWinnerLogo = team2Logo;
      }
    }

    // Определение LIVE_* полей (логика сохранена)
    const liveStatusValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live.png" : defaultLogo;
    const liveBgValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\LIVEBG.png" : defaultLogo;
    const liveVs = statusText === "LIVE" ? "vs" : "";
    const liveCestValue = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\ongoing.png" : defaultLogo;
    const liveRectUp = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png";
    const liveRectLow = statusText === "LIVE" ? "C:\\projects\\NewTimer\\files\\live_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png";

    // Определение UPCOM_* полей (логика сохранена)
    const upcomCestValue = statusText === "UPCOM" ? "cest" : "";
    const upcomRectUp = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectUp.png" : defaultLogo;
    const upcomRectLow = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\rectLow.png" : defaultLogo;
    const upcomVsMiniValue = statusText === "UPCOM" ? "vs" : "";
    const upcomVsBigValue = statusText === "UPCOM" ? "vs" : "";
    const upcomNextPhotoValue = statusText === "UPCOM" ? "C:\\projects\\NewTimer\\files\\bg_next_upcom.png" : "";

    // Определение FINISHED_* полей (логика сохранена)
    const finRectUp = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectUp.png" : "C:\\projects\\NewTimer\\files\\none.png";
    const finRectLow = statusText === "FINISHED" ? "C:\\projects\\NewTimer\\files\\fin_rectLow.png" : "C:\\projects\\NewTimer\\files\\none.png";

    // Формирование объектов для каждого статуса
    const upcomObj = {
      UPCOM_MATCH_STATUS: statusText === "UPCOM" ? statusText : "",
      UPCOM_TIME: statusText === "UPCOM" ? (timeVal + (timeVal ? " CEST" : "")) : "", // Добавляем CEST если есть время
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
      UPCOM_Cest: statusText === "UPCOM" ? upcomCestValue : "",
      UPCOM_RectangleUP: statusText === "UPCOM" ? upcomRectUp : defaultLogo,
      UPCOM_RectangleLOW: statusText === "UPCOM" ? upcomRectLow : defaultLogo,
      UPCOM_vs_mini: statusText === "UPCOM" ? upcomVsMiniValue : "",
      UPCOM_vs_big: statusText === "UPCOM" ? upcomVsBigValue : "",
      UPCOM_next: "", // Поле UPCOM_next больше не используется напрямую?
      UPCOM_next_photo: statusText === "UPCOM" ? upcomNextPhotoValue : ""
    };

    const liveObj = {
      LIVE_MATCH_STATUS: statusText === "LIVE" ? statusText : "",
      LIVE_TIME: statusText === "LIVE" ? timeVal : "", // Время без CEST для LIVE
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
      LIVE_Cest: statusText === "LIVE" ? liveCestValue : defaultLogo, // Используем ongoing.png
      LIVE_VS: statusText === "LIVE" ? liveVs : "",
      LIVE_STATUS: statusText === "LIVE" ? liveStatusValue : defaultLogo,
      LIVE_BG: statusText === "LIVE" ? liveBgValue : defaultLogo,
      LIVE_RectangleUP: statusText === "LIVE" ? liveRectUp : "C:\\projects\\NewTimer\\files\\none.png",
      LIVE_RectangleLOW: statusText === "LIVE" ? liveRectLow : "C:\\projects\\NewTimer\\files\\none.png"
    };

    const finishedObj = {
      FINISHED_MATCH_STATUS: statusText === "FINISHED" ? statusText : "",
      FINISHED_TIME: statusText === "FINISHED" ? (timeVal + (timeVal ? " CEST" : "")) : "", // Добавляем CEST если есть время
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
      FIN_RectangleUP: statusText === "FINISHED" ? finRectUp : "C:\\projects\\NewTimer\\files\\none.png",
      FIN_RectangleLOW: statusText === "FINISHED" ? finRectLow : "C:\\projects\\NewTimer\\files\\none.png"
    };

    // Динамические лого уровня карт
    const perMapLogos = {};
     [1, 2, 3].forEach(i => {
         const sc = maps[`MAP${i}_SCORE`];
         const isNum = SCORE_REGEX.test(sc);
         const show = (statusText === "LIVE" || statusText === "FINISHED") && isNum;
         // Используем имя поля как в db.json для консистентности
         perMapLogos[`MAP${i}_TEAM1logo`] = show ? team1Logo : defaultLogo;
         perMapLogos[`MAP${i}_TEAM2logo`] = show ? team2Logo : defaultLogo;
     });

    // Динамические лого уровня матча
    const matchLogos = {};
    const showFinishedLogos = statusText === "FINISHED"; // Показываем всегда для FINISHED
    const showLiveLogos = statusText === "LIVE"; // Показываем всегда для LIVE
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
      TEAMWINNER: teamWinner, // Сохраняем победителя, определенного на клиенте
      TEAMWINNER_LOGO: teamWinnerLogo,
      ...matchLogos, // Добавляем лого уровня матча
      ...perMapLogos // Добавляем лого уровня карт
    };

    matches.push(matchObj);
  }

  return matches;
}

// ----------------------
// Помощник для иконок счета (без изменений)
// ----------------------
function getScoreIcon(scoreStr) {
  if (typeof scoreStr !== 'string') return "C:\\projects\\NewTimer\\files\\none.png"; // Добавим проверку типа
  const parts = scoreStr.split(":");
  if (parts.length !== 2) return "C:\\projects\\NewTimer\\files\\mp_none.png";
  const left = parseFloat(parts[0]);
  const right = parseFloat(parts[1]);
  if (isNaN(left) || isNaN(right)) return "C:\\projects\\NewTimer\\files\\mp_none.png";
  if (right > left) return "C:\\projects\\NewTimer\\files\\mp_R.png";
  if (left > right) return "C:\\projects\\NewTimer\\files\\mp_L.png";
  return "C:\\projects\\NewTimer\\files\\mp_none.png"; // Ничья или 0:0
}

// Функции saveState, loadState, bindSaveListeners удалены,
// так как сохранение теперь происходит только по кнопке APPLY.
