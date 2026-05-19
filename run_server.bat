@echo off
echo ============================================
echo  WildTrack Animal Alert Server — Setup
echo ============================================

:: Install Python dependencies (includes pymongo and flask-bcrypt now)
echo [1/3] Installing Python dependencies...
pip install -r requirements.txt

:: Build the React dashboard so Flask can serve it
:: Fix: was missing — Flask serves dashboard/build/ but it was never built,
::      causing a 404 on the root URL on first run.
echo.
echo [2/3] Building React dashboard...
cd dashboard
call npm install
call npm run build
cd ..

echo.
echo ============================================
echo  [3/3] Starting server...
echo  API      ^>  http://localhost:5000
echo  Preview  ^>  http://localhost:5000/preview
echo  Dashboard^>  http://localhost:5000
echo ============================================
echo.

python server.py
pause
