// posture-app/frontend/src/App.jsx
// React frontend for rule-based posture detection app
// Allows video upload and real-time webcam analysis with pose overlays

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';

// Backend endpoints
const API_URL = 'http://localhost:8000/analyze_video/'; // For video upload
const FRAME_API_URL = 'http://localhost:8000/analyze_frame/'; // For webcam frames

// MediaPipe pose connections for drawing skeleton
const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [15, 21], [15, 17], [15, 19], [12, 14], [14, 16], [16, 22], [16, 18], [16, 20],
  [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31], [24, 26], [26, 28], [28, 30], [30, 32]
];

// Draw pose skeleton and keypoints on canvas
function drawPose(ctx, keypoints, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6366f1';
  ctx.fillStyle = '#fbbf24';
  // Draw connections
  POSE_CONNECTIONS.forEach(([a, b]) => {
    if (keypoints[a] && keypoints[b] && keypoints[a].visibility > 0.5 && keypoints[b].visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(keypoints[a].x * width, keypoints[a].y * height);
      ctx.lineTo(keypoints[b].x * width, keypoints[b].y * height);
      ctx.stroke();
    }
  });
  // Draw keypoints
  keypoints.forEach((kp) => {
    if (kp.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(kp.x * width, kp.y * height, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

// Summarize feedback by grouping consecutive frames with same posture status
function summarizeFeedback(frames, fps = 30) {
  if (!frames || frames.length === 0) return { good: [], bad: [] };
  let result = [];
  let current = null;
  for (let i = 0; i < frames.length; i++) {
    const isGood = frames[i].issues.length === 0;
    if (!current) {
      current = { isGood, start: i, end: i };
    } else if (current.isGood === isGood) {
      current.end = i;
    } else {
      result.push(current);
      current = { isGood, start: i, end: i };
    }
  }
  if (current) result.push(current);
  const good = result.filter(r => r.isGood).map(r => ({ start: r.start, end: r.end }));
  const bad = result.filter(r => !r.isGood).map(r => ({ start: r.start, end: r.end, issues: frames[r.start].issues }));
  const toTime = (frame) => (frame / fps).toFixed(2);
  return {
    good: good.map(r => ({ from: toTime(r.start), to: toTime(r.end) })),
    bad: bad.map(r => ({ from: toTime(r.start), to: toTime(r.end), issues: frames[r.start].issues })),
  };
}

function App() {
  // --- State and refs ---
  const [activity, setActivity] = useState('squat'); // Activity type
  const [videoFile, setVideoFile] = useState(null); // Uploaded video file
  const [feedback, setFeedback] = useState(null); // Video analysis feedback
  const [loading, setLoading] = useState(false); // Loading state for video analysis
  const [useWebcam, setUseWebcam] = useState(false); // Webcam mode toggle
  const webcamRef = useRef(null); // Webcam component ref
  const [webcamFrames, setWebcamFrames] = useState([]); // (Unused, legacy)
  const videoRef = useRef(null); // Video element ref
  const canvasRef = useRef(null); // Canvas overlay ref
  const [videoError, setVideoError] = useState(false); // Video error state
  const [liveWebcam, setLiveWebcam] = useState(false); // Live webcam analysis toggle
  const [webcamPose, setWebcamPose] = useState(null); // Webcam pose feedback
  const webcamCanvasRef = useRef(null); // Webcam canvas overlay ref

  // --- File input handler with file size check ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 50 * 1024 * 1024) {
      alert('Please upload a video smaller than 50MB.');
      return;
    }
    setVideoFile(file);
    setFeedback(null);
    setVideoError(false);
  };

  // --- Activity type change handler ---
  const handleActivityChange = (e) => {
    setActivity(e.target.value);
    setFeedback(null);
  };

  // --- Video upload and analysis handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) return;
    setLoading(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('activity', activity);
    try {
      const res = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFeedback(res.data);
    } catch (err) {
      setFeedback({ error: 'Error analyzing video.' });
    }
    setLoading(false);
  };

  // --- Real-time webcam analysis effect ---
  useEffect(() => {
    let intervalId;
    if (useWebcam && liveWebcam && webcamRef.current) {
      intervalId = setInterval(async () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;
        // Convert base64 to blob
        const blob = await (await fetch(imageSrc)).blob();
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        formData.append('activity', activity);
        try {
          const res = await axios.post(FRAME_API_URL, formData);
          setWebcamPose(res.data);
        } catch (err) {
          setWebcamPose(null);
        }
      }, 400); // every 400ms
    } else {
      setWebcamPose(null);
    }
    return () => clearInterval(intervalId);
  }, [useWebcam, liveWebcam, activity]);

  // --- Draw pose on webcam overlay ---
  useEffect(() => {
    if (!webcamCanvasRef.current || !webcamPose || !webcamPose.keypoints) return;
    const canvas = webcamCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPose(ctx, webcamPose.keypoints, canvas.width, canvas.height);
  }, [webcamPose]);

  // --- Draw overlay for video playback ---
  const handleOverlay = () => {
    if (!videoRef.current || !canvasRef.current || !feedback || !feedback.frames) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const fps = 30;
    const frameSkip = 5;
    const frameInterval = frameSkip / fps;
    const currentTime = videoRef.current.currentTime;
    const frameIdx = Math.min(
      Math.round(currentTime / frameInterval),
      feedback.frames.length - 1
    );
    const frameData = feedback.frames[frameIdx];
    if (frameData && frameData.keypoints && frameData.keypoints.length > 0) {
      drawPose(ctx, frameData.keypoints, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // --- Redraw overlay when feedback or videoFile changes (e.g., on load) ---
  useEffect(() => {
    if (videoRef.current) {
      handleOverlay();
    }
    // eslint-disable-next-line
  }, [feedback, videoFile]);

  // --- UI rendering ---
  const warningStyle = {
    position: 'absolute',
    top: 16,
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 22,
    color: '#fff',
    background: 'rgba(220, 38, 38, 0.85)',
    borderRadius: 8,
    padding: '8px 0',
    boxShadow: '0 2px 8px rgba(220,38,38,0.15)',
    zIndex: 2,
    opacity: 1,
    transform: 'translateY(0)',
    transition: 'opacity 0.5s, transform 0.5s',
  };
  const warningHiddenStyle = {
    ...warningStyle,
    opacity: 0,
    transform: 'translateY(-20px)',
    pointerEvents: 'none',
  };
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'clamp(320px, 90vw, 600px)', margin: '0 auto', padding: '5vw 4vw', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', minHeight: 0 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: '#3730a3', letterSpacing: -1 }}>Posture Detection App</h1>
        <p style={{ color: '#555', marginBottom: 24 }}>Upload a video or use your webcam to analyze your squat or desk posture.</p>
        {/* Activity selection */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontWeight: 500 }}>Activity:</label>
          <select value={activity} onChange={handleActivityChange} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #c7d2fe' }}>
            <option value="squat">Squat</option>
            <option value="sitting">Desk Sitting</option>
          </select>
        </div>
        {/* Webcam/video mode toggle */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setUseWebcam((v) => !v)}
            style={{
              background: useWebcam ? '#fbbf24' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: useWebcam ? '0 2px 8px #fde68a' : '0 2px 8px #c7d2fe',
              transition: 'all 0.2s',
            }}
          >
            {useWebcam ? 'Use Video Upload' : 'Use Webcam'}
          </button>
        </div>
        {/* --- Live Webcam Analysis Section --- */}
        {useWebcam && (
          <div style={{ marginBottom: 24, position: 'relative', width: 400, margin: '0 auto' }}>
            <div style={{ fontWeight: 600, color: '#3730a3', marginBottom: 8, fontSize: 18, textAlign: 'center' }}>
              Live Webcam Analysis
            </div>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={400}
              style={{ borderRadius: 10, border: '1px solid #c7d2fe', display: 'block' }}
            />
            <canvas
              ref={webcamCanvasRef}
              width={400}
              height={webcamRef.current ? webcamRef.current.video ? webcamRef.current.video.videoHeight * (400 / webcamRef.current.video.videoWidth) : 300 : 300}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                width: '100%',
                height: '100%',
                borderRadius: 10,
              }}
            />
            <button
              onClick={() => setLiveWebcam((v) => !v)}
              style={{
                marginTop: 12,
                background: liveWebcam ? '#fbbf24' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 18px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: liveWebcam ? '0 2px 8px #fde68a' : '0 2px 8px #c7d2fe',
                transition: 'all 0.2s',
                display: 'block',
                width: '100%',
              }}
            >
              {liveWebcam ? 'Stop Live Analysis' : 'Start Live Analysis'}
            </button>
            {/* Real-time posture warning overlay */}
            {webcamPose && (
              <div
                key={webcamPose.issues && webcamPose.issues.length > 0 ? webcamPose.issues.join(',') : 'no-warning'}
                style={webcamPose.issues && webcamPose.issues.length > 0 ? warningStyle : warningHiddenStyle}
              >
                {webcamPose.issues && webcamPose.issues.length > 0 && (
                  <>Bad posture detected: {webcamPose.issues.join(', ')}</>
                )}
              </div>
            )}
          </div>
        )}
        {/* --- Video Upload and Analysis Section --- */}
        {!useWebcam && (
          <>
            <form onSubmit={handleSubmit} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="file" accept="video/*" onChange={handleFileChange} style={{ border: '1px solid #c7d2fe', borderRadius: 6, padding: 6 }} />
              <button
                type="submit"
                disabled={loading || !videoFile}
                style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600, cursor: loading || !videoFile ? 'not-allowed' : 'pointer', opacity: loading || !videoFile ? 0.7 : 1 }}
              >
                {loading ? 'Analyzing...' : 'Analyze Video'}
              </button>
            </form>
            {videoFile && (
              <div style={{ color: '#3730a3', fontWeight: 500, marginBottom: 16, marginLeft: 2 }}>
                Selected file: {videoFile.name}
              </div>
            )}
          </>
        )}
        {/* --- Analyzed Video with Overlay --- */}
        {videoFile && feedback && feedback.frames && feedback.frames.length > 0 && (
          <div style={{ position: 'relative', width: '100%', margin: '0 auto 24px auto', maxWidth: 480 }}>
            <div style={{ fontWeight: 600, color: '#3730a3', marginBottom: 8, fontSize: 18, textAlign: 'center' }}>
              Analyzed Video (with Posture Overlay)
            </div>
            <video
              ref={videoRef}
              src={URL.createObjectURL(videoFile)}
              width={480}
              height={360}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #c7d2fe', display: 'block' }}
              controls
              onError={() => setVideoError(true)}
              onTimeUpdate={handleOverlay}
              onPlay={handleOverlay}
              onSeeked={handleOverlay}
            />
            <canvas
              ref={canvasRef}
              width={480}
              height={360}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                pointerEvents: 'none',
                width: '100%',
                height: '100%',
                borderRadius: 10,
              }}
            />
            {(() => {
              if (!videoRef.current || !feedback.frames) return null;
              const fps = 30;
              const frameSkip = 5;
              const frameInterval = frameSkip / fps;
              const currentTime = videoRef.current.currentTime;
              const frameIdx = Math.min(
                Math.round(currentTime / frameInterval),
                feedback.frames.length - 1
              );
              const frameData = feedback.frames[frameIdx];
              const showWarning = frameData && frameData.issues.length > 0;
              return (
                <div
                  key={showWarning ? frameData.issues.join(',') + frameIdx : 'no-warning'}
                  style={showWarning ? warningStyle : warningHiddenStyle}
                >
                  {showWarning && (
                    <>Bad posture detected: {frameData.issues.join(', ')}</>
                  )}
                </div>
              );
            })()}
            {videoError && (
              <div style={{
                marginTop: 12,
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                padding: '10px 0',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                Unable to play this video. Please try a different file (preferably .mp4 encoded with H.264).
              </div>
            )}
          </div>
        )}
        {/* --- Original Video (no overlay) --- */}
        {videoFile && (
          <div style={{ width: '100%', margin: '0 auto 24px auto', maxWidth: 480 }}>
            <div style={{ fontWeight: 600, color: '#64748b', margin: '24px 0 8px 0', fontSize: 16, textAlign: 'center' }}>
              Original Video (no overlay)
            </div>
            <video
              src={URL.createObjectURL(videoFile)}
              width={480}
              height={360}
              style={{ width: '100%', borderRadius: 10, border: '1px solid #cbd5e1', display: 'block' }}
              controls
            />
          </div>
        )}
        {/* --- Feedback Summary Section --- */}
        {feedback && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#3730a3', marginBottom: 12 }}>Feedback</h2>
            {feedback.error ? (
              <div style={{ color: 'red', fontWeight: 500 }}>{feedback.error}</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto', background: '#f9f9f9', padding: 18, color: '#111', border: '1px solid #c7d2fe', borderRadius: 10, fontSize: 16 }}>
                {feedback.frames && feedback.frames.length > 0 ? (
                  (() => {
                    const summary = summarizeFeedback(feedback.frames, 30);
                    return (
                      <>
                        <div style={{ marginBottom: 20 }}>
                          <strong style={{ color: '#059669' }}>Good posture periods:</strong>
                          {summary.good.length === 0 ? (
                            <div style={{ color: '#b91c1c' }}>None</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {summary.good.map((r, i) => (
                                <li key={i} style={{ color: '#059669', marginBottom: 4 }}>
                                  {r.from}s to {r.to}s
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <strong style={{ color: '#b91c1c' }}>Bad posture periods:</strong>
                          {summary.bad.length === 0 ? (
                            <div style={{ color: '#059669' }}>None</div>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: 18 }}>
                              {summary.bad.map((r, i) => (
                                <li key={i} style={{ color: '#b91c1c', marginBottom: 4 }}>
                                  {r.from}s to {r.to}s
                                  {r.issues && r.issues.length > 0 && (
                                    <span style={{ color: '#b91c1c', marginLeft: 8, fontWeight: 500 }}>
                                      ({r.issues.join(', ')})
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div>No feedback available.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 12, left: 0, width: '100%', textAlign: 'center', color: '#a1a1aa', fontSize: 14 }}>
        &copy; {new Date().getFullYear()} Posture Detection App
      </div>
    </div>
  );
}

export default App;
