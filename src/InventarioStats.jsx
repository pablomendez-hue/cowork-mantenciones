import { useState, useEffect, useMemo } from "react";
import { INVENTARIO_CATALOG, INVENTARIO_SEDES } from "./inventario_catalog.js";
import { INVENTARIO_EXCEL_TREND, INVENTARIO_EXCEL_LATEST } from "./inventario_history.js";
import { fetchInventario } from "./inventario_sheets.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCached(){try{return JSON.parse(localStorage.getItem("cw_inv_cache")||"[]")}catch{return[]}}
function getLevel(qty,min){if(qty==null)return"nd";if(qty<=0)return"rojo";if(qty<=min)return"amarillo";return"ok"}
function getMinStk(sede,prov,prod){return(INVENTARIO_CATALOG[sede]||[]).find(p=>p.proveedor===prov&&p.producto===prod)?.min_stock??null}
function fdate(d){if(!d)return"—";return new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short"})}
function median(arr){if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);const h=Math.floor(s.length/2);return s.length%2?s[h]:(s[h-1]+s[h])/2}

function buildLatest(live){
  const m={...INVENTARIO_EXCEL_LATEST};
  for(const r of live){
    if(r.tipo!=="stock")continue;
    const k=`${r.sede}||${r.proveedor}||${r.producto}`;
    if(!m[k]||r.fecha>=m[k].fecha)m[k]={fecha:r.fecha,cantidad:r.cantidad};
  }
  return m;
}
function buildTrend(live){
  const m={};
  for(const[k,v]of Object.entries(INVENTARIO_EXCEL_TREND))m[k]=[...v];
  for(const r of live){
    if(r.tipo!=="stock")continue;
    const k=`${r.sede}||${r.proveedor}||${r.producto}`;
    if(!m[k])m[k]=[];
    m[k].push([r.fecha,r.cantidad]);
  }
  for(const k of Object.keys(m))m[k]=m[k].sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  return m;
}

function getAllProds(){
  const seen=new Set(),out=[];
  for(const sp of Object.values(INVENTARIO_CATALOG)){
    for(const p of sp){
      const k=`${p.proveedor}||${p.producto}`;
      if(!seen.has(k)){seen.add(k);out.push({proveedor:p.proveedor,producto:p.producto,categoria:p.categoria,subcategoria:p.subcategoria||null});}
    }
  }
  return out;
}

function getStats(prov,prod,latestMap,trendMap){
  const sedes=INVENTARIO_SEDES.filter(s=>(INVENTARIO_CATALOG[s]||[]).some(p=>p.proveedor===prov&&p.producto===prod));
  const dm={};
  for(const s of sedes){
    for(const[f,q]of(trendMap[`${s}||${prov}||${prod}`]||[])){dm[f]=(dm[f]||0)+q;}
  }
  const sedeStatus=sedes.map(s=>{
    const min=getMinStk(s,prov,prod);
    const e=latestMap[`${s}||${prov}||${prod}`];
    return{sede:s,cantidad:e?.cantidad??null,min,level:getLevel(e?.cantidad??null,min),fecha:e?.fecha};
  });
  const total=sedeStatus.reduce((s,x)=>s+(x.cantidad||0),0);
  // Replace the latest date in agg with the real total so chart last point = total actual
  let agg=Object.entries(dm).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  const latestDate=sedeStatus.filter(s=>s.fecha).reduce((d,s)=>s.fecha>d?s.fecha:d,"");
  if(latestDate){
    agg=[...agg.filter(([d])=>d!==latestDate),[latestDate,total]]
      .sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);
  }
  const med=median(agg.map(([,v])=>v));
  return{agg,med,sedeStatus,total,alerts:sedeStatus.filter(x=>x.level==="rojo"||x.level==="amarillo"),sedeCount:sedes.length};
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CAT_ORDER=["Cafetería","Aseo","Papelería"];
const CAT_COLOR={"Aseo":"#3b82f6","Cafetería":"#f97316","Papelería":"#8b5cf6"};
const SUBCAT_PRI={"Café Caribe":0,"Corporate Coffee":1};
const LV_COLOR={rojo:"#ef4444",amarillo:"#f59e0b",ok:"#22c55e",nd:"#d4d4d4"};

// ── Chart ─────────────────────────────────────────────────────────────────────
function ProdChart({data,med,width=312,height=60}){
  if(!data||data.length<2)return<div style={{width,height,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#e5e5e5"}}>Sin datos</div>;
  const pl=4,pr=32,pt=10,pb=6;
  const vals=data.map(d=>d[1]);
  const maxV=Math.max(...vals,med*1.4,1);
  const xS=(width-pl-pr)/(data.length-1);
  const y=v=>height-pb-((v/maxV)*(height-pt-pb));
  const mY=y(med);
  const pts=data.map(([,v],i)=>({x:pl+i*xS,y:y(v),v}));
  const pD=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last=pts[pts.length-1];
  return(
    <svg width={width} height={height} style={{display:"block",overflow:"visible"}}>
      {/* Median line */}
      <line x1={pl} y1={mY} x2={width-pr} y2={mY} stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="5,3"/>
      <text x={width-pr+4} y={mY+3.5} fontSize="8.5" fill="#94a3b8" fontFamily="'JetBrains Mono',monospace">{Math.round(med)}</text>
      {/* Area */}
      <path d={pD+` L${pts[pts.length-1].x},${height-pb} L${pts[0].x},${height-pb} Z`} fill="#3b82f610"/>
      {/* Line */}
      <path d={pD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Dots */}
      {pts.map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r={i===pts.length-1?3:1.8}
          fill={p.v>=med?"#22c55e":"#f59e0b"} stroke="#fff" strokeWidth={i===pts.length-1?1.5:1}/>
      ))}
      {/* Last value */}
      <text x={last.x} y={Math.min(last.y-6,height-pb-2)} fontSize="9" fill="#374151"
        textAnchor="middle" fontWeight="600" fontFamily="'JetBrains Mono',monospace">{Math.round(last.v)}</text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InventarioStats({conn}){
  const[records,setRecords]=useState(getCached());
  const[cat,setCat]=useState("Cafetería");
  const[sub,setSub]=useState("Café Caribe");
  const[exp,setExp]=useState(null);

  useEffect(()=>{
    if(!conn)return;
    fetchInventario().then(d=>setRecords(d)).catch(()=>{});
  },[conn]);

  const latestMap=useMemo(()=>buildLatest(records),[records]);
  const trendMap=useMemo(()=>buildTrend(records),[records]);
  const allProds=useMemo(()=>getAllProds(),[]);

  const subcats=useMemo(()=>{
    const s=[...new Set(allProds.filter(p=>p.categoria===cat&&p.subcategoria).map(p=>p.subcategoria))];
    return s.sort((a,b)=>(SUBCAT_PRI[a]??9)-(SUBCAT_PRI[b]??9));
  },[allProds,cat]);

  const filtProds=useMemo(()=>{
    return allProds
      .filter(p=>p.categoria===cat&&(sub===null||p.subcategoria===sub))
      .sort((a,b)=>{
        const sa=(SUBCAT_PRI[a.subcategoria]??9)-(SUBCAT_PRI[b.subcategoria]??9);
        return sa!==0?sa:a.producto.localeCompare(b.producto);
      });
  },[allProds,cat,sub]);

  const summary=useMemo(()=>{
    let rojo=0,amarillo=0;
    for(const p of filtProds){
      const{alerts}=getStats(p.proveedor,p.producto,latestMap,trendMap);
      for(const s of alerts){if(s.level==="rojo")rojo++;else amarillo++;}
    }
    return{rojo,amarillo};
  },[filtProds,latestMap,trendMap]);

  const btnCat=(c)=>(
    <button key={c} onClick={()=>{setCat(c);setSub(c==="Cafetería"?"Café Caribe":null);}} style={{
      padding:"5px 14px",fontSize:11,fontWeight:500,cursor:"pointer",borderRadius:6,
      fontFamily:"'Sora',sans-serif",transition:"all 0.1s",
      border:cat===c?"none":"1px solid #e5e5e5",
      background:cat===c?CAT_COLOR[c]:"#fff",
      color:cat===c?"#fff":"#737373"
    }}>{c}</button>
  );
  const btnSub=(s,label)=>(
    <button key={s??'all'} onClick={()=>setSub(s)} style={{
      padding:"4px 11px",fontSize:10,fontWeight:sub===s?600:400,cursor:"pointer",borderRadius:5,
      fontFamily:"'Sora',sans-serif",
      border:sub===s?"1px solid #f97316":"1px solid #e5e5e5",
      background:sub===s?"#fff7ed":"#fff",
      color:sub===s?"#ea580c":"#737373"
    }}>{label}</button>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,fontFamily:"'Sora',sans-serif"}}>
      {/* Header */}
      <div style={{padding:"10px 24px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:8,flexShrink:0,flexWrap:"wrap"}}>
        <span style={{fontSize:12,fontWeight:700,color:"#1a1a1a",marginRight:4}}>Insumos</span>
        <div style={{display:"flex",gap:4}}>{CAT_ORDER.map(btnCat)}</div>
        {subcats.length>0&&<>
          <span style={{width:1,height:18,background:"#e5e5e5",margin:"0 2px"}}/>
          <div style={{display:"flex",gap:4}}>
            {btnSub(null,"Todos")}
            {subcats.map(s=>btnSub(s,s))}
          </div>
        </>}
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {summary.rojo>0&&<span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:6,height:6,borderRadius:99,background:"#ef4444",display:"inline-block"}}/>
            <strong style={{color:"#dc2626",fontFamily:"'JetBrains Mono',monospace"}}>{summary.rojo}</strong>
            <span style={{color:"#a3a3a3"}}>sin stock</span>
          </span>}
          {summary.amarillo>0&&<span style={{fontSize:11,display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:6,height:6,borderRadius:99,background:"#f59e0b",display:"inline-block"}}/>
            <strong style={{color:"#b45309",fontFamily:"'JetBrains Mono',monospace"}}>{summary.amarillo}</strong>
            <span style={{color:"#a3a3a3"}}>bajo mín</span>
          </span>}
        </div>
      </div>

      {/* Grid */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
        {filtProds.length===0&&<div style={{textAlign:"center",color:"#d4d4d4",fontSize:12,padding:40}}>Sin productos en esta categoría</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:12}}>
          {filtProds.map(p=>{
            const k=`${p.proveedor}||${p.producto}`;
            const st=getStats(p.proveedor,p.producto,latestMap,trendMap);
            const isExp=exp===k;
            const reds=st.alerts.filter(x=>x.level==="rojo").length;
            const ambs=st.alerts.filter(x=>x.level==="amarillo").length;
            const needOrder=st.total<st.med&&st.med>0;
            return(
              <div key={k} style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,overflow:"hidden",
                borderLeft:`3px solid ${reds>0?"#ef4444":ambs>0?"#f59e0b":"#e5e5e5"}`}}>
                {/* Header */}
                <div style={{padding:"12px 14px 10px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#1a1a1a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.producto}</div>
                      <div style={{fontSize:10,color:"#a3a3a3",marginTop:1}}>{p.proveedor}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                      <div style={{fontSize:24,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,color:reds>0?"#dc2626":ambs>0?"#b45309":"#1a1a1a"}}>{Math.round(st.total)}</div>
                      <div style={{fontSize:9,color:"#a3a3a3",marginTop:1}}>total actual</div>
                    </div>
                  </div>
                  <ProdChart data={st.agg} med={st.med}/>
                  {/* Stats strip */}
                  <div style={{display:"flex",gap:16,marginTop:8,paddingTop:8,borderTop:"1px solid #f9f9f9",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:9,color:"#a3a3a3",textTransform:"uppercase",letterSpacing:"0.04em"}}>Equilibrio</div>
                      <div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#6366f1"}}>{Math.round(st.med)}</div>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:"#a3a3a3",textTransform:"uppercase",letterSpacing:"0.04em"}}>OK</div>
                      <div style={{fontSize:14,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",color:"#16a34a"}}>
                        {st.sedeStatus.filter(x=>x.level==="ok").length}
                        <span style={{fontSize:10,color:"#d4d4d4",fontWeight:400}}>/{st.sedeCount}</span>
                      </div>
                    </div>
                    {reds>0&&<div>
                      <div style={{fontSize:9,color:"#a3a3a3",textTransform:"uppercase",letterSpacing:"0.04em"}}>Sin stock</div>
                      <div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#dc2626"}}>{reds}</div>
                    </div>}
                    {ambs>0&&<div>
                      <div style={{fontSize:9,color:"#a3a3a3",textTransform:"uppercase",letterSpacing:"0.04em"}}>Bajo mín</div>
                      <div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#b45309"}}>{ambs}</div>
                    </div>}
                    {needOrder&&<div style={{marginLeft:"auto"}}>
                      <span style={{fontSize:9,fontWeight:600,background:"#fef3c7",color:"#b45309",border:"1px solid #fde68a",padding:"3px 9px",borderRadius:4}}>↑ Pedir</span>
                    </div>}
                  </div>
                </div>

                {/* Alert sedes */}
                {st.alerts.length>0&&<div style={{padding:"7px 14px 8px",borderTop:"1px solid #f5f5f5"}}>
                  <div style={{fontSize:9,fontWeight:600,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>Pedir en</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {st.alerts.sort((a,b)=>(a.level==="rojo"?0:1)-(b.level==="rojo"?0:1)).map(s=>(
                      <span key={s.sede} style={{fontSize:9,fontWeight:500,padding:"2px 8px",borderRadius:4,
                        background:s.level==="rojo"?"#fef2f2":"#fffbeb",
                        color:s.level==="rojo"?"#dc2626":"#b45309",
                        border:`1px solid ${s.level==="rojo"?"#fecaca":"#fde68a"}`}}>
                        {s.sede.length>14?s.sede.slice(0,13)+"…":s.sede}
                        {s.cantidad!==null&&<span style={{marginLeft:3,opacity:0.65}}>{s.cantidad}</span>}
                      </span>
                    ))}
                  </div>
                </div>}

                {/* Expand: all sedes */}
                <div style={{padding:"6px 14px 8px",borderTop:"1px solid #f5f5f5"}}>
                  <button onClick={()=>setExp(isExp?null:k)} style={{fontSize:10,color:"#6366f1",background:"none",border:"none",cursor:"pointer",fontFamily:"'Sora',sans-serif",padding:0,display:"flex",alignItems:"center",gap:4}}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {isExp?<polyline points="18 15 12 9 6 15"/>:<polyline points="6 9 12 15 18 9"/>}
                    </svg>
                    {isExp?"Ocultar":"Ver todas las sedes"}
                  </button>
                  {isExp&&(
                    <div style={{marginTop:8}}>
                      {st.sedeStatus.sort((a,b)=>{const o={rojo:0,amarillo:1,ok:2,nd:3};return o[a.level]-o[b.level]}).map(s=>(
                        <div key={s.sede} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:"1px solid #f9f9f9"}}>
                          <span style={{width:6,height:6,borderRadius:99,background:LV_COLOR[s.level],flexShrink:0,display:"inline-block"}}/>
                          <span style={{flex:1,fontSize:10,color:"#525252"}}>{s.sede}</span>
                          <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:s.level==="rojo"?700:s.level==="amarillo"?600:400,
                            color:s.level==="nd"?"#d4d4d4":s.level==="ok"?"#525252":LV_COLOR[s.level]}}>
                            {s.cantidad??<span style={{color:"#e5e5e5"}}>—</span>}
                          </span>
                          <span style={{fontSize:9,color:"#d4d4d4"}}>/{s.min}</span>
                          {s.fecha&&<span style={{fontSize:9,color:"#b3b3b3"}}>{fdate(s.fecha)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
