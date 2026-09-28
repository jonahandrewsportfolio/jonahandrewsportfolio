// Builds everything the Photos page needs from the contents of public/photos/.
//
//   public/photos/photo-details.json   <- YOU edit this (location, tags, description)
//   public/photos/manifest.json        <- generated, never edit
//   public/photos/thumbs/, large/      <- generated smaller copies (needs "sharp", optional)
//
// Runs automatically on every deploy. You can also run it yourself:
//   node scripts/generate-photos.mjs
// Locally it also adds a blank entry to photo-details.json for every new photo it finds.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.resolve(here, '..', 'public', 'photos')
const detailsPath = path.join(dir, 'photo-details.json')
const thumbsDir = path.join(dir, 'thumbs')
const largeDir = path.join(dir, 'large')

const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i
const HEIC = /\.(heic|heif)$/i
const IN_CI = Boolean(process.env.CI)
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

const warnings = []
const warn = msg => warnings.push(msg)

function fail(msg) {
  console.error('\n✖ photos: ' + msg + '\n')
  process.exit(1)
}

if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

/* ── 1. Find the photos ─────────────────────────────────── */
const files = readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name)
const images = files.filter(n => IMAGE.test(n)).sort(natural)
const imageSet = new Set(images)
for (const n of files.filter(n => HEIC.test(n))) {
  warn(`"${n}" is a HEIC file, which web browsers can't display. Export it as a JPG and use that instead.`)
}

/* ── 2. Read your details file ──────────────────────────── */
let details = {}
if (existsSync(detailsPath)) {
  try {
    details = JSON.parse(readFileSync(detailsPath, 'utf8') || '{}')
  } catch (err) {
    fail(
      `public/photos/photo-details.json has a typo and can't be read:\n  ${err.message}\n` +
      `  Common causes: a missing comma between entries, a trailing comma after the last item,\n` +
      `  or a missing quote mark. Pasting the file into https://jsonlint.com will point to the exact spot.`,
    )
  }
  if (details === null || typeof details !== 'object' || Array.isArray(details)) {
    fail('public/photos/photo-details.json must start with { and end with }, with one entry per photo file name.')
  }
}

/* ── 3. Add blank entries for new photos (local runs only) ─ */
const added = images.filter(n => !(n in details))
if (added.length && !IN_CI) {
  for (const n of added) details[n] = { alt: '', location: '', coordinates: '', tags: [] }
  writeFileSync(detailsPath, JSON.stringify(details, null, 2) + '\n')
  console.log(`photos: added ${added.length} blank entr${added.length === 1 ? 'y' : 'ies'} to photo-details.json — fill them in!`)
}

/* ── 4. Turn your details into clean data ───────────────── */
function parseCoordinates(name, d) {
  let lat = null
  let lng = null
  if (typeof d.coordinates === 'string' && d.coordinates.trim()) {
    const m = d.coordinates.match(/-?\d+(?:\.\d+)?/g)
    if (m && m.length === 2) { lat = Number(m[0]); lng = Number(m[1]) }
    else warn(`"${name}": couldn't read coordinates "${d.coordinates}". Expected something like "44.4280, -110.5885".`)
  } else if (typeof d.lat === 'number' && typeof d.lng === 'number') {
    lat = d.lat; lng = d.lng
  }
  if (lat !== null && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    warn(`"${name}": coordinates ${lat}, ${lng} are out of range (latitude comes first, then longitude).`)
    return { lat: null, lng: null }
  }
  return { lat, lng }
}

function parseTags(d) {
  const raw = Array.isArray(d.tags) ? d.tags : typeof d.tags === 'string' ? d.tags.split(',') : []
  return [...new Set(raw.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
}

// Where the grid thumbnail's crop starts, top to bottom: 0 = top of the photo, 1 = bottom,
// 0.5 = middle. Leave it unset to keep the normal, centred thumbnail crop.
function parseCropY(name, d) {
  if (d.thumbCropY === undefined || d.thumbCropY === null || d.thumbCropY === '') return null
  const n = Number(d.thumbCropY)
  if (Number.isNaN(n)) {
    warn(`"${name}": thumbCropY is "${d.thumbCropY}", which isn't a number. Use something between 0 and 1, e.g. 0.3.`)
    return null
  }
  if (n < 0 || n > 1) {
    warn(`"${name}": thumbCropY is ${n}, outside the 0–1 range. Use 0 (top) through 1 (bottom).`)
    return Math.max(0, Math.min(1, n))
  }
  return n
}

for (const key of Object.keys(details)) {
  if (!imageSet.has(key)) warn(`photo-details.json has an entry for "${key}", but that file isn't in public/photos/.`)
}

// Order: the order in photo-details.json first, then any photos without an entry.
const ordered = [
  ...Object.keys(details).filter(k => imageSet.has(k)),
  ...images.filter(n => !(n in details)),
]

/* ── 5. Make smaller copies for fast loading (needs sharp) ─ */
let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  console.log('photos: "sharp" is not installed, so photos will be used at their original size (fine locally, slower online).')
}

const made = new Map() // photo name -> output file name
if (sharp) {
  mkdirSync(thumbsDir, { recursive: true })
  mkdirSync(largeDir, { recursive: true })
  const stale = (out, src) => IN_CI || !existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs

  for (const name of ordered) {
    const src = path.join(dir, name)
    const outName = name + '.jpg'
    try {
      const thumbOut = path.join(thumbsDir, outName)
      const largeOut = path.join(largeDir, outName)
      if (stale(thumbOut, src)) {
        await sharp(src).rotate().flatten({ background: '#0c0c0c' })
          .resize({ width: 640, withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true }).toFile(thumbOut)
      }
      if (stale(largeOut, src)) {
        await sharp(src).rotate().flatten({ background: '#0c0c0c' })
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, mozjpeg: true }).toFile(largeOut)
      }
      made.set(name, outName)
    } catch (err) {
      warn(`"${name}": couldn't be resized (${err.message}). The original file will be used instead.`)
    }
  }

  // Tidy up smaller copies of photos that no longer exist.
  for (const folder of [thumbsDir, largeDir]) {
    for (const f of readdirSync(folder)) {
      if (!new Set(made.values()).has(f)) rmSync(path.join(folder, f), { force: true })
    }
  }
}

/* ── 6. Write the list the website reads ────────────────── */
const photos = ordered.map(name => {
  const d = details[name] && typeof details[name] === 'object' ? details[name] : {}
  const { lat, lng } = parseCoordinates(name, d)
  return {
    file: name,
    thumbFile: made.get(name) ?? null,
    largeFile: made.get(name) ?? null,
    alt: typeof d.alt === 'string' ? d.alt.trim() : '',
    location: typeof d.location === 'string' ? d.location.trim() : '',
    lat,
    lng,
    tags: parseTags(d),
    thumbCropY: parseCropY(name, d),
  }
})

writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ photos }, null, 2) + '\n')

/* ── 7. Report ──────────────────────────────────────────── */
const noLocation = photos.filter(p => p.lat === null).map(p => p.file)
const noTags = photos.filter(p => p.tags.length === 0).map(p => p.file)
if (noLocation.length) warn(`${noLocation.length} photo(s) have no coordinates, so they won't appear on the map: ${noLocation.join(', ')}`)
if (noTags.length) warn(`${noTags.length} photo(s) have no tags, so they only show under "All": ${noTags.join(', ')}`)

console.log(`photos: ${photos.length} photo${photos.length === 1 ? '' : 's'} ready (${photos.length - noLocation.length} on the map)`)
for (const w of warnings) console.warn('  ⚠ ' + w)