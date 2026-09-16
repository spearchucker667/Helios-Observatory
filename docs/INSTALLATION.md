# Installation & System Requirements

This document provides complete instructions for installing, configuring, and running **Helios Observatory** in local development, containerized environments, and production hosting.

---

## 1. System Requirements

### Hardware
- **CPU:** Dual-core 2.0 GHz or faster x86_64 / ARM64 processor (Apple Silicon M1/M2/M3/M4 supported natively).
- **Memory:** 4 GB RAM minimum (8 GB recommended for inspection-tier textures and 3D scenes).
- **GPU:** WebGL 2.0 compatible graphics processor with hardware acceleration enabled.
  - Recommended: Discrete GPU or modern integrated GPU (Apple Silicon, Intel Iris Xe, AMD Radeon, NVIDIA GeForce).
- **Display:** Minimum resolution 390×844 (mobile viewports supported; 1920×1080 or higher recommended for multi-window desktop exploration).

### Software & Environment
- **Node.js:** Node.js **22.x LTS** (Node 22 is required for native `--experimental-strip-types` testing).
- **Package Manager:** `npm` (bundled with Node 22) or `pnpm` 9+.
- **Operating System:** macOS 13+, Ubuntu 22.04+ / Debian 12+, Fedora 38+, or Windows 11 (via WSL2).
- **Web Browser:** Modern evergreen browser with WebGL 2.0 support:
  - Google Chrome / Chromium 120+
  - Mozilla Firefox 120+
  - Apple Safari 17+
  - Microsoft Edge 120+

---

## 2. Installation Steps

### Step 1: Clone Repository
```bash
git clone https://github.com/spearchucker667/Helios-Observatory.git
cd Helios-Observatory
```

### Step 2: Install Dependencies
```bash
npm install
```
Dependencies include:
- **Core:** React 19, Three.js, `@react-three/fiber`, `@react-three/drei`
- **Routing & State:** TanStack Start / Router, Zustand, Lucide React, CMDK
- **Styling:** Tailwind CSS v4, Radix UI primitives
- **Validation:** Zod

### Step 3: Verify Environment
Verify that your TypeScript compiler and test runner pass cleanly:
```bash
npm run typecheck
npm test
npm run lint
```

---

## 3. Starting the Observatory

### Development Server
Run the development server bound to `0.0.0.0:8080`:
```bash
npm run dev
```
Open your browser at [http://localhost:8080](http://localhost:8080).

### Production Build & Preview
To compile the optimized production bundle and verify the build:
```bash
npm run build
npm run preview:restart
```
The production preview runs on `http://127.0.0.1:8081`.

---

## 4. Headless & Containerized Execution

When running in CI or headless Linux containers (e.g. GitHub Actions, Docker):
- Playwright and Chromium are pre-configured in `scripts/browser-smoke.mjs`.
- If running under Linux without an active X11/Wayland display, use `xvfb-run` or software WebGL emulation (SwiftShader) for headless screenshot and smoke tests:
```bash
xvfb-run --auto-servernum -- node scripts/browser-smoke.mjs
```
