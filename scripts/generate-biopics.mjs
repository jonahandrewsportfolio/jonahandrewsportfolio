// Scans public/biopics/ and writes public/biopics/manifest.json
// so the website knows which background photos to show.
// Runs automatically on every deploy — you never need to edit the manifest by hand.

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.resolve(here, '..', 'public', 'biopics')
const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i

if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

const files = readdirSync(dir)
  .filter(name => IMAGE.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(files, null, 2) + '\n')
console.log(`biopics: found ${files.length} image${files.length === 1 ? '' : 's'}`)
