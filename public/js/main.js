// Глобальные переменные для хранения списка команд и матчей
window.teamsList = [];
window.matchesData = [];

// Элемент-контейнер для всех матчей
const matchesContainer = document.getElementById('matches-container');

// Подключение к Socket.IO
const socket = io();

// Обработчик события обновления матча от сервера
socket.on('matchUpdated', (updatedMatch) => {
  console.log('Received matchUpdated event:', updatedMatch);
  // Обновляем локальные данные о матче
  const idx = window.matchesData.findIndex(m => m.id === updatedMatch.id);
  if (idx !== -1) {
    window.matchesData[idx] = updatedMatch;
  } else {
    // Если матч не найден (например, новый добавлен), добавляем
    window.matchesData.push(updatedMatch);
  }
  // Перерисовываем обновленный матч в UI
  renderMatch(updatedMatch.id);
});

/**
 * Запрашивает с сервера список команд и список матчей, затем инициализирует UI.
 */
function loadInitialData() {
  // Загружаем список команд
  fetch('/api/teams')
    .then(res => res.json())
    .then(data => {
      window.teamsList = Array.isArray(data) ? data : data.teams || [];
      // После загрузки команд загружаем матчи
      return fetch('/api/matches');
    })
    .then(res => res.json())
    .then(data => {
      window.matchesData = data;
      // Отображаем все матчи
      renderAllMatches();
    })
    .catch(err => console.error('Failed to load initial data:', err));
}

/**
 * Полностью перестраивает список матчей в интерфейсе на основании window.matchesData.
 */
function renderAllMatches() {
  matchesContainer.innerHTML = '';
  window.matchesData.forEach(match => {
    const matchElem = createMatchElement(match);
    matchesContainer.appendChild(matchElem);
  });
}

/**
 * Перестраивает UI для одного матча с заданным matchId, на основании обновленных данных.
 */
function renderMatch(matchId) {
  const match = window.matchesData.find(m => m.id === matchId);
  if (!match) return;
  const oldElem = document.getElementById(`match-${matchId}`);
  if (oldElem) {
    // Заменяем старый элемент матча на новый
    const newElem = createMatchElement(match);
    matchesContainer.replaceChild(newElem, oldElem);
  } else {
    // Если элемента не было, просто создаём (например, новый матч)
    const newElem = createMatchElement(match);
    matchesContainer.appendChild(newElem);
  }
}

// Делегируем обработку изменений от разных элементов ввода через единый обработчик
matchesContainer.addEventListener('change', onFieldChange);
matchesContainer.addEventListener('click', onButtonClick);

/**
 * Обработчик для изменений в полях (select, input) матчей.
 * Используя data-атрибуты, определяет, что именно изменилось, обновляет данные и отправляет на сервер.
 */
function onFieldChange(event) {
  const target = event.target;
  if (!target.dataset.matchId) return; // не наш элемент
  const matchId = Number(target.dataset.matchId);
  const match = window.matchesData.find(m => m.id === matchId);
  if (!match) return;

  // Обработка разных типов изменений по data-атрибутам
  if (target.dataset.team) {
    // Изменение селекта команды
    const teamIndex = target.dataset.team; // "1" или "2"
    const teamName = target.value;
    match['team' + teamIndex] = teamName;
    // Если команда победителя теперь пустая или поменялась, возможно сбросим победителя
    if (match.winner && ((match.winner === 1 && teamIndex === '1') || (match.winner === 2 && teamIndex === '2'))) {
      // Если победительная команда была очищена/изменена, сбросим winner, т.к. выбор победителя нужно пересмотреть
      match.winner = null;
    }
  } else if (target.dataset.field === 'time') {
    // Изменение времени матча
    match.time = target.value;
  } else if (target.dataset.field === 'status') {
    // Изменение статуса матча
    match.status = target.value;
  } else if (target.dataset.field === 'map-name') {
    // Изменение названия карты
    const index = Number(target.dataset.index);
    match.maps[index] = target.value;
  } else if (target.dataset.field === 'score1' || target.dataset.field === 'score2') {
    // Изменение счета на карте
    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    const val = target.value;
    // Преобразуем в число или null
    match.vrs[index][field] = (val === "" ? null : parseInt(val));
    // Обновляем победителя матча автоматически? (нет, по заданию выбор победителя вручную)
    // Можно дополнительно здесь определить winner по результатам карт, но оставляем ручной выбор.
  } else if (target.dataset.field === 'custom-name' || target.dataset.field === 'custom-value') {
    // Изменение пользовательского поля
    const index = Number(target.dataset.index);
    if (target.dataset.field === 'custom-name') {
      match.customFields[index].name = target.value;
    } else {
      match.customFields[index].value = target.value;
    }
  }

  // Отправляем обновленные данные матча на сервер
  saveMatch(match);
  // Локально обновляем UI данного матча (например, могли измениться статус или winner display)
  renderMatch(matchId);
}

/**
 * Обработчик кликов по кнопкам (выбор победителя, добавить/удалить элементы).
 */
function onButtonClick(event) {
  const target = event.target;
  if (!target.dataset.matchId) return;
  const matchId = Number(target.dataset.matchId);
  const match = window.matchesData.find(m => m.id === matchId);
  if (!match) return;

  // Кнопки выбора победителя ("Win")
  if (target.classList.contains('winner-btn')) {
    const teamNum = Number(target.dataset.team);
    if (match.winner === teamNum) {
      // Если уже этот команда отмечена победителем, при повторном нажатии снимем выделение (отменим победителя)
      match.winner = null;
    } else {
      // Устанавливаем выбранную команду как победителя
      match.winner = teamNum;
    }
    saveMatch(match);
    renderMatch(matchId);
    return;
  }

  // Кнопки добавления/удаления карт, результатов или полей (используем data-action)
  if (target.dataset.action === 'add-map') {
    // Добавить новую карту
    match.maps.push("");
    // При добавлении новой карты добавляем и соответствующую запись в результаты (по умолчанию nullы)
    match.vrs.push({ score1: null, score2: null });
    saveMatch(match);
    renderMatch(matchId);
  } else if (target.dataset.action === 'remove-map') {
    // Удалить карту по индексу
    const index = Number(target.dataset.index);
    match.maps.splice(index, 1);
    // Удаляем соответствующий результат карты, если существует
    if (match.vrs[index]) {
      match.vrs.splice(index, 1);
    }
    saveMatch(match);
    renderMatch(matchId);
  } else if (target.dataset.action === 'add-score') {
    // Добавить новую пару счетов (результат карты)
    match.vrs.push({ score1: null, score2: null });
    // Если количество результатов превысило количество названных карт, добавим пустую карту для соответствия длины
    if (match.vrs.length > match.maps.length) {
      match.maps.push("");
    }
    saveMatch(match);
    renderMatch(matchId);
  } else if (target.dataset.action === 'remove-score') {
    // Удалить результаты карты по индексу
    const index = Number(target.dataset.index);
    match.vrs.splice(index, 1);
    // Также удаляем карту, если индекс в пределах массива карт (предполагаем связаны по индексу)
    if (match.maps[index]) {
      match.maps.splice(index, 1);
    }
    saveMatch(match);
    renderMatch(matchId);
  } else if (target.dataset.action === 'add-field') {
    // Добавить новое кастомное поле
    match.customFields.push({ name: "", value: "" });
    saveMatch(match);
    renderMatch(matchId);
  } else if (target.dataset.action === 'remove-field') {
    // Удалить кастомное поле по индексу
    const index = Number(target.dataset.index);
    match.customFields.splice(index, 1);
    saveMatch(match);
    renderMatch(matchId);
  }
}

/**
 * Отправляет обновленные данные матча на сервер (через fetch POST).
 * @param {Object} match - объект матча для сохранения.
 */
function saveMatch(match) {
  fetch(`/api/matches/${match.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(match)
  })
    .then(res => res.json())
    .then(data => {
      console.log(`Match ${data.id} saved on server`);
      // (Обновление UI происходит через событие socket.io, дублируемое обновление уже выполнено выше)
    })
    .catch(err => console.error('Ошибка при сохранении матча:', err));
}

// Загружаем начальные данные и отрисовываем интерфейс
loadInitialData();
