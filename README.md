# VideoViz

VideoViz is a lightweight browser app that captures live camera video and renders a rolling videogram.

For each frame, the app averages pixel values across all rows for every column, producing a 1-pixel-high strip that represents that frame. That strip is appended to the bottom of the videogram canvas while older strips shift upward.

## Features

- Live webcam capture using `getUserMedia`
- Real-time rolling videogram rendering on `<canvas>`
- Adjustable sample width to control visual detail/performance
- Responsive UI for desktop and mobile browsers
- Graceful camera-permission error handling

## Project Structure

- `index.html`: App layout (controls, video preview, videogram canvas)
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
3. Watch the videogram update in real time.
4. Optionally adjust **Sample width** before starting to balance speed/detail.
5. Click **Stop Camera** to end capture.

## How the Videogram Works

At each animation frame:

1. Draw current video frame into an offscreen sample canvas.
2. For each x-coordinate, average RGB across all y rows.
3. Build a single-row RGBA strip from those averages.
4. Shift existing videogram up by one pixel.
5. Draw the new strip at the bottom.

This creates a temporal image where vertical position encodes time progression.

## Browser Notes

- Requires a browser with camera and canvas support.
- Camera access requires user permission.
- If permission is denied, the UI displays a status message and remains usable.

## Development

Use this lightweight workflow while iterating on the app.

### Start a local server

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` and keep browser DevTools open to watch console errors.

### Verify changes

1. Click **Start Camera** and confirm permission prompt appears.
2. Confirm camera preview is visible.
3. Confirm the videogram updates continuously while streaming.
4. Click **Stop Camera** and confirm the stream ends without errors.
5. Resize browser width and confirm layout remains usable on narrow screens.

### Capture a screenshot for PRs

Include one screenshot that shows:

- Camera panel
- Videogram panel
- Current status text

### Suggested commit flow

```bash
git add .
git commit -m "Describe your change"
git push
```

## License

See `LICENSE`.
