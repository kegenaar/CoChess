# CoChess - Cooperative Mega Chess

A cooperative chess variant where two players (Player A and Player B) team up against an AI Enemy.

## How to Play

1. **Player A** controls the pieces on the bottom-left.
2. **Player B** controls the pieces on the bottom-right.
3. **Enemy** controls the pieces on the top (mirrored setup).
4. Players take turns: Player A -> Enemy -> Player B -> Enemy.
5. **Goal**: Capture all Enemy Kings.
6. **Lose Condition**: If ANY allied King (A or B) is captured.

## Hosting

This game is built with **Node.js**, **Express**, and **Socket.io** for real-time multiplayer support.

### Recommended Hosting: Glitch

[Glitch](https://glitch.com/) is the easiest way to host this for free.

1. Go to [glitch.com](https://glitch.com/) and create an account.
2. Click **"New Project"** -> **"Import from GitHub"** (if you push this to GitHub) OR **"glitch-hello-node"** (to start blank).
3. If starting blank, copy the files from this project into the Glitch project.
   - `package.json`
   - `server.js`
   - `index.html`
   - `game.js`
   - `simple-ai.js`
   - `debug-scenarios.js`
   - `styles.css`
4. Glitch will automatically install dependencies and start the server.
5. Share the "Live Site" URL with your friend.

### Recommended Hosting: Render

[Render](https://render.com/) is another great option.

1. Push this code to a GitHub repository.
2. Create a new **Web Service** on Render.
3. Connect your GitHub repository.
4. Use the following settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Deploy!

## Local Development

1. Install Node.js.
2. Run `npm install` to install dependencies.
3. Run `npm start` to start the server.
4. Open `http://localhost:3000` in two different browser tabs/windows to simulate two players.
