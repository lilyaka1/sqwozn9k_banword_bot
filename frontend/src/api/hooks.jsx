// React хуки для работы с API и Telegram WebApp

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as api from './client';

// ==================== CONTEXT ====================

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Инициализация при загрузке
  useEffect(() => {
    async function init() {
      try {
        // Инициализируем Telegram WebApp
        const tg = api.initTelegramWebApp();
        const tgUser = api.getTelegramUser();
        
        if (tgUser) {
          setUser(tgUser);
          
          // Авторизуемся на сервере
          const initData = api.getTelegramInitData();
          if (initData) {
            try {
              await api.authTelegram(initData);
              // Загружаем профиль игрока
              const playerData = await api.getPlayer(tgUser.id);
              setPlayer(playerData);
            } catch (e) {
              console.error('Auth error:', e);
              // Если сервер недоступен, создаём локального игрока
              setPlayer({
                telegram_id: tgUser.id,
                username: tgUser.username,
                first_name: tgUser.first_name,
                balance: 1000,
                ban_count: 0,
                is_banned: false,
              });
            }
          }
        } else {
          // Локальная разработка без Telegram
          const mockUser = {
            id: 12345678,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
          };
          setUser(mockUser);
          setPlayer({
            telegram_id: mockUser.id,
            username: mockUser.username,
            first_name: mockUser.first_name,
            balance: 1000,
            ban_count: 0,
            is_banned: false,
          });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    
    init();
  }, []);

  // Обновить баланс
  const updateBalance = useCallback(async (amount) => {
    if (!player) return;
    
    try {
      const updated = await api.updateBalance(player.telegram_id, amount);
      setPlayer(prev => ({ ...prev, ...updated }));
      return updated;
    } catch (e) {
      // Локальное обновление если сервер недоступен
      setPlayer(prev => ({
        ...prev,
        balance: prev.balance + amount,
      }));
    }
  }, [player]);

  // Сохранить результат игры
  const saveGameResult = useCallback(async (gameType, score) => {
    if (!player) return;
    
    try {
      await api.saveGameResult(player.telegram_id, gameType, score);
    } catch (e) {
      console.error('Failed to save game result:', e);
    }
  }, [player]);

  // Перезагрузить профиль
  const refreshPlayer = useCallback(async () => {
    if (!player) return;
    
    try {
      const updated = await api.getPlayer(player.telegram_id);
      setPlayer(updated);
    } catch (e) {
      console.error('Failed to refresh player:', e);
    }
  }, [player]);

  const value = {
    user,
    player,
    loading,
    error,
    updateBalance,
    saveGameResult,
    refreshPlayer,
    setPlayer,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// Хук для использования контекста пользователя
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}

// ==================== HOOKS ====================

// Хук для загрузки данных с сервера
export function useFetch(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refetch();
  }, deps);

  return { data, loading, error, refetch };
}

// Хук для получения статистики игрока
export function usePlayerStats(telegramId) {
  return useFetch(
    () => api.getPlayerStats(telegramId),
    [telegramId]
  );
}

// Хук для получения активного бана
export function useActiveBan(telegramId) {
  const { data, loading, error, refetch } = useFetch(
    () => api.getActiveBan(telegramId).catch(() => null),
    [telegramId]
  );

  const buyout = useCallback(async () => {
    try {
      await api.buyoutBan(telegramId);
      refetch();
      return true;
    } catch (e) {
      throw e;
    }
  }, [telegramId, refetch]);

  return { ban: data, loading, error, refetch, buyout };
}

// Хук для личных банвордов
export function usePersonalBanwords(telegramId) {
  const { data, loading, error, refetch } = useFetch(
    () => api.getPersonalBanwords(telegramId),
    [telegramId]
  );

  const addWord = useCallback(async (word) => {
    await api.addPersonalBanword(telegramId, word);
    refetch();
  }, [telegramId, refetch]);

  const removeWord = useCallback(async (word) => {
    await api.removePersonalBanword(telegramId, word);
    refetch();
  }, [telegramId, refetch]);

  return { words: data || [], loading, error, addWord, removeWord, refetch };
}

// ==================== ADMIN HOOKS ====================

// Хук для админской панели
export function useAdmin(password) {
  const [stats, setStats] = useState(null);
  const [players, setPlayers] = useState([]);
  const [globalBanwords, setGlobalBanwords] = useState([]);
  const [weeklyBanwords, setWeeklyBanwords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Загрузить всё
  const loadAll = useCallback(async () => {
    if (!password) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [statsData, playersData, globalData, weeklyData] = await Promise.all([
        api.getAdminStats(password),
        api.getAdminPlayers(password),
        api.getGlobalBanwords(password),
        api.getWeeklyBanwords(password),
      ]);
      
      setStats(statsData);
      setPlayers(playersData);
      setGlobalBanwords(globalData);
      setWeeklyBanwords(weeklyData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [password]);

  // Забанить игрока
  const banPlayer = useCallback(async (telegramId, reason) => {
    await api.banPlayer(password, telegramId, reason);
    loadAll();
  }, [password, loadAll]);

  // Разбанить игрока
  const unbanPlayer = useCallback(async (telegramId) => {
    await api.unbanPlayer(password, telegramId);
    loadAll();
  }, [password, loadAll]);

  // Добавить глобальный банворд
  const addGlobalBanword = useCallback(async (word) => {
    await api.addGlobalBanword(password, word);
    loadAll();
  }, [password, loadAll]);

  // Удалить глобальный банворд
  const removeGlobalBanword = useCallback(async (wordId) => {
    await api.removeGlobalBanword(password, wordId);
    loadAll();
  }, [password, loadAll]);

  // Добавить еженедельный банворд
  const addWeeklyBanword = useCallback(async (word, expiresAt) => {
    await api.addWeeklyBanword(password, word, expiresAt);
    loadAll();
  }, [password, loadAll]);

  // Удалить еженедельный банворд
  const removeWeeklyBanword = useCallback(async (wordId) => {
    await api.removeWeeklyBanword(password, wordId);
    loadAll();
  }, [password, loadAll]);

  return {
    stats,
    players,
    globalBanwords,
    weeklyBanwords,
    loading,
    error,
    loadAll,
    banPlayer,
    unbanPlayer,
    addGlobalBanword,
    removeGlobalBanword,
    addWeeklyBanword,
    removeWeeklyBanword,
  };
}

export default {
  UserProvider,
  useUser,
  useFetch,
  usePlayerStats,
  useActiveBan,
  usePersonalBanwords,
  useAdmin,
};
