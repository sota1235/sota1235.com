import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import RssParser from 'rss-parser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const companyBlogDir = join(__dirname, '..', 'src', 'content', 'companyBlog')

const TENX_RSS = 'https://product.10x.co.jp/rss'
const SOTA1235_AUTHOR_MARKER = 'blog.hatena.ne.jp/sota1235/'

function extractDateKeyFromUrl(url) {
  const match = url.match(/\/entry\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{6})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`
}

function extractPubDateFromUrl(url) {
  const match = url.match(/\/entry\/(\d{4})\/(\d{2})\/(\d{2})\//)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

async function isAuthoredBySota1235(articleUrl) {
  try {
    const res = await fetch(articleUrl)
    if (!res.ok) return false
    const html = await res.text()
    return html.includes(SOTA1235_AUTHOR_MARKER)
  } catch (e) {
    console.warn(`Failed to fetch article page: ${articleUrl}`, e)
    return false
  }
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
  const parser = new RssParser()
  const feed = await parser.parseURL(TENX_RSS)
  const existingLinks = collectExistingLinks(companyBlogDir)

  let added = 0
  for (const item of feed.items) {
    const link = item.link
    if (!link) continue
    if (existingLinks.has(link)) continue

    const uniqueKey = extractDateKeyFromUrl(link)
    if (!uniqueKey) continue

    const pubDate = extractPubDateFromUrl(link)
    if (!pubDate) continue

    if (!(await isAuthoredBySota1235(link))) continue

    const filename = `10x-${uniqueKey}.json`
    const path = join(companyBlogDir, filename)
    if (existsSync(path)) continue

    const payload = {
      title: item.title ?? '',
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
