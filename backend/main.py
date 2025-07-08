# posture-app/backend/main.py
# FastAPI backend for rule-based posture detection using MediaPipe and OpenCV

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import mediapipe as mp
import cv2
import numpy as np
import tempfile
import os
from typing import List

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for Vercel frontend (replace with your actual Vercel URL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://posture-detection-app-y8a7.onrender.com"],  # TODO: Replace with your actual Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"message": "Posture Detection Backend is running!"}

# --- Helper functions for rule-based posture checks ---
def calculate_angle(a, b, c):
    """Calculate the angle (in degrees) at point b given three points a, b, c."""
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

def check_squat_rules(landmarks):
    """Check squat-specific posture rules using pose landmarks."""
    issues = []
    try:
        left_knee = landmarks[mp.solutions.pose.PoseLandmark.LEFT_KNEE.value]
        left_ankle = landmarks[mp.solutions.pose.PoseLandmark.LEFT_ANKLE.value]
        left_hip = landmarks[mp.solutions.pose.PoseLandmark.LEFT_HIP.value]
        left_shoulder = landmarks[mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value]
        left_toe = landmarks[mp.solutions.pose.PoseLandmark.LEFT_FOOT_INDEX.value]
        # Rule: Knee over toe
        if left_knee.x > left_toe.x:
            issues.append("Left knee over toe")
        # Rule: Back angle (shoulder-hip-knee)
        back_angle = calculate_angle(
            [left_shoulder.x, left_shoulder.y],
            [left_hip.x, left_hip.y],
            [left_knee.x, left_knee.y]
        )
        if back_angle < 150:
            issues.append(f"Back angle too small: {int(back_angle)}°")
    except Exception as e:
        pass
    return issues

def check_sitting_rules(landmarks):
    """Check desk sitting posture rules using pose landmarks."""
    issues = []
    try:
        left_shoulder = landmarks[mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value]
        left_ear = landmarks[mp.solutions.pose.PoseLandmark.LEFT_EAR.value]
        left_hip = landmarks[mp.solutions.pose.PoseLandmark.LEFT_HIP.value]
        # Rule: Neck bend (angle between shoulder, ear, vertical)
        vertical = [left_shoulder.x, left_shoulder.y - 1]
        neck_angle = calculate_angle(
            [left_shoulder.x, left_shoulder.y],
            [left_ear.x, left_ear.y],
            vertical
        )
        if neck_angle > 30:
            issues.append(f"Neck bend too large: {int(neck_angle)}°")
        # Rule: Back straightness (shoulder-hip-vertical)
        back_angle = calculate_angle(
            [left_shoulder.x, left_shoulder.y],
            [left_hip.x, left_hip.y],
            [left_hip.x, left_hip.y - 1]
        )
        if abs(back_angle - 180) > 20:
            issues.append(f"Back not straight: {int(back_angle)}°")
    except Exception as e:
        pass
    return issues

# --- Video analysis endpoint ---
@app.post("/analyze_video/")
async def analyze_video(file: UploadFile = File(...), activity: str = "squat"):
    """
    Accepts a video file, processes every 5th frame, runs pose detection and rule-based logic,
    and returns per-frame feedback (issues and keypoints).
    """
    # Save uploaded file to a temporary location
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
        temp.write(await file.read())
        temp_path = temp.name
    cap = cv2.VideoCapture(temp_path)
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5)
    frame_results = []
    frame_idx = 0
    processed_idx = 0
    frame_skip = 5  # Analyze every 5th frame
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_skip != 0:
            frame_idx += 1
            continue
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)
        issues = []
        keypoints = []
        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            if activity == "squat":
                issues = check_squat_rules(landmarks)
            elif activity == "sitting":
                issues = check_sitting_rules(landmarks)
            for lm in landmarks:
                keypoints.append({
                    "x": lm.x,
                    "y": lm.y,
                    "visibility": lm.visibility
                })
        frame_results.append({
            "frame": frame_idx,
            "issues": issues,
            "keypoints": keypoints
        })
        frame_idx += 1
        processed_idx += 1
    cap.release()
    os.remove(temp_path)
    return {"frames": frame_results}

# --- Single frame analysis endpoint for real-time webcam ---
@app.post("/analyze_frame/")
async def analyze_frame(file: UploadFile = File(...), activity: str = "squat"):
    """
    Accepts a single image (webcam frame), runs pose detection and rule-based logic,
    and returns issues and keypoints for that frame.
    """
    # Save uploaded image to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp:
        temp.write(await file.read())
        temp_path = temp.name
    image = cv2.imread(temp_path)
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = pose.process(image_rgb)
    issues = []
    keypoints = []
    if results.pose_landmarks:
        landmarks = results.pose_landmarks.landmark
        if activity == "squat":
            issues = check_squat_rules(landmarks)
        elif activity == "sitting":
            issues = check_sitting_rules(landmarks)
        for lm in landmarks:
            keypoints.append({
                "x": lm.x,
                "y": lm.y,
                "visibility": lm.visibility
            })
    os.remove(temp_path)
    return {"issues": issues, "keypoints": keypoints} 