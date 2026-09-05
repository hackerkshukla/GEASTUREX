const video = document.getElementById("webcam");
const outputCanvas = document.getElementById("output-canvas");
const outputContext = outputCanvas.getContext("2d");
const frameCanvas = document.createElement("canvas");
const frameContext = frameCanvas.getContext("2d");

const connectionStatus = document.getElementById("connection-status");
const cameraStatus = document.getElementById("camera-status");
const cameraError = document.getElementById("camera-error");
const gestureDisplay = document.getElementById("gesture-display");
const landmarkCount = document.getElementById("landmark-count");
const fpsValue = document.getElementById("fps-val");
const powerpointStatus = document.getElementById("powerpoint-status");

let socket = null;
let cameraStream = null;
let sendTimer = null;
let reconnectTimer = null;
let encodingFrame = false;
let framesReceived = 0;
let fpsWindowStart = performance.now();
let lastGesture = "";

const slides = [
    {
        title: "Welcome to Smart Learning",
        text: "Use hand gestures or the buttons to control your learning experience."
    },
    {
        title: "Gesture Recognition",
        text: "The backend detects your hand landmarks and identifies your gesture."
    },
    {
        title: "Hands-free Navigation",
        text: "Use thumbs up and thumbs down to move between learning slides."
    },
    {
        title: "Learning Complete",
        text: "You can now control this interface without touching the keyboard."
    }
];

let currentSlide = 0;

function setConnectionStatus(connected) {
    connectionStatus.textContent = connected
        ? "Backend: Connected"
        : "Backend: Disconnected";
    connectionStatus.className = connected
        ? "status connected"
        : "status disconnected";
}

function getWebSocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:8765`;
}

function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    socket = new WebSocket(getWebSocketUrl());
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
        setConnectionStatus(true);
        startFrameSending();
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            updateResults(data);
        } catch (error) {
            console.error("Invalid backend message:", error);
        }
    };

    socket.onerror = () => {
        setConnectionStatus(false);
    };

    socket.onclose = () => {
        setConnectionStatus(false);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectWebSocket, 2000);
    };
}

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraStatus.textContent = "Camera unavailable";
        cameraError.textContent = "Open this page through http://localhost or HTTPS.";
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = cameraStream;
        await video.play();
        cameraStatus.textContent = "Camera ready";
        cameraError.textContent = "";
        resizeCanvases();
    } catch (error) {
        console.error("Camera error:", error);
        cameraStatus.textContent = "Camera access failed";
        cameraError.textContent =
            "Allow camera permission, close other camera apps, and refresh the page.";
    }
}

function resizeCanvases() {
    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

    outputCanvas.width = video.videoWidth;
    outputCanvas.height = video.videoHeight;
    frameCanvas.width = video.videoWidth;
    frameCanvas.height = video.videoHeight;
}

function startFrameSending() {
    if (sendTimer) {
        return;
    }

    sendTimer = setInterval(sendCurrentFrame, 120);
}

function sendCurrentFrame() {
    if (!socket ||
        socket.readyState !== WebSocket.OPEN ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        encodingFrame) {
        return;
    }

    resizeCanvases();

    if (!frameCanvas.width || !frameCanvas.height) {
        return;
    }

    encodingFrame = true;
    frameContext.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);

    frameCanvas.toBlob(async (blob) => {
        try {
            if (blob && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(await blob.arrayBuffer());
            }
        } finally {
            encodingFrame = false;
        }
    }, "image/jpeg", 0.72);
}

function updateResults(data) {
    const gesture = data.gesture || "NO HAND";
    const landmarks = Array.isArray(data.landmarks) ? data.landmarks : [];

    gestureDisplay.textContent = gesture;
    landmarkCount.textContent = `${landmarks.length} / 21`;
    if (data.powerpoint) {
        powerpointStatus.textContent = data.powerpoint;
    }
    drawLandmarks(landmarks);

    framesReceived += 1;
    const now = performance.now();
    if (now - fpsWindowStart >= 1000) {
        fpsValue.textContent = String(framesReceived);
        framesReceived = 0;
        fpsWindowStart = now;
    }

    if (gesture !== lastGesture) {
        lastGesture = gesture;
        handleGesture(gesture);
    }
}

function drawLandmarks(landmarks) {
    outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    outputContext.fillStyle = "#00ff66";

    for (const point of landmarks) {
        outputContext.beginPath();
        outputContext.arc(
            point.x * outputCanvas.width,
            point.y * outputCanvas.height,
            6,
            0,
            Math.PI * 2
        );
        outputContext.fill();
    }
}

function handleGesture(gesture) {
    switch (gesture) {
        case "NEXT":
            changeSlide(1);
            break;
        case "PREVIOUS":
            changeSlide(-1);
            break;
        case "HOME":
            showSlide(0);
            break;
        case "PLAY":
            setWorkspaceMessage("Playing", "Learning content is playing.");
            break;
        case "PAUSE":
            setWorkspaceMessage("Paused", "Learning content is paused.");
            break;
        case "POINTER":
            setWorkspaceMessage("Pointer Mode", "Pinch gesture detected.");
            break;
        case "SELECT":
            setWorkspaceMessage("Selected", "Selection gesture detected.");
            break;
        default:
            break;
    }
}

function showSlide(index) {
    currentSlide = Math.max(0, Math.min(slides.length - 1, index));
    const slide = slides[currentSlide];
    document.getElementById("slide-title").textContent = slide.title;
    document.getElementById("slide-text").textContent = slide.text;
    document.getElementById("slide-number").textContent = String(currentSlide + 1);
    document.getElementById("total-slides").textContent = String(slides.length);
}

function changeSlide(amount) {
    showSlide((currentSlide + amount + slides.length) % slides.length);
}

function setWorkspaceMessage(title, text) {
    document.getElementById("slide-title").textContent = title;
    document.getElementById("slide-text").textContent = text;
}

document.getElementById("prev-btn").addEventListener("click", () => changeSlide(-1));
document.getElementById("next-btn").addEventListener("click", () => changeSlide(1));
document.getElementById("play-btn").addEventListener("click", () => {
    setWorkspaceMessage("Playing", "Learning content is playing.");
});
document.getElementById("pause-btn").addEventListener("click", () => {
    setWorkspaceMessage("Paused", "Learning content is paused.");
});

video.addEventListener("loadedmetadata", resizeCanvases);
window.addEventListener("resize", resizeCanvases);

showSlide(0);
startCamera();
connectWebSocket();