# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal website built with Astro, featuring a blog, media listings (podcasts, slides, company blog posts), and biography. The site is deployed to GitHub Pages at https://sota1235.com.

## Development Commands

### Essential Commands
```bash
pnpm dev              # Start dev server at http://localhost:4321
pnpm run build        # Type-check with astro check, then build for production
pnpm run preview      # Preview production build locally
pnpm run format       # Format code with Prettier
pnpm run format:check # Check code formatting
```

### Quality Checks (Run in CI)
```bash
pnpm run a11y-check   # Run pa11y accessibility checks
pnpm run lhci         # Run Lighthouse CI performance checks
pnpm run astro check  # Type-check Astro files
```

### Other Commands
```bash
pnpm run update-checksum  # Update aqua-checksums.json after modifying aqua.yaml
```

## Architecture

### Content Collections System

The site uses Astro's content collections to manage different content types:

- **blog** (`src/content/blog/`): Markdown/MDX blog posts with frontmatter
- **companyBlog** (`src/content/companyBlog/`): JSON files referencing external company blog posts (Mercari, 10X)
- **podcasts** (`src/content/podcasts/`): JSON files for podcast episodes (言語化.fm, Replay.fm)
- **slides** (`src/content/slides/`): JSON files for presentation/talk metadata
- **other** (`src/content/other/`): Additional media items

All collections are defined with Zod schemas in `src/content/config.ts`.

### Custom Astro Integration

**fetch-media-data** (`src/integrations/fetch-media-data.ts`):
- Custom integration that runs during `astro:build:start` hook
- Fetches podcast RSS feeds from Anchor.fm for 言語化.fm and Replay.fm
- Automatically creates JSON files in `src/content/podcasts/` for new episodes
- Prevents duplicate files by checking if they exist before writing

**ogp-cache** (`src/integrations/ogp-cache.ts`):
- Runs during `astro:config:setup` (so it runs for both `astro check` and `astro build`)
- Scans blog posts for bare-URL paragraphs (the ones `@sota1235/remark-link-bookmark` turns into link cards), fetches OGP info for any URL not yet cached, and writes it to `src/data/ogp-cache.json`
- The same file is passed to `remarkLinkBookmark` via its `cache` option, so cached URLs are never re-fetched at build time (protects the build from external sites going down or blocking bots)
- Fetch failures are logged as warnings; the cache file is committed and gets updated by the daily build PR

### Page Structure

- **Dynamic routes**: `/blog/[slug]/` renders individual blog posts
- **OGP images**: `/blog/[slug]/ogp.png.ts` dynamically generates Open Graph images using `@vercel/og`
- **RSS feed**: `/rss.xml.js` generates RSS feed for blog posts
- **Main pages**: `/` (home), `/blog` (blog listing), `/media` (podcasts/slides), `/biography`

### Styling

- Uses Tailwind CSS with custom color scheme (custom black: #154B5F)
- Typography plugin with custom heading sizes
- Custom Tailwind variants for prose styling (`prose-inline-code`, `prose-code-link`)

### Markdown Processing

- Uses `@sota1235/remark-link-bookmark` plugin to render link cards
- Supports MDX for enhanced blog posts with React components

## Development Workflow

### Pre-commit Hooks

Husky + lint-staged runs on commit:
- Formats files matching `*.{md,json,yml,astro,ts,js,cjs,mjs}`
- Updates aqua checksums when `aqua.yaml` changes

### Package Manager

Uses **pnpm** (version 10.24.0 specified in package.json)

### Quality Standards

The CI pipeline (`.github/workflows/ci.yml`) enforces:
1. **Linting**: Prettier formatting check
2. **Type checking**: `astro check` for type safety
3. **Accessibility**: pa11y-ci on built site (checks /, /biography, /blog)
4. **Performance**: Lighthouse CI with preset thresholds

## Key Technical Details

- **TypeScript**: Strict mode enabled (`astro/tsconfigs/strict`)
- **React**: Used alongside Astro for interactive components (JSX with React 18)
- **Analytics**: Google Analytics via Partytown (offloads to web worker)
- **Site URL**: https://sota1235.com (configured in astro.config.mjs)
- **Language**: Japanese (`lang="ja"` in Layout.astro)

## Common Development Tasks

When adding new blog posts:
- Create `.md` or `.mdx` files in `src/content/blog/`
- Include required frontmatter: `title`, `description`, `pubDate`
- Optional: `updatedDate`, `draft` (defaults to false)

When podcasts or media update:
- The build process automatically fetches new podcast episodes
- Manual JSON files can be added to respective content collection directories
- Follow the schema defined in `src/content/config.ts`
