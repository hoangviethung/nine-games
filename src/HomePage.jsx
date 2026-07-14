import { useEffect, useReducer, useRef, useState } from 'react'
import { useKeywords } from './useKeywords'
import { translations } from './i18n'

const QUEUE_DEPTH = 3 // cards kept ready (top + 2 peeking behind)
const SWIPE_THRESHOLD = 110 // px past which a release commits the swipe
const HIST_KEY = 'gameHistory'
const CARD_TRANSITION =
  'transform .32s cubic-bezier(.22,.61,.36,1), box-shadow .3s ease, opacity .3s ease'

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadHistory() {
  try {
    const a = JSON.parse(localStorage.getItem(HIST_KEY) || '[]')
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

export default function HomePage() {
  const { rows, loading, error } = useKeywords()

  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const t = translations[lang] || translations.en
  const vi = lang === 'vi'
  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  // --- Game state lives in refs (randomised draws stay out of render) ---
  const [, forceRender] = useReducer((n) => n + 1, 0)
  const rowsRef = useRef([])
  const bagRef = useRef([]) // shuffled indices left to draw
  const queueRef = useRef([]) // upcoming card rows (top = [0])
  const playedRef = useRef([]) // english names, persisted
  const phaseRef = useRef('swipe') // 'swipe' | 'playing'
  const playingRef = useRef(null)

  function persist() {
    localStorage.setItem(HIST_KEY, JSON.stringify(playedRef.current))
  }

  function refillQueue() {
    const all = rowsRef.current
    const playedSet = new Set(playedRef.current)
    const inQueue = new Set(queueRef.current.map((r) => r.english))
    let guard = 0
    while (queueRef.current.length < QUEUE_DEPTH && guard < all.length * 2 + 5) {
      guard++
      if (bagRef.current.length === 0) {
        const eligible = all
          .map((_, i) => i)
          .filter((i) => !playedSet.has(all[i].english) && !inQueue.has(all[i].english))
        if (eligible.length === 0) break
        bagRef.current = shuffle(eligible)
      }
      const row = all[bagRef.current.shift()]
      if (playedSet.has(row.english) || inQueue.has(row.english)) continue
      queueRef.current.push(row)
      inQueue.add(row.english)
    }
  }

  function initGame(data) {
    rowsRef.current = data
    playedRef.current = loadHistory()
    bagRef.current = []
    queueRef.current = []
    phaseRef.current = 'swipe'
    playingRef.current = null
    refillQueue()
    forceRender()
  }
  function doSkip() {
    queueRef.current = queueRef.current.slice(1)
    refillQueue()
    forceRender()
  }
  function doPick() {
    if (!queueRef.current.length) return
    playingRef.current = queueRef.current[0]
    phaseRef.current = 'playing'
    forceRender()
  }
  function doFinish() {
    if (playingRef.current) {
      playedRef.current = [...playedRef.current, playingRef.current.english]
      persist()
    }
    queueRef.current = queueRef.current.slice(1)
    playingRef.current = null
    phaseRef.current = 'swipe'
    refillQueue()
    forceRender()
  }
  function doRemove(name) {
    playedRef.current = playedRef.current.filter((n) => n !== name)
    persist()
    forceRender()
  }
  function doReset() {
    playedRef.current = []
    persist()
    bagRef.current = []
    queueRef.current = []
    playingRef.current = null
    phaseRef.current = 'swipe'
    refillQueue()
    forceRender()
  }

  useEffect(() => {
    if (rows.length) initGame(rows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const queue = queueRef.current
  const played = playedRef.current
  const phase = phaseRef.current
  const empty = rows.length > 0 && phase === 'swipe' && queue.length === 0

  const [histOpen, setHistOpen] = useState(false)

  // ---- swipe / drag handling (ref-based to avoid stale closures) ----
  const dragRef = useRef({ x: 0, y: 0, active: false })
  const leavingRef = useRef(null) // 'right' only (skip flies off); pick stays in place
  const startRef = useRef({ x: 0, y: 0 })

  // Skip: fling the card off to the right, then advance.
  function flingSkip() {
    if (leavingRef.current || phaseRef.current !== 'swipe' || !queueRef.current.length) return
    leavingRef.current = 'right'
    dragRef.current = { x: 0, y: 0, active: false }
    forceRender()
    window.setTimeout(() => {
      leavingRef.current = null
      dragRef.current = { x: 0, y: 0, active: false }
      doSkip()
    }, 300)
  }
  // Play: the card settles back to centre and morphs into the playing card.
  function pick() {
    if (leavingRef.current || phaseRef.current !== 'swipe' || !queueRef.current.length) return
    dragRef.current = { x: 0, y: 0, active: false }
    doPick()
  }

  function onPointerDown(e) {
    if (leavingRef.current || phaseRef.current !== 'swipe') return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
    dragRef.current = { x: 0, y: 0, active: true }
    forceRender()
  }
  function onPointerMove(e) {
    if (!dragRef.current.active) return
    dragRef.current = {
      active: true,
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    }
    forceRender()
  }
  function onPointerUp() {
    if (!dragRef.current.active) return
    const dx = dragRef.current.x
    dragRef.current = { x: 0, y: 0, active: false }
    if (dx < -SWIPE_THRESHOLD) pick()
    else if (dx > SWIPE_THRESHOLD) flingSkip()
    else forceRender()
  }

  // Keyboard: ← play, → skip.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') pick()
      else if (e.key === 'ArrowRight') flingSkip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = dragRef.current
  const leaving = leavingRef.current
  const decision = drag.x < 0 ? 'play' : drag.x > 0 ? 'skip' : null
  const decisionStrength = Math.min(1, Math.abs(drag.x) / (SWIPE_THRESHOLD * 1.2))
  const playing = phase === 'playing'

  function cardFace(row, footer) {
    const lvlClass = 'lvl lvl-' + (row.level || '').toLowerCase()
    return (
      <>
        <div className="kw-card-head">
          <span className="kw-cat">{vi ? row.categoryVi : row.category}</span>
          <span className={lvlClass}>{vi ? row.levelVi : t.levels[row.level] || row.level}</span>
        </div>
        <div className="kw-card-body">
          <div className="kw-main">{vi ? row.vietnamese : row.english}</div>
          <div className="kw-sub">{vi ? row.english : row.vietnamese}</div>
        </div>
        {footer}
      </>
    )
  }

  return (
    <div className="home">
      <header className="home-top">
        <div className="home-brand">
          <img src="/logo.svg" alt="Nine Games" className="home-wordmark" />
        </div>
        <div className="home-actions">
          <button className="hist-btn" onClick={() => setHistOpen(true)}>
            <span className="hist-ico">🗂️</span>
            {vi ? 'Đã chơi' : 'Played'}
            {played.length > 0 && <span className="hist-count">{played.length}</span>}
          </button>
          <div className="home-langs">
            <button className={'lang-chip' + (lang === 'en' ? ' on' : '')} onClick={() => setLang('en')}>EN</button>
            <button className={'lang-chip' + (lang === 'vi' ? ' on' : '')} onClick={() => setLang('vi')}>VI</button>
          </div>
        </div>
      </header>

      <div className="home-stage">
        {error && <p className="home-msg">{t.errorPrefix} {error}</p>}
        {loading && !queue.length && <p className="home-msg">{t.loading}</p>}

        {phase === 'swipe' && empty && (
          <div className="deck-done">
            <div className="deck-done-emoji">🏁</div>
            <p>{vi ? 'Đã chơi hết từ khóa!' : 'Every keyword played!'}</p>
            <button className="deal-btn" onClick={doReset}>
              {vi ? 'Chơi lại' : 'Reset game'}
            </button>
          </div>
        )}

        {!empty && queue.length > 0 && (
          <div className="game">
            <div className={'stage-badge' + (playing ? ' show' : '')}>
              {vi ? 'ĐANG DIỄN' : 'NOW PLAYING'}
            </div>

            <div className="deck">
              {queue
                .slice(0, QUEUE_DEPTH)
                .map((row, i) => ({ row, i }))
                .reverse()
                .map(({ row, i }) => {
                  const isTop = i === 0
                  const draggable = isTop && !playing
                  let style
                  if (isTop) {
                    const x = leaving ? (window.innerWidth || 1000) : drag.x
                    const rot = leaving ? 18 : drag.x / 18
                    style = {
                      zIndex: 3,
                      transform: `translate(${x}px, ${drag.y}px) rotate(${rot}deg)`,
                      transition: drag.active && !leaving ? 'none' : CARD_TRANSITION,
                      cursor: playing ? 'default' : drag.active ? 'grabbing' : 'grab',
                    }
                  } else {
                    // peek up, blank back, fade out while a card is being played
                    style = {
                      zIndex: 3 - i,
                      transform: `translateY(${-i * 30}px) scale(${1 - i * 0.04})`,
                      opacity: playing ? 0 : 1,
                      transition: CARD_TRANSITION,
                    }
                  }
                  return (
                    <div
                      key={row.english}
                      className={
                        'kw-card' + (isTop ? ' top' : ' back') + (isTop && playing ? ' is-playing' : '')
                      }
                      style={style}
                      onPointerDown={draggable ? onPointerDown : undefined}
                      onPointerMove={draggable ? onPointerMove : undefined}
                      onPointerUp={draggable ? onPointerUp : undefined}
                      onPointerCancel={draggable ? onPointerUp : undefined}
                    >
                      {isTop ? (
                        cardFace(
                          row,
                          !playing && (
                            <>
                              <span
                                className="decision-tag play"
                                style={{ opacity: decision === 'play' ? decisionStrength : 0 }}
                              >
                                {vi ? 'CHƠI' : 'PLAY'}
                              </span>
                              <span
                                className="decision-tag skip"
                                style={{ opacity: decision === 'skip' ? decisionStrength : 0 }}
                              >
                                {vi ? 'BỎ QUA' : 'SKIP'}
                              </span>
                            </>
                          )
                        )
                      ) : (
                        <div className="card-back">
                          <img src="/favicon.svg" className="card-back-logo" alt="" />
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>

            <div className="controls">
              <div className={'swipe-actions' + (playing ? ' gone' : '')}>
                <button className="act act-skip" onClick={flingSkip}>
                  <span className="act-ico">✕</span>
                  {vi ? 'Bỏ qua' : 'Skip'}
                </button>
                <button className="act act-play" onClick={pick}>
                  <span className="act-ico">▶</span>
                  {vi ? 'Chơi từ này' : 'Play this'}
                </button>
              </div>
              <button className={'finish-btn' + (playing ? ' show' : '')} onClick={doFinish}>
                {vi ? 'Xong, tiếp theo' : 'Done — next'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History panel */}
      {histOpen && (
        <div className="hist-overlay" onClick={() => setHistOpen(false)}>
          <div className="hist-panel" onClick={(e) => e.stopPropagation()}>
            <div className="hist-head">
              <h2>{vi ? 'Đã chơi' : 'Played'} ({played.length})</h2>
              <button className="hist-close" onClick={() => setHistOpen(false)}>✕</button>
            </div>
            {played.length === 0 ? (
              <p className="hist-empty">{vi ? 'Chưa có từ nào.' : 'No keywords played yet.'}</p>
            ) : (
              <ul className="hist-list">
                {played.map((name) => {
                  const row = rows.find((r) => r.english === name)
                  return (
                    <li key={name} className="hist-item">
                      <span className="hist-name">
                        {vi ? row?.vietnamese || name : name}
                        <span className="hist-sub">{vi ? name : row?.vietnamese || ''}</span>
                      </span>
                      <button className="hist-del" onClick={() => doRemove(name)} aria-label="remove">✕</button>
                    </li>
                  )
                })}
              </ul>
            )}
            {played.length > 0 && (
              <button className="hist-reset" onClick={doReset}>
                {vi ? 'Xóa tất cả / chơi lại' : 'Clear all / reset'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
