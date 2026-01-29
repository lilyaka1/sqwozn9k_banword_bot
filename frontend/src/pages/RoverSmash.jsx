import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../api/hooks'
import styles from './RoverSmash.module.css'

import lavkaImg from '../assets/rovers/cutlavka.png'
import yandexImg from '../assets/rovers/cutyandex.png'
import deliveryImg from '../assets/rovers/cutdelivery.png'
import samokatImg from '../assets/rovers/cutsamokat.png'
import bottleImg from '../assets/rovers/bottle.png'

// hp - сколько тапов нужно для уничтожения
// reward - награда (если не указано, равно hp)
// spawnWeight - вес спавна (больше = чаще)
const ROVER_TYPES = [
  { img: lavkaImg, name: 'Лавка', hp: 2, color: '#34d399', spawnWeight: 30 },
  { img: yandexImg, name: 'Яндекс', hp: 3, color: '#0ea5e9', spawnWeight: 25 },
  { img: deliveryImg, name: 'Доставка', hp: 2, color: '#f97316', spawnWeight: 30 },
  { img: samokatImg, name: 'Самокат', hp: 1, color: '#fb7185', spawnWeight: 35 },
]

// Легендарный ровер - только для endless режима (0.1% шанс)
const LEGENDARY_ROVER = { img: bottleImg, name: 'Бутылка', hp: 5, reward: 129, color: '#fbbf24', spawnWeight: 0.12, legendary: true }

// Функция выбора ровера с учётом весов
const getRandomRoverType = (isEndless = false) => {
  const types = isEndless ? [...ROVER_TYPES, LEGENDARY_ROVER] : ROVER_TYPES
  const totalWeight = types.reduce((sum, r) => sum + r.spawnWeight, 0)
  let random = Math.random() * totalWeight
  for (const type of types) {
    random -= type.spawnWeight
    if (random <= 0) return type
  }
  return types[0]
}

const GAME_DURATION = 30000
const SPAWN_INTERVAL = 800
const STORAGE_KEY = 'roversmash_state'

const getRoverLifetime = (score) => {
  if (score >= 2500) return 3000
  if (score >= 1000) return 5000
  if (score >= 500) return 7000
  if (score >= 250) return 10000
  return 15000
}

let roverId = 0

export default function RoverSmash() {
  const { player, updateBalance, saveGameResult } = useUser()
  const [gameState, setGameState] = useState('menu')
  const [gameMode, setGameMode] = useState(null)
  const [score, setScore] = useState(0)
  const [bestEndless, setBestEndless] = useState(0)
  const [bestClassic, setBestClassic] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [rovers, setRovers] = useState([])
  const [hitEffects, setHitEffects] = useState([])
  const [showRules, setShowRules] = useState(false)
  const [missedRovers, setMissedRovers] = useState(0)
  const [balanceAdded, setBalanceAdded] = useState(0)
  const gameAreaRef = useRef(null)
  const scoreRef = useRef(0)

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      setBestEndless(state.bestEndless ?? 0)
      setBestClassic(state.bestClassic ?? 0)
    }
  }, [])

  useEffect(() => {
    if (gameMode === 'endless' && score > bestEndless) {
      setBestEndless(score)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestEndless: score, bestClassic }))
    }
    if (gameMode === 'classic' && score > bestClassic) {
      setBestClassic(score)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestEndless, bestClassic: score }))
    }
  }, [score, gameMode, bestEndless, bestClassic])

  // Сохраняем баланс когда игра заканчивается
  useEffect(() => {
    if (gameState === 'ended' && score > 0) {
      const earned = score // В RoverSmash очки = рубли
      setBalanceAdded(earned)
      updateBalance(earned)
      saveGameResult('rover_smash', score)
    }
  }, [gameState])

  const vibrate = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern)
  }

  const spawnRover = useCallback((isEndless) => {
    if (!gameAreaRef.current) return
    const rect = gameAreaRef.current.getBoundingClientRect()
    const padding = 40
    const type = getRandomRoverType(isEndless)
    
    const rover = {
      id: ++roverId,
      x: padding + Math.random() * (rect.width - padding * 2 - 60),
      y: padding + Math.random() * (rect.height - padding * 2 - 60),
      ...type,
      currentHp: type.hp,
      hit: false,
      destroyed: false,
      spawnTime: Date.now(),
    }
    setRovers(prev => [...prev.slice(-10), rover])
  }, [])

  useEffect(() => {
    if (gameState !== 'running' || gameMode !== 'classic') return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          setGameState('ended')
          return 0
        }
        return prev - 100
      })
    }, 100)
    return () => clearInterval(interval)
  }, [gameState, gameMode])

  useEffect(() => {
    if (gameState !== 'running') return
    const isEndless = gameMode === 'endless'
    const interval = setInterval(() => spawnRover(isEndless), SPAWN_INTERVAL)
    spawnRover(isEndless)
    return () => clearInterval(interval)
  }, [gameState, gameMode, spawnRover])

  useEffect(() => {
    if (gameState !== 'running' || gameMode !== 'endless') return
    const interval = setInterval(() => {
      const now = Date.now()
      const lifetime = getRoverLifetime(scoreRef.current)
      
      setRovers(prev => {
        const expired = prev.filter(r => !r.destroyed && (now - r.spawnTime) > lifetime)
        if (expired.length > 0) {
          setMissedRovers(m => {
            const newMissed = m + expired.length
            if (newMissed >= 15) {
              setTimeout(() => setGameState('ended'), 100)
            }
            return newMissed
          })
        }
        return prev.filter(r => r.destroyed || (now - r.spawnTime) <= lifetime)
      })
    }, 200)
    return () => clearInterval(interval)
  }, [gameState, gameMode])

  const startGame = (mode) => {
    vibrate(50)
    setGameMode(mode)
    setScore(0)
    setTimeLeft(GAME_DURATION)
    setRovers([])
    setHitEffects([])
    setMissedRovers(0)
    setGameState('running')
  }

  const backToMenu = () => {
    setGameState('menu')
    setGameMode(null)
    setRovers([])
  }

  const hitRover = (rover, e) => {
    if (gameState !== 'running' || rover.destroyed) return
    vibrate(20)
    
    const rect = e.currentTarget.getBoundingClientRect()
    const effectX = e.clientX - rect.left
    const effectY = e.clientY - rect.top

    // Находим ровера и проверяем его текущее HP
    const currentRover = rovers.find(r => r.id === rover.id)
    if (!currentRover || currentRover.destroyed) return

    const newHp = currentRover.currentHp - 1
    const isDestroyed = newHp <= 0

    if (isDestroyed) {
      // Даём очки только при уничтожении - reward или hp
      const points = currentRover.reward ?? currentRover.hp
      setScore(s => s + points)
      vibrate(currentRover.legendary ? [50, 30, 50, 30, 100] : [30, 20, 50])
      setHitEffects(prev => [...prev, {
        id: Date.now(),
        x: rover.x + 30 + effectX * 0.2,
        y: rover.y,
        points: points,
        legendary: currentRover.legendary
      }])
    } else {
      // Промежуточный тап - просто эффект без очков
      setHitEffects(prev => [...prev, {
        id: Date.now() + Math.random(),
        x: rover.x + 30 + effectX * 0.2,
        y: rover.y,
        points: null
      }])
    }

    setRovers(prev => prev.map(r => {
      if (r.id !== rover.id) return r
      if (isDestroyed) {
        return { ...r, currentHp: 0, destroyed: true }
      }
      return { ...r, currentHp: newHp }
    }))
  }

  useEffect(() => {
    const cleanup = setInterval(() => {
      setRovers(prev => prev.filter(r => !r.destroyed))
      setHitEffects(prev => prev.filter(e => Date.now() - e.id < 400))
    }, 300)
    return () => clearInterval(cleanup)
  }, [])

  const currentBest = gameMode === 'endless' ? bestEndless : bestClassic

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backBtn}>← Назад</Link>
      
      <div className={styles.header}>
        <h1 className={styles.title}>🎯 Rover Smash</h1>
        <p className={styles.subtitle}>
          {gameMode === 'endless' ? '♾️ Бесконечный режим' : 
           gameMode === 'classic' ? '⏱️ Классический режим' : 
           'Выбери режим игры!'}
        </p>
      </div>

      {gameState !== 'menu' && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Очки</div>
            <div className={styles.statValue}>{score}</div>
          </div>
          {gameMode === 'classic' && (
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Время</div>
              <div className={styles.statValue}>{Math.ceil(timeLeft / 1000)}с</div>
            </div>
          )}
          {gameMode === 'endless' && (
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Пропущено</div>
              <div className={`${styles.statValue} ${missedRovers >= 12 ? styles.statDanger : ''}`}>
                {missedRovers}/15
              </div>
            </div>
          )}
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Рекорд</div>
            <div className={styles.statValue}>{currentBest}</div>
          </div>
        </div>
      )}

      {gameState === 'running' && gameMode === 'classic' && (
        <div className={styles.timerBar}>
          <div className={styles.timerFill} style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }} />
        </div>
      )}

      {gameState === 'running' && gameMode === 'endless' && (
        <div className={styles.speedIndicator}>
          ⚡ Скорость: {getRoverLifetime(score) / 1000}с на ровера
        </div>
      )}

      <div ref={gameAreaRef} className={`${styles.gameArea} ${gameState === 'menu' ? styles.gameAreaIdle : ''}`}>
        {gameState === 'menu' && (
          <div className={styles.menuContainer}>
            <div className={styles.modeCard} onClick={() => startGame('endless')}>
              <div className={styles.modeIcon}>♾️</div>
              <h3 className={styles.modeTitle}>Бесконечный</h3>
              <p className={styles.modeDesc}>
                Роверы пропадают со временем.<br />
                Чем больше очков — тем быстрее!<br />
                5 пропусков = конец игры.
              </p>
              <div className={styles.modeBest}>Рекорд: {bestEndless}₽</div>
            </div>
            
            <div className={styles.modeCard} onClick={() => startGame('classic')}>
              <div className={styles.modeIcon}>⏱️</div>
              <h3 className={styles.modeTitle}>Классический</h3>
              <p className={styles.modeDesc}>
                30 секунд на всё!<br />
                Роверы не пропадают.<br />
                Набей максимум очков!
              </p>
              <div className={styles.modeBest}>Рекорд: {bestClassic}₽</div>
            </div>
          </div>
        )}

        {gameState === 'running' && rovers.map(rover => (
          <div
            key={rover.id}
            className={`${styles.rover} ${rover.hit ? styles.roverHit : ''} ${rover.destroyed ? styles.roverDestroyed : ''} ${rover.legendary ? styles.roverLegendary : ''}`}
            style={{ left: rover.x, top: rover.y }}
            onClick={(e) => hitRover(rover, e)}
          >
            {gameMode === 'endless' && (
              <div className={styles.lifetimeBar}>
                <div className={styles.lifetimeFill} style={{ width: `${Math.max(0, 100 - ((Date.now() - rover.spawnTime) / getRoverLifetime(score)) * 100)}%` }} />
              </div>
            )}
            <img src={rover.img} alt={rover.name} className={styles.roverImage} />
            <div className={`${styles.roverHp} ${rover.legendary ? styles.roverHpLegendary : ''}`}>
              {Array.from({ length: rover.hp }).map((_, i) => (
                <div key={i} className={`${styles.hpDot} ${i >= rover.currentHp ? styles.hpDotEmpty : ''} ${rover.legendary ? styles.hpDotLegendary : ''}`} />
              ))}
            </div>
          </div>
        ))}

        {hitEffects.map(effect => (
          <div
            key={effect.id}
            className={`${styles.hitEffect} ${effect.points === null ? styles.hitEffectSmall : ''} ${effect.legendary ? styles.hitEffectLegendary : ''}`}
            style={{ left: effect.x, top: effect.y }}
          >
            {effect.points !== null ? `+${effect.points}` : '💥'}
          </div>
        ))}
      </div>

      {gameState === 'ended' && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {gameMode === 'classic' ? '⏱️ Время вышло!' : '💔 Игра окончена!'}
            </h2>
            <div className={styles.modalScore}>{score}₽</div>
            <p className={styles.modalBest}>Лучший результат: {currentBest}₽</p>
            {balanceAdded > 0 && (
              <div className={styles.balanceEarned}>+{balanceAdded}₽ на баланс</div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.modalBtn} onClick={() => startGame(gameMode)}>Ещё раз</button>
              <button className={styles.modalBtnSecondary} onClick={backToMenu}>Меню</button>
            </div>
          </div>
        </div>
      )}

      <button className={styles.rulesBtn} onClick={() => setShowRules(true)}>❓ Правила</button>

      {showRules && (
        <div className={styles.modal} onClick={() => setShowRules(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>📖 Правила Rover Smash</h2>
            <div className={styles.rulesContent}>
              <p>🎯 <strong>Цель:</strong> набить максимум очков!</p>
              <p>♾️ <strong>Бесконечный режим:</strong></p>
              <ul>
                <li>Роверы пропадают со временем</li>
                <li>До 250₽ — 15 сек</li>
                <li>250-500₽ — 10 сек</li>
                <li>500-1000₽ — 7 сек</li>
                <li>1000-2500₽ — 5 сек</li>
                <li>2500+₽ — 3 сек</li>
                <li>5 пропусков = конец игры</li>
              </ul>
              <p>⏱️ <strong>Классический:</strong></p>
              <ul>
                <li>30 секунд</li>
                <li>Роверы не пропадают</li>
              </ul>
              <p>🛵 <strong>Роверы:</strong></p>
              <ul>
                <li>🔴 Самокат: 1 тап = 1₽</li>
                <li>🟢 Лавка: 2 тапа = 2₽</li>
                <li>🟠 Доставка: 2 тапа = 2₽</li>
                <li>🔵 Яндекс: 3 тапа = 3₽</li>
              </ul>
            </div>
            <button className={styles.modalBtn} onClick={() => setShowRules(false)}>Понятно!</button>
          </div>
        </div>
      )}
    </div>
  )
}
