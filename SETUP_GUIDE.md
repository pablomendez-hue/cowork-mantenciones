# 🏢 Cowork LABS — Mantenciones
## Guía de Configuración Completa

Esta app usa **Google Sheets como base de datos**. 
Necesitas configurar 3 cosas: la planilla, la API de lectura, y un script de escritura.

---

## Paso 1: Crear el Google Sheet

1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva planilla
2. Renombra la primera hoja (pestaña) a: **Tickets**
3. En la fila 1, pon estos encabezados exactamente así:

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | category | desc | sede | priority | stage | by | date | provider | amount | payment | closedAt | comments |

4. Guarda. Copia el ID del sheet desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_TU_ID/edit
   ```

---

## Paso 2: Configurar Google Cloud (para LEER datos)

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un proyecto nuevo (ej: "cowork-mantenciones")
3. En el menú lateral: **APIs y servicios → Biblioteca**
4. Busca **"Google Sheets API"** y habilítala
5. Ve a **APIs y servicios → Credenciales**
6. Click **"Crear credenciales" → Clave de API**
7. Copia la API Key generada
8. (Opcional pero recomendado) Restringe la key:
   - Click en la key → Restricciones de API
   - Selecciona "Restringir clave" → Google Sheets API
   - En restricciones de sitio web, agrega tu dominio de Vercel

> 💡 Esta API Key es solo para LEER datos. Es segura para el frontend.

---

## Paso 3: Crear el Apps Script (para ESCRIBIR datos)

Esto es necesario porque la API de Sheets requiere OAuth para escribir,
pero con Apps Script podemos evitarlo.

1. Abre tu Google Sheet
2. Ve a **Extensiones → Apps Script**
3. Borra todo el código y pega esto:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Tickets");
    
    if (data.action === "create") {
      sheet.appendRow(data.row);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, action: "create" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === "update") {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          // Update the row (columns A through M)
          for (var j = 0; j < data.row.length; j++) {
            sheet.getRange(i + 1, j + 1).setValue(data.row[j]);
          }
          return ContentService.createTextOutput(
            JSON.stringify({ success: true, action: "update", row: i + 1 })
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "ID not found" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === "delete") {
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.id)) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(
            JSON.stringify({ success: true, action: "delete" })
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: "Unknown action" })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Required for CORS
function doGet(e) {
  return ContentService.createTextOutput("Cowork Mantenciones API is running");
}
```

4. Guarda el proyecto (Ctrl+S)
5. Click **Implementar → Nueva implementación**
6. Tipo: **App web**
7. Configuración:
   - Ejecutar como: **Yo (tu email)**
   - Quién tiene acceso: **Cualquier persona**
8. Click **Implementar**
9. Copia la URL que te da (es tu APPS_SCRIPT_URL)

> ⚠️ Cada vez que cambies el código del script, debes hacer una NUEVA implementación.

---

## Paso 4: Configurar las variables de entorno

1. Copia `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Llena los valores:
   ```
   VITE_GOOGLE_API_KEY=AIzaSyB...tu-api-key
   VITE_GOOGLE_SHEET_ID=1ABC...tu-sheet-id
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
   ```

---

## Paso 5: Ejecutar en local

```bash
npm install
npm run dev
```

La app arrancará en `http://localhost:5173`

Si las credenciales son correctas, verás el indicador **verde "Google Sheets"** en la barra superior.
Si no, verás **amarillo "Demo"** y funcionará con datos de ejemplo.

---

## Paso 6: Desplegar en Vercel (gratis)

1. Sube el proyecto a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/cowork-mantenciones.git
   git push -u origin main
   ```

2. Ve a [vercel.com](https://vercel.com) y conecta tu cuenta de GitHub

3. Importa el repositorio

4. En **Settings → Environment Variables**, agrega las 3 variables:
   - `VITE_GOOGLE_API_KEY`
   - `VITE_GOOGLE_SHEET_ID`
   - `VITE_APPS_SCRIPT_URL`

5. Click **Deploy**

6. Tu app estará en: `https://cowork-mantenciones.vercel.app` (o el nombre que elijas)

---

## Paso 7: Compartir con tu equipo

Simplemente comparte la URL de Vercel. No necesitan instalar nada.
Funciona en celular, tablet y computador.

---

## Cómo funciona

```
┌─────────────┐     Lee datos      ┌──────────────────┐
│   App Web    │ ◄──────────────── │   Google Sheets   │
│  (Vercel)    │                    │   (Tu planilla)   │
│              │ ──────────────── ► │                    │
└─────────────┘   Escribe datos     └──────────────────┘
                  (via Apps Script)
```

- **Lectura**: Directa via Google Sheets API (rápida, ~200ms)
- **Escritura**: Via Apps Script como proxy (toma ~1-2 segundos)
- **Auto-refresh**: La app recarga datos cada 30 segundos
- **Sin conexión**: Funciona en modo Demo con datos de ejemplo

---

## Costos

| Servicio | Costo |
|----------|-------|
| Google Sheets | Gratis |
| Google Cloud (Sheets API) | Gratis hasta 300 req/min |
| Apps Script | Gratis hasta 90 min/día de ejecución |
| Vercel | Gratis (plan hobby) |
| **Total** | **$0/mes** |

---

## Preguntas frecuentes

**¿Puedo seguir viendo los datos en la planilla?**
Sí. Los datos viven en Google Sheets. Puedes abrirla y ver/editar directamente.

**¿Qué pasa si edito la planilla directamente?**
La app recarga datos cada 30 segundos, así que verás los cambios.

**¿Cuántos usuarios soporta?**
Para 5-15 usuarios concurrentes funciona perfecto. Google Sheets aguanta 300 requests/minuto.

**¿Puedo agregar más sedes?**
Sí, edita el archivo `src/constants.js` y agrega las sedes al array SEDES.

**¿Puedo ponerle un dominio propio?**
Sí, en Vercel puedes configurar un dominio custom como `mantenciones.coworklabs.cl`.
