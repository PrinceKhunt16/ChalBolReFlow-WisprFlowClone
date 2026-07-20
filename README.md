# ChalBolReFlow

<p align="center">
  <video src="previews/demo.mp4" width="80%" controls />
  <img src="previews/IMG1.png" width="80%" />
  <img src="previews/IMG2.png" width="80%" />
  <img src="previews/IMG3.png" width="80%" />
  <img src="previews/IMG4.png" width="80%" />
  <img src="previews/IMG5.png" width="80%" />
</p>

## Start the App

1. Install desktop dependencies once:

```bash
cd desktop
npm install
```

2. Start the desktop app from the project root:

```bash
npm run dev
```

The Electron main process starts the FastAPI backend automatically, chooses the configured local port from `app-config.json`, and falls back to a free port if the preferred one is busy.

3. Add your Groq API key inside the app:

Open `Settings` → `AI Provider` → `API Key`, paste your key, then return to Home and start dictation.

The packaged app uses localhost communication only and stores backend data in the user profile instead of the app bundle.

If you want to keep the app running after VS Code closes, use the detached launcher instead:

```bash
npm run open
```

That starts the backend and Electron app in the background and writes logs to the user data directory.

To stop the detached processes later:

```bash
npm run stop
```

You can also run them separately if you want to start only one part:

```bash
npm run dev:backend
npm run dev:desktop
```

## Build A Packaged App

To create installable desktop builds:

```bash
npm run dist
```

That builds the React frontend, freezes the FastAPI backend into a single executable with PyInstaller, bundles that executable into Electron Builder, and emits platform installers.
