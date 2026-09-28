import time
import cv2
import base64
import requests
# pyrefly: ignore [missing-import]
from ml_models.detector import AnimalDetector

# Configuration
BACKEND_URL = "http://localhost:5000"
CAMERA_ID = "CAM_WEBCAM"
RTSP_URL = 0  # Use 0 for local webcam or "rtsp://..." for IP camera

detector = AnimalDetector()

def _is_dangerous_detection(detection):
    class_name = detection.get("class_name", "").lower() if detection else ""
    return bool(class_name and any(animal in class_name for animal in detector.DANGEROUS_ANIMALS))

def run_inference_loop():
    print(f"[INFO] Starting ML inference service for camera {CAMERA_ID}...")
    cap = cv2.VideoCapture(RTSP_URL)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Failed to read frame. Retrying...")
            time.sleep(1)
            continue
            
        detections = detector.detect(frame)
        if detections:
            best = max(detections, key=lambda d: d["confidence"])
            is_dangerous = _is_dangerous_detection(best)
            
            # Encode frame
            success, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_b64 = base64.b64encode(jpeg.tobytes()).decode("utf-8") if success else None
            
            payload = {
                "camera_id": CAMERA_ID,
                "image": image_b64,
                "animal_detected": True,
                "dangerous": is_dangerous,
                "animal_type": best["class_name"],
                "confidence": round(best["confidence"], 2)
            }
            
            # Send to backend
            try:
                res = requests.post(f"{BACKEND_URL}/camera/detect", json=payload)
                print(f"[INFO] Sent detection to backend. Response: {res.status_code}")
            except Exception as e:
                print(f"[ERROR] Failed to connect to backend: {e}")
                
        time.sleep(2)  # Wait before next frame to save resources

if __name__ == "__main__":
    run_inference_loop()
