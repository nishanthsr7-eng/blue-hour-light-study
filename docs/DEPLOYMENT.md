# Deployment

The site is a static build (`dist/`), hosted on
[Cloudflare Pages](https://pages.cloudflare.com).

## Cloudflare Pages

Connect the GitHub repository in **Workers & Pages → Create → Pages**, then:

| Setting                | Value                                        |
| ---------------------- | -------------------------------------------- |
| Build command          | `npm run build`                              |
| Build output directory | `dist`                                       |
| Environment variables  | `NODE_VERSION=22`, `SITE_URL=<your address>` |

Every push to `main` deploys; pull requests get preview URLs.

`SITE_URL` (default `https://blue-hour-light-study.pages.dev`) fills the
canonical link, social tags, `robots.txt` and `sitemap.xml`. Change it if
you use another address or a custom domain.

## Headers

`public/_headers` sets a strict Content Security Policy (everything from
`'self'`, no third-party code), HSTS and other security headers, a one-year
cache for hashed assets, and no cache for the HTML. On Netlify the file works
as is; elsewhere, move the rules into that host's configuration.

## After a visual change

Rebuild, then refresh the screenshots and social image (needs Chrome or Edge):

```bash
npm run build
```

```bash
npm run capture
```

To refresh the season loop for the README, record it (also needs ffmpeg on
the PATH), then upload `recordings/season-loop.mp4` to GitHub:

```bash
npm run record
```

`public/_headers` lists `script-src 'self'`; the build adds the hash of its
one inline script (the desktop-only chunk preloader) to `dist/_headers`.
