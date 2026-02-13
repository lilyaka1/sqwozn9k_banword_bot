import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../api/hooks'
import styles from './BlockBlast.module.css'

const GRID_SIZE = 8
const SCORE_TO_BALANCE_RATIO = 100 // 100 очков = 1₽

// Плитки с размерами для адаптивного алгоритма
const PIECES = [
  { id: 1, shape: [[1]], size: 1 },                           // tiny
  { id: 2, shape: [[1, 1]], size: 2 },                        // small
  { id: 3, shape: [[1], [1]], size: 2 },                      // small
  { id: 4, shape: [[1, 1], [1, 1]], size: 4 },                // medium
  { id: 5, shape: [[1, 1, 1]], size: 3 },                     // small
  { id: 6, shape: [[1], [1], [1]], size: 3 },                 // small
  { id: 7, shape: [[1, 1, 1], [1, 0, 0]], size: 4 },          // medium
  { id: 8, shape: [[1, 0], [1, 0], [1, 1]], size: 4 },        // medium
  { id: 9, shape: [[1, 1, 1], [0, 0, 1]], size: 4 },          // medium
  { id: 10, shape: [[0, 1], [0, 1], [1, 1]], size: 4 },       // medium
  { id: 11, shape: [[1, 1, 0], [0, 1, 1]], size: 4 },         // medium
  { id: 12, shape: [[0, 1], [1, 1], [1, 0]], size: 4 },       // medium
  { id: 13, shape: [[0, 1, 1], [1, 1, 0]], size: 4 },         // medium
  { id: 14, shape: [[1, 0], [1, 1], [0, 1]], size: 4 },       // medium
  { id: 15, shape: [[1, 1, 1], [0, 1, 0]], size: 4 },         // medium
  { id: 16, shape: [[0, 1], [1, 1], [0, 1]], size: 4 },       // medium
]

// Группы плиток по размеру
const TINY_PIECES = PIECES.filter(p => p.size === 1)   // 1 клетка
const SMALL_PIECES = PIECES.filter(p => p.size <= 3)   // 1-3 клетки
const MEDIUM_PIECES = PIECES.filter(p => p.size === 4) // 4 клетки

function BlockBlast() {
  const { player, updateBalance, saveGameResult } = useUser()
  const [grid, setGrid] = useState(() => 
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0))
  )
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => 
    parseInt(localStorage.getItem('bb_highscore')) || 0
  )
  const [combo, setCombo] = useState(0)
  const [pieces, setPieces] = useState([])
  const [gameOver, setGameOver] = useState(false)
  const [showCombo, setShowCombo] = useState(null)
  const [preview, setPreview] = useState({ cells: [], valid: false })
  const [clearingCells, setClearingCells] = useState([])
  const [dragPos, setDragPos] = useState(null) // Позиция курсора при перетаскивании
  const [draggingIndex, setDraggingIndex] = useState(null) // Индекс перетаскиваемой плитки
  const [showRules, setShowRules] = useState(false) // Показать правила
  const [balanceAdded, setBalanceAdded] = useState(0) // Заработок за игру
  
  const draggedPieceRef = useRef(null)
  const gridRef = useRef(null)

  // Сохранение лучшего результата
  useEffect(() => {
    if (score > best) {
      setBest(score)
      localStorage.setItem('bb_highscore', score)
    }
  }, [score, best])

  // Сохраняем баланс когда игра заканчивается
  useEffect(() => {
    if (gameOver && score > 0) {
      const earned = Math.floor(score / SCORE_TO_BALANCE_RATIO) // 100 очков = 1₽
      if (earned > 0) {
        setBalanceAdded(earned)
        updateBalance(earned)
        saveGameResult('block_blast', score)
      }
    }
  }, [gameOver])

  // Подсчёт свободных клеток
  const countFreeCells = (currentGrid) => {
    let count = 0
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentGrid[r][c] === 0) count++
      }
    }
    return count
  }

  // Адаптивный выбор плитки в зависимости от заполненности поля
  const pickAdaptivePiece = (currentGrid, usedIds = []) => {
    const freeCells = countFreeCells(currentGrid)
    const fillPercent = 1 - (freeCells / (GRID_SIZE * GRID_SIZE))
    
    let pool
    const rand = Math.random()
    
    if (fillPercent > 0.7) {
      // Очень мало места (>70% заполнено) — в основном мелкие
      if (rand < 0.6) pool = TINY_PIECES
      else if (rand < 0.9) pool = SMALL_PIECES
      else pool = MEDIUM_PIECES
    } else if (fillPercent > 0.5) {
      // Среднее заполнение (50-70%) — баланс в сторону мелких
      if (rand < 0.3) pool = TINY_PIECES
      else if (rand < 0.7) pool = SMALL_PIECES
      else pool = MEDIUM_PIECES
    } else if (fillPercent > 0.3) {
      // Мало заполнено (30-50%) — обычный баланс
      if (rand < 0.15) pool = TINY_PIECES
      else if (rand < 0.5) pool = SMALL_PIECES
      else pool = MEDIUM_PIECES
    } else {
      // Почти пусто (<30%) — больше средних для challenge
      if (rand < 0.1) pool = TINY_PIECES
      else if (rand < 0.35) pool = SMALL_PIECES
      else pool = MEDIUM_PIECES
    }
    
    // Исключаем уже использованные плитки
    const availablePieces = pool.filter(p => !usedIds.includes(p.id))
    
    if (availablePieces.length === 0) {
      // Если все плитки в пуле использованы, берём случайную
      return pool[Math.floor(Math.random() * pool.length)]
    }
    
    return availablePieces[Math.floor(Math.random() * availablePieces.length)]
  }

  // Spawn new pieces с адаптивным алгоритмом
  const spawnPieces = useCallback(() => {
    const newPieces = []
    const usedIds = []
    
    // Генерируем 3 разные плитки
    for (let i = 0; i < 3; i++) {
      const piece = pickAdaptivePiece(grid, usedIds)
      usedIds.push(piece.id)
      newPieces.push({ ...piece, used: false, key: Date.now() + Math.random() })
    }
    
    setPieces(newPieces)
  }, [grid])

  // Initialize game
  useEffect(() => {
    spawnPieces()
  }, [spawnPieces])

  // Check if piece can be placed
  const canPlace = (piece, row, col, currentGrid = grid) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] === 1) {
          const gr = row + r
          const gc = col + c
          if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false
          if (currentGrid[gr][gc] === 1) return false
        }
      }
    }
    return true
  }

  // Check game over
  const checkGameOver = useCallback((currentGrid, currentPieces) => {
    const unusedPieces = currentPieces.filter(p => !p.used)
    if (unusedPieces.length === 0) return false

    for (const piece of unusedPieces) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlace(piece, r, c, currentGrid)) return false
        }
      }
    }
    return true
  }, [])

  // Clear lines
  const clearLines = (currentGrid) => {
    const newGrid = currentGrid.map(row => [...row])
    const cellsToClear = []
    let linesCleared = 0

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
      if (newGrid[r].every(v => v === 1)) {
        linesCleared++
        for (let c = 0; c < GRID_SIZE; c++) {
          cellsToClear.push({ r, c })
        }
      }
    }

    // Check columns
    for (let c = 0; c < GRID_SIZE; c++) {
      if (newGrid.every(row => row[c] === 1)) {
        linesCleared++
        for (let r = 0; r < GRID_SIZE; r++) {
          if (!cellsToClear.find(cell => cell.r === r && cell.c === c)) {
            cellsToClear.push({ r, c })
          }
        }
      }
    }

    // Clear cells
    cellsToClear.forEach(({ r, c }) => {
      newGrid[r][c] = 0
    })

    return { newGrid, linesCleared, cellsToClear }
  }

  // Place piece
  const placePiece = (pieceIndex, row, col) => {
    const piece = pieces[pieceIndex]
    if (!canPlace(piece, row, col)) return false

    // Update grid
    const newGrid = grid.map(r => [...r])
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] === 1) {
          newGrid[row + r][col + c] = 1
        }
      }
    }

    // Calculate piece size
    const pieceSize = piece.shape.flat().filter(v => v === 1).length

    // Clear lines
    const { newGrid: clearedGrid, linesCleared, cellsToClear } = clearLines(newGrid)

    // Show clearing animation
    if (cellsToClear.length > 0) {
      setClearingCells(cellsToClear)
      setTimeout(() => setClearingCells([]), 400)
    }

    // Update score
    let newScore = score + pieceSize * 10
    let newCombo = combo

    if (linesCleared > 0) {
      newCombo += linesCleared  // Комбо увеличивается на количество очищенных линий
      newScore += linesCleared * 100 * (combo + 1)  // Используем текущее комбо
      setShowCombo(newCombo)
      setTimeout(() => setShowCombo(null), 1300)
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
    } else {
      newCombo = 0  // Сбрасываем комбо если нет очищенных линий
    }

    setScore(newScore)
    setCombo(newCombo)
    setGrid(clearedGrid)

    // Mark piece as used
    const newPieces = pieces.map((p, i) => 
      i === pieceIndex ? { ...p, used: true } : p
    )
    setPieces(newPieces)

    // Проверяем нужно ли обновить плитки - ТОЛЬКО когда ВСЕ 3 использованы
    const allUsed = newPieces.every(p => p.used)
    
    // Check game over с учётом оставшихся плиток
    setTimeout(() => {
      if (allUsed) {
        // Все плитки использованы - генерируем новые
        spawnPieces()
      } else if (checkGameOver(clearedGrid, newPieces)) {
        // Ещё есть плитки, но они не помещаются
        setGameOver(true)
      }
    }, 100)

    if (navigator.vibrate) navigator.vibrate(30)
    return true
  }

  // Get cell position from pointer
  const getCellFromPointer = (clientX, clientY) => {
    if (!gridRef.current) return null
    const cells = gridRef.current.querySelectorAll('[data-row]')
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        return {
          row: parseInt(cell.dataset.row),
          col: parseInt(cell.dataset.col)
        }
      }
    }
    return null
  }

  // Drag handlers
  const handlePointerMove = (e) => {
    if (!draggedPieceRef.current) return

    // Обновляем позицию курсора для визуального следования
    setDragPos({ x: e.clientX, y: e.clientY })

    const piece = pieces[draggedPieceRef.current.index]
    if (!piece) return

    const cell = getCellFromPointer(e.clientX, e.clientY)
    if (!cell) {
      setPreview({ cells: [], valid: false })
      return
    }

    // Calculate piece center
    const centerR = Math.floor(piece.shape.length / 2)
    const centerC = Math.floor(piece.shape[0].length / 2)
    const topR = cell.row - centerR
    const topC = cell.col - centerC

    const valid = canPlace(piece, topR, topC)
    const previewCells = []

    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] === 1) {
          const gr = topR + r
          const gc = topC + c
          if (gr >= 0 && gr < GRID_SIZE && gc >= 0 && gc < GRID_SIZE) {
            previewCells.push({ r: gr, c: gc })
          }
        }
      }
    }

    setPreview({ cells: previewCells, valid, row: topR, col: topC })
    draggedPieceRef.current.lastPreview = { valid, row: topR, col: topC }
  }

  const handlePointerUp = (e) => {
    if (!draggedPieceRef.current) return

    const { index, lastPreview } = draggedPieceRef.current
    
    if (lastPreview && lastPreview.valid) {
      placePiece(index, lastPreview.row, lastPreview.col)
    }

    draggedPieceRef.current = null
    setPreview({ cells: [], valid: false })
    setDragPos(null)
    setDraggingIndex(null)
  }

  useEffect(() => {
    const onMove = (e) => handlePointerMove(e)
    const onUp = (e) => handlePointerUp(e)
    
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  })

  const handlePiecePointerDown = (e, index) => {
    e.preventDefault()
    draggedPieceRef.current = { index, lastPreview: null }
    setDraggingIndex(index)
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  // Restart game
  const restartGame = () => {
    setGrid(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(0)))
    setScore(0)
    setCombo(0)
    setGameOver(false)
    spawnPieces()
  }

  // Check if cell is in preview
  const isCellInPreview = (r, c) => {
    return preview.cells.some(cell => cell.r === r && cell.c === c)
  }

  // Check if cell is clearing
  const isCellClearing = (r, c) => {
    return clearingCells.some(cell => cell.r === r && cell.c === c)
  }

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backBtn}>← Назад</Link>

      <header className={styles.header}>
        <h1 className={styles.headerTitle}>🎯 Block Blast</h1>
        <div className={styles.stats}>
          <div className={styles.stat}>
            Счёт: <span className={styles.statValue}>{score}</span>
          </div>
          <div className={styles.stat}>
            Лучший: <span className={styles.statValue}>{best}</span>
          </div>
          <div className={styles.stat}>
            Комбо: <span className={styles.statValue}>{combo}</span>
          </div>
        </div>
      </header>

      {/* Grid */}
      <div className={styles.gridWrap}>
        <div className={styles.grid} ref={gridRef}>
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                data-row={r}
                data-col={c}
                className={`
                  ${styles.cell}
                  ${cell === 1 ? styles.cellFilled : ''}
                  ${isCellInPreview(r, c) ? (preview.valid ? styles.cellPreview : styles.cellInvalid) : ''}
                  ${isCellClearing(r, c) ? styles.cellClearing : ''}
                `}
              />
            ))
          )}
        </div>
      </div>

      {/* Pieces */}
      <div className={styles.piecesWrap}>
        <div className={styles.pieces}>
          {pieces.map((piece, index) => (
            <div key={piece.key} className={styles.pieceSlot}>
              {!piece.used ? (
                <div
                  className={styles.piece}
                  onPointerDown={(e) => handlePiecePointerDown(e, index)}
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    opacity: draggingIndex === index ? 0.3 : 1,
                    transform: draggingIndex === index ? 'scale(0.9)' : 'scale(1)'
                  }}
                >
                  <div
                    className={styles.pieceGrid}
                    style={{ gridTemplateColumns: `repeat(${piece.shape[0].length}, 28px)` }}
                  >
                    {piece.shape.flat().map((val, i) => (
                      <div
                        key={i}
                        className={val === 1 ? styles.pieceCell : styles.pieceCellEmpty}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Использованная плитка - показываем пустой слот
                <div className={styles.pieceSlotEmpty} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dragging Piece - следует за курсором */}
      {dragPos && draggingIndex !== null && pieces[draggingIndex] && (
        <div 
          className={styles.draggingPiece}
          style={{
            left: dragPos.x,
            top: dragPos.y,
          }}
        >
          <div
            className={styles.pieceGrid}
            style={{ gridTemplateColumns: `repeat(${pieces[draggingIndex].shape[0].length}, 28px)` }}
          >
            {pieces[draggingIndex].shape.flat().map((val, i) => (
              <div
                key={i}
                className={val === 1 ? styles.pieceCell : styles.pieceCellEmpty}
              />
            ))}
          </div>
        </div>
      )}

      {/* Combo Indicator */}
      {showCombo && (
        <div className={styles.comboIndicator}>
          COMBO ×{showCombo}! 🔥
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Игра окончена! 🎮</h2>
            <p className={styles.modalText}>
              Ваш счёт: <strong>{score}</strong>
            </p>
            <p className={styles.modalText}>
              Лучший: <strong>{best}</strong>
            </p>
            {balanceAdded > 0 && (
              <div className={styles.balanceEarned}>
                +{balanceAdded}₽ на баланс
              </div>
            )}
            <button className={styles.btn} onClick={restartGame}>
              Играть снова
            </button>
          </div>
        </div>
      )}

      {/* Rules Button */}
      <button className={styles.rulesBtn} onClick={() => setShowRules(true)}>
        ❓ Правила
      </button>

      {/* Rules Modal */}
      {showRules && (
        <div className={styles.gameOverOverlay} onClick={() => setShowRules(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>📖 Правила Block Blast</h2>
            <div className={styles.rulesContent}>
              <p>🎯 <strong>Цель:</strong> набрать максимум очков!</p>
              <p>🧱 <strong>Как играть:</strong></p>
              <ul>
                <li>Перетаскивай плитки на поле</li>
                <li>Заполняй ряды и столбцы целиком</li>
                <li>Заполненные линии исчезают</li>
                <li>Новые плитки появляются когда использованы все 3</li>
              </ul>
              <p>💰 <strong>Баланс:</strong></p>
              <ul>
                <li>Каждые 100 очков = 1₽</li>
                <li>Комбо множит бонус!</li>
              </ul>
              <p>⚡ <strong>Советы:</strong></p>
              <ul>
                <li>Собирай комбо для ×2, ×3... очков</li>
                <li>Оставляй место для больших фигур</li>
              </ul>
            </div>
            <button className={styles.btn} onClick={() => setShowRules(false)}>
              Понятно!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BlockBlast
