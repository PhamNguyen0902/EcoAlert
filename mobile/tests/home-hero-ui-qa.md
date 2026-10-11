# Citizen Home hero — implementation and QA

## Scope / files

Only the existing hero in `CitizenDashboardScreen.tsx` was replaced. Stable
callbacks still navigate to `ReportTab` and `MyReportsTab`. The existing central
PLUS/report launcher, navigation, app bar/profile/bell, feature grid, map preview,
recent activity and APIs were not changed. Unrelated Admin edits remain outside
this commit. No dependencies were added.

New files in `src/components/citizen/hero/`:

- `HomeHero.tsx`: composition, actual profile, guest fallback, two-line name
  with full accessible label, theme-aware gradient/readability mask.
- `AnimatedTopographicBackground.tsx`: eight organic SVG contours plus small
  dotted geospatial details and radial light. Static geometry; one animated layer.
- `EcoCityIllustration.tsx`: bundled transparent original eco-city artwork.
- `HeroActionButtons.tsx`: report/tracking buttons and short press feedback.
- `heroStyles.ts`: scoped light/dark palette and responsive sizing.
- `useHeroMotion.ts`: shared animation lifecycle and accessibility preferences.

Artwork: `assets/hero/eco-city.png`; generation details in `assets/hero/README.md`.
Tests: new `tests/home-hero.test.cjs`, adapted Home fixture in
`tests/citizen-stitch.test.cjs` for the extracted component.

## Motion / performance

- Reanimated transform/opacity worklets; no per-frame React state updates.
- Terrain: 14-second reverse cycle, 7dp horizontal / 5dp vertical travel,
  effective layer opacity 0.10–0.16 dark / 0.08–0.115 light before masking.
- City: 3.6-second reverse cycle, 4dp vertical float, subtle shadow opacity.
- Entrance: 360ms, 5dp movement; content stays readable and actions stay active.
- Press: 0.97 scale, 110ms. No idle CTA pulse.
- Blur, app background and unmount cancel continuous animations. OS Reduce
  Motion is read initially and observed for changes; static mode resets to a
  fully visible scene. Event subscriptions are removed on unmount.
- Decorative layers ignore touches and are excluded from accessibility traversal.
- One local 1.90 MiB PNG; no runtime image download. Rough full-resolution RGBA
  footprint is 6 MiB before platform downsampling. Memoized hero/decorations and
  stable navigation callbacks avoid unrelated query rerenders where possible.
- Scroll frame time, GPU usage and memory on a physical phone were not profiled.
  Animations pause on screen blur/background, not when the hero merely scrolls
  above the viewport while Home remains focused.

## Visual inspection actually performed

An ignored local DOM adapter rendered the actual hero JSX/style objects in a
browser at 360, 375, 390 and 430px widths, dark and light. This is an approximation,
not React Native Web or a native device render. It was used to inspect composition,
image proportions, text wrapping and spacing, not native animation correctness.

First pass exposed multiline CTA labels at 360px. Reduced CTA gaps/icon widths,
kept 64dp minimum button height and balanced both buttons. Reduced name line
height and capped illustration height to keep the card compact.

Final DOM measurements: 265.6–269.6px hero height across the four widths. Checked
normal name, guest, and long-name truncation; no overlap with the illustration or
CTA in the approximation. Dark/light retain the same detailed city asset. Light
mode uses pale green/cyan surfaces and dark readable text. Contrast assertions
cover primary/secondary text against all hero gradient stops.

Native font metrics, Dynamic Type, safe-area behavior, real map scrolling and
animation smoothness still require device testing. No iOS/Android simulator was
available in this environment, so no native screenshots or pixel-perfect claim.

## Automated validation

- `npx tsc --noEmit`: PASS.
- `node --test tests/*.test.cjs`: 161 PASS, 0 FAIL. Includes 7 new hero tests,
  profile/guest, both CTA callbacks, long-name semantics, theme contrast, reduced
  motion, blur/background/unmount cleanup, decorative touch handling, existing
  five-position Citizen navigation, central ReportFlow launcher and prior flows.
  Includes the pre-existing local Admin logout test, which is not part of this commit.
- `npx expo export --platform android --platform ios --output-dir .expo/home-hero-validation`:
  PASS. Both Hermes bundles and the local artwork exported successfully. This
  verifies bundling/worklet transformation, not native runtime behavior.

The tests use the repo's TypeScript/VM component fixtures; they are not end-to-end
phone taps or native pixel/layout tests.

## Device follow-up checklist

1. Open Citizen Home on 360/375/390/430dp phones in dark and light mode.
2. Verify long names, guest view and larger OS text size do not cover the city/buttons.
3. Tap Report and Tracking; verify the existing ReportFlow and My Reports routes.
4. Verify central PLUS still launches exactly one ReportFlow.
5. Scroll through feature grid, real map preview and activity; check frame smoothness.
6. Switch tabs and background/foreground the app; verify motion pauses/resumes.
7. Toggle OS Reduce Motion while Home is open; verify static fully visible content.
8. Check VoiceOver/TalkBack focus order: decorative city/terrain are skipped.

Delivery is a local commit on `feature/mobile-field-capture`; no push or main merge.
