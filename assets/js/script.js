/* =========================================================
   Newland Jones — shared navigation, header/footer, forms
   Quiet-luxury editorial theme, Newland Jones branding.
   HEADER_FOOTER injected on every page; NAV_CONFIG drives the
   desktop dropdowns and the mobile accordion drawer.
   ========================================================= */

"use strict";

/* -------- Base path handling (works at domain root or subfolder) -------- */
const NJ_BASE = (() => {
  const path = window.location.pathname;
  const marker = "/pages/";
  const idx = path.lastIndexOf(marker);
  if (idx !== -1) return path.slice(0, idx + 1); // e.g. /newland-jones/
  return path.endsWith("index.html") ? path.slice(0, -"index.html".length) : path;
})();

function njUrl(rel) {
  if (/^(https?:)?\/\//.test(rel) || rel.startsWith("mailto:") || rel.startsWith("tel:")) return rel;
  const clean = rel.replace(/^\.\//, "");
  return NJ_BASE + clean.replace(/^\//, "");
}

/* =========================================================
   1. NAV CONFIG
   ========================================================= */

const NAV_CONFIG = [
  { type: "link", label: "Home", href: "", desktop: false },
  {
    type: "menu", label: "About", side: "left", width: 280, links: [
      { label: "About Us", href: "pages/about-us.html", icon: "building-2" },
      { label: "Meet the Team", href: "pages/team.html", icon: "users" },
      { label: "How We Work", href: "pages/about-us.html#approach", icon: "compass" },
      { label: "Careers", href: "pages/contact-us.html", icon: "briefcase" }
    ]
  },
  {
    type: "menu", label: "Services", side: "left", width: 1080, mega: {
      intro: {
        title: "All Services",
        text: "Clear, practical accounting support for growing UK businesses.",
        cta: { label: "View All Services", href: "pages/services.html" }
      },
      columns: [
        {
          heading: "Core Services",
          items: [
            { label: "Accounting & Bookkeeping", href: "pages/service-accounting-bookkeeping.html", icon: "calculator" },
            { label: "Payroll Services", href: "pages/service-payroll.html", icon: "wallet" },
            { label: "Tax Planning & Compliance", href: "pages/service-tax.html", icon: "file-text" },
            { label: "Audit & Assurance", href: "pages/service-audit.html", icon: "clipboard-check" }
          ]
        },
        {
          heading: "Advisory & Setup",
          items: [
            { label: "Business Advisory & Forecasting", href: "pages/service-business-advisory.html", icon: "trending-up" },
            { label: "Company Formation & Secretarial", href: "pages/service-company-formation.html", icon: "file-signature" },
            { label: "Packages", href: "pages/packages.html", icon: "package" },
            { label: "Free Consultation", href: "pages/free-consultation.html", icon: "calendar-check" }
          ]
        }
      ],
      featured: {
        icon: "calendar-check",
        label: "Start Here",
        title: "Free Consultation",
        text: "A relaxed conversation about your business and your numbers.",
        cta: { label: "Book Yours", href: "pages/free-consultation.html" },
        image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=70"
      }
    }
  },
  {
    type: "menu", label: "Industries", side: "left", width: 660, mega: {
      intro: {
        title: "Industries We Serve",
        text: "Support shaped around how your sector actually works.",
        cta: { label: "View All Industries", href: "pages/industries.html" }
      },
      columns: [
        {
          heading: "Sectors",
          items: [
            { label: "Professional Services", href: "pages/industry-professional-services.html", icon: "briefcase" },
            { label: "Hospitality", href: "pages/industry-hospitality.html", icon: "hotel" },
            { label: "E-commerce", href: "pages/industry-ecommerce.html", icon: "shopping-bag" }
          ]
        },
        {
          heading: "More Sectors",
          items: [
            { label: "Property", href: "pages/industry-property.html", icon: "building" },
            { label: "Other SMEs", href: "pages/industries.html", icon: "globe" }
          ]
        }
      ]
    }
  },
  { type: "link", label: "Packages", side: "right", href: "pages/packages.html" },
  { type: "link", label: "Insights", side: "right", href: "pages/insights.html" },
  { type: "link", label: "Contact", side: "right", href: "pages/contact-us.html" }
];

/* =========================================================
   2. Icons
   ========================================================= */

function njIcon(name) {
  return `<i data-lucide="${name}"></i>`;
}

/* =========================================================
   3. Header + footer templates
   ========================================================= */

/* lucide v1 dropped brand icons, so social marks are inline SVG */
const NJ_SOCIAL_SVG = {
  linkedin: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>`
};

function njTopBar() {
  return `
    <div class="top-bar hidden lg:flex">
      <div class="top-bar-group">
        <span class="top-bar-item">Manchester</span>
        <span class="top-bar-divider" aria-hidden="true"></span>
        <span class="top-bar-item">Mon – Fri · 9:00 – 17:30</span>
      </div>
      <div class="top-bar-group">
        <a class="top-bar-item" href="tel:+441610000000">${njIcon("phone")} 0161 000 0000</a>
        <span class="top-bar-divider" aria-hidden="true"></span>
        <a class="social-link" href="#" aria-label="LinkedIn">${NJ_SOCIAL_SVG.linkedin}</a>
        <a class="social-link" href="#" aria-label="YouTube">${NJ_SOCIAL_SVG.youtube}</a>
        <span class="top-bar-divider" aria-hidden="true"></span>
        <a class="portal-link" href="${njUrl("pages/contact-us.html")}">Client Portal ${njIcon("arrow-right")}</a>
      </div>
    </div>`;
}

function njNavbar(currentPath) {
  return `
    ${njTopBar()}
    <nav id="mainNavbar" class="site-nav" aria-label="Main navigation">
      <div id="desktopNavLeft" class="nav-group hidden lg:flex"></div>

      <a href="${njUrl("index.html")}" class="logo" aria-label="Newland Jones — home">
        <img class="logo-img" src="${njUrl("public/logo.png")}" alt="Newland Jones Limited, Chartered Accountants" width="1400" height="250" />
      </a>

      <div class="nav-right hidden lg:flex">
        <div id="desktopNavRight" class="nav-group flex"></div>
        <a href="${njUrl("pages/free-consultation.html")}" class="primary-pill nav-cta">Enquire</a>
      </div>

      <div class="mobile-actions lg:hidden">
        <a class="call-btn" href="tel:+441610000000" aria-label="Call Newland Jones on 0161 000 0000">${njIcon("phone")}</a>
        <button id="mobileMenuButton" class="hamburger-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileDrawer">
          ${njIcon("menu")}
        </button>
      </div>

      <div id="desktopDropdowns"></div>
    </nav>
    <div id="navSpacer" class="nav-spacer" aria-hidden="true"></div>`;
}

function njHeader(currentPath) {
  return `
    ${njNavbar(currentPath)}

    <div id="mobileDrawer" class="mobile-drawer" role="dialog" aria-modal="true" aria-label="Site menu" aria-hidden="true">
      <div class="mobile-drawer-inner">
        <div class="flex items-center justify-between">
          <span class="drawer-title">Menu</span>
          <button id="mobileCloseButton" class="search-btn" type="button" aria-label="Close menu">
            ${njIcon("x")}
          </button>
        </div>
        <div id="mobileLinks" class="mobile-links"></div>
        <div class="mobile-drawer-actions">
          <a href="${njUrl("pages/free-consultation.html")}" class="primary-pill mobile-drawer-cta">Book a Consultation ${njIcon("arrow-right")}</a>
          <a href="tel:+441610000000" class="outline-pill mobile-drawer-portal">${njIcon("phone")} Call 0161 000 0000</a>
        </div>
      </div>
    </div>`;
}

function njFooter() {
  const year = new Date().getFullYear();
  return `
    <footer class="site-footer">
      <div>
        <div class="footer-top">
          <a href="${njUrl("index.html")}" class="footer-logo" aria-label="Newland Jones — home">
            <img src="${njUrl("public/logo.png")}" alt="Newland Jones Limited, Chartered Accountants" width="1400" height="250" loading="lazy" />
          </a>
          <a href="${njUrl("pages/free-consultation.html")}" class="primary-pill">Book a Consultation ${njIcon("arrow-right")}</a>
        </div>

        <div class="footer-grid">
          <div>
            <p class="footer-blurb">Clear, proactive accounting, tax and business support for growing UK businesses.</p>
            <div class="footer-badges">
              <span class="footer-badge">${njIcon("shield-check")} Registered auditors</span>
              <span class="footer-badge">${njIcon("clock-3")} Mon - Fri: 9:00 am - 5:30 pm</span>
            </div>
          </div>

          <div>
            <h3>Services</h3>
            <ul>
              <li><a href="${njUrl("pages/service-accounting-bookkeeping.html")}">Accounting &amp; Bookkeeping</a></li>
              <li><a href="${njUrl("pages/service-payroll.html")}">Payroll Services</a></li>
              <li><a href="${njUrl("pages/service-tax.html")}">Tax Planning &amp; Compliance</a></li>
              <li><a href="${njUrl("pages/service-audit.html")}">Audit &amp; Assurance</a></li>
              <li><a href="${njUrl("pages/service-business-advisory.html")}">Business Advisory</a></li>
              <li><a href="${njUrl("pages/service-company-formation.html")}">Company Formation</a></li>
            </ul>
          </div>

          <div>
            <h3>Company</h3>
            <ul>
              <li><a href="${njUrl("pages/about-us.html")}">About Us</a></li>
              <li><a href="${njUrl("pages/team.html")}">Meet the Team</a></li>
              <li><a href="${njUrl("pages/industries.html")}">Industries</a></li>
              <li><a href="${njUrl("pages/packages.html")}">Packages</a></li>
              <li><a href="${njUrl("pages/insights.html")}">Insights</a></li>
              <li><a href="${njUrl("pages/free-consultation.html")}">Free Consultation</a></li>
            </ul>
          </div>

          <div>
            <h3>Contact</h3>
            <ul class="footer-contact">
              <li><a href="tel:+441610000000">${njIcon("phone")} 0161 000 0000</a></li>
              <li><a href="mailto:hello@newlandjones.co.uk">${njIcon("mail")} hello@newlandjones.co.uk</a></li>
              <li>${njIcon("map-pin")}<span>1 Fictional House, Manchester M1 1AA</span></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <span>&copy; ${year} Newland Jones. All rights reserved.</span>
          <span class="footer-note">${njIcon("info")} Demonstration site — contact details are placeholders.</span>
          <span class="footer-legal">
            <a href="${njUrl("pages/privacy-policy.html")}">Privacy</a>
            <a href="${njUrl("pages/cookie-policy.html")}">Cookies</a>
            <a href="${njUrl("pages/terms.html")}">Terms</a>
            <a href="${njUrl("pages/accessibility.html")}">Accessibility</a>
          </span>
        </div>
      </div>
    </footer>`;
}

/* =========================================================
   4. Render nav from config
   ========================================================= */

function ddRow(link) {
  return `
    <a class="dd-row" role="menuitem" href="${njUrl(link.href)}">
      ${link.icon ? njIcon(link.icon) : ""}
      <span>${link.label}</span>
    </a>`;
}

function renderSimple(item, index) {
  return `
    <div id="navPanel-${index}" class="dd-panel" role="menu" aria-hidden="true" style="--dd-width:${item.width}px">
      ${item.links.map(ddRow).join("")}
    </div>`;
}

function renderMega(item, index) {
  const columns = item.mega.columns.map((col) => `
    <div class="mega-col">
      <p class="mega-heading">${col.heading}</p>
      ${col.items.map(ddRow).join("")}
    </div>`).join("");

  const featured = item.mega.featured ? `
    <div class="featured-service">
      <div class="featured-copy">
        <div class="featured-label">
          <span class="featured-icon">${njIcon(item.mega.featured.icon)}</span>
          ${item.mega.featured.label}
        </div>
        <h3>${item.mega.featured.title}</h3>
        <p>${item.mega.featured.text}</p>
        <a href="${njUrl(item.mega.featured.cta.href)}" class="featured-link">
          ${item.mega.featured.cta.label}
          ${njIcon("arrow-right")}
        </a>
      </div>
      ${item.mega.featured.image ? `<img class="featured-img" src="${item.mega.featured.image}" alt="" loading="lazy" />` : ""}
    </div>` : "";

  const zoneCount = item.mega.columns.length + (item.mega.featured ? 1 : 0);
  const colsClass = !item.mega.featured && zoneCount === 2 ? "cols-2" : "";

  return `
    <div id="navPanel-${index}" class="dd-panel mega-menu" role="menu" aria-hidden="true" style="--dd-width:${item.width}px">
      <div class="mega-intro">
        <h2>${item.mega.intro.title}</h2>
        <p>${item.mega.intro.text}</p>
        <a href="${njUrl(item.mega.intro.cta.href)}" class="outline-pill">
          ${item.mega.intro.cta.label}
          ${njIcon("arrow-right")}
        </a>
      </div>
      <div class="mega-main ${colsClass}">
        ${columns}
        ${featured}
      </div>
    </div>`;
}

function navItemHtml(item, index) {
  if (item.type === "link") {
    return `<a class="nav-link" data-nav-href="${item.href || "index.html"}" href="${njUrl(item.href || "index.html")}">${item.label}</a>`;
  }
  return `<button class="nav-link" type="button" id="navTrigger-${index}" aria-expanded="false" aria-controls="navPanel-${index}" aria-haspopup="true">${item.label} ${njIcon("chevron-down")}</button>`;
}

function renderNavInto(navLeft, navRight, dropdownHost) {
  // the logo sits between the two groups; items with desktop:false are drawer-only
  const group = (side) => NAV_CONFIG
    .map((item, index) => (item.desktop !== false && item.side === side ? navItemHtml(item, index) : ""))
    .join("");
  navLeft.innerHTML = group("left");
  navRight.innerHTML = group("right");

  dropdownHost.innerHTML = NAV_CONFIG.map((item, index) => {
    if (item.type !== "menu") return "";
    return item.mega ? renderMega(item, index) : renderSimple(item, index);
  }).join("");
}

function renderMobileInto(mobileLinks) {
  mobileLinks.innerHTML = NAV_CONFIG.map((item, index) => {
    if (item.type === "link") {
      return `<a href="${njUrl(item.href || "index.html")}">${item.label}</a>`;
    }
    let inner = "";
    if (item.mega) {
      inner = item.mega.columns.map((col) => `
        <p class="mobile-sub-heading">${col.heading}</p>
        ${col.items.map(ddRow).join("")}
      `).join("");
      if (item.mega.intro) {
        inner += `<a href="${njUrl(item.mega.intro.cta.href)}" class="dd-row">${njIcon("arrow-right")}<span>${item.mega.intro.cta.label}</span></a>`;
      }
    } else {
      inner = item.links.map(ddRow).join("");
    }
    return `
      <button class="mobile-accordion" type="button" aria-expanded="false" aria-controls="mobileSub-${index}">${item.label} ${njIcon("chevron-down")}</button>
      <div id="mobileSub-${index}" class="mobile-sub">${inner}</div>`;
  }).join("");
}

/* =========================================================
   5. Menu engine
   ========================================================= */

const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 150;

function initMenus(doc) {
  const navWrap = doc.getElementById("mainNavbar");
  const dropdownHost = doc.getElementById("desktopDropdowns");
  const desktopNav = navWrap;
  const navbar = doc.getElementById("mainNavbar");
  const navSpacer = doc.getElementById("navSpacer");
  if (!navWrap || !desktopNav) return;

  const menus = [];
  let openMenu = null;

  function positionPanel(panel, trigger) {
    const wrapRect = navWrap.getBoundingClientRect();
    const trigRect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || 320;
    const centre = trigRect.left - wrapRect.left + trigRect.width / 2;
    const maxLeft = Math.max(0, wrapRect.width - panelWidth);
    const left = Math.min(centre - panelWidth / 2, maxLeft);
    panel.style.setProperty("--dd-left", `${Math.round(Math.max(0, left))}px`);
    panel.style.setProperty("--dd-caret", `${Math.round(centre - Math.max(0, left))}px`);
  }

  function openPanel(entry) {
    if (openMenu === entry) return;
    if (openMenu) closePanel(openMenu);
    positionPanel(entry.panel, entry.trigger);
    entry.panel.setAttribute("aria-hidden", "false");
    entry.trigger.setAttribute("aria-expanded", "true");
    openMenu = entry;
  }

  function closePanel(entry) {
    entry.panel.setAttribute("aria-hidden", "true");
    entry.trigger.setAttribute("aria-expanded", "false");
    if (openMenu === entry) openMenu = null;
  }

  NAV_CONFIG.forEach((item, index) => {
    if (item.type !== "menu") return;
    const entry = {
      trigger: doc.getElementById(`navTrigger-${index}`),
      panel: doc.getElementById(`navPanel-${index}`),
      hoverTimer: null
    };
    menus.push(entry);

    const scheduleOpen = () => {
      window.clearTimeout(entry.hoverTimer);
      entry.hoverTimer = window.setTimeout(() => openPanel(entry), HOVER_OPEN_DELAY);
    };
    const scheduleClose = () => {
      window.clearTimeout(entry.hoverTimer);
      entry.hoverTimer = window.setTimeout(() => {
        if (!entry.trigger.matches(":hover") && !entry.panel.matches(":hover")) closePanel(entry);
      }, HOVER_CLOSE_DELAY);
    };
    const cancelPending = () => {
      window.clearTimeout(entry.hoverTimer);
      entry.hoverTimer = null;
    };

    entry.trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      if (openMenu === entry) {
        cancelPending();
        closePanel(entry);
      } else {
        scheduleOpen();
      }
    });

    entry.trigger.addEventListener("mouseenter", scheduleOpen);
    entry.trigger.addEventListener("mouseleave", scheduleClose);
    entry.panel.addEventListener("mouseenter", scheduleOpen);
    entry.panel.addEventListener("mouseleave", scheduleClose);

    entry.trigger.addEventListener("focus", () => {
      if (Date.now() < (entry.trigger.__suppressFocusUntil || 0)) {
        cancelPending();
        return;
      }
      scheduleOpen();
    });

    entry.trigger.addEventListener("focusout", () => {
      if (openMenu === entry && entry.panel.getAttribute("aria-hidden") === "false") {
        window.setTimeout(() => {
          const active = doc.activeElement;
          if (active !== entry.trigger && !entry.panel.contains(active)) closePanel(entry);
        }, 0);
      }
    });

    entry.trigger.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        cancelPending();
        openPanel(entry);
        const first = entry.panel.querySelector("a, button");
        if (first) first.focus();
      }
    });

    entry.panel.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const rows = Array.from(entry.panel.querySelectorAll("a, button"));
      if (!rows.length) return;
      event.preventDefault();
      const current = rows.indexOf(doc.activeElement);
      const next = event.key === "ArrowDown"
        ? rows[(current + 1) % rows.length]
        : rows[(current - 1 + rows.length) % rows.length];
      next.focus();
    });
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (openMenu) {
        const trigger = openMenu.trigger;
        trigger.__suppressFocusUntil = Date.now() + 400;
        closePanel(openMenu);
        trigger.focus();
      }
      menus.forEach((m) => {
        window.clearTimeout(m.hoverTimer);
        m.hoverTimer = null;
      });
      if (window.njCloseMobileDrawer) window.njCloseMobileDrawer();
    }
  });

  doc.addEventListener("click", (event) => {
    if (
      openMenu &&
      !openMenu.panel.contains(event.target) &&
      !openMenu.trigger.contains(event.target)
    ) {
      closePanel(openMenu);
    }
  });

  /* -------- active nav item -------- */
  const here = window.location.pathname.split("/").pop() || "index.html";
  desktopNav.querySelectorAll("a.nav-link").forEach((a) => {
    const target = (a.getAttribute("data-nav-href") || "").split("/").pop();
    if (target === here) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });
  // Home is active on the root page
  if (here === "index.html") {
    const home = desktopNav.querySelector('a.nav-link[data-nav-href="index.html"]');
    if (home) {
      home.classList.add("active");
      home.setAttribute("aria-current", "page");
    }
  }

  /* -------- sticky -------- */
  const STICKY_THRESHOLD = 20;
  let stickyTicking = false;
  function updateSticky() {
    const stuck = window.scrollY > STICKY_THRESHOLD;
    navbar.classList.toggle("stuck", stuck);
    navSpacer.classList.toggle("stuck", stuck);
    stickyTicking = false;
  }
  window.addEventListener("scroll", () => {
    if (!stickyTicking) {
      stickyTicking = true;
      window.requestAnimationFrame(updateSticky);
    }
  }, { passive: true });
}

/* =========================================================
   6. Mobile drawer
   ========================================================= */

function initMobileDrawer(doc) {
  const drawer = doc.getElementById("mobileDrawer");
  const openBtn = doc.getElementById("mobileMenuButton");
  const closeBtn = doc.getElementById("mobileCloseButton");
  const links = doc.getElementById("mobileLinks");
  if (!drawer || !openBtn || !links) return;

  const desktop = window.matchMedia("(min-width: 1024px)");
  const isOpen = () => drawer.classList.contains("open");

  function focusables() {
    return Array.from(drawer.querySelectorAll("a[href], button:not([disabled])"))
      .filter((el) => el.offsetParent !== null);
  }

  function openDrawer() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    openBtn.setAttribute("aria-expanded", "true");
    // lock both roots: iOS Safari ignores overflow on <body> alone
    doc.documentElement.classList.add("nav-locked");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
    doc.documentElement.classList.remove("nav-locked");
    if (restoreFocus) openBtn.focus();
  }
  window.njCloseMobileDrawer = closeDrawer;

  openBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", () => closeDrawer());
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer();
  });

  // keep keyboard focus inside the open dialog
  drawer.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // rotating a tablet / resizing to desktop must not leave the page scroll-locked
  desktop.addEventListener("change", (event) => {
    if (event.matches) closeDrawer({ restoreFocus: false });
  });

  links.addEventListener("click", (event) => {
    const accordion = event.target.closest(".mobile-accordion");
    if (accordion) {
      const panel = doc.getElementById(accordion.getAttribute("aria-controls"));
      const expanded = accordion.getAttribute("aria-expanded") === "true";
      accordion.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("open", !expanded);
      return;
    }
    if (event.target.closest("a")) closeDrawer({ restoreFocus: false });
  });
}

/* =========================================================
   7. Contact / consultation forms
   ========================================================= */

function initForms(doc) {
  const form = doc.getElementById("enquiryForm");
  if (!form) return;

  const status = doc.getElementById("formStatus");
  const success = doc.getElementById("formSuccess");

  const messages = {
    name: "Please enter your name.",
    email: "Please enter a valid email address.",
    stage: "Please select your business stage.",
    message: "Please enter a message."
  };

  function setError(id, hasError) {
    const field = doc.getElementById(id);
    const error = doc.getElementById(`${id}Error`);
    if (field) field.setAttribute("aria-invalid", hasError ? "true" : "false");
    if (error) {
      error.textContent = hasError ? messages[id] : "";
      error.style.display = hasError ? "block" : "none";
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    let valid = true;

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const stage = form.stage.value;
    const message = form.message.value.trim();

    if (!name) { setError("name", true); valid = false; } else setError("name", false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("email", true); valid = false; } else setError("email", false);
    if (!stage) { setError("stage", true); valid = false; } else setError("stage", false);
    if (!message) { setError("message", true); valid = false; } else setError("message", false);

    if (!valid) {
      if (status) {
        status.textContent = "Please check the highlighted fields.";
        status.className = "form-status error";
      }
      return;
    }

    // No backend in this static build — simulate a successful send.
    form.reset();
    if (status) { status.textContent = ""; status.className = "form-status"; }
    if (success) {
      success.style.display = "block";
      success.setAttribute("tabindex", "-1");
      success.focus();
    }
  });
}

/* =========================================================
   8. FAQ accordions
   ========================================================= */

function initFaqs(doc) {
  doc.querySelectorAll(".faq-item").forEach((item) => {
    const button = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");
    if (!button || !answer) return;
    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isOpen));
      item.classList.toggle("open", !isOpen);
    });
  });
}

/* =========================================================
   9. Scroll reveal — sections ease in once
   ========================================================= */

function initReveal(doc) {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = doc.querySelectorAll(".page-section > div, .quote-band > div");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });

  targets.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

/* =========================================================
   10. Boot
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("siteHeader");
  if (mount) {
    mount.innerHTML = njHeader(window.location.pathname);
    renderNavInto(
      mount.querySelector("#desktopNavLeft"),
      mount.querySelector("#desktopNavRight"),
      mount.querySelector("#desktopDropdowns")
    );
    renderMobileInto(mount.querySelector("#mobileLinks"));
  }

  const footerMount = document.getElementById("siteFooter");
  if (footerMount) {
    footerMount.outerHTML = njFooter();
  }

  if (window.lucide) lucide.createIcons();

  initMenus(document);
  initMobileDrawer(document);
  initForms(document);
  initFaqs(document);
  initReveal(document);

  document.body.classList.add("loaded");
});
