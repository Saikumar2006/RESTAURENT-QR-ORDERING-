import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./landing.css";

const salesEmail = import.meta.env.VITE_SALES_EMAIL;
const salesHref = salesEmail
  ? `mailto:${salesEmail}?subject=${encodeURIComponent("Svaadya demo request")}`
  : "/admin/register";

const features = [
  ["⌗", "QR ordering", "Turn every table into a digital ordering point.", "A table QR, a live order, no waiting."],
  ["▤", "Digital menu", "Give customers a faster, cleaner way to explore your menu.", "Update dishes and availability from one place."],
  ["↗", "Kitchen operations", "Keep every order moving from new to ready.", "A clear queue for the whole kitchen."],
  ["▦", "Table management", "Know exactly what's happening across your floor.", "See table activity as it happens."],
  ["₹", "Payments", "Make checkout simple and transparent.", "Online payment status alongside each order."],
  ["♙", "Staff & roles", "Give every team member exactly the access they need.", "Keep restaurant operations in the right hands."],
  ["⌁", "Analytics", "Turn restaurant data into better decisions.", "Understand sales, orders and busy hours."],
  ["✳", "Offers & coupons", "Drive more orders with smarter promotions.", "Create offers for your own customers."],
];

const plans = [
  {
    name: "Starter",
    price: "₹999",
    description: "The essentials to bring your restaurant online.",
    features: ["QR ordering", "Digital menu", "Table management", "Order management", "Kitchen workflow", "Online payments", "Basic analytics", "Staff management"],
  },
  {
    name: "Business",
    price: "₹1,999",
    description: "More insight and control as your operation grows.",
    popular: true,
    features: ["Everything in Starter", "Advanced analytics", "Coupons", "Advanced permissions", "Reports", "Customer insights", "Automation"],
  },
  {
    name: "Pro",
    price: "₹3,999",
    description: "More tools for a growing restaurant group.",
    features: ["Everything in Business", "Advanced reporting", "Multi-location", "Advanced permissions", "API access", "Priority support", "Advanced integrations"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "A tailored setup for complex operations.",
    features: ["Multiple locations", "Custom integrations", "Custom workflows", "Dedicated support"],
  },
];

function Icon({ children, className = "" }) {
  return <span className={`landing-icon ${className}`} aria-hidden="true">{children}</span>;
}

function SectionHeading({ eyebrow, title, text, light = false }) {
  return (
    <div className={`landing-section-heading${light ? " is-light" : ""}`}>
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p className="landing-section-copy">{text}</p>}
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="landing-nav-inner">
        <Link className="landing-wordmark" to="/" aria-label="Svaadya home" onClick={closeMenu}>
          <span className="landing-brand-icon">S</span><span>SVAADYA</span>
        </Link>
        <button
          className="landing-menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="landing-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span />
        </button>
        <nav id="landing-navigation" className={`landing-nav-links${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <a href="#product" onClick={closeMenu}>Product</a>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#analytics" onClick={closeMenu}>Analytics</a>
          <a href="#pricing" onClick={closeMenu}>Pricing</a>
          <a href="#resources" onClick={closeMenu}>Resources</a>
          <div className="landing-nav-actions">
            <Link className="landing-signin" to="/admin/login" onClick={closeMenu}>Sign in</Link>
            <Link className="landing-button landing-button-small" to="/admin/register" onClick={closeMenu}>Get started <span aria-hidden="true">↗</span></Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

function RevenueChart({ compact = false }) {
  return (
    <div className={`landing-chart${compact ? " is-compact" : ""}`} role="img" aria-label="Demo revenue chart trending upward through the week">
      <div className="landing-chart-labels"><span>₹60k</span><span>₹40k</span><span>₹20k</span><span>₹0</span></div>
      <svg viewBox="0 0 520 154" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={compact ? "chartFillSmall" : "chartFill"} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f2a24f" stopOpacity=".28" />
            <stop offset="100%" stopColor="#f2a24f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 64, 104, 144].map((y) => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="currentColor" strokeOpacity=".11" strokeDasharray="4 6" />)}
        <path d="M0 123 C38 114 43 91 82 101 S136 112 164 77 S210 86 242 67 S290 80 324 47 S374 68 402 39 S454 45 480 19 S505 32 520 12 V154 H0Z" fill={`url(#${compact ? "chartFillSmall" : "chartFill"})`} />
        <path d="M0 123 C38 114 43 91 82 101 S136 112 164 77 S210 86 242 67 S290 80 324 47 S374 68 402 39 S454 45 480 19 S505 32 520 12" fill="none" stroke="#f2a24f" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <circle cx="480" cy="19" r="5" fill="#f2a24f" stroke="#fff" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="landing-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="hero-dashboard-wrap" aria-label="Illustrative Svaadya restaurant dashboard">
      <div className="hero-orbit hero-orbit-one" />
      <div className="hero-orbit hero-orbit-two" />
      <div className="hero-dashboard">
        <aside className="mock-sidebar">
          <div className="mock-logo"><span>S</span> svaadya</div>
          <div className="mock-restaurant">SPICE &amp; STONE <span>⌄</span></div>
          {["Overview", "Orders", "Menu", "Tables", "Staff", "Analytics", "Payments", "Settings"].map((item, index) => (
            <div className={`mock-nav-item${index === 0 ? " active" : ""}`} key={item}><i>{["⌂", "▤", "▧", "▦", "♙", "⌁", "₹", "⚙"][index]}</i>{item}</div>
          ))}
          <div className="mock-sidebar-bottom"><span className="mock-avatar">AK</span><span>Arjun Kumar<small>Restaurant admin</small></span><b>···</b></div>
        </aside>
        <div className="mock-main">
          <div className="mock-topbar"><div><span className="mock-mobile-brand">SVAADYA · </span>Good afternoon, Arjun <span className="mock-wave">✦</span><small>Here&apos;s what&apos;s happening at your restaurant today.</small></div><div className="mock-top-actions"><span className="mock-live"><i /> Live</span><span className="mock-avatar">AK</span></div></div>
          <div className="mock-overview-heading"><strong>Overview</strong><span>Today, 8 October 2026 ⌄</span></div>
          <div className="mock-stat-grid">
            {[["Today's revenue", "₹48,240", "+12.8%"], ["Orders", "186", "+8.2%"], ["Active tables", "14", "of 20"], ["Average order", "₹742", "+4.6%"]].map(([label, value, delta]) => (
              <div className="mock-stat" key={label}><span>{label}</span><strong>{value}</strong><small>↗ {delta}</small></div>
            ))}
          </div>
          <div className="mock-content-grid">
            <div className="mock-panel mock-revenue-panel"><div className="mock-panel-heading"><span>Revenue overview<small>Performance this week</small></span><button>Last 7 days⌄</button></div><div className="mock-revenue-total">₹2,84,620 <small>↗ 12.8%</small></div><RevenueChart compact /></div>
            <div className="mock-panel mock-orders-panel"><div className="mock-panel-heading"><span>Live orders<small>Updating in real time</small></span><b className="mock-live-dot" /></div>
              {[["#1048", "Table 12 · 4 items", "₹1,240", "Preparing"], ["#1047", "Takeaway · 2 items", "₹680", "New"], ["#1046", "Table 04 · 3 items", "₹940", "Ready"]].map((item) => <div className="mock-order" key={item[0]}><span className="mock-order-icon">↗</span><span><b>{item[0]}</b><small>{item[1]}</small></span><strong>{item[2]}<small>{item[3]}</small></strong></div>)}
            </div>
          </div>
          <div className="mock-bottom-grid">
            <div className="mock-bottom-panel"><b>Floor status</b><div className="mock-tables">{["01", "02", "03", "04", "05", "06", "07", "08"].map((table, i) => <span className={i === 0 || i === 3 || i === 5 ? "occupied" : ""} key={table}>{table}</span>)}</div></div>
            <div className="mock-bottom-panel"><b>Popular today</b><p><i className="mock-food-dot" /> Butter Chicken <strong>42 sold</strong></p><p><i className="mock-food-dot gold" /> Garlic Naan <strong>38 sold</strong></p></div>
            <div className="mock-bottom-panel"><b>Payments</b><p>Online <strong>₹32,480</strong></p><p>At counter <strong>₹15,760</strong></p></div>
          </div>
        </div>
      </div>
      <div className="hero-toast toast-order"><span>↗</span><div><b>New order #1042</b><small>Table 12 · ₹2,480</small></div><i>NOW</i></div>
      <div className="hero-toast toast-payment"><span>₹</span><div><b>Payment received</b><small>₹2,480 · Order #1042</small></div><i>✓</i></div>
      <div className="hero-toast toast-table"><span>▦</span><div><b>Table 12 placed an order</b><small>4 items added to kitchen</small></div></div>
      <p className="mock-demo-caption">Illustrative product preview · Demo data</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="landing-hero" id="top">
      <div className="hero-grain" />
      <div className="landing-container hero-layout">
        <div className="hero-copy">
          <p className="landing-eyebrow"><span className="eyebrow-dash" /> THE OPERATING SYSTEM FOR MODERN RESTAURANTS</p>
          <h1>Run your restaurant <span>smarter.</span></h1>
          <p className="hero-description">Orders, tables, payments, kitchen operations, staff and analytics — everything your restaurant needs, connected in one powerful platform.</p>
          <div className="hero-actions"><Link className="landing-button" to="/admin/register">Start free <span>↗</span></Link><a className="landing-button landing-button-ghost" href={salesHref}>Book a demo <span>→</span></a></div>
          <div className="hero-note"><span className="hero-note-check">✓</span> One connected workspace. Built for the way restaurants run.</div>
          <div className="hero-proof"><div className="hero-proof-avatars"><span>R</span><span>M</span><span>A</span></div><p><strong>Made for restaurant teams</strong><small>From the first order to the end-of-day close.</small></p></div>
        </div>
        <HeroDashboard />
      </div>
      <div className="hero-bottom-rule"><span>ORDERS</span><i /><span>OPERATIONS</span><i /><span>INSIGHT</span><i /><span>GROWTH</span></div>
    </section>
  );
}

function ProblemSection() {
  const problems = ["Manual ordering", "Outdated menus", "Order mistakes", "Kitchen confusion", "Staff coordination", "Payment tracking", "Limited visibility", "Manual reporting"];
  return (
    <section className="problem-section landing-pad">
      <div className="landing-container">
        <SectionHeading eyebrow="THE EVERYDAY FRICTION" title="Your restaurant shouldn't run on disconnected tools." text="When every part of service lives somewhere different, small gaps turn into a harder shift for the whole team." />
        <div className="problem-grid">{problems.map((item, i) => <div className="problem-chip" key={item}><span>0{i + 1}</span>{item}<b>↗</b></div>)}</div>
        <div className="problem-transition"><span>One clear view.</span><i /><span>One connected operation.</span><strong>Svaadya brings everything together.</strong></div>
      </div>
    </section>
  );
}

function ProductSection() {
  return (
    <section className="product-section landing-pad" id="product">
      <div className="landing-container">
        <div className="product-intro">
          <div><p className="landing-eyebrow">ONE PLATFORM. EVERY SERVICE.</p><h2>Less juggling.<br /><span>More in sync.</span></h2></div>
          <p>From the first menu scan to the last order of the day, Svaadya gives your team a shared view of what matters — customers, kitchen and floor included.</p>
        </div>
        <div className="product-flow" aria-label="The Svaadya restaurant workflow">
          {["Customer scans", "Order is placed", "Kitchen gets the ticket", "Team serves with confidence"].map((label, i) => <React.Fragment key={label}><div className="product-flow-step"><span>0{i + 1}</span><b>{label}</b></div>{i < 3 && <i aria-hidden="true">→</i>}</React.Fragment>)}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="features-section landing-pad" id="features">
      <div className="landing-container">
        <SectionHeading eyebrow="A BETTER SERVICE, END TO END" title="Every moving part, working together." text="Practical tools for the moments that shape a great restaurant shift." />
        <div className="features-grid">{features.map(([icon, title, text, visual], i) => <article className="feature-card" key={title}>
          <div className="feature-card-top"><Icon>{icon}</Icon><span>0{i + 1}</span></div>
          <h3>{title}</h3><p>{text}</p>
          <div className={`feature-visual feature-visual-${i + 1}`}><span>{visual}</span><i>{["⌗", "▤", "↗", "▦", "₹", "♙", "⌁", "✳"][i]}</i><b /></div>
        </article>)}</div>
      </div>
    </section>
  );
}

function StepsSection() {
  const steps = [["01", "Set up", "Add your restaurant, menu and tables."], ["02", "Generate QR", "Create QR codes for your restaurant tables."], ["03", "Customer orders", "Customers scan, browse, order and pay."], ["04", "Restaurant operates", "Orders reach the restaurant team in real time."]];
  return (
    <section className="steps-section landing-pad" id="how-it-works">
      <div className="landing-container">
        <SectionHeading eyebrow="UP AND RUNNING" title="A simpler way to get service moving." text="A clear path from your restaurant setup to a more connected service." />
        <div className="steps-track">{steps.map(([num, title, text], index) => <React.Fragment key={num}><article className="step-card"><span className="step-number">{num}</span><div className="step-icon">{["＋", "⌗", "◉", "↗"][index]}</div><h3>{title}</h3><p>{text}</p></article>{index < steps.length - 1 && <div className="step-connector" aria-hidden="true"><span /></div>}</React.Fragment>)}</div>
        <div className="steps-footnote"><span /> Every step stays connected to the same restaurant workspace.</div>
      </div>
    </section>
  );
}

function CustomerExperience() {
  const screens = [["01", "Scan QR", "Your table, your menu."], ["02", "Explore menu", "Browse what's available."], ["03", "Choose dishes", "Add favourites to your order."], ["04", "Checkout", "Review before placing."], ["05", "Pay securely", "See payment status clearly."], ["06", "Track order", "Know what's happening next."]];
  return (
    <section className="customer-section landing-pad">
      <div className="landing-container customer-layout">
        <div className="customer-copy">
          <p className="landing-eyebrow">MADE FOR GUESTS, TOO</p>
          <h2>A smoother guest experience. <span>From the first scan.</span></h2>
          <p>Make it easy to discover your menu, place an order and follow its progress — right from a phone browser.</p>
          <div className="no-app-note"><span>✦</span><div><b>No app download required.</b><small>Guests open the restaurant menu in their browser.</small></div></div>
          <div className="customer-steps">{screens.map(([num, title, text]) => <div key={num}><span>{num}</span><p><b>{title}</b><small>{text}</small></p></div>)}</div>
        </div>
        <div className="phone-stage">
          <div className="phone-glow" />
          <div className="phone-mockup"><div className="phone-speaker" /><div className="phone-screen"><div className="phone-status"><span>9:41</span><span>●●● ▰</span></div><div className="phone-restaurant"><span>✦ SPICE &amp; STONE</span><b>Good food,<br />good moments.</b><small>Fresh from our kitchen, just for you.</small></div><div className="phone-menu-head"><b>Our menu</b><span>See all →</span></div><div className="phone-food"><span className="food-art food-art-orange">✦</span><span><b>Butter Chicken</b><small>Rich tomato, warm spices</small><strong>₹420</strong></span><i>＋</i></div><div className="phone-food"><span className="food-art food-art-green">✿</span><span><b>Garden Bowl</b><small>Seasonal greens, herbs</small><strong>₹280</strong></span><i>＋</i></div><div className="phone-food"><span className="food-art food-art-gold">◉</span><span><b>Garlic Naan</b><small>Fresh from the tandoor</small><strong>₹90</strong></span><i>＋</i></div><div className="phone-cart"><span>2 items · ₹510</span><b>View cart <i>→</i></b></div></div></div>
          <div className="phone-float phone-float-scan"><span>⌗</span><b>Scan to order<small>Table 12</small></b></div>
          <div className="phone-float phone-float-paid"><span>✓</span><b>Payment confirmed<small>Order #1048</small></b></div>
        </div>
      </div>
    </section>
  );
}

function DashboardShowcase() {
  return (
    <section className="dashboard-section landing-pad">
      <div className="landing-container">
        <SectionHeading eyebrow="YOUR RESTAURANT, IN FOCUS" title="A clear view of your whole shift." text="A live operational workspace to help your restaurant team see orders, tables and daily performance together." light />
        <div className="dashboard-product">
          <div className="dashboard-app-sidebar"><div className="mock-logo"><span>S</span> svaadya</div>{["Overview", "Orders", "Menu", "Tables", "Staff", "Analytics", "Payments", "Settings"].map((item, i) => <span className={i === 0 ? "selected" : ""} key={item}><i>{["⌂", "▤", "▧", "▦", "♙", "⌁", "₹", "⚙"][i]}</i>{item}</span>)}<div className="dashboard-sidebar-label">SPICE &amp; STONE</div></div>
          <div className="dashboard-app-main"><div className="dashboard-app-top"><div><span className="landing-eyebrow">THURSDAY, 8 OCTOBER</span><h3>Good afternoon, Arjun <span>✦</span></h3><p>Here&apos;s your restaurant at a glance.</p></div><span className="dashboard-demo-tag">DEMO DATA</span></div>
            <div className="dashboard-kpis">{[["Revenue", "₹48,240", "+12.8%"], ["Orders", "186", "+8.2%"], ["Active tables", "14 / 20", "70% in use"], ["Average order value", "₹742", "+4.6%"]].map(([label, value, trend]) => <div key={label}><small>{label}</small><b>{value}</b><span>↗ {trend}</span></div>)}</div>
            <div className="dashboard-showcase-grid"><div className="dashboard-chart-panel"><div className="dashboard-panel-title"><span>Revenue trends<small>Daily sales · this week</small></span><b>7 days⌄</b></div><div className="dashboard-chart-total">₹2,84,620 <small>+12.8%</small></div><RevenueChart /></div>
              <div className="dashboard-orders-panel"><div className="dashboard-panel-title"><span>Live orders<small>Recent activity</small></span><i className="live-pulse" /></div>{[["#1048", "Table 12", "Preparing", "₹1,240"], ["#1047", "Takeaway", "New order", "₹680"], ["#1046", "Table 04", "Ready", "₹940"], ["#1045", "Table 09", "Preparing", "₹1,560"]].map(([id, table, status, amount]) => <div className="dashboard-order-row" key={id}><b>{id}</b><span>{table}</span><em>{status}</em><strong>{amount}</strong></div>)}</div>
            </div>
            <div className="dashboard-bottom-panels"><div><b>Table status</b><div className="dashboard-table-status">{Array.from({ length: 12 }, (_, i) => <span className={[1, 3, 5, 8, 9].includes(i) ? "busy" : ""} key={i}>T{i + 1}</span>)}</div></div><div><b>Popular items</b><p>Butter Chicken <strong>42 sold</strong></p><p>Garlic Naan <strong>38 sold</strong></p></div><div><b>Payment summary</b><p>Online <strong>₹32,480</strong></p><p>At counter <strong>₹15,760</strong></p></div></div>
          </div>
        </div>
        <div className="dashboard-caption"><span>01 / OPERATIONS</span><span>DEMO DATA · ILLUSTRATIVE DASHBOARD</span></div>
      </div>
    </section>
  );
}

function KitchenSection() {
  const columns = [["NEW", [["#1048", "Table 12", "Butter Chicken ×2", "Garlic Naan ×1", "₹680"]]], ["PREPARING", [["#1046", "Table 04", "Paneer Tikka ×1", "Jeera Rice ×2", "₹740"]]], ["READY", [["#1045", "Takeaway", "Dal Makhani ×1", "Tandoori Roti ×3", "₹560"]]], ["COMPLETED", [["#1041", "Table 08", "Masala Dosa ×2", "Filter Coffee ×2", "₹520"]]]];
  return (
    <section className="kitchen-section landing-pad">
      <div className="landing-container">
        <div className="kitchen-heading"><div><p className="landing-eyebrow">BUILT FOR THE PACE OF SERVICE</p><h2>Keep the kitchen <span>in rhythm.</span></h2></div><p>One shared order view helps front-of-house and kitchen teams stay aligned as service moves.</p></div>
        <div className="kitchen-display"><div className="kitchen-toolbar"><span><i /> KITCHEN DISPLAY</span><small>SPICE &amp; STONE · LIVE QUEUE</small><b>◷ 12:42 PM</b></div><div className="kitchen-columns">{columns.map(([name, orders]) => <div className="kitchen-column" key={name}><div className="kitchen-column-heading"><b>{name}</b><span>{orders.length.toString().padStart(2, "0")}</span></div>{orders.map(([id, table, item1, item2, price]) => <article className={`kitchen-order-card kitchen-${name.toLowerCase()}`} key={id}><div className="kitchen-order-top"><strong>{id}</strong><span>{table}</span></div><p>{item1}<br />{item2}</p><div className="kitchen-order-bottom"><b>{price}</b><small>{name === "NEW" ? "2 min ago" : name === "PREPARING" ? "8 min ago" : "Just now"}</small></div></article>)}</div>)}</div></div>
        <div className="kitchen-caption"><span>One order at a time, with a clearer next step.</span><span>Illustrative kitchen view · Demo data</span></div>
      </div>
    </section>
  );
}

function RolesSection() {
  const roles = [["01", "Owner", "Full restaurant control", "All"], ["02", "Manager", "Operations + analytics", "Ops"], ["03", "Kitchen", "Orders + preparation", "Kitchen"], ["04", "Cashier", "Orders + payments", "Counter"], ["05", "Staff", "Assigned operational access", "Custom"]];
  const matrix = [["Orders", true, true, true, true, true], ["Menu", true, true, false, false, false], ["Payments", true, true, false, true, false], ["Analytics", true, true, false, false, false], ["Staff", true, false, false, false, false], ["Settings", true, false, false, false, false]];
  return (
    <section className="roles-section landing-pad">
      <div className="landing-container">
        <div className="roles-intro"><div><p className="landing-eyebrow">ACCESS THAT MAKES SENSE</p><h2>The right access<br />for the <span>right person.</span></h2></div><p>Restaurant roles help keep everyday work focused — from kitchen order flow to restaurant-wide settings.</p></div>
        <div className="roles-layout"><div className="role-cards">{roles.map(([num, role, desc, tag]) => <article className="role-card" key={role}><span>{num}</span><div><h3>{role}</h3><p>{desc}</p></div><b>{tag}</b></article>)}</div>
          <div className="permission-card"><div className="permission-title"><div><span className="landing-eyebrow">PERMISSIONS AT A GLANCE</span><h3>Role access matrix</h3></div><span className="permission-lock">⌑</span></div><div className="permission-table"><div className="permission-row permission-header"><b>AREA</b><b>OWNER</b><b>MANAGER</b><b>KITCHEN</b><b>CASHIER</b></div>{matrix.map(([label, ...access]) => <div className="permission-row" key={label}><b>{label}</b>{access.map((allowed, i) => <span className={allowed ? "permission-yes" : "permission-no"} key={`${label}-${i}`}>{allowed ? "✓" : "—"}</span>)}</div>)}</div><small className="permission-note">Illustrative access matrix. Available roles and permissions depend on the account setup.</small></div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsSection() {
  return (
    <section className="analytics-section landing-pad" id="analytics">
      <div className="landing-container analytics-layout">
        <div className="analytics-copy"><p className="landing-eyebrow">INSIGHT THAT MOVES YOU FORWARD</p><h2>See the patterns.<br /><span>Make the next call.</span></h2><p>Bring the numbers behind your service into focus — so you can make informed decisions about your menu, team and day.</p><div className="analytics-highlights">{["Revenue and order trends", "Peak hours and customer activity", "Best-selling items and average order value", "Payment breakdown"].map((item) => <span key={item}><i>✓</i>{item}</span>)}</div><Link className="analytics-link" to="/admin/login">Explore your dashboard <span>↗</span></Link></div>
        <div className="analytics-window"><div className="analytics-window-top"><div><span className="landing-eyebrow">PERFORMANCE</span><h3>Restaurant analytics <span className="dashboard-demo-tag">DEMO</span></h3></div><button>Last 7 days⌄</button></div><div className="analytics-metrics">{[["Revenue", "₹2,84,620", "+12.8%"], ["Orders", "684", "+8.2%"], ["Avg. order", "₹742", "+4.6%"]].map(([name, value, up]) => <div key={name}><small>{name}</small><b>{value}</b><span>↗ {up}</span></div>)}</div><div className="analytics-chart-label">Revenue trends <span>DEMO DATA</span></div><RevenueChart /><div className="analytics-lower"><div><b>Peak hours</b><div className="peak-bars">{[30, 42, 36, 54, 62, 80, 68, 94, 75, 52, 32, 48].map((height, i) => <span style={{ height: `${height}%` }} className={i === 7 ? "peak" : ""} key={i} />)}</div><small>11 AM <span>·</span> 2 PM <span>·</span> 8 PM</small></div><div><b>Payment mix</b><div className="payment-donut"><span>₹48k<small>today</small></span></div><p><i /> Online <strong>67%</strong></p><p><i className="counter-dot" /> Counter <strong>33%</strong></p></div></div><div className="analytics-window-footer"><span>Popular item <b>Butter Chicken</b></span><span>Customer activity <b>186 orders</b></span></div></div>
      </div>
    </section>
  );
}

function MultiRestaurantSection() {
  return (
    <section className="multi-section landing-pad">
      <div className="landing-container multi-layout">
        <div className="multi-copy"><p className="landing-eyebrow">ONE PLATFORM, MANY RESTAURANTS</p><h2>Built to grow with <span>your business.</span></h2><p>Svaadya is built as a multi-tenant restaurant SaaS platform. Each restaurant works in its own operational space, while the platform supports oversight across the wider service.</p><div className="multi-restaurant-list">{["Restaurant A", "Restaurant B", "Restaurant C", "Restaurant D"].map((name, i) => <div key={name}><span className={`restaurant-monogram monogram-${i + 1}`}>{name.slice(-1)}</span><b>{name}</b><small>Restaurant workspace</small><i>↗</i></div>)}</div></div>
        <div className="platform-preview"><div className="platform-preview-top"><div className="mock-logo"><span>S</span> svaadya <small>PLATFORM</small></div><span className="platform-admin-badge">Platform overview</span></div><div className="platform-title"><span className="landing-eyebrow">SAAS OPERATIONS</span><h3>Platform dashboard</h3><small>Illustrative demo metrics</small></div><div className="platform-kpis">{[["Total restaurants", "128"], ["Active restaurants", "116"], ["Orders", "24.8k"], ["MRR", "₹2.4L"]].map(([key, value]) => <div key={key}><small>{key}</small><b>{value}</b><span>Demo</span></div>)}</div><div className="platform-growth"><div><b>Platform growth</b><small>Illustrative monthly trend</small></div><span>↑ 18.4%</span><div className="platform-growth-chart">{[25, 34, 30, 44, 39, 57, 49, 68, 59, 73, 67, 88].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></div><div className="platform-preview-note"><span>⌑</span>Platform access is separate from restaurant operations.</div></div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const safeguards = ["Secure authentication", "Role-based access control", "Restaurant tenant separation", "Server-side validation", "Protected APIs", "Payment architecture", "QR and order-session security", "Rate limiting", "Input validation"];
  return (
    <section className="security-section landing-pad" id="security">
      <div className="landing-container security-layout">
        <div><p className="landing-eyebrow">DESIGNED WITH CARE</p><h2>Trust starts with <span>good foundations.</span></h2><p>Operational systems handle important restaurant and customer workflows. Svaadya uses layered application safeguards as part of its product architecture.</p><p className="security-small">Security controls are designed to support safer operations; no system can guarantee absolute security.</p></div>
        <div className="security-grid">{safeguards.map((item, i) => <div key={item}><span>{["⌑", "♙", "▦", "✓", "◈", "₹", "⌗", "◷", "≡"][i]}</span><b>{item}</b><i>✓</i></div>)}</div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section className="pricing-section landing-pad" id="pricing">
      <div className="landing-container">
        <SectionHeading eyebrow="SIMPLE, RECURRING PRICING" title="Choose the pace that fits." text="Start with the tools you need now. Explore a plan that fits as your restaurant operation grows." />
        <div className="pricing-grid">{plans.map((plan) => <article className={`pricing-card${plan.popular ? " is-popular" : ""}`} key={plan.name}>
          {plan.popular && <div className="popular-ribbon">MOST POPULAR</div>}
          <p className="pricing-name">{plan.name}</p><p className="pricing-description">{plan.description}</p>
          <div className="pricing-price">{plan.price}<span>{plan.price === "Custom" ? "tailored" : "/ month"}</span></div>
          <Link className={`landing-button pricing-button${plan.popular ? "" : " pricing-button-light"}`} to="/admin/register">{plan.name === "Enterprise" ? "Contact sales" : "Start free"} <span>↗</span></Link>
          <div className="pricing-divider" /><p className="pricing-includes">WHAT&apos;S INCLUDED</p><ul>{plan.features.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
        </article>)}</div>
        <p className="pricing-footnote">Pricing displayed for illustration. Confirm current availability and terms with Svaadya. No billing is initiated on this page.</p>
      </div>
    </section>
  );
}

function FAQSection() {
  const questions = [
    ["What is Svaadya?", "Svaadya is a restaurant operations platform connecting ordering, tables, digital menus, kitchen workflows, payments, staff and analytics."],
    ["Does the customer need an app?", "No app download is required. Customers open the restaurant's ordering experience in their mobile browser after scanning the QR code."],
    ["How does QR ordering work?", "A guest scans a restaurant QR code, selects or confirms a table when dining in, browses the menu and places an order. The restaurant team sees the order in its workspace."],
    ["Can I manage multiple tables?", "Yes. Restaurant teams can manage tables and see table context associated with dine-in orders."],
    ["Can staff have different permissions?", "The restaurant application distinguishes restaurant admin and staff roles. Available controls depend on each role and the current product configuration."],
    ["Can I accept online payments?", "The application supports online payment flows where the restaurant has configured an available payment provider. Availability and settlement depend on provider setup."],
    ["Can I update my menu?", "Restaurant admins can manage menu items and availability from the restaurant dashboard."],
    ["Can I see analytics?", "The dashboard includes restaurant reporting and analytics views. The information shown depends on the data recorded in the account."],
    ["How does pricing work?", "The plans shown are indicative recurring price points. Confirm current plan terms and availability with the Svaadya team."],
    ["Is there a free trial?", "Create an account to see the current onboarding and account options. Trial availability may vary."],
  ];
  return (
    <section className="faq-section landing-pad" id="resources">
      <div className="landing-container faq-layout"><div><p className="landing-eyebrow">GOOD QUESTIONS</p><h2>Worth knowing<br /><span>before you start.</span></h2><p>Some quick answers about the product and getting started.</p><a href="#contact" className="faq-contact">Still curious? Get in touch <span>↗</span></a></div>
        <div className="faq-list">{questions.map(([question, answer], i) => <details key={question} className="faq-item" open={i === 0}><summary><span>{question}</span><i aria-hidden="true">+</i></summary><p>{answer}</p></details>)}</div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="final-cta" id="contact">
      <div className="landing-container final-cta-inner"><div className="cta-orb cta-orb-left" /><div className="cta-orb cta-orb-right" />
        <p className="landing-eyebrow">MAKE THE NEXT SHIFT YOURS</p><h2>Ready to run your restaurant <span>smarter?</span></h2><p>Bring ordering, operations, payments, staff and analytics together with Svaadya.</p><div className="hero-actions"><Link className="landing-button" to="/admin/register">Start free <span>↗</span></Link><a className="landing-button landing-button-ghost" href={salesHref}>{salesEmail ? "Contact sales" : "Book a demo"} <span>→</span></a></div><small>Existing restaurant account? <Link to="/admin/login">Sign in here</Link>.</small>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-top"><div className="footer-brand"><Link className="landing-wordmark" to="/"><span className="landing-brand-icon">S</span><span>SVAADYA</span></Link><p>The operating system for modern restaurants.</p><span className="footer-platform-note">Restaurant operations, connected.</span></div>
          <div className="footer-links-group"><b>PRODUCT</b><a href="#product">Product</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#analytics">Analytics</a></div>
          <div className="footer-links-group"><b>EXPLORE</b><a href="#how-it-works">How it works</a><a href="#resources">Resources &amp; FAQ</a><a href="#security">Security</a><a href="#contact">About Svaadya</a></div>
          <div className="footer-links-group"><b>ACCOUNT</b><Link to="/admin/login">Restaurant sign in</Link><Link to="/admin/register">Get started</Link><Link to="/platform/login">Platform admin</Link><a href="#contact">Contact</a></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Svaadya. All rights reserved.</span><span>Thoughtfully built for restaurant teams.</span></div>
      </div>
    </footer>
  );
}

export default function Home() {
  useEffect(() => {
    document.title = "Svaadya — The Operating System for Modern Restaurants";
    const description = "Orders, tables, payments, kitchen operations, staff and analytics — everything your restaurant needs, connected in one powerful platform.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  return (
    <main className="landing-page">
      <Navbar />
      <Hero />
      <ProblemSection />
      <ProductSection />
      <FeaturesSection />
      <StepsSection />
      <CustomerExperience />
      <DashboardShowcase />
      <KitchenSection />
      <RolesSection />
      <AnalyticsSection />
      <MultiRestaurantSection />
      <SecuritySection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
