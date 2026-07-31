"""
WildTrack Animal Alert Server
==============================
- Captures frames from your laptop webcam
- Runs animal detection via YOLOv8 (best.pt)
- Serves REST API endpoints for the Android WildTrack app
- Hosts a live browser preview at http://localhost:5000/preview
"""

from datetime import datetime
import time
"""
WildTrack Animal Alert Server
==============================
- Captures frames from your laptop webcam
- Runs animal detection via YOLOv8 (best.pt)
- Serves REST API endpoints for the Android WildTrack app
- Hosts a live browser preview at http://localhost:5000/preview
"""

import time
import os
import base64
import threading
from typing import Optional   # Fix: use Optional instead of X | Y (Python 3.10+ only syntax)
import cv2
import numpy as np
from flask import Flask, jsonify, request, Response, render_template_string
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import pymongo

# ─────────────────────────────────────────────
# FLASK APP SETUP  (CORS must be applied before any routes)
# ─────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder=os.path.join("dashboard", "build"),
    static_url_path="/"
)
app.config['JWT_SECRET_KEY'] = 'wildtrack-super-secret-key-change-in-prod'
CORS(app)        # Fix: was placed after the first @app.route; must come before all routes
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

# ─────────────────────────────────────────────
# MONGODB CONNECTION
# ─────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017"
db_connected = False
db = None

try:
    mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    mongo_client.admin.command('ping')
    db = mongo_client["wildtrack"]
    db_connected = True
    print("[INFO] Successfully connected to local MongoDB database 'wildtrack'.")
except Exception as e:
    print(f"[WARN] Local MongoDB connection failed: {e}")
    print("[WARN] System will run with standard in-memory fallbacks.")

def save_alert_to_db(alert_obj):
    if db_connected and db is not None:
        try:
            db["alerts"].insert_one(alert_obj.copy())
            print(f"[INFO] Saved alert to MongoDB: {alert_obj.get('animal_type')}")
        except Exception as e:
            print(f"[ERROR] Failed to save alert to MongoDB: {e}")


# ─────────────────────────────────────────────
# ML MODEL INTEGRATION POINT
# ─────────────────────────────────────────────
from ml_models.detector import AnimalDetector
detector = AnimalDetector()
# ─────────────────────────────────────────────

# ── In-memory state ──────────────────────────
latest_alert = {
    "animal_detected": False,
    "dangerous": False,
    "animal_type": None,
    "confidence": 0.0,
    "location": "0.0,0.0",
    "latitude": 0.0,
    "longitude": 0.0,
    "timestamp": int(time.time()),
    "image": None,
}

latest_alerts_by_camera = {}


def _is_dangerous_detection(detection):
    class_name = detection.get("class_name", "").lower() if detection else ""
    return bool(
        class_name
        and any(animal in class_name for animal in detector.DANGEROUS_ANIMALS)
    )


def _select_detection(detections):
    dangerous = [d for d in detections if _is_dangerous_detection(d)]
    if dangerous:
        return max(dangerous, key=lambda d: d["confidence"])
    return max(detections, key=lambda d: d["confidence"])

# Fix: lock to protect latest_alert from simultaneous writes by webcam thread + HTTP thread
_alert_lock = threading.Lock()

cameras = {
    "CAM_WEBCAM": "18.5204,73.8567",
    "CAM_01":     "18.5204,73.8567",
    "CAM_02":     "18.5250,73.8600",
    "CAM_03":     "18.5190,73.8500",
}

camera_rtsp_urls = {
    "CAM_WEBCAM": "",
    "CAM_01": "",
    "CAM_02": "",
    "CAM_03": "",
}

system_settings = {
    "monitoring_enabled": True,
    "active_detection_camera": "CAM_01",
    "deployment_city": "Pune",
    "webcam_index": 0,
}


_settings_lock = threading.Lock()


def _load_settings_from_db():
    global system_settings
    if db_connected and db is not None:
        try:
            doc = db["settings"].find_one({"_id": "system"})
            if doc:
                system_settings["monitoring_enabled"] = doc.get(
                    "monitoring_enabled", True
                )
                system_settings["active_detection_camera"] = doc.get(
                    "active_detection_camera", "CAM_01"
                )
                system_settings["deployment_city"] = doc.get(
                    "deployment_city", "Pune"
                )
        except Exception as e:
            print(f"[WARN] Could not load system settings: {e}")


def _save_settings_to_db():
    if db_connected and db is not None:
        try:
            db["settings"].update_one(
                {"_id": "system"},
                {"$set": {
                    "monitoring_enabled": system_settings["monitoring_enabled"],
                    "active_detection_camera": system_settings["active_detection_camera"],
                    "deployment_city": system_settings.get("deployment_city", "Pune"),
                }},
                upsert=True,
            )
        except Exception as e:
            print(f"[ERROR] Failed to save system settings: {e}")


def _load_cameras_from_db():
    if db_connected and db is not None:
        try:
            for cam in db["cameras"].find({}, {"id": 1, "location": 1, "rtspUrl": 1}):
                cameras[cam["id"]] = cam["location"]
                camera_rtsp_urls[cam["id"]] = cam.get("rtspUrl", "")
            print(f"[INFO] Loaded {len(cameras)} cameras from MongoDB.")
        except Exception as e:
            print(f"[WARN] Could not load cameras from MongoDB: {e}")


_load_cameras_from_db()
_load_settings_from_db()


def _get_primary_camera_id():
    with _settings_lock:
        return system_settings.get("active_detection_camera", "CAM_01")


def _get_detection_location():
    cam_id = _get_primary_camera_id()
    return cameras.get(cam_id, cameras.get("CAM_WEBCAM", "18.5204,73.8567"))


def _parse_lat_lng(location_str):
    try:
        parts = location_str.split(",")
        return float(parts[0].strip()), float(parts[1].strip())
    except Exception:
        return 18.5204, 73.8567


def _get_deployment_city():
    with _settings_lock:
        return system_settings.get("deployment_city", "Pune")


def _next_camera_number():
    if db_connected and db is not None:
        try:
            nums = [
                c.get("camera_number")
                for c in db["cameras"].find({}, {"camera_number": 1})
                if c.get("camera_number") is not None
            ]
            return max(nums, default=0) + 1
        except Exception:
            pass
    return len(cameras) + 1


def _enrich_cameras(cam_list):
    """Add is_primary, camera_number, city — sorted by number for maps/apps."""
    primary_id = _get_primary_camera_id()
    city = _get_deployment_city()
    working = [dict(c) for c in cam_list]
    working.sort(key=lambda c: (
        c.get("camera_number") if c.get("camera_number") is not None else 9999,
        c.get("addedAt", 0),
        c.get("id", ""),
    ))
    used = set()
    for cam in working:
        num = cam.get("camera_number")
        if num is None or num in used:
            num = 1
            while num in used:
                num += 1
            cam["camera_number"] = num
            if db_connected and db is not None:
                try:
                    db["cameras"].update_one(
                        {"id": cam["id"]},
                        {"$set": {"camera_number": num}},
                    )
                except Exception:
                    pass
        used.add(num)
        cam["is_primary"] = cam.get("id") == primary_id
        cam["city"] = city
    working.sort(key=lambda c: c.get("camera_number", 0))
    return working

# ── Webcam capture thread ─────────────────────
_latest_frame: Optional[np.ndarray] = None   # Fix: was np.ndarray | None (Python 3.10+ only)
_frame_lock = threading.Lock()
_webcam_running = False


def _get_active_camera_source():
    primary_id = _get_primary_camera_id()
    rtsp = camera_rtsp_urls.get(primary_id, "")
    if rtsp and rtsp.strip():
        return rtsp.strip()
    # Fallback to local USB/webcam device
    with _settings_lock:
        return int(system_settings.get("webcam_index", 0))


def _webcam_thread():
    global _latest_frame, _webcam_running
    _webcam_running = True
    print("[INFO] Dynamic stream capture thread started.")
    
    current_source = None
    cap = None
    
    while _webcam_running:
        # Determine the source for the current primary camera
        target_source = _get_active_camera_source()
        
        # If source changed, open new capture
        if cap is None or target_source != current_source:
            if cap is not None:
                cap.release()
                print(f"[INFO] Released stream source: {current_source}")
            
            current_source = target_source
            print(f"[INFO] Opening new stream source: {current_source}")
            if isinstance(current_source, str) and (current_source.startswith("rtsp://") or current_source.startswith("http://") or current_source.startswith("https://")):
                cap = cv2.VideoCapture(current_source)
            else:
                try:
                    src_val = int(current_source)
                except ValueError:
                    src_val = 0
                cap = cv2.VideoCapture(src_val)
            
            if not cap.isOpened():
                print(f"[WARN] Could not open stream source: {current_source}. Falling back to webcam 0.")
                cap = cv2.VideoCapture(0)
                current_source = 0
        
        ret, frame = cap.read()
        if ret:
            with _frame_lock:
                _latest_frame = frame.copy()
        else:
            # Generate a custom dark signal-lost frame to inform user
            primary_id = _get_primary_camera_id()
            dummy = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(dummy, f"No Signal: {primary_id}", (50, 220),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
            cv2.putText(dummy, f"Source: {current_source}", (50, 280),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 180, 180), 1)
            cv2.putText(dummy, "Please check camera connection & RTSP URL", (50, 330),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 140, 140), 1)
            with _frame_lock:
                _latest_frame = dummy
            time.sleep(0.5) # Wait before retry
            
        time.sleep(0.033)
        
    if cap is not None:
        cap.release()
    print("[INFO] Dynamic stream capture thread stopped.")

webcam_thread = threading.Thread(target=_webcam_thread, daemon=True)
webcam_thread.start()


def _get_latest_frame() -> Optional[np.ndarray]:   # Fix: same type hint fix
    with _frame_lock:
        return _latest_frame.copy() if _latest_frame is not None else None


# ── Auto-detection loop ───────────────────────
def _auto_detect_loop():
    global latest_alert
    print("[INFO] Auto-detection loop started.")
    while True:
        time.sleep(2)
        with _settings_lock:
            monitoring_on = system_settings.get("monitoring_enabled", True)

        cam_id = _get_primary_camera_id()
        cam_location = _get_detection_location()
        lat_val, lng_val = _parse_lat_lng(cam_location)

        if not monitoring_on:
            new_alert = {
                "camera_id": cam_id,
                "animal_detected": False,
                "dangerous": False,
                "animal_type": None,
                "confidence": 0.0,
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": None,
            }
            with _alert_lock:
                latest_alert = new_alert
                latest_alerts_by_camera[cam_id] = new_alert
            continue

        frame = _get_latest_frame()
        if frame is None:
            continue

        detections = detector.detect(frame)

        if detections:
            best = _select_detection(detections)
            is_dangerous = _is_dangerous_detection(best)
            success, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_b64 = (
                base64.b64encode(jpeg.tobytes()).decode("utf-8") if success else None
            )
            new_alert = {
                "camera_id": cam_id,
                "animal_detected": True,
                "dangerous": is_dangerous,
                "animal_type": best["class_name"],
                "confidence": round(best["confidence"], 2),
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": image_b64,
            }
        else:
            new_alert = {
                "camera_id": cam_id,
                "animal_detected": False,
                "dangerous": False,
                "animal_type": None,
                "confidence": 0.0,
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": None,
            }

        with _alert_lock:
            latest_alert = new_alert
            latest_alerts_by_camera[cam_id] = new_alert

        if new_alert["animal_detected"]:
            save_alert_to_db(new_alert)


detect_thread = threading.Thread(target=_auto_detect_loop, daemon=True)
detect_thread.start()


# ═══════════════════════════════════════════════
#  REST API
# ═══════════════════════════════════════════════

@app.route("/")
def serve_index():
    return app.send_static_file("index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/latest-alert", methods=["GET"])
@jwt_required(optional=True)
def get_latest_alert():
    cam_id = request.args.get("camera_id")
    with _alert_lock:
        if cam_id:
            data = latest_alerts_by_camera.get(cam_id)
            if not data:
                # Secondary DB query fallback
                if db_connected and db is not None:
                    try:
                        db_alert = db["alerts"].find_one({"camera_id": cam_id}, sort=[("timestamp", -1)])
                        if db_alert:
                            db_alert.pop("_id", None)
                            data = db_alert
                    except Exception:
                        pass
                # Construct default clear payload if no alert history exists
                if not data:
                    loc = cameras.get(cam_id, "18.5204,73.8567")
                    lat, lng = _parse_lat_lng(loc)
                    data = {
                        "camera_id": cam_id,
                        "animal_detected": False,
                        "dangerous": False,
                        "animal_type": None,
                        "confidence": 0.0,
                        "location": loc,
                        "latitude": lat,
                        "longitude": lng,
                        "timestamp": int(time.time()),
                        "image": None,
                    }
        else:
            data = dict(latest_alert)
    return jsonify(data)


@app.route("/register/camera", methods=["POST"])
@jwt_required()
def register_camera():
    data = request.get_json(force=True)
    camera_id = data.get("camera_id")
    location  = data.get("location")

    if not camera_id or not location:
        return jsonify({"status": "error", "message": "Missing camera_id or location"}), 400

    cameras[camera_id] = location

    if db_connected and db is not None:
        try:
            db["cameras"].update_one(
                {"id": camera_id},
                {"$set": {
                    "id": camera_id,
                    "location": location,
                    "name": data.get("name", f"Camera {camera_id}"),
                    "place": data.get("place", "Pune Office"),
                    "type": data.get("type", "cctv"),
                    "status": "active",
                    "addedAt": int(time.time() * 1000)
                }},
                upsert=True
            )
        except Exception as e:
            print(f"[ERROR] Failed to persist camera in MongoDB: {e}")

    return jsonify({
        "status": "success",
        "message": f"Camera {camera_id} registered at grid {location}",
    })


@app.route("/camera/detect", methods=["POST"])
@jwt_required()
def detect_from_camera():
    global latest_alert
    data      = request.get_json(force=True)
    camera_id = data.get("camera_id")
    image_b64 = data.get("image")

    if not camera_id or not image_b64:
        return jsonify({"status": "error", "message": "Missing camera_id or image"}), 400

    if camera_id not in cameras:
        return jsonify({"status": "error", "message": "Camera not registered"}), 404

    try:
        img_bytes = base64.b64decode(image_b64)
        nparr     = np.frombuffer(img_bytes, np.uint8)
        frame     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        detections = detector.detect(frame)

        cam_location = cameras[camera_id]
        try:
            lat_val = float(cam_location.split(",")[0])
            lng_val = float(cam_location.split(",")[1])
        except Exception:
            lat_val = 0.0
            lng_val = 0.0

        if detections:
            best = _select_detection(detections)
            is_dangerous = _is_dangerous_detection(best)
            new_alert = {
                "camera_id": camera_id,
                "animal_detected": True,
                "dangerous": is_dangerous,
                "animal_type": best["class_name"],
                "confidence": round(best["confidence"], 2),
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": image_b64,
            }
            if new_alert["animal_detected"]:
                save_alert_to_db(new_alert)
            message = "Dangerous wildlife detected!" if is_dangerous else "Safe detection."
        else:
            is_dangerous = False
            new_alert = {
                "camera_id": camera_id,
                "animal_detected": False,
                "dangerous": False,
                "animal_type": None,
                "confidence": 0.0,
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": None,
            }
            message = "No wildlife detected."

        # Fix: use lock when writing shared state (race condition with auto-detect loop)
        with _alert_lock:
            latest_alert = new_alert
            latest_alerts_by_camera[camera_id] = new_alert

        return jsonify({
            "status":     "success",
            "camera_id":  camera_id,
            "dangerous":  is_dangerous,
            "detections": detections,
            "message":    message,
        })

    except Exception as exc:
        return jsonify({"status": "error", "message": f"Inference failed: {exc}"}), 500


# ── Live browser preview ──────────────────────
def _get_camera_details(camera_id):
    name = camera_id
    status = "active"
    rtsp = ""
    location_str = "18.5204,73.8567"
    
    if db_connected and db is not None:
        try:
            c = db["cameras"].find_one({"id": camera_id})
            if c:
                name = c.get("name", camera_id)
                status = c.get("status", "active")
                rtsp = c.get("rtspUrl", "")
                location_str = c.get("location", "18.5204,73.8567")
                return name, status, rtsp, location_str
        except Exception:
            pass
            
    # Fallback to local dicts
    location_str = cameras.get(camera_id, "18.5204,73.8567")
    rtsp = camera_rtsp_urls.get(camera_id, "")
    
    name_map = {
        "CAM_WEBCAM": "Webcam (Dev)",
        "CAM_01": "North Perimeter",
        "CAM_02": "East Gate",
        "CAM_03": "South Boundary",
    }
    name = name_map.get(camera_id, camera_id)
    status = "offline" if camera_id == "CAM_02" else "active"
    return name, status, rtsp, location_str


def _mjpeg_generator(camera_id):
    print(f"[INFO] Started dynamic MJPEG stream for {camera_id}")
    while True:
        cam_name, cam_status, rtsp, location_str = _get_camera_details(camera_id)
        
        # 1. If camera is offline, show offline card
        if cam_status == "offline":
            dummy = np.zeros((480, 640, 3), dtype=np.uint8)
            for y in range(0, 480, 20):
                cv2.line(dummy, (0, y), (640, y), (15, 20, 25), 1)
            cv2.rectangle(dummy, (20, 20), (620, 460), (30, 35, 40), 2)
            cv2.putText(dummy, "CAMERA OFFLINE", (170, 200),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.1, (90, 100, 255), 3)
            cv2.putText(dummy, f"ID: {camera_id} | Name: {cam_name}", (100, 250),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 180, 180), 1)
            cv2.putText(dummy, "Click 'Start' in Camera Management to activate stream", (80, 300),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 140, 140), 1)
            
            time_str = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(dummy, time_str, (400, 440), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 100), 1)
            
            _, jpeg = cv2.imencode(".jpg", dummy, [cv2.IMWRITE_JPEG_QUALITY, 80])
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                   + jpeg.tobytes() + b"\r\n")
            time.sleep(1.0)
            continue

        # 2. Get the base video frame
        frame = None
        is_rtsp = rtsp and rtsp.strip()
        is_global_primary = (camera_id == _get_primary_camera_id())
        
        if is_rtsp and not is_global_primary:
            cap_temp = cv2.VideoCapture(rtsp.strip())
            if cap_temp.isOpened():
                ret, f_read = cap_temp.read()
                if ret:
                    frame = f_read
                cap_temp.release()
            
            if frame is None:
                # RTSP offline / failed -> show "NO SIGNAL" placeholder
                dummy = np.zeros((480, 640, 3), dtype=np.uint8)
                for offset in range(-480, 640, 40):
                    cv2.line(dummy, (offset, 0), (offset + 480, 480), (0, 0, 40), 4)
                cv2.putText(dummy, f"NO SIGNAL: {camera_id}", (150, 220),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 255), 3)
                cv2.putText(dummy, f"RTSP URL: {rtsp}", (50, 270),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (180, 180, 180), 1)
                cv2.putText(dummy, "Please check camera connection & RTSP URL", (50, 320),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (140, 140, 140), 1)
                _, jpeg = cv2.imencode(".jpg", dummy, [cv2.IMWRITE_JPEG_QUALITY, 80])
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                       + jpeg.tobytes() + b"\r\n")
                time.sleep(1.0)
                continue
        else:
            frame = _get_latest_frame()
            if frame is not None:
                frame = frame.copy()
                
        if frame is None:
            dummy = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(dummy, "CONNECTING TO CAMERA...", (150, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
            _, jpeg = cv2.imencode(".jpg", dummy, [cv2.IMWRITE_JPEG_QUALITY, 80])
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
                   + jpeg.tobytes() + b"\r\n")
            time.sleep(0.5)
            continue

        if frame.shape[0] != 480 or frame.shape[1] != 640:
            frame = cv2.resize(frame, (640, 480))

        # 3. Apply CCTV lens filters based on the selected camera
        if camera_id == "CAM_03":
            # Green night-vision monocle
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frame = np.zeros_like(frame)
            frame[:, :, 1] = gray
            frame[:, :, 1] = cv2.add(frame[:, :, 1], 15)
        elif camera_id == "CAM_02":
            # Cool blue tinted outdoor security lens
            frame[:, :, 0] = cv2.add(frame[:, :, 0], 35)
            frame[:, :, 1] = cv2.subtract(frame[:, :, 1], 10)
            frame[:, :, 2] = cv2.subtract(frame[:, :, 2], 25)
        elif camera_id == "CAM_01":
            frame[:, :, 2] = cv2.add(frame[:, :, 2], 10)

        # 4. Check for active alerts for THIS camera
        al = None
        with _alert_lock:
            al_raw = latest_alerts_by_camera.get(camera_id)
            if al_raw:
                al = dict(al_raw)
        
        is_hot_alert = al and al.get("animal_detected", False) and (time.time() - al["timestamp"] < 5)
        
        if is_hot_alert:
            is_dang = al.get("dangerous", False)
            conf_val = round(al.get("confidence", 0.0), 1)
            label = f"{'ALERT' if is_dang else 'DETECTION'}: {al['animal_type']} ({conf_val}%)"
            color = (0, 0, 220) if is_dang else (0, 200, 0)
            
            cv2.rectangle(frame, (8, 8), (632, 472), color, 4)
            cv2.rectangle(frame, (0, 0), (640, 45), color, -1)
            cv2.putText(frame, f"{'WARNING: WILDLIFE' if is_dang else 'INFO: ANIMAL'} DETECTED - {label}", (20, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
        else:
            overlay_h = frame.copy()
            cv2.rectangle(overlay_h, (0, 0), (640, 50), (0, 0, 0), -1)
            cv2.addWeighted(overlay_h, 0.45, frame, 0.55, 0, frame)

        # 5. Draw standard CCTV Telemetry Text Overlays
        sec = int(time.time())
        if sec % 2 == 0:
            cv2.circle(frame, (25, 25), 6, (0, 0, 255), -1)
            cv2.putText(frame, "REC", (38, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        else:
            cv2.circle(frame, (25, 25), 6, (60, 60, 60), -1)
            cv2.putText(frame, "REC", (38, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 160, 160), 1)

        cam_tag = f"CCTV: {camera_id} - {cam_name}"
        cv2.putText(frame, cam_tag, (110, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        gps_tag = f"LOC: {location_str}"
        cv2.putText(frame, gps_tag, (420, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)

        time_str = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, time_str, (420, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)

        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
               + jpeg.tobytes() + b"\r\n")
        time.sleep(0.05)


@app.route("/video_feed")
def video_feed():
    camera_id = request.args.get("camera_id")
    if not camera_id:
        camera_id = _get_primary_camera_id()
    return Response(_mjpeg_generator(camera_id),
                    mimetype="multipart/x-mixed-replace; boundary=frame")


PREVIEW_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WildTrack – Live Preview</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0b0f14; color:#e2e8f0; font-family:'Segoe UI',sans-serif;
           display:flex; flex-direction:column; align-items:center; padding:24px; gap:20px; }
    h1  { font-size:1.6rem; letter-spacing:2px; color:#4ade80; }
    #feed { border:2px solid #22c55e; border-radius:8px; max-width:720px; width:100%; }
    #status { background:#111827; border:1px solid #1f2937; border-radius:8px;
              padding:16px 24px; width:100%; max-width:720px; font-size:.9rem; }
    #status h2 { font-size:1rem; margin-bottom:8px; color:#94a3b8; }
    #alert-box { font-size:1.2rem; font-weight:700; padding:10px 0; }
    .detected   { color:#ef4444; }
    .clear      { color:#4ade80; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    td { padding:4px 8px; }
    td:first-child { color:#94a3b8; width:140px; }
  </style>
</head>
<body>
  <h1>🐾 WildTrack Live Monitor</h1>
  <img id="feed" src="/video_feed" alt="Webcam feed">
  <div id="status">
    <h2>Latest Alert</h2>
    <div id="alert-box">Loading...</div>
    <table id="details"></table>
  </div>
  <script>
    async function poll() {
      try {
        const r  = await fetch('/latest-alert');
        const d  = await r.json();
        const box = document.getElementById('alert-box');
        const tbl = document.getElementById('details');
        if (d.dangerous) {
          box.className = 'detected';
          box.textContent = '🚨 ' + d.animal_type + ' detected  (' + d.confidence + '%)';
        } else if (d.animal_detected) {
          box.className = 'clear';
          box.textContent = 'Safe: ' + d.animal_type + ' detected  (' + d.confidence + '%)';
        } else {
          box.className = 'clear';
          box.textContent = '✅ No animal detected';
        }
        tbl.innerHTML = `
          <tr><td>Location</td><td>${d.location}</td></tr>
          <tr><td>Confidence</td><td>${d.confidence}%</td></tr>
          <tr><td>Timestamp</td><td>${new Date(d.timestamp*1000).toLocaleTimeString()}</td></tr>
        `;
      } catch(e) { /* server not ready yet */ }
    }
    setInterval(poll, 2000);
    poll();
  </script>
</body>
</html>
"""

@app.route("/preview")
def preview():
    return PREVIEW_HTML


# ═══════════════════════════════════════════════
#  AUTH API  —  passwords hashed with bcrypt
# ═══════════════════════════════════════════════

@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(force=True)
    name     = data.get("name")
    email    = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    if db_connected and db is not None:
        try:
            if db["users"].find_one({"email": email.lower()}):
                return jsonify({"status": "error", "message": "Email already registered"}), 400

            # Fix: hash password with bcrypt — never store plaintext passwords
            hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")

            db["users"].insert_one({
                "name": name,
                "email": email.lower(),
                "password": hashed_pw,   # stored as bcrypt hash, not plaintext
                "created_at": int(time.time())
            })
            token = create_access_token(identity=email.lower())
            return jsonify({
                "status": "success",
                "message": "User registered successfully",
                "token": token,
                "user": {"name": name, "email": email.lower()}
            })
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        token = create_access_token(identity=email.lower())
        return jsonify({
            "status": "success",
            "message": "User registered (Mock Mode — no MongoDB)",
            "token": token,
            "user": {"name": name, "email": email.lower()}
        })


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data     = request.get_json(force=True)
    email    = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"status": "error", "message": "Missing email or password"}), 400

    if db_connected and db is not None:
        try:
            # Fix: look up by email only, then verify password with bcrypt
            user_doc = db["users"].find_one({"email": email.lower()})
            if user_doc and bcrypt.check_password_hash(user_doc["password"], password):
                token = create_access_token(identity=user_doc['email'])
                return jsonify({
                    "status": "success",
                    "token": token,
                    "user": {"name": user_doc["name"], "email": user_doc["email"]}
                })
            else:
                return jsonify({"status": "error", "message": "Invalid email or password"}), 401
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        # Mock mode — no real user store, accept any credentials
        token = create_access_token(identity=email.lower())
        return jsonify({
            "status": "success",
            "token": token,
            "user": {"name": "Demo User", "email": email.lower()}
        })


@app.route("/api/contact", methods=["POST"])
def api_contact():
    data    = request.get_json(force=True)
    name    = data.get("name")
    email   = data.get("email")
    subject = data.get("subject", "inquiry")
    message = data.get("message")

    if not name or not email or not message:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    if db_connected and db is not None:
        try:
            db["contacts"].insert_one({
                "name": name, "email": email, "subject": subject,
                "message": message, "timestamp": int(time.time())
            })
            return jsonify({"status": "success", "message": "Inquiry recorded in database"})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        return jsonify({"status": "success", "message": "Inquiry accepted (Mock Mode)"})


# ═══════════════════════════════════════════════
#  CAMERAS API
# ═══════════════════════════════════════════════

@app.route("/api/cameras", methods=["GET"])
@jwt_required()
def api_get_cameras():
    if db_connected and db is not None:
        try:
            cursor = db["cameras"].find({}, {"_id": 0})
            cam_list = list(cursor)
            if not cam_list:
                seed_order = [
                    ("CAM_WEBCAM", "Webcam (Dev)", "webcam", "active", 1),
                    ("CAM_01", "North Perimeter", "cctv", "active", 2),
                    ("CAM_02", "East Gate", "cctv", "offline", 3),
                    ("CAM_03", "South Boundary", "cctv", "active", 4),
                ]
                for cam_id, name, c_type, status, num in seed_order:
                    loc = cameras.get(cam_id, "18.5204,73.8567")
                    db["cameras"].insert_one({
                        "id": cam_id, "location": loc, "name": name,
                        "place": f"{_get_deployment_city()} Office", "type": c_type,
                        "status": status, "camera_number": num,
                        "rtspUrl": "", "streamUrl": "", "notes": "",
                        "addedAt": int(time.time() * 1000)
                    })
                cursor   = db["cameras"].find({}, {"_id": 0})
                cam_list = list(cursor)
            return jsonify(_enrich_cameras(cam_list))
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        mock_cams = [
          {"id": "CAM_WEBCAM", "name": "Webcam (Dev)", "location": "18.5204,73.8567",
           "place": "Pune Office", "type": "webcam", "status": "active",
           "rtspUrl": "", "streamUrl": "", "notes": "Laptop webcam — dev/testing",
           "addedAt": int(time.time()*1000) - 86400000 * 3},
          {"id": "CAM_01", "name": "North Perimeter", "location": "18.5204,73.8567",
           "place": "Pune Office — North Gate", "type": "cctv", "status": "active",
           "rtspUrl": "", "streamUrl": "", "notes": "",
           "addedAt": int(time.time()*1000) - 86400000 * 2},
          {"id": "CAM_02", "name": "East Gate", "location": "18.5250,73.8600",
           "place": "East Entrance", "type": "cctv", "status": "offline",
           "rtspUrl": "", "streamUrl": "", "notes": "",
           "addedAt": int(time.time()*1000) - 86400000},
          {"id": "CAM_03", "name": "South Boundary", "location": "18.5190,73.8500",
           "place": "South Sensors", "type": "cctv", "status": "active",
           "rtspUrl": "", "streamUrl": "", "notes": "",
           "addedAt": int(time.time()*1000)},
        ]
        mock_cams[0]["camera_number"] = 1
        mock_cams[1]["camera_number"] = 2
        mock_cams[2]["camera_number"] = 3
        mock_cams[3]["camera_number"] = 4
        return jsonify(_enrich_cameras(mock_cams))


@app.route("/api/cameras", methods=["POST"])
@jwt_required()
def api_add_camera():
    data     = request.get_json(force=True)
    cam_id   = data.get("id")
    location = data.get("location")

    if not cam_id or not location:
        return jsonify({"status": "error", "message": "Missing id or location"}), 400

    if db_connected and db is not None:
        try:
            cam_num = data.get("camera_number") or _next_camera_number()
            new_cam = {
                "id": cam_id, "location": location,
                "name": data.get("name", cam_id),
                "place": data.get("place", f"{_get_deployment_city()} Office"),
                "type": data.get("type", "cctv"),
                "status": data.get("status", "active"),
                "rtspUrl": data.get("rtspUrl", ""),
                "streamUrl": data.get("streamUrl", ""),
                "notes": data.get("notes", ""),
                "camera_number": int(cam_num),
                "addedAt": int(time.time() * 1000)
            }
            db["cameras"].update_one({"id": cam_id}, {"$set": new_cam}, upsert=True)
            cameras[cam_id] = location
            camera_rtsp_urls[cam_id] = new_cam.get("rtspUrl", "")
            return jsonify({"status": "success", "camera": new_cam})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        cameras[cam_id] = location
        camera_rtsp_urls[cam_id] = data.get("rtspUrl", "")
        return jsonify({"status": "success", "message": "Camera added (Mock Mode)"})


@app.route("/api/cameras/<id>", methods=["PUT"])
@jwt_required()
def api_update_camera(id):
    data = request.get_json(force=True)
    if data.get("set_primary"):
        with _settings_lock:
            system_settings["active_detection_camera"] = id
        _save_settings_to_db()
        data = {k: v for k, v in data.items() if k != "set_primary"}

    if db_connected and db is not None:
        try:
            data.pop("_id", None)
            if data:
                db["cameras"].update_one({"id": id}, {"$set": data})
            if "location" in data:
                cameras[id] = data["location"]
            if "rtspUrl" in data:
                camera_rtsp_urls[id] = data["rtspUrl"]
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        if "location" in data:
            cameras[id] = data["location"]
        if "rtspUrl" in data:
            camera_rtsp_urls[id] = data["rtspUrl"]
        return jsonify({"status": "success", "message": "Updated (mock)"})


@app.route("/api/cameras/<id>/control", methods=["POST"])
@jwt_required()
def api_camera_control(id):
    data = request.get_json(force=True) or {}
    action = data.get("action")

    if action not in ("start", "stop", "set_primary"):
        return jsonify({"status": "error", "message": "Invalid action"}), 400

    if action == "set_primary":
        with _settings_lock:
            system_settings["active_detection_camera"] = id
        _save_settings_to_db()
        if db_connected and db is not None:
            db["cameras"].update_many({}, {"$set": {"is_primary": False}})
        return jsonify({"status": "success", "message": f"{id} set as primary"})

    new_status = "active" if action == "start" else "offline"
    if db_connected and db is not None:
        try:
            db["cameras"].update_one({"id": id}, {"$set": {"status": new_status}})
            return jsonify({"status": "success", "camera": {"id": id, "status": new_status}})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    return jsonify({"status": "success", "camera": {"id": id, "status": new_status}})


@app.route("/api/cameras/<id>", methods=["DELETE"])
@jwt_required()
def api_delete_camera(id):
    if db_connected and db is not None:
        try:
            db["cameras"].delete_one({"id": id})
            cameras.pop(id, None)
            return jsonify({"status": "success", "message": f"Camera {id} deleted"})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        cameras.pop(id, None)
        return jsonify({"status": "success", "message": "Camera deleted (Mock Mode)"})


# ═══════════════════════════════════════════════
#  ALERTS API
# ═══════════════════════════════════════════════

@app.route("/api/alerts", methods=["GET"])
@jwt_required()
def api_get_alerts():
    if db_connected and db is not None:
        try:
            cursor     = db["alerts"].find({}, {"_id": 0}).sort("timestamp", -1).limit(100)
            alert_list = list(cursor)
            return jsonify(alert_list)
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        return jsonify([])


@app.route("/api/system/status", methods=["GET"])
@jwt_required(optional=True)
def api_system_status():
    primary_id = _get_primary_camera_id()
    primary_name = primary_id

    total = active = offline = 0
    if db_connected and db is not None:
        try:
            cam_list = list(db["cameras"].find({}, {"_id": 0, "id": 1, "name": 1, "status": 1}))
            total = len(cam_list)
            active = sum(1 for c in cam_list if c.get("status") == "active")
            offline = total - active
            for c in cam_list:
                if c.get("id") == primary_id:
                    primary_name = c.get("name", primary_id)
        except Exception:
            pass
    else:
        total = len(cameras)
        active = total - 1
        offline = 1

    with _settings_lock:
        monitoring = system_settings.get("monitoring_enabled", True)
        active_cam = system_settings.get("active_detection_camera", "CAM_01")

    with _alert_lock:
        alert_snap = dict(latest_alert)

    return jsonify({
        "monitoring_enabled": monitoring,
        "active_detection_camera": active_cam,
        "deployment_city": _get_deployment_city(),
        "primary_camera": {"id": primary_id, "name": primary_name},
        "cameras": {"total": total, "active": active, "offline": offline},
        "mongodb_connected": db_connected,
        "latest_alert": alert_snap,
    })


@app.route("/api/system/settings", methods=["PUT"])
@jwt_required()
def api_system_settings():
    global system_settings
    data = request.get_json(force=True) or {}

    with _settings_lock:
        if "monitoring_enabled" in data:
            system_settings["monitoring_enabled"] = bool(data["monitoring_enabled"])
        if "active_detection_camera" in data:
            system_settings["active_detection_camera"] = data["active_detection_camera"]
        if "deployment_city" in data and data["deployment_city"]:
            system_settings["deployment_city"] = str(data["deployment_city"]).strip()
        if "webcam_index" in data:
            try:
                system_settings["webcam_index"] = int(data["webcam_index"])
            except Exception:
                pass

    _save_settings_to_db()
    return jsonify({"status": "success", "settings": dict(system_settings)})



@app.route("/api/alerts", methods=["DELETE"])
@jwt_required()
def api_clear_alerts():
    if db_connected and db is not None:
        try:
            db["alerts"].delete_many({})
            return jsonify({"status": "success", "message": "Alert history cleared"})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        return jsonify({"status": "success", "message": "Alert history cleared (Mock Mode)"})


# ── Entry point ───────────────────────────────
@app.route('/api/notify/email', methods=['POST'])
@jwt_required(optional=True)  # Android background service uses JWT
def send_email_notification():
    try:
        data = request.json
        if not data or not data.get('to') or not data.get('subject') or not data.get('body'):
            return jsonify({"status": "error", "message": "Missing required fields"}), 400
            
        # In a real production app, use smtplib or a service like SendGrid/AWS SES
        print(f"\n[{datetime.now()}] [MOCK EMAIL DISPATCH]")
        print(f"To: {data['to']}")
        print(f"Subject: {data['subject']}")
        print(f"Body:\n{data['body']}")
        print("-------------------------------------------\n")
        
        return jsonify({"status": "success", "message": "Email dispatched successfully"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    print("=" * 52)
    print("  WildTrack Animal Alert Server")
    print("  API     →  https://0.0.0.0:5000")
    print("  Preview →  https://localhost:5000/preview")
    print("=" * 52)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True, ssl_context='adhoc')
