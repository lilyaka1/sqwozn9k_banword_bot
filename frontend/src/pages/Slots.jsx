import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../api/hooks'
import styles from './Slots.module.css'

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '7️⃣', '💎']
const MULTIPLIERS = {
  '💎💎💎': 50,
  '7️⃣7️⃣7️⃣': 25,
  '⭐⭐⭐': 15,
  '🍇🍇🍇': 10,
  '🍊🍊🍊': 8,
  '🍋🍋🍋': 5,
  '🍒🍒🍒': 3,
}

const STORAGE_KEY = 'slots_state'

export default function Slots() {
  const { player, updateBalance: updateServerBalance, saveGameResult } = useUser()
  const [reels, setReels] = useState(['🍒', '🍋', '🍊'])
  const [spinning, setSpinning] = useState(false)
  const [balance, setBalance] = useState(1000)
  const [bet, setBet] = useState(10)
  const [wins, setWins] = useState(0)
  const [lastWin, setLastWin] = useState(null)
  const [showWinReels, setShowWinReels] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // Load state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      setBalance(state.balance ?? 1000)
      setWins(state.wins ?? 0)
    }
  }, [])

  // Save state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, wins }))
  }, [balance, wins])

  const vibrate = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern)
  }

  const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]

  const checkWin = (result) => {
    const key = result.join('')
    if (MULTIPLIERS[key]) {
      return { multiplier: MULTIPLIERS[key], symbols: result }
    }
    // Check for 2 matching at start
    if (result[0] === result[1]) {
      return { multiplier: 1.5, symbols: result }
    }
    return null
  }

  const spin = useCallback(() => {
    if (spinning || balance < bet) return
    
    vibrate(50)
    setSpinning(true)
    setLastWin(null)
    setShowWinReels(false)
    setBalance(b => b - bet)

    // Simulate spinning with random symbols
    let spinCount = 0
    const spinInterval = setInterval(() => {
      setReels([getRandomSymbol(), getRandomSymbol(), getRandomSymbol()])
      spinCount++
      if (spinCount > 20) {
        clearInterval(spinInterval)
        
        // Final result
        const result = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
        setReels(result)
        setSpinning(false)

        const win = checkWin(result)
        if (win) {
          const winAmount = Math.floor(bet * win.multiplier)
          setBalance(b => b + winAmount)
          setWins(w => w + 1)
          setLastWin(winAmount)
          setShowWinReels(true)
          vibrate([100, 50, 100, 50, 200])
          
          // Синхронизируем выигрыш с сервером (чистый выигрыш минус ставка)
          const netWin = winAmount - bet
          if (netWin > 0) {
            updateServerBalance(netWin)
            saveGameResult('slots', winAmount)
          }
          
          setTimeout(() => setShowWinReels(false), 2000)
        }
      }
    }, 80)
  }, [spinning, balance, bet])

  const changeBet = (delta) => {
    vibrate(10)
    setBet(b => Math.max(10, Math.min(500, b + delta)))
  }

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backBtn}>← Назад</Link>
      
      <div className={styles.header}>
        <h1 className={styles.title}>🎰 Слоты</h1>
        <p className={styles.subtitle}>Крути барабаны, лови удачу!</p>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>Баланс</div>
          <div className={styles.statValue}>{balance}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>Побед</div>
          <div className={styles.statValue}>{wins}</div>
        </div>
      </div>

      <div className={styles.slotMachine}>
        <div className={styles.reels}>
          {reels.map((symbol, i) => (
            <div 
              key={i} 
              className={`${styles.reel} ${spinning ? styles.reelSpinning : ''} ${showWinReels ? styles.reelWin : ''}`}
            >
              {symbol}
            </div>
          ))}
        </div>

        {lastWin && (
          <div className={styles.winMessage}>
            <div className={styles.winText}>🎉 Победа!</div>
            <div className={styles.winAmount}>+{lastWin}</div>
          </div>
        )}

        <div className={styles.controls}>
          <div className={styles.betControls}>
            <span className={styles.betLabel}>Ставка:</span>
            <button className={styles.betBtn} onClick={() => changeBet(-10)} disabled={spinning}>-</button>
            <span className={styles.betAmount}>{bet}</span>
            <button className={styles.betBtn} onClick={() => changeBet(10)} disabled={spinning}>+</button>
          </div>
          
          <button 
            className={styles.spinBtn} 
            onClick={spin} 
            disabled={spinning || balance < bet}
          >
            {spinning ? '🔄' : 'КРУТИТЬ'}
          </button>
        </div>
      </div>

      <div className={styles.paytable}>
        <div className={styles.paytableTitle}>💰 Таблица выплат</div>
        {Object.entries(MULTIPLIERS).map(([combo, mult]) => (
          <div key={combo} className={styles.paytableRow}>
            <span className={styles.paytableSymbols}>{combo.match(/.{2}/g).join(' ')}</span>
            <span className={styles.paytableMultiplier}>x{mult}</span>
          </div>
        ))}
        <div className={styles.paytableRow}>
          <span className={styles.paytableSymbols}>🎲🎲 (2 одинак.)</span>
          <span className={styles.paytableMultiplier}>x1.5</span>
        </div>
      </div>

      {/* Rules Button */}
      <button className={styles.rulesBtn} onClick={() => setShowRules(true)}>
        ❓ Правила
      </button>

      {/* Rules Modal */}
      {showRules && (
        <div className={styles.modal} onClick={() => setShowRules(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>📖 Правила Слотов</h2>
            <div className={styles.rulesContent}>
              <p>🎯 <strong>Цель:</strong> собрать комбинацию символов!</p>
              <p>🎰 <strong>Как играть:</strong></p>
              <ul>
                <li>Выбери размер ставки (10-500₽)</li>
                <li>Нажми КРУТИТЬ</li>
                <li>Жди результат!</li>
              </ul>
              <p>💰 <strong>Выигрыши:</strong></p>
              <ul>
                <li>💎💎💎 - x50 от ставки</li>
                <li>7️⃣7️⃣7️⃣ - x25 от ставки</li>
                <li>⭐⭐⭐ - x15 от ставки</li>
                <li>2 одинаковых - x1.5</li>
              </ul>
              <p>⚡ <strong>Совет:</strong> больше ставка = больше выигрыш!</p>
            </div>
            <button className={styles.modalBtn} onClick={() => setShowRules(false)}>
              Понятно!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
