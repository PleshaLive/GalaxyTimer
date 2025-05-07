// public/js/casters.js
import { saveData } from './api.js';
// Убедитесь, что setButtonState экспортируется из main.js или создайте ее здесь/в utils
import { setButtonState } from './main.js';

let allCasters = []; // Локальное хранилище списка всех кастеров
let currentSelectedCasters = { caster1: null, caster2: null }; // Локальное хранилище выбранных кастеров

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
        allCasters = []; // В случае ошибки, работаем с пустым списком
        if (castersListContainerElement) castersListContainerElement.innerHTML = '<p style="color: var(--color-error);">Не удалось загрузить список кастеров.</p>';
    }
    // Всегда обновляем UI, даже если загрузка не удалась (покажет пустые списки)
    populateCasterSelects();
    displayCastersList();
}

/**
 * Загружает текущих выбранных кастеров с сервера.
 */
export async function loadSelectedCasters() {
    console.log("[Casters] Attempting to load selected casters...");
    try {
        // Предполагается, что этот эндпоинт вернет объект вида { caster1: "Name", caster2: "Name" } или { caster1: null, caster2: null }
        const response = await fetch('/api/selected-casters'); 
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`HTTP error ${response.status}: ${errorData.message || 'Failed to fetch'}`);
        }
        const selected = await response.json();
        currentSelectedCasters = { 
            caster1: selected.caster1 || null, 
            caster2: selected.caster2 || null 
        };
        console.log("[Casters] Selected casters loaded successfully:", currentSelectedCasters);
    } catch (error) {
        console.error("[Casters] Failed to load selected casters:", error);
        currentSelectedCasters = { caster1: null, caster2: null }; // Сброс в случае ошибки
    }
    // Обновляем селекты после загрузки всех кастеров и выбранных
    // Важно вызывать populateCasterSelects после того, как и allCasters, и currentSelectedCasters загружены
    populateCasterSelects(); 
}


/**
 * Заполняет выпадающие списки (select) кастерами.
 */
function populateCasterSelects() {
    const selects = [caster1SelectElement, caster2SelectElement];
    
    // Сохраняем текущие выбранные значения перед очисткой, чтобы избежать сброса при обновлении списка
    const currentSelection = {
        caster1: selects[0]?.value,
        caster2: selects[1]?.value
    };

    selects.forEach((select, index) => {
        if (!select) return;
        
        // Определяем, какое значение должно быть выбрано для этого селекта
        // Приоритет: текущий выбор пользователя, если он валиден; затем сохраненное значение; затем пусто
        let valueToSelect = "";
        const currentUiValue = (index === 0) ? currentSelection.caster1 : currentSelection.caster2;
        const savedValue = (index === 0) ? currentSelectedCasters.caster1 : currentSelectedCasters.caster2;

        if (currentUiValue && allCasters.some(c => c.caster === currentUiValue)) {
            valueToSelect = currentUiValue; // Если текущее значение в UI валидно - оставляем его
        } else if (savedValue && allCasters.some(c => c.caster === savedValue)) {
            valueToSelect = savedValue; // Иначе пытаемся восстановить сохраненное
        }

        select.innerHTML = '<option value="">- Выбрать кастера -</option>'; // Опция по умолчанию

        allCasters.forEach(caster => {
            const option = document.createElement('option');
            option.value = caster.caster; // Используем имя кастера как значение
            option.textContent = caster.caster;
            option.dataset.social = caster.social || ''; // Сохраняем соц.сеть в data-атрибуте
            select.appendChild(option);
        });

        // Устанавливаем значение
        select.value = valueToSelect;

    });
    console.log("[Casters] Caster select elements populated/repopulated.");
}

/**
 * Отображает список всех кастеров на странице.
 */
function displayCastersList() {
    if (!castersListContainerElement) {
        console.warn("[Casters] Casters list container (#castersListContainer) not found.");
        return;
    }
    castersListContainerElement.innerHTML = ''; // Очищаем предыдущее содержимое

    if (!allCasters || allCasters.length === 0) {
        // Проверяем, была ли ошибка при загрузке (см. loadCasters)
        if (castersListContainerElement.innerHTML === '') { // Если сообщение об ошибке уже не показано
             castersListContainerElement.innerHTML = '<p>Список кастеров пуст.</p>';
        }
        return;
    }

    const ul = document.createElement('ul');
    allCasters.forEach(caster => {
        if (!caster || !caster.id) return; // Пропускаем невалидные записи

        const li = document.createElement('li');
        
        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('caster-details');

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('caster-name');
        nameSpan.textContent = caster.caster || 'Имя не указано'; // Запасной текст
        
        const socialSpan = document.createElement('span');
        socialSpan.classList.add('caster-social');
        socialSpan.textContent = ` (${caster.social || 'нет соц.сети'})`; // Показываем соц.сеть или заглушку

        detailsDiv.appendChild(nameSpan);
        detailsDiv.appendChild(socialSpan);
        li.appendChild(detailsDiv);

        // Кнопки действий (пока только удаление)
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('caster-actions');
        
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteButton.classList.add('app-button', 'delete-caster-btn'); // Используем классы для стилизации
        deleteButton.title = `Удалить кастера ${caster.caster}`;
        // Используем стрелочную функцию, чтобы передать параметры в обработчик
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
    event.preventDefault(); // Предотвращаем стандартную отправку формы
    const name = newCasterNameInputElement.value.trim();
    const social = newCasterSocialInputElement.value.trim();

    if (!name) {
        alert("Имя кастера не может быть пустым.");
        newCasterNameInputElement.focus();
        return;
    }
    // Поле соц.сети сделали опциональным в HTML, но можно добавить проверку здесь при необходимости
    // if (!social) {
    //     alert("Социальная сеть кастера не может быть пустой.");
    //     newCasterSocialInputElement.focus();
    //     return;
    // }

    // Проверка на дубликат имени на клиенте (опционально, т.к. сервер тоже проверяет)
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
        // После успешного добавления обновляем список с сервера
        await loadCasters(); 

        newCasterNameInputElement.value = ''; // Очищаем поля формы
        newCasterSocialInputElement.value = '';
        setButtonState(addCasterButtonElement, 'saved', 'Добавлено!');
    } catch (error) {
        console.error('[Casters] Error adding new caster:', error);
        // Оставляем состояние 'saving' ненадолго, чтобы пользователь видел ошибку
        setButtonState(addCasterButtonElement, 'error', error.message || 'Ошибка добавления');
        alert(`Ошибка добавления кастера: ${error.message}`);
    } 
    // Нет finally, т.к. setButtonState сама возвращает кнопку в idle через таймаут
}

/**
 * Обработчик нажатия кнопки "Назначить Кастеров".
 */
async function handleSaveSelectedCasters() {
    const caster1Name = caster1SelectElement.value;
    const caster2Name = caster2SelectElement.value;

    // Можно добавить доп. проверки, например, что кастеры разные, если нужно
    if (caster1Name && caster2Name && caster1Name === caster2Name) {
        alert("Кастер 1 и Кастер 2 не могут быть одинаковыми.");
        return;
    }

    const dataToSave = {
        caster1: caster1Name || null, // Отправляем null, если не выбрано
        caster2: caster2Name || null,
    };

    console.log('[Casters] Saving selected casters:', dataToSave);
    setButtonState(saveSelectedCastersButtonElement, 'saving', 'Сохранение...');
    
    try {
        const result = await saveData('/api/selected-casters', dataToSave, 'POST'); 
        // Обновляем локальное состояние выбранных кастеров
        currentSelectedCasters = { 
            caster1: result.data.caster1 || null, 
            caster2: result.data.caster2 || null 
        };
        setButtonState(saveSelectedCastersButtonElement, 'saved', 'Назначено!');
        console.log('[Casters] Selected casters saved successfully:', result);
    } catch (error) {
        console.error('[Casters] Error saving selected casters:', error);
        setButtonState(saveSelectedCastersButtonElement, 'error', error.message || 'Ошибка сохранения');
        alert(`Ошибка назначения кастеров: ${error.message}`);
    }
}

/**
 * Обработчик нажатия кнопки удаления кастера.
 * @param {string} casterId - ID удаляемого кастера.
 * @param {string} casterName - Имя удаляемого кастера (для подтверждения).
 */
async function handleDeleteCaster(casterId, casterName) {
    if (!confirm(`Вы уверены, что хотите удалить кастера "${casterName}" (ID: ${casterId})? Это действие необратимо.`)) {
        return;
    }
    console.log(`[Casters] Attempting to delete caster ${casterId}`);
    // Находим кнопку и блокируем ее на время удаления (если нужно)
    const deleteButton = castersListContainerElement.querySelector(`button[title="Удалить кастера ${casterName}"]`);
    if (deleteButton) deleteButton.disabled = true; 

    try {
        const response = await fetch(`/api/casters/${casterId}`, { method: 'DELETE' });
        if (!response.ok) {
            // Пытаемся извлечь сообщение об ошибке из ответа сервера
            let errorMsg = `HTTP error ${response.status}`;
            try { 
                const errorData = await response.json(); 
                errorMsg = errorData.message || errorMsg; 
            } catch (e) { /* Не удалось распарсить JSON ошибки */ }
            throw new Error(errorMsg);
        }
        console.log(`[Casters] Caster ${casterId} deleted successfully.`);
        // Обновляем список кастеров и выбранных кастеров с сервера после удаления
        // Сервер сам отправит обновления через сокеты 'castersUpdate' и 'selectedCastersUpdate'
        // Поэтому принудительный loadCasters/loadSelectedCasters здесь может быть излишним,
        // но можно оставить для надежности, если сокеты не используются или могут сбоить.
        // await loadCasters(); 
        // await loadSelectedCasters(); // Перезагружаем и выбранных, т.к. удаленный мог быть выбран
    } catch (error) {
        console.error(`[Casters] Error deleting caster ${casterId}:`, error);
        alert(`Ошибка удаления кастера: ${error.message}`);
        if (deleteButton) deleteButton.disabled = false; // Разблокируем кнопку в случае ошибки
    }
}


/**
 * Инициализация вкладки "Кастеры".
 * Вызывается при загрузке основного скрипта main.js.
 */
export async function initCasters() {
    console.log("[Casters] Initializing Casters tab module...");
    
    // Проверяем наличие элементов перед добавлением слушателей
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
        console.warn("[Casters] Casters list container (#castersListContainer) not found. List display will not work.");
    }

    // Асинхронно загружаем начальные данные
    // Используем Promise.all для параллельной загрузки, если они независимы
    try {
        await Promise.all([
             loadCasters(),          // Загружаем всех кастеров
             loadSelectedCasters()   // Загружаем выбранных кастеров
        ]);
         console.log("[Casters] Initial caster data loaded.");
    } catch(error) {
        console.error("[Casters] Error during initial data load:", error);
        // UI уже должен показать сообщения об ошибках внутри функций загрузки
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
    
    // Обновляем и селекты, и список
    populateCasterSelects(); 
    displayCastersList();    
}

/**
 * Обновляет UI выбранных кастеров при получении данных через Socket.IO.
 * @param {Object} selectedCastersData - Новый объект с выбранными кастерами ({ caster1: ..., caster2: ... }).
 */
export function updateSelectedCastersUIFromSocket(selectedCastersData) {
    console.log("[Casters Socket] Received 'selectedCastersUpdate'. Updating UI.");
    currentSelectedCasters = {
        caster1: selectedCastersData.caster1 || null,
        caster2: selectedCastersData.caster2 || null
    };
    // Обновляем только значения в селектах, т.к. список опций не менялся
    if (caster1SelectElement) {
        caster1SelectElement.value = currentSelectedCasters.caster1 || "";
    }
    if (caster2SelectElement) {
        caster2SelectElement.value = currentSelectedCasters.caster2 || "";
    }
}