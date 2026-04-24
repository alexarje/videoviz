
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const cameraVideo = document.getElementById("cameraVideo");
const videogramCanvas = document.getElementById("videogramCanvas");
const videogramCanvasVert = document.getElementById("videogramCanvasVert");
const statusText = document.getElementById("statusText");
const sampleWidthRange = document.getElementById("sampleWidthRange");
const sampleWidthValue = document.getElementById("sampleWidthValue");
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
let videoWidth = 320;
let videoHeight = 240;
let duration = 80;
let horizBuffer = null;
let vertBuffer = null;

function updateStatus(message) {
  statusText.textContent = message;
}

function setButtons(isStreaming) {
  toggleCameraBtn.textContent = isStreaming ? "Stop Camera" : "Start Camera";
  sampleWidthRange.disabled = isStreaming;
}

function applySampleSize(width) {
  const sampleWidth = Number(width);
  const sampleHeight = Math.max(72, Math.round(sampleWidth * 0.75));
  videoWidth = sampleWidth;
  videoHeight = sampleHeight;

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

  sampleWidthValue.textContent = `${videoWidth} px`;
}
function applyDuration(newDuration) {
  duration = Number(newDuration);
  // Resize videogram canvases and buffers
  videogramCanvas.height = duration;
  horizBuffer = new Uint8ClampedArray(videoWidth * duration * 4);
  videogramCtx.clearRect(0, 0, videogramCanvas.width, videogramCanvas.height);

  videogramCanvasVert.width = duration;
  vertBuffer = new Uint8ClampedArray(duration * videoHeight * 4);
  videogramCtxVert.clearRect(0, 0, videogramCanvasVert.width, videogramCanvasVert.height);

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
  // Draw buffer to canvas
  const horizImage = new ImageData(new Uint8ClampedArray(horizBuffer), videoWidth, duration);
  videogramCtx.putImageData(horizImage, 0, 0);

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

    processing = true;
    setButtons(true);
    updateStatus("Camera started. Building rolling videogram from each frame.");
    drawVideogramFrame();
  } catch (error) {
    console.error(error);
    updateStatus("Unable to access camera. Check browser permissions and try again.");
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
  updateStatus("Camera stopped.");
}



mirrorCheckbox.addEventListener("change", () => {
  mirrored = mirrorCheckbox.checked;
  cameraVideo.classList.toggle("mirrored", mirrored);
  // Mirror the horizontal videogram display to match the video
  videogramCanvas.classList.toggle("mirrored", mirrored);
});

toggleCameraBtn.addEventListener("click", () => {
  if (processing) {
    stopCamera();
  } else {
    startCamera();
  }
});
sampleWidthRange.addEventListener("input", (event) => {
  applySampleSize(event.target.value);
});
durationRange.addEventListener("input", (event) => {
  applyDuration(event.target.value);
});

applySampleSize(sampleWidthRange.value);
applyDuration(durationRange.value);
updateStatus("");
