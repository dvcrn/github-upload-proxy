# github-upload-proxy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dvcrn/github-upload-proxy)

A Cloudflare Worker proxy that lets GitHub Apps and bots upload images and videos to GitHub issues and PRs (`uploads.github.com/user-attachments/assets`).

## Why

GitHub Apps cannot upload issue/PR user-attachments—only user tokens can, and handing a user PAT directly to an autonomous agent session exposes broad account permissions.

`github-upload-proxy` isolates the user token inside a single-purpose Cloudflare Worker that can **only** upload attachments and return the resulting `https://github.com/user-attachments/assets/...` URL. The agent session then embeds that URL into issues or PRs using its own GitHub App credentials.

## What It Does

1. Authenticates the caller via `API_KEY` (`Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`).
2. Accepts a JSON payload (`{ repo_id, name, content_type, data }`) with base64-encoded file bytes.
3. Validates the MIME type (`image/{png,jpeg,gif,webp}`, `video/{mp4,quicktime}`) and size (default max 25 MiB).
4. Decodes the payload and forwards raw bytes to `https://uploads.github.com/user-attachments/assets` using `GITHUB_UPLOAD_TOKEN`.
5. Returns GitHub's JSON response (`{ "url": "https://github.com/user-attachments/assets/..." }`).

## Setup & Deploy

Set the Worker secrets:

```bash
wrangler secret put API_KEY
wrangler secret put GITHUB_UPLOAD_TOKEN
```

Deploy:

```bash
npm run deploy
```

## Usage

```bash
jq -n --arg d "$(base64 -w0 shot.png)" \
  '{repo_id:1264569176,name:"shot.png",content_type:"image/png",data:$d}' \
  | curl -sS https://github-upload-proxy.d.pn \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @- \
  | jq -r .url
```

## License

[MIT](./LICENSE)
