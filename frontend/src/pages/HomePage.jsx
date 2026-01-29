import { useState, useEffect } from 'react'
import GameCard from '../components/GameCard.jsx'
import ProfileModal from '../components/ProfileModal.jsx'
import api from '../api/client'
import styles from './HomePage.module.css'

function HomePage() {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('games') // 'games' | 'leaderboard'
  const [leaderboard, setLeaderboard] = useState(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  useEffect(() => {
    // Telegram WebApp интеграция
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0f0c29')
      tg.setBackgroundColor('#0f0c29')
    }
  }, [])

  // Загружаем лидерборд только при переключении на вкладку
  useEffect(() => {
    if (activeTab === 'leaderboard' && !leaderboard) {
      loadLeaderboard()
    }
  }, [activeTab])

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true)
    try {
      const data = await api.getLeaderboard(20)
      setLeaderboard(data)
    } catch (err) {
      console.error('Failed to load leaderboard:', err)
      // Fallback данные для демо
      setLeaderboard([
        { rank: 1, username: 'TopPlayer', balance: 15420, total_wins: 89 },
        { rank: 2, username: 'GambleMaster', balance: 12350, total_wins: 76 },
        { rank: 3, username: 'LuckyOne', balance: 9800, total_wins: 54 },
      ])
    } finally {
      setLeaderboardLoading(false)
    }
  }

  const handleProfileOpen = () => {
    setIsProfileOpen(true)
    if (navigator.vibrate) navigator.vibrate(50)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (navigator.vibrate) navigator.vibrate(30)
  }

  const getMedalEmoji = (rank) => {
    switch(rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return `#${rank}`
    }
  }

  return (
    <div className={styles.container}>
      <button className={styles.profileBtn} onClick={handleProfileOpen}>
        <span className={styles.profileIcon}>👤</span>
        <span>Личный кабинет</span>
      </button>

      <header className={styles.header}>
        <div className={styles.logo}>🎮</div>
        <h1 className={styles.title}>Alabama Hub</h1>
        <p className={styles.subtitle}>Выбери игру и погнали!</p>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'games' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('games')}
        >
          <span>🎮</span> Игры
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('leaderboard')}
        >
          <span>🏆</span> Лидерборд
        </button>
      </div>

      {/* Games Tab */}
      {activeTab === 'games' && (
        <div className={styles.gamesGrid}>
          <GameCard
            to="/horse-racing"
            icon="🛵"
            title="Rover Racing"
            description="Ставки на гонки роверов. Лавка, Яндекс, Delivery или Самокат?"
            variant="racing"
            isNew
          />

          <GameCard
            to="/slots"
            icon="🎰"
            title="Слоты"
            description="Крути барабаны, лови джекпот! Классические слоты."
            variant="slots"
          />

          <GameCard
            to="/block-blast"
            icon="🧱"
            title="Block Blast"
            description="Расставляй блоки, собирай линии, набирай очки!"
            variant="blocks"
          />

          <GameCard
            to="/rover-smash"
            icon="💥"
            title="Rover Smash"
            description="Бей роверов, набирай очки, попади в топ!"
            variant="smash"
            isHot
          />
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className={styles.leaderboardContainer}>
          <div className={styles.leaderboardHeader}>
            <h2 className={styles.leaderboardTitle}>🏆 Топ игроков</h2>
            <button 
              className={styles.refreshBtn}
              onClick={loadLeaderboard}
              disabled={leaderboardLoading}
            >
              {leaderboardLoading ? '⏳' : '🔄'}
            </button>
          </div>

          {leaderboardLoading && !leaderboard ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Загрузка...</p>
            </div>
          ) : (
            <div className={styles.leaderboardList}>
              {leaderboard?.map((player, index) => (
                <div 
                  key={player.telegram_id || index} 
                  className={`${styles.leaderboardItem} ${index < 3 ? styles[`top${index + 1}`] : ''}`}
                >
                  <div className={styles.playerRank}>
                    {getMedalEmoji(player.rank || index + 1)}
                  </div>
                  <div className={styles.playerInfo}>
                    <span className={styles.playerName}>
                      {player.username || player.first_name || `Игрок ${player.telegram_id}`}
                    </span>
                    <span className={styles.playerStats}>
                      🏆 {player.total_wins || 0} побед
                    </span>
                  </div>
                  <div className={styles.playerBalance}>
                    {(player.balance || 0).toLocaleString()}₽
                  </div>
                </div>
              ))}

              {(!leaderboard || leaderboard.length === 0) && (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>🏜️</span>
                  <p>Пока нет данных</p>
                  <p className={styles.emptyHint}>Играй первым!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Made with <span className={styles.heart}>❤️</span> by lilyakaaa
        </p>
      </footer>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  )
}

export default HomePage
