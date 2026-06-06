import React,{useEffect,useRef,useState,useCallback}from"react";
import*as THREE from"three";

/* ── Font injection ── */
if(typeof document!=="undefined"&&!document.getElementById("aybo-designer-fonts")){
  const l=document.createElement("link");l.id="aybo-designer-fonts";l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap";document.head.appendChild(l);
  const s=document.createElement("style");s.id="aybo-designer-css";s.textContent=`
    [title]{position:relative;}
    button[title]:hover::after{content:attr(title);position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:rgba(26,18,8,.92);color:#faf8f5;padding:4px 8px;border-radius:3px;font-size:10px;white-space:nowrap;pointer-events:none;font-family:'Inter',sans-serif;letter-spacing:.04em;z-index:1000;border:1px solid rgba(201,168,76,.2);}
  `;document.head.appendChild(s);
}

/* ═══ THEME ═══ */
const T={
  bg:"#1e1e1e",      bg2:"#252526",      bg3:"#2d2d2d",     bg4:"#333333",
  bg5:"#3c3c3c",     ribbon:"#252526",   border:"#3e3e3e",  border2:"#525252",
  accent:"#0098ff",  accent2:"#1aafff",  accentDim:"rgba(0,152,255,.12)",
  gold:"#c9a84c",    gold2:"#e8c97a",    goldD:"#7a5c20",
  dark:"#141414",    dark2:"#0a0a0a",    dark3:"#050505",
  text:"#cccccc",    textDim:"#6c6c6c",  textMid:"#999999",  textBri:"#ffffff",
  green:"#4ec94e",   red:"#f44747",      yellow:"#dcdcaa",   cyan:"#4ec9b0",
  pink:"#f48fb1",    orange:"#ce9178",   purple:"#c586c0",
  viewport:"#1a1a1a",
};

/* ═══ CONSTANTS ═══ */
const SC=64,SN=0.25;
const snapV=v=>Math.round(v/SN)*SN;
const wLen=w=>Math.hypot(w.e.x-w.s.x,w.e.y-w.s.y);
const wAng=w=>Math.atan2(w.e.y-w.s.y,w.e.x-w.s.x);
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const near=(a,b,t=0.28)=>Math.hypot(a.x-b.x,a.y-b.y)<t;
const dist2seg=(p,a,b)=>{
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(!l2)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
const lineInt=(p1,p2,p3,p4)=>{
  const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d2x=p4.x-p3.x,d2y=p4.y-p3.y;
  const d=d1x*d2y-d1y*d2x;if(Math.abs(d)<1e-10)return null;
  const t=((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/d;
  const u=((p3.x-p1.x)*d1y-(p3.y-p1.y)*d1x)/d;
  if(t>=0&&t<=1&&u>=0&&u<=1)return{x:p1.x+t*d1x,y:p1.y+t*d1y};return null;
};
const fmt=(v,u)=>u==="cm"?`${(v*100).toFixed(0)}cm`:u==="ft"?`${(v*3.281).toFixed(2)}'`:`${v.toFixed(2)}m`;
const angSnap=(s,raw,ortho)=>{
  const dx=raw.x-s.x,dy=raw.y-s.y,l=Math.hypot(dx,dy);if(l<.05)return raw;
  const a=Math.atan2(dy,dx);
  if(ortho){const sn=Math.round(a/(Math.PI/2))*(Math.PI/2);return{x:snapV(s.x+l*Math.cos(sn)),y:snapV(s.y+l*Math.sin(sn))};}
  const sn=Math.round(a/(Math.PI/8))*(Math.PI/8);
  return Math.abs(a-sn)<Math.PI/24?{x:snapV(s.x+l*Math.cos(sn)),y:snapV(s.y+l*Math.sin(sn))}:raw;
};

/* ═══ SNAP ENGINE ═══ */
const SNAPS={
  END:{label:"Endpoint",color:"#ffcc00"},
  MID:{label:"Midpoint",color:"#00ee88"},
  INT:{label:"Intersection",color:"#ff4444"},
  GRD:{label:"Grid",color:"#4488ff"},
};
function getSnap(raw,walls,en,tol=0.48){
  let best=null,bestD=tol,type="GRD";
  if(en.END)walls.forEach(w=>{[w.s,w.e].forEach(ep=>{const d=Math.hypot(raw.x-ep.x,raw.y-ep.y);if(d<bestD){bestD=d;best={...ep};type="END";}});});
  if(en.MID)walls.forEach(w=>{const mp=mid(w.s,w.e);const d=Math.hypot(raw.x-mp.x,raw.y-mp.y);if(d<bestD){bestD=d;best={...mp};type="MID";}});
  if(en.INT)for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){const ix=lineInt(walls[i].s,walls[i].e,walls[j].s,walls[j].e);if(ix){const d=Math.hypot(raw.x-ix.x,raw.y-ix.y);if(d<bestD){bestD=d;best={...ix};type="INT";}}}
  if(!best&&en.GRD)best={x:snapV(raw.x),y:snapV(raw.y)};
  return{pt:best||raw,type};
}

/* ═══ WALL AUTO-JOIN ═══ */
function autoJoin(newPt,walls,tol=0.35){
  for(const w of walls){
    if(near(newPt,w.s,tol))return{...w.s};
    if(near(newPt,w.e,tol))return{...w.e};
  }
  return newPt;
}

/* ═══ ROOM DETECTION ═══ */
const ROOM_NAMES=["Salon","Chambre","Cuisine","Bureau","Couloir","Salle de bain","Dressing","Hall","Suite","Entrée","Cellier","Séjour","Véranda","Studio","Atelier","Cave"];
function detectRooms(walls){
  if(walls.length<3)return[];
  const nodes=[],getN=pt=>{for(let i=0;i<nodes.length;i++)if(near(nodes[i],pt))return i;nodes.push({...pt});return nodes.length-1;};
  const edges=walls.map(w=>({a:getN(w.s),b:getN(w.e)}));
  const adj=Array.from({length:nodes.length},()=>[]);
  edges.forEach(e=>{adj[e.a].push(e.b);adj[e.b].push(e.a);});
  const rooms=[],seen=new Set();
  const dfs=(path,vis)=>{
    const cur=path[path.length-1];
    if(path.length>3&&near(nodes[cur],nodes[path[0]])){const k=[...path].sort().join(",");if(!seen.has(k)){seen.add(k);rooms.push([...path]);}return;}
    if(path.length>8)return;
    adj[cur].forEach(to=>{if(path.length>1&&to===path[path.length-2])return;if(path.length>2&&vis.has(to))return;dfs([...path,to],new Set([...vis,to]));});
  };
  for(let i=0;i<nodes.length;i++)if(adj[i].length>=2)dfs([i],new Set([i]));
  return rooms.map(p=>{
    const poly=p.map(ni=>nodes[ni]);
    const area=Math.abs(poly.reduce((a,pt,i)=>{const n=poly[(i+1)%poly.length];return a+pt.x*n.y-n.x*pt.y;},0))/2;
    return{poly,area,cx:poly.reduce((a,pt)=>a+pt.x,0)/poly.length,cy:poly.reduce((a,pt)=>a+pt.y,0)/poly.length};
  }).filter(r=>r.area>0.4).sort((a,b)=>a.area-b.area).slice(0,16);
}

/* ═══ TEMPLATES ═══ */
const TPL={
  salon:{name:"Salon",walls:[{s:{x:1,y:1},e:{x:9,y:1}},{s:{x:9,y:1},e:{x:9,y:7}},{s:{x:9,y:7},e:{x:1,y:7}},{s:{x:1,y:7},e:{x:1,y:1}},{s:{x:4.5,y:1},e:{x:4.5,y:5}}]},
  chambre:{name:"Chambre",walls:[{s:{x:1,y:1},e:{x:8,y:1}},{s:{x:8,y:1},e:{x:8,y:8}},{s:{x:8,y:8},e:{x:1,y:8}},{s:{x:1,y:8},e:{x:1,y:1}},{s:{x:5.5,y:1},e:{x:5.5,y:4}},{s:{x:5.5,y:4},e:{x:8,y:4}}]},
  cuisine:{name:"Cuisine",walls:[{s:{x:1,y:1},e:{x:8,y:1}},{s:{x:8,y:1},e:{x:8,y:6}},{s:{x:8,y:6},e:{x:1,y:6}},{s:{x:1,y:6},e:{x:1,y:1}}]},
  villa:{name:"Villa",walls:[{s:{x:1,y:1},e:{x:14,y:1}},{s:{x:14,y:1},e:{x:14,y:10}},{s:{x:14,y:10},e:{x:1,y:10}},{s:{x:1,y:10},e:{x:1,y:1}},{s:{x:5.5,y:1},e:{x:5.5,y:7}},{s:{x:5.5,y:7},e:{x:14,y:7}},{s:{x:9,y:7},e:{x:9,y:10}},{s:{x:1,y:5},e:{x:5.5,y:5}}]},
  studio:{name:"Studio",walls:[{s:{x:1,y:1},e:{x:7,y:1}},{s:{x:7,y:1},e:{x:7,y:6}},{s:{x:7,y:6},e:{x:1,y:6}},{s:{x:1,y:6},e:{x:1,y:1}},{s:{x:3.5,y:1},e:{x:3.5,y:6}}]},
  bureau:{name:"Bureau",walls:[{s:{x:1,y:1},e:{x:6,y:1}},{s:{x:6,y:1},e:{x:6,y:5}},{s:{x:6,y:5},e:{x:1,y:5}},{s:{x:1,y:5},e:{x:1,y:1}}]},
  appart:{name:"Appart.",walls:[{s:{x:1,y:1},e:{x:13,y:1}},{s:{x:13,y:1},e:{x:13,y:9}},{s:{x:13,y:9},e:{x:1,y:9}},{s:{x:1,y:9},e:{x:1,y:1}},{s:{x:5,y:1},e:{x:5,y:6}},{s:{x:5,y:6},e:{x:9,y:6}},{s:{x:9,y:6},e:{x:9,y:9}},{s:{x:5,y:3.5},e:{x:13,y:3.5}},{s:{x:9,y:1},e:{x:9,y:3.5}}]},
};

/* ═══ MATERIALS ═══ */
const MATS={
  floor:[
    // Parquet & Bois
    {id:"versailles",label:"Parquet Versailles",hex:"#c8a06a",c:0xc8a06a,r:.72,m:0,tag:"Bois"},
    {id:"chene_brun",label:"Chêne Brun",hex:"#b8905a",c:0xb8905a,r:.8,m:0,tag:"Bois"},
    {id:"chene_clair",label:"Chêne Clair",hex:"#d4b880",c:0xd4b880,r:.82,m:0,tag:"Bois"},
    {id:"hongrie",label:"Point de Hongrie",hex:"#b8884a",c:0xb8884a,r:.75,m:0,tag:"Bois"},
    {id:"wenge",label:"Wengé Massif",hex:"#2a1505",c:0x2a1505,r:.68,m:0,tag:"Bois"},
    {id:"bambou",label:"Bambou Naturel",hex:"#d4c080",c:0xd4c080,r:.78,m:0,tag:"Bois"},
    {id:"noyer",label:"Noyer Américain",hex:"#6a4020",c:0x6a4020,r:.7,m:0,tag:"Bois"},
    {id:"pin",label:"Pin Maritime",hex:"#e8c888",c:0xe8c888,r:.85,m:0,tag:"Bois"},
    // Marbre & Pierre
    {id:"calacatta",label:"Marbre Calacatta",hex:"#f0ece4",c:0xf0ece4,r:.06,m:.02,tag:"Marbre"},
    {id:"marbreN",label:"Marbre Noir",hex:"#181818",c:0x181818,r:.05,m:.02,tag:"Marbre"},
    {id:"carrare",label:"Marbre Carrare",hex:"#f8f6f2",c:0xf8f6f2,r:.04,m:.01,tag:"Marbre"},
    {id:"onyx",label:"Onyx Vert",hex:"#2d4a3a",c:0x2d4a3a,r:.04,m:.04,tag:"Marbre"},
    {id:"travertin",label:"Travertin Doré",hex:"#d4b896",c:0xd4b896,r:.68,m:0,tag:"Pierre"},
    {id:"granit",label:"Granit Gris",hex:"#7a7878",c:0x7a7878,r:.1,m:.05,tag:"Pierre"},
    {id:"ardoise",label:"Ardoise Noire",hex:"#3a3a42",c:0x3a3a42,r:.9,m:0,tag:"Pierre"},
    {id:"travertin_bl",label:"Travertin Blanc",hex:"#e8e0d4",c:0xe8e0d4,r:.55,m:0,tag:"Pierre"},
    {id:"calcaire",label:"Calcaire Beige",hex:"#d8ccb4",c:0xd8ccb4,r:.78,m:0,tag:"Pierre"},
    // Béton & Résine
    {id:"beton",label:"Béton Ciré Gris",hex:"#9a9890",c:0x9a9890,r:.82,m:0,tag:"Béton"},
    {id:"beton_blanc",label:"Béton Blanc",hex:"#d8d6d0",c:0xd8d6d0,r:.8,m:0,tag:"Béton"},
    {id:"beton_noir",label:"Béton Noir",hex:"#3a3836",c:0x3a3836,r:.85,m:0,tag:"Béton"},
    {id:"resine_bl",label:"Résine Époxy Blanc",hex:"#f0f0f8",c:0xf0f0f8,r:.05,m:.08,tag:"Résine"},
    {id:"resine_gr",label:"Résine Graphite",hex:"#4a4a52",c:0x4a4a52,r:.04,m:.1,tag:"Résine"},
    {id:"terrazzo",label:"Terrazzo Classique",hex:"#e8e0d0",c:0xe8e0d0,r:.2,m:0,tag:"Résine"},
    {id:"terrazzo_col",label:"Terrazzo Coloré",hex:"#e0d0c8",c:0xe0d0c8,r:.22,m:0,tag:"Résine"},
    // Carrelage
    {id:"carreau_bl",label:"Carreau Blanc 60×60",hex:"#f0eee8",c:0xf0eee8,r:.12,m:.02,tag:"Carrelage"},
    {id:"carreau_gr",label:"Carreau Gris 60×60",hex:"#c0bdb8",c:0xc0bdb8,r:.1,m:.02,tag:"Carrelage"},
    {id:"zellige",label:"Zellige Marocain",hex:"#5888a8",c:0x5888a8,r:.08,m:.03,tag:"Carrelage"},
    {id:"tomette",label:"Tomette Provençale",hex:"#c05840",c:0xc05840,r:.88,m:0,tag:"Carrelage"},
    {id:"metro",label:"Carrelage Métro",hex:"#f4f2ee",c:0xf4f2ee,r:.06,m:.02,tag:"Carrelage"},
  ],
  wall:[
    // Enduits & Peintures
    {id:"crepi",label:"Crépi Blanc Pur",hex:"#faf8f5",c:0xfaf8f5,r:.95,m:0,tag:"Enduit"},
    {id:"stuc",label:"Stuc Vénitien Ivoire",hex:"#f0ebe2",c:0xf0ebe2,r:.82,m:0,tag:"Enduit"},
    {id:"stuc_rose",label:"Stuc Vénitien Rosé",hex:"#f0ddd8",c:0xf0ddd8,r:.8,m:0,tag:"Enduit"},
    {id:"argile",label:"Argile Naturelle",hex:"#c8a878",c:0xc8a878,r:.92,m:0,tag:"Enduit"},
    {id:"chaux",label:"Chaux Blanche",hex:"#f8f4ee",c:0xf8f4ee,r:.94,m:0,tag:"Enduit"},
    {id:"taupe",label:"Peinture Taupe",hex:"#8a7a68",c:0x8a7a68,r:.88,m:0,tag:"Peinture"},
    {id:"bleu_nuit",label:"Bleu Nuit",hex:"#1a2a40",c:0x1a2a40,r:.92,m:0,tag:"Peinture"},
    {id:"vert_sage",label:"Vert Sauge",hex:"#7a9070",c:0x7a9070,r:.9,m:0,tag:"Peinture"},
    {id:"noir_mat",label:"Noir Mat",hex:"#1a1a1a",c:0x1a1a1a,r:.95,m:0,tag:"Peinture"},
    {id:"terracotta",label:"Terracotta",hex:"#c07050",c:0xc07050,r:.9,m:0,tag:"Peinture"},
    // Pierre & Brique
    {id:"brique",label:"Brique Ancienne",hex:"#8b4513",c:0x8b4513,r:.95,m:0,tag:"Pierre"},
    {id:"brique_bl",label:"Brique Blanche",hex:"#e8e0d4",c:0xe8e0d4,r:.92,m:0,tag:"Pierre"},
    {id:"pierre",label:"Pierre Bourgogne",hex:"#c8b8a0",c:0xc8b8a0,r:.92,m:0,tag:"Pierre"},
    {id:"moellons",label:"Moellons Rustiques",hex:"#b0a090",c:0xb0a090,r:.94,m:0,tag:"Pierre"},
    {id:"granit_m",label:"Granit Gris Mur",hex:"#808080",c:0x808080,r:.88,m:0,tag:"Pierre"},
    // Bois & Placage
    {id:"boiserie",label:"Boiserie Chêne",hex:"#c8a06a",c:0xc8a06a,r:.78,m:0,tag:"Bois"},
    {id:"lattes_bois",label:"Lattes Bois Clair",hex:"#d8b880",c:0xd8b880,r:.8,m:0,tag:"Bois"},
    {id:"noyer_m",label:"Noyer Foncé",hex:"#5a3818",c:0x5a3818,r:.72,m:0,tag:"Bois"},
    // Béton & Métal
    {id:"beton_b",label:"Béton Architectonique",hex:"#7a7870",c:0x7a7870,r:.88,m:0,tag:"Béton"},
    {id:"beton_ponce",label:"Béton Poncé",hex:"#9a9890",c:0x9a9890,r:.84,m:0,tag:"Béton"},
    {id:"inox",label:"Acier Inox Brossé",hex:"#b0b0b8",c:0xb0b0b8,r:.15,m:.85,tag:"Métal"},
    {id:"laiton",label:"Laiton Doré",hex:"#c9a84c",c:0xc9a84c,r:.18,m:.78,tag:"Métal"},
    {id:"cuivre",label:"Cuivre Patiné",hex:"#8a5a3a",c:0x8a5a3a,r:.25,m:.6,tag:"Métal"},
    {id:"laque",label:"Laque Noire Brillante",hex:"#0a0a0a",c:0x0a0a0a,r:.02,m:.3,tag:"Laque"},
    {id:"laque_bl",label:"Laque Blanche Brillante",hex:"#fafafa",c:0xfafafa,r:.02,m:.25,tag:"Laque"},
    // Papier peint
    {id:"velours_gr",label:"Velours Graphite",hex:"#3a3a48",c:0x3a3a48,r:.98,m:0,tag:"Tissu"},
    {id:"lin",label:"Lin Naturel",hex:"#c8b898",c:0xc8b898,r:.96,m:0,tag:"Tissu"},
    // Marbre mur
    {id:"marbre_m",label:"Marbre Blanc Mur",hex:"#f5f2ee",c:0xf5f2ee,r:.06,m:.02,tag:"Marbre"},
    {id:"onyx_m",label:"Onyx Doré",hex:"#c8a040",c:0xc8a040,r:.05,m:.05,tag:"Marbre"},
  ],
  ceiling:[
    {id:"blanc",label:"Blanc Mat",hex:"#faf8f5",c:0xfaf8f5,r:1,m:0,tag:"Standard"},
    {id:"blanc_laque",label:"Blanc Laqué",hex:"#ffffff",c:0xffffff,r:.02,m:.15,tag:"Standard"},
    {id:"creme",label:"Crème Chaud",hex:"#f5f0e8",c:0xf5f0e8,r:.95,m:0,tag:"Standard"},
    {id:"gris_clair",label:"Gris Perle",hex:"#d8d4cc",c:0xd8d4cc,r:.88,m:0,tag:"Standard"},
    {id:"poutres",label:"Poutres Chêne",hex:"#a07040",c:0xa07040,r:.88,m:0,tag:"Bois"},
    {id:"lambris",label:"Lambris Blanc",hex:"#f0eee8",c:0xf0eee8,r:.85,m:0,tag:"Bois"},
    {id:"lambris_bois",label:"Lambris Bois Naturel",hex:"#c8a060",c:0xc8a060,r:.82,m:0,tag:"Bois"},
    {id:"beton",label:"Béton Brut",hex:"#888880",c:0x888880,r:.92,m:0,tag:"Béton"},
    {id:"beton_blanc_p",label:"Béton Blanc Poli",hex:"#c8c4c0",c:0xc8c4c0,r:.78,m:0,tag:"Béton"},
    {id:"or",label:"Voûte Dorée",hex:"#c9a84c",c:0xc9a84c,r:.28,m:.4,tag:"Luxe"},
    {id:"anthracite",label:"Anthracite Mat",hex:"#141414",c:0x141414,r:.88,m:0,tag:"Couleur"},
    {id:"bleu_nuit_p",label:"Bleu Nuit Profond",hex:"#0a1428",c:0x0a1428,r:.92,m:0,tag:"Couleur"},
    {id:"rosace",label:"Avec Rosace Plâtre",hex:"#faf8f4",c:0xfaf8f4,r:.96,m:0,tag:"Luxe"},
  ],
};

/* ═══ LAYERS ═══ */
const INIT_LAYERS=[
  {id:"walls",name:"A-WALL",color:"#e05050",lw:3,vis:true,lock:false},
  {id:"walls_int",name:"A-WALL-INT",color:"#e08840",lw:2,vis:true,lock:false},
  {id:"doors",name:"A-DOOR",color:"#44aaff",lw:1.5,vis:true,lock:false},
  {id:"windows",name:"A-GLAZ",color:"#88ddff",lw:1.5,vis:true,lock:false},
  {id:"dims",name:"A-ANNO-DIMS",color:"#4ec9b0",lw:0.8,vis:true,lock:false},
  {id:"text",name:"A-ANNO-TEXT",color:"#dcdcaa",lw:0.8,vis:true,lock:false},
  {id:"hatch",name:"A-FLOR-HATCH",color:"#383848",lw:0.5,vis:true,lock:false},
  {id:"furniture",name:"A-FURN",color:"#c586c0",lw:1,vis:true,lock:false},
  {id:"xref",name:"XREF",color:"#404050",lw:0.5,vis:true,lock:false},
];

/* ═══ FURNITURE CATALOG ═══ */
const FURNITURE_CATALOG = [
  {cat:"🛋 Salon",items:[
    {type:"sofa3",label:"Canapé 3 places",w:2.2,h:.9,color:"#8a7a6a"},
    {type:"sofa2",label:"Canapé 2 places",w:1.6,h:.85,color:"#8a7a6a"},
    {type:"armchair",label:"Fauteuil",w:.85,h:.85,color:"#7a6a5a"},
    {type:"coffeetable",label:"Table basse",w:1.2,h:.6,color:"#b8a080"},
    {type:"tv",label:"Meuble TV",w:1.8,h:.4,color:"#3a3a3a"},
    {type:"bookshelf",label:"Bibliothèque",w:1.0,h:.3,color:"#a07840"},
    {type:"rug",label:"Tapis",w:2.0,h:1.4,color:"#c8b89a"},
    {type:"lamp_floor",label:"Lampadaire",w:.3,h:.3,color:"#d4b060"},
    {type:"plant_large",label:"Plante grande",w:.6,h:.6,color:"#4a8a3a"},
    {type:"fireplace",label:"Cheminée",w:1.4,h:.6,color:"#6a5040"},
  ]},
  {cat:"🛏 Chambre",items:[
    {type:"bed_double",label:"Lit double",w:1.6,h:2.0,color:"#a89878"},
    {type:"bed_single",label:"Lit simple",w:.9,h:2.0,color:"#a89878"},
    {type:"bed_king",label:"Lit King Size",w:2.0,h:2.1,color:"#a89878"},
    {type:"wardrobe",label:"Armoire",w:1.8,h:.6,color:"#b8985a"},
    {type:"dresser",label:"Commode",w:1.0,h:.5,color:"#b8985a"},
    {type:"nightstand",label:"Table de chevet",w:.5,h:.45,color:"#b8985a"},
    {type:"desk",label:"Bureau",w:1.4,h:.7,color:"#9a7a4a"},
    {type:"desk_chair",label:"Chaise bureau",w:.6,h:.6,color:"#6a6a7a"},
    {type:"mirror",label:"Miroir",w:.8,h:.05,color:"#88aabb"},
    {type:"bathrobe",label:"Dressing",w:1.2,h:.5,color:"#a08870"},
  ]},
  {cat:"🍽 Cuisine",items:[
    {type:"dining_table4",label:"Table 4 pers.",w:1.2,h:.8,color:"#a08060"},
    {type:"dining_table6",label:"Table 6 pers.",w:1.8,h:.9,color:"#a08060"},
    {type:"dining_chair",label:"Chaise",w:.45,h:.45,color:"#7a6a5a"},
    {type:"kitchen_counter",label:"Plan de travail",w:2.0,h:.6,color:"#c8c0b0"},
    {type:"fridge",label:"Réfrigérateur",w:.65,h:.7,color:"#d0d0d0"},
    {type:"stove",label:"Cuisinière",w:.6,h:.6,color:"#888080"},
    {type:"sink",label:"Évier",w:.8,h:.5,color:"#b0c0c8"},
    {type:"dishwasher",label:"Lave-vaisselle",w:.6,h:.6,color:"#c0c0c0"},
    {type:"island",label:"Îlot central",w:1.4,h:.8,color:"#b8a888"},
    {type:"bar_stool",label:"Tabouret bar",w:.4,h:.4,color:"#7a6050"},
  ]},
  {cat:"🚿 Salle de bain",items:[
    {type:"bathtub",label:"Baignoire",w:1.7,h:.8,color:"#d0e0e8"},
    {type:"shower",label:"Douche",w:.9,h:.9,color:"#b8d0d8"},
    {type:"toilet",label:"WC",w:.38,h:.6,color:"#e0e8ec"},
    {type:"sink_bath",label:"Lavabo",w:.6,h:.45,color:"#d0e0e8"},
    {type:"double_sink",label:"Double vasque",w:1.2,h:.5,color:"#d0e0e8"},
    {type:"washing_machine",label:"Lave-linge",w:.6,h:.6,color:"#c8d0d8"},
    {type:"towel_rack",label:"Porte-serviettes",w:.6,h:.15,color:"#c8a850"},
    {type:"bath_cabinet",label:"Meuble vasque",w:1.0,h:.45,color:"#d0c8b8"},
  ]},
  {cat:"🏢 Bureau",items:[
    {type:"office_desk",label:"Bureau droit",w:1.6,h:.8,color:"#9a8060"},
    {type:"office_desk_l",label:"Bureau en L",w:2.0,h:1.5,color:"#9a8060"},
    {type:"meeting_table",label:"Table réunion",w:3.0,h:1.2,color:"#8a7050"},
    {type:"office_chair",label:"Chaise ergono.",w:.65,h:.65,color:"#4a4a5a"},
    {type:"filing_cabinet",label:"Classeur",w:.46,h:.62,color:"#888090"},
    {type:"whiteboard",label:"Tableau blanc",w:2.0,h:.1,color:"#f0f0f0"},
    {type:"printer",label:"Imprimante",w:.45,h:.5,color:"#707080"},
    {type:"bookshelf_office",label:"Bibliothèque",w:1.2,h:.3,color:"#a08040"},
  ]},
  {cat:"🌿 Extérieur",items:[
    {type:"car",label:"Voiture",w:2.0,h:4.5,color:"#8090a0"},
    {type:"pool",label:"Piscine",w:4.0,h:2.0,color:"#60a8c8"},
    {type:"hot_tub",label:"Jacuzzi",w:2.0,h:2.0,color:"#70b8d0"},
    {type:"garden_table",label:"Table jardin",w:1.0,h:.8,color:"#8a9060"},
    {type:"garden_chair",label:"Chaise jardin",w:.5,h:.5,color:"#7a8050"},
    {type:"bbq",label:"Barbecue",w:.7,h:.5,color:"#504038"},
    {type:"plant_large",label:"Arbre",w:1.2,h:1.2,color:"#3a7a2a"},
    {type:"hedge",label:"Haie",w:2.0,h:.4,color:"#4a7a3a"},
  ]},
  {cat:"⚙️ Équipements",items:[
    {type:"stairs_up",label:"Escalier montant",w:1.0,h:2.0,color:"#a09888"},
    {type:"stairs_spiral",label:"Escalier spiral",w:1.2,h:1.2,color:"#a09888"},
    {type:"elevator",label:"Ascenseur",w:1.4,h:1.4,color:"#9090a0"},
    {type:"ac_unit",label:"Climatiseur",w:.8,h:.25,color:"#c0c8d0"},
    {type:"radiator",label:"Radiateur",w:.8,h:.15,color:"#c0c0c0"},
    {type:"safe",label:"Coffre-fort",w:.5,h:.4,color:"#606060"},
    {type:"piano",label:"Piano",w:1.5,h:.9,color:"#2a2020"},
    {type:"tv_wall",label:"TV murale",w:1.4,h:.1,color:"#202020"},
  ]},
];

/* ── Draw furniture on canvas ── */
function drawFurniture(ctx, f, sc, sel, hov) {
  const { x, y, w, h, type, color, rot = 0, label } = f;
  ctx.save();
  ctx.translate(x * sc + w * sc / 2, y * sc + h * sc / 2);
  ctx.rotate(rot * Math.PI / 180);
  ctx.translate(-w * sc / 2, -h * sc / 2);
  const W = w * sc, H = h * sc;
  const isSel = sel?.id === f.id, isHov = hov?.id === f.id;
  ctx.globalAlpha = isSel ? 1 : isHov ? .95 : .92;
  if (isSel) { ctx.shadowColor = "#c9a84c"; ctx.shadowBlur = 10; }

  const col = color || "#b0a090";
  const dark = (hex, amt = .25) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgb(${Math.max(0, r * (1 - amt))},${Math.max(0, g * (1 - amt))},${Math.max(0, b * (1 - amt))})`; };
  const light = (hex, amt = .3) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgb(${Math.min(255, r + (255 - r) * amt)},${Math.min(255, g + (255 - g) * amt)},${Math.min(255, b + (255 - b) * amt)})`; };

  // ──────────────────────────────────────────────
  switch (type) {

    // ═══ SOFAS ═══
    case "sofa3": case "sofa2": {
      const nc = type === "sofa3" ? 3 : 2;
      // Shadow
      ctx.fillStyle = "rgba(26,18,8,.12)"; ctx.fillRect(3, 3, W, H);
      // Main body
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, light(col, .15)); grad.addColorStop(1, dark(col, .1));
      ctx.fillStyle = grad; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 6); ctx.fill(); ctx.stroke();
      // Back rest (top thick part)
      const backH = H * .28;
      ctx.fillStyle = dark(col, .15);
      ctx.beginPath(); ctx.roundRect(0, 0, W, backH, [6, 6, 0, 0]); ctx.fill();
      ctx.strokeStyle = dark(col, .35); ctx.lineWidth = .6; ctx.stroke();
      // Arms
      const armW = W * .09, armH = H * .72;
      [0, W - armW].forEach(ax => {
        ctx.fillStyle = dark(col, .18);
        ctx.beginPath(); ctx.roundRect(ax, backH, armW, armH, 3); ctx.fill();
        ctx.strokeStyle = dark(col, .3); ctx.lineWidth = .5; ctx.stroke();
      });
      // Cushions
      const cpad = W * .02, cW = (W - armW * 2 - cpad * (nc + 1)) / nc;
      for (let i = 0; i < nc; i++) {
        const cx2 = armW + cpad + i * (cW + cpad), cy2 = backH + H * .03;
        const cH2 = H * .62;
        ctx.fillStyle = light(col, .1);
        ctx.beginPath(); ctx.roundRect(cx2, cy2, cW, cH2, 4); ctx.fill();
        ctx.strokeStyle = dark(col, .2); ctx.lineWidth = .6; ctx.stroke();
        // Cushion crease
        ctx.strokeStyle = dark(col, .12); ctx.lineWidth = .5; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(cx2 + cW * .5, cy2 + 4); ctx.lineTo(cx2 + cW * .5, cy2 + cH2 - 4); ctx.stroke(); ctx.setLineDash([]);
        // Button detail
        ctx.fillStyle = dark(col, .25); ctx.beginPath(); ctx.arc(cx2 + cW / 2, cy2 + cH2 / 2, 2, 0, Math.PI * 2); ctx.fill();
      }
      // Feet
      ctx.fillStyle = dark(col, .4);
      [[W * .05, H * .92], [W * .95, H * .92]].forEach(([fx, fy]) => { ctx.beginPath(); ctx.roundRect(fx - 4, fy, 8, 6, 1); ctx.fill(); });
      break;
    }

    case "armchair": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, light(col, .2)); grad.addColorStop(1, dark(col, .1));
      ctx.fillStyle = grad; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark(col, .15);
      ctx.beginPath(); ctx.roundRect(0, 0, W, H * .26, [8, 8, 0, 0]); ctx.fill();
      const armW = W * .14;
      ctx.fillStyle = dark(col, .12);
      [0, W - armW].forEach(ax => { ctx.beginPath(); ctx.roundRect(ax, H * .24, armW, H * .68, 4); ctx.fill(); ctx.strokeStyle = dark(col, .25); ctx.lineWidth = .5; ctx.stroke(); });
      ctx.fillStyle = light(col, .12);
      ctx.beginPath(); ctx.roundRect(armW + W * .04, H * .27, W - armW * 2 - W * .08, H * .64, 6); ctx.fill();
      ctx.strokeStyle = dark(col, .18); ctx.lineWidth = .6; ctx.stroke();
      ctx.fillStyle = dark(col, .2); ctx.beginPath(); ctx.arc(W / 2, H * .59, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    }

    // ═══ TABLES ═══
    case "coffeetable": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(4, 4, W, H);
      // Glass top
      const gGrad = ctx.createLinearGradient(0, 0, W, H);
      gGrad.addColorStop(0, "rgba(200,220,230,.85)"); gGrad.addColorStop(.5, "rgba(220,235,245,.92)"); gGrad.addColorStop(1, "rgba(190,210,225,.8)");
      ctx.fillStyle = gGrad; ctx.strokeStyle = "rgba(150,180,200,.6)"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Reflection
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.roundRect(W * .05, H * .05, W * .35, H * .3, 3); ctx.fill();
      // Legs (4 corners)
      ctx.fillStyle = col; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = .8;
      [[W * .08, H * .1], [W * .84, H * .1], [W * .08, H * .7], [W * .84, H * .7]].forEach(([lx, ly]) => { ctx.beginPath(); ctx.roundRect(lx, ly, W * .08, H * .2, 2); ctx.fill(); ctx.stroke(); });
      break;
    }

    case "dining_table4": case "dining_table6": case "meeting_table": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(4, 4, W, H);
      const tGrad = ctx.createLinearGradient(0, 0, W, 0);
      tGrad.addColorStop(0, light(col, .2)); tGrad.addColorStop(.5, light(col, .08)); tGrad.addColorStop(1, dark(col, .05));
      ctx.fillStyle = tGrad; ctx.strokeStyle = dark(col, .25); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Wood grain lines
      ctx.strokeStyle = `${col}55`; ctx.lineWidth = .4;
      for (let gi = 1; gi < 6; gi++) { ctx.beginPath(); ctx.moveTo(W * gi / 6, H * .05); ctx.lineTo(W * gi / 6, H * .95); ctx.stroke(); }
      // Edge highlight
      ctx.strokeStyle = light(col, .35); ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(2, 2, W - 4, H - 4, 3); ctx.stroke();
      // Chairs placement hints (dots)
      const nc2 = type === "dining_table4" ? 1 : type === "dining_table6" ? 2 : 3;
      ctx.strokeStyle = "rgba(26,18,8,.15)"; ctx.setLineDash([3, 3]);
      for (let ci = 0; ci < nc2; ci++) {
        const cx3 = W * (ci + 1) / (nc2 + 1);
        [[cx3, -H * .25], [cx3, H * 1.18]].forEach(([dcx, dcy]) => { ctx.beginPath(); ctx.arc(dcx, dcy, H * .2, 0, Math.PI * 2); ctx.stroke(); });
      }
      ctx.setLineDash([]);
      break;
    }

    case "island": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = light(col, .1); ctx.strokeStyle = dark(col, .2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Countertop edge
      ctx.strokeStyle = dark(col, .3); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(W * .03, H * .05, W * .94, H * .9, 3); ctx.stroke();
      // Sink detail
      ctx.fillStyle = "rgba(180,210,220,.6)"; ctx.beginPath(); ctx.roundRect(W * .35, H * .2, W * .3, H * .6, 3); ctx.fill();
      ctx.strokeStyle = "rgba(140,180,200,.8)"; ctx.lineWidth = .7; ctx.stroke();
      ctx.fillStyle = "rgba(100,150,170,.8)"; ctx.beginPath(); ctx.arc(W * .5, H * .5, W * .04, 0, Math.PI * 2); ctx.fill();
      break;
    }

    // ═══ BEDS ═══
    case "bed_double": case "bed_single": case "bed_king": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      // Bed frame
      ctx.fillStyle = col; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Headboard
      const hbH = H * .13;
      const hbGrad = ctx.createLinearGradient(0, 0, 0, hbH);
      hbGrad.addColorStop(0, light(col, .1)); hbGrad.addColorStop(1, dark(col, .15));
      ctx.fillStyle = hbGrad;
      ctx.beginPath(); ctx.roundRect(W * .02, 0, W * .96, hbH + 4, [4, 4, 0, 0]); ctx.fill();
      ctx.strokeStyle = dark(col, .25); ctx.lineWidth = .7; ctx.stroke();
      // Mattress
      ctx.fillStyle = "#faf8f4"; ctx.strokeStyle = "#d8d0c4"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.roundRect(W * .05, hbH + 2, W * .9, H * .82, 3); ctx.fill(); ctx.stroke();
      // Pillows
      const np = type === "bed_single" ? 1 : 2;
      const pW = (W * .72 / np) - 4, pX = W * .14;
      for (let pi = 0; pi < np; pi++) {
        const px2 = pX + pi * (pW + 4);
        const pGrad = ctx.createLinearGradient(px2, hbH + 6, px2 + pW, hbH + H * .22);
        pGrad.addColorStop(0, "#fff"); pGrad.addColorStop(1, "#e8e4dc");
        ctx.fillStyle = pGrad; ctx.strokeStyle = "#d0c8bc"; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.roundRect(px2, hbH + 6, pW, H * .2, 4); ctx.fill(); ctx.stroke();
        // Pillow detail stitching
        ctx.strokeStyle = "#e0dcd4"; ctx.lineWidth = .4; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.roundRect(px2 + 3, hbH + 9, pW - 6, H * .2 - 6, 2); ctx.stroke(); ctx.setLineDash([]);
      }
      // Blanket/duvet
      const duvetGrad = ctx.createLinearGradient(0, H * .32, 0, H);
      duvetGrad.addColorStop(0, "#f0ece4"); duvetGrad.addColorStop(1, "#e4ddd4");
      ctx.fillStyle = duvetGrad; ctx.strokeStyle = "#d0c8bc"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.roundRect(W * .05, H * .31, W * .9, H * .63, [0, 0, 3, 3]); ctx.fill(); ctx.stroke();
      // Duvet fold
      ctx.strokeStyle = "#d8d2c8"; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(W * .05, H * .42); ctx.bezierCurveTo(W * .2, H * .4, W * .8, H * .44, W * .95, H * .42); ctx.stroke();
      // Stitching lines on duvet
      ctx.strokeStyle = "#e0dbd4"; ctx.lineWidth = .3; ctx.setLineDash([4, 8]);
      for (let di = 0; di < 3; di++) { const dy = H * .52 + di * H * .1; ctx.beginPath(); ctx.moveTo(W * .07, dy); ctx.lineTo(W * .93, dy); ctx.stroke(); }
      ctx.setLineDash([]);
      break;
    }

    case "nightstand": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = col; ctx.strokeStyle = dark(col, .25); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = dark(col, .2); ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(0, H * .5); ctx.lineTo(W, H * .5); ctx.stroke();
      // Drawer handles
      ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .5;
      [H * .25, H * .75].forEach(hy => { ctx.beginPath(); ctx.roundRect(W * .3, hy - 3, W * .4, 6, 2); ctx.fill(); ctx.stroke(); });
      // Lamp on top (optional)
      ctx.fillStyle = "rgba(220,200,100,.2)"; ctx.beginPath(); ctx.arc(W * .5, H * .2, W * .25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d4a840"; ctx.beginPath(); ctx.arc(W * .5, H * .2, W * .1, 0, Math.PI * 2); ctx.fill();
      break;
    }

    // ═══ STORAGE ═══
    case "wardrobe": case "bathrobe": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      const wGrad = ctx.createLinearGradient(0, 0, W, 0);
      wGrad.addColorStop(0, light(col, .15)); wGrad.addColorStop(1, dark(col, .05));
      ctx.fillStyle = wGrad; ctx.strokeStyle = dark(col, .25); ctx.lineWidth = 1;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      const nd = Math.round(W / (H * 1.2)) + 1;
      for (let di = 0; di < nd; di++) {
        const dW = W / nd, dx = di * dW;
        ctx.strokeStyle = dark(col, .2); ctx.lineWidth = .6;
        ctx.beginPath(); ctx.roundRect(dx + 3, H * .06, dW - 6, H * .88, 2); ctx.stroke();
        // Panel detail
        ctx.strokeStyle = dark(col, .1); ctx.lineWidth = .4;
        ctx.beginPath(); ctx.roundRect(dx + 6, H * .12, dW - 12, H * .76, 1); ctx.stroke();
        // Handle
        ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .5;
        ctx.beginPath(); ctx.arc(dx + dW - 8, H * .5, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    }

    case "dresser": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = light(col, .08); ctx.strokeStyle = dark(col, .25); ctx.lineWidth = 1;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      // Top surface reflection
      ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(2, 2, W - 4, H * .12);
      const nr = 4;
      for (let ri = 0; ri < nr; ri++) {
        const dH2 = H / nr, dy = ri * dH2;
        ctx.strokeStyle = dark(col, .18); ctx.lineWidth = .6;
        ctx.beginPath(); ctx.roundRect(W * .05, dy + H * .04, W * .9, dH2 - H * .06, 2); ctx.stroke();
        ctx.strokeStyle = dark(col, .08); ctx.lineWidth = .3;
        ctx.beginPath(); ctx.roundRect(W * .08, dy + H * .06, W * .84, dH2 - H * .1, 1); ctx.stroke();
        ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .5;
        ctx.beginPath(); ctx.arc(W * .5, dy + dH2 / 2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      break;
    }

    // ═══ BATHROOM ═══
    case "bathtub": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      // Outer tub
      ctx.fillStyle = "#f0f4f6"; ctx.strokeStyle = "#a0b8c4"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, H * .18); ctx.fill(); ctx.stroke();
      // Inner basin
      const bGrad = ctx.createRadialGradient(W * .5, H * .5, H * .05, W * .5, H * .5, H * .5);
      bGrad.addColorStop(0, "#b8d8e8"); bGrad.addColorStop(.7, "#9ec8da"); bGrad.addColorStop(1, "#88b8cc");
      ctx.fillStyle = bGrad; ctx.strokeStyle = "#7aaab8"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(W * .07, H * .12, W * .86, H * .72, H * .12); ctx.fill(); ctx.stroke();
      // Water shimmer lines
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = .5;
      [.35, .5, .62].forEach(yp => { ctx.beginPath(); ctx.moveTo(W * .12, H * yp); ctx.bezierCurveTo(W * .3, H * (yp - .03), W * .7, H * (yp + .03), W * .88, H * yp); ctx.stroke(); });
      // Faucet
      ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(W * .42, H * .08, W * .16, H * .1, 2); ctx.fill(); ctx.stroke();
      // Drain
      ctx.fillStyle = "#7090a0"; ctx.beginPath(); ctx.arc(W * .5, H * .76, W * .04, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#506070"; ctx.lineWidth = .4;
      for (let da = 0; da < 4; da++) { const a = da * Math.PI / 2; ctx.beginPath(); ctx.moveTo(W * .5, H * .76); ctx.lineTo(W * .5 + Math.cos(a) * W * .04, H * .76 + Math.sin(a) * W * .04); ctx.stroke(); }
      // Grab bars
      ctx.strokeStyle = "#b0b8c0"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(W * .08, H * .3); ctx.lineTo(W * .08, H * .65); ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }

    case "shower": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#e8f2f8"; ctx.strokeStyle = "#90b0c0"; ctx.lineWidth = 1;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      // Glass door indication
      ctx.strokeStyle = "#80a8b8"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, H * .98); ctx.lineTo(W * .98, H * .98); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * .98, 0); ctx.lineTo(W * .98, H * .98); ctx.stroke();
      // Tile grid
      ctx.strokeStyle = "rgba(140,170,185,.35)"; ctx.lineWidth = .4;
      for (let ti = 1; ti < 4; ti++) { ctx.beginPath(); ctx.moveTo(W * ti / 4, 0); ctx.lineTo(W * ti / 4, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, H * ti / 4); ctx.lineTo(W, H * ti / 4); ctx.stroke(); }
      // Shower head
      ctx.fillStyle = "#c0c8d0"; ctx.strokeStyle = "#909aa0"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.arc(W * .2, H * .2, W * .12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Spray holes
      ctx.fillStyle = "#7090a0";
      for (let si = 0; si < 7; si++) { const sa = si * Math.PI * 2 / 7; ctx.beginPath(); ctx.arc(W * .2 + Math.cos(sa) * W * .07, H * .2 + Math.sin(sa) * H * .07, 1.5, 0, Math.PI * 2); ctx.fill(); }
      // Drain
      ctx.fillStyle = "#6888a0"; ctx.beginPath(); ctx.arc(W * .5, H * .5, W * .06, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#486070"; ctx.lineWidth = .4;
      for (let da = 0; da < 4; da++) { const a = da * Math.PI / 2; ctx.beginPath(); ctx.moveTo(W * .5 - Math.cos(a) * W * .04, H * .5 - Math.sin(a) * H * .04); ctx.lineTo(W * .5 + Math.cos(a) * W * .04, H * .5 + Math.sin(a) * H * .04); ctx.stroke(); }
      break;
    }

    case "toilet": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(2, 2, W, H);
      // Tank
      ctx.fillStyle = "#eff3f6"; ctx.strokeStyle = "#98b0be"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(W * .08, 0, W * .84, H * .32, [3, 3, 0, 0]); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#d8e8f0"; ctx.beginPath(); ctx.roundRect(W * .12, H * .04, W * .76, H * .2, 2); ctx.fill(); ctx.strokeStyle = "#b0c8d4"; ctx.lineWidth = .5; ctx.stroke();
      // Flush button
      ctx.fillStyle = "#c0d0da"; ctx.beginPath(); ctx.arc(W * .5, H * .14, W * .08, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#90b0c0"; ctx.lineWidth = .4; ctx.stroke();
      // Bowl
      ctx.fillStyle = "#f2f6f8"; ctx.strokeStyle = "#90aabb"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.ellipse(W * .5, H * .67, W * .45, H * .32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Seat
      const sGrad = ctx.createLinearGradient(W * .05, H * .38, W * .95, H * .9);
      sGrad.addColorStop(0, "#e8eff4"); sGrad.addColorStop(1, "#d0dce4");
      ctx.fillStyle = sGrad; ctx.strokeStyle = "#90aab8"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(W * .5, H * .65, W * .42, H * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c8d8e4"; ctx.beginPath(); ctx.ellipse(W * .5, H * .63, W * .32, H * .22, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#a0b8c4"; ctx.lineWidth = .5; ctx.stroke();
      break;
    }

    case "sink_bath": case "double_sink": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#d8e8ec"; ctx.strokeStyle = "#88a8b4"; ctx.lineWidth = 1;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      const ns = type === "double_sink" ? 2 : 1;
      const sW = W / ns;
      for (let si = 0; si < ns; si++) {
        const sx = si * sW;
        // Sink bowl
        const sinkGrad = ctx.createRadialGradient(sx + sW * .5, H * .5, H * .05, sx + sW * .5, H * .5, H * .4);
        sinkGrad.addColorStop(0, "#b8d4dc"); sinkGrad.addColorStop(1, "#90b8c4");
        ctx.fillStyle = sinkGrad; ctx.strokeStyle = "#78a0ac"; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.ellipse(sx + sW * .5, H * .5, sW * .38, H * .38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Drain
        ctx.fillStyle = "#507080"; ctx.beginPath(); ctx.arc(sx + sW * .5, H * .5, H * .06, 0, Math.PI * 2); ctx.fill();
        // Faucet
        ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .5;
        ctx.beginPath(); ctx.roundRect(sx + sW * .38, H * .08, sW * .24, H * .14, 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(sx + sW * .47, H * .04, sW * .06, H * .1, 1); ctx.fill(); ctx.stroke();
        // Handles
        ctx.fillStyle = "#c0c8d0";
        [sW * .22, sW * .7].forEach(hx => { ctx.beginPath(); ctx.arc(sx + hx, H * .15, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#90a0a8"; ctx.lineWidth = .4; ctx.stroke(); });
      }
      // Edge detail
      ctx.strokeStyle = "#a0b8c4"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(3, 3, W - 6, H - 6, 3); ctx.stroke();
      break;
    }

    // ═══ KITCHEN ═══
    case "kitchen_counter": {
      ctx.fillStyle = "rgba(26,18,8,.08)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = col; ctx.strokeStyle = dark(col, .2); ctx.lineWidth = 1;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      // Counter surface (lighter top)
      ctx.fillStyle = light(col, .12); ctx.fillRect(0, 0, W, H * .15);
      // Edge strip
      ctx.fillStyle = dark(col, .15); ctx.fillRect(0, H * .14, W, H * .05);
      // Cabinet divisions
      const nc3 = Math.round(W / H) + 1;
      for (let ci = 1; ci < nc3; ci++) {
        ctx.strokeStyle = dark(col, .15); ctx.lineWidth = .5;
        ctx.beginPath(); ctx.moveTo(W * ci / nc3, H * .18); ctx.lineTo(W * ci / nc3, H * .95); ctx.stroke();
      }
      // Handles
      ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .4;
      for (let hi = 0; hi < nc3; hi++) { ctx.beginPath(); ctx.roundRect(W * hi / nc3 + W / nc3 * .25, H * .55, W / nc3 * .5, H * .08, 2); ctx.fill(); ctx.stroke(); }
      break;
    }

    case "stove": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(2, 2, W, H);
      ctx.fillStyle = "#5a5550"; ctx.strokeStyle = "#3a3530"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill(); ctx.stroke();
      // Burners (4)
      const burners = [[.27, .3], [.73, .3], [.27, .73], [.73, .73]];
      burners.forEach(([bx, by]) => {
        ctx.fillStyle = "#3a3530"; ctx.beginPath(); ctx.arc(W * bx, H * by, W * .18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#6a6058"; ctx.lineWidth = 1.2; ctx.stroke();
        // Burner rings
        [.12, .08, .04].forEach(r => { ctx.strokeStyle = "#5a5050"; ctx.lineWidth = .6; ctx.beginPath(); ctx.arc(W * bx, H * by, W * r, 0, Math.PI * 2); ctx.stroke(); });
        ctx.fillStyle = "#888080"; ctx.beginPath(); ctx.arc(W * bx, H * by, W * .025, 0, Math.PI * 2); ctx.fill();
      });
      // Control panel
      ctx.fillStyle = "#4a4540"; ctx.fillRect(W * .05, H * .88, W * .9, H * .1);
      ctx.fillStyle = "#c9a84c";
      [.2, .4, .6, .8].forEach(kx => { ctx.beginPath(); ctx.arc(W * kx, H * .93, 3, 0, Math.PI * 2); ctx.fill(); });
      break;
    }

    case "fridge": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#d8d8d8"; ctx.strokeStyle = "#a0a0a0"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#c8c8c8"; ctx.strokeStyle = "#909090"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(W * .05, H * .04, W * .9, H * .34, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(W * .05, H * .42, W * .9, H * .54, 3); ctx.fill(); ctx.stroke();
      // Handles
      ctx.fillStyle = "#b0b0b0"; ctx.strokeStyle = "#888"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(W * .78, H * .1, W * .06, H * .22, 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(W * .78, H * .5, W * .06, H * .38, 2); ctx.fill(); ctx.stroke();
      // Reflection
      ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.roundRect(W * .07, H * .06, W * .25, H * .28, 2); ctx.fill();
      break;
    }

    case "sink": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#d8e4e8"; ctx.strokeStyle = "#90a8b0"; ctx.lineWidth = .8;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      // Double basin or single
      const nbs = W > H * 1.4 ? 2 : 1;
      const bW2 = W / nbs;
      for (let bi = 0; bi < nbs; bi++) {
        const bx2 = bi * bW2;
        ctx.fillStyle = "#b0ccd4"; ctx.strokeStyle = "#80a0aa"; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.roundRect(bx2 + bW2 * .1, H * .12, bW2 * .8, H * .76, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#6888a0"; ctx.beginPath(); ctx.arc(bx2 + bW2 * .5, H * .5, W * .05, 0, Math.PI * 2); ctx.fill();
      }
      // Faucet
      ctx.fillStyle = "#c9a84c"; ctx.strokeStyle = "#a07820"; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.roundRect(W * .4, H * .06, W * .2, H * .12, 2); ctx.fill(); ctx.stroke();
      break;
    }

    // ═══ OFFICE ═══
    case "desk": case "office_desk": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      const dGrad = ctx.createLinearGradient(0, 0, W, H);
      dGrad.addColorStop(0, light(col, .18)); dGrad.addColorStop(1, dark(col, .05));
      ctx.fillStyle = dGrad; ctx.strokeStyle = dark(col, .2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill(); ctx.stroke();
      // Wood grain
      ctx.strokeStyle = `${col}40`; ctx.lineWidth = .4;
      for (let gi = 1; gi < 5; gi++) { ctx.beginPath(); ctx.moveTo(W * gi / 5, H * .08); ctx.lineTo(W * gi / 5, H * .92); ctx.stroke(); }
      // Pedestal unit
      ctx.fillStyle = dark(col, .12); ctx.strokeStyle = dark(col, .25); ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(0, H * .08, W * .28, H * .84, 2); ctx.fill(); ctx.stroke();
      for (let dr = 0; dr < 3; dr++) { ctx.strokeStyle = dark(col, .18); ctx.lineWidth = .4; ctx.beginPath(); ctx.roundRect(W * .02, H * (.15 + dr * .22), W * .24, H * .18, 1); ctx.stroke(); ctx.fillStyle = "#c9a84c"; ctx.beginPath(); ctx.arc(W * .14, H * (.24 + dr * .22), 2.5, 0, Math.PI * 2); ctx.fill(); }
      // Surface highlight
      ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.beginPath(); ctx.roundRect(W * .3, H * .05, W * .65, H * .12, 2); ctx.fill();
      break;
    }

    case "office_desk_l": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = light(col, .1); ctx.strokeStyle = dark(col, .2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * .48); ctx.lineTo(W * .52, H * .48); ctx.lineTo(W * .52, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `${col}40`; ctx.lineWidth = .4;
      for (let gi = 1; gi < 6; gi++) { ctx.beginPath(); ctx.moveTo(0, H * gi / 6); ctx.lineTo(W * .5, H * gi / 6); ctx.stroke(); }
      ctx.fillStyle = dark(col, .12); ctx.strokeStyle = dark(col, .22); ctx.lineWidth = .5;
      ctx.fillRect(0, H * .08, W * .25, H * .84);
      break;
    }

        case "plant_large": {
      const r2 = Math.min(W, H) / 2;
      // Pot
      ctx.fillStyle = "#8a6040"; ctx.strokeStyle = "#6a4020"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.roundRect(W * .3, H * .6, W * .4, H * .4, [0, 0, 3, 3]); ctx.fill(); ctx.stroke();
      // Soil
      ctx.fillStyle = "#5a3a1a"; ctx.beginPath(); ctx.ellipse(W * .5, H * .62, W * .19, H * .06, 0, 0, Math.PI * 2); ctx.fill();
      // Leaves - multiple overlapping circles for lush look
      const leaves = [[.5, .35, r2 * .8], [.3, .42, r2 * .55], [.7, .4, r2 * .5], [.45, .25, r2 * .55], [.62, .3, r2 * .48], [.35, .3, r2 * .42]];
      leaves.forEach(([lx, ly, lr], i) => {
        ctx.fillStyle = i % 2 === 0 ? "#3a7a2a" : "#4a9030";
        ctx.beginPath(); ctx.arc(W * lx, H * ly, lr, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "#5aaa40"; ctx.beginPath(); ctx.arc(W * .5, H * .3, r2 * .35, 0, Math.PI * 2); ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(120,200,80,.25)"; ctx.beginPath(); ctx.arc(W * .42, H * .26, r2 * .18, 0, Math.PI * 2); ctx.fill();
      break;
    }

    // ═══ MISC ═══
    case "tv": case "tv_wall": {
      ctx.fillStyle = "rgba(26,18,8,.15)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#1a1a1a"; ctx.strokeStyle = "#080808"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill(); ctx.stroke();
      // Screen
      const sGrad2 = ctx.createLinearGradient(W * .03, H * .1, W * .97, H * .9);
      sGrad2.addColorStop(0, "#1a2a38"); sGrad2.addColorStop(.3, "#243040"); sGrad2.addColorStop(1, "#0a1520");
      ctx.fillStyle = sGrad2;
      ctx.beginPath(); ctx.roundRect(W * .03, H * .1, W * .94, H * .8, 2); ctx.fill();
      // Screen reflection
      ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.beginPath(); ctx.roundRect(W * .04, H * .12, W * .35, H * .25, 1); ctx.fill();
      // Bezel
      ctx.strokeStyle = "#303030"; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(W * .03, H * .1, W * .94, H * .8, 2); ctx.stroke();
      break;
    }

    case "lamp_floor": {
      // Shade
      ctx.fillStyle = "#f0d880"; ctx.strokeStyle = "#c8a840"; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.arc(W * .5, H * .35, W * .42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Glow effect
      ctx.fillStyle = "rgba(255,220,100,.15)"; ctx.beginPath(); ctx.arc(W * .5, H * .35, W * .7, 0, Math.PI * 2); ctx.fill();
      // Pole
      ctx.strokeStyle = "#a08830"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(W * .5, H * .6); ctx.lineTo(W * .5, H * .9); ctx.stroke();
      // Base
      ctx.fillStyle = col; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = .6;
      ctx.beginPath(); ctx.ellipse(W * .5, H * .92, W * .35, H * .08, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
    }

    case "rug": {
      // Shadow
      ctx.fillStyle = "rgba(26,18,8,.08)"; ctx.fillRect(3, 3, W, H);
      // Rug body
      const rGrad = ctx.createLinearGradient(0, 0, W, H);
      rGrad.addColorStop(0, light(col, .15)); rGrad.addColorStop(.5, col); rGrad.addColorStop(1, dark(col, .1));
      ctx.fillStyle = rGrad; ctx.strokeStyle = dark(col, .25); ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Border pattern
      ctx.strokeStyle = dark(col, .2); ctx.lineWidth = .6;
      ctx.beginPath(); ctx.roundRect(W * .04, H * .06, W * .92, H * .88, 3); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(W * .08, H * .12, W * .84, H * .76, 2); ctx.stroke();
      // Pattern in center (geometric)
      ctx.strokeStyle = `${col}60`; ctx.lineWidth = .4;
      const cX = W / 2, cY = H / 2, rW = W * .3, rH = H * .3;
      ctx.beginPath(); ctx.moveTo(cX, cY - rH); ctx.lineTo(cX + rW, cY); ctx.lineTo(cX, cY + rH); ctx.lineTo(cX - rW, cY); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cX, cY - rH * .55); ctx.lineTo(cX + rW * .55, cY); ctx.lineTo(cX, cY + rH * .55); ctx.lineTo(cX - rW * .55, cY); ctx.closePath(); ctx.stroke();
      // Fringe lines
      ctx.strokeStyle = dark(col, .18); ctx.lineWidth = .4;
      for (let fi = 0; fi < 12; fi++) { const fx = W * .06 + fi * W * .88 / 12; ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H * .04); ctx.stroke(); ctx.beginPath(); ctx.moveTo(fx, H * .96); ctx.lineTo(fx, H); ctx.stroke(); }
      break;
    }

    case "car": {
      ctx.fillStyle = "rgba(26,18,8,.15)"; ctx.fillRect(5, 5, W, H);
      // Body
      const carGrad = ctx.createLinearGradient(0, 0, W, H);
      carGrad.addColorStop(0, light(col, .2)); carGrad.addColorStop(.5, col); carGrad.addColorStop(1, dark(col, .15));
      ctx.fillStyle = carGrad; ctx.strokeStyle = dark(col, .3); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(W * .06, H * .05, W * .88, H * .9, W * .12); ctx.fill(); ctx.stroke();
      // Windows
      ctx.fillStyle = "rgba(160,200,220,.7)"; ctx.strokeStyle = "#80a8b8"; ctx.lineWidth = .6;
      [[W * .12, H * .2, W * .76, H * .28], [W * .12, H * .52, W * .76, H * .28]].forEach(([wx, wy, ww, wh]) => { ctx.beginPath(); ctx.roundRect(wx, wy, ww, wh, 4); ctx.fill(); ctx.stroke(); });
      // Door line
      ctx.strokeStyle = dark(col, .35); ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(W * .5, H * .15); ctx.lineTo(W * .5, H * .85); ctx.stroke();
      // Wheels
      ctx.fillStyle = "#252520"; ctx.strokeStyle = "#454540"; ctx.lineWidth = .7;
      [[W * .15, H * .14], [W * .78, H * .14], [W * .15, H * .74], [W * .78, H * .74]].forEach(([wx, wy]) => {
        ctx.beginPath(); ctx.arc(wx, wy, W * .11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#707068"; ctx.beginPath(); ctx.arc(wx, wy, W * .055, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#252520";
      });
      // Headlights
      ctx.fillStyle = "#f8f0c0"; ctx.strokeStyle = "#d0c090"; ctx.lineWidth = .5;
      [[W * .12, H * .08], [W * .78, H * .08]].forEach(([lx, ly]) => { ctx.beginPath(); ctx.roundRect(lx, ly, W * .1, H * .06, 2); ctx.fill(); ctx.stroke(); });
      break;
    }

    case "pool": {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(4, 4, W, H);
      // Pool outline
      ctx.fillStyle = "#4898b8"; ctx.strokeStyle = "#307898"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, H * .12); ctx.fill(); ctx.stroke();
      // Water gradient
      const poolGrad = ctx.createLinearGradient(0, 0, W, H);
      poolGrad.addColorStop(0, "rgba(100,180,210,.9)"); poolGrad.addColorStop(.5, "rgba(60,148,188,.95)"); poolGrad.addColorStop(1, "rgba(40,120,168,.9)");
      ctx.fillStyle = poolGrad;
      ctx.beginPath(); ctx.roundRect(W * .04, H * .06, W * .92, H * .88, H * .1); ctx.fill();
      // Lane dividers
      ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = .6; ctx.setLineDash([6, 6]);
      for (let li = 1; li < 3; li++) { ctx.beginPath(); ctx.moveTo(W * .05, H * li / 3); ctx.lineTo(W * .95, H * li / 3); ctx.stroke(); }
      ctx.setLineDash([]);
      // Shimmer lines
      ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = .5;
      [.25, .4, .55, .7].forEach(yp => { ctx.beginPath(); ctx.moveTo(W * .06, H * yp); ctx.bezierCurveTo(W * .3, H * (yp - .04), W * .7, H * (yp + .04), W * .94, H * yp); ctx.stroke(); });
      // Steps indicator
      ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = .4;
      ctx.fillRect(W * .04, H * .06, W * .08, H * .2); ctx.strokeRect(W * .04, H * .06, W * .08, H * .2);
      break;
    }

    case "stairs_up": {
      ctx.fillStyle = "#c8c0b0"; ctx.strokeStyle = "#a09888"; ctx.lineWidth = .6;
      ctx.fillRect(0, 0, W, H); ctx.strokeRect(0, 0, W, H);
      const ns3 = 9;
      for (let si = 0; si < ns3; si++) {
        const sy = H / ns3 * si;
        ctx.fillStyle = si % 2 === 0 ? "#cec6b6" : "#bab2a2";
        ctx.fillRect(0, sy, W, H / ns3);
        ctx.strokeStyle = "#a09880"; ctx.lineWidth = .4;
        ctx.beginPath(); ctx.moveTo(0, sy + H / ns3); ctx.lineTo(W, sy + H / ns3); ctx.stroke();
        // Step shadow
        ctx.fillStyle = "rgba(26,18,8,.06)"; ctx.fillRect(0, sy + H / ns3 - 2, W, 2);
      }
      // Arrow
      ctx.strokeStyle = "#c9a84c"; ctx.fillStyle = "#c9a84c"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(W * .5, H * .88); ctx.lineTo(W * .5, H * .12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * .5, H * .12); ctx.lineTo(W * .35, H * .28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * .5, H * .12); ctx.lineTo(W * .65, H * .28); ctx.stroke();
      break;
    }

    case "piano": {
      ctx.fillStyle = "rgba(26,18,8,.15)"; ctx.fillRect(3, 3, W, H);
      ctx.fillStyle = "#100808"; ctx.strokeStyle = "#080404"; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(0, 0, W, H, 4); ctx.fill(); ctx.stroke();
      // Lid reflection
      ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.beginPath(); ctx.roundRect(4, 4, W * .5, H * .3, 3); ctx.fill();
      // Keys area
      ctx.fillStyle = "#1a1010"; ctx.fillRect(0, H * .62, W, H * .3);
      // White keys
      ctx.fillStyle = "#f8f8f4"; ctx.strokeStyle = "#c8c8c0"; ctx.lineWidth = .3;
      const nk = Math.round(W / 8);
      const kW = W / nk;
      for (let ki = 0; ki < nk; ki++) {
        if (![1, 3, 6, 8, 10, 13, 15].map(v => v % nk).includes(ki % 7)) {
          ctx.fillRect(ki * kW + .5, H * .63, kW - 1, H * .26);
          ctx.strokeRect(ki * kW + .5, H * .63, kW - 1, H * .26);
        }
      }
      // Black keys
      ctx.fillStyle = "#080808";
      for (let ki = 0; ki < nk; ki++) {
        if ([1, 3, 6, 8, 10].includes(ki % 12)) {
          ctx.fillRect(ki * kW - kW * .15, H * .63, kW * .7, H * .15);
        }
      }
      break;
    }

    default: {
      ctx.fillStyle = "rgba(26,18,8,.1)"; ctx.fillRect(3, 3, W, H);
      const defGrad = ctx.createLinearGradient(0, 0, W, H);
      defGrad.addColorStop(0, light(col, .15)); defGrad.addColorStop(1, dark(col, .05));
      ctx.fillStyle = defGrad; ctx.strokeStyle = dark(col, .25); ctx.lineWidth = .8;
      ctx.beginPath(); ctx.roundRect(W * .04, H * .04, W * .92, H * .92, 4); ctx.fill(); ctx.stroke();
    }
  }

  // ── Label ──
  if (W > 24 && H > 18) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(26,18,8,.7)";
    const fS = Math.min(11, Math.max(7.5, Math.min(W, H) * .13));
    ctx.font = `600 ${fS}px 'Inter',sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // Text shadow
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillText(label, W * .5 + .5, H * .5 + .5);
    ctx.fillStyle = "rgba(26,18,8,.75)";
    ctx.fillText(label, W * .5, H * .5);
    ctx.restore();
  }

  // ── Selection handles ──
  if (isSel) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#c9a84c";
    [[0, 0], [W, 0], [0, H], [W, H], [W * .5, 0], [W * .5, H], [0, H * .5], [W, H * .5]].forEach(([hx, hy]) => {
      ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
    });
    ctx.strokeStyle = "#c9a84c"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    ctx.strokeRect(-2, -2, W + 4, H + 4); ctx.setLineDash([]);
  }

  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore();
}



/* ═══ SAVE/LOAD ═══ */
const SAVE_KEY="aybo_project_v3";
function saveProject(data){try{localStorage.setItem(SAVE_KEY,JSON.stringify({...data,savedAt:new Date().toISOString()}));}catch(e){}}
function loadProject(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s):null;}catch(e){return null;}}

/* ═══ 3D BUILDER ═══ */
function build3D(scene,walls,doors,wins,opts={}){
  const{floorM=MATS.floor[0],wallM=MATS.wall[0],ceilM=MATS.ceiling[0],wH=2.8,wT=0.2,tmpl="salon"}=opts;
  const M=(c,r=.7,m=0,tr=false,op=1)=>{const mat=new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,transparent:tr,opacity:op});return mat;};
  const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
  const C=(t,b,h,s=16)=>new THREE.CylinderGeometry(t,b,h,s);
  const add=(geo,mat,x,y,z,ry=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.rotation.y=ry;o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;};
  const pl=(col,i,d,x,y,z)=>{const l=new THREE.PointLight(col,i,d);l.position.set(x,y,z);scene.add(l);return l;};
  const src=walls.length>0?walls:(TPL[tmpl]?.walls||[]);
  if(!src.length)return{cx:5,cy:5};
  let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
  src.forEach(w=>{mnX=Math.min(mnX,w.s.x,w.e.x);mnY=Math.min(mnY,w.s.y,w.e.y);mxX=Math.max(mxX,w.s.x,w.e.x);mxY=Math.max(mxY,w.s.y,w.e.y);});
  const cx=(mnX+mxX)/2,cy=(mnY+mxY)/2,fw=mxX-mnX+3,fd=mxY-mnY+3;
  // Floor
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(fw+2,fd+2),M(floorM.c,floorM.r,floorM.m));
  fl.rotation.x=-Math.PI/2;fl.position.set(cx,0,cy);fl.receiveShadow=true;scene.add(fl);
  new THREE.GridHelper(Math.max(fw,fd)*2.5,Math.ceil(Math.max(fw,fd)*5),0x181824,0x111120);// not added, just for reference
  // Ceiling
  const ce=new THREE.Mesh(new THREE.PlaneGeometry(fw+3,fd+3),M(ceilM.c,ceilM.r,ceilM.m));
  ce.rotation.x=Math.PI/2;ce.position.set(cx,wH,cy);scene.add(ce);
  add(C(.6,.6,.04,32),M(0xc9a84c,.18,.92),cx,wH-.02,cy);
  pl(0xfff5e0,1.3,16,cx,wH-.08,cy);
  const gMat=M(0xc9a84c,.18,.88),bMat=M(0x8a6020,.32,.6),wMat=M(wallM.c,wallM.r,wallM.m);
  const glaMat=M(0x88aacc,0,0,true,.26),frMat=M(0x0e0a04,.88);
  src.forEach((wall,wi)=>{
    const dx=wall.e.x-wall.s.x,dy=wall.e.y-wall.s.y,l=Math.hypot(dx,dy);if(l<.05)return;
    const ang=Math.atan2(dy,dx),ux=dx/l,uy=dy/l;
    const ops=[];
    doors.forEach(d=>{if(d.wallIdx===wi)ops.push({off:d.offset,w:d.width,h:d.height||wH*.92,type:"door"});});
    wins.forEach(w=>{if(w.wallIdx===wi)ops.push({off:w.offset,w:w.width,h:w.height||1.2,sill:w.sill||0.9,type:"win"});});
    ops.sort((a,b)=>a.off-b.off);
    const segs=[];let cur=0;
    ops.forEach(op=>{if(op.off-cur>.01)segs.push({from:cur,to:op.off,full:true});segs.push({from:op.off,to:op.off+op.w,full:false,op});cur=op.off+op.w;});
    if(l-cur>.01)segs.push({from:cur,to:l,full:true});
    segs.forEach(seg=>{
      const sl=seg.to-seg.from;if(sl<.01)return;
      const mx2=wall.s.x+ux*(seg.from+sl/2),mz2=wall.s.y+uy*(seg.from+sl/2);
      if(seg.full){
        add(B(sl,wH,wT),wMat,mx2,wH/2,mz2,-ang);
        add(B(sl,.1,wT+.025),bMat,mx2,.05,mz2,-ang);
        add(B(sl,.07,wT+.015),gMat,mx2,wH-.035,mz2,-ang);
        add(B(sl,.035,wT+.01),gMat,mx2,.92,mz2,-ang);
      } else {
        const op=seg.op;
        if(op.type==="door"){
          const lh=wH-op.h;
          if(lh>.01)add(B(sl,lh,wT),wMat,mx2,op.h+lh/2,mz2,-ang);
          [[0],[sl]].forEach(([ox])=>{add(B(.08,op.h,wT+.07),frMat,wall.s.x+ux*(seg.from+ox),op.h/2,wall.s.y+uy*(seg.from+ox),-ang);});
          add(B(sl+.07,.07,wT+.07),frMat,mx2,op.h-.035,mz2,-ang);
          add(B(sl-.04,op.h-.06,.045),M(0x2a1c08,.82),mx2,(op.h-.06)/2,mz2,-ang);
          const hx=wall.s.x+ux*(seg.from+sl*.2),hz=wall.s.y+uy*(seg.from+sl*.2);
          add(C(.013,.013,.12,8),M(0xc9a84c,.12,.94),hx,.95,hz,-ang+Math.PI/2);
        } else {
          if(op.sill>.05)add(B(sl,op.sill,wT),wMat,mx2,op.sill/2,mz2,-ang);
          const abH=wH-op.sill-op.h;
          if(abH>.05)add(B(sl,abH,wT),wMat,mx2,op.sill+op.h+abH/2,mz2,-ang);
          [[0],[sl]].forEach(([ox])=>{add(B(.06,op.h+.05,wT+.05),frMat,wall.s.x+ux*(seg.from+ox),op.sill+op.h/2,wall.s.y+uy*(seg.from+ox),-ang);});
          [[op.sill-.02],[op.sill+op.h+.02]].forEach(([fy])=>{add(B(sl+.05,.06,wT+.05),frMat,mx2,fy,mz2,-ang);});
          add(B(sl-.06,op.h-.06,.028),glaMat,mx2,op.sill+op.h/2,mz2,-ang);
          add(B(sl+.08,.06,.18),M(0xddd8d0,.32),mx2,op.sill-.03,mz2,-ang);
        }
      }
    });
  });
  // Furniture
  if(tmpl==="salon"||walls.length===0){
    add(B(3.4,.12,1.25),M(0x18100a,.82),-1.4,.06,-2.5);
    add(B(3.4,.48,1.05),M(0x241808,.9),-1.4,.3,-2.5);
    add(B(3.4,.75,.15),M(0x241808,.9),-1.4,.78,-2.96);
    add(B(.15,.65,1.05),M(0x241808,.9),-3.0,.56,-2.5);
    add(B(.15,.65,1.05),M(0x241808,.9),.1,.56,-2.5);
    [-1.9,-1.4,-.9].forEach(x=>add(B(.88,.24,.65),M(0x382818,.95),x,.72,-2.5));
    add(C(.62,.62,.05,32),M(0xf0ece4,.05,0),-1.4,.45,-1.5);
    add(C(.02,.02,.44,8),M(0xc9a84c,.12,.94),-1.4,.22,-1.5);
    add(B(3.6,.07,.52),M(0x0c0c10,.18,.42),-1.4,.64,2.9);
    add(B(2.2,1.2,.045),M(0x040408,.01,.6),-1.4,1.28,2.9);
    add(C(.17,.22,.045,16),M(0xc9a84c,.14,.9),2.7,.022,-3.1);
    add(C(.016,.016,1.9,8),M(0xa8a8b0,.12,.9),2.7,.95,-3.1);
    pl(0xfff0d0,.85,6,2.7,1.92,-3.1);
    add(B(3.8,.015,2.4),M(0x1a0808,.96),-1.4,.008,-2.2);
  }else if(tmpl==="chambre"){
    add(B(2.3,.13,2.7),M(0x100a04,.8),0,.065,-1.6);
    add(B(2.18,.3,2.58),M(0xfcfcfa,.96),0,.36,-1.6);
    add(B(2.3,1.4,.12),M(0x100a04,.8),0,.88,-2.84);
    [-0.6,.6].forEach(x=>add(B(.75,.18,.55),M(0xfafaf8,.96),x,.58,-2.5));
    add(B(2.18,.15,1.55),M(0xe8ddd2,.95),0,.58,-1.38);
    [-1.35,1.35].forEach(x=>{add(B(.58,.62,.52),M(0x1a1008,.74),x,.31,-1.6);pl(0xfff0b0,.44,3.5,x,.96,-1.6);});
    add(B(2.9,.015,2.5),M(0x1a0808,.96),0,.008,-1.55);
  }else if(tmpl==="cuisine"){
    for(let i=0;i<6;i++)add(B(.74,.92,.64),M(0x080808,.42),-3.2+i*.78,.46,2.7);
    add(B(4.4,.055,.7),M(0xf0ece4,.04,0),-1.8,.96,2.68);
    add(B(2.6,.92,1.15),M(0x080808,.22,.14),0,.46,.5);
    add(B(2.66,.055,1.2),M(0xf0ece4,.04,0),0,.98,.5);
  }
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(220,16,8),new THREE.MeshBasicMaterial({color:0x08080e,side:THREE.BackSide})));
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({color:0x060608}));
  gnd.rotation.x=-Math.PI/2;gnd.position.y=-.008;scene.add(gnd);
  return{cx,cy};
}

/* ═══ UI ATOMS ═══ */
const Btn=({active,onClick,children,title,color=T.accent,small=false,icon=null,danger=false,disabled=false})=>{
  const col=danger?T.red:color;
  return(
    <button onClick={disabled?null:onClick} title={title} disabled={disabled}
      style={{display:"flex",flexDirection:small?"row":"column",alignItems:"center",justifyContent:"center",
        gap:small?4:2,padding:small?"4px 10px":"6px 10px",minWidth:small?38:50,height:small?24:56,
        background:active?`${col}22`:"transparent",
        border:`1px solid ${active?col+"99":"rgba(255,255,255,.06)"}`,
        borderRadius:2,color:active?col:danger?T.red:disabled?"#555":"#cccccc",
        cursor:disabled?"not-allowed":"pointer",opacity:disabled?.45:1,
        transition:"all .12s",fontSize:small?10:9,fontFamily:"'Consolas',monospace",
        whiteSpace:"nowrap",letterSpacing:".02em",fontWeight:active?700:400}}
      onMouseOver={e=>{if(disabled)return;e.currentTarget.style.background=active?`${col}2a`:"rgba(255,255,255,.07)";if(!active){e.currentTarget.style.color=col;e.currentTarget.style.borderColor=`${col}66`;}}}
      onMouseOut={e=>{if(disabled)return;e.currentTarget.style.background=active?`${col}22`:"transparent";e.currentTarget.style.borderColor=active?`${col}99`:"rgba(255,255,255,.06)";if(!active)e.currentTarget.style.color=danger?T.red:"#cccccc";}}>
      {icon&&<span style={{fontSize:small?13:17,lineHeight:1}}>{icon}</span>}
      {children&&<span style={{fontSize:9,lineHeight:1.2,opacity:active?1:.85}}>{children}</span>}
    </button>
  );
};
const Sep=()=><div style={{width:1,alignSelf:"stretch",margin:"4px 3px",background:"rgba(255,255,255,.08)"}}/>;
const RG=({label,children})=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 6px",borderRight:"1px solid rgba(255,255,255,.07)",flexShrink:0,minWidth:36}}>
    <div style={{display:"flex",gap:1,marginBottom:2,flexWrap:"nowrap",alignItems:"center",paddingTop:1}}>{children}</div>
    <div style={{fontSize:7,color:"#6c6c6c",letterSpacing:".06em",textTransform:"uppercase",borderTop:"1px solid rgba(255,255,255,.07)",width:"100%",textAlign:"center",paddingTop:2,fontFamily:"'Consolas',monospace"}}>{label}</div>
  </div>
);
const PT=({children,accent=false})=>(
  <div style={{padding:"6px 10px 5px",background:"#1e1e1e",borderBottom:"1px solid #3e3e3e",fontSize:9.5,color:accent?T.accent:"#cccccc",fontWeight:600,letterSpacing:".08em",fontFamily:"'Consolas',monospace",display:"flex",alignItems:"center",gap:6,textTransform:"uppercase"}}>
    {children}
  </div>
);
const Lbl=({children})=><label style={{display:"block",fontSize:8,color:"#6c6c6c",textTransform:"uppercase",letterSpacing:".1em",marginBottom:3,fontFamily:"'Consolas',monospace",fontWeight:400}}>{children}</label>;
const Inp=({...p})=><input {...p} style={{width:"100%",background:"#3c3c3c",border:"1px solid #525252",color:"#dcdcaa",padding:"4px 8px",fontSize:11,fontFamily:"'Consolas',monospace",outline:"none",borderRadius:2,...(p.style||{})}} onFocus={e=>{e.target.style.borderColor="#0098ff";e.target.style.outline="1px solid #0098ff22";}} onBlur={e=>{e.target.style.borderColor="#525252";e.target.style.outline="none";}}/>;
const Sel=({...p})=><select {...p} style={{width:"100%",background:"#3c3c3c",border:"1px solid #525252",color:"#cccccc",padding:"4px 7px",fontSize:11,fontFamily:"'Consolas',monospace",outline:"none",borderRadius:2,cursor:"pointer",...(p.style||{})}}/>;
const Tog=({val,set,label,color=T.accent})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,cursor:"pointer",padding:"3px 0"}} onClick={()=>set(p=>!p)}>
    <span style={{fontSize:10.5,color:val?"#ffffff":"#6c6c6c",fontFamily:"'Consolas',monospace",letterSpacing:".01em"}}>{label}</span>
    <div style={{width:30,height:14,borderRadius:7,background:val?color:"#3c3c3c",position:"relative",transition:"background .2s",flexShrink:0,border:`1px solid ${val?color:"#525252"}`}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:val?18:2,transition:"left .2s",opacity:val?1:.4}}/>
    </div>
  </div>
);

/* ═══ MAIN COMPONENT ═══ */
export default function Designer(){
  const cvRef=useRef(null),mountRef=useRef(null),fileRef=useRef(null),importRef=useRef(null);
  const keys=useRef({}),locked=useRef(false),animR=useRef(null);
  const pan=useRef({x:230,y:190}),zoom=useRef(1);
  const isPanning=useRef(false),panStart=useRef({x:0,y:0,px:0,py:0});
  const autoSaveTimer=useRef(null);

  // Core state
  const[view,setView]=useState("2d");
  const[tool,setTool]=useState("wall");
  const[quickMeasure,setQuickMeasure]=useState(false);
  const[qmResult,setQmResult]=useState(null);
  const[mirrorAxis,setMirrorAxis]=useState("vertical");
  const[walls,setWalls]=useState([]);
  const[doors,setDoors]=useState([]);
  const[wins,setWins]=useState([]);
  const[texts,setTexts]=useState([]);// {id,x,y,text,size,color}
  const[manualDims,setManualDims]=useState([]);// {id,p1,p2}
  const[sketches,setSketches]=useState([]);
  const[curSketch,setCurSketch]=useState(null);
  const[clipboard,setClipboard]=useState(null);
  const[history,setHistory]=useState([]);
  const[future,setFuture]=useState([]);
  const[template,setTemplate]=useState("");
  const[saveStatus,setSaveStatus]=useState("saved");// saved|saving|unsaved

  // Draw state
  const[drawing,setDrawing]=useState(false);
  const[startPt,setStartPt]=useState(null);
  const[curPt,setCurPt]=useState(null);
  const[snapR,setSnapR]=useState({pt:null,type:"GRD"});
  const[hov,setHov]=useState(null);
  const[hovWall,setHovWall]=useState(null);
  const[selected,setSelected]=useState([]);
  const[selBox,setSelBox]=useState(null);
  const[ortho,setOrtho]=useState(false);
  const[fps,setFps]=useState(false);
  const[zoomLvl,setZoomLvl]=useState(1);
  const[measuring,setMeasuring]=useState(false);
  const[measurePts,setMeasurePts]=useState([]);
  const[rooms,setRooms]=useState([]);
  const[roomNames,setRoomNames]=useState({});
  const[dimMode,setDimMode]=useState(false);
  const[dimPts,setDimPts]=useState([]);
  const[textInput,setTextInput]=useState(null);// {x,y} pending
  const[pendingText,setPendingText]=useState("");
  const[editingTextId,setEditingTextId]=useState(null);

  // Tool params
  const[doorW,setDoorW]=useState(0.9);
  const[doorH,setDoorH]=useState(2.1);
  const[winW,setWinW]=useState(1.2);
  const[winH,setWinH]=useState(1.2);
  const[winSill,setWinSill]=useState(0.9);
  const[wallH,setWallH]=useState(2.8);
  const[wallT,setWallT]=useState(0.2);
  const[wallType,setWallType]=useState("walls");
  const[unit,setUnit]=useState("m");
  const[offsetDist,setOffsetDist]=useState(0.5);
  const[sketchColor,setSketchColor]=useState("#1a1208");
  const[sketchSize,setSketchSize]=useState(1.5);
  const[sketchOp,setSketchOp]=useState(0.82);
  const[sketchStyle,setSketchStyle]=useState("pencil");
  const[textColor,setTextColor]=useState("#dcdcaa");
  const[textSize,setTextSize]=useState(0.4);
  const[snapEn,setSnapEn]=useState({END:true,MID:true,INT:true,GRD:true});

  // UI state
  const[ribbonTab,setRibbonTab]=useState("accueil");
  const[leftPanel,setLeftPanel]=useState("layers");
  const[rightPanel,setRightPanel]=useState("properties");
  const[showRight,setShowRight]=useState(true);
  const[layers,setLayers]=useState(INIT_LAYERS);
  const[activeLayer,setActiveLayer]=useState("walls");
  const[showGrid,setShowGrid]=useState(true);
  const[showDims,setShowDims]=useState(true);
  const[showHatch,setShowHatch]=useState(true);
  const[showRooms,setShowRooms]=useState(true);
  const[floorM,setFloorM]=useState(MATS.floor[0]);
  const[wallM,setWallM]=useState(MATS.wall[0]);
  const[ceilM,setCeilM]=useState(MATS.ceiling[0]);
  const[matCat,setMatCat]=useState("floor");
  const[matTag,setMatTag]=useState("");
  const[overlays,setOverlays]=useState([]);
  const[selOv,setSelOv]=useState(null);
  const[dragOv,setDragOv]=useState(null);
  const[cmdInput,setCmdInput]=useState("");
  const[cmdLog,setCmdLog]=useState(["AYBO INC CAD Pro v4.0  ·  Bienvenue ! Tapez W pour dessiner un mur."]);
  const[showCmd,setShowCmd]=useState(true);
  const[floor,setFloor]=useState(0);// multi-floor: current floor
  const[projectName,setProjectName]=useState("Dessin1");
  const[showRestorePrompt,setShowRestorePrompt]=useState(false);
  const[furniture,setFurniture]=useState([]);
  const[placingFurniture,setPlacingFurniture]=useState(null);// item from catalog being placed
  const[selFurniture,setSelFurniture]=useState(null);// selected placed furniture
  const[hovFurniture,setHovFurniture]=useState(null);
  const[furnitureCat,setFurnitureCat]=useState(0);
  const isMobile=typeof window!=="undefined"&&window.innerWidth<768;
  const[mobilePanel,setMobilePanel]=useState("tools");// tools|layers|props|catalog
  const pinchRef=useRef({dist:0,zoom:1});
  const[furniturePreview,setFurniturePreview]=useState(null);
  const[restoreData,setRestoreData]=useState(null);

  /* ── URL param ── */
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const r=p.get("room");
    if(r&&TPL[r]){setTemplate(r);setWalls(TPL[r].walls);setDoors([]);setWins([]);return;}
    // Ask user if they want to restore
    const saved=loadProject();
    if(saved&&saved.walls&&saved.walls.length>0){
      setRestoreData(saved);setShowRestorePrompt(true);
    } else {
      log("✓ Atelier vide — appuyez sur W pour dessiner");
    }
  },[]);

  /* ── Room detection ── */
  useEffect(()=>{
    const r=detectRooms(walls);setRooms(r);
    setRoomNames(prev=>{const n={};r.forEach((_,i)=>{n[i]=prev[i]||ROOM_NAMES[i%ROOM_NAMES.length];});return n;});
  },[walls]);

  /* ── Auto-save ── */
  useEffect(()=>{
    setSaveStatus("unsaved");
    if(autoSaveTimer.current)clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current=setTimeout(()=>{
      setSaveStatus("saving");
      saveProject({walls,doors,wins,texts,manualDims,sketches:sketches.map(s=>({...s,img:undefined})),roomNames,projectName,floor});
      setTimeout(()=>setSaveStatus("saved"),400);
    },1500);
    return()=>{if(autoSaveTimer.current)clearTimeout(autoSaveTimer.current);};
  },[walls,doors,wins,texts,manualDims,sketches,roomNames,projectName]);

  /* ── History ── */
  const push=useCallback((nw,nd=doors,nwi=wins,nt=texts,nmd=manualDims,nf=furniture)=>{
    setHistory(h=>[...h.slice(-69),{walls,doors,wins,texts,manualDims,furniture}]);setFuture([]);
    setWalls(nw);setDoors(nd);setWins(nwi);setTexts(nt);setManualDims(nmd);setFurniture(nf);
  },[walls,doors,wins,texts,manualDims,furniture]);
  const undo=useCallback(()=>{if(!history.length)return;setFuture(f=>[{walls,doors,wins,texts,manualDims},...f]);const p=history[history.length-1];setWalls(p.walls);setDoors(p.doors||[]);setWins(p.wins||[]);setTexts(p.texts||[]);setManualDims(p.manualDims||[]);setHistory(h=>h.slice(0,-1));},[history,walls,doors,wins,texts,manualDims]);
  const redo=useCallback(()=>{if(!future.length)return;setHistory(h=>[...h,{walls,doors,wins,texts,manualDims}]);const n=future[0];setWalls(n.walls);setDoors(n.doors||[]);setWins(n.wins||[]);setTexts(n.texts||[]);setManualDims(n.manualDims||[]);setFuture(f=>f.slice(1));},[future,walls,doors,wins,texts,manualDims]);

  /* ── Log ── */
  const log=useCallback(msg=>setCmdLog(h=>[...h.slice(-49),msg]),[]);

  /* ── Command ── */
  const runCmd=useCallback((cmd)=>{
    const c=cmd.trim().toUpperCase();
    log(`› ${cmd}`);
    const toolMap={W:"wall",D:"door",F:"window",S:"select",E:"erase",O:"offset",M:"move",I:"overlay",P:"sketch",T:"text",DI:"dim"};
    if(toolMap[c]){setTool(toolMap[c]);setDrawing(false);setStartPt(null);setDimMode(false);setDimPts([]);setTextInput(null);log(`Outil: ${toolMap[c]}`);}
    else if(c==="ORTHO"||c==="F8"){setOrtho(p=>{log(`Ortho: ${!p?"ON":"OFF"}`);return!p;});}
    else if(c==="GRID"||c==="F7"){setShowGrid(p=>{log(`Grille: ${!p?"ON":"OFF"}`);return!p;});}
    else if(c==="Z"||c==="ZE"){zoom.current=1;pan.current={x:230,y:190};setZoomLvl(1);log("Zoom: 100%");}
    else if(c==="ZA"){zoom.current=.52;pan.current={x:90,y:80};setZoomLvl(.52);log("Zoom: tout afficher");}
    else if(c==="ZI"){zoom.current=Math.min(12,zoom.current*1.4);setZoomLvl(zoom.current);}
    else if(c==="ZO"){zoom.current=Math.max(.08,zoom.current*.7);setZoomLvl(zoom.current);}
    else if(c==="U"||c==="UNDO"){undo();log("Annulé");}
    else if(c==="REDO"){redo();log("Rétabli");}
    else if(c==="NEW"||c==="N"){push([],[],[],[],[]);setSelected([]);setSketches([]);log("Nouveau projet vide");}
    else if(c==="2D"){setView("2d");log("Vue 2D");}
    else if(c==="3D"){setView("3d");log("Vue 3D");}
    else if(c==="SPLIT"){setView("split");log("Vue Split");}
    else if(c==="MEASURE"){setMeasuring(p=>{setMeasurePts([]);log(`Mesure: ${!p?"cliquez 2 points":"désactivé"}`);return!p;});}
    else if(c==="DIM"){setDimMode(p=>{setDimPts([]);log(`Cotation manuelle: ${!p?"cliquez 2 points":"désactivé"}`);return!p;});}
    else if(c==="ESC"||c===""){setDrawing(false);setStartPt(null);setSelected([]);setMeasuring(false);setMeasurePts([]);setDimMode(false);setDimPts([]);setTextInput(null);log("Annulé");}
    else if(c.startsWith("NAME ")){setProjectName(cmd.slice(5).trim());log(`Projet renommé: "${cmd.slice(5).trim()}"`);}
    else log(`? "${cmd}" — W D F P T S E O I DI 2D 3D ZA ZI ZO ORTHO GRID MEASURE DIM NEW UNDO REDO`);
    setCmdInput("");
  },[log,undo,redo,push]);

  /* ── Keyboard ── */
  useEffect(()=>{
    const ok=e=>{
      const inp=document.activeElement;
      if(inp&&(inp.tagName==="INPUT"||inp.tagName==="TEXTAREA"))return;
      if(e.ctrlKey&&e.key==="z"){e.preventDefault();undo();}
      if(e.ctrlKey&&e.key==="y"){e.preventDefault();redo();}
      if(e.ctrlKey&&e.key==="a"){e.preventDefault();setSelected(walls.map((_,i)=>({type:"wall",idx:i})));}
      if(e.ctrlKey&&e.key==="d"){e.preventDefault();setSelected([]);}
      if(e.ctrlKey&&e.key==="c"&&selected.length>0){
        const sw=selected.filter(s=>s.type==="wall").map(s=>walls[s.idx]).filter(Boolean);
        setClipboard({walls:sw});log(`Copié: ${sw.length} mur(s)`);
      }
      if(e.ctrlKey&&e.key==="v"&&clipboard){
        const offset={x:0.5,y:0.5};
        const nw=clipboard.walls.map(w=>({...w,s:{x:w.s.x+offset.x,y:w.s.y+offset.y},e:{x:w.e.x+offset.x,y:w.e.y+offset.y}}));
        push([...walls,...nw],doors,wins,texts,manualDims);
        log(`Collé: ${nw.length} mur(s)`);
      }
      if(e.key==="Escape"){setDrawing(false);setStartPt(null);setSelected([]);setSelBox(null);setMeasuring(false);setMeasurePts([]);setDimMode(false);setDimPts([]);setTextInput(null);setPlacingFurniture(null);setSelFurniture(null);}
      if((e.key==="Delete"||e.key==="Backspace")&&selFurniture){setFurniture(p=>p.filter(f=>f.id!==selFurniture.id));setSelFurniture(null);}
      if((e.key==="Delete"||e.key==="Backspace")&&selected.length>0){
        const si=new Set(selected.filter(s=>s.type==="wall").map(s=>s.idx));
        const ti=new Set(selected.filter(s=>s.type==="text").map(s=>s.id));
        push(walls.filter((_,i)=>!si.has(i)),doors.filter(d=>!si.has(d.wallIdx)),wins.filter(w=>!si.has(w.wallIdx)),texts.filter(t=>!ti.has(t.id)),manualDims);
        setSelected([]);
      }
      if(!e.ctrlKey&&!e.altKey){
        const map={w:"wall",d:"door",f:"window",s:"select",e:"erase",o:"offset",m:"move",i:"overlay",p:"sketch",t:"text"};
        if(map[e.key]){setTool(map[e.key]);setDrawing(false);setStartPt(null);setDimMode(false);setTextInput(null);}
        if(e.key==="F8"){e.preventDefault();setOrtho(p=>!p);}
        if(e.key==="F7"){e.preventDefault();setShowGrid(p=>!p);}
        if(e.key==="F9"){e.preventDefault();setShowDims(p=>!p);}
        if(e.key==="Tab"){e.preventDefault();setShowRight(p=>!p);}
        if(e.key==="2"){setView("2d");}
        if(e.key==="3"){setView("3d");}
        if(e.key==="/"||e.key==="Enter"){const inp=document.querySelector(".cmd-input");if(inp)inp.focus();}
      }
    };
    window.addEventListener("keydown",ok);return()=>window.removeEventListener("keydown",ok);
  },[undo,redo,selected,walls,doors,wins,texts,manualDims,clipboard,push]);

  /* ── Touch handlers ── */
  useEffect(()=>{
    const cv=cvRef.current;if(!cv)return;
    const getDist=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
    const getMid=touches=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2});

    let lastTap=0,lastTouch=null;

    const onTS=e=>{
      if(e.touches.length===1){
        const t=e.touches[0];
        lastTouch={x:t.clientX,y:t.clientY};
        const now=Date.now();
        if(now-lastTap<300){// Double tap = zoom in
          e.preventDefault();
          zoom.current=Math.min(8,zoom.current*1.5);setZoomLvl(zoom.current);
        }
        lastTap=now;
        // Simulate mousedown for drawing
        const r=cv.getBoundingClientRect(),sx=cv.width/r.width,sy=cv.height/r.height;
        const raw={x:((t.clientX-r.left)*sx-pan.current.x)/(SC*zoom.current),y:((t.clientY-r.top)*sy-pan.current.y)/(SC*zoom.current)};
        const{pt}=getSnap(raw,walls,snapEn);
        if(tool==="wall"){
          if(!drawing){setDrawing(true);setStartPt(pt);}
          else{const endP=autoJoin(pt,walls);if(Math.hypot(endP.x-startPt.x,endP.y-startPt.y)>.05){push([...walls,{s:startPt,e:endP,layerId:wallType}],doors,wins,texts,manualDims);setStartPt(endP);}}
        }
      } else if(e.touches.length===2){
        e.preventDefault();
        pinchRef.current.dist=getDist(e.touches);
        pinchRef.current.zoom=zoom.current;
        isPanning.current=false;
      }
    };

    const onTM=e=>{
      e.preventDefault();
      if(e.touches.length===1){
        const t=e.touches[0];
        const r=cv.getBoundingClientRect(),sx=cv.width/r.width,sy=cv.height/r.height;
        const raw={x:((t.clientX-r.left)*sx-pan.current.x)/(SC*zoom.current),y:((t.clientY-r.top)*sy-pan.current.y)/(SC*zoom.current)};
        setCurPt(raw);
        const{pt,type}=getSnap(raw,walls,snapEn);setSnapR({pt,type});
        // Two-finger drag = pan
        if(lastTouch&&(tool==="select"||!drawing)){
          pan.current.x+=((t.clientX-lastTouch.x)/r.width)*cv.width;
          pan.current.y+=((t.clientY-lastTouch.y)/r.height)*cv.height;
          setZoomLvl(zoom.current);
        }
        lastTouch={x:t.clientX,y:t.clientY};
      } else if(e.touches.length===2){
        const newDist=getDist(e.touches);
        const ratio=newDist/pinchRef.current.dist;
        const nz=Math.max(.08,Math.min(12,pinchRef.current.zoom*ratio));
        const mid=getMid(e.touches);
        const r=cv.getBoundingClientRect(),sx=cv.width/r.width,sy=cv.height/r.height;
        const mx=(mid.x-r.left)*sx,my=(mid.y-r.top)*sy;
        pan.current.x=mx-(mx-pan.current.x)*(nz/zoom.current);
        pan.current.y=my-(my-pan.current.y)*(nz/zoom.current);
        zoom.current=nz;setZoomLvl(nz);
      }
    };

    const onTE=e=>{
      if(e.touches.length===0){
        lastTouch=null;
        if(tool==="wall"&&drawing){// End wall on touch end after drag
          // keep drawing mode for next tap
        }
      }
    };

    cv.addEventListener("touchstart",onTS,{passive:false});
    cv.addEventListener("touchmove",onTM,{passive:false});
    cv.addEventListener("touchend",onTE,{passive:false});
    return()=>{cv.removeEventListener("touchstart",onTS);cv.removeEventListener("touchmove",onTM);cv.removeEventListener("touchend",onTE);};
  },[tool,drawing,startPt,walls,doors,wins,texts,manualDims,snapEn,push,wallType]);

  /* ── Wheel zoom ── */
  useEffect(()=>{
    const cv=cvRef.current;if(!cv)return;
    const onW=e=>{
      e.preventDefault();
      const f=e.deltaY>0?.88:1.14,nz=Math.max(.08,Math.min(12,zoom.current*f));
      const r=cv.getBoundingClientRect(),sx=cv.width/r.width,sy=cv.height/r.height;
      const mx=(e.clientX-r.left)*sx,my=(e.clientY-r.top)*sy;
      pan.current.x=mx-(mx-pan.current.x)*(nz/zoom.current);
      pan.current.y=my-(my-pan.current.y)*(nz/zoom.current);
      zoom.current=nz;setZoomLvl(nz);
    };
    cv.addEventListener("wheel",onW,{passive:false});return()=>cv.removeEventListener("wheel",onW);
  },[]);

  /* ── Image import (overlay) ── */
  const importImg=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{const img=new Image();img.onload=()=>{const id=Date.now();setOverlays(p=>[...p,{id,img,src:ev.target.result,x:1,y:1,scale:.01,opacity:.45,visible:true,locked:false,name:file.name,imgW:img.width,imgH:img.height}]);setSelOv(id);setTool("overlay");log(`Image: ${file.name}`);};img.src=ev.target.result;};
    reader.readAsDataURL(file);e.target.value="";
  };

  /* ── JSON import ── */
  const importJSON=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        push(d.walls||[],d.doors||[],d.wins||[],d.texts||[],d.manualDims||[]);
        setSketches(d.sketches||[]);setRoomNames(d.roomNames||{});
        if(d.projectName)setProjectName(d.projectName);
        log(`Importé: "${d.projectName||file.name}" — ${(d.walls||[]).length} murs`);
      }catch{log("Erreur: fichier JSON invalide");}
    };
    reader.readAsText(file);e.target.value="";
  };

  /* ── Exports ── */
  const exportPNG=()=>{if(!cvRef.current)return;const a=document.createElement("a");a.download=`${projectName}.png`;a.href=cvRef.current.toDataURL("image/png",1);a.click();log("Export PNG HD");};
  const exportJSON=()=>{
    const d=JSON.stringify({walls,doors,wins,texts,manualDims,sketches:[],roomNames,projectName,savedAt:new Date().toISOString()},null,2);
    const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=`${projectName}.json`;a.click();log("Export JSON");
  };
  const exportDXF=()=>{
    const lines=["0","SECTION","2","ENTITIES"];
    walls.forEach(w=>{lines.push("0","LINE","8","A-WALL","10",w.s.x.toFixed(4),"20",w.s.y.toFixed(4),"30","0","11",w.e.x.toFixed(4),"21",w.e.y.toFixed(4),"31","0");});
    texts.forEach(t=>{lines.push("0","TEXT","8","A-ANNO-TEXT","10",t.x.toFixed(4),"20",t.y.toFixed(4),"30","0","40",(t.size||0.4).toFixed(3),"1",t.text||"");});
    lines.push("0","ENDSEC","0","EOF");
    const b=new Blob([lines.join("\n")],{type:"text/plain"});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=`${projectName}.dxf`;a.click();log("Export DXF");
  };
  const exportPDF=()=>{
    const cv=cvRef.current;if(!cv)return;
    const w=window.open("","_blank");
    const img=cv.toDataURL("image/png",1);
    const totalArea=rooms.reduce((a,r)=>a+r.area,0);
    const table=rooms.map((r,i)=>`<tr><td>${roomNames[i]||ROOM_NAMES[i%ROOM_NAMES.length]}</td><td>${r.area.toFixed(2)} m²</td><td>${(r.area*wallH).toFixed(1)} m³</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${projectName}</title><style>body{font-family:'Segoe UI',sans-serif;margin:20px;background:#fff;color:#111}h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;margin:16px 0 8px;color:#333}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 10px;border:1px solid #ddd;text-align:left}th{background:#f0f0f0;font-weight:600}img{max-width:100%;border:1px solid #ddd;margin:12px 0}.meta{font-size:11px;color:#666;margin-bottom:12px}.total{font-weight:700;background:#e8f4ff}@media print{.noprint{display:none}}</style></head><body>
    <h1>📐 ${projectName}</h1><div class="meta">AYBO INC CAD Pro · ${new Date().toLocaleDateString("fr-FR")} · Étage ${floor}</div>
    <img src="${img}"/>
    <h2>Tableau des surfaces</h2><table><thead><tr><th>Pièce</th><th>Surface</th><th>Volume (H=${wallH}m)</th></tr></thead><tbody>${table}<tr class="total"><td>Total</td><td>${totalArea.toFixed(2)} m²</td><td>${(totalArea*wallH).toFixed(1)} m³</td></tr></tbody></table>
    <h2>Éléments du plan</h2><table><thead><tr><th>Élément</th><th>Quantité</th><th>Détails</th></tr></thead><tbody>
    <tr><td>Murs</td><td>${walls.length}</td><td>Total: ${walls.reduce((a,w)=>a+wLen(w),0).toFixed(2)} ml</td></tr>
    <tr><td>Portes</td><td>${doors.length}</td><td>Largeurs: ${doors.map(d=>d.width+"m").join(", ")||"—"}</td></tr>
    <tr><td>Fenêtres</td><td>${wins.length}</td><td>Largeurs: ${wins.map(w=>w.width+"m").join(", ")||"—"}</td></tr>
    </tbody></table>
    <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:10px 24px;background:#007acc;color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:13px">🖨 Imprimer</button>
    </body></html>`);
    w.document.close();log("Export PDF — fenêtre d'impression ouverte");
  };
  const exportReport=()=>{
    const totalArea=rooms.reduce((a,r)=>a+r.area,0);
    const totalLen=walls.reduce((a,w)=>a+wLen(w),0);
    const lines=[`╔══════════════════════════════════╗`,`║   RAPPORT AYBO INC CAD Pro v4.0  ║`,`╚══════════════════════════════════╝`,``,`Projet: ${projectName}`,`Date: ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR")}`,`Étage: ${floor}`,``,`══ ÉLÉMENTS ══`,`  Murs:      ${walls.length}  (${totalLen.toFixed(2)} ml)`,`  Portes:    ${doors.length}`,`  Fenêtres:  ${wins.length}`,`  Textes:    ${texts.length}`,`  Croquis:   ${sketches.length}`,``,`══ SURFACES ══`,`  Surface totale:  ${totalArea.toFixed(2)} m²`,`  Volume total:    ${(totalArea*wallH).toFixed(1)} m³ (H=${wallH}m)`,``,`══ PIÈCES ══`,...rooms.map((r,i)=>`  ${(roomNames[i]||ROOM_NAMES[i%ROOM_NAMES.length]).padEnd(20)} ${r.area.toFixed(2)} m²  /  ${(r.area*wallH).toFixed(1)} m³`),``,`══ MATÉRIAUX ══`,`  Sol:     ${floorM.label}`,`  Murs:    ${wallM.label}`,`  Voûte:   ${ceilM.label}`,];
    const b=new Blob([lines.join("\n")],{type:"text/plain"});const u=URL.createObjectURL(b);
    const a=document.createElement("a");a.href=u;a.download=`rapport-${projectName}.txt`;a.click();log("Rapport exporté");
  };

  /* ═══ CANVAS RENDER ═══ */
  useEffect(()=>{
    if(view!=="2d"&&view!=="split")return;
    const cv=cvRef.current;if(!cv)return;
    const ctx=cv.getContext("2d");
    const W=cv.width,H=cv.height,z=zoom.current,sc=SC*z;
    ctx.clearRect(0,0,W,H);
    // Background
    const bg=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,Math.max(W,H)*.75);
    bg.addColorStop(0,"#1e1e1e");bg.addColorStop(.5,"#1a1a1a");bg.addColorStop(1,"#161616");
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.translate(pan.current.x,pan.current.y);
    // Overlays
    overlays.forEach(ov=>{
      if(!ov.visible||!ov.img)return;
      const px=ov.x*sc,py=ov.y*sc,pw=ov.imgW*ov.scale*sc,ph=ov.imgH*ov.scale*sc;
      ctx.save();ctx.globalAlpha=ov.opacity;ctx.drawImage(ov.img,px,py,pw,ph);ctx.globalAlpha=1;
      if(selOv===ov.id){ctx.strokeStyle=T.accent;ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeRect(px,py,pw,ph);ctx.setLineDash([]);[[px,py],[px+pw,py],[px,py+ph],[px+pw,py+ph]].forEach(([hx,hy])=>{ctx.fillStyle=T.accent;ctx.fillRect(hx-5,hy-5,10,10);});}else{ctx.strokeStyle="rgba(100,100,130,.28)";ctx.lineWidth=.7;ctx.setLineDash([4,4]);ctx.strokeRect(px,py,pw,ph);ctx.setLineDash([]);}
      ctx.restore();
    });
    // Grid
    if(showGrid){
      const gs=SN*sc;
      const drawGL=(step,col,lw)=>{ctx.strokeStyle=col;ctx.lineWidth=lw;for(let gx=pan.current.x%step-step;gx<W;gx+=step){ctx.beginPath();ctx.moveTo(gx,-pan.current.y);ctx.lineTo(gx,H-pan.current.y);ctx.stroke();}for(let gy=pan.current.y%step-step;gy<H;gy+=step){ctx.beginPath();ctx.moveTo(-pan.current.x,gy);ctx.lineTo(W-pan.current.x,gy);ctx.stroke();}};
      if(gs>8){drawGL(gs*4,"rgba(255,255,255,.08)",.7);drawGL(gs,"rgba(255,255,255,.04)",.32);}
      else drawGL(gs*16,"rgba(255,255,255,.08)",.7);
    }
    // Axes
    ctx.strokeStyle="rgba(255,50,50,.28)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-9999,0);ctx.lineTo(9999,0);ctx.stroke();
    ctx.strokeStyle="rgba(40,200,70,.26)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-9999);ctx.lineTo(0,9999);ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,.18)";ctx.font=`${9*Math.max(.5,z)}px 'Consolas',monospace`;ctx.fillText("0,0",4,12);
    // Room fills
    const roomPal=["rgba(0,122,204,.08)","rgba(78,201,176,.07)","rgba(220,220,170,.06)","rgba(197,134,192,.06)","rgba(100,200,120,.06)","rgba(220,100,80,.05)","rgba(180,150,255,.05)","rgba(255,200,100,.05)"];
    if(showRooms)rooms.forEach((room,i)=>{if(room.poly.length<3)return;ctx.beginPath();room.poly.forEach((p,j)=>{if(j===0)ctx.moveTo(p.x*sc,p.y*sc);else ctx.lineTo(p.x*sc,p.y*sc);});ctx.closePath();ctx.fillStyle=roomPal[i%roomPal.length];ctx.fill();});
    // Sketches
    const drawSketch=(pts,color,size,opacity,style)=>{
      if(!pts||pts.length<2)return;
      ctx.save();ctx.globalAlpha=opacity;ctx.lineCap="round";ctx.lineJoin="round";
      if(style==="chalk"){for(let pass=0;pass<3;pass++){ctx.beginPath();ctx.moveTo(pts[0].x*sc+(Math.random()-.5)*2*z,pts[0].y*sc+(Math.random()-.5)*2*z);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x*sc+(Math.random()-.5)*3.5*z,pts[i].y*sc+(Math.random()-.5)*3.5*z);ctx.strokeStyle=color;ctx.lineWidth=size*z*2.4;ctx.globalAlpha=opacity*.45;ctx.stroke();}}
      else if(style==="ink"){ctx.strokeStyle=color;for(let i=1;i<pts.length;i++){const t=i/pts.length,pr=.5+.5*Math.sin(t*Math.PI);ctx.beginPath();ctx.moveTo(pts[i-1].x*sc,pts[i-1].y*sc);ctx.lineTo(pts[i].x*sc,pts[i].y*sc);ctx.lineWidth=size*z*pr*2.4;ctx.stroke();}}
      else{ctx.beginPath();ctx.moveTo(pts[0].x*sc,pts[0].y*sc);for(let i=1;i<pts.length;i++){if(i<pts.length-1){const mx=(pts[i].x+pts[i+1].x)/2*sc,my=(pts[i].y+pts[i+1].y)/2*sc;ctx.quadraticCurveTo(pts[i].x*sc,pts[i].y*sc,mx,my);}else ctx.lineTo(pts[i].x*sc,pts[i].y*sc);}ctx.strokeStyle=color;ctx.lineWidth=size*z;ctx.stroke();}
      ctx.restore();
    };
    sketches.forEach(sk=>drawSketch(sk.points,sk.color,sk.size,sk.opacity,sk.style));
    if(curSketch&&curSketch.points.length>1)drawSketch(curSketch.points,curSketch.color,curSketch.size,curSketch.opacity,curSketch.style);
    // Walls
    walls.forEach((w,i)=>{
      const isSel=selected.some(s=>s.type==="wall"&&s.idx===i),isHov=hov?.type==="wall"&&hov?.idx===i;
      const lay=layers.find(l=>l.id===(w.layerId||"walls"))||layers[0];
      if(!lay.vis)return;
      const dx=w.e.x-w.s.x,dy=w.e.y-w.s.y,l=Math.hypot(dx,dy);if(l<.01)return;
      const ang=Math.atan2(dy,dx),thick=(wallT/2)*sc,ux=dx/l,uy=dy/l;
      const nx=(-dy/l)*thick,ny=(dx/l)*thick;
      const ops=[];
      doors.forEach(d=>{if(d.wallIdx===i)ops.push({off:d.offset,w:d.width,type:"door"});});
      wins.forEach(ww=>{if(ww.wallIdx===i)ops.push({off:ww.offset,w:ww.width,type:"win"});});
      ops.sort((a,b)=>a.off-b.off);
      const drawSeg=(from,to)=>{
        if(to-from<.01)return;
        const fx=w.s.x+ux*from,fy=w.s.y+uy*from,ex2=w.s.x+ux*to,ey2=w.s.y+uy*to;
        ctx.beginPath();ctx.moveTo(fx*sc+nx,fy*sc+ny);ctx.lineTo(ex2*sc+nx,ey2*sc+ny);ctx.lineTo(ex2*sc-nx,ey2*sc-ny);ctx.lineTo(fx*sc-nx,fy*sc-ny);ctx.closePath();
        ctx.fillStyle=isSel?"rgba(0,152,255,.18)":isHov?"rgba(255,80,80,.12)":"rgba(255,255,255,.06)";ctx.fill();
        if(showHatch&&!isSel&&!isHov){ctx.save();ctx.clip();ctx.strokeStyle=`${lay.color}20`;ctx.lineWidth=.5;const step=5.5*z;for(let h=-(to-from+wallT)*sc*3;h<(to-from+wallT)*sc*3;h+=step){ctx.beginPath();ctx.moveTo(fx*sc+h,-5000);ctx.lineTo(fx*sc+h+thick*2.5,5000);ctx.stroke();}ctx.restore();}
        ctx.beginPath();ctx.moveTo(fx*sc+nx,fy*sc+ny);ctx.lineTo(ex2*sc+nx,ey2*sc+ny);ctx.lineTo(ex2*sc-nx,ey2*sc-ny);ctx.lineTo(fx*sc-nx,fy*sc-ny);ctx.closePath();
        ctx.strokeStyle=isSel?"rgba(0,150,255,.9)":isHov?"rgba(255,80,80,.8)":lay.color;ctx.lineWidth=isSel?1.8*z:lay.lw*.5*z;ctx.stroke();
      };
      let cur=0;
      ops.forEach(op=>{
        drawSeg(cur,op.off);
        const ox1=(w.s.x+ux*op.off)*sc,oy1=(w.s.y+uy*op.off)*sc,ox2=(w.s.x+ux*(op.off+op.w))*sc,oy2=(w.s.y+uy*(op.off+op.w))*sc;
        if(op.type==="door"){
          ctx.save();ctx.strokeStyle="#44aaff";ctx.lineWidth=1.2*z;
          ctx.beginPath();ctx.moveTo(ox1+nx,oy1+ny);ctx.lineTo(ox1-nx,oy1-ny);ctx.stroke();
          ctx.beginPath();ctx.moveTo(ox2+nx,oy2+ny);ctx.lineTo(ox2-nx,oy2-ny);ctx.stroke();
          ctx.beginPath();ctx.arc(ox1,oy1,op.w*sc,ang-Math.PI/2,ang,false);ctx.strokeStyle="rgba(68,170,255,.35)";ctx.lineWidth=.9*z;ctx.setLineDash([4*z,3*z]);ctx.stroke();ctx.setLineDash([]);
          ctx.beginPath();ctx.moveTo(ox1,oy1);ctx.lineTo(ox1+Math.cos(ang)*op.w*sc,oy1+Math.sin(ang)*op.w*sc);ctx.strokeStyle="#44aaff";ctx.lineWidth=1.6*z;ctx.stroke();
          ctx.restore();
        } else {
          ctx.save();ctx.strokeStyle="#88ddff";ctx.lineWidth=1.5*z;
          ctx.beginPath();ctx.moveTo(ox1+nx*.35,oy1+ny*.35);ctx.lineTo(ox2+nx*.35,oy2+ny*.35);ctx.stroke();
          ctx.beginPath();ctx.moveTo(ox1-nx*.35,oy1-ny*.35);ctx.lineTo(ox2-nx*.35,oy2-ny*.35);ctx.stroke();
          [[ox1,oy1],[ox2,oy2]].forEach(([x,y])=>{ctx.lineWidth=z;ctx.beginPath();ctx.moveTo(x+nx,y+ny);ctx.lineTo(x-nx,y-ny);ctx.stroke();});
          ctx.restore();
        }
        cur=op.off+op.w;
      });
      drawSeg(cur,l);
      // Wall dim
      if(showDims&&z>.25){
        const mx=(w.s.x+w.e.x)/2*sc,my=(w.s.y+w.e.y)/2*sc,flip=ang>Math.PI/2||ang<-Math.PI/2;
        ctx.save();ctx.translate(mx,my);ctx.rotate(flip?ang+Math.PI:ang);
        const disp=fmt(l,unit),fS=Math.min(11,9*Math.max(.55,z));ctx.font=`${fS}px 'Consolas',monospace`;
        const tw=ctx.measureText(disp).width+10;
        ctx.fillStyle="rgba(20,20,26,.95)";ctx.fillRect(-tw/2,-21*z,tw,14.5*z);
        ctx.strokeStyle=isSel?"#0098ff":"rgba(0,152,255,.6)";ctx.lineWidth=.5;ctx.strokeRect(-tw/2,-21*z,tw,14.5*z);
        [-tw/2,tw/2].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-23*z);ctx.lineTo(x,-27*z);ctx.stroke();});
        ctx.beginPath();ctx.moveTo(-tw/2,-25*z);ctx.lineTo(tw/2,-25*z);ctx.stroke();
        ctx.fillStyle=isSel?"#0098ff":"#4ec9b0";ctx.textAlign="center";ctx.fillText(disp,0,-9*z);
        ctx.restore();
      }
      // Endpoints
      [w.s,w.e].forEach(pt=>{ctx.beginPath();ctx.arc(pt.x*sc,pt.y*sc,isSel?5.5*z:3.5*z,0,Math.PI*2);ctx.fillStyle=isSel?T.accent:lay.color;ctx.fill();ctx.strokeStyle="rgba(0,0,0,.65)";ctx.lineWidth=1;ctx.stroke();});
      const mp2=mid(w.s,w.e);ctx.beginPath();ctx.arc(mp2.x*sc,mp2.y*sc,2.5*z,0,Math.PI*2);ctx.fillStyle=T.green+"55";ctx.fill();
    });
    // Furniture
    furniture.forEach(f=>{drawFurniture(ctx,{...f,x:f.x,y:f.y},sc,selFurniture,hovFurniture);});
    // Placing preview
    if(placingFurniture&&curPt){drawFurniture(ctx,{...placingFurniture,id:"preview",x:snapR.pt?snapR.pt.x-placingFurniture.w/2:curPt.x-placingFurniture.w/2,y:snapR.pt?snapR.pt.y-placingFurniture.h/2:curPt.y-placingFurniture.h/2},sc,null,null);ctx.save();ctx.globalAlpha=.5;ctx.restore();}
    // Room labels
    if(showRooms)rooms.forEach((room,i)=>{
      ctx.save();const fs=Math.max(9,11*Math.min(1,z));
      ctx.font=`bold ${fs}px 'Segoe UI',sans-serif`;ctx.fillStyle="rgba(220,220,220,.75)";ctx.textAlign="center";
      ctx.fillText(roomNames[i]||ROOM_NAMES[i%ROOM_NAMES.length],room.cx*sc,room.cy*sc-7*z);
      ctx.font=`${fs*.88}px 'Consolas',monospace`;ctx.fillStyle="#4ec9b0"+"60";
      ctx.fillText(`${room.area.toFixed(1)} m²`,room.cx*sc,room.cy*sc+8*z);ctx.restore();
    });
    // Text annotations
    texts.forEach(t=>{
      const isSel=selected.some(s=>s.type==="text"&&s.id===t.id);
      const fs=Math.max(8,(t.size||0.4)*sc);
      ctx.font=`${fs}px 'Segoe UI',sans-serif`;ctx.fillStyle=t.color||T.yellow;ctx.textAlign="left";
      ctx.fillText(t.text||"",t.x*sc,t.y*sc);
      if(isSel){const tw=ctx.measureText(t.text||"").width;ctx.strokeStyle=T.accent;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(t.x*sc-2,t.y*sc-fs,tw+4,fs+4);ctx.setLineDash([]);}
    });
    // Manual dimensions
    manualDims.forEach(d=>{
      ctx.save();ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.2*z;
      ctx.beginPath();ctx.moveTo(d.p1.x*sc,d.p1.y*sc);ctx.lineTo(d.p2.x*sc,d.p2.y*sc);ctx.stroke();
      const dist=Math.hypot(d.p2.x-d.p1.x,d.p2.y-d.p1.y),mx=(d.p1.x+d.p2.x)/2*sc,my=(d.p1.y+d.p2.y)/2*sc;
      const ang2=Math.atan2(d.p2.y-d.p1.y,d.p2.x-d.p1.x),flip2=ang2>Math.PI/2||ang2<-Math.PI/2;
      ctx.translate(mx,my);ctx.rotate(flip2?ang2+Math.PI:ang2);
      const disp=fmt(dist,unit),fS=9*Math.max(.55,z),tw=ctx.measureText(disp).width+10;
      ctx.font=`${fS}px 'Consolas',monospace`;ctx.fillStyle="rgba(4,4,12,.92)";ctx.fillRect(-tw/2,-18*z,tw,13*z);
      ctx.strokeStyle="#ff88ff";ctx.lineWidth=.5;ctx.strokeRect(-tw/2,-18*z,tw,13*z);
      ctx.fillStyle="#ff88ff";ctx.textAlign="center";ctx.fillText(disp,0,-7*z);
      ctx.restore();
      [d.p1,d.p2].forEach(pt=>{ctx.beginPath();ctx.arc(pt.x*sc,pt.y*sc,4,0,Math.PI*2);ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.5;ctx.stroke();});
    });
    // Door/window hover preview
    if((tool==="door"||tool==="window")&&hovWall){
      const w=walls[hovWall.wallIdx];
      if(w){const dx=w.e.x-w.s.x,dy=w.e.y-w.s.y,l=Math.hypot(dx,dy),ux=dx/l,uy=dy/l,ow=tool==="door"?doorW:winW;
        const ox=(w.s.x+ux*hovWall.offset)*sc,oy=(w.s.y+uy*hovWall.offset)*sc,ex2=(w.s.x+ux*(hovWall.offset+ow))*sc,ey2=(w.s.y+uy*(hovWall.offset+ow))*sc;
        ctx.strokeStyle=tool==="door"?"#44aaff":"#88ddff";ctx.lineWidth=3.5*z;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ex2,ey2);ctx.stroke();
        ctx.fillStyle="rgba(4,4,12,.92)";ctx.fillRect((ox+ex2)/2-50,(oy+ey2)/2-24*z,100,15*z);
        ctx.fillStyle=tool==="door"?"#44aaff":"#88ddff";ctx.font=`${9*z}px 'Consolas',monospace`;ctx.textAlign="center";
        ctx.fillText(`${tool==="door"?"PORTE":"FENÊTRE"} ${ow.toFixed(2)}m`,(ox+ex2)/2,(oy+ey2)/2-12*z);
      }
    }
    // Preview wall
    if(drawing&&startPt&&curPt){
      const endP=angSnap(startPt,snapR.pt||curPt,ortho);
      const dx=endP.x-startPt.x,dy=endP.y-startPt.y,l=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
      if(l>.01){
        const thick=(wallT/2)*sc,nx=(-dy/l)*thick,ny=(dx/l)*thick;
        ctx.setLineDash([5,4]);ctx.strokeStyle="rgba(255,255,255,.1)";ctx.lineWidth=.8;
        ctx.beginPath();ctx.moveTo(startPt.x*sc,startPt.y*sc);ctx.lineTo(endP.x*sc,endP.y*sc);ctx.stroke();ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(startPt.x*sc+nx,startPt.y*sc+ny);ctx.lineTo(endP.x*sc+nx,endP.y*sc+ny);ctx.lineTo(endP.x*sc-nx,endP.y*sc-ny);ctx.lineTo(startPt.x*sc-nx,startPt.y*sc-ny);ctx.closePath();
        ctx.fillStyle="rgba(255,255,255,.06)";ctx.fill();ctx.strokeStyle=T.textBri;ctx.lineWidth=1.6;ctx.stroke();
        const mxp=(startPt.x+endP.x)/2*sc,myp=(startPt.y+endP.y)/2*sc,flip=ang>Math.PI/2||ang<-Math.PI/2;
        ctx.save();ctx.translate(mxp,myp);ctx.rotate(flip?ang+Math.PI:ang);
        const lab=`${l.toFixed(3)}m  ${(ang*180/Math.PI).toFixed(0)}°`,tw=ctx.measureText(lab).width+14;
        ctx.font="bold 10px 'Consolas',monospace";ctx.fillStyle="rgba(20,20,26,.96)";ctx.fillRect(-tw/2,-24,tw,17);
        ctx.strokeStyle="rgba(0,152,255,.5)";ctx.lineWidth=.5;ctx.strokeRect(-tw/2,-24,tw,17);
        ctx.fillStyle="#ffffff";ctx.textAlign="center";ctx.fillText(lab,0,-11);ctx.restore();
        ctx.beginPath();ctx.arc(endP.x*sc,endP.y*sc,8,0,Math.PI*2);ctx.strokeStyle="#0098ff";ctx.lineWidth=1.5;ctx.stroke();
      }
    }
    if(startPt){ctx.beginPath();ctx.arc(startPt.x*sc,startPt.y*sc,7,0,Math.PI*2);ctx.fillStyle="#0098ff";ctx.fill();}
    // Snap marker
    if(snapR.pt&&(drawing||tool==="wall")){
      const pt=snapR.pt,sx2=pt.x*sc,sy2=pt.y*sc,col=SNAPS[snapR.type]?.color||T.yellow;
      // Snap guide lines (like Figma)
      if(snapR.type==="END"||snapR.type==="MID"||snapR.type==="INT"){
        ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=col+"55";ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(sx2,-pan.current.y);ctx.lineTo(sx2,H-pan.current.y);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-pan.current.x,sy2);ctx.lineTo(W-pan.current.x,sy2);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }
      ctx.strokeStyle=col;ctx.lineWidth=1.6;
      if(snapR.type==="END")ctx.strokeRect(sx2-6.5,sy2-6.5,13,13);
      else if(snapR.type==="MID"){ctx.beginPath();ctx.moveTo(sx2,sy2-8.5);ctx.lineTo(sx2+8.5,sy2+6);ctx.lineTo(sx2-8.5,sy2+6);ctx.closePath();ctx.stroke();}
      else if(snapR.type==="INT"){ctx.beginPath();ctx.moveTo(sx2-9,sy2-9);ctx.lineTo(sx2+9,sy2+9);ctx.moveTo(sx2+9,sy2-9);ctx.lineTo(sx2-9,sy2+9);ctx.stroke();}
      else{ctx.beginPath();ctx.arc(sx2,sy2,6,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle=col;ctx.font="8px 'Consolas',monospace";ctx.textAlign="left";ctx.fillText(snapR.type,sx2+11,sy2-3);
    }
    // Selection box
    if(selBox){const x1=Math.min(selBox.s.x,selBox.e.x)*sc,y1=Math.min(selBox.s.y,selBox.e.y)*sc,x2=Math.max(selBox.s.x,selBox.e.x)*sc,y2=Math.max(selBox.s.y,selBox.e.y)*sc;ctx.fillStyle="rgba(0,122,204,.07)";ctx.fillRect(x1,y1,x2-x1,y2-y1);ctx.strokeStyle=T.accent;ctx.lineWidth=1;ctx.setLineDash([5,3]);ctx.strokeRect(x1,y1,x2-x1,y2-y1);ctx.setLineDash([]);}
    // Measure
    if(measuring&&measurePts.length>0){
      ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.6;ctx.setLineDash([6,4]);
      if(measurePts.length>=2){
        ctx.beginPath();ctx.moveTo(measurePts[0].x*sc,measurePts[0].y*sc);ctx.lineTo(measurePts[1].x*sc,measurePts[1].y*sc);ctx.stroke();ctx.setLineDash([]);
        const d=Math.hypot(measurePts[1].x-measurePts[0].x,measurePts[1].y-measurePts[0].y),mxp=(measurePts[0].x+measurePts[1].x)/2*sc,myp=(measurePts[0].y+measurePts[1].y)/2*sc;
        ctx.fillStyle="rgba(4,4,12,.95)";ctx.fillRect(mxp-68,myp-24,136,18);ctx.strokeStyle="#ff88ff";ctx.lineWidth=.5;ctx.strokeRect(mxp-68,myp-24,136,18);
        ctx.fillStyle="#ff88ff";ctx.font="bold 10.5px 'Consolas',monospace";ctx.textAlign="center";
        ctx.fillText(`${d.toFixed(4)}m  (${(d*100).toFixed(1)}cm)`,mxp,myp-11);
      }
      measurePts.forEach(pt=>{ctx.beginPath();ctx.arc(pt.x*sc,pt.y*sc,6.5,0,Math.PI*2);ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);});
      if(measurePts.length===1&&curPt){ctx.beginPath();ctx.moveTo(measurePts[0].x*sc,measurePts[0].y*sc);ctx.lineTo(curPt.x*sc,curPt.y*sc);ctx.strokeStyle="rgba(255,136,255,.38)";ctx.stroke();ctx.setLineDash([]);}
    }
    // Dim mode preview
    if(dimMode&&dimPts.length===1&&curPt){
      ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.6;ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.moveTo(dimPts[0].x*sc,dimPts[0].y*sc);ctx.lineTo(curPt.x*sc,curPt.y*sc);ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(dimPts[0].x*sc,dimPts[0].y*sc,5,0,Math.PI*2);ctx.strokeStyle="#ff88ff";ctx.lineWidth=1.5;ctx.stroke();
    }
    // Text cursor
    if(tool==="text"&&curPt&&!textInput){
      const fs=Math.max(8,textSize*sc);ctx.font=`${fs}px 'Segoe UI',sans-serif`;ctx.fillStyle=textColor+"88";ctx.textAlign="left";ctx.fillText("T| cliquez pour placer",curPt.x*sc,curPt.y*sc);
    }
    if(ortho){ctx.save();ctx.fillStyle="rgba(255,165,40,.8)";ctx.font="bold 11px 'Segoe UI',sans-serif";ctx.textAlign="right";ctx.fillText("◈ ORTHO",W-pan.current.x-12,22-pan.current.y);ctx.restore();}
    ctx.restore();
    // ── Rulers ──
    const rS=16;
    ctx.fillStyle="rgba(37,37,38,.97)";ctx.fillRect(0,0,W,rS);ctx.fillRect(0,0,rS,H);
    ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=1;ctx.strokeRect(0,0,W,rS);ctx.strokeRect(0,0,rS,H);
    ctx.font="7px 'Inter',sans-serif";ctx.fillStyle="rgba(180,180,180,.7)";ctx.textAlign="center";
    const step=SC*zoom.current;const startX=pan.current.x%step;
    for(let rx=startX;rx<W;rx+=step){const worldX=Math.round((rx-pan.current.x)/step);
      ctx.fillStyle="rgba(255,255,255,.2)";ctx.fillRect(rx,rS-4,1,4);
      if(Math.abs(worldX)%2===0){ctx.fillStyle="rgba(26,18,8,.4)";ctx.fillText(worldX+"m",rx,rS-5);}}
    ctx.textAlign="center";const startY=pan.current.y%step;
    for(let ry=startY;ry<H;ry+=step){const worldY=Math.round((ry-pan.current.y)/step);
      ctx.fillStyle="rgba(255,255,255,.2)";ctx.fillRect(rS-4,ry,4,1);
      if(Math.abs(worldY)%2===0){ctx.save();ctx.translate(rS-5,ry);ctx.rotate(-Math.PI/2);ctx.fillStyle="rgba(26,18,8,.4)";ctx.fillText(worldY+"m",0,0);ctx.restore();}}
    ctx.fillStyle="rgba(30,30,30,.97)";ctx.fillRect(0,0,rS,rS);
    ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=.5;ctx.strokeRect(0,0,rS,rS);
    // Scale bar
    const bW=5*SC*z;ctx.fillStyle="rgba(20,20,28,.95)";ctx.fillRect(12,H-34,bW+56,24);ctx.strokeStyle="rgba(0,152,255,.25)";ctx.lineWidth=.8;ctx.strokeRect(12,H-34,bW+56,24);
    [0,1,2,3,4].forEach(i=>{ctx.fillStyle=i%2===0?"#0098ff":"rgba(0,152,255,.45)";ctx.fillRect(16+i*SC*z,H-19,SC*z,5);});
    ctx.font="8px 'Consolas',monospace";ctx.fillStyle=T.textDim;ctx.textAlign="left";ctx.fillText("0",14,H-22);ctx.textAlign="center";ctx.fillText("5m",16+bW/2,H-22);ctx.textAlign="right";ctx.fillText("10m",16+bW,H-22);
    // Coord bar
    if(curPt){const cW=460;ctx.fillStyle="rgba(20,20,28,.97)";ctx.fillRect(W/2-cW/2,5,cW,22);ctx.strokeStyle="rgba(0,152,255,.35)";ctx.lineWidth=.8;ctx.strokeRect(W/2-cW/2,5,cW,22);ctx.fillStyle=T.cyan;ctx.font="10.5px 'Consolas',monospace";ctx.textAlign="center";const e2=drawing&&startPt?angSnap(startPt,snapR.pt||curPt,ortho):null;const delta=e2?Math.hypot(e2.x-startPt.x,e2.y-startPt.y):0;ctx.fillText(`X: ${curPt.x.toFixed(3)}  Y: ${curPt.y.toFixed(3)}${delta?`  Δ ${delta.toFixed(3)}m`:""}  [${tool.toUpperCase()}]${ortho?" ORTHO":""}`,W/2,20);}
    ctx.fillStyle="rgba(255,255,255,.4)";ctx.font="9px 'Inter',sans-serif";ctx.textAlign="right";ctx.fillText(`${Math.round(zoomLvl*100)}%`,W-12,20);
  },[view,walls,doors,wins,texts,manualDims,sketches,curSketch,drawing,startPt,curPt,snapR,hovWall,hov,selected,selBox,showGrid,showDims,showHatch,showRooms,unit,wallT,rooms,roomNames,tool,doorW,winW,overlays,selOv,ortho,measuring,measurePts,dimMode,dimPts,textInput,textSize,textColor,zoomLvl,layers]);

  /* ═══ MOUSE ═══ */
  const getRaw=useCallback(e=>{const cv=cvRef.current;if(!cv)return{x:0,y:0};const r=cv.getBoundingClientRect(),sx=cv.width/r.width,sy=cv.height/r.height;return{x:((e.clientX-r.left)*sx-pan.current.x)/(SC*zoom.current),y:((e.clientY-r.top)*sy-pan.current.y)/(SC*zoom.current)};},[]);
  const findWallAt=useCallback((raw,tol=0.45)=>{let bi=-1,bd=tol;walls.forEach((w,i)=>{const d=dist2seg(raw,w.s,w.e);if(d<bd){bd=d;bi=i;}});if(bi<0)return null;const w=walls[bi],dx=w.e.x-w.s.x,dy=w.e.y-w.s.y,l=Math.hypot(dx,dy),t=((raw.x-w.s.x)*dx+(raw.y-w.s.y)*dy)/(l*l);return{wallIdx:bi,offset:Math.max(0.12,Math.min(l-0.12,t*l))};},[walls]);

  const onDown=useCallback(e=>{
    if(view!=="2d"&&view!=="split")return;
    if(e.button===1){e.preventDefault();isPanning.current=true;panStart.current={x:e.clientX,y:e.clientY,px:pan.current.x,py:pan.current.y};return;}
    if(e.button!==0)return;
    const raw=getRaw(e);
    if(tool==="sketch"){setCurSketch({points:[raw],color:sketchColor,size:sketchSize,opacity:sketchOp,style:sketchStyle});return;}
    if(tool==="overlay"){let found=null;overlays.forEach(ov=>{if(!ov.visible||ov.locked)return;const pw=ov.imgW*ov.scale,ph=ov.imgH*ov.scale;if(raw.x>=ov.x&&raw.x<=ov.x+pw&&raw.y>=ov.y&&raw.y<=ov.y+ph)found=ov.id;});setSelOv(found);if(found){const ov=overlays.find(o=>o.id===found);setDragOv({id:found,sx:raw.x,sy:raw.y,ox:ov.x,oy:ov.y});}return;}
    if(measuring){setMeasurePts(p=>p.length<2?[...p,raw]:[raw]);return;}
    if(dimMode){
      if(dimPts.length===0){setDimPts([raw]);return;}
      if(dimPts.length===1){push(walls,doors,wins,texts,[...manualDims,{id:Date.now(),p1:dimPts[0],p2:raw}]);setDimPts([]);log(`Cotation: ${Math.hypot(raw.x-dimPts[0].x,raw.y-dimPts[0].y).toFixed(3)}m`);return;}
    }
    if(tool==="text"){
      setTextInput(raw);setPendingText("");return;
    }
    // Place furniture
    if(placingFurniture){
      const pt2=snapR.pt||raw;
      const nf={...placingFurniture,id:Date.now(),x:pt2.x-placingFurniture.w/2,y:pt2.y-placingFurniture.h/2,rot:0};
      setFurniture(prev=>[...prev,nf]);
      log(`✓ ${placingFurniture.label} placé`);
      if(!e.shiftKey)setPlacingFurniture(null);
      return;
    }
    // Select furniture
    if(tool==="select"){
      const fhit=furniture.slice().reverse().find(f=>raw.x>=f.x&&raw.x<=f.x+f.w&&raw.y>=f.y&&raw.y<=f.y+f.h);
      if(fhit){setSelFurniture(fhit);setSelected([]);return;}
      else setSelFurniture(null);
    }
    if(tool==="erase"&&selFurniture){setFurniture(p=>p.filter(f=>f.id!==selFurniture.id));setSelFurniture(null);return;}
    const{pt}=getSnap(raw,walls,snapEn);
    if(tool==="wall"){
      const joined=autoJoin(pt,walls);
      if(!drawing){setDrawing(true);setStartPt(joined);}
      else{const endP=angSnap(startPt,joined,ortho);const endJoined=autoJoin(endP,walls);if(Math.hypot(endJoined.x-startPt.x,endJoined.y-startPt.y)>.08){push([...walls,{s:startPt,e:endJoined,layerId:wallType}],doors,wins,texts,manualDims);setStartPt(endJoined);}}
    }
    else if(tool==="door"&&hovWall)push(walls,[...doors,{id:Date.now(),wallIdx:hovWall.wallIdx,offset:hovWall.offset,width:doorW,height:doorH}],wins,texts,manualDims);
    else if(tool==="window"&&hovWall)push(walls,doors,[...wins,{id:Date.now(),wallIdx:hovWall.wallIdx,offset:hovWall.offset,width:winW,height:winH,sill:winSill}],texts,manualDims);
    else if(tool==="erase"){if(hov?.type==="wall"){const idx=hov.idx;push(walls.filter((_,i)=>i!==idx),doors.filter(d=>d.wallIdx!==idx),wins.filter(w=>w.wallIdx!==idx),texts,manualDims);setHov(null);}}
    else if(tool==="offset"&&hov?.type==="wall"){const w=walls[hov.idx],dx=w.e.x-w.s.x,dy=w.e.y-w.s.y,l=Math.hypot(dx,dy),nx=-dy/l*offsetDist,ny=dx/l*offsetDist;push([...walls,{s:{x:w.s.x+nx,y:w.s.y+ny},e:{x:w.e.x+nx,y:w.e.y+ny},layerId:w.layerId}],doors,wins,texts,manualDims);}
    else if(tool==="select"){
      let f=[];walls.forEach((w,i)=>{if(dist2seg(raw,w.s,w.e)<0.45)f.push({type:"wall",idx:i});});
      texts.forEach(t=>{const fs=(t.size||0.4);if(Math.abs(raw.x-t.x)<fs*3&&Math.abs(raw.y-t.y)<fs*2)f.push({type:"text",id:t.id});});
      if(e.shiftKey&&f.length>0){setSelected(prev=>{const ex=prev.some(s=>(s.type===f[0].type)&&(s.idx===f[0].idx||s.id===f[0].id));return ex?prev.filter(s=>!((s.type===f[0].type)&&(s.idx===f[0].idx||s.id===f[0].id))):[...prev,...f];});}
      else if(f.length>0)setSelected(f);
      else{setSelected([]);setSelBox({s:raw,e:raw});}
    }
  },[view,tool,drawing,startPt,ortho,wallType,hov,hovWall,walls,doors,wins,texts,manualDims,overlays,doorW,doorH,winW,winH,winSill,offsetDist,push,measuring,dimMode,dimPts,snapEn,getRaw,sketchColor,sketchSize,sketchOp,sketchStyle,textColor,textSize]);

  const onMove=useCallback(e=>{
    if(view!=="2d"&&view!=="split")return;
    if(isPanning.current){const cv2=cvRef.current;const r2=cv2?.getBoundingClientRect();const sx=cv2&&r2?cv2.width/r2.width:1,sy=cv2&&r2?cv2.height/r2.height:1;pan.current.x=panStart.current.px+(e.clientX-panStart.current.x)*sx;pan.current.y=panStart.current.py+(e.clientY-panStart.current.y)*sy;setZoomLvl(zoom.current);return;}
    const raw=getRaw(e);setCurPt(raw);
    const{pt,type}=getSnap(raw,walls,snapEn);setSnapR({pt,type});
    if(curSketch&&tool==="sketch"){const last=curSketch.points[curSketch.points.length-1];if(Math.hypot(raw.x-last.x,raw.y-last.y)>0.04/zoom.current)setCurSketch(p=>p?{...p,points:[...p.points,raw]}:null);return;}
    if(dragOv){setOverlays(p=>p.map(ov=>ov.id===dragOv.id?{...ov,x:dragOv.ox+(raw.x-dragOv.sx),y:dragOv.oy+(raw.y-dragOv.sy)}:ov));return;}
    if(selBox){setSelBox(p=>p?{...p,e:raw}:null);return;}
    if(tool==="erase"||tool==="select"||tool==="offset"){let f=null;walls.forEach((w,i)=>{if(dist2seg(raw,w.s,w.e)<0.45)f={type:"wall",idx:i};});setHov(f);}else setHov(null);
    const fhov=furniture.find(f=>raw.x>=f.x&&raw.x<=f.x+f.w&&raw.y>=f.y&&raw.y<=f.y+f.h);setHovFurniture(fhov||null);
    // Quick measure - show nearest wall dimension
    if(quickMeasure){
      let nearest=null,bestD=1.2;
      walls.forEach((w,i)=>{const d=dist2seg(raw,w.s,w.e);if(d<bestD){bestD=d;nearest={wall:w,idx:i,d};}});
      if(nearest)setQmResult({len:wLen(nearest.wall),ang:wAng(nearest.wall)*180/Math.PI,x:raw.x,y:raw.y});
      else setQmResult(null);
    }
    if(tool==="door"||tool==="window")setHovWall(findWallAt(raw));else setHovWall(null);
  },[view,tool,curSketch,dragOv,selBox,walls,snapEn,getRaw,findWallAt]);

  const onUp=useCallback(e=>{
    if(isPanning.current){isPanning.current=false;return;}
    if(curSketch&&tool==="sketch"&&curSketch.points.length>1)setSketches(p=>[...p,{...curSketch,id:Date.now()}]);
    setCurSketch(null);
    if(dragOv){setDragOv(null);return;}
    if(selBox&&tool==="select"){const x1=Math.min(selBox.s.x,selBox.e.x),x2=Math.max(selBox.s.x,selBox.e.x),y1=Math.min(selBox.s.y,selBox.e.y),y2=Math.max(selBox.s.y,selBox.e.y);const f=[];walls.forEach((w,i)=>{if(w.s.x>=x1&&w.s.x<=x2&&w.s.y>=y1&&w.s.y<=y2&&w.e.x>=x1&&w.e.x<=x2&&w.e.y>=y1&&w.e.y<=y2)f.push({type:"wall",idx:i});});setSelected(f);setSelBox(null);}
  },[curSketch,tool,dragOv,selBox,walls]);

  const onCtx=useCallback(e=>{e.preventDefault();setDrawing(false);setStartPt(null);setSelBox(null);},[]);

  /* ═══ 3D SCENE ═══ */
  useEffect(()=>{
    if(view!=="3d"&&view!=="split")return;
    const el=mountRef.current;if(!el)return;
    const W=el.clientWidth||800,H=el.clientHeight||600;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x0e0e18);scene.fog=new THREE.FogExp2(0x0e0e18,.011);
    const camera=new THREE.PerspectiveCamera(62,W/H,.04,280);camera.rotation.order="YXZ";
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(W,H);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    el.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xfff5e0,.55));
    const sun=new THREE.DirectionalLight(0xfff8e8,1.7);sun.position.set(18,32,18);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=sun.shadow.camera.bottom=-32;sun.shadow.camera.right=sun.shadow.camera.top=32;sun.shadow.bias=-.0003;scene.add(sun);
    const fill=new THREE.DirectionalLight(0xb0c8e0,.3);fill.position.set(-14,12,-12);scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xfff0e0,0x181824,.28));
    const{cx,cy}=build3D(scene,walls,doors,wins,{floorM,wallM,ceilM,wH:wallH,wT:wallT,tmpl:template});
    camera.position.set(cx,1.65,cy+3);
    let yaw=0,pitch=0;
    const onLock=()=>{locked.current=document.pointerLockElement===renderer.domElement;setFps(locked.current);};
    document.addEventListener("pointerlockchange",onLock);
    const onMM=e=>{if(!locked.current)return;yaw-=e.movementX*.0014;pitch=Math.max(-1.1,Math.min(1.1,pitch-e.movementY*.0014));camera.rotation.y=yaw;camera.rotation.x=pitch;};
    document.addEventListener("mousemove",onMM);
    const onKD=e=>{keys.current[e.code]=true;};const onKU=e=>{keys.current[e.code]=false;};
    document.addEventListener("keydown",onKD);document.addEventListener("keyup",onKU);
    renderer.domElement.addEventListener("click",()=>renderer.domElement.requestPointerLock());
    const clock=new THREE.Clock();
    function loop(){animR.current=requestAnimationFrame(loop);const dt=clock.getDelta(),sp=(keys.current.ShiftLeft||keys.current.ShiftRight)?7.5:3.8;if(locked.current){const mv=new THREE.Vector3();if(keys.current.KeyW||keys.current.ArrowUp)mv.z-=1;if(keys.current.KeyS||keys.current.ArrowDown)mv.z+=1;if(keys.current.KeyA||keys.current.ArrowLeft)mv.x-=1;if(keys.current.KeyD||keys.current.ArrowRight)mv.x+=1;mv.normalize().multiplyScalar(sp*dt).applyEuler(new THREE.Euler(0,camera.rotation.y,0));camera.position.addScaledVector(mv,1);camera.position.y=1.65;}renderer.render(scene,camera);}
    loop();
    return()=>{cancelAnimationFrame(animR.current);document.removeEventListener("pointerlockchange",onLock);document.removeEventListener("mousemove",onMM);document.removeEventListener("keydown",onKD);document.removeEventListener("keyup",onKU);renderer.dispose();locked.current=false;setFps(false);if(el&&el.contains(renderer.domElement))el.removeChild(renderer.domElement);};
  },[view,walls,doors,wins,floorM,wallM,ceilM,wallH,wallT,template]);

  /* ═══ COMPUTED ═══ */
  const isMobileView=typeof window!=="undefined"&&window.innerWidth<768;
  const totalLen=walls.reduce((a,w)=>a+wLen(w),0);
  const totalArea=rooms.reduce((a,r)=>a+r.area,0);
  const selWalls=selected.filter(s=>s.type==="wall").map(s=>walls[s.idx]).filter(Boolean);
  const RTABS=["Accueil","Insertion","Annotation","Affichage","Gestion","Sortie","Aide"];

  /* ═══ RENDER ═══ */
  return(
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#faf8f5",color:"#1a1208",fontFamily:"'Inter',sans-serif",overflow:"hidden",userSelect:"none"}}>

      {/* ── TITLE BAR ── */}
      <div style={{height:32,background:"#1e1e1e",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",flexShrink:0,borderBottom:"none",boxShadow:"0 1px 0 rgba(201,168,76,.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:200,flexShrink:0}}>
          <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,background:"linear-gradient(135deg,#c9a84c,#a07828)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4,flexShrink:0,boxShadow:"0 2px 8px rgba(201,168,76,.3)"}}>
              <span style={{fontFamily:"'Consolas',monospace",fontSize:10,color:"#fff",fontWeight:700}}>A</span>
            </div>
            <span style={{fontFamily:"'Segoe UI',sans-serif",fontSize:13,fontWeight:600,color:"#cccccc"}}>AYBO<span style={{color:"#c9a84c"}}>.</span>INC</span>
          </a>
          <div style={{width:1,height:14,background:T.border}}/>
          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9,color:"rgba(26,18,8,.35)",letterSpacing:".1em",textTransform:"uppercase"}}>CAD Pro v4.0</span>
          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8.5,color:T.textDim}}>·</span>
          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8,color:T.textDim}}>Étage {floor}</span>
          <div style={{display:"flex",gap:4,marginLeft:6}}>
            {[0,1,2].map(f=><button key={f} onClick={()=>setFloor(f)} style={{padding:"1px 6px",background:floor===f?"rgba(0,152,255,.2)":"transparent",border:`1px solid ${floor===f?"#0098ff":"#525252"}`,borderRadius:1,color:floor===f?"#0098ff":"#999",fontSize:8.5,cursor:"pointer",fontFamily:"'Consolas',monospace",fontWeight:600}}>N{f}</button>)}
          </div>
        </div>
        <div style={{position:"absolute",left:"50%",transform:"translateX(-50%)",pointerEvents:"none",display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:saveStatus==="saved"?T.green:saveStatus==="saving"?"#ffaa33":"#f44",flexShrink:0}}/>
          <input value={projectName} onChange={e=>setProjectName(e.target.value)} style={{background:"transparent",border:"none",outline:"none",fontFamily:"'Consolas',monospace",fontSize:11,color:"#cccccc",textAlign:"center",width:180,cursor:"text",pointerEvents:"all"}}/>
          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9,color:T.textDim}}>{saveStatus==="saved"?"✓ sauvegardé":saveStatus==="saving"?"...":"non sauvegardé"}</span>
        </div>
        <div style={{display:"flex",gap:5,fontSize:8,color:"#6c6c6c",fontFamily:"'Consolas',monospace",flexShrink:0,alignItems:"center"}}>
          {[["Ctrl+Z","Undo"],["Ctrl+V","Paste"],["F7","Grid"],["F8","Ortho"],["Tab","Panel"],["W/D/F/T","Tools"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:2,padding:"1px 5px",background:T.bg2,border:`1px solid ${T.border}`,borderRadius:1}}>
              <span style={{color:T.yellow,fontWeight:600}}>{k}</span>
              <span style={{color:T.textDim}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:26,background:"#2d2d2d",display:"flex",alignItems:"stretch",padding:"0 6px",flexShrink:0,borderBottom:"none",boxShadow:"inset 0 -1px 0 rgba(201,168,76,.12)"}}>
        {RTABS.map(t=>(
          <button key={t} onClick={()=>setRibbonTab(t.toLowerCase())}
            style={{padding:"0 13px",background:ribbonTab===t.toLowerCase()?T.bg3:"transparent",border:"none",borderBottom:ribbonTab===t.toLowerCase()?"2px solid #c9a84c":"2px solid transparent",color:ribbonTab===t.toLowerCase()?"#1a1208":"rgba(26,18,8,.4)",fontSize:10.5,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:".04em",transition:"all .15s",fontWeight:ribbonTab===t.toLowerCase()?600:400}}>
            {t}
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:1,padding:"0 6px"}}>
          {[["Murs",walls.length,T.accent],["Porte",doors.length,"#44aaff"],["Fen.",wins.length,"#88ddff"],["Txt",texts.length,T.yellow],totalArea>0&&["m²",totalArea.toFixed(1),T.cyan]].filter(Boolean).map(([l,v,col])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5,padding:"0 9px",borderLeft:`1px solid ${T.border}`,height:"100%"}}>
              <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:13,color:col,fontWeight:600,lineHeight:1}}>{v}</span>
              <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:7.5,color:T.textDim,textTransform:"uppercase",letterSpacing:".1em"}}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{height:60,background:"#252526",borderBottom:"1px solid #3e3e3e",display:isMobileView?"none":"flex",alignItems:"center",padding:"0 6px",gap:3,flexShrink:0,overflowX:"auto"}}>

        {ribbonTab==="accueil" ? (<>
          <RG label="DESSINER">
            <Btn active={tool==="wall"}   onClick={()=>{setTool("wall");setDrawing(false);setStartPt(null);}} icon="━" title="W">Mur</Btn>
            <Btn active={tool==="door"}   onClick={()=>{setTool("door");setDrawing(false);setStartPt(null);}} icon="🚪" title="D">Porte</Btn>
            <Btn active={tool==="window"} onClick={()=>{setTool("window");setDrawing(false);setStartPt(null);}} icon="🪟" title="F">Fenêtre</Btn>
            <Btn active={tool==="sketch"} onClick={()=>{setTool("sketch");setDrawing(false);setStartPt(null);}} icon="✏️" color={T.gold} title="P">Croquis</Btn>
            <Btn active={tool==="text"}   onClick={()=>{setTool("text");setDrawing(false);setStartPt(null);}} icon="T" color={T.yellow} title="T">Texte</Btn>
            <Btn active={tool==="offset"} onClick={()=>{setTool("offset");setDrawing(false);setStartPt(null);}} icon="⟥" title="O">Offset</Btn>
          </RG>
          <Sep/>
          <RG label="MODIFIER">
            <Btn active={tool==="select"} onClick={()=>{setTool("select");setDrawing(false);setStartPt(null);}} icon="↖" title="S — Sélectionner">Sélect.</Btn>
            <Btn active={tool==="move"} onClick={()=>{setTool("move");setDrawing(false);}} icon="✥" title="M — Déplacer">Déplacer</Btn>
            <Btn active={tool==="erase"}  onClick={()=>{setTool("erase");setDrawing(false);setStartPt(null);}} icon="⌫" title="E — Effacer">Effacer</Btn>
          </RG>
          <Sep/>
          <RG label="CLIPB.">
            <Btn active={false} onClick={()=>{if(selected.length){const si=new Set(selected.filter(s=>s.type==="wall").map(s=>s.idx));setClipboard({walls:walls.filter((_,i)=>si.has(i))});log(`Copié: ${si.size} mur(s)`);}}} icon="⎘" title="Ctrl+C — Copier" disabled={!selected.length}>Copier</Btn>
            <Btn active={false} onClick={()=>{if(clipboard){const nw=clipboard.walls.map(w=>({...w,s:{x:w.s.x+.5,y:w.s.y+.5},e:{x:w.e.x+.5,y:w.e.y+.5}}));push([...walls,...nw],doors,wins,texts,manualDims);log("Collé");}}} icon="⎗" title="Ctrl+V — Coller" disabled={!clipboard}>Coller</Btn>
            <Btn active={false} onClick={()=>{if(selected.length){const si=new Set(selected.filter(s=>s.type==="wall").map(s=>s.idx));const sw=walls.filter((_,i)=>si.has(i));const cx5=sw.reduce((a,w)=>(a+(w.s.x+w.e.x)/2),0)/sw.length;const cy5=sw.reduce((a,w)=>(a+(w.s.y+w.e.y)/2),0)/sw.length;push([...walls,...sw.map(w=>({...w,s:{x:2*cx5-w.s.x,y:w.s.y},e:{x:2*cx5-w.e.x,y:w.e.y}}))],doors,wins,texts,manualDims);log("Miroir appliqué");}}} icon="⟺" title="MI — Miroir" disabled={!selected.length}>Miroir</Btn>
            <Btn active={false} onClick={()=>{const si=new Set(selected.filter(s=>s.type==="wall").map(s=>s.idx));const ti=new Set(selected.filter(s=>s.type==="text").map(s=>s.id));push(walls.filter((_,i)=>!si.has(i)),doors.filter(d=>!si.has(d.wallIdx)),wins.filter(w=>!si.has(w.wallIdx)),texts.filter(t=>!ti.has(t.id)),manualDims);setSelected([]);}} icon="🗑" danger title="Del — Supprimer" disabled={!selected.length}>Suppr.</Btn>
          </RG>
          <Sep/>
          <RG label="OUTILS+">
            <Btn active={quickMeasure} onClick={()=>setQuickMeasure(p=>!p)} icon="📏" color={T.yellow} title="QM — Mesure rapide au survol">Q.Mesure</Btn>
            <Btn active={tool==="offset"} onClick={()=>setTool("offset")} icon="⟥" title="O — Offset parallèle">Offset</Btn>
            <Btn active={false} onClick={()=>{push(walls.filter(w=>wLen(w)>.05),doors,wins,texts,manualDims);log("✓ Plan nettoyé");}} icon="✦" title="Supprimer murs trop courts">Nettoyer</Btn>
          </RG>
          <Sep/>
          <RG label="VUE">
            <Btn active={view==="2d"}    onClick={()=>setView("2d")}    icon="✏">Plan 2D</Btn>
            <Btn active={view==="3d"}    onClick={()=>setView("3d")}    icon="◈">Vue 3D</Btn>
            <Btn active={view==="split"} onClick={()=>setView("split")} icon="⊞">Split</Btn>
          </RG>
          <Sep/>
          <RG label="RÉGLAGES">
            <Btn small active={ortho}     onClick={()=>setOrtho(p=>!p)}               color="#ffaa33">F8 Ortho</Btn>
            <Btn small active={showGrid}  onClick={()=>setShowGrid(p=>!p)}             color={T.textDim}>F7 Grille</Btn>
            <Btn small active={measuring} onClick={()=>{setMeasuring(p=>!p);setMeasurePts([]);}} color={T.pink} title="Mesure 2 points">📏 Mesure</Btn><Btn small active={quickMeasure} onClick={()=>setQuickMeasure(p=>!p)} color={T.yellow} title="Quick Measure — survol de mur">⚡ QMesure</Btn>
            <Btn small active={dimMode}   onClick={()=>{setDimMode(p=>!p);setDimPts([]);}} color="#ff88ff">📐 Cote</Btn>
            <Btn small active={tool==="overlay"} onClick={()=>setTool("overlay")} color={T.green}>📎 Overlay</Btn>
          </RG>
          <Sep/>
          <RG label="ZOOM">
            <Btn small onClick={()=>{zoom.current=Math.min(12,zoom.current*1.28);setZoomLvl(zoom.current);}}>⊕ +</Btn>
            <Btn small onClick={()=>{zoom.current=Math.max(.08,zoom.current*.78);setZoomLvl(zoom.current);}}>⊖ −</Btn>
            <Btn small onClick={()=>{zoom.current=1;pan.current={x:230,y:190};setZoomLvl(1);}}>1:1</Btn>
            <Btn small onClick={()=>{zoom.current=.52;pan.current={x:90,y:80};setZoomLvl(.52);}}>Tout</Btn>
            <div style={{fontSize:10,color:T.cyan,fontFamily:"'JetBrains Mono','Consolas',monospace",textAlign:"center",marginTop:1,width:"100%"}}>{Math.round(zoomLvl*100)}%</div>
          </RG>
          <Sep/>
          <RG label="MODÈLES">
            {Object.entries(TPL).map(([k,v])=>(<Btn key={k} small active={template===k} onClick={()=>{setTemplate(k);setWalls(v.walls);setDoors([]);setWins([]);setTexts([]);setManualDims([]);setSelected([]);setSketches([]);log(`Modèle: ${v.name}`);}}>{v.name}</Btn>))}
            <Btn small onClick={()=>{push([],[],[],[],[]);setSelected([]);setSketches([]);setTemplate("");log("✓ Atelier vide — prêt à dessiner !");}} color={T.green}>⊕ Vide</Btn>
          </RG>
          <Sep/>
          <RG label="FICHIER">
            <Btn small onClick={()=>importRef.current?.click()} color={T.cyan}>📂 Importer</Btn>
            <Btn small onClick={()=>fileRef.current?.click()} color={T.textDim}>📎 Image</Btn>
            <Btn small onClick={exportJSON} color={T.textDim}>💾 JSON</Btn>
            <Btn small onClick={exportPNG} color={T.textDim}>🖼 PNG</Btn>
          </RG>
          <Sep/>
          <RG label="HISTORIQUE">
            <Btn small onClick={undo} color={T.textDim} disabled={!history.length}>↩ Undo</Btn>
            <Btn small onClick={redo} color={T.textDim} disabled={!future.length}>↪ Redo</Btn>
            <div style={{fontSize:8,color:"#6c6c6c",fontFamily:"'Consolas',monospace",textAlign:"center",marginTop:1,width:"100%"}}>{history.length}/{future.length}</div>
          </RG>
        </>) : null}

        {ribbonTab==="insertion" ? (<>
          <RG label="MODÈLES">
            {Object.entries(TPL).map(([k,v])=>(<Btn key={k} active={template===k} onClick={()=>{setTemplate(k);setWalls(v.walls);setDoors([]);setWins([]);setTexts([]);setManualDims([]);setSelected([]);}} icon="📐">{v.name}</Btn>))}
            <Btn active={false} onClick={()=>{push([],[],[],[],[]);setTemplate("");}} icon="⊕" color={T.green}>Vide</Btn>
          </RG>
          <Sep/>
          <RG label="PORTES">
            {[[0.7,"0.7m"],[0.9,"0.9m"],[1.0,"1.0m"],[1.2,"1.2m"],[1.6,"Double"],[2.0,"Grande"]].map(([w,l])=>(<Btn key={l} small active={doorW===w&&tool==="door"} onClick={()=>{setDoorW(w);setTool("door");}} icon="🚪">{l}</Btn>))}
          </RG>
          <Sep/>
          <RG label="FENÊTRES">
            {[[0.6,"0.6m"],[0.9,"0.9m"],[1.2,"1.2m"],[1.5,"1.5m"],[2.0,"Baie"],[3.0,"Pano."]].map(([w,l])=>(<Btn key={l} small active={winW===w&&tool==="window"} onClick={()=>{setWinW(w);setTool("window");}} icon="🪟">{l}</Btn>))}
          </RG>
          <Sep/>
          <RG label="TEXTE">
            <Btn active={tool==="text"} onClick={()=>setTool("text")} icon="T" color={T.yellow}>Placer texte</Btn>
            {[["0.2","Petit"],["0.4","Normal"],["0.6","Grand"],["0.9","Titre"]].map(([s,l])=>(<Btn key={l} small active={textSize===+s&&tool==="text"} onClick={()=>{setTextSize(+s);setTool("text");}}>{l}</Btn>))}
          </RG>
          <Sep/>
          <RG label="COTATION">
            <Btn active={dimMode} onClick={()=>{setDimMode(p=>!p);setDimPts([]);}} icon="📐" color="#ff88ff">Cote manuelle</Btn>
            <Btn active={false} onClick={()=>{setManualDims([]);log("Cotations manuelles supprimées");}} icon="🗑" danger>Effacer cotes</Btn>
          </RG>
        </>) : null}

        {ribbonTab==="annotation" ? (<>
          <RG label="COTATIONS">
            <Btn active={showDims} onClick={()=>setShowDims(p=>!p)} icon="↔">Auto ON/OFF</Btn>
            <Btn active={dimMode} onClick={()=>{setDimMode(p=>!p);setDimPts([]);}} icon="📐" color="#ff88ff">Cote manuelle</Btn>
            <Btn active={measuring} onClick={()=>{setMeasuring(p=>!p);setMeasurePts([]);}} icon="📏" color={T.pink}>Mode mesure</Btn>
          </RG>
          <Sep/>
          <RG label="TEXTE">
            <Btn active={tool==="text"} onClick={()=>setTool("text")} icon="T" color={T.yellow}>Texte</Btn>
            <Btn active={false} onClick={()=>{setTexts([]);log("Textes supprimés");}} icon="🗑" danger>Effacer textes</Btn>
          </RG>
          <Sep/>
          <RG label="AFFICHAGE">
            <Btn active={showHatch} onClick={()=>setShowHatch(p=>!p)} icon="▤">Hachures</Btn>
            <Btn active={showRooms} onClick={()=>setShowRooms(p=>!p)} icon="🏠">Noms pièces</Btn>
          </RG>
          <Sep/>
          <RG label="OSNAP">
            {Object.entries(snapEn).map(([k,v])=>(<Btn key={k} small active={v} onClick={()=>setSnapEn(p=>({...p,[k]:!p[k]}))} color={SNAPS[k]?.color}>{k}</Btn>))}
          </RG>
          <Sep/>
          <RG label="UNITÉS">
            {[["m","Mètres"],["cm","cm"],["ft","Pieds"]].map(([u,l])=>(<Btn key={u} small active={unit===u} onClick={()=>setUnit(u)}>{l}</Btn>))}
          </RG>
        </>) : null}

        {ribbonTab==="affichage" ? (<>
          <RG label="VUE">
            <Btn active={view==="2d"} onClick={()=>setView("2d")} icon="✏">Plan 2D</Btn>
            <Btn active={view==="3d"} onClick={()=>setView("3d")} icon="◈">Vue 3D</Btn>
            <Btn active={view==="split"} onClick={()=>setView("split")} icon="⊞">Split</Btn>
          </RG>
          <Sep/>
          <RG label="ZOOM">
            <Btn onClick={()=>{zoom.current=Math.min(12,zoom.current*1.32);setZoomLvl(zoom.current);}} icon="⊕">Zoom +</Btn>
            <Btn onClick={()=>{zoom.current=Math.max(.08,zoom.current*.75);setZoomLvl(zoom.current);}} icon="⊖">Zoom −</Btn>
            <Btn onClick={()=>{zoom.current=1;pan.current={x:230,y:190};setZoomLvl(1);}} icon="⊙">1:1</Btn>
            <Btn onClick={()=>{zoom.current=.52;pan.current={x:90,y:80};setZoomLvl(.52);}} icon="⊠">Tout</Btn>
          </RG>
          <Sep/>
          <RG label="VISIBILITÉ">
            <Btn active={showGrid} onClick={()=>setShowGrid(p=>!p)} icon="⊞">Grille F7</Btn>
            <Btn active={showDims} onClick={()=>setShowDims(p=>!p)} icon="↔">Cotations</Btn>
            <Btn active={showHatch} onClick={()=>setShowHatch(p=>!p)} icon="▤">Hachures</Btn>
            <Btn active={showRooms} onClick={()=>setShowRooms(p=>!p)} icon="🏠">Pièces</Btn>
          </RG>
          <Sep/>
          <RG label="MODE">
            <Btn active={view==="2d"} onClick={()=>setView("2d")} icon="✏">Plan 2D</Btn>
            <Btn active={view==="3d"} onClick={()=>setView("3d")} icon="◈">Vue 3D</Btn>
            <Btn active={view==="split"} onClick={()=>setView("split")} icon="⊞">Split</Btn>
          </RG>
          <Sep/>
          <RG label="SNAP & ORTHO">
            <Btn active={ortho} onClick={()=>setOrtho(p=>!p)} icon="⊕" color="#ffaa33">Ortho F8</Btn>
            <Btn active={Object.values(snapEn).some(v=>v)} onClick={()=>{const a=Object.values(snapEn).some(v=>v);setSnapEn(Object.fromEntries(Object.keys(snapEn).map(k=>[k,!a])));}} icon="⌖">Snap ALL</Btn>
          </RG>
          <Sep/>
          <RG label="CALQUES">
            {layers.map(lay=>(<Btn key={lay.id} small active={lay.vis} onClick={()=>setLayers(p=>p.map(l=>l.id===lay.id?{...l,vis:!l.vis}:l))} color={lay.color}>{lay.name.replace("A-","")}</Btn>))}
          </RG>
        </>) : null}

        {ribbonTab==="gestion" ? (<>
          <RG label="FICHIER">
            <Btn onClick={()=>{if(window.confirm("Effacer tout et recommencer à zéro ?")){push([],[],[],[],[]);setSelected([]);setSketches([]);setTemplate("");setProjectName("Dessin1");log("✓ Atelier vide — prêt !");}}} icon="📄">Nouveau</Btn>
            <Btn onClick={exportJSON} icon="💾">Sauvegarder</Btn>
            <Btn onClick={()=>importRef.current?.click()} icon="📂">Importer JSON</Btn>
            <Btn onClick={()=>fileRef.current?.click()} icon="📎">Importer image</Btn>
          </RG>
          <Sep/>
          <RG label="EXPORTER">
            <Btn onClick={exportPNG} icon="🖼">PNG HD</Btn>
            <Btn onClick={exportDXF} icon="📐">DXF AutoCAD</Btn>
            <Btn onClick={exportJSON} icon="📁">JSON</Btn>
            <Btn onClick={exportPDF} icon="📄">PDF + surfaces</Btn>
            <Btn onClick={exportReport} icon="📋">Rapport TXT</Btn>
          </RG>
          <Sep/>
          <RG label="CALQUES">
            <Btn onClick={()=>setLeftPanel("layers")} icon="◼">Gestionnaire</Btn>
            <Btn onClick={()=>setLayers(p=>p.map(l=>({...l,vis:true})))} icon="👁">Tout ON</Btn>
            <Btn onClick={()=>setLayers(p=>p.map(l=>({...l,lock:false})))} icon="🔓">Déverr.</Btn>
          </RG>
          <Sep/>
          <RG label="HISTORIQUE">
            <Btn onClick={undo} icon="↩" disabled={!history.length}>Annuler</Btn>
            <Btn onClick={redo} icon="↪" disabled={!future.length}>Rétablir</Btn>
            <Btn onClick={()=>{setHistory([]);setFuture([]);log("Historique vidé");}} icon="🗑" danger>Vider hist.</Btn>
            <div style={{fontSize:8.5,color:T.textDim,textAlign:"center",marginTop:1,width:"100%"}}>{history.length} états</div>
          </RG>
          <Sep/>
          <RG label="SAUVEGARDE AUTO">
            <div style={{textAlign:"center",padding:"4px 8px"}}>
              <div style={{fontSize:9,color:T.textDim,marginBottom:3}}>LocalStorage</div>
              <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:saveStatus==="saved"?T.green:saveStatus==="saving"?"#ffaa33":"#f44"}}/>
                <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9,color:saveStatus==="saved"?T.green:T.textDim}}>{saveStatus==="saved"?"Sauvegardé":saveStatus==="saving"?"Sauvegarde...":"Non sauvegardé"}</span>
              </div>
              <button onClick={()=>localStorage.removeItem(SAVE_KEY)} style={{marginTop:6,padding:"2px 8px",background:"rgba(244,67,67,.1)",border:"1px solid rgba(244,67,67,.3)",color:"#f44",fontSize:8,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Effacer cache</button>
            </div>
          </RG>
        </>) : null}

        {ribbonTab==="sortie" ? (<>
          <RG label="IMPRIMER">
            <Btn onClick={()=>window.print()} icon="🖨">Imprimer</Btn>
          </RG>
          <Sep/>
          <RG label="EXPORTER">
            <Btn onClick={exportPNG} icon="🖼">PNG Haute Résolution</Btn>
            <Btn onClick={exportDXF} icon="📐">DXF AutoCAD</Btn>
            <Btn onClick={exportPDF} icon="📄">PDF + Tableau surfaces</Btn>
            <Btn onClick={exportJSON} icon="📁">JSON (projet complet)</Btn>
            <Btn onClick={exportReport} icon="📋">Rapport quantitatif</Btn>
          </RG>
        </>) : null}

        {ribbonTab==="aide" ? (<>
          <RG label="OUTILS">
            {[["W","Mur"],["D","Porte"],["F","Fenêtre"],["P","Croquis"],["T","Texte"],["S","Sélection"],["E","Effacer"],["O","Offset"],["I","Overlay"],["2","Vue 2D"],["3","Vue 3D"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 5px",minWidth:34,flexShrink:0}}>
                <div style={{background:T.bg4,border:`1px solid ${T.border2}`,borderRadius:3,padding:"2px 5px",fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:10.5,color:T.yellow,marginBottom:2,fontWeight:700}}>{k}</div>
                <div style={{fontSize:7.5,color:T.textDim,textAlign:"center"}}>{v}</div>
              </div>
            ))}
          </RG>
          <Sep/>
          <RG label="SYSTÈME">
            {[["F7","Grille"],["F8","Ortho"],["F9","Cotations"],["Tab","Panel"],["Ctrl+Z","Undo"],["Ctrl+Y","Redo"],["Ctrl+C","Copier"],["Ctrl+V","Coller"],["Ctrl+A","Tout sel."],["Del","Supprimer"],["Molette","Zoom"],["Clic mol.","Pan"],["Esc","Annuler"],["/ ou Entrée","Commande"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"2px 4px",minWidth:40,flexShrink:0}}>
                <div style={{background:T.bg4,border:`1px solid ${T.border2}`,borderRadius:3,padding:"2px 4px",fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8.5,color:T.yellow,marginBottom:2,fontWeight:700,whiteSpace:"nowrap"}}>{k}</div>
                <div style={{fontSize:7,color:T.textDim,textAlign:"center",whiteSpace:"nowrap"}}>{v}</div>
              </div>
            ))}
          </RG>
          <Sep/>
          <RG label="À PROPOS">
            <div style={{padding:"4px 14px",textAlign:"center",minWidth:120}}>
              <div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:14,color:T.accent,marginBottom:4,fontWeight:700}}>AYBO.INC</div>
              <div style={{fontSize:8.5,color:T.textDim,lineHeight:1.75}}>CAD Pro v4.0<br/>Murs auto-joint · Textes<br/>Cotations · PDF · DXF<br/>Sauvegarde auto</div>
              <a href="/" style={{display:"block",marginTop:8,padding:"4px 12px",background:`${T.accent}18`,border:`1px solid ${T.accent}44`,color:T.accent,fontSize:9,textDecoration:"none",borderRadius:2}}>← Accueil</a>
            </div>
          </RG>
        </>) : null}
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",paddingBottom:isMobileView?"60px":0}}>

        {/* LEFT SIDEBAR */}
        {!isMobileView ? (<div style={{width:210,background:"#252526",borderRight:"1px solid #3e3e3e",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{display:"flex",background:"#1e1e1e",borderBottom:"1px solid #3e3e3e",flexShrink:0}}>
            {[["layers","Calques"],["props","Paramètres"],["catalog","Objets"]].map(([t,l])=>(
              <button key={t} onClick={()=>setLeftPanel(t)} style={{flex:1,padding:"6px 0",background:leftPanel===t?"rgba(201,168,76,.1)":"transparent",border:"none",borderBottom:leftPanel===t?"2px solid #c9a84c":"2px solid transparent",color:leftPanel===t?"#ffffff":"#6c6c6c",fontSize:9.5,cursor:"pointer",fontFamily:"'Consolas',monospace",transition:"all .15s",fontWeight:leftPanel===t?600:400}}>{l}</button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>

            {leftPanel==="layers" ? (<div>
              <PT>◼ Calques</PT>
              <div style={{padding:"6px 8px 4px",borderBottom:`1px solid ${T.border}`}}>
                <Lbl>Calque actif</Lbl>
                <Sel value={activeLayer} onChange={e=>setActiveLayer(e.target.value)}>{layers.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel>
              </div>
              {layers.map(lay=>(
                <div key={lay.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderBottom:`1px solid ${T.border}`,background:activeLayer===lay.id?"rgba(0,152,255,.12)":"transparent",cursor:"pointer",transition:"background .15s"}} onClick={()=>setActiveLayer(lay.id)}>
                  <div style={{width:10,height:10,background:lay.color,border:"1px solid rgba(255,255,255,.1)",borderRadius:1,flexShrink:0,boxShadow:activeLayer===lay.id?`0 0 5px ${lay.color}99`:""}}/>
                  <span style={{flex:1,fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9.5,color:lay.vis?"#cccccc":"#555",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lay.name}</span>
                  <button onClick={e=>{e.stopPropagation();setLayers(p=>p.map(l=>l.id===lay.id?{...l,vis:!l.vis}:l));}} style={{background:"none",border:"none",color:lay.vis?T.yellow:T.textDim+"55",cursor:"pointer",fontSize:10.5,padding:"0 2px"}}>👁</button>
                  <button onClick={e=>{e.stopPropagation();setLayers(p=>p.map(l=>l.id===lay.id?{...l,lock:!l.lock}:l));}} style={{background:"none",border:"none",color:lay.lock?T.red:T.textDim+"55",cursor:"pointer",fontSize:10.5,padding:"0 2px"}}>🔒</button>
                  {activeLayer===lay.id ? (<div style={{width:5,height:5,borderRadius:"50%",background:T.accent,flexShrink:0,boxShadow:`0 0 5px ${T.accent}`}}/>) : null}
                </div>
              ))}
            </div>) : null}

            {leftPanel==="props" ? (<div>
              <PT>⚙ Paramètres</PT>
              <div style={{padding:"8px"}}>
                <div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:12,color:T.cyan,padding:"4px 8px",background:`${T.cyan}0c`,border:`1px solid ${T.cyan}28`,borderRadius:1,marginBottom:10,letterSpacing:".04em"}}>{tool.toUpperCase()}</div>
                {(tool==="wall"||tool==="offset") ? (<>
                  <Lbl>Hauteur mur (m)</Lbl><Inp type="number" value={wallH} onChange={e=>setWallH(+e.target.value)} step=".1" min=".5" max="8" style={{marginBottom:6}}/>
                  <Lbl>Épaisseur (m)</Lbl>
                  <div style={{display:"flex",gap:3,marginBottom:6}}>
                    {[[.1,"Cloison"],[.15,"Légère"],[.2,"Standard"],[.3,"Porteur"],[.4,"Ext."]].map(([v,l])=>(
                      <button key={l} title={l} onClick={()=>setWallT(v)} style={{flex:1,padding:"3px 0",background:wallT===v?"rgba(201,168,76,.18)":"transparent",border:`1px solid ${wallT===v?"#c9a84c":"rgba(201,168,76,.2)"}`,color:wallT===v?"#8a6a20":"rgba(26,18,8,.4)",fontSize:8,cursor:"pointer",borderRadius:2,fontFamily:"'Inter',sans-serif"}}>{v*100}cm</button>
                    ))}
                  </div>
                  <Inp type="number" value={wallT} onChange={e=>setWallT(+e.target.value)} step=".025" min=".05" max=".6" style={{marginBottom:6}}/>
                  <Lbl>Calque</Lbl><Sel value={wallType} onChange={e=>setWallType(e.target.value)} style={{marginBottom:6}}>{layers.slice(0,3).map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Sel>
                  {tool==="offset"&&<><Lbl>Distance offset (m)</Lbl><Inp type="number" value={offsetDist} onChange={e=>setOffsetDist(+e.target.value)} step=".05" min=".05" max="10"/></>}
                </>) : null}
                {tool==="door" ? (<>
                  <Lbl>Largeur (m)</Lbl><Inp type="number" value={doorW} onChange={e=>setDoorW(+e.target.value)} step=".05" min=".5" max="5" style={{marginBottom:6}}/>
                  <Lbl>Hauteur (m)</Lbl><Inp type="number" value={doorH} onChange={e=>setDoorH(+e.target.value)} step=".1" min="1.5" max="3.5"/>
                </>) : null}
                {tool==="window" ? (<>
                  <Lbl>Largeur (m)</Lbl><Inp type="number" value={winW} onChange={e=>setWinW(+e.target.value)} step=".1" min=".3" max="6" style={{marginBottom:6}}/>
                  <Lbl>Hauteur (m)</Lbl><Inp type="number" value={winH} onChange={e=>setWinH(+e.target.value)} step=".1" min=".2" max="3.5" style={{marginBottom:6}}/>
                  <Lbl>Allège (m)</Lbl><Inp type="number" value={winSill} onChange={e=>setWinSill(+e.target.value)} step=".05" min="0" max="2.5"/>
                </>) : null}
                {tool==="sketch" ? (<>
                  <Lbl>Style</Lbl>
                  <div style={{display:"flex",gap:3,marginBottom:7}}>
                    {[["pencil","✏"],["ink","🖊"],["chalk","🖍"]].map(([s,ic])=><button key={s} onClick={()=>setSketchStyle(s)} style={{flex:1,padding:"4px 2px",background:sketchStyle===s?`${T.gold}22`:"transparent",border:`1px solid ${sketchStyle===s?T.gold:T.border}`,color:sketchStyle===s?T.gold:T.textDim,fontSize:9.5,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>{ic} {s}</button>)}
                  </div>
                  <Lbl>Couleur</Lbl>
                  <div style={{display:"flex",gap:3,marginBottom:7,flexWrap:"wrap"}}>
                    {[["#1a1208","Graph."],["#0a1525","Bleu"],["#280808","Rouge"],["#081a08","Vert"],["#050505","Noir"]].map(([col,nm])=><div key={col} onClick={()=>setSketchColor(col)} title={nm} style={{width:21,height:21,background:col,border:`2px solid ${sketchColor===col?T.gold:"rgba(255,255,255,.1)"}`,borderRadius:2,cursor:"pointer"}}/>)}
                    <input type="color" value={sketchColor} onChange={e=>setSketchColor(e.target.value)} style={{width:21,height:21,border:`1px solid ${T.border}`,borderRadius:2,cursor:"pointer",padding:0}}/>
                  </div>
                  <Lbl>Épaisseur {sketchSize}px</Lbl>
                  <input type="range" min=".5" max="7" step=".25" value={sketchSize} onChange={e=>setSketchSize(+e.target.value)} style={{width:"100%",accentColor:T.gold,marginBottom:7}}/>
                  <Lbl>Opacité {Math.round(sketchOp*100)}%</Lbl>
                  <input type="range" min=".1" max="1" step=".05" value={sketchOp} onChange={e=>setSketchOp(+e.target.value)} style={{width:"100%",accentColor:T.gold,marginBottom:7}}/>
                  <button onClick={()=>setSketches(p=>p.slice(0,-1))} style={{width:"100%",padding:"4px",background:"rgba(200,100,50,.1)",border:"1px solid rgba(200,100,50,.25)",color:"#c87040",fontSize:9.5,cursor:"pointer",borderRadius:1,marginBottom:3,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>↩ Annuler trait</button>
                  <button onClick={()=>setSketches([])} style={{width:"100%",padding:"4px",background:`rgba(244,67,67,.1)`,border:`1px solid rgba(244,67,67,.25)`,color:T.red,fontSize:9.5,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>🗑 Effacer croquis</button>
                </>) : null}
                {tool==="text" ? (<>
                  <Lbl>Couleur</Lbl>
                  <div style={{display:"flex",gap:3,marginBottom:7,flexWrap:"wrap"}}>
                    {[T.yellow,"#ffffff","#4ec9b0","#44aaff","#f44747","#c9a84c"].map(col=><div key={col} onClick={()=>setTextColor(col)} style={{width:21,height:21,background:col,border:`2px solid ${textColor===col?T.accent:"rgba(255,255,255,.1)"}`,borderRadius:2,cursor:"pointer"}}/>)}
                    <input type="color" value={textColor} onChange={e=>setTextColor(e.target.value)} style={{width:21,height:21,border:`1px solid ${T.border}`,borderRadius:2,cursor:"pointer",padding:0}}/>
                  </div>
                  <Lbl>Taille {textSize}m</Lbl>
                  <input type="range" min=".1" max="1.5" step=".05" value={textSize} onChange={e=>setTextSize(+e.target.value)} style={{width:"100%",accentColor:T.yellow,marginBottom:7}}/>
                  <button onClick={()=>setTexts([])} style={{width:"100%",padding:"4px",background:`rgba(244,67,67,.1)`,border:`1px solid rgba(244,67,67,.25)`,color:T.red,fontSize:9.5,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>🗑 Effacer textes</button>
                </>) : null}
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:8}}>
                  <Lbl>Unité</Lbl>
                  <Sel value={unit} onChange={e=>setUnit(e.target.value)} style={{marginBottom:8}}>
                    <option value="m">Mètres</option><option value="cm">Centimètres</option><option value="ft">Pieds</option>
                  </Sel>
                </div>
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4}}>
                  <Lbl>OSNAP</Lbl>
                  {Object.entries(snapEn).map(([k,v])=>(
                    <div key={k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5,cursor:"pointer"}} onClick={()=>setSnapEn(p=>({...p,[k]:!p[k]}))}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:8,height:8,background:SNAPS[k]?.color||T.textDim,borderRadius:1}}/>
                        <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9.5,color:v?T.text:T.textDim}}>{k} — {SNAPS[k]?.label}</span>
                      </div>
                      <div style={{width:25,height:12,borderRadius:6,background:v?T.accent:"rgba(255,255,255,.07)",position:"relative",transition:"background .2s"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:v?"#fff":"rgba(255,255,255,.3)",position:"absolute",top:2,left:v?15:2,transition:"left .2s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:8,marginTop:4}}>
                  <Tog val={showDims}  set={setShowDims}  label="Cotations auto (F9)"/>
                  <Tog val={showHatch} set={setShowHatch} label="Hachures murs"/>
                  <Tog val={showRooms} set={setShowRooms} label="Noms pièces"/>
                  <Tog val={showGrid}  set={setShowGrid}  label="Grille (F7)"/>
                  <Tog val={ortho}     set={setOrtho}     label="Ortho (F8)" color="#ffaa33"/>
                </div>
              </div>
            </div>) : null}

            {leftPanel==="catalog" ? (<div style={{display:"flex",flexDirection:"column",height:"100%"}}>
              <PT>🛋 Mobilier & Accessoires</PT>
              {placingFurniture ? (<div style={{padding:"8px",background:"rgba(0,152,255,.06)",borderBottom:"1px solid #3e3e3e",flexShrink:0}}>
                <div style={{fontSize:10,color:"#0098ff",fontFamily:"'Consolas',monospace",marginBottom:4,fontWeight:600}}>En cours de placement :</div>
                <div style={{fontSize:11,color:"#1a1208"}}>{placingFurniture.label}</div>
                <div style={{fontSize:9,color:"rgba(26,18,8,.4)",marginBottom:6}}>Cliquez sur le plan · Shift = multiple · Esc = annuler</div>
                <button onClick={()=>setPlacingFurniture(null)} style={{width:"100%",padding:"4px",background:"rgba(192,64,64,.08)",border:"1px solid rgba(192,64,64,.2)",color:"#c04040",fontSize:9.5,cursor:"pointer",borderRadius:3,fontFamily:"'Inter',sans-serif"}}>✕ Annuler placement</button>
              </div>) : null}
              {selFurniture ? (<div style={{padding:"8px",background:"rgba(201,168,76,.06)",borderBottom:"1px solid rgba(201,168,76,.15)",flexShrink:0}}>
                <div style={{fontSize:10,color:"#8a6a20",fontFamily:"'Inter',sans-serif",marginBottom:4,fontWeight:600}}>Sélectionné :</div>
                <div style={{fontSize:11,color:"#1a1208",marginBottom:6}}>{selFurniture.label}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  <div><div style={{fontSize:8,color:"rgba(26,18,8,.4)"}}>Largeur</div><input type="number" value={selFurniture.w} onChange={e=>setFurniture(p=>p.map(f=>f.id===selFurniture.id?{...f,w:+e.target.value}:f))} step=".05" min=".1" style={{width:"100%",background:"rgba(255,255,255,.6)",border:"1px solid rgba(201,168,76,.25)",padding:"3px 6px",fontSize:10,borderRadius:3,outline:"none"}}/></div>
                  <div><div style={{fontSize:8,color:"rgba(26,18,8,.4)"}}>Hauteur</div><input type="number" value={selFurniture.h} onChange={e=>setFurniture(p=>p.map(f=>f.id===selFurniture.id?{...f,h:+e.target.value}:f))} step=".05" min=".1" style={{width:"100%",background:"rgba(255,255,255,.6)",border:"1px solid rgba(201,168,76,.25)",padding:"3px 6px",fontSize:10,borderRadius:3,outline:"none"}}/></div>
                </div>
                <div style={{marginTop:4}}><div style={{fontSize:8,color:"rgba(26,18,8,.4)"}}>Rotation (°)</div><input type="range" min="0" max="360" value={selFurniture.rot||0} onChange={e=>setFurniture(p=>p.map(f=>f.id===selFurniture.id?{...f,rot:+e.target.value}:f))} style={{width:"100%",accentColor:"#c9a84c"}}/></div>
                <button onClick={()=>{setFurniture(p=>p.filter(f=>f.id!==selFurniture.id));setSelFurniture(null);}} style={{width:"100%",marginTop:6,padding:"4px",background:"rgba(192,64,64,.08)",border:"1px solid rgba(192,64,64,.2)",color:"#c04040",fontSize:9.5,cursor:"pointer",borderRadius:3,fontFamily:"'Inter',sans-serif"}}>🗑 Supprimer</button>
              </div>) : null}
              {/* Category tabs */}
              <div style={{display:"flex",flexWrap:"wrap",gap:2,padding:"6px",borderBottom:"1px solid rgba(201,168,76,.15)",flexShrink:0}}>
                {FURNITURE_CATALOG.map((cat,i)=>(
                  <button key={i} onClick={()=>setFurnitureCat(i)} style={{padding:"3px 7px",background:furnitureCat===i?"rgba(201,168,76,.15)":"transparent",border:`1px solid ${furnitureCat===i?"#c9a84c":"rgba(201,168,76,.18)"}`,borderRadius:100,fontSize:9,color:furnitureCat===i?"#8a6a20":"rgba(26,18,8,.4)",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:furnitureCat===i?600:400,transition:"all .15s"}}>{cat.cat}</button>
                ))}
              </div>
              {/* Items grid */}
              <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                  {FURNITURE_CATALOG[furnitureCat]?.items.map((item,i)=>{
                    const isPlacing=placingFurniture?.type===item.type&&placingFurniture?.label===item.label;
                    return(
                      <button key={i}
                        onMouseEnter={()=>setFurniturePreview(item)}
                        onMouseLeave={()=>setFurniturePreview(null)}
                        onClick={()=>setPlacingFurniture(isPlacing?null:{...item})}
                        style={{padding:"8px 6px",background:isPlacing?"rgba(201,168,76,.15)":"rgba(255,255,255,.5)",border:`1px solid ${isPlacing?"#c9a84c":"rgba(201,168,76,.15)"}`,borderRadius:6,cursor:"pointer",textAlign:"center",transition:"all .2s",fontFamily:"'Inter',sans-serif"}}>
                        {/* Mini preview */}
                        <div style={{width:"100%",height:40,background:"rgba(201,168,76,.06)",borderRadius:4,marginBottom:5,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                          <div style={{width:Math.min(36,item.w*12),height:Math.min(28,item.h*12),background:item.color,borderRadius:2,border:"1px solid rgba(26,18,8,.15)",opacity:.8}}/>
                        </div>
                        <div style={{fontSize:9.5,color:isPlacing?"#8a6a20":"rgba(26,18,8,.6)",fontWeight:isPlacing?600:400,lineHeight:1.3}}>{item.label}</div>
                        <div style={{fontSize:8,color:"rgba(26,18,8,.3)",marginTop:2}}>{item.w}×{item.h}m</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Preview popup */}
              {furniturePreview ? (<div style={{position:"fixed",left:"212px",top:"auto",zIndex:300,background:"#fff",border:"1px solid rgba(201,168,76,.3)",borderRadius:12,padding:"16px",width:200,boxShadow:"0 16px 48px rgba(26,18,8,.15)",pointerEvents:"none"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#1a1208",marginBottom:4}}>{furniturePreview.label}</div>
                <div style={{fontSize:10,color:"rgba(26,18,8,.4)",marginBottom:12,fontFamily:"'Inter',sans-serif"}}>{furniturePreview.w}m × {furniturePreview.h}m</div>
                {/* Preview box */}
                <div style={{width:"100%",height:110,background:"rgba(201,168,76,.04)",border:"1px solid rgba(201,168,76,.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10,position:"relative",overflow:"hidden"}}>
                  {/* Grid background */}
                  <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(201,168,76,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.1) 1px,transparent 1px)",backgroundSize:"12px 12px"}}/>
                  <div style={{position:"relative",width:Math.min(150,furniturePreview.w*35),height:Math.min(90,furniturePreview.h*35),background:furniturePreview.color,borderRadius:4,border:"1px solid rgba(26,18,8,.15)",boxShadow:"0 4px 12px rgba(26,18,8,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:10,fontFamily:"'Inter',sans-serif",color:"rgba(26,18,8,.6)",fontWeight:600,textAlign:"center",padding:"2px"}}>{furniturePreview.label}</span>
                  </div>
                </div>
                <div style={{padding:"8px",background:"rgba(201,168,76,.06)",borderRadius:6}}>
                  <div style={{fontSize:10,color:"rgba(26,18,8,.6)",fontFamily:"'Inter',sans-serif",lineHeight:1.7}}>
                    <div>📐 <strong>{furniturePreview.w}m</strong> × <strong>{furniturePreview.h}m</strong></div>
                    <div>🖱 Cliquez pour placer</div>
                    <div>⇧ Shift = plusieurs fois</div>
                  </div>
                </div>
              </div>) : null}
              {furniture.length>0 ? (<div style={{padding:"6px",borderTop:"1px solid rgba(201,168,76,.15)",flexShrink:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:9,color:"rgba(26,18,8,.4)",fontFamily:"'Inter',sans-serif"}}>{furniture.length} meuble(s) sur le plan</span>
                  <button onClick={()=>{setFurniture([]);setSelFurniture(null);log("Mobilier effacé");}} style={{padding:"2px 8px",background:"transparent",border:"1px solid rgba(192,64,64,.2)",color:"#c04040",fontSize:8.5,cursor:"pointer",borderRadius:3,fontFamily:"'Inter',sans-serif"}}>Effacer tout</button>
                </div>
              </div>) : null}
            </div>) : null}
          </div>
        </div>) : null}

        {/* VIEWPORT */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
          <div style={{height:24,background:"#2d2d2d",display:"flex",alignItems:"center",borderBottom:"1px solid #3e3e3e",flexShrink:0,padding:"0 5px"}}>
            {["Modèle","Plan A3","Présentation"].map((t,i)=>(
              <button key={t} style={{padding:"2px 13px",background:i===0?"rgba(255,255,255,.05)":"transparent",border:"none",borderRight:"1px solid #3e3e3e",color:i===0?"#ffffff":"#6c6c6c",fontSize:9.5,cursor:"pointer",height:"100%",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>{t}</button>
            ))}
            <div style={{marginLeft:"auto",display:"flex",gap:2,padding:"0 5px"}}>
              {[["2d","2D"],["3d","3D"],["split","Split"]].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)} style={{padding:"1px 9px",background:view===v?"rgba(0,152,255,.18)":"transparent",border:`1px solid ${view===v?"#0098ff":"rgba(255,255,255,.08)"}`,color:view===v?"#0098ff":"#6c6c6c",fontSize:8.5,cursor:"pointer",borderRadius:2,transition:"all .15s",fontFamily:"'Consolas',monospace",fontWeight:view===v?600:400}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{flex:1,display:"flex",overflow:"hidden"}}>
            {(view==="2d"||view==="split") ? (
              <div style={{flex:1,overflow:"hidden",background:"#faf8f5",position:"relative"}}>
                <canvas ref={cvRef} width={1700} height={1100}
                  style={{cursor:isPanning.current?"grabbing":tool==="sketch"?"crosshair":tool==="text"?"text":tool==="overlay"?dragOv?"grabbing":"move":tool==="erase"?"cell":tool==="select"?"default":"crosshair",display:"block",width:"100%",height:"100%"}}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onContextMenu={onCtx}/>
                {/* Label info */}
                <div style={{position:"absolute",top:6,left:8,fontSize:8.5,color:"rgba(255,255,255,.25)",pointerEvents:"none",letterSpacing:".1em",textTransform:"uppercase",fontFamily:"'Consolas',monospace"}}>PLAN 2D · ÉTAGE {floor} · TOP</div>
                {/* Minimap */}
                {walls.length>0 ? (<div style={{position:"absolute",bottom:38,right:12,width:110,height:80,background:"rgba(30,30,36,.95)",border:"1px solid #3e3e3e",borderRadius:4,overflow:"hidden",pointerEvents:"none",boxShadow:"0 4px 16px rgba(26,18,8,.1)"}}>
                  <div style={{fontSize:7,color:"#6c6c6c",padding:"2px 5px",borderBottom:"1px solid #3e3e3e",fontFamily:"'Consolas',monospace",letterSpacing:".1em",textTransform:"uppercase"}}>Minimap</div>
                  <svg style={{width:"100%",height:68,display:"block"}} viewBox={`${Math.min(...walls.map(w=>Math.min(w.s.x,w.e.x)))-1} ${Math.min(...walls.map(w=>Math.min(w.s.y,w.e.y)))-1} ${Math.max(...walls.map(w=>Math.max(w.s.x,w.e.x)))-Math.min(...walls.map(w=>Math.min(w.s.x,w.e.x)))+2} ${Math.max(...walls.map(w=>Math.max(w.s.y,w.e.y)))-Math.min(...walls.map(w=>Math.min(w.s.y,w.e.y)))+2}`} preserveAspectRatio="xMidYMid meet">
                    {walls.map((w,i)=><line key={i} x1={w.s.x} y1={w.s.y} x2={w.e.x} y2={w.e.y} stroke="#c9a84c" strokeWidth=".2" strokeLinecap="round"/>)}
                  </svg>
                </div>) : null}
                {/* Empty state */}
                {walls.length===0&&!drawing ? (<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                  <div style={{background:"#252526",border:"1px solid #3e3e3e",borderRadius:4,padding:"36px 44px",maxWidth:460,boxShadow:"0 40px 100px rgba(0,0,0,.8)",textAlign:"center"}}>
                    <div style={{width:60,height:60,background:"#0098ff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",boxShadow:"0 8px 24px rgba(0,152,255,.4)"}}>
                      <span style={{fontFamily:"'Consolas',monospace",fontSize:18,color:"#fff",fontWeight:700}}>A</span>
                    </div>
                    <div style={{fontFamily:"'Segoe UI',sans-serif",fontSize:18,fontWeight:600,color:"#ffffff",marginBottom:4}}>AYBO INC — Atelier</div>
                    <div style={{fontSize:10,color:"#6c6c6c",letterSpacing:".1em",textTransform:"uppercase",marginBottom:24}}>CAD Pro v4.0 · Commencez à dessiner</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:24,textAlign:"left"}}>
                      {[["W","Dessiner un mur"],["D","Placer une porte"],["F","Fenêtre"],["T","Ajouter du texte"],["S","Sélectionner"],["E","Effacer"],["3","Vue 3D"],["Ctrl+Z","Annuler"]].map(([k,v])=>(
                        <div key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(255,255,255,.03)",border:"1px solid #3e3e3e",borderRadius:3,pointerEvents:"none"}}>
                          <span style={{fontFamily:"'Consolas',monospace",fontSize:10,fontWeight:700,color:"#0098ff",background:"rgba(0,152,255,.12)",padding:"2px 7px",borderRadius:2,flexShrink:0}}>{k}</span>
                          <span style={{fontSize:11,color:"#999"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{borderTop:"1px solid rgba(201,168,76,.1)",paddingTop:20}}>
                      <div style={{fontSize:9,color:"#6c6c6c",letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}>Partir d'un modèle</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center"}}>
                        {Object.entries(TPL).map(([k,v])=>(
                          <button key={k} onClick={()=>{setTemplate(k);setWalls(v.walls);setDoors([]);setWins([]);setTexts([]);setManualDims([]);log(`✓ Modèle "${v.name}" chargé`);}} style={{padding:"6px 14px",background:"transparent",border:"1px solid #525252",borderRadius:2,cursor:"pointer",fontFamily:"'Consolas',monospace",fontSize:10.5,color:"#cccccc",pointerEvents:"all",transition:"all .15s"}}
                            onMouseOver={e=>{e.currentTarget.style.background="rgba(0,152,255,.12)";e.currentTarget.style.borderColor="#0098ff";}}
                            onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="#525252";}}>
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>) : null}
                {/* Tool hints */}
                {tool==="sketch"&&walls.length>0 ? (<div style={{position:"absolute",bottom:12,left:14,background:"rgba(250,248,245,.96)",border:"1px solid rgba(201,168,76,.3)",padding:"6px 12px",fontSize:9.5,color:"#8a6a20",borderRadius:2,pointerEvents:"none",fontFamily:"'Inter',sans-serif"}}>✏️ Croquis · {sketchStyle} · Glissez pour dessiner · Esc pour quitter</div>) : null}
                {tool==="text" ? (<div style={{position:"absolute",bottom:12,left:14,background:"rgba(250,248,245,.96)",border:"1px solid rgba(201,168,76,.3)",padding:"6px 12px",fontSize:9.5,color:"#8a6a20",borderRadius:2,pointerEvents:"none",fontFamily:"'Inter',sans-serif"}}>T Texte · Cliquez pour placer · Esc pour quitter</div>) : null}
                {dimMode ? (<div style={{position:"absolute",bottom:12,left:14,background:"rgba(250,248,245,.96)",border:"1px solid rgba(180,100,130,.35)",padding:"6px 12px",fontSize:9.5,color:"#ff88ff",borderRadius:2,pointerEvents:"none",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>📐 Cotation manuelle · {dimPts.length===0?"Cliquez le 1er point":"Cliquez le 2ème point"} · Esc pour quitter</div>) : null}
                {measuring ? (<div style={{position:"absolute",bottom:12,left:14,background:"rgba(250,248,245,.96)",border:"1px solid rgba(180,100,130,.35)",padding:"6px 12px",fontSize:9.5,color:T.pink,borderRadius:2,pointerEvents:"none",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>📏 Mesure · Cliquez 2 points · Esc pour quitter</div>) : null}
                {/* Restore prompt */}
                {showRestorePrompt ? (<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(250,248,245,.85)",backdropFilter:"blur(8px)",zIndex:50}}>
                  <div style={{background:"#252526",border:"1px solid #3e3e3e",borderRadius:4,padding:"32px 36px",maxWidth:420,textAlign:"center",boxShadow:"0 32px 80px rgba(0,0,0,.8)"}}>
                    <div style={{fontSize:32,marginBottom:16}}>📂</div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:600,color:"#ffffff",marginBottom:8}}>Projet sauvegardé trouvé</div>
                    <div style={{fontSize:13,color:"rgba(26,18,8,.5)",lineHeight:1.7,marginBottom:8}}><strong style={{color:"#c9a84c"}}>"{restoreData?.projectName||"Dessin1"}"</strong></div>
                    <div style={{fontSize:12,color:"rgba(26,18,8,.4)",marginBottom:28}}>{restoreData?.walls?.length||0} murs · {restoreData?.doors?.length||0} portes · sauvegardé le {restoreData?.savedAt?new Date(restoreData.savedAt).toLocaleDateString("fr-FR"):"-"}</div>
                    <div style={{display:"flex",gap:12,justifyContent:"center"}}>
                      <button onClick={()=>{
                        setWalls(restoreData.walls||[]);setDoors(restoreData.doors||[]);setWins(restoreData.wins||[]);
                        setTexts(restoreData.texts||[]);setManualDims(restoreData.manualDims||[]);setSketches(restoreData.sketches||[]);
                        setRoomNames(restoreData.roomNames||{});if(restoreData.projectName)setProjectName(restoreData.projectName);
                        setShowRestorePrompt(false);log(`✓ Projet "${restoreData.projectName||"Dessin1"}" restauré`);
                      }} style={{padding:"12px 28px",background:"linear-gradient(135deg,#c9a84c,#a07828)",border:"none",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:4,fontFamily:"'Inter',sans-serif"}}>
                        Reprendre le projet
                      </button>
                      <button onClick={()=>{setShowRestorePrompt(false);log("✓ Atelier vide — prêt à dessiner");}} style={{padding:"12px 28px",background:"transparent",border:"1.5px solid rgba(26,18,8,.2)",color:"rgba(26,18,8,.6)",fontSize:13,cursor:"pointer",borderRadius:4,fontFamily:"'Inter',sans-serif",transition:"all .2s"}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor="#c9a84c";e.currentTarget.style.color="#c9a84c";}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(26,18,8,.2)";e.currentTarget.style.color="rgba(26,18,8,.6)";}}>
                        Commencer à zéro
                      </button>
                    </div>
                  </div>
                </div>) : null}
                {/* Text input modal */}
                {textInput ? (<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.5)"}}>
                  <div style={{background:"#252526",border:"1px solid #3e3e3e",borderRadius:4,padding:"24px 28px",minWidth:340,boxShadow:"0 24px 60px rgba(0,0,0,.8)"}}>
                    <div style={{fontFamily:"'Segoe UI',sans-serif",fontSize:14,color:"#ffffff",marginBottom:14,fontWeight:600}}>Placer un texte</div>
                    <input autoFocus value={pendingText} onChange={e=>setPendingText(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&pendingText.trim()){push(walls,doors,wins,[...texts,{id:Date.now(),x:textInput.x,y:textInput.y,text:pendingText.trim(),size:textSize,color:textColor}],manualDims);setTextInput(null);setPendingText("");log(`Texte ajouté: "${pendingText.trim()}"`);}
                        if(e.key==="Escape"){setTextInput(null);setPendingText("");}
                      }}
                      placeholder="Entrez le texte..."
                      style={{width:"100%",background:"rgba(0,0,0,.4)",border:`1px solid ${T.border2}`,color:T.textBri,padding:"8px 12px",fontSize:13,fontFamily:"'Segoe UI',sans-serif",outline:"none",borderRadius:2,marginBottom:12,boxSizing:"border-box"}}/>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{if(pendingText.trim()){push(walls,doors,wins,[...texts,{id:Date.now(),x:textInput.x,y:textInput.y,text:pendingText.trim(),size:textSize,color:textColor}],manualDims);setTextInput(null);setPendingText("");log(`Texte: "${pendingText.trim()}"`);}}} style={{flex:1,padding:"8px",background:T.accent,border:"none",color:"#fff",fontSize:11,cursor:"pointer",borderRadius:2,fontFamily:"'JetBrains Mono','Consolas',monospace",fontWeight:600}}>✓ Placer (Enter)</button>
                      <button onClick={()=>{setTextInput(null);setPendingText("");}} style={{padding:"8px 16px",background:"transparent",border:`1px solid ${T.border2}`,color:T.textDim,fontSize:11,cursor:"pointer",borderRadius:2,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Esc</button>
                    </div>
                  </div>
                </div>) : null}
              </div>
            ) : null}
            {(view==="3d"||view==="split") ? (
              <div style={{flex:1,position:"relative"}}>
                <div ref={mountRef} style={{width:"100%",height:"100%"}}/>
                <div style={{position:"absolute",top:6,left:8,fontFamily:"'Consolas',monospace",fontSize:8.5,color:"rgba(255,255,255,.25)",pointerEvents:"none",letterSpacing:".1em"}}>PERSPECTIVE 3D · ACESFILMIC</div>
                {!fps ? (<div style={{position:"absolute",bottom:14,left:14,background:"rgba(20,20,28,.94)",border:"1px solid rgba(0,152,255,.2)",padding:"12px 16px",pointerEvents:"none",borderRadius:3,backdropFilter:"blur(12px)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:T.accent,boxShadow:`0 0 8px ${T.accent}`}}/>
                    <span style={{color:"#8a6a20",fontWeight:700,letterSpacing:".06em",fontSize:10,fontFamily:"'Playfair Display',serif",textTransform:"uppercase",fontStyle:"italic"}}>Mode FPS</span>
                  </div>
                  {[["Clic","Activer caméra"],["WASD","Se déplacer"],["Souris","Regarder"],["Shift","Courir (7.5m/s)"],["ESC","Quitter"]].map(([k,v])=>(
                    <div key={k} style={{marginBottom:5,fontSize:9.5,display:"flex",gap:10,alignItems:"center",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>
                      <span style={{color:T.yellow,background:"rgba(220,220,170,.08)",padding:"1px 6px",borderRadius:2,flexShrink:0,fontSize:9}}>{k}</span>
                      <span style={{color:T.textDim}}>{v}</span>
                    </div>
                  ))}
                </div>) : null}
              </div>
            ) : null}
          </div>
          {/* Command line */}
          <div style={{height:isMobileView?0:showCmd?88:28,background:"rgba(30,30,30,.99)",display:isMobileView?"none":"flex",flexDirection:"column",borderTop:`1px solid ${T.border}`,flexShrink:0,transition:"height .2s"}}>
            {showCmd ? (<div style={{flex:1,overflowY:"auto",padding:"3px 11px"}}>
              {[...cmdLog].reverse().map((h,i)=>(
                <div key={i} style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9.5,color:h.startsWith("›")?T.yellow:h.startsWith("✓")?T.green:h.startsWith("Modèle")||h.startsWith("Import")||h.startsWith("Projet")?"#9cdcfe":"#6c6c6c",marginBottom:1,lineHeight:1.4}}>{h}</div>
              ))}
            </div>) : null}
            <div style={{display:"flex",alignItems:"center",borderTop:showCmd?"1px solid #3e3e3e":"none",flexShrink:0,background:"#1e1e1e"}}>
              <span style={{padding:"4px 11px",fontFamily:"'Consolas',monospace",fontSize:12,color:"#0098ff",flexShrink:0}}>›</span>
              <input className="cmd-input" value={cmdInput} onChange={e=>setCmdInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){runCmd(cmdInput);}if(e.key==="Escape")setCmdInput("");}}
                placeholder="Commande (W=Mur D=Porte F=Fen. T=Texte S=Sel. E=Eff. MIRROR QM SCALE ZA 2D 3D NEW...)"
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#ffffff",fontFamily:"'Consolas',monospace",fontSize:11,padding:"4px 3px"}}/>
              <button onClick={()=>setShowCmd(p=>!p)} style={{padding:"0 10px",background:"none",border:"none",borderLeft:`1px solid ${T.border}`,color:T.textDim,cursor:"pointer",fontSize:10,height:"100%"}}>{showCmd?"▾":"▴"}</button>
              <button onClick={()=>runCmd(cmdInput)} style={{padding:"4px 13px",background:"#0098ff",border:"none",borderLeft:"none",color:"#fff",cursor:"pointer",fontSize:9.5,fontFamily:"'Consolas',monospace",fontWeight:600}}>↵</button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        {(showRight&&!isMobileView) ? (
          <div style={{width:220,background:"#252526",borderLeft:"1px solid #3e3e3e",display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{display:"flex",background:"#ede9e0",borderBottom:"1px solid rgba(201,168,76,.2)",flexShrink:0}}>
              {[["properties","Propriétés"],["materials","Matériaux"],["overlay","Overlay"]].map(([t,l])=>(
                <button key={t} onClick={()=>setRightPanel(t)} style={{flex:1,padding:"5px 0",background:rightPanel===t?"rgba(201,168,76,.1)":"transparent",border:"none",borderBottom:rightPanel===t?"2px solid #c9a84c":"2px solid transparent",color:rightPanel===t?"#ffffff":"#6c6c6c",fontSize:8.5,cursor:"pointer",fontFamily:"'Consolas',monospace",transition:"all .15s",fontWeight:rightPanel===t?600:400}}>{l}</button>
              ))}
              <button onClick={()=>setShowRight(false)} style={{padding:"0 8px",background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:14,flexShrink:0}}>×</button>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>

              {rightPanel==="properties" ? (
                <div>
                  <PT>📋 Propriétés</PT>
                  <div style={{padding:"8px"}}>
                    {selWalls.length>0 ? (
                      <div>
                        <div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:10.5,color:T.accent,marginBottom:8,padding:"3px 7px",background:`${T.accent}0e`,borderRadius:1}}>
                          {selWalls.length>1?`${selWalls.length} murs`:"Mur sélectionné"}
                        </div>
                        {selWalls.length===1&&(()=>{const w=selWalls[0];return(
                          <div>
                            {[["Longueur",`${wLen(w).toFixed(4)} m`],["En cm",`${(wLen(w)*100).toFixed(1)} cm`],["Angle",`${(wAng(w)*180/Math.PI).toFixed(2)}°`],["Surface mur",`${(wLen(w)*wallH).toFixed(2)} m²`],["Calque",w.layerId||"walls"],["Sx",w.s.x.toFixed(3)],["Sy",w.s.y.toFixed(3)],["Ex",w.e.x.toFixed(3)],["Ey",w.e.y.toFixed(3)]].map(([l,v])=>(
                              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.border}`,fontSize:9.5}}>
                                <span style={{color:"#6c6c6c",fontFamily:"'Consolas',monospace"}}>{l}</span>
                                <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",color:T.yellow,fontSize:9}}>{v}</span>
                              </div>
                            ))}
                            <button onClick={()=>{const si=new Set(selected.map(s=>s.idx));push(walls.filter((_,i)=>!si.has(i)),doors.filter(d=>!si.has(d.wallIdx)),wins.filter(w=>!si.has(w.wallIdx)),texts,manualDims);setSelected([]);}} style={{width:"100%",padding:"4px",background:"rgba(244,67,67,.1)",border:"1px solid rgba(244,67,67,.25)",color:T.red,fontSize:9.5,cursor:"pointer",borderRadius:1,marginTop:7,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>🗑 Supprimer</button>
                          </div>
                        );})()}
                        {selWalls.length>1 ? (<div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:11.5,color:T.yellow,padding:"4px 0"}}>Total: {selWalls.reduce((a,w)=>a+wLen(w),0).toFixed(2)} m</div>) : null}
                      </div>
                    ) : (
                      <div style={{color:T.textDim,fontSize:9.5,textAlign:"center",padding:"10px 0",lineHeight:1.75,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Aucune sélection<br/>[S] → cliquer un élément<br/>ou glisser pour sélectionner</div>
                    )}
                    {measurePts.length===2 ? (
                      <div style={{marginTop:10,padding:"8px",background:"rgba(255,136,255,.06)",border:"1px solid rgba(255,136,255,.2)",borderRadius:2,textAlign:"center"}}>
                        <div style={{color:T.pink,fontSize:9.5,marginBottom:3,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>📏 Mesure</div>
                        <div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:16,color:T.pink,fontWeight:700}}>{Math.hypot(measurePts[1].x-measurePts[0].x,measurePts[1].y-measurePts[0].y).toFixed(4)} m</div>
                        <div style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9.5,color:"rgba(255,136,255,.55)"}}>{(Math.hypot(measurePts[1].x-measurePts[0].x,measurePts[1].y-measurePts[0].y)*100).toFixed(2)} cm</div>
                      </div>
                    ) : null}
                    {/* Surface table */}
                    {rooms.length>0 ? (
                      <div style={{marginTop:10}}>
                        <div style={{fontSize:8.5,color:T.textDim,textTransform:"uppercase",letterSpacing:".1em",marginBottom:5,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Tableau surfaces</div>
                        {rooms.map((r,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",borderBottom:`1px solid ${T.border}`,fontSize:9.5}}>
                            <input value={roomNames[i]||ROOM_NAMES[i%ROOM_NAMES.length]} onChange={e=>setRoomNames(p=>({...p,[i]:e.target.value}))} style={{background:"transparent",border:"none",outline:"none",color:T.text,fontSize:9.5,flex:1,fontFamily:"'Segoe UI',sans-serif"}}/>
                            <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",color:T.cyan,flexShrink:0,fontSize:9}}>{r.area.toFixed(2)}m²</span>
                          </div>
                        ))}
                        <div style={{textAlign:"right",fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:11,color:T.accent,marginTop:3,fontWeight:700}}>{totalArea.toFixed(2)} m² total</div>
                        <div style={{textAlign:"right",fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:9,color:T.textDim}}>{(totalArea*wallH).toFixed(1)} m³ volume</div>
                      </div>
                    ) : null}
                    {/* Stats */}
                    <div style={{marginTop:10,borderTop:`1px solid ${T.border}`,paddingTop:8}}>
                      <div style={{fontSize:8.5,color:T.textDim,textTransform:"uppercase",letterSpacing:".1em",marginBottom:5,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Statistiques</div>
                      {[["Murs",`${walls.length} (${walls.reduce((a,w)=>a+wLen(w),0).toFixed(1)}m)`],["Portes",doors.length],["Fenêtres",wins.length],["Textes",texts.length],["Cotations",manualDims.length],["Croquis",sketches.length],["Pièces",rooms.length],totalArea>0&&["Surface",`${totalArea.toFixed(2)} m²`],totalArea>0&&["Volume",`${(totalArea*wallH).toFixed(1)} m³`]].filter(Boolean).map(([l,v])=>(
                        <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${T.border}`,fontSize:9.5}}>
                          <span style={{color:"#6c6c6c",fontFamily:"'Consolas',monospace"}}>{l}</span>
                          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",color:T.yellow,fontSize:9}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {rightPanel==="materials" ? (
                <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
                  <PT accent>🪨 Matériaux</PT>
                  {/* Current selection preview */}
                  <div style={{padding:"8px",borderBottom:"1px solid rgba(201,168,76,.15)",flexShrink:0}}>
                    <div style={{display:"flex",gap:6,marginBottom:8}}>
                      {[[floorM,"Sol 🪵"],[wallM,"Mur 🧱"],[ceilM,"Plafond"]].map(([m,l])=>(
                        <div key={l} style={{flex:1,textAlign:"center",cursor:"pointer"}} onClick={()=>setMatCat(l.includes("Sol")?"floor":l.includes("Mur")?"wall":"ceiling")}>
                          <div style={{width:"100%",height:28,background:m.hex,borderRadius:4,marginBottom:3,border:`2px solid ${(matCat==="floor"&&l.includes("Sol"))||(matCat==="wall"&&l.includes("Mur"))||(matCat==="ceiling"&&!l.includes("Sol")&&!l.includes("Mur"))?"#c9a84c":"rgba(201,168,76,.2)"}`}}/>
                          <div style={{fontSize:8,color:"rgba(26,18,8,.5)",fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>{l}</div>
                          <div style={{fontSize:7.5,color:"rgba(26,18,8,.35)",fontFamily:"'Inter',sans-serif"}}>{m.label.slice(0,10)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      {[["floor","🪵 Sol"],["wall","🧱 Mur"],["ceiling","🏛 Plafond"]].map(([cat,l])=>(
                        <button key={cat} onClick={()=>setMatCat(cat)} style={{flex:1,padding:"5px 2px",background:matCat===cat?"rgba(0,152,255,.15)":"transparent",border:`1px solid ${matCat===cat?"#0098ff":"#525252"}`,color:matCat===cat?"#0098ff":"#6c6c6c",fontSize:9,cursor:"pointer",borderRadius:4,fontFamily:"'Inter',sans-serif",fontWeight:matCat===cat?600:400,transition:"all .15s"}}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {/* Tag filter */}
                  {(()=>{
                    const tags=[...new Set(MATS[matCat].map(m=>m.tag).filter(Boolean))];
                    const[activeTag,setActiveTag]=[matTag,setMatTag];
                    return(<div style={{padding:"5px 6px",borderBottom:"1px solid rgba(201,168,76,.1)",flexShrink:0,display:"flex",flexWrap:"wrap",gap:3}}>
                      <button onClick={()=>setMatTag("")} style={{padding:"2px 8px",background:!activeTag?"rgba(201,168,76,.15)":"transparent",border:`1px solid ${!activeTag?"#c9a84c":"rgba(201,168,76,.15)"}`,borderRadius:100,fontSize:8.5,color:!activeTag?"#8a6a20":"rgba(26,18,8,.4)",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Tous</button>
                      {tags.map(t=><button key={t} onClick={()=>setMatTag(t===activeTag?"":t)} style={{padding:"2px 8px",background:activeTag===t?"rgba(201,168,76,.15)":"transparent",border:`1px solid ${activeTag===t?"#c9a84c":"rgba(201,168,76,.15)"}`,borderRadius:100,fontSize:8.5,color:activeTag===t?"#8a6a20":"rgba(26,18,8,.4)",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{t}</button>)}
                    </div>);
                  })()}
                  {/* Materials grid */}
                  <div style={{flex:1,overflowY:"auto",padding:"6px"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                      {MATS[matCat].filter(m=>!matTag||m.tag===matTag).map(mat=>{
                        const cur=matCat==="floor"?floorM:matCat==="wall"?wallM:ceilM;
                        const setM=matCat==="floor"?setFloorM:matCat==="wall"?setWallM:setCeilM;
                        const isSel=cur.id===mat.id;
                        return(
                          <button key={mat.id} onClick={()=>setM(mat)}
                            style={{display:"flex",flexDirection:"column",padding:"8px 7px",border:`1.5px solid ${isSel?"#0098ff":"rgba(255,255,255,.08)"}`,background:isSel?"rgba(0,152,255,.12)":"rgba(255,255,255,.04)",cursor:"pointer",borderRadius:6,textAlign:"left",transition:"all .2s"}}>
                            <div style={{display:"flex",alignItems:"center",gap:1,marginBottom:6}}>
                              <div style={{flex:1,height:32,background:mat.hex,borderRadius:4,border:"1px solid rgba(26,18,8,.1)"}}/>
                              {/* Texture simulation */}
                              <div style={{width:16,height:32,borderRadius:"0 4px 4px 0",background:`repeating-linear-gradient(${mat.tag==="Bois"?"90deg":mat.tag==="Carrelage"?"0deg":"45deg"},${mat.hex},${mat.hex} 3px,rgba(0,0,0,.08) 3px,rgba(0,0,0,.08) 6px)`,borderLeft:"none",border:"1px solid rgba(26,18,8,.1)"}}/>
                            </div>
                            <div style={{fontSize:10,color:isSel?"#0098ff":"#cccccc",fontWeight:isSel?700:400,lineHeight:1.2,fontFamily:"'Consolas',monospace"}}>{mat.label}</div>
                            {mat.tag&&<div style={{fontSize:7.5,color:"rgba(26,18,8,.3)",marginTop:2,fontFamily:"'Inter',sans-serif"}}>{mat.tag}{mat.r>.7?" · Mat":mat.r<.2?" · Brillant":""}{mat.m>.3?" · Métal":""}</div>}
                            {isSel&&<div style={{marginTop:3,fontSize:8,color:"#c9a84c",fontWeight:700}}>✓ Appliqué</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 3D settings */}
                  <div style={{borderTop:"1px solid rgba(201,168,76,.15)",padding:"8px",flexShrink:0}}>
                    <div style={{fontSize:8.5,color:"rgba(26,18,8,.4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6,fontFamily:"'Inter',sans-serif"}}>Paramètres 3D</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      <div><Lbl>Hauteur (m)</Lbl><Inp type="number" value={wallH} onChange={e=>setWallH(+e.target.value)} step=".1" min="1" max="8"/></div>
                      <div><Lbl>Épaisseur (m)</Lbl><Inp type="number" value={wallT} onChange={e=>setWallT(+e.target.value)} step=".025" min=".05" max=".6"/></div>
                    </div>
                  </div>
                </div>
              ) : null}

              {rightPanel==="overlay" ? (
                <div>
                  <PT>📎 Overlay / Xref</PT>
                  <div style={{padding:"8px"}}>
                    <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"6px",background:`${T.green}0e`,border:`1px solid ${T.green}38`,color:T.green,cursor:"pointer",fontSize:9.5,marginBottom:8,borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>+ Importer image PNG/JPG</button>
                    <div style={{fontSize:8.5,color:T.textDim,marginBottom:8,lineHeight:1.7,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Plan de référence transparent. Ajustez opacité et échelle, tracez par-dessus.</div>
                    {overlays.length===0 ? (<div style={{color:T.textDim,fontSize:9.5,textAlign:"center",padding:"8px 0",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Aucune image importée</div>) : null}
                    {overlays.map(ov=>(
                      <div key={ov.id} style={{border:`1px solid ${selOv===ov.id?T.accent:T.border}`,background:selOv===ov.id?`${T.accent}0a`:T.bg3,padding:"7px",marginBottom:4,borderRadius:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8.5,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{ov.name}</span>
                          <div style={{display:"flex",gap:2}}>
                            <button onClick={()=>setOverlays(p=>p.map(o=>o.id===ov.id?{...o,visible:!o.visible}:o))} style={{background:"none",border:"none",color:ov.visible?T.yellow:T.textDim,cursor:"pointer",fontSize:10.5}}>👁</button>
                            <button onClick={()=>setOverlays(p=>p.map(o=>o.id===ov.id?{...o,locked:!o.locked}:o))} style={{background:"none",border:"none",color:ov.locked?T.red:T.textDim,cursor:"pointer",fontSize:10.5}}>🔒</button>
                            <button onClick={()=>{setOverlays(p=>p.filter(o=>o.id!==ov.id));if(selOv===ov.id)setSelOv(null);}} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:10.5}}>×</button>
                          </div>
                        </div>
                        <div style={{marginBottom:4}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:8.5,color:"#6c6c6c",fontFamily:"'Consolas',monospace"}}>Opacité</span><span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8.5,color:T.yellow}}>{Math.round(ov.opacity*100)}%</span></div>
                          <input type="range" min="0" max="1" step=".05" value={ov.opacity} onChange={e=>setOverlays(p=>p.map(o=>o.id===ov.id?{...o,opacity:+e.target.value}:o))} style={{width:"100%",accentColor:T.accent}}/>
                        </div>
                        <div style={{marginBottom:4}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:8.5,color:"#6c6c6c",fontFamily:"'Consolas',monospace"}}>Échelle</span><span style={{fontFamily:"'JetBrains Mono','Consolas',monospace",fontSize:8.5,color:T.yellow}}>{(ov.scale*100).toFixed(2)}cm/px</span></div>
                          <input type="range" min=".0005" max=".1" step=".0005" value={ov.scale} onChange={e=>setOverlays(p=>p.map(o=>o.id===ov.id?{...o,scale:+e.target.value}:o))} style={{width:"100%",accentColor:T.accent}}/>
                          <div style={{display:"flex",gap:2,marginTop:3}}>{[["1cm",.0001],["2cm",.0002],["5cm",.0005],["1dm",.001]].map(([l,v])=>(<button key={l} onClick={()=>setOverlays(p=>p.map(o=>o.id===ov.id?{...o,scale:v}:o))} style={{flex:1,padding:"2px 0",background:T.bg4,border:`1px solid ${T.border}`,color:T.textDim,fontSize:8,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>{l}</button>))}</div>
                        </div>
                        <button onClick={()=>{setSelOv(ov.id);setTool("overlay");}} style={{width:"100%",padding:"3px",background:selOv===ov.id?`${T.accent}18`:T.bg4,border:`1px solid ${selOv===ov.id?T.accent:T.border}`,color:selOv===ov.id?T.accent:T.textDim,cursor:"pointer",fontSize:8.5,borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>{selOv===ov.id?"✓ Actif — glisser":"Activer"}</button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Quick export */}
              <div style={{borderTop:`1px solid ${T.border}`,padding:"7px",flexShrink:0}}>
                <div style={{fontSize:7.5,color:T.textDim,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4,fontFamily:"'JetBrains Mono','Consolas',monospace"}}>Export rapide</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
                  {[["PNG","🖼",exportPNG],["PDF","📄",exportPDF],["DXF","📐",exportDXF],["JSON","📁",exportJSON],["Rapport","📋",exportReport],["Imprimer","🖨",()=>window.print()]].map(([l,ic,fn])=>(
                    <button key={l} onClick={fn} style={{padding:"4px",background:T.bg3,border:`1px solid ${T.border}`,color:T.textDim,fontSize:8.5,cursor:"pointer",borderRadius:1,fontFamily:"'JetBrains Mono','Consolas',monospace",transition:"all .15s"}}
                      onMouseOver={e=>{e.currentTarget.style.background=T.bg4;e.currentTarget.style.color=T.text;}} onMouseOut={e=>{e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.textDim;}}>{ic} {l}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!showRight ? (
          <button onClick={()=>setShowRight(true)} style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",padding:"8px 4px",background:T.bg2,border:`1px solid ${T.border}`,borderRight:"none",color:T.accent,cursor:"pointer",fontSize:10,writingMode:"vertical-rl",zIndex:10,borderRadius:"2px 0 0 2px",fontFamily:"'JetBrains Mono','Consolas',monospace"}}>◄ Prop.</button>
        ) : null}
      </div>

      {/* ── STATUS BAR ── */}
      <div style={{height:22,display:isMobileView?"none":"flex",alignItems:"center",background:"#007acc",borderTop:"none",flexShrink:0,fontSize:8.5,fontFamily:"'JetBrains Mono','Consolas',monospace",color:T.textDim,overflowX:"auto"}}>
        <div style={{padding:"0 11px",borderRight:"1px solid rgba(201,168,76,.2)",color:"#8a6a20",minWidth:200,flexShrink:0}}>{curPt?`X: ${curPt.x.toFixed(3)}  Y: ${curPt.y.toFixed(3)}`:"X: —  Y: —"}</div>
        <div style={{padding:"0 9px",borderRight:"1px solid rgba(255,255,255,.12)",color:"#dcdcaa",flexShrink:0}}>{Math.round(zoomLvl*100)}%</div>
        <div style={{padding:"0 9px",borderRight:"1px solid rgba(201,168,76,.2)",color:ortho?"#c9a84c":"rgba(26,18,8,.4)",flexShrink:0}}>ORTHO {ortho?"ON":"OFF"}</div>
        <div style={{padding:"0 9px",borderRight:"1px solid rgba(201,168,76,.2)",flexShrink:0}}>SNAP: <span style={{color:T.yellow}}>{Object.entries(snapEn).filter(([,v])=>v).map(([k])=>k).join("·")}</span></div>
        <div style={{padding:"0 9px",borderRight:"1px solid rgba(201,168,76,.2)",flexShrink:0}}>Outil: <span style={{color:T.cyan}}>{tool.toUpperCase()}</span></div>
        <div style={{padding:"0 9px",borderRight:"1px solid rgba(201,168,76,.2)",flexShrink:0}}>Calque: <span style={{color:T.yellow}}>{activeLayer}</span></div>
        <div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,flexShrink:0}}>N{floor}</div>
        <div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,flexShrink:0}}>↩{history.length}/↪{future.length}</div>
        {selected.length>0&&<div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,color:T.accent,flexShrink:0}}>Sél.: {selected.length}</div>}
        {measuring&&<div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,color:T.pink,flexShrink:0}}>📏 MESURE</div>}
        {dimMode&&<div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,color:"#ff88ff",flexShrink:0}}>📐 COTE {dimPts.length}/2</div>}
        {clipboard&&<div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,color:T.textDim,flexShrink:0}}>⎘ {clipboard.walls.length} mur(s)</div>}
        <div style={{padding:"0 9px",borderRight:`1px solid ${T.border}`,color:saveStatus==="saved"?"#4ec94e":saveStatus==="saving"?"#dcdcaa":"#f44747",flexShrink:0,fontWeight:600}}>{saveStatus==="saved"?"✓":saveStatus==="saving"?"…":"!"}</div>
        <div style={{marginLeft:"auto",padding:"0 11px",borderLeft:`1px solid ${T.border}`,flexShrink:0}}>
          📐 {walls.length} murs · 🚪 {doors.length} portes · 🪟 {wins.length} fen. · T {texts.length} textes · 🏠 {rooms.length} pièces{totalArea>0?` · ${totalArea.toFixed(1)}m²`:""}
        </div>
        <div style={{padding:"0 9px",borderLeft:`1px solid ${T.border}`,color:T.accent,flexShrink:0}}>{view==="2d"?"Plan 2D":view==="3d"?"Vue 3D":"Split"}</div>
      </div>

      {/* ── MOBILE BOTTOM TOOLBAR ── */}
      {isMobileView ? (<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:"#1e1e1e",borderTop:"1px solid #3e3e3e",padding:"6px 8px",display:"flex",gap:4,justifyContent:"space-around",alignItems:"center"}}>
        {[
          ["✏","Mur","wall"],["🚪","Porte","door"],["🪟","Fen.","window"],
          ["T","Texte","text"],["↖","Sel.","select"],["⌫","Eff.","erase"],
        ].map(([ic,lb,t])=>(
          <button key={t} onClick={()=>{setTool(t);setDrawing(false);setStartPt(null);}}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:tool===t?"rgba(0,152,255,.22)":"transparent",border:`1px solid ${tool===t?"#0098ff":"transparent"}`,borderRadius:4,color:tool===t?"#0098ff":"#999",fontSize:9,fontFamily:"'Consolas',monospace",minWidth:44,cursor:"pointer"}}>
            <span style={{fontSize:16}}>{ic}</span>
            <span>{lb}</span>
          </button>
        ))}
        <div style={{width:1,height:40,background:"#3e3e3e"}}/>
        <button onClick={undo} disabled={!history.length} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:"transparent",border:"none",color:history.length?"#cccccc":"#555",fontSize:9,fontFamily:"'Consolas',monospace",cursor:"pointer"}}>
          <span style={{fontSize:16}}>↩</span><span>Annuler</span>
        </button>
        <button onClick={()=>{push([],[],[],[],[]);setSelected([]);setSketches([]);setTemplate("");}} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:"transparent",border:"none",color:"#4ec94e",fontSize:9,fontFamily:"'Consolas',monospace",cursor:"pointer"}}>
          <span style={{fontSize:16}}>⊕</span><span>Nouveau</span>
        </button>
        <button onClick={()=>setView(view==="2d"?"3d":"2d")} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 8px",background:"transparent",border:"none",color:"#c9a84c",fontSize:9,fontFamily:"'Consolas',monospace",cursor:"pointer"}}>
          <span style={{fontSize:16}}>{view==="2d"?"◈":"✏"}</span><span>{view==="2d"?"Vue 3D":"Plan 2D"}</span>
        </button>
      </div>) : null}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={importImg}/>
      <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importJSON}/>
    </div>
  );
}