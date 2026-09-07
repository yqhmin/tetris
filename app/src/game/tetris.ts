export const COLS = 10
export const ROWS = 20

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Board = (PieceType | null)[][]

export interface Piece {
  type: PieceType
  shape: number[][]
  x: number
  y: number
}

export const COLORS: Record<PieceType, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#c084fc',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
}

const SHAPES: Record<PieceType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<PieceType | null>(COLS).fill(null))
}

/** 7-bag 随机发牌器 */
export function createBag(): PieceType[] {
  const bag: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export function spawnPiece(type: PieceType): Piece {
  const shape = SHAPES[type].map((row) => [...row])
  return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 }
}

export function collides(board: Board, shape: number[][], px: number, py: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue
      const x = px + c
      const y = py + r
      if (x < 0 || x >= COLS || y >= ROWS) return true
      if (y >= 0 && board[y][x]) return true
    }
  }
  return false
}

export function rotate(shape: number[][]): number[][] {
  const n = shape.length
  const m = shape[0].length
  const out: number[][] = Array.from({ length: m }, () => Array(n).fill(0))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < m; c++) {
      out[c][n - 1 - r] = shape[r][c]
    }
  }
  return out
}

/** 旋转并尝试简单的墙踢（左右偏移） */
export function tryRotate(board: Board, piece: Piece): Piece {
  const rotated = rotate(piece.shape)
  for (const dx of [0, -1, 1, -2, 2]) {
    if (!collides(board, rotated, piece.x + dx, piece.y)) {
      return { ...piece, shape: rotated, x: piece.x + dx }
    }
  }
  return piece
}

export function ghostY(board: Board, piece: Piece): number {
  let y = piece.y
  while (!collides(board, piece.shape, piece.x, y + 1)) y++
  return y
}

/** 把方块合并进棋盘（不消行） */
export function mergePiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row])
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue
      const y = piece.y + r
      const x = piece.x + c
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = piece.type
    }
  }
  return next
}

export function findFullRows(board: Board): number[] {
  const rows: number[] = []
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r)
  }
  return rows
}

export function removeRows(board: Board, rows: number[]): Board {
  const drop = new Set(rows)
  const remaining = board.filter((_, r) => !drop.has(r)).map((row) => [...row])
  while (remaining.length < ROWS) remaining.unshift(Array<PieceType | null>(COLS).fill(null))
  return remaining
}

export const LINE_SCORES = [0, 100, 300, 500, 800]

export function levelFor(lines: number): number {
  return Math.floor(lines / 10) + 1
}

/** 每级下落间隔（毫秒），最快 80ms */
export function speedFor(level: number): number {
  return Math.max(80, 800 - (level - 1) * 70)
}
