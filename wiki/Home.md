# VideoViz Documentation

VideoViz is a lightweight browser app that captures live camera video and renders two rolling videograms:
- A horizontal (row-averaged) videogram below the video
- A vertical (column-averaged) videogram to the right of the video

## Features
- Live webcam capture using `getUserMedia`
- Real-time rolling videogram rendering on `<canvas>`
- Adjustable sample width to control visual detail/performance
- Responsive UI for desktop and mobile browsers
- Graceful camera-permission error handling

## Project Structure
- `index.html`: App layout (controls, video preview, videogram canvases)
- `style.css`: Responsive visual design
- `app.js`: Camera handling and videogram generation loop

## Run Locally
No build step is required.

1. Clone the repository.
2. Open the project folder.
3. Serve files over a local HTTP server (recommended for camera permissions), for example:
   ```bash
   python3 -m http.server 8080
   ```
4. Open `http://localhost:8080` in a modern browser.

You can also open `index.html` directly, but some browsers are stricter about camera access from `file://` URLs.

## Usage
1. Click **Start Camera**.
2. Allow camera permission when prompted.
3. Watch both videograms update in real time.
4. Optionally adjust **Sample width** before starting to balance speed/detail.
5. Click **Stop Camera** to end capture.

## How the Videograms Work
- **Horizontal (row-averaged):** For each frame, average pixel values across all rows for every column, producing a 1-pixel-high strip. This strip is appended to the bottom of the canvas, shifting older strips up.
- **Vertical (column-averaged):** For each frame, average pixel values across all columns for every row, producing a 1-pixel-wide strip. This strip is appended to the right of the canvas, shifting older strips left.

## Browser Notes
- Requires a browser with camera and canvas support.
- Camera access requires user permission.
- If permission is denied, the UI displays a status message and remains usable.

## Development
- Start a local server as above
- Open DevTools to watch console errors
- Verify both videograms update and layout is responsive
- See commit flow and PR screenshot tips in repo history

## Deploy to GitHub Pages
This repository is configured to deploy automatically with GitHub Actions whenever `main` is updated.

- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main` (or manual run from Actions tab)
- Publish target: GitHub Pages environment
- Site URL: `https://alexarje.github.io/videoviz/`

## License
See `LICENSE`.
