/**
 * Copia los ficheros WASM de @ffmpeg/core a public/ffmpeg/
 * para que se sirvan desde el mismo origen (evita problemas de CORS/iOS).
 *
 * Se ejecuta automáticamente después de npm install (postinstall)
 * y también antes de next build.
 */
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, "..");

const src  = resolve(root, "node_modules/@ffmpeg/core/dist/esm");
const dest = resolve(root, "public/ffmpeg");

if (!existsSync(src)) {
  console.warn("⚠️  @ffmpeg/core no encontrado en node_modules, saltando copia de WASM");
  process.exit(0);
}

if (!existsSync(dest)) mkdirSync(dest, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(resolve(src, file), resolve(dest, file));
}

console.log("✓ ffmpeg WASM copiado a public/ffmpeg/");
