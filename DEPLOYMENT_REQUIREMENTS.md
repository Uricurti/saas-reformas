# Requisitos de Deployment — Compresión de Vídeos

## Resumen
Para que **vídeos > 50MB se compriman correctamente** en servidor (fallback de iOS), necesitas instalar `ffmpeg` en tu entorno de producción.

---

## ¿Por qué es necesario?

El flujo de compresión es:

```
Desktop/Android:
  Vídeo grande → [Comprimir en cliente con ffmpeg.wasm] → Subir comprimido ✅

iOS (Safari):
  Vídeo grande → [Intenta comprimir en cliente] → FALLA (sin SharedArrayBuffer)
              → [Compresión en SERVIDOR con ffmpeg] → Subir comprimido ✅
```

Si vídeo > 50MB y no hay ffmpeg en servidor:
- ❌ Compresión falla
- ❌ Error al usuario
- ❌ Vídeo no se sube

---

## Instalación por plataforma

### En Vercel (Recomendado)
Vercel **INCLUYE ffmpeg** en el runtime Node.js por defecto.

**No necesitas hacer nada** — funciona automáticamente.

Para verificar:
```bash
# En tu función serverless
$ which ffmpeg
> /usr/bin/ffmpeg
```

### En máquina local (desarrollo)

**macOS:**
```bash
brew install ffmpeg
ffmpeg -version  # Verificar
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
ffmpeg -version
```

**Windows:**
Descargar desde: https://ffmpeg.org/download.html

### En Docker (si usas contenedores)

```dockerfile
FROM node:18-alpine

# Instalar ffmpeg
RUN apk add --no-cache ffmpeg

# ... resto de tu Dockerfile
```

### En Railway, Render, Heroku, etc.

Estos servicios generalmente incluyen ffmpeg en su imagen base. Pero puedes forzarlo:

**Railway:**
```yaml
# railway.json
{
  "buildCommand": "npm install && npx tsc",
  "startCommand": "node dist/server.js",
  "enviromentDefaults": {
    "NODE_ENV": "production"
  }
}
```

**Render:**
```
apt-get update && apt-get install -y ffmpeg
```

---

## Verificar si funciona

### En desarrollo

```bash
npm run dev
# Sube un vídeo > 50MB desde un iOS
# Debería ver en logs: "[compress-and-upload] Procesando vídeo..."
```

### En producción (Vercel)

1. Sube un vídeo > 50MB desde iPhone
2. Mira el log de la función:
```
$ vercel logs
> [compress-and-upload] Procesando vídeo: myvideo.mp4 (65.23 MB)
> [compress-and-upload] Comprimiendo myvideo.mp4...
> [compress-and-upload] Compresión exitosa: 65.23 MB → 8.45 MB (87% reducción)
```

Si ves "Compresión exitosa" → ✅ Funciona

---

## Parámetros de compresión

El servidor comprime con estos parámetros (en `/app/api/media/compress-and-upload/route.ts`):

```
Entrada: cualquier formato (MOV, AVI, MKV, MP4, etc.)
Salida: MP4 H.264

Video:
  - Resolución: 720p máximo (scale=-2:720)
  - Codec: H.264 (libx264)
  - Quality (CRF): 28 (0=lossless, 51=lowest)
  - Preset: fast (balanceo velocidad/tamaño)
  - Flags: faststart (permite iniciar reproducción mientras carga)

Audio:
  - Codec: AAC
  - Bitrate: 96 kbps
```

**Resultado típico:**
- iPhone original: 60-100 MB
- Comprimido: 8-15 MB
- Ratio de compresión: 80-90%
- Tiempo: 30-45 segundos por minuto de vídeo

---

## Límites de servidor

### Timeout
- Máximo 30 segundos para comprimir
- Si vídeo tarda más → error timeout
- Solución: el usuario reintenta con clip más corto

### Tamaño máximo
- Sin comprimir: 200 MB (límite del endpoint)
- Si > 200 MB: error directo (usuario debe reducir)

### Archivos temporales
- Se guardan en `/tmp` (se limpian automáticamente)
- Si falla limpieza → manual: `rm /tmp/video_*`

---

## Troubleshooting

### Error: "ffmpeg not found"
**Solución:**
```bash
# En Vercel: se instala automáticamente, no requiere acción
# En local: ejecuta brew install ffmpeg (macOS) o apt-get install ffmpeg (Linux)
# En Docker: añade RUN apk add ffmpeg en Dockerfile
```

### Error: "Compresión agotó timeout (30s)"
**Causas:**
- Vídeo muy largo (> 5 minutos)
- Servidor sobrecargado
- Resolución muy alta (> 1080p)

**Solución:**
- Usuario intenta con clip más corto
- Esperar a que el servidor se desocupe
- Usar dispositivo para pre-comprimir (Kinemaster app)

### Error: "No tiene espacio de disco temporal"
**Solución:**
```bash
# Limpiar /tmp
rm -rf /tmp/video_*

# Hacer espacio (> 500 MB libre en /tmp)
df -h /tmp
```

### Vídeo se sube pero no se reproduce
**Causas:**
- Formato incompatible post-compresión
- Codec no soportado en navegador

**Solución:**
- Usa H.264 + AAC (ya lo hace el servidor)
- Navega directamente a la URL del vídeo para verificar

---

## Performance

### Tiempo estimado de compresión

| Duración | Tamaño Original | Comprimido | Tiempo |
|----------|-----------------|-----------|--------|
| 30s      | 20-30 MB        | 2-3 MB    | 5-8s   |
| 1 min    | 40-60 MB        | 5-8 MB    | 12-18s |
| 2 min    | 80-120 MB       | 10-15 MB  | 25-35s |
| 5 min    | 200+ MB         | 30+ MB    | 60+ s (timeout) |

### Recomendación
- **Clips cortos**: < 2 minutos (entra en timeout)
- **Vídeos más largos**: usuario pre-comprime en dispositivo o desktop

---

## Alternativas si ffmpeg no está disponible

Si por alguna razón ffmpeg no está en el servidor:

### Opción 1: Usar servicio externo (Cloudinary, Mux)
```javascript
// POST /api/media/compress-and-upload enviaría a Cloudinary API
// Pero añade latencia y costo
```

### Opción 2: Forzar compresión en cliente
```javascript
// En subirVideo(), rechazar vídeos > 40 MB sin comprimir
// El usuario debe usar otro dispositivo o pre-comprimir
```

### Opción 3: Cola asincrónica (mejor para producción)
```javascript
// POST /api/media/queue-video devuelve job_id
// Vídeo se comprime en background worker
// Usuario espera notificación cuando esté listo
```

---

## Verificación post-deployment

Después de deployar en Vercel:

```bash
# 1. Ver logs de Vercel
vercel logs --follow

# 2. Probar desde iPhone con vídeo 50+ MB
# 3. Verificar respuesta del endpoint
curl -X POST https://tuapp.vercel.app/api/media/compress-and-upload \
  -F "video=@test.mp4" \
  -F "tenantId=..." \
  -F "obraId=..." \
  -F "userId=..."

# 4. Si ves JSON con "url": "..." → ✅ Funciona
```

---

**Última actualización**: 2026-04-17  
**Responsable**: Sistema de upload de vídeos  
**Status**: ✅ Funcional en Vercel
