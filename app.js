const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const cameraVideo = document.getElementById("cameraVideo");
const videogramCanvas = document.getElementById("videogramCanvas");
const videogramCanvasVert = document.getElementById("videogramCanvasVert");
const durationRange = document.getElementById("durationRange");
const durationValue = document.getElementById("durationValue");
const mirrorCheckbox = document.getElementById("mirrorCheckbox");
const diffCheckbox = document.getElementById("diffCheckbox");
const diffVideoCanvas = document.getElementById("diffVideoCanvas");
const diffVideoCtx = diffVideoCanvas ? diffVideoCanvas.getContext("2d") : null;
let frameDifferencing = false;
let prevFrame = null;
if (diffCheckbox) {
  diffCheckbox.addEventListener("change", (e) => {
    frameDifferencing = e.target.checked;
    prevFrame = null; // Reset on toggle
    // Show/hide video and diff canvas
    if (diffVideoCanvas && cameraVideo) {
      if (frameDifferencing) {
        cameraVideo.style.display = "none";
        diffVideoCanvas.style.display = "block";
      } else {
        cameraVideo.style.display = "block";
        diffVideoCanvas.style.display = "none";
      }
    }
  });
}

const diffThreshold = document.getElementById("diffThreshold");
const diffThresholdValue = document.getElementById("diffThresholdValue");
const normalizeCheckbox = document.getElementById("normalizeCheckbox");
let threshold = 24;
let normalize = true;
if (diffThreshold) {
  diffThreshold.addEventListener("input", (e) => {
    threshold = Number(e.target.value);
    if (diffThresholdValue) diffThresholdValue.textContent = threshold;
  });
  threshold = Number(diffThreshold.value);
  if (diffThresholdValue) diffThresholdValue.textContent = threshold;
}
if (normalizeCheckbox) {
  normalizeCheckbox.addEventListener("change", (e) => {
    normalize = e.target.checked;
  });
  normalize = normalizeCheckbox.checked;
}

const videogramCtx = videogramCanvas.getContext("2d", { willReadFrequently: true });
const videogramCtxVert = videogramCanvasVert.getContext("2d", { willReadFrequently: true });
const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });



let stream = null;
let rafId = null;
let processing = false;
let mirrored = false;
const videoWidth = 320;
const videoHeight = 240;
let duration = 80;
let horizBuffer = null;
let vertBuffer = null;

function updateStatus(message) {}

function setButtons(isStreaming) {
  toggleCameraBtn.textContent = isStreaming ? "Stop Camera" : "Start Camera";
}

function applySampleSize() {
  sampleCanvas.width = videoWidth;
  sampleCanvas.height = videoHeight;

  // Horizontal videogram (row-averaged): width = videoWidth, height = duration
  videogramCanvas.width = videoWidth;
  videogramCanvas.height = duration;
  horizBuffer = new Uint8ClampedArray(videoWidth * duration * 4);
  videogramCtx.clearRect(0, 0, videogramCanvas.width, videogramCanvas.height);

  // Vertical videogram (column-averaged): width = duration, height = videoHeight
  videogramCanvasVert.width = duration;
  videogramCanvasVert.height = videoHeight;
  vertBuffer = new Uint8ClampedArray(duration * videoHeight * 4);
  videogramCtxVert.clearRect(0, 0, videogramCanvasVert.width, videogramCanvasVert.height);

    // Scale the canvases visually according to frame number (duration), proportional to video window
    // Horizontal: height scales with duration
    const scaleY = duration / videoHeight;
    videogramCanvas.style.width = videoWidth + 'px';
    videogramCanvas.style.height = (videoHeight * scaleY) + 'px';

    // Vertical: set both pixel buffer and DOM size to duration x videoHeight
    videogramCanvasVert.width = duration;
    videogramCanvasVert.height = videoHeight;
    videogramCanvasVert.style.width = duration + 'px';
    videogramCanvasVert.style.height = videoHeight + 'px';
}
function applyDuration(newDuration) {
  duration = Number(newDuration);
  applySampleSize();
  durationValue.textContent = duration;
}



function drawVideogramFrame() {
  if (!processing || cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    rafId = requestAnimationFrame(drawVideogramFrame);
    return;
  }

  // Mirror the sample if needed (for video only)
  sampleCtx.save();
  if (mirrored) {
    sampleCtx.translate(videoWidth, 0);
    sampleCtx.scale(-1, 1);
  }
  sampleCtx.drawImage(cameraVideo, 0, 0, videoWidth, videoHeight);
  sampleCtx.restore();

  let frame = sampleCtx.getImageData(0, 0, videoWidth, videoHeight);
  let data = frame.data;


  // Frame differencing with threshold and normalization
  let diffData = data;
  if (frameDifferencing) {
    if (prevFrame) {
      let prevData = prevFrame.data;
      diffData = new Uint8ClampedArray(data.length);
      let maxDiff = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Compute per-pixel difference (grayscale)
        const dr = Math.abs(data[i] - prevData[i]);
        const dg = Math.abs(data[i + 1] - prevData[i + 1]);
        const db = Math.abs(data[i + 2] - prevData[i + 2]);
        let diff = (dr + dg + db) / 3;
        if (diff > maxDiff) maxDiff = diff;
        // Threshold
        diff = diff >= threshold ? diff : 0;
        diffData[i] = diffData[i + 1] = diffData[i + 2] = diff;
        diffData[i + 3] = 255;
      }
      // Normalize if enabled
      if (normalize && maxDiff > 0) {
        for (let i = 0; i < diffData.length; i += 4) {
          diffData[i] = diffData[i + 1] = diffData[i + 2] = Math.round((diffData[i] / maxDiff) * 255);
        }
      }
      // Show difference in the visible diff video canvas
      if (diffVideoCtx && diffVideoCanvas && diffVideoCanvas.style.display !== "none") {
        diffVideoCtx.putImageData(new ImageData(diffData, videoWidth, videoHeight), 0, 0);
      }
    }
    // Always store the original frame for next diff
    prevFrame = new ImageData(new Uint8ClampedArray(data), videoWidth, videoHeight);
    // If no prevFrame yet, skip drawing videograms this frame
    if (!prevFrame || !prevFrame.data) {
      rafId = requestAnimationFrame(drawVideogramFrame);
      return;
    }
    // Use diffData for videograms if prevFrame exists
    if (!prevFrame) return;
  } else {
    prevFrame = new ImageData(new Uint8ClampedArray(data), videoWidth, videoHeight);
    diffData = data;
    // Show normal video frame in video element (handled by browser)
    if (diffVideoCanvas && diffVideoCtx) {
      diffVideoCtx.clearRect(0, 0, videoWidth, videoHeight);
    }
  }


  // Horizontal videogram (row-averaged)
  const averagedRow = new Uint8ClampedArray(videoWidth * 4);
  for (let x = 0; x < videoWidth; x += 1) {
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < videoHeight; y += 1) {
      const idx = (y * videoWidth + x) * 4;
      r += diffData[idx];
      g += diffData[idx + 1];
      b += diffData[idx + 2];
    }
    const pixelIndex = x * 4;
    const scale = videoHeight;
    averagedRow[pixelIndex] = Math.round(r / scale);
    averagedRow[pixelIndex + 1] = Math.round(g / scale);
    averagedRow[pixelIndex + 2] = Math.round(b / scale);
    averagedRow[pixelIndex + 3] = 255;
  }
  // Scroll buffer down and add new row at the top (reverse direction)
  horizBuffer.copyWithin(videoWidth * 4, 0);
  horizBuffer.set(averagedRow, 0);
  // Draw buffer to canvas, mirrored if needed
  const horizImage = new ImageData(new Uint8ClampedArray(horizBuffer), videoWidth, duration);
  if (mirrored) {
    videogramCtx.save();
    videogramCtx.translate(videoWidth, 0);
    videogramCtx.scale(-1, 1);
    videogramCtx.putImageData(horizImage, 0, 0);
    videogramCtx.restore();
  } else {
    videogramCtx.putImageData(horizImage, 0, 0);
  }


  // Vertical videogram (column-averaged)
  const averagedCol = new Uint8ClampedArray(videoHeight * 4);
  for (let y = 0; y < videoHeight; y += 1) {
    let r = 0, g = 0, b = 0;
    for (let x = 0; x < videoWidth; x += 1) {
      const idx = (y * videoWidth + x) * 4;
      r += diffData[idx];
      g += diffData[idx + 1];
      b += diffData[idx + 2];
    }
    const pixelIndex = y * 4;
    const scale = videoWidth;
    averagedCol[pixelIndex] = Math.round(r / scale);
    averagedCol[pixelIndex + 1] = Math.round(g / scale);
    averagedCol[pixelIndex + 2] = Math.round(b / scale);
    averagedCol[pixelIndex + 3] = 255;
  }
  // Scroll buffer right and add new column at the left (reverse direction)
  for (let y = 0; y < videoHeight; y++) {
    vertBuffer.copyWithin(y * duration * 4 + 4, y * duration * 4, (y + 1) * duration * 4 - 4);
    vertBuffer.set(averagedCol.slice(y * 4, y * 4 + 4), y * duration * 4);
  }
  // Draw buffer to canvas
  const vertImage = new ImageData(new Uint8ClampedArray(vertBuffer), duration, videoHeight);
  videogramCtxVert.putImageData(vertImage, 0, 0);

  rafId = requestAnimationFrame(drawVideogramFrame);
}

async function startCamera() {
  if (processing) {
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    cameraVideo.srcObject = stream;
    await cameraVideo.play();

    // After video is playing, update the vertical videogram canvas width and height to fixed 320px width
    setTimeout(() => {
      applySampleSize();
    }, 100);

    processing = true;
    setButtons(true);
    // updateStatus("Camera started. Building rolling videogram from each frame.");
    drawVideogramFrame();
  } catch (error) {
    console.error(error);
    // updateStatus("Unable to access camera. Check browser permissions and try again.");
  }
}

function stopCamera() {
  processing = false;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  cameraVideo.srcObject = null;
  setButtons(false);
  // updateStatus("Camera stopped.");
}



mirrorCheckbox.addEventListener("change", () => {
  mirrored = mirrorCheckbox.checked;
  cameraVideo.classList.toggle("mirrored", mirrored);
  // No CSS mirroring for horizontal videogram; handled in drawVideogramFrame
});

toggleCameraBtn.addEventListener("click", () => {
  if (processing) {
    stopCamera();
  } else {
    startCamera();
  }
});
durationRange.addEventListener("input", (event) => {
  applyDuration(event.target.value);
});

applySampleSize();
applyDuration(durationRange.value);
