# ONE UI — Deploy to OpenClaw Device

## Device
- Host: `192.168.100.71`
- User: `mushahid`
- Project path: `/home/mushahid/one/ui`

## Build & Deploy

```bash
# 1. Build frontend
cd E:/one/ui
npx vite build

# 2. Deploy built files + source
scp -r dist/* mushahid@192.168.100.71:/home/mushahid/one/ui/dist/
scp src/main.ts mushahid@192.168.100.71:/home/mushahid/one/ui/src/main.ts
scp src/ws.ts mushahid@192.168.100.71:/home/mushahid/one/ui/src/ws.ts
scp src/ui/ChatPanel.ts mushahid@192.168.100.71:/home/mushahid/one/ui/src/ui/ChatPanel.ts
scp server/index.ts mushahid@192.168.100.71:/home/mushahid/one/ui/server/index.ts
scp index.html mushahid@192.168.100.71:/home/mushahid/one/ui/index.html
```

## Restart Server (if server/index.ts changed)

```bash
# Kill old server
ssh mushahid@192.168.100.71 'fuser -k 3002/tcp 2>/dev/null'
sleep 1

# Start new server
ssh mushahid@192.168.100.71 'cd /home/mushahid/one/ui && nohup npx tsx server/index.ts &>/tmp/one-server.log &'

# Verify
sleep 3
ssh mushahid@192.168.100.71 'cat /tmp/one-server.log && ss -tlnp | grep 3002'
```

## Quick One-liner (build + deploy + restart)

```bash
cd E:/one/ui && npx vite build && scp -r dist/* mushahid@192.168.100.71:/home/mushahid/one/ui/dist/ && scp server/index.ts mushahid@192.168.100.71:/home/mushahid/one/ui/server/index.ts && scp src/main.ts mushahid@192.168.100.71:/home/mushahid/one/ui/src/main.ts && scp index.html mushahid@192.168.100.71:/home/mushahid/one/ui/index.html && ssh mushahid@192.168.100.71 'fuser -k 3002/tcp; sleep 1; cd /home/mushahid/one/ui && nohup npx tsx server/index.ts &>/tmp/one-server.log &'
```

## Ports
- **5173** — Vite dev server (local dev, auto-reload)
- **3002** — Express + WS server (production, serves dist/ + API + WebSocket)

## Notes
- Vite dev server (`npx vite --host`) serves from `public/` and source files with HMR
- Express server serves from `dist/` (must build first)
- If only frontend changed (no server/index.ts), no need to restart server — just deploy dist/
- Static assets (logo, favicon, textures) go in `public/` and are copied to `dist/` by Vite build
- `lsof` is not available on the device — use `fuser -k 3002/tcp` to kill port
