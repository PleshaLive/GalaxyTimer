// public/js/mapVeto.js

/**
 * Применяет классы к селекту команды в Veto для стилизации.
 * @param {HTMLSelectElement} selectElement - Элемент селекта.
 */
function styleVetoTeamSelect(selectElement) {
  if (!selectElement) return;
  selectElement.classList.remove('team-1-selected-veto', 'team-2-selected-veto');
  if (selectElement.value === "TEAM1") {
      selectElement.classList.add('team-1-selected-veto');
  } else if (selectElement.value === "TEAM2") {
      selectElement.classList.add('team-2-selected-veto');
  }
}

/**
* Применяет классы к селекту действия (BAN/PICK/DECIDER) в Veto для стилизации.
* @param {HTMLSelectElement} selectElement - Элемент селекта.
*/
export function styleVetoActionSelect(selectElement) {
  if (!selectElement) return;
  selectElement.classList.remove('action-is-ban', 'action-is-pick', 'action-is-decider');
  const currentValue = selectElement.value;
  if (currentValue === "BAN") {
      selectElement.classList.add('action-is-ban');
  } else if (currentValue === "PICK") {
      selectElement.classList.add('action-is-pick');
  } else if (currentValue === "DECIDER") {
      selectElement.classList.add('action-is-decider');
  }
}

/**
* Инициализирует селект выбора матча для блока Map Veto.
*/
export function initMapVeto() {
const matchSelect = document.getElementById("matchSelect");
if (!matchSelect) {
  console.warn("[MapVeto] Match select element (#matchSelect) not found.");
  return;
}

matchSelect.innerHTML = '';
for (let i = 1; i <= 4; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = `Match ${i}`;
  matchSelect.appendChild(opt);
}
matchSelect.value = "1";

const vetoTableRows = document.querySelectorAll("#vetoTable tbody tr");
vetoTableRows.forEach(row => {
    const teamSelect = row.querySelector(".veto-team");
    if (teamSelect) {
        styleVetoTeamSelect(teamSelect);
        teamSelect.addEventListener('change', () => styleVetoTeamSelect(teamSelect));
    }

    const actionSelect = row.querySelector(".veto-action");
    if (actionSelect) {
        styleVetoActionSelect(actionSelect);
        actionSelect.addEventListener('change', () => styleVetoActionSelect(actionSelect));
    }
});

console.log("[MapVeto] Map Veto initialized, listeners and styles for team/action selects attached.");
}

/**
* Обновляет опции в селектах выбора команды в таблице Map Veto
* на основе названий команд, выбранных для указанного матча, и применяет стили.
* @param {string|number} matchIndex - Индекс матча (1-4), для которого нужно обновить Veto.
*/
export function updateVetoTeamOptions(matchIndex) {
const vetoTeamSelects = document.querySelectorAll("#vetoTable .veto-team");
if (vetoTeamSelects.length === 0) return;

const team1SelectElement = document.getElementById(`team1Select${matchIndex}`);
const team2SelectElement = document.getElementById(`team2Select${matchIndex}`);
const team1Name = team1SelectElement?.value || "Team 1";
const team2Name = team2SelectElement?.value || "Team 2";

console.log(`[Veto UI] Updating team options for Veto Match ${matchIndex}: T1=${team1Name}, T2=${team2Name}`);

vetoTeamSelects.forEach(select => {
  const currentValue = select.value;
  select.innerHTML = '';

  const opt1 = document.createElement('option');
  opt1.value = "TEAM1";
  opt1.textContent = team1Name;
  select.appendChild(opt1);

  const opt2 = document.createElement('option');
  opt2.value = "TEAM2";
  opt2.textContent = team2Name;
  select.appendChild(opt2);

  if (currentValue === "TEAM1" || currentValue === "TEAM2") {
    select.value = currentValue;
  } else {
    select.value = "TEAM1";
  }
  styleVetoTeamSelect(select);
});
}


/**
* Собирает данные из таблицы Map Veto.
* @returns {object} - Объект с данными Map Veto.
*/
export function gatherMapVetoData() {
const matchSelect = document.getElementById("matchSelect");
const matchIndex = matchSelect ? parseInt(matchSelect.value, 10) : 1;

const sel1 = document.getElementById(`team1Select${matchIndex}`);
const sel2 = document.getElementById(`team2Select${matchIndex}`);
const team1Name = sel1?.value || "Team 1";
const team2Name = sel2?.value || "Team 2";
const team1Logo = sel1 && sel1.selectedIndex >= 0 ? sel1.options[sel1.selectedIndex]?.dataset.logo || "" : "";
const team2Logo = sel2 && sel2.selectedIndex >= 0 ? sel2.options[sel2.selectedIndex]?.dataset.logo || "" : "";

const rows = document.querySelectorAll("#vetoTable tbody tr");
const vetoArr = [];

rows.forEach(row => {
  const i = parseInt(row.dataset.index, 10);
  const actionSelect = row.querySelector(".veto-action");
  const teamSelect = row.querySelector(".veto-team");
  const mapSelectElement = row.querySelector(".veto-map");
  const sideSelect = row.querySelector(".veto-side");

  const action = actionSelect ? actionSelect.value : "BAN";
  const teamKey = teamSelect ? teamSelect.value : "TEAM1";
  const mapName = mapSelectElement ? mapSelectElement.value : "inferno";
  const side = sideSelect ? sideSelect.value : "-";

  const realTeamName = teamKey === "TEAM1" ? team1Name : team2Name;
  const realTeamLogo = teamKey === "TEAM1" ? team1Logo : team2Logo;

  const vetoIMG = `D:\\Broadcast\\BroadcastElements\\Map_veto\\${action}\\${mapName}.png`;

  let sideIMG = "";
  if (side === "CT") {
    sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\ct.png";
  } else if (side === "T") {
    sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\t.png";
  }

  vetoArr.push({
    mapIndex: i,
    action,
    team: teamKey,
    teamName: realTeamName,
    teamLogo: realTeamLogo,
    map: mapName,
    side,
    vetoIMG,
    sideIMG
  });
});

return {
  matchIndex,
  teams: {
    TEAM1: { name: team1Name, logo: team1Logo },
    TEAM2: { name: team2Name, logo: team2Logo }
  },
  veto: vetoArr
};
}

// ======== НОВАЯ ФУНКЦИЯ ДОБАВЛЕНА СЮДА С КЛЮЧЕВЫМ СЛОВОМ EXPORT ========
// Путь к лого по умолчанию (убедитесь, что он совпадает с тем, что в matches.js)
const defaultLogoPathVeto = "/logos/none.png"; // Убедитесь, что этот файл существует в public/logos/
/**
 * Обновляет отображение названий и логотипов команд над таблицей Map Veto.
 * @param {string|number} matchIndex - Индекс матча (1-4), для которого нужно отобразить команды.
 */
export function updateMapVetoDisplay(matchIndex) {
    const displayContainer = document.getElementById('mapVetoTeamDisplay');
    // Если элемента для отображения нет, ничего не делаем
    if (!displayContainer) {
        // console.warn(`[Veto Display] Element #mapVetoTeamDisplay not found.`);
        return;
    }

    // Находим элементы для отображения лого и имен
    const logo1Elem = document.getElementById('mapVetoTeam1Logo');
    const name1Elem = document.getElementById('mapVetoTeam1Name');
    const logo2Elem = document.getElementById('mapVetoTeam2Logo');
    const name2Elem = document.getElementById('mapVetoTeam2Name');

    // --- Получаем данные команд из селектов на вкладке "Матчи" ---
    const team1Select = document.getElementById(`team1Select${matchIndex}`);
    const team2Select = document.getElementById(`team2Select${matchIndex}`);

    let team1Name = "Команда 1"; // Имя по умолчанию
    let team1Logo = defaultLogoPathVeto; // Лого по умолчанию
    let team2Name = "Команда 2"; // Имя по умолчанию
    let team2Logo = defaultLogoPathVeto; // Лого по умолчанию

    // Получаем данные для Команды 1, если она выбрана
    if (team1Select && team1Select.value) {
        const selectedOption1 = team1Select.options[team1Select.selectedIndex];
        team1Name = team1Select.value;
        // Берем лого из data-атрибута выбранной опции
        // Важно: в matches.js лого добавляется в data-logo для option
        team1Logo = selectedOption1?.dataset.logo || defaultLogoPathVeto;
    }

    // Получаем данные для Команды 2, если она выбрана
    if (team2Select && team2Select.value) {
         const selectedOption2 = team2Select.options[team2Select.selectedIndex];
        team2Name = team2Select.value;
        // Берем лого из data-атрибута выбранной опции
        team2Logo = selectedOption2?.dataset.logo || defaultLogoPathVeto;
    }

    // --- Обновляем элементы отображения на вкладке "Map Veto" ---
    if (logo1Elem) {
        logo1Elem.src = team1Logo;
        logo1Elem.alt = `${team1Name} Logo`;
        // Обработчик на случай, если лого не загрузится
        logo1Elem.onerror = () => { if (logo1Elem.src !== defaultLogoPathVeto) logo1Elem.src = defaultLogoPathVeto; };
    }
    if (name1Elem) {
        name1Elem.textContent = team1Name;
    }

    if (logo2Elem) {
        logo2Elem.src = team2Logo;
        logo2Elem.alt = `${team2Name} Logo`;
        // Обработчик на случай, если лого не загрузится
        logo2Elem.onerror = () => { if (logo2Elem.src !== defaultLogoPathVeto) logo2Elem.src = defaultLogoPathVeto; };
    }
    if (name2Elem) {
        name2Elem.textContent = team2Name;
    }
    // console.log(`[Veto Display] Updated for Match ${matchIndex}: ${team1Name} vs ${team2Name}`);
}
// ======== КОНЕЦ НОВОЙ ФУНКЦИИ ========