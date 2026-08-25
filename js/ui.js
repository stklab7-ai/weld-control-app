/**
 * ui.js — управление интерфейсом (форма, список заявок, модалки, тосты)
 */

// Цвета типов контроля
const TYPE_COLORS = {
  Вик: '#00FF88',
  Узк: '#FF6B6B',
  Рк: '#FFD93D',
  Цд: '#6C5CE7',
};

// Кэш DOM-элементов
const el = {};

function cacheElements() {
  el.requestsList = document.getElementById('requests-list');
  el.emptyState = document.getElementById('empty-state');
  el.searchInput = document.getElementById('search-input');
  el.filterBox = document.getElementById('filter-box');
  el.statusFilter = document.getElementById('status-filter');
  el.statTotal = document.getElementById('stat-total');
  el.cntVik = document.getElementById('cnt-vik');
  el.cntUzk = document.getElementById('cnt-uzk');
  el.cntRk = document.getElementById('cnt-rk');
  el.cntCd = document.getElementById('cnt-cd');

  el.form = document.getElementById('request-form');
  el.formTitle = document.getElementById('form-title');
  el.fObjectName = document.getElementById('f-objectName');
  el.fControlType = document.getElementById('f-controlType');
  el.fDescription = document.getElementById('f-description');
  el.fContactPerson = document.getElementById('f-contactPerson');
  el.fLatitude = document.getElementById('f-latitude');
  el.fLongitude = document.getElementById('f-longitude');
  el.fStatus = document.getElementById('f-status');
  el.fCreatedAt = document.getElementById('f-createdAt');
  el.fAuthor = document.getElementById('f-author');
  el.btnSubmit = document.getElementById('btn-submit');
  el.btnCancelEdit = document.getElementById('btn-cancel-edit');

  el.modalUser = document.getElementById('modal-user');
  el.inputUsername = document.getElementById('input-username');
  el.btnSaveUsername = document.getElementById('btn-save-username');
  el.userNameSpan = document.getElementById('user-name');
  el.btnChangeUser = document.getElementById('btn-change-user');

  el.modalConfirm = document.getElementById('modal-confirm');
  el.confirmText = document.getElementById('confirm-text');
  el.btnConfirmDelete = document.getElementById('btn-confirm-delete');
  el.btnCancelDelete = document.getElementById('btn-cancel-delete');

  el.toastContainer = document.getElementById('toast-container');
  el.mapHint = document.getElementById('map-hint');
}

/** Экранирование текста перед вставкой в innerHTML */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Форматирует ISO-дату в читаемый вид ДД.ММ.ГГГГ ЧЧ:MM */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
}

/** Возвращает иконку Font Awesome для типа контроля */
function typeIconClass(type) {
  const map = { Вик: 'fa-eye', Узк: 'fa-wave-square', Рк: 'fa-radiation', Цд: 'fa-magnifying-glass' };
  return map[type] || 'fa-tag';
}

/** Строит HTML одной карточки заявки */
function buildCardHtml(request, isActive) {
  const statusClass = 'st-' + request.status.toLowerCase().replace(/\s+/g, '-');
  const isApproved = request.approved === true;
  const isRejected = request.approved === false;
  
  let verdictHtml = '';
  if (isApproved) {
    verdictHtml = `<span class="verdict approved"><i class="fa-solid fa-check"></i> ГОДЕН</span>`;
  } else if (isRejected) {
    verdictHtml = `<span class="verdict rejected"><i class="fa-solid fa-xmark"></i> НЕ ГОДЕН</span>`;
  }

  return `
    <div class="request-card type-${escapeHtml(request.controlType)} ${isActive ? 'active' : ''} ${isApproved ? 'approved' : ''} ${isRejected ? 'rejected' : ''}" data-id="${request.id}">
      <div class="rc-top">
        <div>
          <p class="rc-title">${escapeHtml(request.objectName)}</p>
          <span class="rc-num">#${request.id}</span>
        </div>
        <button class="rc-del" data-id="${request.id}" title="Удалить заявку" type="button">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div class="rc-meta">
        <span class="rc-type-badge type-${escapeHtml(request.controlType)}">
          <i class="fa-solid ${typeIconClass(request.controlType)}"></i> ${escapeHtml(request.controlType)}
        </span>
        <span class="rc-status ${statusClass}">${escapeHtml(request.status)}</span>
        ${verdictHtml}
      </div>
      <div class="rc-date"><i class="fa-regular fa-clock"></i>${formatDate(request.createdAt)} · ${escapeHtml(request.author)}</div>
      <div class="rc-coords"><i class="fa-solid fa-location-dot"></i>${Number(request.latitude).toFixed(5)}, ${Number(request.longitude).toFixed(5)}</div>
      <div class="rc-actions">
        <button class="btn-vote btn-approve" data-id="${request.id}" type="button"><i class="fa-solid fa-check"></i> Годен</button>
        <button class="btn-vote btn-reject" data-id="${request.id}" type="button"><i class="fa-solid fa-xmark"></i> Не годен</button>
      </div>
    </div>
  `;
}

/**
 * Рендерит список заявок с учётом фильтров.
 */
function renderList(requests, filters, activeId) {
  const search = (filters.search || '').trim().toLowerCase();
  const filtered = requests.filter((r) => {
    const matchesSearch = !search || r.objectName.toLowerCase().includes(search);
    const matchesType = filters.types.has(r.controlType);
    const matchesStatus = !filters.status || r.status === filters.status;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Сортировка: годные вниз
  filtered.sort((a, b) => {
    if (a.approved === b.approved) return b.id - a.id;
    return a.approved ? 1 : -1;
  });

  if (filtered.length === 0) {
    el.requestsList.innerHTML = '';
    el.requestsList.appendChild(el.emptyState.cloneNode(true));
    if (requests.length > 0) {
      const empty = el.requestsList.querySelector('.empty-state p');
      if (empty) empty.innerHTML = 'Нет заявок, соответствующих фильтру.';
      const icon = el.requestsList.querySelector('.empty-state i');
      if (icon) icon.className = 'fa-solid fa-filter-circle-xmark';
    }
  } else {
    el.requestsList.innerHTML = filtered.map((r) => buildCardHtml(r, r.id === activeId)).join('');
  }

  updateCounters(requests);
  return filtered;
}

/** Обновляет счётчики заявок в шапке и левой панели */
function updateCounters(requests) {
  el.statTotal.textContent = requests.length;
  el.cntVik.textContent = requests.filter((r) => r.controlType === 'Вик').length;
  el.cntUzk.textContent = requests.filter((r) => r.controlType === 'Узк').length;
  el.cntRk.textContent = requests.filter((r) => r.controlType === 'Рк').length;
  el.cntCd.textContent = requests.filter((r) => r.controlType === 'Цд').length;
}

/** Собирает текущие значения формы в объект */
function getFormData() {
  return {
    objectName: el.fObjectName.value.trim(),
    controlType: el.fControlType.value,
    description: el.fDescription.value.trim(),
    contactPerson: el.fContactPerson.value.trim(),
    latitude: parseFloat(el.fLatitude.value),
    longitude: parseFloat(el.fLongitude.value),
    status: el.fStatus.value,
  };
}

/** Проверяет валидность формы */
function validateForm(data) {
  if (!data.objectName) {
    return { valid: false, message: 'Укажите название объекта' };
  }
  if (!data.controlType) {
    return { valid: false, message: 'Выберите тип контроля' };
  }
  if (isNaN(data.latitude) || isNaN(data.longitude)) {
    return { valid: false, message: 'Укажите точку на карте (координаты не заданы)' };
  }
  return { valid: true };
}

/** Заполняет форму данными существующей заявки */
function fillForm(request) {
  el.fObjectName.value = request.objectName;
  el.fControlType.value = request.controlType;
  el.fDescription.value = request.description || '';
  el.fContactPerson.value = request.contactPerson || '';
  el.fLatitude.value = request.latitude;
  el.fLongitude.value = request.longitude;
  el.fStatus.value = request.status;
  el.fCreatedAt.value = formatDate(request.createdAt);
  el.fAuthor.value = request.author;

  el.formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Редактирование заявки';
  el.btnSubmit.innerHTML = '<i class="fa-solid fa-rotate"></i> <span>Обновить заявку</span>';
  el.btnCancelEdit.style.display = 'flex';
}

/** Устанавливает координаты в форме */
function setFormCoords(lat, lng) {
  el.fLatitude.value = lat.toFixed(6);
  el.fLongitude.value = lng.toFixed(6);
}

/** Сбрасывает форму в режим "новая заявка" */
function resetForm(author) {
  el.form.reset();
  el.fLatitude.value = '';
  el.fLongitude.value = '';
  el.fCreatedAt.value = '—';
  el.fAuthor.value = author || '—';
  el.fStatus.value = 'Новая';
  el.fControlType.value = 'Вик';

  el.formTitle.innerHTML = '<i class="fa-solid fa-file-pen"></i> Новая заявка';
  el.btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> <span>Создать заявку</span>';
  el.btnCancelEdit.style.display = 'none';
}

/** Получает текущие фильтры из UI */
function getFilters() {
  const types = new Set();
  el.filterBox.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => types.add(cb.value));
  return {
    search: el.searchInput.value,
    types,
    status: el.statusFilter.value,
  };
}

/** Подсвечивает активную карточку */
function highlightCard(id) {
  document.querySelectorAll('.request-card').forEach((card) => {
    card.classList.toggle('active', Number(card.dataset.id) === id);
  });
}

/** Показывает модальное окно ввода имени пользователя */
function showUserModal(existingName) {
  el.inputUsername.value = existingName || '';
  el.modalUser.classList.add('show');
  setTimeout(() => el.inputUsername.focus(), 100);
}

function hideUserModal() {
  el.modalUser.classList.remove('show');
}

function setUserBadge(name) {
  el.userNameSpan.textContent = name;
}

/** Модалка подтверждения удаления */
let pendingDeleteId = null;
let deleteCallback = null;

function showConfirmDelete(request, onConfirm) {
  pendingDeleteId = request.id;
  deleteCallback = onConfirm;
  el.confirmText.textContent = `Заявка «${request.objectName}» (#${request.id}) будет удалена без возможности восстановления.`;
  el.modalConfirm.classList.add('show');
}

function hideConfirmDelete() {
  el.modalConfirm.classList.remove('show');
  pendingDeleteId = null;
  deleteCallback = null;
}

function bindConfirmDeleteButtons() {
  el.btnConfirmDelete.addEventListener('click', () => {
    if (deleteCallback && pendingDeleteId !== null) {
      deleteCallback(pendingDeleteId);
    }
    hideConfirmDelete();
  });
  el.btnCancelDelete.addEventListener('click', hideConfirmDelete);
}

/** Показывает тост-уведомление */
function showToast(message, type = 'info') {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  el.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function hideMapHint() {
  if (el.mapHint) el.mapHint.style.opacity = '0';
}

function showMapHint(text) {
  if (!el.mapHint) return;
  if (text) el.mapHint.querySelector('span').textContent = text;
  el.mapHint.style.opacity = '1';
}


// ===== ЭКСПОРТ =====
export const UI = {
  TYPE_COLORS,
  cacheElements,
  renderList,
  updateCounters,
  getFormData,
  validateForm,
  fillForm,
  setFormCoords,
  resetForm,
  getFilters,
  highlightCard,
  showUserModal,
  hideUserModal,
  setUserBadge,
  showConfirmDelete,
  hideConfirmDelete,
  bindConfirmDeleteButtons,
  showToast,
  hideMapHint,
  showMapHint,
  formatDate,
  get els() { return el; },
};