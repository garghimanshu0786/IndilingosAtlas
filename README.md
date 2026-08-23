# IndilingosAtlas

Walk and talk on live language streets. Delhi and Tokyo.

## Requirements

- Node 22+

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Fill in `.env.local` from `.env.example` before running.

## Controls

| Input | Action |
| --- | --- |
| W | Forward |
| S | Back |
| A | Left |
| D | Right |
| Arrow keys | Look |
| Stick | Move (headset / touch) |

## Headset

```bash
npm run package
npm run package:run
sh quest/wire.sh
```

Use the on-screen stick or controller to walk. Enter immersive mode when the street is live.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run package` | Standalone bundle |
| `npm run package:run` | Run bundle on port 3000 |
| `sh quest/restart.sh` | Restart server and rewire headset |
