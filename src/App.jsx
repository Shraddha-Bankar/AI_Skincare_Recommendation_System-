import { useState, useEffect, useRef, useCallback } from "react";

// ─── TOKEN-SAFE ANTHROPIC API LAYER ───────────────────────────────────────────
// Key fixes:
// 1. All max_tokens budgets are conservative & module-specific
// 2. Prompts are hard-truncated before sending
// 3. Robust JSON extraction with multiple fallback strategies
// 4. Exponential back-off retry for 529 overload errors
// 5. callAIStream for Chat — streams text chunks to avoid timeout on long waits

const MODEL = "claude-sonnet-4-20250514";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Core fetch with retry on 529 overload
const fetchWithRetry = async (body, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 529 && attempt < retries) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return res;
  }
};

// Standard single-turn call
const callAI = async (
  userPrompt,
  systemPrompt = "You are a helpful skincare expert.",
  imageBase64 = null,
  imageType = null,
  maxTokens = 800
) => {
  const content = [];
  if (imageBase64 && imageType) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: imageType, data: imageBase64 },
    });
  }
  // Hard-truncate text prompt to ~1200 chars to keep input tokens low
  content.push({ type: "text", text: userPrompt.slice(0, 1200) });

  const res = await fetchWithRetry({
    model: MODEL,
    max_tokens: Math.min(maxTokens, 1024),
    system: systemPrompt.slice(0, 400),
    messages: [{ role: "user", content }],
  });
  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  return block?.text || "";
};

// Multi-turn chat call — limits history to last 6 messages
const callAIChat = async (messages, systemPrompt, maxTokens = 600) => {
  // Keep last 6 turns, truncate each message text
  const trimmed = messages.slice(-6).map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content.slice(0, 600)
        : m.content,
  }));
  const res = await fetchWithRetry({
    model: MODEL,
    max_tokens: Math.min(maxTokens, 700),
    system: systemPrompt.slice(0, 400),
    messages: trimmed,
  });
  const data = await res.json();
  const block = data.content?.find((b) => b.type === "text");
  return block?.text || "";
};

// Streaming chat — calls onChunk(text) as each delta arrives
const callAIChatStream = async (messages, systemPrompt, onChunk, maxTokens = 600) => {
  const trimmed = messages.slice(-6).map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string" ? m.content.slice(0, 600) : m.content,
  }));
  const res = await fetch("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: Math.min(maxTokens, 700),
      system: systemPrompt.slice(0, 400),
      messages: trimmed,
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(6));
        const delta = json?.delta?.text;
        if (delta) { full += delta; onChunk(full); }
      } catch {}
    }
  }
  return full;
};

// Robust JSON extractor — tries multiple strategies before giving up
const extractJSON = (text) => {
  if (!text) return null;
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);
  try { return JSON.parse(clean); } catch {}
  const fixed = clean.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(fixed); } catch {}
  // Strategy 4: remove bad characters
  const cleaned = clean.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  try { return JSON.parse(cleaned); } catch {}
  return null;
};

const getErrorMsg = (e) => {
  if (e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError"))
    return "Network error — is your proxy server running? Run: node server.js";
  if (e.message?.includes("529") || e.message?.includes("overloaded"))
    return "AI is busy right now. Please wait a moment and try again.";
  if (e.message?.includes("404"))
    return "Proxy not found — make sure node server.js is running on port 3001.";
  if (e.message?.includes("401"))
    return "Invalid API key — check your key in server.js.";
  if (e.message?.includes("400"))
    return "Request too large. Please shorten your input and try again.";
  return `Something went wrong: ${e.message}. Please try again.`;
};

// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg: "#F8F4EF", bgAlt: "#F0E8DC", bgAlt2: "#E8DDD0",
  surface: "#FEFCFA", surfaceGlass: "rgba(255,252,248,0.72)",
  border: "#E4D8C8", borderGlass: "rgba(228,216,200,0.5)",
  text: "#1A1208", textSub: "#3D3020", muted: "#8A7460",
  accent: "#C4845A", accentDark: "#9A6040", accentLight: "#F5E8D8",
  accentGlow: "rgba(196,132,90,0.18)",
  green: "#5C8C5C", greenLight: "#D0E8D0",
  gold: "#C8A45C", goldLight: "#FAF0D8",
  rose: "#C47878", lavender: "#9080B8", navy: "#384468",
  shadow: "0 2px 24px rgba(196,132,90,0.10), 0 1px 4px rgba(26,18,8,0.06)",
  shadowLg: "0 8px 48px rgba(196,132,90,0.16), 0 2px 12px rgba(26,18,8,0.08)",
  shadowXl: "0 24px 80px rgba(196,132,90,0.22), 0 4px 24px rgba(26,18,8,0.10)",
  overlay: "rgba(26,18,8,0.55)",
};
const DARK = {
  bg: "#0D0A07", bgAlt: "#160E08", bgAlt2: "#1E140C",
  surface: "#120C08", surfaceGlass: "rgba(18,12,8,0.75)",
  border: "#2A1E12", borderGlass: "rgba(42,30,18,0.6)",
  text: "#F5EDE0", textSub: "#C8B498", muted: "#7A6448",
  accent: "#D49060", accentDark: "#B87848", accentLight: "#2A1608",
  accentGlow: "rgba(212,144,96,0.22)",
  green: "#70A870", greenLight: "#162416",
  gold: "#D4AA68", goldLight: "#1E1608",
  rose: "#D08080", lavender: "#A890CC", navy: "#6878AA",
  shadow: "0 2px 24px rgba(0,0,0,0.40), 0 1px 4px rgba(0,0,0,0.30)",
  shadowLg: "0 8px 48px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.35)",
  shadowXl: "0 24px 80px rgba(0,0,0,0.70), 0 4px 24px rgba(0,0,0,0.40)",
  overlay: "rgba(0,0,0,0.75)",
};

const makeStyles = (C) => `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:${C.bg};--bg-alt:${C.bgAlt};--bg-alt2:${C.bgAlt2};
    --surface:${C.surface};--surface-glass:${C.surfaceGlass};
    --border:${C.border};--border-glass:${C.borderGlass};
    --text:${C.text};--text-sub:${C.textSub};--muted:${C.muted};
    --accent:${C.accent};--accent-dark:${C.accentDark};--accent-light:${C.accentLight};
    --accent-glow:${C.accentGlow};
    --green:${C.green};--green-light:${C.greenLight};
    --gold:${C.gold};--gold-light:${C.goldLight};
    --rose:${C.rose};--lavender:${C.lavender};--navy:${C.navy};
    --shadow:${C.shadow};--shadow-lg:${C.shadowLg};--shadow-xl:${C.shadowXl};
  }
  html{scroll-behavior:smooth;}
  body{font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.6;}
  ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--accent);border-radius:4px;opacity:.6;}
  .serif{font-family:'Cormorant Garamond',Georgia,serif;}
  .mono{font-family:'DM Mono',monospace;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  @keyframes orb{0%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.1)}66%{transform:translate(-20px,15px) scale(.95)}100%{transform:translate(0,0) scale(1)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes barGrow{from{width:0%}to{width:var(--w,100%)}}
  @keyframes scanLine{0%{top:-2px}100%{top:100%}}
  @keyframes glassReveal{from{opacity:0;transform:scale(.96) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes scoreCount{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
  .fade-up{animation:fadeUp .6s cubic-bezier(.16,1,.3,1) both;}
  .fade-in{animation:fadeIn .45s ease both;}
  .glass-reveal{animation:glassReveal .55s cubic-bezier(.16,1,.3,1) both;}
  .glass{
    background:var(--surface-glass);
    backdrop-filter:blur(20px) saturate(1.6);
    -webkit-backdrop-filter:blur(20px) saturate(1.6);
    border:1px solid var(--border-glass);
    border-radius:16px;
    box-shadow:var(--shadow);
  }
  .glass-hover{transition:transform .25s ease,box-shadow .25s ease;}
  .glass-hover:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
  .btn-primary{
    position:relative;overflow:hidden;
    background:linear-gradient(135deg,var(--accent),var(--accent-dark));
    color:#fff;border:none;border-radius:10px;
    padding:13px 28px;font-family:'DM Sans',sans-serif;font-size:13px;
    font-weight:600;letter-spacing:.8px;cursor:pointer;
    transition:all .22s ease;
    box-shadow:0 2px 12px var(--accent-glow),inset 0 1px 0 rgba(255,255,255,0.15);
  }
  .btn-primary::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.12),transparent);opacity:0;transition:opacity .2s;}
  .btn-primary:hover{transform:translateY(-2px);box-shadow:0 6px 24px var(--accent-glow),inset 0 1px 0 rgba(255,255,255,0.2);}
  .btn-primary:hover::after{opacity:1;}
  .btn-primary:active{transform:translateY(0);box-shadow:0 1px 6px var(--accent-glow);}
  .btn-primary:disabled{background:var(--muted);cursor:not-allowed;transform:none;box-shadow:none;}
  .btn-primary span{position:relative;z-index:1;}
  .btn-ghost{
    background:transparent;color:var(--accent);
    border:1.5px solid var(--border);border-radius:10px;
    padding:11px 24px;font-family:'DM Sans',sans-serif;font-size:13px;
    font-weight:500;letter-spacing:.4px;cursor:pointer;
    transition:all .2s ease;
  }
  .btn-ghost:hover{background:var(--accent-light);border-color:var(--accent);transform:translateY(-1px);}
  .btn-ghost:disabled{opacity:.45;cursor:not-allowed;transform:none;}
  .btn-icon{
    width:38px;height:38px;display:flex;align-items:center;justify-content:center;
    background:var(--surface-glass);border:1px solid var(--border);
    border-radius:50%;cursor:pointer;transition:all .2s ease;font-size:16px;
    backdrop-filter:blur(8px);
  }
  .btn-icon:hover{background:var(--accent-light);border-color:var(--accent);transform:scale(1.08);}
  .input-field{
    width:100%;border:1.5px solid var(--border);border-radius:10px;
    padding:11px 16px;font-family:'DM Sans',sans-serif;font-size:14px;
    background:var(--surface-glass);color:var(--text);resize:vertical;
    transition:border-color .2s,box-shadow .2s;outline:none;
    backdrop-filter:blur(8px);
  }
  .input-field:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow);}
  .input-field::placeholder{color:var(--muted);}
  .option-card{
    background:var(--surface-glass);border:1.5px solid var(--border);
    border-radius:12px;padding:16px 18px;cursor:pointer;
    transition:all .2s ease;text-align:left;position:relative;overflow:hidden;
    backdrop-filter:blur(10px);
  }
  .option-card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 4px 20px var(--accent-glow);}
  .option-card.selected{
    border-color:var(--accent);background:var(--accent-light);
    box-shadow:0 0 0 1px var(--accent),0 4px 20px var(--accent-glow);
  }
  .option-card.selected::before{
    content:'✓';position:absolute;top:8px;right:10px;
    width:20px;height:20px;border-radius:50%;background:var(--accent);
    color:#fff;display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;
  }
  .tag{display:inline-block;background:var(--bg-alt);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);font-weight:600;}
  .tag-accent{background:var(--accent-light);border-color:var(--accent);color:var(--accent);}
  .ingredient-badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;}
  .badge-safe{background:${C.greenLight};color:${C.green};}
  .badge-caution{background:#FEF3CD;color:#7A5C00;}
  .badge-avoid{background:${C.rose}22;color:${C.rose};}
  .progress-bar{height:3px;background:var(--bg-alt2);border-radius:3px;overflow:hidden;}
  .progress-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--gold));border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
  .nav{
    position:fixed;top:0;left:0;right:0;z-index:200;height:62px;
    display:flex;align-items:center;padding:0 32px;justify-content:space-between;
    background:${C.bg}CC;backdrop-filter:blur(24px) saturate(1.8);
    border-bottom:1px solid var(--border-glass);
    box-shadow:0 1px 20px rgba(196,132,90,0.06);
  }
  .tab-bar{display:flex;border-bottom:1px solid var(--border);gap:0;overflow-x:auto;}
  .tab-bar::-webkit-scrollbar{height:0;}
  .tab-item{padding:12px 13px;font-size:12px;font-weight:500;letter-spacing:.2px;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;color:var(--muted);background:none;white-space:nowrap;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;}
  .tab-item:hover{color:var(--text);}
  .tab-item.active{color:var(--accent);border-bottom-color:var(--accent);}
  .concern-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface-glass);border:1.5px solid var(--border);border-radius:24px;padding:7px 15px;font-size:13px;cursor:pointer;transition:all .2s;user-select:none;backdrop-filter:blur(8px);}
  .concern-chip:hover{border-color:var(--accent);color:var(--accent);}
  .concern-chip.active{background:var(--accent-light);border-color:var(--accent);color:var(--accent);}
  .routine-step{display:flex;align-items:flex-start;gap:14px;padding:18px 0;border-bottom:1px solid var(--border);}
  .routine-step:last-child{border-bottom:none;}
  .step-num{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;box-shadow:0 2px 8px var(--accent-glow);}
  .typing-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin:0 2px;animation:pulse 1.4s infinite;}
  .typing-dots span:nth-child(2){animation-delay:.22s;}.typing-dots span:nth-child(3){animation-delay:.44s;}
  .section-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted);font-weight:600;}
  .chat-bubble-user{background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;border-radius:18px 18px 4px 18px;padding:11px 15px;max-width:80%;align-self:flex-end;font-size:14px;line-height:1.55;box-shadow:0 2px 10px var(--accent-glow);}
  .chat-bubble-ai{background:var(--surface-glass);border:1px solid var(--border-glass);backdrop-filter:blur(12px);border-radius:18px 18px 18px 4px;padding:11px 15px;max-width:86%;align-self:flex-start;font-size:14px;line-height:1.65;white-space:pre-wrap;}
  .streak-day{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;transition:all .2s;}
  .streak-done{background:linear-gradient(135deg,var(--green),${C.greenLight});color:#fff;}
  .streak-today{background:linear-gradient(135deg,var(--accent),var(--accent-dark));color:#fff;box-shadow:0 0 14px var(--accent-glow);}
  .streak-missed{background:var(--bg-alt2);color:var(--muted);}
  .streak-future{background:var(--bg-alt);color:var(--border);border:1px dashed var(--border);}
  .journal-entry{padding:16px;border-radius:12px;background:var(--surface-glass);border:1px solid var(--border-glass);backdrop-filter:blur(10px);transition:all .2s;}
  .journal-entry:hover{border-color:var(--accent);}
  .error-box{padding:13px 16px;background:${C.rose}14;border:1px solid ${C.rose}40;border-radius:10px;font-size:13px;color:var(--rose);line-height:1.55;}
  .success-box{padding:13px 16px;background:var(--green-light);border:1px solid var(--green);border-radius:10px;font-size:13px;color:var(--green);line-height:1.55;}
  .camera-corner{position:absolute;width:20px;height:20px;}
  .camera-corner-tl{top:-1px;left:-1px;border-top:2.5px solid var(--accent);border-left:2.5px solid var(--accent);}
  .camera-corner-tr{top:-1px;right:-1px;border-top:2.5px solid var(--accent);border-right:2.5px solid var(--accent);}
  .camera-corner-bl{bottom:-1px;left:-1px;border-bottom:2.5px solid var(--accent);border-left:2.5px solid var(--accent);}
  .camera-corner-br{bottom:-1px;right:-1px;border-bottom:2.5px solid var(--accent);border-right:2.5px solid var(--accent);}
  .scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent)88,transparent);animation:scanLine 2.2s linear infinite;}
  .orb{position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;animation:orb 8s ease-in-out infinite;}
  .shimmer{background:linear-gradient(90deg,var(--bg-alt) 25%,var(--bg-alt2) 50%,var(--bg-alt) 75%);background-size:200% 100%;animation:shimmer 1.6s infinite;}
  .score-ring{filter:drop-shadow(0 0 16px var(--accent-glow));}
  .compare-col{flex:1;background:var(--surface-glass);border:1px solid var(--border-glass);border-radius:16px;overflow:hidden;backdrop-filter:blur(14px);transition:all .3s;}
  .compare-col:hover{border-color:var(--accent);box-shadow:0 8px 32px var(--accent-glow);}
  .thin-scroll::-webkit-scrollbar{width:3px;}.thin-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
  .metric-fill{height:100%;border-radius:3px;animation:barGrow .9s cubic-bezier(.34,1.56,.64,1) both;}
  .kpi-card{background:var(--surface-glass);border:1px solid var(--border-glass);border-radius:14px;padding:20px;text-align:center;backdrop-filter:blur(14px);transition:all .25s;}
  .kpi-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);}
  .grain{position:absolute;inset:0;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
  @media(max-width:768px){
    .nav{padding:0 14px;}
    .hero-grid{grid-template-columns:1fr !important;}
    .results-grid{grid-template-columns:1fr !important;}
    .product-grid{grid-template-columns:1fr 1fr !important;}
    .routine-grid{grid-template-columns:1fr !important;}
    .compare-row{flex-direction:column !important;}
    .tab-item{padding:11px 9px;font-size:11px;}
    .kpi-grid{grid-template-columns:1fr 1fr !important;}
    .two-col{grid-template-columns:1fr !important;}
  }
  @media(max-width:480px){
    .product-grid{grid-template-columns:1fr !important;}
    .kpi-grid{grid-template-columns:1fr !important;}
  }
  *{transition:background-color .3s ease,border-color .25s ease,color .15s ease;}
  button,a,input,textarea{transition:all .2s ease !important;}
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SKIN_TYPES = [
  { id:"dry",emoji:"🌵",label:"Dry",desc:"Tight, flaky, rough texture" },
  { id:"oily",emoji:"💦",label:"Oily",desc:"Shiny T-zone, enlarged pores" },
  { id:"combination",emoji:"⚖️",label:"Combination",desc:"Oily T-zone, dry cheeks" },
  { id:"sensitive",emoji:"🌸",label:"Sensitive",desc:"Reacts easily, prone to redness" },
  { id:"normal",emoji:"✨",label:"Normal",desc:"Balanced, minimal concerns" },
];
const CONCERNS = [
  { id:"acne",label:"Acne & Breakouts",emoji:"🔴" },
  { id:"aging",label:"Fine Lines & Aging",emoji:"⏰" },
  { id:"hyperpigmentation",label:"Dark Spots",emoji:"🌑" },
  { id:"dullness",label:"Dullness & Glow",emoji:"✨" },
  { id:"redness",label:"Redness & Rosacea",emoji:"🌺" },
  { id:"pores",label:"Large Pores",emoji:"🔬" },
  { id:"dryness",label:"Dehydration",emoji:"💧" },
  { id:"eyecircles",label:"Dark Eye Circles",emoji:"👁️" },
  { id:"texture",label:"Uneven Texture",emoji:"🧴" },
  { id:"sensitivity",label:"Irritation",emoji:"❄️" },
];
const AGE_RANGES = ["Under 18","18–24","25–34","35–44","45–54","55+"];
const CLIMATES = [
  { id:"humid",label:"Humid / Tropical",emoji:"🌴" },
  { id:"dry",label:"Dry / Arid",emoji:"🏜️" },
  { id:"temperate",label:"Temperate",emoji:"🌤️" },
  { id:"cold",label:"Cold / Harsh",emoji:"❄️" },
  { id:"polluted",label:"Urban / Polluted",emoji:"🏙️" },
];
const BUDGETS = [
  { id:"budget",label:"Budget",sub:"Under ₹500/product" },
  { id:"mid",label:"Mid-Range",sub:"₹500–₹2000" },
  { id:"premium",label:"Premium",sub:"₹2000–₹5000" },
  { id:"luxury",label:"Luxury",sub:"₹5000+" },
];
const KNOWN_INGREDIENTS = {
  "niacinamide":{ status:"safe",effect:"Brightens skin, minimizes pores, reduces inflammation" },
  "retinol":{ status:"caution",effect:"Anti-aging & cell turnover — avoid if pregnant or sensitive" },
  "hyaluronic acid":{ status:"safe",effect:"Deep hydration, plumps & holds moisture" },
  "salicylic acid":{ status:"caution",effect:"Exfoliates & fights acne — can be drying" },
  "vitamin c":{ status:"safe",effect:"Brightening antioxidant, boosts collagen" },
  "glycolic acid":{ status:"caution",effect:"Chemical exfoliant — always use sunscreen" },
  "benzoyl peroxide":{ status:"caution",effect:"Kills acne bacteria — can bleach fabrics" },
  "fragrance":{ status:"avoid",effect:"Common irritant — skip if sensitive" },
  "alcohol denat":{ status:"avoid",effect:"Drying, damages skin barrier long-term" },
  "parabens":{ status:"caution",effect:"Preservative — some prefer to avoid" },
  "sulfates":{ status:"avoid",effect:"Strips natural oils, causes irritation" },
  "ceramides":{ status:"safe",effect:"Repairs skin barrier, locks in moisture" },
  "peptides":{ status:"safe",effect:"Boosts collagen production, firms skin" },
  "zinc oxide":{ status:"safe",effect:"Physical sunscreen, calms redness" },
  "squalane":{ status:"safe",effect:"Lightweight, non-comedogenic moisturizer" },
  "lactic acid":{ status:"caution",effect:"Gentle AHA — exfoliates and brightens" },
  "tranexamic acid":{ status:"safe",effect:"Fades hyperpigmentation safely" },
  "centella asiatica":{ status:"safe",effect:"Soothes, heals, anti-inflammatory" },
  "azelaic acid":{ status:"safe",effect:"Brightens, fights acne and rosacea" },
  "aloe vera":{ status:"safe",effect:"Soothes, hydrates, anti-inflammatory" },
  "snail mucin":{ status:"safe",effect:"Repairs, hydrates, fades marks" },
  "bakuchiol":{ status:"safe",effect:"Natural retinol alternative — gentle & pregnancy-safe" },
  "ascorbic acid":{ status:"safe",effect:"Pure Vitamin C — potent brightener" },
  "panthenol":{ status:"safe",effect:"Provitamin B5 — soothes, repairs, hydrates" },
  "allantoin":{ status:"safe",effect:"Calms irritation, accelerates repair" },
  "sodium lauryl sulfate":{ status:"avoid",effect:"Harsh surfactant — strips barrier" },
  "dimethicone":{ status:"safe",effect:"Silicone smooths texture, well tolerated" },
  "licorice root extract":{ status:"safe",effect:"Brightens pigmentation, anti-inflammatory" },
  "oxybenzone":{ status:"caution",effect:"Chemical UV filter — some prefer to avoid" },
  "kojic acid":{ status:"caution",effect:"Brightens dark spots — avoid on broken skin" },
  "witch hazel":{ status:"caution",effect:"Tones pores — can be drying with overuse" },
  "ferulic acid":{ status:"safe",effect:"Antioxidant — enhances Vitamin C stability" },
  "green tea extract":{ status:"safe",effect:"Antioxidant, reduces oiliness" },
};
const WEATHER_TIPS = {
  humid:["Use gel-based, lightweight moisturizers","Double cleanse every evening","SPF is non-negotiable — humidity amplifies UV damage","Blotting papers control midday shine"],
  dry:["Layer a facial oil under moisturizer","Avoid hot showers — they strip oils","Use a humidifier to maintain moisture","Apply moisturizer on damp skin"],
  temperate:["Rotate products seasonally","Keep SPF consistent year-round","Focus on barrier repair in cooler months","Lighter formulas work well in mild weather"],
  cold:["Use occlusive moisturizers to lock moisture","Protect lips and eye area from wind","A sleeping mask nightly prevents moisture loss","Switch to cream cleansers"],
  polluted:["Double cleanse every evening — non-negotiable","Vitamin C serum shields against pollution","Clay mask 2×/week clears congested pores","Look for pollution-defense niacinamide formulas"],
};
const SKIN_JOURNAL_RATINGS = ["😩 Very Bad","😕 Bad","😐 Okay","🙂 Good","😊 Great"];
const SCIENTIFIC_INSIGHTS = [
  { finding:"Consistent SPF use reduces visible aging by up to 24% over 4.5 years",source:"Annals of Internal Medicine, 2013" },
  { finding:"Niacinamide 5% is as effective as clindamycin for acne reduction",source:"JEADV, 2007" },
  { finding:"Retinoids remain the most evidence-backed anti-aging ingredient in dermatology",source:"Journal of Clinical & Aesthetic Dermatology" },
  { finding:"Ceramide-dominant moisturizers restore barrier function within 2 weeks",source:"Skin Pharmacology & Physiology, 2016" },
  { finding:"Vitamin C at 10–20% significantly reduces melanin synthesis",source:"Journal of Investigative Dermatology" },
  { finding:"Hyaluronic acid holds up to 1000× its weight in water in the dermis",source:"Dermatology Research & Practice, 2012" },
  { finding:"Azelaic acid 20% is FDA-approved for both rosacea and acne",source:"American Academy of Dermatology" },
  { finding:"Sleep deprivation increases water loss by ~25%, accelerating aging",source:"Clinical & Experimental Dermatology, 2015" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const formatDate = (d = new Date()) => d.toISOString().split("T")[0];
const todayStr = () => formatDate(new Date());
const lsGet = (key, fallback = null) => {
  try { const v = localStorage.getItem(`lumiere_${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const lsSet = (key, value) => { try { localStorage.setItem(`lumiere_${key}`, JSON.stringify(value)); } catch {} };

// ─── FALLBACK RESULT ──────────────────────────────────────────────────────────
const FALLBACK_RESULT = {
  skinScore:72,skinAge:"25-28",
  skinProfile:"Your skin shows a classic combination pattern with an active T-zone and drier peripheral areas. With a consistent barrier-first routine using targeted actives, you can achieve a balanced, radiant complexion.",
  primaryIssue:"Barrier Repair",
  keyFindings:["Skin barrier needs strengthening — focus on ceramide-rich products","Targeted hydration essential before adding active ingredients","Daily SPF is non-negotiable for long-term skin health"],
  metrics:{ hydration:65,barrier:58,clarity:70,radiance:68,oiliness:55,sensitivity:40 },
  morningRoutine:[
    { step:1,product:"Gentle Gel Cleanser",ingredient:"Centella Asiatica",why:"Cleanses without stripping your barrier.",tip:"Use lukewarm water only." },
    { step:2,product:"Vitamin C Serum 15%",ingredient:"Ascorbic Acid",why:"Protects against pollution, brightens.",tip:"Apply on slightly damp skin." },
    { step:3,product:"Lightweight Moisturizer",ingredient:"Hyaluronic Acid + Ceramides",why:"Seals hydration and fortifies barrier.",tip:"Apply within 60 seconds of washing." },
    { step:4,product:"Broad Spectrum SPF 50+",ingredient:"Zinc Oxide",why:"Daily UV protection prevents 80% of visible aging.",tip:"Reapply every 2 hours outdoors." },
  ],
  eveningRoutine:[
    { step:1,product:"Oil Cleanser",ingredient:"Jojoba Oil",why:"Removes sunscreen without stripping.",tip:"Always double cleanse on SPF days." },
    { step:2,product:"Exfoliating Toner (3×/wk)",ingredient:"Niacinamide + AHA",why:"Refines texture, evens tone overnight.",tip:"Skip on retinol nights." },
    { step:3,product:"Treatment Serum",ingredient:"Retinol 0.2%",why:"Stimulates collagen overnight.",tip:"Start 2×/week and build slowly." },
    { step:4,product:"Rich Night Cream",ingredient:"Squalane + Peptides",why:"Intensive barrier repair while you sleep.",tip:"Use as sleeping mask once a week." },
  ],
  topProducts:[
    { name:"Minimalist 10% Niacinamide",brand:"Minimalist",type:"Serum",price:"₹599",rating:4.5,keyIngredient:"Niacinamide",suitableFor:"Pores & Glow",emoji:"💎",bestFor:"Daily brightening" },
    { name:"Re'equil Ceramide Moisturizer",brand:"Re'equil",type:"Moisturizer",price:"₹795",rating:4.3,keyIngredient:"Ceramides",suitableFor:"Hydration",emoji:"💧",bestFor:"Barrier repair" },
    { name:"Dot & Key Waterlight SPF 50",brand:"Dot & Key",type:"Sunscreen",price:"₹475",rating:4.4,keyIngredient:"Zinc Oxide",suitableFor:"Protection",emoji:"☀️",bestFor:"Daily wear" },
    { name:"COSRX Snail Mucin 96",brand:"COSRX",type:"Essence",price:"₹1290",rating:4.7,keyIngredient:"Snail Filtrate",suitableFor:"Repair & Glow",emoji:"🌟",bestFor:"Skin repair" },
    { name:"Plum 1% Retinol Serum",brand:"Plum",type:"Serum",price:"₹845",rating:4.2,keyIngredient:"Retinol",suitableFor:"Anti-aging",emoji:"⚡",bestFor:"Night treatment" },
    { name:"Simple Kind to Skin",brand:"Simple",type:"Moisturizer",price:"₹350",rating:4.1,keyIngredient:"Vitamins B3 B5",suitableFor:"Sensitive",emoji:"🌸",bestFor:"Gentle daily use" },
  ],
  ingredientsToAvoid:["Fragrance / Parfum","Alcohol Denat","Sodium Lauryl Sulfate"],
  ingredientsToSeek:["Ceramides","Niacinamide","Hyaluronic Acid"],
  dietTips:["Drink 2-3L water daily","Include omega-3 rich flaxseeds and walnuts","Reduce refined sugar intake"],
  weeklyTreatments:["Clay mask 1-2×/week","Hydrating sheet mask midweek"],
  lifestyleTips:["Sleep 7-8 hours nightly","Change pillowcase every 2-3 days","Manage stress — cortisol triggers breakouts"],
  ingredientPairings:[
    { pair:["Vitamin C","Niacinamide"],verdict:"safe",note:"Apply Vitamin C first, let absorb, then layer niacinamide." },
    { pair:["Retinol","AHAs/BHAs"],verdict:"avoid",note:"Both increase cell turnover — alternate nights to prevent over-exfoliation." },
    { pair:["Hyaluronic Acid","Moisturizer"],verdict:"safe",note:"HA draws moisture in; sealing with moisturizer dramatically boosts hydration." },
    { pair:["Benzoyl Peroxide","Retinol"],verdict:"avoid",note:"BP oxidizes retinol, making it ineffective — use on alternating nights." },
  ],
};

// ─── NAV ──────────────────────────────────────────────────────────────────────
const Nav = ({ page, setPage, dark, setDark }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const navItems = [
    { id:"results",label:"My Skin",icon:"📊" },
    { id:"routine",label:"Routine",icon:"🌿" },
    { id:"tracker",label:"Tracker",icon:"📅" },
    { id:"journal",label:"Journal",icon:"📝" },
    { id:"ingredients",label:"Ingredients",icon:"🔬" },
    { id:"camera",label:"Live Scan",icon:"📷" },
    { id:"analytics",label:"Analytics",icon:"📈" },
    { id:"compare",label:"Compare",icon:"⚖️" },
    { id:"chat",label:"Ask AI",icon:"💬" },
  ];
  return (
    <nav className="nav" style={{ boxShadow:scrolled?"0 2px 24px rgba(196,132,90,0.10)":"none" }}>
      <div style={{ display:"flex",alignItems:"center",gap:"10px",cursor:"pointer" }} onClick={() => setPage("home")}>
        <div style={{ width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),var(--gold))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"15px",boxShadow:"0 2px 10px var(--accent-glow)" }}>✦</div>
        <span className="serif" style={{ fontSize:"21px",fontWeight:300,letterSpacing:"2.5px" }}>Lumière</span>
      </div>
      <div style={{ display:"flex",gap:"2px",alignItems:"center",overflowX:"auto" }}>
        {page!=="home"&&page!=="quiz"&&page!=="analyzing"&&navItems.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            background:page===n.id?"var(--accent-light)":"transparent",
            color:page===n.id?"var(--accent)":"var(--muted)",
            border:page===n.id?"1px solid var(--accent)":"1px solid transparent",
            borderRadius:"8px",padding:"5px 10px",fontSize:"11px",fontWeight:500,cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",transition:"all .2s",
          }}>
            <span style={{ marginRight:"3px" }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <button className="btn-icon" onClick={() => setDark(d => !d)} title="Toggle theme" style={{ fontSize:"13px" }}>
          {dark?"☀️":"🌙"}
        </button>
      </div>
    </nav>
  );
};

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HeroPage = ({ setPage, dark }) => {
  const C = dark ? DARK : LIGHT;
  const features = [
    { icon:"📷",h:"Live Camera Scan",p:"Real-time AI skin analysis — pores, texture, tone detected instantly." },
    { icon:"🧬",h:"AI Skin Profiling",p:"40+ parameters mapped to build your unique skin fingerprint." },
    { icon:"🔬",h:"Ingredient Scanner",p:"Paste any ingredient list or photograph a label for instant analysis." },
    { icon:"📊",h:"Progress Analytics",p:"Visual dashboards tracking skin score, trends, and routine streaks." },
    { icon:"🌤️",h:"Weather Tips",p:"Climate-adaptive skincare recommendations for your environment." },
    { icon:"📄",h:"PDF Report",p:"Download your full personalized skin report as a formatted PDF." },
    { icon:"💬",h:"AI Chat",p:"Multi-turn AI dermatologist that remembers your skin profile." },
    { icon:"⚖️",h:"Product Comparator",p:"Side-by-side AI ingredient analysis for any two products." },
    { icon:"📝",h:"Skin Journal",p:"Daily logging with AI pattern detection for your skin." },
  ];
  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ position:"relative",minHeight:"calc(100vh - 62px)",display:"flex",alignItems:"center",overflow:"hidden",background:`linear-gradient(160deg,${C.bg} 40%,${C.bgAlt} 100%)` }}>
        <div className="grain" />
        {[
          { size:420,top:"5%",right:"-8%",color:C.accentGlow,delay:"0s",dur:"9s" },
          { size:280,top:"55%",right:"20%",color:`${C.gold}18`,delay:"3s",dur:"12s" },
          { size:200,top:"20%",right:"38%",color:`${C.lavender}14`,delay:"1.5s",dur:"7s" },
          { size:150,top:"70%",left:"10%",color:`${C.green}12`,delay:"2s",dur:"10s" },
        ].map((o,i) => (
          <div key={i} className="orb" style={{ width:o.size,height:o.size,background:`radial-gradient(circle,${o.color},transparent 70%)`,top:o.top,right:o.right,left:o.left,animationDelay:o.delay,animationDuration:o.dur }} />
        ))}
        <div style={{ maxWidth:"1200px",margin:"0 auto",padding:"60px 36px",width:"100%",position:"relative",zIndex:1 }}>
          <div className="hero-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"72px",alignItems:"center" }}>
            <div>
              <div className="fade-up"><span className="tag tag-accent">✦ AI-Powered Skincare Intelligence</span></div>
              <h1 className="serif fade-up" style={{ fontSize:"clamp(42px,5.5vw,72px)",fontWeight:300,lineHeight:1.04,marginTop:"18px",letterSpacing:"-0.5px",animationDelay:".12s" }}>
                Skin that<br/><em style={{ color:"var(--accent)",fontStyle:"italic" }}>knows itself.</em>
              </h1>
              <p className="fade-up" style={{ fontSize:"16px",color:"var(--muted)",lineHeight:1.85,marginTop:"20px",maxWidth:"440px",animationDelay:".22s" }}>
                Lumière uses live camera scanning, AI facial analysis, and dermatological data to give you the most comprehensive personalized skincare intelligence available.
              </p>
              <div className="fade-up" style={{ marginTop:"30px",display:"flex",gap:"12px",flexWrap:"wrap",animationDelay:".32s" }}>
                <button className="btn-primary" onClick={() => setPage("quiz")}><span>Start Free Analysis ✦</span></button>
                <button className="btn-ghost" onClick={() => setPage("camera")}>📷 Live Scan</button>
                <button className="btn-ghost" onClick={() => setPage("ingredients")}>🔬 Ingredients</button>
              </div>
              <div className="fade-up" style={{ marginTop:"28px",display:"flex",gap:"20px",animationDelay:".42s" }}>
                {["Free forever","No sign-up needed","India-focused"].map(t => (
                  <div key={t} style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",color:"var(--muted)" }}>
                    <span style={{ color:"var(--green)",fontSize:"14px" }}>✓</span>{t}
                  </div>
                ))}
              </div>
            </div>
            <div className="fade-in" style={{ animationDelay:".28s" }}>
              <div className="glass" style={{ padding:"28px",boxShadow:C.shadowXl }}>
                <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px" }}>
                  <div style={{ width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.gold})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",boxShadow:`0 4px 16px ${C.accentGlow}` }}>🌿</div>
                  <div><div style={{ fontWeight:600,fontSize:"15px" }}>Lumière Pro</div><div style={{ fontSize:"12px",color:"var(--muted)" }}>Your complete skin intelligence platform</div></div>
                </div>
                {[["📷","Live Camera AI Scan","Real-time facial analysis"],["🔬","Ingredient Scanner","Check any product instantly"],["📊","Analytics Dashboard","Track progress over time"],["📄","PDF Report Export","Download your skin report"],["🌤️","Weather Skincare Tips","Climate-adaptive advice"],["💬","AI Dermatologist Chat","Remembers your profile"]].map(([e,t,d]) => (
                  <div key={t} style={{ display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid var(--border-glass)" }}>
                    <span style={{ fontSize:"18px",width:28,flexShrink:0 }}>{e}</span>
                    <div style={{ flex:1 }}><div style={{ fontSize:"13px",fontWeight:500 }}>{t}</div><div style={{ fontSize:"11px",color:"var(--muted)" }}>{d}</div></div>
                    <span style={{ color:"var(--green)",fontSize:"13px",fontWeight:700 }}>✓</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding:"80px 36px",background:"var(--bg-alt)" }}>
        <div style={{ maxWidth:"1080px",margin:"0 auto",textAlign:"center" }}>
          <span className="section-label">Everything you need</span>
          <h2 className="serif" style={{ fontSize:"38px",fontWeight:300,marginTop:"10px",marginBottom:"48px" }}>Your complete skin intelligence platform</h2>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px",textAlign:"left" }}>
            {features.map((f,i) => (
              <div key={i} className="glass glass-hover" style={{ padding:"24px" }}>
                <div style={{ width:44,height:44,borderRadius:"10px",background:"var(--accent-light)",border:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",marginBottom:"14px" }}>{f.icon}</div>
                <h3 style={{ fontSize:"15px",fontWeight:600,marginBottom:"7px" }}>{f.h}</h3>
                <p style={{ fontSize:"13px",color:"var(--muted)",lineHeight:1.7 }}>{f.p}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop:"44px" }}><button className="btn-primary" onClick={() => setPage("quiz")}><span>Start Your Free Analysis →</span></button></div>
        </div>
      </div>
    </div>
  );
};

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
const QuizPage = ({ setPage, setProfile }) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ skinType:null,concerns:[],ageRange:null,climate:null,budget:null });
  const canNext = () => {
    if (step===0) return !!answers.skinType;
    if (step===1) return answers.concerns.length > 0;
    if (step===2) return !!answers.ageRange;
    if (step===3) return !!answers.climate;
    if (step===4) return !!answers.budget;
    return false;
  };
  const next = () => { if (step < 4) setStep(s => s+1); else { setProfile(answers); setPage("analyzing"); } };
  const toggleConcern = id => setAnswers(a => ({
    ...a,concerns:a.concerns.includes(id)?a.concerns.filter(c=>c!==id):a.concerns.length<4?[...a.concerns,id]:a.concerns,
  }));
  const steps = [
    { label:"Skin Type",icon:"🧴",title:"What is your skin type?",sub:"Choose what best describes your skin on an average day.",
      content:(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px" }}>
          {SKIN_TYPES.map(s => (
            <div key={s.id} className={`option-card ${answers.skinType===s.id?"selected":""}`} onClick={() => setAnswers(a => ({...a,skinType:s.id}))}>
              <div style={{ fontSize:"24px",marginBottom:"8px" }}>{s.emoji}</div>
              <div style={{ fontWeight:600,fontSize:"14px" }}>{s.label}</div>
              <div style={{ fontSize:"12px",color:"var(--muted)",marginTop:"3px" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      ),
    },
    { label:"Concerns",icon:"🎯",title:"What are your skin concerns?",sub:"Select up to 4 concerns you'd most like to address.",
      content:(
        <div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:"8px" }}>
            {CONCERNS.map(c => (
              <div key={c.id} className={`concern-chip ${answers.concerns.includes(c.id)?"active":""}`} onClick={() => toggleConcern(c.id)}>
                <span>{c.emoji}</span><span>{c.label}</span>{answers.concerns.includes(c.id)&&<span>✓</span>}
              </div>
            ))}
          </div>
          {answers.concerns.length===4&&<div style={{ marginTop:"10px",fontSize:"12px",color:"var(--accent)" }}>✦ Max 4 concerns selected</div>}
        </div>
      ),
    },
    { label:"Age Range",icon:"👤",title:"What is your age range?",sub:"Skin biology changes with age — this helps refine recommendations.",
      content:(
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px" }}>
          {AGE_RANGES.map(a => (
            <div key={a} className={`option-card ${answers.ageRange===a?"selected":""}`} style={{ textAlign:"center",padding:"20px 12px" }} onClick={() => setAnswers(p => ({...p,ageRange:a}))}>
              <div className="serif" style={{ fontSize:"17px" }}>{a}</div>
            </div>
          ))}
        </div>
      ),
    },
    { label:"Climate",icon:"🌍",title:"What's your environment like?",sub:"Climate dramatically affects how skin behaves and what it needs.",
      content:(
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
          {CLIMATES.map(c => (
            <div key={c.id} className={`option-card ${answers.climate===c.id?"selected":""}`} onClick={() => setAnswers(a => ({...a,climate:c.id}))}>
              <div style={{ fontSize:"24px",marginBottom:"7px" }}>{c.emoji}</div>
              <div style={{ fontWeight:600,fontSize:"14px" }}>{c.label}</div>
            </div>
          ))}
        </div>
      ),
    },
    { label:"Budget",icon:"💰",title:"What's your skincare budget?",sub:"We'll match you with products in your comfort zone.",
      content:(
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
          {BUDGETS.map(b => (
            <div key={b.id} className={`option-card ${answers.budget===b.id?"selected":""}`} onClick={() => setAnswers(a => ({...a,budget:b.id}))}>
              <div style={{ fontWeight:700,fontSize:"15px" }}>{b.label}</div>
              <div style={{ fontSize:"12px",color:"var(--muted)",marginTop:"4px" }}>{b.sub}</div>
            </div>
          ))}
        </div>
      ),
    },
  ];
  const cur = steps[step];
  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ width:"100%",maxWidth:"620px",padding:"36px 24px" }}>
        <div style={{ marginBottom:"26px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"8px" }}>
            <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
              {steps.map((_,i) => <div key={i} style={{ width:i===step?26:7,height:7,borderRadius:4,background:i<step?"var(--green)":i===step?"var(--accent)":"var(--border)",transition:"all .3s" }} />)}
            </div>
            <span style={{ fontSize:"12px",color:"var(--muted)",fontWeight:500 }}>{step+1} / {steps.length}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width:`${((step+1)/steps.length)*100}%` }} /></div>
        </div>
        <div className="fade-up" key={step}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px" }}>
            <span style={{ fontSize:"20px" }}>{cur.icon}</span>
            <span className="section-label">{cur.label}</span>
          </div>
          <h2 className="serif" style={{ fontSize:"28px",fontWeight:300,marginBottom:"7px" }}>{cur.title}</h2>
          <p style={{ fontSize:"14px",color:"var(--muted)",marginBottom:"22px",lineHeight:1.6 }}>{cur.sub}</p>
          {cur.content}
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"26px" }}>
          <button className="btn-ghost" onClick={() => step>0?setStep(s=>s-1):setPage("home")} style={{ padding:"10px 20px",fontSize:"12px" }}>← {step>0?"Back":"Home"}</button>
          <button className="btn-primary" onClick={next} disabled={!canNext()}><span>{step===4?"Analyze My Skin ✦":"Continue →"}</span></button>
        </div>
      </div>
    </div>
  );
};

// ─── ANALYZING ────────────────────────────────────────────────────────────────
// FIX: Lean two-phase approach — Phase 1 gets core metrics + routines (≤900 tokens)
//      Phase 2 gets products + pairings (≤600 tokens). Merge client-side.
const AnalyzingPage = ({ profile, setPage, setResult }) => {
  const [phase, setPhase] = useState(0);
  const phases = [
    "Mapping your skin profile…",
    "Analyzing skin type & concerns…",
    "Building your morning routine…",
    "Building your evening routine…",
    "Curating product recommendations…",
    "Finalizing your skin report…",
  ];

  useEffect(() => {
    const run = async () => {
      for (let i = 0; i < phases.length - 1; i++) { setPhase(i); await sleep(550); }
      const concerns = profile.concerns
        .map(id => CONCERNS.find(c => c.id === id)?.label)
        .filter(Boolean).join(", ") || "general care";

      const sys = "You are a dermatologist AI. Return ONLY valid compact JSON, no markdown, no extra text.";

      // ── Phase 1: Core report (score, metrics, routines) ──────────────────────
      const phase1Prompt = `Skin: type=${profile.skinType}, concerns=${concerns}, age=${profile.ageRange}, climate=${profile.climate}, budget=${profile.budget}.
Return ONLY this JSON:
{"skinScore":75,"skinAge":"26-28","primaryIssue":"Barrier Repair","skinProfile":"Two sentences.","keyFindings":["f1","f2","f3"],"metrics":{"hydration":65,"barrier":60,"clarity":70,"radiance":68,"oiliness":50,"sensitivity":35},"morningRoutine":[{"step":1,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":2,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":3,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":4,"product":"SPF","ingredient":"Zinc Oxide","why":"Sun protection.","tip":"Reapply."}],"eveningRoutine":[{"step":1,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":2,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":3,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."},{"step":4,"product":"Name","ingredient":"Key","why":"Why.","tip":"Tip."}],"ingredientsToAvoid":["Fragrance","Alcohol Denat","SLS"],"ingredientsToSeek":["Ceramides","Niacinamide","HA"],"dietTips":["Tip1","Tip2","Tip3"],"weeklyTreatments":["T1","T2"],"lifestyleTips":["L1","L2","L3"]}`;

      // ── Phase 2: Products + Pairings ─────────────────────────────────────────
      const phase2Prompt = `For ${profile.skinType} skin, ${concerns}, ${profile.budget} budget in India.
Return ONLY this JSON:
{"topProducts":[{"name":"Minimalist Niacinamide 10%","brand":"Minimalist","type":"Serum","price":"₹599","rating":4.5,"keyIngredient":"Niacinamide","suitableFor":"Pores","emoji":"💎","bestFor":"Brightening"},{"name":"Re equil Ceramide","brand":"Re equil","type":"Moisturizer","price":"₹795","rating":4.3,"keyIngredient":"Ceramides","suitableFor":"Hydration","emoji":"💧","bestFor":"Barrier"},{"name":"Dot Key SPF 50","brand":"Dot Key","type":"Sunscreen","price":"₹475","rating":4.4,"keyIngredient":"Zinc Oxide","suitableFor":"Protection","emoji":"☀️","bestFor":"Daily"},{"name":"COSRX Snail 96","brand":"COSRX","type":"Essence","price":"₹1290","rating":4.7,"keyIngredient":"Snail Filtrate","suitableFor":"Repair","emoji":"🌟","bestFor":"Repair"},{"name":"Plum Retinol Serum","brand":"Plum","type":"Serum","price":"₹845","rating":4.2,"keyIngredient":"Retinol","suitableFor":"Aging","emoji":"⚡","bestFor":"Night"},{"name":"Simple Moisturizer","brand":"Simple","type":"Moisturizer","price":"₹350","rating":4.1,"keyIngredient":"B3 B5","suitableFor":"Sensitive","emoji":"🌸","bestFor":"Daily"}],"ingredientPairings":[{"pair":["Vitamin C","Niacinamide"],"verdict":"safe","note":"Apply Vitamin C first, then niacinamide."},{"pair":["Retinol","AHAs"],"verdict":"avoid","note":"Alternate nights to prevent over-exfoliation."},{"pair":["Hyaluronic Acid","Moisturizer"],"verdict":"safe","note":"Seal HA with moisturizer for max hydration."},{"pair":["Benzoyl Peroxide","Retinol"],"verdict":"avoid","note":"Use on alternating nights."}]}`;

      setPhase(phases.length - 1);

      try {
        const [text1, text2] = await Promise.all([
          callAI(phase1Prompt, sys, null, null, 900),
          callAI(phase2Prompt, sys, null, null, 700),
        ]);

        const parsed1 = extractJSON(text1);
        const parsed2 = extractJSON(text2);

        if (!parsed1) throw new Error("Phase 1 JSON parse failed");

        const merged = {
          ...FALLBACK_RESULT,    // safe defaults
          ...parsed1,             // core data
          ...(parsed2 || {}),     // products + pairings (if available)
        };

        const history = lsGet("score_history", []);
        history.push({ date:todayStr(), score:merged.skinScore, profile:profile.skinType });
        if (history.length > 30) history.shift();
        lsSet("score_history", history);
        setResult(merged);
        setPage("results");
      } catch (e) {
        console.warn("Analysis error, using fallback:", e.message);
        const history = lsGet("score_history", []);
        history.push({ date:todayStr(), score:FALLBACK_RESULT.skinScore, profile:profile.skinType });
        lsSet("score_history", history);
        setResult({
          ...FALLBACK_RESULT,
          skinProfile:`Analysis for ${profile.skinType} skin (${profile.ageRange}, ${profile.climate}). ${FALLBACK_RESULT.skinProfile}`,
        });
        setPage("results");
      }
    };
    run();
  }, []);

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center",padding:"40px 24px",maxWidth:"480px" }}>
        <div style={{ position:"relative",width:100,height:100,margin:"0 auto 28px" }}>
          <div style={{ width:100,height:100,borderRadius:"50%",background:"conic-gradient(var(--accent),var(--gold),var(--green),var(--lavender),var(--accent))",animation:"spin 2s linear infinite" }} />
          <div style={{ position:"absolute",inset:"8px",borderRadius:"50%",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px" }}>✦</div>
        </div>
        <h2 className="serif" style={{ fontSize:"28px",fontWeight:300,marginBottom:"8px" }}>Reading your skin…</h2>
        <p style={{ color:"var(--muted)",marginBottom:"24px",fontSize:"14px" }}>AI dermatologist building your personalized report</p>
        <div className="glass" style={{ padding:"18px",textAlign:"left" }}>
          {phases.map((p,i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:"12px",padding:"8px 0",color:i<phase?"var(--green)":i===phase?"var(--text)":"var(--muted)",fontSize:"13px",borderBottom:i<phases.length-1?"1px solid var(--border-glass)":"none" }}>
              <span style={{ fontSize:"13px",flexShrink:0 }}>{i<phase?"✓":i===phase?"◉":"○"}</span>
              <span style={{ fontWeight:i===phase?600:400 }}>{p}</span>
              {i===phase&&<div className="typing-dots" style={{ marginLeft:"auto" }}><span/><span/><span/></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── LIVE CAMERA SCAN ─────────────────────────────────────────────────────────
// FIX: Separate system prompts are tighter; image call uses 500 max_tokens.
//      OCR is two-step: extract text (no AI), then analyze text-only (no image re-send).
const CameraPage = ({ result }) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [streaming, setStreaming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraAnalysis, setCameraAnalysis] = useState(null);
  const [scanMode, setScanMode] = useState("skin");
  const [error, setError] = useState("");
  const [capturedImg, setCapturedImg] = useState(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user",width:{ ideal:1280 },height:{ ideal:720 } } });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();
      setStreaming(true);
    } catch {
      setError("Camera access denied. Allow camera permission in your browser settings and try again.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
    setCapturedImg(null);
    setCameraAnalysis(null);
    setError("");
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    // Compress to JPEG 0.6 quality to reduce base64 size → fewer input tokens
    const dataUrl = c.toDataURL("image/jpeg", 0.6);
    const base64 = dataUrl.split(",")[1];
    setCapturedImg(dataUrl);
    setAnalyzing(true);
    setCameraAnalysis(null);
    setError("");

    try {
      if (scanMode === "skin") {
        // Skin analysis: compact system prompt, 500 max_tokens
        const res = await callAI(
          "Analyze my skin from this photo in 4 sentences covering texture, pores, tone, and oiliness. Then list 3 specific product tips.",
          "You are a dermatologist. 4-sentence analysis + 3 tips. Be encouraging and specific.",
          base64, "image/jpeg", 500
        );
        setCameraAnalysis(res);
      } else {
        // OCR mode: Step 1 — extract text from image (compact)
        const ocrText = await callAI(
          "Extract all visible text from this image, especially ingredient lists. Output raw text only.",
          "OCR system. Extract text accurately, output only the extracted text.",
          base64, "image/jpeg", 400
        );
        // Step 2 — analyze extracted text WITHOUT image (saves tokens)
        const truncated = ocrText.slice(0, 500);
        const analysis = await callAI(
          `Analyze these skincare ingredients in 4 sentences: key benefits, concerns (fragrance, alcohol, sulfates), skin type suitability, safety verdict.\n\nIngredients: ${truncated}`,
          "You are a cosmetic chemist. 4 sentences max. Be direct.",
          null, null, 400
        );
        setCameraAnalysis(`📝 Extracted text:\n${ocrText.slice(0, 300)}${ocrText.length > 300 ? "…" : ""}\n\n🔬 Analysis:\n${analysis}`);
      }
    } catch (e) {
      setError(getErrorMsg(e));
    }
    setAnalyzing(false);
  };

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ maxWidth:"840px",margin:"0 auto",padding:"36px 24px" }}>
        <span className="section-label">✦ Live Camera Intelligence</span>
        <h1 className="serif" style={{ fontSize:"clamp(26px,4vw,42px)",fontWeight:300,marginTop:"10px",marginBottom:"8px" }}>
          AI <em style={{ color:"var(--accent)" }}>Visual Scan</em>
        </h1>
        <p style={{ color:"var(--muted)",marginBottom:"22px" }}>Live skin analysis or OCR ingredient label scanning.</p>
        <div style={{ display:"flex",gap:"10px",marginBottom:"18px",flexWrap:"wrap" }}>
          {[["skin","🧴 Skin Analysis"],["ocr","📝 Label / OCR"]].map(([m,l]) => (
            <button key={m} onClick={() => { setScanMode(m); setCameraAnalysis(null); setCapturedImg(null); setError(""); }} style={{
              background:scanMode===m?"var(--accent)":"var(--surface-glass)",
              color:scanMode===m?"#fff":"var(--muted)",
              border:`1.5px solid ${scanMode===m?"var(--accent)":"var(--border)"}`,
              borderRadius:"24px",padding:"8px 18px",fontSize:"13px",cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",transition:"all .2s",fontWeight:scanMode===m?600:400,
              backdropFilter:"blur(8px)",
            }}>{l}</button>
          ))}
        </div>
        <div className="glass" style={{ padding:"22px",marginBottom:"18px" }}>
          <div style={{ position:"relative",width:"100%",maxWidth:"540px",margin:"0 auto",aspectRatio:"4/3",background:"var(--bg-alt2)",borderRadius:"10px",overflow:"hidden" }}>
            <video ref={videoRef} style={{ width:"100%",height:"100%",objectFit:"cover",display:streaming?"block":"none",transform:"scaleX(-1)" }} muted playsInline />
            <canvas ref={canvasRef} style={{ display:"none" }} />
            {capturedImg&&!streaming&&<img src={capturedImg} alt="" style={{ width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)" }} />}
            {!streaming&&!capturedImg&&(
              <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"14px" }}>
                <div style={{ fontSize:"52px" }}>📷</div>
                <div style={{ fontWeight:600 }}>Camera Ready</div>
                <div style={{ fontSize:"13px",color:"var(--muted)" }}>Click Start Camera to begin</div>
              </div>
            )}
            {streaming&&(
              <>
                <div style={{ position:"absolute",inset:"18px" }}>
                  <div className="camera-corner camera-corner-tl"/><div className="camera-corner camera-corner-tr"/>
                  <div className="camera-corner camera-corner-bl"/><div className="camera-corner camera-corner-br"/>
                </div>
                <div style={{ position:"absolute",inset:0,overflow:"hidden",borderRadius:"10px" }}><div className="scan-line"/></div>
                <div style={{ position:"absolute",bottom:"12px",left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.5)",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",color:"#fff",whiteSpace:"nowrap" }}>
                  {scanMode==="skin"?"👤 Position your face in frame":"📝 Point camera at ingredient label"}
                </div>
              </>
            )}
            {analyzing&&(
              <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"12px" }}>
                <div className="typing-dots" style={{ display:"flex" }}><span/><span/><span/></div>
                <div style={{ color:"#fff",fontSize:"14px",fontWeight:600 }}>Analyzing…</div>
              </div>
            )}
          </div>
          {error&&<div className="error-box" style={{ marginTop:"12px" }}>{error}</div>}
          <div style={{ display:"flex",gap:"10px",marginTop:"14px",justifyContent:"center",flexWrap:"wrap" }}>
            {!streaming
              ?<button className="btn-primary" onClick={startCamera}><span>📷 Start Camera</span></button>
              :<>
                <button className="btn-primary" onClick={capture} disabled={analyzing}><span>{analyzing?"Analyzing…":"📸 Capture & Analyze"}</span></button>
                <button className="btn-ghost" onClick={stopCamera} style={{ padding:"11px 18px",fontSize:"12px" }}>Stop</button>
              </>
            }
            {capturedImg&&!streaming&&(
              <button className="btn-ghost" onClick={() => { setCapturedImg(null); setCameraAnalysis(null); setError(""); startCamera(); }} style={{ padding:"11px 18px",fontSize:"12px" }}>Retake</button>
            )}
          </div>
        </div>
        {cameraAnalysis&&(
          <div className="glass fade-up" style={{ padding:"22px" }}>
            <span className="section-label">{scanMode==="skin"?"🧴 AI Skin Analysis":"📝 Label Analysis"}</span>
            <p style={{ fontSize:"14px",lineHeight:1.85,marginTop:"12px",whiteSpace:"pre-wrap" }}>{cameraAnalysis}</p>
            {scanMode==="ocr"&&(
              <div style={{ marginTop:"14px",paddingTop:"14px",borderTop:"1px solid var(--border-glass)" }}>
                <div style={{ fontSize:"11px",color:"var(--muted)",marginBottom:"8px",fontWeight:600,letterSpacing:"1px" }}>DETECTED INGREDIENTS</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                  {Object.entries(KNOWN_INGREDIENTS).filter(([name]) => cameraAnalysis.toLowerCase().includes(name)).map(([name,info]) => (
                    <span key={name} className={`ingredient-badge badge-${info.status}`}>{name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop:"14px",padding:"13px",background:"var(--bg-alt)",borderRadius:"10px" }}>
          <p style={{ fontSize:"12px",color:"var(--muted)",lineHeight:1.6 }}>🔒 <strong>Privacy:</strong> Images are analyzed in-session only and never stored.</p>
        </div>
      </div>
    </div>
  );
};

// ─── RESULTS PAGE ─────────────────────────────────────────────────────────────
const ResultsPage = ({ profile, result, setPage }) => {
  const [tab, setTab] = useState("overview");
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileRef = useRef();
  if (!result) return null;
  const concerns = profile.concerns.map(id => CONCERNS.find(c => c.id === id)?.label).filter(Boolean);
  const scoreHistory = lsGet("score_history", []);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoLoading(true); setPhotoAnalysis(null); setPhotoError("");
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      // FIX: compress via canvas before sending
      const img = new Image();
      const compressedBase64 = await new Promise((res) => {
        img.onload = () => {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 800 / Math.max(img.width, img.height));
          c.width = img.width * scale; c.height = img.height * scale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.65).split(",")[1]);
        };
        img.src = `data:${file.type};base64,${base64}`;
      });
      const res = await callAI(
        "Analyze my skin from this photo in 4 sentences: texture, pore size, tone, dryness/oiliness. Then give 3 specific product tips.",
        "You are a compassionate dermatologist. 4 sentences + 3 tips. Be encouraging.",
        compressedBase64, "image/jpeg", 500
      );
      setPhotoAnalysis(res);
    } catch (e) { setPhotoError(getErrorMsg(e)); }
    setPhotoLoading(false);
  };

  const fetchWeather = () => {
    setWeatherLoading(true); setWeatherData(null);
    if (!navigator.geolocation) { setWeatherData({ error:"Geolocation not supported." }); setWeatherLoading(false); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude:lat, longitude:lon } = pos.coords;
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`);
        const wData = await wRes.json();
        const { temperature_2m:temp, relative_humidity_2m:hum, weather_code:wc, wind_speed_10m:wind } = wData.current;
        const skinType = hum>70?"humid":temp<15?"cold":temp>30?"dry":"temperate";
        const wDesc = wc<=1?"Clear ☀️":wc<=3?"Partly Cloudy 🌤️":wc<=67?"Rainy 🌧️":"Variable 🌥️";
        setWeatherData({ temp:Math.round(temp),hum:Math.round(hum),desc:wDesc,wind:Math.round(wind),tips:WEATHER_TIPS[skinType]||WEATHER_TIPS.temperate,skinType });
      } catch { setWeatherData({ error:"Could not fetch weather. Please try again." }); }
      setWeatherLoading(false);
    }, () => { setWeatherData({ error:"Location access denied." }); setWeatherLoading(false); });
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation:"portrait",unit:"mm",format:"a4" });
      const accent=[196,132,90],dark=[26,18,8],muted=[138,116,96],white=[255,255,255];
      doc.setFillColor(...accent); doc.rect(0,0,210,42,"F");
      doc.setTextColor(...white); doc.setFontSize(24); doc.setFont("helvetica","bold");
      doc.text("Lumière",20,18);
      doc.setFontSize(10); doc.setFont("helvetica","normal");
      doc.text("Personalized AI Skin Report",20,26);
      doc.text(`Generated ${new Date().toLocaleDateString("en-IN",{year:"numeric",month:"long",day:"numeric"})}`,20,33);
      doc.setFillColor(...white); doc.circle(185,21,14,"F");
      doc.setTextColor(...accent); doc.setFontSize(18); doc.setFont("helvetica","bold");
      doc.text(`${result.skinScore}`,185,26,{align:"center"});
      doc.setFontSize(7); doc.setFont("helvetica","normal");
      doc.text("/ 100",185,31,{align:"center"});
      let y=55;
      const addSection=(title)=>{if(y>255){doc.addPage();y=20;}doc.setTextColor(...accent);doc.setFontSize(14);doc.setFont("helvetica","bold");doc.text(title,20,y);y+=2;doc.setDrawColor(...accent);doc.line(20,y,190,y);y+=8;doc.setTextColor(...dark);};
      addSection("Skin Profile");
      doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(...muted);
      const pl=doc.splitTextToSize(result.skinProfile||"",170);doc.text(pl,20,y);y+=pl.length*5+10;
      addSection("Key Findings");
      (result.keyFindings||[]).forEach(f=>{if(y>270){doc.addPage();y=20;}const lines=doc.splitTextToSize(`• ${f}`,165);doc.setFontSize(10);doc.setFont("helvetica","normal");doc.setTextColor(...muted);doc.text(lines,20,y);y+=lines.length*5+3;});
      addSection("Morning Routine");
      (result.morningRoutine||[]).forEach(s=>{if(y>265){doc.addPage();y=20;}doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(...dark);doc.text(`${s.step}. ${s.product}`,20,y);doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(...muted);const lines=doc.splitTextToSize(`${s.ingredient} — ${s.why} Tip: ${s.tip}`,165);doc.text(lines,24,y+5);y+=lines.length*4+14;});
      addSection("Evening Routine");
      (result.eveningRoutine||[]).forEach(s=>{if(y>265){doc.addPage();y=20;}doc.setFontSize(11);doc.setFont("helvetica","bold");doc.setTextColor(...dark);doc.text(`${s.step}. ${s.product}`,20,y);doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(...muted);const lines=doc.splitTextToSize(`${s.ingredient} — ${s.why} Tip: ${s.tip}`,165);doc.text(lines,24,y+5);y+=lines.length*4+14;});
      const total=doc.internal.getNumberOfPages();for(let i=1;i<=total;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(...muted);doc.text(`Lumière AI Skin Report · Page ${i} of ${total}`,105,292,{align:"center"});}
      doc.save(`Lumiere-Skin-Report-${todayStr()}.pdf`);
    } catch(e){ alert(`PDF error: ${e.message}`); }
    setPdfLoading(false);
  };

  const MetricBar = ({ label,value,color,emoji }) => (
    <div style={{ marginBottom:"13px" }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"5px" }}>
        <span style={{ fontSize:"13px",color:"var(--muted)" }}>{emoji} {label}</span>
        <span style={{ fontSize:"13px",fontWeight:700,color }}>{value}%</span>
      </div>
      <div className="progress-bar">
        <div className="metric-fill" style={{ "--w":`${value}%`,width:`${value}%`,background:color }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ background:"linear-gradient(160deg,var(--bg-alt2) 0%,var(--bg-alt) 100%)",padding:"36px",borderBottom:"1px solid var(--border-glass)" }}>
        <div style={{ maxWidth:"1200px",margin:"0 auto" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"24px" }}>
            <div>
              <span className="section-label">✦ Your AI Skin Report</span>
              <h1 className="serif" style={{ fontSize:"clamp(26px,4vw,46px)",fontWeight:300,marginTop:"8px",lineHeight:1.15 }}>
                Skin Analysis <em style={{ color:"var(--accent)" }}>Complete</em>
              </h1>
              <div style={{ marginTop:"12px",display:"flex",gap:"7px",flexWrap:"wrap" }}>
                {[`🧴 ${profile.skinType?.charAt(0).toUpperCase()+profile.skinType?.slice(1)} Skin`,`📍 ${profile.climate?.charAt(0).toUpperCase()+profile.climate?.slice(1)}`,`👤 ${profile.ageRange}`,result.skinAge?`🧬 Skin Age: ${result.skinAge}`:null].filter(Boolean).map(t=><span key={t} className="tag">{t}</span>)}
              </div>
              {result.primaryIssue&&<div style={{ marginTop:"10px",fontSize:"13px",color:"var(--accent)",fontWeight:500 }}>Primary Focus: {result.primaryIssue}</div>}
              <div style={{ marginTop:"14px",display:"flex",gap:"10px",flexWrap:"wrap" }}>
                <button onClick={downloadPDF} style={{ background:"var(--green)",color:"#fff",border:"none",borderRadius:"10px",padding:"11px 20px",fontSize:"12px",fontWeight:600,letterSpacing:".6px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }} disabled={pdfLoading}>
                  {pdfLoading?"⏳ Generating…":"📄 Download PDF"}
                </button>
                <button onClick={() => setPage("camera")} className="btn-ghost" style={{ padding:"9px 16px",fontSize:"12px" }}>📷 Photo Scan</button>
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <svg className="score-ring" width="108" height="108" viewBox="0 0 108 108">
                <circle cx="54" cy="54" r="46" fill="none" stroke="var(--bg-alt2)" strokeWidth="6"/>
                <circle cx="54" cy="54" r="46" fill="none" stroke="var(--accent)" strokeWidth="6"
                  strokeDasharray={`${(result.skinScore/100)*289} 289`}
                  strokeLinecap="round" transform="rotate(-90 54 54)"
                  style={{ transition:"stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)" }}
                />
                <text x="54" y="50" textAnchor="middle" fontFamily="Cormorant Garamond,Georgia,serif" fontSize="22" fontWeight="300" fill="var(--accent)">{result.skinScore}</text>
                <text x="54" y="64" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="9" fill="var(--muted)" letterSpacing="0.5">/ 100</text>
              </svg>
              <div style={{ fontSize:"10px",color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase",marginTop:"4px" }}>Skin Health Score</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background:"var(--surface-glass)",backdropFilter:"blur(16px)",borderBottom:"1px solid var(--border-glass)",position:"sticky",top:"62px",zIndex:50 }}>
        <div style={{ maxWidth:"1200px",margin:"0 auto",padding:"0 36px" }}>
          <div className="tab-bar">
            {[["overview","📊 Overview"],["photo","📸 Photo"],["routine","🌿 Routine"],["products","✨ Products"],["pairings","🧪 Pairings"],["weather","🌤️ Weather"],["diet","🥗 Lifestyle"],["history","📈 History"]].map(([id,label]) => (
              <button key={id} className={`tab-item ${tab===id?"active":""}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:"1200px",margin:"0 auto",padding:"28px 36px" }}>
        {tab==="overview"&&(
          <div className="fade-up">
            <div className="results-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"18px" }}>
              <div className="glass" style={{ padding:"22px" }}>
                <span className="section-label">AI Skin Profile</span>
                <p className="serif" style={{ fontSize:"16px",fontWeight:300,lineHeight:1.85,marginTop:"12px" }}>{result.skinProfile}</p>
                <div style={{ display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"14px" }}>{concerns.map(c=><span key={c} className="tag tag-accent">{c}</span>)}</div>
              </div>
              <div className="glass" style={{ padding:"22px" }}>
                <span className="section-label">Skin Metrics</span>
                <div style={{ marginTop:"14px" }}>
                  <MetricBar label="Hydration" value={result.metrics?.hydration||65} color="var(--green)" emoji="💧"/>
                  <MetricBar label="Barrier" value={result.metrics?.barrier||60} color="var(--accent)" emoji="🛡️"/>
                  <MetricBar label="Clarity" value={result.metrics?.clarity||70} color="var(--gold)" emoji="✨"/>
                  <MetricBar label="Radiance" value={result.metrics?.radiance||68} color="var(--lavender)" emoji="🌟"/>
                  {result.metrics?.oiliness&&<MetricBar label="Oiliness" value={result.metrics.oiliness} color="var(--navy)" emoji="💦"/>}
                  {result.metrics?.sensitivity&&<MetricBar label="Sensitivity" value={result.metrics.sensitivity} color="var(--rose)" emoji="🌸"/>}
                </div>
              </div>
              <div className="glass" style={{ padding:"22px" }}>
                <span className="section-label">Key Findings</span>
                <div style={{ marginTop:"11px" }}>
                  {result.keyFindings?.map((f,i) => (
                    <div key={i} style={{ display:"flex",gap:"11px",padding:"10px 0",borderBottom:i<result.keyFindings.length-1?"1px solid var(--border-glass)":"none" }}>
                      <span style={{ color:"var(--accent)",fontWeight:700 }}>✦</span>
                      <span style={{ fontSize:"14px",lineHeight:1.6 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass" style={{ padding:"22px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"11px" }}>
                  <span className="section-label">Ingredients to Avoid</span>
                  <span className="section-label" style={{ color:"var(--green)" }}>To Seek</span>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px" }}>
                  <div>{result.ingredientsToAvoid?.map((ing,i) => <div key={i} style={{ display:"flex",gap:"7px",padding:"7px 0",borderBottom:"1px solid var(--border-glass)",fontSize:"13px",alignItems:"center" }}><span style={{ color:"var(--rose)" }}>✗</span>{ing}</div>)}</div>
                  <div>{result.ingredientsToSeek?.map((ing,i) => <div key={i} style={{ display:"flex",gap:"7px",padding:"7px 0",borderBottom:"1px solid var(--border-glass)",fontSize:"13px",alignItems:"center" }}><span style={{ color:"var(--green)" }}>✓</span>{ing}</div>)}</div>
                </div>
                <button className="btn-ghost" style={{ width:"100%",fontSize:"12px",padding:"9px",marginTop:"12px" }} onClick={() => setPage("ingredients")}>Check Your Products →</button>
              </div>
            </div>
          </div>
        )}

        {tab==="photo"&&(
          <div className="fade-up">
            <div style={{ maxWidth:"600px",margin:"0 auto" }}>
              <h2 className="serif" style={{ fontSize:"26px",fontWeight:300,marginBottom:"8px" }}>Photo Skin Analysis</h2>
              <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"14px" }}>Upload a clear selfie for AI skin analysis.</p>
              <div style={{ display:"flex",gap:"10px",marginBottom:"14px" }}>
                <button className="btn-ghost" onClick={() => setPage("camera")} style={{ flex:1,padding:"11px",fontSize:"12px" }}>📷 Open Live Camera Scan</button>
              </div>
              <div className="glass" style={{ padding:"24px" }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
                <div style={{ border:"2px dashed var(--border)",borderRadius:"10px",padding:"36px 20px",cursor:"pointer",transition:"all .2s",background:"var(--bg-alt)",textAlign:"center" }}
                  onClick={() => fileRef.current.click()}
                  onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                >
                  <div style={{ fontSize:"36px",marginBottom:"10px" }}>📸</div>
                  <div style={{ fontWeight:600,marginBottom:"5px" }}>Upload a Selfie</div>
                  <div style={{ fontSize:"13px",color:"var(--muted)" }}>JPG or PNG · Good lighting, no filter</div>
                </div>
                {photoLoading&&<div style={{ marginTop:"18px",display:"flex",alignItems:"center",gap:"12px",justifyContent:"center" }}><div className="typing-dots"><span/><span/><span/></div><span style={{ fontSize:"14px",color:"var(--muted)" }}>Analyzing your skin…</span></div>}
                {photoError&&<div className="error-box" style={{ marginTop:"14px" }}>{photoError}</div>}
                {photoAnalysis&&(
                  <div className="fade-up" style={{ marginTop:"18px" }}>
                    <div style={{ padding:"18px",background:"var(--bg-alt)",borderRadius:"10px",borderLeft:"3px solid var(--accent)" }}>
                      <span className="section-label" style={{ display:"block",marginBottom:"10px" }}>AI Photo Analysis</span>
                      <p style={{ fontSize:"14px",lineHeight:1.8,whiteSpace:"pre-wrap" }}>{photoAnalysis}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="routine"&&(
          <div className="fade-up">
            <div className="routine-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px" }}>
              {[{ time:"Morning",icon:"🌅",color:"var(--gold)",steps:result.morningRoutine },{ time:"Evening",icon:"🌙",color:"var(--lavender)",steps:result.eveningRoutine,isDark:true }].map(({ time,icon,color,steps,isDark }) => (
                <div key={time} className="glass" style={{ padding:"22px" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px" }}>
                    <span style={{ fontSize:"24px" }}>{icon}</span>
                    <div><span className="section-label">{time} Routine</span><div className="serif" style={{ fontSize:"18px",fontWeight:300,marginTop:"2px" }}>{time} Ritual</div></div>
                  </div>
                  {steps?.map((s,i) => (
                    <div key={i} className="routine-step">
                      <div className="step-num" style={{ background:isDark?`linear-gradient(135deg,var(--lavender),var(--navy))`:undefined }}>{s.step}</div>
                      <div>
                        <div style={{ fontWeight:600,fontSize:"14px" }}>{s.product}</div>
                        <div style={{ fontSize:"11px",color,marginTop:"2px",fontWeight:600 }}>✦ {s.ingredient}</div>
                        <div style={{ fontSize:"13px",color:"var(--muted)",marginTop:"4px",lineHeight:1.5 }}>{s.why}</div>
                        <div style={{ fontSize:"11px",background:"var(--bg-alt)",padding:"5px 9px",borderRadius:"6px",marginTop:"6px",color:"var(--muted)" }}>💡 {s.tip}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {result.weeklyTreatments?.length>0&&(
              <div className="glass" style={{ padding:"22px",marginTop:"18px" }}>
                <span className="section-label">Weekly Treatments</span>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"12px" }}>
                  {result.weeklyTreatments.map((t,i) => <div key={i} style={{ background:"var(--bg-alt)",borderRadius:"8px",padding:"13px",borderLeft:"3px solid var(--accent)" }}><span style={{ fontSize:"13px" }}>🧖 {t}</span></div>)}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="products"&&(
          <div className="fade-up">
            <div style={{ marginBottom:"18px" }}>
              <h2 className="serif" style={{ fontSize:"24px",fontWeight:300 }}>Curated for Your Skin</h2>
              <p style={{ color:"var(--muted)",fontSize:"13px",marginTop:"5px" }}>Personalized for {profile.skinType} skin · {concerns.slice(0,2).join(" & ")} · {profile.budget} budget</p>
            </div>
            <div className="product-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"14px" }}>
              {result.topProducts?.map((p,i) => (
                <div key={i} className="glass glass-hover" style={{ overflow:"hidden" }}>
                  <div style={{ height:"84px",background:["linear-gradient(135deg,#F5E8D3,#E8C9A0)","linear-gradient(135deg,#D3E8D3,#A0C9A0)","linear-gradient(135deg,#D3D3F5,#A0A0E8)","linear-gradient(135deg,#F5D3D3,#E8A0A0)","linear-gradient(135deg,#F5F0D3,#E8D9A0)","linear-gradient(135deg,#D3EBF5,#A0C9E0)"][i%6],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"34px",position:"relative" }}>
                    {p.emoji}
                    <div style={{ position:"absolute",top:"7px",right:"7px",background:"#fff",borderRadius:"6px",padding:"2px 7px",fontSize:"11px",fontWeight:700,color:"var(--green)" }}>★ {p.rating}</div>
                  </div>
                  <div style={{ padding:"14px" }}>
                    <div style={{ fontSize:"10px",color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase" }}>{p.brand}</div>
                    <div style={{ fontWeight:700,fontSize:"14px",marginTop:"3px",lineHeight:1.3 }}>{p.name}</div>
                    <div style={{ fontSize:"11px",color:"var(--accent)",marginTop:"3px" }}>✦ {p.type}</div>
                    {p.bestFor&&<div style={{ fontSize:"11px",color:"var(--muted)",marginTop:"3px",fontStyle:"italic" }}>{p.bestFor}</div>}
                    <div style={{ height:"1px",background:"var(--border-glass)",margin:"9px 0" }} />
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ fontWeight:700,fontSize:"13px" }}>{p.price}</span>
                      <span className="tag" style={{ fontSize:"9px" }}>{p.suitableFor}</span>
                    </div>
                    <div style={{ marginTop:"6px",fontSize:"11px",color:"var(--muted)" }}>Key: <strong>{p.keyIngredient}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="pairings"&&(
          <div className="fade-up">
            <h2 className="serif" style={{ fontSize:"24px",fontWeight:300,marginBottom:"7px" }}>Ingredient Pairings</h2>
            <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"22px" }}>Which ingredients work together — and which clash for your skin type.</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px" }}>
              {result.ingredientPairings?.map((p,i) => (
                <div key={i} className="glass" style={{ padding:"18px",borderLeft:`3px solid ${p.verdict==="safe"?"var(--green)":"var(--rose)"}` }}>
                  <div style={{ display:"flex",gap:"8px",alignItems:"center",marginBottom:"7px" }}>
                    <span>{p.verdict==="safe"?"✅":"⚠️"}</span>
                    <span style={{ fontWeight:700,fontSize:"11px",color:p.verdict==="safe"?"var(--green)":"var(--rose)",textTransform:"uppercase",letterSpacing:"1px" }}>{p.verdict==="safe"?"Great Pairing":"Avoid Together"}</span>
                  </div>
                  <div style={{ display:"flex",gap:"7px",alignItems:"center",marginBottom:"8px" }}>
                    <span className="tag tag-accent">{p.pair[0]}</span><span style={{ color:"var(--muted)" }}>+</span><span className="tag tag-accent">{p.pair[1]}</span>
                  </div>
                  <p style={{ fontSize:"13px",color:"var(--muted)",lineHeight:1.6 }}>{p.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="weather"&&(
          <div className="fade-up">
            <h2 className="serif" style={{ fontSize:"24px",fontWeight:300,marginBottom:"7px" }}>Weather-Based Skincare</h2>
            <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"22px" }}>Skincare tips tailored to your local weather conditions.</p>
            {!weatherData&&(
              <div className="glass" style={{ padding:"36px",textAlign:"center" }}>
                <div style={{ fontSize:"44px",marginBottom:"14px" }}>🌤️</div>
                <h3 style={{ fontSize:"17px",fontWeight:600,marginBottom:"7px" }}>Get Local Weather Tips</h3>
                <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"18px" }}>Allow location access to receive skincare recommendations for today's conditions.</p>
                <button className="btn-primary" onClick={fetchWeather} disabled={weatherLoading}><span>{weatherLoading?"Fetching…":"🌍 Get Weather Tips"}</span></button>
              </div>
            )}
            {weatherData?.error&&<div className="error-box" style={{ marginBottom:"14px" }}>{weatherData.error} <button onClick={() => setWeatherData(null)} style={{ marginLeft:"8px",color:"var(--accent)",background:"none",border:"none",cursor:"pointer",fontSize:"12px",textDecoration:"underline" }}>Try again</button></div>}
            {weatherData&&!weatherData.error&&(
              <div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px",marginBottom:"20px" }}>
                  {[["🌡️","Temperature",`${weatherData.temp}°C`,"var(--rose)"],["💧","Humidity",`${weatherData.hum}%`,"var(--navy)"],["🌤️","Conditions",weatherData.desc,"var(--gold)"],["💨","Wind",`${weatherData.wind} km/h`,"var(--lavender)"]].map(([e,l,v,c]) => (
                    <div key={l} className="kpi-card">
                      <div style={{ fontSize:"26px",marginBottom:"7px" }}>{e}</div>
                      <div style={{ fontSize:"10px",color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"3px" }}>{l}</div>
                      <div style={{ fontSize:"18px",fontWeight:700,color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="glass" style={{ padding:"22px" }}>
                  <span className="section-label">Today's Skincare Adjustments</span>
                  <div style={{ marginTop:"3px",fontSize:"12px",color:"var(--accent)",marginBottom:"14px" }}>For {weatherData.skinType} conditions</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" }}>
                    {weatherData.tips.map((t,i) => <div key={i} style={{ background:"var(--bg-alt)",padding:"13px",borderRadius:"8px",fontSize:"13px",borderLeft:"2px solid var(--accent)",lineHeight:1.5 }}>{t}</div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="diet"&&(
          <div className="fade-up">
            <div className="two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"18px" }}>
              <div className="glass" style={{ padding:"22px" }}>
                <span className="section-label">Diet & Nutrition</span>
                {result.dietTips?.map((t,i) => (
                  <div key={i} style={{ display:"flex",gap:"11px",padding:"11px 0",borderBottom:i<result.dietTips.length-1?"1px solid var(--border-glass)":"none" }}>
                    <span style={{ fontSize:"16px" }}>{"🥤🥗🍇🫐🫚".split("").filter((_,j)=>j%2===0)[i]||"🌿"}</span>
                    <span style={{ fontSize:"13px",lineHeight:1.6 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div className="glass" style={{ padding:"22px" }}>
                <span className="section-label">Lifestyle Tips</span>
                {(result.lifestyleTips||[]).slice(0,5).map((t,i) => (
                  <div key={i} style={{ display:"flex",gap:"11px",padding:"11px 0",borderBottom:i<4?"1px solid var(--border-glass)":"none" }}>
                    <span style={{ fontSize:"15px" }}>{"😴🧘🏃💧🛏️".split("").filter((_,j)=>j%2===0)[i]||"🌿"}</span>
                    <span style={{ fontSize:"13px",lineHeight:1.6 }}>{t}</span>
                  </div>
                ))}
              </div>
              <div className="glass" style={{ padding:"22px",gridColumn:"1/-1" }}>
                <span className="section-label">🌍 Climate-Specific Tips · {profile.climate}</span>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginTop:"13px" }}>
                  {(WEATHER_TIPS[profile.climate]||[]).map((t,i) => <div key={i} style={{ background:"var(--bg-alt)",padding:"12px",borderRadius:"8px",fontSize:"13px",borderLeft:"2px solid var(--accent)" }}>{t}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="history"&&(
          <div className="fade-up">
            <h2 className="serif" style={{ fontSize:"24px",fontWeight:300,marginBottom:"7px" }}>Skin Score History</h2>
            <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"22px" }}>Track your skin health progress over time.</p>
            {scoreHistory.length<2?(
              <div className="glass" style={{ padding:"36px",textAlign:"center" }}>
                <div style={{ fontSize:"36px",marginBottom:"11px" }}>📈</div>
                <div style={{ fontWeight:600,marginBottom:"7px" }}>Not enough data yet</div>
                <div style={{ color:"var(--muted)",fontSize:"14px" }}>Retake the analysis periodically to track your skin's progress.</div>
              </div>
            ):(
              <div className="glass" style={{ padding:"22px" }}>
                <div style={{ display:"flex",gap:"4px",alignItems:"flex-end",height:"150px",paddingTop:"18px" }}>
                  {scoreHistory.slice(-12).map((h,i,arr) => {
                    const min=Math.min(...arr.map(x=>x.score));
                    const max=Math.max(...arr.map(x=>x.score));
                    const pct=Math.max(18,((h.score-min)/(max-min||1))*100);
                    const isLast=i===arr.length-1;
                    return (
                      <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",height:"100%" }}>
                        <div style={{ fontSize:"9px",color:"var(--muted)",fontWeight:600,visibility:isLast?"visible":"hidden" }}>{h.score}</div>
                        <div style={{ flex:1,width:"100%",display:"flex",alignItems:"flex-end" }}>
                          <div style={{ width:"100%",height:`${pct}%`,background:isLast?"linear-gradient(to top,var(--accent),var(--gold))":"var(--bg-alt2)",borderRadius:"3px 3px 0 0",minHeight:"4px" }} />
                        </div>
                        <div style={{ fontSize:"8px",color:"var(--muted)",transform:"rotate(-30deg)",whiteSpace:"nowrap" }}>{h.date.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginTop:"18px",textAlign:"center" }}>
              <button className="btn-primary" onClick={() => setPage("quiz")}><span>Retake Analysis</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── INGREDIENT CHECKER ───────────────────────────────────────────────────────
// FIX: AI analysis is capped at 512 tokens with hard text truncation at 500 chars.
//      Image OCR is 2-step (image→text, text→analysis) to halve image call cost.
const IngredientsPage = ({ result }) => {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [filter, setFilter] = useState("all");
  const fileRef = useRef();

  const quickCheck = () => {
    const lower = text.toLowerCase();
    const found = [];
    Object.entries(KNOWN_INGREDIENTS).forEach(([name,info]) => { if (lower.includes(name)) found.push({ name,...info }); });
    setAnalysis(found); setAiInsight(""); setAiError("");
  };

  const askAI = async () => {
    if (!text.trim()) return;
    setAiLoading(true); setAiInsight(""); setAiError("");
    try {
      const truncated = text.slice(0, 500);
      const res = await callAI(
        `Skincare ingredients — answer in 4 sentences only: (1) top 2 benefits, (2) any red flags, (3) best skin type, (4) safety: Safe/Caution/Avoid.\n\nIngredients: ${truncated}`,
        "Cosmetic chemist. 4 sentences max. Be specific, no lists.",
        null, null, 450
      );
      setAiInsight(res);
    } catch (e) { setAiError(getErrorMsg(e)); }
    setAiLoading(false);
  };

  const handleImageOCR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAiLoading(true); setAiInsight(""); setAiError(""); setAnalysis(null);
    try {
      const base64Raw = await new Promise((res,rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      // Compress image
      const img = new Image();
      const base64 = await new Promise((res) => {
        img.onload = () => {
          const c = document.createElement("canvas");
          const scale = Math.min(1, 800 / Math.max(img.width, img.height));
          c.width = img.width * scale; c.height = img.height * scale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.65).split(",")[1]);
        };
        img.src = `data:${file.type || "image/jpeg"};base64,${base64Raw}`;
      });

      // Step 1: OCR (image call, 400 tokens)
      const ocrText = await callAI(
        "Extract all visible text from this image. Focus on ingredient lists. Output raw extracted text only.",
        "OCR. Extract text accurately. Output only extracted text.",
        base64, "image/jpeg", 400
      );
      setText(ocrText);

      // Step 2: Local dict scan
      const lower = ocrText.toLowerCase();
      const found = [];
      Object.entries(KNOWN_INGREDIENTS).forEach(([name,info]) => { if (lower.includes(name)) found.push({ name,...info }); });
      setAnalysis(found);

      // Step 3: AI text analysis — NO image resend (saves tokens)
      const truncated = ocrText.slice(0, 450);
      const aiRes = await callAI(
        `Skincare ingredients in 4 sentences: key benefits, concerns, skin type, safety verdict.\n\n${truncated}`,
        "Cosmetic chemist. 4 sentences. Direct and practical.",
        null, null, 400
      );
      setAiInsight(aiRes);
    } catch (e) { setAiError(getErrorMsg(e)); }
    setAiLoading(false);
  };

  const filtered = analysis ? (filter==="all"?analysis:analysis.filter(i=>i.status===filter)) : [];
  const sample = "Water, Niacinamide (10%), Zinc PCA, Panthenol, Hyaluronic Acid, Fragrance, Alcohol Denat, Glycerin, Ceramide NP, Retinol, Salicylic Acid, Centella Asiatica, Squalane, Vitamin C";

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageOCR} />
      <div style={{ maxWidth:"840px",margin:"0 auto",padding:"36px 24px" }}>
        <span className="section-label">✦ Ingredient Intelligence</span>
        <h1 className="serif" style={{ fontSize:"clamp(26px,4vw,42px)",fontWeight:300,marginTop:"10px",marginBottom:"8px" }}>
          Decode Your <em style={{ color:"var(--accent)" }}>Ingredients</em>
        </h1>
        <p style={{ color:"var(--muted)",marginBottom:"24px",lineHeight:1.7 }}>Paste any ingredient list, or photograph a product label for instant AI-powered safety analysis.</p>

        <div className="glass" style={{ padding:"22px",marginBottom:"18px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px" }}>
            <label style={{ fontWeight:600,fontSize:"14px" }}>Paste Ingredient List</label>
            <button onClick={() => { setText(sample); setAnalysis(null); setAiInsight(""); setAiError(""); }} style={{ fontSize:"12px",color:"var(--accent)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'DM Sans',sans-serif" }}>Load sample</button>
          </div>
          <textarea className="input-field" rows={5} value={text} onChange={e => { setText(e.target.value); setAnalysis(null); setAiInsight(""); setAiError(""); }} placeholder="e.g. Water, Niacinamide, Hyaluronic Acid, Fragrance, Alcohol Denat…" />
          <div style={{ display:"flex",gap:"10px",marginTop:"13px",flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={quickCheck} disabled={!text.trim()}><span>⚡ Quick Scan</span></button>
            <button className="btn-ghost" onClick={askAI} disabled={!text.trim()||aiLoading}>{aiLoading?"Analyzing…":"🧠 AI Deep Analysis"}</button>
            <button className="btn-ghost" onClick={() => fileRef.current.click()} disabled={aiLoading} style={{ padding:"11px 16px",fontSize:"12px" }}>📷 Scan Label Photo</button>
          </div>
          {aiLoading&&(
            <div style={{ marginTop:"13px",display:"flex",alignItems:"center",gap:"12px" }}>
              <div className="typing-dots"><span/><span/><span/></div>
              <span style={{ fontSize:"13px",color:"var(--muted)" }}>Analyzing ingredients…</span>
            </div>
          )}
          {aiError&&<div className="error-box" style={{ marginTop:"13px" }}>{aiError}</div>}
        </div>

        {analysis!==null&&(
          <div className="glass fade-up" style={{ padding:"22px",marginBottom:"18px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"10px" }}>
              <span className="section-label">Scan Results · {analysis.length} ingredients found</span>
              <div style={{ display:"flex",gap:"5px" }}>
                {["all","safe","caution","avoid"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{ background:filter===f?"var(--accent)":"var(--bg-alt)",color:filter===f?"#fff":"var(--muted)",border:"1px solid var(--border)",borderRadius:"20px",padding:"4px 11px",fontSize:"11px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"capitalize",fontWeight:500 }}>{f}</button>
                ))}
              </div>
            </div>
            {filtered.length===0?(
              <p style={{ color:"var(--muted)",textAlign:"center",padding:"18px" }}>{analysis.length===0?"No known ingredients detected. Try AI Deep Analysis.":"No ingredients match this filter."}</p>
            ):(
              ["safe","caution","avoid"].map(status => {
                const items = filtered.filter(i=>i.status===status);
                if (!items.length) return null;
                return (
                  <div key={status} style={{ marginBottom:"14px" }}>
                    <div style={{ fontSize:"10px",letterSpacing:"2px",textTransform:"uppercase",color:{ safe:"var(--green)",caution:"#7A5C00",avoid:"var(--rose)" }[status],marginBottom:"7px",fontWeight:700 }}>
                      {{ safe:"✓ Safe to Use",caution:"⚠ Use with Caution",avoid:"✗ Consider Avoiding" }[status]}
                    </div>
                    {items.map(ing => (
                      <div key={ing.name} style={{ display:"flex",gap:"11px",padding:"9px 0",borderBottom:"1px solid var(--border-glass)",alignItems:"flex-start" }}>
                        <span className={`ingredient-badge badge-${status}`} style={{ flexShrink:0 }}>{ing.name}</span>
                        <span style={{ fontSize:"13px",color:"var(--muted)",lineHeight:1.5 }}>{ing.effect}</span>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}

        {aiInsight&&(
          <div className="glass fade-up" style={{ padding:"22px",marginBottom:"18px" }}>
            <span className="section-label">🧠 AI Deep Analysis</span>
            <p style={{ fontSize:"14px",lineHeight:1.85,marginTop:"11px" }}>{aiInsight}</p>
          </div>
        )}

        <div style={{ marginTop:"28px" }}>
          <span className="section-label">Ingredients Glossary ({Object.keys(KNOWN_INGREDIENTS).length} ingredients)</span>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginTop:"13px" }}>
            {Object.entries(KNOWN_INGREDIENTS).slice(0,16).map(([name,info]) => (
              <div key={name} style={{ display:"flex",gap:"9px",alignItems:"flex-start",padding:"11px",background:"var(--surface-glass)",border:"1px solid var(--border-glass)",borderRadius:"10px",backdropFilter:"blur(8px)" }}>
                <span className={`ingredient-badge badge-${info.status}`} style={{ flexShrink:0 }}>{name}</span>
                <span style={{ fontSize:"11px",color:"var(--muted)",lineHeight:1.5 }}>{info.effect}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── COMPARE PAGE ─────────────────────────────────────────────────────────────
// FIX: Smallest viable JSON schema — 600 output tokens max.
//      Two separate focused calls (scores+basics, then verdict+situational)
//      merged client-side to avoid any single large JSON parse failure.
const ComparePage = () => {
  const [products, setProducts] = useState(["",""]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const compare = async () => {
    if (!products[0].trim() || !products[1].trim()) return;
    setLoading(true); setComparison(null); setError("");
    try {
      const a = products[0].slice(0, 70);
      const b = products[1].slice(0, 70);
      const sys = "Dermatologist. Return ONLY valid JSON, no markdown.";

      // Call 1: product details (compact)
      const detailsPrompt = `Compare "${a}" vs "${b}" for Indian skin. Return ONLY:
{"productA":{"name":"${a.slice(0,30)}","type":"type","keyIngredients":["a","b"],"benefits":["b1","b2"],"bestFor":"skin","concerns":["c1"],"score":75},"productB":{"name":"${b.slice(0,30)}","type":"type","keyIngredients":["a","b"],"benefits":["b1","b2"],"bestFor":"skin","concerns":["c1"],"score":70}}`;

      // Call 2: verdict (separate to avoid large single parse)
      const verdictPrompt = `Compare "${a}" vs "${b}". Return ONLY:
{"verdict":"Two sentences on which is better.","winner":"A","situationalWinner":{"forDryness":"A","forAcne":"B","forAging":"A","forSensitive":"B"}}`;

      const [t1, t2] = await Promise.all([
        callAI(detailsPrompt, sys, null, null, 450),
        callAI(verdictPrompt, sys, null, null, 300),
      ]);

      const p1 = extractJSON(t1);
      const p2 = extractJSON(t2);

      if (!p1?.productA || !p1?.productB) throw new Error("Could not parse product details");

      setComparison({ ...p1, ...(p2 || { verdict:"Both products have unique strengths suited to different skin types.", winner:"tie", situationalWinner:{} }) });
    } catch (e) {
      setError(e.message.includes("parse") || e.message.includes("JSON")
        ? "AI returned unexpected format. Try shorter product names and retry."
        : getErrorMsg(e));
    }
    setLoading(false);
  };

  const C2 = comparison;
  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ maxWidth:"880px",margin:"0 auto",padding:"36px 24px" }}>
        <span className="section-label">✦ Product Comparator</span>
        <h1 className="serif" style={{ fontSize:"32px",fontWeight:300,marginTop:"8px",marginBottom:"7px" }}>Compare <em style={{ color:"var(--accent)" }}>Products</em></h1>
        <p style={{ color:"var(--muted)",fontSize:"14px",marginBottom:"24px" }}>Enter any two skincare products for a detailed AI comparison.</p>

        <div className="glass" style={{ padding:"22px",marginBottom:"22px" }}>
          <div className="compare-row" style={{ display:"flex",gap:"14px",alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"12px",color:"var(--muted)",marginBottom:"5px",display:"block",fontWeight:500 }}>Product A</label>
              <input className="input-field" value={products[0]} onChange={e => setProducts([e.target.value,products[1]])} placeholder="e.g. Minimalist 10% Niacinamide" />
            </div>
            <div style={{ fontSize:"18px",color:"var(--muted)",paddingBottom:"11px",flexShrink:0 }}>vs</div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:"12px",color:"var(--muted)",marginBottom:"5px",display:"block",fontWeight:500 }}>Product B</label>
              <input className="input-field" value={products[1]} onChange={e => setProducts([products[0],e.target.value])} placeholder="e.g. Dot & Key Vitamin C Serum" />
            </div>
          </div>
          <div style={{ marginTop:"14px",display:"flex",gap:"10px",flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={compare} disabled={!products[0].trim()||!products[1].trim()||loading}><span>{loading?"Comparing…":"Compare Now ⚖️"}</span></button>
            <button className="btn-ghost" style={{ padding:"11px 15px",fontSize:"11px" }} onClick={() => { setProducts(["Minimalist Niacinamide 10%","COSRX Snail 96 Mucin"]); setComparison(null); setError(""); }}>Try Example</button>
          </div>
          {error&&<div className="error-box" style={{ marginTop:"13px" }}>{error}</div>}
        </div>

        {loading&&(
          <div style={{ textAlign:"center",padding:"36px" }}>
            <div className="typing-dots" style={{ justifyContent:"center",display:"flex" }}><span/><span/><span/></div>
            <p style={{ color:"var(--muted)",marginTop:"11px" }}>Analyzing ingredients and formulations…</p>
          </div>
        )}

        {C2&&(
          <div className="fade-up">
            <div className="compare-row" style={{ display:"flex",gap:"14px",marginBottom:"18px" }}>
              {[C2.productA,C2.productB].map((p,i) => (
                <div key={i} className="compare-col" style={{ borderTop:`3px solid ${C2.winner===(i===0?"A":"B")?"var(--accent)":C2.winner==="tie"?"var(--gold)":"var(--border)"}` }}>
                  {C2.winner===(i===0?"A":"B")&&<div style={{ background:"linear-gradient(135deg,var(--accent),var(--accent-dark))",color:"#fff",textAlign:"center",padding:"5px",fontSize:"11px",fontWeight:600,letterSpacing:"1px" }}>✦ WINNER</div>}
                  <div style={{ padding:"18px" }}>
                    <div style={{ fontSize:"10px",color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"3px" }}>Product {i===0?"A":"B"}</div>
                    <h3 style={{ fontWeight:700,fontSize:"15px",marginBottom:"5px" }}>{p.name}</h3>
                    <span className="tag">{p.type}</span>
                    <div style={{ margin:"12px 0" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"4px" }}><span style={{ fontSize:"12px",color:"var(--muted)" }}>AI Score</span><span style={{ fontWeight:700,color:"var(--accent)" }}>{p.score}/100</span></div>
                      <div className="progress-bar"><div className="metric-fill" style={{ "--w":`${p.score}%`,width:`${p.score}%`,background:"var(--accent)" }}/></div>
                    </div>
                    <div style={{ marginBottom:"9px" }}><div style={{ fontSize:"10px",color:"var(--muted)",marginBottom:"5px",fontWeight:600,letterSpacing:"1px" }}>KEY INGREDIENTS</div><div style={{ display:"flex",flexWrap:"wrap",gap:"4px" }}>{p.keyIngredients?.map(ing=><span key={ing} className="tag">{ing}</span>)}</div></div>
                    <div style={{ marginBottom:"9px" }}><div style={{ fontSize:"10px",color:"var(--muted)",marginBottom:"5px",fontWeight:600,letterSpacing:"1px" }}>BENEFITS</div>{p.benefits?.map((bn,j)=><div key={j} style={{ fontSize:"12px",lineHeight:1.5,color:"var(--text-sub)" }}>✓ {bn}</div>)}</div>
                    <div style={{ fontSize:"12px",color:"var(--accent)",fontWeight:500,marginBottom:"7px" }}>Best for: {p.bestFor}</div>
                    {p.concerns?.length>0&&p.concerns.map((c,j)=><div key={j} style={{ fontSize:"11px",color:"var(--rose)" }}>⚠ {c}</div>)}
                  </div>
                </div>
              ))}
            </div>
            <div className="glass" style={{ padding:"18px",marginBottom:"14px",borderLeft:"3px solid var(--accent)" }}>
              <span className="section-label">AI Verdict</span>
              <p style={{ fontSize:"14px",lineHeight:1.8,marginTop:"9px" }}>{C2.verdict}</p>
            </div>
            {C2.situationalWinner&&Object.keys(C2.situationalWinner).length>0&&(
              <div className="glass" style={{ padding:"18px" }}>
                <span className="section-label" style={{ display:"block",marginBottom:"11px" }}>Best for Each Concern</span>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"9px" }}>
                  {Object.entries(C2.situationalWinner).map(([s,w]) => (
                    <div key={s} style={{ display:"flex",justifyContent:"space-between",padding:"9px 13px",background:"var(--bg-alt)",borderRadius:"8px" }}>
                      <span style={{ fontSize:"13px",textTransform:"capitalize" }}>{s.replace(/([A-Z])/g," $1").trim()}</span>
                      <span style={{ fontSize:"13px",fontWeight:700,color:"var(--accent)" }}>Product {w}</span>
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

// ─── ANALYTICS PAGE ───────────────────────────────────────────────────────────
// FIX: Compact 3-sentence prompt, 400 max_tokens
const AnalyticsPage = () => {
  const scoreHistory = lsGet("score_history",[]);
  const journalEntries = lsGet("journal_entries",[]);
  const trackerHistory = lsGet("tracker_history",{});
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const avgScore = scoreHistory.length?Math.round(scoreHistory.reduce((a,b)=>a+b.score,0)/scoreHistory.length):0;
  const latestScore = scoreHistory.length?scoreHistory[scoreHistory.length-1].score:0;
  const scoreChange = scoreHistory.length>1?latestScore-scoreHistory[scoreHistory.length-2].score:0;
  const journalAvgRating = journalEntries.length?(journalEntries.reduce((a,b)=>a+(b.rating||3),0)/journalEntries.length).toFixed(1):"N/A";
  const completedDays = Object.values(trackerHistory).filter(d=>d.done>0).length;
  const streak = (() => { let s=0; for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);const h=trackerHistory[formatDate(d)];if(h&&h.done>=Math.floor(h.total*.6))s++;else if(i>0)break;} return s; })();
  const symptomFrequency = {};
  journalEntries.forEach(e=>(e.symptoms||[]).forEach(s=>{symptomFrequency[s]=(symptomFrequency[s]||0)+1;}));
  const topSymptoms = Object.entries(symptomFrequency).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const last14Ratings = journalEntries.slice(0,14).reverse();

  const getAIInsight = async () => {
    setAiLoading(true); setAiInsight(""); setAiError("");
    try {
      const histSummary = scoreHistory.slice(-3).map(h=>`${h.date.slice(5)}:${h.score}`).join(",")||"none";
      const topSym = topSymptoms.slice(0,2).map(([s,c])=>`${s}(${c}x)`).join(",")||"none";
      const res = await callAI(
        `Skin data: scores=${histSummary}, streak=${streak}d, avg mood=${journalAvgRating}/5, symptoms=${topSym}. Give 3 insights in 3 sentences.`,
        "Skin analytics expert. 3 sentences. Data-driven and specific.",
        null, null, 350
      );
      setAiInsight(res);
    } catch (e) { setAiError(getErrorMsg(e)); }
    setAiLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ maxWidth:"1080px",margin:"0 auto",padding:"36px 24px" }}>
        <span className="section-label">✦ Progress Analytics</span>
        <h1 className="serif" style={{ fontSize:"clamp(26px,4vw,42px)",fontWeight:300,marginTop:"10px",marginBottom:"22px" }}>
          Your Skin <em style={{ color:"var(--accent)" }}>Dashboard</em>
        </h1>
        <div className="kpi-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px",marginBottom:"22px" }}>
          {[
            { icon:"🏆",label:"Latest Score",value:`${latestScore||"—"}/100`,sub:scoreChange>0?`↑ +${scoreChange}`:scoreChange<0?`↓ ${scoreChange}`:"First analysis",color:"var(--accent)" },
            { icon:"📊",label:"Average Score",value:`${avgScore||"—"}`,sub:`${scoreHistory.length} analyses`,color:"var(--gold)" },
            { icon:"🔥",label:"Streak",value:`${streak} days`,sub:`${completedDays} tracked days`,color:"var(--rose)" },
            { icon:"😊",label:"Journal Avg",value:journalAvgRating,sub:`${journalEntries.length} entries`,color:"var(--green)" },
          ].map((k,i) => (
            <div key={i} className="kpi-card">
              <div style={{ fontSize:"26px",marginBottom:"7px" }}>{k.icon}</div>
              <div style={{ fontSize:"10px",color:"var(--muted)",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"3px" }}>{k.label}</div>
              <div className="serif" style={{ fontSize:"22px",fontWeight:300,color:k.color,marginBottom:"3px" }}>{k.value}</div>
              <div style={{ fontSize:"11px",color:"var(--muted)" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:"18px",marginBottom:"18px" }}>
          <div className="glass" style={{ padding:"22px" }}>
            <span className="section-label">Skin Score Timeline</span>
            {scoreHistory.length>=2?(
              <div style={{ display:"flex",gap:"4px",alignItems:"flex-end",height:"130px",paddingTop:"16px",marginTop:"14px" }}>
                {scoreHistory.slice(-12).map((h,i,arr) => {
                  const min=Math.min(...arr.map(x=>x.score));
                  const max=Math.max(...arr.map(x=>x.score));
                  const pct=Math.max(16,((h.score-min)/(max-min||1))*100);
                  const isLast=i===arr.length-1;
                  return (
                    <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",height:"100%" }} title={`${h.date}: ${h.score}/100`}>
                      <div style={{ fontSize:"9px",color:"var(--muted)",fontWeight:700,visibility:isLast?"visible":"hidden" }}>{h.score}</div>
                      <div style={{ flex:1,width:"100%",display:"flex",alignItems:"flex-end" }}>
                        <div style={{ width:"100%",height:`${pct}%`,background:isLast?"linear-gradient(to top,var(--accent),var(--gold))":"var(--bg-alt2)",borderRadius:"3px 3px 0 0",minHeight:"4px" }} />
                      </div>
                      <div style={{ fontSize:"8px",color:"var(--muted)",transform:"rotate(-30deg)",whiteSpace:"nowrap" }}>{h.date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            ):<div style={{ padding:"36px 0",textAlign:"center",color:"var(--muted)",fontSize:"13px" }}>Take the quiz multiple times to see your score trend.</div>}
          </div>
          <div className="glass" style={{ padding:"22px" }}>
            <span className="section-label">Common Symptoms</span>
            <div style={{ marginTop:"14px" }}>
              {topSymptoms.length>0?topSymptoms.map(([sym,count]) => (
                <div key={sym} style={{ marginBottom:"9px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:"3px" }}>
                    <span style={{ fontSize:"12px" }}>{sym}</span>
                    <span style={{ fontSize:"12px",fontWeight:700,color:"var(--accent)" }}>{count}×</span>
                  </div>
                  <div className="progress-bar"><div style={{ height:"100%",width:`${(count/Math.max(journalEntries.length,1))*100}%`,background:"var(--accent)",borderRadius:"2px" }} /></div>
                </div>
              )):<div style={{ color:"var(--muted)",fontSize:"13px",textAlign:"center",padding:"18px 0" }}>Log journal entries to see patterns.</div>}
            </div>
          </div>
        </div>

        {last14Ratings.length>0&&(
          <div className="glass" style={{ padding:"22px",marginBottom:"18px" }}>
            <span className="section-label">Mood Trend (Last 14 entries)</span>
            <div style={{ display:"flex",gap:"5px",alignItems:"flex-end",height:"70px",marginTop:"14px" }}>
              {last14Ratings.map((d,i) => {
                const colors=["var(--rose)","var(--rose)","var(--gold)","var(--green)","var(--green)"];
                return (
                  <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",height:"100%" }}>
                    <div style={{ flex:1,width:"100%",display:"flex",alignItems:"flex-end" }}>
                      <div style={{ width:"100%",height:`${(d.rating/5)*100}%`,background:colors[d.rating-1],borderRadius:"2px 2px 0 0",minHeight:"4px" }} />
                    </div>
                    <div style={{ fontSize:"8px",color:"var(--muted)",transform:"rotate(-30deg)",whiteSpace:"nowrap" }}>{d.date?.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass" style={{ padding:"22px",marginBottom:"18px" }}>
          <span className="section-label">📚 Scientific Skincare Research</span>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginTop:"14px" }}>
            {SCIENTIFIC_INSIGHTS.map((s,i) => (
              <div key={i} style={{ padding:"13px",background:"var(--bg-alt)",borderRadius:"8px",borderLeft:"2px solid var(--accent)" }}>
                <p style={{ fontSize:"13px",lineHeight:1.6,marginBottom:"5px" }}>{s.finding}</p>
                <p style={{ fontSize:"10px",color:"var(--muted)",fontStyle:"italic" }}>{s.source}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass" style={{ padding:"22px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"11px" }}>
            <span className="section-label">🧠 AI Progress Analysis</span>
            <button className="btn-ghost" onClick={getAIInsight} disabled={aiLoading} style={{ padding:"7px 14px",fontSize:"11px" }}>{aiLoading?"Analyzing…":"Generate Insight"}</button>
          </div>
          {aiLoading&&<div style={{ display:"flex",gap:"10px",alignItems:"center" }}><div className="typing-dots"><span/><span/><span/></div><span style={{ fontSize:"13px",color:"var(--muted)" }}>Analyzing your data…</span></div>}
          {aiError&&<div className="error-box">{aiError}</div>}
          {aiInsight&&<p style={{ fontSize:"14px",lineHeight:1.85,color:"var(--text-sub)" }}>{aiInsight}</p>}
          {!aiInsight&&!aiLoading&&!aiError&&<p style={{ fontSize:"13px",color:"var(--muted)" }}>Click Generate Insight to get a personalized analysis of your skin progress.</p>}
        </div>
      </div>
    </div>
  );
};

// ─── TRACKER ─────────────────────────────────────────────────────────────────
const TrackerPage = ({ result, setPage }) => {
  const today = todayStr();
  const [completed, setCompleted] = useState(() => lsGet(`tracker_${today}`,{}));
  const [history, setHistory] = useState(() => lsGet("tracker_history",{}));
  const amSteps = result?.morningRoutine?.map(s=>s.product)||["Gentle Cleanser","Vitamin C Serum","Moisturizer","SPF 50+"];
  const pmSteps = result?.eveningRoutine?.map(s=>s.product)||["Oil Cleanser","Treatment Serum","Night Moisturizer","Retinol"];
  const allSteps = [...amSteps.map(s=>`AM:${s}`),...pmSteps.map(s=>`PM:${s}`)];

  const toggle = (key) => {
    const updated = { ...completed,[key]:!completed[key] };
    setCompleted(updated); lsSet(`tracker_${today}`,updated);
    const hist = { ...history,[today]:{ done:Object.values(updated).filter(Boolean).length,total:allSteps.length } };
    setHistory(hist); lsSet("tracker_history",hist);
  };

  const doneCount = Object.values(completed).filter(Boolean).length;
  const pct = Math.round((doneCount/allSteps.length)*100);
  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date();d.setDate(d.getDate()-i);const key=formatDate(d);const h=history[key];return{key,label:d.toLocaleDateString("en",{weekday:"short"}),done:h?.done||0,total:h?.total||allSteps.length,isToday:key===today}; }).reverse();
  const streak = (() => { let s=0; for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);const h=history[formatDate(d)];if(h&&h.done>=Math.floor(h.total*.6))s++;else if(i>0)break;} return s; })();

  if (!result) return (
    <div style={{ minHeight:"100vh",paddingTop:"62px",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ textAlign:"center",padding:"40px" }}>
        <div style={{ fontSize:"44px",marginBottom:"11px" }}>📅</div>
        <h2 className="serif" style={{ fontSize:"26px",fontWeight:300,marginBottom:"9px" }}>No routine yet</h2>
        <p style={{ color:"var(--muted)",marginBottom:"18px" }}>Take the quiz to get your personalized routine tracker.</p>
        <button className="btn-primary" onClick={() => setPage("quiz")}><span>Start Quiz</span></button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ maxWidth:"780px",margin:"0 auto",padding:"36px 24px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"24px",flexWrap:"wrap",gap:"12px" }}>
          <div>
            <span className="section-label">✦ Daily Routine Tracker</span>
            <h1 className="serif" style={{ fontSize:"30px",fontWeight:300,marginTop:"6px" }}>Today's <em style={{ color:"var(--accent)" }}>Ritual</em></h1>
            <p style={{ color:"var(--muted)",fontSize:"13px",marginTop:"3px" }}>{new Date().toLocaleDateString("en",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
          </div>
          <div style={{ display:"flex",gap:"14px" }}>
            <div style={{ textAlign:"center" }}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--bg-alt2)" strokeWidth="5"/>
                <circle cx="36" cy="36" r="30" fill="none" stroke="var(--accent)" strokeWidth="5"
                  strokeDasharray={`${(pct/100)*188} 188`} strokeLinecap="round" transform="rotate(-90 36 36)"
                  style={{ transition:"stroke-dasharray .8s ease" }}
                />
                <text x="36" y="41" textAnchor="middle" fontFamily="DM Sans,sans-serif" fontSize="13" fontWeight="600" fill="var(--accent)">{pct}%</text>
              </svg>
              <div style={{ fontSize:"9px",color:"var(--muted)",marginTop:"3px" }}>Today</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),var(--gold))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:streak>0?"0 0 20px var(--accent-glow)":"none" }}>
                <div style={{ textAlign:"center" }}><div style={{ fontWeight:700,fontSize:"20px",color:"#fff" }}>{streak}</div><div style={{ fontSize:"8px",color:"rgba(255,255,255,.8)" }}>STREAK</div></div>
              </div>
              <div style={{ fontSize:"9px",color:"var(--muted)",marginTop:"3px" }}>🔥 Days</div>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding:"18px",marginBottom:"18px" }}>
          <span className="section-label" style={{ marginBottom:"11px",display:"block" }}>This Week</span>
          <div style={{ display:"flex",gap:"7px",justifyContent:"space-between" }}>
            {last7.map(d => { const p2=d.total>0?d.done/d.total:0; const cls=d.isToday?"streak-today":p2>=.6?"streak-done":d.done>0?"streak-missed":"streak-future"; return (<div key={d.key} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"3px" }}><div style={{ fontSize:"10px",color:"var(--muted)" }}>{d.label}</div><div className={`streak-day ${cls}`}>{p2>=.6?"✓":d.done>0?d.done:""}</div></div>); })}
          </div>
        </div>

        {[{ label:"Morning Routine",icon:"🌅",steps:amSteps,prefix:"AM" },{ label:"Evening Routine",icon:"🌙",steps:pmSteps,prefix:"PM" }].map(({ label,icon,steps,prefix }) => (
          <div key={prefix} className="glass" style={{ padding:"22px",marginBottom:"14px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px" }}>
              <span style={{ fontSize:"20px" }}>{icon}</span>
              <span className="section-label">{label}</span>
              <span style={{ marginLeft:"auto",fontSize:"12px",color:"var(--muted)" }}>{steps.filter(s=>completed[`${prefix}:${s}`]).length}/{steps.length}</span>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"7px" }}>
              {steps.map((step,i) => {
                const key=`${prefix}:${step}`;
                const done=!!completed[key];
                return (
                  <div key={key} onClick={() => toggle(key)} style={{ display:"flex",alignItems:"center",gap:"13px",padding:"11px 13px",borderRadius:"8px",cursor:"pointer",background:done?"var(--accent-light)":"var(--bg-alt)",border:`1px solid ${done?"var(--accent)":"var(--border)"}`,transition:"all .2s" }}>
                    <div style={{ width:20,height:20,borderRadius:"50%",background:done?"var(--accent)":"var(--surface)",border:`2px solid ${done?"var(--accent)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{done&&<span style={{ color:"#fff",fontSize:"10px",fontWeight:700 }}>✓</span>}</div>
                    <span style={{ fontSize:"13px",fontWeight:done?500:400,color:done?"var(--accent)":"var(--text)",flex:1 }}><strong style={{ marginRight:"5px",color:"var(--muted)",fontSize:"11px" }}>{i+1}.</strong>{step}</span>
                    {done&&<span style={{ fontSize:"12px" }}>✨</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {pct===100&&(
          <div className="fade-up" style={{ textAlign:"center",padding:"22px",background:"linear-gradient(135deg,var(--accent-light),var(--green-light))",borderRadius:"12px",border:"1px solid var(--accent)" }}>
            <div style={{ fontSize:"32px",marginBottom:"7px" }}>🎉</div>
            <h3 className="serif" style={{ fontSize:"20px",fontWeight:300,marginBottom:"5px" }}>Ritual Complete!</h3>
            <p style={{ color:"var(--muted)",fontSize:"13px" }}>Full routine done today. Consistency is the secret to great skin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── JOURNAL ─────────────────────────────────────────────────────────────────
// FIX: Journal AI summary capped at 350 tokens with last-5-entries only
const JournalPage = () => {
  const [entries, setEntries] = useState(() => lsGet("journal_entries",[]));
  const [newEntry, setNewEntry] = useState({ rating:3,notes:"",symptoms:[] });
  const [saved, setSaved] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const symptomsOpts = ["Breakout","Dryness","Oiliness","Redness","Dullness","Irritation","Smooth","Glowing","Hydrated","Sensitive","Tight","Plump"];

  const save = () => {
    const entry = { date:todayStr(),...newEntry,time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}) };
    const updated = [entry,...entries].slice(0,60);
    setEntries(updated); lsSet("journal_entries",updated);
    setNewEntry({ rating:3,notes:"",symptoms:[] });
    setSaved(true); setTimeout(() => setSaved(false),2500);
  };

  const toggleSym = sym => setNewEntry(e => ({ ...e,symptoms:e.symptoms.includes(sym)?e.symptoms.filter(s=>s!==sym):[...e.symptoms,sym] }));

  const getAISummary = async () => {
    if (entries.length<2) return;
    setAiLoading(true); setAiSummary(""); setAiError("");
    try {
      const last5 = entries.slice(0,5).map(e=>`${e.date.slice(5)}: ${e.rating}/5, ${e.symptoms?.slice(0,2).join(",")||"no tags"}`).join("; ");
      const res = await callAI(
        `Journal: ${last5}\n\nIn 3 sentences: patterns that help my skin, patterns that hurt it, and 2 tips.`,
        "Skincare coach. Empathetic and specific. 3 sentences.",
        null, null, 350
      );
      setAiSummary(res);
    } catch (e) { setAiError(getErrorMsg(e)); }
    setAiLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px" }}>
      <div style={{ maxWidth:"820px",margin:"0 auto",padding:"36px 24px" }}>
        <span className="section-label">✦ Skin Journal</span>
        <h1 className="serif" style={{ fontSize:"30px",fontWeight:300,marginTop:"8px",marginBottom:"22px" }}>Daily Skin <em style={{ color:"var(--accent)" }}>Log</em></h1>

        <div className="glass" style={{ padding:"22px",marginBottom:"22px" }}>
          <h3 style={{ fontWeight:600,marginBottom:"14px",fontSize:"15px" }}>Log Today · {new Date().toLocaleDateString("en",{weekday:"short",month:"short",day:"numeric"})}</h3>
          <div style={{ marginBottom:"14px" }}>
            <div style={{ fontSize:"12px",color:"var(--muted)",marginBottom:"9px",fontWeight:500 }}>How is your skin feeling?</div>
            <div style={{ display:"flex",gap:"7px" }}>
              {SKIN_JOURNAL_RATINGS.map((r,i) => (
                <button key={i} onClick={() => setNewEntry(e => ({...e,rating:i+1}))} style={{ flex:1,padding:"9px 4px",border:`1.5px solid ${newEntry.rating===i+1?"var(--accent)":"var(--border)"}`,borderRadius:"8px",background:newEntry.rating===i+1?"var(--accent-light)":"var(--surface-glass)",cursor:"pointer",fontSize:"18px",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",backdropFilter:"blur(8px)" }}>
                  <span>{r.split(" ")[0]}</span><span style={{ fontSize:"9px",color:"var(--muted)" }}>{r.split(" ").slice(1).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:"13px" }}>
            <div style={{ fontSize:"12px",color:"var(--muted)",marginBottom:"7px",fontWeight:500 }}>Tag today's observations</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
              {symptomsOpts.map(s => <span key={s} className={`concern-chip ${newEntry.symptoms.includes(s)?"active":""}`} style={{ fontSize:"12px",padding:"5px 11px" }} onClick={() => toggleSym(s)}>{s}</span>)}
            </div>
          </div>
          <textarea className="input-field" rows={3} value={newEntry.notes} onChange={e => setNewEntry(n => ({...n,notes:e.target.value}))} placeholder="Notes — new products tried, stress level, sleep quality, diet…" />
          <div style={{ display:"flex",gap:"10px",marginTop:"13px",alignItems:"center" }}>
            <button className="btn-primary" onClick={save}><span>{saved?"✓ Saved!":"Save Entry"}</span></button>
            {entries.length>=2&&<button className="btn-ghost" onClick={getAISummary} disabled={aiLoading} style={{ padding:"11px 16px",fontSize:"12px" }}>{aiLoading?"Analyzing…":"🧠 AI Pattern Analysis"}</button>}
          </div>
        </div>

        {(aiLoading||aiSummary||aiError)&&(
          <div className="glass fade-up" style={{ padding:"18px",marginBottom:"18px",borderLeft:"3px solid var(--accent)" }}>
            <span className="section-label">🧠 AI Skin Pattern Analysis</span>
            {aiLoading&&<div style={{ marginTop:"11px" }}><div className="typing-dots"><span/><span/><span/></div></div>}
            {aiError&&<div className="error-box" style={{ marginTop:"11px" }}>{aiError}</div>}
            {aiSummary&&<p style={{ fontSize:"14px",lineHeight:1.8,marginTop:"9px" }}>{aiSummary}</p>}
          </div>
        )}

        {entries.length>0&&(
          <div>
            <span className="section-label" style={{ marginBottom:"13px",display:"block" }}>Past Entries ({entries.length})</span>
            <div style={{ display:"flex",flexDirection:"column",gap:"9px" }}>
              {entries.slice(0,15).map((e,i) => (
                <div key={i} className="journal-entry">
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"9px" }}>
                      <span style={{ fontSize:"18px" }}>{SKIN_JOURNAL_RATINGS[e.rating-1]?.split(" ")[0]||"🙂"}</span>
                      <div><div style={{ fontWeight:600,fontSize:"13px" }}>{SKIN_JOURNAL_RATINGS[e.rating-1]?.slice(3)||"Good"}</div><div style={{ fontSize:"11px",color:"var(--muted)" }}>{e.date} · {e.time}</div></div>
                    </div>
                    <div style={{ display:"flex",gap:"3px",flexWrap:"wrap",justifyContent:"flex-end" }}>{e.symptoms?.map(s=><span key={s} className="tag" style={{ fontSize:"9px" }}>{s}</span>)}</div>
                  </div>
                  {e.notes&&<p style={{ fontSize:"13px",color:"var(--muted)",lineHeight:1.5 }}>{e.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {entries.length===0&&(
          <div style={{ textAlign:"center",padding:"36px",color:"var(--muted)" }}>
            <div style={{ fontSize:"36px",marginBottom:"9px" }}>📝</div>
            <div>No entries yet. Log your first skin day above!</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
// FIX: Uses streaming (callAIChatStream) to show tokens as they arrive.
//      History limited to last 6 turns. System prompt hard-capped at 400 chars.
//      Max output 600 tokens.
const ChatPage = ({ result }) => {
  const [messages, setMessages] = useState(() => {
    const saved = lsGet("chat_history",[]);
    return saved.length>0?saved:[{ role:"assistant",text:"Hello! I'm your AI dermatologist. Ask me anything about skincare, ingredients, routines, or Indian market products!" }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, streamingText, loading]);

  const send = async (text = input) => {
    if (!text.trim() || loading) return;
    const userMsg = { role:"user",text };
    const updated = [...messages,userMsg];
    setMessages(updated);
    lsSet("chat_history",updated.slice(-20));
    setInput(""); setLoading(true); setError(""); setStreamingText("");

    try {
      const skinCtx = result
        ? `User has ${result.skinProfile?.slice(0,80)||""}. Avoid: ${(result.ingredientsToAvoid||[]).slice(0,2).join(",")}. Seek: ${(result.ingredientsToSeek||[]).slice(0,2).join(",")}.`
        : "User hasn't taken the quiz yet.";
      // Hard cap system prompt at 400 chars total
      const sys = `Friendly AI dermatologist. ${skinCtx} Be warm, concise (3-4 sentences), practical. Recommend Indian products when relevant.`.slice(0,400);

      const history = updated.slice(-6).map(m => ({ role:m.role==="user"?"user":"assistant",content:m.text }));

      // Use streaming so users see text appear progressively
      let final = "";
      try {
        final = await callAIChatStream(history, sys, (chunk) => {
          setStreamingText(chunk);
        }, 600);
      } catch {
        // Streaming fallback → regular call
        final = await callAIChat(history, sys, 600);
      }

      setStreamingText("");
      const newMsgs = [...updated,{ role:"assistant",text:final }];
      setMessages(newMsgs);
      lsSet("chat_history",newMsgs.slice(-20));
    } catch (e) {
      setStreamingText("");
      setError(getErrorMsg(e));
      const errMsgs = [...updated,{ role:"assistant",text:"Couldn't respond right now. Please try again." }];
      setMessages(errMsgs);
    }
    setLoading(false);
  };

  const clearHistory = () => {
    const initial = [{ role:"assistant",text:"Conversation cleared. I still have your skin profile! Ask me anything." }];
    setMessages(initial); lsSet("chat_history",initial); setStreamingText("");
  };

  const suggestions = [
    "Can I use niacinamide with vitamin C?",
    "What causes skin purging?",
    "Best budget serum for dark spots?",
    "Should I use retinol day or night?",
    "How to build a minimal routine?",
    "AHA vs BHA — what's the difference?",
  ];

  return (
    <div style={{ minHeight:"100vh",paddingTop:"62px",display:"flex",flexDirection:"column" }}>
      <div style={{ flex:1,maxWidth:"720px",width:"100%",margin:"0 auto",padding:"22px 24px 0",display:"flex",flexDirection:"column" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px" }}>
          <div>
            <span className="section-label">✦ AI Dermatologist</span>
            <h1 className="serif" style={{ fontSize:"26px",fontWeight:300,marginTop:"5px" }}>Ask <em style={{ color:"var(--accent)" }}>Anything</em></h1>
          </div>
          <div style={{ display:"flex",gap:"7px",alignItems:"center" }}>
            <div style={{ fontSize:"11px",color:"var(--muted)" }}>💬 {messages.length-1}</div>
            <button onClick={clearHistory} style={{ background:"none",border:"1px solid var(--border)",borderRadius:"7px",padding:"5px 11px",fontSize:"11px",color:"var(--muted)",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>Clear</button>
          </div>
        </div>

        <div className="thin-scroll" style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"10px",paddingBottom:"14px",minHeight:"280px",maxHeight:"calc(100vh - 290px)" }}>
          {messages.map((m,i) => (
            <div key={i} style={{ display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              {m.role==="assistant"&&(
                <div style={{ width:30,height:30,borderRadius:"50%",flexShrink:0,marginRight:"7px",background:"linear-gradient(135deg,var(--accent),var(--gold))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px" }}>🩺</div>
              )}
              <div className={m.role==="user"?"chat-bubble-user":"chat-bubble-ai"}>{m.text}</div>
            </div>
          ))}
          {/* Streaming in-progress bubble */}
          {loading&&(
            <div style={{ display:"flex",gap:"7px",alignItems:"flex-start" }}>
              <div style={{ width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),var(--gold))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0 }}>🩺</div>
              <div className="chat-bubble-ai">
                {streamingText||<div className="typing-dots"><span/><span/><span/></div>}
                {streamingText&&<span style={{ display:"inline-block",width:"2px",height:"14px",background:"var(--accent)",marginLeft:"2px",verticalAlign:"middle",animation:"pulse 1s infinite" }}>▊</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length<4&&(
          <div style={{ display:"flex",gap:"7px",flexWrap:"wrap",marginBottom:"11px" }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} style={{ background:"var(--surface-glass)",border:"1px solid var(--border)",borderRadius:"20px",padding:"6px 13px",fontSize:"12px",cursor:"pointer",color:"var(--muted)",fontFamily:"'DM Sans',sans-serif",transition:"all .2s",backdropFilter:"blur(8px)" }}
                onMouseEnter={e => { e.target.style.borderColor="var(--accent)"; e.target.style.color="var(--accent)"; }}
                onMouseLeave={e => { e.target.style.borderColor="var(--border)"; e.target.style.color="var(--muted)"; }}
              >{s}</button>
            ))}
          </div>
        )}

        {error&&<div className="error-box" style={{ marginBottom:"11px" }}>{error}</div>}

        <div style={{ display:"flex",gap:"9px",paddingBottom:"22px",paddingTop:"7px",background:"var(--bg)",position:"sticky",bottom:0 }}>
          <input className="input-field" style={{ borderRadius:"24px",padding:"11px 18px" }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Ask your skin question…" disabled={loading} />
          <button className="btn-primary" onClick={() => send()} disabled={!input.trim()||loading} style={{ borderRadius:"24px",padding:"11px 22px",whiteSpace:"nowrap" }}><span>{loading?"…":"Send →"}</span></button>
        </div>
      </div>
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => lsGet("dark_mode",false));
  const [page, setPage] = useState("home");
  const [profile, setProfile] = useState(null);
  const [result, setResult] = useState(null);
  const C = dark ? DARK : LIGHT;

  useEffect(() => { lsSet("dark_mode",dark); },[dark]);

  const navigate = (p) => {
    if ((p==="results"||p==="routine")&&!result) { setPage("quiz"); return; }
    setPage(p);
    window.scrollTo({ top:0,behavior:"smooth" });
  };

  return (
    <>
      <style>{makeStyles(C)}</style>
      {page!=="analyzing"&&<Nav page={page} setPage={navigate} dark={dark} setDark={setDark} />}
      {page==="home"        &&<HeroPage setPage={setPage} dark={dark} />}
      {page==="quiz"        &&<QuizPage setPage={setPage} setProfile={setProfile} />}
      {page==="analyzing"   &&<AnalyzingPage profile={profile} setPage={setPage} setResult={setResult} />}
      {page==="results"     &&<ResultsPage profile={profile} result={result} setPage={navigate} />}
      {page==="ingredients" &&<IngredientsPage result={result} />}
      {page==="camera"      &&<CameraPage result={result} />}
      {page==="analytics"   &&<AnalyticsPage />}
      {page==="tracker"     &&<TrackerPage result={result} setPage={navigate} />}
      {page==="journal"     &&<JournalPage />}
      {page==="compare"     &&<ComparePage />}
      {page==="chat"        &&<ChatPage result={result} />}
      {page==="routine"     &&<ResultsPage profile={profile} result={result} setPage={navigate} />}
    </>
  );
}