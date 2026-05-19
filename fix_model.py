"""
Run this ONCE to convert the best.pt folder into a proper single .pt file.
Usage:  python fix_model.py
"""
import torch
import os
import shutil

folder = r"D:\9)projects\Animal_alert server\ml_models\best.pt"
output = r"D:\9)projects\Animal_alert server\ml_models\best_fixed.pt"

print("Loading model from folder...")
# torch.load can load the folder-format directly
ckpt = torch.load(folder, map_location="cpu", weights_only=False)

print("Saving as single .pt file...")
torch.save(ckpt, output)

print(f"Done! Saved to: {output}")
print("Now rename  best_fixed.pt  →  best2.pt  and update detector.py if needed.")
