# Contexto del Proyecto: Cowork Mantenciones

## ¿Qué es este proyecto?
App web para una empresa de coworking (co-work.cl). Gestiona dos cosas:
1. **Tickets de mantención**: seguimiento de requerimientos, pagos, ejecución y cierre de trabajos en sedes.
2. **Inventario de insumos**: registro y control de stock de productos (aseo, cafetería, papelería) por sede.

Está deployado en **Vercel** y conectado a un repo en **GitHub** (`pablomendez-hue/cowork-mantenciones`). Push a `main` = deploy automático.

---

## Stack técnico
- **React 18 + Vite** — sin UI library, todos los estilos son inline
- **Google Sheets** como base de datos (via Sheets API v4 + Apps Script)
- **Google Apps Script** como "backend" (una URL que recibe POST con `action`)
- **Fuentes**: Sora (texto), JetBrains Mono (números)
- Variables de entorno en `.env`: `VITE_GOOGLE_SHEET_ID`, `VITE_GOOGLE_API_KEY`, `VITE_APPS_SCRIPT_URL`

---

## Estructura de archivos clave

```
src/
  App.jsx                  ← Login + navegación principal (Tickets / Inventario)
  constants.js             ← USERS, SEDES, CATEGORIES, roles, etc.
  sheets.js                ← CRUD para hoja "Tickets"
  config_sheets.js         ← CRUD para hoja "Config" (sede_cm, user_extra, breakeven, prod_cat, prod_global)
  inventario_sheets.js     ← CRUD para hoja "Inventario"
  inventario_catalog.js    ← Catálogo de productos por sede + INVENTARIO_SEDES
  inventario_history.js    ← Datos históricos del Excel importado (INVENTARIO_EXCEL_LATEST, INVENTARIO_EXCEL_TREND)
  Inventario.jsx           ← Módulo completo de inventario (~1100 líneas)
  InventarioStats.jsx      ← Estadísticas de inventario
```

---

## Google Sheets — hojas y estructura

### Hoja "Tickets"
`id | num | category | desc | sede | priority | stage | by | date | provider | amount | payment | closedAt | execDate | comments(JSON) | assignee`

### Hoja "Inventario"
`id | sede | proveedor | producto | fecha | cantidad | tipo | registrado_por`

### Hoja "Config"
`tipo | clave | valor | updated_at`

Tipos usados en Config:
| tipo | clave | valor | para qué |
|---|---|---|---|
| `sede_cm` | email | nombre sede | asigna sede a usuario CM |
| `user_extra` | email | JSON `{name,role}` | usuarios agregados desde UI |
| `user_role` | email | rol | override de rol a usuario base |
| `prod_cat` | nombre producto | categoría | override de categoría de producto |
| `breakeven` | `"Sede\|\|Producto"` | número | punto de equilibrio manual por sede/producto |
| `prod_global` | nombre producto | JSON `{categoria,proveedor,min_stock}` | insumo creado desde UI |

---

## Sistema de roles

| Rol | Acceso |
|---|---|
| `admin` | Todo: vista admin de inventario (Resumen, Registrar, Historial, Directorio), tickets, config |
| `ops` | Igual que admin en inventario; acceso a tickets |
| `cm` | Solo su sede asignada: registrar stock, ver historial propio |

El login es por **email únicamente** (sin contraseña). Se valida contra `USERS` en `constants.js` + extras en Config sheet.

### Usuarios admin actuales (constants.js)
- Ana Rondon — ana@co-work.cl
- Vito Lacasella — vito@co-work.cl
- Emilia Jorges — emilia@co-work.cl
- Maria Fernanda — maria.fernanda@co-work.cl
- Pablo Mendez — pablo.mendez@coworklatam.com
- Sebastian O'ryan — sebastian.oryan@co-work.cl
- Maria Jesus Ubilla — jesus.ubilla@co-work.cl ← cambiada de ops a admin (2026-04-02)

### Usuarios ops actuales
- Luis Morales — luis.morales@co-work.cl
- Osaris Gomez — osaris@co-work.cl
- María Ubilla — maria.p@co-work.cl
- Jose Diaz — jose.diaz@co-work.cl
- Carlos Sanchez — carlos.sanchez@co-work.cl

---

## Módulo Inventario — arquitectura

### Componentes principales en Inventario.jsx

```
Inventario (root)
  ├── carga fetchInventario() + fetchConfig() al montar
  ├── estado: records, catOverrides, breakevenMap
  ├── InventarioAdmin (role: admin | ops)
  │   ├── tabs: Resumen | Registrar | Historial | Directorio
  │   ├── MatrixTable        ← tabla de productos × sedes con semáforo
  │   ├── SedePanel          ← panel lateral al hacer clic en sede
  │   ├── FormRegistro       ← ingresa stock por sede
  │   ├── HistorialSede      ← ver y editar registros pasados (con botón editar por fila)
  │   └── DirectorioCM       ← gestión de CMs y categorías de insumos
  └── InventarioCM (role: cm)
      ├── tab: Registrar → FormRegistro (solo su sede)
      └── tab: Historial → HistorialSede (solo su sede)
```

### Semáforo de stock
- 🔴 Rojo: cantidad = 0
- 🟡 Amarillo: 0 < cantidad ≤ min_stock
- 🟢 Verde: cantidad > min_stock
- ⚫ Sin dato: no hay registro

### Punto de equilibrio (breakeven)
- Se muestra en la columna "Gráfico · P. Equilibrio" de FormRegistro
- **Solo admin/ops pueden editarlo** (clic en el número, input inline)
- Se guarda en Config sheet: `tipo:"breakeven"`, `clave:"Sede||Producto"`, `valor:"5"`
- Si no hay valor manual, se muestra la mediana calculada del historial (en gris)
- Si hay valor manual, se muestra en morado con etiqueta "p.e."

### Categorías de productos (catOverrides)
- Las categorías base vienen de `inventario_catalog.js`
- Hay un mapa de correcciones hardcodeado `CAT_FIX` en Inventario.jsx
- Los overrides editados desde UI se guardan en Config sheet: `tipo:"prod_cat"`
- Se editan desde Directorio → tab "Insumos"

---

## Sedes activas en INVENTARIO_SEDES (24 total)
Abedules, Alto el Golf, Apoquindo, Cerro el Plomo, **Chery**, **Coldwell**, Florida Center, Isidora, Kennedy, **Liquidos**, **Londres 43 - PPD**, Los Militares - NACE, Manuel Montt, Nido 9, Neohaus, Nueva Las Condes, Plaza Egaña, **S2GO**, **Salesforce**, Santa Lucia, Santa Rosa, Suecia, Tobalaba-P3, Vespucio

*(Las 6 en negrita fueron agregadas en abril 2026 y tienen catálogo vacío — los CMs las pueblan desde el formulario)*

---

## Directorio (admin only)

### Sub-tab "Comerciales"
- Asigna qué sede le corresponde a cada usuario CM
- Guarda en Config sheet: `tipo:"sede_cm"`
- Se sincroniza en todos los dispositivos

### Sub-tab "Insumos"
- Lista todos los productos con su categoría actual
- Permite cambiar la categoría (Aseo / Cafetería / Papelería) → guarda en `prod_cat`
- Badge "editado" si el producto tiene override
- **Botón "Crear nuevo insumo"** al final: nombre + categoría + mín → guarda en `prod_global` + `prod_cat`

---

## FormRegistro — comportamiento

- Solo muestra tipo "Stock" (se eliminó "Reposición")
- Fecha: input date libre (se puede registrar para cualquier fecha pasada)
- Para sedes sin productos: muestra botón "Agregar primer producto de X" por categoría
- Para sedes con productos: muestra tabla con historial de 12 entradas + columna de ingreso + sparkline
- Botón "Agregar producto" al final de cada categoría para añadir nuevos productos de otras sedes

---

## HistorialSede — edición de registros

- Disponible en: InventarioCM (tab Historial, solo su sede) + InventarioAdmin (tab Historial, cualquier sede)
- **Todos los roles** pueden editar fecha y cantidad de cualquier registro
- Botón "editar" por fila → inputs inline para fecha y cantidad → botón OK
- Llama a `updateInventarioRecord` → Apps Script action `"update"`

---

## Apps Script — acciones soportadas (verificar si están implementadas)

El Apps Script recibe POST con `{ action, ... }`. Acciones usadas desde el frontend:

| action | sheet | para qué |
|---|---|---|
| `create` | Tickets | crea ticket |
| `update` | Tickets | actualiza ticket |
| `delete` | Tickets | elimina ticket |
| `notify` | — | envía email |
| `createBatch` | Inventario | crea múltiples filas |
| `update` | Inventario | actualiza una fila por id |
| `delete` | Inventario | elimina fila por id |
| `upsertConfig` | Config | busca por tipo+clave, actualiza o inserta |

⚠️ **`upsertConfig` debe estar implementada en el Apps Script** para que funcionen: asignación de sedes CM, punto de equilibrio, categorías de productos y creación de nuevos insumos. Si algo no persiste en Sheets, revisar que esta acción esté en el script.

---

## Historial de cambios recientes (sesión 2026-03-24 / 2026-04-01 / 2026-04-02)

| Fecha | Cambio |
|---|---|
| 2026-03-24 | Módulo inventario implementado desde cero |
| 2026-04-01 | Directorio → tab Insumos con gestión de categorías |
| 2026-04-01 | Punto de equilibrio manual por sede/producto (admin/ops) |
| 2026-04-01 | Root Inventario carga config desde Sheets al montar |
| 2026-04-02 | 6 nuevas sedes agregadas (vacías) |
| 2026-04-02 | Fix Florida Center "Invalid Date" (fechas no-ISO en historial Excel) |
| 2026-04-02 | Eliminado botón Reposición — solo Stock |
| 2026-04-02 | HistorialSede: botón "editar" por fila (todos los roles) |
| 2026-04-02 | Directorio scroll habilitado |
| 2026-04-02 | Botón "Crear nuevo insumo" en Directorio → Insumos |
| 2026-04-02 | Fix sedes vacías: ahora muestran "Agregar primer producto" |
| 2026-04-02 | María Jesús Ubilla: ops → admin |
| 2026-04-02 | Tab "Historial" agregado a vista InventarioAdmin |

---

## Pendientes / cosas a revisar

- [ ] Verificar que `upsertConfig` está implementada en el Apps Script de Google
- [ ] Los productos creados con "Crear nuevo insumo" se guardan en Config (`prod_global`) pero aún **no aparecen automáticamente** en `getAllProductsGrouped` ni en el dropdown de "Agregar producto" — si el usuario pide esto, hay que leer `prod_global` desde config en el root y pasarlo como prop
- [ ] Las sedes nuevas (Chery, Coldwell, etc.) tienen catálogo vacío en código — los productos que agreguen los CMs se guardan en `localStorage` (`cw_extra_prods`), no en Sheets — si se quiere persistencia cross-device habría que migrar eso
- [ ] No hay contraseñas — solo validación por email. Si se quiere más seguridad, hay que agregar autenticación real

---

## Notas de estilo para Claude

- **Todos los estilos son inline** — nunca usar CSS classes
- No usar TypeScript ni agregar tipos
- No agregar comentarios salvo los headers de sección que ya existen (`// ══════...`)
- Las constantes de estilo reutilizables ya están definidas: `I` (input), `BP` (button primary), `FL` (field label)
- Evitar crear abstracciones nuevas — si algo se usa una sola vez, escribirlo inline
- Deploy: siempre terminar con `git add ... && git commit && git push origin main`
