import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ════════════════════════════════════════════════════════════════
   HI CO — Where Travelers Become Neighbors
   Interactive Prototype · Transformed from LUME for hihostels.ca
   ════════════════════════════════════════════════════════════════ */

// ─── DESIGN TOKENS ──────────────────────────────────────────
const H = {
  // Base palette — "Mountain Lodge"
  deep:    "#121a21",     // night sky through lodge windows
  timber:  "#1a2530",     // dark warm surface
  ridge:   "#243040",     // elevated surface
  stone:   "#7a8e9e",     // secondary text, like river stones
  cream:   "#e8e0d6",     // warm primary text
  white:   "#f5f0ea",     // bright text
  // Accent palette
  trail:   "#2ea872",     // forest green — primary action
  trailDk: "#1e8a5a",     // darker trail for contrast
  ember:   "#e07a4f",     // campfire warm — community
  emberLt: "#f0a878",     // lighter ember
  sky:     "#5ba0d4",     // alpine blue — info
  gold:    "#d4a83a",     // warm gold — highlights
  coral:   "#cc3d3d",     // HI brand red nod — urgency
  // Derived
  gradTrail: "linear-gradient(135deg, #2ea872, #3dbf8a)",
  gradEmber: "linear-gradient(135deg, #e07a4f, #f0a878)",
  gradSky:   "linear-gradient(135deg, #5ba0d4, #7ab8e8)",
  gradGold:  "linear-gradient(135deg, #d4a83a, #e8c45e)",
  gradHero:  "linear-gradient(135deg, #2ea872, #5ba0d4, #e07a4f)",
  cardBg:    "linear-gradient(135deg, rgba(26,37,48,0.85), rgba(18,26,33,0.95))",
  glass:     "rgba(26,37,48,0.4)",
  border:    "rgba(122,142,158,0.15)",
  borderHi:  "rgba(122,142,158,0.28)",
  inputBg:   "rgba(26,37,48,0.5)",
};

// ─── CONTENT CATEGORIES ─────────────────────────────────────
const CATEGORIES = {
  "Adventure":  { color: H.trail,  emoji: "⛰️" },
  "Social":     { color: H.ember,  emoji: "🎯" },
  "Wellness":   { color: H.sky,    emoji: "🧘" },
  "Culture":    { color: H.gold,   emoji: "🎭" },
  "Outdoor":    { color: "#5ba070", emoji: "🌲" },
};

const EXPLORE_CATS = {
  "Trails":     { color: H.trail,  emoji: "🥾" },
  "Food":       { color: H.ember,  emoji: "🍜" },
  "Drinks":     { color: H.gold,   emoji: "🍺" },
  "Culture":    { color: H.sky,    emoji: "🏛️" },
  "Adventure":  { color: H.coral,  emoji: "🪂" },
};

const SIGNAL_TYPES = [
  { value: "coffee",  label: "Coffee",    emoji: "☕", grad: H.gradEmber },
  { value: "hike",    label: "Hike",      emoji: "🥾", grad: H.gradTrail },
  { value: "food",    label: "Food",      emoji: "🍽️", grad: H.gradGold },
  { value: "explore", label: "Explore",   emoji: "🗺️", grad: H.gradSky },
  { value: "hang",    label: "Hang Out",  emoji: "🎶", grad: H.gradEmber },
];

// ─── MOCK DATA (sourced from HI Whistler boards) ────────────

// What's On — Weekly hostel activities
const ACTIVITIES = [
  { id: "a1", title: "Volleyball Tournament", day: "Mon", time: "3:00 PM", category: "Social", location: "Beach Court", desc: "All-comers volleyball. Teams formed on the spot — show up and play. Signup at front desk.", host: "HI Staff", spots: 24, taken: 16, recurring: true },
  { id: "a2", title: "Pool Tournament", day: "Tue", time: "7:00 PM", category: "Social", location: "Common Room", desc: "Bracket-style pool tournament in the common room. Winner gets bragging rights and a free drink.", host: "HI Staff", spots: 16, taken: 12, recurring: true },
  { id: "a3", title: "Axe Throwing", day: "Wed", time: "2:00 PM", category: "Adventure", location: "Forged Axe Throwing", desc: "Group outing to Forged. Turn out — you'll learn something new and it's surprisingly meditative.", host: "HI Staff", spots: 12, taken: 8, recurring: true },
  { id: "a4", title: "Pub Crawl", day: "Thu", time: "8:00 PM", category: "Social", location: "Meet at Lobby", desc: "We know where we're going. You'll be inspired and maybe slightly lost. Trust the process.", host: "HI Staff", spots: 20, taken: 18, recurring: true },
  { id: "a5", title: "Trivia Night!", day: "Fri", time: "8:00 PM", category: "Social", location: "Common Room", desc: "Happy Hour and trivia at Cheekye's. If you're inspired and want to show off, you'll learn something.", host: "HI Staff", spots: 30, taken: 22, recurring: true },
  { id: "a6", title: "Train Wreck Hike", day: "Sat", time: "10:00 AM", category: "Adventure", location: "Meet at Lobby", desc: "Forest trails, a suspension bridge, and old train cars covered in graffiti art. Easy 1-hour return hike. All levels welcome.", host: "HI Staff", spots: 15, taken: 9, recurring: true },
  { id: "a7", title: "Morning Yoga", day: "Sun", time: "8:30 AM", category: "Wellness", location: "Deck", desc: "Gentle morning flow on the deck overlooking the lake. Mats provided, no experience needed.", host: "Guest Leader", spots: 12, taken: 5, recurring: true },
  { id: "a8", title: "Lakeside Summer Concert", day: "Sun", time: "3:30 PM", category: "Culture", location: "The Point Artist Centre", desc: "Live music at The Point on Alta Lake. $10 tickets, kids free. Creative Café open from noon.", host: "The Point Artists", spots: null, taken: null, recurring: false },
  { id: "a9", title: "Cheakamus River Hike", day: "Wed", time: "9:00 AM", category: "Adventure", location: "Meet at Lobby", desc: "Suspension bridge loop — 3 km, easy, about 2 hours. Follow the sign past the highway bridge to the trailhead.", host: "HI Staff", spots: 10, taken: 6, recurring: false },
  { id: "a10", title: "Garibaldi Lake Day Trip", day: "Sat", time: "7:30 AM", category: "Adventure", location: "Meet at Lobby", desc: "9 km one-way, moderate–hard. Stunning turquoise alpine lake. Pack lunch, water, layers. Early start essential.", host: "HI Staff", spots: 8, taken: 7, recurring: false },
];

// Explore — Local knowledge from the boards
const PLACES = [
  // Trails
  { id: "t1", name: "Train Wreck Trail", category: "Trails", rating: 4.7, difficulty: "Easy", distance: "1 km", time: "30 min", desc: "Forest trail to abandoned train cars covered in street art. Suspension bridge crossing. Whistler's most Instagrammed hike.", staffPick: true },
  { id: "t2", name: "Cheakamus River Suspension Bridge", category: "Trails", rating: 4.5, difficulty: "Easy", distance: "3 km loop", time: "2 hrs", desc: "Follow the signs past the highway bridge. Beautiful river views and a swaying suspension bridge.", staffPick: false },
  { id: "t3", name: "Crater Rim Trail", category: "Trails", rating: 4.3, difficulty: "Easy–Moderate", distance: "6 km roundtrip", time: "3 hrs", desc: "Views of the volcanic crater. Check for off-road vehicle traffic.", staffPick: false },
  { id: "t4", name: "Garibaldi Lake Trail", category: "Trails", rating: 4.9, difficulty: "Moderate", distance: "18 km return", time: "6–7 hrs", desc: "Turquoise alpine lake. One of BC's most stunning day hikes. Take the Rubble Creek parking lot off Highway 99.", staffPick: true },
  { id: "t5", name: "Rainbow Trail", category: "Trails", rating: 4.4, difficulty: "Moderate", distance: "10 km roundtrip", time: "4 hrs", desc: "Alpine meadows and mountain views. Trailhead is a short 10-minute drive.", staffPick: false },
  { id: "t6", name: "Brandywine Falls", category: "Trails", rating: 4.6, difficulty: "Easy", distance: "1 km", time: "30 min", desc: "Short walk to a 70-metre waterfall. Drive to Highway 99 and make a left. Quick and spectacular.", staffPick: true },
  { id: "t7", name: "Singing Pass", category: "Trails", rating: 4.8, difficulty: "Hard", distance: "26 km return", time: "8–10 hrs", desc: "Alpine ridge walking at its finest. Bring layers, water, and start early.", staffPick: false },
  // Food
  { id: "f1", name: "El Furniture Warehouse (Fernie's)", category: "Food", rating: 4.5, priceRange: "$", desc: "The go-to budget eat. Everything on the menu is $5.95. Burgers, nachos, wraps — hostel-traveler approved.", staffPick: true },
  { id: "f2", name: "Chubby Dudes Donairs, Kebabs, Poutine", category: "Food", rating: 4.3, priceRange: "$", desc: "Late-night donairs and loaded poutine. The name delivers on its promise.", staffPick: false },
  { id: "f3", name: "Samurai Bowl", category: "Food", rating: 4.4, priceRange: "$$", desc: "Japanese comfort food. Great variety — fried chicken, poke bowls, ramen.", staffPick: false },
  { id: "f4", name: "Functional Pie Pizzeria", category: "Food", rating: 4.6, priceRange: "$$", desc: "Wood-fired pizza done right. The margherita is the move.", staffPick: true },
  { id: "f5", name: "Purebread", category: "Food", rating: 4.8, priceRange: "$$", desc: "Just a 10-min walk from the hostel. Legendary pastries, soups, sandwiches. Everything is baked fresh. Open Wed–Sat 12–6pm.", staffPick: true },
  { id: "f6", name: "Harajuku Izakaya", category: "Food", rating: 4.5, priceRange: "$$", desc: "Japanese izakaya with great small plates and drinks. Cozy atmosphere.", staffPick: false },
  { id: "f7", name: "Southside Diner", category: "Food", rating: 4.2, priceRange: "$", desc: "Comfort food in a 50s-style diner. Huge breakfasts, burgers, milkshakes, chicken pot pie.", staffPick: false },
  // Drinks
  { id: "d1", name: "Tapley's Neighbourhood Pub", category: "Drinks", rating: 4.4, priceRange: "$$", desc: "The #1 apres spot. Good food, friendly staff, local vibe.", staffPick: true },
  { id: "d2", name: "Crystal Lounge", category: "Drinks", rating: 4.2, priceRange: "$$", desc: "Upscale-ish cocktails in a mountain setting. Good for a special evening.", staffPick: false },
  { id: "d3", name: "Dubh Linn Gate Pub", category: "Drinks", rating: 4.5, priceRange: "$$", desc: "Irish pub with the best nachos in the village. Live music some nights.", staffPick: true },
  { id: "d4", name: "Merlin's Pub", category: "Drinks", rating: 4.1, priceRange: "$$", desc: "Base-of-mountain pub. Classic post-ski/ride spot.", staffPick: false },
  // Culture
  { id: "c1", name: "Squamish Lil'wat Cultural Centre", category: "Culture", rating: 4.8, priceRange: "$$", desc: "Learn about the Whistler area's First Nations through art, exhibits, and guided tours. Beautiful building designed to honor both cultures.", staffPick: true },
  { id: "c2", name: "Audain Art Museum", category: "Culture", rating: 4.6, priceRange: "$$", desc: "Permanent collection of nearly 200 works spanning the 18th century to present, including works of Northwest Coast First Nations artists.", staffPick: false },
  { id: "c3", name: "Whistler Museum", category: "Culture", rating: 4.3, priceRange: "Free", desc: "Come explore Whistler's unique history. Entry by donation. Located next to the Library.", staffPick: false },
  // Adventure
  { id: "v1", name: "Whistler Bungee", category: "Adventure", rating: 4.7, priceRange: "$$$", desc: "160-foot bungee jump over the Cheakamus River. Open year-round. 604.938.9333.", staffPick: false },
  { id: "v2", name: "Canadian Outback Rafting", category: "Adventure", rating: 4.6, priceRange: "$$", desc: "Whitewater or gentle scenic — different rafting classes and trips. Save $20 with HI membership.", staffPick: true },
  { id: "v3", name: "Whistler Mountain Bike Park", category: "Adventure", rating: 4.9, priceRange: "$$$", desc: "The ultimate gravity-fed downhill biking experience. 70+ trails from green to double-black. Open daily 10am–8pm.", staffPick: true },
];

// Common Room — Traveler-organized gatherings
const GATHERINGS = [
  { id: "g1", title: "Group Dinner — Thai Curry Night", host: "Clara M.", capacity: 8, attending: 5, time: "Tonight · 7:00 PM", location: "Hostel Kitchen", desc: "I'm cooking Thai green curry for anyone who wants in. $5 each for ingredients. Bring your own drink.", tags: ["food", "social"] },
  { id: "g2", title: "Sunrise Photography Walk", host: "Kenji T.", capacity: 6, attending: 2, time: "Tomorrow · 5:30 AM", location: "Meet at Lobby", desc: "Golden hour at Alta Lake. Any camera works — phone is fine. I'll share some composition tips if you want.", tags: ["outdoor", "creative"] },
  { id: "g3", title: "Spanish Practice Circle", host: "Sofía R.", capacity: 10, attending: 7, time: "Tomorrow · 4:00 PM", location: "Common Room", desc: "All levels welcome. We chat, we laugh, we learn. Native speaker here to help.", tags: ["culture", "language"] },
  { id: "g4", title: "Board Game Night", host: "Jake & Emma", capacity: 12, attending: 10, time: "Tonight · 8:30 PM", location: "Common Room", desc: "Catan, Codenames, Ticket to Ride. We've got the games — you bring the competitive spirit.", tags: ["social", "games"] },
  { id: "g5", title: "Rainbow Lake Trail Group", host: "Maya L.", capacity: 6, attending: 4, time: "Saturday · 8:00 AM", location: "Meet at Lobby", desc: "4-hour moderate hike. I've done it twice — I know the route. Bring water and snacks.", tags: ["hiking", "nature"] },
  { id: "g6", title: "Guitar Jam Session", host: "Tomás H.", capacity: 8, attending: 3, time: "Friday · 9:00 PM", location: "Deck", desc: "Casual jam on the deck. I've got one guitar — bring yours if you have one. All skill levels.", tags: ["music", "social"] },
];

// Connect — Active signals
const SIGNALS_DATA = [
  { id: "s1", type: "coffee",  user: "Lisa K.", message: "Just made a French press — come grab a cup in the kitchen before it's gone", minutesLeft: 38, dorm: "Dorm 3" },
  { id: "s2", type: "hike",    user: "Marco P.", message: "Heading to Train Wreck in 30 min. Easy walk, good for photos. Anyone in?", minutesLeft: 22, dorm: "Dorm 1" },
  { id: "s3", type: "food",    user: "Yuki S.", message: "Walking to Fernie's for the $5.95 menu. Solo traveler looking for company", minutesLeft: 45, dorm: "Dorm 4" },
  { id: "s4", type: "explore", user: "Anja B.", message: "Rented a car for the day — driving to Garibaldi trailhead. One seat free", minutesLeft: 15, dorm: "Dorm 2" },
  { id: "s5", type: "hang",    user: "Dev M.", message: "On the deck with a book and a beer. Come say hi if you're around", minutesLeft: 52, dorm: "Common Room" },
];

// ─── UTILITIES ──────────────────────────────────────────────
const capColor = r => r < 0.6 ? H.trail : r < 0.85 ? H.gold : H.ember;
const fmtMin = m => { const mins = Math.floor(m); const secs = Math.floor((m - mins) * 60); return `${mins}:${secs.toString().padStart(2, "0")}`; };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 6)  return { label: "Night owl hours", emoji: "🌌" };
  if (h < 9)  return { label: "Early riser", emoji: "🌅" };
  if (h < 12) return { label: "Morning", emoji: "☀️" };
  if (h < 17) return { label: "Afternoon", emoji: "⛰️" };
  if (h < 20) return { label: "Golden hour", emoji: "🌇" };
  return { label: "Evening", emoji: "🌙" };
}

// ─── ICONS (SVG) ────────────────────────────────────────────
const I = {
  cal:   (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  compass:(c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  users: (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  zap:   (c) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  star:  (f) => <svg width="16" height="16" viewBox="0 0 24 24" fill={f ? H.gold : "none"} stroke={f ? H.gold : H.stone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  badge: <svg width="14" height="14" viewBox="0 0 24 24" fill={H.trail} stroke="none"><path d="M12 2L9 9H2l5.5 4.5L5 22l7-4.5L19 22l-2.5-8.5L22 9h-7L12 2z"/></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={H.stone} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pin:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={H.stone} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  search:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={H.stone} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  send:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  x:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  mountain:(c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3l4 8 5-5 5 15H2L8 3z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={H.trail} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

// ─── GLOBAL CSS ─────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(122,142,158,0.2); border-radius: 4px; }
  input, textarea, select { font-family: inherit; }
  @keyframes fadeInUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse2 { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  @keyframes breathe { 0%,100% { transform:scale(1); opacity:0.15; } 50% { transform:scale(1.15); opacity:0.25; } }
`;

// ─── SHARED COMPONENTS ──────────────────────────────────────
function Pill({ active, color, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 16px", borderRadius: 20, whiteSpace: "nowrap", cursor: "pointer",
      fontFamily: "inherit", fontSize: 12, fontWeight: 500, transition: "all 0.25s",
      border: `1px solid ${active ? color : H.border}`,
      background: active ? `${color}20` : "transparent",
      color: active ? color : H.stone,
    }}>{children}</button>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, background: H.inputBg,
      border: `1px solid ${H.border}`, borderRadius: 14, padding: "11px 16px",
      backdropFilter: "blur(12px)",
    }}>
      {I.search}
      <input placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={{ background: "none", border: "none", outline: "none", color: H.white, fontSize: 14, flex: 1, fontFamily: "inherit" }}
      />
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: H.cardBg, borderRadius: 18, backdropFilter: "blur(12px)",
      border: `1px solid ${H.border}`, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}

function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: `translateX(-50%) translateY(${visible ? 0 : 16}px)`,
      background: `rgba(46,168,114,0.14)`, border: `1px solid ${H.trail}`, borderRadius: 14,
      padding: "11px 22px", color: H.trail, fontSize: 13, fontWeight: 600,
      opacity: visible ? 1 : 0, transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
      pointerEvents: "none", backdropFilter: "blur(16px)", zIndex: 200,
      boxShadow: `0 0 40px rgba(46,168,114,0.1)`, whiteSpace: "nowrap",
      letterSpacing: "0.01em",
    }}>
      ▲ {message}
    </div>
  );
}

// ─── AMBIENT PARTICLES (mountain motes) ─────────────────────
function Particles() {
  const [dots] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, size: 1.5 + Math.random() * 2.5, left: Math.random() * 100,
      dur: 20 + Math.random() * 15, delay: Math.random() * -25,
      color: [H.trail, H.gold, H.ember, H.sky][Math.floor(Math.random() * 4)],
      opacity: 0.12 + Math.random() * 0.18,
    }))
  );
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {dots.map(d => (
        <div key={d.id} style={{
          position: "absolute", bottom: -10, left: `${d.left}%`,
          width: d.size, height: d.size, borderRadius: "50%",
          background: d.color, opacity: d.opacity,
          animation: `floatUp ${d.dur}s linear ${d.delay}s infinite`,
        }}/>
      ))}
      <style>{`@keyframes floatUp { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-105vh) translateX(${Math.random() > 0.5 ? '' : '-'}${30+Math.random()*40}px); opacity: 0; } }`}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// WHAT'S ON — Weekly activities
// ═════════════════════════════════════════════════════════════
function WhatsOnView({ toast }) {
  const [dayFilter, setDayFilter] = useState(() => DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [catFilter, setCatFilter] = useState("All");
  const [joined, setJoined] = useState(new Set());

  const filtered = ACTIVITIES.filter(a => {
    if (a.day !== dayFilter) return false;
    if (catFilter !== "All" && a.category !== catFilter) return false;
    return true;
  });

  const toggleJoin = id => {
    setJoined(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); toast("You're in — see you there"); }
      return n;
    });
  };

  return (
    <div style={{ padding: "0 16px 110px" }}>
      {/* Day selector — horizontally scrollable */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 12, marginTop: 4 }}>
        {DAYS.map(d => {
          const active = dayFilter === d;
          const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] === d;
          return (
            <button key={d} onClick={() => setDayFilter(d)} style={{
              minWidth: 46, padding: "10px 8px", borderRadius: 12, cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: 700, textAlign: "center",
              border: `1.5px solid ${active ? H.trail : today ? H.borderHi : H.border}`,
              background: active ? `${H.trail}18` : "transparent",
              color: active ? H.trail : today ? H.cream : H.stone,
              transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>{d}</span>
              {today && <span style={{ width: 4, height: 4, borderRadius: "50%", background: active ? H.trail : H.ember }}/>}
            </button>
          );
        })}
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 }}>
        <Pill active={catFilter === "All"} color={H.cream} onClick={() => setCatFilter("All")}>All</Pill>
        {Object.entries(CATEGORIES).map(([name, { color, emoji }]) => (
          <Pill key={name} active={catFilter === name} color={color} onClick={() => setCatFilter(name)}>
            <span style={{ marginRight: 4 }}>{emoji}</span>{name}
          </Pill>
        ))}
      </div>

      {/* Activity cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(a => {
          const mine = joined.has(a.id);
          const count = a.taken + (mine ? 1 : 0);
          const hasCap = a.spots !== null;
          const ratio = hasCap ? count / a.spots : 0;
          const full = hasCap && count >= a.spots;
          const cat = CATEGORIES[a.category];
          return (
            <Card key={a.id} style={{ padding: "16px 18px", borderLeft: `3px solid ${cat?.color || H.trail}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: H.white, lineHeight: 1.35 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: H.stone, marginTop: 2 }}>{a.host}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: `${cat?.color || H.trail}18`, color: cat?.color || H.trail, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
                  {a.category}
                </span>
              </div>

              <p style={{ fontSize: 13, color: H.cream, opacity: 0.8, lineHeight: 1.55, margin: "8px 0 10px" }}>{a.desc}</p>

              <div style={{ display: "flex", gap: 14, marginBottom: hasCap ? 10 : 12, fontSize: 11, color: H.stone }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.clock} {a.time}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.pin} {a.location}</span>
              </div>

              {hasCap && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: H.stone }}>{count} / {a.spots} spots</span>
                    {full && <span style={{ fontSize: 10, color: H.ember, fontWeight: 700 }}>FULL</span>}
                  </div>
                  <div style={{ height: 4, borderRadius: 3, background: "rgba(26,37,48,0.6)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(ratio * 100, 100)}%`, background: capColor(ratio), transition: "all 0.4s ease" }}/>
                  </div>
                </div>
              )}

              <button onClick={() => !full && toggleJoin(a.id)} disabled={full && !mine} style={{
                width: "100%", padding: "10px 0", borderRadius: 12, cursor: (full && !mine) ? "default" : "pointer",
                fontFamily: "inherit", fontWeight: 600, fontSize: 13, transition: "all 0.25s",
                background: mine ? `${H.trail}15` : full ? H.glass : H.gradTrail,
                color: mine ? H.trail : full ? H.stone : H.white,
                border: mine ? `1px solid ${H.trail}` : "1px solid transparent",
                opacity: (full && !mine) ? 0.45 : 1,
                boxShadow: (!mine && !full) ? `0 4px 18px rgba(46,168,114,0.15)` : "none",
              }}>
                {mine ? "Going ✓" : full ? "Full" : "I'm In"}
              </button>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: H.stone }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏔️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: H.white, marginBottom: 4 }}>Nothing scheduled</div>
            <div style={{ fontSize: 13 }}>Check another day or explore nearby trails</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// EXPLORE — Local knowledge
// ═════════════════════════════════════════════════════════════
function ExploreView({ toast }) {
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [saved, setSaved] = useState(new Set());

  const filtered = PLACES.filter(p => {
    if (catFilter !== "All" && p.category !== catFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSave = id => {
    setSaved(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); toast("Removed from your trail map"); }
      else { n.add(id); toast("Saved to your trail map"); }
      return n;
    });
  };

  return (
    <div style={{ padding: "0 16px 110px" }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Search trails, food, drinks…" />

      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 0 14px" }}>
        <Pill active={catFilter === "All"} color={H.cream} onClick={() => setCatFilter("All")}>All</Pill>
        {Object.entries(EXPLORE_CATS).map(([name, { color, emoji }]) => (
          <Pill key={name} active={catFilter === name} color={color} onClick={() => setCatFilter(name)}>
            <span style={{ marginRight: 4 }}>{emoji}</span>{name}
          </Pill>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(p => {
          const cat = EXPLORE_CATS[p.category];
          const isExpanded = expanded === p.id;
          return (
            <Card key={p.id} style={{ padding: "16px 18px" }} onClick={() => setExpanded(isExpanded ? null : p.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: H.white }}>{p.name}</span>
                    {p.staffPick && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: `${H.trail}18`, color: H.trail, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {I.badge} STAFF PICK
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: H.stone }}>
                    {p.category}
                    {p.difficulty && <> · {p.difficulty}</>}
                    {p.priceRange && <> · {p.priceRange}</>}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleSave(p.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                  {I.star(saved.has(p.id))}
                </button>
              </div>

              <p style={{ fontSize: 13, color: H.cream, opacity: 0.8, lineHeight: 1.55, margin: "6px 0 8px" }}>{p.desc}</p>

              {isExpanded && (
                <div style={{ animation: "fadeInUp 0.25s ease", paddingTop: 8, borderTop: `1px solid ${H.border}`, marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: H.stone }}>
                    {p.distance && <span style={{ display: "flex", alignItems: "center", gap: 4 }}>📏 {p.distance}</span>}
                    {p.time && <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.clock} {p.time}</span>}
                    {p.rating && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: H.gold }}>★</span> {p.rating}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 8, background: `${cat?.color || H.trail}15`, color: cat?.color || H.trail, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {cat?.emoji} {p.category}
                </span>
                {p.rating && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 8, background: `${H.gold}15`, color: H.gold }}>
                    ★ {p.rating}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// COMMON ROOM — Traveler gatherings
// ═════════════════════════════════════════════════════════════
function CommonRoomView({ toast }) {
  const [joined, setJoined] = useState(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", desc: "", location: "", capacity: "" });

  const toggle = g => {
    setJoined(prev => {
      const n = new Set(prev);
      if (n.has(g.id)) { n.delete(g.id); } else { n.add(g.id); toast("You're in — see you there"); }
      return n;
    });
  };

  const [gatherings, setGatherings] = useState(GATHERINGS);

  const handleCreate = () => {
    if (!form.title || !form.location) return;
    const g = { id: `g${Date.now()}`, title: form.title, host: "You", capacity: form.capacity ? parseInt(form.capacity) : 10, attending: 0, time: "Today", location: form.location, desc: form.desc, tags: [] };
    setGatherings([g, ...gatherings]);
    setForm({ title: "", desc: "", location: "", capacity: "" });
    setShowCreate(false);
    toast("Gathering posted to the board");
  };

  return (
    <div style={{ padding: "0 16px 110px" }}>
      {/* Create button */}
      <button onClick={() => setShowCreate(true)} style={{
        width: "100%", padding: "12px 0", borderRadius: 14, cursor: "pointer",
        fontFamily: "inherit", fontWeight: 600, fontSize: 14, marginBottom: 14, marginTop: 6,
        background: "transparent", color: H.ember, border: `1.5px dashed ${H.ember}60`,
        transition: "all 0.25s",
      }}>+ Post a Gathering</button>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {gatherings.map(g => {
          const mine = joined.has(g.id);
          const count = g.attending + (mine ? 1 : 0);
          const ratio = count / g.capacity;
          const full = count >= g.capacity;
          return (
            <Card key={g.id} style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: H.white, marginBottom: 3, lineHeight: 1.35 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: H.stone, marginBottom: 10 }}>Organized by {g.host}</div>
              <p style={{ fontSize: 13, color: H.cream, opacity: 0.8, lineHeight: 1.5, marginBottom: 12 }}>{g.desc}</p>

              <div style={{ display: "flex", gap: 14, marginBottom: 12, fontSize: 11, color: H.stone }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.clock} {g.time}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{I.pin} {g.location}</span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: H.stone }}>{count} / {g.capacity} going</span>
                  {full && <span style={{ fontSize: 10, color: H.ember, fontWeight: 700 }}>FULL</span>}
                </div>
                <div style={{ height: 4, borderRadius: 3, background: "rgba(26,37,48,0.5)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, width: `${Math.min(ratio * 100, 100)}%`, background: capColor(ratio), transition: "all 0.4s ease" }}/>
                </div>
              </div>

              {g.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {g.tags.map(t => (
                    <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: H.glass, color: H.stone, border: `1px solid ${H.border}` }}>{t}</span>
                  ))}
                </div>
              )}

              <button onClick={() => !full && toggle(g)} disabled={full && !mine} style={{
                width: "100%", padding: "10px 0", borderRadius: 12, cursor: (full && !mine) ? "default" : "pointer",
                fontFamily: "inherit", fontWeight: 600, fontSize: 13, transition: "all 0.25s",
                background: mine ? `${H.trail}15` : full ? H.glass : H.gradTrail,
                color: mine ? H.trail : full ? H.stone : H.white,
                border: mine ? `1px solid ${H.trail}` : "1px solid transparent",
                opacity: (full && !mine) ? 0.45 : 1,
              }}>
                {mine ? "Going ✓" : full ? "Full" : "Count Me In"}
              </button>
            </Card>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowCreate(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: `linear-gradient(180deg, #1e3040, ${H.deep})`, borderRadius: "24px 24px 0 0", padding: "24px 20px 34px", border: `1px solid ${H.border}`, borderBottom: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: H.white }}>Post a Gathering</span>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: H.stone }}>{I.x}</button>
            </div>
            <p style={{ fontSize: 13, color: H.cream, opacity: 0.8, marginBottom: 18, lineHeight: 1.5 }}>
              Organize something for fellow travelers. Cooking dinner? Going on a hike? Looking for board game partners? Post it here.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input placeholder="What's happening?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                style={{ width: "100%", background: H.inputBg, border: `1px solid ${H.border}`, borderRadius: 12, padding: "12px 16px", color: H.white, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <input placeholder="Where?" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                style={{ width: "100%", background: H.inputBg, border: `1px solid ${H.border}`, borderRadius: 12, padding: "12px 16px", color: H.white, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <textarea placeholder="Tell people what to expect…" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} rows={2}
                style={{ width: "100%", background: H.inputBg, border: `1px solid ${H.border}`, borderRadius: 12, padding: "12px 16px", color: H.white, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "none", boxSizing: "border-box" }} />
              <input placeholder="Max people (optional)" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })}
                style={{ width: "100%", background: H.inputBg, border: `1px solid ${H.border}`, borderRadius: 12, padding: "12px 16px", color: H.white, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              <button onClick={handleCreate} style={{
                width: "100%", marginTop: 6, padding: "14px 0", borderRadius: 14, border: "none",
                fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer",
                background: H.gradTrail, color: H.white,
                boxShadow: `0 4px 20px rgba(46,168,114,0.2)`,
              }}>Post Gathering</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CONNECT — Traveler signals (ambient serendipity)
// ═════════════════════════════════════════════════════════════
function ConnectView({ toast }) {
  const [signals, setSignals] = useState(SIGNALS_DATA);
  const [view, setView] = useState("feed");
  const [showCreate, setShowCreate] = useState(false);
  const [responded, setResponded] = useState(new Set());

  useEffect(() => {
    const iv = setInterval(() => {
      setSignals(prev => prev.map(s => ({ ...s, minutesLeft: Math.max(0, s.minutesLeft - 1/60) })).filter(s => s.minutesLeft > 0));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const respond = id => {
    setResponded(prev => new Set(prev).add(id));
    toast("Heading over — they'll know you're coming");
  };

  return (
    <div style={{ padding: "0 16px 110px", position: "relative" }}>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 6, margin: "8px 0 16px" }}>
        {[{id: "feed", label: "Feed"}, {id: "radar", label: "Nearby"}].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontFamily: "inherit",
            border: `1px solid ${view === v.id ? H.trail : H.border}`,
            background: view === v.id ? `${H.trail}15` : "transparent",
            color: view === v.id ? H.trail : H.stone, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>{v.label}</button>
        ))}
      </div>

      {view === "radar" ? (
        <RadarView signals={signals} />
      ) : (
        <>
          {/* Signal type legend */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 }}>
            {SIGNAL_TYPES.map(st => (
              <div key={st.value} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 20,
                background: H.glass, border: `1px solid ${H.border}`, whiteSpace: "nowrap",
                fontSize: 12, color: H.white, fontWeight: 500,
              }}>
                <span style={{ fontSize: 14 }}>{st.emoji}</span> {st.label}
              </div>
            ))}
          </div>

          {/* Signal cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signals.map(s => {
              const type = SIGNAL_TYPES.find(t => t.value === s.type);
              const urgent = s.minutesLeft < 15;
              const bridged = responded.has(s.id);
              return (
                <Card key={s.id} style={{ padding: "16px 18px", borderColor: urgent ? `${H.ember}35` : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 14, background: type.grad, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{type.emoji}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: H.white }}>{s.user}</div>
                        <div style={{ fontSize: 11, color: H.stone }}>{s.dorm}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: urgent ? H.ember : H.trail, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: urgent ? H.ember : H.trail, animation: urgent ? "pulse2 1.2s infinite" : "none" }}/>
                      {fmtMin(s.minutesLeft)}
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: H.cream, lineHeight: 1.55, margin: "8px 0 12px", opacity: 0.85 }}>"{s.message}"</p>
                  <button onClick={() => !bridged && respond(s.id)} style={{
                    width: "100%", padding: "9px 0", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: bridged ? `${H.trail}12` : H.glass, border: `1px solid ${bridged ? H.trail : H.border}`,
                    color: bridged ? H.trail : H.cream, transition: "all 0.2s",
                  }}>
                    {bridged ? "▲ On My Way" : "Join Them"}
                  </button>
                </Card>
              );
            })}
            {signals.length === 0 && (
              <div style={{ textAlign: "center", padding: 50, color: H.stone }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⛺</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: H.white, marginBottom: 4 }}>All quiet</div>
                <div style={{ fontSize: 13 }}>Be the first to send a signal</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* FAB */}
      <button onClick={() => setShowCreate(true)} style={{
        position: "fixed", bottom: 88, right: 20, width: 56, height: 56, borderRadius: 16,
        background: H.gradEmber, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 24px rgba(224,122,79,0.25)`, color: H.white, zIndex: 50,
      }}>
        {I.zap(H.white)}
      </button>

      {showCreate && <CreateSignalSheet onClose={() => setShowCreate(false)} onSend={sig => {
        setSignals(prev => [sig, ...prev]); setShowCreate(false); toast("Your signal is live — 60 minutes");
      }}/>}
    </div>
  );
}

// ─── RADAR VIEW ─────────────────────────────────────────────
function RadarView({ signals }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr; ctx.scale(dpr, dpr);
    const cx = w / 2, cy = h / 2, maxR = Math.min(w, h) / 2 - 24;
    ctx.clearRect(0, 0, w, h);

    // Rings
    [0.25, 0.5, 0.75, 1.0].forEach((r, i) => {
      ctx.beginPath(); ctx.arc(cx, cy, maxR * r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(46,168,114,${0.06 + i * 0.03})`; ctx.lineWidth = 1; ctx.stroke();
    });

    // Center
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 22);
    glow.addColorStop(0, "rgba(46,168,114,0.4)"); glow.addColorStop(1, "rgba(46,168,114,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = H.trail; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = H.stone; ctx.font = "bold 10px 'DM Sans',system-ui"; ctx.textAlign = "center"; ctx.fillText("YOU", cx, cy + 22);

    const tCol = { coffee: H.ember, hike: H.trail, food: H.gold, explore: H.sky, hang: "#b07ac8" };
    signals.forEach((s, i) => {
      const a = (i / signals.length) * Math.PI * 2 - Math.PI / 2 + i * 0.4;
      const d = (0.15 + Math.random() * 0.7) * maxR;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const col = tCol[s.type] || H.trail;
      const dg = ctx.createRadialGradient(x, y, 0, x, y, 16);
      dg.addColorStop(0, col + "55"); dg.addColorStop(1, col + "00");
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = H.white; ctx.font = "11px 'DM Sans',system-ui"; ctx.textAlign = "center";
      ctx.fillText(s.user.split(" ")[0], x, y - 14);
      const st = SIGNAL_TYPES.find(t => t.value === s.type);
      if (st) { ctx.font = "13px system-ui"; ctx.fillText(st.emoji, x, y + 22); }
    });
  }, [signals]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <canvas ref={ref} style={{ width: "100%", maxWidth: 380, height: 380, borderRadius: 20, background: "rgba(18,26,33,0.5)", border: `1px solid ${H.border}` }}/>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 16 }}>
        {SIGNAL_TYPES.map(st => (
          <div key={st.value} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: H.stone }}>
            <span>{st.emoji}</span> {st.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CREATE SIGNAL SHEET ────────────────────────────────────
function CreateSignalSheet({ onClose, onSend }) {
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState("");
  const send = () => { if (!sel) return; onSend({ id: `s${Date.now()}`, type: sel, user: "You", message: msg || `Available for ${sel}`, minutesLeft: 60, dorm: "Your Location" }); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: `linear-gradient(180deg, #1e3040, ${H.deep})`, borderRadius: "24px 24px 0 0", padding: "24px 20px 34px", border: `1px solid ${H.border}`, borderBottom: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: H.white }}>Send a Signal</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: H.stone }}>{I.x}</button>
        </div>
        <p style={{ fontSize: 13, color: H.cream, opacity: 0.8, marginBottom: 18, lineHeight: 1.5 }}>
          Let nearby travelers know what you're up to. Your signal stays live for one hour, then disappears. No pressure — just an open invitation.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 18 }}>
          {SIGNAL_TYPES.map(st => (
            <button key={st.value} onClick={() => setSel(st.value)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "14px 2px", borderRadius: 14,
              border: `1.5px solid ${sel === st.value ? H.trail : H.border}`, background: sel === st.value ? `${H.trail}12` : H.glass,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 22 }}>{st.emoji}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: sel === st.value ? H.trail : H.stone }}>{st.label}</span>
            </button>
          ))}
        </div>
        <textarea placeholder="Add a message… (optional)" value={msg} onChange={e => setMsg(e.target.value)} rows={2}
          style={{ width: "100%", background: H.inputBg, border: `1px solid ${H.border}`, borderRadius: 14, padding: "12px 16px", color: H.white, fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", boxSizing: "border-box" }}
        />
        <button onClick={send} disabled={!sel} style={{
          width: "100%", marginTop: 14, padding: "14px 0", borderRadius: 14, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: sel ? "pointer" : "default",
          background: sel ? H.gradEmber : H.glass, color: sel ? H.white : H.stone,
          boxShadow: sel ? `0 4px 20px rgba(224,122,79,0.2)` : "none", transition: "all 0.2s",
        }}>Send Signal</button>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: H.stone }}>Expires in 60 minutes · Visible to everyone at this hostel</div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// BOTTOM NAV
// ═════════════════════════════════════════════════════════════
function Nav({ tab, setTab }) {
  const items = [
    { id: "whatson",   label: "What's On",    icon: I.cal },
    { id: "explore",   label: "Explore",      icon: I.compass },
    { id: "commonroom",label: "Common Room",  icon: I.users },
    { id: "connect",   label: "Connect",      icon: I.zap },
  ];
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "linear-gradient(180deg, rgba(18,26,33,0.88), rgba(18,26,33,0.96))",
      backdropFilter: "blur(20px)", borderTop: `1px solid ${H.border}`,
      display: "flex", justifyContent: "space-around",
      padding: "8px 0 calc(8px + env(safe-area-inset-bottom, 0px))",
    }}>
      {items.map(it => {
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: "4px 14px",
          }}>
            {it.icon(active ? H.trail : H.stone)}
            <span style={{ fontSize: 10, fontWeight: 600, color: active ? H.trail : H.stone, letterSpacing: "0.03em" }}>{it.label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: H.trail, boxShadow: `0 0 8px ${H.trail}`, marginTop: 1 }}/>}
          </button>
        );
      })}
    </nav>
  );
}

// ═════════════════════════════════════════════════════════════
// APP ROOT
// ═════════════════════════════════════════════════════════════
export default function HiCoApp() {
  const [tab, setTab] = useState("whatson");
  const [toastState, setToastState] = useState({ msg: "", vis: false });
  const timerRef = useRef(null);

  const showToast = useCallback(msg => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastState({ msg, vis: true });
    timerRef.current = setTimeout(() => setToastState(prev => ({ ...prev, vis: false })), 2600);
  }, []);

  const tod = getTimeOfDay();

  return (
    <div style={{
      background: H.deep, color: H.cream,
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative",
      WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale",
    }}>
      <style>{globalCSS}</style>
      <Particles />

      {/* Brand bar */}
      <div style={{ position: "relative", zIndex: 10, padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: H.gradTrail,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 2px 12px rgba(46,168,114,0.2)`,
            position: "relative",
          }}>
            {I.mountain(H.white)}
          </div>
          <div>
            <span style={{
              fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: H.white,
            }}>HI</span>
            <span style={{
              fontSize: 20, fontWeight: 300, letterSpacing: "0.06em", color: H.trail, marginLeft: 4,
            }}>CO</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: `${H.cream}cc`, fontWeight: 500, padding: "4px 12px", background: `${H.timber}80`, borderRadius: 20, border: `1px solid ${H.border}`, backdropFilter: "blur(8px)" }}>
          {tod.emoji} {tod.label}
        </div>
      </div>

      {/* Section header */}
      <div style={{ position: "relative", zIndex: 10, padding: "12px 20px 6px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: H.white, letterSpacing: "-0.02em" }}>
          {{ whatson: "What's On", explore: "Explore", commonroom: "Common Room", connect: "Connect" }[tab]}
        </div>
        <div style={{ fontSize: 12, color: H.stone, fontWeight: 500, letterSpacing: "0.04em", marginTop: 2 }}>
          {{ whatson: "HI Whistler · This week's activities", explore: "Local trails, food, and more", commonroom: "Plans organized by travelers", connect: "See what's happening right now" }[tab]}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 10, marginTop: 4 }}>
        {tab === "whatson" && <WhatsOnView toast={showToast} />}
        {tab === "explore" && <ExploreView toast={showToast} />}
        {tab === "commonroom" && <CommonRoomView toast={showToast} />}
        {tab === "connect" && <ConnectView toast={showToast} />}
      </div>

      <Nav tab={tab} setTab={setTab} />
      <Toast message={toastState.msg} visible={toastState.vis} />
    </div>
  );
}
