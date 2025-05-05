// public/js/teams.js
import { saveData } from './api.js'; // Импортируем функцию для отправки данных на сервер

// Получаем ссылки на элементы DOM
const teamsTableBody = document.querySelector('#teamsTable tbody'); // Тело таблицы для отображения команд
const addTeamForm = document.getElementById('addTeamForm');       // Форма добавления команды
const newTeamNameInput = document.getElementById('newTeamName');   // Поле ввода имени новой команды
const newTeamLogoInput = document.getElementById('newTeamLogo');   // Поле ввода имени файла логотипа новой команды

let teamsData = []; // Массив для хранения списка команд, загруженного с сервера

/**
 * Отображает список команд в HTML-таблице.
 * Очищает таблицу и заполняет ее строками на основе массива teamsData.
 */
function displayTeams() {
    // Проверяем, найден ли элемент tbody таблицы
    if (!teamsTableBody) {
        console.error("[Teams] Table body not found!");
        return;
    }
    // Очищаем содержимое таблицы перед заполнением
    teamsTableBody.innerHTML = '';

    // Если список команд пуст, показываем сообщение
    if (teamsData.length === 0) {
        teamsTableBody.innerHTML = '<tr><td colspan="4">Список команд пуст.</td></tr>'; // Обновлен colspan на 4
        return;
    }

    // Проходим по каждой команде в массиве teamsData
    teamsData.forEach(team => {
        // Создаем новую строку таблицы (tr)
        const row = document.createElement('tr');
        // Сохраняем ID команды в data-атрибуте строки для легкого доступа
        row.dataset.teamId = team.id;

        // --- Создаем ячейки (td) для строки ---

        // Ячейка ID
        const idCell = document.createElement('td');
        idCell.textContent = team.id; // Отображаем ID
        row.appendChild(idCell);

        // Ячейка Названия
        const nameCell = document.createElement('td');
        nameCell.textContent = team.name; // Отображаем имя
        nameCell.dataset.originalName = team.name; // Сохраняем оригинальное имя для возможности отмены редактирования
        row.appendChild(nameCell);

        // Ячейка Имени файла логотипа
        const logoCell = document.createElement('td');
        logoCell.textContent = team.logo || '-'; // Отображаем путь к лого или прочерк, если его нет
        logoCell.dataset.originalLogo = team.logo || ""; // Сохраняем оригинальный путь для отмены
        row.appendChild(logoCell);

        // Ячейка Действий (кнопки Edit/Delete)
        const actionsCell = document.createElement('td');
        // Кнопка Edit
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('action-button', 'edit-button');
        // При клике на Edit вызываем функцию переключения в режим редактирования
        editButton.onclick = () => toggleEditMode(row, true);

        // Кнопка Delete
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('action-button', 'delete-button');
        // При клике на Delete вызываем функцию удаления команды
        deleteButton.onclick = () => deleteTeam(team.id, team.name);

        // Добавляем кнопки в ячейку действий
        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell); // Добавляем ячейку действий в строку

        // Добавляем готовую строку в тело таблицы
        teamsTableBody.appendChild(row);
    });
}

/**
 * Переключает режим отображения строки таблицы между просмотром и редактированием.
 * @param {HTMLTableRowElement} row - Строка таблицы для переключения.
 * @param {boolean} isEditing - true для включения режима редактирования, false для выключения.
 */
function toggleEditMode(row, isEditing) {
    // Находим ячейки имени, логотипа и действий в строке
    const nameCell = row.querySelector('td:nth-child(2)');
    const logoCell = row.querySelector('td:nth-child(3)');
    const actionsCell = row.querySelector('td:nth-child(4)');
    // Получаем ID команды и оригинальные значения из data-атрибутов
    const teamId = row.dataset.teamId;
    const originalName = nameCell.dataset.originalName;
    const originalLogo = logoCell.dataset.originalLogo;

    if (!nameCell || !logoCell || !actionsCell) {
        console.error("[Teams] Could not find cells in the row for editing.");
        return;
    }

    if (isEditing) {
        // --- Включаем режим редактирования ---
        const currentName = nameCell.textContent;
        // Получаем текущий путь к лого (если '-', то пустая строка)
        const currentLogo = logoCell.textContent === '-' ? '' : logoCell.textContent;

        // Заменяем текст в ячейках на поля ввода <input>
        nameCell.innerHTML = `<input type="text" value="${currentName}" class="edit-input name-input">`;
        logoCell.innerHTML = `<input type="text" value="${currentLogo}" placeholder="/logos/filename.png" class="edit-input logo-input">`;

        // Очищаем ячейку действий (убираем кнопки Edit/Delete)
        actionsCell.innerHTML = '';

        // Создаем кнопки Save и Cancel
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.classList.add('action-button', 'save-edit-button');
        // Обработчик клика на Save
        saveButton.onclick = () => {
            // Получаем новые значения из полей ввода
            const newName = nameCell.querySelector('input.name-input').value.trim();
            const newLogo = logoCell.querySelector('input.logo-input').value.trim();
            // Сохраняем, только если имя не пустое И (имя изменилось ИЛИ логотип изменился)
            if (newName && (newName !== originalName || newLogo !== originalLogo)) {
                updateTeam(teamId, newName, newLogo, row); // Вызываем функцию сохранения
            } else if (!newName) {
                 // Если имя пустое, выводим предупреждение и ставим фокус обратно
                 alert("Название команды не может быть пустым.");
                 nameCell.querySelector('input.name-input').focus();
            } else {
                // Если ничего не изменилось, просто выключаем режим редактирования
                toggleEditMode(row, false);
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('action-button', 'cancel-edit-button');
        // Обработчик клика на Cancel - просто выключаем режим редактирования
        cancelButton.onclick = () => toggleEditMode(row, false);

        // Добавляем кнопки Save/Cancel в ячейку действий
        actionsCell.appendChild(saveButton);
        actionsCell.appendChild(cancelButton);

        // Устанавливаем фокус на поле ввода имени для удобства
        nameCell.querySelector('input').focus();

    } else {
        // --- Выключаем режим редактирования ---
        // Восстанавливаем оригинальные текстовые значения в ячейках
        nameCell.textContent = originalName;
        logoCell.textContent = originalLogo || '-'; // Показываем прочерк, если лого пустое

        // Очищаем ячейку действий (убираем кнопки Save/Cancel)
        actionsCell.innerHTML = '';

        // Создаем и возвращаем кнопки Edit и Delete
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('action-button', 'edit-button');
        editButton.onclick = () => toggleEditMode(row, true); // Обработчик для включения редактирования

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('action-button', 'delete-button');
        deleteButton.onclick = () => deleteTeam(teamId, originalName); // Обработчик для удаления

        // Добавляем кнопки Edit/Delete обратно в ячейку
        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
    }
}


/**
 * Асинхронно загружает список команд с сервера и отображает их в таблице.
 */
async function fetchTeams() {
    console.log("[Teams] Fetching teams...");
    try {
        // Запрашиваем данные с API
        const response = await fetch('/api/teams');
        if (!response.ok) {
            // Если ответ сервера не успешный, выбрасываем ошибку
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Парсим JSON ответ
        const data = await response.json();
        // Сохраняем массив команд в переменную teamsData
        teamsData = Array.isArray(data.teams) ? data.teams : [];
        console.log("[Teams] Teams loaded:", teamsData);
        // Отображаем команды в таблице
        displayTeams();
    } catch (error) {
        // Обрабатываем ошибки загрузки
        console.error("[Teams] Error fetching teams:", error);
        if (teamsTableBody) {
            // Показываем сообщение об ошибке в таблице
            teamsTableBody.innerHTML = '<tr><td colspan="4">Ошибка загрузки команд.</td></tr>'; // Обновлен colspan
        }
    }
}

/**
 * Обработчик отправки формы добавления новой команды.
 * @param {Event} event - Событие отправки формы.
 */
async function addTeam(event) {
    event.preventDefault(); // Предотвращаем стандартную перезагрузку страницы при отправке формы
    // Получаем значения из полей ввода, удаляя лишние пробелы
    const teamName = newTeamNameInput.value.trim();
    const teamLogo = newTeamLogoInput.value.trim();

    // Проверка, что имя команды не пустое
    if (!teamName) {
        alert("Название команды не может быть пустым.");
        newTeamNameInput.focus(); // Ставим фокус на поле имени
        return; // Прерываем выполнение функции
    }

    console.log(`[Teams] Adding team: ${teamName}, Logo: ${teamLogo}`);
    // Блокируем кнопку добавления на время запроса
    const addButton = addTeamForm.querySelector('button[type="submit"]');
    const originalButtonText = addButton.textContent;
    addButton.disabled = true;
    addButton.textContent = 'Добавление...';

    try {
        // Отправляем POST запрос на сервер с данными новой команды
        const newTeam = await saveData('/api/teams', { name: teamName, logo: teamLogo }, 'POST');
        console.log("[Teams] Team added successfully:", newTeam);
        // После успешного добавления перезагружаем список команд с сервера
        await fetchTeams();
        // Очищаем поля ввода в форме
        newTeamNameInput.value = '';
        newTeamLogoInput.value = '';
    } catch (error) {
        // Обрабатываем ошибки добавления
        console.error("[Teams] Error adding team:", error);
        alert(`Ошибка добавления команды: ${error.message}`);
    } finally {
        // В любом случае разблокируем кнопку и возвращаем исходный текст
        addButton.disabled = false;
        addButton.textContent = originalButtonText;
    }
}

/**
 * Асинхронно обновляет имя и/или логотип существующей команды на сервере.
 * @param {string} teamId - ID команды для обновления.
 * @param {string} newName - Новое имя команды.
 * @param {string} newLogo - Новое имя файла логотипа.
 * @param {HTMLTableRowElement} row - Строка таблицы, соответствующая команде.
 */
async function updateTeam(teamId, newName, newLogo, row) {
    console.log(`[Teams] Updating team ${teamId} to name: ${newName}, logo: ${newLogo}`);
    // Блокируем кнопки Save/Cancel на время запроса
    const saveButton = row.querySelector('.save-edit-button');
    const cancelButton = row.querySelector('.cancel-edit-button');
    if (saveButton) saveButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    try {
        // Отправляем PUT запрос на сервер с обновленными данными
        const updatedTeam = await saveData(`/api/teams/${teamId}`, { name: newName, logo: newLogo }, 'PUT');
        console.log("[Teams] Team updated successfully:", updatedTeam);
        // Обновляем данные в локальном массиве teamsData
        const teamIndex = teamsData.findIndex(t => t.id === teamId);
        if (teamIndex > -1) {
            teamsData[teamIndex].name = newName;
            teamsData[teamIndex].logo = newLogo;
        }
        // Выключаем режим редактирования для строки
        toggleEditMode(row, false);
        // Сервер должен оповестить другие страницы через Socket.IO об изменении
    } catch (error) {
        // Обрабатываем ошибки обновления
        console.error(`[Teams] Error updating team ${teamId}:`, error);
        alert(`Ошибка обновления команды: ${error.message}`);
        // Разблокируем кнопки при ошибке, чтобы пользователь мог попробовать снова
        if (saveButton) saveButton.disabled = false;
        if (cancelButton) cancelButton.disabled = false;
    }
}

/**
 * Асинхронно удаляет команду с сервера.
 * @param {string} teamId - ID команды для удаления.
 * @param {string} teamName - Имя команды (для подтверждения).
 */
async function deleteTeam(teamId, teamName) {
    // Запрашиваем подтверждение у пользователя
    if (!confirm(`Вы уверены, что хотите удалить команду "${teamName}" (ID: ${teamId})?`)) {
        return; // Отмена, если пользователь не подтвердил
    }

    console.log(`[Teams] Deleting team ${teamId}`);
    // Блокируем кнопку Delete на время запроса
    const row = document.querySelector(`tr[data-team-id="${teamId}"]`);
    const deleteButton = row ? row.querySelector('.delete-button') : null;
    if (deleteButton) deleteButton.disabled = true;


    try {
        // Отправляем DELETE запрос на сервер
        const response = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });

        // Проверяем статус ответа
        if (!response.ok) {
             // Пытаемся получить сообщение об ошибке из ответа
             let errorMsg = `HTTP error ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) { /* Оставляем HTTP статус */ }
             throw new Error(errorMsg); // Выбрасываем ошибку
        }

        console.log(`[Teams] Team ${teamId} deleted successfully.`);
        // Удаляем команду из локального массива teamsData
        teamsData = teamsData.filter(team => team.id !== teamId);
        // Перерисовываем таблицу
        displayTeams();
        // Сервер должен оповестить другие страницы через Socket.IO об изменении
    } catch (error) {
        // Обрабатываем ошибки удаления
        console.error(`[Teams] Error deleting team ${teamId}:`, error);
        alert(`Ошибка удаления команды: ${error.message}`);
         // Разблокируем кнопку при ошибке
         if (deleteButton) deleteButton.disabled = false;
    }
}


// ========== Инициализация при загрузке страницы ==========
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем список команд при первой загрузке страницы
    fetchTeams();

    // Привязываем обработчик к событию 'submit' формы добавления команды
    if (addTeamForm) {
        addTeamForm.addEventListener('submit', addTeam);
    }
});

// ========== Обработка обновлений через Socket.IO ==========
// Проверяем, загружен ли клиент Socket.IO
if (typeof io !== 'undefined') {
    // Подключаемся к тому же серверу Socket.IO
    const socket = io();

    // Слушаем событие 'teamsUpdate' от сервера
    socket.on('teamsUpdate', (updatedTeams) => {
        console.log('[SOCKET][TeamsPage] Received teamsUpdate:', updatedTeams);
        // Обновляем локальный массив команд
        teamsData = Array.isArray(updatedTeams) ? updatedTeams : [];
        // Перерисовываем таблицу с обновленным списком
        displayTeams();
    });
    console.log('[Teams] Socket listener for "teamsUpdate" attached.');

} else {
    // Предупреждение, если Socket.IO не загружен
    console.warn("Socket.IO client not found. Real-time team updates will not work on this page.");
}
