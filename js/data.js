/**
 * data.js — работа с localStorage (CRUD для заявок и пользователя)
 *
 * Хранит:
 *  - "weld_requests"  — массив заявок
 *  - "weld_username"  — имя текущего пользователя
 *
 * Структура заявки:
 * {
 *   id: число,
 *   objectName: строка,
 *   controlType: "Вик" | "Узк" | "Рк" | "Цд",
 *   description: строка,
 *   contactPerson: строка,
 *   latitude: число,
 *   longitude: число,
 *   status: "Новая" | "В работе" | "Завершена",
 *   createdAt: строка (дата ISO),
 *   author: строка (имя пользователя)
 * }
 */

const DataStore = (() => {
  const STORAGE_KEY = 'weld_requests';
  const USER_KEY = 'weld_username';

  /**
   * Безопасно читает массив заявок из localStorage.
   * При повреждённых данных возвращает пустой массив и не роняет приложение.
   */
  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('[DataStore] Ошибка чтения заявок из localStorage:', err);
      return [];
    }
  }

  /** Сохраняет весь массив заявок */
  function saveAll(requests) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
      return true;
    } catch (err) {
      console.error('[DataStore] Ошибка сохранения заявок в localStorage:', err);
      return false;
    }
  }

  /** Возвращает заявку по id или null */
  function getById(id) {
    const requests = getAll();
    return requests.find((r) => r.id === id) || null;
  }

  /** Создаёт новую заявку, присваивает уникальный id, сохраняет и возвращает её */
  function create(data) {
    const requests = getAll();
    const newRequest = {
      id: Date.now(),
      objectName: (data.objectName || '').trim(),
      controlType: data.controlType,
      description: (data.description || '').trim(),
      contactPerson: (data.contactPerson || '').trim(),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      status: data.status || 'Новая',
      createdAt: data.createdAt || new Date().toISOString(),
      author: data.author || 'Неизвестный автор',
    };
    requests.push(newRequest);
    saveAll(requests);
    return newRequest;
  }

  /** Обновляет заявку по id, возвращает обновлённую заявку или null если не найдена */
  function update(id, patch) {
    const requests = getAll();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    requests[idx] = { ...requests[idx], ...patch };
    saveAll(requests);
    return requests[idx];
  }

  /** Удаляет заявку по id, возвращает true если удалена */
  function remove(id) {
    const requests = getAll();
    const filtered = requests.filter((r) => r.id !== id);
    const removed = filtered.length !== requests.length;
    if (removed) saveAll(filtered);
    return removed;
  }

  /** Возвращает имя пользователя или null */
  function getUsername() {
    try {
      return localStorage.getItem(USER_KEY);
    } catch (err) {
      console.error('[DataStore] Ошибка чтения имени пользователя:', err);
      return null;
    }
  }

  /** Сохраняет имя пользователя */
  function setUsername(name) {
    try {
      localStorage.setItem(USER_KEY, name);
      return true;
    } catch (err) {
      console.error('[DataStore] Ошибка сохранения имени пользователя:', err);
      return false;
    }
  }

  return {
    getAll,
    saveAll,
    getById,
    create,
    update,
    remove,
    getUsername,
    setUsername,
  };
})();
