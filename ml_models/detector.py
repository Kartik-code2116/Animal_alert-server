"""
ml_models/detector.py
======================
NOW USING: YOLOv8 custom model  →  ml_models/best.pt

To swap in a different model later:
  1. Replace best.pt with your new model file/folder
  2. Update the path in __init__ below
"""

from __future__ import annotations
import os
import numpy as np

# ── Dangerous animal set used by server.py ───
DANGEROUS_ANIMALS = {
    "bear", "elephant", "wolf", "lion", "tiger",
    "leopard", "crocodile", "alligator", "snake",
    "wild_boar", "cheetah", "hyena",
}

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")


class AnimalDetector:
    """YOLOv8-based animal detector using your custom best.pt model."""

    DANGEROUS_ANIMALS = DANGEROUS_ANIMALS

    def __init__(self):
        from ultralytics import YOLO
        print(f"[INFO] Loading YOLOv8 model from: {_MODEL_PATH}")
        self.model  = YOLO(_MODEL_PATH)
        self._ready = True
        print(f"[INFO] Model loaded. Classes: {list(self.model.names.values())}")

    def detect(self, frame: np.ndarray) -> list[dict]:
        """
        Run inference on a BGR numpy frame.
        Returns list of dicts: [{"class_name": str, "confidence": float}, ...]
        Returns [] when nothing detected.
        """
        if not self._ready or frame is None:
            return []

        results = self.model(frame, verbose=False)
        out: list[dict] = []

        for r in results:
            for box in r.boxes:
                cls  = self.model.names[int(box.cls[0])]
                conf = float(box.conf[0]) * 100
                if conf < 40.0:   # ignore low-confidence detections
                    continue
                out.append({
                    "class_name": cls,
                    "confidence": round(conf, 2),
                })

        return out
