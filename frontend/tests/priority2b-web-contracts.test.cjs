const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readFrontend(relPath) {
  return fs.readFileSync(path.join(__dirname, "../src", relPath), "utf8");
}

test("Web API contracts: confirmArrival uses accuracyMeters, validateImage/analyze-url use 60s timeout, and fire category is removed", () => {
  const typesSrc = readFrontend("types/index.ts");
  const servicesSrc = readFrontend("services/services.ts");
  const hooksSrc = readFrontend("hooks/hooks.ts");
  const createAlertSrc = readFrontend("pages/CreateAlert.tsx");

  assert.doesNotMatch(typesSrc, /\|\s*"fire"/);
  assert.doesNotMatch(createAlertSrc, /value:\s*"fire"/);

  assert.match(servicesSrc, /confirmArrival:\s*async\s*\(\s*id:\s*string,\s*location:\s*\{\s*latitude:\s*number;\s*longitude:\s*number;\s*accuracyMeters:\s*number\s*\}/);
  assert.match(hooksSrc, /location:\s*\{\s*latitude:\s*number;\s*longitude:\s*number;\s*accuracyMeters:\s*number\s*\}/);

  assert.match(servicesSrc, /api\.post\(\s*"\/v1\/ai\/validate-image",\s*input,\s*\{\s*timeout:\s*60_000,?\s*\}/);
  assert.match(servicesSrc, /api\.post\(\s*"\/v1\/media\/analyze-url",\s*\{\s*imageUrl:\s*uploadedResult\.url\s*\},\s*\{\s*timeout:\s*60_000,?\s*\}/);
  assert.doesNotMatch(createAlertSrc, /Promise\.all\(\s*files\.map/);
});

test("Web SocketContext listens to ai:analyzed, uses VITE_API_URL, does not silence citizenId, and invalidates detail/dashboard queries", () => {
  const socketSrc = readFrontend("contexts/SocketContext.tsx");

  assert.match(socketSrc, /import\.meta\.env\.VITE_API_URL/);
  assert.match(socketSrc, /socketInstance\.on\(\s*'ai:analyzed'/);
  assert.doesNotMatch(socketSrc, /socketInstance\.on\(\s*'image:analyzed'/);
  assert.doesNotMatch(socketSrc, /data\.citizenId\s*\|\|\s*data\.createdBy/);
  assert.match(socketSrc, /queryKey:\s*\[\s*'alert'\s*\]/);
  assert.match(socketSrc, /queryKey:\s*\[\s*'admin-dashboard-stats'\s*\]/);
  assert.match(socketSrc, /queryKey:\s*\[\s*'officer-availability'\s*\]/);
});

test("Web Citizen & Admin pages: safe map coordinates/recenter, pending-only citizen edit/delete, server pagination, and no fake dashboard metrics", () => {
  const incidentMapSrc = readFrontend("features/citizen/components/IncidentMap.tsx");
  const myReportsSrc = readFrontend("features/citizen/pages/MyReports.tsx");
  const reportMgmtSrc = readFrontend("features/admin/pages/ReportManagement.tsx");
  const dashboardSrc = readFrontend("features/admin/pages/AdminDashboard.tsx");

  assert.match(incidentMapSrc, /getIncidentLatLng/);
  assert.match(incidentMapSrc, /useMap/);
  assert.match(incidentMapSrc, /map\.setView\(/);

  assert.doesNotMatch(myReportsSrc, /ai_analyzing/);

  assert.match(reportMgmtSrc, /status:\s*"pending,ai_analyzing"/);
  assert.match(reportMgmtSrc, /status:\s*"assigned,in_progress"/);
  assert.match(reportMgmtSrc, /title:\s*search\.trim\(\)/);
  assert.match(reportMgmtSrc, /disabled=\{page\s*>=\s*totalPages\}/);
  assert.match(reportMgmtSrc, /deleteAlert\.mutate\(\s*alert\._id,\s*\{\s*onSuccess:/);

  assert.doesNotMatch(dashboardSrc, /Math\.random\(/);
  assert.doesNotMatch(dashboardSrc, /:\s*92/);
  assert.doesNotMatch(dashboardSrc, /\|\|\s*stats\?\.pendingIncidents/);
  assert.match(dashboardSrc, /ref\.current\.textContent\s*=\s*"—"/);
});

test("Web Vision, GIS & Officer detail: keyed viewer, URL-first evidence matching, no autoAssign fallback, and no fake 80%/35ms provenance", () => {
  const aiVisionSrc = readFrontend("features/admin/pages/AdminAiVision.tsx");
  const panelSrc = readFrontend("components/incidents/VisionAnalysisTestPanel.tsx");
  const gisMapSrc = readFrontend("features/admin/pages/AdminGisMap.tsx");
  const officerDetailSrc = readFrontend("features/officer/pages/OfficerReportDetail.tsx");

  assert.match(aiVisionSrc, /<EnvironmentalAiAnalysisContent\s+key=\{selectedAlert\._id\}/);
  assert.match(panelSrc, /setImageSize\(null\)/);
  assert.match(panelSrc, /evidence\.find\(\s*\(item\)\s*=>\s*item\.imageUrl\s*===\s*currentImageUrl\s*\)/);

  assert.match(gisMapSrc, /typeof\s+selectedAlert\?\.aiOverallAnalysis\?\.categoryConfidence\s*===\s*"number"/);
  assert.doesNotMatch(gisMapSrc, /serviceAreas\.autoAssign/);
  assert.match(gisMapSrc, /!canDispatchSelectedAlert/);

  assert.match(officerDetailSrc, /setSelectedYoloImageIndex\(0\)/);
  assert.match(officerDetailSrc, /visionEvidenceList\.find\(\s*\(item\)\s*=>\s*item\.imageUrl\s*===\s*currentYoloImageUrl\s*\)/);
  assert.doesNotMatch(officerDetailSrc, /:\s*"80%"/);
  assert.doesNotMatch(officerDetailSrc, /~35ms/);
  assert.doesNotMatch(officerDetailSrc, /±5m/);
});
