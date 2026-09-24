---
name: r3f-mobile-input
description: Mobile controls and performance for React Three Fiber games - virtual joystick, touch gestures, unified keyboard/touch input, third-person camera follow, adaptive DPR. Use when working on movement, joystick, touch input, camera or mobile performance in the 3D world.
---
# R3F mobile input and camera

Reference notes (MIT, Nice Wolf Studio - see LICENSE) in `references/`:
- `touch-input.md` - touch events, gestures, virtual joystick patterns
- `input-system.md` - one input system for keyboard, mouse, touch and gamepad
- `camera-system.md` - follow cameras, smoothing, collision
- `r3f-mobile-patterns.md`, `r3f-performance.md` - DPR, draw calls, frame budget on phones

## How Bgame does it (keep these invariants)
- Input lives in `src/world/controls.ts`: keyboard set + joystick `{x, z, active, pointerId}`.
- The joystick component (`src/ui/Joystick.tsx`) stays mounted for the whole world session.
  Unmounting it mid-drag loses `pointerup` and the avatar keeps walking (bug fixed 2026-09).
- Release paths: element pointerup/cancel/lostpointercapture, a window-level pointerup for the same
  pointer id, and `resetInput()` on blur, tab hide, world pause and unmount.
- Dead zone 0.18 with a linear ramp; velocity damps faster when input is zero, so no drift.
