
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraVideo = document.getElementById("cameraVideo");
const videogramCanvas = document.getElementById("videogramCanvas");
const videogramCanvasVert = document.getElementById("videogramCanvasVert");
const statusText = document.getElementById("statusText");
const sampleWidthRange = document.getElementById("sampleWidthRange");
const sampleWidthValue = document.getElementById("sampleWidthValue");
const mirrorCheckbox = document.getElementById("mirrorCheckbox");

const videogramCtx = videogramCanvas.getContext("2d", { willReadFrequently: true });
const videogramCtxVert = videogramCanvasVert.getContext("2d", { willReadFrequently: true });
const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });


let stream = null;
let rafId = null;
let processing = false;
let mirrored = false;

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

  // Horizontal videogram (row-averaged): width = sampleWidth, height = 80
  videogramCanvas.width = sampleWidth;
  videogramCanvas.height = 80;
  videogramCtx.fillStyle = "#000";
  videogramCtx.fillRect(0, 0, videogramCanvas.width, videogramCanvas.height);

  // Vertical videogram (column-averaged): width = 80, height = sampleHeight
  videogramCanvasVert.width = 80;
  videogramCanvasVert.height = sampleHeight;
  videogramCtxVert.fillStyle = "#000";
  videogramCtxVert.fillRect(0, 0, videogramCanvasVert.width, videogramCanvasVert.height);

  sampleWidthValue.textContent = `${sampleWidth} px`;
}


function drawVideogramFrame() {
  if (!processing || cameraVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    rafId = requestAnimationFrame(drawVideogramFrame);
    return;
  }

  // Mirror the sample if needed (for video only)
  sampleCtx.save();
  if (mirrored) {
    sampleCtx.translate(sampleCanvas.width, 0);
    sampleCtx.scale(-1, 1);
  }
  sampleCtx.drawImage(cameraVideo, 0, 0, sampleCanvas.width, sampleCanvas.height);
  sampleCtx.restore();

  const frame = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
  const data = frame.data;

  // Horizontal videogram (row-averaged, as before)
  const averagedRow = new Uint8ClampedArray(sampleCanvas.width * 4);
  for (let x = 0; x < sampleCanvas.width; x += 1) {
    let r = 0, g = 0, b = 0;
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
  // Shift up and draw new row at bottom
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

  // Vertical videogram (column-averaged)
  const averagedCol = new Uint8ClampedArray(sampleCanvas.height * 4);
  for (let y = 0; y < sampleCanvas.height; y += 1) {
    let r = 0, g = 0, b = 0;
    for (let x = 0; x < sampleCanvas.width; x += 1) {
      const idx = (y * sampleCanvas.width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
    }
    const pixelIndex = y * 4;
    const scale = sampleCanvas.width;
    averagedCol[pixelIndex] = Math.round(r / scale);
    averagedCol[pixelIndex + 1] = Math.round(g / scale);
    averagedCol[pixelIndex + 2] = Math.round(b / scale);
    averagedCol[pixelIndex + 3] = 255;
  }
  // Shift left and draw new column at right
  videogramCtxVert.drawImage(
    videogramCanvasVert,
    1,
    0,
    videogramCanvasVert.width - 1,
    videogramCanvasVert.height,
    0,
    0,
    videogramCanvasVert.width - 1,
    videogramCanvasVert.height
  );
  const colStrip = new ImageData(1, sampleCanvas.height);
  for (let i = 0; i < averagedCol.length; i++) {
    colStrip.data[i] = averagedCol[i];
  }
  videogramCtxVert.putImageData(colStrip, videogramCanvasVert.width - 1, 0);

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
  // Only mirror the display of the videogram, not the buffer update
  if (mirrored) {
    videogramCanvas.classList.add("mirrored");
  } else {
    videogramCanvas.classList.remove("mirrored");
  }
});

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
sampleWidthRange.addEventListener("input", (event) => {
  applySampleSize(event.target.value);
});

applySampleSize(sampleWidthRange.value);
updateStatus("");
