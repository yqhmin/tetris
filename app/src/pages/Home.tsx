import { useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useTetris } from '../hooks/useTetris'
import { COLS, ROWS, COLORS, type PieceType, ghostY } from '../game/tetris'
import { Button } from '@/components/ui/button'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsDown,
  Pause,
  Play,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'

/** 支持按住连发的触屏按钮：按下立即触发，延迟 delay 后按 interval 连发 */
function HoldButton({
  onFire,
  repeat = true,
  delay = 180,
  interval = 55,
  className = '',
  children,
}: {
  onFire: () => void
  repeat?: boolean
  delay?: number
  interval?: number
  className?: string
  children: ReactNode
}) {
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({})

  const stop = () => {
    if (timers.current.delay) clearTimeout(timers.current.delay)
    if (timers.current.interval) clearInterval(timers.current.interval)
    timers.current = {}
  }

  useEffect(() => stop, [])

  return (
    <button
      type="button"
      className={`flex touch-none items-center justify-center rounded-md border border-slate-600 bg-slate-800/60 text-slate-200 select-none active:bg-slate-600 ${className}`}
      onPointerDown={(e) => {
        e.preventDefault()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* 合成事件或个别浏览器无 active pointer 时忽略 */
        }
        onFire()
        if (!repeat) return
        timers.current.delay = setTimeout(() => {
          onFire()
          timers.current.interval = setInterval(onFire, interval)
        }, delay)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

const NEXT_SHAPES: Record<PieceType, number[][]> = {
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 md:px-4 md:py-3">
      <div className="text-[10px] tracking-widest text-slate-400 md:text-xs">{label}</div>
      <div className="mt-0.5 font-mono text-base font-bold text-white tabular-nums md:mt-1 md:text-xl">{value}</div>
    </div>
  )
}

export default function Home() {
  const {
    board,
    piece,
    next,
    score,
    lines,
    level,
    status,
    clearingRows,
    highScore,
    soundOn,
    toggleSound,
    start,
    move,
    rotatePiece,
    softDrop,
    hardDrop,
    togglePause,
  } = useTetris()

  // 合并棋盘 + 当前方块 + 影子方块
  const cells = useMemo(() => {
    const grid: ({ type: PieceType; ghost: boolean } | null)[][] = board.map((row) =>
      row.map((t) => (t ? { type: t, ghost: false } : null))
    )
    if (piece && status !== 'ready') {
      const gy = ghostY(board, piece)
      const paint = (py: number, ghost: boolean) => {
        piece.shape.forEach((row, r) => {
          row.forEach((v, c) => {
            if (!v) return
            const y = py + r
            const x = piece.x + c
            if (y >= 0 && y < ROWS && x >= 0 && x < COLS && !grid[y][x]) {
              grid[y][x] = { type: piece.type, ghost }
            }
          })
        })
      }
      paint(gy, true)
      paint(piece.y, false)
    }
    return grid
  }, [board, piece, status])

  const nextShape = NEXT_SHAPES[next]

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/60 via-slate-950 to-slate-950 p-4 text-white select-none">
      <div className="flex flex-col items-center gap-2 md:gap-4">
        <h1 className="bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 bg-clip-text text-2xl font-black tracking-widest text-transparent md:text-3xl">
          俄罗斯方块
        </h1>

        <div className="flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-4">
          {/* 游戏区 */}
          <div className="relative rounded-2xl border border-slate-700/70 bg-slate-900/80 p-2 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]">
            <div
              className="tetris-board grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))` }}
            >
              {cells.flatMap((row, y) => {
                const clearing = clearingRows.includes(y)
                return row.map((cell, x) => (
                  <div
                    key={`${y}-${x}`}
                    className={`aspect-square rounded-[3px] ${clearing && cell ? 'row-clearing' : ''}`}
                    style={{
                      backgroundColor: cell
                        ? cell.ghost
                          ? 'transparent'
                          : COLORS[cell.type]
                        : 'rgba(30,41,59,0.6)',
                      border: cell?.ghost
                        ? `2px dashed ${COLORS[cell.type]}55`
                        : 'none',
                      boxShadow:
                        cell && !cell.ghost && !clearing ? `inset -2px -2px 0 rgba(0,0,0,0.3), inset 2px 2px 0 rgba(255,255,255,0.25)` : 'none',
                    }}
                  />
                ))
              })}
            </div>

            {/* 状态遮罩 */}
            {status !== 'playing' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-slate-950/80 backdrop-blur-sm">
                {status === 'ready' && (
                  <>
                    <div className="text-lg font-bold text-slate-200">准备开始</div>
                    <Button size="lg" onClick={start} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
                      <Play className="h-4 w-4" /> 开始游戏
                    </Button>
                    <div className="hidden text-xs text-slate-400 md:block">按 空格 / 回车 也可开始</div>
                  </>
                )}
                {status === 'paused' && (
                  <>
                    <div className="text-lg font-bold text-slate-200">已暂停</div>
                    <Button size="lg" onClick={togglePause} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
                      <Play className="h-4 w-4" /> 继续
                    </Button>
                  </>
                )}
                {status === 'over' && (
                  <>
                    <div className="text-xl font-black text-red-400">游戏结束</div>
                    <div className="font-mono text-slate-300">得分 {score}</div>
                    {score >= highScore && score > 0 && (
                      <div className="text-sm font-bold text-amber-300">🎉 新纪录！</div>
                    )}
                    <Button size="lg" onClick={start} className="gap-2 bg-indigo-600 hover:bg-indigo-500">
                      <RotateCw className="h-4 w-4" /> 再来一局
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 侧边栏（移动端横排紧凑卡片） */}
          <div className="flex w-full max-w-[340px] flex-row flex-wrap items-stretch justify-center gap-2 md:w-36 md:flex-col md:gap-3">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-2.5 py-1.5 md:px-4 md:py-3">
              <div className="text-[10px] tracking-widest text-slate-400 md:text-xs">下一个</div>
              <div className="mt-1 flex h-8 items-center justify-center md:mt-2 md:h-14">
                <div
                  className="grid gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${nextShape[0].length}, 12px)` }}
                >
                  {nextShape.flatMap((row, r) =>
                    row.map((v, c) => (
                      <div
                        key={`${r}-${c}`}
                        className="h-[12px] w-[12px] rounded-[2px] md:h-[14px] md:w-[14px]"
                        style={{
                          backgroundColor: v ? COLORS[next] : 'transparent',
                          boxShadow: v ? 'inset -1px -1px 0 rgba(0,0,0,0.3), inset 1px 1px 0 rgba(255,255,255,0.25)' : 'none',
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
            <StatCard label="得分" value={score} />
            <StatCard label="最高分" value={highScore} />
            <StatCard label="消除行数" value={lines} />
            <StatCard label="等级" value={level} />
            <Button
              variant="outline"
              onClick={status === 'playing' ? togglePause : start}
              className="gap-2 border-slate-600 bg-slate-800/60 px-3 text-slate-200 hover:bg-slate-700 md:px-4"
            >
              {status === 'playing' ? (
                <>
                  <Pause className="h-4 w-4" /> <span className="hidden md:inline">暂停</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> <span className="hidden md:inline">开始</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={toggleSound}
              className="gap-2 border-slate-600 bg-slate-800/60 px-3 text-slate-200 hover:bg-slate-700 md:px-4"
            >
              {soundOn ? (
                <>
                  <Volume2 className="h-4 w-4" /> <span className="hidden md:inline">音效开</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-4 w-4" /> <span className="hidden md:inline">音效关</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 触屏控制：左手十字方向键，右手旋转/硬降（支持按住连发） */}
        <div className="flex w-full max-w-[420px] items-end justify-between md:hidden">
          {/* 左手区：经典十字方向键（倒 T 形） */}
          <div className="grid grid-cols-3 gap-[4px]">
            <HoldButton className="h-14 w-14" onFire={() => move(-1)}>
              <ArrowLeft className="h-6 w-6" />
            </HoldButton>
            <div />
            <HoldButton className="h-14 w-14" onFire={() => move(1)}>
              <ArrowRight className="h-6 w-6" />
            </HoldButton>
            <div />
            <HoldButton className="h-14 w-14" onFire={softDrop} delay={120} interval={45}>
              <ArrowDown className="h-6 w-6" />
            </HoldButton>
            <div />
          </div>
          {/* 右手区：变化类（保持不变） */}
          <div className="flex items-center gap-3">
            <HoldButton className="h-16 w-16" onFire={rotatePiece} repeat={false}>
              <RotateCw className="h-6 w-6" />
            </HoldButton>
            <HoldButton className="h-16 w-16" onFire={hardDrop} repeat={false}>
              <ChevronsDown className="h-6 w-6" />
            </HoldButton>
          </div>
        </div>

        {/* 键盘说明 */}
        <div className="hidden gap-4 text-xs text-slate-500 md:flex">
          <span>← → 移动</span>
          <span>↑ 旋转</span>
          <span>↓ 软降</span>
          <span>空格 硬降</span>
          <span>P 暂停</span>
        </div>
      </div>
    </div>
  )
}
