# EcoAlert Mobile architecture

## Scope and migration baseline

This is a folder/import refactor, not a product redesign. Baseline: `4edc1c00b190f5ce7090cbb0f7089eb242669bb8`, branch `feature/mobile-field-capture`, 2026-10-13.

Before: global `screens`, `components`, `hooks`, `api`, `utils`, `context`, and `navigation` alongside a partly feature-based ReportFlow.

After: 107 existing source files moved in five validated phases. All 147 pre-existing source/entry files remain present, including three uncommitted Officer source files. Their non-import content is byte-identical to the local baseline. No API, route name, JSX layout, style, asset, data schema, permission or workflow implementation was intentionally changed.

The full [migration ledger](architecture-migration.md) lists every old/new path, owner, consumers and risk. [Inventory](architecture-inventory.json) records imports, exports, consumers, route names and hashes before any moves. [Baseline audit](architecture-baseline-audit.json) records barrels, duplicate names and test path dependencies. Baseline and final module graphs have no cycles (type-only edges included).

## Implemented tree

```text
mobile/
  App.tsx                         # providers, NavigationContainer, startup hooks
  index.ts                        # Expo registerRootComponent; unchanged
  assets/                         # unchanged, including hero/eco-city.png
  src/
    app/
      navigation/                 # Root, Citizen, Officer, Admin, navigationRef
      providers/SocketContext.tsx
      legacyScreenExports.ts      # old barrel retained; no active consumer now
    features/
      auth/                       # index (login/register), screens, hooks, api
      citizen/
        home/ nearby/ my-reports/ profile/ settings/ notifications/
        components/               # CitizenHeader, cards, v2 UI and hero animations
        model/                    # citizen list/progress presentation
      report/
        screens/                  # all six active screens, unchanged names
        navigation/               # flow navigator and tab launcher
        model/                    # context, draft types, semantic mapping, media helpers
        hooks/                    # report theme
        components/               # existing Stitch components unchanged
        offline/                  # report queue storage and synchronization
        legacy/                   # old reporting implementations and location picker
      officer/
        dashboard/ tasks/ map/ check-in/ resolution/ profile/ notifications/
        components/               # entrance and timeline
      admin/incidents/            # admin screen, assignment picker, area API/hooks
      incidents/
        api/ hooks/ model/        # shared incident/GIS contracts and presentation
        screens/AlertDetailScreen.tsx
        components/ai/ modals/ vision/
      notifications/              # api, hooks, model, pushNotificationService
    shared/
      api/client.ts               # transport/session-expiry callback, not feature logic
      components/ui/ media/       # reusable primitives and image viewers
      constants/ lib/ hooks/ location/ types/
    theme/                        # theme provider, tokens and useCivicTheme
    i18n/                         # language provider and translations
    navigation/types.ts           # retained public route contract; see exceptions
    screens/officer/OfficerOperationalMap.tsx  # protected local work
    api/officerRouting.ts         # retained dependency of protected map
    hooks/                        # retained dependencies listed below
    utils/                        # retained dependencies listed below
    components/officer/           # retained UI/Card/Filters used by protected map
    components/ui/Button.tsx      # retained dependency of protected map
  tests/
  docs/
```

No empty placeholder features, Metro aliases or backend changes were added. Expo may log that `src/app` is its router root while exporting; the actual entry is still `index.ts -> App.tsx`, using React Navigation, not Expo Router.

## Ownership and dependencies

App composes features and providers. Feature modules consume their own internals, shared infrastructure, and explicitly documented public modules. Shared modules cannot import feature/app/business modules. `theme` and `i18n` are foundation peers allowed by the shared dependency test; neither depends on features.

Use named exports from the narrow source modules in [public module manifest](architecture-public-modules.json). This is the explicit cross-feature interface, enforced by `tests/architecture.test.cjs`; do not create a barrel at every directory level. A small `features/auth/index.ts` exposes only Login/Register to RootNavigator, replacing the global screens barrel on the active path.

Examples of intentional reuse:

- Auth session hooks are consumed by all roles. User/officer lookup API stays with identity/auth, with unchanged permissions.
- Incident API, AI formatting and vision presentation are shared by Citizen, Officer and ReportFlow.
- Notifications owns tap identity, presentation, push registration, API and query hooks. Role-specific notification screens stay with their role.
- Report owns the offline report queue; it is not a generic offline abstraction. My Reports/settings and app startup consume its existing public operations.
- Field capture normalization and watermark helpers remain owned by Report and are reused by Officer resolution. No algorithm extraction occurred.

Existing composition exceptions are documented rather than redesigned: the shared detail screen uses CitizenHeader and the Admin assignment picker; Report success uses Citizen progress helpers; Officer motion uses Report FieldUI. The manifest does not authorize new unrelated internals. These dependencies predate this migration and are follow-up extraction candidates, not new functionality.

## Navigation and providers

`App.tsx` remains the entry composition root: query client, theme, language, socket, safe area and NavigationContainer, push listeners and offline synchronization. Theme/Language providers live with their foundation modules to avoid shared UI depending upwards on `app`.

`app/navigation` owns role routing, with unchanged five Citizen tabs, three Officer tabs, Admin routes and authentication gate. `navigation/types.ts` remains in place because the uncommitted Officer map imports it. It is a public type contract, not a second navigator.

`features/report/navigation/ReportFlowNavigator.tsx` wraps exactly one FieldReportProvider around:

1. ReportLocation
2. ReportCamera
3. ReportPhotoReview
4. ReportImageValidation
5. ReportConfirm
6. ReportSuccess

Admin continues to use `OfficerMapScreen` with `mode="admin"`; Officer uses its default mode. That adapter is deliberately retained in Officer instead of pretending both map implementations are identical. Citizen, Officer and Admin already shared AlertDetailScreen, now owned by Incidents. OfficerAlertDetail remains a separate Officer task screen.

Notification deep-links still use `app/navigation/navigationRef.ts` and the queue in Notifications; auth routes, route parameters and alert ID validation are unchanged.

## APIs, contracts and UI

- HTTP transport: `shared/api/client.ts`.
- Auth/user endpoints: `features/auth/api`.
- Incident, media, semantic and GIS endpoints: `features/incidents/api`.
- Notification endpoints: `features/notifications/api`.
- Service-area endpoints: `features/admin/incidents/api` (existing Officer profile reuse).
- Self-hosted routing adapter: `api/officerRouting.ts`, held for dirty-map compatibility. No OSRM endpoint or request logic changes.
- Shared wire contracts: `shared/types/index.ts` and `notification.ts`. The existing mixed contract file was moved without splitting type definitions; narrowing domain ownership can be a separate audited task.
- Report draft and analysis model: `features/report/model`.
- Generic UI/media: `shared/components`, except the held Button path. Stitch-specific widgets stay with their feature. Colors, sizes, illustrations, animations and padding remain unchanged.

## Protected local changes and incomplete moves

The local OfficerOperationalMap modification and untracked `hooks/useOfficerMapFollow.ts`, `utils/officerMapCamera.ts`, map interaction test and QA document were neither moved, edited nor committed. Pre-existing deletions of `docs/vietnamese-notifications.md` and 32 files under `mobile/tests` remain deleted and excluded from commits. No reset, pull, stash, push or merge was used.

The following clean paths were retained because the protected map imports them directly. Their internal import paths may have changed, but their implementation did not:

- `hooks/useAlerts.ts`, `useOfficerPosition.ts`, `useForegroundScreen.ts`
- `api/officerRouting.ts`
- `utils/maps.ts`, `officerWorkflow.ts`, `officerPresentation.ts`
- `components/officer/OfficerUI.tsx`, `OfficerTaskCard.tsx`, `OfficerTaskFilters.tsx`
- `components/ui/Button.tsx`
- `navigation/types.ts`, `theme/useCivicTheme.ts`
- `features/report/components/stitch/FieldUI.tsx`

These are real implementations, not compatibility facades. Move them only when the Officer work and its test can be migrated together with approval. This is the main remaining architecture debt; the tree is intentionally not presented as fully migrated.

## Legacy and overlap audit

| Implementation | Evidence at baseline | Action |
|---|---|---|
| Active ReportFlow | Citizen navigator registers ReportFlow/ReportTabLauncher; six screens share one context | Kept active, model/navigation grouped |
| citizen/ReportIncidentScreen | Exported by global screens barrel and compatibility file; no route registers it; supports camera and gallery/manual picker | Preserved under report/legacy, no behavioral change |
| screens/ReportIncidentScreen | One-line compatibility re-export; no source/test consumer | Moved to legacy/ReportIncidentScreen.compat.tsx, not deleted |
| citizen/FieldCaptureReportScreen | No source/test/literal-lazy-import/barrel consumers found; camera-only monolith requires fresh device GPS within threshold | Preserved under report/legacy; deletion requires separate decision |
| LocationPickerScreen | Still registered as Citizen LocationPicker compatibility route | Preserved under report/legacy and route unchanged |
| ResolutionModal | No current source consumer found; overlaps Officer resolution workflow | Preserved in Incidents components; no deletion |
| legacyScreenExports | Retains old exported surface; Root now uses Auth entry | Kept as historical compatibility surface, not used by active navigation |

No unused-file finding is treated as permission to delete nontrivial functionality. Duplicate `types.ts`/`index.ts` names reflect different domains, not proof of duplicated behavior.

## Extending the architecture

### Add a screen or feature

1. Choose the business owner; put a screen beside that feature's logic, not in global screens.
2. Add its typed route in the existing public navigation contract and register it in the proper app or Report navigator. Do not rename existing routes casually.
3. Keep local components/models internal. If another feature truly needs one, document its narrow public export in the manifest, or move genuinely role-neutral infrastructure to shared.
4. Add API operations to the owning domain API using the shared client. Do not add a second transport or duplicate backend contract.
5. Add regression coverage for state, permissions, errors and navigation. Run checks below before committing.

### Add shared UI

Shared UI takes data/callback props and may depend on foundation theme/i18n, never a role screen or feature hook. Do not move Stitch-specific business cards into shared just to reduce folder count. Keep platform-native map/camera behavior in the existing feature.

### Tests and verification

```powershell
cd mobile
npx tsc --noEmit
node --test tests/*.test.cjs
$env:EXPO_OFFLINE='1'
npx expo export --platform ios --output-dir dist/architecture-ios --max-workers 2
npx expo export --platform android --output-dir dist/architecture-android --max-workers 2
```

Test paths/mocks in `report-semantic-flow.test.cjs` were updated contextually; assertions were not removed. The untracked Officer test is unchanged. `architecture.test.cjs` checks local import resolution, cycles, shared boundaries, documented cross-feature modules, all role route names, Report provider scope, Admin map mode and notification cold-start/role/deduplication behavior.

The one-time `scripts/architecture-migration.cjs verify` compares existing source with the baseline after stripping only module-specifier strings. Do not use its migration/commit commands for normal development or replay completed phases. Its snapshot is historical evidence, not a requirement to freeze all future product code.

Existing package scripts `test:vision`, `test:civic`, `test:images` reference test files already deleted locally before this task. They were not silently restored, skipped or counted as passing. The existing applicable local suite is the 12 semantic-flow tests plus 9 Officer tests; the new architecture suite supplements it.

## Validation record

- Baseline and each B–F phase: strict TypeScript passed; 21 existing applicable tests passed after updating test paths where required.
- Source audit: all 147 pre-existing source/entry files preserve exact non-import content; protected source remains byte-identical; no unresolved imports or new module cycles.
- iOS export: passed, 4,431 modules, Hermes bundle and 17 assets including Eco City.
- Android export: passed, 4,429 modules, Hermes bundle and 18 assets including Eco City.
- Final tests: 33/33 passed (12 existing semantic-flow, 9 existing local Officer, 12 new architecture/navigation/notification checks).
- No physical iPhone/Android or simulator UI verification was performed. Native camera/GPS/permissions, login against the live API, screenshots, gestures, real push delivery and real field-resolution submission still require device smoke testing. Compile/bundle and mocked tests are not substitutes for those checks.

Phase commits: `470846a` shared; `aa464ca` auth/citizen; `fd77d1b` report; `4a769f7` officer; `6818e33` navigation/domain. Final documentation/test commit follows these. All commits are local only.
