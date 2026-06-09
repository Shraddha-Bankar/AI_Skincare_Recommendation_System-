import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg:         "#FAF8F4",
  bgAlt:      "#F3EDE3",
  bgAlt2:     "#EDE5D8",
  surface:    "#FFFCF8",
  border:     "#E8DDD0",
  text:       "#1E1712",
  textSub:    "#4A3F35",
  muted:      "#8A7968",
  accent:     "#B8845A",
  accentDark: "#8C5E35",
  accentLight:"#F5E6D3",
  green:      "#6A8C69",
  greenLight: "#D4E8D3",
  gold:       "#C9A96E",
  rose:       "#C97A7A",
  lavender:   "#9B8EC4",
  navy:       "#3D4A6B",
  overlay:    "rgba(30,23,18,0.6)",
};

const DARK = {
  bg:         "#0F0C0A",
  bgAlt:      "#1A1410",
  bgAlt2:     "#221C16",
  surface:    "#181210",
  border:     "#2E2318",
  text:       "#F5EFE8",
  textSub:    "#C9BBA8",
  muted:      "#7A6A58",
  accent:     "#D4956A",
  accentDark: "#B8845A",
  accentLight:"#2E1E10",
  green:      "#7AAD79",
  greenLight: "#1A2E1A",
  gold:       "#D4B47A",
  rose:       "#D48A8A",
  lavender:   "#AD9ED4",
  navy:       "#6B7AAD",
  overlay:    "rgba(0,0,0,0.8)",
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const makeStyles = (C) => `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: ${C.bg}; --bg-alt: ${C.bgAlt}; --bg-alt2: ${C.bgAlt2};
    --surface: ${C.surface}; --border: ${C.border};
    --text: ${C.text}; --text-sub: ${C.textSub}; --muted: ${C.muted};
    --accent: ${C.accent}; --accent-dark: ${C.accentDark}; --accent-light: ${C.accentLight};
    --green: ${C.green}; --green-light: ${C.greenLight};
    --gold: ${C.gold}; --rose: ${C.rose}; --lavender: ${C.lavender}; --navy: ${C.navy};
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Outfit', sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    transition: background 0.4s ease, color 0.4s ease;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg-alt); }
  ::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }

  .serif { font-family: 'Playfair Display', Georgia, serif; }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
  @keyframes slideIn   { from { opacity:0; transform:translateX(-20px); } to { opacity:1; transform:translateX(0); } }
  @keyframes scaleIn   { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
  @keyframes spin      { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes pulse     { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
  @keyframes float     { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-10px);} }
  @keyframes shimmer   { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
  @keyframes glow      { 0%,100%{box-shadow:0 0 20px ${C.accent}40;} 50%{box-shadow:0 0 40px ${C.accent}80;} }
  @keyframes ripple    { to { transform:scale(4); opacity:0; } }
  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes barGrow   { from { width:0; } }
  @keyframes numberUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes borderSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes typing    {
    0%,100%{opacity:1;} 50%{opacity:0;}
  }

  .fade-up  { animation: fadeUp  0.55s cubic-bezier(.22,.68,0,1.2) both; }
  .fade-in  { animation: fadeIn  0.4s ease both; }
  .scale-in { animation: scaleIn 0.35s ease both; }
  .slide-in { animation: slideIn 0.4s ease both; }
  .floating { animation: float 4s ease-in-out infinite; }

  /* ── BUTTONS ── */
  .btn-primary {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, var(--accent), var(--accent-dark));
    color: #fff; border: none; border-radius: 3px;
    padding: 14px 32px;
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 600;
    letter-spacing: 1.5px; text-transform: uppercase;
    cursor: pointer; transition: all 0.25s ease;
  }
  .btn-primary::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, var(--accent-dark), var(--accent));
    opacity:0; transition: opacity 0.25s;
  }
  .btn-primary:hover::before { opacity:1; }
  .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px ${C.accent}40; }
  .btn-primary:active { transform:translateY(0); }
  .btn-primary:disabled { background: var(--muted); cursor:not-allowed; transform:none; box-shadow:none; }
  .btn-primary span { position:relative; z-index:1; }

  .btn-ghost {
    background: transparent; color: var(--accent);
    border: 1.5px solid var(--accent); border-radius: 3px;
    padding: 12px 28px;
    font-family: 'Outfit', sans-serif;
    font-size: 13px; font-weight: 500;
    letter-spacing: 1px; text-transform: uppercase;
    cursor: pointer; transition: all 0.2s ease;
  }
  .btn-ghost:hover { background: var(--accent); color: #fff; transform:translateY(-1px); }

  .btn-icon {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-alt); border: 1px solid var(--border);
    border-radius: 50%; cursor: pointer;
    transition: all 0.2s ease; font-size: 18px;
  }
  .btn-icon:hover { background: var(--accent-light); border-color: var(--accent); transform:scale(1.05); }

  /* ── CARDS ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; transition: all 0.25s ease;
  }
  .card-hover:hover { box-shadow: 0 12px 40px ${C.text}12; transform: translateY(-3px); }

  .glass-card {
    background: ${C.surface}CC;
    backdrop-filter: blur(16px);
    border: 1px solid ${C.border}80;
    border-radius: 6px;
  }

  /* ── INPUTS ── */
  .input-field {
    width: 100%; border: 1.5px solid var(--border);
    border-radius: 4px; padding: 12px 16px;
    font-family: 'Outfit', sans-serif; font-size: 14px;
    background: var(--surface); color: var(--text);
    resize: vertical; transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .input-field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px ${C.accent}18; }
  .input-field::placeholder { color: var(--muted); }

  /* ── OPTION CARDS ── */
  .option-card {
    background: var(--surface); border: 1.5px solid var(--border);
    border-radius: 6px; padding: 16px 20px;
    cursor: pointer; transition: all 0.2s ease; text-align: left;
    position: relative; overflow: hidden;
  }
  .option-card::after {
    content:''; position:absolute; inset:0;
    background: var(--accent); opacity:0;
    transition: opacity 0.2s;
  }
  .option-card:hover { border-color: var(--accent); transform:translateY(-1px); box-shadow:0 4px 16px ${C.accent}20; }
  .option-card.selected {
    border-color: var(--accent); background: var(--accent-light);
    box-shadow: 0 0 0 1px var(--accent), 0 4px 16px ${C.accent}25;
  }
  .option-card.selected::before {
    content: '✓'; position:absolute; top:8px; right:10px;
    width:20px; height:20px; border-radius:50%;
    background: var(--accent); color:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:700;
  }

  /* ── TAGS / BADGES ── */
  .tag {
    display: inline-block;
    background: var(--bg-alt); border: 1px solid var(--border);
    border-radius: 2px; padding: 3px 10px;
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .tag-accent { background: var(--accent-light); border-color: ${C.accent}40; color: var(--accent); }

  .ingredient-badge {
    display:inline-block; padding:3px 10px; border-radius:2px;
    font-size:10px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;
  }
  .badge-safe    { background:${C.greenLight}; color:${C.green}; }
  .badge-caution { background:#FEF3CD; color:#856404; }
  .badge-avoid   { background:#F8D7DA; color:#842029; }

  /* ── PROGRESS ── */
  .progress-bar { height:3px; background:var(--bg-alt2); border-radius:2px; overflow:hidden; }
  .progress-fill { height:100%; background:linear-gradient(90deg,var(--accent),var(--gold)); border-radius:2px; transition:width 0.6s cubic-bezier(.34,1.56,.64,1); }

  /* ── NAV ── */
  .nav {
    position:fixed; top:0; left:0; right:0; z-index:200;
    height:64px; display:flex; align-items:center;
    padding:0 40px; justify-content:space-between;
    background:${C.bg}E8; backdrop-filter:blur(16px) saturate(1.5);
    border-bottom:1px solid var(--border);
    transition: background 0.4s;
  }

  /* ── CONCERN CHIPS ── */
  .concern-chip {
    display:inline-flex; align-items:center; gap:6px;
    background:var(--bg-alt); border:1.5px solid var(--border);
    border-radius:24px; padding:7px 15px;
    font-size:13px; cursor:pointer; transition:all 0.2s; user-select:none;
  }
  .concern-chip:hover { border-color:var(--accent); color:var(--accent); transform:translateY(-1px); }
  .concern-chip.active { background:var(--accent-light); border-color:var(--accent); color:var(--accent); }

  /* ── ROUTINE STEP ── */
  .routine-step { display:flex; align-items:flex-start; gap:16px; padding:20px 0; border-bottom:1px solid var(--border); }
  .routine-step:last-child { border-bottom:none; }
  .step-num {
    width:36px; height:36px; border-radius:50%;
    background:var(--accent); color:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; flex-shrink:0;
  }

  /* ── TABS ── */
  .tab-bar { display:flex; border-bottom:1px solid var(--border); gap:0; overflow-x:auto; }
  .tab-bar::-webkit-scrollbar { height:0; }
  .tab-item {
    padding:13px 20px; font-size:13px; font-weight:500; letter-spacing:0.3px;
    cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s;
    color:var(--muted); background:none; white-space:nowrap;
    border-top:none; border-left:none; border-right:none;
    font-family:'Outfit',sans-serif;
  }
  .tab-item:hover { color:var(--text); }
  .tab-item.active { color:var(--accent); border-bottom-color:var(--accent); }

  /* ── TYPING DOTS ── */
  .typing-dots span {
    display:inline-block; width:6px; height:6px; border-radius:50%;
    background:var(--accent); margin:0 2px;
    animation:pulse 1.2s infinite;
  }
  .typing-dots span:nth-child(2) { animation-delay:0.2s; }
  .typing-dots span:nth-child(3) { animation-delay:0.4s; }

  /* ── SECTION LABEL ── */
  .section-label { font-size:10px; letter-spacing:3px; text-transform:uppercase; color:var(--muted); font-weight:600; }

  /* ── JOURNAL ENTRY ── */
  .journal-entry {
    padding:16px; border-radius:6px;
    background:var(--bg-alt); border:1px solid var(--border);
    transition:all 0.2s;
  }
  .journal-entry:hover { border-color:var(--accent); }

  /* ── CHAT BUBBLE ── */
  .chat-bubble-user { background:var(--accent); color:#fff; border-radius:18px 18px 4px 18px; padding:12px 16px; max-width:80%; align-self:flex-end; font-size:14px; line-height:1.5; }
  .chat-bubble-ai   { background:var(--bg-alt); border:1px solid var(--border); border-radius:18px 18px 18px 4px; padding:12px 16px; max-width:85%; align-self:flex-start; font-size:14px; line-height:1.6; }

  /* ── STREAK ── */
  .streak-day { width:32px; height:32px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; transition:all 0.2s; }
  .streak-done { background:var(--green); color:#fff; }
  .streak-today { background:var(--accent); color:#fff; box-shadow:0 0 12px ${C.accent}60; }
  .streak-missed { background:var(--bg-alt2); color:var(--muted); }
  .streak-future { background:var(--bg-alt); color:var(--border); border:1px dashed var(--border); }

  /* ── COMPARE ── */
  .compare-col { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:6px; overflow:hidden; transition:all 0.3s; }
  .compare-col:hover { border-color:var(--accent); box-shadow:0 8px 32px ${C.accent}15; }

  /* ── TOOLTIP ── */
  .tooltip-wrap { position:relative; display:inline-block; }
  .tooltip-content {
    position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
    background:var(--text); color:var(--bg); padding:6px 10px; border-radius:4px;
    font-size:12px; white-space:nowrap; pointer-events:none;
    opacity:0; transition:opacity 0.2s; z-index:999;
  }
  .tooltip-wrap:hover .tooltip-content { opacity:1; }

  /* ── SCROLLBAR STYLE ── */
  .thin-scroll::-webkit-scrollbar { width:3px; }
  .thin-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

  /* ── HERO GRAIN ── */
  .hero-grain {
    position:absolute; inset:0; pointer-events:none;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  }

  /* ── MOBILE ── */
  @media(max-width:768px) {
    .nav { padding:0 16px; }
    .hero-cols { grid-template-columns:1fr !important; }
    .results-grid { grid-template-columns:1fr !important; }
    .product-grid { grid-template-columns:1fr 1fr !important; }
    .routine-grid { grid-template-columns:1fr !important; }
    .compare-row  { flex-direction:column !important; }
    .tab-item { padding:12px 14px; font-size:12px; }
  }
  @media(max-width:480px) {
    .product-grid { grid-template-columns:1fr !important; }
  }

  /* ── THEME TRANSITION ── */
  * { transition: background-color 0.3s ease, border-color 0.3s ease, color 0.15s ease; }
  button, a, input, textarea { transition: all 0.2s ease !important; }
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SKIN_TYPES = [
  { id:"dry",         emoji:"🌵", label:"Dry",         desc:"Feels tight, flaky, rough" },
  { id:"oily",        emoji:"💦", label:"Oily",        desc:"Shiny, enlarged pores" },
  { id:"combination", emoji:"⚖️", label:"Combination", desc:"Oily T-zone, dry cheeks" },
  { id:"sensitive",   emoji:"🌸", label:"Sensitive",   desc:"Reacts easily, redness" },
  { id:"normal",      emoji:"✨", label:"Normal",      desc:"Balanced, few issues" },
];
const CONCERNS = [
  { id:"acne",              label:"Acne & Breakouts",   emoji:"🔴" },
  { id:"aging",             label:"Fine Lines & Aging", emoji:"⏰" },
  { id:"hyperpigmentation", label:"Dark Spots",         emoji:"🌑" },
  { id:"dullness",          label:"Dullness & Glow",    emoji:"✨" },
  { id:"redness",           label:"Redness & Rosacea",  emoji:"🌺" },
  { id:"pores",             label:"Large Pores",        emoji:"🔬" },
  { id:"dryness",           label:"Dehydration",        emoji:"💧" },
  { id:"eyecircles",        label:"Dark Eye Circles",   emoji:"👁️" },
  { id:"texture",           label:"Uneven Texture",     emoji:"🧴" },
  { id:"sensitivity",       label:"Irritation & Itch",  emoji:"❄️" },
];
const AGE_RANGES = ["Under 18","18–24","25–34","35–44","45–54","55+"];
const CLIMATES = [
  { id:"humid",    label:"Humid / Tropical", emoji:"🌴" },
  { id:"dry",      label:"Dry / Arid",       emoji:"🏜️" },
  { id:"temperate",label:"Temperate",         emoji:"🌤️" },
  { id:"cold",     label:"Cold / Harsh",     emoji:"❄️" },
  { id:"polluted", label:"Urban / Polluted", emoji:"🏙️" },
];
const BUDGETS = [
  { id:"budget",  label:"Budget",    sub:"Under ₹500/product" },
  { id:"mid",     label:"Mid-Range", sub:"₹500–₹2000/product" },
  { id:"premium", label:"Premium",   sub:"₹2000–₹5000/product" },
  { id:"luxury",  label:"Luxury",    sub:"₹5000+/product" },
];
const KNOWN_INGREDIENTS = {
  "niacinamide":        { status:"safe",    effect:"Brightens, minimizes pores, reduces inflammation" },
  "retinol":            { status:"caution", effect:"Anti-aging, cell turnover — avoid if pregnant/sensitive" },
  "hyaluronic acid":    { status:"safe",    effect:"Deep hydration, plumps skin" },
  "salicylic acid":     { status:"caution", effect:"Exfoliates, fights acne — can be drying" },
  "vitamin c":          { status:"safe",    effect:"Brightening, antioxidant, collagen boost" },
  "glycolic acid":      { status:"caution", effect:"Chemical exfoliant — use sunscreen" },
  "benzoyl peroxide":   { status:"caution", effect:"Kills acne bacteria — can bleach fabrics" },
  "fragrance":          { status:"avoid",   effect:"Common irritant, skip if sensitive" },
  "alcohol denat":      { status:"avoid",   effect:"Drying, damages skin barrier long-term" },
  "parabens":           { status:"caution", effect:"Preservative — some prefer to avoid" },
  "sulfates":           { status:"avoid",   effect:"Strips natural oils, irritates skin" },
  "ceramides":          { status:"safe",    effect:"Repairs skin barrier, locks moisture" },
  "peptides":           { status:"safe",    effect:"Boosts collagen, firms skin" },
  "spf":                { status:"safe",    effect:"Sun protection — essential daily" },
  "zinc oxide":         { status:"safe",    effect:"Physical sunscreen, calms redness" },
  "squalane":           { status:"safe",    effect:"Lightweight, non-comedogenic moisturizer" },
  "lactic acid":        { status:"caution", effect:"Gentle AHA — exfoliates, brightens" },
  "kojic acid":         { status:"caution", effect:"Brightens dark spots — avoid broken skin" },
  "tranexamic acid":    { status:"safe",    effect:"Fades hyperpigmentation safely" },
  "centella asiatica":  { status:"safe",    effect:"Soothes, heals, anti-inflammatory" },
  "azelaic acid":       { status:"safe",    effect:"Brightens, fights acne & rosacea" },
  "aloe vera":          { status:"safe",    effect:"Soothes, hydrates, anti-inflammatory" },
  "green tea extract":  { status:"safe",    effect:"Antioxidant, reduces oiliness" },
  "collagen":           { status:"safe",    effect:"Moisturizes — topical collagen can't penetrate deep" },
  "witch hazel":        { status:"caution", effect:"Tones pores — can be drying with overuse" },
  "snail mucin":        { status:"safe",    effect:"Repairs, hydrates, fades marks" },
  "bakuchiol":          { status:"safe",    effect:"Natural retinol alternative — gentle & safe" },
  "ferulic acid":       { status:"safe",    effect:"Antioxidant — enhances vitamin C stability" },
};

const WEATHER_TIPS = {
  humid:     ["Use gel-based, lightweight moisturizers", "Double cleanse to prevent clogged pores", "SPF is non-negotiable — humidity magnifies sun damage", "Use blotting papers to control midday shine"],
  dry:       ["Layer a facial oil under your moisturizer", "Avoid hot showers — they strip oils", "Humidifier at home/office helps maintain moisture", "Apply moisturizer on slightly damp skin for better absorption"],
  temperate: ["Rotate products seasonally", "Keep SPF consistent year-round", "Focus on barrier repair in cooler months", "Lighter formulas work well in mild weather"],
  cold:      ["Use occlusive moisturizers (shea, petrolatum) to seal moisture", "Protect lips and eye area from harsh winds", "Consider a hydrating sleeping mask nightly", "Avoid foaming cleansers — opt for cream or oil"],
  polluted:  ["Double cleanse every evening — non-negotiable", "Antioxidant serum (Vitamin C) is your shield", "Clay mask 2x/week to deep-clean pores", "Look for pollution-defense formulas with niacinamide"],
};

const ROUTINE_TIPS_AM = ["Cleanser", "Toner", "Vitamin C Serum", "Eye Cream", "Moisturizer", "SPF 50+"];
const ROUTINE_TIPS_PM = ["Oil Cleanser", "Foam Cleanser", "Exfoliant (3x/week)", "Treatment Serum", "Night Moisturizer", "Sleeping Mask (weekly)"];

const SKIN_JOURNAL_RATINGS = ["😩 Very Bad", "😕 Bad", "😐 Okay", "🙂 Good", "😊 Great"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── OpenRouter API key — replace with your actual key ────────────────────────
const OPENROUTER_API_KEY = "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"; // 🔑 Replace with your OpenRouter API key

const callClaude = async (prompt, systemPrompt, useSearch = false) => {
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const body = {
    model: "anthropic/claude-sonnet-4-5",
    max_tokens: 1200,
    messages,
  };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
};

const getStorageKey = (key) => `lumiere_${key}`;
const lsGet = (key, fallback = null) => {
  try { const v = localStorage.getItem(getStorageKey(key)); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const lsSet = (key, value) => {
  try { localStorage.setItem(getStorageKey(key), JSON.stringify(value)); } catch {}
};

const formatDate = (d = new Date()) => d.toISOString().split("T")[0];
const todayStr = () => formatDate(new Date());

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const ThemeToggle = ({ dark, setDark }) => (
  <button className="btn-icon" onClick={() => setDark(d => !d)} title="Toggle theme" style={{ fontSize: "16px" }}>
    {dark ? "☀️" : "🌙"}
  </button>
);

const Nav = ({ page, setPage, dark, setDark }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  const navItems = [
    { id:"results",     label:"My Skin",     icon:"📊" },
    { id:"routine",     label:"Routine",     icon:"🌿" },
    { id:"tracker",     label:"Tracker",     icon:"📅" },
    { id:"journal",     label:"Journal",     icon:"📝" },
    { id:"ingredients", label:"Ingredients", icon:"🔬" },
    { id:"compare",     label:"Compare",     icon:"⚖️" },
    { id:"chat",        label:"Ask AI",      icon:"💬" },
  ];

  return (
    <nav className="nav" style={{ boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.08)" : "none" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }} onClick={() => setPage("home")}>
        <div style={{
          width:32, height:32, borderRadius:"50%",
          background:"linear-gradient(135deg,var(--accent),var(--gold))",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"15px",
        }}>✦</div>
        <span className="serif" style={{ fontSize:"20px", fontWeight:400, letterSpacing:"2px" }}>
          Lumière
        </span>
      </div>

      <div style={{ display:"flex", gap:"4px", alignItems:"center", overflowX:"auto" }}>
        {page !== "home" && page !== "quiz" && page !== "analyzing" && navItems.map(n => (
          <button key={n.id}
            onClick={() => setPage(n.id)}
            style={{
              background: page === n.id ? "var(--accent-light)" : "transparent",
              color: page === n.id ? "var(--accent)" : "var(--muted)",
              border: page === n.id ? "1px solid var(--accent)" : "1px solid transparent",
              borderRadius:"4px", padding:"6px 12px",
              fontSize:"12px", fontWeight:500, cursor:"pointer",
              fontFamily:"'Outfit',sans-serif", whiteSpace:"nowrap",
              transition:"all 0.2s",
            }}
          >
            <span style={{ marginRight:"4px" }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <ThemeToggle dark={dark} setDark={setDark} />
      </div>
    </nav>
  );
};

// ─── HERO / LANDING ────────────────────────────────────────────────────────────
const HeroPage = ({ setPage, dark }) => {
  const C = dark ? DARK : LIGHT;
  const stats = [
    { n:"5 min",  l:"Quick Analysis" },
    { n:"40+",    l:"Parameters" },
    { n:"AI",     l:"Dermatologist" },
    { n:"Free",   l:"Always" },
  ];

  const features = [
    { icon:"🧬", h:"Skin DNA Profiling",      p:"AI maps your unique skin fingerprint across 40+ biological & environmental parameters." },
    { icon:"📸", h:"Photo Skin Analysis",     p:"Upload a selfie and get instant visible skin analysis — pores, texture, tone, and more." },
    { icon:"📅", h:"Routine Tracker",         p:"Check off your daily routine, build streaks, and stay consistent with reminders." },
    { icon:"📝", h:"Skin Journal",            p:"Log daily skin condition, track patterns, and correlate with weather & lifestyle." },
    { icon:"⚖️", h:"Product Comparator",     p:"Compare two products side-by-side — ingredients, benefits, and AI compatibility score." },
    { icon:"💬", h:"AI Dermatologist Chat",   p:"Multi-turn conversation with your personal AI skin expert, powered by Claude." },
  ];

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      {/* Hero */}
      <div style={{
        position:"relative", minHeight:"calc(100vh - 64px)",
        display:"flex", alignItems:"center",
        background:`linear-gradient(145deg, ${C.bg} 50%, ${C.bgAlt} 100%)`,
        overflow:"hidden",
      }}>
        <div className="hero-grain" />
        {/* Orbs */}
        {[
          { size:400, top:"10%", right:"-5%", color:`${C.accent}18` },
          { size:250, top:"60%", right:"15%", color:`${C.gold}12` },
          { size:180, top:"30%", right:"35%", color:`${C.lavender}10` },
        ].map((o,i) => (
          <div key={i} style={{
            position:"absolute", width:o.size, height:o.size,
            borderRadius:"50%", background:`radial-gradient(circle, ${o.color}, transparent 70%)`,
            top:o.top, right:o.right,
            animation:`float ${4+i}s ease-in-out infinite`, animationDelay:`${i*0.7}s`,
            pointerEvents:"none",
          }} />
        ))}

        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"60px 40px", width:"100%" }}>
          <div className="hero-cols" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"80px", alignItems:"center" }}>
            {/* Left */}
            <div>
              <div className="fade-up" style={{ animationDelay:"0.05s" }}>
                <span className="tag tag-accent">✦ AI-Powered Skincare Intelligence</span>
              </div>
              <h1 className="serif fade-up" style={{
                fontSize:"clamp(44px,5.5vw,76px)", fontWeight:300,
                lineHeight:1.05, marginTop:"20px", letterSpacing:"-0.5px",
                animationDelay:"0.15s",
              }}>
                Skin that<br />
                <em style={{ color:"var(--accent)", fontStyle:"italic" }}>tells its story.</em>
              </h1>
              <p className="fade-up" style={{
                fontSize:"16px", color:"var(--muted)", lineHeight:1.85,
                marginTop:"20px", maxWidth:"460px", animationDelay:"0.25s",
              }}>
                Lumière AI decodes your unique skin biology using advanced AI. Answer 5 questions, upload a photo, and receive a complete personalized ritual — morning to night.
              </p>
              <div className="fade-up" style={{ marginTop:"32px", display:"flex", gap:"12px", flexWrap:"wrap", animationDelay:"0.35s" }}>
                <button className="btn-primary" onClick={() => setPage("quiz")}>
                  <span>Analyze My Skin ✦</span>
                </button>
                <button className="btn-ghost" onClick={() => setPage("ingredients")}>
                  Check Ingredients
                </button>
              </div>
              <div className="fade-up" style={{
                marginTop:"40px", display:"grid", gridTemplateColumns:"repeat(4,1fr)",
                gap:"20px", paddingTop:"28px", borderTop:"1px solid var(--border)",
                animationDelay:"0.45s",
              }}>
                {stats.map(s => (
                  <div key={s.n}>
                    <div className="serif" style={{ fontSize:"26px", fontWeight:400, color:"var(--accent)" }}>{s.n}</div>
                    <div style={{ fontSize:"11px", color:"var(--muted)", marginTop:"3px", letterSpacing:"0.5px" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right card */}
            <div className="fade-in" style={{ animationDelay:"0.3s" }}>
              <div style={{
                background:`linear-gradient(145deg, ${C.surface}, ${C.bgAlt})`,
                border:`1px solid ${C.border}`,
                borderRadius:"12px", padding:"32px",
                boxShadow:`0 32px 64px ${C.text}10`,
                position:"relative", overflow:"hidden",
              }}>
                <div style={{
                  position:"absolute", top:0, right:0, width:"150px", height:"150px",
                  background:`radial-gradient(circle at top right, ${C.accent}10, transparent 70%)`,
                }} />
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
                  <div style={{
                    width:48, height:48, borderRadius:"50%",
                    background:`linear-gradient(135deg,${C.accent},${C.gold})`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px",
                    animation:"glow 2.5s ease-in-out infinite",
                  }}>🌿</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:"15px" }}>Skin Analysis Preview</div>
                    <div style={{ fontSize:"12px", color:"var(--muted)" }}>Take the quiz to unlock yours</div>
                  </div>
                </div>
                {[
                  { icon:"💧", l:"Hydration",      v:68, c:C.green },
                  { icon:"🛡️", l:"Barrier Health", v:55, c:C.accent },
                  { icon:"✨", l:"Radiance",       v:72, c:C.gold },
                  { icon:"🌟", l:"Skin Score",     v:74, c:C.lavender },
                ].map(m => (
                  <div key={m.l} style={{ marginBottom:"16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                      <span style={{ fontSize:"13px", color:"var(--text-sub)" }}>{m.icon} {m.l}</span>
                      <span style={{ fontSize:"13px", fontWeight:700, color:m.c }}>{m.v}%</span>
                    </div>
                    <div className="progress-bar">
                      <div style={{ height:"100%", width:`${m.v}%`, background:m.c, borderRadius:"2px", transition:"width 1s ease" }} />
                    </div>
                  </div>
                ))}
                <div style={{
                  marginTop:"20px", padding:"12px",
                  background:"var(--bg-alt)", borderRadius:"4px",
                  fontSize:"12px", color:"var(--muted)", textAlign:"center",
                  borderLeft:`2px solid var(--accent)`,
                }}>
                  ✦ Sample result — your analysis will be personalized
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div style={{ padding:"80px 40px", background:"var(--bg-alt)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto", textAlign:"center" }}>
          <span className="section-label">Everything you need</span>
          <h2 className="serif" style={{ fontSize:"40px", fontWeight:300, marginTop:"10px", marginBottom:"48px" }}>
            Your complete skin intelligence platform
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"20px", textAlign:"left" }}>
            {features.map((f,i) => (
              <div key={i} className="card card-hover" style={{ padding:"28px" }}>
                <div style={{
                  width:48, height:48, borderRadius:"8px",
                  background:"var(--accent-light)", border:"1px solid var(--border)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"22px", marginBottom:"16px",
                }}>{f.icon}</div>
                <h3 style={{ fontSize:"16px", fontWeight:600, marginBottom:"8px" }}>{f.h}</h3>
                <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.7 }}>{f.p}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"48px" }}>
            <button className="btn-primary" onClick={() => setPage("quiz")}>
              <span>Start Your Free Analysis →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
const QuizPage = ({ setPage, setProfile }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ skinType:null, concerns:[], ageRange:null, climate:null, budget:null });

  const canNext = () => {
    if (step===0) return !!answers.skinType;
    if (step===1) return answers.concerns.length > 0;
    if (step===2) return !!answers.ageRange;
    if (step===3) return !!answers.climate;
    if (step===4) return !!answers.budget;
    return false;
  };

  const next = () => {
    if (step < 4) setStep(s => s+1);
    else { setProfile(answers); setPage("analyzing"); }
  };

  const toggleConcern = id => setAnswers(a => ({
    ...a,
    concerns: a.concerns.includes(id)
      ? a.concerns.filter(c=>c!==id)
      : a.concerns.length < 4 ? [...a.concerns, id] : a.concerns,
  }));

  const steps = [
    {
      label:"Skin Type", icon:"🧴",
      title:"What is your skin type?",
      sub:"Choose what best describes your skin on an average day.",
      content:(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"12px" }}>
          {SKIN_TYPES.map(s => (
            <div key={s.id} className={`option-card ${answers.skinType===s.id?"selected":""}`}
              onClick={()=>setAnswers(a=>({...a,skinType:s.id}))}>
              <div style={{ fontSize:"26px", marginBottom:"8px" }}>{s.emoji}</div>
              <div style={{ fontWeight:600, fontSize:"15px" }}>{s.label}</div>
              <div style={{ fontSize:"12px", color:"var(--muted)", marginTop:"4px" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label:"Concerns", icon:"🎯",
      title:"What are your skin concerns?",
      sub:"Select up to 4 concerns you'd most like to address.",
      content:(
        <div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"10px" }}>
            {CONCERNS.map(c => (
              <div key={c.id} className={`concern-chip ${answers.concerns.includes(c.id)?"active":""}`}
                onClick={()=>toggleConcern(c.id)}>
                <span>{c.emoji}</span><span>{c.label}</span>
                {answers.concerns.includes(c.id) && <span>✓</span>}
              </div>
            ))}
          </div>
          {answers.concerns.length===4 && (
            <div style={{ marginTop:"10px", fontSize:"12px", color:"var(--accent)" }}>
              ✦ Max 4 concerns selected — choose your top priorities
            </div>
          )}
        </div>
      ),
    },
    {
      label:"Age Range", icon:"👤",
      title:"What is your age range?",
      sub:"Skin biology changes with age — this helps refine recommendations.",
      content:(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px" }}>
          {AGE_RANGES.map(a => (
            <div key={a} className={`option-card ${answers.ageRange===a?"selected":""}`}
              style={{ textAlign:"center", padding:"22px 12px" }}
              onClick={()=>setAnswers(p=>({...p,ageRange:a}))}>
              <div className="serif" style={{ fontSize:"18px" }}>{a}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label:"Climate", icon:"🌍",
      title:"What's your environment like?",
      sub:"Climate dramatically affects how skin behaves and what it needs.",
      content:(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
          {CLIMATES.map(c => (
            <div key={c.id} className={`option-card ${answers.climate===c.id?"selected":""}`}
              onClick={()=>setAnswers(a=>({...a,climate:c.id}))}>
              <div style={{ fontSize:"26px", marginBottom:"8px" }}>{c.emoji}</div>
              <div style={{ fontWeight:600 }}>{c.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      label:"Budget", icon:"💰",
      title:"What's your skincare budget?",
      sub:"We'll match you with products in your comfort zone.",
      content:(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
          {BUDGETS.map(b => (
            <div key={b.id} className={`option-card ${answers.budget===b.id?"selected":""}`}
              onClick={()=>setAnswers(a=>({...a,budget:b.id}))}>
              <div style={{ fontWeight:700, fontSize:"16px" }}>{b.label}</div>
              <div style={{ fontSize:"12px", color:"var(--muted)", marginTop:"4px" }}>{b.sub}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const cur = steps[step];

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"100%", maxWidth:"640px", padding:"40px 24px" }}>
        {/* Progress */}
        <div style={{ marginBottom:"28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              {steps.map((s,i) => (
                <div key={i} style={{
                  width: i===step ? 28 : 8, height:8,
                  borderRadius:4,
                  background: i<step ? "var(--green)" : i===step ? "var(--accent)" : "var(--border)",
                  transition:"all 0.3s ease",
                }} />
              ))}
            </div>
            <span style={{ fontSize:"12px", color:"var(--muted)", fontWeight:500 }}>
              {step+1} / {steps.length}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width:`${((step+1)/steps.length)*100}%` }} />
          </div>
        </div>

        <div className="fade-up" key={step}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
            <span style={{ fontSize:"22px" }}>{cur.icon}</span>
            <span className="section-label">{cur.label}</span>
          </div>
          <h2 className="serif" style={{ fontSize:"30px", fontWeight:300, marginBottom:"8px" }}>{cur.title}</h2>
          <p style={{ fontSize:"14px", color:"var(--muted)", marginBottom:"24px", lineHeight:1.6 }}>{cur.sub}</p>
          {cur.content}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"28px" }}>
          <button className="btn-ghost" onClick={() => step>0 ? setStep(s=>s-1) : setPage("home")} style={{ padding:"10px 20px", fontSize:"12px" }}>
            ← {step>0?"Back":"Home"}
          </button>
          <button className="btn-primary" onClick={next} disabled={!canNext()}>
            <span>{step===4 ? "Analyze My Skin ✦" : "Continue →"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ANALYZING ────────────────────────────────────────────────────────────────
const AnalyzingPage = ({ profile, setPage, setResult }) => {
  const [phase, setPhase] = useState(0);
  const phases = [
    "Mapping your skin profile…",
    "Analyzing skin type & concerns…",
    "Scanning 200+ ingredient interactions…",
    "Building personalized morning routine…",
    "Building personalized evening routine…",
    "Curating Indian market products…",
    "Generating lifestyle recommendations…",
    "Finalizing your skin report…",
  ];

  useEffect(() => {
    const run = async () => {
      for (let i=0; i<phases.length; i++) {
        setPhase(i);
        await sleep(700);
      }
      const concerns = profile.concerns
        .map(id => CONCERNS.find(c=>c.id===id)?.label)
        .filter(Boolean).join(", ");

      const sys = `You are a world-class dermatologist and cosmetic chemist AI. Respond ONLY with valid JSON, no markdown, no extra text.`;
      const prompt = `Analyze this person's skin and create a comprehensive personalized report:
- Skin type: ${profile.skinType}
- Primary concerns: ${concerns || "general care"}
- Age range: ${profile.ageRange}
- Climate: ${profile.climate}
- Budget: ${profile.budget}

Return ONLY this JSON (no markdown):
{
  "skinScore": <60-92>,
  "skinProfile": "<2 rich sentences describing this skin>",
  "keyFindings": ["<finding1>","<finding2>","<finding3>"],
  "metrics": { "hydration":<40-90>, "barrier":<40-90>, "clarity":<40-90>, "radiance":<40-90>, "oiliness":<20-80>, "sensitivity":<10-70> },
  "skinAge": "<estimated skin age, can differ from actual>",
  "primaryIssue": "<single most important concern to address>",
  "morningRoutine": [
    {"step":1,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":2,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":3,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":4,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"}
  ],
  "eveningRoutine": [
    {"step":1,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":2,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":3,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"},
    {"step":4,"product":"<type>","ingredient":"<key ingredient>","why":"<1 sentence>","tip":"<usage tip>"}
  ],
  "topProducts": [
    {"name":"<real Indian market product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"},
    {"name":"<product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"},
    {"name":"<product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"},
    {"name":"<product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"},
    {"name":"<product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"},
    {"name":"<product>","brand":"<brand>","type":"<type>","price":"<INR range>","rating":<3.5-5.0>,"keyIngredient":"<ingredient>","suitableFor":"<concern>","emoji":"<emoji>","bestFor":"<1 short phrase>"}
  ],
  "ingredientsToAvoid": ["<ing1>","<ing2>","<ing3>"],
  "ingredientsToSeek": ["<ing1>","<ing2>","<ing3>"],
  "dietTips": ["<tip1>","<tip2>","<tip3>"],
  "weeklyTreatments": ["<treatment1>","<treatment2>"],
  "lifestyleTips": ["<tip1>","<tip2>","<tip3>"],
  "ingredientPairings": [
    {"pair":["<ingredient A>","<ingredient B>"],"verdict":"safe","note":"<why they work>"},
    {"pair":["<ingredient C>","<ingredient D>"],"verdict":"avoid","note":"<why they clash>"}
  ]
}`;

      try {
        const text = await callClaude(prompt, sys);
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        // Save score history
        const history = lsGet("score_history", []);
        history.push({ date: todayStr(), score: parsed.skinScore, profile: profile.skinType });
        if (history.length > 30) history.shift();
        lsSet("score_history", history);
        setResult(parsed);
        setPage("results");
      } catch {
        setResult(FALLBACK_RESULT);
        setPage("results");
      }
    };
    run();
  }, []);

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:"40px 24px", maxWidth:"480px" }}>
        {/* Animated logo */}
        <div style={{ position:"relative", width:100, height:100, margin:"0 auto 32px" }}>
          <div style={{
            width:100, height:100, borderRadius:"50%",
            background:`conic-gradient(var(--accent), var(--gold), var(--green), var(--lavender), var(--accent))`,
            animation:"spin 2s linear infinite, glow 2s ease-in-out infinite",
          }} />
          <div style={{
            position:"absolute", inset:"8px",
            borderRadius:"50%", background:"var(--bg)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"28px",
          }}>✦</div>
        </div>
        <h2 className="serif" style={{ fontSize:"30px", fontWeight:300, marginBottom:"10px" }}>
          Reading your skin…
        </h2>
        <p style={{ color:"var(--muted)", marginBottom:"28px", fontSize:"14px", lineHeight:1.7 }}>
          Our AI dermatologist is building your personalized skin report
        </p>
        <div className="card" style={{ padding:"20px", textAlign:"left" }}>
          {phases.map((p,i) => (
            <div key={i} style={{
              display:"flex", alignItems:"center", gap:"12px",
              padding:"9px 0",
              color: i<phase ? "var(--green)" : i===phase ? "var(--text)" : "var(--muted)",
              fontSize:"13px",
              borderBottom: i<phases.length-1 ? "1px solid var(--border)" : "none",
            }}>
              <span style={{ fontSize:"14px", flexShrink:0 }}>
                {i<phase ? "✓" : i===phase ? "◉" : "○"}
              </span>
              <span style={{ fontWeight: i===phase?600:400 }}>{p}</span>
              {i===phase && <div className="typing-dots" style={{ marginLeft:"auto" }}><span/><span/><span/></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── RESULTS ─────────────────────────────────────────────────────────────────
const ResultsPage = ({ profile, result, setPage }) => {
  const [tab, setTab] = useState("overview");
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileRef = useRef();
  if (!result) return null;

  const concerns = profile.concerns.map(id=>CONCERNS.find(c=>c.id===id)?.label).filter(Boolean);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhotoAnalysis(null);
    try {
      const base64 = await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(",")[1]);
        r.onerror=rej;
        r.readAsDataURL(file);
      });
      const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-5",
          max_tokens: 600,
          messages: [
            {
              role: "system",
              content: "You are a dermatologist analyzing a face photo. Give a compassionate, concise analysis (3-4 sentences) covering: visible skin texture, pore appearance, skin tone evenness, and hydration levels. Be encouraging and constructive. Then list 3 specific product tips based on what you see. Keep it under 150 words total.",
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${file.type||"image/jpeg"};base64,${base64}` } },
                { type: "text", text: "Please analyze my skin from this photo." },
              ],
            },
          ],
        }),
      });
      const d = await res2.json();
      setPhotoAnalysis(d.choices?.[0]?.message?.content || "");
    } catch {
      setPhotoAnalysis("Photo analysis unavailable. Please ensure your API key supports vision.");
    }
    setPhotoLoading(false);
  };

  const MetricBar = ({ label, value, color, emoji }) => (
    <div style={{ marginBottom:"14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontSize:"13px", color:"var(--muted)" }}>{emoji} {label}</span>
        <span style={{ fontSize:"13px", fontWeight:700, color }}>{value}%</span>
      </div>
      <div className="progress-bar">
        <div style={{ height:"100%", width:`${value}%`, background:color, borderRadius:"2px", animation:"barGrow 1s ease both" }} />
      </div>
    </div>
  );

  const scoreHistory = lsGet("score_history", []);

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      {/* Header */}
      <div style={{
        background:`linear-gradient(145deg, var(--bg-alt2) 0%, var(--bg-alt) 100%)`,
        padding:"40px",
        borderBottom:"1px solid var(--border)",
      }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"24px" }}>
            <div>
              <span className="section-label">✦ Your AI Skin Report</span>
              <h1 className="serif" style={{ fontSize:"clamp(28px,4vw,48px)", fontWeight:300, marginTop:"8px", lineHeight:1.15 }}>
                Skin Analysis <em style={{ color:"var(--accent)" }}>Complete</em>
              </h1>
              <div style={{ marginTop:"14px", display:"flex", gap:"8px", flexWrap:"wrap" }}>
                {[
                  `🧴 ${profile.skinType?.charAt(0).toUpperCase()+profile.skinType?.slice(1)} Skin`,
                  `📍 ${profile.climate?.charAt(0).toUpperCase()+profile.climate?.slice(1)}`,
                  `👤 ${profile.ageRange}`,
                  result.skinAge ? `🧬 Skin Age: ${result.skinAge}` : null,
                ].filter(Boolean).map(t=>(
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
              {result.primaryIssue && (
                <div style={{ marginTop:"12px", fontSize:"13px", color:"var(--accent)", fontWeight:500 }}>
                  Primary Focus: {result.primaryIssue}
                </div>
              )}
            </div>
            {/* Score */}
            <div style={{ textAlign:"center" }}>
              <div style={{
                width:110, height:110, borderRadius:"50%",
                background:`conic-gradient(var(--accent) ${result.skinScore}%, var(--bg-alt2) 0)`,
                display:"flex", alignItems:"center", justifyContent:"center",
                position:"relative", margin:"0 auto 8px",
                animation:"glow 3s ease-in-out infinite",
              }}>
                <div style={{
                  width:80, height:80, borderRadius:"50%",
                  background:"var(--surface)",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                }}>
                  <span className="serif" style={{ fontSize:"26px", fontWeight:400, color:"var(--accent)" }}>{result.skinScore}</span>
                  <span style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"1px" }}>/ 100</span>
                </div>
              </div>
              <div style={{ fontSize:"11px", color:"var(--muted)", letterSpacing:"1px", textTransform:"uppercase" }}>Skin Health Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", position:"sticky", top:"64px", zIndex:50 }}>
        <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"0 40px" }}>
          <div className="tab-bar">
            {[
              ["overview","📊 Overview"],
              ["photo","📸 Photo Scan"],
              ["routine","🌿 Routine"],
              ["products","✨ Products"],
              ["pairings","🧪 Pairings"],
              ["diet","🥗 Lifestyle"],
              ["history","📈 History"],
            ].map(([id,label])=>(
              <button key={id} className={`tab-item ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"1200px", margin:"0 auto", padding:"32px 40px" }}>

        {/* OVERVIEW */}
        {tab==="overview" && (
          <div className="fade-up">
            <div className="results-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
              <div className="card" style={{ padding:"24px" }}>
                <span className="section-label">AI Skin Profile</span>
                <p className="serif" style={{ fontSize:"17px", fontWeight:300, lineHeight:1.8, marginTop:"12px" }}>{result.skinProfile}</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"16px" }}>
                  {concerns.map(c=><span key={c} className="tag tag-accent">{c}</span>)}
                </div>
              </div>
              <div className="card" style={{ padding:"24px" }}>
                <span className="section-label">Skin Metrics</span>
                <div style={{ marginTop:"16px" }}>
                  <MetricBar label="Hydration"    value={result.metrics.hydration}   color="var(--green)"    emoji="💧" />
                  <MetricBar label="Barrier"       value={result.metrics.barrier}     color="var(--accent)"   emoji="🛡️" />
                  <MetricBar label="Clarity"       value={result.metrics.clarity}     color="var(--gold)"     emoji="✨" />
                  <MetricBar label="Radiance"      value={result.metrics.radiance}    color="var(--lavender)" emoji="🌟" />
                  {result.metrics.oiliness && <MetricBar label="Oiliness"  value={result.metrics.oiliness}   color="var(--navy)"     emoji="💦" />}
                  {result.metrics.sensitivity && <MetricBar label="Sensitivity" value={result.metrics.sensitivity} color="var(--rose)" emoji="🌸" />}
                </div>
              </div>
              <div className="card" style={{ padding:"24px" }}>
                <span className="section-label">Key Findings</span>
                <div style={{ marginTop:"12px" }}>
                  {result.keyFindings?.map((f,i)=>(
                    <div key={i} style={{ display:"flex", gap:"12px", padding:"11px 0", borderBottom:i<result.keyFindings.length-1?"1px solid var(--border)":"none" }}>
                      <span style={{ color:"var(--accent)", fontWeight:700 }}>✦</span>
                      <span style={{ fontSize:"14px", lineHeight:1.6 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding:"24px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"12px" }}>
                  <span className="section-label">Ingredients to Avoid</span>
                  <span className="section-label" style={{ color:"var(--green)" }}>To Seek</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                  <div>
                    {result.ingredientsToAvoid?.map((ing,i)=>(
                      <div key={i} style={{ display:"flex", gap:"8px", padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:"13px", alignItems:"center" }}>
                        <span style={{ color:"var(--rose)" }}>✗</span>{ing}
                      </div>
                    ))}
                  </div>
                  <div>
                    {result.ingredientsToSeek?.map((ing,i)=>(
                      <div key={i} style={{ display:"flex", gap:"8px", padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:"13px", alignItems:"center" }}>
                        <span style={{ color:"var(--green)" }}>✓</span>{ing}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop:"14px" }}>
                  <button className="btn-ghost" style={{ width:"100%", fontSize:"12px", padding:"10px" }} onClick={()=>setPage("ingredients")}>
                    Check Your Products →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHOTO SCAN */}
        {tab==="photo" && (
          <div className="fade-up">
            <div style={{ maxWidth:"640px", margin:"0 auto" }}>
              <h2 className="serif" style={{ fontSize:"28px", fontWeight:300, marginBottom:"8px" }}>Photo Skin Analysis</h2>
              <p style={{ color:"var(--muted)", fontSize:"14px", lineHeight:1.7, marginBottom:"24px" }}>
                Upload a clear, well-lit selfie and our AI will analyze your visible skin — pores, texture, tone, and hydration.
              </p>
              <div className="card" style={{ padding:"28px", textAlign:"center" }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
                <div style={{
                  border:"2px dashed var(--border)", borderRadius:"8px", padding:"40px 20px",
                  cursor:"pointer", transition:"all 0.2s",
                  background:"var(--bg-alt)",
                }}
                  onClick={()=>fileRef.current.click()}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}
                >
                  <div style={{ fontSize:"40px", marginBottom:"12px" }}>📸</div>
                  <div style={{ fontWeight:600, marginBottom:"6px" }}>Upload a Selfie</div>
                  <div style={{ fontSize:"13px", color:"var(--muted)" }}>JPG, PNG · Clear lighting, no filter</div>
                </div>
                {photoLoading && (
                  <div style={{ marginTop:"20px", display:"flex", alignItems:"center", gap:"12px", justifyContent:"center" }}>
                    <div className="typing-dots"><span/><span/><span/></div>
                    <span style={{ fontSize:"14px", color:"var(--muted)" }}>Analyzing your skin…</span>
                  </div>
                )}
                {photoAnalysis && (
                  <div className="fade-up" style={{ marginTop:"20px", textAlign:"left" }}>
                    <div style={{ padding:"20px", background:"var(--bg-alt)", borderRadius:"6px", borderLeft:"3px solid var(--accent)" }}>
                      <span className="section-label" style={{ marginBottom:"10px", display:"block" }}>AI Photo Analysis</span>
                      <p style={{ fontSize:"14px", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{photoAnalysis}</p>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop:"16px", padding:"14px", background:"var(--bg-alt)", borderRadius:"4px" }}>
                <p style={{ fontSize:"12px", color:"var(--muted)", lineHeight:1.6 }}>
                  🔒 <strong>Privacy:</strong> Your photo is sent to Claude AI for analysis and is not stored on any server. Requires an OpenRouter API key with vision support.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ROUTINE */}
        {tab==="routine" && (
          <div className="fade-up">
            <div className="routine-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
              {[
                { time:"Morning", icon:"🌅", color:"var(--gold)", steps:result.morningRoutine },
                { time:"Evening", icon:"🌙", color:"var(--lavender)", steps:result.eveningRoutine, dark:true },
              ].map(({ time,icon,color,steps,dark:isDark })=>(
                <div key={time} className="card" style={{ padding:"24px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
                    <span style={{ fontSize:"26px" }}>{icon}</span>
                    <div>
                      <span className="section-label">{time} Routine</span>
                      <div className="serif" style={{ fontSize:"20px", fontWeight:300, marginTop:"2px" }}>{time} Ritual</div>
                    </div>
                  </div>
                  {steps?.map((s,i)=>(
                    <div key={i} className="routine-step">
                      <div className="step-num" style={{ background:isDark?"var(--bg-alt2)":undefined, border:`2px solid ${color}`, color }}>{s.step}</div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:"14px" }}>{s.product}</div>
                        <div style={{ fontSize:"11px", color, marginTop:"2px", fontWeight:600 }}>✦ {s.ingredient}</div>
                        <div style={{ fontSize:"13px", color:"var(--muted)", marginTop:"5px", lineHeight:1.5 }}>{s.why}</div>
                        <div style={{ fontSize:"11px", background:"var(--bg-alt)", padding:"5px 9px", borderRadius:"3px", marginTop:"7px", color:"var(--muted)" }}>
                          💡 {s.tip}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {result.weeklyTreatments?.length > 0 && (
              <div className="card" style={{ padding:"24px", marginTop:"20px" }}>
                <span className="section-label">Weekly Treatments</span>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginTop:"12px" }}>
                  {result.weeklyTreatments.map((t,i)=>(
                    <div key={i} style={{ background:"var(--bg-alt)", borderRadius:"4px", padding:"14px", borderLeft:"3px solid var(--accent)" }}>
                      <span style={{ fontSize:"13px" }}>🧖 {t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS */}
        {tab==="products" && (
          <div className="fade-up">
            <div style={{ marginBottom:"20px" }}>
              <h2 className="serif" style={{ fontSize:"26px", fontWeight:300 }}>Curated for Your Skin</h2>
              <p style={{ color:"var(--muted)", fontSize:"13px", marginTop:"6px" }}>
                Personalized for {profile.skinType} skin · {concerns.slice(0,2).join(" & ")} · {profile.budget} budget
              </p>
            </div>
            <div className="product-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px" }}>
              {result.topProducts?.map((p,i)=>(
                <div key={i} className="card card-hover" style={{ overflow:"hidden" }}>
                  <div style={{
                    height:"90px",
                    background:[
                      "linear-gradient(135deg,#F5E6D3,#E8C9A0)",
                      "linear-gradient(135deg,#D3E8D3,#A0C9A0)",
                      "linear-gradient(135deg,#D3D3F5,#A0A0E8)",
                      "linear-gradient(135deg,#F5D3D3,#E8A0A0)",
                      "linear-gradient(135deg,#F5F0D3,#E8D9A0)",
                      "linear-gradient(135deg,#D3EBF5,#A0C9E0)",
                    ][i%6],
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"36px", position:"relative",
                  }}>
                    {p.emoji}
                    <div style={{
                      position:"absolute", top:"8px", right:"8px",
                      background:"#fff", borderRadius:"3px", padding:"2px 7px",
                      fontSize:"11px", fontWeight:700, color:"var(--green)",
                    }}>★ {p.rating}</div>
                  </div>
                  <div style={{ padding:"16px" }}>
                    <div style={{ fontSize:"10px", color:"var(--muted)", letterSpacing:"1px", textTransform:"uppercase" }}>{p.brand}</div>
                    <div style={{ fontWeight:700, fontSize:"14px", marginTop:"3px", lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ fontSize:"11px", color:"var(--accent)", marginTop:"4px" }}>✦ {p.type}</div>
                    {p.bestFor && <div style={{ fontSize:"12px", color:"var(--muted)", marginTop:"4px", fontStyle:"italic" }}>{p.bestFor}</div>}
                    <div style={{ height:"1px", background:"var(--border)", margin:"10px 0" }} />
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontWeight:700, fontSize:"13px" }}>{p.price}</span>
                      <span className="tag" style={{ fontSize:"10px" }}>{p.suitableFor}</span>
                    </div>
                    <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>
                      Key: <strong>{p.keyIngredient}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAIRINGS */}
        {tab==="pairings" && (
          <div className="fade-up">
            <h2 className="serif" style={{ fontSize:"26px", fontWeight:300, marginBottom:"8px" }}>Ingredient Pairings</h2>
            <p style={{ color:"var(--muted)", fontSize:"14px", marginBottom:"24px" }}>Know which ingredients work together and which clash for your skin type.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
              {result.ingredientPairings?.map((p,i)=>(
                <div key={i} className="card" style={{ padding:"20px", borderLeft:`3px solid ${p.verdict==="safe"?"var(--green)":"var(--rose)"}` }}>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"8px" }}>
                    <span style={{ fontSize:"16px" }}>{p.verdict==="safe"?"✅":"⚠️"}</span>
                    <span style={{ fontWeight:700, fontSize:"12px", color:p.verdict==="safe"?"var(--green)":"var(--rose)", textTransform:"uppercase", letterSpacing:"1px" }}>
                      {p.verdict==="safe"?"Great Pairing":"Avoid Together"}
                    </span>
                  </div>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"8px" }}>
                    <span className="tag tag-accent">{p.pair[0]}</span>
                    <span style={{ color:"var(--muted)" }}>+</span>
                    <span className="tag tag-accent">{p.pair[1]}</span>
                  </div>
                  <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.6 }}>{p.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DIET / LIFESTYLE */}
        {tab==="diet" && (
          <div className="fade-up">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
              <div className="card" style={{ padding:"24px" }}>
                <span className="section-label">Diet & Nutrition</span>
                {result.dietTips?.map((t,i)=>(
                  <div key={i} style={{ display:"flex", gap:"12px", padding:"12px 0", borderBottom:i<result.dietTips.length-1?"1px solid var(--border)":"none" }}>
                    <span style={{ fontSize:"18px" }}>{"🥤🥗🍇🫐🫚".split("").filter((_,j)=>j%2===0)[i]||"🌿"}</span>
                    <span style={{ fontSize:"13px", lineHeight:1.6 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding:"24px" }}>
                <span className="section-label">Lifestyle Tips</span>
                {(result.lifestyleTips||[]).concat(["😴 Sleep 7–8 hours","🧘 Manage daily stress","🏃 Exercise for skin glow","💧 Hydrate consistently"]).slice(0,5).map((t,i)=>(
                  <div key={i} style={{ display:"flex", gap:"12px", padding:"12px 0", borderBottom:i<4?"1px solid var(--border)":"none" }}>
                    <span style={{ fontSize:"16px" }}>{t.charAt(0)}</span>
                    <span style={{ fontSize:"13px", lineHeight:1.6 }}>{t.slice(2)||t}</span>
                  </div>
                ))}
              </div>
              {/* Climate tips */}
              <div className="card" style={{ padding:"24px", gridColumn:"1/-1" }}>
                <span className="section-label">🌍 Climate-Specific Tips · {profile.climate}</span>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"10px", marginTop:"14px" }}>
                  {(WEATHER_TIPS[profile.climate]||[]).map((t,i)=>(
                    <div key={i} style={{ background:"var(--bg-alt)", padding:"12px", borderRadius:"4px", fontSize:"13px", borderLeft:"2px solid var(--accent)" }}>
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab==="history" && (
          <div className="fade-up">
            <h2 className="serif" style={{ fontSize:"26px", fontWeight:300, marginBottom:"8px" }}>Skin Score History</h2>
            <p style={{ color:"var(--muted)", fontSize:"14px", marginBottom:"24px" }}>Track your skin health progress over time.</p>
            {scoreHistory.length < 2 ? (
              <div className="card" style={{ padding:"40px", textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>📈</div>
                <div style={{ fontWeight:600, marginBottom:"8px" }}>Not enough data yet</div>
                <div style={{ color:"var(--muted)", fontSize:"14px" }}>Retake the analysis periodically to track your skin's progress over time.</div>
              </div>
            ) : (
              <div className="card" style={{ padding:"24px" }}>
                <div style={{ display:"flex", gap:"4px", alignItems:"flex-end", height:"160px", paddingTop:"20px" }}>
                  {scoreHistory.slice(-12).map((h,i,arr)=>{
                    const max=Math.max(...arr.map(x=>x.score));
                    const pct=(h.score/max)*100;
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", height:"100%" }}>
                        <div style={{ fontSize:"10px", color:"var(--muted)", fontWeight:600 }}>{h.score}</div>
                        <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                          <div style={{
                            width:"100%", height:`${pct}%`,
                            background:`linear-gradient(to top, var(--accent), var(--gold))`,
                            borderRadius:"3px 3px 0 0", minHeight:"4px",
                            transition:"height 0.8s ease",
                            opacity: i===arr.length-1 ? 1 : 0.6,
                          }} />
                        </div>
                        <div style={{ fontSize:"9px", color:"var(--muted)", transform:"rotate(-45deg)", transformOrigin:"center", whiteSpace:"nowrap" }}>
                          {h.date.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginTop:"20px", textAlign:"center" }}>
              <button className="btn-primary" onClick={()=>setPage("quiz")}><span>Retake Analysis</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── INGREDIENT CHECKER ───────────────────────────────────────────────────────
const IngredientsPage = ({ result }) => {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const quickCheck = () => {
    const lower = text.toLowerCase();
    const found = [];
    Object.entries(KNOWN_INGREDIENTS).forEach(([name,info]) => {
      if (lower.includes(name)) found.push({ name, ...info });
    });
    setAnalysis(found);
    setAiInsight("");
  };

  const askAI = async () => {
    if (!text.trim()) return;
    setAiLoading(true); setAiInsight("");
    try {
      const skinContext = result ? ` This is for ${result.skinProfile?.slice(0,100)}` : "";
      const res = await callClaude(
        `Analyze these skincare product ingredients. List: key benefits, any red flags, skin type suitability, and 2 standout ingredients.${skinContext}\n\nIngredients: ${text}`,
        "You are a cosmetic chemist. Be concise and practical. 4-5 sentences max.",
      );
      setAiInsight(res);
    } catch { setAiInsight("AI analysis unavailable. Try again."); }
    setAiLoading(false);
  };

  const filtered = analysis ? (filter==="all" ? analysis : analysis.filter(i=>i.status===filter)) : [];
  const sample = "Water, Niacinamide (10%), Zinc PCA, Panthenol, Hyaluronic Acid, Fragrance, Alcohol Denat, Glycerin, Ceramide NP, Retinol, Salicylic Acid, Centella Asiatica";

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      <div style={{ maxWidth:"860px", margin:"0 auto", padding:"40px 24px" }}>
        <span className="section-label">✦ Ingredient Intelligence</span>
        <h1 className="serif" style={{ fontSize:"clamp(28px,4vw,44px)", fontWeight:300, marginTop:"10px", marginBottom:"8px" }}>
          Decode Your <em style={{ color:"var(--accent)" }}>Ingredients</em>
        </h1>
        <p style={{ color:"var(--muted)", marginBottom:"28px", lineHeight:1.7 }}>
          Paste any product's ingredient list for an instant safety scan and AI analysis.
        </p>

        <div className="card" style={{ padding:"24px", marginBottom:"20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
            <label style={{ fontWeight:600, fontSize:"14px" }}>Paste Ingredient List</label>
            <button onClick={()=>{ setText(sample); setAnalysis(null); setAiInsight(""); }}
              style={{ fontSize:"12px", color:"var(--accent)", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
              Load sample
            </button>
          </div>
          <textarea className="input-field" rows={5} value={text}
            onChange={e=>{ setText(e.target.value); setAnalysis(null); setAiInsight(""); }}
            placeholder="e.g. Water, Niacinamide, Hyaluronic Acid, Fragrance..."
          />
          <div style={{ display:"flex", gap:"10px", marginTop:"14px", flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={quickCheck} disabled={!text.trim()}>
              <span>Quick Scan</span>
            </button>
            <button className="btn-ghost" onClick={askAI} disabled={!text.trim()||aiLoading}>
              {aiLoading ? "Analyzing…" : "🧠 AI Deep Analysis"}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        {analysis !== null && (
          <div className="card fade-up" style={{ padding:"24px", marginBottom:"20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"10px" }}>
              <span className="section-label">Scan Results · {analysis.length} found</span>
              <div style={{ display:"flex", gap:"6px" }}>
                {["all","safe","caution","avoid"].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} style={{
                    background: filter===f ? "var(--accent)" : "var(--bg-alt)",
                    color: filter===f ? "#fff" : "var(--muted)",
                    border:"1px solid var(--border)", borderRadius:"20px",
                    padding:"4px 12px", fontSize:"11px", cursor:"pointer",
                    fontFamily:"'Outfit',sans-serif", textTransform:"capitalize", fontWeight:500,
                  }}>{f}</button>
                ))}
              </div>
            </div>
            {filtered.length===0 ? (
              <p style={{ color:"var(--muted)", textAlign:"center", padding:"20px" }}>
                {analysis.length===0
                  ? "No known ingredients found. Try the AI Deep Analysis for custom review."
                  : `No ${filter} ingredients in this filter.`}
              </p>
            ) : (
              ["safe","caution","avoid"].map(status => {
                const items = filtered.filter(i=>i.status===status);
                if (!items.length) return null;
                return (
                  <div key={status} style={{ marginBottom:"16px" }}>
                    <div style={{
                      fontSize:"10px", letterSpacing:"2px", textTransform:"uppercase",
                      color:{ safe:"var(--green)", caution:"#856404", avoid:"var(--rose)" }[status],
                      marginBottom:"8px", fontWeight:700,
                    }}>
                      {{ safe:"✓ Safe to Use", caution:"⚠ Use with Caution", avoid:"✗ Consider Avoiding" }[status]}
                    </div>
                    {items.map(ing=>(
                      <div key={ing.name} style={{ display:"flex", gap:"12px", padding:"10px 0", borderBottom:"1px solid var(--border)", alignItems:"flex-start" }}>
                        <span className={`ingredient-badge badge-${status}`} style={{ flexShrink:0 }}>{ing.name}</span>
                        <span style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.5 }}>{ing.effect}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* AI insight */}
        {(aiLoading||aiInsight) && (
          <div className="card fade-up" style={{ padding:"24px", marginBottom:"20px" }}>
            <span className="section-label">🧠 AI Deep Analysis</span>
            {aiLoading ? (
              <div style={{ display:"flex", gap:"10px", alignItems:"center", marginTop:"14px" }}>
                <div className="typing-dots"><span/><span/><span/></div>
                <span style={{ fontSize:"13px", color:"var(--muted)" }}>Analyzing ingredient interactions…</span>
              </div>
            ) : (
              <p style={{ fontSize:"14px", lineHeight:1.85, marginTop:"12px" }}>{aiInsight}</p>
            )}
          </div>
        )}

        {/* Glossary */}
        <div style={{ marginTop:"32px" }}>
          <span className="section-label">Common Ingredients Glossary</span>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"10px", marginTop:"14px" }}>
            {Object.entries(KNOWN_INGREDIENTS).slice(0,12).map(([name,info])=>(
              <div key={name} style={{ display:"flex", gap:"10px", alignItems:"flex-start", padding:"12px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"4px" }}>
                <span className={`ingredient-badge badge-${info.status}`} style={{ flexShrink:0 }}>{name}</span>
                <span style={{ fontSize:"11px", color:"var(--muted)", lineHeight:1.5 }}>{info.effect}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── ROUTINE TRACKER ──────────────────────────────────────────────────────────
const TrackerPage = ({ result, setPage }) => {
  const today = todayStr();
  const [completed, setCompleted] = useState(() => lsGet(`tracker_${today}`, {}));
  const [history, setHistory] = useState(() => lsGet("tracker_history", {}));

  const amSteps = result?.morningRoutine?.map(s=>s.product) || ROUTINE_TIPS_AM;
  const pmSteps = result?.eveningRoutine?.map(s=>s.product) || ROUTINE_TIPS_PM;
  const allSteps = [...amSteps.map(s=>`AM:${s}`),...pmSteps.map(s=>`PM:${s}`)];

  const toggle = (key) => {
    const updated = { ...completed, [key]: !completed[key] };
    setCompleted(updated);
    lsSet(`tracker_${today}`, updated);
    // Update history
    const hist = { ...history };
    const done = Object.values(updated).filter(Boolean).length;
    hist[today] = { done, total: allSteps.length };
    setHistory(hist);
    lsSet("tracker_history", hist);
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const pct = Math.round((doneCount / allSteps.length) * 100);

  // Last 7 days streak
  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = formatDate(d);
    const h = history[key];
    return { key, label:d.toLocaleDateString("en",{weekday:"short"}), done:h?.done||0, total:h?.total||allSteps.length, isToday:key===today };
  }).reverse();

  const streak = (() => {
    let s=0;
    for (let i=0; i<30; i++) {
      const d=new Date(); d.setDate(d.getDate()-i);
      const h=history[formatDate(d)];
      if (h && h.done >= Math.floor(h.total*0.6)) s++;
      else if (i>0) break;
    }
    return s;
  })();

  if (!result) return (
    <div style={{ minHeight:"100vh",paddingTop:"64px",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center",padding:"40px" }}>
        <div style={{ fontSize:"48px",marginBottom:"12px" }}>📅</div>
        <h2 className="serif" style={{ fontSize:"28px",fontWeight:300,marginBottom:"10px" }}>No routine yet</h2>
        <p style={{ color:"var(--muted)",marginBottom:"20px" }}>Take the quiz to get your personalized routine tracker.</p>
        <button className="btn-primary" onClick={()=>setPage("quiz")}><span>Start Quiz</span></button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      <div style={{ maxWidth:"800px", margin:"0 auto", padding:"40px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <span className="section-label">✦ Daily Routine Tracker</span>
            <h1 className="serif" style={{ fontSize:"32px", fontWeight:300, marginTop:"6px" }}>
              Today's <em style={{ color:"var(--accent)" }}>Ritual</em>
            </h1>
            <p style={{ color:"var(--muted)", fontSize:"13px", marginTop:"4px" }}>
              {new Date().toLocaleDateString("en",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
            </p>
          </div>
          <div style={{ display:"flex", gap:"16px" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{
                width:72, height:72, borderRadius:"50%",
                background:`conic-gradient(var(--accent) ${pct}%, var(--bg-alt2) 0)`,
                display:"flex", alignItems:"center", justifyContent:"center", position:"relative",
              }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontWeight:700, fontSize:"14px" }}>{pct}%</span>
                </div>
              </div>
              <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"4px" }}>Today</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{
                width:72, height:72, borderRadius:"50%",
                background:`linear-gradient(135deg, var(--accent), var(--gold))`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: streak>0 ? "0 0 20px var(--accent)60" : "none",
              }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:700, fontSize:"20px", color:"#fff" }}>{streak}</div>
                  <div style={{ fontSize:"8px", color:"rgba(255,255,255,0.8)" }}>DAY STREAK</div>
                </div>
              </div>
              <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"4px" }}>🔥 Streak</div>
            </div>
          </div>
        </div>

        {/* 7-day mini calendar */}
        <div className="card" style={{ padding:"20px", marginBottom:"20px" }}>
          <span className="section-label" style={{ marginBottom:"12px", display:"block" }}>This Week</span>
          <div style={{ display:"flex", gap:"8px", justifyContent:"space-between" }}>
            {last7.map(d=>{
              const pct2 = d.total>0 ? d.done/d.total : 0;
              const cls = d.isToday ? "streak-today" : pct2>=0.6 ? "streak-done" : d.done>0 ? "streak-missed" : "streak-future";
              return (
                <div key={d.key} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                  <div style={{ fontSize:"10px", color:"var(--muted)" }}>{d.label}</div>
                  <div className={`streak-day ${cls}`}>{pct2>=0.6?"✓":d.done>0?d.done:""}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AM / PM Checklists */}
        {[
          { label:"Morning Routine", icon:"🌅", steps:amSteps, prefix:"AM" },
          { label:"Evening Routine", icon:"🌙", steps:pmSteps, prefix:"PM" },
        ].map(({ label,icon,steps,prefix })=>(
          <div key={prefix} className="card" style={{ padding:"24px", marginBottom:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px" }}>
              <span style={{ fontSize:"22px" }}>{icon}</span>
              <span className="section-label">{label}</span>
              <span style={{ marginLeft:"auto", fontSize:"12px", color:"var(--muted)" }}>
                {steps.filter(s=>completed[`${prefix}:${s}`]).length}/{steps.length}
              </span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {steps.map((step,i)=>{
                const key=`${prefix}:${step}`;
                const done=!!completed[key];
                return (
                  <div key={key}
                    onClick={()=>toggle(key)}
                    style={{
                      display:"flex", alignItems:"center", gap:"14px", padding:"12px 14px",
                      borderRadius:"4px", cursor:"pointer",
                      background: done ? "var(--accent-light)" : "var(--bg-alt)",
                      border:`1px solid ${done?"var(--accent)":"var(--border)"}`,
                      transition:"all 0.2s",
                    }}
                  >
                    <div style={{
                      width:22, height:22, borderRadius:"50%",
                      background: done ? "var(--accent)" : "var(--surface)",
                      border:`2px solid ${done?"var(--accent)":"var(--border)"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, transition:"all 0.2s",
                    }}>
                      {done && <span style={{ color:"#fff", fontSize:"11px", fontWeight:700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:"14px", fontWeight: done?500:400, color: done?"var(--accent)":"var(--text)", textDecoration: done?"none":"none", flex:1 }}>
                      <strong style={{ marginRight:"6px", color:"var(--muted)", fontSize:"11px" }}>{i+1}.</strong>{step}
                    </span>
                    {done && <span style={{ fontSize:"12px" }}>✨</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {pct===100 && (
          <div className="fade-up" style={{
            textAlign:"center", padding:"24px",
            background:"linear-gradient(135deg, var(--accent-light), var(--green-light))",
            borderRadius:"6px", border:"1px solid var(--accent)",
          }}>
            <div style={{ fontSize:"36px", marginBottom:"8px" }}>🎉</div>
            <h3 className="serif" style={{ fontSize:"22px", fontWeight:300, marginBottom:"6px" }}>Ritual Complete!</h3>
            <p style={{ color:"var(--muted)", fontSize:"13px" }}>You've completed your full skincare routine today. Consistency is the secret to great skin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SKIN JOURNAL ─────────────────────────────────────────────────────────────
const JournalPage = () => {
  const [entries, setEntries] = useState(() => lsGet("journal_entries", []));
  const [newEntry, setNewEntry] = useState({ rating:3, notes:"", symptoms:[] });
  const [saved, setSaved] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const symptomsOpts = ["Breakout","Dryness","Oiliness","Redness","Dullness","Irritation","Smooth","Glowing","Hydrated"];

  const save = () => {
    const entry = { date:todayStr(), ...newEntry, time: new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}) };
    const updated = [entry, ...entries].slice(0, 60);
    setEntries(updated);
    lsSet("journal_entries", updated);
    setNewEntry({ rating:3, notes:"", symptoms:[] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleSym = sym => setNewEntry(e=>({
    ...e,
    symptoms: e.symptoms.includes(sym) ? e.symptoms.filter(s=>s!==sym) : [...e.symptoms, sym],
  }));

  const getAISummary = async () => {
    if (entries.length < 2) return;
    setAiLoading(true);
    try {
      const last7 = entries.slice(0,7).map(e=>`${e.date}: Rating ${e.rating}/5, Symptoms: ${e.symptoms.join(",")||"none"}, Notes: ${e.notes||"—"}`).join("\n");
      const res = await callClaude(
        `Here are my last ${Math.min(7,entries.length)} skin journal entries:\n${last7}\n\nIdentify patterns, what's helping, what's hurting, and give 2-3 actionable tips.`,
        "You are a skincare coach analyzing a skin journal. Be empathetic, specific, and practical in 4-5 sentences.",
      );
      setAiSummary(res);
    } catch { setAiSummary("Could not analyze. Try again."); }
    setAiLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      <div style={{ maxWidth:"840px", margin:"0 auto", padding:"40px 24px" }}>
        <span className="section-label">✦ Skin Journal</span>
        <h1 className="serif" style={{ fontSize:"32px", fontWeight:300, marginTop:"8px", marginBottom:"24px" }}>
          Daily Skin <em style={{ color:"var(--accent)" }}>Log</em>
        </h1>

        {/* New Entry */}
        <div className="card" style={{ padding:"24px", marginBottom:"24px" }}>
          <h3 style={{ fontWeight:600, marginBottom:"16px" }}>
            Log Today · {new Date().toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}
          </h3>
          {/* Emoji rating */}
          <div style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"12px", color:"var(--muted)", marginBottom:"10px", fontWeight:500 }}>How is your skin feeling?</div>
            <div style={{ display:"flex", gap:"8px" }}>
              {SKIN_JOURNAL_RATINGS.map((r,i)=>(
                <button key={i} onClick={()=>setNewEntry(e=>({...e,rating:i+1}))} style={{
                  flex:1, padding:"10px 4px", border:`1.5px solid ${newEntry.rating===i+1?"var(--accent)":"var(--border)"}`,
                  borderRadius:"4px", background: newEntry.rating===i+1?"var(--accent-light)":"var(--surface)",
                  cursor:"pointer", fontSize:"18px", fontFamily:"'Outfit',sans-serif",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
                }}>
                  <span>{r.split(" ")[0]}</span>
                  <span style={{ fontSize:"9px", color:"var(--muted)" }}>{r.split(" ").slice(1).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Symptoms */}
          <div style={{ marginBottom:"14px" }}>
            <div style={{ fontSize:"12px", color:"var(--muted)", marginBottom:"8px", fontWeight:500 }}>Tag today's observations</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {symptomsOpts.map(s=>(
                <span key={s} className={`concern-chip ${newEntry.symptoms.includes(s)?"active":""}`}
                  style={{ fontSize:"12px", padding:"5px 12px" }}
                  onClick={()=>toggleSym(s)}>{s}</span>
              ))}
            </div>
          </div>
          <textarea className="input-field" rows={3}
            value={newEntry.notes}
            onChange={e=>setNewEntry(n=>({...n,notes:e.target.value}))}
            placeholder="Any notes — new product tried, stress level, diet, sleep quality…"
          />
          <div style={{ display:"flex", gap:"10px", marginTop:"14px", alignItems:"center" }}>
            <button className="btn-primary" onClick={save}>
              <span>{saved ? "✓ Saved!" : "Save Entry"}</span>
            </button>
            {entries.length >= 2 && (
              <button className="btn-ghost" onClick={getAISummary} disabled={aiLoading} style={{ padding:"12px 18px", fontSize:"12px" }}>
                {aiLoading ? "Analyzing…" : "🧠 AI Pattern Analysis"}
              </button>
            )}
          </div>
        </div>

        {/* AI summary */}
        {(aiLoading||aiSummary) && (
          <div className="card fade-up" style={{ padding:"20px", marginBottom:"20px", borderLeft:"3px solid var(--accent)" }}>
            <span className="section-label">🧠 AI Skin Pattern Analysis</span>
            {aiLoading
              ? <div style={{ marginTop:"12px" }}><div className="typing-dots"><span/><span/><span/></div></div>
              : <p style={{ fontSize:"14px", lineHeight:1.8, marginTop:"10px" }}>{aiSummary}</p>}
          </div>
        )}

        {/* Past entries */}
        {entries.length > 0 && (
          <div>
            <span className="section-label" style={{ marginBottom:"14px", display:"block" }}>Past Entries ({entries.length})</span>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {entries.slice(0,15).map((e,i)=>(
                <div key={i} className="journal-entry">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      <span style={{ fontSize:"20px" }}>{SKIN_JOURNAL_RATINGS[e.rating-1]?.split(" ")[0]||"🙂"}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:"14px" }}>{SKIN_JOURNAL_RATINGS[e.rating-1]?.slice(3)||"Good"}</div>
                        <div style={{ fontSize:"11px", color:"var(--muted)" }}>{e.date} · {e.time}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", justifyContent:"flex-end" }}>
                      {e.symptoms?.map(s=><span key={s} className="tag" style={{ fontSize:"9px" }}>{s}</span>)}
                    </div>
                  </div>
                  {e.notes && <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.5 }}>{e.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {entries.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--muted)" }}>
            <div style={{ fontSize:"40px", marginBottom:"10px" }}>📝</div>
            <div>No entries yet. Log your first skin day above!</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PRODUCT COMPARATOR ───────────────────────────────────────────────────────
const ComparePage = () => {
  const [products, setProducts] = useState(["",""]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  const compare = async () => {
    if (!products[0].trim() || !products[1].trim()) return;
    setLoading(true); setComparison(null);
    try {
      const sys = `You are a cosmetic chemist. Respond ONLY with valid JSON, no markdown.`;
      const prompt = `Compare these two skincare products for an Indian consumer:
Product A: ${products[0]}
Product B: ${products[1]}

Return ONLY this JSON:
{
  "productA": {
    "name": "<full name>",
    "type": "<category>",
    "keyIngredients": ["<ing1>","<ing2>","<ing3>"],
    "benefits": ["<b1>","<b2>","<b3>"],
    "bestFor": "<skin type/concern>",
    "concerns": ["<c1>"],
    "score": <60-95>
  },
  "productB": {
    "name": "<full name>",
    "type": "<category>",
    "keyIngredients": ["<ing1>","<ing2>","<ing3>"],
    "benefits": ["<b1>","<b2>","<b3>"],
    "bestFor": "<skin type/concern>",
    "concerns": ["<c1>"],
    "score": <60-95>
  },
  "verdict": "<which is better and why — 2 sentences>",
  "winner": "A" | "B" | "tie",
  "situationalWinner": { "forDryness":"A or B","forAcne":"A or B","forAging":"A or B","forSensitive":"A or B" }
}`;
      const text = await callClaude(prompt, sys);
      const clean = text.replace(/```json|```/g,"").trim();
      setComparison(JSON.parse(clean));
    } catch { setComparison(null); alert("Could not compare. Try again."); }
    setLoading(false);
  };

  const C2 = comparison;

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px" }}>
      <div style={{ maxWidth:"900px", margin:"0 auto", padding:"40px 24px" }}>
        <span className="section-label">✦ Product Comparator</span>
        <h1 className="serif" style={{ fontSize:"32px", fontWeight:300, marginTop:"8px", marginBottom:"8px" }}>
          Compare <em style={{ color:"var(--accent)" }}>Products</em>
        </h1>
        <p style={{ color:"var(--muted)", fontSize:"14px", marginBottom:"28px" }}>Enter any two skincare products and get a detailed AI comparison.</p>

        <div className="card" style={{ padding:"24px", marginBottom:"24px" }}>
          <div className="compare-row" style={{ display:"flex", gap:"16px", alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"12px", color:"var(--muted)", marginBottom:"6px", display:"block", fontWeight:500 }}>Product A</label>
              <input className="input-field"
                value={products[0]}
                onChange={e=>setProducts([e.target.value,products[1]])}
                placeholder="e.g. Minimalist 10% Niacinamide Serum"
              />
            </div>
            <div style={{ fontSize:"20px", color:"var(--muted)", paddingBottom:"12px", flexShrink:0 }}>vs</div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"12px", color:"var(--muted)", marginBottom:"6px", display:"block", fontWeight:500 }}>Product B</label>
              <input className="input-field"
                value={products[1]}
                onChange={e=>setProducts([products[0],e.target.value])}
                placeholder="e.g. Dot & Key Vitamin C Serum"
              />
            </div>
          </div>
          <div style={{ marginTop:"16px", display:"flex", gap:"10px", flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={compare} disabled={!products[0].trim()||!products[1].trim()||loading}>
              <span>{loading?"Comparing…":"Compare Now ⚖️"}</span>
            </button>
            <button className="btn-ghost" style={{ padding:"12px 16px", fontSize:"11px" }} onClick={()=>{ setProducts(["Minimalist 10% Niacinamide","Cosrx Advanced Snail 96 Mucin Power Essence"]); setComparison(null); }}>
              Try Example
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign:"center", padding:"40px" }}>
            <div className="typing-dots" style={{ justifyContent:"center", display:"flex" }}><span/><span/><span/></div>
            <p style={{ color:"var(--muted)", marginTop:"12px" }}>Analyzing products…</p>
          </div>
        )}

        {C2 && (
          <div className="fade-up">
            {/* Side by side */}
            <div className="compare-row" style={{ display:"flex", gap:"16px", marginBottom:"20px" }}>
              {[C2.productA, C2.productB].map((p,i)=>(
                <div key={i} className="compare-col" style={{
                  borderTop: C2.winner===(i===0?"A":"B") ? "3px solid var(--accent)" : C2.winner==="tie"?"3px solid var(--gold)":"3px solid var(--border)",
                }}>
                  {C2.winner===(i===0?"A":"B") && (
                    <div style={{ background:"var(--accent)", color:"#fff", textAlign:"center", padding:"4px", fontSize:"11px", fontWeight:600, letterSpacing:"1px" }}>
                      ✦ WINNER
                    </div>
                  )}
                  <div style={{ padding:"20px" }}>
                    <div style={{ fontSize:"10px", color:"var(--muted)", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"4px" }}>Product {i===0?"A":"B"}</div>
                    <h3 style={{ fontWeight:700, fontSize:"15px", marginBottom:"6px" }}>{p.name}</h3>
                    <span className="tag">{p.type}</span>
                    {/* Score */}
                    <div style={{ marginTop:"14px", marginBottom:"14px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                        <span style={{ fontSize:"12px", color:"var(--muted)" }}>AI Score</span>
                        <span style={{ fontWeight:700, color:"var(--accent)" }}>{p.score}/100</span>
                      </div>
                      <div className="progress-bar">
                        <div style={{ height:"100%", width:`${p.score}%`, background:"var(--accent)", borderRadius:"2px" }} />
                      </div>
                    </div>
                    <div style={{ marginBottom:"10px" }}>
                      <div style={{ fontSize:"11px", color:"var(--muted)", marginBottom:"5px", fontWeight:600 }}>KEY INGREDIENTS</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
                        {p.keyIngredients?.map(ing=><span key={ing} className="tag">{ing}</span>)}
                      </div>
                    </div>
                    <div style={{ marginBottom:"10px" }}>
                      <div style={{ fontSize:"11px", color:"var(--muted)", marginBottom:"5px", fontWeight:600 }}>BENEFITS</div>
                      {p.benefits?.map((b,j)=><div key={j} style={{ fontSize:"12px", lineHeight:1.5, color:"var(--text-sub)" }}>✓ {b}</div>)}
                    </div>
                    <div style={{ fontSize:"12px", color:"var(--accent)", fontWeight:500, marginBottom:"8px" }}>Best for: {p.bestFor}</div>
                    {p.concerns?.length>0 && (
                      <div>
                        {p.concerns.map((c,j)=><div key={j} style={{ fontSize:"11px", color:"var(--rose)" }}>⚠ {c}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Verdict */}
            <div className="card" style={{ padding:"20px", marginBottom:"16px", borderLeft:"3px solid var(--accent)" }}>
              <span className="section-label">AI Verdict</span>
              <p style={{ fontSize:"14px", lineHeight:1.8, marginTop:"10px" }}>{C2.verdict}</p>
            </div>

            {/* Situational */}
            {C2.situationalWinner && (
              <div className="card" style={{ padding:"20px" }}>
                <span className="section-label" style={{ marginBottom:"12px", display:"block" }}>Situational Winner</span>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"10px" }}>
                  {Object.entries(C2.situationalWinner).map(([situation,winner])=>(
                    <div key={situation} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"var(--bg-alt)", borderRadius:"4px" }}>
                      <span style={{ fontSize:"13px", textTransform:"capitalize" }}>{situation.replace(/([A-Z])/g," $1").trim()}</span>
                      <span style={{ fontSize:"13px", fontWeight:700, color:"var(--accent)" }}>Product {winner}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
const ChatPage = ({ result }) => {
  const [messages, setMessages] = useState([{
    role:"assistant",
    text:"Hello! I'm your AI dermatologist powered by Claude. I can answer questions about skincare, ingredients, your routine, product recommendations, and more. What's on your mind?",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const send = async (text = input) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user", text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const sys = `You are a friendly, knowledgeable dermatologist and skincare expert. 
${result ? `Context about this user: ${result.skinProfile}. Their skin type is ${result.skinScore}/100 health score.` : ""}
Be warm, specific, and practical. Keep responses concise (3-5 sentences) unless a detailed explanation is needed. Use Indian product names when recommending.`;
      const history = updated.slice(-6).map(m=>({ role:m.role==="user"?"user":"assistant", content:m.text }));
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-5",
          max_tokens: 600,
          messages: [{ role: "system", content: sys }, ...history],
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "";
      setMessages(m=>[...m,{ role:"assistant", text:reply }]);
    } catch {
      setMessages(m=>[...m,{ role:"assistant", text:"Sorry, I couldn't respond. Please check your API key and try again." }]);
    }
    setLoading(false);
  };

  const suggestions = [
    "Can I layer niacinamide with vitamin C?",
    "What's causing my skin purging?",
    "Best budget serum for dark spots in India?",
    "Should I use retinol in the morning or night?",
    "How do I build a minimal routine?",
    "Why is my skin oily in T-zone but dry on cheeks?",
  ];

  return (
    <div style={{ minHeight:"100vh", paddingTop:"64px", display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, maxWidth:"740px", width:"100%", margin:"0 auto", padding:"24px 24px 0", display:"flex", flexDirection:"column" }}>
        <div style={{ marginBottom:"16px" }}>
          <span className="section-label">✦ AI Dermatologist</span>
          <h1 className="serif" style={{ fontSize:"28px", fontWeight:300, marginTop:"6px" }}>
            Ask <em style={{ color:"var(--accent)" }}>Anything</em>
          </h1>
        </div>

        {/* Chat messages */}
        <div className="thin-scroll" style={{
          flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:"12px",
          paddingBottom:"16px", minHeight:"300px", maxHeight:"calc(100vh - 280px)",
        }}>
          {messages.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              {m.role==="assistant" && (
                <div style={{
                  width:32, height:32, borderRadius:"50%", flexShrink:0, marginRight:"8px",
                  background:"linear-gradient(135deg,var(--accent),var(--gold))",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px",
                }}>🩺</div>
              )}
              <div className={m.role==="user"?"chat-bubble-user":"chat-bubble-ai"}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,var(--accent),var(--gold))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px" }}>🩺</div>
              <div className="chat-bubble-ai">
                <div className="typing-dots"><span/><span/><span/></div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length < 3 && (
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"12px" }}>
            {suggestions.map(s=>(
              <button key={s} onClick={()=>send(s)} style={{
                background:"var(--bg-alt)", border:"1px solid var(--border)",
                borderRadius:"20px", padding:"7px 14px", fontSize:"12px",
                cursor:"pointer", color:"var(--muted)", fontFamily:"'Outfit',sans-serif",
                transition:"all 0.2s",
              }}
              onMouseEnter={e=>{ e.target.style.borderColor="var(--accent)"; e.target.style.color="var(--accent)"; }}
              onMouseLeave={e=>{ e.target.style.borderColor="var(--border)"; e.target.style.color="var(--muted)"; }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display:"flex", gap:"10px", paddingBottom:"24px", paddingTop:"8px", background:"var(--bg)", position:"sticky", bottom:0 }}>
          <input
            className="input-field"
            style={{ borderRadius:"24px", padding:"12px 20px" }}
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Ask your skin question…"
          />
          <button className="btn-primary"
            onClick={()=>send()}
            disabled={!input.trim()||loading}
            style={{ borderRadius:"24px", padding:"12px 24px", whiteSpace:"nowrap" }}
          >
            <span>{loading?"…":"Send →"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ROUTINE PAGE (standalone) ────────────────────────────────────────────────
const RoutinePage = ({ result, setPage }) => {
  if (!result) return (
    <div style={{ minHeight:"100vh",paddingTop:"64px",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center",padding:"40px" }}>
        <div style={{ fontSize:"48px",marginBottom:"12px" }}>🌿</div>
        <h2 className="serif" style={{ fontSize:"28px",fontWeight:300,marginBottom:"10px" }}>No routine yet</h2>
        <p style={{ color:"var(--muted)",marginBottom:"20px" }}>Take the skin quiz to generate your personalized routine.</p>
        <button className="btn-primary" onClick={()=>setPage("quiz")}><span>Start Quiz</span></button>
      </div>
    </div>
  );
  // Redirect to results > routine tab
  useEffect(() => { setPage("results"); }, []);
  return null;
};

// ─── FALLBACK RESULT ──────────────────────────────────────────────────────────
const FALLBACK_RESULT = {
  skinScore:74, skinAge:"25-28",
  skinProfile:"Your skin shows a classic combination pattern with an active T-zone and drier peripheral areas. With a consistent barrier-first routine, you can achieve a balanced, radiant complexion.",
  primaryIssue:"Barrier Repair",
  keyFindings:["Skin barrier needs strengthening — focus on ceramide-rich products","Targeted hydration is key before adding active ingredients","Daily SPF is non-negotiable for your climate and skin goals"],
  metrics:{ hydration:65, barrier:58, clarity:70, radiance:68, oiliness:55, sensitivity:40 },
  morningRoutine:[
    { step:1, product:"Gentle Gel Cleanser", ingredient:"Centella Asiatica", why:"Cleans without stripping your delicate barrier.", tip:"Use lukewarm water — never hot." },
    { step:2, product:"Vitamin C Serum 15%", ingredient:"Ascorbic Acid", why:"Protects against pollution and brightens skin.", tip:"Apply on slightly damp skin for better penetration." },
    { step:3, product:"Lightweight Moisturizer", ingredient:"Hyaluronic Acid + Ceramides", why:"Seals hydration and fortifies the barrier.", tip:"Apply within 60 seconds of washing for best results." },
    { step:4, product:"Broad Spectrum SPF 50+", ingredient:"Zinc Oxide", why:"Daily UV protection prevents 80% of visible skin aging.", tip:"Reapply every 2 hours when outdoors." },
  ],
  eveningRoutine:[
    { step:1, product:"Micellar Water / Oil Cleanser", ingredient:"Jojoba Oil", why:"Removes sunscreen and impurities without stripping.", tip:"Always double cleanse on days you wear SPF." },
    { step:2, product:"Exfoliating Toner (3x/week)", ingredient:"Niacinamide + AHA", why:"Refines texture and evens tone while you sleep.", tip:"Skip on nights you use retinol." },
    { step:3, product:"Treatment Serum", ingredient:"Retinol 0.2%", why:"Stimulates collagen and addresses your primary concern overnight.", tip:"Start 2x/week and build up slowly." },
    { step:4, product:"Rich Night Cream", ingredient:"Squalane + Peptides", why:"Intensive barrier repair during your skin's peak regeneration hours.", tip:"Use an extra layer as a sleeping mask once a week." },
  ],
  topProducts:[
    { name:"Minimalist 10% Niacinamide Serum", brand:"Minimalist", type:"Serum", price:"₹599", rating:4.5, keyIngredient:"Niacinamide", suitableFor:"Pores & Glow", emoji:"💎", bestFor:"Daily brightening" },
    { name:"Re'equil Ceramide & HA Moisturizer", brand:"Re'equil", type:"Moisturizer", price:"₹795", rating:4.3, keyIngredient:"Ceramides", suitableFor:"Hydration", emoji:"💧", bestFor:"Barrier repair" },
    { name:"Dot & Key Waterlight SPF 50", brand:"Dot & Key", type:"Sunscreen", price:"₹475", rating:4.4, keyIngredient:"Zinc Oxide", suitableFor:"Daily Protection", emoji:"☀️", bestFor:"Everyday wear" },
    { name:"COSRX Advanced Snail Mucin 96", brand:"COSRX", type:"Essence", price:"₹1,290", rating:4.7, keyIngredient:"Snail Filtrate", suitableFor:"Repair & Glow", emoji:"🌟", bestFor:"Skin repair" },
    { name:"Plum 1% Retinol Face Serum", brand:"Plum", type:"Serum", price:"₹845", rating:4.2, keyIngredient:"Retinol", suitableFor:"Anti-aging", emoji:"⚡", bestFor:"Nighttime treatment" },
    { name:"Simple Kind to Skin Moisturizer", brand:"Simple", type:"Moisturizer", price:"₹350", rating:4.1, keyIngredient:"Vitamins B3, B5, E", suitableFor:"Sensitive Skin", emoji:"🌸", bestFor:"Gentle daily use" },
  ],
  ingredientsToAvoid:["Fragrance / Parfum","Alcohol Denat","Sodium Lauryl Sulfate"],
  ingredientsToSeek:["Ceramides","Niacinamide","Hyaluronic Acid"],
  dietTips:["Drink 2-3L of water daily for deep skin hydration","Include Omega-3 rich flaxseeds and walnuts to strengthen barrier","Reduce refined sugar to minimize collagen-damaging glycation"],
  weeklyTreatments:["Clay mask 1-2x/week to deep-clean pores","Hydrating sheet mask mid-week for instant glow boost"],
  lifestyleTips:["Sleep 7-8 hours — skin repairs itself overnight","Keep a clean pillowcase — change every 2-3 days","Manage stress: cortisol directly triggers breakouts"],
  ingredientPairings:[
    { pair:["Vitamin C","Niacinamide"], verdict:"safe", note:"Modern formulations are stable together — apply Vitamin C first, let absorb, then layer niacinamide." },
    { pair:["Retinol","AHAs/BHAs"], verdict:"avoid", note:"Both are actives that increase cell turnover — using together causes over-exfoliation and irritation." },
    { pair:["Hyaluronic Acid","Any Moisturizer"], verdict:"safe", note:"HA draws water in; top with moisturizer to seal it in for maximum hydration benefit." },
    { pair:["Benzoyl Peroxide","Retinol"], verdict:"avoid", note:"BP oxidizes retinol, rendering it ineffective. Use on alternate nights or different parts of routine." },
  ],
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => lsGet("dark_mode", false));
  const [page, setPage] = useState("home");
  const [profile, setProfile] = useState(null);
  const [result, setResult] = useState(null);
  const C = dark ? DARK : LIGHT;

  useEffect(() => { lsSet("dark_mode", dark); }, [dark]);

  // Page guard
  const navigate = (p) => {
    if ((p==="results"||p==="routine") && !result) { setPage("quiz"); return; }
    setPage(p);
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  // CSS as string
  const styleStr = makeStyles(C);

  return (
    <>
      <style>{styleStr}</style>
      {page !== "analyzing" && <Nav page={page} setPage={navigate} dark={dark} setDark={setDark} />}
      {page === "home"        && <HeroPage setPage={setPage} dark={dark} />}
      {page === "quiz"        && <QuizPage setPage={setPage} setProfile={setProfile} />}
      {page === "analyzing"   && <AnalyzingPage profile={profile} setPage={setPage} setResult={setResult} />}
      {page === "results"     && <ResultsPage profile={profile} result={result} setPage={navigate} />}
      {page === "ingredients" && <IngredientsPage result={result} />}
      {page === "routine"     && <RoutinePage result={result} setPage={navigate} />}
      {page === "tracker"     && <TrackerPage result={result} setPage={navigate} />}
      {page === "journal"     && <JournalPage />}
      {page === "compare"     && <ComparePage />}
      {page === "chat"        && <ChatPage result={result} />}
    </>
  );
}