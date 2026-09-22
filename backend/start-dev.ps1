# Script to automate building and running all EcoAlert backend microservices locally on Windows.

# 1. Build the shared package first
Write-Host "====== [1/3] Building @ecoalert/shared library ======" -ForegroundColor Cyan
cd shared
npm install
npm run build
cd ..

# List of Node.js services to run
$services = @("api-gateway", "user-service", "alert-service", "gis-service", "media-service", "notification-service", "ai-service")

# 2. Install dependencies for all services
Write-Host "`n====== [2/3] Installing dependencies for all microservices ======" -ForegroundColor Cyan
foreach ($service in $services) {
    Write-Host "`n[+] Installing dependencies for: $service" -ForegroundColor Yellow
    cd $service
    npm install
    cd ..
}

# 3. Start all services in separate PowerShell windows
Write-Host "`n====== [3/3] Starting all microservices ======" -ForegroundColor Green
Write-Host "Opening separate PowerShell windows for each service. Keep them open to see logs." -ForegroundColor Green

# Start Python vision-service
Write-Host "[>] Starting vision-service (FastAPI + YOLO)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd vision-service; python -m uvicorn main:app --port 8001"

# Start Node.js services
foreach ($service in $services) {
    Write-Host "[>] Starting $service..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $service; npm run dev"
}

Write-Host "`nDone! All services have been launched. You can check the new windows for status/logs." -ForegroundColor Green