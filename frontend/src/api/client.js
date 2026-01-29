// API клиент для связи с бэкендом

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Получаем токен из localStorage
const getToken = () => localStorage.getItem('token');

// Сохраняем токен
export const setToken = (token) => localStorage.setItem('token', token);

// Удаляем токен
export const removeToken = () => localStorage.removeItem('token');

// Базовый fetch с авторизацией
async function fetchAPI(endpoint, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(error.detail || 'API Error');
  }
  
  return response.json();
}

// ==================== AUTH ====================

// Авторизация через Telegram WebApp
export async function authTelegram(initData) {
  const data = await fetchAPI('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  });
  
  if (data.access_token) {
    setToken(data.access_token);
  }
  
  return data;
}

// Получить текущего пользователя
export async function getCurrentUser() {
  return fetchAPI('/auth/me');
}

// ==================== PLAYERS ====================

// Получить профиль игрока
export async function getPlayer(telegramId) {
  return fetchAPI(`/players/${telegramId}`);
}

// Обновить баланс игрока
export async function updateBalance(telegramId, amount) {
  return fetchAPI(`/players/${telegramId}/balance`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  });
}

// Сохранить результат игры
export async function saveGameResult(telegramId, gameType, score) {
  return fetchAPI(`/players/${telegramId}/games`, {
    method: 'POST',
    body: JSON.stringify({ game_type: gameType, score }),
  });
}

// Получить статистику игрока
export async function getPlayerStats(telegramId) {
  return fetchAPI(`/players/${telegramId}/stats`);
}

// Получить лидерборд
export async function getLeaderboard(limit = 20) {
  return fetchAPI(`/players/leaderboard?limit=${limit}`);
}

// ==================== BANS ====================

// Получить активный бан
export async function getActiveBan(telegramId) {
  return fetchAPI(`/players/${telegramId}/ban`);
}

// Выкупить бан
export async function buyoutBan(telegramId) {
  return fetchAPI(`/players/${telegramId}/ban/buyout`, {
    method: 'POST',
  });
}

// ==================== BANWORDS ====================

// Получить личные запрещённые слова
export async function getPersonalBanwords(telegramId) {
  return fetchAPI(`/players/${telegramId}/banwords`);
}

// Добавить личное запрещённое слово
export async function addPersonalBanword(telegramId, word) {
  return fetchAPI(`/players/${telegramId}/banwords`, {
    method: 'POST',
    body: JSON.stringify({ word }),
  });
}

// Удалить личное запрещённое слово
export async function removePersonalBanword(telegramId, word) {
  return fetchAPI(`/players/${telegramId}/banwords/${encodeURIComponent(word)}`, {
    method: 'DELETE',
  });
}

// ==================== ADMIN ====================

// Админские запросы требуют пароль в заголовке

async function adminFetch(endpoint, password, options = {}) {
  return fetchAPI(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'X-Admin-Password': password,
    },
  });
}

// Получить статистику
export async function getAdminStats(password) {
  return adminFetch('/admin/stats', password);
}

// Получить список игроков
export async function getAdminPlayers(password, skip = 0, limit = 50) {
  return adminFetch(`/admin/players?skip=${skip}&limit=${limit}`, password);
}

// Забанить игрока
export async function banPlayer(password, telegramId, reason) {
  return adminFetch(`/admin/players/${telegramId}/ban`, password, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// Разбанить игрока
export async function unbanPlayer(password, telegramId) {
  return adminFetch(`/admin/players/${telegramId}/unban`, password, {
    method: 'POST',
  });
}

// Сбросить баланс игрока
export async function resetPlayerBalance(password, telegramId) {
  return adminFetch(`/admin/players/${telegramId}/reset-balance`, password, {
    method: 'POST',
  });
}

// Получить глобальные банворды
export async function getGlobalBanwords(password) {
  return adminFetch('/admin/banwords', password);
}

// Добавить глобальный банворд
export async function addGlobalBanword(password, word) {
  return adminFetch('/admin/banwords', password, {
    method: 'POST',
    body: JSON.stringify({ word }),
  });
}

// Удалить глобальный банворд
export async function removeGlobalBanword(password, wordId) {
  return adminFetch(`/admin/banwords/${wordId}`, password, {
    method: 'DELETE',
  });
}

// Получить еженедельные банворды
export async function getWeeklyBanwords(password) {
  return adminFetch('/admin/banwords/weekly', password);
}

// Добавить еженедельный банворд
export async function addWeeklyBanword(password, word, expiresAt) {
  return adminFetch('/admin/banwords/weekly', password, {
    method: 'POST',
    body: JSON.stringify({ word, expires_at: expiresAt }),
  });
}

// Удалить еженедельный банворд
export async function removeWeeklyBanword(password, wordId) {
  return adminFetch(`/admin/banwords/weekly/${wordId}`, password, {
    method: 'DELETE',
  });
}

// ==================== TELEGRAM WEBAPP ====================

// Инициализация Telegram WebApp
export function initTelegramWebApp() {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    return tg;
  }
  return null;
}

// Получить данные пользователя из Telegram
export function getTelegramUser() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user;
  }
  return null;
}

// Получить initData для верификации
export function getTelegramInitData() {
  if (window.Telegram?.WebApp?.initData) {
    return window.Telegram.WebApp.initData;
  }
  return null;
}

// Показать popup
export function showTelegramPopup(title, message, buttons = [{ type: 'ok' }]) {
  if (window.Telegram?.WebApp?.showPopup) {
    return window.Telegram.WebApp.showPopup({ title, message, buttons });
  }
  alert(`${title}\n${message}`);
}

// Закрыть WebApp
export function closeTelegramWebApp() {
  if (window.Telegram?.WebApp?.close) {
    window.Telegram.WebApp.close();
  }
}

export default {
  authTelegram,
  getCurrentUser,
  getPlayer,
  updateBalance,
  saveGameResult,
  getPlayerStats,
  getActiveBan,
  buyoutBan,
  getPersonalBanwords,
  addPersonalBanword,
  removePersonalBanword,
  getAdminStats,
  getAdminPlayers,
  banPlayer,
  unbanPlayer,
  resetPlayerBalance,
  getGlobalBanwords,
  addGlobalBanword,
  removeGlobalBanword,
  getWeeklyBanwords,
  addWeeklyBanword,
  removeWeeklyBanword,
  initTelegramWebApp,
  getTelegramUser,
  getTelegramInitData,
  showTelegramPopup,
  closeTelegramWebApp,
};
