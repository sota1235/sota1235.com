// @ts-check
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import react from '@astrojs/react'
import fetchMediaData from './src/integrations/fetch-media-data'
import partytown from '@astrojs/partytown'
import { remarkLinkBookmark } from '@sota1235/remark-link-bookmark'
import ogpCache, { ogpCacheOption } from './src/integrations/ogp-cache'

// https://astro.build/config
export default defineConfig({
  site: 'https://sota1235.com',
  markdown: {
    remarkPlugins: [
      [
        remarkLinkBookmark,
        {
          mergeClassNames: {
            container: 'not-prose',
          },
          cache: ogpCacheOption,
        },
      ],
    ],
  },
  integrations: [
    mdx(),
    sitemap(),
    react(),
    fetchMediaData(),
    ogpCache(),
    partytown({
      config: {
        forward: ['dataLayer.push'],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
