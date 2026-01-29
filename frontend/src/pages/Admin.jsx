import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/client'
import styles from './Admin.module.css'

// Пароль для админки
const ADMIN_PASSWORD = 'alabama2024'
const AUTH_KEY = 'admin_auth'

// Настройки игр по умолчанию
const DEFAULT_GAME_SETTINGS = {
  horseRacing: { enabled: true, minBet: 50, maxBet: 1000, multipliers: { degenerate: 2, addict: 5, psycho: 10 } },
  slots: { enabled: true, minBet: 10, maxBet: 500 },
  blockBlast: { enabled: true },
  roverSmash: { enabled: true, gameDuration: 30 },
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // Data states from API
  const [stats, setStats] = useState(null)
  const [players, setPlayers] = useState([])
  const [globalBanwords, setGlobalBanwords] = useState([])
  const [weeklyBanwords, setWeeklyBanwords] = useState([])
  const [newGlobalWord, setNewGlobalWord] = useState('')
  const [newWeeklyWord, setNewWeeklyWord] = useState('')
  const [newWeeklyExpires, setNewWeeklyExpires] = useState('')
  
  // Local settings (still stored in localStorage)
  const [gameSettings, setGameSettings] = useState(() => {
    const saved = localStorage.getItem('admin_game_settings')
    return saved ? JSON.parse(saved) : DEFAULT_GAME_SETTINGS
  })
  const [balanceSettings, setBalanceSettings] = useState(() => {
    const saved = localStorage.getItem('admin_balance_settings')
    return saved ? JSON.parse(saved) : { startBalance: 1000, dailyBonus: 100 }
  })

  // Check auth on mount
  useEffect(() => {
    const auth = sessionStorage.getItem(AUTH_KEY)
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  // Load data when authenticated
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return
    
    setLoading(true)
    try {
      const [statsData, playersData, globalData, weeklyData] = await Promise.all([
        api.getAdminStats(ADMIN_PASSWORD).catch(() => null),
        api.getAdminPlayers(ADMIN_PASSWORD).catch(() => []),
        api.getGlobalBanwords(ADMIN_PASSWORD).catch(() => []),
        api.getWeeklyBanwords(ADMIN_PASSWORD).catch(() => []),
      ])
      
      if (statsData) setStats(statsData)
      setPlayers(playersData || [])
      setGlobalBanwords(globalData || [])
      setWeeklyBanwords(weeklyData || [])
    } catch (e) {
      console.error('Failed to load data:', e)
      showToast('❌ Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Show toast
  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem(AUTH_KEY, 'true')
      setLoginError('')
    } else {
      setLoginError('Неверный пароль')
    }
  }

  // Logout handler
  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem(AUTH_KEY)
  }

  // Save game settings
  const saveGameSettings = () => {
    localStorage.setItem('admin_game_settings', JSON.stringify(gameSettings))
    showToast('✅ Настройки игр сохранены')
  }

  // Add global banword
  const handleAddGlobalWord = async () => {
    if (!newGlobalWord.trim()) return
    try {
      await api.addGlobalBanword(ADMIN_PASSWORD, newGlobalWord.trim())
      setNewGlobalWord('')
      loadData()
      showToast('✅ Слово добавлено')
    } catch (e) {
      showToast('❌ Ошибка добавления')
    }
  }

  // Remove global banword
  const handleRemoveGlobalWord = async (wordId) => {
    try {
      await api.removeGlobalBanword(ADMIN_PASSWORD, wordId)
      loadData()
      showToast('✅ Слово удалено')
    } catch (e) {
      showToast('❌ Ошибка удаления')
    }
  }

  // Add weekly banword
  const handleAddWeeklyWord = async () => {
    if (!newWeeklyWord.trim()) return
    try {
      const expiresAt = newWeeklyExpires || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await api.addWeeklyBanword(ADMIN_PASSWORD, newWeeklyWord.trim(), expiresAt)
      setNewWeeklyWord('')
      setNewWeeklyExpires('')
      loadData()
      showToast('✅ Еженедельное слово добавлено')
    } catch (e) {
      showToast('❌ Ошибка добавления')
    }
  }

  // Remove weekly banword
  const handleRemoveWeeklyWord = async (wordId) => {
    try {
      await api.removeWeeklyBanword(ADMIN_PASSWORD, wordId)
      loadData()
      showToast('✅ Слово удалено')
    } catch (e) {
      showToast('❌ Ошибка удаления')
    }
  }

  // Ban player
  const handleBanPlayer = async (telegramId) => {
    try {
      await api.banPlayer(ADMIN_PASSWORD, telegramId, 'manual')
      loadData()
      showToast('✅ Игрок забанен')
    } catch (e) {
      showToast('❌ Ошибка бана')
    }
  }

  // Unban player
  const handleUnbanPlayer = async (telegramId) => {
    try {
      await api.unbanPlayer(ADMIN_PASSWORD, telegramId)
      loadData()
      showToast('✅ Игрок разбанен')
    } catch (e) {
      showToast('❌ Ошибка разбана')
    }
  }

  // Reset player balance
  const handleResetBalance = async (telegramId) => {
    try {
      await api.resetPlayerBalance(ADMIN_PASSWORD, telegramId)
      loadData()
      showToast('✅ Баланс сброшен')
    } catch (e) {
      showToast('❌ Ошибка сброса')
    }
  }

  // Save balance settings
  const saveBalanceSettings = () => {
    localStorage.setItem('admin_balance_settings', JSON.stringify(balanceSettings))
    showToast('✅ Настройки баланса сохранены')
  }

  // Toggle game
  const toggleGame = (game) => {
    setGameSettings(prev => ({
      ...prev,
      [game]: { ...prev[game], enabled: !prev[game].enabled }
    }))
  }

  // Update game setting
  const updateGameSetting = (game, key, value) => {
    setGameSettings(prev => ({
      ...prev,
      [game]: { ...prev[game], [key]: value }
    }))
  }

  // Calculate stats from API or local
  const totalPlayers = stats?.total_players || players.length
  const bannedPlayers = stats?.banned_players || players.filter(p => p.is_banned).length
  const totalGamesPlayed = stats?.total_games || players.reduce((sum, p) => sum + (p.games_played || 0), 0)
  const totalBalance = players.reduce((sum, p) => sum + (p.balance || 0), 0)


  // Login page
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.loginPage}>
          <div className={styles.loginCard}>
            <h1 className={styles.loginTitle}>🔐 Админ-панель</h1>
            <p className={styles.loginSubtitle}>Alabama Hub</p>
            
            {loginError && (
              <div className={styles.loginError}>{loginError}</div>
            )}
            
            <form onSubmit={handleLogin}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Пароль</label>
                <input
                  type="password"
                  className={styles.formInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  autoFocus
                />
              </div>
              
              <button type="submit" className={styles.loginBtn}>
                Войти
              </button>
            </form>
            
            <Link to="/" className={styles.backLink}>
              ← Вернуться к играм
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Admin panel
  return (
    <div className={styles.container}>
      <div className={styles.adminLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h1 className={styles.sidebarTitle}>🎮 Alabama Admin</h1>
          <p className={styles.sidebarSubtitle}>Панель управления</p>
          
          <nav>
            <ul className={styles.navList}>
              <li className={styles.navItem}>
                <button
                  className={`${styles.navBtn} ${activeTab === 'dashboard' ? styles.navBtnActive : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <span className={styles.navIcon}>📊</span>
                  Дашборд
                </button>
              </li>
              <li className={styles.navItem}>
                <button
                  className={`${styles.navBtn} ${activeTab === 'players' ? styles.navBtnActive : ''}`}
                  onClick={() => setActiveTab('players')}
                >
                  <span className={styles.navIcon}>👥</span>
                  Игроки
                </button>
              </li>
              <li className={styles.navItem}>
                <button
                  className={`${styles.navBtn} ${activeTab === 'games' ? styles.navBtnActive : ''}`}
                  onClick={() => setActiveTab('games')}
                >
                  <span className={styles.navIcon}>🎰</span>
                  Игры
                </button>
              </li>
              <li className={styles.navItem}>
                <button
                  className={`${styles.navBtn} ${activeTab === 'moderation' ? styles.navBtnActive : ''}`}
                  onClick={() => setActiveTab('moderation')}
                >
                  <span className={styles.navIcon}>🛡️</span>
                  Модерация
                </button>
              </li>
              <li className={styles.navItem}>
                <button
                  className={`${styles.navBtn} ${activeTab === 'settings' ? styles.navBtnActive : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <span className={styles.navIcon}>⚙️</span>
                  Настройки
                </button>
              </li>
            </ul>
          </nav>
          
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <span>🚪</span>
            Выйти
          </button>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Loading indicator */}
          {loading && (
            <div className={styles.loading}>Загрузка данных...</div>
          )}

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              <h2 className={styles.pageTitle}>📊 Дашборд</h2>
              <p className={styles.pageSubtitle}>Общая статистика платформы</p>
              
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Всего игроков</div>
                  <div className={`${styles.statValue} ${styles.blue}`}>{totalPlayers}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Забанено</div>
                  <div className={`${styles.statValue} ${styles.red}`}>{bannedPlayers}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Всего игр сыграно</div>
                  <div className={`${styles.statValue} ${styles.yellow}`}>{totalGamesPlayed}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Общий баланс</div>
                  <div className={`${styles.statValue} ${styles.purple}`}>{totalBalance.toLocaleString()}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Глобальных банвордов</div>
                  <div className={`${styles.statValue} ${styles.orange}`}>{globalBanwords.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Еженедельных банвордов</div>
                  <div className={`${styles.statValue} ${styles.green}`}>{weeklyBanwords.length}</div>
                </div>
              </div>

              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <h3 className={styles.tableTitle}>Топ игроков по балансу</h3>
                  <button className={styles.refreshBtn} onClick={loadData}>🔄 Обновить</button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Игрок</th>
                      <th>Баланс</th>
                      <th>Банов</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.slice(0, 5).map(player => (
                      <tr key={player.telegram_id || player.id}>
                        <td>@{player.username || player.first_name || player.telegram_id}</td>
                        <td>{(player.balance || 0).toLocaleString()}</td>
                        <td>{player.ban_count || 0}</td>
                        <td>
                          <span className={`${styles.badge} ${player.is_banned ? styles.badgeRed : styles.badgeGreen}`}>
                            {player.is_banned ? 'Забанен' : 'Активен'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr><td colSpan="4" style={{textAlign: 'center'}}>Нет данных</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Players */}
          {activeTab === 'players' && (
            <>
              <h2 className={styles.pageTitle}>👥 Игроки</h2>
              <p className={styles.pageSubtitle}>Управление пользователями</p>
              
              <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                  <h3 className={styles.tableTitle}>Все игроки ({players.length})</h3>
                  <button className={styles.refreshBtn} onClick={loadData}>🔄 Обновить</button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя</th>
                      <th>Баланс</th>
                      <th>Банов</th>
                      <th>Цена выкупа</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(player => (
                      <tr key={player.telegram_id || player.id}>
                        <td>#{player.telegram_id || player.id}</td>
                        <td>@{player.username || player.first_name || 'Без имени'}</td>
                        <td>{(player.balance || 0).toLocaleString()}</td>
                        <td>{player.ban_count || 0}</td>
                        <td>{(player.current_buyout_price || 100).toLocaleString()}</td>
                        <td>
                          <span className={`${styles.badge} ${player.is_banned ? styles.badgeRed : styles.badgeGreen}`}>
                            {player.is_banned ? 'Забанен' : 'Активен'}
                          </span>
                        </td>
                        <td className={styles.actionBtns}>
                          {player.is_banned ? (
                            <button 
                              className={`${styles.actionBtn} ${styles.green}`}
                              onClick={() => handleUnbanPlayer(player.telegram_id)}
                            >
                              Разбанить
                            </button>
                          ) : (
                            <button 
                              className={`${styles.actionBtn} ${styles.red}`}
                              onClick={() => handleBanPlayer(player.telegram_id)}
                            >
                              Забанить
                            </button>
                          )}
                          <button 
                            className={styles.actionBtn}
                            onClick={() => handleResetBalance(player.telegram_id)}
                          >
                            Сбросить баланс
                          </button>
                        </td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr><td colSpan="7" style={{textAlign: 'center'}}>Нет данных</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Games */}
          {activeTab === 'games' && (
            <>
              <h2 className={styles.pageTitle}>🎰 Управление играми</h2>
              <p className={styles.pageSubtitle}>Включение/выключение и настройки игр</p>
              
              <div className={styles.settingsGrid}>
                {/* Horse Racing */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsTitle}>
                    🏇 Скачки роверов
                    <div 
                      className={`${styles.toggle} ${gameSettings.horseRacing.enabled ? styles.active : ''}`}
                      onClick={() => toggleGame('horseRacing')}
                    >
                      <div className={styles.toggleKnob} />
                    </div>
                  </h3>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Мин. ставка</span>
                    <input
                      type="number"
                      className={styles.settingsInput}
                      value={gameSettings.horseRacing.minBet}
                      onChange={(e) => updateGameSetting('horseRacing', 'minBet', parseInt(e.target.value))}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Макс. ставка</span>
                    <input
                      type="number"
                      className={styles.settingsInput}
                      value={gameSettings.horseRacing.maxBet}
                      onChange={(e) => updateGameSetting('horseRacing', 'maxBet', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                {/* Slots */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsTitle}>
                    🎰 Слоты
                    <div 
                      className={`${styles.toggle} ${gameSettings.slots.enabled ? styles.active : ''}`}
                      onClick={() => toggleGame('slots')}
                    >
                      <div className={styles.toggleKnob} />
                    </div>
                  </h3>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Мин. ставка</span>
                    <input
                      type="number"
                      className={styles.settingsInput}
                      value={gameSettings.slots.minBet}
                      onChange={(e) => updateGameSetting('slots', 'minBet', parseInt(e.target.value))}
                    />
                  </div>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Макс. ставка</span>
                    <input
                      type="number"
                      className={styles.settingsInput}
                      value={gameSettings.slots.maxBet}
                      onChange={(e) => updateGameSetting('slots', 'maxBet', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                {/* Block Blast */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsTitle}>
                    🧩 Block Blast
                    <div 
                      className={`${styles.toggle} ${gameSettings.blockBlast.enabled ? styles.active : ''}`}
                      onClick={() => toggleGame('blockBlast')}
                    >
                      <div className={styles.toggleKnob} />
                    </div>
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                    Без дополнительных настроек
                  </p>
                </div>

                {/* Rover Smash */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsTitle}>
                    🎯 Rover Smash
                    <div 
                      className={`${styles.toggle} ${gameSettings.roverSmash.enabled ? styles.active : ''}`}
                      onClick={() => toggleGame('roverSmash')}
                    >
                      <div className={styles.toggleKnob} />
                    </div>
                  </h3>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>Длительность (сек)</span>
                    <input
                      type="number"
                      className={styles.settingsInput}
                      value={gameSettings.roverSmash.gameDuration}
                      onChange={(e) => updateGameSetting('roverSmash', 'gameDuration', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.banwordsActions}>
                <button className={styles.saveBtn} onClick={saveGameSettings}>
                  💾 Сохранить настройки игр
                </button>
              </div>
            </>
          )}

          {/* Moderation */}
          {activeTab === 'moderation' && (
            <>
              <h2 className={styles.pageTitle}>🛡️ Модерация</h2>
              <p className={styles.pageSubtitle}>Управление запрещёнными словами</p>
              
              {/* Global Banwords */}
              <div className={styles.settingsCard} style={{ maxWidth: '600px', marginBottom: '24px' }}>
                <h3 className={styles.settingsTitle}>🌍 Глобальные банворды</h3>
                <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '16px' }}>
                  Слова, запрещённые для всех пользователей.
                </p>
                
                <div className={styles.addWordForm}>
                  <input
                    type="text"
                    className={styles.settingsInput}
                    value={newGlobalWord}
                    onChange={(e) => setNewGlobalWord(e.target.value)}
                    placeholder="Новое слово..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGlobalWord()}
                  />
                  <button className={styles.addBtn} onClick={handleAddGlobalWord}>
                    ➕ Добавить
                  </button>
                </div>

                <div className={styles.wordsList}>
                  {globalBanwords.map(word => (
                    <div key={word.id} className={styles.wordItem}>
                      <span>{word.word}</span>
                      <button 
                        className={styles.removeBtn}
                        onClick={() => handleRemoveGlobalWord(word.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {globalBanwords.length === 0 && (
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Нет глобальных банвордов</p>
                  )}
                </div>
              </div>

              {/* Weekly Banwords */}
              <div className={styles.settingsCard} style={{ maxWidth: '600px' }}>
                <h3 className={styles.settingsTitle}>📅 Еженедельные банворды (x4 выкуп)</h3>
                <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '16px' }}>
                  Временные слова с повышенным множителем выкупа.
                </p>
                
                <div className={styles.addWordForm}>
                  <input
                    type="text"
                    className={styles.settingsInput}
                    value={newWeeklyWord}
                    onChange={(e) => setNewWeeklyWord(e.target.value)}
                    placeholder="Новое слово..."
                    style={{ flex: 2 }}
                  />
                  <input
                    type="date"
                    className={styles.settingsInput}
                    value={newWeeklyExpires}
                    onChange={(e) => setNewWeeklyExpires(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className={styles.addBtn} onClick={handleAddWeeklyWord}>
                    ➕ Добавить
                  </button>
                </div>

                <div className={styles.wordsList}>
                  {weeklyBanwords.map(word => (
                    <div key={word.id} className={styles.wordItem}>
                      <span>{word.word}</span>
                      <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: '8px' }}>
                        до {new Date(word.expires_at).toLocaleDateString()}
                      </span>
                      <button 
                        className={styles.removeBtn}
                        onClick={() => handleRemoveWeeklyWord(word.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {weeklyBanwords.length === 0 && (
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>Нет еженедельных банвордов</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <>
              <h2 className={styles.pageTitle}>⚙️ Настройки баланса</h2>
              <p className={styles.pageSubtitle}>Экономика платформы</p>
              
              <div className={styles.settingsCard} style={{ maxWidth: '400px' }}>
                <h3 className={styles.settingsTitle}>💰 Баланс игроков</h3>
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>Начальный баланс</span>
                  <input
                    type="number"
                    className={styles.settingsInput}
                    value={balanceSettings.startBalance}
                    onChange={(e) => setBalanceSettings(prev => ({ ...prev, startBalance: parseInt(e.target.value) }))}
                  />
                </div>
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>Ежедневный бонус</span>
                  <input
                    type="number"
                    className={styles.settingsInput}
                    value={balanceSettings.dailyBonus}
                    onChange={(e) => setBalanceSettings(prev => ({ ...prev, dailyBonus: parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className={styles.banwordsActions} style={{ marginTop: '24px' }}>
                <button className={styles.saveBtn} onClick={saveBalanceSettings}>
                  💾 Сохранить настройки
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles.toastSuccess}`}>
          {toast}
        </div>
      )}
    </div>
  )
}
