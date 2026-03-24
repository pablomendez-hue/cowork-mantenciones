# Contexto del Proyecto: Cowork Mantenciones

## Descripción
Este proyecto gestiona y automatiza el seguimiento de mantenciones para un cowork.

## Estructura
```
/cowork-mantenciones
  /data        ← Archivos Excel con datos de mantenciones
  /scripts     ← Scripts Python para procesamiento y automatización
  /docs        ← Documentación del proyecto
  context.md   ← Este archivo: contexto clave para Claude
```

## Objetivo
<!-- Describe aquí el objetivo principal del proyecto -->

## Datos
- Fuente: archivos Excel en `/data`
- Formato: <!-- describe columnas clave, estructura del Excel -->

## Scripts
- <!-- lista los scripts y qué hace cada uno -->

## Módulo Inventario (implementado 2026-03-24)

### Archivos nuevos
- `src/inventario_catalog.js` — Catálogo de 372 productos en 18 sedes con `min_stock` calculado del histórico 2025 (avg × 0.4)
- `src/inventario_sheets.js` — CRUD para hoja "Inventario" en Google Sheets (columnas: id, sede, proveedor, producto, fecha, cantidad, tipo, registrado_por)
- `src/Inventario.jsx` — Componente principal con dos vistas:
  - **CM**: registra stock o reposición por productos de su sede, con semáforo de alertas
  - **Admin/Ops**: dashboard con resumen por sede, alertas globales, detalle por sede con mini-gráfico histórico, directorio de asignación CM ↔ sede

### Lógica de semáforo
- 🟢 Verde: cantidad > min_stock
- 🟡 Amarillo: 0 < cantidad ≤ min_stock
- 🔴 Rojo: cantidad = 0
- ⚫ Sin dato: no hay registro

### Asignación de sedes
Se guarda en `localStorage` clave `cw_sede_cm` como `{ "email@co-work.cl": "Sede" }`.
Los admin la gestionan desde Inventario > Directorio.

### Google Sheets
Requiere hoja "Inventario" con cabecera: id | sede | proveedor | producto | fecha | cantidad | tipo | registrado_por
El Apps Script debe soportar `action: "createBatch"` con `{ rows: [[...], [...]] }`.

## Notas para Claude
- Stack: React 18 + Vite, sin UI library, todos los estilos inline
- Backend: Google Sheets + Apps Script (misma URL que tickets)
- Fuente: Sora (texto) + JetBrains Mono (números)
