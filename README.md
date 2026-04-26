# VideoViz

Live camera visualization with dual videograms and optional motion (frame differencing) view.

<p align="center">
	<img src=".github/illustration.png" alt="VideoViz UI illustration" width="500" />
</p>

Try it:
- **Live demo**: https://alexarje.github.io/videoviz/

Docs:
- **Wiki**: https://github.com/alexarje/videoviz/wiki

## Demo (GIFs)
Regular view:

![VideoViz regular view](documentation/gif/videoviz_regular.gif)

Motion view (Frame Differencing):

![VideoViz motion view](documentation/gif/videoviz_motion.gif)

## What it does
- Captures live webcam video (browser `getUserMedia`)
- Renders two rolling videograms:
  - **Horizontal avg** (row-averaged) over time
  - **Vertical avg** (column-averaged) over time
- Optional **Frame Differencing** mode that shows a motion/difference view and uses that data for the videograms

## Controls (current defaults)
- **Layout**: 2×2 grid of square 400×400 canvases (camera/motion, two videograms, self-similarity)
- **Duration**: fixed rolling buffer length (**400** frames)
- **Mirror**: toggle
- **Frame Differencing**: toggle (**default: off**)
- **Threshold**: slider (**default: 0**)
- **Normalize**: toggle (enabled by default)

## Run locally
Camera access is most reliable from `http://` (not `file://`), so serve the folder with a tiny local server:

```bash
cd videoviz
python3 -m http.server 8080
```

Then open `http://localhost:8080` and click **Start Camera**.

## Project structure
- `index.html`: layout + controls
- `style.css`: UI styling
- `app.js`: camera capture + frame processing + videogram rendering

## License
See [`LICENSE`](LICENSE).
