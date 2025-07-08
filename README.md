# Posture Detection App

A full-stack web application that detects bad posture (squat or desk sitting) from uploaded videos using rule-based logic and pose estimation.

## Features
- Upload a video or use your webcam (webcam analysis coming soon)
- Detects bad posture (e.g., knee over toe, hunched back, neck bend)
- Per-frame feedback with clear messages
- Built with FastAPI, MediaPipe, OpenCV, React, and Vite

## Tech Stack
- **Frontend:** React (Vite), Axios, react-webcam
- **Backend:** FastAPI, MediaPipe, OpenCV, Python
- **Deployment:** (Recommend: Vercel/Netlify for frontend, Render/Railway/Heroku for backend)

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
- Upload a video and click "Analyze Video".
- View per-frame feedback below the video.

### 5. Deployment
- Deploy the frontend to Vercel/Netlify (connect your repo, set build command to `npm run build` and output to `dist`)
- Deploy the backend to Render/Railway/Heroku (Python, FastAPI, `uvicorn main:app`)
- Update CORS settings in `backend/main.py` to allow your frontend domain.

## Links
- **Deployed App:** [Add your public URL here]
- **Demo Video:** [Add your demo video link here]

## License
MIT 