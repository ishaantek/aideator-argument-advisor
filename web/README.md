# Argument Advisor web demo

Interactive GBS-map argument advisor. The Express server keeps the OpenAI key
off the browser and, in production, also serves the built frontend.

## Requirements

- Node.js 20 or newer
- An OpenAI API key

## Development

```bash
npm ci
cp .env.example .env
# put OPENAI_API_KEY in .env
npm run dev
```

Open **http://localhost:5173**. The API is proxied to **http://localhost:8787**.

## Production

```bash
npm ci
npm run build
OPENAI_API_KEY=your_key npm start
```

Open **http://localhost:8787**. Confirm `GET /api/health` returns
`{"ok":true,"hasApiKey":true,...}`.

This is the setup to use for demos. Serving only the Vite `dist/` folder without
the Node server will show the UI but every coaching call will fail.
