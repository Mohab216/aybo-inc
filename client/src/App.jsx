import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import Designer from "./Designer";

/* ── Google Fonts ─────────────────────────────────────────── */
const injectFont = () => {
  const href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap";
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href;
    document.head.appendChild(l);
  }
};

/* ── Global CSS ───────────────────────────────────────────── */
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #060608; overflow-x: hidden; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(40px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ticker {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes pulseRing {
    0%   { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes rotateSlow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes counterUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .nav-item {
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: color 0.2s;
    padding: 6px 0;
    position: relative;
  }
  .nav-item::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0;
    width: 0; height: 1px;
    background: #fff;
    transition: width 0.25s;
  }
  .nav-item:hover { color: rgba(255,255,255,0.9); }
  .nav-item:hover::after { width: 100%; }
  .nav-item.active { color: #fff; }
  .nav-item.active::after { width: 100%; }

  .cta-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 15px 28px;
    background: #fff; color: #060608;
    font-family: 'Outfit', sans-serif;
    font-size: 14px; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
    border: none; border-radius: 4px;
    cursor: pointer; text-decoration: none;
    transition: all 0.25s cubic-bezier(.23,1,.32,1);
    position: relative; overflow: hidden;
  }
  .cta-primary::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
    opacity: 0; transition: opacity 0.25s;
  }
  .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(255,255,255,0.18); }
  .cta-primary:hover::before { opacity: 1; }

  .cta-secondary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 15px 28px;
    background: transparent; color: rgba(255,255,255,0.7);
    font-family: 'Outfit', sans-serif;
    font-size: 14px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px; cursor: pointer; text-decoration: none;
    transition: all 0.25s;
  }
  .cta-secondary:hover {
    border-color: rgba(255,255,255,0.4);
    color: #fff;
    transform: translateY(-2px);
  }

  .feat-item {
    border-top: 1px solid rgba(255,255,255,0.07);
    padding: 28px 0;
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 20px;
    align-items: start;
    cursor: default;
    transition: background 0.2s;
  }
  .feat-item:hover { background: rgba(255,255,255,0.02); }

  .stat-card {
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 2px;
    padding: 32px 28px;
    transition: border-color 0.3s, background 0.3s;
  }
  .stat-card:hover {
    border-color: rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.03);
  }

  .img-card {
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
  }
  .img-card img {
    width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(.23,1,.32,1);
    display: block;
  }
  .img-card:hover img { transform: scale(1.05); }
  .img-card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.72) 100%);
    opacity: 0; transition: opacity 0.3s;
  }
  .img-card:hover .img-card-overlay { opacity: 1; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #060608; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
`;

/* ── Noise overlay ──────────────────────────────────────── */
function NoiseOverlay() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width = 256, H = c.height = 256;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 18;
    }
    ctx.putImageData(img, 0, 0);
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      width: "100%", height: "100%",
      imageRendering: "pixelated", opacity: 0.4,
    }}/>
  );
}

/* ── Animated grid lines ─────────────────────────────────── */
function GridLines() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
      `,
      backgroundSize: "80px 80px",
    }}/>
  );
}

/* ── Navbar ──────────────────────────────────────────────── */
function Navbar() {
  const loc = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      height: 64,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 48px",
      background: scrolled ? "rgba(6,6,8,0.94)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      transition: "all 0.4s ease",
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          background: "#fff",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          flexShrink: 0,
        }}/>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 22, color: "#fff", letterSpacing: 4,
        }}>AYBO INC</span>
      </Link>

      {/* Links */}
      <div style={{ display: "flex", gap: 36 }}>
        {[["/" , "Home"], ["/designer", "Designer"], ["#features", "Features"], ["#gallery", "Gallery"]].map(([to, label]) => (
          <a key={to} href={to.startsWith("#") ? to : undefined}
            onClick={to.startsWith("#") ? undefined : undefined}
            className={`nav-item${loc.pathname === to ? " active" : ""}`}
            style={{ textDecoration: "none" }}
            {...(!to.startsWith("#") ? { href: to, as: "a" } : {})}
          >
            {label}
          </a>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#4ade80",
          boxShadow: "0 0 0 0 rgba(74,222,128,0.4)",
          animation: "pulseRing 2s ease-out infinite",
          position: "relative",
        }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80" }}/>
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>LIVE</span>
        <Link to="/designer" className="cta-primary" style={{ marginLeft: 12, padding: "9px 20px", fontSize: 12 }}>
          Open Designer
        </Link>
      </div>
    </nav>
  );
}

/* ── Ticker ──────────────────────────────────────────────── */
function Ticker() {
  const items = ["2D Floor Plans", "3D Visualization", "FPS Walkthrough", "AI Generation", "Real-time Collaboration", "PDF Export", "VR Mode", "Professional Tools"];
  const repeated = [...items, ...items];
  return (
    <div style={{
      overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(255,255,255,0.02)",
      padding: "14px 0", whiteSpace: "nowrap",
    }}>
      <div style={{ display: "inline-flex", animation: "ticker 28s linear infinite", gap: 0 }}>
        {repeated.map((item, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 24, padding: "0 32px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>{item}</span>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 18 }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Stat ────────────────────────────────────────────────── */
function StatCard({ num, label, sub, delay }) {
  return (
    <div className="stat-card" style={{ animation: `counterUp 0.8s ease both`, animationDelay: delay }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 56, color: "#fff", letterSpacing: 2, lineHeight: 1,
        marginBottom: 10,
      }}>{num}</div>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {sub && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Feature row ─────────────────────────────────────────── */
function FeatRow({ num, icon, title, desc, tag }) {
  return (
    <div className="feat-item">
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 13, color: "rgba(255,255,255,0.2)", letterSpacing: 2, paddingTop: 4,
      }}>{num}</div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, color: "#fff", fontWeight: 600 }}>{title}</span>
          {tag && <span style={{
            padding: "2px 10px", borderRadius: 2,
            background: "rgba(255,255,255,0.07)",
            fontFamily: "'Outfit', sans-serif", fontSize: 10,
            color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase",
          }}>{tag}</span>}
        </div>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 520 }}>{desc}</p>
      </div>
      <div style={{
        width: 32, height: 32, border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.3)", fontSize: 14, flexShrink: 0,
      }}>→</div>
    </div>
  );
}

/* ── Image card ──────────────────────────────────────────── */
function ImgCard({ src, label, style }) {
  return (
    <div className="img-card" style={style}>
      <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
      <div className="img-card-overlay"/>
      <div style={{
        position: "absolute", bottom: 16, left: 16,
        fontFamily: "'Outfit', sans-serif", fontSize: 12,
        color: "rgba(255,255,255,0.7)", letterSpacing: 1, textTransform: "uppercase",
        opacity: 0, transition: "opacity 0.3s",
      }} className="img-label">{label}</div>
    </div>
  );
}

/* ── Home ────────────────────────────────────────────────── */
function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "#060608", color: "#fff", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", padding: "0 48px 80px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Big background number */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(200px, 30vw, 420px)",
          color: "rgba(255,255,255,0.025)",
          userSelect: "none", pointerEvents: "none",
          letterSpacing: -10, lineHeight: 1,
          whiteSpace: "nowrap",
        }}>AYBO</div>

        {/* Rotating ring */}
        <div style={{
          position: "absolute", top: "12%", right: "8%",
          width: 200, height: 200,
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "50%",
          animation: "rotateSlow 30s linear infinite",
        }}>
          <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }}/>
        </div>
        <div style={{
          position: "absolute", top: "14%", right: "9.5%",
          width: 160, height: 160,
          border: "1px dashed rgba(255,255,255,0.04)",
          borderRadius: "50%",
          animation: "rotateSlow 20s linear infinite reverse",
        }}/>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          marginBottom: 36, alignSelf: "flex-start",
          animation: "fadeIn 1s ease both 0.2s",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }}/>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textTransform: "uppercase" }}>
            Architecture Platform · Beta
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(72px, 12vw, 180px)",
          lineHeight: 0.88, letterSpacing: -2,
          color: "#fff", marginBottom: 0,
          animation: "fadeUp 1s ease both 0.1s",
        }}>
          Design.<br/>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>Build.</span><br/>
          Explore.
        </h1>

        {/* Subtext + CTA side by side */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", marginTop: 40,
          flexWrap: "wrap", gap: 32,
          animation: "fadeUp 1s ease both 0.3s",
        }}>
          <div style={{ maxWidth: 480 }}>
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 17, color: "rgba(255,255,255,0.45)",
              lineHeight: 1.75, marginBottom: 28,
            }}>
              AYBO INC est la plateforme de conception architecturale qui vous permet de
              dessiner en 2D, visualiser en 3D et vous déplacer à l'intérieur de vos projets.
              Précision professionnelle. Interface radicale.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <Link to="/designer" className="cta-primary">
                Open Designer <span style={{ fontSize: 18 }}>→</span>
              </Link>
              <a href="#features" className="cta-secondary">
                Learn More
              </a>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: "flex", gap: 40 }}>
            {[["25cm", "Précision"], ["2.8m", "Hauteur murs"], ["60fps", "Temps réel"]].map(([v, l]) => (
              <div key={l} style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: "#fff", letterSpacing: 2 }}>{v}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: "absolute", bottom: 32, right: 48,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          animation: "fadeIn 1s ease both 1s",
        }}>
          <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.15)" }}/>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: 2, writingMode: "vertical-rl", textTransform: "uppercase" }}>Scroll</span>
        </div>
      </section>

      {/* ── TICKER ── */}
      <Ticker/>

      {/* ── STATS ── */}
      <section style={{ padding: "100px 48px", maxWidth: 1240, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 1, background: "rgba(255,255,255,0.06)",
        }}>
          {[
            ["∞",   "Projets",    "Sans limite",          "0s"],
            ["100+","Outils",     "Design professionnel", "0.1s"],
            ["4",   "Modes",      "2D / 3D / FPS / VR",   "0.2s"],
            ["<1s", "Rendu",      "Temps réel",           "0.3s"],
          ].map(([n, l, s, d]) => (
            <StatCard key={l} num={n} label={l} sub={s} delay={d}/>
          ))}
        </div>
      </section>

      {/* ── IMAGE MOSAIC ── */}
      <section id="gallery" style={{ padding: "0 48px 100px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gridTemplateRows: "320px 280px",
          gap: 6,
        }}>
          <ImgCard
            src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80"
            label="Architecture"
            style={{ gridRow: "1 / 3" }}
          />
          <ImgCard
            src="https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=900&q=80"
            label="Interior"
          />
          <ImgCard
            src="https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80"
            label="Design"
          />
          <ImgCard
            src="https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80"
            label="Planning"
          />
          <ImgCard
            src="https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=900&q=80"
            label="3D View"
          />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "0 48px 100px", maxWidth: 1240, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 0 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>
              Fonctionnalités
            </div>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(40px, 6vw, 80px)", color: "#fff", letterSpacing: 2, lineHeight: 1 }}>
              Tout l'arsenal<br/>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>d'un architecte</span>
            </h2>
          </div>
          <Link to="/designer" className="cta-secondary" style={{ marginBottom: 8 }}>
            Start Building →
          </Link>
        </div>

        {/* Feature list */}
        <div style={{ marginTop: 20 }}>
          {[
            { num: "01", icon: "✏️", title: "Plan 2D architectural",      desc: "Grille 25cm, snap angulaire 0/45/90°, cotations temps réel, murs avec épaisseur réelle. Précis comme AutoCAD.", tag: "Core" },
            { num: "02", icon: "🏠", title: "Extrusion 3D automatique",   desc: "Votre plan 2D devient une vraie maison en 3D instantanément. Matériaux, ombres PCF, lumière solaire." },
            { num: "03", icon: "🚶", title: "Mode FPS immersif",           desc: "WASD + souris. Hauteur 1.65m. Sprint. Fog atmosphérique. Comme si vous étiez sur le chantier.", tag: "New" },
            { num: "04", icon: "🧠", title: "Génération IA",              desc: "Décrivez votre maison en langage naturel. L'IA génère automatiquement le plan complet.", tag: "Soon" },
            { num: "05", icon: "👥", title: "Collaboration temps réel",   desc: "Travaillez en équipe sur le même projet. WebSocket, curseurs des collaborateurs, historique des modifications." },
            { num: "06", icon: "📐", title: "Export professionnel",        desc: "PDF architectural, SVG vectoriel, DXF pour AutoCAD, images haute résolution." },
          ].map(f => <FeatRow key={f.num} {...f}/>)}
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}/>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section style={{
        margin: "0 48px 100px",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 4,
        padding: "80px 64px",
        background: "rgba(255,255,255,0.02)",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 32,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 320, height: 320,
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: "50%",
        }}/>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 5vw, 64px)", color: "#fff", letterSpacing: 2, lineHeight: 1.1, marginBottom: 16 }}>
            Prêt à concevoir<br/>votre espace ?
          </h2>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.4)", maxWidth: 400, lineHeight: 1.7 }}>
            Rejoignez les architectes, designers et particuliers qui créent avec AYBO INC.
          </p>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Link to="/designer" className="cta-primary">
            Ouvrir le Designer →
          </Link>
          <button className="cta-secondary" onClick={() => {}}>
            Voir la démo ▶
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: "48px 48px 40px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 40, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, background: "#fff", clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}/>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#fff", letterSpacing: 3 }}>AYBO INC</span>
              </div>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", maxWidth: 240, lineHeight: 1.7 }}>
                Plateforme de conception architecturale 3D propulsée par l'IA.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: 64, flexWrap: "wrap" }}>
              {[
                { title: "Produit",  links: ["Designer", "Tarifs", "Roadmap", "API"] },
                { title: "Société",  links: ["À propos", "Blog", "Careers", "Contact"] },
                { title: "Support",  links: ["Docs", "Tutoriels", "Status", "Discord"] },
              ].map(col => (
                <div key={col.title}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 18 }}>{col.title}</div>
                  {col.links.map(l => (
                    <div key={l} style={{ marginBottom: 12 }}>
                      <a href="#" style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "rgba(255,255,255,0.4)", textDecoration: "none", transition: "color 0.2s" }}
                        onMouseOver={e => e.target.style.color = "rgba(255,255,255,0.85)"}
                        onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.4)"}
                      >{l}</a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 16,
          }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
              © 2026 AYBO INC. Tous droits réservés.
            </span>

            {/* Signature */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.07)" }}/>
              <div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 18, letterSpacing: 3,
                  background: "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.4))",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>Ayoub Bouicha</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 2 }}>
                  Founder & CEO · AYBO INC
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────────── */
export default function App() {
  useEffect(() => {
    injectFont();
    const s = document.createElement("style");
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  return (
    <BrowserRouter>
      <NoiseOverlay/>
      <GridLines/>
      <Navbar/>
      <Routes>
        <Route path="/"         element={<Home/>}/>
        <Route path="/designer" element={<Designer/>}/>
      </Routes>
    </BrowserRouter>
  );
}
