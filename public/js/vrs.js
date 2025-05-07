// public/js/vrs.js

// ----------------------
// Инициализация VRS
// ----------------------
/**
 * Создает HTML-структуру таблиц VRS для всех 4 матчей.
 */
export function initVRS() {
  console.log("[VRS] Initializing VRS blocks...");
  // Проходим по индексам матчей от 1 до 4
  for (let i = 1; i <= 4; i++) {
    // Находим родительский блок для таблицы VRS по ID
    const vrsBlock = document.getElementById(`vrsBlock${i}`); // Исправлено: `` вместо "" для интерполяции
    if (vrsBlock) {
      // Генерируем HTML для таблицы и вставляем его в блок
      // Строки с комментариями "{/* ... */}" были удалены, так как они отображались как текст.
      // Также удален заголовок <h3>VRS</h3>, так как он дублировал заголовок из index.html.
      vrsBlock.innerHTML = `
        <table class="vrs-table">
          <thead>
            <tr>
              <th>TEAM</th> <th>+P</th>  <th>-P</th>  <th>#</th>   <th>CUR</th>
            </tr>
          </thead>
          <tbody>
            <tr class="team-1-row" data-vrs-team="1"> 
              <td id="vrsTeam1Name${i}">TEAM1</td>
              <td><input type="text" class="vrs-input" id="team1WinPoints${i}" placeholder="+P" /></td>
              <td><input type="text" class="vrs-input" id="team1LosePoints${i}" placeholder="-P" /></td>
              <td><input type="text" class="vrs-input" id="team1Rank${i}" placeholder="#" /></td>
              <td><input type="text" class="vrs-input" id="team1CurrentPoints${i}" placeholder="CUR" /></td>
            </tr>
            <tr class="team-2-row" data-vrs-team="2"> 
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
      // Предупреждение, если блок для VRS не найден в HTML
      console.warn(`[VRS] Element vrsBlock${i} not found in HTML.`);
    }
  }
  // Сразу обновляем имена команд в созданных таблицах VRS
  updateVRSTeamNames();

  // Добавляем слушатели на селекты команд (в блоках матчей),
  // чтобы обновлять имена в VRS при их изменении
  for (let m = 1; m <= 4; m++) {
    const sel1 = document.getElementById(`team1Select${m}`);
    const sel2 = document.getElementById(`team2Select${m}`);
    // Используем 'change' событие, так как имя команды меняется только после выбора
    if (sel1) sel1.addEventListener('change', updateVRSTeamNames);
    if (sel2) sel2.addEventListener('change', updateVRSTeamNames);
  }
  console.log("[VRS] VRS blocks initialized and listeners attached.");
}

// ----------------------
// Обновление имен команд в VRS
// ----------------------
/**
 * Обновляет текстовое содержимое ячеек с именами команд в таблицах VRS,
 * беря текущие значения из соответствующих селектов выбора команд из блоков матчей.
 */
export function updateVRSTeamNames() {
  // console.log("[VRS] Updating VRS team names..."); // Можно раскомментировать для отладки
  for (let i = 1; i <= 4; i++) {
    const team1Select = document.getElementById(`team1Select${i}`);
    const team2Select = document.getElementById(`team2Select${i}`);
    const vrsTeam1NameCell = document.getElementById(`vrsTeam1Name${i}`);
    const vrsTeam2NameCell = document.getElementById(`vrsTeam2Name${i}`);

    // Обновляем имя Team 1, если ячейка и селект существуют
    if (vrsTeam1NameCell) {
      // Используем значение селекта, если оно есть и не пустое, иначе 'Команда 1'
      const team1Name = team1Select && team1Select.value ? team1Select.value : 'Команда 1';
      if (vrsTeam1NameCell.textContent !== team1Name) {
        vrsTeam1NameCell.textContent = team1Name;
      }
    }
    // Обновляем имя Team 2
    if (vrsTeam2NameCell) {
      const team2Name = team2Select && team2Select.value ? team2Select.value : 'Команда 2';
      if (vrsTeam2NameCell.textContent !== team2Name) {
        vrsTeam2NameCell.textContent = team2Name;
      }
    }
  }
}

// --------------------------------------------------
// Сбор данных VRS для ОДНОГО матча
// --------------------------------------------------
/**
 * Собирает данные VRS (очки, ранг) для одного конкретного матча из полей ввода.
 * @param {number} matchIndex - Индекс матча (1-4).
 * @returns {object | null} - Объект с данными VRS для матча или null, если элементы ввода не найдены.
 */
export function gatherSingleVRSData(matchIndex) {
  const i = matchIndex; // Для краткости

  /**
   * Вспомогательная функция для получения и парсинга значения из input.
   * @param {string} id - ID элемента input.
   * @returns {number | string | null} - Числовое значение, если возможно, иначе строку или null.
   * В данном случае, по логике, ожидаем числа или null.
   */
  const getValue = (id) => {
    const element = document.getElementById(id);
    const value = element ? element.value.trim() : ''; // Получаем значение, удаляем пробелы

    if (value === '') return null; // Если значение пустое, возвращаем null

    // Пытаемся преобразовать в целое число
    // Если это поле для ранга, которое может быть нечисловым (например, '#'),
    // можно добавить специальную обработку или возвращать строку.
    // Для очков предполагаем числовой ввод.
    const parsed = parseInt(value, 10);

    // Возвращаем число, если парсинг удался и результат не NaN, иначе null
    // (или value, если нужно разрешить нечисловые ранги, но тогда тип возврата нужно будет уточнить)
    return Number.isNaN(parsed) ? null : parsed;
  };

  // Проверяем, существуют ли элементы ввода для этого матча (достаточно проверить один)
  if (!document.getElementById(`team1WinPoints${i}`)) {
    console.warn(`[VRS] VRS input elements for match ${i} not found during data gathering.`);
    return null; // Возвращаем null, если элементы не найдены
  }

  // Собираем данные для обеих команд
  const vrsData = {
    TEAM1: {
      winPoints: getValue(`team1WinPoints${i}`),      // Очки за победу
      losePoints: getValue(`team1LosePoints${i}`),     // Очки за поражение
      rank: getValue(`team1Rank${i}`),               // Ранг
      currentPoints: getValue(`team1CurrentPoints${i}`) // Текущие очки
    },
    TEAM2: {
      winPoints: getValue(`team2WinPoints${i}`),
      losePoints: getValue(`team2LosePoints${i}`),
      rank: getValue(`team2Rank${i}`),
      currentPoints: getValue(`team2CurrentPoints${i}`)
    }
  };
  // console.log(`[VRS] Gathered VRS data for match ${i}:`, vrsData); // Для отладки
  return vrsData;
}