// public/js/teams.js
import { saveData } from './api.js'; // Импортируем функцию для отправки данных

const teamsTableBody = document.querySelector('#teamsTable tbody');
const addTeamForm = document.getElementById('addTeamForm');
const newTeamNameInput = document.getElementById('newTeamName');

let teamsData = []; // Хранилище для загруженных команд

/** Отображает список команд в таблице */
function displayTeams() {
    if (!teamsTableBody) return;
    teamsTableBody.innerHTML = ''; // Очищаем таблицу

    if (teamsData.length === 0) {
        teamsTableBody.innerHTML = '<tr><td colspan="3">Список команд пуст.</td></tr>';
        return;
    }

    teamsData.forEach(team => {
        const row = document.createElement('tr');
        row.dataset.teamId = team.id; // Сохраняем ID команды

        // Ячейка ID
        const idCell = document.createElement('td');
        idCell.textContent = team.id;
        row.appendChild(idCell);

        // Ячейка Названия
        const nameCell = document.createElement('td');
        nameCell.textContent = team.name;
        nameCell.dataset.originalName = team.name; // Сохраняем оригинальное имя для отмены
        row.appendChild(nameCell);

        // Ячейка Действий
        const actionsCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('action-button', 'edit-button');
        editButton.onclick = () => toggleEditMode(row, true); // Включить режим редактирования

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('action-button', 'delete-button');
        deleteButton.onclick = () => deleteTeam(team.id, team.name); // Удалить команду

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);

        teamsTableBody.appendChild(row);
    });
}

/** Переключает режим редактирования для строки таблицы */
function toggleEditMode(row, isEditing) {
    const nameCell = row.querySelector('td:nth-child(2)');
    const actionsCell = row.querySelector('td:nth-child(3)');
    const teamId = row.dataset.teamId;
    const originalName = nameCell.dataset.originalName;

    if (isEditing) {
        // Включаем режим редактирования
        const currentName = nameCell.textContent;
        nameCell.innerHTML = `<input type="text" value="${currentName}" class="edit-input">`;

        actionsCell.innerHTML = ''; // Очищаем кнопки Edit/Delete

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.classList.add('action-button', 'save-edit-button');
        saveButton.onclick = () => {
            const newName = nameCell.querySelector('input').value.trim();
            if (newName && newName !== originalName) {
                updateTeam(teamId, newName, row); // Сохраняем изменения
            } else {
                toggleEditMode(row, false); // Отмена, если имя не изменилось или пустое
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('action-button', 'cancel-edit-button');
        cancelButton.onclick = () => toggleEditMode(row, false); // Отменить редактирование

        actionsCell.appendChild(saveButton);
        actionsCell.appendChild(cancelButton);

        nameCell.querySelector('input').focus(); // Фокус на поле ввода

    } else {
        // Выключаем режим редактирования
        nameCell.textContent = originalName; // Восстанавливаем оригинальное имя

        actionsCell.innerHTML = ''; // Очищаем кнопки Save/Cancel

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('action-button', 'edit-button');
        editButton.onclick = () => toggleEditMode(row, true);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('action-button', 'delete-button');
        deleteButton.onclick = () => deleteTeam(teamId, originalName);

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
    }
}


/** Загружает список команд с сервера */
async function fetchTeams() {
    console.log("[Teams] Fetching teams...");
    try {
        const response = await fetch('/api/teams'); // Используем существующий эндпоинт
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Убедимся, что получаем массив команд
        teamsData = Array.isArray(data.teams) ? data.teams : [];
        console.log("[Teams] Teams loaded:", teamsData);
        displayTeams(); // Отображаем загруженные команды
    } catch (error) {
        console.error("[Teams] Error fetching teams:", error);
        if (teamsTableBody) {
            teamsTableBody.innerHTML = '<tr><td colspan="3">Ошибка загрузки команд.</td></tr>';
        }
    }
}

/** Добавляет новую команду */
async function addTeam(event) {
    event.preventDefault(); // Предотвращаем стандартную отправку формы
    const teamName = newTeamNameInput.value.trim();
    if (!teamName) {
        alert("Название команды не может быть пустым.");
        return;
    }

    console.log(`[Teams] Adding team: ${teamName}`);
    const addButton = addTeamForm.querySelector('button[type="submit"]');
    const originalButtonText = addButton.textContent;
    addButton.disabled = true;
    addButton.textContent = 'Добавление...';

    try {
        // Отправляем POST запрос на новый эндпоинт
        const newTeam = await saveData('/api/teams', { name: teamName }, 'POST');
        console.log("[Teams] Team added successfully:", newTeam);
        // Обновляем список команд с сервера (или просто добавляем локально и перерисовываем)
        await fetchTeams(); // Перезагружаем список
        newTeamNameInput.value = ''; // Очищаем поле ввода
    } catch (error) {
        console.error("[Teams] Error adding team:", error);
        alert(`Ошибка добавления команды: ${error.message}`);
    } finally {
        addButton.disabled = false;
        addButton.textContent = originalButtonText;
    }
}

/** Обновляет имя существующей команды */
async function updateTeam(teamId, newName, row) {
    console.log(`[Teams] Updating team ${teamId} to name: ${newName}`);
    const saveButton = row.querySelector('.save-edit-button');
    const cancelButton = row.querySelector('.cancel-edit-button');
    if (saveButton) saveButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    try {
        // Отправляем PUT запрос на новый эндпоинт
        const updatedTeam = await saveData(`/api/teams/${teamId}`, { name: newName }, 'PUT');
        console.log("[Teams] Team updated successfully:", updatedTeam);
        // Обновляем данные локально и выключаем режим редактирования
        const teamIndex = teamsData.findIndex(t => t.id === teamId);
        if (teamIndex > -1) {
            teamsData[teamIndex].name = newName; // Обновляем имя в локальном массиве
        }
        toggleEditMode(row, false); // Выключаем режим редактирования
        // Обновляем селекты на главной странице через Socket.IO (сервер должен это сделать)
    } catch (error) {
        console.error(`[Teams] Error updating team ${teamId}:`, error);
        alert(`Ошибка обновления команды: ${error.message}`);
        // Не выключаем режим редактирования при ошибке, чтобы пользователь мог попробовать снова
        if (saveButton) saveButton.disabled = false;
        if (cancelButton) cancelButton.disabled = false;
    }
}

/** Удаляет команду */
async function deleteTeam(teamId, teamName) {
    // Запрашиваем подтверждение у пользователя
    if (!confirm(`Вы уверены, что хотите удалить команду "${teamName}" (ID: ${teamId})?`)) {
        return; // Отмена, если пользователь не подтвердил
    }

    console.log(`[Teams] Deleting team ${teamId}`);
    // Можно добавить визуальную индикацию удаления на кнопке/строке
    const row = document.querySelector(`tr[data-team-id="${teamId}"]`);
    const deleteButton = row ? row.querySelector('.delete-button') : null;
    if (deleteButton) deleteButton.disabled = true;


    try {
        // Отправляем DELETE запрос на новый эндпоинт
        // Используем fetch напрямую, так как saveData ожидает JSON ответ, а DELETE может его не вернуть
        const response = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });

        if (!response.ok) {
             // Пытаемся получить сообщение об ошибке
             let errorMsg = `HTTP error ${response.status}`;
             try {
                 const errorData = await response.json();
                 errorMsg = errorData.message || errorMsg;
             } catch (e) { /* Оставляем HTTP статус */ }
             throw new Error(errorMsg);
        }

        console.log(`[Teams] Team ${teamId} deleted successfully.`);
        // Удаляем команду из локального массива и перерисовываем таблицу
        teamsData = teamsData.filter(team => team.id !== teamId);
        displayTeams();
        // Обновляем селекты на главной странице через Socket.IO (сервер должен это сделать)
    } catch (error) {
        console.error(`[Teams] Error deleting team ${teamId}:`, error);
        alert(`Ошибка удаления команды: ${error.message}`);
         if (deleteButton) deleteButton.disabled = false; // Разблокируем кнопку при ошибке
    }
}


// ========== Инициализация при загрузке страницы ==========
document.addEventListener('DOMContentLoaded', () => {
    fetchTeams(); // Загружаем команды при загрузке страницы

    // Привязываем обработчик к форме добавления
    if (addTeamForm) {
        addTeamForm.addEventListener('submit', addTeam);
    }
});

// ========== Обработка обновлений через Socket.IO ==========
// Подключаемся к тому же сокету, что и на главной странице
// (предполагается, что socket.io.js подключен в HTML)
if (typeof io !== 'undefined') {
    const socket = io();

    // Слушаем событие обновления списка команд от сервера
    socket.on('teamsUpdate', (updatedTeams) => {
        console.log('[SOCKET] Received teamsUpdate:', updatedTeams);
        teamsData = Array.isArray(updatedTeams) ? updatedTeams : [];
        displayTeams(); // Перерисовываем таблицу с обновленным списком
    });
} else {
    console.warn("Socket.IO client not found. Real-time team updates will not work.");
}
