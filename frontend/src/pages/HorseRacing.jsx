import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../api/hooks'
import styles from './HorseRacing.module.css'

// Изображения роверов
import lavkaImg from '../assets/rovers/cutlavka.png'
import yandexImg from '../assets/rovers/cutyandex.png'
import deliveryImg from '../assets/rovers/cutdelivery.png'
import samokatImg from '../assets/rovers/cutsamokat.png'

const ROVERS = [
  { id: 1, name: 'Лавка', emoji: '🛵', color: '#5dade2', img: lavkaImg },
  { id: 2, name: 'Яндекс', emoji: '🛵', color: '#fbbf24', img: yandexImg },
  { id: 3, name: 'Delivery', emoji: '🛵', color: '#10b981', img: deliveryImg },
  { id: 4, name: 'Самокат', emoji: '🛵', color: '#a855f7', img: samokatImg }
]

const EXPRESS_CONFIG = {
  degenerate: { name: 'ДЕГЕНЕРАТ', places: 2, multiplier: 6.25, emoji: '🤡🤡' },
  addict: { name: 'НАРКОМАН', places: 3, multiplier: 15.6, emoji: '💊💊💊' },
  psycho: { name: 'ПСИХОПАТ', places: 4, multiplier: 39.1, emoji: '🔪🔪🔪🔪' }
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣']

function HorseRacing() {
  const { player, updateBalance: updateServerBalance, saveGameResult } = useUser()
  // State
  const [balance, setBalance] = useState(() => 
    parseInt(localStorage.getItem('rr_balance')) || 1000
  )
  const [wins, setWins] = useState(() => 
    parseInt(localStorage.getItem('rr_wins')) || 0
  )
  const [selectedRover, setSelectedRover] = useState(null)
  const [betAmount, setBetAmount] = useState(100)
  const [gamePhase, setGamePhase] = useState('betting') // betting, countdown, racing, results
  const [countdown, setCountdown] = useState(null)
  const [results, setResults] = useState([])
  const [winMessage, setWinMessage] = useState({ text: '', won: false })
  const [showBankrupt, setShowBankrupt] = useState(false)
  const [showRules, setShowRules] = useState(false)
  
  // Express
  const [showExpress, setShowExpress] = useState(false)
  const [expressMode, setExpressMode] = useState(null)
  const [expressPlaces, setExpressPlaces] = useState({})
  
  // Refs для гонки
  const trackRef = useRef(null)
  const roverRefs = useRef([])
  const positionsRef = useRef([0, 0, 0, 0])

  // Сохранение в localStorage
  useEffect(() => {
    localStorage.setItem('rr_balance', balance)
    localStorage.setItem('rr_wins', wins)
  }, [balance, wins])

  // Проверка банкротства
  useEffect(() => {
    if (balance === 0 && gamePhase === 'betting') {
      setTimeout(() => setShowBankrupt(true), 500)
    }
  }, [balance, gamePhase])

  const vibrate = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern)
  }

  const handleRoverSelect = (roverId) => {
    if (expressMode) return
    setSelectedRover(roverId)
    vibrate(30)
  }

  const handleBetPreset = (amount) => {
    if (amount > balance) {
      vibrate(50)
      return
    }
    setBetAmount(amount)
  }

  const handleAllIn = () => {
    if (balance === 0) return
    setBetAmount(balance)
  }

  const handleExpressToggle = () => {
    setShowExpress(!showExpress)
    if (showExpress) {
      setExpressMode(null)
      setExpressPlaces({})
    }
  }

  const handleExpressModeSelect = (mode) => {
    setExpressMode(mode)
    setExpressPlaces({})
    setSelectedRover(null)
  }

  const handlePlaceSelect = (place, roverId) => {
    const alreadySelected = Object.values(expressPlaces).includes(roverId)
    if (alreadySelected && expressPlaces[place] !== roverId) {
      vibrate(50)
      return
    }

    setExpressPlaces(prev => {
      if (prev[place] === roverId) {
        const newPlaces = { ...prev }
        delete newPlaces[place]
        return newPlaces
      }
      return { ...prev, [place]: roverId }
    })
  }

  const canStartRace = () => {
    if (betAmount > balance || balance === 0) return false
    if (expressMode) {
      const config = EXPRESS_CONFIG[expressMode]
      return Object.keys(expressPlaces).length === config.places
    }
    return selectedRover !== null
  }

  const startRace = async () => {
    if (!canStartRace()) {
      vibrate(100)
      return
    }

    // Снять ставку
    setBalance(prev => prev - betAmount)
    setGamePhase('countdown')

    // Countdown
    for (const num of ['3', '2', '1', 'GO!']) {
      setCountdown(num)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(null)

    // Начать гонку
    setGamePhase('racing')
    positionsRef.current = [0, 0, 0, 0]
    
    const trackWidth = trackRef.current?.offsetWidth || 400
    const finishLine = trackWidth - 110
    const speeds = ROVERS.map(() => 3 + Math.random() * 2)

    await new Promise(resolve => {
      const interval = setInterval(() => {
        let anyFinished = false
        
        positionsRef.current = positionsRef.current.map((pos, i) => {
          if (pos < finishLine) {
            const newPos = pos + speeds[i] * (0.9 + Math.random() * 0.2)
            if (roverRefs.current[i]) {
              roverRefs.current[i].style.left = (70 + newPos) + 'px'
            }
            if (newPos >= finishLine) anyFinished = true
            return newPos
          }
          anyFinished = true
          return pos
        })

        if (anyFinished) {
          clearInterval(interval)
          
          const raceResults = positionsRef.current
            .map((pos, i) => ({ roverId: i + 1, position: pos }))
            .sort((a, b) => b.position - a.position)
            .map(r => r.roverId)
          
          resolve(raceResults)
        }
      }, 30)
    }).then(raceResults => {
      processResults(raceResults)
    })
  }

  const processResults = (raceResults) => {
    setResults(raceResults)
    setGamePhase('results')

    let won = false
    let winnings = 0

    if (expressMode) {
      const config = EXPRESS_CONFIG[expressMode]
      let allCorrect = true

      for (let p = 1; p <= config.places; p++) {
        if (expressPlaces[p] !== raceResults[p - 1]) {
          allCorrect = false
          break
        }
      }

      if (allCorrect) {
        won = true
        winnings = Math.floor(betAmount * config.multiplier)
        setWinMessage({
          text: `${config.emoji} ${config.name}! ВСЕ УГАДАЛ! +${winnings}₽`,
          won: true
        })
        vibrate([50, 30, 50, 30, 50, 30, 100, 50, 100, 50, 200])
      } else {
        setWinMessage({
          text: `💀 Не угадал! Экспресс сгорел -${betAmount}₽`,
          won: false
        })
        vibrate([200, 100, 200])
      }
    } else {
      if (raceResults[0] === selectedRover) {
        won = true
        winnings = Math.floor(betAmount * 2.5)
        setWinMessage({
          text: `🎉 Победа! Выигрыш: +${winnings}₽`,
          won: true
        })
        vibrate([100, 50, 100, 50, 200])
      } else {
        setWinMessage({
          text: `😢 Проигрыш! -${betAmount}₽`,
          won: false
        })
        vibrate([200, 100, 200])
      }
    }

    if (won) {
      setBalance(prev => prev + winnings)
      setWins(prev => prev + 1)
      
      // Синхронизируем чистый выигрыш с сервером
      const netWin = winnings - betAmount
      if (netWin > 0) {
        updateServerBalance(netWin)
        saveGameResult('horse_racing', winnings)
      }
    }
  }

  const playAgain = () => {
    setGamePhase('betting')
    setSelectedRover(null)
    setResults([])
    setWinMessage({ text: '', won: false })
    
    // Сброс позиций роверов
    roverRefs.current.forEach(ref => {
      if (ref) ref.style.left = '70px'
    })
  }

  const restartGame = () => {
    setBalance(1000)
    setWins(0)
    setShowBankrupt(false)
    playAgain()
  }

  const quitGame = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close()
    } else {
      setShowBankrupt(false)
    }
  }

  const getExpressInfo = () => {
    if (!expressMode) return null
    const config = EXPRESS_CONFIG[expressMode]
    const selectedCount = Object.keys(expressPlaces).length
    const potentialWin = Math.floor(betAmount * config.multiplier)

    return (
      <div className={styles.expressInfo}>
        <span className={styles.expressInfoHighlight}>Выбрано: {selectedCount}/{config.places}</span><br />
        Множитель: <span className={styles.expressInfoHighlight}>×{config.multiplier}</span><br />
        Потенциальный выигрыш: <span className={styles.expressInfoHighlight}>{potentialWin}₽</span>
        {selectedCount < config.places && (
          <><br /><span style={{ color: '#ef4444' }}>⚠️ Выбери все {config.places} места!</span></>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backBtn}>← Назад</Link>

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>🛵 Rover Racing</h1>
        <div className={styles.stats}>
          <div className={styles.stat}>
            Баланс: <span className={styles.statValue}>{balance}</span>₽
          </div>
          <div className={styles.stat}>
            Выигрышей: <span className={styles.statValue}>{wins}</span>
          </div>
        </div>
      </header>

      {/* Betting Panel */}
      {gamePhase === 'betting' && (
        <div className={styles.betPanel}>
          <h2 className={styles.betTitle}>Выберите ровер и сделайте ставку</h2>
          
          {!expressMode && (
            <div className={styles.betGrid}>
              {ROVERS.map(rover => (
                <div
                  key={rover.id}
                  className={`${styles.betOption} ${selectedRover === rover.id ? styles.betOptionSelected : ''}`}
                  onClick={() => handleRoverSelect(rover.id)}
                >
                  <div className={styles.roverColor} style={{ background: rover.color }} />
                  <strong className={styles.roverName}>{rover.emoji} {rover.name}</strong>
                  <small className={styles.roverCoef}>Коэффициент: ×2.5</small>
                </div>
              ))}
            </div>
          )}

          <div className={styles.betAmount}>
            <label className={styles.betLabel}>Сумма ставки (₽)</label>
            <div className={styles.betControls}>
              {[100, 250, 500].map(amount => (
                <button
                  key={amount}
                  className={`${styles.betPreset} ${betAmount === amount ? styles.betPresetActive : ''}`}
                  onClick={() => handleBetPreset(amount)}
                >
                  {amount}₽
                </button>
              ))}
              <button
                className={`${styles.betPreset} ${styles.allIn}`}
                onClick={handleAllIn}
              >
                ALL IN �
              </button>
            </div>
            <input
              type="number"
              className={styles.betInput}
              value={betAmount}
              onChange={e => setBetAmount(Math.min(parseInt(e.target.value) || 10, balance))}
            />
          </div>

          {/* Express Toggle */}
          <button
            className={`${styles.expressToggle} ${showExpress ? styles.expressToggleActive : ''}`}
            onClick={handleExpressToggle}
          >
            <span className={styles.fire}>🔥</span>
            <span>КОНЧЕНЫЕ ЭКСПРЕССЫ</span>
            <span className={styles.fire}>🔥</span>
          </button>

          {/* Express Modes */}
          {showExpress && (
            <div className={styles.expressModes}>
              {Object.entries(EXPRESS_CONFIG).map(([key, config]) => (
                <div
                  key={key}
                  className={`${styles.expressMode} ${expressMode === key ? styles.expressModeActive : ''}`}
                  onClick={() => handleExpressModeSelect(key)}
                >
                  <div className={styles.expressModeTitle}>{config.name}</div>
                  <div className={styles.expressModeCoef}>×{config.multiplier}</div>
                  <div className={styles.expressModeDesc}>Топ-{config.places} места</div>
                </div>
              ))}
            </div>
          )}

          {/* Place Selector */}
          {expressMode && (
            <div className={styles.placeSelector}>
              {Array.from({ length: EXPRESS_CONFIG[expressMode].places }, (_, i) => i + 1).map(place => (
                <div key={place} style={{ marginBottom: 12 }}>
                  <div className={styles.placeSelectorTitle}>
                    {MEDALS[place - 1]} {place}-е место
                  </div>
                  <div className={styles.placesGrid}>
                    {ROVERS.map(rover => {
                      const isSelected = expressPlaces[place] === rover.id
                      const isUsed = Object.values(expressPlaces).includes(rover.id) && !isSelected
                      
                      return (
                        <div
                          key={rover.id}
                          className={`${styles.placeBtn} ${isSelected ? styles.placeBtnSelected : ''} ${isUsed ? styles.placeBtnDisabled : ''}`}
                          onClick={() => !isUsed && handlePlaceSelect(place, rover.id)}
                        >
                          <span className={styles.placeMedal}>{rover.emoji}</span>
                          <span className={styles.placeLabel}>{rover.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {expressMode && getExpressInfo()}

          <button
            className={styles.startBtn}
            onClick={startRace}
            disabled={!canStartRace()}
          >
            Начать забег 🏁
          </button>
        </div>
      )}

      {/* Race Track */}
      {(gamePhase === 'countdown' || gamePhase === 'racing') && (
        <div className={styles.trackWrap}>
          <div className={styles.track} ref={trackRef}>
            <div className={styles.startLine} />
            <div className={styles.finishLine} />

            {ROVERS.map((rover, i) => (
              <div key={rover.id} className={`${styles.lane} ${styles[`lane${i + 1}`]}`}>
                <div className={`${styles.laneNumber} ${styles[`laneNumber${i + 1}`]}`}>{i + 1}</div>
                <div
                  ref={el => roverRefs.current[i] = el}
                  className={`${styles.rover} ${gamePhase === 'racing' ? styles.roverRunning : ''}`}
                >
                  <img src={rover.img} alt={rover.name} className={styles.roverImg} />
                </div>
              </div>
            ))}

            {countdown && <div className={styles.countdown}>{countdown}</div>}
          </div>
        </div>
      )}

      {/* Results */}
      {gamePhase === 'results' && (
        <div className={styles.results}>
          <div className={`${styles.winMessage} ${winMessage.won ? styles.winMessageWon : styles.winMessageLost}`}>
            {winMessage.text}
          </div>

          {results.map((roverId, index) => {
            const rover = ROVERS.find(r => r.id === roverId)
            const isWinner = !expressMode && roverId === selectedRover && index === 0
            
            return (
              <div
                key={roverId}
                className={`${styles.resultItem} ${isWinner ? styles.resultItemWinner : ''}`}
              >
                <span className={styles.resultMedal}>{MEDALS[index]}</span>
                <span className={styles.resultName}>{rover.name}</span>
                <span className={styles.resultEmoji}>{rover.emoji}</span>
              </div>
            )
          })}

          <button className={styles.startBtn} onClick={playAgain}>
            Играть снова 🎰
          </button>
        </div>
      )}

      {/* Bankrupt Modal */}
      {showBankrupt && (
        <div className={styles.bankruptOverlay}>
          <div className={styles.bankruptContent}>
            <div className={styles.bankruptEmoji}>💸</div>
            <div className={styles.bankruptTitle}>ТЫ ВСЁ ПРОЕБАЛ!</div>
            <div className={styles.bankruptMessage}>
              Баланс: <strong style={{ color: '#ef4444' }}>0₽</strong><br />
              Поздравляем, ты настоящий дегенерат! 🎰<br />
              Начать заново?
            </div>
            <div className={styles.bankruptActions}>
              <button
                className={`${styles.bankruptBtn} ${styles.bankruptBtnRestart}`}
                onClick={restartGame}
              >
                ДОДЕП 🔄
              </button>
              <button
                className={`${styles.bankruptBtn} ${styles.bankruptBtnQuit}`}
                onClick={quitGame}
              >
                Выйти 😢
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Button */}
      <button className={styles.rulesBtn} onClick={() => setShowRules(true)}>
        ❓ Правила
      </button>

      {/* Rules Modal */}
      {showRules && (
        <div className={styles.bankruptOverlay} onClick={() => setShowRules(false)}>
          <div className={styles.bankruptContent} onClick={e => e.stopPropagation()}>
            <h2 className={styles.rulesTitle}>📖 Правила Rover Racing</h2>
            <div className={styles.rulesContent}>
              <p>🎯 <strong>Цель:</strong> угадай победителя гонки!</p>
              <p>🛵 <strong>Обычная ставка:</strong></p>
              <ul>
                <li>Выбери ровера и размер ставки</li>
                <li>Победа = ставка × 4</li>
              </ul>
              <p>🔥 <strong>Экспресс режимы:</strong></p>
              <ul>
                <li>🤡 ДЕГЕНЕРАТ: угадай топ-2 (×6.25)</li>
                <li>💊 НАРКОМАН: угадай топ-3 (×15.6)</li>
                <li>🔪 ПСИХОПАТ: угадай все 4 (×39.1)</li>
              </ul>
              <p>💡 <strong>Совет:</strong> начни с обычных ставок!</p>
            </div>
            <button 
              className={`${styles.bankruptBtn} ${styles.bankruptBtnRestart}`}
              onClick={() => setShowRules(false)}
            >
              Понятно!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default HorseRacing
