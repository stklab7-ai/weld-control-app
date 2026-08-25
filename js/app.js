/**
 * app.js — основная логика приложения "Сварочный контроль"
 *
 * Связывает вместе:
 *  - DataStore (js/data.js)  — хранение заявок
 *  - MapModule (js/map.js)   — карта Leaflet
 *  - UI (js/ui.js)           — интерфейс, форма, список, модалки
 *
 * Основной сценарий:
 *  1. Пользователь вводит имя (при первом запуске)
 *  2. Клик по карте создаёт/перемещает точку новой заявки
 *  3. Форма заполняется и заявка сохраняется в localStorage
 *  4. Список и карта синхронизируются с данными
 */

const App = (() => {
  let currentUser = null;
  let activeRequestId = null; // id заявки, выбранной в списке / редактируемой в форме
  let isCreatingNew = false; // true, если форма находится в режиме "новая заявка, ожидание клика по карте"

  /** Точка входа приложения */
  function init() {
    UI.cacheElements();

    // Инициализация карты (центр — Москва, если геолокация недоступна)
    MapModule.init('map', { center: [55.751244, 37.618423], zoom: 11 });

    MapModule.setHandlers({
      onMapClick: handleMapClick,
      onMarkerDragEnd: handleMarkerDragEnd,
      onMarkerDoubleClick: handleEditRequest,
      onEditFromPopup: handleEditRequest,
    });

    bindUIEvents();
    UI.bindConfirmDeleteButtons();

    checkUsername();
    refreshAll();

    console.log('[App] Приложение "Сварочный контроль" запущено');
  }

  /** Проверяет наличие сохранённого имени пользователя, иначе показывает модалку */
  function checkUsername() {
    const saved = DataStore.getUsername();
    if (saved) {
      currentUser = saved;
      UI.setUserBadge(saved);
    } else {
      UI.showUserModal();
    }
  }

  /** Привязывает обработчики к элементам интерфейса */
  function bindUIEvents() {
    const el = UI.els;

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

    // --- Список заявок (делегирование событий на карточках) ---
    el.requestsList.addEventListener('click', handleListClick);

    // --- Кнопки карты ---
    document.getElementById('btn-geo').addEventListener('click', handleGeoLocate);
    document.getElementById('btn-new-request').addEventListener('click', handleStartNewRequest);

    // --- Экспорт JSON ---
    document.getElementById('btn-export').addEventListener('click', handleExport);
  }

  /** Сохраняет имя пользователя из модалки */
  function saveUsername() {
    const name = UI.els.inputUsername.value.trim();
    if (!name) {
      UI.showToast('Введите имя, чтобы продолжить', 'error');
      return;
    }
    currentUser = name;
    DataStore.setUsername(name);
    UI.setUserBadge(name);
    UI.hideUserModal();
    UI.showToast(`Добро пожаловать, ${name}!`, 'success');
    // Обновляем поле "Автор" в форме, если она открыта
    UI.els.fAuthor.value = currentUser;
  }

  /** Перерисовывает список заявок и синхронизирует видимость маркеров на карте */
  function refreshList() {
    const requests = DataStore.getAll();
    const filters = UI.getFilters();
    const filtered = UI.renderList(requests, filters, activeRequestId);
    const visibleIds = new Set(filtered.map((r) => r.id));
    MapModule.setMarkerVisibility(requests, visibleIds);
  }

  /** Полное обновление: список + все маркеры на карте */
  function refreshAll() {
    const requests = DataStore.getAll();
    MapModule.renderAll(requests);
    refreshList();
  }

  // ==========================================================================
  // Обработчики карты
  // ==========================================================================

  /** Клик по карте в пустом месте */
  function handleMapClick(lat, lng) {
    if (activeRequestId !== null && !isCreatingNew) {
      // Есть активная заявка в режиме редактирования — обновляем её координаты
      const request = DataStore.getById(activeRequestId);
      if (request) {
        UI.setFormCoords(lat, lng);
        const updated = DataStore.update(activeRequestId, { latitude: lat, longitude: lng });
        if (updated) {
          MapModule.updateMarker(updated);
          UI.showToast('Координаты заявки обновлены', 'info');
        }
      }
      return;
    }

    // Иначе — начинаем создание новой заявки в этой точке
    isCreatingNew = true;
    activeRequestId = null;
    UI.resetForm(currentUser);
    UI.setFormCoords(lat, lng);
    UI.highlightCard(null);
    UI.hideMapHint();
    UI.showToast('Точка выбрана. Заполните форму заявки справа.', 'info');
  }

  /** Перетаскивание маркера завершено — обновляем координаты заявки */
  function handleMarkerDragEnd(id, lat, lng) {
    const updated = DataStore.update(id, { latitude: lat, longitude: lng });
    if (updated) {
      MapModule.updateMarker(updated);
      if (activeRequestId === id) {
        UI.setFormCoords(lat, lng);
      }
      refreshList();
      UI.showToast('Маркер перемещён, координаты сохранены', 'success');
    }
  }

  /** Клик "Мое местоположение" */
  function handleGeoLocate() {
    UI.showToast('Определяем местоположение...', 'info');
    MapModule.locateUser(
      () => UI.showToast('Карта отцентрирована на вашем местоположении', 'success'),
      (err) => UI.showToast('Не удалось получить геолокацию: ' + (err.message || 'ошибка'), 'error')
    );
  }

  /** Кнопка "Новая заявка" — просто напоминает кликнуть по карте */
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

  /** Отправка формы (создание или обновление заявки) */
  function handleFormSubmit(e) {
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
        const updated = DataStore.update(activeRequestId, data);
        if (updated) {
          MapModule.updateMarker(updated);
          UI.showToast('Заявка обновлена', 'success');
          refreshList();
        } else {
          UI.showToast('Не удалось найти заявку для обновления', 'error');
        }
      } else {
        // Режим создания
        const newRequest = DataStore.create({
          ...data,
          createdAt: new Date().toISOString(),
          author: currentUser || 'Неизвестный автор',
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

  /** Отмена редактирования — возврат формы в состояние "новая заявка" */
  function handleCancelEdit() {
    activeRequestId = null;
    isCreatingNew = false;
    UI.resetForm(currentUser);
    UI.highlightCard(null);
  }

  /** Открывает заявку в форме для редактирования (из карточки, попапа, dbl-click) */
  function handleEditRequest(id) {
    const request = DataStore.getById(id);
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

  /** Делегированный обработчик кликов по списку заявок */
  function handleListClick(e) {
    const delBtn = e.target.closest('.rc-del');
    if (delBtn) {
      e.stopPropagation();
      const id = Number(delBtn.dataset.id);
      const request = DataStore.getById(id);
      if (request) {
        UI.showConfirmDelete(request, handleDeleteRequest);
      }
      return;
    }

    const card = e.target.closest('.request-card');
    if (card) {
      const id = Number(card.dataset.id);
      handleEditRequest(id);
    }
  }

  /** Выполняет удаление заявки после подтверждения */
  function handleDeleteRequest(id) {
    const removed = DataStore.remove(id);
    if (removed) {
      MapModule.removeMarker(id);
      if (activeRequestId === id) {
        activeRequestId = null;
        isCreatingNew = false;
        UI.resetForm(currentUser);
      }
      refreshList();
      UI.showToast('Заявка удалена', 'success');
    } else {
      UI.showToast('Не удалось удалить заявку', 'error');
    }
  }

  // ==========================================================================
  // Экспорт данных
  // ==========================================================================

  /** Экспортирует все заявки в JSON-файл для скачивания */
  function handleExport() {
    try {
      const requests = DataStore.getAll();
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

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('[App] Критическая ошибка запуска приложения:', err);
    alert('Не удалось запустить приложение. Подробности в консоли разработчика (F12).');
  }
});
