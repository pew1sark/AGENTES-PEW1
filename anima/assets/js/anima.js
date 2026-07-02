/* ===========================================================
   ANIMA Studio — App logic (Beta · Founding Era)
   Sistema vivo: Almas editables, niveles, módulos, LUMBRE,
   personalización y Cotizador. Local + nube (Supabase).
   =========================================================== */

const STORAGE = "anima_alpha_state_v2";

/* ---------- Estado ---------- */
let state = load();
function load(){
  try{ const s = JSON.parse(localStorage.getItem(STORAGE)); if(s && s.almas && s.almas.length) return s; }catch(e){}
  return { almas: JSON.parse(JSON.stringify(SEED_ALMAS)), currentId:"guest", view:"mialma", lumbreMode:"LOCAL", chat:[] };
}
function save(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }
function reset(){ if(confirm("¿Restaurar ANIMA a las 10 Almas fundadoras? Se borrarán tus cambios locales.")){ localStorage.removeItem(STORAGE); location.reload(); } }

const me = () => state.almas.find(a => a.id === state.currentId) || state.almas[0];
const sum = arr => arr.reduce((t,x)=>t+x.a,0);
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ---------- Avatar ---------- */
function initials(name){ return (name||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(); }
function avatarHTML(a, cls=""){
  if(a.photo) return `<span class="avatar ${cls}" style="background-image:url('${esc(a.photo)}');background-size:cover;background-position:center"></span>`;
  return `<span class="avatar ${cls}" style="background:linear-gradient(145deg,${a.color},${shade(a.color,-22)})">${initials(a.name)}</span>`;
}
function shade(hex,p){ hex=hex||"#111111"; const n=parseInt(hex.slice(1),16); let r=(n>>16)+p,g=(n>>8&255)+p,b=(n&255)+p;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return "#"+(0x1000000+(r<<16)+(g<<8)+b).toString(16).slice(1); }

/* ---------- Pixel art (solo el Camino del Alma) ---------- */
const LEVEL_SPRITES={
  FOUNDING:["....a....","....X....","..x.X.x..","...xXx...","XXXXaXXXX","...xXx...","..x.X.x..","....X....","....a...."],
  EMBER:["....X....","....X....","...xXx...","...xXx...","..xXaXx..","..xXaXx..","...xXx...","....X....","........."],
  ROOT:["...XaX...","....X....","..X.X.X..","..X.X.X..","...XXX...","..d.X.d..",".d..X..d.","d...d...d","........."],
  WILD:[".........",".X.....X.",".X.X.X.X.",".X.X.X.X.",".X.X.X.X.",".X.XaX.X.",".XXXXXXX.",".........","........."],
  TOTEM:[".X.X.X...",".........","...XXX...","..XXXXX..","..XXXXX..","..XXXXX..","...XXX...",".........","........."],
  AETHER:["..XXXXX..",".XdXXXdX.",".X.XaX.X.",".XdXXXdX.",".X.XaX.X.",".XdXXXdX.","..XXXXX..","...XXX...","........."],
  SPIRIT:["....a....",".x..X..x.","..xXXXx..",".xXXXXXx.","aXXXaXXXa",".xXXXXXx.","..xXXXx..",".x..X..x.","....a...."],
  ANIMA:["....a....","...XaX...","..XxxxX..",".XxxxxxX.","XxxxxxxxX",".XxxxxxX.","..XxxxX..","...XaX...","....a...."]
};
function pixelSprite(l){
  const pal={ X:l.color, x:shade(l.color,46), d:shade(l.color,-48), a:"#f5ecd2" };
  const g=LEVEL_SPRITES[l.key]||LEVEL_SPRITES.FOUNDING; let r="";
  g.forEach((row,y)=>{ [...row].forEach((ch,x)=>{ const c=pal[ch]; if(c) r+=`<rect x="${x}" y="${y}" width="1.04" height="1.04" fill="${c}"/>`; }); });
  return `<svg class="pix" viewBox="0 0 9 9" shape-rendering="crispEdges">${r}</svg>`;
}
const UNLOCKS={ FOUNDING:"Tu Alma, portafolio y memoria", EMBER:"Cotizador y finanzas", ROOT:"Clientes y flujo de trabajo",
  WILD:"Publicar en la comunidad", TOTEM:"Crear o unirte a un Clan", AETHER:"Mentorías y perfil destacado",
  SPIRIT:"Academia: enseñar y cursos", ANIMA:"Santuario e IA conectada (LUMBRE)" };
function caminoPixelHTML(lp){
  const nx=lp.next; const falta=nx?Math.max(0,nx.xp-me().xp):0;
  return `<div class="camino">
    <div class="camino-head"><span class="pixel-font">TU CAMINO</span><div class="spacer" style="flex:1"></div>
      <button class="ia" id="levelsInfo" title="¿Qué son los niveles?">ⓘ</button></div>
    <div class="camino-track">${LEVELS.map((l,i)=>`<div class="ptile ${i===lp.idx?'cur':''} ${i<lp.idx?'passed':''}">
      <span class="pn pixel-font">${i+1}</span>${pixelSprite(l)}<b class="pixel-font">${l.label}</b></div>`).join("")}</div>
    <div class="camino-prog"><div class="bar"><span style="width:${lp.pct}%"></span></div>
      <small class="muted">${nx?`${lp.pct}% — faltan ${falta.toLocaleString("es-CL")} XP para <b>${nx.label}</b>`:"Alma Despierta · nivel máximo ∞"}</small></div>
  </div>`;
}
function openLevels(){
  document.getElementById("levelBody").innerHTML=`<p class="muted" style="font-size:13px">Tu Alma evoluciona con tu actividad. Cada acción (crear trabajos, memorias, hitos) da XP y desbloquea nuevas ventanas dentro de ANIMA.</p>
    ${LEVELS.map(l=>`<div class="row"><div style="width:40px">${pixelSprite(l)}</div><div class="grow"><b>${l.label}</b> <small class="muted">· ${l.name} · ${l.xp.toLocaleString("es-CL")} XP</small><br><small class="muted">Desbloquea: ${UNLOCKS[l.key]||""}</small></div></div>`).join("")}`;
  document.getElementById("levelModal").classList.add("open");
}
function closeLevels(){ document.getElementById("levelModal").classList.remove("open"); }

/* ---------- Personalización (mostrar/ocultar) ---------- */

/* ---------- Personalización (mostrar/ocultar) ---------- */
const cfgKey = a => "anima_cfg_"+(a.almaId||a.id);
function getCfg(a){
  const def={ modules:{trayectoria:true,portafolio:true,proyectos:true,finanzas:true,clientes:true,cotizador:true,agenda:true,memoria:true,biblioteca:true},
              cards:{constelacion:true,kpis:true,camino:true,graficos:true,hoy:true,memoria:true}, mapSize:"md" };
  try{ const c=JSON.parse(localStorage.getItem(cfgKey(a))); if(c){ return { modules:{...def.modules,...c.modules}, cards:{...def.cards,...c.cards}, mapSize:c.mapSize||def.mapSize }; } }catch(e){}
  return def;
}
function setCfg(a,c){ localStorage.setItem(cfgKey(a), JSON.stringify(c)); if(a.live){ Cloud.savePrefs(a.almaId,c).catch(()=>{}); } }
function toggleCfg(path){ const a=me(); const c=getCfg(a); const [g,k]=path.split(":"); c[g][k]=(c[g][k]===false); setCfg(a,c); renderAll(); }

/* ---------- Navegación (3 capas: secciones › reinos › módulos) ---------- */
const CREATOR_EMAIL = "sarkgraff@gmail.com";
let isCreator = false;   // se activa en refreshAuth si la sesión es del Creador

const NAV_TREE = [
  { type:"item",  v:"mialma", ico:"◆", t:"Mi Alma" },
  { type:"reino", key:"esencia", ico:"✦", t:"Esencia", children:[
      {v:"trayectoria",ico:"⤴",t:"Trayectoria"},
      {v:"portafolio", ico:"▦",t:"Portafolio"},
      {v:"memoria",    ico:"✦",t:"Memorias"},
      {v:"biblioteca", ico:"❏",t:"Biblioteca"}
  ]},
  { type:"reino", key:"taller", ico:"₵", t:"Taller", children:[
      {v:"proyectos",  ico:"◷",t:"Proyectos"},
      {v:"clientes",   ico:"☺",t:"Clientes"},
      {v:"cotizador",  ico:"₵",t:"Cotizador"},
      {v:"finanzas",   ico:"$",t:"Finanzas"},
      {v:"agenda",     ico:"☰",t:"Agenda"}
  ]}
];
function navItem(n, sub){ return `<div class="nav-item ${sub?'sub':''} ${state.view===n.v?'active':''}" data-view="${n.v}"><span class="ico">${n.ico}</span>${n.t}</div>`; }
function reinoOpen(key){ if(!state.navOpen) state.navOpen={}; return state.navOpen[key]!==false; }
function toggleReino(key){ if(!state.navOpen) state.navOpen={}; state.navOpen[key]=!reinoOpen(key); save(); renderNav(); }
function renderNav(){
  const cfg=getCfg(me());
  let h=`<div class="nav-label">Mi Alma</div>`;
  NAV_TREE.forEach(node=>{
    if(node.type==="item"){ h+=navItem(node); return; }
    const kids=node.children.filter(c=>cfg.modules[c.v]!==false);
    if(!kids.length) return;
    const activeInside=kids.some(c=>c.v===state.view);
    const open=reinoOpen(node.key)||activeInside;
    h+=`<div class="nav-group ${open?'open':''} ${activeInside?'has-active':''}" data-reino="${node.key}">
        <span class="ico">${node.ico}</span><span class="rt">${node.t}</span><span class="caret">⌄</span></div>`;
    h+=`<div class="nav-sub ${open?'open':''}"><div class="nav-sub-inner">${kids.map(c=>navItem(c,true)).join("")}</div></div>`;
  });
  h+=`<div class="nav-label">Mundo</div>`+navItem({v:"comunidad",ico:"❂",t:"Comunidad"})+navItem({v:"santuario",ico:"🜁",t:"Santuario"});
  if(isCreator){
    h+=`<div class="nav-label">Creador</div>`+navItem({v:"config",ico:"⚙",t:"Personalizar"});
  }
  document.getElementById("nav").innerHTML=h;
}

/* ---------- Sidebar identidad ---------- */
function renderWho(){
  const a=me(); const lv=levelByKey(a.level);
  document.getElementById("who").innerHTML = `${avatarHTML(a)}<div class="meta"><b>${esc(a.name)}</b><small>${lv.emoji} ${a.level} · ${esc(a.city||"")}</small></div>`;
}

/* ---------- Topbar ---------- */
const TITLES = {
  mialma:["Mi Alma","Tu espacio privado: identidad, nivel y pulso de hoy."],
  trayectoria:["Trayectoria","La historia de tu Alma, hito a hito."],
  portafolio:["Portafolio","Las obras que te representan."],
  proyectos:["Proyectos","Lo que está vivo ahora mismo."],
  finanzas:["Finanzas","Ingresos, egresos y ganancia — privado."],
  clientes:["Clientes","Tu cartera de clientes y contactos."],
  cotizador:["Cotizador","Crea presupuestos profesionales y expórtalos en PDF."],
  agenda:["Agenda","Tu día, ordenado."],
  memoria:["Memorias","Ideas, frases y referencias que no quieres perder."],
  biblioteca:["Biblioteca","Tus documentos y archivos."],
  config:["Personalizar","Tú decides qué muestra tu Alma."],
  comunidad:["Comunidad","Tu Clan y la constelación de Almas."],
  santuario:["Santuario","Nivel 3: la organización completa de ANIMA."]
};
function renderTop(){ const [t,s]=TITLES[state.view]||["ANIMA",""]; document.getElementById("topTitle").innerHTML=`<h1>${t}</h1><div class="sub">${s}</div>`; }

/* ---------- Mapamundi de Almas ---------- */
function hashStr(s){ s=String(s||""); let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return h; }
function timeAgo(iso){ if(!iso) return ""; const d=(Date.now()-new Date(iso).getTime())/1000;
  if(isNaN(d)) return ""; if(d<60) return "ahora"; if(d<3600) return Math.floor(d/60)+" min"; if(d<86400) return Math.floor(d/3600)+" h"; return Math.floor(d/86400)+" d"; }
const WORLD_IMG="https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg";
const CITY_COORDS={ "santiago":[-33.45,-70.66],"valparaiso":[-33.05,-71.62],"buenos aires":[-34.6,-58.38],
  "cordoba":[-31.42,-64.18],"medellin":[6.24,-75.57],"bogota":[4.71,-74.07],"ciudad de mexico":[19.43,-99.13],
  "guadalajara":[20.67,-103.35],"lima":[-12.04,-77.04],"madrid":[40.42,-3.70] };
const COUNTRY_COORDS={ "chile":[-35,-71],"argentina":[-38,-63],"colombia":[4,-73],"mexico":[23,-102],
  "peru":[-10,-76],"espana":[40,-4],"spain":[40,-4] };
const deburr=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\u{1F1E6}-\u{1F1FF}]/gu,"").trim().toLowerCase();
function almaLatLng(m){ const c=deburr(m.city); if(CITY_COORDS[c]) return CITY_COORDS[c];
  const co=deburr(m.country); if(COUNTRY_COORDS[co]) return COUNTRY_COORDS[co]; return [15,-20]; }
function constelacionHTML(){
  const list=roster();
  const recent=[...list].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()).slice(0,5);
  const nodes=list.map(m=>{
    const [lat,lng]=almaLatLng(m); const j=hashStr(m.id||m.name);
    const x=Math.max(2,Math.min(98,(lng+180)/360*100+((j%14)-7)*0.18));
    const y=Math.max(4,Math.min(96,(90-lat)/180*100+(((j>>4)%12)-6)*0.18));
    const isNew=liveMode()&&recent.indexOf(m)>-1;
    const act=(liveMode()&&!m.live)?`data-pub="${m.id}"`:`data-alma="${m.id}"`;
    return `<button class="wn ${isNew?'new':''}" ${act} style="left:${x}%;top:${y}%;--c:${m.color}" title="${esc(m.name)} · ${esc(m.city||m.country||"")} · ${m.level}">${initials(m.name)}</button>`;
  }).join("");
  const chips=recent.map(m=>`<span class="chip"><b style="color:${m.color}">●</b> ${esc(m.name)} · ${esc(deburr(m.city)?m.city:m.country||"")} ${m.created_at?"· "+timeAgo(m.created_at):""}</span>`).join("");
  const sz=getCfg(me()).mapSize||"md";
  return `<div class="card s12 map-card">
    <div class="map-bar">
      <span class="pixel-font" style="font-size:11px;color:#e9d9a8">⌖ MAPA DE ALMAS</span>
      <span class="pill ${liveMode()?'gold':''}" style="margin-left:6px">${liveMode()?'🜂 '+list.length:'Demo · '+list.length}</span>
      <div class="spacer" style="flex:1"></div>
      <div class="map-sizes">${["sm","md","lg"].map(s=>`<button class="msz ${sz===s?'on':''}" data-mapsize="${s}">${s.toUpperCase()}</button>`).join("")}</div>
    </div>
    <div class="worldmap ${sz}"><img src="${WORLD_IMG}" alt="" loading="lazy" onerror="this.style.display='none'">${nodes}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap">
      <small class="pixel-font" style="font-size:8px;color:#7b5920">ENTRANDO AL MUNDO</small>
      ${chips}
    </div>
  </div>`;
}
function setMapSize(s){ const a=me(); const c=getCfg(a); c.mapSize=s; setCfg(a,c); renderAll(); }

/* ---------- Acciones de ítem (editar/eliminar) ---------- */
function acts(kind,i){ return `<span class="acts"><button class="ia" data-edit="${kind}:${i}" title="Editar">✎</button><button class="ia danger" data-del="${kind}:${i}" title="Eliminar">✕</button></span>`; }

/* ===========================================================
   VISTAS
   =========================================================== */
function renderView(){
  if(state.view==="config" && !isCreator) state.view="mialma";   // Personalizar es solo del Creador
  const fn = { mialma:vMiAlma, trayectoria:vTrayectoria, portafolio:vPortafolio, proyectos:vProyectos,
    finanzas:vFinanzas, clientes:vClientes, cotizador:vCotizador, agenda:vAgenda, memoria:vMemoria, biblioteca:vBiblioteca,
    config:vConfig, comunidad:vComunidad, santuario:vSantuario }[state.view] || vMiAlma;
  document.getElementById("view").innerHTML = fn(me());
}

/* --- Mi Alma --- */
function vMiAlma(a){
  const lp=levelProgress(a.xp), lv=levelByKey(a.level);
  let tab=state.almaTab||"resumen"; if(tab==="ajustes"&&!isCreator) tab="resumen";
  const idline=[a.discipline||a.role, a.specialty].filter(Boolean).join(" · ");
  const header=`<div class="card s12">
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
      ${avatarHTML(a,"lg")}
      <div style="flex:1;min-width:200px">
        <span class="level-badge" style="border-color:${lv.color}55;color:${lv.color}">${lv.emoji} ${lv.label} · ${lv.name}</span>
        <h2 style="font-size:30px;letter-spacing:-.05em;margin:10px 0 2px">${esc(a.name)}</h2>
        <div class="muted">${esc(idline||"")}${(a.territory||a.country)?" · "+esc(a.territory||a.country):""}</div>
        ${a.handle?`<div class="muted" style="font-size:12.5px;margin-top:2px">${esc(a.handle)}</div>`:""}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="pixel-font" style="font-size:10px;color:#7b5920">${a.xp.toLocaleString("es-CL")} XP</span>
        <div class="bar" style="width:170px"><span style="width:${lp.pct}%"></span></div>
        <small class="muted" style="font-size:11px">${lp.next?`hacia ${lp.next.label}`:"Alma Despierta ∞"}</small>
      </div>
    </div>
    ${a.bio?`<p style="margin:14px 0 0">${esc(a.bio)}</p>`:""}
    <div style="margin-top:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${(a.tags||[]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")}
      ${linksHTML(a)}<span style="flex:1"></span>
      ${a.live?`<button class="btn ghost sm" id="sharePf">↗ Compartir portafolio</button>`:""}
      <button class="btn ghost sm" data-export>⤓ PDF</button>
    </div>
  </div>`;
  const tabs=[["resumen","Resumen"],["identidad","Identidad"],["publica","Vista pública"]];
  if(isCreator) tabs.push(["ajustes","Ajustes"]);
  const tabbar=`<div class="card s12 tabbar">${tabs.map(([k,l])=>`<button class="tabbtn ${tab===k?'on':''}" data-tab="${k}">${l}</button>`).join("")}</div>`;
  const body = tab==="identidad"?vAlmaIdentidad(a) : tab==="publica"?vAlmaPublica(a) : tab==="ajustes"?vConfigBody(a) : vAlmaResumen(a,lp);
  return `<div class="grid">${header}${tabbar}${body}</div>`;
}
function linksHTML(a){
  const L=[]; if(a.website)L.push(["Sitio",a.website]); if(a.instagram)L.push(["Instagram",a.instagram.startsWith("http")?a.instagram:"https://instagram.com/"+a.instagram.replace("@","")]);
  if(a.portfolio_url)L.push(["Portafolio",a.portfolio_url]); if(a.shop_url)L.push(["Tienda",a.shop_url]);
  return L.map(([t,u])=>`<a class="chip" href="${esc(u)}" target="_blank" rel="noopener">${t} ↗</a>`).join("");
}
function vAlmaResumen(a,lp){
  const cfg=getCfg(a); const inc=sum(a.finance.income), exp=sum(a.finance.expense);
  const active=a.projects.filter(p=>!["Entregado","Cerrado","Terminado"].includes(p.st)).length;
  const createCTA=(!a.live && Cloud.enabled)?`<div class="card s12" style="background:linear-gradient(145deg,rgba(208,170,99,.16),rgba(255,255,255,.7))">
      <span class="pill gold">Estás viendo una Alma de muestra</span>
      <p style="margin:8px 0 0">Crea tu propia Alma para construir tu trayectoria real y aparecer en la constelación.</p>
      <div style="margin-top:12px"><button class="btn" id="createAlmaBtn">✦ Crear mi Alma</button></div></div>`:``;
  const onboarding=(a.live && a.memories.length===0 && a.projects.length===0)?`<div class="card s12" style="background:linear-gradient(145deg,rgba(208,170,99,.14),rgba(255,255,255,.7))">
      <span class="pill gold">Bienvenida, Alma nueva</span>
      <p style="margin:8px 0 0">Empieza por <b>Identidad</b>: pon tu foto y datos. Luego crea tu primer trabajo o memoria. Cada acción da XP.</p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn sm" data-tab="identidad">✎ Completar identidad</button>
        <button class="btn secondary sm" data-add="proyecto">+ Primer trabajo</button></div></div>`:``;
  return `${createCTA}${onboarding}
    ${cfg.cards.kpis!==false?`
    <div class="card s3"><div class="stat"><span class="num">${active}</span><span class="lbl">Trabajos activos</span></div></div>
    <div class="card s3"><div class="stat"><span class="num" style="color:var(--ok)">${money(inc)}</span><span class="lbl">Ingresos</span></div></div>
    <div class="card s3"><div class="stat"><span class="num">${money(inc-exp)}</span><span class="lbl">Ganancia</span></div></div>
    <div class="card s3"><div class="stat"><span class="num">${a.clan?esc(a.clan):"—"}</span><span class="lbl">${a.clan?"Tu Clan":"Sin Clan aún"}</span></div></div>`:``}
    ${cfg.cards.camino!==false?`<div class="card s12 camino-card">${caminoPixelHTML(lp)}</div>`:``}
    ${cfg.cards.graficos!==false?`
    <div class="card s6"><div class="section-title"><h2>Finanzas por mes</h2></div>${chartFinance(a)}</div>
    <div class="card s6"><div class="section-title"><h2>Trabajos por estado</h2></div>${chartProjects(a)}</div>`:``}
    ${cfg.cards.constelacion!==false?constelacionHTML():``}
    ${cfg.cards.hoy!==false?`<div class="card s6"><div class="section-title"><h2>Hoy</h2><div class="spacer"></div><button class="btn sm" data-add="cita">+ Cita</button></div>
      ${a.agenda.map((x,i)=>`<div class="row"><b style="color:var(--gold);width:60px">${esc(x.h)}</b><div class="grow">${esc(x.t)}</div>${acts("cita",i)}</div>`).join("")||`<p class="muted">Sin agenda hoy.</p>`}</div>`:``}
    ${cfg.cards.memoria!==false?`<div class="card s6"><div class="section-title"><h2>Última memoria</h2><div class="spacer"></div><button class="btn sm" data-add="memoria">+ Memoria</button></div>
      ${a.memories[0]?`<b>${esc(a.memories[0].t)}</b><p class="muted" style="margin:6px 0 0">${esc(a.memories[0].d)}</p>`:`<p class="muted">Aún no hay memorias.</p>`}
      <div style="margin-top:16px"><button class="btn ghost sm" data-go="memoria">Ver memorias →</button></div></div>`:``}`;
}
function vAlmaIdentidad(a){
  if(!a.live) return `<div class="card s12"><p class="muted">Entra o crea tu Alma para editar tu identidad. <button class="btn sm" id="createAlmaBtn" style="margin-left:8px">Crear mi Alma</button></p></div>`;
  const f=(id,l,v,ph="")=>`<div class="field"><label>${l}</label><input id="${id}" value="${esc(v||"")}" placeholder="${ph}"></div>`;
  return `<div class="card s8">
    <div class="section-title"><h2>Identidad creativa</h2></div>
    ${f("id_name","Nombre creativo",a.name)}
    <div style="display:flex;gap:10px"><div style="flex:1">${f("id_disc","Rama artística",a.discipline||a.role,"Muralismo, tattoo…")}</div><div style="flex:1">${f("id_spec","Especialidad",a.specialty)}</div></div>
    <div style="display:flex;gap:10px"><div style="flex:1">${f("id_handle","Alias público",a.handle,"@tualias")}</div><div style="flex:1">${f("id_terr","Territorio",a.territory||a.country,"Ciudad, país")}</div></div>
    <div class="field"><label>Bio</label><textarea id="id_bio" rows="3">${esc(a.bio||"")}</textarea></div>
    ${f("id_tags","Etiquetas (separadas por coma)",(a.tags||[]).join(", "))}
    <div class="section-title" style="margin-top:8px"><h2 style="font-size:16px">Enlaces</h2></div>
    <div style="display:flex;gap:10px"><div style="flex:1">${f("id_web","Sitio web",a.website)}</div><div style="flex:1">${f("id_ig","Instagram",a.instagram)}</div></div>
    <div style="display:flex;gap:10px"><div style="flex:1">${f("id_port","Portafolio",a.portfolio_url)}</div><div style="flex:1">${f("id_shop","Tienda / catálogo",a.shop_url)}</div></div>
    <button class="btn" id="idSave" style="width:100%;margin-top:6px">Guardar identidad</button>
  </div>
  <div class="card s4" style="align-self:start;text-align:center">
    <small class="muted" style="font-weight:850;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px">Foto de perfil</small>
    <div style="margin:14px 0">${avatarHTML(a,"lg")}</div>
    <div class="field"><label>URL de la foto</label><input id="id_photo" value="${esc(a.photo||"")}" placeholder="https://…/foto.jpg"></div>
    <p class="muted" style="font-size:11.5px">Pega el enlace de una imagen (Instagram, Drive público, etc.). La subida de archivos llega pronto.</p>
  </div>`;
}
function vAlmaPublica(a){
  if(!a.live) return `<div class="card s12"><p class="muted">Entra a tu Alma para configurar tu vista pública.</p></div>`;
  const v=a.visibility||{}; const on=k=>v[k]!==false;
  const rows=[["bio","Mostrar mi bio"],["tags","Mostrar mis etiquetas"],["trajectory","Mostrar mi trayectoria"],["portfolio","Mostrar mi portafolio"],["links","Mostrar mis enlaces"]];
  return `<div class="card s12"><span class="pill gold">Vista pública</span>
    <p class="muted" style="max-width:640px">Controla qué ven las demás Almas cuando visitan tu perfil en la comunidad. Tus finanzas, agenda, memorias y clientes <b>siempre son privados</b>.</p>
    ${rows.map(([k,l])=>`<div class="row"><div class="grow"><b>${l}</b></div><button class="toggle ${on(k)?'on':''}" data-pubcfg="${k}"><span></span></button></div>`).join("")}
  </div>`;
}
/* Gráficos simples */
function chartFinance(a){
  const map={};
  a.finance.income.forEach(x=>{const k=(x.d||x.on||"").slice(0,7);if(k){(map[k]=map[k]||{i:0,e:0}).i+=x.a;}});
  a.finance.expense.forEach(x=>{const k=(x.d||x.on||"").slice(0,7);if(k){(map[k]=map[k]||{i:0,e:0}).e+=x.a;}});
  const keys=Object.keys(map).sort().slice(-6);
  if(!keys.length) return `<p class="muted">Aún no hay datos de finanzas.</p>`;
  const max=Math.max(1,...keys.map(k=>Math.max(map[k].i,map[k].e)));
  return `<div class="chart">${keys.map(k=>`<div class="cbar"><div class="cbars"><span class="ci" style="height:${Math.round(map[k].i/max*100)}%" title="Ingresos ${money(map[k].i)}"></span><span class="ce" style="height:${Math.round(map[k].e/max*100)}%" title="Egresos ${money(map[k].e)}"></span></div><small>${k.slice(2)}</small></div>`).join("")}</div>
    <div class="muted" style="font-size:11px;margin-top:8px"><b style="color:var(--ok)">■</b> Ingresos &nbsp; <b style="color:var(--danger)">■</b> Egresos</div>`;
}
function chartProjects(a){
  const counts=FLOW.map(s=>({s,n:a.projects.filter(p=>flowOf(p.st)===s).length}));
  const max=Math.max(1,...counts.map(c=>c.n));
  return `<div>${counts.map(c=>`<div class="hbar"><small>${c.s}</small><div class="hb"><span style="width:${Math.round(c.n/max*100)}%"></span></div><b>${c.n}</b></div>`).join("")}</div>`;
}
async function saveIdentity(){
  const a=me(); if(!a.live) return;
  const g=id=>{const e=document.getElementById(id);return e?e.value.trim():"";};
  const patch={ name:g("id_name"), discipline:g("id_disc"), specialty:g("id_spec"), handle:g("id_handle"),
    territory:g("id_terr"), bio:g("id_bio"), avatar_url:g("id_photo"), website:g("id_web"),
    instagram:g("id_ig"), portfolio_url:g("id_port"), shop_url:g("id_shop"),
    tags:g("id_tags").split(",").map(s=>s.trim()).filter(Boolean) };
  try{ await Cloud.updateAlma(a.almaId,patch);
    a.name=patch.name; a.discipline=patch.discipline; a.specialty=patch.specialty; a.handle=patch.handle;
    a.territory=patch.territory; a.bio=patch.bio; a.photo=patch.avatar_url; a.website=patch.website;
    a.instagram=patch.instagram; a.portfolio_url=patch.portfolio_url; a.shop_url=patch.shop_url; a.tags=patch.tags;
    a.role=patch.discipline||a.role;
    renderAll(); updateAuthUI(await Cloud.session()); alert("Identidad guardada ✓");
  }catch(e){ alert("No se pudo guardar (¿aplicaste la migración 0003?): "+(e.message||e)); }
}
async function togglePublic(key){
  const a=me(); if(!a.live) return; a.visibility=a.visibility||{}; a.visibility[key]=(a.visibility[key]===false);
  try{ await Cloud.updateAlma(a.almaId,{visibility:a.visibility}); }catch(e){}
  renderAll();
}

/* --- Trayectoria --- */
function vTrayectoria(a){
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Trayectoria</h2><div class="spacer"></div><button class="btn sm" data-add="hito">+ Hito</button></div>
    <div class="tl">${a.trajectory.map((n,i)=>`<div class="node"><div style="display:flex;align-items:flex-start"><div class="grow"><div class="yr">${esc(n.y)}</div><b>${esc(n.t)}</b><p class="muted" style="margin:4px 0 0">${esc(n.d)}</p></div>${acts("hito",i)}</div></div>`).join("")||`<p class="muted">Aún no hay hitos.</p>`}</div>
  </div></div>`;
}

/* --- Portafolio (galería tipo Behance) --- */
function isImgUrl(u){ return u && /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(u); }
function vPortafolio(a){
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Portafolio</h2><div class="spacer"></div><span class="muted" style="font-size:12.5px;margin-right:10px">${a.portfolio.length} obras</span><button class="btn sm" data-add="obra">+ Obra</button></div>
    ${a.portfolio.length?`<div class="pf-grid">${a.portfolio.map((p,i)=>{
      const cover=isImgUrl(p.link)?`background-image:url('${esc(p.link)}');background-size:cover;background-position:center`
        :`background:linear-gradient(145deg,${p.c},${shade(p.c,-28)})`;
      return `<div class="pf-card">
        <div class="pf-cover" style="${cover}">${isImgUrl(p.link)?"":`<span>${initials(p.t)}</span>`}<div class="pf-acts">${acts("obra",i)}</div></div>
        <div class="pf-cap"><b>${esc(p.t)}</b><small>${esc([p.k,p.year].filter(Boolean).join(" · "))}</small>${p.desc?`<p>${esc(p.desc)}</p>`:""}${p.link&&!isImgUrl(p.link)?`<a href="${esc(p.link)}" target="_blank" rel="noopener" class="pf-link">Ver →</a>`:""}</div>
      </div>`; }).join("")}</div>`
    :`<p class="muted">Aún no hay obras. Agrega tu primera (puedes pegar el enlace de una imagen como portada).</p>`}
  </div></div>`;
}

/* --- Proyectos: Flujo de trabajo (kanban) --- */
const FLOW=["Cotizando","Aprobado","En producción","Revisión","Entregado","Cerrado"];
function flowOf(st){ if(FLOW.includes(st)) return st; if(st==="En curso") return "En producción"; if(st==="Terminado"||st==="Cerrado") return "Cerrado"; return "Cotizando"; }
function vProyectos(a){
  const cols=FLOW.map(s=>({s,items:[]}));
  a.projects.forEach((p,i)=>{ const col=cols.find(c=>c.s===flowOf(p.st)); (col||cols[0]).items.push({p,i}); });
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Flujo de trabajo</h2><div class="spacer"></div><span class="muted" style="font-size:12.5px;margin-right:10px">${a.projects.length} trabajos</span><button class="btn sm" data-add="proyecto">+ Nuevo trabajo</button></div>
    <div class="kanban">
      ${cols.map(c=>`<div class="kcol"><div class="kcol-h">${c.s.toUpperCase()}<span>${c.items.length||""}</span></div>
        ${c.items.map(({p,i})=>{ const bal=(p.budget||0)-(p.paid||0);
          const meta=[p.client,p.budget?money(p.budget):"",p.budget?("saldo "+money(bal)):""].filter(Boolean).join(" · ");
          return `<div class="kcard"><b>${esc(p.t)}</b><small>${esc(meta)}</small>${p.due?`<small class="muted">Entrega ${esc(p.due)}</small>`:""}${p.desc?`<p>${esc(p.desc)}</p>`:""}
            <select class="kstatus" data-pstatus="${i}">${FLOW.map(s=>`<option ${s===flowOf(p.st)?'selected':''}>${s}</option>`).join("")}</select>
            <div class="kacts">${acts("proyecto",i)}</div></div>`; }).join("")||`<div class="kempty">Sin trabajos.</div>`}
      </div>`).join("")}
    </div>
  </div></div>`;
}
async function setProjectStatus(i,st){
  const a=me(); const p=a.projects[i]; if(!p) return; p.st=st;
  if(a.live && p._id){ try{ await Cloud.updateRow("projects",p._id,{status:st}); }catch(e){ alert("No se pudo mover: "+(e.message||e)); } }
  save(); renderAll();
}

/* --- Finanzas --- */
function vFinanzas(a){
  const inc=sum(a.finance.income), exp=sum(a.finance.expense);
  return `<div class="grid">
    <div class="card s4"><div class="stat"><span class="num" style="color:var(--ok)">${money(inc)}</span><span class="lbl">Ingresos totales</span></div></div>
    <div class="card s4"><div class="stat"><span class="num" style="color:var(--danger)">${money(exp)}</span><span class="lbl">Egresos totales</span></div></div>
    <div class="card s4"><div class="stat"><span class="num">${money(inc-exp)}</span><span class="lbl">Ganancia neta</span></div></div>
    <div class="card s6"><div class="section-title"><h2>Ingresos</h2><div class="spacer"></div><button class="btn sm" data-add="ingreso">+ Ingreso</button></div>
      ${a.finance.income.map((x,i)=>`<div class="row"><div class="grow"><b>${esc(x.t)}</b><br><small>${esc(x.d)}</small></div><span class="amt in">+${money(x.a)}</span>${acts("ingreso",i)}</div>`).join("")||`<p class="muted">Sin ingresos.</p>`}</div>
    <div class="card s6"><div class="section-title"><h2>Egresos</h2><div class="spacer"></div><button class="btn sm secondary" data-add="egreso">+ Egreso</button></div>
      ${a.finance.expense.map((x,i)=>`<div class="row"><div class="grow"><b>${esc(x.t)}</b><br><small>${esc(x.d)}</small></div><span class="amt out">−${money(x.a)}</span>${acts("egreso",i)}</div>`).join("")||`<p class="muted">Sin egresos.</p>`}</div>
    <div class="card s12 muted" style="font-size:12.5px">🔒 Tus finanzas son privadas. Mi Alma ≠ Mi Clan. Nada se comparte automáticamente.</div>
  </div>`;
}

/* --- Agenda --- */
function vAgenda(a){
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Agenda</h2><div class="spacer"></div><button class="btn sm" data-add="cita">+ Cita</button></div>
    ${a.agenda.map((x,i)=>`<div class="row"><b style="color:var(--gold);width:70px">${esc(x.h)}</b><div class="grow">${esc(x.t)}</div>${acts("cita",i)}</div>`).join("")||`<p class="muted">Día libre.</p>`}
  </div></div>`;
}

/* --- Memoria --- */
function vMemoria(a){
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Memorias</h2><div class="spacer"></div><button class="btn sm" data-add="memoria">+ Nueva memoria</button></div>
    ${a.memories.map((m,i)=>`<div class="row"><span style="color:var(--gold);font-size:18px">✦</span><div class="grow"><b>${esc(m.t)}</b><br><small>${esc(m.d)}</small></div>${acts("memoria",i)}</div>`).join("")||`<p class="muted">Aún no guardas memorias.</p>`}
  </div></div>`;
}

/* --- Biblioteca --- */
function vBiblioteca(a){
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Biblioteca</h2><div class="spacer"></div><button class="btn sm" data-add="doc">+ Documento</button></div>
    ${a.library.map((d,i)=>`<div class="row"><span style="font-size:18px">❏</span><div class="grow"><b>${esc(d.t)}</b></div><span class="chip">${esc(d.k)}</span>${acts("doc",i)}</div>`).join("")||`<p class="muted">Biblioteca vacía.</p>`}
    <p class="muted" style="margin-top:16px;font-size:12.5px">LUMBRE en modo IA Local podrá leer estos PDFs y ordenar tu memoria sin enviar nada a internet.</p>
  </div></div>`;
}

/* --- Personalizar --- */
function vConfigBody(a){
  const cfg=getCfg(a);
  const mod=[["trayectoria","Trayectoria"],["portafolio","Portafolio"],["proyectos","Flujo de trabajo"],["finanzas","Finanzas"],["clientes","Clientes"],["cotizador","Cotizador"],["agenda","Agenda"],["memoria","Memorias"],["biblioteca","Biblioteca"]];
  const card=[["constelacion","Mapa de Almas"],["kpis","Indicadores rápidos"],["camino","Camino (pixel art)"],["graficos","Gráficos"],["hoy","Agenda de hoy"],["memoria","Última memoria"]];
  const tg=(g,k,l,on)=>`<div class="row"><div class="grow"><b>${l}</b></div><button class="toggle ${on?'on':''}" data-cfg="${g}:${k}"><span></span></button></div>`;
  return `<div class="card s12"><span class="pill gold">Personalización</span>
      <p class="muted" style="max-width:640px">Configura tu espacio: qué módulos aparecen en tu menú y qué secciones se muestran en tu panel.</p></div>
    <div class="card s6"><div class="section-title"><h2>Módulos del menú</h2></div>${mod.map(([k,l])=>tg("modules",k,l,cfg.modules[k]!==false)).join("")}</div>
    <div class="card s6"><div class="section-title"><h2>Secciones de Mi Alma</h2></div>${card.map(([k,l])=>tg("cards",k,l,cfg.cards[k]!==false)).join("")}</div>`;
}
function vConfig(a){ return `<div class="grid">${vConfigBody(a)}</div>`; }

/* --- Clientes --- */
function vClientes(a){
  const list=a.clients||[];
  return `<div class="grid"><div class="card s12">
    <div class="section-title"><h2>Clientes</h2><div class="spacer"></div><button class="btn sm" data-add="cliente">+ Nuevo cliente</button></div>
    ${list.length?list.map((c,i)=>`<div class="row"><span class="avatar sm" style="background:linear-gradient(145deg,${a.color},${shade(a.color,-22)})">${initials(c.name)}</span>
        <div class="grow"><b>${esc(c.name)}</b><br><small>${esc(c.email||"")}${c.email&&c.phone?" · ":""}${esc(c.phone||"")}</small>${c.notes?`<br><small class="muted">${esc(c.notes)}</small>`:""}</div>${acts("cliente",i)}</div>`).join("")
      :`<p class="muted">Aún no tienes clientes. Se crean solos al guardar una cotización, o agrégalos aquí.</p>`}
  </div></div>`;
}

/* ===========================================================
   COTIZADOR — presupuestos profesionales + PDF
   =========================================================== */
const CURRENCIES={CLP:"$",USD:"US$",EUR:"€",MXN:"MX$",ARS:"AR$",COP:"CO$",PEN:"S/"};
const fmtq=(n,c)=>(CURRENCIES[c]||"$")+Number(n||0).toLocaleString("es-CL");
function blankQuote(){ return { id:null, client_id:null, project_id:null, title:"Cotización", client:"", date:new Date().toISOString().slice(0,10),
  discipline:"", currency:"CLP", taxPct:0, notes:"", items:[{desc:"",qty:1,price:0,unit:"unidad"}] }; }
let quoteDraft = blankQuote();
const quotesKey = a => "anima_quotes_"+(a.almaId||a.id);
function loadQuotes(a){ try{ return JSON.parse(localStorage.getItem(quotesKey(a)))||[]; }catch(e){ return []; } }
function saveQuotes(a,q){ localStorage.setItem(quotesKey(a), JSON.stringify(q)); }
function quoteTotals(){ const sub=quoteDraft.items.reduce((t,it)=>t+(+it.qty||0)*(+it.price||0),0); const tax=sub*(+quoteDraft.taxPct||0)/100; return {sub,tax,total:sub+tax}; }
function readQuoteForm(){
  const g=id=>{const e=document.getElementById(id);return e?e.value:"";};
  quoteDraft.title=g("q_title"); quoteDraft.client=g("q_client"); quoteDraft.date=g("q_date");
  quoteDraft.discipline=g("q_disc"); quoteDraft.currency=g("q_cur"); quoteDraft.taxPct=+g("q_tax")||0; quoteDraft.notes=g("q_notes");
  quoteDraft.items=quoteDraft.items.map((it,i)=>({ desc:g("qi_desc_"+i), qty:+g("qi_qty_"+i)||0, price:+g("qi_price_"+i)||0, unit:g("qi_unit_"+i)||"unidad" }));
}
function vCotizador(a){
  const t=quoteTotals(), cur=quoteDraft.currency;
  const saved = a.live
    ? (state.cloudQuotes||[]).map(q=>({id:q.id,title:q.title,client:q.client_name,date:(q.created_at||"").slice(0,10)}))
    : loadQuotes(a);
  const itemsRows = quoteDraft.items.map((it,i)=>`<div class="qitem">
      <input id="qi_desc_${i}" placeholder="Concepto / obra / servicio" value="${esc(it.desc)}">
      <input id="qi_qty_${i}" type="number" min="0" step="any" value="${it.qty}" title="Cantidad">
      <input id="qi_unit_${i}" placeholder="unidad" value="${esc(it.unit)}" title="Unidad (m², hora, pieza…)">
      <input id="qi_price_${i}" type="number" min="0" step="any" value="${it.price}" title="Precio unitario">
      <div class="qsub">${fmtq((+it.qty||0)*(+it.price||0),cur)}</div>
      <button class="ia danger" data-qdel="${i}" title="Quitar">✕</button>
    </div>`).join("");
  return `<div class="grid">
    <div class="card s8">
      <div class="section-title"><h2>Editor de cotización</h2><div class="spacer"></div>
        <button class="btn ghost sm" id="q_new">＋ Nueva</button>
        <button class="btn secondary sm" id="q_save">Guardar</button>
        <button class="btn sm" id="q_export">⤓ Exportar PDF</button>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:2;min-width:180px"><label>Título</label><input id="q_title" value="${esc(quoteDraft.title)}"></div>
        <div class="field" style="flex:1;min-width:120px"><label>Fecha</label><input id="q_date" type="date" value="${esc(quoteDraft.date)}"></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:2;min-width:180px"><label>Cliente</label><input id="q_client" placeholder="Nombre del cliente" value="${esc(quoteDraft.client)}"></div>
        <div class="field" style="flex:2;min-width:160px"><label>Disciplina / rama</label><input id="q_disc" placeholder="Mural, tattoo, branding, música…" value="${esc(quoteDraft.discipline)}"></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:120px"><label>Moneda</label><select id="q_cur">${Object.keys(CURRENCIES).map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join("")}</select></div>
        <div class="field" style="flex:1;min-width:120px"><label>Impuesto %</label><input id="q_tax" type="number" min="0" step="any" value="${quoteDraft.taxPct}"></div>
      </div>

      <div class="section-title" style="margin-top:8px"><h2 style="font-size:16px">Ítems</h2><div class="spacer"></div><button class="btn sm" data-qadd>+ Ítem</button></div>
      <div class="qhead"><span>Concepto</span><span>Cant.</span><span>Unidad</span><span>Precio</span><span>Subtotal</span><span></span></div>
      ${itemsRows||`<p class="muted">Agrega tu primer ítem.</p>`}

      <div class="field" style="margin-top:14px"><label>Notas / condiciones</label><textarea id="q_notes" rows="2" placeholder="Validez, anticipo, plazos, formas de pago…">${esc(quoteDraft.notes)}</textarea></div>
    </div>

    <div class="card s4" style="align-self:start">
      <span class="pill gold">Resumen</span>
      <div class="row"><div class="grow muted">Subtotal</div><b>${fmtq(t.sub,cur)}</b></div>
      <div class="row"><div class="grow muted">Impuesto (${quoteDraft.taxPct||0}%)</div><b>${fmtq(t.tax,cur)}</b></div>
      <div class="row"><div class="grow"><b>Total</b></div><span class="kpi" style="font-size:24px">${fmtq(t.total,cur)}</span></div>
      <p class="muted" style="font-size:12px;margin-top:8px">Editor adaptable a cualquier rama de arte. Exporta un PDF limpio listo para enviar al cliente.</p>
    </div>

    <div class="card s12">
      <div class="section-title"><h2>Cotizaciones guardadas</h2><div class="spacer"></div><span class="muted" style="font-size:12.5px">${saved.length}</span></div>
      ${saved.map(q=>`<div class="row"><div class="grow"><b>${esc(q.title)}</b><br><small>${esc(q.client||"—")} · ${esc(q.date)}</small></div>
        <button class="btn ghost sm" data-qload="${q.id}">Abrir</button><button class="ia danger" data-qdelete="${q.id}">✕</button></div>`).join("")||`<p class="muted">Aún no guardas cotizaciones.</p>`}
    </div>
  </div>`;
}
function qAddItem(){ readQuoteForm(); quoteDraft.items.push({desc:"",qty:1,price:0,unit:"unidad"}); renderView(); }
function qDelItem(i){ readQuoteForm(); quoteDraft.items.splice(i,1); if(!quoteDraft.items.length) quoteDraft.items.push({desc:"",qty:1,price:0,unit:"unidad"}); renderView(); }
function qNew(){ quoteDraft=blankQuote(); renderView(); }
async function qSave(){
  readQuoteForm(); const a=me();
  if(a.live) return qSaveCloud(a);
  const list=loadQuotes(a);
  if(!quoteDraft.id){ quoteDraft.id="q"+Date.now(); list.unshift(JSON.parse(JSON.stringify(quoteDraft))); }
  else { const i=list.findIndex(x=>x.id===quoteDraft.id); if(i>=0) list[i]=JSON.parse(JSON.stringify(quoteDraft)); else list.unshift(JSON.parse(JSON.stringify(quoteDraft))); }
  saveQuotes(a,list); renderView(); alert("Cotización guardada.");
}
async function qSaveCloud(a){
  const t=quoteTotals();
  try{
    let clientId=quoteDraft.client_id||null;
    if(quoteDraft.client){
      let c=(a.clients||[]).find(x=>(x.name||"").toLowerCase()===quoteDraft.client.toLowerCase());
      if(!c){ const row=await Cloud.insertRow("clients",{alma_id:a.almaId,name:quoteDraft.client}); c={_id:row.id,name:row.name}; (a.clients||(a.clients=[])).unshift(c); }
      clientId=c._id;
    }
    let projectId=quoteDraft.project_id||null;
    if(!projectId && quoteDraft.title){
      const prow=await Cloud.insertRow("projects",{alma_id:a.almaId,title:quoteDraft.title,client:quoteDraft.client||null,status:"Planificado",pct:0,client_id:clientId});
      projectId=prow.id; a.projects.unshift({_id:prow.id,t:quoteDraft.title,st:"Planificado",pct:0,client:quoteDraft.client||""});
    }
    const payload={ alma_id:a.almaId, client_id:clientId, project_id:projectId, title:quoteDraft.title, client_name:quoteDraft.client,
      discipline:quoteDraft.discipline, currency:quoteDraft.currency, tax_pct:quoteDraft.taxPct, notes:quoteDraft.notes,
      items:quoteDraft.items, subtotal:Math.round(t.sub), total:Math.round(t.total) };
    if(quoteDraft.id){ await Cloud.updateRow("quotes",quoteDraft.id,payload); }
    else { const qrow=await Cloud.insertRow("quotes",payload); quoteDraft.id=qrow.id; }
    quoteDraft.client_id=clientId; quoteDraft.project_id=projectId;
    state.cloudQuotes=await Cloud.quotes(a.almaId);
    renderAll(); alert("Cotización guardada en la nube ✓ Cliente y proyecto vinculados.");
  }catch(e){ alert("No se pudo guardar la cotización: "+(e.message||e)); }
}
function qLoad(id){
  const a=me();
  if(a.live){ const q=(state.cloudQuotes||[]).find(x=>x.id===id);
    if(q){ quoteDraft={ id:q.id, client_id:q.client_id, project_id:q.project_id, title:q.title||"Cotización", client:q.client_name||"",
      date:(q.created_at||"").slice(0,10), discipline:q.discipline||"", currency:q.currency||"CLP", taxPct:+q.tax_pct||0, notes:q.notes||"",
      items:(q.items&&q.items.length)?q.items:[{desc:"",qty:1,price:0,unit:"unidad"}] }; renderView(); }
    return;
  }
  const ql=loadQuotes(a).find(x=>x.id===id); if(ql){ quoteDraft=JSON.parse(JSON.stringify(ql)); renderView(); }
}
async function qDeleteSaved(id){
  if(!confirm("¿Eliminar esta cotización?"))return; const a=me();
  if(a.live){ try{ await Cloud.deleteRow("quotes",id); state.cloudQuotes=await Cloud.quotes(a.almaId); renderView(); }catch(e){ alert("No se pudo eliminar: "+(e.message||e)); } return; }
  saveQuotes(a,loadQuotes(a).filter(x=>x.id!==id)); renderView();
}
function qExport(){
  readQuoteForm(); const a=me(), t=quoteTotals(), cur=quoteDraft.currency;
  document.getElementById("printArea").innerHTML=`
    <div class="p-head"><div class="brand"><span class="mark"><svg viewBox="0 0 100 100" fill="none"><path d="M50 7 89 91H72L61 66H39L28 91H11L50 7Z" stroke="#111" stroke-width="6.5" stroke-linejoin="round"/><circle cx="50" cy="49" r="5.5" fill="#111"/></svg></span>ANIMA · ${esc(a.name)}</div><small>Cotización · ${esc(quoteDraft.date)}</small></div>
    <h1 class="p-name">${esc(quoteDraft.title)}</h1>
    <div class="p-sub">${esc(quoteDraft.discipline||a.role||"")} · Cliente: ${esc(quoteDraft.client||"—")}</div>
    <table class="p-table"><thead><tr><th>Concepto</th><th>Cant.</th><th>Unidad</th><th>P. unitario</th><th>Subtotal</th></tr></thead><tbody>
      ${quoteDraft.items.map(it=>`<tr><td>${esc(it.desc)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${fmtq(it.price,cur)}</td><td>${fmtq((+it.qty||0)*(+it.price||0),cur)}</td></tr>`).join("")}
    </tbody></table>
    <table class="p-tot"><tr><td>Subtotal</td><td>${fmtq(t.sub,cur)}</td></tr><tr><td>Impuesto (${quoteDraft.taxPct||0}%)</td><td>${fmtq(t.tax,cur)}</td></tr><tr class="grand"><td>Total</td><td>${fmtq(t.total,cur)}</td></tr></table>
    ${quoteDraft.notes?`<h2>Notas</h2><p>${esc(quoteDraft.notes)}</p>`:``}
    <div class="p-foot">${esc(a.name)} · ${esc(a.city||"")} ${esc(a.country||"")} · ANIMA TSC — The Soul of Creativity</div>`;
  window.print();
}

/* --- Comunidad --- */
function roster(){ return (state.cloudAlmas && state.cloudAlmas.length) ? state.cloudAlmas : state.almas; }
const liveMode = () => !!(state.cloudAlmas && state.cloudAlmas.length);
function authorOf(id){ return (state.cloudAlmas||[]).find(x=>x.id===id) || {name:"Alma",color:"#888"}; }
function vComunidad(a){
  const list=roster(); const clan=SEED_CLANS.find(c=>c.name===a.clan);
  const members=a.clan?list.filter(m=>m.clan===a.clan):[];
  const feed=state.cloudPosts||[];
  const create = a.live ? `<div class="card s12"><div class="section-title"><h2>Comparte con la comunidad</h2></div>
      <div class="field"><input id="postTitle" placeholder="Título (opcional)"></div>
      <div class="field"><textarea id="postBody" rows="2" placeholder="¿Qué estás creando? Comparte un proyecto, idea o pregunta…"></textarea></div>
      <button class="btn" id="postSend">Publicar</button></div>`
    : `<div class="card s12"><p class="muted">Entra a tu Alma para publicar en la comunidad.</p></div>`;
  const wall = `<div class="card s12"><div class="section-title"><h2>Muro de la comunidad</h2><div class="spacer"></div><span class="pill ${liveMode()?'gold':''}">${feed.length} publicaciones</span></div>
      ${feed.length?feed.map(p=>{ const au=authorOf(p.author_alma_id);
        return `<div class="post" data-openpost="${p.id}"><span class="avatar sm" style="background:linear-gradient(145deg,${au.color},${shade(au.color,-22)})">${initials(au.name)}</span>
          <div class="grow"><b>${esc(p.title||au.name)}</b><br><small class="muted">${esc(au.name)} · ${timeAgo(p.created_at)}</small>
          <p style="margin:6px 0 0">${esc((p.body||"").slice(0,160))}${(p.body||"").length>160?"…":""}</p></div></div>`;
      }).join(""):`<p class="muted">Aún no hay publicaciones.${a.live?" ¡Crea la primera!":""}</p>`}</div>`;
  const clanCard = a.clan ? `<div class="card s12"><div class="section-title"><h2>${clan?clan.emoji:"🖤"} ${esc(a.clan)}</h2><div class="spacer"></div><span class="pill">Clan · Nivel 2</span></div>
      <p class="muted">${clan?clan.desc:"Comunidad privada por invitación (2 a 8 Almas)."}</p>
      <div class="alma-grid" style="margin-top:14px">${members.map(almaMini).join("")}</div></div>`
    : `<div class="card s12"><div class="section-title"><h2>Sin Clan aún</h2></div><p class="muted">Un Clan es una comunidad privada por invitación (2 a 8 Almas).</p></div>`;
  return `<div class="grid">${create}${wall}${clanCard}
    <div class="card s12"><div class="section-title"><h2>Constelación de Almas</h2><div class="spacer"></div>
      <span class="pill ${liveMode()?'gold':''}">${liveMode()?'🜂 En vivo · '+list.length+' Almas':'Founding · '+list.length+' Almas'}</span></div>
      <div class="alma-grid">${list.map(almaMini).join("")}</div></div></div>`;
}
async function loadPosts(){ if(!Cloud.enabled) return; try{ state.cloudPosts=await Cloud.posts(); if(state.view==="comunidad") renderView(); }catch(e){} }
async function sendPost(){
  const a=me(); if(!a.live){ alert("Entra a tu Alma para publicar."); return; }
  const title=document.getElementById("postTitle").value.trim(), body=document.getElementById("postBody").value.trim();
  if(!title && !body) return;
  try{ await Cloud.insertRow("posts",{author_alma_id:a.almaId,kind:"post",title,body}); await loadPosts(); }
  catch(e){ alert("No se pudo publicar: "+(e.message||e)); }
}
function openPost(id){
  const p=(state.cloudPosts||[]).find(x=>x.id===id); if(!p) return; const au=authorOf(p.author_alma_id);
  document.getElementById("postModal").classList.add("open");
  document.getElementById("postModalBody").innerHTML=`
    <div style="display:flex;gap:10px;align-items:center">
      <span class="avatar sm" style="background:linear-gradient(145deg,${au.color},${shade(au.color,-22)})">${initials(au.name)}</span>
      <div><b>${esc(au.name)}</b><br><small class="muted">${timeAgo(p.created_at)}</small></div></div>
    ${p.title?`<h2 style="margin:12px 0 4px;letter-spacing:-.03em">${esc(p.title)}</h2>`:""}
    <p style="white-space:pre-wrap">${esc(p.body||"")}</p>
    <div class="section-title" style="margin-top:14px"><h3 style="font-size:14px;margin:0">Comentarios</h3></div>
    <div id="postComments" class="muted">Cargando…</div>
    <div class="lum-input" style="margin-top:10px"><input id="commentInput" placeholder="Escribe un comentario…"><button class="btn" id="commentSend" data-post="${id}">↑</button></div>`;
  loadComments(id);
}
async function loadComments(postId){
  try{ const cs=await Cloud.comments(postId); const box=document.getElementById("postComments"); if(!box) return;
    box.innerHTML=cs.length?cs.map(c=>{ const au=authorOf(c.author_alma_id);
      return `<div class="row"><span class="avatar sm" style="background:linear-gradient(145deg,${au.color},${shade(au.color,-22)})">${initials(au.name)}</span><div class="grow"><b>${esc(au.name)}</b> <small class="muted">${timeAgo(c.created_at)}</small><br>${esc(c.body)}</div></div>`;
    }).join(""):`<p class="muted">Sé la primera Alma en comentar.</p>`;
  }catch(e){}
}
async function sendComment(postId){
  const a=me(); if(!a.live){ alert("Entra a tu Alma para comentar."); return; }
  const el=document.getElementById("commentInput"); const body=el.value.trim(); if(!body) return; el.value="";
  try{ await Cloud.insertRow("comments",{post_id:postId,author_alma_id:a.almaId,body}); loadComments(postId); }catch(e){ alert("No se pudo comentar: "+(e.message||e)); }
}
function closePost(){ document.getElementById("postModal").classList.remove("open"); }
function almaMini(m){
  const lv=levelByKey(m.level); const act=(liveMode()&&!m.live)?`data-pub="${m.id}"`:`data-alma="${m.id}"`;
  return `<div class="card alma-card" ${act}>${avatarHTML(m,"lg")}
    <b style="display:block;letter-spacing:-.02em">${esc(m.name)}</b><small class="muted">${esc(m.role||"")}</small><br>
    <span class="level-badge" style="margin-top:8px;border-color:${lv.color}55;color:${lv.color};font-size:11px">${lv.emoji} ${m.level}</span>
    <div class="muted" style="font-size:11px;margin-top:6px">${esc(m.country||"")}</div></div>`;
}

/* --- Santuario --- */
function vSantuario(a){
  const S=SEED_SANCTUARY, list=roster(), live=liveMode();
  const full=state.almas.filter(x=>x.finance);
  const totalInc=full.reduce((t,x)=>t+sum(x.finance.income),0), totalExp=full.reduce((t,x)=>t+sum(x.finance.expense),0);
  const totalProj=full.reduce((t,x)=>t+x.projects.length,0), activeProj=full.reduce((t,x)=>t+x.projects.filter(p=>p.st==="En curso").length,0);
  const dist=LEVELS.map(l=>({l,n:list.filter(x=>x.level===l.key).length})).filter(d=>d.n>0);
  const top=[...list].sort((x,y)=>y.xp-x.xp).slice(0,5);
  return `<div class="grid">
    <div class="card s12" style="background:linear-gradient(145deg,rgba(208,170,99,.16),rgba(255,255,255,.7))">
      <span class="pill gold">Nivel 3 · Santuario</span><h2 style="font-size:30px;letter-spacing:-.05em;margin:10px 0 4px">${S.emoji} ${S.name}</h2>
      <p class="muted" style="max-width:680px">${S.desc}</p></div>
    <div class="card s3"><div class="stat"><span class="num">${list.length}</span><span class="lbl">Almas</span></div></div>
    <div class="card s3"><div class="stat"><span class="num">${S.clans.length}</span><span class="lbl">Clanes</span></div></div>
    <div class="card s3"><div class="stat"><span class="num">${activeProj}/${totalProj}</span><span class="lbl">Proyectos ${live?'(míos)':'activos'}</span></div></div>
    <div class="card s3"><div class="stat"><span class="num">${money(totalInc-totalExp)}</span><span class="lbl">Ganancia ${live?'(mía)':'general'}</span></div></div>
    <div class="card s7"><div class="section-title"><h2>Clanes del Santuario</h2></div>
      ${S.clans.map(id=>{const c=SEED_CLANS.find(x=>x.id===id); const n=list.filter(m=>m.clan===c.name).length;
        return `<div class="row"><span style="font-size:22px">${c.emoji}</span><div class="grow"><b>${c.name}</b><br><small>${n} Almas · ${c.desc}</small></div></div>`;}).join("")}</div>
    <div class="card s5"><div class="section-title"><h2>Departamentos</h2></div>
      ${S.departments.map(d=>{const l=list.find(x=>x.slug===d.lead)||state.almas.find(x=>x.id===d.lead);return `<div class="row"><div class="grow"><b>${d.t}</b><br><small>Lidera: ${l?esc(l.name):"—"}</small></div></div>`;}).join("")}</div>
    <div class="card s7"><div class="section-title"><h2>Finanzas generales</h2><div class="spacer"></div><span class="pill">${live?'Privadas':'Agregado'}</span></div>
      ${live?`<p class="muted" style="font-size:13px">🔒 En el sistema vivo las finanzas de cada Alma son <b>privadas</b>. Estos números corresponden sólo a tu Alma.</p>`:``}
      <div class="grid" style="gap:14px;margin-top:${live?'10px':'0'}">
        <div class="s4"><div class="stat"><span class="num" style="color:var(--ok);font-size:22px">${money(totalInc)}</span><span class="lbl">Ingresos</span></div></div>
        <div class="s4"><div class="stat"><span class="num" style="color:var(--danger);font-size:22px">${money(totalExp)}</span><span class="lbl">Egresos</span></div></div>
        <div class="s4"><div class="stat"><span class="num" style="font-size:22px">${money(totalInc-totalExp)}</span><span class="lbl">Neto</span></div></div></div></div>
    <div class="card s5"><div class="section-title"><h2>Distribución por nivel</h2></div>
      ${dist.map(d=>`<div class="row"><span style="font-size:18px">${d.l.emoji}</span><div class="grow"><b>${d.l.key}</b></div><span class="chip">${d.n}</span></div>`).join("")}</div>
    <div class="card s12"><div class="section-title"><h2>Almas destacadas (XP)</h2></div>
      ${top.map((m,i)=>`<div class="row"><b style="color:var(--gold);width:24px">${i+1}</b>${avatarHTML(m,"sm")}<div class="grow"><b>${esc(m.name)}</b><br><small>${esc(m.role||"")}</small></div><span class="chip">${m.xp.toLocaleString("es-CL")} XP</span></div>`).join("")}</div>
  </div>`;
}

/* ===========================================================
   EDITOR UNIVERSAL DE REGISTROS (crear / editar / eliminar)
   =========================================================== */
const EDITORS = {
  proyecto:{ title:"Trabajo", table:"projects", get:a=>a.projects, push:"unshift", xp:60,
    fields:[{k:"t",l:"Trabajo"},{k:"client",l:"Cliente"},{k:"st",l:"Estado",sel:["Cotizando","Aprobado","En producción","Revisión","Entregado","Cerrado"]},{k:"pct",l:"Avance %",num:true},{k:"budget",l:"Valor",num:true},{k:"start",l:"Inicio",date:true},{k:"due",l:"Entrega",date:true},{k:"desc",l:"Entregables / notas",ta:true}],
    toRow:v=>({title:v.t,client:v.client,status:v.st,pct:+v.pct||0,budget:v.budget?+v.budget:null,started_at:v.start||null,due_at:v.due||null,description:v.desc}) },
  memoria:{ title:"Memoria", table:"memories", get:a=>a.memories, push:"unshift", xp:40,
    fields:[{k:"t",l:"Título"},{k:"d",l:"Descripción",ta:true}], toRow:v=>({title:v.t,detail:v.d}) },
  ingreso:{ title:"Ingreso", table:"finance_entries", get:a=>a.finance.income, push:"unshift", xp:20,
    fields:[{k:"t",l:"Concepto"},{k:"a",l:"Monto",num:true},{k:"cat",l:"Categoría"},{k:"on",l:"Fecha",date:true},{k:"method",l:"Método (efectivo, transferencia…)"},{k:"d",l:"Periodo (AAAA-MM)"},{k:"notes",l:"Notas",ta:true}],
    toRow:v=>({title:v.t,amount:+v.a||0,period:v.d,kind:"income",category:v.cat,occurred_at:v.on||null,method:v.method,notes:v.notes}) },
  egreso:{ title:"Egreso", table:"finance_entries", get:a=>a.finance.expense, push:"unshift", xp:0,
    fields:[{k:"t",l:"Concepto"},{k:"a",l:"Monto",num:true},{k:"cat",l:"Categoría"},{k:"on",l:"Fecha",date:true},{k:"method",l:"Método (efectivo, transferencia…)"},{k:"d",l:"Periodo (AAAA-MM)"},{k:"notes",l:"Notas",ta:true}],
    toRow:v=>({title:v.t,amount:+v.a||0,period:v.d,kind:"expense",category:v.cat,occurred_at:v.on||null,method:v.method,notes:v.notes}) },
  hito:{ title:"Hito", table:"trajectory", get:a=>a.trajectory, push:"push", xp:50,
    fields:[{k:"y",l:"Año"},{k:"t",l:"Título"},{k:"d",l:"Descripción",ta:true}], toRow:v=>({year:v.y,title:v.t,detail:v.d}) },
  obra:{ title:"Obra", table:"portfolio", get:a=>a.portfolio, push:"push", xp:40,
    fields:[{k:"t",l:"Título"},{k:"k",l:"Tipo / técnica"},{k:"year",l:"Año"},{k:"c",l:"Color",color:true},{k:"link",l:"Enlace"},{k:"desc",l:"Descripción",ta:true}],
    toRow:v=>({title:v.t,kind:v.k,color:v.c,year:v.year,link:v.link,description:v.desc}) },
  cita:{ title:"Cita", table:"agenda", get:a=>a.agenda, push:"push", xp:0,
    fields:[{k:"h",l:"Hora (ej: 15:00)"},{k:"t",l:"Actividad"},{k:"date",l:"Fecha",date:true},{k:"notes",l:"Notas",ta:true}], toRow:v=>({at_time:v.h,title:v.t,on_date:v.date||null,notes:v.notes}) },
  doc:{ title:"Documento", table:"library", get:a=>a.library, push:"push", xp:0,
    fields:[{k:"t",l:"Nombre"},{k:"k",l:"Tipo (Contrato, Brief…)"},{k:"url",l:"Enlace / URL"},{k:"notes",l:"Notas",ta:true}], toRow:v=>({title:v.t,kind:v.k,url:v.url,notes:v.notes}) },
  cliente:{ title:"Cliente", table:"clients", get:a=>(a.clients||(a.clients=[])), push:"unshift", xp:0,
    fields:[{k:"name",l:"Nombre"},{k:"email",l:"Correo"},{k:"phone",l:"Teléfono"},{k:"notes",l:"Notas",ta:true}], toRow:v=>({name:v.name,email:v.email,phone:v.phone,notes:v.notes}) }
};
let recordCtx=null;
function openRecord(kind, idx=null){
  const cfg=EDITORS[kind]; if(!cfg) return; recordCtx={kind,idx};
  const a=me(); const item=(idx!=null)?cfg.get(a)[idx]:{};
  document.getElementById("recTitle").textContent=(idx!=null?"Editar ":"Nuevo/a ")+cfg.title;
  document.getElementById("recFields").innerHTML=cfg.fields.map(f=>{
    const val=(item[f.k]!=null)?item[f.k]:"";
    if(f.sel) return `<div class="field"><label>${f.l}</label><select id="rec_${f.k}">${f.sel.map(o=>`<option ${o==val?'selected':''}>${o}</option>`).join("")}</select></div>`;
    if(f.ta)  return `<div class="field"><label>${f.l}</label><textarea id="rec_${f.k}" rows="3">${esc(val)}</textarea></div>`;
    if(f.color) return `<div class="field"><label>${f.l}</label><input type="color" id="rec_${f.k}" value="${val||a.color||'#b8a892'}"></div>`;
    if(f.date) return `<div class="field"><label>${f.l}</label><input id="rec_${f.k}" type="date" value="${esc(val)}"></div>`;
    return `<div class="field"><label>${f.l}</label><input id="rec_${f.k}" type="${f.num?'number':'text'}" value="${esc(val)}"></div>`;
  }).join("");
  document.getElementById("recDel").style.display=(idx!=null)?"inline-flex":"none";
  document.getElementById("recMsg").textContent="";
  document.getElementById("recordModal").classList.add("open");
}
function closeRecord(){ document.getElementById("recordModal").classList.remove("open"); recordCtx=null; }
async function saveRecord(){
  if(!recordCtx) return; const {kind,idx}=recordCtx; const cfg=EDITORS[kind]; const a=me();
  const v={}; cfg.fields.forEach(f=>{ const el=document.getElementById("rec_"+f.k); v[f.k]=f.num?(+el.value||0):el.value; });
  const first=cfg.fields[0];
  if(first && !String(v[first.k]).trim()){ document.getElementById("recMsg").textContent="Completa: "+first.l; return; }
  const arr=cfg.get(a);
  try{
    if(idx==null){
      const item={...v};
      if(a.live){ const row=await Cloud.insertRow(cfg.table, {...cfg.toRow(v), alma_id:a.almaId}); item._id=row.id; }
      arr[cfg.push==="push"?"push":"unshift"](item);
      if(cfg.xp){ a.xp=(a.xp||0)+cfg.xp; if(a.live){ try{await Cloud.setXP(a.almaId,a.xp);}catch(e){} } await syncLevel(a); }
    }else{
      const item=arr[idx]; Object.assign(item,v);
      if(a.live && item._id){ await Cloud.updateRow(cfg.table,item._id,cfg.toRow(v)); }
    }
    save(); closeRecord(); renderAll();
  }catch(e){ document.getElementById("recMsg").textContent="No se pudo guardar: "+(e.message||e); }
}
async function deleteRecord(kind,idx){
  const cfg=EDITORS[kind]; const a=me(); const arr=cfg.get(a); const item=arr[idx];
  if(!confirm("¿Eliminar este elemento?")) return;
  try{
    if(a.live && item && item._id){ await Cloud.deleteRow(cfg.table,item._id); }
    arr.splice(idx,1); save(); closeRecord(); renderAll();
  }catch(e){ alert("No se pudo eliminar: "+(e.message||e)); }
}
async function syncLevel(a){
  const cur=levelProgress(a.xp).cur.key;
  if(cur!==a.level){ a.level=cur; if(a.live){ try{await Cloud.updateAlma(a.almaId,{level:cur});}catch(e){} } save(); setTimeout(()=>alert("✦ Tu Alma evolucionó a nivel "+cur),60); }
}

/* ===========================================================
   EXPORTAR PDF — Dossier del Alma
   =========================================================== */
function exportPDF(){
  const a=me(), lv=levelByKey(a.level), inc=sum(a.finance.income), exp=sum(a.finance.expense);
  document.getElementById("printArea").innerHTML=`
    <div class="p-head"><div class="brand"><span class="mark"><svg viewBox="0 0 100 100" fill="none"><path d="M50 7 89 91H72L61 66H39L28 91H11L50 7Z" stroke="#111" stroke-width="6.5" stroke-linejoin="round"/><circle cx="50" cy="49" r="5.5" fill="#111"/></svg></span>ANIMA TSC</div><small>Dossier de Alma · ${new Date().toLocaleDateString("es-CL")}</small></div>
    <h1 class="p-name">${esc(a.name)}</h1>
    <div class="p-sub">${lv.emoji} ${a.level} · ${lv.name} · ${a.xp.toLocaleString("es-CL")} XP — ${esc(a.role||"")} · ${esc(a.country||"")}</div>
    <p>${esc(a.bio||"")}</p>
    <div class="p-tags">${(a.tags||[]).map(t=>`<span>${esc(t)}</span>`).join("")}</div>
    <h2>Trayectoria</h2>${a.trajectory.map(n=>`<p><b>${esc(n.y)} · ${esc(n.t)}</b> — ${esc(n.d)}</p>`).join("")||"<p>—</p>"}
    <h2>Proyectos</h2>${a.projects.map(p=>`<p><b>${esc(p.t)}</b> (${esc(p.st)}, ${p.pct}%) — ${esc(p.client)}</p>`).join("")||"<p>—</p>"}
    <h2>Portafolio</h2><p>${a.portfolio.map(p=>esc(p.t)+" ("+esc(p.k)+")").join(" · ")||"—"}</p>
    <h2>Finanzas</h2><p>Ingresos: ${money(inc)} · Egresos: ${money(exp)} · <b>Ganancia: ${money(inc-exp)}</b></p>
    <div class="p-foot">ANIMA TSC — The Soul of Creativity · The Founding Era</div>`;
  window.print();
}

/* ===========================================================
   LUMBRE — motor agente local
   =========================================================== */
function renderLumbre(){
  const a=me();
  document.getElementById("lumbreMode").innerHTML=LUMBRE_MODES.map(m=>`<div class="mode ${state.lumbreMode===m.key?'on':''}" data-mode="${m.key}"><b>${m.name}</b><small>${m.desc}</small></div>`).join("");
  const body=document.getElementById("lumbreChat");
  const intro=`<div class="msg lum"><b>LUMBRE</b><br>Soy el motor de ANIMA para <b>${esc(a.name)}</b>. Modo: <b>${modeName()}</b>. Pregúntame por finanzas, proyectos, trayectoria o pídeme sugerencias.</div>`;
  body.innerHTML=intro+state.chat.map(m=>`<div class="msg ${m.role==='you'?'you':'lum'}">${m.role==='lum'?'<b>LUMBRE</b><br>':''}${m.text}</div>`).join("");
  body.scrollTop=body.scrollHeight;
}
const modeName=()=>(LUMBRE_MODES.find(m=>m.key===state.lumbreMode)||{}).name;
function lumbreAsk(q){ state.chat.push({role:"you",text:esc(q)}); state.chat.push({role:"lum",text:lumbreThink(q)}); save(); renderLumbre(); }
function lumbreThink(q){
  const a=me(), t=q.toLowerCase();
  if(state.lumbreMode==="OFF") return "Estoy en modo <b>OFF</b>: solo organización manual. Actívame en Básico, IA Local o IA Conectada.";
  const inc=sum(a.finance.income), exp=sum(a.finance.expense), ai=(state.lumbreMode==="LOCAL"||state.lumbreMode==="CLOUD");
  if(/finanz|ingreso|egreso|ganan|plata|dinero|gast/.test(t)){ const m=exp>inc*0.7?" Tus egresos son altos respecto a tus ingresos.":" Tu margen está sano."; return `Finanzas: ingresos ${money(inc)}, egresos ${money(exp)}, <b>ganancia ${money(inc-exp)}</b>.${ai?m:""}`; }
  if(/cotiz|presupuesto|precio/.test(t)) return `Abre el <b>Cotizador</b> para armar un presupuesto profesional y exportarlo en PDF. ${ai?"Puedo sugerir precios según tus proyectos anteriores.":""}`;
  if(/proyect|trabajo|encargo/.test(t)){ const act=a.projects.filter(p=>p.st==="En curso"); const s=ai&&act[0]?` Enfócate en "${esc(act[0].t)}" (${act[0].pct}%).`:""; return `Tienes ${act.length} proyecto(s) en curso de ${a.projects.length}.${s}`; }
  if(/trayectoria|historia|hito/.test(t)){ const l=a.trajectory[a.trajectory.length-1]; return l?`Tu último hito: <b>${esc(l.t)}</b> (${esc(l.y)}).`:"Aún no tienes hitos. Agrega el primero en Trayectoria."; }
  if(/portafolio|obra/.test(t)) return `Tu portafolio tiene ${a.portfolio.length} obras.`;
  if(/nivel|xp|sube|progreso/.test(t)){ const lp=levelProgress(a.xp); return lp.next?`Estás en <b>${a.level}</b> con ${a.xp.toLocaleString("es-CL")} XP. Te faltan ${(lp.next.xp-a.xp).toLocaleString("es-CL")} para <b>${lp.next.key}</b>.`:`Eres <b>ANIMA</b>. Nivel máximo. ∞`; }
  if(/resumen|reporte/.test(t)) return `Resumen: ${a.projects.filter(p=>p.st==="En curso").length} proyectos activos · ganancia ${money(inc-exp)} · nivel ${a.level} · ${a.memories.length} memorias.`;
  if(/hola|hey|buenas/.test(t)) return `Hola, ${esc(a.name.split(" ")[0])}. ¿Reviso tus finanzas, proyectos o tu siguiente nivel?`;
  return ai?`Puedo ayudarte con finanzas, cotizaciones, proyectos, trayectoria, niveles y reportes.`:"En modo Básico organizo finanzas, proyectos, documentos y portafolio.";
}

/* ===========================================================
   AUTH (Supabase)
   =========================================================== */
async function refreshAuth(){
  if(!Cloud.enabled){ updateAuthUI(null); return; }
  try{ state.cloudAlmas=await Cloud.allAlmas(); }catch(e){}
  const s=await Cloud.session();
  isCreator = !!(s && s.user && (s.user.email||"").toLowerCase() === CREATOR_EMAIL);
  if(s){ const pend=localStorage.getItem("anima_pending_invite"); if(pend){ try{await Cloud.redeemInvite(pend);}catch(e){} localStorage.removeItem("anima_pending_invite"); }
    await loadMyAlma(); updateAuthUI(s);
  }else{ if(state.almas.some(x=>x.live)){ state.almas=JSON.parse(JSON.stringify(SEED_ALMAS)); state.currentId="guest"; } updateAuthUI(null); renderAll(); }
}
async function loadMyAlma(){
  const row=await Cloud.myAlma(); if(!row) return;
  const mods=await Cloud.loadModules(row.id); const a=dbAlmaToState(row,mods);
  try{ a.clients=(await Cloud.clients(row.id)).map(c=>({_id:c.id,name:c.name,email:c.email,phone:c.phone,notes:c.notes})); }catch(e){ a.clients=[]; }
  try{ state.cloudQuotes=await Cloud.quotes(row.id); }catch(e){ state.cloudQuotes=[]; }
  try{ const p=await Cloud.getPrefs(row.id); if(p) localStorage.setItem("anima_cfg_"+row.id, JSON.stringify(p)); }catch(e){}
  state.almas=[a];   // tu Alma viva, limpia (las de muestra no se mezclan)
  state.currentId=a.id; state.view="mialma"; state.chat=[]; renderAll();
}
function updateAuthUI(session){
  const btn=document.getElementById("authBtn"); if(!btn) return;
  if(session){ const a=state.almas.find(x=>x.live); btn.textContent=a?("● "+a.name.split(" ")[0]):"● Mi cuenta"; btn.dataset.in="1"; }
  else { btn.textContent=Cloud.enabled?"Entrar":"Modo local"; btn.dataset.in=""; }
}
function openAuth(){ if(!Cloud.enabled){ alert("Conexión a la nube no disponible. ANIMA funciona en modo Fundadores local."); return; }
  document.getElementById("authModal").classList.add("open"); document.getElementById("authMsg").textContent=""; }
function closeAuth(){ document.getElementById("authModal").classList.remove("open"); }
async function doAuth(mode){
  const g=id=>document.getElementById(id).value, email=g("authEmail").trim(), pass=g("authPass"),
    name=g("authName").trim(), code=(g("authCode")||"").trim().toUpperCase(), msg=document.getElementById("authMsg");
  if(!email||!pass){ msg.textContent="Ingresa correo y contraseña."; return; }
  msg.textContent="…";
  try{
    if(mode==="up"){
      if(!code){ msg.textContent="Necesitas un código de invitación (beta cerrada)."; return; }
      if(!await Cloud.checkInvite(code)){ msg.textContent="Código de invitación inválido o ya usado."; return; }
      localStorage.setItem("anima_pending_invite",code);
      const {data,error}=await Cloud.signUp(email,pass,name||email.split("@")[0]); if(error) throw error;
      if(!data.session){ msg.textContent="Alma creada. Revisa tu correo para confirmar y vuelve a entrar."; return; }
    }else{ const {error}=await Cloud.signIn(email,pass); if(error) throw error; }
    closeAuth(); await refreshAuth();
  }catch(e){ msg.textContent=e.message||"No se pudo completar."; }
}
async function logout(){ if(!confirm("¿Salir de tu Alma?"))return; await Cloud.signOut();
  isCreator=false; state.almas=JSON.parse(JSON.stringify(SEED_ALMAS)); state.currentId="guest"; state.view="mialma"; save(); renderAll(); updateAuthUI(null); }

/* --- Editar perfil --- */
function openEdit(){ const a=me(); if(!a.live){ if(Cloud.enabled){ openAuth(); } else { alert("Entra a tu Alma para editar."); } return; }
  const s=(id,v)=>document.getElementById(id).value=v||"";
  s("edName",a.name);s("edRole",a.role);s("edCity",a.city);s("edCountry",a.country);s("edBio",a.bio);s("edTags",(a.tags||[]).join(", "));
  document.getElementById("editModal").classList.add("open"); }
function closeEdit(){ document.getElementById("editModal").classList.remove("open"); }
async function saveEdit(){ const a=me(); const g=id=>document.getElementById(id).value.trim();
  const patch={name:g("edName"),role:g("edRole"),city:g("edCity"),country:g("edCountry"),bio:g("edBio"),tags:g("edTags").split(",").map(s=>s.trim()).filter(Boolean)};
  try{ await Cloud.updateAlma(a.almaId,patch); Object.assign(a,patch); closeEdit(); renderAll(); updateAuthUI(await Cloud.session()); }
  catch(e){ alert("No se pudo guardar: "+(e.message||e)); } }

/* --- Perfil público --- */
async function openPublic(id){
  const row=(state.cloudAlmas||[]).find(x=>x.id===id); if(!row) return;
  const lv=levelByKey(row.level); const vis=row.visibility||{}; const show=k=>vis[k]!==false;
  const av=row.avatar_url?`background-image:url('${esc(row.avatar_url)}');background-size:cover;background-position:center`:`background:linear-gradient(145deg,${row.color},${shade(row.color,-22)})`;
  document.getElementById("publicModal").classList.add("open");
  document.getElementById("pubBody").innerHTML=`<div style="text-align:center">
      <span class="avatar lg" style="margin:0 auto 10px;${av}">${row.avatar_url?"":initials(row.name)}</span>
      <h2 style="margin:0;letter-spacing:-.04em">${esc(row.name)}</h2><div class="muted">${esc([row.discipline||row.role,row.specialty].filter(Boolean).join(" · "))} · ${esc(row.territory||row.country||"")}</div>
      <span class="level-badge" style="margin-top:8px;border-color:${lv.color}55;color:${lv.color}">${lv.emoji} ${lv.label}</span>
      <div style="margin-top:12px"><a class="btn sm" href="portfolio.html?alma=${id}" target="_blank" rel="noopener">Ver portafolio completo →</a></div></div>
    ${show("bio")?`<p style="margin-top:14px">${esc(row.bio||"")}</p>`:""}${show("tags")?`<div>${(row.tags||[]).map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div>`:""}
    <div id="pubExtra" class="muted" style="font-size:12.5px;margin-top:12px">Cargando…</div>`;
  try{ const m=await Cloud.loadModules(id);
    const tj=show("trajectory")?(m.trajectory||[]).map(x=>`<div class="node"><div class="yr">${esc(x.year)}</div><b>${esc(x.title)}</b><p class="muted" style="margin:2px 0 0">${esc(x.detail||"")}</p></div>`).join(""):"";
    const pf=show("portfolio")?(m.portfolio||[]).map(x=>`<span class="chip">${esc(x.title)} · ${esc(x.kind)}</span>`).join(""):"";
    document.getElementById("pubExtra").innerHTML=(tj?`<h3 style="font-size:15px;margin:8px 0 4px">Trayectoria</h3><div class="tl">${tj}</div>`:"")+(pf?`<h3 style="font-size:15px;margin:14px 0 6px">Portafolio</h3><div>${pf}</div>`:"")||"Perfil público.";
  }catch(e){ document.getElementById("pubExtra").textContent=""; }
}
function closePublic(){ document.getElementById("publicModal").classList.remove("open"); }

/* --- Feedback --- */
let _fbRating=0;
function openFeedback(){ if(!Cloud.enabled||!me().live){ alert("Entra a tu Alma para enviar feedback."); return; }
  _fbRating=0; document.getElementById("fbMsg").value=""; document.getElementById("fbStatus").textContent=""; renderStars();
  document.getElementById("feedbackModal").classList.add("open"); }
function closeFeedback(){ document.getElementById("feedbackModal").classList.remove("open"); }
function renderStars(){ document.getElementById("fbStars").innerHTML=[1,2,3,4,5].map(n=>`<span data-star="${n}" style="cursor:pointer;font-size:26px;color:${n<=_fbRating?'#d0aa63':'#ccc'}">★</span>`).join(""); }
async function sendFeedback(){ const message=document.getElementById("fbMsg").value.trim(), st=document.getElementById("fbStatus");
  if(!message&&!_fbRating){ st.textContent="Escribe algo o deja una estrella."; return; } st.textContent="Enviando…";
  try{ await Cloud.sendFeedback({rating:_fbRating||null,message,context:state.view,almaName:me().name}); st.textContent="¡Gracias! Tu voz construye ANIMA. 🜂"; setTimeout(closeFeedback,1100); }
  catch(e){ st.textContent="No se pudo enviar: "+(e.message||e); } }

/* ===========================================================
   RENDER + EVENTOS
   =========================================================== */
function renderAll(){ renderNav(); renderWho(); renderTop(); renderView(); }
function go(view){ state.view=view; save(); renderAll(); document.getElementById("view").scrollTop=0; closeSide(); if(view==="comunidad") loadPosts(); }
function switchAlma(id){ state.currentId=id; state.view="mialma"; state.chat=[]; save(); renderAll(); renderLumbre(); }
const drawer=()=>document.getElementById("drawer"), dbg=()=>document.getElementById("drawerBg");
function openLumbre(){ drawer().classList.add("open"); dbg().classList.add("open"); renderLumbre(); }
function closeLumbre(){ drawer().classList.remove("open"); dbg().classList.remove("open"); }
function closeSide(){ document.getElementById("side").classList.remove("open"); }

document.addEventListener("click", e=>{
  const rn=e.target.closest("[data-reino]"); if(rn){ toggleReino(rn.dataset.reino); return; }
  const ed=e.target.closest("[data-edit]"); if(ed){ const [k,i]=ed.dataset.edit.split(":"); openRecord(k,+i); return; }
  const dl=e.target.closest("[data-del]"); if(dl){ const [k,i]=dl.dataset.del.split(":"); deleteRecord(k,+i); return; }
  const st=e.target.closest("[data-star]"); if(st){ _fbRating=+st.dataset.star; renderStars(); return; }
  const cf=e.target.closest("[data-cfg]"); if(cf){ toggleCfg(cf.dataset.cfg); return; }
  const tb=e.target.closest("[data-tab]"); if(tb){ state.almaTab=tb.dataset.tab; state.view="mialma"; renderAll(); return; }
  const pcf=e.target.closest("[data-pubcfg]"); if(pcf){ togglePublic(pcf.dataset.pubcfg); return; }
  const mz=e.target.closest("[data-mapsize]"); if(mz){ setMapSize(mz.dataset.mapsize); return; }
  const op=e.target.closest("[data-openpost]"); if(op){ openPost(op.dataset.openpost); return; }
  const ql=e.target.closest("[data-qload]"); if(ql){ qLoad(ql.dataset.qload); return; }
  const qx=e.target.closest("[data-qdelete]"); if(qx){ qDeleteSaved(qx.dataset.qdelete); return; }
  const qd=e.target.closest("[data-qdel]"); if(qd){ qDelItem(+qd.dataset.qdel); return; }
  if(e.target.closest("[data-qadd]")){ qAddItem(); return; }
  const t=e.target.closest("[data-view],[data-alma],[data-pub],[data-go],[data-add],[data-mode]");
  if(t){ if(t.dataset.view) go(t.dataset.view);
    else if(t.dataset.go) go(t.dataset.go);
    else if(t.dataset.alma) switchAlma(t.dataset.alma);
    else if(t.dataset.pub) openPublic(t.dataset.pub);
    else if(t.dataset.add) openRecord(t.dataset.add,null);
    else if(t.dataset.mode){ state.lumbreMode=t.dataset.mode; save(); renderLumbre(); }
    return; }
  if(e.target.closest("#q_new")) qNew();
  if(e.target.closest("#q_save")) qSave();
  if(e.target.closest("#q_export")) qExport();
  if(e.target.closest("#createAlmaBtn")) openAuth();
  if(e.target.closest("#idSave")) saveIdentity();
  if(e.target.closest("#edSave")) saveEdit();
  if(e.target.closest("#edClose")||e.target.id==="editModal") closeEdit();
  if(e.target.closest("#recSave")) saveRecord();
  if(e.target.closest("#recDel")){ if(recordCtx) deleteRecord(recordCtx.kind,recordCtx.idx); }
  if(e.target.closest("#recClose")||e.target.id==="recordModal") closeRecord();
  if(e.target.closest("#pubClose")||e.target.id==="publicModal") closePublic();
  if(e.target.closest("#postSend")) sendPost();
  if(e.target.closest("#commentSend")){ const b=e.target.closest("#commentSend"); sendComment(b.dataset.post); }
  if(e.target.closest("#postClose")||e.target.id==="postModal") closePost();
  if(e.target.closest("#feedbackBtn")) openFeedback();
  if(e.target.closest("#fbSend")) sendFeedback();
  if(e.target.closest("#fbClose")||e.target.id==="feedbackModal") closeFeedback();
  if(e.target.closest("#lumbreOpen")) openLumbre();
  if(e.target.closest("#lumbreClose")||e.target.id==="drawerBg") closeLumbre();
  if(e.target.closest("#menuBtn")) document.getElementById("side").classList.toggle("open");
  if(e.target.closest("#whoBox")) go("mialma");
  if(e.target.closest("#resetBtn")) reset();
  if(e.target.closest("#installBtn")) installApp();
  if(e.target.closest("#lumbreFab")) openLumbre();
  if(e.target.closest("#tourBtn")) startTour();
  if(e.target.closest("#tourNext")) tourNext();
  if(e.target.closest("#tourSkip")) endTour();
  if(e.target.closest("#levelsInfo")) openLevels();
  if(e.target.closest("#levelClose")||e.target.id==="levelModal") closeLevels();
  if(e.target.closest("#sharePf")) sharePortfolio();
  if(e.target.closest("[data-export]")) exportPDF();
  if(e.target.closest("#authBtn")){ const b=e.target.closest("#authBtn"); b.dataset.in?logout():openAuth(); }
  if(e.target.closest("#authClose")||e.target.id==="authModal") closeAuth();
  if(e.target.closest("#authSignIn")) doAuth("in");
  if(e.target.closest("#authSignUp")) doAuth("up");
  if(e.target.closest("#lumbreSend")) sendLumbre();
});
document.addEventListener("keydown", e=>{
  if(e.key==="Enter" && e.target.id==="lumbreInput") sendLumbre();
  if(e.key==="Enter" && e.target.id==="commentInput"){ const b=document.getElementById("commentSend"); if(b) sendComment(b.dataset.post); }
});
document.addEventListener("change", e=>{
  const ks=e.target.closest(".kstatus"); if(ks){ setProjectStatus(+ks.dataset.pstatus, ks.value); }
});
function sendLumbre(){ const i=document.getElementById("lumbreInput"), v=i.value.trim(); if(!v)return; i.value=""; lumbreAsk(v); }

/* ---------- Compartir portafolio ---------- */
function portfolioURL(a){ const base=location.origin+location.pathname.replace(/[^/]*$/,""); return base+"portfolio.html?alma="+a.almaId; }
function sharePortfolio(){ const a=me(); if(!a.live){ alert("Crea tu Alma para tener tu portafolio público compartible."); return; }
  const url=portfolioURL(a);
  if(navigator.share){ navigator.share({title:"Portafolio · "+a.name, url}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>alert("Enlace de tu portafolio copiado:\n"+url)); }
  else prompt("Tu portafolio:",url);
}

/* ---------- Tutorial guiado por LUMBRE ---------- */
const TOUR=[
  {sel:"#nav", title:"Tu menú", text:"Aquí vive tu Alma: trayectoria, portafolio, finanzas, cotizador, clientes y más. Lo que no uses, lo ocultas en Ajustes."},
  {sel:".tabbar", title:"Tu perfil", text:"Mi Alma tiene pestañas: Resumen, Identidad (tu foto y datos), Vista pública (qué muestras) y Ajustes."},
  {sel:".camino-card", title:"Tu camino", text:"Subes de nivel creando. Cada nivel desbloquea nuevas ventanas. Toca la ⓘ para ver el mapa de niveles."},
  {sel:".map-card", title:"El mundo", text:"El Mapa de Almas muestra a la comunidad que va entrando a ANIMA, ubicada en el planeta."},
  {sel:"#lumbreFab", title:"Soy LUMBRE ✦", text:"Tu chispa compañera. Tócame cuando quieras: te ayudo con finanzas, proyectos y tu siguiente nivel. ¡Bienvenida a ANIMA!"}
];
function startTour(){ closeLumbre(); state.view="mialma"; state.almaTab="resumen"; renderAll(); setTimeout(()=>tourStep(0),360); }
function tourStep(i){
  if(i>=TOUR.length) return endTour();
  state.tourI=i; const step=TOUR[i]; const el=document.querySelector(step.sel);
  document.getElementById("tour").classList.add("open");
  if(!el){ return tourStep(i+1); }
  el.scrollIntoView({block:"center",behavior:"smooth"});
  setTimeout(()=>{
    const r=el.getBoundingClientRect();
    const ring=document.getElementById("tourRing");
    ring.style.cssText=`top:${r.top-6}px;left:${Math.max(6,r.left-6)}px;width:${Math.min(r.width+12,window.innerWidth-12)}px;height:${r.height+12}px`;
    const bub=document.getElementById("tourBub");
    bub.innerHTML=`<img class="lumbre" src="assets/img/lumbre.svg" width="42" height="50" alt="">
      <div style="flex:1"><b>${step.title}</b><p>${step.text}</p>
      <div class="trow"><span class="muted" style="font-size:11px">${i+1}/${TOUR.length}</span><span style="flex:1"></span>
      <button class="btn ghost sm" id="tourSkip">Saltar</button><button class="btn sm" id="tourNext">${i===TOUR.length-1?"¡Listo!":"Siguiente"}</button></div></div>`;
    let top=r.bottom+12; if(top> window.innerHeight-170) top=Math.max(12,r.top-170);
    let left=Math.max(12,Math.min(window.innerWidth-330, r.left));
    bub.style.cssText=`top:${top}px;left:${left}px`;
  },380);
}
function tourNext(){ tourStep((state.tourI||0)+1); }
function endTour(){ document.getElementById("tour").classList.remove("open"); localStorage.setItem("anima_tour_done","1"); }

/* ---------- PWA (instalable) ---------- */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferredPrompt=e; const b=document.getElementById("installBtn"); if(b) b.hidden=false; });
window.addEventListener("appinstalled", ()=>{ deferredPrompt=null; const b=document.getElementById("installBtn"); if(b) b.hidden=true; });
async function installApp(){
  if(deferredPrompt){ deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; const b=document.getElementById("installBtn"); if(b) b.hidden=true; }
  else { alert("Para instalar ANIMA:\n\n• iPhone/iPad (Safari): botón Compartir → \"Agregar a inicio\".\n• Android (Chrome): menú ⋮ → \"Instalar app\".\n• Computador (Chrome/Edge): ícono de instalar en la barra de direcciones."); }
}

/* ---------- Boot ---------- */
renderAll();
refreshAuth();
if("serviceWorker" in navigator){ window.addEventListener("load", ()=>navigator.serviceWorker.register("sw.js").catch(()=>{})); }
if(!localStorage.getItem("anima_tour_done")){ setTimeout(()=>{ if(!localStorage.getItem("anima_tour_done")) startTour(); }, 1100); }
