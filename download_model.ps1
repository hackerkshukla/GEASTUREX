$url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
$output = Join-Path $PSScriptRoot "hand_landmarker.task"

Write-Host "Downloading MediaPipe hand model..."
Invoke-WebRequest -Uri $url -OutFile $output
Write-Host "Downloaded: $output"