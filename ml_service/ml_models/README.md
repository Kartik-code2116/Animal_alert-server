# ml_models — Your ML Model Lives Here

## Current mode
The server ships with **MobileNet-SSD (COCO)** as a placeholder detector.
It auto-downloads its weights (~23 MB) on first run.
It can detect: bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe.

---

## How to add YOUR model

1. **Copy your model file(s) into this folder.**
   e.g. `yolov8n_wildlife.pt`, `best.pt`, `model.tflite`, etc.

2. **Open `detector.py` and edit two methods:**

### `__init__` — load your model
```python
def __init__(self):
    from ultralytics import YOLO          # or your own library
    self.model  = YOLO("ml_models/best.pt")
    self._ready = True
```

### `detect(frame)` — run inference, return standard format
```python
def detect(self, frame):
    results = self.model(frame)
    out = []
    for r in results:
        for box in r.boxes:
            cls  = self.model.names[int(box.cls[0])]
            conf = float(box.conf[0]) * 100
            out.append({"class_name": cls, "confidence": round(conf, 2)})
    return out
```

The return format must be:
```python
[{"class_name": "Tiger", "confidence": 98.4}, ...]
```
Return `[]` when nothing is detected.

That's it — `server.py` handles everything else automatically.

---

## Danger level matrix (used by the Android app)
| Level | Animals |
|-------|---------|
| 5 – Very High | Bear, Wolf, Lion, Tiger, Leopard, Crocodile, Alligator, Venomous Snake |
| 4 – High | Wild Boar, Moose, Elk, Bison, Deer (conf > 80%) |
| 3 – Medium | Deer, Fox, Coyote, Raccoon, Skunk |
| 2 – Moderate | Rabbit, Squirrel, Bird, Cat, Dog |
| 1 – Low | Everything else |
