import React,{useEffect,useRef,useState,useCallback}from"react";
import{BrowserRouter,Routes,Route,Link,useNavigate}from"react-router-dom";
import Designer from"./Designer";

const STYLE=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;1,300&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:#faf8f5;color:#1a1208;font-family:'Inter',sans-serif;overflow-x:hidden;cursor:none;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#f0ede8;}::-webkit-scrollbar-thumb{background:#c9a84c;border-radius:2px;}
@keyframes panLeft{0%{background-position:0% 50%}100%{background-position:100% 50%}}
@keyframes panRight{0%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes panLeftS{0%{background-position:0% 40%}100%{background-position:100% 60%}}
@keyframes panRightS{0%{background-position:100% 60%}100%{background-position:0% 40%}}
@keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes rotateSlow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes shimmer{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.95);opacity:.6}}
@keyframes slideUp{from{opacity:0;transform:translateY(60px)}to{opacity:1;transform:translateY(0)}}
@keyframes countUp{from{opacity:0}to{opacity:1}}
@keyframes borderGlow{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0)}50%{box-shadow:0 0 0 4px rgba(201,168,76,.15)}}
.pano{background-size:200% 100%;background-repeat:no-repeat;}
.pano-l{animation:panLeft 22s linear infinite alternate;}
.pano-r{animation:panRight 22s linear infinite alternate;}
.pano-ls{animation:panLeftS 28s linear infinite alternate;}
.pano-rs{animation:panRightS 18s linear infinite alternate;}
.reveal{opacity:0;transform:translateY(50px);transition:opacity .8s cubic-bezier(.23,1,.32,1),transform .8s cubic-bezier(.23,1,.32,1);}
.reveal.visible{opacity:1;transform:translateY(0);}
.reveal-left{opacity:0;transform:translateX(-50px);transition:opacity .8s cubic-bezier(.23,1,.32,1),transform .8s cubic-bezier(.23,1,.32,1);}
.reveal-left.visible{opacity:1;transform:translateX(0);}
.reveal-right{opacity:0;transform:translateX(50px);transition:opacity .8s cubic-bezier(.23,1,.32,1),transform .8s cubic-bezier(.23,1,.32,1);}
.reveal-right.visible{opacity:1;transform:translateX(0);}
.card-hover{transition:transform .5s cubic-bezier(.23,1,.32,1),box-shadow .5s;}
.card-hover:hover{transform:translateY(-8px);box-shadow:0 32px 60px rgba(26,18,8,.15);}
.btn-gold{display:inline-flex;align-items:center;gap:10px;padding:15px 36px;background:linear-gradient(135deg,#c9a84c,#a07828);color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border:none;border-radius:3px;cursor:none;text-decoration:none;transition:all .3s;}
.btn-gold:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(201,168,76,.4);}
.btn-outline{display:inline-flex;align-items:center;gap:10px;padding:14px 36px;background:transparent;color:#1a1208;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid rgba(26,18,8,.2);border-radius:3px;cursor:none;text-decoration:none;transition:all .3s;}
.btn-outline:hover{border-color:#c9a84c;color:#c9a84c;transform:translateY(-3px);}
.nav-link{color:rgba(26,18,8,.45);font-family:'Inter',sans-serif;font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;transition:color .2s;cursor:none;}
.nav-link:hover{color:#1a1208;}
.section-tag{display:inline-flex;align-items:center;gap:8px;font-family:'Inter',sans-serif;font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#c9a84c;margin-bottom:16px;}
.section-tag::before{content:'';width:24px;height:1px;background:#c9a84c;}
.faq-item{border-bottom:1px solid rgba(201,168,76,.2);overflow:hidden;}
.price-card{padding:40px 36px;border:1px solid rgba(201,168,76,.2);border-radius:8px;background:#fff;transition:all .4s;position:relative;}
.price-card:hover{border-color:#c9a84c;transform:translateY(-6px);box-shadow:0 24px 60px rgba(201,168,76,.12);}
.price-card.featured{background:linear-gradient(135deg,#1a1208,#2a1e0a);border-color:#c9a84c;}
`;

/* ── Cursor ── */
function Cursor(){
  const dot=useRef(null),ring=useRef(null),pos=useRef({x:0,y:0}),rp=useRef({x:0,y:0});
  const[hov,setHov]=useState(false);
  useEffect(()=>{
    const mv=e=>{pos.current={x:e.clientX,y:e.clientY};if(dot.current){dot.current.style.left=e.clientX-4+"px";dot.current.style.top=e.clientY-4+"px";}};
    const ov=e=>setHov(!!e.target.closest("a,button,[data-hover]"));
    window.addEventListener("mousemove",mv);window.addEventListener("mouseover",ov);
    let raf;const loop=()=>{rp.current.x+=(pos.current.x-rp.current.x)*.12;rp.current.y+=(pos.current.y-rp.current.y)*.12;if(ring.current){ring.current.style.left=rp.current.x-(hov?24:18)+"px";ring.current.style.top=rp.current.y-(hov?24:18)+"px";ring.current.style.width=(hov?48:36)+"px";ring.current.style.height=(hov?48:36)+"px";}raf=requestAnimationFrame(loop);};loop();
    return()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseover",ov);cancelAnimationFrame(raf);};
  },[hov]);
  return(<>
    <div ref={dot} style={{position:"fixed",zIndex:9999,pointerEvents:"none",width:8,height:8,borderRadius:"50%",background:"#c9a84c",boxShadow:"0 0 10px rgba(201,168,76,.6)"}}/>
    <div ref={ring} style={{position:"fixed",zIndex:9998,pointerEvents:"none",borderRadius:"50%",border:"1.5px solid rgba(201,168,76,.5)",transition:"width .3s,height .3s"}}/>
  </>);
}

/* ── Scroll reveal ── */
function useReveal(){
  useEffect(()=>{
    const els=document.querySelectorAll(".reveal,.reveal-left,.reveal-right");
    const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible");});},{threshold:.12});
    els.forEach(el=>obs.observe(el));
    return()=>obs.disconnect();
  },[]);
}

/* ── Animated counter ── */
function Counter({target,suffix="",duration=2000}){
  const[val,setVal]=useState(0);
  const ref=useRef(null);
  useEffect(()=>{
    const obs=new IntersectionObserver(([e])=>{
      if(e.isIntersecting){
        const start=Date.now();
        const tick=()=>{const p=Math.min(1,(Date.now()-start)/duration);setVal(Math.floor(p*target));if(p<1)requestAnimationFrame(tick);};
        tick();obs.disconnect();
      }
    },{threshold:.5});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[target,duration]);
  return<span ref={ref}>{val}{suffix}</span>;
}

/* ── Nav ── */
function Nav(){
  const[sc,setSc]=useState(false);
  useEffect(()=>{const fn=()=>setSc(window.scrollY>60);window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);},[]);
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:200,height:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 60px",background:sc?"rgba(250,248,245,.97)":"transparent",backdropFilter:sc?"blur(20px)":"none",borderBottom:sc?"1px solid rgba(201,168,76,.15)":"none",transition:"all .5s"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,background:"linear-gradient(135deg,#c9a84c,#a07828)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(201,168,76,.3)"}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#fff",fontWeight:700,fontStyle:"italic"}}>A</span>
        </div>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#1a1208",lineHeight:1,letterSpacing:"-.01em"}}>AYBO<span style={{color:"#c9a84c"}}>.</span>INC</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:8,color:"rgba(26,18,8,.35)",letterSpacing:".18em",textTransform:"uppercase"}}>Architecture Pro</div>
        </div>
      </div>
      <div style={{display:"flex",gap:typeof window!=="undefined"&&window.innerWidth<768?12:36,alignItems:"center"}}>
        <div style={{display:typeof window!=="undefined"&&window.innerWidth<768?"none":"flex",gap:36,alignItems:"center"}}>
          {[["#vision","Vision"],["#projets","Projets"],["#fonctions","Fonctions"],["#prix","Tarifs"]].map(([h,l])=>(
            <a key={h} href={h} className="nav-link">{l}</a>
          ))}
        </div>
        <Link to="/designer" className="btn-gold" style={{padding:"9px 18px",fontSize:11}}>Atelier →</Link>
      </div>
    </nav>
  );
}

/* ── Ticker ── */
function Ticker({dark}){
  const items=["Architecture de luxe","Plan 2D AutoCAD","Rendu 3D photoréaliste","Mode FPS immersif","Export PDF & DXF","Croquis architectural","Matériaux nobles","Sauvegarde automatique","Cotations & Textes","Multi-étages","Snap OSNAP avancé","Portes & Fenêtres"];
  const rep=[...items,...items];
  return(
    <div style={{overflow:"hidden",padding:"13px 0",borderTop:`1px solid ${dark?"rgba(26,18,8,.08)":"rgba(201,168,76,.15)"}`,borderBottom:`1px solid ${dark?"rgba(26,18,8,.08)":"rgba(201,168,76,.15)"}`,background:dark?"rgba(26,18,8,.03)":"rgba(201,168,76,.04)"}}>
      <div style={{display:"inline-flex",animation:"ticker 36s linear infinite",whiteSpace:"nowrap"}}>
        {rep.map((item,i)=>(
          <span key={i} style={{display:"inline-flex",alignItems:"center",gap:18,padding:"0 28px"}}>
            <span style={{fontSize:10,fontWeight:600,color:dark?"rgba(26,18,8,.3)":"rgba(201,168,76,.7)",letterSpacing:".18em",textTransform:"uppercase"}}>{item}</span>
            <span style={{width:3,height:3,borderRadius:"50%",background:"#c9a84c",opacity:.5,flexShrink:0}}/>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Hero ── */
function Hero(){
  const navigate=useNavigate();
  return(
    <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",background:"#faf8f5"}}>
      <div style={{position:"absolute",inset:0,zIndex:0}}>
        <div className="pano pano-l" style={{width:"100%",height:"100%",backgroundImage:"url(https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2400&q=85)",backgroundSize:"200% 100%"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to right,rgba(250,248,245,.97) 0%,rgba(250,248,245,.75) 50%,rgba(250,248,245,.15) 100%)"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 60%,rgba(250,248,245,1) 100%)"}}/>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",padding:"clamp(80px,12vw,140px) clamp(20px,6vw,60px) 60px",position:"relative",zIndex:1}}>
        <div style={{maxWidth:600}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",background:"rgba(201,168,76,.1)",border:"1px solid rgba(201,168,76,.25)",borderRadius:100,marginBottom:32,animation:"fadeIn 1s ease both .2s",opacity:0}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#c9a84c",animation:"pulse 2s ease infinite"}}/>
            <span style={{fontSize:10,fontWeight:600,color:"#c9a84c",letterSpacing:".18em",textTransform:"uppercase"}}>Plateforme Architecturale v4.0</span>
          </div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(38px,7.5vw,100px)",fontWeight:700,lineHeight:.88,letterSpacing:"-.02em",color:"#1a1208",marginBottom:28,animation:"fadeUp 1.1s ease both .3s",opacity:0}}>
            L'art de<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>concevoir</em><br/>l'espace
          </h1>
          <p style={{fontSize:16,color:"rgba(26,18,8,.5)",lineHeight:1.9,marginBottom:40,fontWeight:300,maxWidth:460,animation:"fadeUp 1.1s ease both .5s",opacity:0}}>
            Plan 2D précis, rendu 3D photoréaliste, visite FPS immersive. Tout ce qu'un architecte professionnel attend, directement dans le navigateur.
          </p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",animation:"fadeUp 1.1s ease both .7s",opacity:0}}>
            <Link to="/designer" className="btn-gold">Ouvrir l'Atelier →</Link>
            <a href="#demo" className="btn-outline">Voir la démo</a>
          </div>
          {/* Animated stats */}
          <div style={{display:"flex",gap:48,marginTop:60,animation:"fadeIn 1.2s ease both 1s",opacity:0}}>
            {[[540,"m²","Plus grand espace"],[60,"fps","Rendu 3D"],[5,"","Types d'export"]].map(([n,s,l])=>(
              <div key={l} style={{borderLeft:"2px solid rgba(201,168,76,.3)",paddingLeft:16}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#c9a84c",lineHeight:1,marginBottom:4}}>
                  <Counter target={n} suffix={s}/>
                </div>
                <div style={{fontSize:10,color:"rgba(26,18,8,.4)",textTransform:"uppercase",letterSpacing:".12em",fontWeight:500}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{position:"absolute",bottom:32,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,animation:"float 2.5s ease-in-out infinite",zIndex:1}}>
        <div style={{width:1,height:48,background:"linear-gradient(to bottom,transparent,#c9a84c)"}}/>
        <span style={{fontSize:9,color:"#c9a84c",letterSpacing:".2em",textTransform:"uppercase"}}>Défiler</span>
      </div>
    </section>
  );
}

/* ── Demo Section ── */
function Demo(){
  const[active,setActive]=useState(0);
  const demos=[
    {label:"Plan 2D",img:"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",desc:"Interface IntelliCAD complète avec snap OSNAP, calques, cotations automatiques et murs auto-joints."},
    {label:"Vue 3D",img:"https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",desc:"Rendu photoréaliste ACESFilmic avec ombres PCF, matériaux PBR nobles et mobilier automatique."},
    {label:"Mode FPS",img:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",desc:"Visitez votre espace à hauteur d'homme. WASD pour vous déplacer, souris pour regarder."},
    {label:"Export",img:"https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=1200&q=80",desc:"Exportez en PDF avec tableau des surfaces, DXF AutoCAD, PNG HD ou rapport quantitatif TXT."},
  ];
  return(
    <section id="demo" style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#f5f1eb",position:"relative"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:60}}>
          <div className="section-tag reveal" style={{justifyContent:"center"}}>Démo interactive</div>
          <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em"}}>
            Voyez-le en <em style={{fontStyle:"italic",color:"#c9a84c"}}>action</em>
          </h2>
        </div>
        <div className="reveal" style={{display:"flex",gap:4,marginBottom:4,justifyContent:"center"}}>
          {demos.map((d,i)=>(
            <button key={i} onClick={()=>setActive(i)} style={{padding:"10px 24px",background:active===i?"#1a1208":"transparent",border:"1px solid rgba(26,18,8,.15)",borderRadius:100,color:active===i?"#faf8f5":"rgba(26,18,8,.5)",fontSize:12,fontWeight:500,cursor:"none",transition:"all .3s",fontFamily:"'Inter',sans-serif"}}>{d.label}</button>
          ))}
        </div>
        <div className="reveal" style={{position:"relative",borderRadius:16,overflow:"hidden",height:420,boxShadow:"0 32px 80px rgba(26,18,8,.2)"}}>
          <div className="pano pano-l" style={{width:"100%",height:"100%",backgroundImage:`url(${demos[active].img})`,backgroundSize:"200% 100%",transition:"background-image .5s"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(26,18,8,.85) 0%,transparent 60%)"}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"32px 40px"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"4px 14px",background:"rgba(201,168,76,.2)",border:"1px solid rgba(201,168,76,.4)",borderRadius:100,marginBottom:12}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#c9a84c",animation:"pulse 2s ease infinite"}}/>
              <span style={{fontSize:9,fontWeight:600,color:"#c9a84c",letterSpacing:".18em",textTransform:"uppercase"}}>{demos[active].label}</span>
            </div>
            <p style={{fontSize:16,color:"rgba(255,255,255,.75)",lineHeight:1.7,maxWidth:520,fontWeight:300}}>{demos[active].desc}</p>
          </div>
          <Link to="/designer" className="btn-gold" style={{position:"absolute",top:24,right:24,padding:"10px 22px",fontSize:11}}>Essayer →</Link>
        </div>
      </div>
    </section>
  );
}

/* ── Vision ── */
function Vision(){
  return(
    <section id="vision" style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#faf8f5"}}>
      <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"clamp(32px,5vw,80px)",alignItems:"center"}}>
        <div className="reveal-left">
          <div className="section-tag">Notre Vision</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,60px)",fontWeight:700,color:"#1a1208",lineHeight:1.02,letterSpacing:"-.02em",marginBottom:24}}>
            L'excellence<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>au service</em><br/>de l'espace
          </h2>
          <div style={{width:60,height:1,background:"#c9a84c",marginBottom:24,opacity:.5}}/>
          <p style={{fontSize:15,color:"rgba(26,18,8,.5)",lineHeight:1.9,fontWeight:300,marginBottom:32}}>
            AYBO INC réunit en une seule plateforme tous les outils dont un architecte a besoin. Du plan 2D de précision à la visite 3D immersive, en passant par l'export professionnel.
          </p>
          <div style={{display:"flex",gap:24,marginBottom:32}}>
            {[["∞","Projets"],["9","Calques"],["12","Matériaux"]].map(([n,l])=>(
              <div key={l} style={{textAlign:"center",padding:"16px 20px",background:"rgba(201,168,76,.06)",border:"1px solid rgba(201,168,76,.2)",borderRadius:8}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#c9a84c"}}>{n}</div>
                <div style={{fontSize:10,color:"rgba(26,18,8,.4)",textTransform:"uppercase",letterSpacing:".1em",marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          <Link to="/designer" className="btn-gold" style={{fontSize:12,padding:"12px 28px"}}>Essayer gratuitement →</Link>
        </div>
        <div className="reveal-right" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"220px 160px",gap:10}}>
          {[
            {url:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",pan:"pano-l",label:"Suite Luxe"},
            {url:"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80",pan:"pano-r",label:"Cuisine Chef"},
            {url:"https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",pan:"pano-rs",label:"Open Space"},
            {url:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",pan:"pano-ls",label:"Salon Moderne"},
          ].map((img,i)=>(
            <div key={i} className="card-hover" style={{borderRadius:12,overflow:"hidden",position:"relative"}}>
              <div className={`pano ${img.pan}`} style={{width:"100%",height:"100%",backgroundImage:`url(${img.url})`,backgroundSize:"220% 100%"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 12px",background:"linear-gradient(transparent,rgba(26,18,8,.7))"}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,.85)",fontWeight:500}}>{img.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Projects ── */
function Projects(){
  const navigate=useNavigate();
  const[hov,setHov]=useState(null);
  const PROJECTS=[
    {url:"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=2000&q=85",room:"villa",label:"Villa Méditerranéenne",sub:"Résidentiel · 540 m²",pan:"pano-l",big:true},
    {url:"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80",room:"chambre",label:"Suite Présidentielle",sub:"Hôtellerie · 120 m²",pan:"pano-r"},
    {url:"https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1400&q=80",room:"cuisine",label:"Cuisine Grand Chef",sub:"Gastronomique · 85 m²",pan:"pano-ls"},
    {url:"https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80",room:"bureau",label:"Open Space Corporate",sub:"Tertiaire · 320 m²",pan:"pano-rs"},
    {url:"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80",room:"salon",label:"Appartement Haussmannien",sub:"Résidentiel · 180 m²",pan:"pano-l"},
    {url:"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",room:"studio",label:"Loft Contemporain",sub:"Résidentiel · 65 m²",pan:"pano-r"},
  ];
  return(
    <section id="projets" style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#f5f1eb"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:52}}>
          <div className="reveal-left">
            <div className="section-tag">Projets</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em"}}>
              Cliquez pour<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>recréer</em> cet espace
            </h2>
          </div>
          <div className="reveal-right" style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:64,fontWeight:700,color:"rgba(26,18,8,.06)",lineHeight:1}}>06</div>
            <div style={{fontSize:10,color:"rgba(26,18,8,.3)",letterSpacing:".16em",textTransform:"uppercase"}}>Œuvres disponibles</div>
          </div>
        </div>
        <div className="reveal" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:10}}>
          {PROJECTS.map((p,i)=>(
            <div key={i} onClick={()=>navigate(`/designer?room=${p.room}`)}
              onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
              style={{position:"relative",borderRadius:16,overflow:"hidden",cursor:"none",gridRow:p.big?"1/3":"auto",boxShadow:hov===i?"0 32px 60px rgba(26,18,8,.2)":"0 4px 24px rgba(26,18,8,.08)",transition:"all .5s cubic-bezier(.23,1,.32,1)"}}>
              <div className={`pano ${p.pan}`} style={{width:"100%",height:"100%",backgroundImage:`url(${p.url})`,backgroundSize:"220% 100%",transition:"transform .6s cubic-bezier(.23,1,.32,1)",transform:hov===i?"scale(1.04)":"scale(1)"}}/>
              <div style={{position:"absolute",inset:0,background:hov===i?"linear-gradient(to top,rgba(26,18,8,.88) 0%,rgba(26,18,8,.15) 55%,transparent 100%)":"linear-gradient(to top,rgba(26,18,8,.65) 0%,transparent 55%)",transition:"all .4s"}}/>
              {hov===i&&<div style={{position:"absolute",inset:0,border:"1.5px solid rgba(201,168,76,.4)",borderRadius:16,pointerEvents:"none"}}/>}
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 22px",transform:hov===i?"translateY(0)":"translateY(3px)",transition:"transform .4s"}}>
                {hov===i&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><div style={{width:18,height:1,background:"#c9a84c"}}/><span style={{fontSize:9,color:"#c9a84c",letterSpacing:".18em",textTransform:"uppercase",fontWeight:600}}>Ouvrir dans l'atelier</span></div>}
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:p.big?22:17,fontWeight:600,color:"#fff",marginBottom:4}}>{p.label}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{p.sub}</div>
                {hov===i&&<div style={{marginTop:12,display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",background:"rgba(201,168,76,.2)",border:"1px solid rgba(201,168,76,.5)",borderRadius:100,fontSize:10,color:"#e8c97a",fontWeight:600}}>→ Recréer cet espace</div>}
              </div>
              <div style={{position:"absolute",top:14,right:14,fontFamily:"'Playfair Display',serif",fontSize:11,color:"rgba(255,255,255,.3)",fontStyle:"italic"}}>0{i+1}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pano Banner ── */
function PanoBanner(){
  return(
    <div style={{position:"relative",height:"clamp(300px,50vw,520px)",overflow:"hidden"}}>
      <div className="pano pano-l" style={{width:"100%",height:"100%",backgroundImage:"url(https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=3000&q=85)",backgroundSize:"200% 100%"}}/>
      <div style={{position:"absolute",inset:0,background:"rgba(26,18,8,.55)"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"0 60px"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:"#c9a84c",letterSpacing:".3em",textTransform:"uppercase",marginBottom:20}}>Atelier Architectural</div>
        <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(40px,6vw,80px)",fontWeight:700,color:"#fff",lineHeight:.9,letterSpacing:"-.02em",marginBottom:28}}>
          Chaque espace mérite<br/><em style={{fontStyle:"italic",color:"#e8c97a"}}>l'excellence</em>
        </h2>
        <p style={{fontSize:16,color:"rgba(255,255,255,.5)",maxWidth:480,lineHeight:1.8,marginBottom:36}}>De l'esquisse à la visite immersive. AYBO INC vous accompagne à chaque étape.</p>
        <Link to="/designer" className="btn-gold">Ouvrir l'Atelier →</Link>
      </div>
    </div>
  );
}

/* ── Features ── */
function Features(){
  const FEATS=[
    {n:"01",icon:"✏️",title:"Plan 2D AutoCAD",desc:"Interface IntelliCAD avec ruban 7 onglets. Snap OSNAP, calques, cotations, hachures, textes, murs auto-joints.",color:"#c9a84c"},
    {n:"02",icon:"◈",title:"Rendu 3D Photoréaliste",desc:"Extrusion automatique. Portes, fenêtres paramétriques. Éclairage ACESFilmic, ombres PCF, mobilier par template.",color:"#8a6a20"},
    {n:"03",icon:"🚶",title:"Visite FPS Immersive",desc:"Exploration à hauteur d'homme. WASD fluide, sprint, brouillard. Vraie visite architecturale en temps réel.",color:"#c9a84c"},
    {n:"04",icon:"T",title:"Textes & Cotations",desc:"Annotations sur le plan. Cotations manuelles permanentes. Tableau des surfaces automatique. Minimap en bas à droite.",color:"#8a6a20"},
    {n:"05",icon:"📄",title:"Export PDF & DXF",desc:"PDF imprimable avec tableau surfaces. DXF AutoCAD. PNG HD. JSON. Rapport quantitatif complet.",color:"#c9a84c"},
    {n:"06",icon:"💾",title:"Sauvegarde Auto",desc:"Sauvegarde automatique toutes les 1.5s. Restauration automatique. Import/Export de projets JSON.",color:"#8a6a20"},
  ];
  return(
    <section id="fonctions" style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#faf8f5"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:64}}>
          <div className="reveal-left">
            <div className="section-tag">Fonctions</div>
            <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em"}}>
              L'arsenal d'un<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>maître architecte</em>
            </h2>
          </div>
          <Link to="/designer" className="btn-gold reveal-right" style={{fontSize:12}}>Accéder à l'Atelier →</Link>
        </div>
        <div className="reveal" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:1,background:"rgba(201,168,76,.12)"}}>
          {FEATS.map((f,i)=>(
            <div key={i} style={{padding:"36px 32px",background:"#faf8f5",transition:"background .3s",position:"relative",overflow:"hidden"}}
              onMouseOver={e=>{e.currentTarget.style.background="#f5f1eb";}}
              onMouseOut={e=>{e.currentTarget.style.background="#faf8f5";}}>
              <div style={{position:"absolute",top:0,left:0,width:2,height:"0%",background:"#c9a84c",transition:"height .4s"}}
                onMouseOver={e=>{e.currentTarget.style.height="100%";}}
                onMouseOut={e=>{e.currentTarget.style.height="0%";}}/>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:11,color:"rgba(26,18,8,.3)",letterSpacing:".2em",fontStyle:"italic"}}>{f.n}</span>
                <span style={{fontSize:9,fontWeight:600,color:"#c9a84c",padding:"2px 10px",border:"1px solid rgba(201,168,76,.3)",borderRadius:100,letterSpacing:".1em"}}>PRO</span>
              </div>
              <div style={{fontSize:28,marginBottom:16}}>{f.icon}</div>
              <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:600,color:"#1a1208",marginBottom:10,letterSpacing:"-.01em"}}>{f.title}</h3>
              <p style={{fontSize:12.5,color:"rgba(26,18,8,.45)",lineHeight:1.85,fontWeight:300}}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function Testimonials(){
  const TESTI=[
    {name:"Marc Dubois",role:"Architecte DPLG · Paris",text:"AYBO INC m'a permis de présenter des rendus 3D à mes clients en quelques minutes. L'interface est intuitive et les exports DXF sont parfaitement compatibles avec AutoCAD.",avatar:"M",color:"#c9a84c"},
    {name:"Sophie Laurent",role:"Designer d'intérieur · Lyon",text:"Le mode FPS est bluffant. Je fais visiter les appartements à mes clients directement dans le navigateur sans installer quoi que ce soit. Un gain de temps énorme.",avatar:"S",color:"#8a6a20"},
    {name:"Karim Benali",role:"Promoteur immobilier · Casablanca",text:"La sauvegarde automatique et l'export PDF avec tableau des surfaces ont révolutionné mon workflow. Je recommande à tous mes équipes.",avatar:"K",color:"#c9a84c"},
  ];
  return(
    <section style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#f5f1eb"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:64}}>
          <div className="section-tag reveal" style={{justifyContent:"center"}}>Témoignages</div>
          <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em"}}>
            Ils nous font <em style={{fontStyle:"italic",color:"#c9a84c"}}>confiance</em>
          </h2>
        </div>
        <div className="reveal" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          {TESTI.map((t,i)=>(
            <div key={i} className="card-hover" style={{padding:"36px 32px",background:"#fff",borderRadius:12,border:"1px solid rgba(201,168,76,.15)",position:"relative"}}>
              <div style={{fontSize:40,color:"rgba(201,168,76,.15)",fontFamily:"'Playfair Display',serif",fontWeight:700,lineHeight:1,marginBottom:16,letterSpacing:"-.02em"}}>"</div>
              <p style={{fontSize:14,color:"rgba(26,18,8,.6)",lineHeight:1.85,fontWeight:300,marginBottom:24,fontStyle:"italic"}}>{t.text}</p>
              <div style={{display:"flex",alignItems:"center",gap:12,borderTop:"1px solid rgba(201,168,76,.12)",paddingTop:20}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:`linear-gradient(135deg,${t.color},#7a5c20)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#fff",fontWeight:700,fontStyle:"italic"}}>{t.avatar}</span>
                </div>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:600,color:"#1a1208"}}>{t.name}</div>
                  <div style={{fontSize:10,color:"rgba(26,18,8,.4)",letterSpacing:".08em"}}>{t.role}</div>
                </div>
                <div style={{marginLeft:"auto",display:"flex",gap:2}}>{[1,2,3,4,5].map(s=><span key={s} style={{color:"#c9a84c",fontSize:12}}>★</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Stats counter section ── */
function StatsSection(){
  return(
    <div style={{padding:"80px 60px",background:"#1a1208",position:"relative",overflow:"hidden"}}>
      <div className="pano pano-ls" style={{position:"absolute",inset:0,backgroundImage:"url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=2400&q=50)",backgroundSize:"200% 100%",opacity:.06}}/>
      <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:1,background:"rgba(201,168,76,.1)",position:"relative",zIndex:1}}>
        {[[540,"m²","Plus grand espace designé"],[100,"+","Architectes utilisateurs"],[5,"","Types d'export disponibles"],[1.5,"s","Délai de sauvegarde auto"]].map(([n,s,l])=>(
          <div key={l} style={{padding:"40px 32px",background:"rgba(26,18,8,.8)",textAlign:"center"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:48,fontWeight:700,color:"#c9a84c",lineHeight:1,marginBottom:8}}>
              <Counter target={n} suffix={s}/>
            </div>
            <div style={{fontSize:11,color:"rgba(250,248,245,.35)",textTransform:"uppercase",letterSpacing:".12em",fontWeight:500}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pricing ── */
function Pricing(){
  const PLANS=[
    {name:"Gratuit",price:"0",period:"forever",color:"#1a1208",features:["Plan 2D illimité","Vue 3D temps réel","Export PNG","3 templates","Sauvegarde locale"],cta:"Commencer gratuitement",link:"/designer",featured:false},
    {name:"Pro",price:"9",period:"per month",color:"#c9a84c",features:["Tout du gratuit","Export PDF + DXF","Import JSON","Tous les templates","Textes & Cotations","Mode FPS immersif","Matériaux nobles PBR","Support prioritaire"],cta:"Démarrer Pro",link:"/designer",featured:true},
    {name:"Studio",price:"29",period:"per month",color:"#8a6a20",features:["Tout du Pro","Multi-projets cloud","Sauvegarde en ligne","Partage client","Export rapport TXT","Accès API","Équipe jusqu'à 5","Formation incluse"],cta:"Contacter Studio",link:"mailto:contact@aybo.inc",featured:false},
  ];
  return(
    <section id="prix" style={{padding:"120px 60px",background:"#faf8f5"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:64}}>
          <div className="section-tag reveal" style={{justifyContent:"center"}}>Tarifs</div>
          <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em",marginBottom:16}}>
            Simple et <em style={{fontStyle:"italic",color:"#c9a84c"}}>transparent</em>
          </h2>
          <p className="reveal" style={{fontSize:15,color:"rgba(26,18,8,.45)",maxWidth:440,margin:"0 auto",lineHeight:1.8}}>Commencez gratuitement. Passez Pro quand vous êtes prêt.</p>
        </div>
        <div className="reveal" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start"}}>
          {PLANS.map((p,i)=>(
            <div key={i} className={`price-card ${p.featured?"featured":""}`}>
              {p.featured&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",padding:"4px 20px",background:"#c9a84c",borderRadius:100,fontSize:10,fontWeight:700,color:"#1a1208",letterSpacing:".12em",textTransform:"uppercase",whiteSpace:"nowrap"}}>⭐ Le plus populaire</div>}
              <div style={{marginBottom:24}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:p.featured?"#e8c97a":"#1a1208",marginBottom:8}}>{p.name}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:48,fontWeight:700,color:p.featured?"#fff":"#c9a84c",lineHeight:1}}>$ {p.price}</span>
                  <span style={{fontSize:12,color:p.featured?"rgba(255,255,255,.4)":"rgba(26,18,8,.3)"}}>/mo</span>
                </div>
                <div style={{fontSize:11,color:p.featured?"rgba(255,255,255,.3)":"rgba(26,18,8,.3)",letterSpacing:".08em"}}>{p.period}</div>
              </div>
              <div style={{height:1,background:p.featured?"rgba(201,168,76,.3)":"rgba(201,168,76,.15)",marginBottom:24}}/>
              <div style={{marginBottom:32}}>
                {p.features.map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:p.featured?"rgba(201,168,76,.2)":"rgba(201,168,76,.1)",border:`1px solid ${p.featured?"rgba(201,168,76,.4)":"rgba(201,168,76,.25)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:9,color:"#c9a84c"}}>✓</span>
                    </div>
                    <span style={{fontSize:13,color:p.featured?"rgba(255,255,255,.7)":"rgba(26,18,8,.6)",fontWeight:300}}>{f}</span>
                  </div>
                ))}
              </div>
              <Link to={p.link} className="btn-gold" style={{width:"100%",justifyContent:"center",background:p.featured?"linear-gradient(135deg,#c9a84c,#a07828)":"transparent",color:p.featured?"#fff":"#c9a84c",border:`1.5px solid ${p.featured?"transparent":"#c9a84c"}`,fontSize:12,padding:"13px 24px"}}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ── */
function FAQ(){
  const[open,setOpen]=useState(null);
  const QS=[
    {q:"Est-ce que c'est vraiment gratuit ?",a:"Oui, la version gratuite est complète pour les usages de base — plan 2D illimité, vue 3D, export PNG. Aucune carte de crédit requise."},
    {q:"Faut-il installer quelque chose ?",a:"Non. AYBO INC fonctionne 100% dans votre navigateur. Aucune installation, aucun téléchargement. Chrome, Firefox ou Edge suffisent."},
    {q:"Est-ce que les fichiers DXF sont compatibles AutoCAD ?",a:"Oui. Les exports DXF respectent le format standard AutoCAD 2018. Ils peuvent être ouverts directement dans AutoCAD, IntelliCAD ou BricsCAD."},
    {q:"Mes projets sont-ils sauvegardés ?",a:"La sauvegarde automatique fonctionne en temps réel dans votre navigateur (localStorage). Pour une sauvegarde cloud entre appareils, optez pour le plan Pro."},
    {q:"Puis-je utiliser AYBO INC sur tablette ou téléphone ?",a:"L'atelier est optimisé pour desktop. La page d'accueil et la galerie fonctionnent sur tous les appareils."},
    {q:"Comment annuler mon abonnement Pro ?",a:"Vous pouvez annuler à tout moment depuis votre compte, sans frais ni engagement. Vous gardez l'accès jusqu'à la fin de la période payée."},
  ];
  return(
    <section style={{padding:"120px 60px",background:"#f5f1eb"}}>
      <div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:64}}>
          <div className="section-tag reveal" style={{justifyContent:"center"}}>FAQ</div>
          <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(36px,4vw,58px)",fontWeight:700,color:"#1a1208",lineHeight:.95,letterSpacing:"-.02em"}}>
            Questions <em style={{fontStyle:"italic",color:"#c9a84c"}}>fréquentes</em>
          </h2>
        </div>
        <div className="reveal">
          {QS.map((q,i)=>(
            <div key={i} className="faq-item">
              <button onClick={()=>setOpen(open===i?null:i)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"22px 0",background:"none",border:"none",cursor:"none",textAlign:"left"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:600,color:"#1a1208",letterSpacing:"-.01em"}}>{q.q}</span>
                <span style={{fontSize:20,color:"#c9a84c",flexShrink:0,marginLeft:20,transition:"transform .3s",transform:open===i?"rotate(45deg)":"rotate(0deg)"}}>+</span>
              </button>
              {open===i&&<div style={{paddingBottom:22,fontSize:14,color:"rgba(26,18,8,.55)",lineHeight:1.85,fontWeight:300,animation:"fadeIn .3s ease"}}>{q.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pano Banner 2 ── */
function PanoBanner2(){
  return(
    <div style={{position:"relative",height:"clamp(260px,40vw,420px)",overflow:"hidden"}}>
      <div className="pano pano-r" style={{width:"100%",height:"100%",backgroundImage:"url(https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=3000&q=85)",backgroundSize:"200% 100%"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to right,rgba(250,248,245,.95) 0%,rgba(250,248,245,.4) 50%,rgba(26,18,8,.3) 100%)"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"0 clamp(20px,8vw,120px)"}}>
        <div style={{maxWidth:520}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:12,color:"#c9a84c",letterSpacing:".28em",textTransform:"uppercase",marginBottom:16}}>À propos</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(32px,4vw,56px)",fontWeight:700,color:"#1a1208",lineHeight:1.02,letterSpacing:"-.02em",marginBottom:20}}>
            Fondé par un passionné<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>d'architecture</em>
          </h2>
          <p style={{fontSize:15,color:"rgba(26,18,8,.5)",lineHeight:1.85,fontWeight:300,marginBottom:28}}>AYBO INC est né d'une vision simple : rendre les outils d'architecture professionnels accessibles à tous, directement dans le navigateur.</p>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#c9a84c,#8a6a20)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700,fontStyle:"italic"}}>A</span>
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#1a1208",fontWeight:600}}>Ayoub Bouicha</div>
              <div style={{fontSize:10,color:"rgba(26,18,8,.4)",letterSpacing:".1em",textTransform:"uppercase"}}>Fondateur & Directeur Créatif</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CTA ── */
function CTA(){
  return(
    <section style={{padding:"clamp(60px,8vw,120px) clamp(20px,5vw,60px)",background:"#1a1208",position:"relative",overflow:"hidden"}}>
      <div className="pano pano-ls" style={{position:"absolute",inset:0,backgroundImage:"url(https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2400&q=50)",backgroundSize:"200% 100%",opacity:.08}}/>
      <div style={{maxWidth:900,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:500,height:500,borderRadius:"50%",border:"1px solid rgba(201,168,76,.08)",pointerEvents:"none"}}>
          <div style={{position:"absolute",inset:30,borderRadius:"50%",border:"1px dashed rgba(201,168,76,.05)",animation:"rotateSlow 40s linear infinite"}}/>
        </div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:12,color:"#c9a84c",letterSpacing:".28em",textTransform:"uppercase",marginBottom:24}}>Commencez maintenant</div>
        <h2 className="reveal" style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(44px,6.5vw,88px)",fontWeight:700,color:"#faf8f5",lineHeight:.88,letterSpacing:"-.02em",marginBottom:24}}>
          Votre chef-d'œuvre<br/><em style={{fontStyle:"italic",color:"#c9a84c"}}>commence ici</em>
        </h2>
        <p style={{fontSize:16,color:"rgba(250,248,245,.35)",maxWidth:440,margin:"0 auto 44px",lineHeight:1.85,fontWeight:300}}>Rejoignez les architectes et designers qui créent avec AYBO INC. Gratuit, sans installation.</p>
        <div style={{display:"flex",justifyContent:"center",gap:14,flexWrap:"wrap"}}>
          <Link to="/designer" className="btn-gold" style={{fontSize:14,padding:"16px 44px"}}>Ouvrir l'Atelier →</Link>
          <a href="#prix" style={{display:"inline-flex",alignItems:"center",padding:"15px 44px",background:"transparent",color:"rgba(250,248,245,.5)",fontSize:13,fontWeight:500,border:"1.5px solid rgba(250,248,245,.15)",borderRadius:3,textDecoration:"none",cursor:"none",letterSpacing:".06em",textTransform:"uppercase",transition:"all .3s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor="rgba(201,168,76,.4)";e.currentTarget.style.color="#e8c97a";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor="rgba(250,248,245,.15)";e.currentTarget.style.color="rgba(250,248,245,.5)";}}>
            Voir les tarifs
          </a>
        </div>
        <div style={{marginTop:20,fontSize:10,color:"rgba(250,248,245,.18)",letterSpacing:".14em",textTransform:"uppercase"}}>Gratuit · Aucune installation · Sauvegarde automatique</div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer(){
  return(
    <footer style={{background:"#120e06",borderTop:"1px solid rgba(201,168,76,.1)",padding:"52px 60px 40px"}}>
      <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"clamp(24px,4vw,56px)",marginBottom:40}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <div style={{width:32,height:32,background:"linear-gradient(135deg,#c9a84c,#8a6a20)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#fff",fontWeight:700,fontStyle:"italic"}}>A</span>
              </div>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#faf8f5",fontWeight:700}}>AYBO<span style={{color:"#c9a84c"}}>.</span>INC</div>
                <div style={{fontSize:8,color:"rgba(250,248,245,.2)",letterSpacing:".18em",textTransform:"uppercase"}}>Architecture Pro</div>
              </div>
            </div>
            <p style={{fontSize:13,color:"rgba(250,248,245,.3)",lineHeight:1.85,fontWeight:300,maxWidth:240}}>Plateforme d'architecture de luxe. Plan 2D, rendu 3D, export professionnel. Chaque espace mérite l'excellence.</p>
          </div>
          {[{title:"Atelier",links:["Designer","Croquis","Matériaux","Export","Modèles"]},{title:"Plateforme",links:["Fonctions","Projets","Tarifs","FAQ"]},{title:"Contact",links:["contact@aybo.inc","Instagram","LinkedIn","Carrières"]},].map(col=>(
            <div key={col.title}>
              <div style={{fontSize:9,color:"#c9a84c",textTransform:"uppercase",letterSpacing:".2em",marginBottom:20,fontWeight:600}}>{col.title}</div>
              {col.links.map(l=>(
                <div key={l} style={{marginBottom:12}}>
                  <a href="#" style={{fontSize:13,color:"rgba(250,248,245,.3)",textDecoration:"none",transition:"color .2s",fontWeight:300,cursor:"none"}}
                    onMouseOver={e=>e.target.style.color="#faf8f5"} onMouseOut={e=>e.target.style.color="rgba(250,248,245,.3)"}>{l}</a>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid rgba(201,168,76,.08)",paddingTop:28,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16}}>
          <span style={{fontSize:11,color:"rgba(250,248,245,.18)"}}>© 2026 AYBO INC · Tous droits réservés</span>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:1,height:36,background:"rgba(201,168,76,.15)"}}/>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:18,color:"#c9a84c"}}>Ayoub Bouicha</div>
              <div style={{fontSize:9,color:"rgba(250,248,245,.2)",textTransform:"uppercase",letterSpacing:".22em",marginTop:2}}>Fondateur & Directeur Créatif</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Home ── */
function Home(){
  useReveal();
  return(
    <div>
      <Nav/>
      <Hero/>
      <Ticker dark/>
      <Demo/>
      <Vision/>
      <Ticker dark={false}/>
      <Projects/>
      <PanoBanner/>
      <Features/>
      <StatsSection/>
      <Testimonials/>
      <Pricing/>
      <FAQ/>
      <PanoBanner2/>
      <CTA/>
      <Footer/>
    </div>
  );
}

/* ── App ── */
export default function App(){
  useEffect(()=>{
    const id="aybo-styles-v6";
    if(!document.getElementById(id)){const s=document.createElement("style");s.id=id;s.textContent=STYLE;document.head.appendChild(s);}
  },[]);
  return(
    <BrowserRouter>
      <Cursor/>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/designer" element={<Designer/>}/>
      </Routes>
    </BrowserRouter>
  );
}