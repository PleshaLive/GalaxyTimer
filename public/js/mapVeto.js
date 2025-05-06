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
* Инициализирует селект выбора матча для блока Map Veto.
*/
export function initMapVeto() {
const matchSelect = document.getElementById("matchSelect");
if (!matchSelect) {
  console.warn("[MapVeto] Match select element (#matchSelect) not found.");
  return;
}

matchSelect.innerHTML = ''; // Очищаем предыдущие опции
for (let i = 1; i <= 4; i++) {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = `Match ${i}`;
  matchSelect.appendChild(opt);
}
matchSelect.value = "1"; // Значение по умолчанию

// Привязываем слушатели к селектам команд в таблице Veto для обновления стилей при ручном выборе
const vetoTeamSelects = document.querySelectorAll("#vetoTable .veto-team");
vetoTeamSelects.forEach(select => {
  styleVetoTeamSelect(select); // Применяем стиль при инициализации (на основе дефолтного значения)
  select.addEventListener('change', () => styleVetoTeamSelect(select));
});

console.log("[MapVeto] Map Veto initialized and team select listeners attached.");
}

/**
* Обновляет опции в селектах выбора команды в таблице Map Veto
* на основе названий команд, выбранных для указанного матча, и применяет стили.
* @param {string|number} matchIndex - Индекс матча (1-4), для которого нужно обновить Veto.
*/
export function updateVetoTeamOptions(matchIndex) {
const vetoTeamSelects = document.querySelectorAll("#vetoTable .veto-team");
if (vetoTeamSelects.length === 0) return;

const team1SelectElement = document.getElementById(`team1Select${matchIndex}`); // Избегаем конфликта имен
const team2SelectElement = document.getElementById(`team2Select${matchIndex}`);
const team1Name = team1SelectElement?.value || "Team 1";
const team2Name = team2SelectElement?.value || "Team 2";

console.log(`[Veto UI] Updating team options for Veto Match <span class="math-inline">\{matchIndex\}\: T1\=</span>{team1Name}, T2=${team2Name}`);

vetoTeamSelects.forEach(select => {
  const currentValue = select.value; // Сохраняем текущее значение (TEAM1 или TEAM2)
  select.innerHTML = ''; // Очищаем старые опции

  const opt1 = document.createElement('option');
  opt1.value = "TEAM1";
  opt1.textContent = team1Name;
  select.appendChild(opt1);

  const opt2 = document.createElement('option');
  opt2.value = "TEAM2";
  opt2.textContent = team2Name;
  select.appendChild(opt2);

  // Восстанавливаем ранее выбранное значение (TEAM1 или TEAM2)
  if (currentValue === "TEAM1" || currentValue === "TEAM2") {
    select.value = currentValue;
  } else {
    select.value = "TEAM1"; // По умолчанию ставим TEAM1
  }
  styleVetoTeamSelect(select); // Применяем/обновляем стиль к селекту
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
  const mapSelect = row.querySelector(".veto-map");
  const sideSelect = row.querySelector(".veto-side");

  const action = actionSelect ? actionSelect.value : "BAN";
  const teamKey = teamSelect ? teamSelect.value : "TEAM1";
  const mapName = mapSelect ? mapSelect.value : "inferno";
  const side = sideSelect ? sideSelect.value : "-";

  const realTeamName = teamKey === "TEAM1" ? team1Name : team2Name;
  const realTeamLogo = teamKey === "TEAM1" ? team1Logo : team2Logo;

  const vetoIMG = `D:\\Broadcast\\BroadcastElements\\Map_veto\\<span class="math-inline">\{action\}\\\\</span>{mapName}.png`;
  let sideIMG = "";
  if (side === "CT") {
    sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\ct.png";
  } else if (side === "T") {
    sideIMG = "D:\\Broadcast\\BroadcastElements\\Map_veto\\side\\t.png";
  }

  vetoArr.push({
    mapIndex: i, action, team: teamKey, teamName: realTeamName,
    teamLogo: realTeamLogo, map: mapName, side, vetoIMG, sideIMG
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