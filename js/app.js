/**
 * app.js — основная логика приложения "Сварочный контроль"
 */

import { 
  loadFromFirebase,
  createInFirebase,
  updateInFirebase,
  removeFromFirebase,
  subscribeToFirebase,
  getAll,
  getById,
  getUsername,
  setUsername,
  authenticate,
  registerUser
} from './data.js';

const App = (() => {
  let currentUser = null;
  let activeRequestId = null;
  let isCreatingNew = false;

  /** Точка входа приложения */
  async function init() {
    UI.cacheElements();

    // Инициализация карты
    MapModule.init('map', { center: [55.751244, 37.618423], zoom: 11 });

    MapModule.setHandlers({
      onMapClick: handleMapClick,
      onMarkerDragEnd: handleMarkerDragEnd,
      onMarkerDoubleClick: handleEditRequest,
      onEditFromPopup: handleEditRequest,
    });

    bindUIEvents();
    UI.bindConfirmDeleteButtons();

    // Загрузка данных из Firebase
    try {
      await loadFromFirebase();
      UI.showToast('Данные загружены из облака', 'success');
    } catch (err) {
      UI.showToast('Используем локальные данные', 'info');
    }

    // Подписка на обновления в реальном времени
    subscribeToFirebase((requests) => {
      refreshAll();
      UI.showToast('Данные обновлены', 'info');
    });

    // Проверка входа
    checkLogin();

    console.log('[App] Приложение запущено с Firebase');
  }

  /** Проверяет, авторизован ли пользователь */
  function checkLogin() {
    const saved = sessionStorage.getItem('weld_logged_in');
    if (saved === 'true') {
      const username = getUsername();
      if (username) {
        currentUser = username;
        UI.setUserBadge(username);
        document.getElementById('modal-login').classList.remove('show');
        document.getElementById('app').style.display = 'flex';
        refreshAll();
        return;
      }
    }
    // Показываем модалку входа
    document.getElementById('modal-login').classList.add('show');
    document.getElementById('app').style.display = 'none';
  }

  /** Привязывает обработчики к элементам интерфейса */
  function bindUIEvents() {
    const el = UI.els;

    // --- Вход ---
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });

    // --- Модалка имени пользователя ---
    el.btnSaveUsername.addEventListener('click', saveUsername);
    el.inputUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveUsername();
    });
    el.btnChangeUser.addEventListener('click', () => UI.showUserModal(currentUser));

    // --- Поиск и фильтры ---
    el.searchInput.addEventListener('input', refreshList);
    el.filterBox.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', refreshList);
    });
    el.statusFilter.addEventListener('change', refreshList);

    // --- Форма заявки ---
    el.form.addEventListener('submit', handleFormSubmit);
    el.btnCancelEdit.addEventListener('click', handleCancelEdit);

    // --- Список заявок ---
    el.requestsList.addEventListener('click', handleListClick);

    // --- Кнопки карты ---
    document.getElementById('btn-geo').addEventListener('click', handleGeoLocate);
    document.getElementById('btn-new-request').addEventListener('click', handleStartNewRequest);

    // --- Экспорт JSON ---
    document.getElementById('btn-export').addEventListener('click', handleExport);
  }

  /** Обработчик входа */
  function handleLogin() {
    const login = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!login || !password) {
      UI.showToast('Введите логин и пароль', 'error');
      return;
    }

    const user = authenticate(login, password);
    if (user) {
      sessionStorage.setItem('weld_logged_in', 'true');
      setUsername(login);
      currentUser = login;
      UI.setUserBadge(login);
      document.getElementById('modal-login').classList.remove('show');
      document.getElementById('app').style.display = 'flex';
      UI.showToast(`Добро пожаловать, ${login}!`, 'success');
      refreshAll();
    } else {
      UI.showToast('Неверный логин или пароль', 'error');
    }
  }

  /** Сохраняет имя пользователя из модалки */
  function saveUsername() {
    const name = UI.els.inputUsername.value.trim();
    if (!name) {
      UI.showToast('Введите имя, чтобы продолжить', 'error');
      return;
    }
    currentUser = name;
    setUsername(name);
    UI.setUserBadge(name);
    UI.hideUserModal();
    UI.showToast(`Добро пожаловать, ${name}!`, 'success');
    UI.els.fAuthor.value = currentUser;
  }

  /** Перерисовывает список заявок */
  function refreshList() {
    const requests = getAll();
    const filters = UI.getFilters();
    const filtered = UI.renderList(requests, filters, activeRequestId);
    const visibleIds = new Set(filtered.map((r) => r.id));
    MapModule.setMarkerVisibility(requests, visibleIds);
  }

  /** Полное обновление */
  function refreshAll() {
    const requests = getAll();
    MapModule.renderAll(requests);
    refreshList();
  }

  // ==========================================================================
  // Обработчики карты
  // ==========================================================================

  function handleMapClick(lat, lng) {
    if (activeRequestId !== null && !isCreatingNew) {
      const request = getById(activeRequestId);
      if (request) {
        UI.setFormCoords(lat, lng);
        updateInFirebase(activeRequestId, { latitude: lat, longitude: lng });
        UI.showToast('Координаты заявки обновлены', 'info');
      }
      return;
    }

    isCreatingNew = true;
    activeRequestId = null;
    UI.resetForm(currentUser);
    UI.setFormCoords(lat, lng);
    UI.highlightCard(null);
    UI.hideMapHint();
    UI.showToast('Точка выбрана. Заполните форму заявки справа.', 'info');
  }

  function handleMarkerDragEnd(id, lat, lng) {
    updateInFirebase(id, { latitude: lat, longitude: lng });
    if (activeRequestId === id) {
      UI.setFormCoords(lat, lng);
    }
    refreshList();
    UI.showToast('Маркер перемещён, координаты сохранены', 'success');
  }

  function handleGeoLocate() {
    UI.showToast('Определяем местоположение...', 'info');
    MapModule.locateUser(
      () => UI.showToast('Карта отцентрирована на вашем местоположении', 'success'),
      (err) => UI.showToast('Не удалось получить геолокацию: ' + (err.message || 'ошибка'), 'error')
    );
  }

  function handleStartNewRequest() {
    isCreatingNew = true;
    activeRequestId = null;
    UI.resetForm(currentUser);
    UI.highlightCard(null);
    UI.showMapHint('Кликните по карте, чтобы указать точку контроля');
    UI.showToast('Кликните по карте для выбора точки новой заявки', 'info');
  }

  // ==========================================================================
  // Обработчики формы
  // ==========================================================================

  async function handleFormSubmit(e) {
    e.preventDefault();
    const data = UI.getFormData();
    const validation = UI.validateForm(data);

    if (!validation.valid) {
      UI.showToast(validation.message, 'error');
      return;
    }

    try {
      if (activeRequestId !== null && !isCreatingNew) {
        // Режим обновления
        await updateInFirebase(activeRequestId, data);
        UI.showToast('Заявка обновлена', 'success');
        refreshList();
      } else {
        // Режим создания
        const newRequest = await createInFirebase({
          ...data,
          createdAt: new Date().toISOString(),
          author: currentUser || 'Неизвестный автор',
          approved: null
        });
        MapModule.addMarker(newRequest);
        UI.showToast(`Заявка «${newRequest.objectName}» создана`, 'success');

        activeRequestId = newRequest.id;
        isCreatingNew = false;
        UI.fillForm(newRequest);
        refreshList();
        MapModule.focusOn(newRequest.id);
      }
    } catch (err) {
      console.error('[App] Ошибка сохранения заявки:', err);
      UI.showToast('Произошла ошибка при сохранении заявки', 'error');
    }
  }

  function handleCancelEdit() {
    activeRequestId = null;
    isCreatingNew = false;
    UI.resetForm(currentUser);
    UI.highlightCard(null);
  }

  function handleEditRequest(id) {
    const request = getById(id);
    if (!request) {
      UI.showToast('Заявка не найдена', 'error');
      return;
    }
    activeRequestId = id;
    isCreatingNew = false;
    UI.fillForm(request);
    UI.highlightCard(id);
    MapModule.focusOn(id);
  }

  // ==========================================================================
  // Обработчики списка заявок
  // ==========================================================================

  function handleListClick(e) {
    const delBtn = e.target.closest('.rc-del');
    if (delBtn) {
      e.stopPropagation();
      const id = String(delBtn.dataset.id);
      const request = getById(id);
      if (request) {
        UI.showConfirmDelete(request, handleDeleteRequest);
      }
      return;
    }

    // Кнопки "Годен" / "Не годен"
    const voteBtn = e.target.closest('.btn-vote');
    if (voteBtn) {
      e.stopPropagation();
      const id = String(voteBtn.dataset.id);
      const value = voteBtn.classList.contains('btn-approve');
      handleVoteClick(id, value);
      return;
    }

    const card = e.target.closest('.request-card');
    if (card) {
      const id = String(card.dataset.id);
      handleEditRequest(id);
    }
  }

  /** Обработчик голосования */
  async function handleVoteClick(id, value) {
    const request = getById(id);
    if (!request) return;

    try {
      await updateInFirebase(id, {
        approved: value,
        status: value ? 'Завершена' : 'В работе'
      });
      refreshList();
      UI.showToast(value ? '✅ Заявка признана ГОДНОЙ' : '❌ Заявка признана НЕ ГОДНОЙ', value ? 'success' : 'error');
    } catch (err) {
      UI.showToast('Ошибка при голосовании', 'error');
    }
  }

  /** Выполняет удаление заявки */
  async function handleDeleteRequest(id) {
    try {
      await removeFromFirebase(id);
      if (activeRequestId === id) {
        activeRequestId = null;
        isCreatingNew = false;
        UI.resetForm(currentUser);
      }
      refreshList();
      UI.showToast('Заявка удалена', 'success');
    } catch (err) {
      UI.showToast('Не удалось удалить заявку', 'error');
    }
  }

  // ==========================================================================
  // Экспорт данных
  // ==========================================================================

  function handleExport() {
    try {
      const requests = getAll();
      if (requests.length === 0) {
        UI.showToast('Нет заявок для экспорта', 'error');
        return;
      }
      const blob = new Blob([JSON.stringify(requests, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `weld_requests_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      UI.showToast('Файл заявок экспортирован', 'success');
    } catch (err) {
      console.error('[App] Ошибка экспорта:', err);
      UI.showToast('Ошибка при экспорте данных', 'error');
    }
  }

  return { init };
})();

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('[App] Критическая ошибка:', err);
    alert('Не удалось запустить приложение. Подробности в консоли (F12).');
  }
});