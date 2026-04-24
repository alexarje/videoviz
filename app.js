const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraVideo = document.getElementById("cameraVideo");
const videogramCanvas = document.getElementById("videogramCanvas");
const statusText = document.getElementById("statusText");
const sampleWidthRange = document.getElementById("sampleWidthRange");
const sampleWidthValue = document.getElementById("sampleWidthValue");

const videogramCtx = videogramCanvas.getContext("2d", { willReadFrequently: true });
const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

let stream = null;
let rafId = null;
let processing = false;

function updateStatus(message) {
  statusText.textContent = message;
}

function setButtons(isStreaming) {
  startBtn.disabled = isStreaming;
  stopBtn.disabled = !isStreaming;
  sampleWidthRange.disabled = isStreaming;
}

function applySampleSize(width) {
  const sampleWidth = Number(width);
  const sampleHeight = Math.max(72, Math.round(sampleWidth * 0.75));

  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;

  videogramCanvas.width = sampleWidth;
  videogramCtx.fillStyle = "#000";
  videogramCtx.fillRect(0, 0, videogramCanvas.width, videogramCanvas.height);

  sampleWidthValue.textContent = `${sampleWidth} px`;
}

function drawVideogramFrame() {
  if (!processing || cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    rafId = requestAnimationFrame(drawVideogramFrame);
    return;
  }

  sampleCtx.drawImage(cameraVideo, 0, 0, sampleCanvas.width, sampleCanvas.height);
  const frame = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
  const data = frame.data;

  // For each x-position, average RGB values across every row in the frame.
  const averagedRow = new Uint8ClampedArray(sampleCanvas.width * 4);

  for (let x = 0; x < sampleCanvas.width; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;

    for (let y = 0; y < sampleCanvas.height; y += 1) {
      const idx = (y * sampleCanvas.width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
    }

    const pixelIndex = x * 4;
    const scale = sampleCanvas.height;
    averagedRow[pixelIndex] = Math.round(r / scale);
    averagedRow[pixelIndex + 1] = Math.round(g / scale);
    averagedRow[pixelIndex + 2] = Math.round(b / scale);
    averagedRow[pixelIndex + 3] = 255;
  }

  videogramCtx.drawImage(
    videogramCanvas,
    0,
    1,
    videogramCanvas.width,
    videogramCanvas.height - 1,
    0,
    0,
    videogramCanvas.width,
    videogramCanvas.height - 1
  );

  const strip = new ImageData(averagedRow, sampleCanvas.width, 1);
  videogramCtx.putImageData(strip, 0, videogramCanvas.height - 1);

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

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
sampleWidthRange.addEventListener("input", (event) => {
  applySampleSize(event.target.value);
});

applySampleSize(sampleWidthRange.value);
updateStatus("Camera is idle. Click Start Camera.");
