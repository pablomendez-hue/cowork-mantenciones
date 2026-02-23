import { useState, useCallback, useEffect, useRef } from "react";
import { COLUMNS, COL_IDS, CATEGORIES, PRIORITY, SEDES, USERS, ROLE_LABELS, ROLE_COLORS, fmt, fdate, daysAgo, today } from "./constants.js";
import { isConfigured, fetchAllTickets, createTicket, updateTicket, deleteTicket, testConnection } from "./sheets.js";

const DEMO_DATA = [
  { id:1, num:1, category:"Servicio Adicional", desc:"Instalacion de 12 tomacorrientes oficina piso 7", sede:"Suecia", priority:"Alta", stage:"finalizado", by:"Ana Rondon", date:"2026-01-21", provider:"Servicios e Ingenieria IA SPA", amount:642600, payment:"100", closedAt:"2026-02-01", execDate:"2026-01-28", comments:[] },
  { id:2, num:2, category:"Mantencion", desc:"Cambio rejilla desague lavaplatos", sede:"SalesForce", priority:"Urgente", stage:"en_proceso", by:"Luis Morales", date:"2025-12-03", provider:"Servicios e Ingenieria IA SPA", amount:95200, payment:"50", closedAt:null, execDate:"2026-02-20", comments:[] },
  { id:3, num:3, category:"Servicio Adicional", desc:"Instalacion tope puerta oficinas piso 3", sede:"Abedules", priority:"Baja", stage:"pago", by:"Ana Rondon", date:"2026-02-12", provider:"Servicios e Ingenieria IA", amount:71400, payment:null, closedAt:null, execDate:null, comments:[] },
  { id:4, num:4, category:"Aire Acondicionado", desc:"Revision y recarga gas split oficina 301", sede:"Plaza Egana", priority:"Media", stage:"requerimiento", by:"Vito Lacasella", date:"2026-02-17", provider:null, amount:null, payment:null, closedAt:null, execDate:null, comments:[] },
];

function getCustomSedes(){try{return JSON.parse(localStorage.getItem("cowork_custom_sedes")||"[]")}catch{return[]}}
function saveCustomSede(s){const l=getCustomSedes();if(!l.includes(s)&&!SEDES.includes(s)){l.push(s);localStorage.setItem("cowork_custom_sedes",JSON.stringify(l))}}
function getAllSedes(){return[...SEDES,...getCustomSedes()].sort((a,b)=>a.localeCompare(b))}
function getProviders(){try{return JSON.parse(localStorage.getItem("cowork_providers")||"[]")}catch{return[]}}
function saveProvider(n){if(!n)return;const l=getProviders();if(!l.includes(n)){l.push(n);localStorage.setItem("cowork_providers",JSON.stringify(l))}}
function getCurrentUser(){try{return JSON.parse(localStorage.getItem("cowork_user"))}catch{return null}}
function setCurrentUser(u){localStorage.setItem("cowork_user",JSON.stringify(u))}
function logoutUser(){localStorage.removeItem("cowork_user")}

const S={appearance:"none",WebkitAppearance:"none",background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 11px",fontSize:12,color:"#1a1a1a",width:"100%",fontFamily:"'Sora',sans-serif",outline:"none",transition:"border-color 0.12s",boxSizing:"border-box"};
const BP={background:"#1a1a1a",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,transition:"opacity 0.12s"};
const BD={background:"#fff",color:"#525252",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif"};
const FL={fontSize:10,fontWeight:500,color:"#a3a3a3",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"};
const SL={fontSize:9,fontWeight:600,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10};
const ML={fontSize:9,color:"#b3b3b3",marginBottom:1};
const FB={padding:"5px 10px",borderRadius:5,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",transition:"all 0.12s"};

/* ── LOGIN SCREEN ── */
function LoginScreen({onLogin}){
  const[email,setEmail]=useState("");
  const[err,setErr]=useState("");
  const handle=()=>{
    const u=USERS.find(u=>u.email.toLowerCase()===email.trim().toLowerCase());
    if(u){setCurrentUser(u);onLogin(u)}else{setErr("Correo no autorizado")}
  };
  return(
    <div style={{fontFamily:"'Sora',sans-serif",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa"}}>
      <div style={{background:"#fff",borderRadius:12,padding:"40px 36px",width:380,maxWidth:"92vw",boxShadow:"0 8px 32px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:"-0.03em"}}>Cowork LABS</div>
          <div style={{fontSize:12,color:"#b3b3b3",marginTop:4}}>Mantenciones</div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={FL}>Correo corporativo</label>
          <input value={email} onChange={e=>{setEmail(e.target.value);setErr("")}} placeholder="tu@co-work.cl" style={S} onKeyDown={e=>e.key==="Enter"&&handle()} autoFocus/>
        </div>
        {err&&<div style={{color:"#dc2626",fontSize:11,marginBottom:12,background:"#fef2f2",padding:"8px 12px",borderRadius:6}}>{err}</div>}
        <button onClick={handle} disabled={!email.trim()} style={{...BP,width:"100%",justifyContent:"center",padding:"10px 16px",opacity:email.trim()?1:0.35,cursor:email.trim()?"pointer":"not-allowed"}}>Entrar</button>
        <div style={{marginTop:20,fontSize:10,color:"#d4d4d4",textAlign:"center"}}>Solo correos autorizados</div>
      </div>
    </div>
  );
}

/* ── SEDE SELECTOR ── */
function SedeSelector({value,onChange}){
  const[isOtro,setIsOtro]=useState(false);const[custom,setCustom]=useState("");const sedes=getAllSedes();
  const handleSelect=(e)=>{const v=e.target.value;if(v==="__otro__"){setIsOtro(true);onChange("")}else{setIsOtro(false);onChange(v)}};
  const handleSaveCustom=()=>{if(custom.trim()){saveCustomSede(custom.trim());onChange(custom.trim());setIsOtro(false);setCustom("")}};
  if(isOtro)return(<div style={{display:"flex",gap:4}}><input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Nombre sede..." style={{...S,flex:1}} onKeyDown={e=>e.key==="Enter"&&handleSaveCustom()} autoFocus/><button onClick={handleSaveCustom} disabled={!custom.trim()} style={{...BP,padding:"8px 10px",opacity:custom.trim()?1:0.35}}>OK</button><button onClick={()=>{setIsOtro(false);setCustom("")}} style={{...BD,padding:"8px 10px"}}>X</button></div>);
  return(<select value={value} onChange={handleSelect} style={{...S,cursor:"pointer"}}><option value="">Seleccionar...</option>{sedes.map(s=><option key={s} value={s}>{s}</option>)}<option value="__otro__">+ Otra sede...</option></select>);
}

/* ── PROVIDER INPUT ── */
function ProviderInput({value,onChange}){
  const[showList,setShowList]=useState(false);const ref=useRef(null);const providers=getProviders();
  const filtered=value?providers.filter(p=>p.toLowerCase().includes(value.toLowerCase())):providers;
  useEffect(()=>{const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setShowList(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);
  return(<div ref={ref} style={{position:"relative"}}><input value={value} onChange={e=>{onChange(e.target.value);setShowList(true)}} onFocus={()=>setShowList(true)} placeholder="Nombre del proveedor" style={S}/>{showList&&filtered.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:2,background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,boxShadow:"0 8px 24px rgba(0,0,0,0.08)",zIndex:20,maxHeight:160,overflowY:"auto"}}>{filtered.map(p=>(<div key={p} onClick={()=>{onChange(p);setShowList(false)}} style={{padding:"8px 12px",fontSize:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f5f5f5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{p}</div>))}</div>)}</div>);
}

/* ── CARD ── */
function Card({item,onOpen,onDragStart}){
  const cat=CATEGORIES[item.category];const pri=PRIORITY[item.priority];const age=daysAgo(item.date);
  return(
    <div draggable onDragStart={(e)=>{e.dataTransfer.setData("text/plain",String(item.id));e.dataTransfer.effectAllowed="move";onDragStart(item.id)}} onClick={()=>onOpen(item)}
      style={{background:"#fff",border:"1px solid #ebebeb",borderRadius:8,padding:"10px 12px",cursor:"grab",transition:"box-shadow 0.12s, transform 0.12s",borderLeft:"3px solid "+cat.color}}
      onMouseEnter={(e)=>{e.currentTarget.style.boxShadow="0 3px 12px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(-1px)"}}
      onMouseLeave={(e)=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:9,fontWeight:700,color:"#737373",fontFamily:"'JetBrains Mono',monospace"}}>{"#"+String(item.num).padStart(3,"0")}</span>
          <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:cat.color,background:cat.bg,border:"1px solid "+cat.border,padding:"1px 6px",borderRadius:3}}>
            {item.category==="Aire Acondicionado"?"A/C":item.category==="Servicio Adicional"?"SA":"MNT"}
          </span>
        </div>
        <span style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:pri.color,fontWeight:500}}>
          <span style={{width:5,height:5,borderRadius:99,background:pri.dot}}/>{item.priority}
        </span>
      </div>
      <div style={{fontSize:12,fontWeight:500,lineHeight:1.35,color:"#1a1a1a",marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.desc}</div>
      {item.provider&&(<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style={{fontSize:10,color:"#737373",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{item.provider}</span></div>)}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:"#b3b3b3"}}>{item.sede}</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {item.amount!=null&&<span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,color:"#525252"}}>{fmt(item.amount)}</span>}
          <span style={{fontSize:9,color:age>14?"#ef4444":age>7?"#f59e0b":"#b3b3b3",fontWeight:age>14?600:400,fontFamily:"'JetBrains Mono',monospace"}}>{age}d</span>
        </div>
      </div>
    </div>
  );
}

/* ── COLUMN ── */
function Column({col,items,onOpen,onDragStart,onDrop,dragOverCol,setDragOverCol}){
  const isOver=dragOverCol===col.id;const total=items.reduce((s,i)=>s+(i.amount||0),0);
  return(
    <div style={{flex:1,minWidth:240,maxWidth:340,display:"flex",flexDirection:"column",height:"100%"}}
      onDragOver={(e)=>{e.preventDefault();e.dataTransfer.dropEffect="move";setDragOverCol(col.id)}} onDragLeave={()=>setDragOverCol(null)}
      onDrop={(e)=>{e.preventDefault();onDrop(Number(e.dataTransfer.getData("text/plain")),col.id);setDragOverCol(null)}}>
      <div style={{padding:"0 2px 10px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15}}>{col.icon}</span><span style={{fontSize:13,fontWeight:600}}>{col.label}</span><span style={{background:"#f0f0f0",color:"#737373",fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:99,fontFamily:"'JetBrains Mono',monospace"}}>{items.length}</span></div>
        <div style={{fontSize:10,color:"#b3b3b3",marginTop:1,paddingLeft:25}}>{col.sub}{total>0&&<span style={{marginLeft:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,color:"#999"}}>{"· "+fmt(total)}</span>}</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:3,borderRadius:10,background:isOver?"#f0f7ff":"transparent",border:isOver?"2px dashed #3b82f6":"2px solid transparent",transition:"all 0.15s",display:"flex",flexDirection:"column",gap:6}}>
        {items.length===0&&<div style={{padding:"24px 12px",textAlign:"center",color:"#e0e0e0",fontSize:11,border:"1px dashed #e5e5e5",borderRadius:8}}>Arrastra aqui</div>}
        {items.map(item=><Card key={item.id} item={item} onOpen={onOpen} onDragStart={onDragStart}/>)}
      </div>
    </div>
  );
}

/* ── DETAIL PANEL ── */
function DetailPanel({item,onClose,onUpdate,onDelete,saving,user}){
  const cat=CATEGORIES[item.category];const pri=PRIORITY[item.priority];const colIdx=COL_IDS.indexOf(item.stage);
  const[comment,setComment]=useState("");const[provider,setProvider]=useState(item.provider||"");
  const[amount,setAmount]=useState(item.amount||"");const[payment,setPayment]=useState(item.payment||"");
  const[execDate,setExecDate]=useState(item.execDate||"");const[confirmDel,setConfirmDel]=useState(false);
  const canApprovePayment=user.role==="admin";
  const canFinalize=user.role==="ops"||user.role==="admin";
  const canDelete=user.role==="admin";

  const handleComment=()=>{if(!comment.trim())return;onUpdate(item.id,{comments:[...(item.comments||[]),{who:user.name,text:comment,date:today()}]});setComment("")};
  const handleDeleteComment=(idx)=>{const c=[...(item.comments||[])];c.splice(idx,1);onUpdate(item.id,{comments:c})};
  const handleSaveQuote=()=>{if(!provider||!amount)return;saveProvider(provider);onUpdate(item.id,{provider,amount:Number(amount),stage:"pago"})};
  const handleSavePayment=()=>{if(!payment||Number(payment)<=0)return;onUpdate(item.id,{payment,stage:"en_proceso"})};
  const handleSaveExecDate=()=>{if(execDate)onUpdate(item.id,{execDate})};
  const handleFinalize=()=>{onUpdate(item.id,{stage:"finalizado",closedAt:today()})};
  const handleDelete=()=>{onDelete(item.id);onClose()};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",zIndex:1000,display:"flex",justifyContent:"flex-end",backdropFilter:"blur(3px)",animation:"fadeIn 0.1s ease"}} onClick={onClose}>
      <div style={{width:500,maxWidth:"94vw",background:"#fff",height:"100vh",overflowY:"auto",borderLeft:"1px solid #e5e5e5",animation:"slideIn 0.15s ease",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        {saving&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#3b82f6",animation:"pulse 1s infinite",zIndex:10}}/>}

        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#525252",fontFamily:"'JetBrains Mono',monospace"}}>{"#"+String(item.num).padStart(3,"0")}</span>
              <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:cat.color,background:cat.bg,border:"1px solid "+cat.border,padding:"2px 8px",borderRadius:4}}>{item.category}</span>
              <select value={item.priority} onChange={(e)=>onUpdate(item.id,{priority:e.target.value})} style={{appearance:"none",WebkitAppearance:"none",fontSize:10,fontWeight:500,color:pri.color,background:"#fafafa",padding:"2px 20px 2px 8px",borderRadius:4,border:"1px solid #e5e5e5",cursor:"pointer",fontFamily:"'Sora',sans-serif",outline:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}>
                {Object.keys(PRIORITY).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:4}}>
              {canDelete&&<button onClick={()=>setConfirmDel(true)} style={{background:"none",border:"none",cursor:"pointer",color:"#d4d4d4",padding:2}} title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>}
              <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#b3b3b3",padding:2}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          <h2 style={{fontSize:15,fontWeight:600,margin:0,lineHeight:1.4}}>{item.desc}</h2>
          {confirmDel&&<div style={{marginTop:12,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:500,color:"#dc2626",marginBottom:8}}>Eliminar este requerimiento?</div>
            <div style={{display:"flex",gap:6}}><button onClick={handleDelete} style={{...BP,background:"#dc2626",padding:"6px 14px",fontSize:11}}>Eliminar</button><button onClick={()=>setConfirmDel(false)} style={{...BD,padding:"6px 14px",fontSize:11}}>Cancelar</button></div>
          </div>}
        </div>

        <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}>
          <div style={{display:"flex",gap:0}}>
            {COLUMNS.map((col,i)=>{const active=i<=colIdx;const current=i===colIdx;return(
              <div key={col.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>
                {i>0&&<div style={{position:"absolute",left:"-50%",right:"50%",top:9,height:2,background:active?"#1a1a1a":"#e5e5e5",zIndex:0}}/>}
                <div style={{width:18,height:18,borderRadius:99,background:active?"#1a1a1a":"#e5e5e5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700,zIndex:1}}>
                  {active&&i<colIdx?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:<span style={{color:active?"#fff":"#a3a3a3"}}>{i+1}</span>}
                </div><span style={{fontSize:9,fontWeight:current?600:400,color:current?"#1a1a1a":active?"#737373":"#d4d4d4",marginTop:4,textAlign:"center"}}>{col.label}</span>
              </div>)})}
          </div>
        </div>

        <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{l:"Sede",v:item.sede},{l:"Solicitante",v:item.by},{l:"Fecha",v:fdate(item.date)+" ("+daysAgo(item.date)+"d)"},{l:"Ticket",v:"#"+String(item.num).padStart(3,"0")}].map(m=>(
            <div key={m.l}><div style={{fontSize:9,fontWeight:500,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>{m.l}</div><div style={{fontSize:12,fontWeight:500}}>{m.v}</div></div>
          ))}
        </div>

        {item.stage==="requerimiento"&&(
          <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}>
            <div style={SL}>Asignar proveedor y cotizacion</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <ProviderInput value={provider} onChange={setProvider}/>
              <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Monto cotizado (CLP)" type="number" style={S}/>
              <button onClick={handleSaveQuote} disabled={!provider||!amount} style={{...BP,width:"100%",justifyContent:"center",opacity:(!provider||!amount)?0.35:1,cursor:(!provider||!amount)?"not-allowed":"pointer"}}>{saving?"Guardando...":"Guardar y enviar a Pago"}</button>
            </div>
          </div>
        )}

        {item.stage==="pago"&&(
          <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}>
            <div style={SL}>Cotizacion</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div>
              <div><div style={ML}>Monto total</div><div style={{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div>
            </div>
            {canApprovePayment?(<><div style={SL}>Definir pago</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{position:"relative",flex:1}}><input value={payment} onChange={e=>{const v=e.target.value;if(v===""||(/^\d{0,3}$/.test(v)&&Number(v)<=100))setPayment(v)}} placeholder="Ej: 50" type="text" inputMode="numeric" style={S}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#a3a3a3",pointerEvents:"none"}}>%</span></div>
                <div style={{display:"flex",gap:4}}>{[25,50,100].map(p=>(<button key={p} onClick={()=>setPayment(String(p))} style={{padding:"7px 10px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",border:payment===String(p)?"1.5px solid #1a1a1a":"1px solid #e5e5e5",background:payment===String(p)?"#1a1a1a":"#fff",color:payment===String(p)?"#fff":"#737373"}}>{p}%</button>))}</div>
              </div>
              {payment&&Number(payment)>0&&(<div style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:11,color:"#737373"}}>Monto a pagar ({payment}%)</span><span style={{fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#1a1a1a"}}>{fmt(Math.round(item.amount*Number(payment)/100))}</span></div>)}
              <button onClick={handleSavePayment} disabled={!payment||Number(payment)<=0} style={{...BP,width:"100%",justifyContent:"center",opacity:(!payment||Number(payment)<=0)?0.35:1,cursor:(!payment||Number(payment)<=0)?"not-allowed":"pointer"}}>{saving?"Guardando...":"Aprobar y pasar a En Proceso"}</button>
            </div></>):(<div style={{background:"#fefce8",border:"1px solid #fef08a",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#a16207"}}>Esperando aprobacion de Administrador</div>)}
          </div>
        )}

        {item.stage==="en_proceso"&&(
          <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}>
            <div style={SL}>Cotizacion y pago</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:6}}>
              <div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div>
              <div><div style={ML}>Monto total</div><div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:11,color:"#737373"}}>Pagado ({item.payment}%)</span>
              <span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(Math.round(item.amount*Number(item.payment)/100))}</span>
            </div>
            <div style={SL}>Fecha de ejecucion</div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              <input type="date" value={execDate} onChange={e=>setExecDate(e.target.value)} style={{...S,flex:1}}/>
              <button onClick={handleSaveExecDate} disabled={!execDate} style={{...BP,padding:"8px 14px",opacity:execDate?1:0.35}}>{item.execDate?"Actualizar":"Guardar"}</button>
            </div>
            {item.execDate&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#2563eb",marginBottom:14}}>{"Programado: "+fdate(item.execDate)}</div>}
            {canFinalize?<button onClick={handleFinalize} style={{...BP,width:"100%",justifyContent:"center",background:"#16a34a",border:"none"}}>{saving?"Guardando...":"Marcar como Finalizado"}</button>
            :<div style={{background:"#fefce8",border:"1px solid #fef08a",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#a16207"}}>Solo Operaciones puede finalizar</div>}
          </div>
        )}

        {item.stage==="finalizado"&&(
          <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}>
            <div style={SL}>Resumen</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:6}}>
              <div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div>
              <div><div style={ML}>Monto total</div><div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div>
            </div>
            {item.payment&&item.amount&&(<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:11,color:"#16a34a"}}>Pagado ({item.payment}%)</span><span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#16a34a"}}>{fmt(Math.round(item.amount*Number(item.payment)/100))}</span></div>)}
            {item.closedAt&&(<div style={{display:"flex",alignItems:"center",gap:6,color:"#16a34a",fontSize:12,fontWeight:500,background:"#f0fdf4",padding:"8px 12px",borderRadius:6,marginTop:4}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{"Cerrado el "+fdate(item.closedAt)}</div>)}
          </div>
        )}

        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
          <div style={{padding:"12px 24px 6px",flexShrink:0}}><div style={SL}>{"Actividad ("+(item.comments||[]).length+")"}</div></div>
          <div style={{flex:1,overflowY:"auto",padding:"0 24px"}}>
            {(item.comments||[]).length===0&&<div style={{padding:"16px 0",color:"#e0e0e0",fontSize:11,textAlign:"center"}}>Sin actividad</div>}
            {(item.comments||[]).map((c,i)=>(
              <div key={i} style={{padding:"8px 0",borderBottom:"1px solid #f5f5f5",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}><span style={{fontSize:11,fontWeight:600}}>{c.who}</span><span style={{fontSize:9,color:"#b3b3b3"}}>{fdate(c.date)}</span></div><div style={{fontSize:12,color:"#525252",lineHeight:1.35}}>{c.text}</div></div>
                <button onClick={()=>handleDeleteComment(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#e0e0e0",padding:2,flexShrink:0,marginTop:2}} title="Eliminar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
            ))}
          </div>
          <div style={{padding:"12px 24px",borderTop:"1px solid #f0f0f0",display:"flex",gap:6,flexShrink:0}}>
            <input value={comment} onChange={e=>setComment(e.target.value)} placeholder="Comentario..." style={{...S,flex:1,padding:"7px 10px",fontSize:12}} onKeyDown={e=>e.key==="Enter"&&handleComment()}/>
            <button onClick={handleComment} disabled={!comment.trim()} style={{...BP,padding:"7px 12px",opacity:!comment.trim()?0.3:1,cursor:!comment.trim()?"not-allowed":"pointer"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── NEW MODAL ── */
function NewModal({onClose,onSubmit,saving,user}){
  const[f,setF]=useState({category:"",sede:"",priority:"Media",desc:"",by:user.name});
  const set=(k,v)=>setF({...f,[k]:v});const ok=f.category&&f.sede&&f.desc&&f.by;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",animation:"fadeIn 0.1s ease"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:12,width:440,maxWidth:"92vw",boxShadow:"0 16px 32px rgba(0,0,0,0.08)",animation:"slideUp 0.15s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:15,fontWeight:600,margin:0}}>Nuevo Requerimiento</h2><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#b3b3b3"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div><label style={FL}>Tipo</label><div style={{display:"flex",gap:6}}>{Object.entries(CATEGORIES).map(([name,c])=>(<button key={name} onClick={()=>set("category",name)} style={{flex:1,padding:"8px 6px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textAlign:"center",border:f.category===name?"2px solid "+c.color:"1px solid #e5e5e5",background:f.category===name?c.bg:"#fff",color:f.category===name?c.color:"#999",transition:"all 0.12s"}}>{name==="Aire Acondicionado"?"A/C":name==="Servicio Adicional"?"Serv. Adicional":name}</button>))}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={FL}>Sede</label><SedeSelector value={f.sede} onChange={(v)=>set("sede",v)}/></div>
            <div><label style={FL}>Prioridad</label><select value={f.priority} onChange={e=>set("priority",e.target.value)} style={{...S,cursor:"pointer"}}>{Object.keys(PRIORITY).map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label style={FL}>Descripcion</label><textarea value={f.desc} onChange={e=>set("desc",e.target.value)} placeholder="Describe el requerimiento..." rows={2} style={{...S,resize:"vertical",lineHeight:1.4}}/></div>
        </div>
        <div style={{padding:"10px 24px 20px",display:"flex",justifyContent:"flex-end",gap:6}}>
          <button onClick={onClose} style={BD}>Cancelar</button>
          <button onClick={()=>{if(ok)onSubmit(f)}} disabled={!ok||saving} style={{...BP,opacity:(ok&&!saving)?1:0.35,cursor:(ok&&!saving)?"pointer":"not-allowed"}}>{saving?"Guardando...":"Crear"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App(){
  const[user,setUser]=useState(getCurrentUser());
  const[items,setItems]=useState([]);const[selected,setSelected]=useState(null);
  const[showNew,setShowNew]=useState(false);const[dragOverCol,setDragOverCol]=useState(null);
  const[search,setSearch]=useState("");const[filterCat,setFilterCat]=useState("");
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[connected,setConnected]=useState(false);const[error,setError]=useState(null);

  useEffect(()=>{if(!user)return;async function load(){if(isConfigured()){try{const ok=await testConnection();if(ok){setConnected(true);const data=await fetchAllTickets();setItems(data);data.forEach(it=>{if(it.provider)saveProvider(it.provider)})}else{setItems(DEMO_DATA)}}catch(err){console.error(err);setItems(DEMO_DATA)}}else{setItems(DEMO_DATA)}setLoading(false)}load()},[user]);
  useEffect(()=>{if(!connected)return;const interval=setInterval(async()=>{try{const data=await fetchAllTickets();setItems(data)}catch(err){console.error(err)}},30000);return()=>clearInterval(interval)},[connected]);

  const persist=async(updatedItem)=>{if(!connected)return;setSaving(true);try{await updateTicket(updatedItem)}catch(err){console.error(err);setError("Error al guardar");setTimeout(()=>setError(null),3000)}setSaving(false)};

  const getNextNum=()=>{const nums=items.map(i=>i.num||0);return nums.length?Math.max(...nums)+1:1};

  const handleDrop=useCallback((id,newStage)=>{
    setItems(prev=>prev.map(it=>{
      if(it.id!==id)return it;const from=COL_IDS.indexOf(it.stage);const to=COL_IDS.indexOf(newStage);
      if(Math.abs(to-from)!==1||to<from)return it;
      if(newStage==="pago"&&(!it.provider||!it.amount))return it;
      if(newStage==="en_proceso"&&!it.payment)return it;
      if(newStage==="en_proceso"&&user.role!=="admin")return it;
      if(newStage==="finalizado"&&user.role!=="ops"&&user.role!=="admin")return it;
      const item={...it,stage:newStage};if(newStage==="finalizado")item.closedAt=today();
      persist(item);return item;
    }));
  },[connected,user]);

  const handleNew=async(f)=>{
    const item={id:Date.now(),num:getNextNum(),...f,stage:"requerimiento",date:today(),provider:null,amount:null,payment:null,closedAt:null,execDate:null,comments:[]};
    setItems(prev=>[item,...prev]);setShowNew(false);
    if(connected){setSaving(true);try{await createTicket(item)}catch(err){console.error(err)}setSaving(false)}
  };

  const handleUpdate=async(id,updates)=>{let updatedItem;setItems(prev=>prev.map(it=>{if(it.id!==id)return it;updatedItem={...it,...updates};return updatedItem}));if(updatedItem)await persist(updatedItem)};

  const handleDelete=async(id)=>{setItems(prev=>prev.filter(it=>it.id!==id));setSelected(null);if(connected){setSaving(true);try{await deleteTicket(id)}catch(err){console.error(err)}setSaving(false)}};

  if(!user)return<LoginScreen onLogin={setUser}/>;

  const filtered=items.filter(it=>{
    if(search){const s=search.toLowerCase();if(!it.desc.toLowerCase().includes(s)&&!it.sede.toLowerCase().includes(s)&&!(it.provider||"").toLowerCase().includes(s)&&!String(it.num).padStart(3,"0").includes(s))return false}
    if(filterCat&&it.category!==filterCat)return false;return true;
  });

  const selectedData=selected?items.find(i=>i.id===selected.id):null;
  const active=items.filter(i=>i.stage!=="finalizado").length;
  const totalCost=items.reduce((s,i)=>s+(i.amount||0),0);
  const closed=items.filter(i=>i.closedAt);
  const avgTime=closed.length?Math.round(closed.map(i=>daysAgo(i.date)-daysAgo(i.closedAt)).reduce((a,b)=>a+b,0)/closed.length):0;

  if(loading)return<div style={{fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#a3a3a3",fontSize:14}}>Cargando...</div>;

  const rc=ROLE_COLORS[user.role];
  return(
    <div style={{fontFamily:"'Sora',sans-serif",background:"#fff",color:"#1a1a1a",minHeight:"100vh",fontSize:13,display:"flex",flexDirection:"column"}}>
      <style>{"@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#e5e5e5;border-radius:2px}body{margin:0}"}</style>

      {error&&<div style={{position:"fixed",top:16,right:16,background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"10px 16px",borderRadius:8,fontSize:12,zIndex:9999,animation:"fadeIn 0.15s"}}>{error}</div>}

      <div style={{padding:"12px 24px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"#fff",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div><span style={{fontSize:14,fontWeight:700,letterSpacing:"-0.03em"}}>Cowork LABS</span><span style={{fontSize:11,color:"#b3b3b3",marginLeft:8}}>Mantenciones</span></div>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:99,background:connected?"#f0fdf4":"#fefce8",border:connected?"1px solid #bbf7d0":"1px solid #fef08a"}}><span style={{width:6,height:6,borderRadius:99,background:connected?"#22c55e":"#eab308"}}/><span style={{fontSize:9,fontWeight:500,color:connected?"#16a34a":"#a16207"}}>{connected?"Google Sheets":"Demo"}</span></div>
          <div style={{display:"flex",gap:14,borderLeft:"1px solid #f0f0f0",paddingLeft:16}}>
            {[{l:"Activos",v:active},{l:"Cotizado",v:fmt(totalCost)},{l:"Prom.",v:avgTime+"d"}].map(s=>(<div key={s.l} style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"-0.02em"}}>{s.v}</span><span style={{fontSize:9,color:"#b3b3b3",fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>{s.l}</span></div>))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" style={{position:"absolute",left:9,top:9}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...S,paddingLeft:28,width:170,padding:"6px 10px 6px 28px",fontSize:11}}/></div>
          <div style={{display:"flex",gap:3}}>
            <button onClick={()=>setFilterCat("")} style={{...FB,background:!filterCat?"#1a1a1a":"#fff",color:!filterCat?"#fff":"#999",border:!filterCat?"1px solid #1a1a1a":"1px solid #e5e5e5"}}>Todos</button>
            {Object.entries(CATEGORIES).map(([n,c])=>(<button key={n} onClick={()=>setFilterCat(filterCat===n?"":n)} style={{...FB,background:filterCat===n?c.bg:"#fff",color:filterCat===n?c.color:"#b3b3b3",border:filterCat===n?"1px solid "+c.border:"1px solid #e5e5e5"}}>{n==="Aire Acondicionado"?"A/C":n==="Servicio Adicional"?"SA":"MNT"}</button>))}
          </div>
          {(user.role==="cm"||user.role==="ops"||user.role==="admin")&&<button onClick={()=>setShowNew(true)} style={{...BP,padding:"6px 14px",fontSize:11}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button>}
          <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:8,borderLeft:"1px solid #f0f0f0"}}>
            <div style={{width:28,height:28,borderRadius:99,background:rc+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:rc}}>{user.name.charAt(0)}</div>
            <div><div style={{fontSize:11,fontWeight:500}}>{user.name.split(" ")[0]}</div><div style={{fontSize:9,color:rc,fontWeight:500}}>{ROLE_LABELS[user.role]}</div></div>
            <button onClick={()=>{logoutUser();setUser(null)}} style={{background:"none",border:"none",cursor:"pointer",color:"#d4d4d4",padding:2}} title="Cerrar sesion"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
          </div>
        </div>
      </div>

      <div style={{flex:1,display:"flex",gap:12,padding:"16px 24px",overflowX:"auto",minHeight:0}}>
        {COLUMNS.map(col=>(<Column key={col.id} col={col} items={filtered.filter(i=>i.stage===col.id).sort((a,b)=>{const o={Urgente:0,Alta:1,Media:2,Baja:3};return o[a.priority]-o[b.priority]})} onOpen={setSelected} onDragStart={()=>{}} onDrop={handleDrop} dragOverCol={dragOverCol} setDragOverCol={setDragOverCol}/>))}
      </div>

      {showNew&&<NewModal onClose={()=>setShowNew(false)} onSubmit={handleNew} saving={saving} user={user}/>}
      {selectedData&&<DetailPanel item={selectedData} onClose={()=>setSelected(null)} onUpdate={handleUpdate} onDelete={handleDelete} saving={saving} user={user}/>}
    </div>
  );
}
