#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const MANIFEST_PATH = path.join(PUBLIC_DIR, "assets", "manifest.json");

export function validateAssetManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Asset manifest not found at ${MANIFEST_PATH}`);
  }

  const raw = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = JSON.parse(raw);

  if (!manifest.assets || !Array.isArray(manifest.assets)) {
    throw new Error("Manifest must contain an 'assets' array");
  }

  const errors = [];
  const registeredPaths = new Set();

  for (const asset of manifest.assets) {
    if (!asset.id || typeof asset.id !== "string") {
      errors.push(`Asset missing string id: ${JSON.stringify(asset)}`);
      continue;
    }
    if (!asset.path || typeof asset.path !== "string") {
      errors.push(`Asset ${asset.id} missing relative path`);
      continue;
    }

    registeredPaths.add(asset.path);
    const fullPath = path.join(PUBLIC_DIR, asset.path);

    if (!fs.existsSync(fullPath)) {
      errors.push(`Asset ${asset.id} file not found on disk: ${asset.path}`);
      continue;
    }

    if (asset.format === "svg") {
      const content = fs.readFileSync(fullPath, "utf-8");

      // Check valid SVG root
      if (!content.includes("<svg") || !content.includes("</svg>")) {
        errors.push(`SVG asset ${asset.id} lacks valid root <svg> tags`);
      }

      // Check viewBox
      if (!content.includes("viewBox=")) {
        errors.push(`SVG asset ${asset.id} missing viewBox attribute for responsiveness`);
      }

      // Strict enforcement of zero raster/base64 embedding
      if (
        content.includes("data:image/") ||
        content.includes(";base64,") ||
        content.includes("<image") ||
        content.includes("<feImage")
      ) {
        errors.push(
          `SVG asset ${asset.id} violates pure-vector rule: contains embedded raster data or <image> elements`,
        );
      }

      // Check accessibility
      const hasAria =
        content.includes('role="img"') ||
        content.includes("aria-labelledby=") ||
        content.includes("aria-label=") ||
        content.includes("<title>");
      if (!hasAria) {
        errors.push(`SVG asset ${asset.id} missing accessibility markup (<title> or role="img")`);
      }
    }
  }

  // Scan public/assets directory to ensure no unregistered SVGs
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.isFile() && entry.name.endsWith(".svg")) {
        const rel = path.relative(PUBLIC_DIR, full);
        if (!registeredPaths.has(rel)) {
          errors.push(`Unregistered SVG asset found in public directory: ${rel}`);
        }
      }
    }
  }

  const assetsDir = path.join(PUBLIC_DIR, "assets");
  if (fs.existsSync(assetsDir)) {
    scanDir(assetsDir);
  }

  return {
    valid: errors.length === 0,
    errors,
    assetCount: manifest.assets.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = validateAssetManifest();
    if (!result.valid) {
      console.error("Asset validation failed with errors:");
      for (const err of result.errors) console.error(` - ${err}`);
      process.exit(1);
    }
    console.log(`Asset manifest and ${result.assetCount} vector assets verified successfully.`);
  } catch (err) {
    console.error(`Fatal error in asset validation: ${err.message}`);
    process.exit(1);
  }
}
