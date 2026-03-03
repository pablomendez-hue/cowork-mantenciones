import { useState, useCallback, useEffect, useRef } from "react";
import { COLUMNS, COL_IDS, CATEGORIES, PRIORITY, SEDES, USERS, ROLE_LABELS, ROLE_COLORS, NOTIFY_EMAILS, fmt, fdate, daysAgo, today } from "./constants.js";
import { isConfigured, fetchAllTickets, createTicket, updateTicket, deleteTicket, sendNotification, testConnection } from "./sheets.js";

const DEMO = [
  {id:1,num:1,category:"Servicio Adicional",desc:"Instalacion tomacorrientes piso 7",sede:"Suecia",priority:"Alta",stage:"finalizado",by:"Ana Rondon",date:"2026-01-21",provider:"Servicios IA SPA",amount:642600,payment:"100",closedAt:"2026-02-01",execDate:"2026-01-28",comments:[]},
  {id:2,num:2,category:"Mantencion",desc:"Cambio rejilla desague",sede:"Salesforce",priority:"Urgente",stage:"en_proceso",by:"Luis Morales",date:"2025-12-03",provider:"Servicios IA SPA",amount:95200,payment:"50",closedAt:null,execDate:"2026-02-20",comments:[]},
  {id:3,num:3,category:"Servicio Adicional",desc:"Tope puerta oficinas piso 3",sede:"Abedules",priority:"Baja",stage:"pago",by:"Ana Rondon",date:"2026-02-12",provider:"Servicios IA",amount:71400,payment:null,closedAt:null,execDate:null,comments:[]},
  {id:4,num:4,category:"Aire Acondicionado",desc:"Revision gas split oficina 301",sede:"Plaza Egana",priority:"Media",stage:"requerimiento",by:"Vito Lacasella",date:"2026-02-17",provider:null,amount:null,payment:null,closedAt:null,execDate:null,comments:[]},
];
function getCSedes(){try{return JSON.parse(localStorage.getItem("cw_sedes")||"[]")}catch{return[]}}
function saveCSede(s){const l=getCSedes();if(!l.includes(s)&&!SEDES.includes(s)){l.push(s);localStorage.setItem("cw_sedes",JSON.stringify(l))}}
function allSedes(){return[...SEDES,...getCSedes()].sort((a,b)=>a.localeCompare(b))}
function getProvs(){try{return JSON.parse(localStorage.getItem("cw_provs")||"[]")}catch{return[]}}
function saveProv(n){if(!n)return;const l=getProvs();if(!l.includes(n)){l.push(n);localStorage.setItem("cw_provs",JSON.stringify(l))}}
function getCurUser(){try{return JSON.parse(localStorage.getItem("cw_user"))}catch{return null}}
function setCurUser(u){localStorage.setItem("cw_user",JSON.stringify(u))}
function logoutUser(){localStorage.removeItem("cw_user")}
function getSavedUsers(){try{const s=localStorage.getItem("cw_users_list");return s?JSON.parse(s):null}catch{return null}}
function setSavedUsers(l){localStorage.setItem("cw_users_list",JSON.stringify(l))}
function getAllUsers(){return getSavedUsers()||USERS}
const STG={requerimiento:"Requerimiento",pago:"Pago",en_proceso:"En Proceso",finalizado:"Finalizado"};
const I={appearance:"none",WebkitAppearance:"none",background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 11px",fontSize:12,color:"#1a1a1a",width:"100%",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box"};
const BP={background:"#1a1a1a",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5};
const BD={background:"#fff",color:"#525252",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif"};
const FL={fontSize:10,fontWeight:500,color:"#a3a3a3",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"};
const SL={fontSize:9,fontWeight:600,color:"#b3b3b3",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10};
const ML={fontSize:9,color:"#b3b3b3",marginBottom:1};
const FB={padding:"5px 10px",borderRadius:5,fontSize:10,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",transition:"all 0.12s"};
const CSS=`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#e5e5e5;border-radius:2px}body{margin:0}`;

function LoginScreen({onLogin}){
  const[email,setEmail]=useState("");const[err,setErr]=useState("");
  const go=()=>{const users=getAllUsers();const u=users.find(x=>x.email.toLowerCase()===email.trim().toLowerCase());if(u){setCurUser(u);onLogin(u)}else setErr("Correo no autorizado")};
  return(<div style={{fontFamily:"'Sora',sans-serif",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa"}}><div style={{background:"#fff",borderRadius:12,padding:"40px 36px",width:380,maxWidth:"92vw",boxShadow:"0 8px 32px rgba(0,0,0,0.06)"}}><div style={{textAlign:"center",marginBottom:28}}><div style={{fontSize:18,fontWeight:700}}>Cowork LABS</div><div style={{fontSize:12,color:"#b3b3b3",marginTop:4}}>Mantenciones</div></div><div style={{marginBottom:16}}><label style={FL}>Correo corporativo</label><input value={email} onChange={e=>{setEmail(e.target.value);setErr("")}} placeholder="tu@co-work.cl" style={I} onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/></div>{err&&<div style={{color:"#dc2626",fontSize:11,marginBottom:12,background:"#fef2f2",padding:"8px 12px",borderRadius:6}}>{err}</div>}<button onClick={go} disabled={!email.trim()} style={{...BP,width:"100%",justifyContent:"center",padding:"10px",opacity:email.trim()?1:0.35}}>Entrar</button></div></div>);
}
function SedeSelect({value,onChange}){
  const[ot,setOt]=useState(false);const[c,setC]=useState("");const ss=allSedes();
  const sv=()=>{if(c.trim()){saveCSede(c.trim());onChange(c.trim());setOt(false);setC("")}};
  if(ot)return(<div style={{display:"flex",gap:4}}><input value={c} onChange={e=>setC(e.target.value)} placeholder="Nombre sede..." style={{...I,flex:1}} onKeyDown={e=>e.key==="Enter"&&sv()} autoFocus/><button onClick={sv} disabled={!c.trim()} style={{...BP,padding:"8px 10px",opacity:c.trim()?1:0.35}}>OK</button><button onClick={()=>{setOt(false);setC("")}} style={{...BD,padding:"8px 10px"}}>X</button></div>);
  return(<select value={value} onChange={e=>{const v=e.target.value;if(v==="__o__"){setOt(true);onChange("")}else onChange(v)}} style={{...I,cursor:"pointer"}}><option value="">Seleccionar...</option>{ss.map(s=><option key={s} value={s}>{s}</option>)}<option value="__o__">+ Otra sede...</option></select>);
}
function ProvInput({value,onChange}){
  const[sh,setSh]=useState(false);const ref=useRef(null);const ps=getProvs();
  const fl=value?ps.filter(p=>p.toLowerCase().includes(value.toLowerCase())):ps;
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setSh(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);
  return(<div ref={ref} style={{position:"relative"}}><input value={value} onChange={e=>{onChange(e.target.value);setSh(true)}} onFocus={()=>setSh(true)} placeholder="Nombre del proveedor" style={I}/>{sh&&fl.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:2,background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,boxShadow:"0 8px 24px rgba(0,0,0,0.08)",zIndex:20,maxHeight:160,overflowY:"auto"}}>{fl.map(p=><div key={p} onClick={()=>{onChange(p);setSh(false)}} style={{padding:"8px 12px",fontSize:12,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#f5f5f5"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{p}</div>)}</div>}</div>);
}

function Card({item,onOpen,onDragStart}){
  const cat=CATEGORIES[item.category];const pri=PRIORITY[item.priority];const age=daysAgo(item.date);
  return(<div draggable onDragStart={e=>{e.dataTransfer.setData("text/plain",String(item.id));onDragStart(item.id)}} onClick={()=>onOpen(item)} style={{background:"#fff",border:"1px solid #ebebeb",borderRadius:8,padding:"10px 12px",cursor:"grab",transition:"box-shadow 0.12s,transform 0.12s",borderLeft:"3px solid "+cat.color}} onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 3px 12px rgba(0,0,0,0.05)";e.currentTarget.style.transform="translateY(-1px)"}} onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:9,fontWeight:700,color:"#737373",fontFamily:"'JetBrains Mono',monospace"}}>{"#"+String(item.num).padStart(3,"0")}</span><span style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:cat.color,background:cat.bg,border:"1px solid "+cat.border,padding:"1px 6px",borderRadius:3}}>{item.category==="Aire Acondicionado"?"A/C":item.category==="Servicio Adicional"?"SA":"MNT"}</span></div><span style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:pri.color,fontWeight:500}}><span style={{width:5,height:5,borderRadius:99,background:pri.dot}}/>{item.priority}</span></div>
    <div style={{fontSize:12,fontWeight:500,lineHeight:1.35,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.desc}</div>
    {item.provider&&<div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style={{fontSize:10,color:"#737373",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{item.provider}</span></div>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:10,color:"#b3b3b3"}}>{item.sede}</span><div style={{display:"flex",alignItems:"center",gap:6}}>{item.amount!=null&&<span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,color:"#525252"}}>{fmt(item.amount)}</span>}<span style={{fontSize:9,color:age>14?"#ef4444":age>7?"#f59e0b":"#b3b3b3",fontWeight:age>14?600:400,fontFamily:"'JetBrains Mono',monospace"}}>{age}d</span></div></div>
  </div>);
}
function Col({col,items,onOpen,onDragStart,onDrop,dragOverCol,setDragOverCol}){
  const ov=dragOverCol===col.id;const tot=items.reduce((s,i)=>s+(i.amount||0),0);
  return(<div style={{flex:1,minWidth:240,maxWidth:340,display:"flex",flexDirection:"column",height:"100%"}} onDragOver={e=>{e.preventDefault();setDragOverCol(col.id)}} onDragLeave={()=>setDragOverCol(null)} onDrop={e=>{e.preventDefault();onDrop(Number(e.dataTransfer.getData("text/plain")),col.id);setDragOverCol(null)}}>
    <div style={{padding:"0 2px 10px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:15}}>{col.icon}</span><span style={{fontSize:13,fontWeight:600}}>{col.label}</span><span style={{background:"#f0f0f0",color:"#737373",fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:99,fontFamily:"'JetBrains Mono',monospace"}}>{items.length}</span></div><div style={{fontSize:10,color:"#b3b3b3",marginTop:1,paddingLeft:25}}>{col.sub}{tot>0&&<span style={{marginLeft:6,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,color:"#999"}}>{"\u00b7 "+fmt(tot)}</span>}</div></div>
    <div style={{flex:1,overflowY:"auto",padding:3,borderRadius:10,background:ov?"#f0f7ff":"transparent",border:ov?"2px dashed #3b82f6":"2px solid transparent",display:"flex",flexDirection:"column",gap:6}}>{items.length===0&&<div style={{padding:"24px 12px",textAlign:"center",color:"#e0e0e0",fontSize:11,border:"1px dashed #e5e5e5",borderRadius:8}}>Arrastra aqui</div>}{items.map(t=><Card key={t.id} item={t} onOpen={onOpen} onDragStart={onDragStart}/>)}</div>
  </div>);
}

const PRI_CELL={Urgente:"#dc2626",Alta:"#f97316",Media:"#fbbf24",Baja:"#d4d4d4"};
const PRI_CELL_BG={Urgente:"#fef2f2",Alta:"#fff7ed",Media:"#fffbeb",Baja:"#fafafa"};

function HeatRow({label,tickets,maxCells}){
  const open=tickets.filter(t=>t.stage!=="finalizado");
  const closed=tickets.filter(t=>t.stage==="finalizado");
  const cells=[];
  const sorted=[...open].sort((a,b)=>{const o={Urgente:0,Alta:1,Media:2,Baja:3};return o[a.priority]-o[b.priority]});
  sorted.forEach(t=>cells.push({color:PRI_CELL[t.priority],tip:"#"+String(t.num).padStart(3,"0")+" "+t.priority+" - "+t.desc.substring(0,30)}));
  while(cells.length<maxCells)cells.push({color:"#f0f0f0",tip:null});
  return(
    <div style={{display:"flex",alignItems:"center",gap:0,padding:"4px 0",borderBottom:"1px solid #f5f5f5"}}>
      <div style={{width:160,fontSize:12,fontWeight:500,color:"#525252",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
      <div style={{display:"flex",gap:2,flex:1}}>
        {cells.slice(0,maxCells).map((c,i)=><div key={i} style={{width:14,height:14,borderRadius:2,background:c.color,transition:"transform 0.1s",cursor:c.tip?"pointer":"default"}} title={c.tip||""} onMouseEnter={e=>{if(c.tip)e.currentTarget.style.transform="scale(1.3)"}} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>)}
      </div>
      <div style={{display:"flex",gap:4,marginLeft:12,flexShrink:0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:"#737373"}}>
        <span style={{minWidth:20,textAlign:"right",fontWeight:600,color:"#1a1a1a"}}>{tickets.length}</span>
        <span style={{color:"#d4d4d4"}}>|</span>
        <span style={{minWidth:20,textAlign:"right",color:open.length>0?"#f97316":"#a3a3a3",fontWeight:open.length>0?600:400}}>{open.length}</span>
        <span style={{color:"#d4d4d4"}}>|</span>
        <span style={{minWidth:20,textAlign:"right",color:"#16a34a"}}>{closed.length}</span>
      </div>
    </div>
  );
}

function Dashboard({items,onBack}){
  const[tab,setTab]=useState("sedes");
  const[users,setUsers]=useState(getAllUsers());
  const[nn,setNn]=useState("");const[ne,setNe]=useState("");const[nr,setNr]=useState("cm");
  const uniqSedes=[...new Set(items.map(i=>i.sede))].sort();
  const catKeys=Object.keys(CATEGORIES);
  const maxOpen=Math.max(...uniqSedes.map(s=>items.filter(t=>t.sede===s&&t.stage!=="finalizado").length),8);
  const maxOpenCat=Math.max(...catKeys.map(c=>items.filter(t=>t.category===c&&t.stage!=="finalizado").length),8);
  const uniqProvs=[...new Set(items.filter(i=>i.provider).map(i=>i.provider))].sort();
  const maxOpenProv=Math.max(...uniqProvs.map(p=>items.filter(t=>t.provider===p&&t.stage!=="finalizado").length),8);
  const addU=()=>{if(!nn.trim()||!ne.trim())return;const u=[...users,{name:nn.trim(),email:ne.trim().toLowerCase(),role:nr}];setUsers(u);setSavedUsers(u);setNn("");setNe("")};
  const delU=idx=>{const u=[...users];u.splice(idx,1);setUsers(u);setSavedUsers(u)};
  const ts=a=>({padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",borderRadius:7,border:"none",fontFamily:"'Sora',sans-serif",background:a?"#1a1a1a":"#fff",color:a?"#fff":"#737373"});

  const totalOpen=items.filter(t=>t.stage!=="finalizado").length;
  const totalClosed=items.filter(t=>t.stage==="finalizado").length;
  const urgCount=items.filter(t=>t.stage!=="finalizado"&&t.priority==="Urgente").length;
  const altCount=items.filter(t=>t.stage!=="finalizado"&&t.priority==="Alta").length;

  return(
    <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{...BD,padding:"6px 12px",fontSize:11,display:"flex",alignItems:"center",gap:4}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>Kanban</button>
          <h2 style={{fontSize:16,fontWeight:700,margin:0}}>Dashboard</h2>
        </div>
        <div style={{display:"flex",gap:4}}><button onClick={()=>setTab("sedes")} style={ts(tab==="sedes")}>Sedes</button><button onClick={()=>setTab("tipos")} style={ts(tab==="tipos")}>Tipos</button><button onClick={()=>setTab("proveedores")} style={ts(tab==="proveedores")}>Proveedores</button><button onClick={()=>setTab("usuarios")} style={ts(tab==="usuarios")}>Usuarios</button></div>
      </div>

      <div style={{display:"flex",gap:16,marginBottom:24}}>
        {[{l:"Total",v:items.length,c:"#1a1a1a"},{l:"Abiertos",v:totalOpen,c:"#f97316"},{l:"Cerrados",v:totalClosed,c:"#16a34a"},{l:"Urgentes",v:urgCount,c:"#dc2626"},{l:"Alta",v:altCount,c:"#ea580c"}].map(s=>
          <div key={s.l} style={{background:"#fafafa",border:"1px solid #f0f0f0",borderRadius:8,padding:"12px 16px",flex:1}}>
            <div style={{fontSize:22,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#a3a3a3",fontWeight:500,textTransform:"uppercase",marginTop:2}}>{s.l}</div>
          </div>
        )}
      </div>

      {tab==="sedes"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={SL}>Tickets abiertos por sede</div>
          <div style={{display:"flex",gap:8,fontSize:10,color:"#a3a3a3"}}>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#dc2626"}}/>Urgente</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#f97316"}}/>Alta</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#fbbf24"}}/>Media</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#d4d4d4"}}/>Baja</span>
            <span style={{marginLeft:8,fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>Total | Abiertos | Cerrados</span>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,padding:"8px 16px"}}>
          {uniqSedes.map(s=><HeatRow key={s} label={s} tickets={items.filter(t=>t.sede===s)} maxCells={maxOpen}/>)}
        </div>
      </div>}

      {tab==="tipos"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={SL}>Tickets abiertos por tipo</div>
          <div style={{display:"flex",gap:8,fontSize:10,color:"#a3a3a3"}}>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#dc2626"}}/>Urgente</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#f97316"}}/>Alta</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#fbbf24"}}/>Media</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#d4d4d4"}}/>Baja</span>
            <span style={{marginLeft:8,fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>Total | Abiertos | Cerrados</span>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,padding:"8px 16px"}}>
          {catKeys.map(c=><HeatRow key={c} label={c} tickets={items.filter(t=>t.category===c)} maxCells={maxOpenCat}/>)}
        </div>
      </div>}

      {tab==="proveedores"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={SL}>Tickets abiertos por proveedor ({uniqProvs.length})</div>
          <div style={{display:"flex",gap:8,fontSize:10,color:"#a3a3a3"}}>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#dc2626"}}/>Urgente</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#f97316"}}/>Alta</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#fbbf24"}}/>Media</span>
            <span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:8,height:8,borderRadius:1,background:"#d4d4d4"}}/>Baja</span>
            <span style={{marginLeft:8,fontFamily:"'JetBrains Mono',monospace",fontWeight:500}}>Total | Abiertos | Cerrados</span>
          </div>
        </div>
        <div style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:10,padding:"8px 16px"}}>
          {uniqProvs.map(p=><HeatRow key={p} label={p} tickets={items.filter(t=>t.provider===p)} maxCells={maxOpenProv}/>)}
        </div>
      </div>}

      {tab==="usuarios"&&<div>
        <div style={SL}>Usuarios registrados ({users.length})</div>
        <div style={{background:"#fff",borderRadius:10,border:"1px solid #f0f0f0",overflow:"hidden",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"1px solid #e5e5e5"}}>{["Nombre","Email","Rol",""].map((h,i)=><th key={i} style={{padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:600,color:"#a3a3a3",textTransform:"uppercase",width:i===3?40:undefined}}>{h}</th>)}</tr></thead>
          <tbody>{users.map((u,i)=>{const rc=ROLE_COLORS[u.role];return<tr key={i} style={{borderBottom:"1px solid #f5f5f5"}}><td style={{padding:"8px 14px",fontWeight:500}}>{u.name}</td><td style={{padding:"8px 14px",color:"#737373",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{u.email}</td><td style={{padding:"8px 14px"}}><span style={{fontSize:10,fontWeight:500,color:rc,background:rc+"15",padding:"2px 8px",borderRadius:4}}>{ROLE_LABELS[u.role]}</span></td><td style={{padding:"8px 14px"}}><button onClick={()=>delU(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#e0e0e0",padding:2}} onMouseEnter={e=>e.currentTarget.style.color="#dc2626"} onMouseLeave={e=>e.currentTarget.style.color="#e0e0e0"}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td></tr>})}</tbody></table>
        </div>
        <div style={SL}>Agregar usuario</div>
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{flex:1}}><label style={FL}>Nombre</label><input value={nn} onChange={e=>setNn(e.target.value)} placeholder="Nombre" style={I}/></div><div style={{flex:1.5}}><label style={FL}>Email</label><input value={ne} onChange={e=>setNe(e.target.value)} placeholder="email@co-work.cl" style={I}/></div><div style={{flex:0.8}}><label style={FL}>Rol</label><select value={nr} onChange={e=>setNr(e.target.value)} style={{...I,cursor:"pointer"}}><option value="cm">Comercial</option><option value="ops">Operaciones</option><option value="admin">Administrador</option></select></div><button onClick={addU} disabled={!nn.trim()||!ne.trim()} style={{...BP,padding:"8px 16px",opacity:nn.trim()&&ne.trim()?1:0.35}}>Agregar</button></div>
      </div>}
    </div>
  );
}

function Detail({item,onClose,onUpdate,onDelete,saving,user}){
  const cat=CATEGORIES[item.category];const pri=PRIORITY[item.priority];const ci=COL_IDS.indexOf(item.stage);
  const[cm,setCm]=useState("");const[pv,setPv]=useState(item.provider||"");const[am,setAm]=useState(item.amount||"");
  const[py,setPy]=useState(item.payment||"");const[ed,setEd]=useState(item.execDate||"");const[cd,setCd]=useState(false);
  const cPay=user.role==="admin";const cFin=user.role==="ops"||user.role==="admin";const cDel=user.role==="admin";
  const hCm=()=>{if(!cm.trim())return;onUpdate(item.id,{comments:[...(item.comments||[]),{who:user.name,text:cm,date:today()}]});setCm("")};
  const hDCm=i=>{const c=[...(item.comments||[])];c.splice(i,1);onUpdate(item.id,{comments:c})};
  const hQ=()=>{if(!pv||!am)return;saveProv(pv);onUpdate(item.id,{provider:pv,amount:Number(am),stage:"pago"},"stage")};
  const hPy=()=>{if(!py||Number(py)<=0)return;onUpdate(item.id,{payment:py,stage:"en_proceso"},"stage")};
  const hEx=()=>{if(ed)onUpdate(item.id,{execDate:ed},"execDate")};
  const hFn=()=>onUpdate(item.id,{stage:"finalizado",closedAt:today()},"stage");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",zIndex:1000,display:"flex",justifyContent:"flex-end",backdropFilter:"blur(3px)",animation:"fadeIn 0.1s ease"}} onClick={onClose}>
      <div style={{width:500,maxWidth:"94vw",background:"#fff",height:"100vh",overflowY:"auto",borderLeft:"1px solid #e5e5e5",animation:"slideIn 0.15s ease",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
        {saving&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"#3b82f6",animation:"pulse 1s infinite",zIndex:10}}/>}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:700,color:"#525252",fontFamily:"'JetBrains Mono',monospace"}}>{"#"+String(item.num).padStart(3,"0")}</span>
              <span style={{fontSize:10,fontWeight:600,textTransform:"uppercase",color:cat.color,background:cat.bg,border:"1px solid "+cat.border,padding:"2px 8px",borderRadius:4}}>{item.category}</span>
              <select value={item.priority} onChange={e=>onUpdate(item.id,{priority:e.target.value})} style={{appearance:"none",WebkitAppearance:"none",fontSize:10,fontWeight:500,color:pri.color,background:"#fafafa",padding:"2px 20px 2px 8px",borderRadius:4,border:"1px solid #e5e5e5",cursor:"pointer",fontFamily:"'Sora',sans-serif",outline:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 4px center"}}>{Object.keys(PRIORITY).map(p=><option key={p} value={p}>{p}</option>)}</select>
            </div>
            <div style={{display:"flex",gap:4}}>{cDel&&<button onClick={()=>setCd(true)} style={{background:"none",border:"none",cursor:"pointer",color:"#d4d4d4",padding:2}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>}<button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#b3b3b3",padding:2}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
          </div>
          <h2 style={{fontSize:15,fontWeight:600,margin:0,lineHeight:1.4}}>{item.desc}</h2>
          {cd&&<div style={{marginTop:12,background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"12px 14px"}}><div style={{fontSize:12,fontWeight:500,color:"#dc2626",marginBottom:8}}>Eliminar este requerimiento?</div><div style={{display:"flex",gap:6}}><button onClick={()=>{onDelete(item.id);onClose()}} style={{...BP,background:"#dc2626",padding:"6px 14px",fontSize:11}}>Eliminar</button><button onClick={()=>setCd(false)} style={{...BD,padding:"6px 14px",fontSize:11}}>Cancelar</button></div></div>}
        </div>
        <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}><div style={{display:"flex"}}>{COLUMNS.map((c,i)=>{const a=i<=ci;const cur=i===ci;return<div key={c.id} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>{i>0&&<div style={{position:"absolute",left:"-50%",right:"50%",top:9,height:2,background:a?"#1a1a1a":"#e5e5e5",zIndex:0}}/>}<div style={{width:18,height:18,borderRadius:99,background:a?"#1a1a1a":"#e5e5e5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700,zIndex:1}}>{a&&i<ci?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:<span style={{color:a?"#fff":"#a3a3a3"}}>{i+1}</span>}</div><span style={{fontSize:9,fontWeight:cur?600:400,color:cur?"#1a1a1a":a?"#737373":"#d4d4d4",marginTop:4}}>{c.label}</span></div>})}</div></div>
        <div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[{l:"Sede",v:item.sede},{l:"Solicitante",v:item.by},{l:"Fecha",v:fdate(item.date)+" ("+daysAgo(item.date)+"d)"},{l:"Ticket",v:"#"+String(item.num).padStart(3,"0")}].map(m=><div key={m.l}><div style={{fontSize:9,fontWeight:500,color:"#b3b3b3",textTransform:"uppercase",marginBottom:2}}>{m.l}</div><div style={{fontSize:12,fontWeight:500}}>{m.v}</div></div>)}</div>
        {item.stage==="requerimiento"&&<div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}><div style={SL}>Asignar proveedor y cotizacion</div><div style={{display:"flex",flexDirection:"column",gap:8}}><ProvInput value={pv} onChange={setPv}/><input value={am} onChange={e=>setAm(e.target.value)} placeholder="Monto cotizado (CLP)" type="number" style={I}/><button onClick={hQ} disabled={!pv||!am} style={{...BP,width:"100%",justifyContent:"center",opacity:(!pv||!am)?0.35:1}}>{saving?"Guardando...":"Guardar y enviar a Pago"}</button></div></div>}
        {item.stage==="pago"&&<div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}><div style={SL}>Cotizacion</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}><div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div><div><div style={ML}>Monto total</div><div style={{fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div></div>{cPay?<><div style={SL}>Definir pago</div><div style={{display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{position:"relative",flex:1}}><input value={py} onChange={e=>{const v=e.target.value;if(v===""||(/^\d{0,3}$/.test(v)&&Number(v)<=100))setPy(v)}} placeholder="Ej: 50" style={I}/><span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#a3a3a3",pointerEvents:"none"}}>%</span></div><div style={{display:"flex",gap:4}}>{[25,50,100].map(p=><button key={p} onClick={()=>setPy(String(p))} style={{padding:"7px 10px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"'Sora',sans-serif",border:py===String(p)?"1.5px solid #1a1a1a":"1px solid #e5e5e5",background:py===String(p)?"#1a1a1a":"#fff",color:py===String(p)?"#fff":"#737373"}}>{p}%</button>)}</div></div>{py&&Number(py)>0&&<div style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"10px 12px",display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#737373"}}>Monto ({py}%)</span><span style={{fontSize:15,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(Math.round(item.amount*Number(py)/100))}</span></div>}<button onClick={hPy} disabled={!py||Number(py)<=0} style={{...BP,width:"100%",justifyContent:"center",opacity:(!py||Number(py)<=0)?0.35:1}}>{saving?"Guardando...":"Aprobar y pasar a En Proceso"}</button></div></>:<div style={{background:"#fefce8",border:"1px solid #fef08a",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#a16207"}}>Esperando aprobacion de Administrador</div>}</div>}
        {item.stage==="en_proceso"&&<div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",background:"#fafafa",flexShrink:0}}><div style={SL}>Cotizacion y pago</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:6}}><div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div><div><div style={ML}>Monto total</div><div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div></div><div style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:7,padding:"8px 12px",display:"flex",justifyContent:"space-between",marginBottom:10}}><span style={{fontSize:11,color:"#737373"}}>Pagado ({item.payment}%)</span><span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(Math.round(item.amount*Number(item.payment)/100))}</span></div><div style={SL}>Fecha de ejecucion</div><div style={{display:"flex",gap:6,marginBottom:14}}><input type="date" value={ed} onChange={e=>setEd(e.target.value)} style={{...I,flex:1}}/><button onClick={hEx} disabled={!ed} style={{...BP,padding:"8px 14px",opacity:ed?1:0.35}}>{item.execDate?"Actualizar":"Guardar"}</button></div>{item.execDate&&<div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:7,padding:"8px 12px",fontSize:12,color:"#2563eb",marginBottom:14}}>{"Programado: "+fdate(item.execDate)}</div>}{cFin?<button onClick={hFn} style={{...BP,width:"100%",justifyContent:"center",background:"#16a34a",border:"none"}}>{saving?"Guardando...":"Marcar como Finalizado"}</button>:<div style={{background:"#fefce8",border:"1px solid #fef08a",borderRadius:7,padding:"10px 14px",fontSize:12,color:"#a16207"}}>Solo Operaciones puede finalizar</div>}</div>}
        {item.stage==="finalizado"&&<div style={{padding:"16px 24px",borderBottom:"1px solid #f0f0f0",flexShrink:0}}><div style={SL}>Resumen</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:6}}><div><div style={ML}>Proveedor</div><div style={{fontSize:12,fontWeight:500}}>{item.provider}</div></div><div><div style={ML}>Monto total</div><div style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{fmt(item.amount)}</div></div></div>{item.payment&&item.amount&&<div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"8px 12px",display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:11,color:"#16a34a"}}>Pagado ({item.payment}%)</span><span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:"#16a34a"}}>{fmt(Math.round(item.amount*Number(item.payment)/100))}</span></div>}{item.closedAt&&<div style={{display:"flex",alignItems:"center",gap:6,color:"#16a34a",fontSize:12,fontWeight:500,background:"#f0fdf4",padding:"8px 12px",borderRadius:6,marginTop:4}}>{"Cerrado el "+fdate(item.closedAt)}</div>}</div>}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}><div style={{padding:"12px 24px 6px",flexShrink:0}}><div style={SL}>{"Actividad ("+(item.comments||[]).length+")"}</div></div><div style={{flex:1,overflowY:"auto",padding:"0 24px"}}>{(item.comments||[]).length===0&&<div style={{padding:"16px 0",color:"#e0e0e0",fontSize:11,textAlign:"center"}}>Sin actividad</div>}{(item.comments||[]).map((c,i)=><div key={i} style={{padding:"8px 0",borderBottom:"1px solid #f5f5f5",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}><span style={{fontSize:11,fontWeight:600}}>{c.who}</span><span style={{fontSize:9,color:"#b3b3b3"}}>{fdate(c.date)}</span></div><div style={{fontSize:12,color:"#525252",lineHeight:1.35}}>{c.text}</div></div><button onClick={()=>hDCm(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#e0e0e0",padding:2,flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>)}</div>
          <div style={{padding:"12px 24px",borderTop:"1px solid #f0f0f0",display:"flex",gap:6,flexShrink:0}}><input value={cm} onChange={e=>setCm(e.target.value)} placeholder="Comentario..." style={{...I,flex:1,padding:"7px 10px",fontSize:12}} onKeyDown={e=>e.key==="Enter"&&hCm()}/><button onClick={hCm} disabled={!cm.trim()} style={{...BP,padding:"7px 12px",opacity:!cm.trim()?0.3:1}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>
        </div>
      </div>
    </div>);
}

function NewModal({onClose,onSubmit,saving,user}){
  const[f,setF]=useState({category:"",sede:"",priority:"Media",desc:"",by:user.name});const set=(k,v)=>setF({...f,[k]:v});const ok=f.category&&f.sede&&f.desc&&f.by;
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)",animation:"fadeIn 0.1s ease"}} onClick={onClose}><div style={{background:"#fff",borderRadius:12,width:440,maxWidth:"92vw",boxShadow:"0 16px 32px rgba(0,0,0,0.08)",animation:"slideUp 0.15s ease"}} onClick={e=>e.stopPropagation()}>
    <div style={{padding:"20px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 style={{fontSize:15,fontWeight:600,margin:0}}>Nuevo Requerimiento</h2><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#b3b3b3"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
    <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={FL}>Tipo</label><div style={{display:"flex",gap:6}}>{Object.entries(CATEGORIES).map(([n,c])=><button key={n} onClick={()=>set("category",n)} style={{flex:1,padding:"8px 6px",borderRadius:6,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textAlign:"center",border:f.category===n?"2px solid "+c.color:"1px solid #e5e5e5",background:f.category===n?c.bg:"#fff",color:f.category===n?c.color:"#999"}}>{n==="Aire Acondicionado"?"A/C":n==="Servicio Adicional"?"Serv. Adicional":n}</button>)}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={FL}>Sede</label><SedeSelect value={f.sede} onChange={v=>set("sede",v)}/></div><div><label style={FL}>Prioridad</label><select value={f.priority} onChange={e=>set("priority",e.target.value)} style={{...I,cursor:"pointer"}}>{Object.keys(PRIORITY).map(p=><option key={p} value={p}>{p}</option>)}</select></div></div>
      <div><label style={FL}>Descripcion</label><textarea value={f.desc} onChange={e=>set("desc",e.target.value)} placeholder="Describe el requerimiento..." rows={2} style={{...I,resize:"vertical",lineHeight:1.4}}/></div>
    </div>
    <div style={{padding:"10px 24px 20px",display:"flex",justifyContent:"flex-end",gap:6}}><button onClick={onClose} style={BD}>Cancelar</button><button onClick={()=>{if(ok)onSubmit(f)}} disabled={!ok||saving} style={{...BP,opacity:(ok&&!saving)?1:0.35}}>{saving?"Guardando...":"Crear"}</button></div>
  </div></div>);
}

export default function App(){
  const[user,setUser]=useState(getCurUser());
  const[items,setItems]=useState([]);const[sel,setSel]=useState(null);const[showNew,setShowNew]=useState(false);
  const[showDash,setShowDash]=useState(false);const[dragCol,setDragCol]=useState(null);
  const[search,setSearch]=useState("");const[fCat,setFCat]=useState("");const[fPri,setFPri]=useState("");
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[conn,setConn]=useState(false);const[err,setErr]=useState(null);
  const savRef=useRef(false);

  useEffect(()=>{if(!user)return;async function ld(){if(isConfigured()){try{const ok=await testConnection();if(ok){setConn(true);const d=await fetchAllTickets();setItems(d);d.forEach(t=>{if(t.provider)saveProv(t.provider)})}else setItems(DEMO)}catch(e){console.error(e);setItems(DEMO)}}else setItems(DEMO);setLoading(false)}ld()},[user]);
  useEffect(()=>{if(!conn)return;const iv=setInterval(async()=>{if(savRef.current)return;try{const d=await fetchAllTickets();setItems(d)}catch(e){console.error(e)}},30000);return()=>clearInterval(iv)},[conn]);

  const persist=async u=>{if(!conn)return;savRef.current=true;setSaving(true);try{await updateTicket(u)}catch(e){console.error(e);setErr("Error al guardar");setTimeout(()=>setErr(null),3000)}setSaving(false);savRef.current=false};
  const notify=async(item,type)=>{if(!conn)return;const tag="#"+String(item.num).padStart(3,"0");let sub="",body="",em=[...NOTIFY_EMAILS.admin,...NOTIFY_EMAILS.ops];if(type==="stage"){const sl=STG[item.stage]||item.stage;sub="[Mantenciones] "+tag+" "+item.sede+" > "+sl;body=tag+" - "+item.desc+"\nSede: "+item.sede+"\nEstado: "+sl+"\nPor: "+user.name}else if(type==="execDate"){sub="[Mantenciones] "+tag+" "+item.sede+" - Fecha: "+fdate(item.execDate);body=tag+" - "+item.desc+"\nSede: "+item.sede+"\nFecha programada: "+fdate(item.execDate)+"\nPor: "+user.name}if(em.length)try{await sendNotification(em,sub,body)}catch(e){console.error("Notify:",e)}};
  const nextNum=()=>{const ns=items.map(i=>i.num||0);return ns.length?Math.max(...ns)+1:1};

  const handleDrop=useCallback((id,ns)=>{setItems(p=>p.map(t=>{if(t.id!==id)return t;const f=COL_IDS.indexOf(t.stage),to=COL_IDS.indexOf(ns);if(Math.abs(to-f)!==1||to<f)return t;if(ns==="pago"&&(!t.provider||!t.amount))return t;if(ns==="en_proceso"&&!t.payment)return t;if(ns==="en_proceso"&&user.role!=="admin")return t;if(ns==="finalizado"&&user.role!=="ops"&&user.role!=="admin")return t;const it={...t,stage:ns};if(ns==="finalizado")it.closedAt=today();persist(it);notify(it,"stage");return it}))},[conn,user]);

  const handleNew=async f=>{const it={id:Date.now(),num:nextNum(),...f,stage:"requerimiento",date:today(),provider:null,amount:null,payment:null,closedAt:null,execDate:null,comments:[]};setItems(p=>[it,...p]);setShowNew(false);if(conn){savRef.current=true;setSaving(true);try{await createTicket(it)}catch(e){console.error(e)}setSaving(false);savRef.current=false}};
  const handleUpd=async(id,upd,nt)=>{let ui;setItems(p=>p.map(t=>{if(t.id!==id)return t;ui={...t,...upd};return ui}));if(ui){await persist(ui);if(nt)notify(ui,nt)}};
  const handleDel=async id=>{setItems(p=>p.filter(t=>t.id!==id));setSel(null);if(conn){savRef.current=true;setSaving(true);try{await deleteTicket(id)}catch(e){console.error(e)}setSaving(false);savRef.current=false}};

  if(!user)return<LoginScreen onLogin={setUser}/>;
  const filt=items.filter(t=>{if(search){const s=search.toLowerCase();if(!t.desc.toLowerCase().includes(s)&&!t.sede.toLowerCase().includes(s)&&!(t.provider||"").toLowerCase().includes(s)&&!String(t.num).padStart(3,"0").includes(s))return false}if(fCat&&t.category!==fCat)return false;if(fPri&&t.priority!==fPri)return false;return true});
  const selD=sel?items.find(i=>i.id===sel.id):null;
  const act=items.filter(i=>i.stage!=="finalizado").length;const totC=items.reduce((s,i)=>s+(i.amount||0),0);
  const cls=items.filter(i=>i.closedAt);const avg=cls.length?Math.round(cls.map(i=>daysAgo(i.date)-daysAgo(i.closedAt)).reduce((a,b)=>a+b,0)/cls.length):0;
  if(loading)return<div style={{fontFamily:"'Sora',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#a3a3a3",fontSize:14}}>Cargando...</div>;
  const rc=ROLE_COLORS[user.role];
  return(
    <div style={{fontFamily:"'Sora',sans-serif",background:"#fff",color:"#1a1a1a",minHeight:"100vh",fontSize:13,display:"flex",flexDirection:"column"}}>
      <style>{CSS}</style>
      {err&&<div style={{position:"fixed",top:16,right:16,background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",padding:"10px 16px",borderRadius:8,fontSize:12,zIndex:9999}}>{err}</div>}
      <div style={{padding:"12px 24px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,background:"#fff",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div><span style={{fontSize:14,fontWeight:700}}>Cowork LABS</span><span style={{fontSize:11,color:"#b3b3b3",marginLeft:8}}>Mantenciones</span></div>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:99,background:conn?"#f0fdf4":"#fefce8",border:conn?"1px solid #bbf7d0":"1px solid #fef08a"}}><span style={{width:6,height:6,borderRadius:99,background:conn?"#22c55e":"#eab308"}}/><span style={{fontSize:9,fontWeight:500,color:conn?"#16a34a":"#a16207"}}>{conn?"Sheets":"Demo"}</span></div>
          <div style={{display:"flex",gap:14,borderLeft:"1px solid #f0f0f0",paddingLeft:16}}>{[{l:"Activos",v:act},{l:"Cotizado",v:fmt(totC)},{l:"Prom.",v:avg+"d"}].map(s=><div key={s.l} style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{s.v}</span><span style={{fontSize:9,color:"#b3b3b3",fontWeight:500,textTransform:"uppercase"}}>{s.l}</span></div>)}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {!showDash&&<><div style={{position:"relative"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" strokeWidth="2" style={{position:"absolute",left:9,top:9}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{...I,paddingLeft:28,width:170,padding:"6px 10px 6px 28px",fontSize:11}}/></div>
          <div style={{display:"flex",gap:3}}>
            <button onClick={()=>{setFCat("");setFPri("")}} style={{...FB,background:!fCat&&!fPri?"#1a1a1a":"#fff",color:!fCat&&!fPri?"#fff":"#999",border:!fCat&&!fPri?"1px solid #1a1a1a":"1px solid #e5e5e5"}}>Todos</button>
            {Object.entries(CATEGORIES).map(([n,c])=><button key={n} onClick={()=>{setFCat(fCat===n?"":n);setFPri("")}} style={{...FB,background:fCat===n?c.bg:"#fff",color:fCat===n?c.color:"#b3b3b3",border:fCat===n?"1px solid "+c.border:"1px solid #e5e5e5"}}>{n==="Aire Acondicionado"?"A/C":n==="Servicio Adicional"?"SA":"MNT"}</button>)}
            <span style={{width:1,background:"#e5e5e5",margin:"0 2px"}}/>
            {Object.entries(PRIORITY).map(([n,p])=><button key={n} onClick={()=>{setFPri(fPri===n?"":n);setFCat("")}} style={{...FB,background:fPri===n?"#1a1a1a":"#fff",color:fPri===n?"#fff":p.color,border:fPri===n?"1px solid #1a1a1a":"1px solid #e5e5e5",display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:99,background:p.dot}}/>{n.slice(0,3)}</button>)}
          </div>
          <button onClick={()=>setShowNew(true)} style={{...BP,padding:"6px 14px",fontSize:11}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo</button></>}
          {user.role==="admin"&&<button onClick={()=>setShowDash(!showDash)} style={{...showDash?BP:BD,padding:"6px 14px",fontSize:11}} title="Dashboard"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showDash?"#fff":"currentColor"} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>}
          <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:8,borderLeft:"1px solid #f0f0f0"}}><div style={{width:28,height:28,borderRadius:99,background:rc+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:rc}}>{user.name.charAt(0)}</div><div><div style={{fontSize:11,fontWeight:500}}>{user.name.split(" ")[0]}</div><div style={{fontSize:9,color:rc,fontWeight:500}}>{ROLE_LABELS[user.role]}</div></div><button onClick={()=>{logoutUser();setUser(null)}} style={{background:"none",border:"none",cursor:"pointer",color:"#d4d4d4",padding:2}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></div>
        </div>
      </div>
      {showDash?<Dashboard items={items} onBack={()=>setShowDash(false)}/>:
      <div style={{flex:1,display:"flex",gap:12,padding:"16px 24px",overflowX:"auto",minHeight:0}}>
        {COLUMNS.map(col=><Col key={col.id} col={col} items={filt.filter(i=>i.stage===col.id).sort((a,b)=>{const o={Urgente:0,Alta:1,Media:2,Baja:3};return o[a.priority]-o[b.priority]})} onOpen={setSel} onDragStart={()=>{}} onDrop={handleDrop} dragOverCol={dragCol} setDragOverCol={setDragCol}/>)}
      </div>}
      {showNew&&<NewModal onClose={()=>setShowNew(false)} onSubmit={handleNew} saving={saving} user={user}/>}
      {selD&&<Detail item={selD} onClose={()=>setSel(null)} onUpdate={handleUpd} onDelete={handleDel} saving={saving} user={user}/>}
    </div>
  );
}
