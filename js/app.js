/**
 * app.js — основная логика приложения "Сварочный контроль"
 */

// ===== ИМПОРТЫ =====
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
  registerUser,
  loadUsersFromFirebase,
  subscribeToUsers,
  getAllUsers,
  saveUserToFirebase,
  deleteUserFromFirebase,
  authenticateUser
} from './data.js';

import { UI } from './ui.js';

const App = (() => {
  let currentUser = null;
  let activeRequestId = null;
  let isCreatingNew = false;

  /** Точка входа приложения */
  async function init() {
    UI.cacheElements();
    bindUIEvents();
    UI.bindConfirmDeleteButtons();

    // Загрузка пользователей из Firebase
    try {
      await loadUsersFromFirebase();
      console.log('[App] Пользователи загружены из Firebase');
    } catch (err) {
      console.warn('[App] Используем локальных пользователей');
    }

    // Подписка на обновления пользователей
    subscribeToUsers((users) => {
      console.log('[App] Пользователи обновлены:', Object.keys(users));
    });

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

    // --- Экспорт JSON ---
    document.getElementById('btn-export').addEventListener('click', handleExport);

    // --- Админ-панель ---
    document.getElementById('btn-admin').addEventListener('click', openAdminPanel);
    document.getElementById('admin-add-user').addEventListener('click', adminAddUser);
    document.getElementById('admin-close').addEventListener('click', () => {
      document.getElementById('modal-admin').classList.remove('show');
    });
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
    UI.renderList(requests, filters, activeRequestId);
  }

  /** Полное обновление */
  function refreshAll() {
    refreshList();
  }

  // ==========================================================================
  // АДМИН-ПАНЕЛЬ
  // ==========================================================================

  function openAdminPanel() {
    renderUsersList();
    document.getElementById('modal-admin').classList.add('show');
  }

  function renderUsersList() {
    const users = JSON.parse(localStorage.getItem('weld_users') || '{}');
    const container = document.getElementById('admin-users-list');
    
    if (Object.keys(users).length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-faint);padding:20px;">Нет пользователей</p>';
      return;
    }
    
    container.innerHTML = Object.entries(users).map(([login, data]) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid var(--panel-border);">
        <div>
          <strong>${login}</strong> 
          <span style="color:var(--text-dim); font-size:11px;">(${data.role || 'user'})</span>
        </div>
        <button class="btn-admin-delete" data-login="${login}" style="background:none; border:none; color:var(--color-uzk); cursor:pointer; padding:4px 8px; border-radius:4px; transition:all 0.2s;">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
    
    // Обработчики удаления
    container.querySelectorAll('.btn-admin-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const login = btn.dataset.login;
        if (login === 'admin') {
          UI.showToast('Нельзя удалить администратора', 'error');
          return;
        }
        if (confirm(`Удалить пользователя ${login}?`)) {
          const success = await deleteUserFromFirebase(login);
          if (success) {
            renderUsersList();
            UI.showToast(`Пользователь ${login} удалён`, 'success');
          } else {
            UI.showToast('Ошибка удаления пользователя', 'error');
          }
        }
      });
    });
  }

  async function adminAddUser() {
    const login = document.getElementById('admin-new-login').value.trim();
    const password = document.getElementById('admin-new-password').value.trim();
    const role = document.getElementById('admin-new-role').value;
    
    if (!login || !password) {
      UI.showToast('Введите логин и пароль', 'error');
      return;
    }
    
    if (login.length < 3) {
      UI.showToast('Логин должен быть не менее 3 символов', 'error');
      return;
    }
    
    const success = await saveUserToFirebase(login, { password, role });
    if (success) {
      document.getElementById('admin-new-login').value = '';
      document.getElementById('admin-new-password').value = '';
      renderUsersList();
      UI.showToast(`Пользователь ${login} добавлен`, 'success');
    } else {
      UI.showToast('Ошибка добавления пользователя', 'error');
    }
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

    if (isNaN(data.latitude) || data.latitude === 0 || data.latitude === null || data.latitude === undefined) {
      data.latitude = 55.751244;
    }
    if (isNaN(data.longitude) || data.longitude === 0 || data.longitude === null || data.longitude === undefined) {
      data.longitude = 37.618423;
    }

    try {
      if (activeRequestId !== null && !isCreatingNew) {
        await updateInFirebase(activeRequestId, data);
        UI.showToast('Заявка обновлена', 'success');
        refreshList();
      } else {
        const newRequest = await createInFirebase({
          ...data,
          createdAt: new Date().toISOString(),
          author: currentUser || 'Неизвестный автор',
          approved: null
        });
        UI.showToast(`Заявка «${newRequest.objectName}» создана`, 'success');

        activeRequestId = newRequest.id;
        isCreatingNew = false;
        UI.fillForm(newRequest);
        refreshList();
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