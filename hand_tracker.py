import asyncio
import json
import math
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import websockets

from powerpoint_controller import PowerPointController


HOST = "localhost"
PORT = 8765
MODEL_PATH = Path(__file__).resolve().parent / "hand_landmarker.task"


BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode


def create_options():
    return HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
    )


def distance(first, second):
    return math.sqrt(
        (first.x - second.x) ** 2 +
        (first.y - second.y) ** 2
    )


def detect_gesture(hand):
    thumb_tip = hand[4]
    thumb_ip = hand[3]
    index_tip = hand[8]
    index_pip = hand[6]
    middle_tip = hand[12]
    middle_pip = hand[10]
    ring_tip = hand[16]
    ring_pip = hand[14]
    pinky_tip = hand[20]
    pinky_pip = hand[18]

    index_up = index_tip.y < index_pip.y
    middle_up = middle_tip.y < middle_pip.y
    ring_up = ring_tip.y < ring_pip.y
    pinky_up = pinky_tip.y < pinky_pip.y

    index_down = not index_up
    middle_down = not middle_up
    ring_down = not ring_up
    pinky_down = not pinky_up

    if distance(thumb_tip, index_tip) < 0.06:
        return "POINTER"

    if (
        thumb_tip.y < thumb_ip.y
        and index_down
        and middle_down
        and ring_down
        and pinky_down
    ):
        return "NEXT"

    if (
        thumb_tip.y > thumb_ip.y
        and index_down
        and middle_down
        and ring_down
        and pinky_down
    ):
        return "PREVIOUS"

    if index_up and middle_up and ring_up and pinky_up:
        return "PLAY"

    if index_down and middle_down and ring_down and pinky_down:
        return "PAUSE"

    if index_up and middle_down and ring_down and pinky_down:
        return "SELECT"

    if index_up and middle_up and ring_down and pinky_down:
        return "HOME"

    return "UNKNOWN"


def process_frame(message, landmarker, controller, gesture_gate):
    if not isinstance(message, (bytes, bytearray)):
        return {
            "gesture": "ERROR",
            "landmarks": [],
            "error": "Expected a binary JPEG frame.",
            "powerpoint": "",
        }

    image_array = np.frombuffer(message, dtype=np.uint8)
    bgr_frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if bgr_frame is None:
        return {
            "gesture": "ERROR",
            "landmarks": [],
            "error": "Could not decode the camera frame.",
            "powerpoint": "",
        }

    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame,
    )
    result = landmarker.detect(mp_image)

    if not result.hand_landmarks:
        return {
            "gesture": "NO HAND",
            "landmarks": [],
            "powerpoint": "",
        }

    hand = result.hand_landmarks[0]
    landmarks = [
        {"x": float(point.x), "y": float(point.y)}
        for point in hand
    ]

    gesture = detect_gesture(hand)
    powerpoint_message = ""

    # A gesture triggers once, then the user must briefly remove their hand
    # before the same gesture can trigger again. This prevents one held
    # thumbs-up from advancing many slides.
    if gesture in {"NO HAND", "UNKNOWN"}:
        gesture_gate["last_triggered"] = None
    elif gesture != gesture_gate["last_triggered"]:
        powerpoint_message = controller.execute(gesture)
        gesture_gate["last_triggered"] = gesture

    return {
        "gesture": gesture,
        "landmarks": landmarks,
        "powerpoint": powerpoint_message,
    }


async def websocket_handler(websocket, landmarker):
    print("Frontend connected")
    controller = PowerPointController()
    gesture_gate = {"last_triggered": None}

    try:
        async for message in websocket:
            result = process_frame(
                message,
                landmarker,
                controller,
                gesture_gate,
            )
            await websocket.send(json.dumps(result))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print("Frontend disconnected")


async def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing model file: {MODEL_PATH}\n"
            "Download hand_landmarker.task and put it beside this Python file."
        )

    options = create_options()

    with HandLandmarker.create_from_options(options) as landmarker:
        async def handler(websocket):
            await websocket_handler(websocket, landmarker)

        async with websockets.serve(
            handler,
            HOST,
            PORT,
            max_size=2 * 1024 * 1024,
        ):
            print("=" * 50)
            print("GestureLearn backend is running")
            print(f"WebSocket: ws://{HOST}:{PORT}")
            print("Keep this terminal open.")
            print("Press Ctrl+C to stop.")
            print("=" * 50)
            await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBackend stopped.")