// Функции для генерации и обновления DOM-элементов матча

/**
 * Создает DOM-элемент для одного матча на основе данных матча.
 * @param {Object} match - объект матча со всеми полями.
 * @return {HTMLElement} - DOM-элемент (div) для данного матча.
 */
function createMatchElement(match) {
  // Создаем основной контейнер матча
  const matchDiv = document.createElement('div');
  matchDiv.className = 'match';
  matchDiv.id = `match-${match.id}`;

  // Заголовок матча с названием и статусом
  const headerDiv = document.createElement('div');
  headerDiv.className = 'match-header';
  const titleSpan = document.createElement('span');
  titleSpan.className = 'match-title';
  titleSpan.textContent = `MATCH ${match.id}`;  // отображаем "MATCH X"
  const statusSpan = document.createElement('span');
  statusSpan.className = `match-status status-${match.status}`;
  statusSpan.textContent = (match.status === 'UPCOM' ? 'UPCOMING' : match.status) + '.';  // например "FINISHED."
  headerDiv.appendChild(titleSpan);
  headerDiv.appendChild(statusSpan);
  matchDiv.appendChild(headerDiv);

  // Блок команд
  const teamsDiv = document.createElement('div');
  teamsDiv.className = 'teams';
  // Team 1
  const team1Label = document.createElement('label');
  team1Label.textContent = 'Team 1:';
  const team1Select = document.createElement('select');
  team1Select.dataset.matchId = match.id;
  team1Select.dataset.team = '1';
  // Добавляем опции команд в селект
  addTeamOptions(team1Select, match.team1);
  // Кнопка выбора победителя для Team 1
  const team1WinBtn = document.createElement('button');
  team1WinBtn.textContent = 'Win';
  team1WinBtn.className = 'winner-btn';
  team1WinBtn.dataset.matchId = match.id;
  team1WinBtn.dataset.team = '1';
  // Team 2
  const team2Label = document.createElement('label');
  team2Label.textContent = 'Team 2:';
  const team2Select = document.createElement('select');
  team2Select.dataset.matchId = match.id;
  team2Select.dataset.team = '2';
  addTeamOptions(team2Select, match.team2);
  const team2WinBtn = document.createElement('button');
  team2WinBtn.textContent = 'Win';
  team2WinBtn.className = 'winner-btn';
  team2WinBtn.dataset.matchId = match.id;
  team2WinBtn.dataset.team = '2';

  // Отмечаем кнопку активной, если соответствующая команда - победитель
  if (match.winner === 1) {
    team1WinBtn.classList.add('active');
  }
  if (match.winner === 2) {
    team2WinBtn.classList.add('active');
  }

  // Добавляем элементы команд в контейнер teamsDiv
  teamsDiv.appendChild(team1Label);
  teamsDiv.appendChild(team1Select);
  teamsDiv.appendChild(team1WinBtn);
  teamsDiv.appendChild(document.createTextNode('   ')); // небольшой разделитель
  teamsDiv.appendChild(team2Label);
  teamsDiv.appendChild(team2Select);
  teamsDiv.appendChild(team2WinBtn);

  // Поле времени матча
  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Time:';
  const timeInput = document.createElement('input');
  timeInput.type = 'text';
  timeInput.className = 'time-input';
  timeInput.value = match.time || '';
  timeInput.placeholder = 'Match time';
  timeInput.dataset.matchId = match.id;
  timeInput.dataset.field = 'time';
  teamsDiv.appendChild(document.createElement('br'));
  teamsDiv.appendChild(timeLabel);
  teamsDiv.appendChild(timeInput);

  matchDiv.appendChild(teamsDiv);

  // Секция выбора статуса матча
  const statusSection = document.createElement('div');
  statusSection.className = 'status-section';
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status:';
  const statusSelect = document.createElement('select');
  statusSelect.dataset.matchId = match.id;
  statusSelect.dataset.field = 'status';
  const statuses = ['UPCOM', 'LIVE', 'FINISHED'];
  statuses.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = (st === 'UPCOM' ? 'UPCOMING' : st);
    if (match.status === st) opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusSection.appendChild(statusLabel);
  statusSection.appendChild(statusSelect);
  matchDiv.appendChild(statusSection);

  // Секция MapVeto (карты)
  const mapsSection = document.createElement('div');
  mapsSection.className = 'maps-section';
  const mapsLabel = document.createElement('label');
  mapsLabel.textContent = 'Maps:';
  mapsSection.appendChild(mapsLabel);
  mapsSection.appendChild(document.createElement('br'));
  // Строки карт
  match.maps.forEach((mapName, index) => {
    const mapInput = document.createElement('input');
    mapInput.type = 'text';
    mapInput.value = mapName;
    mapInput.placeholder = `Map ${index+1} name`;
    mapInput.dataset.matchId = match.id;
    mapInput.dataset.field = 'map-name';
    mapInput.dataset.index = index;
    mapsSection.appendChild(mapInput);
    // Кнопка удаления карты
    const removeMapBtn = document.createElement('span');
    removeMapBtn.textContent = '✕';
    removeMapBtn.className = 'remove-btn';
    removeMapBtn.title = 'Remove map';
    removeMapBtn.dataset.matchId = match.id;
    removeMapBtn.dataset.index = index;
    removeMapBtn.dataset.action = 'remove-map';
    mapsSection.appendChild(removeMapBtn);
    mapsSection.appendChild(document.createElement('br'));
  });
  // Кнопка добавления новой карты
  const addMapBtn = document.createElement('button');
  addMapBtn.textContent = 'Add map';
  addMapBtn.className = 'add-btn';
  addMapBtn.dataset.matchId = match.id;
  addMapBtn.dataset.action = 'add-map';
  mapsSection.appendChild(addMapBtn);
  matchDiv.appendChild(mapsSection);

  // Секция VRS (результаты карт)
  const vrsSection = document.createElement('div');
  vrsSection.className = 'vrs-section';
  const vrsLabel = document.createElement('label');
  vrsLabel.textContent = 'Map Scores (VRS):';
  vrsSection.appendChild(vrsLabel);
  vrsSection.appendChild(document.createElement('br'));
  match.vrs.forEach((res, index) => {
    // Создаем поля для счета команд на карте index
    const score1Input = document.createElement('input');
    score1Input.type = 'number';
    score1Input.style.width = '50px';
    score1Input.placeholder = 'Team1';
    score1Input.value = res.score1 !== null ? res.score1 : '';
    score1Input.dataset.matchId = match.id;
    score1Input.dataset.field = 'score1';
    score1Input.dataset.index = index;
    const dash = document.createTextNode(' - ');
    const score2Input = document.createElement('input');
    score2Input.type = 'number';
    score2Input.style.width = '50px';
    score2Input.placeholder = 'Team2';
    score2Input.value = res.score2 !== null ? res.score2 : '';
    score2Input.dataset.matchId = match.id;
    score2Input.dataset.field = 'score2';
    score2Input.dataset.index = index;
    vrsSection.appendChild(score1Input);
    vrsSection.appendChild(dash);
    vrsSection.appendChild(score2Input);
    // Привязываем результат к карте с тем же индексом (если карта названа)
    if (match.maps[index]) {
      const mapNameText = document.createTextNode(` (${match.maps[index]})`);
      vrsSection.appendChild(mapNameText);
    }
    // Кнопка удаления результата карты
    const removeResBtn = document.createElement('span');
    removeResBtn.textContent = '✕';
    removeResBtn.className = 'remove-btn';
    removeResBtn.title = 'Remove score';
    removeResBtn.dataset.matchId = match.id;
    removeResBtn.dataset.index = index;
    removeResBtn.dataset.action = 'remove-score';
    vrsSection.appendChild(removeResBtn);
    vrsSection.appendChild(document.createElement('br'));
  });
  // Кнопка добавления результата новой карты
  const addResBtn = document.createElement('button');
  addResBtn.textContent = 'Add score';
  addResBtn.className = 'add-btn';
  addResBtn.dataset.matchId = match.id;
  addResBtn.dataset.action = 'add-score';
  vrsSection.appendChild(addResBtn);
  matchDiv.appendChild(vrsSection);

  // Секция кастомных полей
  const customSection = document.createElement('div');
  customSection.className = 'custom-section';
  const customLabel = document.createElement('label');
  customLabel.textContent = 'Custom Fields:';
  customSection.appendChild(customLabel);
  customSection.appendChild(document.createElement('br'));
  match.customFields.forEach((field, index) => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'custom-field';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'custom-field-name';
    nameInput.placeholder = 'Field name';
    nameInput.value = field.name;
    nameInput.dataset.matchId = match.id;
    nameInput.dataset.field = 'custom-name';
    nameInput.dataset.index = index;
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'custom-field-value';
    valueInput.placeholder = 'Value';
    valueInput.value = field.value;
    valueInput.dataset.matchId = match.id;
    valueInput.dataset.field = 'custom-value';
    valueInput.dataset.index = index;
    // Кнопка удаления поля
    const removeFieldBtn = document.createElement('span');
    removeFieldBtn.textContent = '✕';
    removeFieldBtn.className = 'remove-btn';
    removeFieldBtn.title = 'Remove field';
    removeFieldBtn.dataset.matchId = match.id;
    removeFieldBtn.dataset.index = index;
    removeFieldBtn.dataset.action = 'remove-field';

    fieldDiv.appendChild(nameInput);
    fieldDiv.appendChild(valueInput);
    fieldDiv.appendChild(removeFieldBtn);
    customSection.appendChild(fieldDiv);
  });
  // Кнопка добавления нового кастомного поля
  const addFieldBtn = document.createElement('button');
  addFieldBtn.textContent = 'Add field';
  addFieldBtn.className = 'add-btn';
  addFieldBtn.dataset.matchId = match.id;
  addFieldBtn.dataset.action = 'add-field';
  customSection.appendChild(addFieldBtn);
  matchDiv.appendChild(customSection);

  // Если у матча определён победитель, показываем явным текстом (для ясности)
  if (match.winner) {
    const winnerText = document.createElement('div');
    const winTeamName = (match.winner === 1 ? match.team1 : match.team2) || '';
    winnerText.textContent = winTeamName ? `Winner: ${winTeamName}` : '';
    winnerText.style.fontWeight = 'bold';
    winnerText.style.marginTop = '5px';
    matchDiv.appendChild(winnerText);
  }

  return matchDiv;
}

/**
 * Добавляет опции со списком команд в указанный select.
 * Включает пустую опцию для случая неопределённой команды.
 */
function addTeamOptions(selectElement, selectedTeamName) {
  // пустая опция
  const emptyOpt = document.createElement('option');
  emptyOpt.value = "";
  emptyOpt.textContent = "-- Select Team --";
  selectElement.appendChild(emptyOpt);
  // опции для каждой команды из глобального списка teams
  window.teamsList.forEach(teamName => {
    const opt = document.createElement('option');
    opt.value = teamName;
    opt.textContent = teamName;
    if (teamName === selectedTeamName) {
      opt.selected = true;
    }
    selectElement.appendChild(opt);
  });
}
