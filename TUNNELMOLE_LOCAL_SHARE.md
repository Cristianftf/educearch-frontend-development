# Tunnelmole share setup (frontend + backend)

This repository is configured to be shared with Tunnelmole and tested from multiple external devices.

## 1) Base config

Use these values in `.env.local`:

```env
NEXT_PUBLIC_API_URL=/api
BACKEND_INTERNAL_URL=http://localhost:8080
```

Notes:
- `NEXT_PUBLIC_API_URL=/api` keeps browser calls same-origin on the frontend URL and avoids CORS issues in normal flow.
- `BACKEND_INTERNAL_URL` is used by Next.js rewrites to reach local Spring Boot.

## 2) One-command startup (recommended)

Dev stack with shared frontend URL:

```powershell
cd C:\Users\Cristian\Downloads\educearch-frontend-development
cmd /c npm run share:stack
```

Production-like stack:

```powershell
cmd /c npm run share:stack:prod
```

Production-like with backend tunnel for WebSocket fallback:

```powershell
cmd /c npm run share:stack:prod:ws
```

The script starts backend/frontend, opens tunnels, and prints the generated public URL(s).

## 3) Manual startup (alternative)

Backend:

```powershell
cd backend
mvn spring-boot:run
```

Frontend:

```powershell
cd C:\Users\Cristian\Downloads\educearch-frontend-development
cmd /c npm run build
cmd /c npm run start:public
```

For quick development testing you can run:

```powershell
cmd /c npm run dev:public
```

## 4) Create public Tunnelmole URL for frontend

```powershell
cd C:\Users\Cristian\Downloads\educearch-frontend-development
cmd /c npm run share:frontend
```

Share the generated URL `https://xxxxx.tunnelmole.net`.

## 5) Realtime chat/WebSocket fallback (if needed)

If realtime features fail through frontend rewrites in your environment:

1. Open a backend tunnel:
```powershell
cmd /c npm run share:backend
```
2. Copy backend URL and set:
```env
NEXT_PUBLIC_WS_URL=wss://<backend-subdomain>.tunnelmole.net/ws-native
```
3. Restart frontend (`start:public` or `dev:public`).

Keep `NEXT_PUBLIC_API_URL=/api` for REST and use `NEXT_PUBLIC_WS_URL` only for STOMP/WebSocket.

## 6) Validation checklist

1. Open shared frontend URL from another device (mobile data if possible).
2. Register/login with at least two different users.
3. Validate API calls in browser DevTools Network tab (`/api/...` with 2xx/401 as expected).
4. If chat is enabled, confirm WebSocket connects (`/ws-native`).
5. Confirm no CORS or Mixed Content errors in console.
