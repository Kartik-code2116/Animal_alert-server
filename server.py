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
import pymongo

# ─────────────────────────────────────────────
# FLASK APP SETUP  (CORS must be applied before any routes)
# ─────────────────────────────────────────────
app = Flask(
    __name__,
    static_folder=os.path.join("dashboard", "build"),
    static_url_path="/"
)
CORS(app)        # Fix: was placed after the first @app.route; must come before all routes
bcrypt = Bcrypt(app)

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
    "animal_type": None,
    "confidence": 0.0,
    "location": "0.0,0.0",
    "latitude": 0.0,
    "longitude": 0.0,
    "timestamp": int(time.time()),
    "image": None,
}

# Fix: lock to protect latest_alert from simultaneous writes by webcam thread + HTTP thread
_alert_lock = threading.Lock()

cameras = {
    "CAM_WEBCAM": "18.5204,73.8567",
    "CAM_01":     "18.5204,73.8567",
    "CAM_02":     "18.5250,73.8600",
    "CAM_03":     "18.5190,73.8500",
}

system_settings = {
    "monitoring_enabled": True,
    "active_detection_camera": "CAM_01",
    "deployment_city": "Pune",
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
            for cam in db["cameras"].find({}, {"id": 1, "location": 1}):
                cameras[cam["id"]] = cam["location"]
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


def _webcam_thread():
    global _latest_frame, _webcam_running
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[WARN] Could not open webcam — webcam feed disabled.")
        _webcam_running = False
        return

    _webcam_running = True
    print("[INFO] Webcam capture started.")
    while _webcam_running:
        ret, frame = cap.read()
        if ret:
            with _frame_lock:
                _latest_frame = frame.copy()
        time.sleep(0.033)

    cap.release()
    print("[INFO] Webcam capture stopped.")


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

        cam_location = _get_detection_location()
        lat_val, lng_val = _parse_lat_lng(cam_location)

        if not monitoring_on:
            new_alert = {
                "animal_detected": False,
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
            continue

        frame = _get_latest_frame()
        if frame is None:
            continue

        detections = detector.detect(frame)

        if detections:
            best = max(detections, key=lambda d: d["confidence"])
            success, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_b64 = (
                base64.b64encode(jpeg.tobytes()).decode("utf-8") if success else None
            )
            new_alert = {
                "animal_detected": True,
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
                "animal_detected": False,
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
def get_latest_alert():
    with _alert_lock:
        data = dict(latest_alert)
    return jsonify(data)


@app.route("/register/camera", methods=["POST"])
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

        detections  = detector.detect(frame)
        is_dangerous = any(
            d["class_name"].lower() in detector.DANGEROUS_ANIMALS for d in detections
        )

        cam_location = cameras[camera_id]
        try:
            lat_val = float(cam_location.split(",")[0])
            lng_val = float(cam_location.split(",")[1])
        except Exception:
            lat_val = 0.0
            lng_val = 0.0

        if detections:
            best = max(detections, key=lambda d: d["confidence"])
            new_alert = {
                "animal_detected": True,
                "animal_type": best["class_name"],
                "confidence": round(best["confidence"], 2),
                "location": cam_location,
                "latitude": lat_val,
                "longitude": lng_val,
                "timestamp": int(time.time()),
                "image": image_b64,
            }
            save_alert_to_db(new_alert)
            message = "Wildlife detected!"
        else:
            new_alert = {
                "animal_detected": False,
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
def _mjpeg_generator():
    while True:
        frame = _get_latest_frame()
        if frame is None:
            time.sleep(0.1)
            continue

        with _alert_lock:
            al = dict(latest_alert)

        if al["animal_detected"]:
            label = f"{al['animal_type']}  {al['confidence']:.1f}%"
            cv2.putText(frame, label, (10, 36),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 60, 255), 3)
            cv2.rectangle(frame, (5, 5), (frame.shape[1]-5, frame.shape[0]-5),
                          (0, 0, 220), 3)
        else:
            cv2.putText(frame, "No animal detected", (10, 36),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (50, 200, 50), 2)

        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n"
               + jpeg.tobytes() + b"\r\n")
        time.sleep(0.05)


@app.route("/video_feed")
def video_feed():
    return Response(_mjpeg_generator(),
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
        if (d.animal_detected) {
          box.className = 'detected';
          box.textContent = '🚨 ' + d.animal_type + ' detected  (' + d.confidence + '%)';
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
            token = base64.b64encode(f"{email}:{int(time.time())}".encode()).decode()
            return jsonify({
                "status": "success",
                "message": "User registered successfully",
                "token": token,
                "user": {"name": name, "email": email.lower()}
            })
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        token = base64.b64encode(f"{email}:{int(time.time())}".encode()).decode()
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
                token = base64.b64encode(
                    f"{user_doc['email']}:{int(time.time())}".encode()
                ).decode()
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
        token = base64.b64encode(f"{email}:{int(time.time())}".encode()).decode()
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
            return jsonify({"status": "success", "camera": new_cam})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        cameras[cam_id] = location
        return jsonify({"status": "success", "message": "Camera added (Mock Mode)"})


@app.route("/api/cameras/<id>", methods=["PUT"])
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
            return jsonify({"status": "success"})
        except Exception as e:
            return jsonify({"status": "error", "message": f"Database error: {e}"}), 500
    else:
        if "location" in data:
            cameras[id] = data["location"]
        return jsonify({"status": "success", "message": "Updated (mock)"})


@app.route("/api/cameras/<id>/control", methods=["POST"])
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

    _save_settings_to_db()
    return jsonify({"status": "success", "settings": dict(system_settings)})


@app.route("/api/alerts", methods=["DELETE"])
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
if __name__ == "__main__":
    print("=" * 52)
    print("  WildTrack Animal Alert Server")
    print("  API     →  http://0.0.0.0:5000")
    print("  Preview →  http://localhost:5000/preview")
    print("=" * 52)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
