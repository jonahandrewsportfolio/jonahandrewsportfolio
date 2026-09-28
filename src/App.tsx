import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
// Marker images are bundled with the site (nothing is loaded from another website).
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png'
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

/* ─── Fix Leaflet default marker icons ─────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

/* ─── Types ─────────────────────────────────────────────── */
type Page = 'home' | 'apps' | 'scripts' | 'photos' | 'app-detail' | 'script-detail'
type Photo = {
  file: string
  url: string // full-size image (shown in the lightbox)
  thumb: string // small image (grid + map popups)
  alt: string
  description: string // the raw alt text as written in photo-details.json, empty if none — used for the lightbox caption toggle
  location: string
  lat: number | null
  lng: number | null
  tags: string[]
  thumbCropY: number | null // 0–1: where the grid thumbnail's crop starts (top to bottom); null = default centred crop
}

/* ─── Responsive hook ───────────────────────────────────── */
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const handler = () => setW(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return w
}

/* ─── Asset paths ───────────────────────────────────────────
   Prefixes a public-folder path with the site's base URL so images work
   whether the site lives at the root (username.github.io) or in a
   sub-folder (username.github.io/repo-name/).
   Usage: asset('/screenshots/apps/x/1.jpg')  or  asset('icons/x.png')
   ─────────────────────────────────────────────────────────── */
const BASE_URL: string = ((import.meta as any).env?.BASE_URL as string | undefined) ?? '/'
const asset = (path: string) => BASE_URL.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '')

// ─── BIO BACKGROUND PHOTOS ─────────────────────────────────────────────────────
// Drop images (jpg, png, webp…) into  public/biopics/  — any file names work.
// They cycle behind your bio and profile picture, in alphabetical order.
// Tip: landscape images around 1600×900 px and under ~500 KB each load fastest.
// (A list of the files is generated automatically when the site is built.)
// ──────────────────────────────────────────────────────────────────────────────

/* ─── Data ─────────────────────────────────────────────── */

// ─── SCREENSHOT FOLDERS ────────────────────────────────────────────────────────
// Drop your screenshot images into the matching folder under /public/screenshots/.
// Use VERTICAL (portrait) iPhone screenshots for apps — e.g. 390×844 px, JPG or PNG.
// Use portrait script-page images for scripts — e.g. 850×1100 px, JPG or PNG.
// Name them 1.jpg, 2.jpg, 3.jpg, 4.jpg … in the order you want them displayed.
// App screenshots cycle through pairs of two every 5 seconds.
// Script screenshots cycle one page at a time every 9 seconds.
//
// Folder layout:
//   public/screenshots/apps/sketch-press/1.jpg  2.jpg  3.jpg  4.jpg
//   public/screenshots/apps/bible-bison/1.jpg   2.jpg  3.jpg  4.jpg
//   public/screenshots/scripts/camp-moolah/1.jpg 2.jpg  3.jpg  4.jpg
// ──────────────────────────────────────────────────────────────────────────────

const APPS = [
  {
    id: 'sketch-press',
    name: 'Sketch Press',
    initial: 'SP',
    color: '#1a3a5c',
    accent: '#4a9eff',
    tagline: 'Balls-to-the-Wall Endless Fun',
    description:
      'Bounce into a world of fun. Join the Ballerz, an international team of balls, whose mission is to stop the evil Polytrons from taking over the world! Jump around, draw lines, collect coins, dodge enemies, and try to survive. With over 70+ balls and 30+ themes to collect, you\'re bound to be completely hooked on this free, offline adventure.',
    platforms: ['iOS', 'iPadOS'],
    year: '2026',
    appStoreUrl: 'https://apps.apple.com/us/app/sketch-press/id6799782916', // ← replace with your real App Store link
    screenshots: [
      asset('/screenshots/apps/sketch-press/1.PNG'),
      asset('/screenshots/apps/sketch-press/2.PNG'),
      asset('/screenshots/apps/sketch-press/3.PNG'),
      asset('/screenshots/apps/sketch-press/4.PNG'),
      asset('/screenshots/apps/sketch-press/5.PNG'),
      asset('/screenshots/apps/sketch-press/6.PNG'),
      asset('/screenshots/apps/sketch-press/7.PNG'),
      asset('/screenshots/apps/sketch-press/8.PNG'),
    ],
  },
  {
    id: 'bible-bison',
    name: 'Bible Bison',
    initial: 'BB',
    color: '#1a3a1f',
    accent: '#4caf72',
    tagline: 'Daily Verse & Christian Chat',
    description:
      'Bible Bison is a daily scripture app that allows you to discuss verses with other people from around the world. Every day, users receive a featured Bible verse and can instantly connect with another person for a private, one-on-one conversation about faith, life, scripture, and personal reflection. Designed to encourage meaningful conversations without the pressure of social media, Bible Bison creates a calm and welcoming space for anyone to connect through God\'s word.',
    platforms: ['iOS', 'iPadOS'],
    year: '2026',
    appStoreUrl: 'https://apps.apple.com/us/app/bible-bison/id6771197860', // ← replace with your real App Store link
    screenshots: [
      asset('/screenshots/apps/bible-bison/1.PNG'),
      asset('/screenshots/apps/bible-bison/2.PNG'),
      asset('/screenshots/apps/bible-bison/3.PNG'),
      asset('/screenshots/apps/bible-bison/4.PNG'),
    ],
  },
]

const SCRIPTS = [
  {
    id: 'camp-moolah',
    name: 'Camp Moolah',
    // ← The label shown under the cover in the Scripts grid. Leave it as `undefined` to
    // just reuse the name above (the old behaviour); set your own text to show something
    // different there; or set it to '' (empty quotes) to remove the label entirely.
    // Default value was -> undefined as string | undefined
    listLabel: '',
    genre: 'Comedy',
    logline: 'After an accident at work leads to a pizza delivery guy going viral online, a Hollywood cult invites him on their weekend retreat and promises to make him a star.',
    pages: 144,
    year: '2026',
    color: '#2a1a0a',
    accent: '#d4a843',
    description:
      "Pete Peterson is a poor young man who wants nothing more than to provide for his elderly aunt. Days before being evicted from his home, an opportunity of a lifetime falls into his lap and he must ask himself what wealth is really worth.",
    scriptUrl: '/coming-soon.html', // ← replace with a link to read/download the full script (PDF, Google Drive, etc.)
    screenshots: [
      asset('/screenshots/scripts/camp-moolah/1.png'),
      asset('/screenshots/scripts/camp-moolah/2.png'),
      asset('/screenshots/scripts/camp-moolah/3.png'),
      asset('/screenshots/scripts/camp-moolah/4.png'),
      asset('/screenshots/scripts/camp-moolah/5.png'),
      asset('/screenshots/scripts/camp-moolah/6.png'),
    ],
  },
]

/* ─── Code Animation (Apps background) ─────────────────── */
const CODE_LINES = [
  'import React, { useState } from "react"',
  '',
  'interface AppProps {',
  '  name: string',
  '  version: string',
  '}',
  '',
  'function SketchPress({ name, version }: AppProps) {',
  '  const [canvas, setCanvas] = useState(null)',
  '  const [brushSize, setBrushSize] = useState(4)',
  '  const [color, setColor] = useState("#000000")',
  '',
  '  const handleDraw = useCallback((e: PointerEvent) => {',
  '    if (!canvas) return',
  '    const ctx = canvas.getContext("2d")',
  '    ctx.beginPath()',
  '    ctx.arc(e.x, e.y, brushSize, 0, Math.PI * 2)',
  '    ctx.fillStyle = color',
  '    ctx.fill()',
  '  }, [canvas, brushSize, color])',
  '',
  '  useEffect(() => {',
  '    window.addEventListener("pointermove", handleDraw)',
  '    return () => window.removeEventListener("pointermove", handleDraw)',
  '  }, [handleDraw])',
  '',
  '  return (',
  '    <div className="sketch-canvas">',
  '      <canvas ref={setCanvas} />',
  '      <Toolbar brushSize={brushSize} color={color} />',
  '    </div>',
  '  )',
  '}',
  '',
  'export default SketchPress',
]

function CodeAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef({ lineIdx: 0, charIdx: 0, lines: [] as string[], scroll: 0, tick: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const lineH = 22
    const padL = 56
    const padT = 24
    const fontSize = 13

    const KEYWORD = '#c792ea'
    const STRING = '#c3e88d'
    const COMMENT = '#546e7a'
    const PUNCT = '#89ddff'
    const DEFAULT = '#d0d0d8'
    const GUTTER = '#3a3a4a'
    const LINE_NUM = '#4a4a6a'

    function tokenize(line: string): { text: string; color: string }[] {
      if (line.trim().startsWith('//')) return [{ text: line, color: COMMENT }]
      const tokens: { text: string; color: string }[] = []
      const keywords = /\b(import|from|function|const|let|return|if|interface|useCallback|useEffect|useState|export|default|null)\b/g
      let last = 0
      let m: RegExpExecArray | null
      const re = /(".*?"|'.*?'|`.*?`|\b(import|from|function|const|let|return|if|interface|useCallback|useEffect|useState|export|default|null)\b|[{}[\]()<>:,;.])/g
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: DEFAULT })
        const t = m[0]
        if (/^["'`]/.test(t)) tokens.push({ text: t, color: STRING })
        else if (keywords.test(t)) { keywords.lastIndex = 0; tokens.push({ text: t, color: KEYWORD }) }
        else tokens.push({ text: t, color: PUNCT })
        last = m.index + t.length
      }
      if (last < line.length) tokens.push({ text: line.slice(last), color: DEFAULT })
      return tokens
    }

    let lastTime = 0
    const CHAR_DELAY = 28

    function draw(ts: number) {
      const st = stateRef.current
      const W = canvas!.offsetWidth
      const H = canvas!.offsetHeight
      ctx.clearRect(0, 0, W, H)

      // background
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, W, H)

      // gutter bg
      ctx.fillStyle = '#0b0f15'
      ctx.fillRect(0, 0, padL - 8, H)
      ctx.fillStyle = GUTTER
      ctx.fillRect(padL - 9, 0, 1, H)

      ctx.font = `${fontSize}px "JetBrains Mono", "Fira Code", monospace`
      ctx.textBaseline = 'top'

      const visibleLines = Math.ceil(H / lineH) + 2
      const startLine = Math.max(0, Math.floor(st.scroll / lineH))

      for (let i = startLine; i < Math.min(st.lines.length, startLine + visibleLines); i++) {
        const y = padT + i * lineH - st.scroll
        if (y > H + lineH) break

        // line number
        ctx.fillStyle = LINE_NUM
        ctx.textAlign = 'right'
        ctx.fillText(String(i + 1), padL - 16, y)
        ctx.textAlign = 'left'

        const line = st.lines[i]
        const isCurrentLine = i === st.lineIdx
        const displayLine = isCurrentLine ? line.slice(0, st.charIdx) : line

        // cursor
        if (isCurrentLine) {
          const textW = ctx.measureText(displayLine).width
          ctx.fillStyle = '#c9a96e'
          ctx.fillRect(padL + textW, y, 2, fontSize + 2)
        }

        const tokens = tokenize(displayLine)
        let x = padL
        for (const tok of tokens) {
          ctx.fillStyle = tok.color
          ctx.fillText(tok.text, x, y)
          x += ctx.measureText(tok.text).width
        }
      }

      // advance typing
      if (ts - lastTime > CHAR_DELAY) {
        lastTime = ts
        const fullLine = CODE_LINES[st.lineIdx] ?? ''
        if (st.charIdx < fullLine.length) {
          st.charIdx++
        } else {
          if (st.lineIdx < CODE_LINES.length - 1) {
            st.lines[st.lineIdx] = fullLine
            st.lineIdx++
            st.charIdx = 0
            // scroll if needed
            const cursorY = padT + st.lineIdx * lineH
            if (cursorY > H - lineH * 3) {
              st.scroll = Math.max(0, cursorY - H + lineH * 4)
            }
          } else {
            // reset
            setTimeout(() => {
              stateRef.current = { lineIdx: 0, charIdx: 0, lines: [], scroll: 0, tick: 0 }
            }, 1500)
          }
        }
        st.lines[st.lineIdx] = CODE_LINES[st.lineIdx] ?? ''
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}

/* ─── Script Animation (Scripts background) ─────────────── */
const SCRIPT_LINES = [
  { text: 'CAMP MOOLAH', style: 'title' },
  { text: '', style: 'blank' },
  { text: 'Written by Jonah Andrews', style: 'author' },
  { text: '', style: 'blank' },
  { text: '', style: 'blank' },
  { text: 'FADE IN:', style: 'direction' },
  { text: '', style: 'blank' },
  { text: 'EXT. BEVERLY HILLS NEIGHBORHOOD - DAY', style: 'scene' },
  { text: '', style: 'blank' },
  { text: '      Rows of unfathomably expensive suburban houses', style: 'action' },
  { text: '      with perfectly trimmed yards line the street.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      The neighborhood is dead silent...', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      SKRRT - A beat up 2001 TOYOTA COROLLA drifts', style: 'action' },
  { text: '      around the corner blasting "BLITZKRIEG BOP".', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      In the front seat is PETE PETERSON, 22, a natural born', style: 'action' },
  { text: '      air-guitarist whose bright eyes betray his carefree charm.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      His hands fly through the air as he plays an ', style: 'action' },
  { text: '      invisible drum set to the beat of the song.', style: 'action' },
  { text: '', style: 'blank' },
  { text: 'EXT. FRONT YARD - DAY', style: 'scene' },
  { text: '      Pete turns off his music as he pulls up to ', style: 'action' },
  { text: '      the only dilapidated house on the street.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      KNOCK KNOCK', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      Immediately after Pete’s hand leaves the door ', style: 'action' },
  { text: '      a guttural dog bark is heard from within.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '                    CURTIS', style: 'character' },
  { text: '            (O.S.)', style: 'paren' },
  { text: '      Brunson! Shut up!', style: 'dialogue' },
  { text: '', style: 'blank' },
  { text: '      The dusty door swings open to reveal CURTIS LEE, ', style: 'action' },
  { text: '      62, a self-proclaimed former alien-abductee who ', style: 'action' },
  { text: '      has more screws loose than a Boeing 787.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '                    CURTIS (CONT\'D)', style: 'character' },
  { text: '            (deep southern accent)', style: 'paren' },
  { text: '      Who are you?', style: 'dialogue' },
  { text: '', style: 'blank' },
  { text: '      Pete takes in Curtis’ startling appearance.', style: 'action' },
  { text: '      His dirty wife-beater, short-shorts, and ', style: 'action' },
  { text: '      and tin foil hat leave Pete in a state of ', style: 'action' },
  { text: '      pure shock. ', style: 'action' },
  { text: '', style: 'blank' },
  { text: '                    PETE', style: 'character' },
  { text: '      I... um...', style: 'dialogue' },
  { text: '            (beat)', style: 'paren' },
  { text: '      My name is Pete, I have the pizza that ', style: 'dialogue' },
  { text: '      you ordered.', style: 'dialogue' },
  { text: '', style: 'blank' },
  { text: '      Curtis stares at him unimpressed.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '      Pete hoists up his pizza as proof of his', style: 'action' },
  { text: '      seemingly outrageous claim.', style: 'action' },
  { text: '', style: 'blank' },
  { text: '                                          CUT TO:', style: 'direction' },
]

function ScriptAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef({ lineIdx: 0, charIdx: 0, lines: [] as string[], scroll: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const lineH = 24
    const padT = 40
    const CENTER_X = () => canvas.offsetWidth / 2

    function getStyle(style: string): { font: string; color: string; align: CanvasTextAlign; x: (cw: number) => number } {
      switch (style) {
        case 'title':    return { font: 'bold 15px "Courier Prime", "Courier New", monospace', color: '#f0ede8', align: 'center', x: CENTER_X }
        case 'author':   return { font: '13px "Courier Prime", "Courier New", monospace', color: '#888880', align: 'center', x: CENTER_X }
        case 'scene':    return { font: 'bold 13px "Courier Prime", "Courier New", monospace', color: '#f0ede8', align: 'left', x: () => 60 }
        case 'action':   return { font: '13px "Courier Prime", "Courier New", monospace', color: '#b8b5b0', align: 'left', x: () => 60 }
        case 'character': return { font: 'bold 13px "Courier Prime", "Courier New", monospace', color: '#d4a843', align: 'left', x: () => 220 }
        case 'paren':    return { font: 'italic 12px "Courier Prime", "Courier New", monospace', color: '#888880', align: 'left', x: () => 160 }
        case 'dialogue': return { font: '13px "Courier Prime", "Courier New", monospace', color: '#d0cdc8', align: 'left', x: () => 100 }
        case 'direction': return { font: '13px "Courier Prime", "Courier New", monospace', color: '#666660', align: 'left', x: (cw) => style === 'direction' && SCRIPT_LINES.findIndex(l => l.text === 'CUT TO:') >= 0 ? cw - 120 : 60 }
        default:         return { font: '13px "Courier Prime", "Courier New", monospace', color: '#888880', align: 'left', x: () => 60 }
      }
    }

    let lastTime = 0
    const CHAR_DELAY = 35

    function draw(ts: number) {
      const st = stateRef.current
      const W = canvas!.offsetWidth
      const H = canvas!.offsetHeight
      ctx.clearRect(0, 0, W, H)

      ctx.fillStyle = '#080808'
      ctx.fillRect(0, 0, W, H)

      // page vignette
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.8)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      ctx.textBaseline = 'top'

      for (let i = 0; i < st.lines.length; i++) {
        const scriptLine = SCRIPT_LINES[i]
        if (!scriptLine) continue
        const y = padT + i * lineH - st.scroll
        if (y < -lineH || y > H + lineH) continue

        const displayText = i === st.lineIdx ? st.lines[i].slice(0, st.charIdx) : st.lines[i]
        if (!displayText && scriptLine.style !== 'blank') continue

        const s = getStyle(scriptLine.style)
        ctx.font = s.font
        ctx.fillStyle = s.color
        ctx.textAlign = s.align

        const xPos = s.x(W)
        ctx.fillText(displayText, xPos, y)

        // cursor on active line
        if (i === st.lineIdx && scriptLine.style !== 'blank') {
          const tw = ctx.measureText(displayText).width
          const cursorX = s.align === 'center' ? xPos + tw / 2 : xPos + tw
          ctx.fillStyle = '#c9a96e'
          ctx.fillRect(cursorX + 1, y + 1, 2, 13)
        }
      }

      if (ts - lastTime > CHAR_DELAY) {
        lastTime = ts
        const fullScriptLine = SCRIPT_LINES[st.lineIdx]
        if (!fullScriptLine) return

        if (st.charIdx < fullScriptLine.text.length) {
          st.charIdx++
          st.lines[st.lineIdx] = fullScriptLine.text
        } else {
          if (st.lineIdx < SCRIPT_LINES.length - 1) {
            st.lines[st.lineIdx] = fullScriptLine.text
            st.lineIdx++
            st.charIdx = 0
            st.lines[st.lineIdx] = ''
            const cursorY = padT + st.lineIdx * lineH
            if (cursorY > H - lineH * 4) st.scroll = Math.max(0, cursorY - H + lineH * 5)
          } else {
            setTimeout(() => {
              stateRef.current = { lineIdx: 0, charIdx: 0, lines: [], scroll: 0 }
            }, 2000)
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}

/* ─── iPhone Frame ────────────────────────────────────────── */
function PhoneFrame({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div style={{
      width: 'min(160px, 47vw)',
      height: 'min(335px, 98.4vw)',
      background: '#111',
      borderRadius: '26px',
      border: '2px solid #2a2a2a',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      boxShadow: '0 24px 48px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.06)',
    }}>
      {/* dynamic island
      <div style={{
        position: 'absolute', top: '10px', left: '50%',
        transform: 'translateX(-50%)',
        width: '52px', height: '13px',
        background: '#000', borderRadius: '7px', zIndex: 2,
      }} /> */}
      {src ? (
        <img
          src={src}
          alt="App screenshot"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.3s',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', color: '#333',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="11" r="3"/><path d="M3 19c0-2.5 4-4 9-4s9 1.5 9 4"/></svg>
          <span style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>screenshot</span>
        </div>
      )}
    </div>
  )
}

/* ─── Document Frame (script pages) ──────────────────────── */
function DocumentFrame({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div style={{
      width: 'min(300px, 46vw)',
      height: 'min(411px, 63vw)', // ~letter paper ratio
      background: src ? '#111' : '#111',
      borderRadius: '6px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
    }}>
      {src ? (
        <img
          src={src}
          alt="Script screenshot"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.3s',
          }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', background: '#f8f7f4',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.4rem',
        }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{ height: '2px', width: `${60 + (i % 3) * 16}%`, background: '#ccc', borderRadius: '1px' }} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Screenshot Slideshow: apps show 2 phone slots side by side,
   cycling every 5s; scripts show a single (larger) document page,
   cycling every 9s. ─────────────────────────────────────────── */
function ScreenshotSlideshow({ screenshots, type }: { screenshots: string[]; type: 'phone' | 'document' }) {
  if (type === 'document') return <DocumentSlideshow screenshots={screenshots} />
  return <PhoneSlideshow screenshots={screenshots} />
}

function PhoneSlideshow({ screenshots }: { screenshots: string[] }) {
  // Group into pairs
  const pairs: [string, string][] = []
  for (let i = 0; i < Math.max(screenshots.length, 2); i += 2) {
    pairs.push([screenshots[i] ?? '', screenshots[i + 1] ?? ''])
  }

  const [pairIdx, setPairIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (pairs.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setPairIdx(p => (p + 1) % pairs.length)
        setVisible(true)
      }, 600)
    }, 5000)
    return () => clearInterval(id)
  }, [pairs.length])

  const [a, b] = pairs[pairIdx]

  return (
    <div style={{
      display: 'flex', gap: '1.25rem', justifyContent: 'center', alignItems: 'flex-start',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.6s ease',
    }}>
      <PhoneFrame src={a} /><PhoneFrame src={b} />
    </div>
  )
}

function DocumentSlideshow({ screenshots }: { screenshots: string[] }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (screenshots.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % screenshots.length)
        setVisible(true)
      }, 600)
    }, 9000)
    return () => clearInterval(id)
  }, [screenshots.length])

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.6s ease',
    }}>
      <DocumentFrame src={screenshots[idx] ?? ''} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CUSTOM VIDEO BACKGROUNDS
   ─────────────────────────────────────────────────────────────────────────────
   Drop your video files into the /public/videos/ folder (create it if needed),
   then update the paths below.

   Optimal specs:
     • Format  : MP4 (H.264 video + AAC audio, or mute is fine)
     • Resolution: 1920 × 1080  (16:9 landscape)
     • Duration : 15–30 seconds, seamless loop
     • File size: keep under 15 MB for fast load; 8–12 MB is ideal
     • Export tip: use Handbrake — "Web Optimised" checkbox ensures fast-start

   Example values once your files are in place:
     const APPS_BG_VIDEO: string | null = '/videos/code-typing.mp4'
     const SCRIPTS_BG_VIDEO: string | null = '/videos/script-writing.mp4'

   Leave as null to use the built-in canvas animation fallback.
   ─────────────────────────────────────────────────────────────────────────── */
const APPS_BG_VIDEO: string | null = null      // ← swap in your video path here
const SCRIPTS_BG_VIDEO: string | null = null   // ← swap in your video path here

/* ─── Section Background (starts below the header text) ─── */
function SectionBackground({ type }: { type: 'code' | 'script' }) {
  const video = type === 'code' ? APPS_BG_VIDEO : SCRIPTS_BG_VIDEO
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {video ? (
        <video
          src={asset(video)}
          autoPlay
          loop
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        type === 'code' ? <CodeAnimation /> : <ScriptAnimation />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,12,12,0.74)' }} />
    </div>
  )
}

/* ─── Slideshow ───────────────────────────────────────────── */
function useBioImages() {
  const [images, setImages] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    fetch(asset('biopics/manifest.json'))
      .then(r => (r.ok ? r.json() : []))
      .then((names: unknown) => {
        if (cancelled || !Array.isArray(names)) return
        setImages(
          names
            .filter((n): n is string => typeof n === 'string')
            .map(n => asset('biopics/' + encodeURIComponent(n))),
        )
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  return images
}

function Slideshow() {
  const images = useBioImages()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (images.length < 2) return // nothing to cycle through
    // Just one piece of state, updated once every 5 seconds flat — no separate
    // "transitioning" step. The crossfade itself is handled by the CSS `transition:
    // opacity` below: the outgoing image's opacity drops to 0 and the incoming one
    // rises to 1 in the same instant, and the browser animates both over 1.5s on its own.
    const interval = setInterval(() => {
      setCurrent(c => (c + 1) % images.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [images.length])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '0.75rem', background: '#161614' }}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: i === current ? 1 : 0,
            transition: 'opacity 1.5s ease',
          }}
        />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(12,12,12,0.78) 0%, rgba(12,12,12,0.55) 100%)', borderRadius: '0.75rem' }} />
    </div>
  )
}

/* ─── Nav ─────────────────────────────────────────────────── */
function Nav({ activePage, navigate }: { activePage: Page; navigate: (p: Page) => void }) {
  const w = useWindowWidth()
  const mobile = w < 600

  const navBtn = (label: string, target: Page) => {
    const isActive = activePage === target
      || (activePage === 'app-detail' && target === 'apps')
      || (activePage === 'script-detail' && target === 'scripts')
    return (
      <button
        key={target}
        onClick={() => navigate(target)}
        style={{
          color: isActive ? '#c9a96e' : '#888880',
          borderBottom: isActive ? '1px solid #c9a96e' : '1px solid transparent',
          paddingBottom: '2px',
          transition: 'color 0.2s, border-color 0.2s',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 500,
          fontSize: mobile ? '0.75rem' : '0.85rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!isActive) (e.target as HTMLElement).style.color = '#f0ede8' }}
        onMouseLeave={e => { if (!isActive) (e.target as HTMLElement).style.color = '#888880' }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative', zIndex: 10, background: '#0c0c0c' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? '1rem' : '2rem', padding: mobile ? '1.1rem 1.25rem' : '1.5rem 2.5rem' }}>
        <button
          onClick={() => navigate('home')}
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: mobile ? '1.2rem' : '1.5rem',
            color: '#f0ede8',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = '#c9a96e' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = '#f0ede8' }}
        >
          Jonah
        </button>
        <span style={{ color: 'rgba(240,237,232,0.2)', fontSize: '1rem' }}>—</span>
        <div style={{ display: 'flex', gap: mobile ? '1rem' : '1.5rem' }}>
          {navBtn('Apps', 'apps')}
          {navBtn('Scripts', 'scripts')}
          {navBtn('Photos', 'photos')}
        </div>
      </div>
      <div style={{ height: '1px', background: 'rgba(240,237,232,0.1)', margin: `0 ${mobile ? '1.25rem' : '2.5rem'}` }} />
    </div>
  )
}

/* ─── App Icon ────────────────────────────────────────────── */
// Drop a square icon (1024×1024 recommended) into  public/icons/  named after the
// app's id, e.g.  public/icons/sketch-press.png  and  public/icons/bible-bison.png
// (.png, .jpg, .jpeg and .webp all work). If no file is found, the initials show instead.
// Don't round the corners yourself — the site does that automatically.
const ICON_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp']

function AppIcon({ app, size = 72 }: { app: (typeof APPS)[0]; size?: number }) {
  const r = size * 0.225
  const [extIndex, setExtIndex] = useState(0)
  useEffect(() => { setExtIndex(0) }, [app.id])
  const hasIcon = extIndex < ICON_EXTENSIONS.length

  return (
    <div style={{
      width: size, height: size,
      borderRadius: `${r}px`,
      background: app.color,
      border: `1px solid ${app.accent}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {hasIcon ? (
        <img
          key={ICON_EXTENSIONS[extIndex]}
          src={asset(`icons/${app.id}.${ICON_EXTENSIONS[extIndex]}`)}
          alt={`${app.name} icon`}
          onError={() => setExtIndex(i => i + 1)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: size * 0.28, fontWeight: 600, color: app.accent, letterSpacing: '-0.02em' }}>
          {app.initial}
        </span>
      )}
    </div>
  )
}

/* ─── Script Cover ────────────────────────────────────────── */
function ScriptCover({ script }: { script: (typeof SCRIPTS)[0] }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '2 / 3',
      background: script.color,
      border: `1px solid ${script.accent}30`,
      borderRadius: '0.5rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem 1rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', height: '1px', background: `${script.accent}40` }} />
      <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', height: '1px', background: `${script.accent}40` }} />
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: `${script.accent}99`, textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 500 }}>
        {script.genre}
      </div>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.15rem', color: '#f0ede8', textAlign: 'center', lineHeight: 1.3 }}>
        {script.name}
      </div>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', color: `${script.accent}80`, textTransform: 'uppercase', marginTop: '0.75rem' }}>
        {script.year}
      </div>
    </div>
  )
}

/* ─── Profile Picture ─────────────────────────────────────── */
// Drop your photo into  public/profile.jpg  (.png, .jpeg and .webp also work).
// Square images look best (e.g. 800×800). If no file is found, your initials show instead.
// Size: 130px on phones, then grows with the screen width up to a max of 260px.
const PROFILE_EXTENSIONS = ['jpg', 'png', 'jpeg', 'webp']
const PROFILE_INITIALS = 'JA'

function ProfilePicture({ mobile }: { mobile: boolean }) {
  const [extIndex, setExtIndex] = useState(0)
  const hasPhoto = extIndex < PROFILE_EXTENSIONS.length
  const size = mobile ? '130px' : 'clamp(160px, 15vw, 260px)'

  return (
    <div style={{ position: 'relative', flexShrink: 0, alignSelf: 'center' }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '2px solid rgba(201,169,110,0.5)',
        background: '#1a1a18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hasPhoto ? (
          <img
            key={PROFILE_EXTENSIONS[extIndex]}
            src={asset(`profile.${PROFILE_EXTENSIONS[extIndex]}`)}
            alt="Profile"
            onError={() => setExtIndex(i => i + 1)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontFamily: "'Instrument Serif', serif", fontSize: mobile ? '2.8rem' : 'clamp(3.5rem, 5vw, 5.5rem)', color: '#c9a96e', opacity: 0.7 }}>
            {PROFILE_INITIALS}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Contact Button ──────────────────────────────────────── */
// Left 80%: opens the visitor's email app with this address in the "To" field.
// Right 20%: copies the address to the clipboard instead.
const CONTACT_EMAIL = 'jonahandrews7@gmail.com'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older browsers / blocked clipboard: fall back to a temporary hidden text box.
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function ContactButton() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const handleCopy = async () => {
    const ok = await copyText(CONTACT_EMAIL)
    if (!ok) {
      window.prompt('Copy my email address:', CONTACT_EMAIL)
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const accent = 'rgba(201,169,110,0.45)'
  const hoverOn = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.background = 'rgba(201,169,110,0.18)' }
  const hoverOff = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.background = 'transparent' }

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      width: 'clamp(240px, 19vw, 280px)',
      border: `1px solid ${accent}`,
      borderRadius: '0.5rem',
      background: 'rgba(12,12,12,0.55)',
      backdropFilter: 'blur(6px)',
      fontFamily: "'Outfit', sans-serif",
      fontSize: 'clamp(0.8rem, 0.15vw + 0.75rem, 0.9rem)',
    }}>
      {/* 80% — opens email app */}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        title={`Email ${CONTACT_EMAIL}`}
        style={{
          flex: '0 0 80%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          padding: 'clamp(0.65rem, 0.3vw + 0.55rem, 0.8rem) 0.75rem',
          color: '#c9a96e',
          textDecoration: 'none',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderRadius: '0.45rem 0 0 0.45rem',
          transition: 'background 0.2s',
        }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <polyline points="3 7 12 13 21 7" />
        </svg>
        Contact
      </a>

      {/* 20% — copy email */}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy email address"
        title="Copy email address"
        style={{
          flex: '0 0 20%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: `1px solid ${accent}`,
          background: 'transparent',
          color: copied ? '#c9a96e' : 'rgba(240,237,232,0.75)',
          cursor: 'pointer',
          borderRadius: '0 0.45rem 0.45rem 0',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={hoverOn}
        onMouseLeave={hoverOff}
      >
        {copied ? (
          <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>

      {/* Visual "Email copied!" tag: fades in quickly, then fades out slowly */}
      <span aria-hidden style={{
        position: 'absolute',
        right: 0,
        bottom: 'calc(100% + 8px)',
        background: '#c9a96e',
        color: '#0c0c0c',
        padding: '0.25rem 0.6rem',
        borderRadius: '0.3rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: copied ? 1 : 0,
        transform: copied ? 'translateY(0)' : 'translateY(3px)',
        transition: copied ? 'opacity 0.15s ease, transform 0.15s ease' : 'opacity 0.9s ease, transform 0.9s ease',
      }}>
        Email copied!
      </span>
      {/* Same message for screen readers */}
      <span role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {copied ? 'Email address copied to clipboard' : ''}
      </span>
    </div>
  )
}

/* ─── Home Page ───────────────────────────────────────────── */
/* ─── Olive Wreath ────────────────────────────────────────── */
// A victory wreath of two olive branches that sits under the Apps / Scripts / Photos
// buttons and curls up just past the outer buttons. It's drawn as SVG, so it scales
// with the button row automatically — nothing else to resize.
const WREATH_COLOR = '#c9a96e' // ← try '#8a9160' for an olive green instead
const WREATH = {
  width: 1000,      // drawing units (leave as is)
  top: -62,         // how far above the buttons' bottom edge the tips rise
  height: 172,      // total drawing height
  overhang: 0.05,   // how far past each outer button the wreath reaches (5% of the row)
}

function buildBranch() {
  // One branch, drawn from the bottom centre out to the left, curling upward.
  const P = [
    { x: 508, y: 56 },  // start (just past centre so the two branches overlap)
    { x: 340, y: 70 },
    { x: 118, y: 68 },
    { x: 26, y: -40 },  // tip
  ]
  const at = (t: number) => {
    const m = 1 - t
    return {
      x: m * m * m * P[0].x + 3 * m * m * t * P[1].x + 3 * m * t * t * P[2].x + t * t * t * P[3].x,
      y: m * m * m * P[0].y + 3 * m * m * t * P[1].y + 3 * m * t * t * P[2].y + t * t * t * P[3].y,
    }
  }
  const tangent = (t: number) => {
    const m = 1 - t
    const dx = 3 * m * m * (P[1].x - P[0].x) + 6 * m * t * (P[2].x - P[1].x) + 3 * t * t * (P[3].x - P[2].x)
    const dy = 3 * m * m * (P[1].y - P[0].y) + 6 * m * t * (P[2].y - P[1].y) + 3 * t * t * (P[3].y - P[2].y)
    return Math.atan2(dy, dx)
  }

  // Walk along the curve at even distances.
  const N = 400
  const cum: number[] = [0]
  for (let i = 1; i <= N; i++) {
    const a = at((i - 1) / N), b = at(i / N)
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const total = cum[N]
  const tAt = (dist: number) => {
    let i = 1
    while (i < N && cum[i] < dist) i++
    const f = (dist - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    return (i - 1 + f) / N
  }

  const r1 = (n: number) => Math.round(n * 10) / 10
  const leafPath = (len: number) => {
    const hw = len * 0.15 // half-width: slim, pointed olive leaf
    return `M0 0Q${r1(len / 2)} ${r1(-2 * hw)} ${r1(len)} 0Q${r1(len / 2)} ${r1(2 * hw)} 0 0Z`
  }

  const leaves: { d: string; transform: string; opacity: number }[] = []
  const spread = (38 * Math.PI) / 180
  const first = 46, gap = 33
  const count = Math.floor((total - first - 10) / gap) + 1
  for (let k = 0; k < count; k++) {
    const dist = first + k * gap
    const t = tAt(dist)
    const p = at(t)
    const th = tangent(t)
    const u = dist / total
    const len = 50 - 18 * u // leaves shrink slightly toward the tip
    for (const side of [-1, 1]) {
      const ang = ((th + side * spread) * 180) / Math.PI
      leaves.push({
        d: leafPath(len),
        transform: `translate(${r1(p.x)} ${r1(p.y)}) rotate(${r1(ang)})`,
        opacity: side === -1 ? 0.95 : 0.7,
      })
    }
  }
  // Leaf at the very tip, pointing along the curve.
  const tip = at(1)
  leaves.push({
    d: leafPath(30),
    transform: `translate(${r1(tip.x)} ${r1(tip.y)}) rotate(${r1((tangent(1) * 180) / Math.PI)})`,
    opacity: 0.95,
  })

  const stem = `M${P[0].x} ${P[0].y}C${P[1].x} ${P[1].y} ${P[2].x} ${P[2].y} ${P[3].x} ${P[3].y}`
  return { stem, leaves }
}
const OLIVE_BRANCH = buildBranch()

function OliveWreath() {
  const over = WREATH.overhang
  const branch = (
    <>
      <path d={OLIVE_BRANCH.stem} fill="none" stroke={WREATH_COLOR} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      {OLIVE_BRANCH.leaves.map((l, i) => (
        <path key={i} d={l.d} transform={l.transform} fill={WREATH_COLOR} opacity={l.opacity} />
      ))}
    </>
  )
  return (
    <svg
      viewBox={`0 ${WREATH.top} ${WREATH.width} ${WREATH.height}`}
      aria-hidden
      focusable="false"
      data-wreath="true"
      style={{
        display: 'block',
        width: `${(1 + 2 * over) * 100}%`,
        marginLeft: `${-over * 100}%`,
        marginTop: `${(WREATH.top / WREATH.width) * (1 + 2 * over) * 100}%`,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {branch}
      <g transform={`translate(${WREATH.width} 0) scale(-1 1)`}>{branch}</g>
      {/* little knot where the branches meet */}
      <circle cx={WREATH.width / 2} cy="57" r="5.5" fill={WREATH_COLOR} />
    </svg>
  )
}

// Everything on the home page scales smoothly with the screen using clamp(min, ideal, max),
// so there are no sudden jumps. The numbers to tweak are marked with ← below.
const HOME_MAX_WIDTH = '1500px' // ← content stops growing wider than this (and centres on huge screens)

function HomePage({ navigate }: { navigate: (p: Page) => void }) {
  const w = useWindowWidth()
  const mobile = w < 640
  const pad = mobile ? '1.25rem' : '2.5rem'

  const icons = [
    {
      page: 'apps' as Page, label: 'Apps',
      svg: <svg width="100%" height="100%" viewBox="0 0 38 38" fill="none"><rect x="3" y="3" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.5"/><rect x="22" y="3" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="22" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.5"/><rect x="22" y="22" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.5"/></svg>,
    },
    {
      page: 'scripts' as Page, label: 'Scripts',
      svg: <svg width="100%" height="100%" viewBox="0 0 38 38" fill="none"><rect x="7" y="3" width="24" height="32" rx="2" stroke="currentColor" strokeWidth="1.5"/><line x1="12" y1="12" x2="26" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="17" x2="26" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="22" x2="20" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    },
    {
      page: 'photos' as Page, label: 'Photos',
      svg: <svg width="100%" height="100%" viewBox="0 0 38 38" fill="none"><rect x="3" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="19" cy="20" r="6" stroke="currentColor" strokeWidth="1.5"/><circle cx="19" cy="20" r="2" fill="currentColor"/><rect x="13" y="5" width="12" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>,
    },
  ]

  return (
    <div className="page-enter" style={{ minHeight: '100dvh', padding: `2rem ${pad} 3rem`, display: 'flex', flexDirection: 'column', overflowX: 'clip' }}>
      <div style={{ width: '100%', maxWidth: HOME_MAX_WIDTH, margin: '0 auto', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{
          fontFamily: "'Instrument Serif', serif",
          fontSize: mobile ? '2rem' : 'clamp(2.2rem, 4vw, 4.25rem)',
          color: '#f0ede8',
          marginBottom: '2rem',
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
        }}>
          Jonah Andrews
        </h1>

        {/* Hero: slideshow + profile + bio. On bigger screens it stretches to use spare height, up to the max below. */}
        <div style={{
          position: 'relative',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          padding: mobile ? '2rem 1.5rem' : 'clamp(3rem, 4vw, 4.5rem) clamp(2.5rem, 4vw, 5rem)',
          marginBottom: mobile ? '3rem' : 'clamp(2rem, 3vw, 3.5rem)',
          minHeight: mobile ? '280px' : 'clamp(320px, 24vw, 420px)', // ← smallest height
          maxHeight: mobile ? undefined : '640px', // ← tallest it can grow
          flex: mobile ? '0 0 auto' : '1 1 auto',
          display: 'flex',
          flexDirection: mobile ? 'column' : 'row',
          alignItems: mobile ? 'flex-start' : 'center',
          justifyContent: mobile ? 'flex-start' : 'center',
          gap: mobile ? '1.5rem' : 'clamp(2rem, 3.5vw, 4rem)',
        }}>
          <Slideshow />

          {/* Profile picture */}
          <ProfilePicture mobile={mobile} />

          {/* Bio + contact */}
          <div style={{
            position: 'relative',
            maxWidth: mobile ? '580px' : 'clamp(420px, 44vw, 760px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: mobile ? '1.5rem' : 'clamp(1.5rem, 2vw, 2.25rem)',
          }}>
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: mobile ? '0.95rem' : 'clamp(1.05rem, 0.25vw + 0.98rem, 1.35rem)',
              color: '#f0ede8',
              lineHeight: 1.8,
              fontWeight: 300,
            }}>
              Designer, developer, and storyteller with a passion to create great things.
              I develop apps when I have something to build.
              I write stories when I have something to say.
              I take pictures when God has something to show me.
              
              This is a collection of my work.
            </p>
            <ContactButton />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(240,237,232,0.1)', marginBottom: mobile ? '1.05rem' : 'clamp(1.5rem, 2.4vw, 2.05rem)', flexShrink: 0 }} /> {/* ← gap below the divider, above the buttons */}

        {/* Icons — always one row of three equal buttons; they grow with the screen up to a max width */}
        <div style={{
          width: '100%',
          maxWidth: mobile ? '540px' : 'clamp(560px, 44vw, 820px)', // ← widest the button row can get
          margin: '0 auto',
          flexShrink: 0,
        }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: mobile ? '1rem' : 'clamp(1rem, 1.4vw, 1.5rem)',
        }}>
          {icons.map(({ page, label, svg }) => (
            <button
              key={page}
              onClick={() => navigate(page)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: '100%',
                gap: mobile ? '0.75rem' : 'clamp(0.75rem, 1vw, 1.1rem)',
                padding: mobile ? '0.5rem 0' : '0.75rem 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s',
                color: '#888880',
              }}
              onMouseEnter={e => {
                const circle = e.currentTarget.firstElementChild as HTMLElement
                circle.style.background = 'rgba(201,169,110,0.08)'
                circle.style.borderColor = 'rgba(201,169,110,0.3)'
                e.currentTarget.style.color = '#c9a96e'
              }}
              onMouseLeave={e => {
                const circle = e.currentTarget.firstElementChild as HTMLElement
                circle.style.background = 'rgba(240,237,232,0.03)'
                circle.style.borderColor = 'rgba(240,237,232,0.08)'
                e.currentTarget.style.color = '#888880'
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: mobile ? '92px' : 'clamp(96px, 8vw, 148px)', // ← max button size: 92px on phones, 148px cap on wide screens
                aspectRatio: '1',
                borderRadius: '50%',
                background: 'rgba(240,237,232,0.03)',
                border: '1px solid rgba(240,237,232,0.08)',
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                <span style={{ display: 'block', width: 'clamp(32px, 3vw, 48px)', height: 'clamp(32px, 3vw, 48px)' }}>
                  {svg}
                </span>
              </span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(0.78rem, 0.35vw + 0.65rem, 1rem)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {label}
              </span>
            </button>
          ))}
        </div>
        <OliveWreath />
        </div>
      </div>
    </div>
  )
}

/* ─── Apps Page ───────────────────────────────────────────── */
function AppsPage({ navigate, setDetailId }: { navigate: (p: Page) => void; setDetailId: (id: string) => void }) {
  const w = useWindowWidth()
  const mobile = w < 600
  const pad = mobile ? '1.25rem' : '2.5rem'

  const handleApp = (id: string) => { setDetailId(id); navigate('app-detail') }

  return (
    <div className="page-enter">
      {/* Header — solid background, no animation */}
      <div style={{ padding: `2rem ${pad} 1.5rem`, background: '#0c0c0c', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.8rem', color: '#f0ede8', marginBottom: '0.5rem' }}>Apps</h2>
        <p style={{ color: '#888880', fontSize: '0.9rem', fontWeight: 300 }}>Software I've shipped.</p>
      </div>

      {/* Animated section — background starts here */}
      <div style={{ position: 'relative', minHeight: 'calc(100vh - 120px)', paddingBottom: '4rem' }}>
        <SectionBackground type="code" />
        <div style={{ position: 'relative', zIndex: 1, padding: `2rem ${pad} 0` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(2, minmax(160px, 220px))',
            gap: '2rem',
          }}>
            {APPS.map(app => (
              <button
                key={app.id}
                onClick={() => handleApp(app.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: '0.85rem', padding: mobile ? '1rem 0.5rem' : '1.25rem 0.5rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <AppIcon app={app} size={mobile ? 90 : 108} />
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  color: '#f0ede8',
                  background: 'rgba(10,10,10,0.82)',
                  padding: '0.28rem 0.7rem',
                  borderRadius: '0.3rem',
                  display: 'inline-block',
                }}>
                  {app.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── App Detail ──────────────────────────────────────────── */
function AppDetailPage({ appId, navigate }: { appId: string; navigate: (p: Page) => void }) {
  const app = APPS.find(a => a.id === appId)
  const w = useWindowWidth()
  const wide = w >= 860
  const mobile = w < 600
  const pad = mobile ? '1.25rem' : '2.5rem'
  if (!app) return null

  const descCard = (
    <div style={{
      background: 'rgba(22,22,20,0.9)',
      border: '1px solid rgba(240,237,232,0.1)',
      borderRadius: '0.75rem',
      padding: mobile ? '1.5rem' : '2rem',
      flex: wide ? '1 1 0' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <AppIcon app={app} />
        <div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: mobile ? '1.8rem' : '2.1rem', color: '#f0ede8', marginBottom: '0.2rem' }}>{app.name}</h2>
          <p style={{ color: app.accent, fontSize: '0.88rem' }}>{app.tagline}</p>
        </div>
      </div>
      <div style={{ height: '1px', background: 'rgba(240,237,232,0.08)', marginBottom: '1.25rem' }} />
      <p style={{ color: '#c8c5c0', fontSize: '0.98rem', lineHeight: 1.8, fontWeight: 300, marginBottom: '1.5rem' }}>{app.description}</p>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        {[{ label: 'Platforms', value: app.platforms.join(', ') }, { label: 'Released', value: app.year }].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888880', marginBottom: '0.2rem', fontWeight: 500 }}>{label}</div>
            <div style={{ color: '#f0ede8', fontSize: '0.93rem' }}>{value}</div>
          </div>
        ))}
      </div>
      {/* App Store button */}
      <a
        href={app.appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.55rem 1.1rem',
          background: `${app.accent}18`,
          border: `1px solid ${app.accent}45`,
          borderRadius: '0.45rem',
          color: app.accent,
          textDecoration: 'none',
          fontFamily: "'Outfit', sans-serif",
          fontSize: '0.85rem',
          fontWeight: 500,
          transition: 'background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${app.accent}30` }}
        onMouseLeave={e => { e.currentTarget.style.background = `${app.accent}18` }}
      >
        {/* Apple logo */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        View on App Store
      </a>
    </div>
  )

  const screenshots = (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      paddingTop: wide ? '1rem' : '0',
      flexShrink: 0,
      width: wide ? '300px' : '100%',
    }}>
      <ScreenshotSlideshow screenshots={app.screenshots} type="phone" />
    </div>
  )

  return (
    <div className="page-enter" style={{ padding: `2rem ${pad} 4rem` }}>
      <button onClick={() => navigate('apps')} style={{ background: 'none', border: 'none', color: '#888880', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif", marginBottom: '2rem', padding: 0, transition: 'color 0.2s' }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#c9a96e' }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#888880' }}>
        ← Back to Apps
      </button>

      {wide ? (
        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', maxWidth: '900px' }}>
          {descCard}
          {screenshots}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '540px' }}>
          {descCard}
          {screenshots}
        </div>
      )}
    </div>
  )
}

/* ─── Scripts Page ────────────────────────────────────────── */
function ScriptsPage({ navigate, setDetailId }: { navigate: (p: Page) => void; setDetailId: (id: string) => void }) {
  const w = useWindowWidth()
  const mobile = w < 600
  const pad = mobile ? '1.25rem' : '2.5rem'

  const handleScript = (id: string) => { setDetailId(id); navigate('script-detail') }

  return (
    <div className="page-enter">
      {/* Header — solid background, no animation */}
      <div style={{ padding: `2rem ${pad} 1.5rem`, background: '#0c0c0c', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '1.8rem', color: '#f0ede8', marginBottom: '0.5rem' }}>Scripts</h2>
        <p style={{ color: '#888880', fontSize: '0.9rem', fontWeight: 300 }}>Screenplays I've written.</p>
      </div>

      {/* Animated section — background starts here */}
      <div style={{ position: 'relative', minHeight: 'calc(100vh - 120px)', paddingBottom: '4rem' }}>
        <SectionBackground type="script" />
        <div style={{ position: 'relative', zIndex: 1, padding: `2rem ${pad} 0` }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(2, minmax(140px, 180px))',
            gap: '1.25rem',
          }}>
            {SCRIPTS.map(script => {
              const label = script.listLabel ?? script.name // falls back to the cover's title unless overridden above
              return (
                <button
                  key={script.id}
                  onClick={() => handleScript(script.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '0.75rem', padding: 0,
                    background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'transform 0.2s, opacity 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.opacity = '0.88' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1' }}
                >
                  <div style={{ width: '100%' }}><ScriptCover script={script} /></div>
                  {label && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.9rem', fontWeight: 500, color: '#f0ede8' }}>{label}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Script Detail ───────────────────────────────────────── */
function ScriptDetailPage({ scriptId, navigate }: { scriptId: string; navigate: (p: Page) => void }) {
  const script = SCRIPTS.find(s => s.id === scriptId)
  const w = useWindowWidth()
  const wide = w >= 860
  const mobile = w < 600
  const pad = mobile ? '1.25rem' : '2.5rem'
  if (!script) return null

  return (
    <div className="page-enter" style={{ padding: `2rem ${pad} 4rem` }}>
      <button onClick={() => navigate('scripts')} style={{ background: 'none', border: 'none', color: '#888880', cursor: 'pointer', fontSize: '0.8rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: "'Outfit', sans-serif", marginBottom: '2rem', padding: 0, transition: 'color 0.2s' }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#c9a96e' }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#888880' }}>
        ← Back to Scripts
      </button>

      {wide ? (
        /* Desktop: description left, screenshots right */
        <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', maxWidth: '980px' }}>
          {/* Description card */}
          <div style={{ flex: '1 1 0', background: 'rgba(22,22,20,0.9)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: '0.75rem', padding: '2rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ width: '110px', flexShrink: 0 }}><ScriptCover script={script} /></div>
              <div>
                <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: script.accent, marginBottom: '0.4rem', fontWeight: 500 }}>{script.genre}</div>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: '2rem', color: '#f0ede8', marginBottom: '0', lineHeight: 1.15 }}>{script.name}</h2>
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(240,237,232,0.08)', marginBottom: '1.25rem' }} />
            <p style={{ color: '#c8c5c0', fontSize: '0.97rem', lineHeight: 1.8, fontWeight: 300, marginBottom: '1.25rem', fontStyle: 'italic' }}>"{script.logline}"</p>
            <p style={{ color: '#a8a5a0', fontSize: '0.92rem', lineHeight: 1.75, fontWeight: 300, marginBottom: '1.75rem' }}>{script.description}</p>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
              {[{ label: 'Pages', value: `${script.pages} ` }, { label: 'Year', value: script.year }].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888880', marginBottom: '0.2rem', fontWeight: 500 }}>{label}</div>
                  <div style={{ color: '#f0ede8', fontSize: '0.93rem' }}>{value}</div>
                </div>
              ))}
            </div>
            <a href={script.scriptUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', background: `${script.accent}18`, border: `1px solid ${script.accent}45`, borderRadius: '0.45rem', color: script.accent, textDecoration: 'none', fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${script.accent}30` }}
              onMouseLeave={e => { e.currentTarget.style.background = `${script.accent}18` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              View Full Script
            </a>
          </div>
          {/* Screenshots */}
          <div style={{ flexShrink: 0, width: '360px', display: 'flex', justifyContent: 'center', paddingTop: '0.5rem' }}>
            <ScreenshotSlideshow screenshots={script.screenshots} type="document" />
          </div>
        </div>
      ) : (
        /* Mobile: stacked */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '540px' }}>
          <div style={{ background: 'rgba(22,22,20,0.9)', border: '1px solid rgba(240,237,232,0.08)', borderRadius: '0.75rem', padding: mobile ? '1.5rem' : '2rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ width: mobile ? '100px' : '120px', flexShrink: 0 }}><ScriptCover script={script} /></div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: script.accent, marginBottom: '0.4rem', fontWeight: 500 }}>{script.genre}</div>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: mobile ? '1.6rem' : '2rem', color: '#f0ede8', lineHeight: 1.15 }}>{script.name}</h2>
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(240,237,232,0.08)', marginBottom: '1.25rem' }} />
            <p style={{ color: '#c8c5c0', fontSize: '0.95rem', lineHeight: 1.8, fontWeight: 300, marginBottom: '1rem', fontStyle: 'italic' }}>"{script.logline}"</p>
            <p style={{ color: '#a8a5a0', fontSize: '0.9rem', lineHeight: 1.75, fontWeight: 300, marginBottom: '1.5rem' }}>{script.description}</p>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {[{ label: 'Pages', value: `${script.pages} ` }, { label: 'Year', value: script.year }].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888880', marginBottom: '0.2rem', fontWeight: 500 }}>{label}</div>
                  <div style={{ color: '#f0ede8', fontSize: '0.93rem' }}>{value}</div>
                </div>
              ))}
            </div>
            <a href={script.scriptUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.1rem', background: `${script.accent}18`, border: `1px solid ${script.accent}45`, borderRadius: '0.45rem', color: script.accent, textDecoration: 'none', fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', fontWeight: 500, transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${script.accent}30` }}
              onMouseLeave={e => { e.currentTarget.style.background = `${script.accent}18` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              View Full Script
            </a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ScreenshotSlideshow screenshots={script.screenshots} type="document" />
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Photos: data ────────────────────────────────────────── */
// Photos come from  public/photos/  — see photo-details.json in that folder
// for the location / tags / description of each one.
function usePhotos() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(asset('photos/manifest.json'))
      .then(r => (r.ok ? r.json() : { photos: [] }))
      .then((data: any) => {
        if (cancelled) return
        const enc = encodeURIComponent
        const list: any[] = Array.isArray(data?.photos) ? data.photos : []
        setPhotos(
          list.map((p): Photo => ({
            file: p.file,
            url: asset('photos/' + (p.largeFile ? 'large/' + enc(p.largeFile) : enc(p.file))),
            thumb: asset('photos/' + (p.thumbFile ? 'thumbs/' + enc(p.thumbFile) : enc(p.file))),
            alt: p.alt || p.location || 'Photo',
            description: p.alt || '',
            location: p.location || '',
            lat: typeof p.lat === 'number' ? p.lat : null,
            lng: typeof p.lng === 'number' ? p.lng : null,
            tags: Array.isArray(p.tags) ? p.tags : [],
            thumbCropY: typeof p.thumbCropY === 'number' ? p.thumbCropY : null,
          })),
        )
      })
      .catch(() => { if (!cancelled) setPhotos([]) })
    return () => { cancelled = true }
  }, [])
  return photos
}

// "favorites" -> "My Favorites", "national-parks" -> "National Parks"
const tagLabel = (tag: string) =>
  tag === 'favorites'
    ? 'My Favorites'
    : tag.split(/[-_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/* ─── Overlays ────────────────────────────────────────────── */
// Overlays are drawn directly on <body>. If they were drawn inside the page itself,
// the page's slide-in animation would trap them inside the page box (so they'd be
// off-centre and slip under the nav bar).
function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}

function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])
}

/* ─── Map View ────────────────────────────────────────────── */
function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  )
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 9 })
  }, [map, points])
  return null
}

function PhotoMapView({ photos, onClose, onSelect }: { photos: Photo[]; onClose: () => void; onSelect: (p: Photo) => void }) {
  // Photos taken at the same spot share one pin.
  const groups = useMemo(() => {
    const byPlace = new Map<string, { lat: number; lng: number; photos: Photo[] }>()
    for (const p of photos) {
      if (p.lat === null || p.lng === null) continue
      const key = p.lat.toFixed(4) + ',' + p.lng.toFixed(4)
      const g = byPlace.get(key)
      if (g) g.photos.push(p)
      else byPlace.set(key, { lat: p.lat, lng: p.lng, photos: [p] })
    }
    return Array.from(byPlace.values())
  }, [photos])

  const points = useMemo<[number, number][]>(() => groups.map(g => [g.lat, g.lng]), [groups])

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
        {/* Map header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: 'rgba(12,12,12,0.95)', borderBottom: '1px solid rgba(240,237,232,0.1)', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888880' }}>
            Photo Locations
          </span>
          <button
            onClick={onClose}
            style={{ background: 'rgba(240,237,232,0.08)', border: '1px solid rgba(240,237,232,0.15)', color: '#f0ede8', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem', transition: 'background 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,237,232,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(240,237,232,0.08)' }}
          >
            ✕
          </button>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={[44, -105]} zoom={4} style={{ width: '100%', height: '100%' }} zoomControl={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {groups.map(g => (
              <Marker key={g.lat + ',' + g.lng} position={[g.lat, g.lng]}>
                <Popup minWidth={170} maxWidth={260}>
                  <div style={{ padding: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      {g.photos.find(p => p.location)?.location || 'Photo location'}
                      {g.photos.length > 1 && <span style={{ fontWeight: 400, color: '#666' }}> · {g.photos.length} photos</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: g.photos.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                      {g.photos.map(p => (
                        <button
                          key={p.file}
                          onClick={() => onSelect(p)}
                          title="View photo"
                          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'block' }}
                        >
                          <img
                            src={p.thumb}
                            alt={p.alt}
                            style={{
                              width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: '4px', display: 'block',
                              objectPosition: p.thumbCropY !== null ? `50% ${p.thumbCropY * 100}%` : undefined,
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {groups.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1000 }}>
              <div style={{ background: 'rgba(12,12,12,0.85)', color: '#f0ede8', padding: '0.75rem 1.1rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontFamily: "'Outfit', sans-serif" }}>
                No photo locations yet.
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}

/* ─── Photos Page ─────────────────────────────────────────── */
function PhotosPage() {
  const photos = usePhotos()
  const [filter, setFilter] = useState<string | null>(null) // null = use the default view
  const [lightbox, setLightbox] = useState<Photo | null>(null)
  const [showMap, setShowMap] = useState(false)
  const w = useWindowWidth()
  const mobile = w < 600
  const pad = mobile ? '1.25rem' : '2.5rem'

  const allPhotos = useMemo(() => photos ?? [], [photos])

  // One filter button per tag you've used, plus "All".
  const tags = useMemo(() => {
    const set = new Set<string>()
    allPhotos.forEach(p => p.tags.forEach(t => set.add(t)))
    return Array.from(set).sort((a, b) => (a === 'favorites' ? -1 : b === 'favorites' ? 1 : a.localeCompare(b)))
  }, [allPhotos])

  const filters = [{ key: 'all', label: 'All' }, ...tags.map(t => ({ key: t, label: tagLabel(t) }))]
  const activeFilter = filter ?? (tags.includes('favorites') ? 'favorites' : 'all')
  const filtered = activeFilter === 'all' ? allPhotos : allPhotos.filter(p => p.tags.includes(activeFilter))

  const closeLightbox = useCallback(() => setLightbox(null), [])
  useLockScroll(lightbox !== null || showMap)

  // Whether the lightbox caption is currently showing the photo's alt text instead of
  // its location. Reset to "showing location" every time a different photo opens.
  const [showCaptionAlt, setShowCaptionAlt] = useState(false)
  const [captionFading, setCaptionFading] = useState(false)
  useEffect(() => { setShowCaptionAlt(false) }, [lightbox?.file])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeLightbox(); setShowMap(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeLightbox])

  return (
    <div className="page-enter" style={{ padding: `1.75rem ${pad} 4rem` }}>
      {/* Filter row + map icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#888880', fontSize: '0.82rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            View:
          </span>
          {filters.map(({ key, label }) => {
            const active = activeFilter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '0.35rem',
                  border: '1px solid',
                  borderColor: active ? '#c9a96e' : 'rgba(240,237,232,0.12)',
                  background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
                  color: active ? '#c9a96e' : '#888880',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: mobile ? '0.72rem' : '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.3)'; e.currentTarget.style.color = '#f0ede8' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.12)'; e.currentTarget.style.color = '#888880' } }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Map button */}
        <button
          onClick={() => setShowMap(true)}
          title="View on map"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '0.35rem',
            border: '1px solid rgba(240,237,232,0.12)',
            background: 'transparent',
            color: '#888880',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,0.4)'; e.currentTarget.style.color = '#c9a96e' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,237,232,0.12)'; e.currentTarget.style.color = '#888880' }}
        >
          <MapIcon />
          {!mobile && <span>Map</span>}
        </button>
      </div>

      <div style={{ height: '1px', background: 'rgba(240,237,232,0.08)', marginBottom: '1.75rem' }} />

      {/* Gallery */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.625rem',
      }}>
        {filtered.map(photo => (
          <button
            key={photo.file}
            onClick={() => setLightbox(photo)}
            style={{
              padding: 0, border: 'none',
              background: '#161614',
              borderRadius: '0.4rem',
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              transition: 'transform 0.22s, opacity 0.22s',
              aspectRatio: '4/3',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.018)'; e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1' }}
          >
            <img
              src={photo.thumb}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              style={{
                width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                objectPosition: photo.thumbCropY !== null ? `50% ${photo.thumbCropY * 100}%` : undefined,
              }}
            />
          </button>
        ))}
      </div>

      {photos !== null && filtered.length === 0 && (
        <div style={{ color: '#888880', fontSize: '0.9rem', padding: '3rem 0', textAlign: 'center' }}>
          {allPhotos.length === 0 ? 'No photos yet.' : 'No photos with this tag yet.'}
        </div>
      )}

      {/* Lightbox — fixed to the screen and centred */}
      {lightbox && (
        <Portal>
          <div
            onClick={closeLightbox}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.94)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3000,
              padding: '1.5rem',
            }}
          >
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
              {/* X — top right corner of the image itself */}
              <button
                onClick={closeLightbox}
                style={{
                  position: 'absolute',
                  top: '-14px',
                  right: '-14px',
                  background: '#0c0c0c',
                  border: '1px solid rgba(240,237,232,0.2)',
                  color: '#f0ede8',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  lineHeight: 1,
                  zIndex: 10,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#c9a96e'; e.currentTarget.style.borderColor = '#c9a96e' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0c0c0c'; e.currentTarget.style.borderColor = 'rgba(240,237,232,0.2)' }}
              >
                ✕
              </button>
              <img
                src={lightbox.url}
                alt={lightbox.alt}
                style={{
                  display: 'block',
                  maxWidth: 'calc(100vw - 3.5rem)',
                  maxHeight: 'calc(100vh - 3.5rem)',
                  objectFit: 'contain',
                  borderRadius: '0.4rem',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
                }}
              />
              {/* Caption: shows the location by default. If the photo also has alt text,
                  clicking the tag fades it over to that instead, and fades back on a
                  second click. With only one of the two, the tag isn't clickable. */}
              {(lightbox.location || lightbox.description) && (() => {
                const hasBoth = Boolean(lightbox.location) && Boolean(lightbox.description)
                const text = hasBoth ? (showCaptionAlt ? lightbox.description : lightbox.location) : (lightbox.location || lightbox.description)
                const handleToggle = () => {
                  if (!hasBoth) return
                  setCaptionFading(true)
                  setTimeout(() => {
                    setShowCaptionAlt(v => !v)
                    setCaptionFading(false)
                  }, 180)
                }
                return (
                  <button
                    onClick={handleToggle}
                    title={hasBoth ? (showCaptionAlt ? 'Click to show location' : 'Click to show description') : undefined}
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      maxWidth: 'calc(100% - 24px)',
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(6px)',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '0.3rem',
                      border: 'none',
                      fontSize: '0.78rem',
                      color: '#f0ede8',
                      fontFamily: "'Outfit', sans-serif",
                      letterSpacing: '0.04em',
                      textAlign: 'left',
                      cursor: hasBoth ? 'pointer' : 'default',
                      opacity: captionFading ? 0 : 1,
                      transition: 'opacity 0.18s ease',
                    }}
                  >
                    {!showCaptionAlt && lightbox.location ? `📍 ${text}` : text}
                  </button>
                )
              })()}
            </div>
          </div>
        </Portal>
      )}

      {/* Map overlay */}
      {showMap && (
        <PhotoMapView
          photos={allPhotos}
          onClose={() => setShowMap(false)}
          onSelect={p => { setShowMap(false); setLightbox(p) }}
        />
      )}
    </div>
  )
}

/* ─── Root ────────────────────────────────────────────────── */
export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [detailId, setDetailId] = useState<string>('')
  const [pageKey, setPageKey] = useState(0)

  const navigate = useCallback((p: Page) => {
    setPage(p)
    setPageKey(k => k + 1)
    window.scrollTo(0, 0)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0c0c0c', fontFamily: "'Outfit', sans-serif" }}>
      {page === 'home' ? (
        <div key={pageKey}><HomePage navigate={navigate} /></div>
      ) : (
        <>
          <Nav activePage={page} navigate={navigate} />
          <div key={pageKey}>
            {page === 'apps' && <AppsPage navigate={navigate} setDetailId={setDetailId} />}
            {page === 'app-detail' && <AppDetailPage appId={detailId} navigate={navigate} />}
            {page === 'scripts' && <ScriptsPage navigate={navigate} setDetailId={setDetailId} />}
            {page === 'script-detail' && <ScriptDetailPage scriptId={detailId} navigate={navigate} />}
            {page === 'photos' && <PhotosPage />}
          </div>
        </>
      )}
    </div>
  )
}