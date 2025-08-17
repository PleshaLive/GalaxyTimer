// public/js/teams.js
import { saveData } from './api.js'; // Импортируем функцию для отправки данных на сервер

const teamsTableBody = document.querySelector('#teamsTable tbody');
const addTeamForm = document.getElementById('addTeamForm');
const newTeamNameInput = document.getElementById('newTeamName');
const newTeamLogoInput = document.getElementById('newTeamLogo'); // Поле для ввода имени файла лого

let teamsData = []; // Хранилище для загруженных команд

/**
 * Извлекает имя файла из полного пути логотипа.
 * Пример: /logos/navi.png -> navi
 * @param {string} logoPath - Полный или относительный путь к логотипу.
 * @returns {string} - Имя файла без расширения и пути.
 */
function extractLogoFilename(logoPath) {
    if (!logoPath || typeof logoPath !== 'string') return "";
    // Удаляем путь и расширение .png
    return logoPath.split('/').pop().replace(/\.png$/i, '');
}

/**
 * Формирует полный относительный путь к логотипу.
 * @param {string} filename - Имя файла (без расширения).
 * @returns {string} - Относительный путь вида /logos/filename.png или пустая строка.
 */
function buildLogoPath(filename) {
    if (!filename || typeof filename !== 'string') return "";
    // Убираем возможное расширение .png и добавляем путь
    const nameWithoutExt = filename.replace(/\.png$/i, '');
    return `/logos/${nameWithoutExt}.png`;
}


/** Отображает список команд в таблице */
function displayTeams() {
    if (!teamsTableBody) return;
    teamsTableBody.innerHTML = '';

    if (teamsData.length === 0) {
        teamsTableBody.innerHTML = '<tr><td colspan="4">Список команд пуст.</td></tr>';
        return;
    }

    teamsData.forEach(team => {
        const row = document.createElement('tr');
        row.dataset.teamId = team.id;

        const idCell = document.createElement('td');
        idCell.textContent = team.id;
        row.appendChild(idCell);

        const nameCell = document.createElement('td');
        nameCell.textContent = team.name;
        nameCell.dataset.originalName = team.name;
        row.appendChild(nameCell);

        // Отображаем только имя файла логотипа
        const logoCell = document.createElement('td');
        const logoFilename = extractLogoFilename(team.logo); // Получаем имя файла
        logoCell.textContent = logoFilename || '-'; // Показываем имя файла или прочерк
        logoCell.dataset.originalLogoFilename = logoFilename; // Сохраняем имя файла для отмены
        row.appendChild(logoCell);

        const actionsCell = document.createElement('td');
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('action-button', 'edit-button');
        editButton.onclick = () => toggleEditMode(row, true);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('action-button', 'delete-button');
        deleteButton.onclick = () => deleteTeam(team.id, team.name);

        actionsCell.appendChild(editButton);
        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);

        teamsTableBody.appendChild(row);
    });
}

/** Переключает режим редактирования для строки таблицы */
function toggleEditMode(row, isEditing) {
    const nameCell = row.querySelector('td:nth-child(2)');
    const logoCell = row.querySelector('td:nth-child(3)');
    const actionsCell = row.querySelector('td:nth-child(4)');
    const teamId = row.dataset.teamId;
    const originalName = nameCell.dataset.originalName;
    const originalLogoFilename = logoCell.dataset.originalLogoFilename; // Используем сохраненное имя файла

    if (!nameCell || !logoCell || !actionsCell) return;

    if (isEditing) {
        // Включаем режим редактирования
        const currentName = nameCell.textContent;
        const currentLogoFilename = logoCell.textContent === '-' ? '' : logoCell.textContent; // Получаем текущее имя файла

        nameCell.innerHTML = `<input type="text" value="${currentName}" class="edit-input name-input">`;
        // Поле ввода для имени файла логотипа
        logoCell.innerHTML = `<input type="text" value="${currentLogoFilename}" placeholder="имя_файла (без .png)" class="edit-input logo-input">`;

        actionsCell.innerHTML = '';

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.classList.add('action-button', 'save-edit-button');
        saveButton.onclick = () => {
            const newName = nameCell.querySelector('input.name-input').value.trim();
            const newLogoFilename = logoCell.querySelector('input.logo-input').value.trim(); // Получаем новое имя файла
            // Сохраняем, если имя не пустое и (имя изменилось ИЛИ имя файла лого изменилось)
            if (newName && (newName !== originalName || newLogoFilename !== originalLogoFilename)) {
                // Формируем полный путь перед отправкой
                const newLogoPath = buildLogoPath(newLogoFilename);
                updateTeam(teamId, newName, newLogoPath, row); // Отправляем полный путь
            } else if (!newName) {
                 alert("Название команды не может быть пустым.");
                 nameCell.querySelector('input.name-input').focus();
            } else {
                toggleEditMode(row, false); // Отмена, если ничего не изменилось
            }
        };

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.classList.add('action-button', 'cancel-edit-button');
        cancelButton.onclick = () => toggleEditMode(row, false);

        actionsCell.appendChild(saveButton);
        actionsCell.appendChild(cancelButton);
        nameCell.querySelector('input').focus();

    } else {
        // Выключаем режим редактирования
        nameCell.textContent = originalName;
        logoCell.textContent = originalLogoFilename || '-'; // Восстанавливаем имя файла логотипа

        actionsCell.innerHTML = '';

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
        const response = await fetch('/api/teams');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        teamsData = Array.isArray(data.teams) ? data.teams : [];
        console.log("[Teams] Teams loaded:", teamsData);
        displayTeams();
    } catch (error) {
        console.error("[Teams] Error fetching teams:", error);
        if (teamsTableBody) teamsTableBody.innerHTML = '<tr><td colspan="4">Ошибка загрузки команд.</td></tr>';
    }
}

/** Добавляет новую команду */
async function addTeam(event) {
    event.preventDefault();
    const teamName = newTeamNameInput.value.trim();
    const logoFilename = newTeamLogoInput.value.trim(); // Получаем имя файла

    if (!teamName) {
        alert("Название команды не может быть пустым.");
        newTeamNameInput.focus();
        return;
    }

    // Формируем полный относительный путь
    const teamLogoPath = buildLogoPath(logoFilename);

    console.log(`[Teams] Adding team: ${teamName}, Logo Path: ${teamLogoPath}`);
    const addButton = addTeamForm.querySelector('button[type="submit"]');
    const originalButtonText = addButton.textContent;
    addButton.disabled = true;
    addButton.textContent = 'Добавление...';

    try {
        // Отправляем имя и СФОРМИРОВАННЫЙ путь логотипа
        const newTeam = await saveData('/api/teams', { name: teamName, logo: teamLogoPath }, 'POST');
        console.log("[Teams] Team added successfully:", newTeam);
        await fetchTeams();
        newTeamNameInput.value = '';
        newTeamLogoInput.value = ''; // Очищаем поле ввода имени файла
    } catch (error) {
        console.error("[Teams] Error adding team:", error);
        alert(`Ошибка добавления команды: ${error.message}`);
    } finally {
        addButton.disabled = false;
        addButton.textContent = originalButtonText;
    }
}

/** Обновляет имя и/или логотип существующей команды */
async function updateTeam(teamId, newName, newLogoPath, row) { // Принимаем полный путь лого
    console.log(`[Teams] Updating team ${teamId} to name: ${newName}, logo path: ${newLogoPath}`);
    const saveButton = row.querySelector('.save-edit-button');
    const cancelButton = row.querySelector('.cancel-edit-button');
    if (saveButton) saveButton.disabled = true;
    if (cancelButton) cancelButton.disabled = true;

    try {
        // Отправляем имя и СФОРМИРОВАННЫЙ путь логотипа
        const updatedTeam = await saveData(`/api/teams/${teamId}`, { name: newName, logo: newLogoPath }, 'PUT');
        console.log("[Teams] Team updated successfully:", updatedTeam);
        const teamIndex = teamsData.findIndex(t => t.id === teamId);
        if (teamIndex > -1) {
            teamsData[teamIndex].name = newName;
            teamsData[teamIndex].logo = newLogoPath; // Обновляем полный путь в локальных данных
        }
        toggleEditMode(row, false);
    } catch (error) {
        console.error(`[Teams] Error updating team ${teamId}:`, error);
        alert(`Ошибка обновления команды: ${error.message}`);
        if (saveButton) saveButton.disabled = false;
        if (cancelButton) cancelButton.disabled = false;
    }
}

/** Удаляет команду */
async function deleteTeam(teamId, teamName) {
    if (!confirm(`Вы уверены, что хотите удалить команду "${teamName}" (ID: ${teamId})?`)) {
        return;
    }
    console.log(`[Teams] Deleting team ${teamId}`);
    const row = document.querySelector(`tr[data-team-id="${teamId}"]`);
    const deleteButton = row ? row.querySelector('.delete-button') : null;
    if (deleteButton) deleteButton.disabled = true;

    try {
        const response = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
        if (!response.ok) {
             let errorMsg = `HTTP error ${response.status}`;
             try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
             throw new Error(errorMsg);
        }
        console.log(`[Teams] Team ${teamId} deleted successfully.`);
        teamsData = teamsData.filter(team => team.id !== teamId);
        displayTeams();
    } catch (error) {
        console.error(`[Teams] Error deleting team ${teamId}:`, error);
        alert(`Ошибка удаления команды: ${error.message}`);
         if (deleteButton) deleteButton.disabled = false;
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
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('teamsUpdate', (updatedTeams) => {
        console.log('[SOCKET][TeamsPage] Received teamsUpdate:', updatedTeams);
        teamsData = Array.isArray(updatedTeams) ? updatedTeams : [];
        displayTeams(); // Перерисовываем таблицу
    });
    console.log('[Teams] Socket listener for "teamsUpdate" attached.');
} else {
    console.warn("Socket.IO client not found. Real-time team updates will not work on this page.");
}
