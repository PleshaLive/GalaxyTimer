// public/js/observers.js
import { saveData } from './api.js';
import { setButtonState } from './main.js';

let allObservers = [];
let currentSelectedObserverName = null;

const addObserverFormElement = document.getElementById('addObserverForm');
const newObserverNameInputElement = document.getElementById('newObserverName');
const newObserverSocialInputElement = document.getElementById('newObserverSocial');
const addObserverButtonElement = document.getElementById('addObserverButton');
const observersListContainerElement = document.getElementById('observersListContainer');
const observerSelectElement = document.getElementById('observerSelect');
const saveSelectedObserverButtonElement = document.getElementById('saveSelectedObserverButton');

export async function loadObservers() {
  console.log('[Observers] Loading observers...');
  try {
    const resp = await fetch('/api/observers');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    allObservers = await resp.json();
  } catch (e) {
    console.error('[Observers] Failed to load:', e);
    allObservers = [];
    if (observersListContainerElement)
      observersListContainerElement.innerHTML = '<p style="color: var(--color-error);">Не удалось загрузить список observers.</p>';
  }
  populateObserverSelect();
  displayObserversList();
}

export async function loadSelectedObserver() {
  console.log('[Observers] Loading selected observer...');
  try {
    const resp = await fetch('/api/selected-observer');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arr = await resp.json();
    const data = Array.isArray(arr) && arr[0] ? arr[0] : { observer: null };
    currentSelectedObserverName = data.observer || null;
  } catch (e) {
    console.error('[Observers] Failed to load selected observer:', e);
    currentSelectedObserverName = null;
  }
  populateObserverSelect();
}

function populateObserverSelect() {
  if (!observerSelectElement) return;
  const prev = observerSelectElement.value;
  const candidates = allObservers.map(o => o.observer);
  let toSelect = '';
  if (prev && candidates.includes(prev)) toSelect = prev;
  else if (currentSelectedObserverName && candidates.includes(currentSelectedObserverName)) toSelect = currentSelectedObserverName;
  observerSelectElement.innerHTML = '<option value="">- Выбрать observer -</option>';
  allObservers.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.observer;
    opt.textContent = o.observer;
    observerSelectElement.appendChild(opt);
  });
  observerSelectElement.value = toSelect;
}

function displayObserversList() {
  if (!observersListContainerElement) return;
  observersListContainerElement.innerHTML = '';
  if (!allObservers.length) {
    observersListContainerElement.innerHTML = '<p>Список observers пуст.</p>';
    return;
  }
  const ul = document.createElement('ul');
  allObservers.forEach(o => {
    if (!o || !o.id) return;
    const li = document.createElement('li');
    li.dataset.observerId = o.id;
    li.dataset.originalName = o.observer;
    li.dataset.originalSocial = o.social || '';

    createObserverDisplayMode(li, o);
    ul.appendChild(li);
  });
  observersListContainerElement.appendChild(ul);
}

function createObserverDisplayMode(li, observer) {
  li.innerHTML = '';
  li.classList.remove('editing');
  const detailsDiv = document.createElement('div');
  detailsDiv.classList.add('caster-details');
  const nameSpan = document.createElement('span');
  nameSpan.classList.add('caster-name');
  nameSpan.textContent = observer.observer || 'Имя не указано';
  const socialSpan = document.createElement('span');
  socialSpan.classList.add('caster-social');
  socialSpan.textContent = ` (${observer.social || 'нет соц.сети'})`;
  detailsDiv.appendChild(nameSpan);
  detailsDiv.appendChild(socialSpan);

  const actionsDiv = document.createElement('div');
  actionsDiv.classList.add('caster-actions');
  const editButton = document.createElement('button');
  editButton.innerHTML = '<i class="fas fa-edit"></i>';
  editButton.classList.add('app-button', 'edit-caster-btn');
  editButton.title = `Редактировать observer ${observer.observer}`;
  editButton.addEventListener('click', () => toggleEditMode(li, true));

  const deleteButton = document.createElement('button');
  deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
  deleteButton.classList.add('app-button', 'delete-caster-btn');
  deleteButton.title = `Удалить observer ${observer.observer}`;
  deleteButton.addEventListener('click', () => handleDeleteObserver(observer.id, observer.observer));

  actionsDiv.appendChild(editButton);
  actionsDiv.appendChild(deleteButton);
  li.appendChild(detailsDiv);
  li.appendChild(actionsDiv);
}

function createObserverEditMode(li) {
  li.innerHTML = '';
  li.classList.add('editing');

  const originalName = li.dataset.originalName;
  const originalSocial = li.dataset.originalSocial;

  const detailsDiv = document.createElement('div');
  detailsDiv.classList.add('caster-details');
  detailsDiv.innerHTML = `
    <input type="text" class="edit-input caster-name-input" value="${originalName}" placeholder="Имя" required>
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
    handleSaveObserverEdit(li.dataset.observerId, newNameInput.value.trim(), newSocialInput.value.trim(), li, saveButton);
  });

  const cancelButton = document.createElement('button');
  cancelButton.innerHTML = '<i class="fas fa-times"></i>';
  cancelButton.classList.add('app-button', 'cancel-caster-btn');
  cancelButton.title = 'Отменить';
  cancelButton.addEventListener('click', () => toggleEditMode(li, false));

  actionsDiv.appendChild(saveButton);
  actionsDiv.appendChild(cancelButton);
  li.appendChild(detailsDiv);
  li.appendChild(actionsDiv);
  detailsDiv.querySelector('.caster-name-input')?.focus();
}

function toggleEditMode(li, isEditing) {
  if (isEditing) {
    createObserverEditMode(li);
  } else {
    const id = li.dataset.observerId;
    const obs = allObservers.find(o => o.id === id) || {
      id,
      observer: li.dataset.originalName,
      social: li.dataset.originalSocial
    };
    createObserverDisplayMode(li, obs);
  }
}

async function handleAddObserverSubmit(e) {
  e.preventDefault();
  const name = newObserverNameInputElement.value.trim();
  const social = newObserverSocialInputElement.value.trim();
  if (!name) return;
  if (allObservers.some(o => o.observer.toLowerCase() === name.toLowerCase())) return;
  setButtonState(addObserverButtonElement, 'saving', 'Добавление...');
  try {
    await saveData('/api/observers', { observer: name, social }, 'POST');
    newObserverNameInputElement.value = '';
    newObserverSocialInputElement.value = '';
    setButtonState(addObserverButtonElement, 'saved', 'Добавлено!');
  } catch (e) {
    console.error('[Observers] Add failed:', e);
    setButtonState(addObserverButtonElement, 'error', e.message || 'Ошибка');
    alert(`Ошибка добавления observer: ${e.message}`);
  }
}

async function handleSaveObserverEdit(id, newName, newSocial, li, saveButton) {
  if (!newName) return;
  const originalName = li.dataset.originalName;
  const originalSocial = li.dataset.originalSocial;
  if (newName === originalName && newSocial === originalSocial) { toggleEditMode(li, false); return; }
  if (newName.toLowerCase() !== originalName.toLowerCase() && allObservers.some(o => o.id !== id && o.observer.toLowerCase() === newName.toLowerCase())) return;
  setButtonState(saveButton, 'saving');
  try {
    await saveData(`/api/observers/${id}`, { observer: newName, social: newSocial }, 'PUT');
    li.dataset.originalName = newName;
    li.dataset.originalSocial = newSocial;
    toggleEditMode(li, false);
  } catch (e) {
    console.error('[Observers] Update failed:', e);
    setButtonState(saveButton, 'error', 'Ошибка');
    alert(`Ошибка обновления observer: ${e.message}`);
    setTimeout(() => setButtonState(saveButton, 'idle'), 2000);
  }
}

async function handleDeleteObserver(id, name) {
  if (!confirm(`Удалить observer "${name}"?`)) return;
  const li = observersListContainerElement.querySelector(`li[data-observer-id="${id}"]`);
  const btn = li?.querySelector('.delete-caster-btn');
  if (btn) btn.disabled = true;
  try {
    const resp = await fetch(`/api/observers/${id}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  } catch (e) {
    console.error('[Observers] Delete failed:', e);
    alert(`Ошибка удаления observer: ${e.message}`);
    if (btn) btn.disabled = false;
  }
}

export function updateObserversUIFromSocket(updatedObservers) {
  console.log('[Observers Socket] Received observersUpdate:', updatedObservers);
  allObservers = Array.isArray(updatedObservers) ? updatedObservers : [];
  populateObserverSelect();
  displayObserversList();
}

export function updateSelectedObserverUIFromSocket(selected) {
  console.log('[Observers Socket] Received selectedObserverUpdate:', selected);
  currentSelectedObserverName = selected?.observer || null;
  if (observerSelectElement) observerSelectElement.value = currentSelectedObserverName || '';
}

export function initObservers() {
  console.log('[Observers] Initializing observers module...');
  if (addObserverFormElement) addObserverFormElement.addEventListener('submit', handleAddObserverSubmit);
  else console.warn('[Observers] Add form not found');
  if (saveSelectedObserverButtonElement) {
    saveSelectedObserverButtonElement.addEventListener('click', async () => {
      const name = observerSelectElement?.value || null;
      if (name && !allObservers.some(o => o.observer === name)) return;
      setButtonState(saveSelectedObserverButtonElement, 'saving', 'Сохранение...');
      try {
        const result = await saveData('/api/selected-observer', { observer: name }, 'POST');
        currentSelectedObserverName = result.data?.observer || name || null;
        setButtonState(saveSelectedObserverButtonElement, 'saved', 'Назначено!');
      } catch (e) {
        console.error('[Observers] Save selected failed:', e);
        setButtonState(saveSelectedObserverButtonElement, 'error', e.message || 'Ошибка');
        alert(`Ошибка назначения observer: ${e.message}`);
      }
    });
  } else {
    console.warn('[Observers] Save selected observer button not found');
  }
  Promise.all([loadObservers(), loadSelectedObserver()]).then(() => console.log('[Observers] Data loaded.'));
}
