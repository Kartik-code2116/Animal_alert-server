# 🐾 WildTrack: Wild Animal Alert System

WildTrack is a modern, end-to-end wild animal detection and alert system designed to monitor perimeters, identify dangerous wildlife, and dispatch instant notifications to monitoring dashboards and mobile applications. It integrates a lightweight Flask backend, an OpenCV webcam/CCTV feed ingestion pipeline, a custom-trained YOLOv8 computer vision model, a React administrative dashboard, and an Android client application.

---

## 📸 System Flowchart Overview

### 1. Visual Flowchart
A high-level visual representation of the system architecture has been generated and saved to the project root directory. You can open and view it here:
**[wildtrack_flowchart.png](file:///d:/9)projects/Animal_alert server/wildtrack_flowchart.png)**

### 2. Logical Data Flow
The diagram below details the data flow between physical input sources, the Python Flask backend service, the YOLOv8 model, the MongoDB storage layer, and client user interfaces:

```mermaid
graph TD
    classDef device fill:#111827,stroke:#3b82f6,stroke-width:2px,color:#e2e8f0;
    classDef server fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#e2e8f0;
    classDef db fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#e2e8f0;
    classDef client fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#e2e8f0;

    subgraph VideoSources [Input Sources]
        webcam[Laptop Webcam / cv2.VideoCapture]:::device
        cctv[External CCTV Cameras / RTSP]:::device
    end

    subgraph Backend [Flask Backend Server - python server.py]
        flask_api[Flask REST API Endpoints]:::server
        cv_thread[OpenCV Capture Thread]:::server
        det_thread[Auto-Detection Loop]:::server
        yolo[YOLOv8 AnimalDetector - best.pt]:::server
    end

    subgraph Storage [Database]
        mongo[(MongoDB local 'wildtrack' DB)]:::db
    end

    subgraph Viewers [Clients & Dashboards]
        react_dash[React Web Dashboard - port 3000/build]:::client
        android_app[WildTrack Android App]:::client
        live_preview[Web Browser - /preview MJPEG]:::client
    end

    webcam --> cv_thread
    cctv --> flask_api
    cv_thread --> det_thread
    det_thread --> yolo
    yolo -- Detections --> det_thread
    flask_api --> yolo
    det_thread -- Save Alerts --> mongo
    flask_api -- Save Cameras/Users --> mongo
    
    flask_api -- MJPEG Stream --> live_preview
    flask_api -- JSON API / Proxy --> react_dash
    flask_api -- Polling GET /latest-alert --> android_app
```

---

## 🗂️ File-by-File Repository Breakdown

Here is a detailed explanation of the role and contents of every file in the server repository:

### Root Directory Files
*   **`server.py`**: The core execution engine. Written in Flask, it hosts the REST API endpoints, starts a background OpenCV thread to read from a webcam or RTSP feed, runs an auto-detection thread every 2 seconds, and connects to MongoDB. If MongoDB is offline, it automatically falls back to an in-memory mock mode.
*   **`requirements.txt`**: List of primary Python library dependencies including Flask, Flask-CORS, OpenCV-python, NumPy, and PyMongo. *(Note: `ultralytics` and `torch` are required for YOLOv8 model execution).*
*   **`run_server.bat`**: A Windows batch file launcher that simplifies startup. It automatically checks and installs python dependencies from `requirements.txt` and executes `server.py`.
*   **`fix_model.py`**: A helper utility to convert directory-formatted PyTorch weights export formats into a single serialized `.pt` weight file (`best_fixed.pt`).
*   **`TODO.md`**: Tasks list noting finished implementations, such as encoding/injecting Base64 images into the alert payload for mobile rendering.

### Machine Learning Engine (`ml_models/`)
*   **`ml_models/detector.py`**: Contains the `AnimalDetector` wrapper class. It loads `best.pt` using `ultralytics.YOLO`, runs inference on BGR numpy arrays, filters out low-confidence outputs (< 40%), and translates raw coordinates to label objects. It defines a set of `DANGEROUS_ANIMALS` used to label threat metrics.
*   **`ml_models/best.pt`**: The custom-trained YOLOv8 weights used for animal object classification.
*   **`ml_models/README.md`**: Explains model formats, the returns layout structure, and documents the threat matrix danger levels.

### React Management Dashboard (`dashboard/`)
The web client dashboard is structured inside `dashboard/` and built using React. It contains the following layout components:
*   **`dashboard/package.json`**: Package configuration listing libraries like `lucide-react` (icons) and `recharts` (charts/graphs) and configures the `"proxy": "http://localhost:5000"` for backend APIs.
*   **`dashboard/src/App.js` & `App.css`**: Configures the main React Router mapping pages and sidebar grids.
*   **`dashboard/src/components/`**:
    *   `Sidebar.js` / `Sidebar.css`: Navigation sidebar enabling pages transitions.
    *   `TopBar.js` / `TopBar.css`: Admin header bar displaying profile menus and quick alerts.
*   **`dashboard/src/pages/`**:
    *   `Landing.js` / `Landing.css`: Premium system introduction landing portal.
    *   `Dashboard.js`: Operational dashboard depicting counts (total cameras, alerts count), custom analytics charts, and recent threats.
    *   `Alerts.js`: Historical log of all animal alerts with locations, timestamps, and confidence percentages.
    *   `Cameras.js`: Management view allowing adding, editing, and deleting cameras.
    *   `MultiView.js`: Screen that renders multi-grid feeds of all registered camera feeds concurrently.
    *   `CctvSetup.js`: Documentation detailing how to configure CCTV RTSP feeds.
    *   `AndroidGuide.js`: Guidelines page instructing how to setup the WildTrack Android app.
    *   `ServerConfig.js`: Server parameters controller showing database connections status.
    *   `Settings.js`: Interface customization options, dark mode toggle, and settings storage.

---

## ⚙️ How the System Operates

### 1. Video Capture & ML Inference
*   The server spawns a daemon thread (`_webcam_thread()`) that captures frames from camera device 0 (laptop webcam) or an RTSP CCTV video URL using OpenCV.
*   A separate auto-detection daemon thread (`_auto_detect_loop()`) fetches the latest frame every 2 seconds and runs it through `detector.detect()`.
*   If an animal is detected (e.g. "bear"), it calculates the highest confidence detection, encodes the frame to a Base64 string, and sets `latest_alert` state.
*   If connected to MongoDB, it inserts the alert document with timestamp and camera coordinate details into the `alerts` database collection.

### 2. External Camera Frame Push
External IoT devices or standalone security cameras can push pre-processed or raw frames to the server using the `POST /camera/detect` endpoint, which registers the threat, updates the global state, and returns a JSON detection report.

### 3. React Web Interface
The React App polls the MongoDB CRUD endpoints to:
*   Add, list, or delete camera hardware registries.
*   Display animal classification telemetry and logs.
*   Plot alerts volume trends over time using interactive graphs.

### 4. WildTrack Android Mobile Client
*   **Polling Loop**: The Android app contains an `AlertService` running in the background, polling `GET /latest-alert` from the server every 3 seconds.
*   **Notifications**: When `animal_detected` is `true`, the app displays a high-priority alert notification on the phone.
*   **Alert Feed & Imagery**: The app decodes the base64 `image` payload from the server and displays the exact frame that triggered the alert, so users can see the animal in real-time.
*   **Theme Adjustments**: Supports switching between a bright, clean light mode theme and a dark mode.

---

## 🚦 API Reference

| Endpoint            | Method | Payload                     | Description                                                         |
|---------------------|--------|-----------------------------|---------------------------------------------------------------------|
| `/health`           | `GET`  | *None*                      | Validates server startup status.                                    |
| `/latest-alert`     | `GET`  | *None*                      | Retreives current active alert and Base64 frame.                    |
| `/register/camera`  | `POST` | `{"camera_id": "...", "location": "lat,lng"}` | Registers location grids of incoming camera sources.                       |
| `/camera/detect`    | `POST` | `{"camera_id": "...", "image": "base64_string..."}` | Endpoint for external CCTV cameras to post frames.                   |
| `/preview`          | `GET`  | *None*                      | Hosts a live HTML streaming browser window overlay.                 |
| `/video_feed`       | `GET`  | *None*                      | Standard MJPEG video feed.                                          |
| `/api/auth/login`   | `POST` | `{"email": "...", "password": "..."}` | Log in administrative dashboard panel.                    |
| `/api/cameras`      | `GET` / `POST` | Camera details json | Retrieves list of registered cameras / adds camera.                 |
| `/api/alerts`       | `GET` / `DELETE` | *None* | Retrieves alert database histories / clears log.                               |

---

## 🛠️ Step-by-Step Installation

### System Pre-requisites
*   Python 3.8 to 3.11 installed.
*   MongoDB installed and running locally on port 27017 (Optional, server runs mock mode without it).
*   Node.js and npm (For compiling/running React frontend).

### 1. Server Setup
Initialize python requirements:
```bash
pip install -r requirements.txt
pip install ultralytics torch torchvision
```
*Alternatively, simply double click the launcher script **`run_server.bat`** which automatically handles virtual environments and dependencies.*

### 2. Swapping the Input from Webcam to RTSP CCTV
In `server.py`, change:
```python
cap = cv2.VideoCapture(0) # laptop webcam
```
to your security camera RTSP feed:
```python
cap = cv2.VideoCapture("rtsp://admin:password@192.168.1.100:554/stream1")
```

### 3. Deploying React Frontend
In a separate terminal tab:
```bash
cd dashboard
npm install
npm run build
```
*(The Flask server automatically hosts the compiled React production build located under `dashboard/build/`).*

### 4. Running the Android Client
1. Get your computer's local IP address (e.g. `ipconfig` on Windows, e.g. `192.168.1.25`).
2. Connect your Android phone to the same Wi-Fi network as the computer.
3. Open the Android application Settings page, set the Base URL to: `http://192.168.1.25:5000/`.
4. Return to the dashboard; you will start receiving real-time alarm alerts and visual images on your phone!
