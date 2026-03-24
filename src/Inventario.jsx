import { useState, useEffect, useMemo } from "react";
import { INVENTARIO_CATALOG, INVENTARIO_SEDES } from "./inventario_catalog.js";
import { INVENTARIO_EXCEL_LATEST } from "./inventario_history.js";
import { fetchInventario, saveInventarioRegistro } from "./inventario_sheets.js";
import { USERS, today } from "./constants.js";

// ── Shared styles ────────────────────────────────────────────────────────────
const I = { appearance:"none", WebkitAppearance:"none", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 11px", fontSize:12, color:"#1a1a1a", width:"100%", fontFamily:"'Sora',sans-serif", outline:"none", boxSizing:"border-box" };
const BP = { background:"#1a1a1a", color:"#fff", border:"none", borderRadius:7, padding:"8px 16px", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"'Sora',sans-serif", display:"inline-flex", alignItems:"center", gap:5 };
const FL = { fontSize:10, fontWeight:500, color:"#a3a3a3", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" };

// ── localStorage ─────────────────────────────────────────────────────────────
function getSedeCMMap() { try { return JSON.parse(localStorage.getItem("cw_sede_cm")||"{}"); } catch { return {}; } }
function setSedeCMMap(m) { localStorage.setItem("cw_sede_cm", JSON.stringify(m)); }
function getCMSede(email) { return getSedeCMMap()[email.toLowerCase()]||null; }
function getCached() { try { return JSON.parse(localStorage.getItem("cw_inv_cache")||"[]"); } catch { return []; } }
function setCached(d) { localStorage.setItem("cw_inv_cache", JSON.stringify(d)); }

// ── Helpers ──────────────────────────────────────────────────────────────────
function fdate(d) {
  if (!d) return "—";
  const dt = new Date(d+"T12:00:00");
  return dt.toLocaleDateString("es-CL", { day:"2-digit", month:"short" });
}
function daysAgo(d) {
  if (!d) return null;
  return Math.floor((new Date() - new Date(d+"T12:00:00")) / 86400000);
}

// Merge Excel history + live records → latest value per key
function buildLatestMap(liveRecords) {
  // Start with Excel data
  const map = {};
  for (const [key, val] of Object.entries(INVENTARIO_EXCEL_LATEST)) {
    map[key] = val; // { fecha, cantidad }
  }
  // Override with live data if newer
  for (const r of liveRecords) {
    if (r.tipo !== "stock") continue;
    const key = `${r.sede}||${r.proveedor}||${r.producto}`;
    if (!map[key] || r.fecha >= map[key].fecha) {
      map[key] = { fecha: r.fecha, cantidad: r.cantidad };
    }
  }
  return map;
}

// ── Semáforo ─────────────────────────────────────────────────────────────────
function getLevel(cantidad, min_stock) {
  if (cantidad == null) return "nd";
  if (cantidad <= 0) return "rojo";
  if (cantidad <= min_stock) return "amarillo";
  return "ok";
}
const CELL_STYLE = {
  rojo:     { background:"#fef2f2", color:"#dc2626", fontWeight:700 },
  amarillo: { background:"#fffbeb", color:"#b45309", fontWeight:600 },
  ok:       { background:"transparent", color:"#525252", fontWeight:400 },
  nd:       { background:"transparent", color:"#d4d4d4", fontWeight:400 },
};

// ── All unique products across catalog ────────────────────────────────────────
function getAllProducts() {
  const seen = new Set();
  const list = [];
  for (const prods of Object.values(INVENTARIO_CATALOG)) {
    for (const p of prods) {
      const key = `${p.proveedor}||${p.producto}`;
      if (!seen.has(key)) { seen.add(key); list.push({ proveedor: p.proveedor, producto: p.producto }); }
    }
  }
  return list.sort((a,b) => a.proveedor.localeCompare(b.proveedor)||a.producto.localeCompare(b.producto));
}

function getMinStock(sede, proveedor, producto) {
  const prods = INVENTARIO_CATALOG[sede] || [];
  return prods.find(p => p.proveedor===proveedor && p.producto===producto)?.min_stock ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// MATRIX TABLE (admin / ops)
// ══════════════════════════════════════════════════════════════════════════════
function MatrixTable({ latestMap, filtProv }) {
  const allProds = useMemo(() => getAllProducts(), []);
  const filtered = filtProv ? allProds.filter(p => p.proveedor === filtProv) : allProds;
  const sedes = INVENTARIO_SEDES;

  // Group by proveedor for section headers
  const groups = useMemo(() => {
    const g = {};
    for (const p of filtered) {
      if (!g[p.proveedor]) g[p.proveedor] = [];
      g[p.proveedor].push(p.producto);
    }
    return g;
  }, [filtered]);

  return (
    <div style={{ overflowX:"auto", overflowY:"auto", flex:1 }}>
      <table style={{ borderCollapse:"collapse", fontSize:11, fontFamily:"'Sora',sans-serif", whiteSpace:"nowrap" }}>
        <thead>
          <tr style={{ position:"sticky", top:0, zIndex:10, background:"#fafafa" }}>
            <th style={{ ...TH, position:"sticky", left:0, zIndex:11, background:"#fafafa", width:220, minWidth:220 }}>Insumo</th>
            {sedes.map(s => (
              <th key={s} style={{ ...TH, maxWidth:80, minWidth:70, fontWeight:500, fontSize:9, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                {s.length > 12 ? s.slice(0, 11)+"…" : s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([prov, prods]) => (
            <>
              <tr key={"hdr-"+prov}>
                <td colSpan={sedes.length + 1} style={{ padding:"10px 14px 4px", fontSize:9, fontWeight:700, color:"#a3a3a3", textTransform:"uppercase", letterSpacing:"0.06em", background:"#f8f8f8", borderTop:"1px solid #f0f0f0" }}>
                  {prov}
                </td>
              </tr>
              {prods.map(prod => (
                <tr key={prov+"||"+prod} style={{ borderBottom:"1px solid #f5f5f5" }}
                  onMouseEnter={e => e.currentTarget.style.background="#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                  <td style={{ ...TH, position:"sticky", left:0, background:"inherit", fontWeight:500, fontSize:12, color:"#1a1a1a", paddingLeft:14 }}>
                    {prod}
                  </td>
                  {sedes.map(sede => {
                    const min_stock = getMinStock(sede, prov, prod);
                    // Not in this sede's catalog
                    if (min_stock === null) {
                      return <td key={sede} style={{ ...TD, color:"#ebebeb" }}>·</td>;
                    }
                    const key = `${sede}||${prov}||${prod}`;
                    const entry = latestMap[key];
                    const level = getLevel(entry?.cantidad ?? null, min_stock);
                    const cs = CELL_STYLE[level];
                    return (
                      <td key={sede} style={{ ...TD, ...cs }} title={entry ? `${entry.cantidad} · ${fdate(entry.fecha)}` : "Sin dato"}>
                        {entry?.cantidad ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const TH = { padding:"8px 10px", textAlign:"left", borderBottom:"1px solid #f0f0f0", fontSize:11, color:"#737373", fontWeight:600 };
const TD = { padding:"7px 10px", textAlign:"center", fontSize:12, fontFamily:"'JetBrains Mono',monospace" };

// ── Proveedores únicos ────────────────────────────────────────────────────────
function uniqueProveedores() {
  const s = new Set();
  for (const prods of Object.values(INVENTARIO_CATALOG)) for (const p of prods) s.add(p.proveedor);
  return [...s].sort();
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ══════════════════════════════════════════════════════════════════════════════
function InventarioAdmin({ records }) {
  const [tab, setTab] = useState("resumen");
  const [filtProv, setFiltProv] = useState("");
  const [sedeFiltro, setSedeFiltro] = useState(INVENTARIO_SEDES[0]);

  const latestMap = useMemo(() => buildLatestMap(records), [records]);
  const proveedores = useMemo(() => uniqueProveedores(), []);

  // Alert counts
  const alertas = useMemo(() => {
    let rojo = 0, amarillo = 0;
    for (const [key, entry] of Object.entries(latestMap)) {
      const [sede, prov, prod] = key.split("||");
      const min = getMinStock(sede, prov, prod);
      if (min === null) continue;
      const lv = getLevel(entry.cantidad, min);
      if (lv === "rojo") rojo++;
      else if (lv === "amarillo") amarillo++;
    }
    return { rojo, amarillo };
  }, [latestMap]);

  const navBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding:"6px 14px", fontSize:11, fontWeight:500, cursor:"pointer", borderRadius:6,
      border: tab===id ? "none" : "1px solid #e5e5e5",
      background: tab===id ? "#1a1a1a" : "#fff",
      color: tab===id ? "#fff" : "#737373",
      fontFamily:"'Sora',sans-serif"
    }}>{label}</button>
  );

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      {/* Sub-header */}
      <div style={{ padding:"12px 20px", borderBottom:"1px solid #f0f0f0", display:"flex", alignItems:"center", gap:10, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4 }}>
          {navBtn("resumen","Resumen")}
          {navBtn("registrar","Registrar")}
          {navBtn("directorio","Directorio")}
        </div>
        {tab === "resumen" && (
          <>
            <div style={{ width:1, background:"#e5e5e5", height:20, margin:"0 4px" }}/>
            <select value={filtProv} onChange={e=>setFiltProv(e.target.value)} style={{ ...I, width:160, fontSize:11 }}>
              <option value="">Todos los proveedores</option>
              {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div style={{ marginLeft:"auto", display:"flex", gap:12 }}>
              {alertas.rojo > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                  <span style={{ width:8, height:8, borderRadius:99, background:"#ef4444", display:"inline-block" }}/>
                  <span style={{ fontWeight:700, color:"#dc2626", fontFamily:"'JetBrains Mono',monospace" }}>{alertas.rojo}</span>
                  <span style={{ color:"#a3a3a3" }}>sin stock</span>
                </div>
              )}
              {alertas.amarillo > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                  <span style={{ width:8, height:8, borderRadius:99, background:"#f59e0b", display:"inline-block" }}/>
                  <span style={{ fontWeight:700, color:"#b45309", fontFamily:"'JetBrains Mono',monospace" }}>{alertas.amarillo}</span>
                  <span style={{ color:"#a3a3a3" }}>bajo mínimo</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {tab === "resumen" && <MatrixTable latestMap={latestMap} filtProv={filtProv} />}
      {tab === "registrar" && <RegistrarAdmin records={records} latestMap={latestMap} />}
      {tab === "directorio" && <DirectorioCM />}
    </div>
  );
}

// ── Registrar (admin selecciona sede, igual que CM) ───────────────────────────
function RegistrarAdmin({ records, latestMap }) {
  const [sede, setSede] = useState(INVENTARIO_SEDES[0]);
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
      <div style={{ marginBottom:16 }}>
        <label style={FL}>Sede</label>
        <select value={sede} onChange={e=>setSede(e.target.value)} style={{ ...I, width:220, cursor:"pointer" }}>
          {INVENTARIO_SEDES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <FormRegistro sede={sede} latestMap={latestMap} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE REGISTRO (compartido CM y Admin)
// ══════════════════════════════════════════════════════════════════════════════
function FormRegistro({ sede, latestMap, user, conn, onSaved }) {
  const [tipo, setTipo] = useState("stock");
  const [fecha, setFecha] = useState(today());
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const productos = INVENTARIO_CATALOG[sede] || [];
  const proveedores = [...new Set(productos.map(p=>p.proveedor))].sort();

  const handleGuardar = async () => {
    const entries = Object.entries(cantidades).filter(([,v])=>v!==""&&v!==null&&!isNaN(v));
    if (!entries.length) return;
    setSaving(true);
    const ts_now = Date.now();
    const newRecords = entries.map(([key, cantidad], i) => {
      const [proveedor, producto] = key.split("|||");
      return { id:String(ts_now+i), sede, proveedor, producto, fecha, cantidad:Number(cantidad), tipo, registrado_por: user?.name||"Admin" };
    });
    try {
      if (conn) await saveInventarioRegistro(newRecords);
      const cached = getCached();
      const updated = [...cached, ...newRecords];
      setCached(updated);
      onSaved?.(updated);
      setCantidades({});
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const filled = Object.values(cantidades).filter(v=>v!==""&&v!==null&&!isNaN(v)).length;

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div>
          <label style={FL}>Tipo</label>
          <div style={{ display:"flex", gap:6 }}>
            {[["stock","Stock Actual"],["reposicion","Reposición"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTipo(v)} style={{
                padding:"7px 14px", fontSize:11, fontWeight:500, cursor:"pointer", borderRadius:7,
                border: tipo===v ? "none" : "1px solid #e5e5e5",
                background: tipo===v ? "#1a1a1a" : "#fff",
                color: tipo===v ? "#fff" : "#737373",
                fontFamily:"'Sora',sans-serif"
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ width:150 }}>
          <label style={FL}>Fecha</label>
          <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={I}/>
        </div>
      </div>

      {proveedores.map(prov => {
        const prods = productos.filter(p=>p.proveedor===prov);
        return (
          <div key={prov} style={{ marginBottom:16 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#a3a3a3", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>{prov}</div>
            <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:10, overflow:"hidden" }}>
              {prods.map((p,idx)=>{
                const key = `${p.proveedor}|||${p.producto}`;
                const mapKey = `${sede}||${p.proveedor}||${p.producto}`;
                const last = latestMap?.[mapKey];
                const level = getLevel(last?.cantidad??null, p.min_stock);
                const cs = CELL_STYLE[level];
                const val = cantidades[key]??"";
                return (
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 14px", borderBottom:idx<prods.length-1?"1px solid #f5f5f5":"none" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500 }}>{p.producto}</div>
                      <div style={{ fontSize:10, color:"#a3a3a3", marginTop:1 }}>
                        mín {p.min_stock}
                        {last && <span style={{ marginLeft:8 }}>· último: <strong style={{ color: cs.color }}>{last.cantidad}</strong> <span style={{ color:"#d4d4d4" }}>({fdate(last.fecha)})</span></span>}
                      </div>
                    </div>
                    <input type="number" min="0" step="0.5" value={val}
                      onChange={e=>setCantidades(prev=>({...prev,[key]:e.target.value===""?"":parseFloat(e.target.value)}))}
                      placeholder="—" style={{ ...I, width:80, textAlign:"center", background:val!==""?"#f0fdf4":"#fff" }}/>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:8, paddingBottom:32 }}>
        {saved && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#16a34a" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Registrado
        </div>}
        <button onClick={handleGuardar} disabled={!filled||saving} style={{ ...BP, opacity:filled&&!saving?1:0.35 }}>
          {saving?"Guardando…":`Guardar ${filled>0?`(${filled})`:""}`}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CM VIEW
// ══════════════════════════════════════════════════════════════════════════════
function InventarioCM({ user, records, onSaved, conn }) {
  const sede = getCMSede(user.email);
  const [tab, setTab] = useState("registrar");
  const latestMap = useMemo(() => buildLatestMap(records), [records]);

  const navBtn = (id, label) => (
    <button onClick={()=>setTab(id)} style={{
      padding:"6px 14px", fontSize:11, fontWeight:500, cursor:"pointer", borderRadius:6,
      border: tab===id?"none":"1px solid #e5e5e5",
      background: tab===id?"#1a1a1a":"#fff",
      color: tab===id?"#fff":"#737373",
      fontFamily:"'Sora',sans-serif"
    }}>{label}</button>
  );

  if (!sede) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, color:"#a3a3a3" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <div style={{ fontSize:13, fontWeight:500 }}>Sin sede asignada</div>
        <div style={{ fontSize:11, color:"#b3b3b3", textAlign:"center", maxWidth:260 }}>Contacta a un administrador para asignarte una sede.</div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <div style={{ padding:"12px 20px", borderBottom:"1px solid #f0f0f0", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>{sede}</div>
        <div style={{ display:"flex", gap:4 }}>
          {navBtn("registrar","Registrar")}
          {navBtn("historial","Historial")}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
        {tab==="registrar" && <FormRegistro sede={sede} latestMap={latestMap} user={user} conn={conn} onSaved={onSaved}/>}
        {tab==="historial" && <HistorialSede sede={sede} records={records} latestMap={latestMap}/>}
      </div>
    </div>
  );
}

// ── Historial ────────────────────────────────────────────────────────────────
function HistorialSede({ sede, records, latestMap }) {
  const sedeR = records.filter(r=>r.sede===sede).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const fechas = [...new Set(sedeR.map(r=>r.fecha))].slice(0,15);
  if (!sedeR.length) return <div style={{ textAlign:"center", color:"#d4d4d4", fontSize:12, padding:40 }}>Sin registros aún</div>;
  return (
    <div>
      {fechas.map(fecha=>{
        const day = sedeR.filter(r=>r.fecha===fecha);
        const ago = daysAgo(fecha);
        return (
          <div key={fecha} style={{ marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:600 }}>{fdate(fecha)}</div>
              <div style={{ fontSize:10, color:"#a3a3a3" }}>{ago===0?"hoy":`hace ${ago}d`}</div>
              {day.some(r=>r.tipo==="stock") && <span style={{ fontSize:9, background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0", padding:"1px 7px", borderRadius:4, fontWeight:500 }}>Stock</span>}
              {day.some(r=>r.tipo==="reposicion") && <span style={{ fontSize:9, background:"#eff6ff", color:"#3b82f6", border:"1px solid #bfdbfe", padding:"1px 7px", borderRadius:4, fontWeight:500 }}>Reposición</span>}
            </div>
            <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:8, overflow:"hidden" }}>
              {day.map((r,i)=>{
                const min = getMinStock(sede, r.proveedor, r.producto);
                const level = min!==null ? getLevel(r.cantidad, min) : "nd";
                const cs = CELL_STYLE[level];
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 14px", borderBottom:i<day.length-1?"1px solid #f5f5f5":"none" }}>
                    <div style={{ flex:1, fontSize:11, color:"#525252" }}>{r.producto}</div>
                    <div style={{ fontSize:10, color:"#b3b3b3" }}>{r.proveedor}</div>
                    <div style={{ fontSize:12, fontWeight:cs.fontWeight, fontFamily:"'JetBrains Mono',monospace", color: r.tipo==="reposicion"?"#3b82f6":cs.color }}>
                      {r.tipo==="reposicion"?"+":""}{r.cantidad??"—"}
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

// ── Directorio ────────────────────────────────────────────────────────────────
function DirectorioCM() {
  const [map, setMap] = useState(getSedeCMMap());
  const cmUsers = USERS.filter(u=>u.role==="cm").sort((a,b)=>a.name.localeCompare(b.name));
  return (
    <div style={{ padding:"20px 24px" }}>
      <div style={{ fontSize:9, fontWeight:700, color:"#b3b3b3", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Asignación de sedes ({cmUsers.length} comerciales)</div>
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:10, overflow:"hidden" }}>
        {cmUsers.map((u,i)=>{
          const asignada = map[u.email.toLowerCase()]||"";
          return (
            <div key={u.email} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderBottom:i<cmUsers.length-1?"1px solid #f5f5f5":"none" }}>
              <div style={{ width:30,height:30,borderRadius:99,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#3b82f6",flexShrink:0 }}>{u.name.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:500 }}>{u.name}</div>
                <div style={{ fontSize:10, color:"#a3a3a3" }}>{u.email}</div>
              </div>
              <select value={asignada} onChange={e=>{const next={...map,[u.email.toLowerCase()]:e.target.value||null};setSedeCMMap(next);setMap(next)}} style={{ ...I, width:200, cursor:"pointer" }}>
                <option value="">Sin sede</option>
                {INVENTARIO_SEDES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function Inventario({ user, conn }) {
  const [records, setRecords] = useState(getCached());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conn) return;
    setLoading(true);
    fetchInventario()
      .then(data => { setRecords(data); setCached(data); })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [conn]);

  const handleSaved = (updated) => setRecords(updated);
  const isAdmin = user.role==="admin"||user.role==="ops";

  if (loading) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#a3a3a3", fontSize:13, fontFamily:"'Sora',sans-serif" }}>
      Cargando inventario…
    </div>
  );

  return isAdmin
    ? <InventarioAdmin records={records} user={user} conn={conn} onSaved={handleSaved}/>
    : <InventarioCM user={user} records={records} onSaved={handleSaved} conn={conn}/>;
}
