import { useState, useEffect, useMemo, useRef } from "react";
import { INVENTARIO_CATALOG, INVENTARIO_SEDES } from "./inventario_catalog.js";
import { INVENTARIO_EXCEL_LATEST, INVENTARIO_EXCEL_TREND } from "./inventario_history.js";
import { fetchInventario, saveInventarioRegistro, updateInventarioRecord, deleteInventarioRecord } from "./inventario_sheets.js";
import { upsertConfig, fetchConfig, parseProdCat, parseBreakeven } from "./config_sheets.js";
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
  const dt = new Date(d+"T12:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("es-CL",{day:"2-digit",month:"short"});
}
function daysAgo(d) {
  if (!d) return null;
  const dt = new Date(d+"T12:00:00");
  if (isNaN(dt.getTime())) return null;
  return Math.floor((new Date()-dt)/86400000);
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
function finalCat(p, catOverrides={}){ return catOverrides[p.producto] || CAT_FIX[p.producto] || p.categoria; }

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
function getAllProductsGrouped(catOverrides={}) {
  const seen = new Set();
  const groups = {};
  for (const prods of Object.values(INVENTARIO_CATALOG)) {
    for (const p of prods) {
      const cat = finalCat(p, catOverrides);
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

  const pedir = prodStatus.filter(p=>p.level==="rojo"||p.level==="amarillo");
  const ok    = prodStatus.filter(p=>p.level!=="rojo"&&p.level!=="amarillo");

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

function MatrixTable({ latestMap, filtCat, onSedeClick, activeSedeCol, catOverrides={} }) {
  const groups = useMemo(()=>getAllProductsGrouped(catOverrides),[catOverrides]);
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
function InventarioAdmin({ records, user, conn, onSaved, catOverrides={}, breakevenMap={}, onCatOverride, onBreakevenChange }) {
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
        <FormRegistro sede={previewSede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved} isPreview breakevenMap={breakevenMap} onBreakevenChange={onBreakevenChange}/>
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
          {navBtn("historial","Historial")}
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
            <MatrixTable latestMap={latestMap} filtCat={filtCat} onSedeClick={setActiveSedeCol} activeSedeCol={activeSedeCol} catOverrides={catOverrides}/>
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
            <FormRegistro sede={previewSede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved} breakevenMap={breakevenMap} onBreakevenChange={onBreakevenChange}/>
          </div>
        )}
        {tab==="historial"&&(
          <div style={{ flex:1,overflowY:"auto",padding:"20px 24px" }}>
            <div style={{ marginBottom:16 }}>
              <label style={FL}>Sede</label>
              <select value={previewSede} onChange={e=>setPreviewSede(e.target.value)} style={{ ...I,width:220,cursor:"pointer" }}>
                {INVENTARIO_SEDES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <HistorialSede sede={previewSede} records={records} latestMap={latestMap}
              onRecordUpdate={r=>{ const upd=records.map(x=>x.id===r.id?r:x); onSaved(upd); setCached(upd); }}
              canDelete={true}
              onRecordDelete={id=>{ const upd=records.filter(x=>x.id!==id); onSaved(upd); setCached(upd); }}/>
          </div>
        )}
        {tab==="directorio"&&<DirectorioCM conn={conn} catOverrides={catOverrides} onCatOverride={onCatOverride}/>}
      </div>
    </div>
  );
}

// ── Punto de equilibrio cell (editable for ops) ────────────────────────────
function ColPE({ sede, producto, be, histSorted, hasHist, breakevenMap, onBreakevenChange, user }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const beKey = `${sede}||${producto}`;
  const manualBE = breakevenMap?.[beKey];
  const displayBE = manualBE != null ? manualBE : (be > 0 ? Math.round(be) : null);
  const isOps = user?.role === "ops" || user?.role === "admin";

  const handleSave = async () => {
    const v = parseFloat(editVal);
    if (isNaN(v) || v < 0) return;
    await onBreakevenChange?.(sede, producto, v);
    setEditing(false);
  };

  return (
    <div style={{ width:195,flexShrink:0,padding:"5px 10px",display:"flex",alignItems:"center",gap:8 }}>
      {hasHist && <SparkCM data={histSorted} breakeven={displayBE || be} width={140} height={28}/>}
      {!hasHist && <span style={{ fontSize:9,color:"#e0e0e0",fontStyle:"italic" }}>sin datos</span>}
      {editing ? (
        <div style={{ display:"flex",flexDirection:"column",gap:3,flexShrink:0 }}>
          <input type="number" min="0" step="0.5" value={editVal}
            onChange={e=>setEditVal(e.target.value)}
            style={{ ...I,width:50,textAlign:"center",fontSize:11,padding:"3px 4px" }}
            autoFocus
            onKeyDown={e=>{ if(e.key==="Enter") handleSave(); if(e.key==="Escape") setEditing(false); }}/>
          <button onClick={handleSave} style={{ ...BP,padding:"2px 6px",fontSize:9 }}>OK</button>
        </div>
      ) : (
        <div
          style={{ flexShrink:0,textAlign:"center",cursor:isOps?"pointer":"default" }}
          onClick={()=>{ if(!isOps) return; setEditVal(String(displayBE??"")); setEditing(true); }}
          title={isOps?"Clic para editar punto de equilibrio":undefined}
        >
          <div style={{ fontSize:8,color:"#a3a3a3",marginBottom:1 }}>
            {manualBE!=null?"p.e.":"med."}
            {isOps && <span style={{ marginLeft:3,color:"#c0c0ff" }}>✎</span>}
          </div>
          {displayBE!=null
            ? <div style={{ fontSize:13,fontWeight:700,color:manualBE!=null?"#6366f1":"#94a3b8",fontFamily:"'Consolas','Courier New',monospace",lineHeight:1 }}>{Math.round(displayBE)}</div>
            : <div style={{ fontSize:9,color:"#e0e0e0" }}>—</div>
          }
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE REGISTRO
// ══════════════════════════════════════════════════════════════════════════════
function FormRegistro({ sede, latestMap, trendMap, user, conn, onSaved, isPreview, breakevenMap={}, onBreakevenChange }) {
  const [tipo, setTipo] = useState("stock");
  const [fecha, setFecha] = useState(today());
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddForm, setShowAddForm] = useState(null);
  const [newProd, setNewProd] = useState({ producto:"", min_stock:1 });
  const [extraProds, setExtraProds] = useState(()=>getExtraProds(sede));

  // Merge catalog + extra products
  const catalogProds = INVENTARIO_CATALOG[sede]||[];
  const allSedeProds = [...catalogProds];
  for (const ep of extraProds) {
    if (!allSedeProds.some(p=>p.producto===ep.producto)) allSedeProds.push(ep);
  }

  // Products from other sedes not yet in this sede (for the "add" dropdown)
  const availableToAdd = useMemo(()=>{
    const existing = new Set(allSedeProds.map(p=>p.producto));
    const seen = new Set();
    const out = [];
    for (const prods of Object.values(INVENTARIO_CATALOG)) {
      for (const p of prods) {
        if (!existing.has(p.producto)&&!seen.has(p.producto)) {
          seen.add(p.producto);
          out.push({...p, categoria:finalCat(p)});
        }
      }
    }
    return out.sort((a,b)=>a.producto.localeCompare(b.producto));
  },[allSedeProds]);

  const handleAddProd = (cat) => {
    if (!newProd.producto) return;
    const ref = Object.values(INVENTARIO_CATALOG).flat().find(p=>p.producto===newProd.producto);
    const np = { proveedor:ref?.proveedor||"Otro", producto:newProd.producto, categoria:cat, subcategoria:ref?.subcategoria||null, min_stock:Math.max(1,Number(newProd.min_stock)||1) };
    const updated = [...extraProds, np];
    setExtraProds(updated);
    saveExtraProds(sede, updated);
    setNewProd({ producto:"", min_stock:1 });
    setShowAddForm(null);
  };

  const productos = allSedeProds;
  const cats = CAT_ORDER.filter(c=>productos.some(p=>p.categoria===c)||availableToAdd.some(p=>p.categoria===c));

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
    <div style={{ fontFamily:"'Consolas','Courier New',monospace" }}>
      <div style={{ display:"flex",gap:10,marginBottom:18,alignItems:"flex-end",flexWrap:"wrap" }}>
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
            {/* Empty sede: show add button directly at category level */}
            {!isPreview&&catProds.length===0&&(()=>{
              const catAvailable=availableToAdd.filter(p=>p.categoria===cat);
              if(!catAvailable.length) return null;
              return showAddForm===cat?(
                <div style={{ display:"flex",gap:6,alignItems:"center",padding:"10px 12px",background:"#fafafa",border:"1px solid #e5e5e5",borderRadius:10 }}>
                  <select value={newProd.producto} onChange={e=>{
                    const prod=e.target.value;
                    const ref=catAvailable.find(p=>p.producto===prod);
                    setNewProd({producto:prod,min_stock:ref?.min_stock||1});
                  }} style={{ ...I,flex:1,fontSize:11,cursor:"pointer" }}>
                    <option value="">Seleccionar producto…</option>
                    {catAvailable.map(p=><option key={p.producto} value={p.producto}>{p.producto}</option>)}
                  </select>
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1,flexShrink:0 }}>
                    <label style={{ fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.04em" }}>Mín.</label>
                    <input type="number" min="1" value={newProd.min_stock} onChange={e=>setNewProd(p=>({...p,min_stock:e.target.value}))} style={{ ...I,width:58,textAlign:"center",fontSize:11,padding:"5px 4px" }}/>
                  </div>
                  <button onClick={()=>handleAddProd(cat)} disabled={!newProd.producto} style={{ ...BP,padding:"7px 12px",opacity:newProd.producto?1:0.35,flexShrink:0 }}>Agregar</button>
                  <button onClick={()=>setShowAddForm(null)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:7,padding:"7px 9px",cursor:"pointer",color:"#a3a3a3",fontSize:11,flexShrink:0 }}>✕</button>
                </div>
              ):(
                <button onClick={()=>setShowAddForm(cat)} style={{ fontSize:10,color:"#6366f1",background:"none",border:"1px dashed #c4b5fd",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",gap:4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar primer producto de {cat}
                </button>
              );
            })()}
            {subcats.map(sub=>{
              const sk = sub===null?"_general":sub;
              const subProds = catProds.filter(p=>(p.subcategoria||"_general")===sk||(!p.subcategoria&&sub===null));
              if (!subProds.length) return null;
              return (
                <div key={sk} style={{ marginBottom:12 }}>
                  {sub!==null&&<div style={{ fontSize:9,color:"#a3a3a3",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4 }}>{sub}</div>}
                  <div style={{ background:"#fff",border:"1px solid #e5e5e5",borderRadius:10,overflow:"hidden" }}>
                    {/* Table header */}
                    <div style={{ display:"flex",borderBottom:"1px dashed #d4d4d4",background:"#fafafa",padding:"3px 0" }}>
                      <div style={{ width:170,flexShrink:0,padding:"0 10px",fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",alignItems:"center" }}>Insumo</div>
                      <div style={{ flex:1,minWidth:0,padding:"0 8px",fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",alignItems:"center",borderLeft:"1px dashed #e0e0e0" }}>Últimos 12 registros</div>
                      <div style={{ width:90,flexShrink:0,padding:"0 8px",fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",alignItems:"center",justifyContent:"center",borderLeft:"1px dashed #e0e0e0" }}>Ingresar</div>
                      <div style={{ width:195,flexShrink:0,padding:"0 10px",fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",alignItems:"center",borderLeft:"1px dashed #e0e0e0" }}>Gráfico · P. Equilibrio</div>
                    </div>
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
                      const dotColor=level==="nd"?"#d4d4d4":level==="ok"?"#22c55e":level==="amarillo"?"#f59e0b":"#ef4444";
                      return (
                        <div key={fkey} style={{ display:"flex",alignItems:"stretch",
                          borderBottom:idx<subProds.length-1?"1px dashed #e8e8e8":"none",
                          background:val!==""?"#f7fffe":"transparent",minHeight:42 }}>
                          {/* Col 1: product name */}
                          <div style={{ width:170,flexShrink:0,padding:"6px 10px",display:"flex",alignItems:"center",gap:6,borderRight:"1px dashed #e0e0e0",
                            background:level==="rojo"?"#fef2f2":level==="amarillo"?"#fffbeb":"transparent" }}>
                            <span style={{ width:5,height:5,borderRadius:99,background:dotColor,flexShrink:0 }}/>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:11,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.producto}</div>
                              <div style={{ fontSize:8,color:"#b3b3b3",marginTop:1 }}>
                                mín {p.min_stock}{be>0?` · eq.${Math.round(be)}`:""}{last?` · últ.`:""}
                                {last&&<strong style={{ color:cs.color }}>{last.cantidad}</strong>}
                              </div>
                            </div>
                          </div>
                          {/* Col 2: 12 history entries */}
                          <div style={{ flex:1,minWidth:0,overflowX:"auto",display:"flex",alignItems:"center",borderRight:"1px dashed #e0e0e0" }}>
                            {histSorted.length===0
                              ?<span style={{ fontSize:9,color:"#d4d4d4",padding:"0 14px",fontStyle:"italic" }}>sin registros</span>
                              :histSorted.map(([f,q],i)=>(
                                <div key={i} style={{ flexShrink:0,textAlign:"center",
                                  borderRight:i<histSorted.length-1?"1px dashed #f0f0f0":"none",
                                  padding:"4px 6px",minWidth:44 }}>
                                  <div style={{ fontSize:8,color:"#a3a3a3",marginBottom:2,whiteSpace:"nowrap" }}>{fdate(f)}</div>
                                  <div style={{ fontSize:12,fontWeight:700,
                                    color:q>=be&&be>0?"#16a34a":q>0?"#b45309":"#dc2626",
                                    fontFamily:"'Consolas','Courier New',monospace" }}>{q}</div>
                                </div>
                              ))
                            }
                          </div>
                          {/* Col 3: new entry input */}
                          <div style={{ width:90,flexShrink:0,padding:"5px 8px",display:"flex",alignItems:"center",justifyContent:"center",borderRight:"1px dashed #e0e0e0" }}>
                            <input type="number" min="0" step="0.5" value={val}
                              onChange={e=>setCantidades(prev=>({...prev,[fkey]:e.target.value===""?"":parseFloat(e.target.value)}))}
                              placeholder="—" style={{ ...I,width:"100%",textAlign:"center",padding:"5px 4px",fontSize:13,fontFamily:"'Consolas','Courier New',monospace" }}/>
                          </div>
                          {/* Col 4: sparkline + punto de equilibrio */}
                          <ColPE sede={sede} producto={p.producto} be={be} histSorted={histSorted} hasHist={hasHist} breakevenMap={breakevenMap} onBreakevenChange={onBreakevenChange} user={user}/>
                        </div>
                      );
                    })}
                    {/* Add product button */}
                    {!isPreview&&(()=>{
                      const catAvailable=availableToAdd.filter(p=>p.categoria===cat);
                      if(!catAvailable.length) return null;
                      return showAddForm===cat?(
                        <div style={{ display:"flex",gap:6,alignItems:"center",padding:"7px 12px",borderTop:"1px dashed #e8e8e8",background:"#fafafa" }}>
                          <select value={newProd.producto} onChange={e=>{
                            const prod=e.target.value;
                            const ref=catAvailable.find(p=>p.producto===prod);
                            setNewProd({producto:prod,min_stock:ref?.min_stock||1});
                          }} style={{ ...I,flex:1,fontSize:11,fontFamily:"'Consolas','Courier New',monospace",cursor:"pointer" }}>
                            <option value="">Seleccionar producto…</option>
                            {catAvailable.map(p=><option key={p.producto} value={p.producto}>{p.producto}</option>)}
                          </select>
                          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1,flexShrink:0 }}>
                            <label style={{ fontSize:8,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.04em" }}>Mín.</label>
                            <input type="number" min="1" value={newProd.min_stock} onChange={e=>setNewProd(p=>({...p,min_stock:e.target.value}))} style={{ ...I,width:58,textAlign:"center",fontSize:11,padding:"5px 4px" }}/>
                          </div>
                          <button onClick={()=>handleAddProd(cat)} disabled={!newProd.producto} style={{ ...BP,padding:"7px 12px",opacity:newProd.producto?1:0.35,flexShrink:0 }}>Agregar</button>
                          <button onClick={()=>setShowAddForm(null)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:7,padding:"7px 9px",cursor:"pointer",color:"#a3a3a3",fontSize:11,flexShrink:0 }}>✕</button>
                        </div>
                      ):(
                        <div style={{ padding:"5px 12px",borderTop:"1px dashed #e8e8e8" }}>
                          <button onClick={()=>setShowAddForm(cat)} style={{ fontSize:10,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontFamily:"'Sora',sans-serif",padding:0,display:"flex",alignItems:"center",gap:4 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Agregar producto
                          </button>
                        </div>
                      );
                    })()}
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
function InventarioCM({ user, records, onSaved, conn, breakevenMap={} }) {
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
        {tab==="registrar"&&<FormRegistro sede={sede} latestMap={latestMap} trendMap={trendMap} user={user} conn={conn} onSaved={onSaved} breakevenMap={breakevenMap}/>}
        {tab==="historial"&&<HistorialSede sede={sede} records={records} latestMap={latestMap} onRecordUpdate={r=>{ const upd=records.map(x=>x.id===r.id?r:x); onSaved(upd); setCached(upd); }}/>}
      </div>
    </div>
  );
}

// ── Historial ─────────────────────────────────────────────────────────────────
function HistorialRow({ r, sede, day, i, onUpdate, canDelete, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editFecha, setEditFecha] = useState(r.fecha);
  const [editCant, setEditCant] = useState(String(r.cantidad ?? ""));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const min = getMinStock(sede, r.proveedor, r.producto);
  const level = min !== null ? getLevel(r.cantidad, min) : "nd";
  const cs = CELL_STYLE[level];

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = { ...r, fecha: editFecha, cantidad: parseFloat(editCant) };
      await updateInventarioRecord(updated);
      onUpdate(updated);
      setEditing(false);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar registro de "${r.producto}" (${r.cantidad ?? "—"} — ${fdate(r.fecha)})?`)) return;
    setDeleting(true);
    try {
      await deleteInventarioRecord(r.id);
      onDelete(r.id);
    } catch(e) { console.error(e); setDeleting(false); }
  };

  return (
    <div style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 14px",borderBottom:i<day.length-1?"1px solid #f5f5f5":"none" }}>
      <div style={{ flex:1,fontSize:11,color:"#525252" }}>{r.producto}</div>
      {editing ? (
        <>
          <input type="date" value={editFecha} onChange={e=>setEditFecha(e.target.value)}
            style={{ ...I,width:130,fontSize:11,padding:"4px 6px" }}/>
          <input type="number" min="0" step="0.5" value={editCant} onChange={e=>setEditCant(e.target.value)}
            style={{ ...I,width:60,textAlign:"center",fontSize:11,padding:"4px 6px",fontFamily:"'JetBrains Mono',monospace" }}/>
          <button onClick={handleSave} disabled={saving} style={{ ...BP,padding:"4px 8px",fontSize:10,opacity:saving?0.5:1 }}>
            {saving?"…":"OK"}
          </button>
          <button onClick={()=>setEditing(false)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:5,padding:"4px 7px",cursor:"pointer",color:"#a3a3a3",fontSize:10 }}>✕</button>
        </>
      ) : (
        <>
          <div style={{ fontSize:10,color:"#b3b3b3" }}>{r.proveedor}</div>
          <div style={{ fontSize:12,fontWeight:cs.fontWeight,fontFamily:"'JetBrains Mono',monospace",color:r.tipo==="reposicion"?"#3b82f6":cs.color }}>
            {r.tipo==="reposicion"?"+":""}{r.cantidad??"—"}
          </div>
          <button onClick={()=>{ setEditFecha(r.fecha); setEditCant(String(r.cantidad??"")); setEditing(true); }}
            style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:5,padding:"3px 7px",cursor:"pointer",color:"#a3a3a3",fontSize:9 }}>
            editar
          </button>
          {canDelete&&(
            <button onClick={handleDelete} disabled={deleting}
              style={{ background:"none",border:"1px solid #fecaca",borderRadius:5,padding:"3px 7px",cursor:"pointer",color:"#ef4444",fontSize:9,opacity:deleting?0.5:1 }}>
              {deleting?"…":"borrar"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function HistorialSede({ sede, records, latestMap, onRecordUpdate, canDelete, onRecordDelete }) {
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
              {ago!=null&&<div style={{ fontSize:10,color:"#a3a3a3" }}>{ago===0?"hoy":`hace ${ago}d`}</div>}
              {day.some(r=>r.tipo==="stock")&&<span style={{ fontSize:9,background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",padding:"1px 7px",borderRadius:4,fontWeight:500 }}>Stock</span>}
            </div>
            <div style={{ background:"#fff",border:"1px solid #f0f0f0",borderRadius:8,overflow:"hidden" }}>
              {day.map((r,i)=>(
                <HistorialRow key={r.id||i} r={r} sede={sede} day={day} i={i}
                  onUpdate={updated=>onRecordUpdate?.(updated)}
                  canDelete={canDelete} onDelete={id=>onRecordDelete?.(id)}/>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Directorio ─────────────────────────────────────────────────────────────────
function DirectorioCM({ conn, catOverrides, onCatOverride }) {
  const [subTab, setSubTab] = useState("comerciales");
  const [map, setMap] = useState(getSedeCMMap());
  const [syncing, setSyncing] = useState(null);
  const [editingProd, setEditingProd] = useState(null); // producto name being edited
  const [savingProd, setSavingProd] = useState(null);
  const [showCreateProd, setShowCreateProd] = useState(false);
  const [newGlobalProd, setNewGlobalProd] = useState({ producto:"", categoria:"Aseo", proveedor:"Aseo", min_stock:1 });
  const [savingNew, setSavingNew] = useState(false);

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

  const handleCatChange = async (producto, newCat) => {
    setSavingProd(producto);
    try { await onCatOverride(producto, newCat); }
    catch(e) { console.error(e); }
    finally { setSavingProd(null); setEditingProd(null); }
  };

  const handleCreateProd = async () => {
    if (!newGlobalProd.producto.trim()) return;
    setSavingNew(true);
    try {
      await upsertConfig("prod_global", newGlobalProd.producto.trim(), JSON.stringify({
        categoria: newGlobalProd.categoria,
        proveedor: newGlobalProd.proveedor || newGlobalProd.categoria,
        min_stock: Number(newGlobalProd.min_stock) || 1,
      }));
      await onCatOverride(newGlobalProd.producto.trim(), newGlobalProd.categoria);
      setNewGlobalProd({ producto:"", categoria:"Aseo", proveedor:"Aseo", min_stock:1 });
      setShowCreateProd(false);
    } catch(e) { console.error(e); }
    finally { setSavingNew(false); }
  };

  // Build unique product list with current categories
  const allProducts = useMemo(()=>{
    const seen = new Set();
    const out = [];
    for (const prods of Object.values(INVENTARIO_CATALOG)) {
      for (const p of prods) {
        if (!seen.has(p.producto)) {
          seen.add(p.producto);
          out.push({ producto: p.producto, categoriaBase: p.categoria, subcategoria: p.subcategoria||null });
        }
      }
    }
    return out.sort((a,b)=>a.producto.localeCompare(b.producto));
  },[]);

  const subBtn = (id, label) => (
    <button onClick={()=>setSubTab(id)} style={{
      padding:"5px 12px",fontSize:10,fontWeight:500,cursor:"pointer",borderRadius:5,
      border:subTab===id?"none":"1px solid #e5e5e5",
      background:subTab===id?"#1a1a1a":"#fff",color:subTab===id?"#fff":"#737373",
      fontFamily:"'Sora',sans-serif"
    }}>{label}</button>
  );

  const prodsByCategory = useMemo(()=>{
    const g = {};
    for (const p of allProducts) {
      const cat = catOverrides[p.producto] || CAT_FIX[p.producto] || p.categoriaBase;
      if (!g[cat]) g[cat] = [];
      g[cat].push({...p, categoriaActual: cat});
    }
    return g;
  },[allProducts, catOverrides]);

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", flex:1 }}>
      {/* Sub-tabs */}
      <div style={{ display:"flex",gap:6,marginBottom:16,alignItems:"center" }}>
        {subBtn("comerciales","Comerciales")}
        {subBtn("insumos","Insumos")}
        {conn
          ? <span style={{ fontSize:10,color:"#16a34a",display:"flex",alignItems:"center",gap:3,marginLeft:8 }}><span style={{ width:5,height:5,borderRadius:99,background:"#22c55e",display:"inline-block" }}/>Sincronizado</span>
          : <span style={{ fontSize:10,color:"#f59e0b",marginLeft:8 }}>Solo local</span>
        }
      </div>

      {subTab==="comerciales"&&(
        <>
          <div style={{ fontSize:9,fontWeight:700,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>Asignación de sedes ({cmUsers.length} comerciales)</div>
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
        </>
      )}

      {subTab==="insumos"&&(
        <>
          <div style={{ fontSize:9,fontWeight:700,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10 }}>
            Categorías de insumos ({allProducts.length} productos)
          </div>
          {CAT_ORDER.map(cat=>{
            const prods = prodsByCategory[cat]||[];
            if (!prods.length) return null;
            return (
              <div key={cat} style={{ marginBottom:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
                  <span style={{ width:7,height:7,borderRadius:99,background:CAT_COLORS[cat],display:"inline-block" }}/>
                  <span style={{ fontSize:9,fontWeight:700,color:CAT_COLORS[cat],textTransform:"uppercase",letterSpacing:"0.06em" }}>{cat}</span>
                  <span style={{ fontSize:9,color:"#b3b3b3" }}>({prods.length})</span>
                </div>
                <div style={{ background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,overflow:"hidden" }}>
                  {prods.map((p,i)=>{
                    const isEditing = editingProd===p.producto;
                    const isSaving = savingProd===p.producto;
                    const hasOverride = !!catOverrides[p.producto] || !!CAT_FIX[p.producto];
                    return (
                      <div key={p.producto} style={{ display:"flex",alignItems:"center",gap:12,padding:"9px 16px",borderBottom:i<prods.length-1?"1px solid #f5f5f5":"none" }}>
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:12,fontWeight:500 }}>{p.producto}</span>
                          {hasOverride&&!isEditing&&<span style={{ fontSize:9,color:"#6366f1",marginLeft:6,background:"#f0f0ff",padding:"1px 5px",borderRadius:3 }}>editado</span>}
                        </div>
                        {isEditing?(
                          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                            <select defaultValue={p.categoriaActual}
                              id={`cat-sel-${p.producto}`}
                              style={{ ...I,width:130,fontSize:11,cursor:"pointer" }}>
                              {CAT_ORDER.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                              onClick={()=>{
                                const sel=document.getElementById(`cat-sel-${p.producto}`);
                                if(sel) handleCatChange(p.producto, sel.value);
                              }}
                              disabled={isSaving}
                              style={{ ...BP,padding:"5px 10px",fontSize:10,opacity:isSaving?0.5:1 }}>
                              {isSaving?"…":"OK"}
                            </button>
                            <button onClick={()=>setEditingProd(null)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#a3a3a3",fontSize:10 }}>✕</button>
                          </div>
                        ):(
                          <button onClick={()=>setEditingProd(p.producto)}
                            style={{ fontSize:10,color:"#6366f1",background:"none",border:"1px solid #e0e0ff",borderRadius:5,padding:"3px 9px",cursor:"pointer",fontFamily:"'Sora',sans-serif" }}>
                            Cambiar cat.
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Create new product */}
          <div style={{ marginTop:8 }}>
            {!showCreateProd ? (
              <button onClick={()=>setShowCreateProd(true)} style={{ fontSize:11,color:"#6366f1",background:"none",border:"1px dashed #c4b5fd",borderRadius:6,padding:"7px 14px",cursor:"pointer",fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",gap:5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Crear nuevo insumo
              </button>
            ) : (
              <div style={{ background:"#fafafa",border:"1px solid #e5e5e5",borderRadius:10,padding:"14px 16px" }}>
                <div style={{ fontSize:10,fontWeight:700,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10 }}>Nuevo insumo</div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end" }}>
                  <div style={{ flex:2,minWidth:160 }}>
                    <label style={FL}>Nombre</label>
                    <input value={newGlobalProd.producto} onChange={e=>setNewGlobalProd(p=>({...p,producto:e.target.value}))}
                      placeholder="Ej: Alcohol Gel" style={{ ...I,fontSize:12 }}/>
                  </div>
                  <div style={{ flex:1,minWidth:110 }}>
                    <label style={FL}>Categoría</label>
                    <select value={newGlobalProd.categoria} onChange={e=>setNewGlobalProd(p=>({...p,categoria:e.target.value,proveedor:e.target.value}))}
                      style={{ ...I,cursor:"pointer",fontSize:12 }}>
                      {CAT_ORDER.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ width:70 }}>
                    <label style={FL}>Mín.</label>
                    <input type="number" min="1" value={newGlobalProd.min_stock} onChange={e=>setNewGlobalProd(p=>({...p,min_stock:e.target.value}))}
                      style={{ ...I,textAlign:"center",fontSize:12 }}/>
                  </div>
                  <button onClick={handleCreateProd} disabled={!newGlobalProd.producto.trim()||savingNew}
                    style={{ ...BP,padding:"8px 14px",opacity:newGlobalProd.producto.trim()&&!savingNew?1:0.4,flexShrink:0 }}>
                    {savingNew?"Guardando…":"Crear"}
                  </button>
                  <button onClick={()=>setShowCreateProd(false)} style={{ background:"none",border:"1px solid #e5e5e5",borderRadius:6,padding:"7px 9px",cursor:"pointer",color:"#a3a3a3",fontSize:11,flexShrink:0 }}>✕</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function Inventario({ user, conn }) {
  const [records, setRecords] = useState(getCached());
  const [loading, setLoading] = useState(false);
  const [catOverrides, setCatOverrides] = useState({});
  const [breakevenMap, setBreakevenMap] = useState({});

  useEffect(()=>{
    if (!conn) return;
    setLoading(true);
    Promise.all([fetchInventario(), fetchConfig()])
      .then(([data, configRows])=>{
        setRecords(data); setCached(data);
        setCatOverrides(parseProdCat(configRows));
        setBreakevenMap(parseBreakeven(configRows));
      })
      .catch(e=>console.error(e))
      .finally(()=>setLoading(false));
  },[conn]);

  const onCatOverride = async (producto, categoria) => {
    const next = { ...catOverrides, [producto]: categoria };
    setCatOverrides(next);
    if (conn) {
      try { await upsertConfig("prod_cat", producto, categoria); }
      catch(e) { console.error(e); }
    }
  };

  const onBreakevenChange = async (sede, producto, value) => {
    const key = `${sede}||${producto}`;
    const next = { ...breakevenMap, [key]: value };
    setBreakevenMap(next);
    if (conn) {
      try { await upsertConfig("breakeven", key, String(value)); }
      catch(e) { console.error(e); }
    }
  };

  const isAdmin = user.role==="admin"||user.role==="ops";

  if (loading) return (
    <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#a3a3a3",fontSize:13,fontFamily:"'Sora',sans-serif" }}>
      Cargando inventario…
    </div>
  );

  return isAdmin
    ? <InventarioAdmin records={records} user={user} conn={conn} onSaved={setRecords} catOverrides={catOverrides} breakevenMap={breakevenMap} onCatOverride={onCatOverride} onBreakevenChange={onBreakevenChange}/>
    : <InventarioCM user={user} records={records} onSaved={setRecords} conn={conn} breakevenMap={breakevenMap}/>;
}
