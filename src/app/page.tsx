"use client";

import { useState, useEffect } from "react";

const PREVIEW_DAYS = [
  { label: "Day 1", date: "Apr. 8",  title: "Drive to Phoenix", meta: "12:00 PM · 4 hrs", color: "#fff4de", dot: "#f5a623" },
  { label: "Day 2", date: "Apr. 9",  title: "Explore Sedona",   meta: "Red Rock trail + dinner", color: "#e8f5ff", dot: "#4f88df" },
  { label: "Day 3", date: "Apr. 10", title: "Grand Canyon Rim", meta: "South Rim sunrise hike",  color: "#e9fff2", dot: "#1fb87a" },
  { label: "Day 4", date: "Apr. 11", title: "Page & Horseshoe", meta: "Antelope Canyon tour",    color: "#fff0fb", dot: "#d46fbc" },
];

const FEATURES = [
  { icon: "🤖", label: "AI Concierge", body: "Plan with natural language, research stops live, and let Northstar edit the active trip for you.", bg: "#fff8ec", border: "#ffe8bc" },
  { icon: "💰", label: "Budget Builder", body: "Get budget recommendations, structure costs by trip need, and save approved spend directly into the plan.", bg: "#edf7ff", border: "#c2deff" },
  { icon: "🎒", label: "Packing Help", body: "Create packing lists around destination, weather, activity type, and trip length instead of starting from scratch.", bg: "#edfbf3", border: "#b3efd4" },
  { icon: "✈️", label: "Reservation Assist", body: "Look up flights, sync reservations, compare booking options, and move from research to action without leaving the workspace.", bg: "#fef0ff", border: "#e8c2ff" },
];

const STEPS = [
  { n: "01", title: "Tell it what you want", body: "Describe the trip, vibe, budget, stops, or booking help you need in plain English.", color: "#fff8ec" },
  { n: "02", title: "Let AI do the heavy lift", body: "Northstar researches live options, accounts for travel time and timezone shifts, and updates the active trip when the request is clear.", color: "#edf7ff" },
  { n: "03", title: "Approve external actions", body: "Keep internal edits automatic, then approve bookings, provider handoffs, and account connections only when needed.", color: "#edfbf3" },
];

const FAQS = [
  { q: "Is it really a one-time payment?", a: "Yes — pay once, plan every trip you'll ever take. No renewals, no monthly fees, no surprises." },
  { q: "Do I need an account to start?", a: "You can poke around immediately. An account lets you save trips across all your devices." },
  { q: "Can I share with travel partners?", a: "Trip sharing is on the roadmap. For now you can export a clean view to share with anyone." },
  { q: "What can the AI do right now?", a: "Northstar AI can plan days in natural language, research destinations and restaurants, update your trip, help with budgets and packing, look up flight details, sync Google reservations, and guide booking flows with approval for external actions." },
];

const STATS = [
  { val: "11", sub: "days until departure", icon: "📅", bg: "#fff8ec", border: "#ffe8bc" },
  { val: "3", sub: "AI actions applied", icon: "⚡", bg: "#edf7ff", border: "#c2deff" },
  { val: "82%", sub: "packing plan ready", icon: "🎒", bg: "#fef0ff", border: "#e8c2ff" },
  { val: "$1.2k", sub: "budget mapped", icon: "💳", bg: "#edfbf3", border: "#b3efd4" },
];

export default function NorthstarLanding() {
  const [activeDay, setActiveDay] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setActiveDay(d => (d + 1) % PREVIEW_DAYS.length), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Nunito', sans-serif", background: "#f0f3f9", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        .blob {
          position: fixed; border-radius: 50%; filter: blur(80px);
          pointer-events: none; z-index: 0; opacity: 0.55;
        }

        .pill-nav a, .pill-nav button {
          font-size: 14px; font-weight: 500;
          color: #64748b; text-decoration: none;
          padding: 8px 18px; border-radius: 100px;
          border: none; background: transparent;
          font-family: inherit; cursor: pointer;
          transition: all 0.18s ease;
        }
        .pill-nav a:hover, .pill-nav button:hover {
          color: #1e293b; background: rgba(0,0,0,0.05);
        }

        .btn-dark {
          display: inline-flex; align-items: center; gap: 6px;
          background: #1e293b; color: #fff;
          border: none; border-radius: 100px;
          padding: 13px 26px; font-size: 15px; font-weight: 600;
          font-family: inherit; cursor: pointer; text-decoration: none;
          box-shadow: 0 8px 24px rgba(30,41,59,0.22);
          transition: all 0.18s ease;
        }
        .btn-dark:hover { background: #334155; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(30,41,59,0.28); }

        .btn-soft {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fff; color: #1e293b;
          border: 1.5px solid #e2e8f0; border-radius: 100px;
          padding: 12px 24px; font-size: 15px; font-weight: 600;
          font-family: inherit; cursor: pointer; text-decoration: none;
          transition: all 0.18s ease;
        }
        .btn-soft:hover { border-color: #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.07); transform: translateY(-1px); }

        .card {
          background: #fff;
          border-radius: 24px;
          border: 1.5px solid rgba(255,255,255,0.9);
          box-shadow: 0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.1); transform: translateY(-2px); }

        .day-pill {
          display: inline-flex; flex-direction: column;
          align-items: center; padding: 10px 16px;
          border-radius: 100px; border: 1.5px solid #e2e8f0;
          background: #fff; cursor: pointer;
          transition: all 0.18s ease; white-space: nowrap;
          font-family: inherit;
        }
        .day-pill.active {
          background: #1e293b; border-color: #1e293b; color: #fff;
          box-shadow: 0 4px 16px rgba(30,41,59,0.22);
        }
        .day-pill:not(.active):hover { border-color: #94a3b8; }

        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: #fff; border: 1.5px solid #e2e8f0;
          border-radius: 100px; padding: 6px 16px;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: #64748b;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .stat-card {
          border-radius: 20px;
          border-width: 1.5px; border-style: solid;
          padding: 16px 14px;
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.09); }

        .feature-card {
          border-radius: 22px;
          padding: 28px;
          transition: transform 0.18s, box-shadow 0.18s;
          border-width: 1.5px; border-style: solid;
        }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }

        .step-card {
          border-radius: 24px; padding: 32px 28px;
          background: #fff; border: 1.5px solid #f1f5f9;
          box-shadow: 0 2px 16px rgba(0,0,0,0.05);
        }

        .badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px; border-radius: 100px;
          font-size: 12px; font-weight: 600;
        }

        .faq-card {
          background: #fff; border-radius: 20px;
          border: 1.5px solid #f1f5f9; padding: 26px 28px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          transition: box-shadow 0.18s, transform 0.18s;
        }
        .faq-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.08); transform: translateY(-2px); }

        .nav-link-footer { font-size: 13px; color: #94a3b8; text-decoration: none; font-weight: 500; transition: color 0.15s; }
        .nav-link-footer:hover { color: #1e293b; }

        .two-col > *, .three-col > *, .four-col > *,
        .preview-card, .promo-strip, .section-shell, .pricing-card, .cta-shell, .footer-shell {
          min-width: 0;
        }

        @keyframes floatIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .float-in { animation: floatIn 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.12s; }

        @media (max-width: 820px) {
          .two-col { grid-template-columns: 1fr !important; }
          .three-col { grid-template-columns: 1fr !important; }
          .four-col { grid-template-columns: 1fr 1fr !important; }
          .hide-sm { display: none !important; }
          .hero-h1 { font-size: 38px !important; }
          .header-shell { padding: 10px 12px 10px 16px !important; }
          .section-shell, .cta-shell { padding: 36px 24px !important; }
          .preview-card { padding: 18px !important; }
          .preview-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .promo-strip { padding: 24px !important; }
          .promo-strip-cards { width: 100%; flex-wrap: wrap; }
          .promo-strip-cards > * { flex: 1 1 140px; min-width: 0; }
          .pricing-card { padding: 32px 24px !important; }
          .benefit-grid { grid-template-columns: 1fr !important; }
          .footer-shell { justify-content: flex-start !important; }
        }

        @media (max-width: 560px) {
          .four-col { grid-template-columns: 1fr !important; }
          .hero-h1 { font-size: 32px !important; }
          .btn-dark, .btn-soft { width: 100%; justify-content: center; }
          .section-eyebrow { max-width: 100%; }
          .preview-heading { gap: 12px !important; }
          .preview-heading, .preview-next {
            flex-direction: column;
            align-items: flex-start !important;
          }
          .preview-day-row {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            overflow-x: visible !important;
          }
          .day-pill { width: 100%; min-width: 0; padding: 10px 12px; }
          .step-card, .feature-card, .faq-card, .stat-card { padding-left: 20px; padding-right: 20px; }
          .footer-brand { flex-wrap: wrap; }
        }
      `}</style>

      {/* Background blobs */}
      <div className="blob" style={{ width: 500, height: 500, background: "#ffd9b0", top: -100, left: -100 }} />
      <div className="blob" style={{ width: 400, height: 400, background: "#b8d8ff", top: 60, right: -80 }} />
      <div className="blob" style={{ width: 300, height: 300, background: "#c8f5e0", bottom: "40%", left: "20%" }} />

      {/* NAV */}
      <header style={{ position: "sticky", top: 12, zIndex: 100, margin: "12px 16px 0" }}>
        <div className="header-shell" style={{
          maxWidth: 1100, margin: "0 auto",
          background: scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.72)",
          backdropFilter: "blur(20px)",
          borderRadius: 100,
          border: "1.5px solid rgba(255,255,255,0.9)",
          boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.1)" : "0 4px 20px rgba(0,0,0,0.06)",
          padding: "10px 14px 10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "all 0.3s ease",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #f5a623, #e8554e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", letterSpacing: "-0.02em" }}>Northstar</span>
          </div>
          <nav className="pill-nav hide-sm" style={{ display: "flex", gap: 2 }}>
            {[["Product","#product"],["How It Works","#flow"],["Pricing","#pricing"],["FAQ","#faq"]].map(([l,h]) => (
              <a key={h} href={h}>{l}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a href="/start" className="btn-dark" style={{ padding: "9px 20px", fontSize: 14 }}>Get Started →</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 20px 60px", position: "relative", zIndex: 1 }}>
        <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 52, alignItems: "center" }}>

          <div className="float-in d1">
            <div className="section-eyebrow" style={{ marginBottom: 24 }}>
              <span>✦</span> AI Trip Planning, Live
            </div>
            <h1 className="hero-h1" style={{ fontSize: 52, fontWeight: 800, color: "#1e293b", lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 20 }}>
              Plan your trip with AI.<br />
              <span style={{ background: "linear-gradient(110deg, #f5a623 10%, #e8554e 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Keep every detail aligned.
              </span>
            </h1>
            <p style={{ fontSize: 17, color: "#64748b", lineHeight: 1.72, maxWidth: 460, marginBottom: 32, fontWeight: 400 }}>
              Research destinations, build day plans, shape the budget, prep packing, sync reservations, and guide booking decisions inside one clean travel workspace.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 40 }}>
              <a href="/start" className="btn-dark">Start Planning →</a>
              <a href="#product" className="btn-soft">See the product</a>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[["🤖 AI-native","planning + edits"],["🗂️ One view","for the full trip"],["💸 $49","lifetime access"]].map(([v,s]) => (
                <div key={v} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{v}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          {/* App preview card */}
          <div className="float-in d2">
            <div style={{
              background: "rgba(255,255,255,0.6)", backdropFilter: "blur(24px)",
              borderRadius: 32, border: "1.5px solid rgba(255,255,255,0.95)",
              padding: 6,
              boxShadow: "0 24px 80px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset",
            }}>
              <div className="preview-card" style={{ background: "linear-gradient(150deg, #fff8ee 0%, #fdfeff 50%, #f0fbf6 100%)", borderRadius: 28, padding: 24 }}>
                <div className="preview-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 6 }}>WORKSPACE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em" }}>Southwest Road Trip</div>
                    <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>Apr. 8 – Apr. 18 · 11 days</div>
                  </div>
                  <div style={{ background: "linear-gradient(135deg, #f5a623, #e8554e)", borderRadius: 100, padding: "7px 16px", fontSize: 12, fontWeight: 700, color: "#fff", boxShadow: "0 4px 12px rgba(232,85,78,0.35)", whiteSpace: "nowrap" }}>
                    11 days ✦
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: "#fff1f1", color: "#e8554e", border: "1px solid #ffd0d0" }}>⚠️ 1 overdue</span>
                  <span className="badge" style={{ background: "#fff8ec", color: "#f5a623", border: "1px solid #ffe8bc" }}>🔔 3 due soon</span>
                </div>

                <div className="preview-day-row" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 18 }}>
                  {PREVIEW_DAYS.map((d, i) => (
                    <button key={i} className={`day-pill ${activeDay === i ? "active" : ""}`} onClick={() => setActiveDay(i)}>
                      <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>{d.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.6, lineHeight: 1, marginTop: 2 }}>{d.date}</span>
                    </button>
                  ))}
                </div>

                <div className="preview-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {STATS.map((s) => (
                    <div key={s.val} className="stat-card" style={{ background: s.bg, borderColor: s.border }}>
                      <div style={{ fontSize: 16, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em" }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, fontWeight: 500 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{
                  borderRadius: 20, padding: "18px 20px",
                  background: PREVIEW_DAYS[activeDay].color,
                  transition: "background 0.3s ease",
                }}>
                  <div className="preview-next" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>NEXT UP</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{PREVIEW_DAYS[activeDay].title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{PREVIEW_DAYS[activeDay].meta}</div>
                    </div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: PREVIEW_DAYS[activeDay].dot, boxShadow: `0 0 0 4px ${PREVIEW_DAYS[activeDay].dot}30` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="product" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="section-eyebrow" style={{ marginBottom: 16 }}>🗺️ Product</div>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em", lineHeight: 1.1 }}>AI planning inside the trip workspace.</h2>
          <p style={{ fontSize: 16, color: "#64748b", marginTop: 12, maxWidth: 440, margin: "12px auto 0", lineHeight: 1.7 }}>
            No copy-pasting between tabs. No separate planning doc. Just research, edits, budgets, packing, and reservation help in one calm place.
          </p>
        </div>
        <div className="four-col" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card" style={{ background: f.bg, borderColor: f.border }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 8, letterSpacing: "-0.02em" }}>{f.label}</div>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65 }}>{f.body}</p>
            </div>
          ))}
        </div>
        <div className="promo-strip" style={{ marginTop: 14, background: "#1e293b", borderRadius: 24, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, boxShadow: "0 16px 48px rgba(30,41,59,0.22)" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 8 }}>Why it works</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>One workspace. Fewer tabs. Better trips.</div>
          </div>
          <div className="promo-strip-cards" style={{ display: "flex", gap: 10 }}>
            {[["Days","Mapped clearly","#fff8ec"],["Costs","In context","#edf7ff"],["Reminders","When needed","#edfbf3"]].map(([l,t,bg]) => (
              <div key={l} style={{ background: bg, borderRadius: 16, padding: "14px 18px", minWidth: 100 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{l}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="flow" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px", position: "relative", zIndex: 1 }}>
        <div className="section-shell" style={{ background: "linear-gradient(145deg, #eaf4ff 0%, #fdfff5 50%, #fff5ea 100%)", borderRadius: 32, padding: "52px 48px", border: "1.5px solid #e8f0ff" }}>
          <div style={{ marginBottom: 40 }}>
            <div className="section-eyebrow" style={{ marginBottom: 16 }}>⚡ How It Works</div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em", lineHeight: 1.1 }}>From rough idea to finished itinerary.</h2>
          </div>
          <div className="three-col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {STEPS.map((s, i) => (
              <div key={i} className="step-card">
                <div style={{ fontSize: 32, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 16 }}>{s.n}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", marginBottom: 8, letterSpacing: "-0.02em" }}>{s.title}</div>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px", position: "relative", zIndex: 1 }}>
        <div className="two-col" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 14 }}>
          <div className="pricing-card" style={{ background: "linear-gradient(145deg, #fff4de 0%, #ffe8d0 50%, #fffdf9 100%)", borderRadius: 28, padding: "44px 40px", border: "1.5px solid #ffe8bc" }}>
            <div className="section-eyebrow" style={{ marginBottom: 20 }}>💸 Pricing</div>
            <div style={{ fontSize: 60, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.04em", lineHeight: 1 }}>$49</div>
            <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 6, marginBottom: 20, fontWeight: 600 }}>one-time · lifetime access</div>
            <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.72, maxWidth: 320, marginBottom: 28 }}>
              Pay once. Plan every trip, forever. No subscriptions, no renewals, no gotchas.
            </p>
            <a href="/start" className="btn-dark">Get Lifetime Access →</a>
          </div>
          <div className="card pricing-card" style={{ padding: "44px 40px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b", marginBottom: 24 }}>Everything in the core workspace</div>
            <div className="benefit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
              {["AI trip concierge","Day-by-day planner","Budget & packing help","Reservation sync","Notes & reminders","Booking assistance"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: "#f8fafc", borderRadius: 12, fontSize: 13, fontWeight: 500, color: "#475569", border: "1px solid #f1f5f9" }}>
                  <span style={{ color: "#1fb87a", fontSize: 14 }}>✓</span> {item}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.72 }}>
              Built for real travelers. Internal trip edits stay automatic, while external booking actions stay approval-based so the workflow stays clean and safe.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 60px", position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 36 }}>
          <div className="section-eyebrow" style={{ marginBottom: 16 }}>❓ FAQ</div>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#1e293b", letterSpacing: "-0.03em" }}>Straight answers.</h2>
        </div>
        <div className="two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {FAQS.map((f, i) => (
            <div key={i} className="faq-card">
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 10, letterSpacing: "-0.02em" }}>{f.q}</div>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.72 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 80px", position: "relative", zIndex: 1 }}>
        <div className="cta-shell" style={{
          borderRadius: 32, padding: "60px 52px",
          background: "linear-gradient(135deg, #1e293b 0%, #1e4060 45%, #0f3d2e 100%)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 28,
          boxShadow: "0 28px 80px rgba(30,41,59,0.28)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(245,166,35,0.12)", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, left: "30%", width: 180, height: 180, borderRadius: "50%", background: "rgba(31,184,122,0.1)", filter: "blur(50px)", pointerEvents: "none" }} />
          <div style={{ maxWidth: 500, position: "relative" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, marginBottom: 16 }}>Start Planning</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14 }}>
              Build your next trip<br />with an AI concierge.
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}>
              Ask in plain English, let Northstar do the research and edits, then approve the external steps when you are ready.
            </p>
          </div>
          <a href="/start"
            className="btn-soft"
            style={{ fontSize: 15, fontWeight: 800, padding: "16px 32px", boxShadow: "0 8px 28px rgba(0,0,0,0.2)" }}
          >
            Get Started Free →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-shell" style={{ borderTop: "1px solid #e2e8f0", padding: "24px 20px", maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, position: "relative", zIndex: 1 }}>
        <div className="footer-brand" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #f5a623, #e8554e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✦</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Northstar</span>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>— clean travel planning, finally.</span>
        </div>
        <nav style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[["Product","#product"],["How It Works","#flow"],["Pricing","#pricing"],["FAQ","#faq"],["Privacy","/privacy"],["Terms","/terms"]].map(([l,h]) => (
            <a key={h} href={h} className="nav-link-footer">{l}</a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
