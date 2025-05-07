// public/js/casters.js
import { saveData } from './api.js';
// Убедитесь, что setButtonState экспортируется из main.js
import { setButtonState } from './main.js';

let allCasters = []; // Локальное хранилище списка всех кастеров
// Локальное хранилище имен выбранных кастеров
let currentSelectedCasterNames = { caster1: null, caster2: null };

// Элементы DOM
const caster1SelectElement = document.getElementById('caster1Select');
const caster2SelectElement = document.getElementById('caster2Select');
const addCasterFormElement = document.getElementById('addCasterForm');
const newCasterNameInputElement = document.getElementById('newCasterName');
const newCasterSocialInputElement = document.getElementById('newCasterSocial');
const addCasterButtonElement = document.getElementById('addCasterButton');
const saveSelectedCastersButtonElement = document.getElementById('saveSelectedCastersButton');
const castersListContainerElement = document.getElementById('castersListContainer');

// --- Функции загрузки данных ---

/**
 * Загружает всех кастеров с сервера.
 */
export async function loadCasters() {
    console.log("[Casters] Attempting to load casters...");
    try {
        const response = await fetch('/api/casters');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error ${response.status}: ${errorData.message || 'Failed to fetch'}`);
        }
        allCasters = await response.json();
        console.log("[Casters] Casters loaded successfully:", allCasters);
    } catch (error) {
        console.error("[Casters] Failed to load casters:", error);
        allCasters = [];
        if (castersListContainerElement) castersListContainerElement.innerHTML = '<p style="color: var(--color-error);">Не удалось загрузить список кастеров.</p>';
    }
    // Всегда обновляем UI после попытки загрузки
    populateCasterSelects();
    displayCastersList();
}

/**
 * Загружает текущих выбранных кастеров с сервера.
 * Обрабатывает формат ответа { caster1: ..., caster1soc: ..., ... }.
 */
export async function loadSelectedCasters() {
    console.log("[Casters] Attempting to load selected casters...");
    try {
        const response = await fetch('/api/selected-casters');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error ${response.status}: ${errorData.message || 'Failed to fetch'}`);
        }
        const selectedDataFromServer = await response.json();

        // Сохраняем только имена в локальное состояние
        currentSelectedCasterNames.caster1 = selectedDataFromServer.caster1 || null;
        currentSelectedCasterNames.caster2 = selectedDataFromServer.caster2 || null;

        console.log("[Casters] Selected caster data loaded successfully (names stored locally):", currentSelectedCasterNames);

    } catch (error) {
        console.error("[Casters] Failed to load selected casters:", error);
        currentSelectedCasterNames = { caster1: null, caster2: null };
    }
    // Обновляем селекты, используя загруженные имена
    populateCasterSelects();
}

// --- Функции отображения и UI ---

/**
 * Заполняет выпадающие списки (select) кастерами.
 * Устанавливает выбранные значения на основе currentSelectedCasterNames.
 */
function populateCasterSelects() {
    const selects = [caster1SelectElement, caster2SelectElement];
    const currentSelection = {
        caster1: selects[0]?.value,
        caster2: selects[1]?.value
    };

    selects.forEach((select, index) => {
        if (!select) return;
        let valueToSelect = "";
        const currentUiValue = (index === 0) ? currentSelection.caster1 : currentSelection.caster2;
        const savedValue = (index === 0) ? currentSelectedCasterNames.caster1 : currentSelectedCasterNames.caster2;

        if (currentUiValue && allCasters.some(c => c.caster === currentUiValue)) {
            valueToSelect = currentUiValue;
        } else if (savedValue && allCasters.some(c => c.caster === savedValue)) {
            valueToSelect = savedValue;
        }

        select.innerHTML = '<option value="">- Выбрать кастера -</option>';
        allCasters.forEach(caster => {
            const option = document.createElement('option');
            option.value = caster.caster;
            option.textContent = caster.caster;
            option.dataset.social = caster.social || '';
            select.appendChild(option);
        });
        select.value = valueToSelect;
    });
    // console.log("[Casters] Caster select elements populated/repopulated. Current names state:", currentSelectedCasterNames);
}

/**
 * Отображает список всех кастеров на странице с кнопками Edit/Delete.
 */
function displayCastersList() {
    if (!castersListContainerElement) {
        console.warn("[Casters] Casters list container (#castersListContainer) not found.");
        return;
    }
    castersListContainerElement.innerHTML = '';

    if (!allCasters || allCasters.length === 0) {
        if (castersListContainerElement.innerHTML === '') {
             castersListContainerElement.innerHTML = '<p>Список кастеров пуст.</p>';
        }
        return;
    }

    const ul = document.createElement('ul');
    allCasters.forEach(caster => {
        if (!caster || !caster.id) return;

        const li = document.createElement('li');
        li.dataset.casterId = caster.id;
        li.dataset.originalName = caster.caster;
        li.dataset.originalSocial = caster.social || ""; // Сохраняем пустую строку, если social undefined

        // Создаем контент для режима отображения по умолчанию
        createCasterDisplayMode(li, caster);

        ul.appendChild(li);
    });
    castersListContainerElement.appendChild(ul);
    // console.log("[Casters] Casters list has been displayed with edit/delete buttons.");
}

/**
 * Создает и добавляет элементы для режима отображения кастера.
 * @param {HTMLElement} liElement - Элемент <li>.
 * @param {object} caster - Данные кастера.
 */
function createCasterDisplayMode(liElement, caster) {
    liElement.innerHTML = ''; // Очищаем предыдущее содержимое
    liElement.classList.remove('editing');

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('caster-details');
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('caster-name');
    nameSpan.textContent = caster.caster || 'Имя не указано';
    const socialSpan = document.createElement('span');
    socialSpan.classList.add('caster-social');
    socialSpan.textContent = ` (${caster.social || 'нет соц.сети'})`;
    detailsDiv.appendChild(nameSpan);
    detailsDiv.appendChild(socialSpan);

    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('caster-actions');

    const editButton = document.createElement('button');
    editButton.innerHTML = '<i class="fas fa-edit"></i>';
    editButton.classList.add('app-button', 'edit-caster-btn');
    editButton.title = `Редактировать кастера ${caster.caster}`;
    editButton.addEventListener('click', () => toggleEditMode(liElement, true));

    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteButton.classList.add('app-button', 'delete-caster-btn');
    deleteButton.title = `Удалить кастера ${caster.caster}`;
    deleteButton.addEventListener('click', () => handleDeleteCaster(caster.id, caster.caster));

    actionsDiv.appendChild(editButton);
    actionsDiv.appendChild(deleteButton);

    liElement.appendChild(detailsDiv);
    liElement.appendChild(actionsDiv);
}

/**
 * Создает и добавляет элементы для режима редактирования кастера.
 * @param {HTMLElement} liElement - Элемент <li>.
 */
function createCasterEditMode(liElement) {
    liElement.innerHTML = ''; // Очищаем предыдущее содержимое
    liElement.classList.add('editing');

    const casterId = liElement.dataset.casterId;
    const originalName = liElement.dataset.originalName;
    const originalSocial = liElement.dataset.originalSocial;

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('caster-details');
    detailsDiv.innerHTML = `
        <input type="text" class="edit-input caster-name-input" value="${originalName}" placeholder="Имя кастера" required>
        <input type="text" class="edit-input caster-social-input" value="${originalSocial}" placeholder="Соц.сеть">
    `;

    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('caster-actions');

    const saveButton = document.createElement('button');
    saveButton.innerHTML = '<i class="fas fa-save"></i>';
    saveButton.classList.add('app-button', 'save-caster-btn');
    saveButton.title = 'Сохранить изменения';
    saveButton.addEventListener('click', () => {
        const newNameInput = detailsDiv.querySelector('.caster-name-input');
        const newSocialInput = detailsDiv.querySelector('.caster-social-input');
        handleSaveCasterEdit(casterId, newNameInput.value.trim(), newSocialInput.value.trim(), liElement, saveButton);
    });

    const cancelButton = document.createElement('button');
    cancelButton.innerHTML = '<i class="fas fa-times"></i>';
    cancelButton.classList.add('app-button', 'cancel-caster-btn');
    cancelButton.title = 'Отменить редактирование';
    cancelButton.addEventListener('click', () => toggleEditMode(liElement, false));

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);

    liElement.appendChild(detailsDiv);
    liElement.appendChild(actionsDiv);

    detailsDiv.querySelector('.caster-name-input')?.focus();
}


/**
 * Переключает режим отображения/редактирования для строки кастера.
 * @param {HTMLElement} liElement - Элемент <li> строки кастера.
 * @param {boolean} isEditing - True для перехода в режим редактирования, false для возврата.
 */
function toggleEditMode(liElement, isEditing) {
    const casterId = liElement.dataset.casterId;
    if (!casterId) return;

    if (isEditing) {
        createCasterEditMode(liElement);
    } else {
        // Находим оригинальные данные из allCasters (на случай, если data-атрибуты устарели)
        // или используем data-атрибуты как запасной вариант
        const currentCasterData = allCasters.find(c => c.id === casterId) || {
            id: casterId,
            caster: liElement.dataset.originalName,
            social: liElement.dataset.originalSocial
        };
        createCasterDisplayMode(liElement, currentCasterData);
    }
}


// --- Функции обработки действий ---

/**
 * Обработчик отправки формы добавления нового кастера.
 */
async function handleAddCasterSubmit(event) {
    event.preventDefault();
    const name = newCasterNameInputElement.value.trim();
    const social = newCasterSocialInputElement.value.trim();

    if (!name) { /* ... валидация ... */ return; }
    if (allCasters.some(c => c.caster.toLowerCase() === name.toLowerCase())) { /* ... валидация ... */ return; }

    setButtonState(addCasterButtonElement, 'saving', 'Добавление...');
    try {
        const newCasterData = { caster: name, social: social };
        await saveData('/api/casters', newCasterData, 'POST');
        // UI обновится через сокет 'castersUpdate'
        newCasterNameInputElement.value = '';
        newCasterSocialInputElement.value = '';
        setButtonState(addCasterButtonElement, 'saved', 'Добавлено!');
    } catch (error) {
        console.error('[Casters] Error adding new caster:', error);
        setButtonState(addCasterButtonElement, 'error', error.message || 'Ошибка добавления');
        alert(`Ошибка добавления кастера: ${error.message}`);
    }
}

/**
 * Обработчик нажатия кнопки "Назначить Кастеров".
 */
async function handleSaveSelectedCasters() {
    const caster1Name = caster1SelectElement.value;
    const caster2Name = caster2SelectElement.value;

    if (caster1Name && caster2Name && caster1Name === caster2Name) { /* ... валидация ... */ return; }

    const dataToSave = { caster1: caster1Name || null, caster2: caster2Name || null };
    console.log('[Casters] Saving selected casters:', dataToSave);
    setButtonState(saveSelectedCastersButtonElement, 'saving', 'Сохранение...');

    try {
        const result = await saveData('/api/selected-casters', dataToSave, 'POST');
        // Обновляем локальное состояние имен (полные данные придут через сокет)
        currentSelectedCasterNames.caster1 = result.data.caster1 || null;
        currentSelectedCasterNames.caster2 = result.data.caster2 || null;
        setButtonState(saveSelectedCastersButtonElement, 'saved', 'Назначено!');
        console.log('[Casters] Selected casters saved successfully response:', result);
    } catch (error) {
        console.error('[Casters] Error saving selected casters:', error);
        setButtonState(saveSelectedCastersButtonElement, 'error', error.message || 'Ошибка сохранения');
        alert(`Ошибка назначения кастеров: ${error.message}`);
    }
}

/**
 * Обработчик сохранения изменений кастера после редактирования.
 */
async function handleSaveCasterEdit(casterId, newName, newSocial, liElement, saveButton) {
    const originalName = liElement.dataset.originalName;
    const originalSocial = liElement.dataset.originalSocial;

    if (!newName) { /* ... валидация ... */ return; }
    if (newName === originalName && newSocial === originalSocial) { toggleEditMode(liElement, false); return; }
    if (newName.toLowerCase() !== originalName.toLowerCase() &&
        allCasters.some(c => c.id !== casterId && c.caster.toLowerCase() === newName.toLowerCase())) { /* ... валидация конфликта ... */ return; }

    setButtonState(saveButton, 'saving');
    try {
        const updatedData = { caster: newName, social: newSocial };
        const result = await saveData(`/api/casters/${casterId}`, updatedData, 'PUT');

        console.log('[Casters] Caster updated response:', result);
        // Обновляем data-атрибуты для консистентности (хотя UI обновится через сокет)
        liElement.dataset.originalName = newName;
        liElement.dataset.originalSocial = newSocial;

        // Обновление UI произойдет через сокет 'castersUpdate' и 'selectedCastersUpdate'
        // Поэтому просто выходим из режима редактирования
        toggleEditMode(liElement, false);

    } catch (error) {
        console.error(`[Casters] Error updating caster ${casterId}:`, error);
        setButtonState(saveButton, 'error', 'Ошибка');
        alert(`Ошибка обновления кастера: ${error.message}`);
        // Не выходим из режима редактирования при ошибке
        setTimeout(() => {
            if(saveButton?.classList.contains('error')){ // Проверяем, что кнопка еще существует
                 setButtonState(saveButton, 'idle');
            }
        }, 2500);
    }
}

/**
 * Обработчик нажатия кнопки удаления кастера.
 */
async function handleDeleteCaster(casterId, casterName) {
    if (!confirm(`Вы уверены, что хотите удалить кастера "${casterName}" (ID: ${casterId})? Это действие необратимо.`)) {
        return;
    }
    console.log(`[Casters] Attempting to delete caster ${casterId}`);
    const listItem = castersListContainerElement.querySelector(`li[data-caster-id="${casterId}"]`);
    const deleteButton = listItem?.querySelector('.delete-caster-btn');
    if (deleteButton) deleteButton.disabled = true;

    try {
        const response = await fetch(`/api/casters/${casterId}`, { method: 'DELETE' });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        console.log(`[Casters] Caster ${casterId} deleted request sent successfully.`);
        // UI обновится через сокеты 'castersUpdate' и 'selectedCastersUpdate'
    } catch (error) {
        console.error(`[Casters] Error deleting caster ${casterId}:`, error);
        alert(`Ошибка удаления кастера: ${error.message}`);
        if (deleteButton) deleteButton.disabled = false;
    }
}

// --- Инициализация модуля ---

/**
 * Инициализация вкладки "Кастеры".
 */
export async function initCasters() {
    console.log("[Casters] Initializing Casters tab module...");
    if (addCasterFormElement) {
        addCasterFormElement.addEventListener('submit', handleAddCasterSubmit);
    } else {
        console.warn("[Casters] Add caster form (#addCasterForm) not found.");
    }
    if (saveSelectedCastersButtonElement) {
        saveSelectedCastersButtonElement.addEventListener('click', handleSaveSelectedCasters);
    } else {
        console.warn("[Casters] Save selected casters button (#saveSelectedCastersButton) not found.");
    }
    if (!castersListContainerElement) {
        console.warn("[Casters] Casters list container (#castersListContainer) not found.");
    }

    try {
        await Promise.all([ loadCasters(), loadSelectedCasters() ]);
         console.log("[Casters] Initial caster data loaded.");
    } catch(error) {
        console.error("[Casters] Error during initial data load:", error);
    }
    console.log("[Casters] Casters tab module initialized.");
}

// --- Функции обновления UI от Socket.IO ---

/**
 * Обновляет UI списка кастеров при получении данных через Socket.IO.
 * @param {Array<Object>} updatedCastersData - Новый массив объектов кастеров.
 */
export function updateCastersUIFromSocket(updatedCastersData) {
    console.log("[Casters Socket] Received 'castersUpdate'. Updating UI.");
    allCasters = Array.isArray(updatedCastersData) ? updatedCastersData : [];
    populateCasterSelects(); // Перезаполняем селекты (сохраняя текущий выбор, если он валиден)
    displayCastersList();    // Перерисовываем список
}

/**
 * Обновляет UI выбранных кастеров при получении данных через Socket.IO.
 * @param {Object} selectedCastersDataFromServer - Новый объект { caster1, caster1soc, caster2, caster2soc }.
 */
export function updateSelectedCastersUIFromSocket(selectedCastersDataFromServer) {
    console.log("[Casters Socket] Received 'selectedCastersUpdate'. Data:", selectedCastersDataFromServer);

    // Обновляем локальное состояние имен
    currentSelectedCasterNames.caster1 = selectedCastersDataFromServer.caster1 || null;
    currentSelectedCasterNames.caster2 = selectedCastersDataFromServer.caster2 || null;

    // Устанавливаем значения в селектах
    if (caster1SelectElement) {
        caster1SelectElement.value = selectedCastersDataFromServer.caster1 || "";
    }
    if (caster2SelectElement) {
        caster2SelectElement.value = selectedCastersDataFromServer.caster2 || "";
    }
    // Дополнительно можно отобразить соц.сети, если есть куда
}