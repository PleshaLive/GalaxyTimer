// public/js/mapVeto.js

/**
 * Инициализирует селект выбора матча для блока Map Veto.
 */
export function initMapVeto() {
  const matchSelect = document.getElementById("matchSelect");
  if (!matchSelect) {
      console.warn("[MapVeto] Match select element (#matchSelect) not found.");
      return;
  };

  // Очищаем предыдущие опции (на всякий случай)
  matchSelect.innerHTML = '';

  // Заполняем опциями матчами 1–4
  for (let i = 1; i <= 4; i++) {
    const opt = document.createElement("option");
    opt.value = i; // Значение - номер матча
    opt.textContent = `Match ${i}`; // Текст - "Match X"
    matchSelect.appendChild(opt);
  }

  // Значение по умолчанию — первый матч
  matchSelect.value = "1";

  console.log("[MapVeto] Map Veto initialized.");
  // Обработчик смены матча будет добавлен в main.js,
  // т.к. ему нужно вызывать updateVetoTeamOptions, которая теперь здесь
}

/**
 * Обновляет опции в селектах выбора команды в таблице Map Veto
 * на основе названий команд, выбранных для указанного матча.
 * @param {string|number} matchIndex - Индекс матча (1-4), для которого нужно обновить Veto.
 */
export function updateVetoTeamOptions(matchIndex) {
    const vetoTeamSelects = document.querySelectorAll("#vetoTable .veto-team");
    if (vetoTeamSelects.length === 0) return; // Выходим, если селектов нет

    // Находим селекты команд для выбранного матча
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team2Select = document.getElementById(`team2Select${matchIndex}`);

    // Получаем названия команд (или используем дефолтные)
    const team1Name = team1Select?.value || "Team 1";
    const team2Name = team2Select?.value || "Team 2";

    console.log(`[Veto UI] Updating team options for Veto Match ${matchIndex}: T1=${team1Name}, T2=${team2Name}`);

    // Обновляем опции в каждом селекте `.veto-team`
    vetoTeamSelects.forEach(select => {
        const currentValue = select.value; // Сохраняем текущее выбранное значение (TEAM1 или TEAM2)
        select.innerHTML = ''; // Очищаем старые опции

        // Создаем и добавляем новые опции
        const opt1 = document.createElement('option');
        opt1.value = "TEAM1";
        opt1.textContent = team1Name; // Отображаемое имя
        select.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = "TEAM2";
        opt2.textContent = team2Name; // Отображаемое имя
        select.appendChild(opt2);

        // Восстанавливаем ранее выбранное значение (TEAM1 или TEAM2), если оно валидно
        if (currentValue === "TEAM1" || currentValue === "TEAM2") {
             select.value = currentValue;
        } else {
             select.value = "TEAM1"; // По умолчанию ставим TEAM1
        }
    });
}


/**
 * Собирает данные из таблицы Map Veto.
 * @returns {object} - Объект с данными Map Veto.
 */
export function gatherMapVetoData() {
  // Номер выбранного в UI матча
  const matchSelect = document.getElementById("matchSelect");
  const matchIndex = matchSelect ? parseInt(matchSelect.value, 10) : 1; // По умолчанию 1

  // Селекты команд в этом матче
  const sel1 = document.getElementById(`team1Select${matchIndex}`);
  const sel2 = document.getElementById(`team2Select${matchIndex}`);

  // Имя и лого из data-атрибута ВЫБРАННОЙ опции селекта команды
  const team1Name = sel1?.value || "Team 1"; // Имя команды 1
  const team2Name = sel2?.value || "Team 2"; // Имя команды 2
  const team1Logo = sel1 && sel1.selectedIndex >= 0 ? sel1.options[sel1.selectedIndex]?.dataset.logo || "" : "";
  const team2Logo = sel2 && sel2.selectedIndex >= 0 ? sel2.options[sel2.selectedIndex]?.dataset.logo || "" : "";


  // Проходим по всем строкам veto-таблицы
  const rows = document.querySelectorAll("#vetoTable tbody tr");
  const vetoArr = [];

  rows.forEach(row => {
    const i = parseInt(row.dataset.index, 10);
    const actionSelect = row.querySelector(".veto-action");
    const teamSelect = row.querySelector(".veto-team");
    const mapSelect = row.querySelector(".veto-map");
    const sideSelect = row.querySelector(".veto-side");

    // Получаем значения из селектов
    const action = actionSelect ? actionSelect.value : "BAN";
    const teamKey = teamSelect ? teamSelect.value : "TEAM1"; // "TEAM1" или "TEAM2"
    const mapName = mapSelect ? mapSelect.value : "inferno";
    const side = sideSelect ? sideSelect.value : "-";

    // Подставляем реальные имя и лого в зависимости от выбранного teamKey
    const realTeamName = teamKey === "TEAM1" ? team1Name : team2Name;
    const realTeamLogo = teamKey === "TEAM1" ? team1Logo : team2Logo;

    // Вычисляем ссылку на изображение карты (vetoIMG) - ПУТИ НУЖНО АДАПТИРОВАТЬ!
    // const vetoIMG = `D:\\Broadcast\\BroadcastElements\\Map_veto\\${action}\\${mapName}.png`;
    const vetoIMG = ""; // Заглушка, т.к. абсолютные пути не работают в браузере

    // Вычисляем ссылку на изображение стороны (sideIMG) - ПУТИ НУЖНО АДАПТИРОВАТЬ!
    let sideIMG = "";
    // if (side === "CT") sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\ct.png";
    // else if (side === "T") sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\t.png";


    vetoArr.push({
      mapIndex: i,
      action,
      team: teamKey, // Сохраняем ключ TEAM1/TEAM2
      teamName: realTeamName, // Сохраняем актуальное имя
      teamLogo: realTeamLogo, // Сохраняем актуальное лого
      map: mapName,
      side,
      vetoIMG, // Поле для vMix (пока пустое)
      sideIMG  // Поле для vMix (пока пустое)
    });
  });

  // Возвращаем объект с данными Veto
  return {
    matchIndex,
    teams: {
      TEAM1: { name: team1Name, logo: team1Logo },
      TEAM2: { name: team2Name, logo: team2Logo }
    },
    veto: vetoArr
  };
}
