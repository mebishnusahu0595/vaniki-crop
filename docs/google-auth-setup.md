# Google Auth Env Setup

Use backend-verified ID token flow with separate env files per app.

## 1) API env (root)
Create `.env` in project root from `.env.example` and set:
- `GOOGLE_AUTH_ENABLED=true`
- `GOOGLE_OAUTH_ALLOWED_CLIENT_IDS=<comma-separated client IDs>`

Example:
`GOOGLE_OAUTH_ALLOWED_CLIENT_IDS=web-client-id.apps.googleusercontent.com,android-client-id.apps.googleusercontent.com,ios-client-id.apps.googleusercontent.com`

## 2) Web env
Create `apps/web/.env` from `apps/web/.env.example` and set:
- `VITE_GOOGLE_CLIENT_ID=<web client ID>`

## 3) Mobile env
Create `apps/mobile/.env` from `apps/mobile/.env.example` and set:
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client ID>`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android client ID>`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client ID>`

## 4) Keep IDs aligned
The web/mobile client IDs must also be included in API allow-list:
- `GOOGLE_OAUTH_ALLOWED_CLIENT_IDS`

## 5) Restart after changes
After editing env files, restart these dev servers:
- API server
- Web Vite server
- Mobile Expo server
