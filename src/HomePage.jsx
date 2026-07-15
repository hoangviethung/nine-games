import { useEffect, useReducer, useRef, useState } from 'react'
import { useKeywords } from './useKeywords'
import { translations, LOCALES, LANGS, PRIMARY, tr } from './i18n'

const QUEUE_DEPTH = 3 // cards kept ready (top + 2 peeking behind)
const SWIPE_THRESHOLD = 110 // px past which a release commits the swipe
const HIST_KEY = 'gameHistoryIds' // keyed by keyword id (names are translatable)

// Card physics. Tuned to feel like a real playing card rather than a UI panel:
// a flicked card coasts away and is slowed by friction (ease-out with a long
// tail), while a released card settles back with a little weight and overshoot.
const FLY_MS = 520 // card flies off screen (skip)
const SETTLE_MS = 420 // card drops back into place / next card rises
const FLY_EASE = 'cubic-bezier(.25, .46, .45, .94)' // coast, then friction
const SETTLE_EASE = 'cubic-bezier(.34, 1.28, .64, 1)' // settle with slight overshoot
const FLY_TRANSITION =
  `transform ${FLY_MS}ms ${FLY_EASE}, box-shadow .3s ease, opacity ${FLY_MS}ms ease`
const SETTLE_TRANSITION =
  `transform ${SETTLE_MS}ms ${SETTLE_EASE}, box-shadow .3s ease, opacity ${SETTLE_MS}ms ease`

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

  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang')
    return LANGS.includes(saved) ? saved : PRIMARY
  })
  const t = translations[lang] || translations[PRIMARY]
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
    const inQueue = new Set(queueRef.current.map((r) => r.id))
    let guard = 0
    while (queueRef.current.length < QUEUE_DEPTH && guard < all.length * 2 + 5) {
      guard++
      if (bagRef.current.length === 0) {
        const eligible = all
          .map((_, i) => i)
          .filter((i) => !playedSet.has(all[i].id) && !inQueue.has(all[i].id))
        if (eligible.length === 0) break
        bagRef.current = shuffle(eligible)
      }
      const row = all[bagRef.current.shift()]
      if (playedSet.has(row.id) || inQueue.has(row.id)) continue
      queueRef.current.push(row)
      inQueue.add(row.id)
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
      playedRef.current = [...playedRef.current, playingRef.current.id]
      persist()
    }
    queueRef.current = queueRef.current.slice(1)
    playingRef.current = null
    phaseRef.current = 'swipe'
    refillQueue()
    forceRender()
  }
  function doRemove(id) {
    playedRef.current = playedRef.current.filter((n) => n !== id)
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
    // Advance only once the card has fully left, so it never pops out mid-flight.
    window.setTimeout(() => {
      leavingRef.current = null
      dragRef.current = { x: 0, y: 0, active: false }
      doSkip()
    }, FLY_MS)
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
    const lvlClass = 'lvl lvl-' + (row.levelId || '').toLowerCase()
    const main = tr(row.name, lang)
    // Show English underneath as a hint, except when English *is* the shown one.
    const sub = lang === PRIMARY ? '' : row.name?.[PRIMARY] || ''
    return (
      <>
        <div className="kw-card-head">
          <span className="kw-cat">{tr(row.category, lang)}</span>
          <span className={lvlClass}>{tr(row.level, lang)}</span>
        </div>
        <div className="kw-card-body">
          <div className="kw-main">{main}</div>
          {sub && sub !== main && <div className="kw-sub">{sub}</div>}
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
            {t.game.played}
            {played.length > 0 && <span className="hist-count">{played.length}</span>}
          </button>
          <div className="home-langs">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                className={'lang-chip' + (lang === l.code ? ' on' : '')}
                onClick={() => setLang(l.code)}
                title={l.label}
              >
                {l.short}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="home-stage">
        {error && <p className="home-msg">{t.errorPrefix} {error}</p>}
        {loading && !queue.length && <p className="home-msg">{t.loading}</p>}

        {phase === 'swipe' && empty && (
          <div className="deck-done">
            <div className="deck-done-emoji">🏁</div>
            <p>{t.game.allPlayed}</p>
            <button className="deal-btn" onClick={doReset}>
              {t.game.reset}
            </button>
          </div>
        )}

        {!empty && queue.length > 0 && (
          <div className="game">
            <div className={'stage-badge' + (playing ? ' show' : '')}>{t.game.nowPlaying}</div>

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
                    // Fly a bit past the edge and tumble further, like a real flick.
                    const x = leaving ? (window.innerWidth || 1000) * 1.15 : drag.x
                    const rot = leaving ? 26 : drag.x / 18
                    style = {
                      zIndex: 3,
                      transform: `translate(${x}px, ${drag.y}px) rotate(${rot}deg)`,
                      // 1:1 with the finger while dragging; weighty otherwise
                      transition: drag.active
                        ? 'none'
                        : leaving
                          ? FLY_TRANSITION
                          : SETTLE_TRANSITION,
                      cursor: playing ? 'default' : drag.active ? 'grabbing' : 'grab',
                    }
                  } else {
                    // peek up, blank back, fade out while a card is being played
                    style = {
                      zIndex: 3 - i,
                      transform: `translateY(${-i * 30}px) scale(${1 - i * 0.04})`,
                      opacity: playing ? 0 : 1,
                      transition: SETTLE_TRANSITION,
                    }
                  }
                  return (
                    <div
                      key={row.id}
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
                                {t.game.tagPlay}
                              </span>
                              <span
                                className="decision-tag skip"
                                style={{ opacity: decision === 'skip' ? decisionStrength : 0 }}
                              >
                                {t.game.tagSkip}
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

            <div className="game-controls">
              <div className={'swipe-actions' + (playing ? ' gone' : '')}>
                <button className="act act-skip" onClick={flingSkip}>
                  <span className="act-ico">✕</span>
                  {t.game.skip}
                </button>
                <button className="act act-play" onClick={pick}>
                  <span className="act-ico">▶</span>
                  {t.game.play}
                </button>
              </div>
              <button className={'finish-btn' + (playing ? ' show' : '')} onClick={doFinish}>
                {t.game.done}
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
              <h2>{t.game.played} ({played.length})</h2>
              <button className="hist-close" onClick={() => setHistOpen(false)}>✕</button>
            </div>
            {played.length === 0 ? (
              <p className="hist-empty">{t.game.noneYet}</p>
            ) : (
              <ul className="hist-list">
                {played.map((id) => {
                  const row = rows.find((r) => r.id === id)
                  const main = row ? tr(row.name, lang) : id
                  const sub = lang === PRIMARY ? '' : row?.name?.[PRIMARY] || ''
                  return (
                    <li key={id} className="hist-item">
                      <span className="hist-name">
                        {main}
                        {sub && sub !== main && <span className="hist-sub">{sub}</span>}
                      </span>
                      <button className="hist-del" onClick={() => doRemove(id)} aria-label={t.picker.remove}>✕</button>
                    </li>
                  )
                })}
              </ul>
            )}
            {played.length > 0 && (
              <button className="hist-reset" onClick={doReset}>
                {t.game.clearAll}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
