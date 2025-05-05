// public/js/vrs.js

// Инициализация HTML структуры для VRS таблиц
export function initVRS() {
  for (let i = 1; i <= 4; i++) {
    const vrsBlock = document.getElementById("vrsBlock" + i);
    if (vrsBlock) {
      vrsBlock.innerHTML = `
        <h3>VRS</h3>
        <table class="vrs-table">
          <thead>
            <tr>
              <th>TEAM</th>
              <th>+P</th>
              <th>-P</th>
              <th>#</th>
              <th>CUR</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td id="vrsTeam1Name${i}">TEAM1</td>
              <td><input type="text" class="vrs-input" id="team1WinPoints${i}" placeholder="+P" /></td>
              <td><input type="text" class="vrs-input" id="team1LosePoints${i}" placeholder="-P" /></td>
              <td><input type="text" class="vrs-input" id="team1Rank${i}" placeholder="#" /></td>
              <td><input type="text" class="vrs-input" id="team1CurrentPoints${i}" placeholder="CUR" /></td>
            </tr>
            <tr>
              <td id="vrsTeam2Name${i}">TEAM2</td>
              <td><input type="text" class="vrs-input" id="team2WinPoints${i}" placeholder="+P" /></td>
              <td><input type="text" class="vrs-input" id="team2LosePoints${i}" placeholder="-P" /></td>
              <td><input type="text" class="vrs-input" id="team2Rank${i}" placeholder="#" /></td>
              <td><input type="text" class="vrs-input" id="team2CurrentPoints${i}" placeholder="CUR" /></td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
        console.warn(`Элемент vrsBlock${i} не найден.`);
    }
  }
  // Обновляем имена команд при инициализации и при изменении селектов
  updateVRSTeamNames();
  for (let m = 1; m <= 4; m++) {
      const sel1 = document.getElementById(`team1Select${m}`);
      const sel2 = document.getElementById(`team2Select${m}`);
      if (sel1) sel1.addEventListener('change', updateVRSTeamNames);
      if (sel2) sel2.addEventListener('change', updateVRSTeamNames);
  }
}

// Функция обновления имен команд в VRS таблицах
export function updateVRSTeamNames() {
    for (let i = 1; i <= 4; i++) {
        const team1Select = document.getElementById(`team1Select${i}`);
        const team2Select = document.getElementById(`team2Select${i}`);
        const vrsTeam1NameCell = document.getElementById(`vrsTeam1Name${i}`);
        const vrsTeam2NameCell = document.getElementById(`vrsTeam2Name${i}`);

        if (vrsTeam1NameCell) {
             vrsTeam1NameCell.textContent = team1Select?.value || 'TEAM1';
        }
         if (vrsTeam2NameCell) {
             vrsTeam2NameCell.textContent = team2Select?.value || 'TEAM2';
        }
    }
}

// --------------------------------------------------
// Сбор данных VRS для ОДНОГО матча
// --------------------------------------------------
export function gatherSingleVRSData(matchIndex) {
    const i = matchIndex;
    const getValue = (id) => {
        const element = document.getElementById(id);
        const value = element ? element.value.trim() : '';
        // Возвращаем null, если поле пустое или не число
        const parsed = parseInt(value, 10);
        return value === '' ? null : (Number.isNaN(parsed) ? null : parsed);
    };

    // Проверяем, существуют ли элементы перед чтением
    if (!document.getElementById(`team1WinPoints${i}`)) {
        console.error(`Элементы VRS для матча ${i} не найдены.`);
        return null;
    }

    return {
        TEAM1: {
            winPoints: getValue(`team1WinPoints${i}`),
            losePoints: getValue(`team1LosePoints${i}`),
            rank: getValue(`team1Rank${i}`),
            currentPoints: getValue(`team1CurrentPoints${i}`)
        },
        TEAM2: {
            winPoints: getValue(`team2WinPoints${i}`),
            losePoints: getValue(`team2LosePoints${i}`),
            rank: getValue(`team2Rank${i}`),
            currentPoints: getValue(`team2CurrentPoints${i}`)
        }
    };
}
