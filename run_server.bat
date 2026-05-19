@echo off
echo ============================================
echo  WildTrack Animal Alert Server — Setup
echo ============================================

:: Install Python dependencies
pip install -r requirements.txt

echo.
echo ============================================
echo  Starting server...
echo  API      ^>  http://localhost:5000
echo  Preview  ^>  http://localhost:5000/preview
echo ============================================
echo.

python server.py
pause
