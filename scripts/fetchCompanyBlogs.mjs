import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const companyBlogDir = join(__dirname, '..', 'src', 'content', 'companyBlog')

const ARCHIVE_URL = 'https://product.10x.co.jp/archive/author/sota1235'
const ENTRY_URL_PATTERN = /\/entry\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{6})/

function extractDateKeyFromUrl(url) {
  const match = url.match(ENTRY_URL_PATTERN)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`
}

function extractPubDateFromUrl(url) {
  const match = url.match(ENTRY_URL_PATTERN)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

function decodeHtmlEntities(str) {
  const namedEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  }
  return str.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|[a-zA-Z]+);/g,
    (match, decimal, hex) => {
      if (decimal) return String.fromCharCode(Number(decimal))
      if (hex) return String.fromCharCode(parseInt(hex, 16))
      return namedEntities[match] ?? match
    }
  )
}

function stripHtmlTags(str) {
  let result = str
  let prev
  do {
    prev = result
    result = result.replace(/<[^>]*>/g, '')
  } while (result !== prev)
  return result
}

function parseEntries(html) {
  const entries = new Map()
  const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/g
  for (const m of html.matchAll(linkRegex)) {
    const attrs = m[1]
    if (!/class="[^"]*\bentry-title-link\b[^"]*"/.test(attrs)) continue
    const hrefMatch = attrs.match(/href="([^"]+)"/)
    if (!hrefMatch) continue
    const link = hrefMatch[1]
    if (!ENTRY_URL_PATTERN.test(link)) continue
    if (entries.has(link)) continue
    const title = decodeHtmlEntities(stripHtmlTags(m[2]).trim())
    entries.set(link, title)
  }
  return Array.from(entries, ([link, title]) => ({ link, title }))
}

function collectExistingLinks(dirPath) {
  const links = new Set()
  if (!existsSync(dirPath)) return links

  for (const file of readdirSync(dirPath)) {
    if (!file.endsWith('.json')) continue
    try {
      const content = JSON.parse(readFileSync(join(dirPath, file), 'utf-8'))
      if (content.link) links.add(content.link)
    } catch (e) {
      console.warn(`Failed to parse company blog JSON: ${file}`, e)
    }
  }
  return links
}

async function main() {
  const res = await fetch(ARCHIVE_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${ARCHIVE_URL}: ${res.status}`)
  }
  const html = await res.text()
  const entries = parseEntries(html)
  console.log(`Found ${entries.length} entries on archive page.`)

  const existingLinks = collectExistingLinks(companyBlogDir)

  let added = 0
  for (const { link, title } of entries) {
    if (existingLinks.has(link)) continue

    const uniqueKey = extractDateKeyFromUrl(link)
    if (!uniqueKey) continue

    const pubDate = extractPubDateFromUrl(link)
    if (!pubDate) continue

    const filename = `10x-${uniqueKey}.json`
    const path = join(companyBlogDir, filename)
    if (existsSync(path)) continue

    const payload = {
      title,
      company: '10X',
      link,
      pubDate,
    }
    writeFileSync(path, JSON.stringify(payload, null, 2) + '\n')
    console.log(`Added: ${filename}`)
    added++
  }

  console.log(`Done. ${added} new article(s) added.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
