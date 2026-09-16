# Troubleshooting & Diagnostics

This guide covers common issues, diagnostic steps, and resolutions for Helios Observatory.

---

## 1. WebGL & Graphics Diagnostics

### Symptom: Canvas is black or WebGL context is lost
1. **Check WebGL 2.0 Support:**
   Open your browser and navigate to `chrome://gpu` (Chromium) or `about:support` (Firefox). Confirm that "WebGL 2.0" and "Hardware acceleration" are listed as **Hardware accelerated**.
2. **Enable Hardware Acceleration:**
   - Chrome / Edge: Settings → System → Enable "Use graphics acceleration when available".
   - Safari: Settings → Advanced → Develop → Experimental Features → WebGL via Metal.
3. **Out of Memory / Context Loss:**
   If inspecting many high-resolution textures rapidly, the GPU memory may trigger a context loss. Helios automatically disposes textures when unmounted, but refreshing the page (`Cmd+R` / `F5`) restores the WebGL context cleanly.

---

## 2. Dev Server & Port Conflicts

### Symptom: Dev server fails to bind or port 8080 is in use
```bash
# Check what process is listening on 8080
lsof -i :8080

# Kill conflicting process if necessary
kill -9 <PID>

# Restart the dev server
npm run dev
```

### Symptom: Startup script fails
Helios includes an idempotent startup script at `/workspace/startup.sh`:
```bash
sh /workspace/startup.sh
```
The script probes `http://127.0.0.1:8080/` and returns exit code 0 when healthy.

---

## 3. Build & Test Failures

### Symptom: Typecheck errors
Run the isolated TypeScript typechecker:
```bash
npm run typecheck
```
Ensure all custom type definitions in `src/data/types.ts` and `src/data/satellites/schema.ts` match.

### Symptom: ESLint errors with `--max-warnings=0`
Run ESLint in strict zero-warning mode:
```bash
npm run lint
```
Unused imports or variables must be removed or prefixed with `_` to satisfy strict linting.

### Symptom: Test failure in `src/data/satellites/`
If moon catalogue tests fail:
```bash
# Rebuild the satellite catalogue snapshot
node scripts/build-satellite-catalogue.mjs

# Verify the snapshot
node scripts/verify-satellite-catalogue.mjs

# Run tests
npm test
```

---

## 4. Deep Link & URL Parsing Issues

### Symptom: Deep link opens to J2000 instead of requested date
Dates must be within the supported ephemeris domain (`1800-01-01` to `2050-12-31`) in standard ISO 8601 format (`YYYY-MM-DD`). Invalid dates fall back to the default simulation clock rather than throwing an unhandled runtime error.
