# Luganda to English Voice Translator

A production-ready Next.js App Router frontend for Luganda-to-English speech-to-speech translation using a deployed Modal Step-Audio2 API.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the required server-side variables:

```bash
MODAL_TRANSLATE_URL=https://your-modal-url.modal.run
MODAL_API_KEY=your-service-api-key
TRANSLATE_ALLOWED_ORIGINS=
```

`MODAL_TRANSLATE_URL` may be either the Modal base URL or the full
`https://your-modal-url.modal.run/v1/translate` endpoint. The server proxy
normalizes both forms, and normalizes other versioned translate paths back to
`/v1/translate`.

Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

The browser records Luganda microphone audio with `MediaRecorder` and sends it to the local Next.js route `POST /api/translate` as multipart `FormData`. The UI is intentionally fixed to the stable focused Luganda to English model with the default female voice.

The Next.js server route securely proxies the request to:

```text
${MODAL_TRANSLATE_URL}/v1/translate
```

It adds:

```text
Authorization: Bearer ${MODAL_API_KEY}
```

The Modal API key is never referenced by a client component and is never sent to the browser.

## Vercel Deployment

Vercel is the recommended production target for this app because it can host both
the Next.js frontend and the server-side `POST /api/translate` route. The browser
calls `/api/translate` on the same Vercel domain, while `MODAL_API_KEY` remains a
server-only environment variable.

1. Push this repository to GitHub.
2. In Vercel, choose `Add New` -> `Project` and import the GitHub repository.
3. Use the default Next.js framework settings.
4. Set the production branch to `main`.
5. Add these Vercel environment variables for Production, Preview, and Development
   as needed:

```bash
MODAL_TRANSLATE_URL=https://your-modal-url.modal.run
MODAL_API_KEY=your-service-api-key
TRANSLATE_ALLOWED_ORIGINS=
```

6. Deploy. After the first import, every push to `main` automatically creates a
   production deployment.

`TRANSLATE_ALLOWED_ORIGINS` is optional for Vercel same-origin deployments. Only set
it if another website must call this app's `/api/translate` route across origins.

## Testing With Modal

1. Confirm your Modal deployment is healthy with its `/health` endpoint.
2. Set `MODAL_TRANSLATE_URL` without a trailing path, for example `https://your-modal-url.modal.run`.
3. Start the frontend with `npm run dev`.
4. Press the microphone button, allow microphone access, speak Luganda, and press again to stop.
5. The app sends Luganda audio to `/api/translate`, displays English captions, and automatically plays generated English speech when `audio_base64` is returned.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run test
```

## Troubleshooting

Microphone permission denied:

- Use `https://` in production or `http://localhost` during local development.
- Reset site microphone permissions in the browser settings.
- Make sure another application is not exclusively holding the microphone.

API configuration errors:

- Verify `.env.local` contains `MODAL_TRANSLATE_URL` and `MODAL_API_KEY`.
- Restart the dev server after changing environment variables.
- Confirm `MODAL_TRANSLATE_URL` points to the deployed Modal service. Either the base URL or full `/v1/translate` endpoint is accepted.
- If the UI says `Configured Modal URL is not the Step-Audio2 FastAPI endpoint`, the URL is a Modal host but not the ASGI app endpoint. Use the URL printed for `StepAudio2ModalService.fastapi_app`, which should respond to `/health`.
- On Vercel, make sure `MODAL_TRANSLATE_URL` and `MODAL_API_KEY` are configured in Project Settings -> Environment Variables, then redeploy.
- If `/api/translate` returns 500 in production, check the Vercel Function logs for missing environment variables or upstream Modal errors.
- If sample clips return 404 on Vercel, verify `public/luganda_inputs/*.wav` is committed and that `.vercelignore` does not exclude `public/luganda_inputs`.

Translation service errors:

- Check the Modal service logs for model loading, timeout, or authorization failures.
- Try a shorter recording under 30 seconds.
- If text appears but audio does not, inspect the response for warnings and confirm `return_audio=true`.
