# GestureLearn

This version uses the browser webcam only. The browser sends JPEG frames to
the Python backend, and the backend sends gesture results back over WebSocket.
On Windows, it also controls the active Microsoft PowerPoint slideshow.

## 1. Open a terminal in this folder

On Windows, the folder should contain:

```text
app.js
hand_tracker.py
hand_landmarker.task
index.html
requirements.txt
style.css
```

PowerPoint control requires Windows and Microsoft PowerPoint desktop.

## 2. Create and activate a virtual environment

Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Windows Command Prompt:

```bat
py -m venv .venv
.venv\Scripts\activate
```

Mac/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

## 3. Install Python packages

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 4. Download the MediaPipe model

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -OutFile "hand_landmarker.task"
```

You can also run the included script:

```powershell
.\download_model.ps1
```

Mac/Linux/Git Bash:

```bash
curl -L "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" -o hand_landmarker.task
```

## 5. Start the Python backend

```bash
python hand_tracker.py
```

Leave this terminal open.

## 6. Start the frontend

Open a second terminal in the same folder and run:

```bash
python -m http.server 8000
```

Open this address in your browser:

```text
http://localhost:8000
```

Allow camera permission when the browser asks.

## Using a PowerPoint presentation

1. Open a `.pptx` file in the Microsoft PowerPoint desktop application.
2. Start Slide Show with `F5`, or choose **Slide Show → From Beginning**.
3. Start `python hand_tracker.py`.
4. Start the frontend with `python -m http.server 8000`.
5. Open `http://localhost:8000` and allow camera access.
6. Keep the PowerPoint slideshow open while showing gestures.

PowerPoint gestures:

| Gesture | PowerPoint action |
|---|---|
| Thumb up | Next slide |
| Thumb down | Previous slide |
| Two fingers | Go to first slide |
| Open palm | Resume slideshow |
| Fist | Pause slideshow |

After a gesture triggers, briefly remove your hand before repeating the same
gesture. This prevents one held gesture from triggering many times.