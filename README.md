# Posture Detection App

A full-stack web application that detects bad posture (squat or desk sitting) from uploaded videos or webcam using rule-based logic and pose estimation.

## Features
- Upload a video or use your webcam (real-time analysis)
- Detects bad posture (e.g., knee over toe, hunched back, neck bend)
- Per-frame feedback with clear messages
- Built with FastAPI, MediaPipe, OpenCV, React, and Vite

## Tech Stack
- **Frontend:** React (Vite), Axios, react-webcam
- **Backend:** FastAPI, MediaPipe, OpenCV, Python
- **Deployment:** Vercel (frontend), Render (backend)

## Live Demo
- **Frontend:** [https://posture-detection-app-steel.vercel.app/](https://posture-detection-app-steel.vercel.app/)
- **Backend:** [https://posture-detection-app-y8a7.onrender.com](https://posture-detection-app-y8a7.onrender.com)

## Setup Instructions

### 1. Clone the Repository
```sh
git clone <your-repo-url>
cd posture-app
```

### 2. Backend Setup
```sh
cd backend
python -m venv venv
# Activate the virtual environment:
# On Windows (PowerShell):
.\venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
The backend will run at `http://localhost:8000` by default.

### 3. Frontend Setup
```sh
cd frontend
npm install
npm run dev
```
The frontend will run at `http://localhost:5173` by default.

### 4. Usage
- Open the frontend in your browser.
- Select activity (Squat or Desk Sitting).
- Upload a video or use webcam and click "Analyze Video" or "Start Live Analysis".
- View per-frame feedback and overlays.

 Note: The backend is deployed on the free version of Render. It may "sleep" after some inactivity, so the first request after a while can take 20–30 seconds to respond while the server wakes up.

### 5. Deployment
- **Frontend:** Deployed to Vercel: [https://posture-detection-app-steel.vercel.app/](https://posture-detection-app-steel.vercel.app/)
- **Backend:** Deployed to Render: [https://posture-detection-app-y8a7.onrender.com](https://posture-detection-app-y8a7.onrender.com)
- **CORS:** Backend is configured to allow only the Vercel frontend domain.

## Links
- **Deployed App:** [https://posture-detection-app-steel.vercel.app/](https://posture-detection-app-steel.vercel.app/)
- **Backend API:** [https://posture-detection-app-y8a7.onrender.com](https://posture-detection-app-y8a7.onrender.com)
- **Demo Video:** [https://drive.google.com/file/d/1y0YYd_Iv68v275qUHqGe5Hw-d0tvr1xu/view?usp=drive_link](https://drive.google.com/file/d/1y0YYd_Iv68v275qUHqGe5Hw-d0tvr1xu/view?usp=drive_link)

## License
MIT 