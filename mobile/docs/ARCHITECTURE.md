# EcoAlert Mobile architecture

`mobile/src` has five direct folders:

| Folder | Responsibility |
| --- | --- |
| `app/` | Root, Citizen, and Officer navigation; application providers and notification navigation reference. |
| `auth/` | Login and registration screens, session API and hooks, and the ADMIN mobile notice. |
| `citizen/` | Citizen screens, presentation, location and map components. `report/` contains the six ReportFlow screens, capture helpers, AI result presentation, watermark and offline queue. |
| `officer/` | Officer task, operational map, GPS check-in, routing, and resolution screens, components, hooks, and helpers. |
| `shared/` | API clients, UI/media/vision components, hooks, contexts, theme, services, utilities, and data types consumed across roles. |

`App.tsx` composes the application providers and RootNavigator. `RootNavigator` opens Citizen or Officer navigation only for those exact roles. ADMIN and unrecognized roles see a dedicated notice with logout. The `ADMIN` role remains in shared authentication types and backend contracts; the administrative dashboard is on the web application.

Citizen reporting starts at `citizen/report/ReportFlowNavigator.tsx`. Its draft stays in `FieldReportContext.tsx` while the user moves through location, camera, photo review, image validation, confirmation, and success. Shared API and vision presentation code remains under `shared/`; Officer routing and map camera helpers stay under `officer/`.

The path-by-path migration ledger is in `ROLE_MIGRATION.md` and `role-migration.json`. Run `node scripts/role-migration.cjs verify` from `mobile/` to check that the five folders are the only direct `src` folders, migrated imports resolve, and the source graph has no circular imports.

Validation commands from `mobile/`:

```sh
npx tsc --noEmit
node tests/report-semantic-flow.test.cjs
node tests/mobile-role-routing.test.cjs
node tests/officer-map-interaction.test.cjs
EXPO_OFFLINE=1 npx expo export --platform ios
EXPO_OFFLINE=1 npx expo export --platform android
```

The first two test files above are committed tests. The Officer map interaction test is existing untracked local work and remains untracked. Other tracked tests were already locally deleted before this migration; their deletions were preserved.
