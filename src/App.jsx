import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Download, Upload, Database, Map, BarChart2, ChevronLeft, ChevronRight, X, Pencil, Trash2, Camera, ChevronDown, Search, User, LogOut } from "lucide-react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, setPersistence, browserLocalStoragePersistence } from "firebase/auth";

// ─── Firebase Config ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA02DIbc9rAJwOmRfgphFYMWRcpnDI9xiY",
  authDomain: "monster-vault-2e691.firebaseapp.com",
  projectId: "monster-vault-2e691",
  storageBucket: "monster-vault-2e691.firebasestorage.app",
  messagingSenderId: "349413568305",
  appId: "1:349413568305:web:054c3002470332c9ea8a10",
};

const CLOUDINARY_CLOUD = "dy5c9xbxy";
const CLOUDINARY_PRESET = "monster-vault";

// ─── Firebase init ────────────────────────────────────────────────────────────
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function fbGetCans() {
  const q = query(collection(db, "cans"), orderBy("created_date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fbAddCan(data) {
  const ref = await addDoc(collection(db, "cans"), { ...data, created_date: new Date().toISOString() });
  return { id: ref.id, ...data };
}

async function fbUpdateCan(id, data) {
  await updateDoc(doc(db, "cans", id), data);
  return { id, ...data };
}

async function fbDeleteCan(id) {
  await deleteDoc(doc(db, "cans", id));
}

async function fbBulkAdd(cans) {
  const results = [];
  for (let i = 0; i < cans.length; i += 10) {
    const batch = cans.slice(i, i + 10);
    const added = await Promise.all(batch.map(c => addDoc(collection(db, "cans"), { ...c, created_date: new Date().toISOString() })));
    results.push(...added.map((r, j) => ({ id: r.id, ...batch[j] })));
  }
  return results;
}

// ─── Cloudinary upload ────────────────────────────────────────────────────────
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload fallito");
  return data.secure_url;
}

async function uploadBase64ToCloudinary(dataUrl) {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: formData });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload fallito");
  return data.secure_url;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    :root{
      --primary:#00ff41;--primary-dim:rgba(0,255,65,0.1);--primary-border:rgba(0,255,65,0.3);
      --bg:#050505;--card:#0d0d0d;--secondary:#111111;--border:#1f1f1f;
      --muted:#141414;--muted-fg:#666;--fg:#ccc;--destructive:#ff3333;--yellow:#ffbf00;
    }
    body{background:var(--bg);color:var(--fg);font-family:'Inter',sans-serif;}
    body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;
      background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:var(--bg);}
    ::-webkit-scrollbar-thumb{background:#1a3a1a;}
    ::-webkit-scrollbar-thumb:hover{background:var(--primary);}
    @keyframes pulse-glow{0%,100%{text-shadow:0 0 30px var(--primary),0 0 60px rgba(0,255,65,0.5);}50%{text-shadow:0 0 50px var(--primary),0 0 100px rgba(0,255,65,0.7);}}
    @keyframes spin{to{transform:rotate(360deg);}}
    .pulse-glow{animation:pulse-glow 3s ease-in-out infinite;}
    .spin{animation:spin 0.8s linear infinite;}
    input,select,textarea{font-family:'JetBrains Mono',monospace;}
    button{cursor:pointer;font-family:'JetBrains Mono',monospace;}
  `}</style>
);

const mono = { fontFamily: "JetBrains Mono, monospace" };
const orbitron = { fontFamily: "Inter, sans-serif", fontWeight: 900, letterSpacing: "0.05em" };

// ─── Toast ────────────────────────────────────────────────────────────────────
const ToastCtx = { listeners: [] };
const toast = {
  success: m => ToastCtx.listeners.forEach(f => f({ type: "success", msg: m })),
  error: m => ToastCtx.listeners.forEach(f => f({ type: "error", msg: m })),
  info: m => ToastCtx.listeners.forEach(f => f({ type: "info", msg: m })),
};
function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const h = t => { const id = Date.now(); setToasts(p => [...p, { ...t, id }]); setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000); };
    ToastCtx.listeners.push(h);
    return () => { ToastCtx.listeners = ToastCtx.listeners.filter(f => f !== h); };
  }, []);
  return (
    <div style={{ position: "fixed", bottom: 80, right: 16, zIndex: 9998, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type === "success" ? "#0a2a0a" : t.type === "info" ? "#0a1a2a" : "#2a0a0a", border: `1px solid ${t.type === "success" ? "#00ff41" : t.type === "info" ? "#00aaff" : "#ff3333"}`, color: t.type === "success" ? "#00ff41" : t.type === "info" ? "#00aaff" : "#ff3333", padding: "8px 16px", ...mono, fontSize: 11, letterSpacing: "0.1em", maxWidth: 300 }}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 24 }) {
  return <div className="spin" style={{ width: size, height: size, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", flexShrink: 0 }} />;
}

function Btn({ children, onClick, variant = "ghost", style = {}, disabled, ...p }) {
  const base = { ...mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 12px", border: "1px solid", display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.15s", background: "transparent", minHeight: 32, opacity: disabled ? 0.5 : 1 };
  const variants = { primary: { borderColor: "var(--primary)", color: "var(--primary)", background: "var(--primary-dim)" }, ghost: { borderColor: "var(--border)", color: "var(--muted-fg)" }, danger: { borderColor: "#3a1a1a", color: "var(--destructive)" } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }} {...p}>{children}</button>;
}

function MetaTag({ children }) {
  return <span style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", background: "var(--muted)", border: "1px solid var(--border)", padding: "2px 6px", whiteSpace: "nowrap" }}>{children}</span>;
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRedirectResult(auth).then(result => {
      // handled by onAuthStateChanged
    }).catch(e => {
      if (e.code !== 'auth/no-auth-event') setError(e.message);
    });
  }, []);

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      await setPersistence(auth, browserLocalStoragePersistence);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (e) {
      if (e.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
      } else {
        setError(e.message);
        setLoading(false);
      }
    }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "0 20px" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      <div className="pulse-glow" style={{ ...orbitron, fontSize: "clamp(4rem,12vw,10rem)", color: "var(--primary)", lineHeight: 1, marginBottom: 8 }}>M</div>
      <div style={{ ...mono, fontSize: 11, color: "#1a3a1a", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: 16 }}>VAULT PROTOCOL: ACTIVE</div>
      <h1 style={{ ...orbitron, fontSize: "clamp(1.5rem,5vw,2.5rem)", color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>MONSTER VAULT</h1>
      <p style={{ ...mono, fontSize: 12, color: "var(--muted-fg)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 48 }}>MONSTER_COLLECTOR05</p>
      <button onClick={handleLogin} disabled={loading} style={{ ...orbitron, fontSize: 13, background: "var(--primary)", color: "#000", border: "none", padding: "14px 48px", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)", display: "flex", alignItems: "center", gap: 12, opacity: loading ? 0.7 : 1 }}>
        {loading ? <Spinner size={16} /> : null}
        {loading ? "REINDIRIZZAMENTO..." : "ACCEDI CON GOOGLE"}
      </button>
      {error && <div style={{ ...mono, fontSize: 11, color: "var(--destructive)", marginTop: 16, maxWidth: 300, textAlign: "center" }}>{error}</div>}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: "vault", label: "VAULT", Icon: Database },
  { id: "mappa", label: "MAP", Icon: Map },
  { id: "stats", label: "STATS", Icon: BarChart2 },
];

function AppHeader({ page, setPage, totalCount, onAdd, onExport, onImport, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <header style={{ background: "var(--secondary)", borderBottom: "1px solid var(--primary-border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap" }}>
        <div style={{ ...orbitron, fontSize: 17, color: "var(--primary)" }}>⬡ MONSTER VAULT</div>
        {totalCount != null && <div style={{ ...mono, fontSize: 11, color: "#fff" }}>{totalCount} LATTINE</div>}
        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ ...mono, fontSize: 11, padding: "5px 12px", border: "1px solid", letterSpacing: "0.1em", textTransform: "uppercase", transition: "all 0.15s", background: "transparent", ...(page === n.id ? { borderColor: "var(--primary)", color: "var(--primary)", background: "var(--primary-dim)" } : { borderColor: "transparent", color: "#fff" }) }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        {onImport && <Btn onClick={onImport}><Upload size={12} /> Import</Btn>}
        {onExport && <Btn onClick={onExport}><Download size={12} /> Export</Btn>}
        {onAdd && <Btn onClick={onAdd} variant="primary"><Plus size={12} /> Aggiungi</Btn>}
        <div style={{ position: "relative" }}>
          <button onClick={() => setMenuOpen(v => !v)} style={{ border: "1px solid var(--border)", color: "var(--muted-fg)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", borderRadius: "50%", overflow: "hidden" }}>
            {user?.photoURL ? <img src={user.photoURL} style={{ width: 32, height: 32, objectFit: "cover" }} /> : <User size={14} />}
          </button>
          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 50, background: "var(--card)", border: "1px solid var(--border)", minWidth: 180 }}>
                {user && <div style={{ padding: "10px 12px", ...mono, fontSize: 10, color: "var(--muted-fg)", borderBottom: "1px solid var(--border)" }}>{user.email}</div>}
                <button onClick={() => { onLogout(); setMenuOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 12px", ...mono, fontSize: 11, color: "var(--destructive)", background: "transparent", border: "none", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  <LogOut size={12} /> Esci
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      <nav style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--secondary)", borderTop: "1px solid var(--primary-border)" }} className="mobile-nav">
        {NAV.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 0", background: "transparent", border: "none", color: page === n.id ? "var(--primary)" : "var(--muted-fg)", minHeight: 50 }}>
            <n.Icon size={20} />
            <span style={{ ...mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase" }}>{n.label}</span>
          </button>
        ))}
      </nav>
      <style>{`@media(max-width:640px){.mobile-nav{display:flex!important;}}`}</style>
    </>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ cans }) {
  const stats = [
    { num: cans.length, label: "TOTALE" },
    { num: new Set(cans.map(c => c.tipo_linea).filter(Boolean)).size, label: "LINEE" },
    { num: cans.filter(c => c.photos?.some(p => p)).length, label: "CON FOTO" },
    { num: cans.filter(c => c.piena_vuota === "FULL").length, label: "PIENE" },
    { num: cans.filter(c => c.piena_vuota === "EMPTY").length, label: "VUOTE" },
  ];
  return (
    <div style={{ display: "flex", gap: 16, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", flexWrap: "wrap" }}>
      {stats.map(s => <div key={s.label} style={{ ...mono, fontSize: 11, color: "#fff" }}><span style={{ color: "var(--primary)", fontWeight: 700, marginRight: 4 }}>{s.num}</span>{s.label}</div>)}
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "default", label: "ORDINE ORIGINALE" },
  { value: "name_az", label: "NOME A→Z" },
  { value: "name_za", label: "NOME Z→A" },
  { value: "sku_asc", label: "SKU 0→9 (più vecchio)" },
  { value: "sku_desc", label: "SKU 9→0 (più recente)" },
  { value: "tipo", label: "LINEA" },
];

function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...mono, fontSize: 11, background: "var(--muted)", border: "1px solid var(--border)", color: value ? "var(--primary)" : "var(--muted-fg)", padding: "5px 8px", letterSpacing: "0.08em" }}>
      <option value="">{placeholder}</option>
      {options.map(opt => <option key={typeof opt === "object" ? opt.value : opt} value={typeof opt === "object" ? opt.value : opt}>{typeof opt === "object" ? opt.label : opt}</option>)}
    </select>
  );
}

function FiltersBar({ cans, filters, setFilters, filteredCount }) {
  const tipos = [...new Set(cans.map(c => c.tipo_linea).filter(Boolean))].sort();
  const sizes = [...new Set(cans.map(c => c.size).filter(Boolean))].sort();
  const prods = [...new Set(cans.map(c => c.produttore).filter(Boolean))].sort();
  const aperture = [...new Set(cans.map(c => c.apertura).filter(Boolean))].sort();
  const update = (key, val) => setFilters(p => ({ ...p, [key]: val }));
  const reset = () => setFilters({ search: "", tipo: "", size: "", produttore: "", piena_vuota: "", apertura: "", sort: "default", photoOnly: false });
  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "8px 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#0e0e0e", overflowX: "auto" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search size={12} style={{ position: "absolute", left: 8, color: "var(--muted-fg)" }} />
        <input type="text" placeholder="Cerca nome, SKU..." value={filters.search} onChange={e => update("search", e.target.value)} style={{ ...mono, fontSize: 11, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--fg)", padding: "5px 8px 5px 24px", width: 180 }} />
      </div>
      <FilterSelect value={filters.tipo} onChange={v => update("tipo", v)} placeholder="TUTTE LE LINEE" options={tipos} />
      <FilterSelect value={filters.size} onChange={v => update("size", v)} placeholder="TUTTI I SIZE" options={sizes} />
      <FilterSelect value={filters.produttore} onChange={v => update("produttore", v)} placeholder="PRODUTTORI" options={prods} />
      <FilterSelect value={filters.piena_vuota} onChange={v => update("piena_vuota", v)} placeholder="PIENA/VUOTA" options={["FULL", "EMPTY"]} />
      <FilterSelect value={filters.apertura} onChange={v => update("apertura", v)} placeholder="APERTURE" options={aperture} />
      <button onClick={() => update("photoOnly", !filters.photoOnly)} style={{ ...mono, fontSize: 11, border: "1px solid", padding: "5px 10px", letterSpacing: "0.08em", background: "transparent", ...(filters.photoOnly ? { borderColor: "var(--primary)", color: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-fg)" }) }}>CON FOTO</button>
      <FilterSelect value={filters.sort} onChange={v => update("sort", v)} placeholder="ORDINA" options={SORT_OPTIONS} />
      <button onClick={reset} style={{ ...mono, fontSize: 11, border: "1px solid transparent", color: "var(--destructive)", padding: "5px 10px", background: "transparent", display: "flex", alignItems: "center", gap: 4 }}><X size={12} /> RESET</button>
      <div style={{ ...mono, fontSize: 11, color: "var(--muted-fg)", marginLeft: "auto", whiteSpace: "nowrap" }}>{filteredCount} / {cans.length}</div>
    </div>
  );
}

// ─── Can Card ─────────────────────────────────────────────────────────────────
function LazyImage({ src, alt }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ width: "100%", height: "100%" }}>{visible && <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>;
}

function CanCard({ can, onClick }) {
  const firstPhoto = can.photos?.find(p => p) || "";
  return (
    <div onClick={onClick} style={{ background: "var(--card)", cursor: "pointer", overflow: "hidden", transition: "background 0.15s" }}
      onMouseOver={e => e.currentTarget.style.background = "var(--secondary)"}
      onMouseOut={e => e.currentTarget.style.background = "var(--card)"}>
      <div style={{ width: "100%", paddingTop: "100%", position: "relative", overflow: "hidden", background: "var(--bg)" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {firstPhoto ? <LazyImage src={firstPhoto} alt={can.nome} /> : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--card), var(--muted))" }}>
              <span style={{ ...orbitron, fontSize: 48, color: "#1a3a1a", opacity: 0.5 }}>M</span>
            </div>
          )}
        </div>
        {can.tipo_linea && <span style={{ position: "absolute", top: 6, left: 6, ...mono, fontSize: 9, background: "rgba(0,0,0,0.85)", border: "1px solid var(--primary-border)", color: "var(--primary)", padding: "2px 6px", letterSpacing: "0.1em" }}>{can.tipo_linea}</span>}
        {can.piena_vuota && <span style={{ position: "absolute", top: 6, right: 6, ...mono, fontSize: 9, background: "rgba(0,0,0,0.85)", border: `1px solid ${can.piena_vuota === "FULL" ? "#ffbf00" : "#333"}`, color: can.piena_vuota === "FULL" ? "#ffbf00" : "#555", padding: "2px 6px", letterSpacing: "0.1em" }}>{can.piena_vuota}</span>}
      </div>
      <div style={{ padding: 10, borderTop: "1px solid var(--border)" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#d0d0d0", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{can.nome || "—"}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
          {can.sku && <span style={{ ...mono, fontSize: 10, color: "var(--primary)" }}>{can.sku}</span>}
          {can.sku && can.produttore && <span style={{ ...mono, fontSize: 10, color: "#333" }}>·</span>}
          {can.produttore && <span style={{ ...mono, fontSize: 10, color: "var(--muted-fg)" }}>{can.produttore}</span>}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {can.size && <MetaTag>{can.size}</MetaTag>}
          {can.lingua && <MetaTag>{can.lingua}</MetaTag>}
        </div>
        <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ width: 6, height: 6, border: `1px solid ${can.photos?.[i] ? "var(--primary)" : "var(--border)"}`, background: can.photos?.[i] ? "var(--primary)" : "transparent" }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Can Grid ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 60;
function CanGrid({ cans, onSelect }) {
  const [count, setCount] = useState(PAGE_SIZE);
  if (!cans.length) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>
      <div style={{ ...orbitron, fontSize: 64, color: "var(--border)", marginBottom: 16 }}>M</div>
      <div style={{ ...mono, color: "var(--muted-fg)" }}>Nessuna lattina trovata</div>
    </div>
  );
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1, background: "var(--border)" }}>
        {cans.slice(0, count).map(can => <CanCard key={can.id} can={can} onClick={() => onSelect(can)} />)}
      </div>
      {cans.length > count && (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Btn onClick={() => setCount(p => p + PAGE_SIZE)} variant="primary" style={{ padding: "10px 32px", fontSize: 12, letterSpacing: "0.15em" }}>CARICA ALTRI ▼</Btn>
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ can, open, onClose, onEdit, onDelete, onPrev, onNext }) {
  const [activePhoto, setActivePhoto] = useState(0);
  useEffect(() => { setActivePhoto(0); }, [can?.id]);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (e.key === "ArrowLeft") onPrev?.(); if (e.key === "ArrowRight") onNext?.(); if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, onPrev, onNext, onClose]);
  if (!can || !open) return null;
  const photos = can.photos?.length === 4 ? can.photos : ["", "", "", ""];
  const currentPhoto = photos[activePhoto] || photos.find(p => p) || "";
  const fields = [["TIPO LINEA", can.tipo_linea], ["NOME", can.nome], ["SKU", can.sku], ["PRODUTTORE", can.produttore], ["SIZE", can.size], ["LINGUA / PAESE", can.lingua], ["TOP / TAB", can.top_tab], ["PIENA / VUOTA", can.piena_vuota], ["APERTURA", can.apertura]];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--secondary)", border: "1px solid var(--primary-border)", width: "100%", maxWidth: 860, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,255,65,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--primary-border)", flexShrink: 0 }}>
          <Btn onClick={onPrev} style={{ padding: "4px 10px", fontSize: 11 }}><ChevronLeft size={12} />PREV</Btn>
          <div style={{ flex: 1, ...orbitron, fontSize: 13, color: "var(--primary)", textTransform: "uppercase", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{can.nome || "LATTINA"}</div>
          <Btn onClick={onNext} style={{ padding: "4px 10px", fontSize: 11 }}>NEXT<ChevronRight size={12} /></Btn>
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--muted-fg)", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}><X size={14} /></button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16 }}>
            <div>
              <div style={{ width: "100%", paddingTop: "100%", position: "relative", background: "var(--bg)", border: "1px solid var(--border)", marginBottom: 8, overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {currentPhoto ? <img src={currentPhoto} alt={can.nome} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ ...orbitron, fontSize: 64, color: "var(--border)" }}>M</span>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {photos.map((p, i) => (
                  <div key={i} onClick={() => p && setActivePhoto(i)} style={{ paddingTop: "100%", position: "relative", background: "var(--muted)", border: `1px solid ${i === activePhoto && p ? "var(--primary)" : "var(--border)"}`, cursor: p ? "pointer" : "default", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0 }}>
                      {p ? <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ position: "absolute", bottom: 2, right: 4, ...mono, fontSize: 9, color: "var(--border)" }}>+</span>}
                    </div>
                    <span style={{ position: "absolute", bottom: 2, right: 4, ...mono, fontSize: 9, color: "var(--muted-fg)" }}>{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {fields.map(([label, val]) => (
                <div key={label} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <div style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: label === "TIPO LINEA" || label === "SKU" ? "var(--primary)" : "#e0e0e0" }}>{val || "—"}</div>
                </div>
              ))}
            </div>
          </div>
          {(onEdit || onDelete) && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {onEdit && <Btn onClick={onEdit}><Pencil size={12} />MODIFICA</Btn>}
              {onDelete && <Btn onClick={onDelete} variant="danger"><Trash2 size={12} />ELIMINA</Btn>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
const APERTURA_OPTIONS = ["", "TOP", "BOTTOM", "TOP AND BOTTOM", "NO", "TAPPO", "BARCODE", "?"];
const PV_OPTIONS = ["", "FULL", "EMPTY", "?"];

function PhotoPreviewModal({ file, onConfirm, onCancel }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>ANTEPRIMA — così apparirà nella griglia</div>
      {/* Simulazione card */}
      <div style={{ width: 220, background: "var(--card)", border: "1px solid var(--border)" }}>
        <div style={{ width: "100%", paddingTop: "100%", position: "relative", overflow: "hidden", background: "var(--bg)" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {previewUrl && <img src={previewUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          {/* Guide overlay */}
          <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(0,255,65,0.6)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 2, height: "100%", background: "rgba(0,255,65,0.15)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "100%", height: 2, background: "rgba(0,255,65,0.15)", pointerEvents: "none" }} />
        </div>
        <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)" }}>
          <div style={{ ...mono, fontSize: 9, color: "var(--muted-fg)" }}>Così verrà mostrata</div>
        </div>
      </div>
      <div style={{ ...mono, fontSize: 10, color: "#444", marginTop: 12, marginBottom: 20, textAlign: "center", lineHeight: 1.6 }}>
        La foto viene ritagliata in formato quadrato.<br />Centra il soggetto nel riquadro verde.
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Btn onClick={onCancel} variant="danger"><X size={12} /> RIFARE</Btn>
        <Btn onClick={() => onConfirm(file)} variant="primary">✓ USA QUESTA FOTO</Btn>
      </div>
    </div>
  );
}

function EditModal({ can, open, onClose, onSave, allCans }) {
  const [form, setForm] = useState({ tipo_linea: "", nome: "", sku: "", produttore: "", size: "", lingua: "", top_tab: "", piena_vuota: "", apertura: "", photos: ["", "", "", ""] });
  const [uploading, setUploading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [subMenu, setSubMenu] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewSlot, setPreviewSlot] = useState(null);

  useEffect(() => {
    if (!open) return;
    setUploading(false);
    if (can) {
      setForm({ tipo_linea: can.tipo_linea || "", nome: can.nome || "", sku: can.sku || "", produttore: can.produttore || "", size: can.size || "", lingua: can.lingua || "", top_tab: can.top_tab || "", piena_vuota: can.piena_vuota || "", apertura: can.apertura || "", photos: can.photos?.length === 4 ? [...can.photos] : ["", "", "", ""] });
    } else {
      setForm({ tipo_linea: "", nome: "", sku: "", produttore: "", size: "", lingua: "", top_tab: "", piena_vuota: "", apertura: "", photos: ["", "", "", ""] });
    }
  }, [open, can]);

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleFileChange = async (e, slot) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    setPreviewFile(file);
    setPreviewSlot(slot);
  };

  const handleConfirmPhoto = async (file) => {
    const slot = previewSlot;
    setPreviewFile(null);
    setPreviewSlot(null);
    setUploading(true); setUploadingSlot(slot);
    try {
      const url = await uploadToCloudinary(file);
      setForm(p => { const np = [...p.photos]; np[slot] = url; return { ...p, photos: np }; });
      toast.success("Foto caricata su Cloudinary!");
    } catch (err) { toast.error("Errore upload: " + err.message); }
    finally { setUploading(false); setUploadingSlot(null); }
  };

  const removePhoto = (i) => { const np = [...form.photos]; np[i] = ""; update("photos", np); };
  const handleSave = () => {
    if (!form.tipo_linea.trim()) { toast.error("TIPO LINEA è obbligatorio"); return; }
    onSave({ ...form, tipo_linea: form.tipo_linea.trim().toUpperCase() });
  };

  const tipos = [...new Set((allCans || []).map(c => c.tipo_linea).filter(Boolean))].sort();
  const prods = [...new Set((allCans || []).map(c => c.produttore).filter(Boolean))].sort();
  const sizes = [...new Set((allCans || []).map(c => c.size).filter(Boolean))].sort();

  if (!open) return null;
  return (
    <>
    {previewFile && <PhotoPreviewModal file={previewFile} onConfirm={handleConfirmPhoto} onCancel={() => { setPreviewFile(null); setPreviewSlot(null); }} />}
    <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "var(--secondary)", borderTop: "1px solid var(--primary-border)", width: "100%", maxWidth: 640, maxHeight: "95vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--primary-border)", flexShrink: 0 }}>
          <div style={{ flex: 1, ...orbitron, fontSize: 13, color: "var(--primary)", textTransform: "uppercase" }}>{can ? "MODIFICA LATTINA" : "AGGIUNGI LATTINA"}</div>
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--muted-fg)", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}><X size={14} /></button>
        </div>
        <div style={{ overflow: "auto", flex: 1, padding: 16, paddingBottom: 32 }}>
          {/* Photos */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>FOTO (4 SLOT) — Cloudinary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {form.photos.map((url, i) => (
                <div key={i} style={{ paddingTop: "100%", position: "relative", overflow: "hidden" }}>
                  {url ? (
                    <div style={{ position: "absolute", inset: 0 }}>
                      <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, background: "rgba(200,0,0,0.8)", color: "#fff", border: "none", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>
                    </div>
                  ) : (
                    <label style={{ position: "absolute", inset: 0, background: uploadingSlot === i ? "rgba(0,255,65,0.05)" : "var(--muted)", border: `1px dashed ${uploadingSlot === i ? "var(--primary)" : "var(--border)"}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      {uploadingSlot === i ? <Spinner size={16} /> : <Camera size={16} style={{ color: "var(--border)" }} />}
                      <span style={{ ...mono, fontSize: 9, color: "var(--muted-fg)" }}>{uploadingSlot === i ? "..." : `FOTO ${i + 1}`}</span>
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFileChange(e, i)} disabled={uploading} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ key: "tipo_linea", label: "TIPO LINEA *", list: tipos }, { key: "nome", label: "NOME" }, { key: "sku", label: "SKU" }, { key: "produttore", label: "PRODUTTORE", list: prods }, { key: "size", label: "SIZE", list: sizes }, { key: "lingua", label: "LINGUA / PAESE" }, { key: "top_tab", label: "TOP/TAB" }].map(({ key, label, list }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</label>
                <input type="text" value={form[key]} onChange={e => update(key, e.target.value)} list={list ? `dl-${key}` : undefined}
                  style={{ ...mono, fontSize: 13, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--fg)", padding: "6px 8px", outline: "none", width: "100%" }}
                  onFocus={e => e.target.style.borderColor = "var(--primary)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
                {list && <datalist id={`dl-${key}`}>{list.map(v => <option key={v} value={v} />)}</datalist>}
              </div>
            ))}
            {[{ key: "piena_vuota", label: "PIENA/VUOTA", options: PV_OPTIONS }, { key: "apertura", label: "APERTURA", options: APERTURA_OPTIONS }].map(({ key, label, options }) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</label>
                <div style={{ position: "relative" }}>
                  <button type="button" onClick={() => setSubMenu(subMenu === key ? null : key)} style={{ ...mono, fontSize: 13, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--fg)", padding: "6px 8px", width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{form[key] || "—"}</span><ChevronDown size={12} style={{ color: "var(--muted-fg)" }} />
                  </button>
                  {subMenu === key && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--card)", border: "1px solid var(--border)", zIndex: 120, maxHeight: 200, overflow: "auto" }}>
                      {options.map(opt => <button key={opt} onClick={() => { update(key, opt); setSubMenu(null); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", ...mono, fontSize: 12, background: form[key] === opt ? "var(--primary-dim)" : "transparent", color: form[key] === opt ? "var(--primary)" : "var(--fg)", border: "none" }}>{opt || "— Nessuno —"}</button>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
            <Btn onClick={onClose}>ANNULLA</Btn>
            <Btn onClick={handleSave} variant="primary" disabled={uploading}>SALVA</Btn>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ open, onClose, onImportDone, existingCans }) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;
    setLoading(true); setStatus("Lettura file..."); setProgress(0);
    try {
      const XLSX = window.XLSX;
      if (!XLSX) { setStatus("Errore: libreria XLSX non caricata"); setLoading(false); return; }
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      setStatus(`Trovate ${rows.length} righe, verifico duplicati...`);
      const existingKeys = new Set(existingCans.map(c => `${c.tipo_linea}|${c.nome}|${c.sku}`));
      const mapped = rows.map(r => ({
        tipo_linea: String(r["TIPO LINEA"] || "").trim().toUpperCase(),
        nome: String(r["NOME"] || "").trim(),
        sku: String(r["SKU"] || "").replace(/\.0$/, "").trim(),
        produttore: String(r["PRODUTTORE"] || "").trim(),
        size: String(r["SIZE"] || "").trim(),
        lingua: String(r["LINGUA"] || "").trim(),
        top_tab: String(r["TOP/TAB"] || "").trim(),
        piena_vuota: String(r["PIENA/VUOTA"] || "").trim(),
        apertura: String(r["APERTURA"] || "").trim(),
        photos: ["", "", "", ""],
      })).filter(r => r.tipo_linea && !existingKeys.has(`${r.tipo_linea}|${r.nome}|${r.sku}`));

      if (mapped.length === 0) { setStatus(`✓ Nessuna nuova lattina (${rows.length} già esistenti)`); setLoading(false); return; }

      setStatus(`Importo ${mapped.length} nuove lattine su Firebase...`);
      const BATCH = 20;
      let done = 0;
      const all = [];
      for (let i = 0; i < mapped.length; i += BATCH) {
        const batch = mapped.slice(i, i + BATCH);
        const added = await fbBulkAdd(batch);
        all.push(...added);
        done += batch.length;
        setProgress(Math.round(done / mapped.length * 100));
        setStatus(`Importate ${done} / ${mapped.length} lattine...`);
      }
      toast.success(`Import completato: ${mapped.length} lattine aggiunte!`);
      setStatus(`✓ Importate ${mapped.length} lattine (${rows.length - mapped.length} già esistenti)`);
      onImportDone(all);
    } catch (err) { setStatus("Errore: " + err.message); toast.error("Errore import"); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--secondary)", border: "1px solid var(--primary-border)", width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--primary-border)" }}>
          <div style={{ flex: 1, ...orbitron, fontSize: 13, color: "var(--primary)", textTransform: "uppercase" }}>IMPORTA XLSX → FIREBASE</div>
          <button onClick={onClose} style={{ border: "1px solid var(--border)", color: "var(--muted-fg)", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent" }}><X size={14} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <div onClick={() => !loading && fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
            style={{ border: "2px dashed var(--primary-border)", padding: "40px 20px", textAlign: "center", cursor: loading ? "default" : "pointer", ...mono, fontSize: 11, color: "var(--muted-fg)" }}>
            <Upload size={28} style={{ margin: "0 auto 8px", color: "var(--muted-fg)", display: "block" }} />
            Trascina il file Excel qui<br />
            <span style={{ color: "var(--primary)" }}>oppure clicca per selezionare</span><br />
            <span style={{ color: "#444", marginTop: 4, display: "block" }}>.xlsx .xls</span>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => processFile(e.target.files?.[0])} />
          <p style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", marginTop: 12, lineHeight: 1.6 }}>
            I dati vengono salvati su Firebase. Le foto si aggiungono dopo, senza limiti.
          </p>
          {loading && progress > 0 && (
            <div style={{ marginTop: 10, height: 4, background: "var(--border)", borderRadius: 2 }}>
              <div style={{ height: "100%", background: "var(--primary)", width: `${progress}%`, transition: "width 0.3s", borderRadius: 2 }} />
            </div>
          )}
          {status && <div style={{ marginTop: 10, ...mono, fontSize: 11, color: status.startsWith("Errore") ? "var(--destructive)" : "var(--primary)", display: "flex", alignItems: "center", gap: 8 }}>{loading && <Spinner size={12} />}{status}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Page ───────────────────────────────────────────────────────────────
const STAT_COLORS = ["#adff2f","#00e5ff","#ff6600","#ff69b4","#a855f7","#00ff88","#ffd700","#ff4444","#00bfff","#90ee90","#ff8c00","#da70d6","#7fff00","#40e0d0","#ff1493","#87ceeb","#ffa07a","#98fb98","#dda0dd","#f0e68c"];

function groupByStat(arr, key) {
  const map = {};
  arr.forEach(c => { const k = c[key] || "N/D"; map[k] = (map[k] || 0) + 1; });
  return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function DonutChart({ data, total }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const top10 = data.slice(0, 10);
    const rest = total - top10.reduce((s, d) => s + d.count, 0);
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "doughnut",
      data: { labels: [...top10.map(d => d.name), ...(rest > 0 ? ["Altri"] : [])], datasets: [{ data: [...top10.map(d => d.count), ...(rest > 0 ? [rest] : [])], backgroundColor: [...top10.map((_, i) => STAT_COLORS[i % STAT_COLORS.length]), ...(rest > 0 ? ["#222"] : [])], borderWidth: 0, hoverOffset: 3 }] },
      options: { responsive: false, cutout: "72%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } } } }
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data, total]);
  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <canvas ref={canvasRef} width={130} height={130} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
        <div style={{ ...orbitron, fontSize: 20, color: "#fff", lineHeight: 1 }}>{total}</div>
        <div style={{ ...mono, fontSize: 9, color: "#555", letterSpacing: "0.1em", marginTop: 2 }}>total</div>
      </div>
    </div>
  );
}

function StatSection({ title, data, filterKey, onFilter }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = data[0]?.count || 1;
  return (
    <div style={{ borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ ...mono, fontSize: 10, color: "#444", letterSpacing: "0.18em", textTransform: "uppercase", padding: "20px 20px 16px" }}>{title}</div>
      <div style={{ display: "flex", gap: 20, padding: "0 20px 20px", alignItems: "flex-start" }}>
        <DonutChart data={data} total={total} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          {data.slice(0, 10).map((d, i) => (
            <div key={d.name} onClick={() => onFilter(filterKey, d.name)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: STAT_COLORS[i % STAT_COLORS.length], flexShrink: 0 }} />
              <div style={{ flex: 1, ...mono, fontSize: 11, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ ...mono, fontSize: 12, color: "#fff", fontWeight: 700, marginRight: 4 }}>{d.count}</div>
              <div style={{ ...mono, fontSize: 11, color: "#444" }}>→</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 20px 8px" }}>
        {data.slice(0, 10).map((d, i) => (
          <div key={d.name} onClick={() => onFilter(filterKey, d.name)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", cursor: "pointer", borderRadius: 4 }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ ...mono, fontSize: 10, color: "#666", width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ flex: 1, height: 14, background: "#1a1a1a", borderRadius: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 7, background: STAT_COLORS[i % STAT_COLORS.length], width: `${Math.round(d.count / max * 100)}%`, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ ...mono, fontSize: 11, color: "#ccc", width: 36, textAlign: "right", flexShrink: 0 }}>{d.count}</div>
            <div style={{ ...mono, fontSize: 11, color: "#444", flexShrink: 0 }}>→</div>
          </div>
        ))}
      </div>
      <div style={{ height: 16 }} />
    </div>
  );
}

function StatsPage({ cans, page, setPage, onFilterApply }) {
  const [scriptLoaded, setScriptLoaded] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) { setScriptLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = () => setScriptLoaded(true);
    document.head.appendChild(s);
  }, []);

  const data = useMemo(() => ({
    total: cans.length,
    withPhoto: cans.filter(c => c.photos?.some(p => p)).length,
    full: cans.filter(c => c.piena_vuota === "FULL").length,
    empty: cans.filter(c => c.piena_vuota === "EMPTY").length,
    lines: new Set(cans.map(c => c.tipo_linea).filter(Boolean)).size,
    countries: new Set(cans.map(c => c.lingua).filter(Boolean)).size,
    byLingua: groupByStat(cans, "lingua"), bySize: groupByStat(cans, "size"),
    byProd: groupByStat(cans, "produttore"), byLine: groupByStat(cans, "tipo_linea"),
    byApertura: groupByStat(cans, "apertura"), byTopTab: groupByStat(cans, "top_tab"),
  }), [cans]);

  const handleFilter = (key, value) => {
    const map = { lingua: "tipo", size: "size", produttore: "produttore", tipo_linea: "tipo", apertura: "apertura", piena_vuota: "piena_vuota" };
    const mapped = map[key]; if (mapped) onFilterApply && onFilterApply(mapped, value);
    setPage("vault");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <AppHeader page={page} setPage={setPage} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10, padding: "16px 20px" }}>
        {[{ l: "TOTALE", v: data.total, c: "#00ff41" }, { l: "LINEE", v: data.lines, c: "#00ff41" }, { l: "PAESI", v: data.countries, c: "#f87171" }, { l: "CON FOTO", v: data.withPhoto, sub: data.total ? Math.round(data.withPhoto / data.total * 100) + "%" : "", c: "#60a5fa" }, { l: "VUOTE", v: data.empty, sub: data.total ? Math.round(data.empty / data.total * 100) + "%" : "", c: "#4ade80" }, { l: "PIENE", v: data.full, sub: data.total ? Math.round(data.full / data.total * 100) + "%" : "", c: "#facc15" }].map(s => (
          <div key={s.l} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "12px 14px" }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: "0.15em", color: "#555", textTransform: "uppercase", marginBottom: 4 }}>{s.l}</div>
            <div style={{ ...orbitron, fontSize: 28, color: s.c, lineHeight: 1 }}>{s.v}</div>
            {s.sub && <div style={{ ...mono, fontSize: 10, color: "#444", marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: "#1a1a1a" }} />
      {!scriptLoaded ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div> : (
        [{ title: "BY COUNTRY / LANGUAGE", data: data.byLingua, key: "lingua" }, { title: "BY SIZE", data: data.bySize, key: "size" }, { title: "BY MANUFACTURER", data: data.byProd, key: "produttore" }, { title: "BY LINE", data: data.byLine, key: "tipo_linea" }, { title: "BY APERTURA", data: data.byApertura, key: "apertura" }, { title: "BY TOP/TAB", data: data.byTopTab, key: "top_tab" }]
          .filter(s => s.data.length > 0)
          .map(s => <StatSection key={s.key} title={s.title} data={s.data} filterKey={s.key} onFilter={handleFilter} />)
      )}
    </div>
  );
}

// ─── isOriginal filter ────────────────────────────────────────────────────────
const EXCLUDED_KEYWORDS = ['zero sugar', 'export', 'cuba-lima', 'tour', ' xg', 'hitman', 'spring'];
function isOriginal(can) {
  const t = (can.tipo_linea || '').toUpperCase().trim();
  const nome = (can.nome || '').toLowerCase();
  if (t.includes('BLACK')) {
    const hasOg = t.includes('OG') || t.includes('ORIGINAL') || nome.includes('og') || nome.includes('original');
    if (!hasOg) return false;
    if (EXCLUDED_KEYWORDS.some(kw => nome.includes(kw))) return false;
    return true;
  }
  if (t === 'ASIA' || t.startsWith('ASIA ') || t.includes(' ASIA')) {
    const hasOg = t.includes('OG') || t.includes('ORIGINAL') || nome.includes('og') || nome.includes('original');
    if (!hasOg) return false;
    return true;
  }
  const isOg = t === 'ORIGINAL' || t === 'OG' || t.startsWith('OG ') || t.startsWith('ORIGINAL ') || t.includes(' OG') || t.includes(' ORIGINAL');
  if (!isOg) return false;
  if (t.includes('PROMO') || t.includes('EXPORT') || t.includes('ZERO')) return false;
  if (EXCLUDED_KEYWORDS.some(kw => nome.includes(kw))) return false;
  return true;
}

// Lista completa paesi mancanti (lingua value → iso, nome, note)
const MISSING_COUNTRIES = [
  { lingua: 'TANZANIA',           iso: 'TZ', name: 'Tanzania',    note: 'Mancante' },
  { lingua: 'UKRAINE/MOLDOVA',    iso: 'MD', name: 'Moldova',     note: 'Solo UK/MD' },
  { lingua: 'INDONESIA',          iso: 'ID', name: 'Indonesia',   note: 'Mancante' },
  { lingua: 'THAILAND',           iso: 'TH', name: 'Thailand',    note: 'Mancante' },
  { lingua: 'JAMAICA',            iso: 'JM', name: 'Jamaica',     note: 'Mancante' },
  { lingua: 'SPAIN/PORTUGAL',     iso: 'PT', name: 'Portugal',    note: 'Solo ES/PT' },
  { lingua: 'CZECH REPUBLIC/SLOVAKIA', iso: 'CZ', name: 'Czech Rep.', note: 'Solo CZ/SK' },
  { lingua: 'CZECH REPUBLIC/SLOVAKIA', iso: 'SK', name: 'Slovakia',   note: 'Solo CZ/SK' },
  { lingua: 'BOLIVIA/PARAGUAY',   iso: 'BO', name: 'Bolivia',     note: 'Solo BO/PY' },
  { lingua: 'AUSTRALIA/NEW ZEALAND', iso: 'AU', name: 'Australia', note: 'Solo AU/NZ' },
];

function WorldMap({ cans, page, setPage, onSelectCan }) {
  const [geoData, setGeoData] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [search, setSearch] = useState("");
  const [filterPaese, setFilterPaese] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [filterStato, setFilterStato] = useState("");
  const [sort, setSort] = useState("nome");

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then(r => r.json()).then(setGeoData).catch(() => setGeoData(null));
  }, []);

  const originals = useMemo(() => cans.filter(isOriginal), [cans]);

  const { countryData, ownedISOs, totalCountries } = useMemo(() => {
    const map = {};
    originals.forEach(can => {
      normalizeLinguaAll(can.lingua).forEach(iso => {
        if (!map[iso]) map[iso] = { count: 0, cans: [] };
        map[iso].count++; map[iso].cans.push(can);
      });
    });
    return { countryData: map, ownedISOs: new Set(Object.keys(map)), totalCountries: Object.keys(map).length };
  }, [originals]);

  // Paesi mancanti dinamici — spariscono quando si aggiunge una lattina originale di quel paese
  const missingCountries = useMemo(() => {
    return MISSING_COUNTRIES.filter(mc => !ownedISOs.has(mc.iso));
  }, [ownedISOs]);

  // ISOs parziali (hanno solo edizioni combinate)
  const partialISOs = useMemo(() => {
    const partial = new Set();
    MISSING_COUNTRIES.forEach(mc => {
      if (mc.note !== 'Mancante' && !ownedISOs.has(mc.iso)) partial.add(mc.iso);
    });
    return partial;
  }, [ownedISOs]);

  const missingISOs = useMemo(() => {
    const missing = new Set();
    MISSING_COUNTRIES.forEach(mc => {
      if (mc.note === 'Mancante' && !ownedISOs.has(mc.iso)) missing.add(mc.iso);
    });
    return missing;
  }, [ownedISOs]);

  const allPaesi = useMemo(() => [...new Set(originals.map(c => c.lingua).filter(Boolean))].sort(), [originals]);
  const allSizes = useMemo(() => [...new Set(originals.map(c => c.size).filter(Boolean))].sort(), [originals]);

  const filteredCans = useMemo(() => {
    let r = [...originals];
    if (search) { const s = search.toLowerCase(); r = r.filter(c => (c.nome || '').toLowerCase().includes(s) || (c.sku || '').toLowerCase().includes(s) || (c.lingua || '').toLowerCase().includes(s)); }
    if (filterPaese) r = r.filter(c => c.lingua === filterPaese);
    if (filterSize) r = r.filter(c => c.size === filterSize);
    if (filterStato) r = r.filter(c => c.piena_vuota === filterStato);
    if (sort === 'nome') r.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    else if (sort === 'linea') r.sort((a, b) => (a.tipo_linea || '').localeCompare(b.tipo_linea || ''));
    else if (sort === 'sku') r.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));
    else if (sort === 'paese') r.sort((a, b) => (a.lingua || '').localeCompare(b.lingua || ''));
    return r;
  }, [originals, search, filterPaese, filterSize, filterStato, sort]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <AppHeader page={page} setPage={setPage} />

      {/* Stats bar */}
      <div style={{ padding: "6px 16px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "center" }}>
        {[
          { icon: "🥤", v: originals.length, l: "ORIGINAL TOTALI", c: "var(--primary)" },
          { icon: "📍", v: totalCountries, l: "PAESI", c: "#f87171" },
          { icon: "🟢", v: originals.filter(c => c.piena_vuota === "EMPTY").length, l: "VUOTE", c: "#4ade80" },
          { icon: "🟡", v: originals.filter(c => c.piena_vuota === "FULL").length, l: "PIENE", c: "#facc15" },
        ].map(({ icon, v, l, c }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ ...orbitron, fontSize: 20, color: c }}>{v}</span>
            <span style={{ ...mono, fontSize: 10, color: "var(--muted-fg)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Mappa */}
      <div style={{ width: "100%", height: "min(55vw,48vh)", minHeight: 200, borderBottom: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {!geoData
          ? <div style={{ ...mono, fontSize: 11, color: "var(--muted-fg)" }}>Caricamento mappa...</div>
          : <MapSVG geoData={geoData} ownedISOs={ownedISOs} missingISOs={missingISOs} partialISOs={partialISOs} countryData={countryData} tooltip={tooltip} setTooltip={setTooltip} />
        }
      </div>

      {/* Paesi mancanti */}
      {missingCountries.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ ...mono, fontSize: 10, color: "#ef4444", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
            ⚠ PAESI MANCANTI ({missingCountries.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 1, background: "var(--border)" }}>
            {missingCountries.map(mc => (
              <div key={mc.iso} style={{ background: "var(--card)", borderLeft: "2px solid #dc2626", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <img src={`https://flagcdn.com/20x15/${mc.iso.toLowerCase()}.png`} alt={mc.iso} style={{ width: 20, height: 15, objectFit: "cover", flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...mono, fontSize: 11, color: "#f87171", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mc.name}</div>
                  <div style={{ ...mono, fontSize: 9, color: "var(--muted-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mc.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, minWidth: 180 }}>
          <Search size={12} style={{ position: "absolute", left: 8, color: "var(--muted-fg)" }} />
          <input type="text" placeholder="Cerca per nome, SKU, paese..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...mono, fontSize: 11, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--fg)", padding: "5px 8px 5px 24px", width: "100%" }} />
        </div>
        <FilterSelect value={filterPaese} onChange={setFilterPaese} placeholder="— Paese —" options={allPaesi} />
        <FilterSelect value={filterSize} onChange={setFilterSize} placeholder="— Size —" options={allSizes} />
        <FilterSelect value={filterStato} onChange={setFilterStato} placeholder="— Stato —" options={["EMPTY", "FULL"]} />
        <FilterSelect value={sort} onChange={setSort} placeholder="Ordina" options={[
          { value: "nome", label: "A-Z Nome" }, { value: "linea", label: "A-Z Linea" },
          { value: "sku", label: "SKU" }, { value: "paese", label: "Paese" }
        ]} />
        <div style={{ ...mono, fontSize: 11, color: "var(--muted-fg)", whiteSpace: "nowrap" }}>{filteredCans.length} lattine su {originals.length}</div>
      </div>

      {/* Griglia lattine */}
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 1, background: "var(--border)" }}>
          {filteredCans.map(can => <CanCard key={can.id} can={can} onClick={() => onSelectCan && onSelectCan(can)} />)}
        </div>
      </div>
    </div>
  );
}

function MapSVG({ geoData, ownedISOs, missingISOs, partialISOs, countryData, tooltip, setTooltip }) {
  const W = 960, H = 420;
  const ISO3_TO_ISO2 = { "DEU":"DE","GBR":"GB","ITA":"IT","ESP":"ES","PRT":"PT","NLD":"NL","BEL":"BE","AUT":"AT","CHE":"CH","SWE":"SE","DNK":"DK","FIN":"FI","POL":"PL","CZE":"CZ","SVK":"SK","HUN":"HU","ROU":"RO","BGR":"BG","GRC":"GR","TUR":"TR","RUS":"RU","UKR":"UA","JPN":"JP","CHN":"CN","KOR":"KR","AUS":"AU","BRA":"BR","MEX":"MX","CAN":"CA","ARG":"AR","CHL":"CL","ZAF":"ZA","IND":"IN","IRL":"IE","HRV":"HR","SVN":"SI","SRB":"RS","LUX":"LU","MLT":"MT","CYP":"CY","EST":"EE","LVA":"LV","LTU":"LT","BLR":"BY","KAZ":"KZ","ISR":"IL","ARE":"AE","SAU":"SA","EGY":"EG","MAR":"MA","NGA":"NG","KEN":"KE","NZL":"NZ","THA":"TH","VNM":"VN","PHL":"PH","IDN":"ID","MYS":"MY","SGP":"SG","COL":"CO","PER":"PE","ECU":"EC","VEN":"VE","ISL":"IS","MKD":"MK","ALB":"AL","HKG":"HK","TWN":"TW","LKA":"LK","GEO":"GE","JOR":"JO","QAT":"QA","TZA":"TZ","JAM":"JM","MDA":"MD","KHM":"KH","DOM":"DO","CRI":"CR","GTM":"GT","URY":"UY","BOL":"BO","TTO":"TT","AZE":"AZ","AFG":"AF","USA":"US","FRA":"FR","NOR":"NO" };
  const NAME_TO_ISO = { "France":"FR","Norway":"NO","Germany":"DE","Italy":"IT","Spain":"ES","Portugal":"PT","United Kingdom":"GB","Netherlands":"NL","Belgium":"BE","Austria":"AT","Switzerland":"CH","Sweden":"SE","Denmark":"DK","Finland":"FI","Poland":"PL","Czech Republic":"CZ","Czechia":"CZ","Hungary":"HU","Romania":"RO","Bulgaria":"BG","Greece":"GR","Turkey":"TR","Türkiye":"TR","Russia":"RU","Russian Federation":"RU","Ukraine":"UA","Japan":"JP","China":"CN","South Korea":"KR","Republic of Korea":"KR","Australia":"AU","Brazil":"BR","Mexico":"MX","Canada":"CA","Argentina":"AR","Chile":"CL","South Africa":"ZA","India":"IN","Ireland":"IE","Croatia":"HR","Slovakia":"SK","Slovenia":"SI","Serbia":"RS","Estonia":"EE","Latvia":"LV","Lithuania":"LT","Belarus":"BY","Kazakhstan":"KZ","Israel":"IL","United Arab Emirates":"AE","Saudi Arabia":"SA","Egypt":"EG","Morocco":"MA","Nigeria":"NG","Kenya":"KE","New Zealand":"NZ","Thailand":"TH","Viet Nam":"VN","Vietnam":"VN","Philippines":"PH","Indonesia":"ID","Malaysia":"MY","Singapore":"SG","Colombia":"CO","Peru":"PE","Ecuador":"EC","Venezuela":"VE","Iceland":"IS","North Macedonia":"MK","Albania":"AL","Taiwan":"TW","Georgia":"GE","Jordan":"JO","Qatar":"QA","Tanzania":"TZ","Jamaica":"JM","Moldova":"MD","Cambodia":"KH","Dominican Republic":"DO","Costa Rica":"CR","Guatemala":"GT","Uruguay":"UY","Bolivia":"BO","Trinidad and Tobago":"TT","Azerbaijan":"AZ","Afghanistan":"AF","United States of America":"US","United States":"US" };

  const getISO = props => {
    const a2 = props["ISO3166-1-Alpha-2"] || props.ISO_A2 || props.iso_a2 || "";
    if (a2 && a2 !== "-99" && a2 !== "-1") return a2.toUpperCase();
    const a3 = props["ISO3166-1-Alpha-3"] || props.ISO_A3 || props.iso_a3 || "";
    if (a3 && ISO3_TO_ISO2[a3.toUpperCase()]) return ISO3_TO_ISO2[a3.toUpperCase()];
    const name = props.name || props.NAME || props.ADMIN || props.SOVEREIGNT || "";
    return NAME_TO_ISO[name] || null;
  };

  const LAT_MAX = 85, LAT_MIN = -60;
  const project = ([lon, lat]) => [(lon + 180) / 360 * W, (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * H];
  const pathFromCoords = coords => coords.map(ring => ring.map((pt, i) => { const [x, y] = project(pt); return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ") + "Z").join(" ");
  const featureToPath = f => { const { type, coordinates } = f.geometry; if (type === "Polygon") return pathFromCoords(coordinates); if (type === "MultiPolygon") return coordinates.map(c => pathFromCoords(c)).join(" "); return ""; };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", background: "var(--bg)" }} preserveAspectRatio="xMidYMid meet">
        {geoData.features.map((feature, i) => {
          const iso = getISO(feature.properties);
          const owned = iso ? ownedISOs.has(iso) : false;
          const missing = iso ? missingISOs.has(iso) : false;
          const partial = iso ? partialISOs.has(iso) : false;
          const count = (iso && countryData[iso]?.count) || 0;
          const d = featureToPath(feature); if (!d) return null;
          const fill = partial ? "hsl(48,96%,50%)" : owned ? `hsl(142,70%,${Math.max(28, 52 - count * 2)}%)` : missing ? "hsl(0,72%,38%)" : "hsl(0,0%,10%)";
          const stroke = partial ? "hsl(48,80%,30%)" : owned ? "hsl(142,60%,18%)" : missing ? "hsl(0,60%,25%)" : "hsl(0,0%,18%)";
          const interactive = owned || missing || partial;
          return <path key={i} d={d} fill={fill} stroke={stroke} strokeWidth="0.5"
            onMouseEnter={e => { if (interactive && iso) setTooltip({ iso, count, x: e.clientX, y: e.clientY, cans: countryData[iso]?.cans, missing, partial }); }}
            onMouseMove={e => { if (interactive) setTooltip(p => p ? { ...p, x: e.clientX, y: e.clientY } : p); }}
            onMouseLeave={() => setTooltip(null)} style={{ cursor: interactive ? "pointer" : "default" }} />;
        })}
      </svg>
      {tooltip && (
        <div style={{ position: "fixed", zIndex: 200, pointerEvents: "none", background: "var(--card)", border: "1px solid var(--primary-border)", padding: "8px 12px", ...mono, fontSize: 11, left: Math.min(tooltip.x + 14, window.innerWidth - 200), top: tooltip.y - 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <img src={`https://flagcdn.com/20x15/${tooltip.iso.toLowerCase()}.png`} alt={tooltip.iso} style={{ width: 20, height: 15 }} onError={e => e.target.style.display='none'} />
            <span style={{ color: tooltip.missing ? "#f87171" : tooltip.partial ? "#facc15" : "var(--primary)", fontWeight: 700 }}>{ISO_TO_NAME[tooltip.iso] || tooltip.iso}</span>
          </div>
          <div style={{ color: tooltip.missing ? "#f87171" : tooltip.partial ? "#facc15" : "var(--fg)" }}>
            {tooltip.missing ? "⚠ MANCANTE" : tooltip.partial ? "⚡ PARZIALE" : `${tooltip.count} lattine`}
          </div>
          {tooltip.cans?.slice(0, 4).map((c, i) => <div key={i} style={{ color: "var(--muted-fg)", fontSize: 10 }}>{c.nome || c.tipo_linea}</div>)}
          {tooltip.cans?.length > 4 && <div style={{ color: "var(--muted-fg)", fontSize: 10 }}>+{tooltip.cans.length - 4} altre</div>}
        </div>
      )}
    </div>
  );
}

// ─── SKU parser (MMYY o MMYYY formato) ───────────────────────────────────────
// Es: "0121" = mese 01, anno 2021 → 202101
// Es: "023"  = mese 02, anno 2003 → 200302
function parseSku(sku) {
  if (!sku) return 999999;
  const s = String(sku).trim().replace(/\D/g, "");
  if (s.length === 4) {
    const mm = parseInt(s.slice(0, 2), 10);
    const yy = parseInt(s.slice(2, 4), 10);
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    return year * 100 + mm;
  }
  if (s.length === 3) {
    const mm = parseInt(s.slice(0, 1), 10);
    const yy = parseInt(s.slice(1, 3), 10);
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    return year * 100 + mm;
  }
  return parseInt(s, 10) || 999999;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const DEFAULT_FILTERS = { search: "", tipo: "", size: "", produttore: "", piena_vuota: "", apertura: "", sort: "default", photoOnly: false };

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cans, setCans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState("vault");
  const [detailCan, setDetailCan] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editCan, setEditCan] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [entered, setEntered] = useState(() => sessionStorage.getItem("vault_entered") === "1");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  useEffect(() => {
    if (user && entered) loadCans();
  }, [user, entered]);

  const loadCans = async () => {
    setLoading(true);
    try {
      const data = await fbGetCans();
      setCans(data.map(c => ({ ...c, sku: c.sku ? String(c.sku).replace(/\.0$/, "") : c.sku })));
    } catch (e) { toast.error("Errore caricamento: " + e.message); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCans([]); setEntered(false); sessionStorage.removeItem("vault_entered");
  };

  const filtered = useMemo(() => {
    let r = [...cans];
    if (filters.tipo) r = r.filter(c => c.tipo_linea === filters.tipo);
    if (filters.size) r = r.filter(c => c.size === filters.size);
    if (filters.produttore) r = r.filter(c => c.produttore === filters.produttore);
    if (filters.piena_vuota) r = r.filter(c => c.piena_vuota === filters.piena_vuota);
    if (filters.apertura) r = r.filter(c => c.apertura === filters.apertura);
    if (filters.photoOnly) r = r.filter(c => c.photos?.some(p => p));
    if (filters.search) { const s = filters.search.toLowerCase(); r = r.filter(c => (c.nome + " " + c.sku + " " + c.tipo_linea).toLowerCase().includes(s)); }
    if (filters.sort === "name_az") r.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    else if (filters.sort === "name_za") r.sort((a, b) => (b.nome || "").localeCompare(a.nome || ""));
    else if (filters.sort === "sku_asc") r.sort((a, b) => parseSku(a.sku) - parseSku(b.sku));
    else if (filters.sort === "sku_desc") r.sort((a, b) => parseSku(b.sku) - parseSku(a.sku));
    else if (filters.sort === "tipo") r.sort((a, b) => (a.tipo_linea || "").localeCompare(b.tipo_linea || ""));
    return r;
  }, [cans, filters]);

  const currentIndex = detailCan ? filtered.findIndex(c => c.id === detailCan.id) : -1;

  const handleSave = async (formData) => {
    try {
      if (editCan) {
        const updated = await fbUpdateCan(editCan.id, formData);
        setCans(prev => prev.map(c => c.id === editCan.id ? { ...c, ...formData } : c));
        toast.success("Lattina aggiornata ✓");
      } else {
        const created = await fbAddCan(formData);
        setCans(prev => [created, ...prev]);
        toast.success("Lattina aggiunta ✓");
      }
      setEditOpen(false);
    } catch (e) { toast.error("Errore salvataggio: " + e.message); }
  };

  const handleDelete = async () => {
    if (!detailCan || !window.confirm(`Eliminare "${detailCan.nome}"?`)) return;
    try {
      await fbDeleteCan(detailCan.id);
      setCans(prev => prev.filter(c => c.id !== detailCan.id));
      setDetailOpen(false); toast.success("Lattina eliminata");
    } catch (e) { toast.error("Errore eliminazione: " + e.message); }
  };

  const handleExport = () => {
    const XLSX = window.XLSX; if (!XLSX) { toast.error("Libreria XLSX non disponibile"); return; }
    const data = cans.map(c => ({ "TIPO LINEA": c.tipo_linea, "NOME": c.nome, "SKU": c.sku, "PRODUTTORE": c.produttore, "SIZE": c.size, "LINGUA": c.lingua, "TOP/TAB": c.top_tab, "PIENA/VUOTA": c.piena_vuota, "APERTURA": c.apertura }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "COLLEZIONE");
    XLSX.writeFile(wb, "monster_vault_export.xlsx");
    toast.success("Export completato ✓");
  };

  const handleFilterApply = (key, value) => setFilters({ ...DEFAULT_FILTERS, [key]: value });

  if (authLoading) return <><GlobalStyle /><div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div></>;
  if (!user) return <><GlobalStyle /><LoginScreen /><Toaster /></>;

  if (!entered) return (
    <>
      <GlobalStyle />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", textAlign: "center", padding: "0 20px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
        <div className="pulse-glow" style={{ ...orbitron, fontSize: "clamp(5rem,15vw,12rem)", color: "var(--primary)", lineHeight: 1, marginBottom: 8 }}>M</div>
        <div style={{ ...mono, fontSize: "clamp(0.65rem,2vw,0.9rem)", color: "#1a3a1a", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: 24 }}>VAULT PROTOCOL: ACTIVE</div>
        <h1 style={{ ...orbitron, fontSize: "clamp(1.5rem,5vw,3rem)", color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>MONSTER VAULT</h1>
        <p style={{ ...mono, fontSize: 14, color: "var(--muted-fg)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>MONSTER_COLLECTOR05</p>
        <p style={{ ...mono, fontSize: 11, color: "#1a3a1a", marginBottom: 40 }}>Benvenuto, {user.displayName}</p>
        <button onClick={() => { sessionStorage.setItem("vault_entered", "1"); setEntered(true); }} style={{ ...orbitron, fontSize: 13, background: "var(--primary)", color: "#000", border: "none", padding: "14px 48px", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)" }}>
          ENTRA NEL VAULT
        </button>
      </div>
      <Toaster />
    </>
  );

  if (page === "stats") return <><GlobalStyle /><StatsPage cans={cans} page={page} setPage={setPage} onFilterApply={handleFilterApply} /><Toaster /></>;
  if (page === "mappa") return <><GlobalStyle /><WorldMap cans={cans} page={page} setPage={setPage} onSelectCan={can => { setDetailCan(can); setDetailOpen(true); }} /><Toaster /></>;

  return (
    <>
      <GlobalStyle />
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        <AppHeader page={page} setPage={setPage} totalCount={cans.length} user={user} onLogout={handleLogout}
          onAdd={() => { setEditCan(null); setEditOpen(true); }}
          onExport={handleExport}
          onImport={() => setImportOpen(true)} />
        <StatsBar cans={cans} />
        <FiltersBar cans={cans} filters={filters} setFilters={setFilters} filteredCount={filtered.length} />
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner /></div>
        ) : (
          <CanGrid cans={filtered} onSelect={can => { setDetailCan(can); setDetailOpen(true); }} />
        )}
      </div>
      <DetailModal can={detailCan} open={detailOpen} onClose={() => setDetailOpen(false)}
        onEdit={() => { setEditCan(detailCan); setEditOpen(true); setDetailOpen(false); }}
        onDelete={handleDelete}
        onPrev={currentIndex > 0 ? () => setDetailCan(filtered[currentIndex - 1]) : null}
        onNext={currentIndex < filtered.length - 1 ? () => setDetailCan(filtered[currentIndex + 1]) : null} />
      <EditModal can={editCan} open={editOpen} onClose={() => setEditOpen(false)} onSave={handleSave} allCans={cans} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} existingCans={cans}
        onImportDone={newCans => { setCans(prev => [...newCans, ...prev]); setImportOpen(false); }} />
      <Toaster />
    </>
  );
}
