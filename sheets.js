/* ══════════════════════════════════════════════════════════════
   sheets.js — Dynamic Content Loader
   Fetches data from Google Sheets CSV endpoints and injects
   it into the portfolio DOM.

   SETUP:
   1. Paste your Google Sheet ID below (from the sheet URL)
   2. Make sure the sheet is published to web (File → Share → Publish to web)
   3. Tab names must match the TAB_NAMES object exactly

   The sheet must be published publicly. No API key is required —
   this uses the public CSV export endpoint.
══════════════════════════════════════════════════════════════ */

"use strict";
(() => {
  /* ─── YOUR CONFIGURATION ──────────────────────────────────────
   Replace this with your actual Google Sheet ID.
   Find it in your sheet URL:
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
──────────────────────────────────────────────────────────────── */
  const SHEET_ID = "1AlcT-2J58Fyo_EcxXDjNxVNqGxqawi7GqS41BpJsmdU";

  /* Tab names must match your Google Sheet tab names exactly */
  const TABS = {
    hero: "hero",
    about: "about",
    skills: "skills",
    certifications: "certifications",
    experience: "experience",
    projects: "projects",
    education: "education",
    contact: "contact",
  };

  /* Cache duration in minutes — data is re-fetched after this time */
  const CACHE_MINUTES = 1;

  /* ─── UTILITY FUNCTIONS ───────────────────────────────────────*/

  /**
   * Build the public CSV export URL for a given tab
   */
  function sheetUrl(tabName) {
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }

  /**
   * Parse a raw CSV string into an array of row arrays.
   * Handles quoted fields containing commas and newlines.
   */
  function parseCSV(text) {
    const rows = [];
    let row = [],
      field = "",
      inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i],
        next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field.trim());
          field = "";
        } else if (ch === "\n") {
          row.push(field.trim());
          rows.push(row);
          row = [];
          field = "";
        } else if (ch === "\r") {
          /* skip */
        } else {
          field += ch;
        }
      }
    }
    if (field || row.length) {
      row.push(field.trim());
      rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c !== ""));
  }

  /**
   * Convert a parsed CSV (rows of arrays) into an array of objects
   * using the first row as keys.
   */
  function csvToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
    return rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] || "").trim();
      });
      return obj;
    });
  }

  /**
   * Convert a "key/value" tab (like hero and about) to a plain object.
   * Expects columns: key, value
   */
  function csvToKeyValue(rows) {
    const obj = {};
    rows.slice(1).forEach((row) => {
      if (row[0]) obj[row[0].trim()] = (row[1] || "").trim();
    });
    return obj;
  }

  /**
   * Fetch a sheet tab with sessionStorage caching.
   */
  async function fetchTab(tabName) {
    const cacheKey = `rs_sheet_${SHEET_ID}_${tabName}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_MINUTES * 60 * 1000) return data;
      } catch (e) {
        /* stale/corrupt cache — refetch */
      }
    }

    const url = sheetUrl(tabName);
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Failed to fetch tab "${tabName}": ${res.status}`);
    const text = await res.text();
    const data = parseCSV(text);

    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({ data, ts: Date.now() }),
      );
    } catch (e) {
      /* storage full — skip cache */
    }

    return data;
  }

  /* ─── LOADING STATE HELPERS ───────────────────────────────────*/

  function showSectionLoading(sectionId) {
    const el = document.querySelector(`#${sectionId} .dynamic-container`);
    if (!el) return;
    el.innerHTML = `
    <div class="sheets-loading" role="status" aria-live="polite">
      <div class="sheets-loading-dots">
        <span></span><span></span><span></span>
      </div>
      <p>Loading content…</p>
    </div>`;
  }

  function showSectionError(sectionId, message) {
    const el = document.querySelector(`#${sectionId} .dynamic-container`);
    if (!el) return;
    el.innerHTML = `
    <div class="sheets-error" role="alert">
      <p>⚠ Could not load this section. <button onclick="window.location.reload()" class="btn btn-outline" style="font-size:0.8rem;padding:0.3rem 0.8rem;margin-left:0.5rem;">Retry</button></p>
      <p style="font-size:0.75rem;opacity:0.6;margin-top:0.25rem;">${message}</p>
    </div>`;
  }

  /* ─── SECTION RENDERERS ───────────────────────────────────────*/

  /**
   * HERO
   *
   * Reads key/value rows from the "hero" sheet tab and updates both the
   * left content column and the right visual panel.
   *
   * ── LEFT COLUMN (already existed) ────────────────────────────────────
   *  location       e.g.  "Based in Kathmandu, Nepal"
   *  name_line1     e.g.  "Roshan"
   *  name_line2     e.g.  "Shrestha"
   *  title          e.g.  "Data Analyst · Excel, SQL, Data Handling & Programming"
   *  description    Hero paragraph text
   *  stat1_num      e.g.  "MSc"
   *  stat1_label    e.g.  "IT, Data Analytics"
   *  stat2_num      e.g.  "Biz Dev"
   *  stat2_label    e.g.  "Jr. BDM at Rudra Origins"
   *  stat3_num      e.g.  "Google"
   *  stat3_label    e.g.  "Data Analytics Cert."
   *  cv_url         Direct URL to the CV PDF
   *
   * ── RIGHT PANEL (new — all optional, HTML stays as fallback) ─────────
   *  card_initials  Avatar letters           e.g.  "RS"
   *  card_name      Profile card full name   e.g.  "Roshan Shrestha"
   *  card_role      Role + location line     e.g.  "Data Analyst · Kathmandu, NP"
   *  card_status    Status badge text        e.g.  "Available"  (blank = hidden)
   *  skills_pills   Comma-separated pills; prefix with * for accent colour
   *                 e.g.  "*SQL,Excel,*Python,Odoo CRM,Data Cleaning,*MySQL"
   *  mini1_icon     First mini card emoji    e.g.  "🎓"
   *  mini1_label    First mini card label    e.g.  "Currently at"
   *  mini1_val      First mini card value    e.g.  "Islington College"
   *  mini1_sub      First mini card sub      e.g.  "MSc IT · Data Analytics"
   *  mini2_icon     Second mini card emoji   e.g.  "💼"
   *  mini2_label    Second mini card label   e.g.  "Currently working"
   *  mini2_val      Second mini card value   e.g.  "Rudra Origins"
   *  mini2_sub      Second mini card sub     e.g.  "Jr. Business Dev. Manager"
   *  badge_icon     Floating badge emoji     e.g.  "🏅"
   *  badge_title    Floating badge title     e.g.  "Google Certified"
   *  badge_sub      Floating badge subtitle  e.g.  "Data Analytics Professional"
   */
  function renderHero(data) {
    const d = csvToKeyValue(data);
    if (!Object.keys(d).length) return;

    /* ── LEFT COLUMN ─────────────────────────────────────────── */
    if (d.location) set(".hero-mono", d.location);
    if (d.name_line1 || d.name_line2)
      set(".hero-name", `${d.name_line1 || ""}<br>${d.name_line2 || ""}`);
    if (d.title) {
      attr(".hero-title", "aria-label", d.title);
      set(
        ".hero-title",
        d.title,
        false,
      ); /* typewriter in main.js picks this up */
    }
    const descEl = qs(".hero-desc");
    if (descEl && d.description) descEl.textContent = d.description;

    if (d.stat1_num)
      set(".hero-stats .stat-item:nth-child(1) .stat-num", d.stat1_num);
    if (d.stat1_label)
      set(".hero-stats .stat-item:nth-child(1) .stat-label", d.stat1_label);
    if (d.stat2_num)
      set(".hero-stats .stat-item:nth-child(2) .stat-num", d.stat2_num);
    if (d.stat2_label)
      set(".hero-stats .stat-item:nth-child(2) .stat-label", d.stat2_label);
    if (d.stat3_num)
      set(".hero-stats .stat-item:nth-child(3) .stat-num", d.stat3_num);
    if (d.stat3_label)
      set(".hero-stats .stat-item:nth-child(3) .stat-label", d.stat3_label);

    if (d.cv_url) {
      qsa('a[href*="RoshanShrestha_CV"]').forEach((a) =>
        a.setAttribute("href", d.cv_url),
      );
    }

    /* ── RIGHT PANEL — profile card ──────────────────────────── */
    if (d.card_initials) set(".hero-avatar", d.card_initials, false);
    if (d.card_name) set(".hero-card-name", d.card_name, false);
    if (d.card_role) set(".hero-card-role", d.card_role, false);

    /* card_status: present + non-empty = show with dot; empty string = hide */
    if ("card_status" in d) {
      const statusEl = qs(".hero-card-status");
      if (statusEl) {
        if (d.card_status.trim()) {
          statusEl.innerHTML = `<span class="hero-status-dot"></span>${esc(d.card_status)}`;
          statusEl.style.display = "";
        } else {
          statusEl.style.display = "none";
        }
      }
    }

    /* ── RIGHT PANEL — skill pills ───────────────────────────── */
    if (d.skills_pills) {
      const cluster = qs(".hero-pill-cluster");
      if (cluster) {
        cluster.innerHTML = d.skills_pills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((p) => {
            const accent = p.startsWith("*");
            const label = esc(accent ? p.slice(1).trim() : p);
            return `<span class="hero-pill${accent ? " hero-pill-accent" : ""}">${label}</span>`;
          })
          .join("");
      }
    }

    /* ── RIGHT PANEL — mini cards ────────────────────────────── */
    function updateMini(selector, icon, label, val, sub) {
      const card = qs(selector);
      if (!card) return;
      if (icon) {
        const el = card.querySelector(".hero-mini-icon");
        if (el) el.textContent = icon;
      }
      if (label) {
        const el = card.querySelector(".hero-mini-label");
        if (el) el.textContent = label;
      }
      if (val) {
        const el = card.querySelector(".hero-mini-val");
        if (el) el.textContent = val;
      }
      if (sub) {
        const el = card.querySelector(".hero-mini-sub");
        if (el) el.textContent = sub;
      }
    }
    const miniCards = qsa(".hero-mini-card");
    if (miniCards[0])
      updateMini(
        ".hero-mini-card:nth-child(1)",
        d.mini1_icon,
        d.mini1_label,
        d.mini1_val,
        d.mini1_sub,
      );
    if (miniCards[1])
      updateMini(
        ".hero-mini-card:nth-child(2)",
        d.mini2_icon,
        d.mini2_label,
        d.mini2_val,
        d.mini2_sub,
      );

    /* ── RIGHT PANEL — floating badge ────────────────────────── */
    if (d.badge_icon) {
      const el = qs(".hero-badge-icon");
      if (el) el.textContent = d.badge_icon;
    }
    if (d.badge_title) {
      const el = qs(".hero-badge-title");
      if (el) el.textContent = d.badge_title;
    }
    if (d.badge_sub) {
      const el = qs(".hero-badge-sub");
      if (el) el.textContent = d.badge_sub;
    }
  }

  /**
   * ABOUT
   */
  function renderAbout(data) {
    const d = csvToKeyValue(data);
    if (!Object.keys(d).length) return;

    // Badge
    if (d.badge_label) set(".about-badge-label", d.badge_label);
    if (d.badge_value) set(".about-badge-value", d.badge_value);

    // Heading
    if (d.heading_line1 || d.heading_italic) {
      const heading = qs("#about-heading");
      if (heading)
        heading.innerHTML = `${esc(d.heading_line1 || "")}<br>
      <em style="font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;color:var(--ink-3);">${esc(d.heading_italic || "")}</em>`;
    }

    // Paragraphs
    const textEl = qs(".about-text");
    if (textEl) {
      // Remove old static paragraphs
      qsa(".about-text > p", textEl).forEach((p) => p.remove());
      // Inject dynamic paragraphs before the pills div
      const pillsEl = qs(".about-pills", textEl);
      let paraIndex = 1;
      while (d[`para${paraIndex}`]) {
        const p = document.createElement("p");
        p.textContent = d[`para${paraIndex}`];
        textEl.insertBefore(p, pillsEl);
        paraIndex++;
      }
    }

    // Pills
    if (d.pills) {
      const pillsContainer = qs(".about-pills");
      if (pillsContainer) {
        pillsContainer.innerHTML = d.pills
          .split(",")
          .map((p) => `<span class="pill">${esc(p.trim())}</span>`)
          .join("");
      }
    }

    // Photo
    if (d.photo_url) {
      const wrap = qs(".about-photo-wrap");
      if (wrap) {
        const placeholder = qs(".about-photo-placeholder", wrap);
        if (placeholder) {
          const img = document.createElement("img");
          img.src = d.photo_url;
          img.alt = d.photo_alt || "Roshan Shrestha";
          img.className = "about-photo";
          img.width = 400;
          img.height = 500;
          img.loading = "eager";
          img.onerror = () => {
            img.style.display = "none";
            placeholder.style.display = "flex";
          };
          wrap.replaceChild(img, placeholder);
        }
      }
    }
  }

  /**
   * SKILLS
   */
  function renderSkills(skillsData, certData) {
    // Skill categories
    const cats = csvToObjects(skillsData);
    const grid = qs(".skills-grid");
    if (grid && cats.length) {
      grid.innerHTML = cats
        .map((cat) => {
          const primaries = splitList(cat.skills_primary);
          const secondaries = splitList(cat.skills_secondary);
          const allTags = [
            ...primaries.map(
              (s) => `<span class="skill-tag primary">${esc(s)}</span>`,
            ),
            ...secondaries.map(
              (s) => `<span class="skill-tag">${esc(s)}</span>`,
            ),
          ].join("");
          return `
        <div class="skill-category reveal" role="listitem">
          <div class="skill-cat-icon" aria-hidden="true">${esc(cat.icon || "🔹")}</div>
          <div class="skill-cat-name">${esc(cat.category_name || "")}</div>
          <div class="skill-tags">${allTags}</div>
        </div>`;
        })
        .join("");
    }

    // Certifications
    const certs = csvToObjects(certData);
    const certsContainer = qs("#skills .certs-container");
    if (certsContainer && certs.length) {
      certsContainer.innerHTML = certs
        .map((cert) => {
          const viewBtn = cert.cert_url
            ? `<a href="${esc(cert.cert_url)}" target="_blank" rel="noopener noreferrer"
              class="btn btn-outline" style="font-size:0.78rem;padding:0.4rem 0.9rem;flex-shrink:0;">View ↗</a>`
            : "";
          return `
        <div class="cert-strip reveal">
          <div class="cert-icon" aria-hidden="true">${esc(cert.cert_icon || "🏅")}</div>
          <div class="cert-text">
            <div class="cert-name">${esc(cert.cert_name || "")}</div>
            <div class="cert-by">${esc(cert.cert_by || "")}</div>
          </div>
          ${viewBtn}
        </div>`;
        })
        .join("");
    }
  }

  /**
   * EXPERIENCE
   */
  function renderExperience(data) {
    const jobs = csvToObjects(data);
    const timeline = qs(".timeline");
    if (!timeline || !jobs.length) return;

    timeline.innerHTML = jobs
      .map((job) => {
        // Collect bullets (bullet1 through bullet9)
        const bullets = [];
        for (let i = 1; i <= 9; i++) {
          const b = job[`bullet${i}`];
          if (b) bullets.push(`<li>${esc(b)}</li>`);
        }

        const tags = splitList(job.tags)
          .map((t) => `<span class="t-tag">${esc(t)}</span>`)
          .join("");

        const statusClass =
          job.status === "current"
            ? "status-current"
            : job.status === "ongoing"
              ? "status-current"
              : "status-prev";
        const statusLabel =
          job.status === "current"
            ? "Current"
            : job.status === "ongoing"
              ? "Ongoing"
              : "Previous";

        // Semantic time elements
        const startTime = job.date_start_iso
          ? `<time datetime="${esc(job.date_start_iso)}">${esc(job.date_start || "")}</time>`
          : esc(job.date_start || "");
        const endDisplay =
          job.date_end === "Present" || !job.date_end
            ? "Present"
            : job.date_end_iso
              ? `<time datetime="${esc(job.date_end_iso)}">${esc(job.date_end)}</time>`
              : esc(job.date_end);

        const locationMeta = job.location
          ? `<div class="timeline-meta">${esc(job.type || "")}<br>${esc(job.location)}</div>`
          : `<div class="timeline-meta">${esc(job.type || "")}</div>`;

        return `
      <div class="timeline-item reveal" role="listitem">
        <div class="timeline-left">
          <span class="timeline-date">${startTime} – ${endDisplay}</span>
          <span class="timeline-status ${statusClass}">${statusLabel}</span>
          ${locationMeta}
        </div>
        <div class="timeline-right">
          <div class="timeline-role">${esc(job.role || "")}</div>
          <div class="timeline-company">${esc(job.company || "")}</div>
          <ul class="timeline-bullets">${bullets.join("")}</ul>
          <div class="timeline-tags" aria-label="Skills used">${tags}</div>
        </div>
      </div>`;
      })
      .join("");
  }

  /**
   * PROJECTS
   */
  function renderProjects(data) {
    const projects = csvToObjects(data);
    const grid = qs(".projects-grid");
    if (!grid || !projects.length) return;

    grid.innerHTML = projects
      .map((proj) => {
        const isData = proj.is_data === "TRUE" || proj.is_data === "true";
        const badgeClass =
          {
            data: "badge-data",
            web: "badge-web",
            app: "badge-app",
            nda: "badge-nda",
          }[proj.badge_type] || "badge-web";

        const tools = splitList(proj.tools)
          .map((t) => `<span class="project-tool">${esc(t)}</span>`)
          .join("");

        const link = proj.link_url
          ? `<div class="project-links">
           <a href="${esc(proj.link_url)}" target="_blank" rel="noopener noreferrer" class="project-link">${esc(proj.link_label || "View ↗")}</a>
         </div>`
          : "";

        return `
      <article class="project-card ${isData ? "data" : ""} reveal" role="listitem">
        <span class="project-type-badge ${badgeClass}">${esc(proj.badge_label || "")}</span>
        <h3 class="project-title">${esc(proj.title || "")}</h3>
        <p class="project-summary">${esc(proj.summary || "")}</p>
        <div class="project-tools" aria-label="Tools used">${tools}</div>
        <div class="project-outcome">${esc(proj.outcome || "")}</div>
        ${link}
      </article>`;
      })
      .join("");
  }

  /**
   * EDUCATION
   */
  function renderEducation(data) {
    const entries = csvToObjects(data);
    const grid = qs(".edu-grid");
    if (!grid || !entries.length) return;

    grid.innerHTML = entries
      .map((edu) => {
        const isFeatured =
          edu.is_featured === "TRUE" || edu.is_featured === "true";
        const majorLine = edu.major
          ? `<div style="font-size:0.8rem;color:var(--accent);font-family:'DM Mono',monospace;margin-bottom:0.2rem;">Major: ${esc(edu.major)}</div>`
          : "";
        const statusBadge = edu.status
          ? `<span class="edu-highlight">${esc(edu.status)}</span>`
          : "";
        const coursesLine = edu.courses
          ? `<div class="edu-courses">Key courses: ${esc(edu.courses)}</div>`
          : "";
        const periodEl = edu.period_iso
          ? `<div class="edu-period"><time datetime="${esc(edu.period_iso)}">${esc(edu.period || "")}</time></div>`
          : `<div class="edu-period">${esc(edu.period || "")}</div>`;

        return `
      <div class="edu-card ${isFeatured ? "featured" : ""} reveal" role="listitem">
        ${statusBadge}
        <div class="edu-degree">${esc(edu.degree || "")}</div>
        ${majorLine}
        <div class="edu-institution">${esc(edu.institution || "")}</div>
        ${periodEl}
        <div class="edu-detail">${esc(edu.detail || "")}</div>
        ${coursesLine}
      </div>`;
      })
      .join("");
  }

  /**
   * CONTACT
   *
   * The 'contact' tab uses a mixed structure:
   *
   * SECTION 1 — key/value rows (column A = key, column B = value):
   *   intro         The paragraph text shown above the contact links
   *   heading       Section heading override (default: "Get in Touch")
   *   form_heading  Form card heading (default: "Send a message")
   *   form_subtext  Form card sub-paragraph
   *   cv_url        URL for the Download CV button
   *   cv_label      Button label (default: "↓ Download CV")
   *   formspree_id  Your Formspree form ID (activates the contact form)
   *
   * SECTION 2 — contact link rows (column A = "link"):
   *   These rows must have "link" as the value in column A, followed by:
   *   column B = label   (e.g. "Email", "LinkedIn", "GitHub", "Portfolio")
   *   column C = value   (the display text, e.g. "roshanxshrestha@gmail.com")
   *   column D = url     (the href — use "mailto:" prefix for email)
   *   column E = icon    (a single emoji or short text shown in the icon slot)
   *   column F = is_static  TRUE = render as a plain div (no link), FALSE/blank = <a> tag
   *
   * Rows are rendered in the order they appear in the sheet.
   * Mix key/value rows and link rows freely — the renderer detects by column A value.
   */
  function renderContact(data) {
    if (!data || !data.length) return;

    /* ── Split into key/value pairs and link rows ── */
    const kv = {};
    const links = [];

    // Skip header row (row[0] = "key" or "label")
    const rows = data.slice(1);

    rows.forEach((row) => {
      const colA = (row[0] || "").trim().toLowerCase();
      if (colA === "link") {
        // Link row: B=label, C=value, D=url, E=icon, F=is_static
        links.push({
          label: (row[1] || "").trim(),
          value: (row[2] || "").trim(),
          url: (row[3] || "").trim(),
          icon: (row[4] || "").trim(),
          is_static: (row[5] || "").trim().toUpperCase() === "TRUE",
        });
      } else if (colA) {
        kv[colA] = (row[1] || "").trim();
      }
    });

    /* ── Inject intro paragraph ── */
    const introEl = qs("#contact-intro");
    if (introEl && kv.intro) introEl.textContent = kv.intro;

    /* ── Inject section heading ── */
    const headingEl = qs("#contact-heading");
    if (headingEl && kv.heading) headingEl.textContent = kv.heading;

    /* ── Inject form heading + subtext ── */
    const formHeadEl = qs("#contact-form-heading");
    const formSubEl = qs("#contact-form-subtext");
    if (formHeadEl && kv.form_heading) formHeadEl.textContent = kv.form_heading;
    if (formSubEl && kv.form_subtext) formSubEl.textContent = kv.form_subtext;

    /* ── Update CV button ── */
    const cvBtn = qs("#contact-cv-btn");
    if (cvBtn) {
      if (kv.cv_url) cvBtn.setAttribute("href", kv.cv_url);
      if (kv.cv_label) cvBtn.textContent = kv.cv_label;
    }

    /* ── Activate Formspree if ID provided ── */
    const form = qs("#contactForm");
    const note = qs("#form-note");
    if (form && kv.formspree_id && kv.formspree_id !== "YOUR_FORM_ID") {
      form.setAttribute("action", `https://formspree.io/f/${kv.formspree_id}`);
      form.setAttribute("method", "POST");
      if (note) note.style.display = "none";
    }

    /* ── Render contact links ── */
    if (!links.length) return;

    const container = qs("#contact-links");
    if (!container) return;

    container.innerHTML = links
      .map((link) => {
        const iconHtml = link.icon
          ? `<span class="cli-icon" aria-hidden="true">${esc(link.icon)}</span>`
          : "";
        const inner = `
      ${iconHtml}
      <div>
        <span class="cli-label">${esc(link.label)}</span>
        <span class="cli-value">${esc(link.value)}</span>
      </div>`;

        if (link.is_static || !link.url) {
          // Non-clickable item (e.g. Location)
          return `<div class="contact-link-item" style="cursor:default;" role="presentation">${inner}</div>`;
        }

        // Detect email links
        const isEmail = link.url.startsWith("mailto:");
        const isExternal =
          !isEmail &&
          (link.url.startsWith("http") || link.url.startsWith("//"));
        const targetAttr = isExternal
          ? 'target="_blank" rel="noopener noreferrer"'
          : "";
        const ariaLabel = `${esc(link.label)}: ${esc(link.value)}`;

        return `<a href="${esc(link.url)}" class="contact-link-item" ${targetAttr} aria-label="${ariaLabel}">${inner}</a>`;
      })
      .join("");
  }

  /* ─── DOM HELPERS ─────────────────────────────────────────────*/

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function set(sel, html, isHTML = true) {
    const el = qs(sel);
    if (!el) return;
    if (isHTML) el.innerHTML = html;
    else el.textContent = html;
  }

  function attr(sel, attribute, value) {
    const el = qs(sel);
    if (el) el.setAttribute(attribute, value);
  }

  function splitList(str) {
    if (!str) return [];
    return str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** Basic HTML escaping to prevent XSS from sheet data */
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ─── GLOBAL LOADING STATE ────────────────────────────────────*/

  function showGlobalLoading() {
    document.body.classList.add("sheets-loading-active");
  }

  function hideGlobalLoading() {
    document.body.classList.remove("sheets-loading-active");
  }

  /* ─── MAIN ORCHESTRATOR ───────────────────────────────────────*/

  /**
   * Check if the Sheet ID has been configured.
   */
  function isConfigured() {
    return SHEET_ID && SHEET_ID.trim() !== "";
  }

  /**
   * Load all sections in parallel, with individual error handling
   * so one failed section doesn't block the others.
   */
  async function loadAllSections() {
    if (!isConfigured()) {
      console.warn(
        "[sheets.js] No Sheet ID configured. Static content will be used. Set SHEET_ID at the top of sheets.js.",
      );
      return;
    }

    showGlobalLoading();

    const results = await Promise.allSettled([
      fetchTab(TABS.hero),
      fetchTab(TABS.about),
      fetchTab(TABS.skills),
      fetchTab(TABS.certifications),
      fetchTab(TABS.experience),
      fetchTab(TABS.projects),
      fetchTab(TABS.education),
      fetchTab(TABS.contact),
    ]);

    const [heroR, aboutR, skillsR, certsR, expR, projR, eduR, contactR] =
      results;

    // Render each section — gracefully skip on failure
    try {
      if (heroR.status === "fulfilled") renderHero(heroR.value);
      else console.error("[sheets.js] Hero failed:", heroR.reason);
    } catch (e) {
      console.error("[sheets.js] Hero render error:", e);
    }

    try {
      if (aboutR.status === "fulfilled") renderAbout(aboutR.value);
      else console.error("[sheets.js] About failed:", aboutR.reason);
    } catch (e) {
      console.error("[sheets.js] About render error:", e);
    }

    try {
      const skOk = skillsR.status === "fulfilled";
      const ceOk = certsR.status === "fulfilled";
      if (skOk || ceOk) {
        renderSkills(skOk ? skillsR.value : [], ceOk ? certsR.value : []);
      } else {
        console.error("[sheets.js] Skills/Certs both failed");
      }
    } catch (e) {
      console.error("[sheets.js] Skills render error:", e);
    }

    try {
      if (expR.status === "fulfilled") renderExperience(expR.value);
      else console.error("[sheets.js] Experience failed:", expR.reason);
    } catch (e) {
      console.error("[sheets.js] Experience render error:", e);
    }

    try {
      if (projR.status === "fulfilled") renderProjects(projR.value);
      else console.error("[sheets.js] Projects failed:", projR.reason);
    } catch (e) {
      console.error("[sheets.js] Projects render error:", e);
    }

    try {
      if (eduR.status === "fulfilled") renderEducation(eduR.value);
      else console.error("[sheets.js] Education failed:", eduR.reason);
    } catch (e) {
      console.error("[sheets.js] Education render error:", e);
    }

    try {
      if (contactR.status === "fulfilled") renderContact(contactR.value);
      else console.error("[sheets.js] Contact failed:", contactR.reason);
    } catch (e) {
      console.error("[sheets.js] Contact render error:", e);
    }

    hideGlobalLoading();

    // Re-trigger scroll reveal observer on freshly injected elements
    if (typeof reinitScrollReveal === "function") {
      reinitScrollReveal();
    }
  }

  /* ─── LOADING INDICATOR CSS (injected at runtime) ────────────*/
  (function injectLoadingCSS() {
    const style = document.createElement("style");
    style.textContent = `
    /* ── Sheets loading dots ── */
    .sheets-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 0;
      gap: 1rem;
      color: var(--ink-4);
      font-size: 0.85rem;
      font-family: 'DM Mono', monospace;
    }
    .sheets-loading-dots {
      display: flex;
      gap: 6px;
    }
    .sheets-loading-dots span {
      display: block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0.4;
      animation: dots-pulse 1.2s ease-in-out infinite;
    }
    .sheets-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
    .sheets-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dots-pulse {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
      40%           { opacity: 1;    transform: scale(1); }
    }
    /* ── Error state ── */
    .sheets-error {
      padding: 1.5rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--ink-3);
      font-size: 0.875rem;
    }
    /* ── NDA badge type ── */
    .badge-nda {
      background: var(--surface-3);
      color: var(--ink-3);
      font-family: 'DM Mono', monospace;
      font-size: 0.68rem;
      font-weight: 500;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-flex;
      width: fit-content;
    }
  `;
    document.head.appendChild(style);
  })();

  /* ─── BOOT ────────────────────────────────────────────────────*/
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAllSections);
  } else {
    loadAllSections();
  }
})();
