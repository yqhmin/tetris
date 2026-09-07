import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type Board,
  type Piece,
  type PieceType,
  collides,
  createBag,
  emptyBoard,
  findFullRows,
  ghostY,
  levelFor,
  mergePiece,
  removeRows,
  spawnPiece,
  speedFor,
  tryRotate,
  LINE_SCORES,
} from '../game/tetris'
import { setSoundEnabled, sounds } from '../game/sound'

export type GameStatus = 'ready' | 'playing' | 'paused' | 'over'

interface GameState {
  board: Board
  piece: Piece | null
  next: PieceType
  score: number
  lines: number
  status: GameStatus
  /** 正在播放消除动画的行 */
  clearingRows: number[]
  /** 每开一局递增，防止旧局的延时回调污染新局 */
  epoch: number
}

const HIGH_SCORE_KEY = 'tetris-high-score'
const SOUND_KEY = 'tetris-sound-on'
const CLEAR_ANIM_MS = 240

function initialState(): GameState {
  return {
    board: emptyBoard(),
    piece: null,
    next: 'T',
    score: 0,
    lines: 0,
    status: 'ready',
    clearingRows: [],
    epoch: 0,
  }
}

/** 安全存储：file:// 或隐私模式下 localStorage 可能抛异常 */
const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* 忽略：无法持久化时游戏照常运行 */
    }
  },
}

export function useTetris() {
  const gameRef = useRef<GameState>(initialState())
  const [snap, setSnap] = useState<GameState>(gameRef.current)
  const [highScore, setHighScore] = useState<number>(() => {
    const v = Number(storage.get(HIGH_SCORE_KEY))
    return Number.isFinite(v) ? v : 0
  })
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    return storage.get(SOUND_KEY) !== '0'
  })
  const bagRef = useRef<PieceType[]>([])

  useEffect(() => {
    setSoundEnabled(soundOn)
    storage.set(SOUND_KEY, soundOn ? '1' : '0')
  }, [soundOn])

  const toggleSound = useCallback(() => setSoundOn((v) => !v), [])

  const commit = useCallback(() => {
    setSnap({ ...gameRef.current })
  }, [])

  const drawType = useCallback((): PieceType => {
    if (bagRef.current.length === 0) bagRef.current = createBag()
    return bagRef.current.pop()!
  }, [])

  const spawnNext = useCallback(() => {
    const g = gameRef.current
    const p = spawnPiece(g.next)
    g.next = drawType()
    if (collides(g.board, p.shape, p.x, p.y)) {
      g.piece = p
      g.status = 'over'
      sounds.over()
    } else {
      g.piece = p
    }
  }, [drawType])

  /** 当前方块落底：合并 → 有满行则播动画+音效后消行，否则直接出下一块 */
  const lockCurrent = useCallback(() => {
    const g = gameRef.current
    if (!g.piece) return
    g.board = mergePiece(g.board, g.piece)
    g.piece = null
    const rows = findFullRows(g.board)
    if (rows.length === 0) {
      sounds.lock()
      spawnNext()
      return
    }
    g.clearingRows = rows
    sounds.clear(rows.length)
    const epoch = g.epoch
    const linesBefore = g.lines
    const levelBefore = levelFor(linesBefore)
    setTimeout(() => {
      const g2 = gameRef.current
      if (g2.epoch !== epoch) return // 已重开
      g2.board = removeRows(g2.board, rows)
      g2.score += LINE_SCORES[rows.length] * levelBefore
      g2.lines += rows.length
      g2.clearingRows = []
      if (levelFor(g2.lines) > levelBefore) sounds.levelUp()
      if (g2.status === 'playing') spawnNext()
      commit()
    }, CLEAR_ANIM_MS)
  }, [spawnNext, commit])

  const start = useCallback(() => {
    bagRef.current = []
    const g = gameRef.current
    g.epoch++
    g.board = emptyBoard()
    g.score = 0
    g.lines = 0
    g.status = 'playing'
    g.clearingRows = []
    g.next = drawType()
    spawnNext()
    sounds.start()
    commit()
  }, [drawType, spawnNext, commit])

  /** 消行动画播放期间冻结操作 */
  const frozen = () => gameRef.current.clearingRows.length > 0

  const tick = useCallback(() => {
    const g = gameRef.current
    if (g.status !== 'playing' || !g.piece || frozen()) return
    if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
      g.piece = { ...g.piece, y: g.piece.y + 1 }
    } else {
      lockCurrent()
    }
    commit()
  }, [lockCurrent, commit])

  const level = levelFor(snap.lines)

  // 自动下落
  useEffect(() => {
    if (snap.status !== 'playing') return
    const id = setInterval(tick, speedFor(level))
    return () => clearInterval(id)
  }, [snap.status, level, tick])

  // 更新最高分
  useEffect(() => {
    if (snap.score > highScore) {
      setHighScore(snap.score)
      storage.set(HIGH_SCORE_KEY, String(snap.score))
    }
  }, [snap.score, highScore])

  const move = useCallback(
    (dx: number) => {
      const g = gameRef.current
      if (g.status !== 'playing' || !g.piece || frozen()) return
      if (!collides(g.board, g.piece.shape, g.piece.x + dx, g.piece.y)) {
        g.piece = { ...g.piece, x: g.piece.x + dx }
        sounds.move()
        commit()
      }
    },
    [commit]
  )

  const rotatePiece = useCallback(() => {
    const g = gameRef.current
    if (g.status !== 'playing' || !g.piece || frozen()) return
    const rotated = tryRotate(g.board, g.piece)
    if (rotated !== g.piece) {
      g.piece = rotated
      sounds.rotate()
      commit()
    }
  }, [commit])

  const softDrop = useCallback(() => {
    const g = gameRef.current
    if (g.status !== 'playing' || !g.piece || frozen()) return
    if (!collides(g.board, g.piece.shape, g.piece.x, g.piece.y + 1)) {
      g.piece = { ...g.piece, y: g.piece.y + 1 }
      g.score += 1
      sounds.softDrop()
      commit()
    } else {
      lockCurrent()
      commit()
    }
  }, [lockCurrent, commit])

  const hardDrop = useCallback(() => {
    const g = gameRef.current
    if (g.status !== 'playing' || !g.piece || frozen()) return
    const y = ghostY(g.board, g.piece)
    g.score += (y - g.piece.y) * 2
    g.piece = { ...g.piece, y }
    sounds.hardDrop()
    lockCurrent()
    commit()
  }, [lockCurrent, commit])

  const togglePause = useCallback(() => {
    const g = gameRef.current
    if (g.status === 'playing') {
      g.status = 'paused'
      sounds.pause()
    } else if (g.status === 'paused') {
      g.status = 'playing'
      sounds.pause()
    }
    commit()
  }, [commit])

  // 键盘控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault()
      }
      const s = gameRef.current.status
      if (s === 'ready' || s === 'over') {
        if (e.key === 'Enter' || e.key === ' ') start()
        return
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause()
        return
      }
      if (s !== 'playing') return
      switch (e.key) {
        case 'ArrowLeft':
          move(-1)
          break
        case 'ArrowRight':
          move(1)
          break
        case 'ArrowDown':
          softDrop()
          break
        case 'ArrowUp':
          rotatePiece()
          break
        case ' ':
          hardDrop()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, move, softDrop, rotatePiece, hardDrop, togglePause])

  return {
    board: snap.board,
    piece: snap.piece,
    next: snap.next,
    score: snap.score,
    lines: snap.lines,
    level,
    status: snap.status,
    clearingRows: snap.clearingRows,
    highScore,
    soundOn,
    toggleSound,
    start,
    move,
    rotatePiece,
    softDrop,
    hardDrop,
    togglePause,
  }
}
