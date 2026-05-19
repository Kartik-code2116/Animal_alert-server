"""
Run this ONCE to convert the best.pt folder into a proper single .pt file.
Usage:  python fix_model.py
        (run from the project root: D:\\9)projects\\Animal_alert server\\)
"""
import torch
import os

# Fix: use relative paths so this script works on any machine, not just D:\\9)projects\\...
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
folder    = os.path.join(BASE_DIR, "ml_models", "best.pt")
output    = os.path.join(BASE_DIR, "ml_models", "best_fixed.pt")

print(f"Loading model from: {folder}")
ckpt = torch.load(folder, map_location="cpu", weights_only=False)

print(f"Saving as single .pt file to: {output}")
torch.save(ckpt, output)

print("Done!")
print("Rename  best_fixed.pt  →  best.pt  (or update the path in detector.py) when ready.")
