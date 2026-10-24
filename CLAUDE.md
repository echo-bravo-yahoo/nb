# nb

nb records notes into InfluxDB. A note is one recorded event, such as a weight or a blood-pressure reading, and belongs to a stream defined in `~/.nbrc`. The `nb` CLI and a LAN-only web form both write notes. See `~/.claude/docs/nb.md` for streams, config, and token handling.

## Build, test, run

```bash
npm ci
npm test            # node:test over test/*.test.js; needs no InfluxDB
npm run vendor      # copy feathers into web/vendor/feathers (needed before running the server)
npm run server      # web form on :8080 (PORT overrides)
npm run deploy      # test, then ship the server to stockholm
```

`npm run server` writes to the real `personal` bucket, so a note recorded through a local server is a real note.

## Web form

The form (`web/index.html`, `web/app.js`) uses feathers primitives only and has no stylesheet of its own beyond the page column. feathers is built from the private `~/workspace/plumage` repo, so `scripts/vendor-feathers.sh` copies its `dist/feathers.css` and fonts into the gitignored `web/vendor/feathers/` instead of committing them.

`lib/note.js` (`buildPoint`) is the one path from input to InfluxDB point for both the CLI and the server. `lib/web.js` takes its dependencies as arguments, so `test/web.test.js` runs it against fakes.

## Deployment

- stockholm runs OMV compose stack `nb` (container `nb`, image `node:24-alpine`), which serves `https://nb.echobravoyahoo.net` through the `nb.subdomain.conf` vhost on SWAG's LAN-only address. There is no login; the vhost is LAN-only.
- The code is a copy at `/home/pi/apps/nb`, mounted read-only. `npm run deploy` refreshes it, installs packages in a throwaway container, and restarts `nb`.
- The container reads the write token from `/home/pi/.config/nb/influx-write-token` (`INFLUX_WRITE_TOKEN_FILE`), which every deploy rewrites from stockholm's `~/.secrets.privileged.env`. After a token rotation, run `npm run deploy`.
- The container reads stockholm's `~/.nbrc` through a single-file bind mount, which keeps the old inode when the file is replaced. After `~/.nbrc` changes on stockholm, run `docker restart nb`.
- Stack changes go through the OMV config DB (`~/.claude/skills/stockholm/omv-compose.md`), never the rendered files.

## Release pipeline

`echo-bravo-yahoo/nb` on GitHub (public).

- Branching: work lands on `wip` through `worktree-land`. `main` predates the InfluxDB rewrite.
- CI: none. `npm run deploy` runs `npm test` before it ships anything.
- Release: the installed `nb` CLI is the primary checkout's `nb.js`, linked globally, so landing on `wip` updates it. The web form ships with `npm run deploy`.