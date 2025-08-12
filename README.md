# root dev — AI Website Generator

root dev is a full‑stack AI website generator powered by Gemini 2.5 Flash. Describe what you want and get a responsive frontend (HTML/CSS/JS) plus optional Node.js backend code — all previewable in the app.

- Creator: Amit Jaiswal
- Contact: amitjaiswal044@gmail.com

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and enter your Gemini API key in the left panel. Your key is stored locally in your browser only.

## Features

- Quick Preview: generate a minimal site structure for fast iteration
- Full Stack: generate complete HTML, CSS, JS, and an Express server with routes
- Auto Fix: if the JSON is invalid, attempts a one‑click repair via Gemini
- Download: export the generated files

## Notes

- For production usage, proxy the Gemini API via a secure backend. Never ship API keys to the client.
- This project is not affiliated with lovable.dev; it is rebranded as root dev.
