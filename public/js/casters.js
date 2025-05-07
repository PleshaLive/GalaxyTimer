// public/js/casters.js
import { saveData } from './api.js';
// Убедитесь, что setButtonState экспортируется из main.js
import { setButtonState } from './main.js';

let allCasters = []; // Локальное хранилище списка всех кастеров
// Локальное хранилище выбранных кастеров (продолжаем хранить только имена для удобства работы с селектами)
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
    populateCasterSelects(); // Обновляем селекты
    displayCastersList();    // Обновляем отображаемый список
}

/**
 * Загружает текущих выбранных кастеров с сервера.
 * Обрабатывает новый формат ответа { caster1: ..., caster1soc: ..., ... }.
 */
export async function loadSelectedCasters() {
    console.log("[Casters] Attempting to load selected casters...");
    try {
        const response = await fetch('/api/selected-casters');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error ${response.status}: ${errorData.message || 'Failed to fetch'}`);
        }
        const selectedDataFromServer = await response.json(); // Получаем { caster1: ..., caster1soc: ..., ... }

        // Сохраняем только имена в локальное состояние для управления селектами
        currentSelectedCasterNames.caster1 = selectedDataFromServer.caster1 || null;
        currentSelectedCasterNames.caster2 = selectedDataFromServer.caster2 || null;

        console.log("[Casters] Selected caster data (incl. socials) loaded successfully:", selectedDataFromServer);
        console.log("[Casters] Stored selected caster names locally:", currentSelectedCasterNames);

    } catch (error) {
        console.error("[Casters] Failed to load selected casters:", error);
        currentSelectedCasterNames = { caster1: null, caster2: null }; // Сброс в случае ошибки
    }
    // Обновляем селекты, используя загруженные имена
    populateCasterSelects();
}


/**
 * Заполняет выпадающие списки (select) кастерами.
 * Устанавливает выбранные значения на основе currentSelectedCasterNames.
 */
function populateCasterSelects() {
    const selects = [caster1SelectElement, caster2SelectElement];

    selects.forEach((select, index) => {
        if (!select) return;

        const valueToSelect = (index === 0) ? currentSelectedCasterNames.caster1 : currentSelectedCasterNames.caster2;
        const currentValueInSelect = select.value; // Запоминаем текущее значение перед очисткой

        select.innerHTML = '<option value="">- Выбрать кастера -</option>'; // Опция по умолчанию

        allCasters.forEach(caster => {
            const option = document.createElement('option');
            option.value = caster.caster;
            option.textContent = caster.caster;
            option.dataset.social = caster.social || '';
            select.appendChild(option);
        });

        // Пытаемся установить сохраненное/загруженное значение
        if (valueToSelect && allCasters.some(c => c.caster === valueToSelect)) {
            select.value = valueToSelect;
        }
        // Если сохраненного значения нет или оно невалидно, пытаемся сохранить текущее значение из UI, если оно валидно
        else if (currentValueInSelect && allCasters.some(c => c.caster === currentValueInSelect)) {
             select.value = currentValueInSelect;
        }
        // Иначе остается дефолтное "- Выбрать кастера -"
        else {
             select.value = "";
        }

    });
    console.log("[Casters] Caster select elements populated/repopulated. Current names state:", currentSelectedCasterNames);
}

/**
 * Отображает список всех кастеров на странице с кнопками удаления.
 */
function displayCastersList() {
    if (!castersListContainerElement) {
        console.warn("[Casters] Casters list container (#castersListContainer) not found.");
        return;
    }
    castersListContainerElement.innerHTML = '';

    if (!allCasters || allCasters.length === 0) {
        if (castersListContainerElement.innerHTML === '') { // Показываем, только если нет сообщения об ошибке
             castersListContainerElement.innerHTML = '<p>Список кастеров пуст.</p>';
        }
        return;
    }

    const ul = document.createElement('ul');
    allCasters.forEach(caster => {
        if (!caster || !caster.id) return;

        const li = document.createElement('li');
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
        li.appendChild(detailsDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('caster-actions');
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteButton.classList.add('app-button', 'delete-caster-btn');
        deleteButton.title = `Удалить кастера ${caster.caster}`;
        deleteButton.addEventListener('click', () => handleDeleteCaster(caster.id, caster.caster));
        actionsDiv.appendChild(deleteButton);
        li.appendChild(actionsDiv);
        ul.appendChild(li);
    });
    castersListContainerElement.appendChild(ul);
    console.log("[Casters] Casters list has been displayed.");
}


/**
 * Обработчик отправки формы добавления нового кастера.
 */
async function handleAddCasterSubmit(event) {
    event.preventDefault();
    const name = newCasterNameInputElement.value.trim();
    const social = newCasterSocialInputElement.value.trim();

    if (!name) {
        alert("Имя кастера не может быть пустым.");
        newCasterNameInputElement.focus();
        return;
    }
    if (allCasters.some(c => c.caster.toLowerCase() === name.toLowerCase())) {
         alert(`Кастер с именем "${name}" уже существует.`);
         newCasterNameInputElement.focus();
         return;
    }

    setButtonState(addCasterButtonElement, 'saving', 'Добавление...');
    try {
        const newCasterData = { caster: name, social: social };
        const savedCaster = await saveData('/api/casters', newCasterData, 'POST');
        console.log('[Casters] New caster added response:', savedCaster);
        // После успешного добавления сервер отправит 'castersUpdate',
        // клиент его получит и вызовет updateCastersUIFromSocket,
        // поэтому явный loadCasters() здесь не обязателен, если сокет работает надежно.
        // await loadCasters(); // Можно раскомментировать для надежности

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

    if (caster1Name && caster2Name && caster1Name === caster2Name) {
        alert("Кастер 1 и Кастер 2 не могут быть одинаковыми.");
        return;
    }

    const dataToSave = {
        caster1: caster1Name || null,
        caster2: caster2Name || null,
    };

    console.log('[Casters] Saving selected casters:', dataToSave);
    setButtonState(saveSelectedCastersButtonElement, 'saving', 'Сохранение...');

    try {
        // Сервер вернет данные в новом формате { caster1, caster1soc, ... }
        const result = await saveData('/api/selected-casters', dataToSave, 'POST');
        // Обновляем локальное состояние имен (сервер сам отправит сокет с полными данными)
        currentSelectedCasterNames.caster1 = result.data.caster1 || null;
        currentSelectedCasterNames.caster2 = result.data.caster2 || null;
        setButtonState(saveSelectedCastersButtonElement, 'saved', 'Назначено!');
        console.log('[Casters] Selected casters saved successfully response:', result);
        // Явный вызов обновления UI после сохранения не нужен, т.к. придет сокет 'selectedCastersUpdate'
    } catch (error) {
        console.error('[Casters] Error saving selected casters:', error);
        setButtonState(saveSelectedCastersButtonElement, 'error', error.message || 'Ошибка сохранения');
        alert(`Ошибка назначения кастеров: ${error.message}`);
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
    const deleteButton = castersListContainerElement.querySelector(`button[title="Удалить кастера ${casterName}"]`);
    if (deleteButton) deleteButton.disabled = true;

    try {
        const response = await fetch(`/api/casters/${casterId}`, { method: 'DELETE' });
        if (!response.ok) {
            let errorMsg = `HTTP error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (e) { /* ignore */ }
            throw new Error(errorMsg);
        }
        console.log(`[Casters] Caster ${casterId} deleted successfully.`);
        // Обновление UI произойдет через сокеты 'castersUpdate' и 'selectedCastersUpdate' от сервера
    } catch (error) {
        console.error(`[Casters] Error deleting caster ${casterId}:`, error);
        alert(`Ошибка удаления кастера: ${error.message}`);
        if (deleteButton) deleteButton.disabled = false;
    }
}


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
        // Загружаем параллельно список всех кастеров и текущих выбранных
        await Promise.all([
             loadCasters(),
             loadSelectedCasters()
        ]);
         console.log("[Casters] Initial caster data loaded.");
    } catch(error) {
        console.error("[Casters] Error during initial data load:", error);
    }
    console.log("[Casters] Casters tab module initialized.");
}

/**
 * Обновляет UI списка кастеров при получении данных через Socket.IO.
 * @param {Array<Object>} updatedCastersData - Новый массив объектов кастеров.
 */
export function updateCastersUIFromSocket(updatedCastersData) {
    console.log("[Casters Socket] Received 'castersUpdate'. Updating UI.");
    allCasters = Array.isArray(updatedCastersData) ? updatedCastersData : [];
    populateCasterSelects(); // Перезаполняем селекты
    displayCastersList();    // Перерисовываем список
}

/**
 * Обновляет UI выбранных кастеров при получении данных через Socket.IO.
 * @param {Object} selectedCastersDataFromServer - Новый объект { caster1, caster1soc, caster2, caster2soc }.
 */
export function updateSelectedCastersUIFromSocket(selectedCastersDataFromServer) {
    console.log("[Casters Socket] Received 'selectedCastersUpdate'. Data:", selectedCastersDataFromServer);

    // Обновляем локальное состояние имен для консистентности
    currentSelectedCasterNames.caster1 = selectedCastersDataFromServer.caster1 || null;
    currentSelectedCasterNames.caster2 = selectedCastersDataFromServer.caster2 || null;

    // Устанавливаем значения в селектах
    if (caster1SelectElement) {
        caster1SelectElement.value = selectedCastersDataFromServer.caster1 || "";
    }
    if (caster2SelectElement) {
        caster2SelectElement.value = selectedCastersDataFromServer.caster2 || "";
    }

    // Здесь можно добавить код для отображения caster1soc и caster2soc в других элементах UI, если нужно
    // console.log("Selected Caster 1 Social:", selectedCastersDataFromServer.caster1soc);
    // console.log("Selected Caster 2 Social:", selectedCastersDataFromServer.caster2soc);
}