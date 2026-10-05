const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "../src", file), "utf8");
test("Citizen has exactly four tabs in the requested order", () => {
  const source = read("navigation/CitizenTabNavigator.tsx");
  const tabs = [...source.matchAll(/<Tab.Screen\s+name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ["DashboardTab", "MapTab", "ReportTab", "MyReportsTab"]);
  assert.match(source, /<Stack.Screen name="Profile" component=\{CitizenProfileScreen\}/);
});
test("Report tab still launches the existing field-report stack", () => {
  assert.match(read("navigation/CitizenTabNavigator.tsx"), /component=\{ReportTabLauncherScreen\}/);
  assert.match(read("features/report/ReportTabLauncherScreen.tsx"), /navigate\("ReportFlow"\)/);
});
test("Home Map action and all tab avatars lead to the intended routes", () => {
  assert.match(read("screens/citizen/CitizenDashboardScreen.tsx"), /action=\{copy.viewMap\}[\s\S]*?navigate\("MapTab"\)/);
  for (const screen of ["CitizenDashboardScreen", "CitizenMapScreen", "MyReportsScreen"]) {
    assert.match(read(`screens/citizen/${screen}.tsx`), /onProfile=[\s\S]*?navigate\("Profile"\)/);
  }
});
