import type { AstroIntegration } from 'astro'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchOgpInfo,
  type CacheOption,
  type OgpInfo,
} from '@sota1235/remark-link-bookmark/dist/ogp.js'

const cacheFilePath = fileURLToPath(new URL('../data', import.meta.url))
const cacheFileName = 'ogp-cache.json'
const cacheFile = path.join(cacheFilePath, cacheFileName)
const blogDir = fileURLToPath(new URL('../content/blog', import.meta.url))

/**
 * remark-link-bookmark に渡す cache オプション。
 * ここで指定したファイルに OGP 情報が永続化され、2 回目以降のビルドでは
 * 外部サイトへのリクエストを行わずにリンクカードが生成される。
 */
export const ogpCacheOption: Required<CacheOption> = {
  cacheFilePath,
  cacheFileName,
}

type OgpCache = Record<string, OgpInfo>

async function readCache(): Promise<OgpCache> {
  if (!existsSync(cacheFile)) {
    return {}
  }
  return JSON.parse(await readFile(cacheFile, 'utf-8')) as OgpCache
}

async function writeCache(cache: OgpCache): Promise<void> {
  // diff を安定させるため URL 順にソートして書き出す
  const sorted = Object.fromEntries(
    Object.entries(cache).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  )
  await mkdir(cacheFilePath, { recursive: true })
  await writeFile(cacheFile, JSON.stringify(sorted, null, 2) + '\n')
}

function isBookmarkUrl(text: string): boolean {
  if (text === '' || /\s/.test(text)) {
    return false
  }
  try {
    return new URL(text).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * remark-link-bookmark がリンクカード化する URL を Markdown 本文から抜き出す。
 * プラグインは「https の URL だけで構成された段落」をカード化するので、
 * 前後が空行（またはファイル端）で、コードブロック外にある URL 行を対象とする。
 */
export function collectBookmarkUrls(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim())
  const urls: string[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^(```|~~~)/.test(line)) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) {
      continue
    }
    const prev = lines[i - 1] ?? ''
    const next = lines[i + 1] ?? ''
    if (prev === '' && next === '' && isBookmarkUrl(line)) {
      urls.push(line)
    }
  }

  return urls
}

async function collectBlogBookmarkUrls(): Promise<string[]> {
  const files = (await readdir(blogDir, { recursive: true })).filter((file) =>
    /\.mdx?$/.test(file)
  )
  const urls = new Set<string>()
  for (const file of files) {
    const markdown = await readFile(path.join(blogDir, file), 'utf-8')
    for (const url of collectBookmarkUrls(markdown)) {
      urls.add(url)
    }
  }
  return [...urls]
}

function describeError(e: unknown): string {
  if (e instanceof Error) {
    return e.message
  }
  // open-graph-scraper は { error: true, result: { error: string } } を throw する
  if (typeof e === 'object' && e !== null && 'result' in e) {
    const result = (e as { result?: { error?: unknown } }).result
    if (result?.error !== undefined) {
      return String(result.error)
    }
  }
  return String(e)
}

/**
 * ビルド前にブログ記事内のリンクカード対象 URL の OGP 情報を取得し、
 * キャッシュファイルに書き出す integration。
 *
 * remark-link-bookmark 自身にもキャッシュ書き込み機能はあるが、記事ごと・URL ごとに
 * 並列で同じファイルを read-modify-write するため取りこぼしが起きうる。
 * ここで事前に直列で埋めておくことで、プラグイン側は常にキャッシュヒットになる。
 */
export default (): AstroIntegration => ({
  name: '@sota1235/ogp-cache',
  hooks: {
    'astro:config:setup': async ({ logger }) => {
      const cache = await readCache()
      const urls = await collectBlogBookmarkUrls()
      const missing = urls.filter((url) => cache[url] === undefined)

      if (missing.length === 0) {
        logger.info(`OGP cache is up to date (${urls.length} urls)`)
        return
      }

      logger.info(`Fetching OGP info for ${missing.length} uncached url(s)`)
      let added = 0
      for (const url of missing) {
        try {
          const info = await fetchOgpInfo(url, {})
          if (info === undefined) {
            throw new Error('open-graph-scraper returned an error result')
          }
          cache[url] = info
          added++
        } catch (e) {
          logger.warn(`Failed to fetch OGP info: ${url} (${describeError(e)})`)
        }
      }

      if (added > 0) {
        await writeCache(cache)
        logger.info(`OGP cache updated: ${added} url(s) added to ${cacheFile}`)
      }
    },
  },
})
