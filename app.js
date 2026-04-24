
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const cameraVideo = document.getElementById("cameraVideo");
const videogramCanvas = document.getElementById("videogramCanvas");
const videogramCanvasVert = document.getElementById("videogramCanvasVert");
const durationRange = document.getElementById("durationRange");
const durationValue = document.getElementById("durationValue");
const mirrorCheckbox = document.getElementById("mirrorCheckbox");

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

  // Vertical: width scales with duration
  const scaleX = duration / videoWidth;
  videogramCanvasVert.style.width = (videoWidth * scaleX) + 'px';
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

  const frame = sampleCtx.getImageData(0, 0, videoWidth, videoHeight);
  const data = frame.data;

  // Horizontal videogram (row-averaged)
  const averagedRow = new Uint8ClampedArray(videoWidth * 4);
  for (let x = 0; x < videoWidth; x += 1) {
    let r = 0, g = 0, b = 0;
    for (let y = 0; y < videoHeight; y += 1) {
      const idx = (y * videoWidth + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
    }
    const pixelIndex = x * 4;
    const scale = videoHeight;
    averagedRow[pixelIndex] = Math.round(r / scale);
    averagedRow[pixelIndex + 1] = Math.round(g / scale);
    averagedRow[pixelIndex + 2] = Math.round(b / scale);
    averagedRow[pixelIndex + 3] = 255;
  }
  // Scroll buffer up and add new row at the end
  horizBuffer.copyWithin(0, videoWidth * 4);
  horizBuffer.set(averagedRow, (duration - 1) * videoWidth * 4);
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
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
    }
    const pixelIndex = y * 4;
    const scale = videoWidth;
    averagedCol[pixelIndex] = Math.round(r / scale);
    averagedCol[pixelIndex + 1] = Math.round(g / scale);
    averagedCol[pixelIndex + 2] = Math.round(b / scale);
    averagedCol[pixelIndex + 3] = 255;
  }
  // Scroll buffer left and add new column at the end
  for (let y = 0; y < videoHeight; y++) {
    vertBuffer.copyWithin(y * duration * 4, y * duration * 4 + 4, (y + 1) * duration * 4);
    vertBuffer.set(averagedCol.slice(y * 4, y * 4 + 4), (y * duration + (duration - 1)) * 4);
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
