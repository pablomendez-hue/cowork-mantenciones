import { useState, useEffect, useMemo } from "react";
import { INVENTARIO_CATALOG, INVENTARIO_SEDES } from "./inventario_catalog.js";
import { fetchInventario, saveInventarioRegistro } from "./inventario_sheets.js";
import { USERS, ROLE_LABELS, today } from "./constants.js";

// ── Shared styles ───────────────────────────────────────────────────────────
const F = { fontFamily: "'Sora',sans-serif" };
const I = { appearance: "none", WebkitAppearance: "none", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 11px", fontSize: 12, color: "#1a1a1a", width: "100%", fontFamily: "'Sora',sans-serif", outline: "none", boxSizing: "border-box" };
const BP = { background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Sora',sans-serif", display: "inline-flex", alignItems: "center", gap: 5 };
const BD = { background: "#fff", color: "#525252", border: "1px solid #e5e5e5", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "'Sora',sans-serif" };
const FL = { fontSize: 10, fontWeight: 500, color: "#a3a3a3", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" };
const SL = { fontSize: 9, fontWeight: 600, color: "#b3b3b3", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 };
const ts = (a) => ({ padding: "6px 14px", fontSize: 11, fontWeight: 500, cursor: "pointer", borderRadius: 6, border: "none", fontFamily: "'Sora',sans-serif", background: a ? "#1a1a1a" : "#fff", color: a ? "#fff" : "#737373" });

// ── localStorage helpers ─────────────────────────────────────────────────────
function getSedeCMMap() { try { return JSON.parse(localStorage.getItem("cw_sede_cm") || "{}"); } catch { return {}; } }
function setSedeCMMap(m) { localStorage.setItem("cw_sede_cm", JSON.stringify(m)); }
function getCMSede(email) { return getSedeCMMap()[email.toLowerCase()] || null; }

function getCachedInventario() { try { return JSON.parse(localStorage.getItem("cw_inv_cache") || "[]"); } catch { return []; } }
function setCachedInventario(d) { localStorage.setItem("cw_inv_cache", JSON.stringify(d)); }

// ── Semáforo ─────────────────────────────────────────────────────────────────
function getAlertLevel(cantidad, min_stock) {
  if (cantidad == null) return "sin_dato";
  if (cantidad <= 0) return "rojo";
  if (cantidad <= min_stock) return "amarillo";
  return "verde";
}
const ALERT_COLORS = { verde: "#22c55e", amarillo: "#f59e0b", rojo: "#ef4444", sin_dato: "#d4d4d4" };
const ALERT_BG = { verde: "#f0fdf4", amarillo: "#fffbeb", rojo: "#fef2f2", sin_dato: "#fafafa" };

function Dot({ level, size = 8 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 99, background: ALERT_COLORS[level], flexShrink: 0 }} />;
}

// ── Last stock helper ────────────────────────────────────────────────────────
function getLastStock(records, sede, proveedor, producto) {
  const matches = records
    .filter(r => r.sede === sede && r.proveedor === proveedor && r.producto === producto && r.tipo === "stock")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return matches[0] || null;
}

function getLastReposicion(records, sede, proveedor, producto) {
  const matches = records
    .filter(r => r.sede === sede && r.proveedor === proveedor && r.producto === producto && r.tipo === "reposicion")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return matches[0] || null;
}

// ── Format date ──────────────────────────────────────────────────────────────
function fdate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}
function daysAgo(d) {
  if (!d) return null;
  return Math.floor((new Date() - new Date(d + "T12:00:00")) / 86400000);
}

// ── CM VIEW ──────────────────────────────────────────────────────────────────
function InventarioCM({ user, records, onSaved, saving, setSaving, conn }) {
  const sede = getCMSede(user.email);
  const [tipo, setTipo] = useState("stock");
  const [fecha, setFecha] = useState(today());
  const [cantidades, setCantidades] = useState({});
  const [saved, setSaved] = useState(false);
  const [histTab, setHistTab] = useState(false);

  const productos = INVENTARIO_CATALOG[sede] || [];
  const proveedores = [...new Set(productos.map(p => p.proveedor))].sort();

  const handleCantidad = (key, val) => {
    const n = val === "" ? "" : parseFloat(val);
    setCantidades(prev => ({ ...prev, [key]: n }));
  };

  const handleGuardar = async () => {
    const entries = Object.entries(cantidades).filter(([, v]) => v !== "" && v !== null && !isNaN(v));
    if (!entries.length) return;
    setSaving(true);
    const ts_now = Date.now();
    const newRecords = entries.map(([key, cantidad], i) => {
      const [proveedor, producto] = key.split("|||");
      return { id: String(ts_now + i), sede, proveedor, producto, fecha, cantidad: Number(cantidad), tipo, registrado_por: user.name };
    });
    try {
      if (conn) await saveInventarioRegistro(newRecords);
      const updated = [...records, ...newRecords];
      setCachedInventario(updated);
      onSaved(updated);
      setCantidades({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!sede) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#a3a3a3" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
        <div style={{ fontSize: 13, fontWeight: 500 }}>Sin sede asignada</div>
        <div style={{ fontSize: 11, textAlign: "center", maxWidth: 260 }}>Contacta a un administrador para que te asigne una sede en el directorio.</div>
      </div>
    );
  }

  const filled = Object.values(cantidades).filter(v => v !== "" && v !== null && !isNaN(v)).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{sede}</div>
          <div style={{ fontSize: 11, color: "#a3a3a3", marginTop: 2 }}>Registro de inventario</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setHistTab(false)} style={ts(!histTab)}>Registrar</button>
          <button onClick={() => setHistTab(true)} style={ts(histTab)}>Historial</button>
        </div>
      </div>

      {histTab ? (
        <HistorialSede sede={sede} records={records} />
      ) : (
        <>
          {/* Tipo + Fecha */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={FL}>Tipo de registro</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[["stock", "Stock Actual"], ["reposicion", "Reposición / Compra"]].map(([v, l]) => (
                  <button key={v} onClick={() => setTipo(v)} style={{ ...ts(tipo === v), border: "1px solid " + (tipo === v ? "#1a1a1a" : "#e5e5e5"), borderRadius: 7, padding: "8px 14px" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ width: 160 }}>
              <label style={FL}>Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={I} />
            </div>
          </div>

          {tipo === "stock" && (
            <div style={{ background: "#fffbeb", border: "1px solid #fef08a", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#92400e", marginBottom: 16 }}>
              Ingresa el stock que <strong>existe actualmente</strong> en la sede para cada producto.
            </div>
          )}
          {tipo === "reposicion" && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 14px", fontSize: 11, color: "#1e40af", marginBottom: 16 }}>
              Ingresa la cantidad <strong>que se recibió</strong> en esta compra/reposición.
            </div>
          )}

          {/* Products grouped by proveedor */}
          {proveedores.map(prov => {
            const prods = productos.filter(p => p.proveedor === prov);
            return (
              <div key={prov} style={{ marginBottom: 20 }}>
                <div style={{ ...SL, marginBottom: 8 }}>{prov}</div>
                <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
                  {prods.map((p, idx) => {
                    const key = `${p.proveedor}|||${p.producto}`;
                    const last = getLastStock(records, sede, p.proveedor, p.producto);
                    const level = getAlertLevel(last?.cantidad ?? null, p.min_stock);
                    const val = cantidades[key] ?? "";
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: idx < prods.length - 1 ? "1px solid #f5f5f5" : "none", background: val !== "" ? "#fafffe" : "transparent" }}>
                        <Dot level={level} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{p.producto}</div>
                          <div style={{ fontSize: 10, color: "#a3a3a3", marginTop: 1 }}>
                            Mín: {p.min_stock}
                            {last && <span style={{ marginLeft: 8 }}>· Último: <strong style={{ color: ALERT_COLORS[level] }}>{last.cantidad}</strong> <span style={{ color: "#c4c4c4" }}>({fdate(last.fecha)})</span></span>}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={val}
                          onChange={e => handleCantidad(key, e.target.value)}
                          placeholder="—"
                          style={{ ...I, width: 90, textAlign: "center" }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Save button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingBottom: 32 }}>
            {saved && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#16a34a" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Registrado correctamente
            </div>}
            <button onClick={handleGuardar} disabled={!filled || saving} style={{ ...BP, opacity: filled && !saving ? 1 : 0.35 }}>
              {saving ? "Guardando..." : `Guardar ${filled > 0 ? `(${filled})` : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Historial de una sede ─────────────────────────────────────────────────────
function HistorialSede({ sede, records }) {
  const sedeRecords = records.filter(r => r.sede === sede).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const fechas = [...new Set(sedeRecords.map(r => r.fecha))].slice(0, 10);

  if (!sedeRecords.length) {
    return <div style={{ textAlign: "center", color: "#d4d4d4", fontSize: 12, padding: 32 }}>Sin registros aún</div>;
  }

  return (
    <div>
      {fechas.map(fecha => {
        const dayRecords = sedeRecords.filter(r => r.fecha === fecha);
        const stocks = dayRecords.filter(r => r.tipo === "stock");
        const repos = dayRecords.filter(r => r.tipo === "reposicion");
        const ago = daysAgo(fecha);
        return (
          <div key={fecha} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{fdate(fecha)}</div>
              <div style={{ fontSize: 10, color: "#a3a3a3" }}>{ago === 0 ? "hoy" : `hace ${ago}d`}</div>
              {stocks.length > 0 && <span style={{ fontSize: 9, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>Stock</span>}
              {repos.length > 0 && <span style={{ fontSize: 9, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>Reposición</span>}
              <div style={{ fontSize: 10, color: "#c4c4c4" }}>por {dayRecords[0]?.registrado_por}</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, overflow: "hidden" }}>
              {dayRecords.map((r, i) => {
                const cat = INVENTARIO_CATALOG[sede] || [];
                const meta = cat.find(p => p.proveedor === r.proveedor && p.producto === r.producto);
                const level = meta ? getAlertLevel(r.cantidad, meta.min_stock) : "sin_dato";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: i < dayRecords.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                    <Dot level={level} size={6} />
                    <div style={{ flex: 1, fontSize: 11, color: "#525252" }}>{r.producto}</div>
                    <div style={{ fontSize: 10, color: "#a3a3a3" }}>{r.proveedor}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: r.tipo === "reposicion" ? "#3b82f6" : "#1a1a1a" }}>
                      {r.tipo === "reposicion" ? "+" : ""}{r.cantidad ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN VIEW ────────────────────────────────────────────────────────────────
function InventarioAdmin({ user, records, loading }) {
  const [tab, setTab] = useState("resumen");
  const [sedeFiltro, setSedeFiltro] = useState("");

  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "alertas", label: "Alertas" },
    { id: "sede", label: "Por Sede" },
    { id: "directorio", label: "Directorio" },
  ];

  const alertasSedes = useMemo(() => {
    return INVENTARIO_SEDES.map(sede => {
      const prods = INVENTARIO_CATALOG[sede] || [];
      let rojos = 0, amarillos = 0, ok = 0, sinDato = 0;
      prods.forEach(p => {
        const last = getLastStock(records, sede, p.proveedor, p.producto);
        const level = getAlertLevel(last?.cantidad ?? null, p.min_stock);
        if (level === "rojo") rojos++;
        else if (level === "amarillo") amarillos++;
        else if (level === "verde") ok++;
        else sinDato++;
      });
      const lastDates = records.filter(r => r.sede === sede && r.tipo === "stock").map(r => r.fecha).sort().reverse();
      const lastDate = lastDates[0] || null;
      return { sede, rojos, amarillos, ok, sinDato, total: prods.length, lastDate };
    });
  }, [records]);

  const totalAlertas = alertasSedes.reduce((s, a) => s + a.rojos + a.amarillos, 0);
  const sedesSinUpdate = alertasSedes.filter(a => !a.lastDate || daysAgo(a.lastDate) > 7).length;
  const sedesHoy = alertasSedes.filter(a => a.lastDate === today()).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { l: "Sedes", v: INVENTARIO_SEDES.length, c: "#1a1a1a" },
          { l: "Registros hoy", v: sedesHoy, c: "#16a34a" },
          { l: "Alertas", v: totalAlertas, c: totalAlertas > 0 ? "#ef4444" : "#22c55e" },
          { l: "Sin update +7d", v: sedesSinUpdate, c: sedesSinUpdate > 0 ? "#f59e0b" : "#22c55e" },
        ].map(s => (
          <div key={s.l} style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: "#a3a3a3", fontWeight: 500, textTransform: "uppercase", marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={ts(tab === t.id)}>{t.label}</button>)}
      </div>

      {tab === "resumen" && <ResumenGrid alertasSedes={alertasSedes} onSelectSede={s => { setSedeFiltro(s); setTab("sede"); }} />}
      {tab === "alertas" && <AlertasView alertasSedes={alertasSedes} records={records} />}
      {tab === "sede" && <SedeDetalleAdmin sede={sedeFiltro} setSede={setSedeFiltro} records={records} />}
      {tab === "directorio" && <DirectorioCM />}
    </div>
  );
}

function ResumenGrid({ alertasSedes, onSelectSede }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
      {alertasSedes.map(a => {
        const ago = a.lastDate ? daysAgo(a.lastDate) : null;
        const stale = ago == null || ago > 7;
        return (
          <div key={a.sede} onClick={() => onSelectSede(a.sede)} style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "box-shadow 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.06)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a.sede}</div>
              {stale && <span style={{ fontSize: 9, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>
                {ago == null ? "Sin registro" : `Hace ${ago}d`}
              </span>}
              {!stale && <span style={{ fontSize: 9, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>
                {ago === 0 ? "Hoy" : `Hace ${ago}d`}
              </span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {a.rojos > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot level="rojo" /><span style={{ fontSize: 11, fontWeight: 600, color: "#ef4444" }}>{a.rojos}</span></div>}
              {a.amarillos > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot level="amarillo" /><span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>{a.amarillos}</span></div>}
              {a.ok > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot level="verde" /><span style={{ fontSize: 11, color: "#a3a3a3" }}>{a.ok}</span></div>}
              {a.sinDato > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Dot level="sin_dato" /><span style={{ fontSize: 11, color: "#d4d4d4" }}>{a.sinDato}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertasView({ alertasSedes, records }) {
  const alertas = useMemo(() => {
    const list = [];
    INVENTARIO_SEDES.forEach(sede => {
      const prods = INVENTARIO_CATALOG[sede] || [];
      prods.forEach(p => {
        const last = getLastStock(records, sede, p.proveedor, p.producto);
        const level = getAlertLevel(last?.cantidad ?? null, p.min_stock);
        if (level === "rojo" || level === "amarillo") {
          list.push({ sede, ...p, cantidad: last?.cantidad ?? null, fecha: last?.fecha ?? null, level });
        }
      });
    });
    return list.sort((a, b) => {
      if (a.level !== b.level) return a.level === "rojo" ? -1 : 1;
      return a.sede.localeCompare(b.sede);
    });
  }, [records]);

  if (!alertas.length) {
    return <div style={{ textAlign: "center", color: "#a3a3a3", fontSize: 12, padding: 40 }}>Sin alertas activas</div>;
  }

  return (
    <div>
      <div style={{ ...SL, marginBottom: 12 }}>{alertas.length} productos requieren atención</div>
      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
        {alertas.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < alertas.length - 1 ? "1px solid #f5f5f5" : "none", background: ALERT_BG[a.level] }}>
            <Dot level={a.level} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{a.producto}</div>
              <div style={{ fontSize: 10, color: "#a3a3a3" }}>{a.sede} · {a.proveedor}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: ALERT_COLORS[a.level] }}>
                {a.cantidad ?? "—"}
              </div>
              <div style={{ fontSize: 9, color: "#c4c4c4" }}>mín {a.min_stock} · {a.fecha ? fdate(a.fecha) : "sin dato"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SedeDetalleAdmin({ sede, setSede, records }) {
  const [filtProv, setFiltProv] = useState("");
  const selSede = sede || INVENTARIO_SEDES[0];

  const prods = INVENTARIO_CATALOG[selSede] || [];
  const proveedores = [...new Set(prods.map(p => p.proveedor))].sort();
  const filtrados = filtProv ? prods.filter(p => p.proveedor === filtProv) : prods;

  const sedeRecords = records.filter(r => r.sede === selSede);
  const lastUpdate = sedeRecords.filter(r => r.tipo === "stock").sort((a, b) => b.fecha.localeCompare(a.fecha))[0];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={FL}>Sede</label>
          <select value={selSede} onChange={e => { setSede(e.target.value); setFiltProv(""); }} style={{ ...I, cursor: "pointer" }}>
            {INVENTARIO_SEDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FL}>Proveedor</label>
          <select value={filtProv} onChange={e => setFiltProv(e.target.value)} style={{ ...I, cursor: "pointer" }}>
            <option value="">Todos</option>
            {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {lastUpdate && (
          <div style={{ fontSize: 11, color: "#a3a3a3", paddingBottom: 9 }}>
            Último: {fdate(lastUpdate.fecha)} por {lastUpdate.registrado_por}
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
        {filtrados.map((p, i) => {
          const last = getLastStock(records, selSede, p.proveedor, p.producto);
          const lastRep = getLastReposicion(records, selSede, p.proveedor, p.producto);
          const level = getAlertLevel(last?.cantidad ?? null, p.min_stock);
          const hist = records
            .filter(r => r.sede === selSede && r.proveedor === p.proveedor && r.producto === p.producto && r.tipo === "stock")
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .slice(-8);
          const maxQ = Math.max(...hist.map(r => r.cantidad ?? 0), p.min_stock * 2, 1);

          return (
            <div key={i} style={{ padding: "12px 16px", borderBottom: i < filtrados.length - 1 ? "1px solid #f5f5f5" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: hist.length > 0 ? 8 : 0 }}>
                <Dot level={level} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{p.producto}</div>
                  <div style={{ fontSize: 10, color: "#a3a3a3" }}>
                    {p.proveedor} · mín {p.min_stock}
                    {lastRep && <span style={{ marginLeft: 8, color: "#3b82f6" }}>+{lastRep.cantidad} reposición {fdate(lastRep.fecha)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: ALERT_COLORS[level] }}>
                    {last?.cantidad ?? "—"}
                  </div>
                  {last && <div style={{ fontSize: 9, color: "#c4c4c4" }}>{fdate(last.fecha)}</div>}
                </div>
              </div>
              {hist.length > 1 && (
                <MiniChart data={hist} minStock={p.min_stock} maxQ={maxQ} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniChart({ data, minStock, maxQ }) {
  const w = 200, h = 32, pad = 4;
  const xStep = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const yScale = (v) => h - pad - ((v ?? 0) / maxQ) * (h - pad * 2);
  const minY = h - pad - (minStock / maxQ) * (h - pad * 2);

  const points = data.map((r, i) => ({ x: pad + i * xStep, y: yScale(r.cantidad ?? 0), v: r.cantidad }));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <line x1={pad} y1={minY} x2={w - pad} y2={minY} stroke="#fde68a" strokeWidth="1" strokeDasharray="3,2" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.y >= minY ? "#f59e0b" : "#3b82f6"} />
      ))}
    </svg>
  );
}

// ── Directorio CM ─────────────────────────────────────────────────────────────
function DirectorioCM() {
  const [map, setMap] = useState(getSedeCMMap());
  const cmUsers = [...USERS].filter(u => u.role === "cm").sort((a, b) => a.name.localeCompare(b.name));
  const allSedes = INVENTARIO_SEDES;

  const handleChange = (email, sede) => {
    const next = { ...map, [email.toLowerCase()]: sede || null };
    setSedeCMMap(next);
    setMap(next);
  };

  return (
    <div>
      <div style={{ ...SL, marginBottom: 12 }}>Asignación de sedes a comerciales ({cmUsers.length})</div>
      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
        {cmUsers.map((u, i) => {
          const asignada = map[u.email.toLowerCase()] || "";
          return (
            <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < cmUsers.length - 1 ? "1px solid #f5f5f5" : "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 99, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#3b82f6", flexShrink: 0 }}>
                {u.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 10, color: "#a3a3a3" }}>{u.email}</div>
              </div>
              <select value={asignada} onChange={e => handleChange(u.email, e.target.value)} style={{ ...I, width: 200, cursor: "pointer" }}>
                <option value="">Sin sede asignada</option>
                {allSedes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function Inventario({ user, conn }) {
  const [records, setRecords] = useState(getCachedInventario());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!conn) return;
    setLoading(true);
    fetchInventario()
      .then(data => { setRecords(data); setCachedInventario(data); })
      .catch(e => setErr("Error cargando inventario"))
      .finally(() => setLoading(false));
  }, [conn]);

  const isAdmin = user.role === "admin" || user.role === "ops";

  if (loading) {
    return <div style={{ ...F, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#a3a3a3", fontSize: 13 }}>Cargando inventario...</div>;
  }

  return (
    <div style={{ ...F, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "8px 16px", fontSize: 11 }}>{err}</div>}
      {isAdmin
        ? <InventarioAdmin user={user} records={records} loading={loading} />
        : <InventarioCM user={user} records={records} onSaved={setRecords} saving={saving} setSaving={setSaving} conn={conn} />
      }
    </div>
  );
}
