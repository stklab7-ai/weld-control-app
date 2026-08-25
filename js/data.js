/**
 * data.js — работа с данными (Firebase + localStorage)
 */

import { 
  requestsCollection,
  usersCollection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc
} from './firebase.js';

const STORAGE_KEY = 'weld_requests';
const USER_KEY = 'weld_username';
const USERS_KEY = 'weld_users';

// ===== LOCALSTORAGE (кеш) =====
function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(requests) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    return true;
  } catch {
    return false;
  }
}

function getById(id) {
  const requests = getAll();
  return requests.find((r) => r.id === id) || null;
}

// ===== FIREBASE (облако) =====

/** Загружает все заявки из Firebase */
async function loadFromFirebase() {
  try {
    const q = query(requestsCollection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    saveAll(requests);
    return requests;
  } catch (err) {
    console.error('[Firebase] Ошибка загрузки:', err);
    return [];
  }
}

/** Создаёт заявку в Firebase */
async function createInFirebase(data) {
  try {
    const docRef = await addDoc(requestsCollection, {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
      approved: data.approved !== undefined ? data.approved : null
    });
    const newRequest = { id: docRef.id, ...data };
    const requests = getAll();
    requests.push(newRequest);
    saveAll(requests);
    return newRequest;
  } catch (err) {
    console.error('[Firebase] Ошибка создания:', err);
    throw err;
  }
}

/** Обновляет заявку в Firebase */
async function updateInFirebase(id, patch) {
  try {
    const docRef = doc(requestsCollection, id);
    await updateDoc(docRef, patch);
    const requests = getAll();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      requests[idx] = { ...requests[idx], ...patch };
      saveAll(requests);
    }
    return { id, ...patch };
  } catch (err) {
    console.error('[Firebase] Ошибка обновления:', err);
    throw err;
  }
}

/** Удаляет заявку из Firebase */
async function removeFromFirebase(id) {
  try {
    const docRef = doc(requestsCollection, id);
    await deleteDoc(docRef);
    const requests = getAll().filter((r) => r.id !== id);
    saveAll(requests);
    return true;
  } catch (err) {
    console.error('[Firebase] Ошибка удаления:', err);
    return false;
  }
}

/** Подписка на обновления в реальном времени */
function subscribeToFirebase(callback) {
  const q = query(requestsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const requests = [];
    snapshot.forEach((doc) => {
      requests.push({ id: doc.id, ...doc.data() });
    });
    saveAll(requests);
    if (callback) callback(requests);
  }, (error) => {
    console.error('[Firebase] Ошибка подписки:', error);
  });
}

// ============================================================
// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (Firebase + localStorage) =====
// ============================================================

/** Загружает пользователей из Firebase */
async function loadUsersFromFirebase() {
  try {
    const snapshot = await getDocs(usersCollection);
    const users = {};
    snapshot.forEach((doc) => {
      users[doc.id] = doc.data();
    });
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return users;
  } catch (err) {
    console.error('[Firebase] Ошибка загрузки пользователей:', err);
    return getUsersLocal();
  }
}

/** Получает пользователей из localStorage */
function getUsersLocal() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const defaultUsers = { 
        admin: { password: 'admin123', role: 'admin' }
      };
      saveUsersLocal(defaultUsers);
      return defaultUsers;
    }
    return JSON.parse(raw);
  } catch { 
    return { admin: { password: 'admin123', role: 'admin' } };
  }
}

/** Сохраняет пользователей в localStorage */
function saveUsersLocal(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Сохраняет пользователя в Firebase */
async function saveUserToFirebase(login, data) {
  try {
    await setDoc(doc(usersCollection, login), data);
    const users = getUsersLocal();
    users[login] = data;
    saveUsersLocal(users);
    return true;
  } catch (err) {
    console.error('[Firebase] Ошибка сохранения пользователя:', err);
    return false;
  }
}

/** Удаляет пользователя из Firebase */
async function deleteUserFromFirebase(login) {
  try {
    await deleteDoc(doc(usersCollection, login));
    const users = getUsersLocal();
    delete users[login];
    saveUsersLocal(users);
    return true;
  } catch (err) {
    console.error('[Firebase] Ошибка удаления пользователя:', err);
    return false;
  }
}

/** Аутентификация пользователя (сначала Firebase, потом localStorage) */
async function authenticateUser(login, password) {
  try {
    const users = await loadUsersFromFirebase();
    if (users[login] && users[login].password === password) {
      return users[login];
    }
    return null;
  } catch (err) {
    console.warn('[Auth] Firebase недоступен, проверяем локально');
    const users = getUsersLocal();
    if (users[login] && users[login].password === password) {
      return users[login];
    }
    return null;
  }
}

/** Регистрация нового пользователя */
async function registerUserInFirebase(login, password, role = 'user') {
  try {
    const users = await loadUsersFromFirebase();
    if (users[login]) return false;
    await saveUserToFirebase(login, { password, role });
    return true;
  } catch (err) {
    console.error('[Firebase] Ошибка регистрации:', err);
    return false;
  }
}

/** Подписка на обновления пользователей в реальном времени */
function subscribeToUsers(callback) {
  return onSnapshot(usersCollection, (snapshot) => {
    const users = {};
    snapshot.forEach((doc) => {
      users[doc.id] = doc.data();
    });
    saveUsersLocal(users);
    if (callback) callback(users);
  }, (error) => {
    console.error('[Firebase] Ошибка подписки на пользователей:', error);
  });
}

/** Получить всех пользователей (асинхронно) */
async function getAllUsers() {
  try {
    return await loadUsersFromFirebase();
  } catch {
    return getUsersLocal();
  }
}

// ===== СТАРЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ =====
function getUsers() { return getUsersLocal(); }
function saveUsers(users) { saveUsersLocal(users); }
function authenticate(login, password) {
  const users = getUsersLocal();
  if (users[login] && users[login].password === password) {
    return users[login];
  }
  return null;
}
function registerUser(login, password, role = 'user') {
  const users = getUsersLocal();
  if (users[login]) return false;
  users[login] = { password, role };
  saveUsersLocal(users);
  saveUserToFirebase(login, { password, role }).catch(console.error);
  return true;
}

function getUsername() {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function setUsername(name) {
  try {
    localStorage.setItem(USER_KEY, name);
    return true;
  } catch {
    return false;
  }
}

// ===== ЭКСПОРТ =====
export {
  // localStorage
  getAll,
  saveAll,
  getById,
  // Firebase
  loadFromFirebase,
  createInFirebase,
  updateInFirebase,
  removeFromFirebase,
  subscribeToFirebase,
  // Пользователи (новые)
  loadUsersFromFirebase,
  getUsersLocal,
  saveUsersLocal,
  saveUserToFirebase,
  deleteUserFromFirebase,
  authenticateUser,
  registerUserInFirebase,
  subscribeToUsers,
  getAllUsers,
  // Старые (для совместимости)
  getUsers,
  saveUsers,
  authenticate,
  registerUser,
  getUsername,
  setUsername
};