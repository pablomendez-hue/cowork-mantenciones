import { useState, useEffect, useMemo, useRef } from "react";
import { INVENTARIO_CATALOG, INVENTARIO_SEDES } from "./inventario_catalog.js";
import { INVENTARIO_EXCEL_LATEST, INVENTARIO_EXCEL_TREND } from "./inventario_history.js";
import { fetchInventario, saveInventarioRegistro } from "./inventario_sheets.js";
import { upsertConfig } from "./config_sheets.js";
import { USERS, today } from "./constants.js";

// ── Shared styles ────────────────────────────────────────────────────────────
const I = { appearance:"none",WebkitAppearance:"none",background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 11px",fontSize:12,color:"#1a1a1a",width:"100%",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box" };
const BP = { background:"#1a1a1a",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",display:"inline-flex",alignItems:"center",gap:5 };
const FL = { fontSize:10,fontWeight:500,color:"#a3a3a3",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em" };

// ── localStorage ─────────────────────────────────────────────────────────────
function getSedeCMMap() { try { return JSON.parse(localStorage.getItem("cw_sede_cm")||"{}"); } catch { return {}; } }
function setSedeCMMap(m) { localStorage.setItem("cw_sede_cm",JSON.stringify(m)); }
function getCMSede(email) { return getSedeCMMap()[email.toLowerCase()]||null; }
function getCached() { try { return JSON.parse(localStorage.getItem("cw_inv_cache")||"[]"); } catch { return []; } }
function setCached(d) { localStorage.setItem("cw_inv_cache",JSON.stringify(d)); }
// Extra products per sede (added by CM users)
function getExtraProds(sede) { try { return (JSON.parse(localStorage.getItem("cw_extra_prods")||"{}")[sede])||[]; } catch { return []; } }
function saveExtraProds(sede,prods) { try { const all=JSON.parse(localStorage.getItem("cw_extra_prods")||"{}"); all[sede]=prods; localStorage.setItem("cw_extra_prods",JSON.stringify(all)); } catch {} }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fdate(d) {
  if (!d) return "—";
  return new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
}
function daysAgo(d) {
  if (!d) return null;
  return Math.floor((new Date()-new Date(d+"T12:00:00"))/86400000);
}

function buildLatestMap(liveRecords) {
  const map = { ...INVENTARIO_EXCEL_LATEST };
  for (const r of liveRecords) {
    if (r.tipo !== "stock") continue;
    const key = `${r.sede}||${r.proveedor}||${r.producto}`;
    if (!map[key] || r.fecha >= map[key].fecha) map[key] = { fecha:r.fecha, cantidad:r.cantidad };
  }
  return map;
}

function buildTrendMap(liveRecords) {
  const map = {};
  for (const [k,v] of Object.entries(INVENTARIO_EXCEL_TREND)) map[k] = [...v];
  for (const r of liveRecords) {
    if (r.tipo !== "stock") continue;
    const key = `${r.sede}||${r.proveedor}||${r.producto}`;
    if (!map[key]) map[key] = [];
    map[key].push([r.fecha, r.cantidad]);
  }
  // sort each and keep last 12
  for (const k of Object.keys(map)) {
    map[k] = map[k].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  }
  return map;
}

// ── Semáforo ──────────────────────────────────────────────────────────────────
function getLevel(cantidad, min_stock) {
  if (cantidad==null) return "nd";
  if (cantidad<=0) return "rojo";
  if (cantidad<=min_stock) return "amarillo";
  return "ok";
}
const CELL_STYLE = {
  rojo:     { background:"#fef2f2",color:"#dc2626",fontWeight:700 },
  amarillo: { background:"#fffbeb",color:"#b45309",fontWeight:600 },
  ok:       { background:"transparent",color:"#525252",fontWeight:400 },
  nd:       { background:"transparent",color:"#d4d4d4",fontWeight:400 },
};

// ── Category order ────────────────────────────────────────────────────────────
const CAT_ORDER = ["Aseo","Cafetería","Papelería"];
const CAT_COLORS = { "Aseo":"#3b82f6","Cafetería":"#f97316","Papelería":"#8b5cf6" };
const SUBCAT_ORDER = [null,"Corporate Coffee","Café Caribe"];

// Products that appear under wrong category — override to canonical category
const CAT_FIX = {
  "Aceite de Oliva":"Cafetería","Aceto Balsámico":"Cafetería",
  "Café Granulado":"Cafetería","Vinagre":"Cafetería",
  "Papel Higiénico":"Papelería","Papel Interfoliado":"Papelería","Toalla de Papel":"Papelería"
};
function finalCat(p){ return CAT_FIX[p.producto]||p.categoria; }

function getMinStock(sede,proveedor,producto) {
  const c=(INVENTARIO_CATALOG[sede]||[]).find(p=>p.proveedor===proveedor&&p.producto===producto);
  if(c)return c.min_stock;
  const e=getExtraProds(sede).find(p=>p.proveedor===proveedor&&p.producto===producto);
  return e?.min_stock??null;
}

// Product-level lookups (aggregate across all providers for a given product name)
function getMinStockByProd(sede,producto){
  const c=(INVENTARIO_CATALOG[sede]||[]).find(p=>p.producto===producto);
  if(c)return c.min_stock;
  const e=getExtraProds(sede).find(p=>p.producto===producto);
  return e?.min_stock??null;
}
function getLatestByProd(sede,producto,latestMap){
  let best=null;
  for(const[k,v]of Object.entries(latestMap)){
    const parts=k.split("||");
    if(parts[0]===sede&&parts[2]===producto){if(!best||v.fecha>best.fecha)best=v;}
  }
  return best;
}
function getTrendByProd(sede,producto,trendMap){
  const dm={};
  for(const[k,entries]of Object.entries(trendMap)){
    const parts=k.split("||");
    if(parts[0]===sede&&parts[2]===producto){for(const[f,q]of entries)dm[f]=(dm[f]||0)+q;}
  }
  return Object.entries(dm).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
}

// ── All unique products grouped by categoria + subcategoria ───────────────────
function getAllProductsGrouped() {
  const seen = new Set();
  const groups = {};
  for (const prods of Object.values(INVENTARIO_CATALOG)) {
    for (const p of prods) {
      const cat = finalCat(p);
      const key = `${cat}||${p.producto}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sub = p.subcategoria || null;
      if (!groups[cat]) groups[cat] = {};
      const subKey = sub || "_general";
      if (!groups[cat][subKey]) groups[cat][subKey] = [];
      groups[cat][subKey].push({ producto:p.producto, subcategoria:sub });
    }
  }
  for (const cat of Object.keys(groups)) {
    for (const sub of Object.keys(groups[cat])) {
      groups[cat][sub].sort((a,b)=>a.producto.localeCompare(b.producto));
    }
  }
  return groups;
}

// ── Median helper ─────────────────────────────────────────────────────────────
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const h = Math.floor(s.length/2);
  return s.length%2 ? s[h] : (s[h-1]+s[h])/2;
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Spark({ data, min_stock }) {
  if (!data || data.length < 2) return null;
  const w=120, h=28, pad=3;
  const vals = data.map(d=>d[1]);
  const maxV = Math.max(...vals, min_stock*1.5, 1);
  const xStep = (w-pad*2)/(data.length-1);
  const y = v => h-pad-((v/maxV)*(h-pad*2));
  const minY = y(min_stock);
  const pts = data.map(([,v],i)=>({ x:pad+i*xStep, y:y(v), v }));
  const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{display:"block",overflow:"visible"}}>
      <line x1={pad} y1={minY} x2={w-pad} y2={minY} stroke="#fde68a" strokeWidth="1" strokeDasharray="3,2"/>
      <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth="1.5"/>
      {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.y>=minY?"#f59e0b":"#22c55e"}/>)}
    </svg>
  );
}

// ── Sparkline for CM form (wide, with breakeven/median line) ──────────────────
function SparkCM({ data, breakeven, width=220, height=32 }) {
  if (!data || data.length < 2) return null;
  const pl=3, pr=3, pt=5, pb=4;
  const vals = data.map(d=>d[1]);
  const maxV = Math.max(...vals, breakeven*1.4, 1);
  const xStep = (width-pl-pr) / (data.length-1);
  const y = v => height-pb-((v/maxV)*(height-pt-pb));
  const beY = y(breakeven);
  const pts = data.map(([,v],i)=>({ x:pl+i*xStep, y:y(v), v }));
  const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} style={{display:"block",overflow:"visible"}}>
      <line x1={pl} y1={beY} x2={width-pr} y2={beY} stroke="#c4b5fd" strokeWidth="1" strokeDasharray="3,2"/>
      <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r={i===pts.length-1?3:2}
          fill={p.v>=breakeven?"#22c55e":"#f59e0b"} stroke="#fff" strokeWidth="1"/>
      ))}
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEDE DETAIL PANEL
// ══════════════════════════════════════════════════════════════════════════════
function SedePanel({ sede, latestMap, trendMap, onClose }) {
  const [showOK, setShowOK] = useState(false);
  const rawProds = INVENTARIO_CATALOG[sede] || [];

  // Deduplicate products for this sede using canonical category
  const seenProds = new Set();
  const uniqProds = [];
  for(const p of rawProds){
    const cat=finalCat(p);
    const key=`${cat}||${p.producto}`;
    if(!seenProds.has(key)){seenProds.add(key);uniqProds.push({...p,categoria:cat});}
  }

  const prodStatus = uniqProds.map(p=>{
    const entry=getLatestByProd(sede,p.producto,latestMap);
    const trend=getTrendByProd(sede,p.producto,trendMap);
    const min=getMinStockByProd(sede,p.producto);
    const med=trend.length?median(trend.map(([,v])=>v)):0;
    const level=getLevel(entry?.cantidad??null,min);
    return {...p,entry,trend,min,med,level,cantidad:entry?.cantidad??null};
  });

  const pedir = prodStatus.filter(p=>p.level==="rojo"||p.level==="amarillo"||(p.med>0&&(p.cantidad||0)<p.med));
  const ok    = prodStatus.filter(p=>!(p.level==="rojo"||p.level==="amarillo"||(p.med>0&&(p.cantidad||0)<p.med)));

  const lastDate = Object.entries(latestMap)
    .filter(([k])=>k.startsWith(sede+"||"))
    .map(([,v])=>v.fecha).sort().reverse()[0];

  const ProdCard = ({p}) => {
    const cs=CELL_STYLE[p.level];
    return (
      <div style={{ marginBottom:8,padding:"9px 12px",background:p.level==="ok"?"#fafafa":cs.background,borderRadius:8,border:`1px solid ${p.level==="rojo"?"#fecaca":p.level==="amarillo"?"#fde68a":"#f0f0f0"}` }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
          <div style={{ fontSize:11,fontWeight:500,color:"#1a1a1a" }}>{p.producto}</div>
          <div style={{ fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:cs.color }}>
            {p.cantidad!=null?p.cantidad:<span style={{ color:"#d4d4d4",fontSize:11 }}>sin dato</span>}
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <div style={{ fontSize:9,color:"#b3b3b3" }}>
            mín <strong>{p.min}</strong>
            {p.med>0&&<span style={{ color:"#a78bfa",marginLeft:5 }}>eq. {Math.round(p.med)}</span>}
            {p.entry&&<span style={{ marginLeft:5 }}>· {fdate(p.entry.fecha)}</span>}
          </div>
          <Spark data={p.trend} min_stock={p.min}/>
        </div>
      </div>
    );
  };

  return (
    <div style={{ width:380,flexShrink:0,borderLeft:"1px solid #f0f0f0",display:"flex",flexDirection:"column",background:"#fff",height:"100%" }}>
      {/* Header */}
      <div style={{ padding:"14px 18px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14,fontWeight:700 }}>{sede}</div>
          {lastDate && <div style={{ fontSize:10,color:"#a3a3a3",marginTop:2 }}>Último registro: {fdate(lastDate)} · hace {daysAgo(lastDate)}d</div>}
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#b3b3b3",padding:4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {/* Products */}
      <div style={{ flex:1,overflowY:"auto",padding:"12px 18px" }}>
        {/* Pedir section */}
        {pedir.length>0&&(
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10,fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8,display:"flex",alignItems:"center",gap:6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
              Pedir ({pedir.length})
            </div>
            {pedir.map(p=><ProdCard key={p.producto} p={p}/>)}
          </div>
        )}
        {pedir.length===0&&(
          <div style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:16,border:"1px solid #bbf7d0" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ fontSize:11,color:"#16a34a",fontWeight:500 }}>Todo en orden — sin productos a pedir</span>
          </div>
        )}
        {/* OK section (collapsible) */}
        {ok.length>0&&(
          <div>
            <button onClick={()=>setShowOK(v=>!v)} style={{ background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:5,marginBottom:8,fontFamily:"'Sora',sans-serif" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2.5">{showOK?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}</svg>
              <span style={{ fontSize:10,fontWeight:600,color:"#a3a3a3",textTransform:"uppercase",letterSpacing:"0.05em" }}>OK ({ok.length})</span>
            </button>
            {showOK&&ok.map(p=><ProdCard key={p.producto} p={p}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MATRIX TABLE
// ══════════════════════════════════════════════════════════════════════════════
const TH = { padding:"8px 8px",textAlign:"left",borderBottom:"1px solid #f0f0f0",fontSize:10,color:"#737373",fontWeight:600,whiteSpace:"nowrap" };
const TD = { padding:"6px 8px",textAlign:"center",fontSize:11,fontFamily:"'JetBrains Mono',monospace",borderBottom:"1px solid #f9f9f9" };

function MatrixTable({ latestMap, filtCat, onSedeClick, activeSedeCol }) {
  const groups = useMemo(()=>getAllProductsGrouped(),[]);
  const sedes = INVENTARIO_SEDES;
  const cats = filtCat ? [filtCat] : CAT_ORDER;
  const ref = useRef(null);
  useEffect(()=>{ ref.current?.focus(); },[]);

  return (
    <div ref={ref} tabIndex={0} style={{ overflowX:"auto",overflowY:"auto",flex:1,outline:"none" }}
      onKeyDown={e=>{
        const el=ref.current; if(!el) return;
        if(e.key===" "){e.preventDefault();el.scrollBy({top:e.shiftKey?-240:240,behavior:"smooth"});}
        if(e.key==="ArrowRight"){e.preventDefault();el.scrollBy({left:120,behavior:"smooth"});}
        if(e.key==="ArrowLeft"){e.preventDefault();el.scrollBy({left:-120,behavior:"smooth"});}
        if(e.key==="ArrowDown"){e.preventDefault();el.scrollBy({top:48,behavior:"smooth"});}
        if(e.key==="ArrowUp"){e.preventDefault();el.scrollBy({top:-48,behavior:"smooth"});}
      }}>
      <table style={{ borderCollapse:"collapse",fontSize:11,fontFamily:"'Sora',sans-serif",whiteSpace:"nowrap" }}>
        <thead>
          <tr style={{ position:"sticky",top:0,zIndex:10,background:"#fff" }}>
            <th style={{ ...TH,position:"sticky",left:0,zIndex:11,background:"#fff",width:200,minWidth:200,borderRight:"1px solid #f0f0f0" }}>Insumo</th>
            {sedes.map(s=>(
              <th key={s} onClick={()=>onSedeClick(s===activeSedeCol?null:s)}
                style={{ ...TH,cursor:"pointer",minWidth:65,maxWidth:80,textAlign:"center",
                  background:s===activeSedeCol?"#1a1a1a":"#fff",
                  color:s===activeSedeCol?"#fff":"#737373",
                  transition:"background 0.1s" }}
                title={s}>
                {s.length>9?s.slice(0,8)+"…":s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map(cat=>{
            if (!groups[cat]) return null;
            const subcats = SUBCAT_ORDER.filter(s=>(s===null?"_general":s) in (groups[cat]||{}));
            return (
              <>
                <tr key={"cat-"+cat}>
                  <td colSpan={sedes.length+1} style={{ padding:"10px 12px 4px",background:"#fafafa",borderTop:"2px solid #f0f0f0",borderBottom:"1px solid #f0f0f0" }}>
                    <span style={{ fontSize:9,fontWeight:700,color:CAT_COLORS[cat],textTransform:"uppercase",letterSpacing:"0.07em",display:"flex",alignItems:"center",gap:5 }}>
                      <span style={{ width:6,height:6,borderRadius:99,background:CAT_COLORS[cat],display:"inline-block" }}/>{cat}
                    </span>
                  </td>
                </tr>
                {subcats.map(sub=>{
                  const subKey = sub===null?"_general":sub;
                  const prods = groups[cat]?.[subKey]||[];
                  return (
                    <>
                      {sub!==null && (
                        <tr key={"sub-"+sub}>
                          <td colSpan={sedes.length+1} style={{ padding:"5px 14px 3px",background:"#fdfdfd",borderBottom:"1px solid #f5f5f5" }}>
                            <span style={{ fontSize:9,color:"#a3a3a3",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em" }}>{sub}</span>
                          </td>
                        </tr>
                      )}
                      {prods.map(p=>(
                        <tr key={p.producto}
                          onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ ...TH,position:"sticky",left:0,background:"inherit",fontWeight:500,fontSize:12,color:"#1a1a1a",borderRight:"1px solid #f0f0f0",borderBottom:"1px solid #f5f5f5" }}>
                            {p.producto}
                          </td>
                          {sedes.map(sede=>{
                            const min=getMinStockByProd(sede,p.producto);
                            if (min===null) return <td key={sede} style={{ ...TD,color:"#efefef" }}>·</td>;
                            const entry=getLatestByProd(sede,p.producto,latestMap);
                            const level=getLevel(entry?.cantidad??null,min);
                            const cs=CELL_STYLE[level];
                            return (
                              <td key={sede} style={{ ...TD,...cs,
                                opacity:sede===activeSedeCol?1:1,
                                outline:sede===activeSedeCol?"2px solid #1a1a1a":"none",
                                outlineOffset:-1 }}
                                title={entry?`${entry.cantidad} · ${fdate(entry.fecha)} (mín ${min})`:`Sin dato (mín ${min})`}>
                                {entry?.cantidad??<span style={{ color:"#e5e5e5",fontSize:9 }}>—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ══════════════════════════════════════════════════════════════════════════════
function InventarioAdmin({ records, user, conn, onSaved }) {
  const [tab, setTab] = useState("resumen");
  const [filtCat, setFiltCat] = useState("");
  const [activeSedeCol, setActiveSedeCol] = useState(null);
  const [previewCM, setPreviewCM] = useState(false);
  const [previewSede, setPreviewSede] = useState(INVENTARIO_SEDES[0]);

  const latestMap = useMemo(()=>buildLatestMap(records),[records]);
  const trendMap  = useMemo(()=>buildTrendMap(records),[records]);

  const alertas = useMemo(()=>{
    let rojo=0,amarillo=0;
    for (const [k,entry] of Object.entries(latestMap)) {
      const [sede,prov,prod]=k.split("||");
      const min=getMinStock(sede,prov,prod);
      if (min===null) continue;
      const lv=getLevel(entry.cantidad,min);
      if (lv==="rojo") rojo++;
      else if (lv==="amarillo") amarillo++;
    }
    return {rojo,amarillo};
  },[latestMap]);

  const navBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{
      padding:"6px 14px",fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:6,
      border:tab===id?"none":"1px solid #e5e5e5",
      background:tab===id?"#1a1a1a":"#fff",color:tab===id?"#fff":"#737373",
      fontFamily:"'Sora',sans-serif"
    }}>{label}</button>
  );

  if (previewCM) {
    return (
      <div style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0 }}>
        <div style={{ padding:"10px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:12,background:"#fffbeb",flexShrink:0 }}>
          <span style={{ fontSize:10,background:"#fef08a",color:"#92400e",padding:"2px 8px",borderRadius:4,fontWeight:600 }}>PREVIEW VISTA COMERCIAL</span>
          <select value={previewSede} onChange={e=>setPreviewSede(e.target.value)} style={{ ...I,width:200,fontSize:11 }}>
            {INVENTARIO_SEDES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>setPreviewCM(false)} style={{ ...BP,background:"#fff",color:"#525252",border:"1px solid #e5e5e5",marginLeft:"auto" }}>
            Salir del preview
          </button>
        </div>
        <FormRegistro sede={previewSede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved} isPreview/>
      </div>
    );
  }

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0 }}>
      {/* Sub-header */}
      <div style={{ padding:"10px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap" }}>
        <div style={{ display:"flex",gap:4 }}>
          {navBtn("resumen","Resumen")}
          {navBtn("registrar","Registrar")}
          {navBtn("directorio","Directorio")}
        </div>
        {tab==="resumen"&&(
          <>
            <div style={{ width:1,background:"#e5e5e5",height:20,margin:"0 4px" }}/>
            {CAT_ORDER.map(c=>(
              <button key={c} onClick={()=>setFiltCat(filtCat===c?"":c)} style={{
                padding:"4px 12px",fontSize:10,fontWeight:600,cursor:"pointer",borderRadius:5,
                border:`1px solid ${filtCat===c?CAT_COLORS[c]:"#e5e5e5"}`,
                background:filtCat===c?CAT_COLORS[c]+"15":"#fff",
                color:filtCat===c?CAT_COLORS[c]:"#a3a3a3",
                fontFamily:"'Sora',sans-serif",textTransform:"uppercase",letterSpacing:"0.04em"
              }}>{c}</button>
            ))}
            <div style={{ marginLeft:"auto",display:"flex",gap:10,alignItems:"center" }}>
              {alertas.rojo>0&&<span style={{ display:"flex",alignItems:"center",gap:4,fontSize:11 }}>
                <span style={{ width:7,height:7,borderRadius:99,background:"#ef4444",display:"inline-block" }}/>
                <strong style={{ color:"#dc2626",fontFamily:"'JetBrains Mono',monospace" }}>{alertas.rojo}</strong>
                <span style={{ color:"#a3a3a3" }}>sin stock</span>
              </span>}
              {alertas.amarillo>0&&<span style={{ display:"flex",alignItems:"center",gap:4,fontSize:11 }}>
                <span style={{ width:7,height:7,borderRadius:99,background:"#f59e0b",display:"inline-block" }}/>
                <strong style={{ color:"#b45309",fontFamily:"'JetBrains Mono',monospace" }}>{alertas.amarillo}</strong>
                <span style={{ color:"#a3a3a3" }}>bajo mínimo</span>
              </span>}
              <button onClick={()=>setPreviewCM(true)} style={{ padding:"4px 10px",fontSize:10,fontWeight:500,cursor:"pointer",borderRadius:5,border:"1px solid #e5e5e5",background:"#fff",color:"#737373",fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Ver como comercial
              </button>
            </div>
          </>
        )}
      </div>
      {/* Content */}
      <div style={{ flex:1,display:"flex",minHeight:0,overflow:"hidden" }}>
        {tab==="resumen"&&(
          <>
            <MatrixTable latestMap={latestMap} filtCat={filtCat} onSedeClick={setActiveSedeCol} activeSedeCol={activeSedeCol}/>
            {activeSedeCol&&(
              <SedePanel sede={activeSedeCol} latestMap={latestMap} trendMap={trendMap} onClose={()=>setActiveSedeCol(null)}/>
            )}
          </>
        )}
        {tab==="registrar"&&(
          <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
            <div style={{ marginBottom:16 }}>
              <label style={FL}>Sede</label>
              <select value={previewSede} onChange={e=>setPreviewSede(e.target.value)} style={{ ...I,width:220,cursor:"pointer" }}>
                {INVENTARIO_SEDES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <FormRegistro sede={previewSede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved}/>
          </div>
        )}
        {tab==="directorio"&&<DirectorioCM conn={conn}/>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE REGISTRO
// ══════════════════════════════════════════════════════════════════════════════
function FormRegistro({ sede, latestMap, trendMap, user, conn, onSaved, isPreview }) {
  const [tipo, setTipo] = useState("stock");
  const [fecha, setFecha] = useState(today());
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(null);
  const [newProd, setNewProd] = useState({ producto:"", proveedor:"", min_stock:1 });
  const [extraProds, setExtraProds] = useState(()=>getExtraProds(sede));

  // Merge catalog + extra products
  const catalogProds = INVENTARIO_CATALOG[sede]||[];
  const allSedeProds = [...catalogProds];
  for (const ep of extraProds) {
    if (!allSedeProds.some(p=>p.proveedor===ep.proveedor&&p.producto===ep.producto)) allSedeProds.push(ep);
  }

  const handleAddProd = (cat) => {
    if (!newProd.producto.trim()) return;
    const np = { proveedor:newProd.proveedor.trim()||"Otro", producto:newProd.producto.trim(), categoria:cat, subcategoria:null, min_stock:Math.max(1,Number(newProd.min_stock)||1) };
    const updated = [...extraProds, np];
    setExtraProds(updated);
    saveExtraProds(sede, updated);
    setNewProd({ producto:"", proveedor:"", min_stock:1 });
    setShowAddForm(null);
  };

  const productos = allSedeProds;
  const cats = CAT_ORDER.filter(c=>productos.some(p=>p.categoria===c));

  const handleGuardar = async () => {
    const entries = Object.entries(cantidades).filter(([,v])=>v!==""&&v!==null&&!isNaN(v));
    if (!entries.length) return;
    setSaving(true);
    const ts_now = Date.now();
    const newR = entries.map(([key,cantidad],i)=>{
      const [proveedor,producto]=key.split("|||");
      return { id:String(ts_now+i),sede,proveedor,producto,fecha,cantidad:Number(cantidad),tipo,registrado_por:user?.name||"Admin" };
    });
    try {
      if (conn&&!isPreview) await saveInventarioRegistro(newR);
      if (!isPreview) {
        const updated=[...getCached(),...newR];
        setCached(updated);
        onSaved?.(updated);
      }
      setCantidades({});
      setSaved(true);
      setTimeout(()=>setSaved(false),3000);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const filled = Object.values(cantidades).filter(v=>v!==""&&v!==null&&!isNaN(v)).length;

  return (
    <div>
      <div style={{ display:"flex",gap:10,marginBottom:18,alignItems:"flex-end",flexWrap:"wrap" }}>
        <div>
          <label style={FL}>Tipo de registro</label>
          <div style={{ display:"flex",gap:6 }}>
            {[["stock","Stock Actual"],["reposicion","Reposición"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTipo(v)} style={{
                padding:"7px 14px",fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:7,
                border:tipo===v?"none":"1px solid #e5e5e5",
                background:tipo===v?"#1a1a1a":"#fff",color:tipo===v?"#fff":"#737373",
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

      {cats.map(cat=>{
        const catProds = productos.filter(p=>p.categoria===cat);
        const subcats = SUBCAT_ORDER.filter(s=>{
          const sk = s===null?"_general":s;
          return catProds.some(p=>(p.subcategoria||"_general")===sk||(!p.subcategoria&&s===null));
        });
        return (
          <div key={cat} style={{ marginBottom:20 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
              <span style={{ width:7,height:7,borderRadius:99,background:CAT_COLORS[cat],display:"inline-block" }}/>
              <span style={{ fontSize:9,fontWeight:700,color:CAT_COLORS[cat],textTransform:"uppercase",letterSpacing:"0.06em" }}>{cat}</span>
            </div>
            {subcats.map(sub=>{
              const sk = sub===null?"_general":sub;
              const subProds = catProds.filter(p=>(p.subcategoria||"_general")===sk||(!p.subcategoria&&sub===null));
              if (!subProds.length) return null;
              return (
                <div key={sk} style={{ marginBottom:12 }}>
                  {sub!==null&&<div style={{ fontSize:9,color:"#a3a3a3",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4 }}>{sub}</div>}
                  <div style={{ background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,overflow:"hidden" }}>
                    {subProds.map((p,idx)=>{
                      const fkey=`${p.proveedor}|||${p.producto}`;
                      const mkey=`${sede}||${p.proveedor}||${p.producto}`;
                      const last=latestMap?.[mkey];
                      const hist=trendMap?.[mkey];
                      const histSorted=hist?[...hist].sort((a,b)=>a[0].localeCompare(b[0])):[];
                      const be=histSorted.length?median(histSorted.map(([,v])=>v)):0;
                      const level=getLevel(last?.cantidad??null,p.min_stock);
                      const cs=CELL_STYLE[level];
                      const val=cantidades[fkey]??"";
                      const hasHist=histSorted.length>=2;
                      return (
                        <div key={fkey} style={{ borderBottom:idx<subProds.length-1?"1px solid #f5f5f5":"none",background:val!==""?"#f8fffe":"transparent" }}>
                          <div style={{ display:"flex",alignItems:"flex-start",gap:12,padding:"9px 14px" }}>
                            <div style={{ width:6,height:6,borderRadius:99,background:CELL_STYLE[level].color==="transparent"?"#d4d4d4":CELL_STYLE[level].color,flexShrink:0,marginTop:4 }}/>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:12,fontWeight:500 }}>{p.producto}</div>
                              <div style={{ fontSize:10,color:"#a3a3a3",marginTop:1,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
                                <span>mín {p.min_stock}</span>
                                {last&&<span>· <strong style={{ color:cs.color }}>{last.cantidad}</strong> <span style={{ color:"#d4d4d4" }}>({fdate(last.fecha)})</span></span>}
                                {be>0&&<span style={{ color:"#a78bfa" }}>· eq. {Math.round(be)}</span>}
                              </div>
                              {hasHist&&<>
                                <div style={{ marginTop:5 }}>
                                  <SparkCM data={histSorted} breakeven={be} width={Math.min(220,histSorted.length*20+6)}/>
                                </div>
                                <div style={{ display:"flex",gap:2,marginTop:3,flexWrap:"wrap" }}>
                                  {histSorted.map(([f,q],i)=>(
                                    <span key={i} title={fdate(f)} style={{
                                      fontSize:8,fontFamily:"'JetBrains Mono',monospace",
                                      color:q>=be?"#16a34a":q>0?"#b45309":"#dc2626",
                                      background:q>=be?"#f0fdf4":q>0?"#fffbeb":"#fef2f2",
                                      padding:"1px 4px",borderRadius:3,
                                      fontWeight:i===histSorted.length-1?700:400,
                                      border:`1px solid ${q>=be?"#bbf7d0":q>0?"#fde68a":"#fecaca"}`
                                    }}>{q}</span>
                                  ))}
                                </div>
                              </>}
                            </div>
                            <input type="number" min="0" step="0.5" value={val}
                              onChange={e=>setCantidades(prev=>({...prev,[fkey]:e.target.value===""?"":parseFloat(e.target.value)}))}
                              placeholder="—" style={{ ...I,width:80,textAlign:"center",flexShrink:0,marginTop:2}}/>
                          </div>
                        </div>
                      );
                    })}
                    {/* Add product button */}
                    {!isPreview&&(
                      showAddForm===cat?(<div style={{ padding:"10px 14px",borderTop:"1px solid #f0f0f0",background:"#fafafa" }}>
                        <div style={{ display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap" }}>
                          <div style={{ flex:2,minWidth:120 }}>
                            <label style={{ fontSize:9,color:"#a3a3a3",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.04em" }}>Producto</label>
                            <input value={newProd.producto} onChange={e=>setNewProd(p=>({...p,producto:e.target.value}))} placeholder="Nombre del producto" style={{ ...I,fontSize:11 }}/>
                          </div>
                          <div style={{ flex:1.5,minWidth:100 }}>
                            <label style={{ fontSize:9,color:"#a3a3a3",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.04em" }}>Proveedor</label>
                            <input value={newProd.proveedor} onChange={e=>setNewProd(p=>({...p,proveedor:e.target.value}))} placeholder="Proveedor" style={{ ...I,fontSize:11 }}/>
                          </div>
                          <div style={{ width:64 }}>
                            <label style={{ fontSize:9,color:"#a3a3a3",display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.04em" }}>Mín.</label>
                            <input type="number" min="1" value={newProd.min_stock} onChange={e=>setNewProd(p=>({...p,min_stock:e.target.value}))} style={{ ...I,fontSize:11 }}/>
                          </div>
                          <button onClick={()=>handleAddProd(cat)} disabled={!newProd.producto.trim()} style={{ ...BP,padding:"8px 12px",opacity:newProd.producto.trim()?1:0.35,flexShrink:0 }}>Agregar</button>
                          <button onClick={()=>setShowAddForm(null)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 10px",cursor:"pointer",color:"#a3a3a3",fontSize:12,flexShrink:0 }}>✕</button>
                        </div>
                      </div>)
                      :<div style={{ padding:"6px 14px",borderTop:"1px solid #f5f5f5" }}>
                        <button onClick={()=>setShowAddForm(cat)} style={{ fontSize:10,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontFamily:"'Sora',sans-serif",padding:0,display:"flex",alignItems:"center",gap:4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Agregar producto
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ display:"flex",justifyContent:"flex-end",gap:10,marginTop:4,paddingBottom:32 }}>
        {isPreview&&<span style={{ fontSize:11,color:"#a3a3a3",alignSelf:"center" }}>Modo preview — no se guardan datos</span>}
        {saved&&<div style={{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#16a34a" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Registrado
        </div>}
        <button onClick={handleGuardar} disabled={!filled||saving||isPreview} style={{ ...BP,opacity:filled&&!saving&&!isPreview?1:0.35 }}>
          {saving?"Guardando…":`Guardar${filled>0?` (${filled})`:""}`}
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
  const latestMap = useMemo(()=>buildLatestMap(records),[records]);
  const trendMap  = useMemo(()=>buildTrendMap(records),[records]);

  if (!sede) {
    return (
      <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:"#a3a3a3" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <div style={{ fontSize:13,fontWeight:500 }}>Sin sede asignada</div>
        <div style={{ fontSize:11,color:"#b3b3b3",textAlign:"center",maxWidth:260 }}>Contacta a un administrador para que te asignen una sede.</div>
      </div>
    );
  }

  const navBtn=(id,label)=>(
    <button onClick={()=>setTab(id)} style={{
      padding:"6px 14px",fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:6,
      border:tab===id?"none":"1px solid #e5e5e5",
      background:tab===id?"#1a1a1a":"#fff",color:tab===id?"#fff":"#737373",
      fontFamily:"'Sora',sans-serif"
    }}>{label}</button>
  );

  return (
    <div style={{ flex:1,display:"flex",flexDirection:"column",minHeight:0 }}>
      <div style={{ padding:"12px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:16,flexShrink:0 }}>
        <div style={{ fontSize:14,fontWeight:700 }}>{sede}</div>
        <div style={{ display:"flex",gap:4 }}>
          {navBtn("registrar","Registrar")}
          {navBtn("historial","Historial")}
        </div>
      </div>
      <div style={{ flex:1,overflowY:"auto",overflowX:"auto",padding:"20px 24px" }}>
        {tab==="registrar"&&<FormRegistro sede={sede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved}/>}
        {tab==="historial"&&<HistorialSede sede={sede} records={records} latestMap={latestMap}/>}
      </div>
    </div>
  );
}

// ── Historial ─────────────────────────────────────────────────────────────────
function HistorialSede({ sede, records, latestMap }) {
  const sedeR = records.filter(r=>r.sede===sede).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const fechas = [...new Set(sedeR.map(r=>r.fecha))].slice(0,15);
  if (!sedeR.length) return <div style={{ textAlign:"center",color:"#d4d4d4",fontSize:12,padding:40 }}>Sin registros aún</div>;
  return (
    <div>
      {fechas.map(fecha=>{
        const day=sedeR.filter(r=>r.fecha===fecha);
        const ago=daysAgo(fecha);
        return (
          <div key={fecha} style={{ marginBottom:16 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
              <div style={{ fontSize:12,fontWeight:600 }}>{fdate(fecha)}</div>
              <div style={{ fontSize:10,color:"#a3a3a3" }}>{ago===0?"hoy":`hace ${ago}d`}</div>
              {day.some(r=>r.tipo==="stock")&&<span style={{ fontSize:9,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",padding:"1px 7px",borderRadius:4,fontWeight:500 }}>Stock</span>}
              {day.some(r=>r.tipo==="reposicion")&&<span style={{ fontSize:9,background:"#eff6ff",color:"#3b82f6",border:"1px solid #bfdbfe",padding:"1px 7px",borderRadius:4,fontWeight:500 }}>Reposición</span>}
            </div>
            <div style={{ background:"#fff",border:"1px solid #f0f0f0",borderRadius:8,overflow:"hidden" }}>
              {day.map((r,i)=>{
                const min=getMinStock(sede,r.proveedor,r.producto);
                const level=min!==null?getLevel(r.cantidad,min):"nd";
                const cs=CELL_STYLE[level];
                return (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 14px",borderBottom:i<day.length-1?"1px solid #f5f5f5":"none" }}>
                    <div style={{ flex:1,fontSize:11,color:"#525252" }}>{r.producto}</div>
                    <div style={{ fontSize:10,color:"#b3b3b3" }}>{r.proveedor}</div>
                    <div style={{ fontSize:12,fontWeight:cs.fontWeight,fontFamily:"'JetBrains Mono',monospace",color:r.tipo==="reposicion"?"#3b82f6":cs.color }}>
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

// ── Directorio ─────────────────────────────────────────────────────────────────
function DirectorioCM({ conn }) {
  const [map, setMap] = useState(getSedeCMMap());
  const [syncing, setSyncing] = useState(null); // email being synced
  // Show all users (including those with role overrides applied at app load)
  const allUsers = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("cw_users_extra")||"[]"); } catch { return []; }
  }, []);
  const baseUsers = USERS;
  const be = new Set(baseUsers.map(u=>u.email.toLowerCase()));
  const extra = allUsers.filter(u=>!be.has(u.email.toLowerCase()));
  const cmUsers = [...baseUsers,...extra].filter(u=>u.role==="cm").sort((a,b)=>a.name.localeCompare(b.name));

  const handleChange = async (email, sede) => {
    const next = { ...map, [email.toLowerCase()]: sede||null };
    setSedeCMMap(next);
    setMap(next);
    if (conn) {
      setSyncing(email);
      try { await upsertConfig("sede_cm", email.toLowerCase(), sede||""); }
      catch(e) { console.error(e); }
      finally { setSyncing(null); }
    }
  };

  return (
    <div style={{ padding:"20px 24px" }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
        <div style={{ fontSize:9,fontWeight:700,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em" }}>Asignación de sedes ({cmUsers.length} comerciales)</div>
        {conn
          ? <span style={{ fontSize:10,color:"#16a34a",display:"flex",alignItems:"center",gap:3 }}><span style={{ width:5,height:5,borderRadius:99,background:"#22c55e",display:"inline-block" }}/>Sincronizado con Sheets</span>
          : <span style={{ fontSize:10,color:"#f59e0b" }}>Solo local (sin conexión a Sheets)</span>
        }
      </div>
      <div style={{ background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,overflow:"hidden" }}>
        {cmUsers.map((u,i)=>{
          const asignada=map[u.email.toLowerCase()]||"";
          const isSyncing=syncing===u.email;
          return (
            <div key={u.email} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<cmUsers.length-1?"1px solid #f5f5f5":"none" }}>
              <div style={{ width:30,height:30,borderRadius:99,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#3b82f6",flexShrink:0 }}>{u.name.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,fontWeight:500 }}>{u.name}</div>
                <div style={{ fontSize:10,color:"#a3a3a3" }}>{u.email}</div>
              </div>
              {isSyncing && <span style={{ fontSize:10,color:"#a3a3a3" }}>Guardando…</span>}
              <select value={asignada} onChange={e=>handleChange(u.email, e.target.value)} style={{ ...I,width:200,cursor:"pointer",opacity:isSyncing?0.5:1 }} disabled={isSyncing}>
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

  useEffect(()=>{
    if (!conn) return;
    setLoading(true);
    fetchInventario()
      .then(data=>{ setRecords(data); setCached(data); })
      .catch(e=>console.error(e))
      .finally(()=>setLoading(false));
  },[conn]);

  const isAdmin = user.role==="admin"||user.role==="ops";

  if (loading) return (
    <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#a3a3a3",fontSize:13,fontFamily:"'Sora',sans-serif" }}>
      Cargando inventario…
    </div>
  );

  return isAdmin
    ? <InventarioAdmin records={records} user={user} conn={conn} onSaved={setRecords}/>
    : <InventarioCM user={user} records={records} onSaved={setRecords} conn={conn}/>;
}
