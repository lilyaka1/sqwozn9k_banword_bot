import { useState, useEffect } from 'react'
import styles from './ProfileModal.module.css'

function ProfileModal({ isOpen, onClose }) {
  const [stats, setStats] = useState({
    totalGames: 0,
    totalWins: 0,
    totalBalance: 0,
    bestScore: 0
  })
  const [userName, setUserName] = useState('Игрок')

  useEffect(() => {
    if (isOpen) {
      loadStats()
      loadUserName()
    }
  }, [isOpen])

  const loadStats = () => {
    const rrBalance = parseInt(localStorage.getItem('rr_balance')) || 1000
    const rrWins = parseInt(localStorage.getItem('rr_wins')) || 0
    const bbScore = parseInt(localStorage.getItem('bb_highscore')) || 0
    const slotWins = parseInt(localStorage.getItem('slot_wins')) || 0

    setStats({
      totalBalance: rrBalance,
      totalWins: rrWins + slotWins,
      bestScore: bbScore,
      totalGames: rrWins + slotWins + (bbScore > 0 ? 1 : 0)
    })
  }

  const loadUserName = () => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp
      if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        setUserName(tg.initDataUnsafe.user.first_name || 'Игрок')
      }
    }
  }

  const handleResetStats = () => {
    if (confirm('Точно сбросить всю статистику?')) {
      localStorage.removeItem('rr_balance')
      localStorage.removeItem('rr_wins')
      localStorage.removeItem('bb_highscore')
      localStorage.removeItem('slot_wins')
      loadStats()
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
    }
  }

  const handleShareStats = () => {
    const text = `🎮 Моя статистика в Alabama Hub:\n` +
                 `💰 Баланс: ${stats.totalBalance}₽\n` +
                 `🏆 Побед: ${stats.totalWins}\n` +
                 `⭐ Лучший счёт: ${stats.bestScore}`

    if (navigator.share) {
      navigator.share({ text })
    } else if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.showAlert(text)
    } else {
      alert(text)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.title}>👤 Личный кабинет</div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.avatar}>🎮</div>
        <div className={styles.name}>{userName}</div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.totalGames}</div>
            <div className={styles.statLabel}>Игр сыграно</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.totalWins}</div>
            <div className={styles.statLabel}>Побед</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.totalBalance}₽</div>
            <div className={styles.statLabel}>Баланс</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{stats.bestScore}</div>
            <div className={styles.statLabel}>Лучший счёт</div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={handleResetStats}>
            <span className={styles.icon}>🔄</span>
            <span>Сбросить статистику</span>
          </button>
          <button className={styles.actionBtn} onClick={handleShareStats}>
            <span className={styles.icon}>📤</span>
            <span>Поделиться</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileModal
