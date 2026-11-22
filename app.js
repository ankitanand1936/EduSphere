/* EduSphere interactive demo - Vanilla JavaScript + LocalStorage
 *
 * Everything on the site now reads from one small "database" in localStorage:
 * catalog, course details, checkout, student dashboard, profile and the whole
 * admin panel all use the same courses / users / enrollments data.
 */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- *
   * Constants & tiny helpers
   * ---------------------------------------------------------------- */
  const DB_KEY = "edusphere_v2";
  const OLD_DB_KEY = "edusphere_v1";
  const USER_KEY = "edu_current_user";
  const ADMIN_KEY = "edu_admin";
  const FLASH_KEY = "edu_flash";
  const ORDER_KEY = "edu_last_order";
  const TAX_RATE = 0.1;
  const ADMIN_EMAIL = "admin@edusphere.com";
  const ADMIN_PASS = "admin123";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

  const money = (n) => {
    const v = Number(n) || 0;
    return "$" + (Number.isInteger(v) ? v : v.toFixed(2));
  };
  const money2 = (n) => "$" + (Number(n) || 0).toFixed(2);

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d)
      ? "-"
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  const isPhone = (s) => /^[+\d][\d\s-]{6,15}$/.test(s);
  const nextId = (list, start) => list.reduce((m, x) => Math.max(m, Number(x.id) || 0), start - 1) + 1;
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

  const path = decodeURIComponent(location.pathname);
  const page = path.split("/").pop() || "index.html";
  const inAdmin = path.includes("/Admin/");
  const inClient = path.includes("/Client Side Web pages/");
  const params = new URLSearchParams(location.search);
  const homeUrl = inClient ? "home.html" : "index.html";

  /* ---------------------------------------------------------------- *
   * Database
   * ---------------------------------------------------------------- */
  const DEFAULT_MODULES = ["Introduction and setup", "Core concepts", "Hands-on practice", "Final project"];

  function makeSeed() {
    const course = (id, name, category, price, duration, level, rating, lessons, description, modules) => ({
      id, name, category, price, duration, level, rating, lessons, description, modules, status: "Active",
    });
    const today = new Date().toISOString();
    return {
      courses: [
        course(1001, "Web Development Fundamentals", "Web Dev", 29, "6 weeks", "Beginner", 4.8, 12,
          "Build responsive websites with HTML, CSS and Bootstrap.",
          ["HTML essentials", "Styling with CSS", "Responsive layouts with Bootstrap", "Build your portfolio site"]),
        course(1002, "Java Programming", "Programming", 39, "8 weeks", "Beginner", 4.7, 16,
          "Learn Java fundamentals and object-oriented programming.",
          ["Syntax and data types", "Control flow and methods", "Object-oriented design", "Collections and a mini project"]),
        course(1003, "Data Science Essentials", "Data Science", 49, "10 weeks", "Intermediate", 4.6, 20,
          "Explore data analysis, statistics and practical workflows.",
          ["Working with data", "Statistics refresher", "Visualisation", "End-to-end analysis project"]),
        course(1004, "UI/UX Design Basics", "Design", 35, "5 weeks", "Beginner", 4.5, 10,
          "Understand layouts, visual hierarchy and user experience.",
          ["Design principles", "Layout and hierarchy", "Wireframing", "Prototype and test"]),
        course(1005, "Business Communication", "Business", 32, "4 weeks", "Beginner", 4.4, 8,
          "Write clearly, present confidently and communicate at work.",
          ["Clear writing", "Email and meeting etiquette", "Presentation skills", "Handling feedback"]),
        course(1006, "Advanced JavaScript", "Web Dev", 59, "8 weeks", "Intermediate", 4.9, 16,
          "Go deeper into async code, modules and browser APIs.",
          ["Scope and closures", "Promises and async/await", "Modules and tooling", "Build a small app"]),
      ],
      categories: [
        { id: 1, name: "Web Dev", description: "Web technologies", status: "Active", created: today },
        { id: 2, name: "Programming", description: "Programming languages", status: "Active", created: today },
        { id: 3, name: "Data Science", description: "Data and analytics", status: "Active", created: today },
        { id: 4, name: "Design", description: "Design skills", status: "Active", created: today },
        { id: 5, name: "Business", description: "Professional skills", status: "Active", created: today },
      ],
      users: [
        { id: 100, name: "Ankit Anand", email: "ankit@gmail.com", password: "ankit123",
          phone: "9876543210", status: "Active", joined: daysAgo(40) },
      ],
      enrollments: [
        { id: 5001, userId: 100, student: "Ankit Anand", email: "ankit@gmail.com", courseId: 1001,
          course: "Web Development Fundamentals", amount: 31.9, payment: "Card", status: "Enrolled",
          lessonsDone: 5, lessonsTotal: 12, date: daysAgo(12) },
        { id: 5002, userId: 100, student: "Ankit Anand", email: "ankit@gmail.com", courseId: 1002,
          course: "Java Programming", amount: 42.9, payment: "UPI", status: "Enrolled",
          lessonsDone: 2, lessonsTotal: 16, date: daysAgo(4) },
      ],
      messages: [],
    };
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(DB_KEY)); } catch { /* ignore */ }

    if (!data || typeof data !== "object") {
      data = makeSeed();
      // Keep accounts registered in the previous version of the demo.
      try {
        const old = JSON.parse(localStorage.getItem(OLD_DB_KEY));
        (old?.users || []).forEach((u) => {
          if (u?.email && !data.users.some((x) => x.email.toLowerCase() === u.email.toLowerCase())) {
            data.users.push({ ...u, id: nextId(data.users, 100), status: u.status || "Active" });
          }
        });
      } catch { /* ignore */ }
    }

    ["courses", "categories", "users", "enrollments", "messages"].forEach((k) => {
      if (!Array.isArray(data[k])) data[k] = [];
    });
    return data;
  }

  const db = load();
  const save = () => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
  };
  save();

  /* ---- lookups ---- */
  const courseById = (id) => db.courses.find((c) => c.id === Number(id));
  const activeCourses = () => db.courses.filter((c) => c.status === "Active");
  const activeCategories = () => db.categories.filter((c) => c.status !== "Inactive");
  const liveEnrollments = () => db.enrollments.filter((e) => e.status !== "Cancelled");
  const enrollmentsOf = (u) => liveEnrollments().filter((e) => e.userId === u?.id);
  const isEnrolled = (u, courseId) => enrollmentsOf(u).some((e) => e.courseId === Number(courseId));
  const progressOf = (e) => {
    const total = e.lessonsTotal || 12;
    return Math.min(100, Math.round(((e.lessonsDone || 0) / total) * 100));
  };

  /* ---------------------------------------------------------------- *
   * Session, toast and flash messages
   * ---------------------------------------------------------------- */
  const user = (() => {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(USER_KEY)); } catch { /* ignore */ }
    if (!s) return null;
    const u = db.users.find((x) => x.id === s.id);
    if (!u || u.status === "Inactive") {
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return u;
  })();

  const isAdmin = () => sessionStorage.getItem(ADMIN_KEY) === "yes";

  let toastTimer;
  const notice = (msg, kind = "success") => {
    let n = $(".edu-toast");
    if (!n) {
      n = document.createElement("div");
      n.setAttribute("role", "status");
      document.body.append(n);
    }
    n.className = `edu-toast alert alert-${kind}`;
    n.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => n.remove(), 3500);
  };

  const flash = (msg, kind = "success") => sessionStorage.setItem(FLASH_KEY, JSON.stringify({ msg, kind }));
  try {
    const f = JSON.parse(sessionStorage.getItem(FLASH_KEY) || "null");
    if (f) {
      sessionStorage.removeItem(FLASH_KEY);
      // wait for DOM so the toast is appended to <body>
      document.addEventListener("DOMContentLoaded", () => notice(f.msg, f.kind));
      if (document.readyState !== "loading") notice(f.msg, f.kind);
    }
  } catch { /* ignore */ }

  const safeNext = (n) => (n && /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(n) ? n : null);
  const requireLogin = () => {
    location.replace(`login.html?next=${encodeURIComponent(page + location.search)}`);
  };

  /* ---------------------------------------------------------------- *
   * Admin guard (runs first so nothing else executes for visitors)
   * ---------------------------------------------------------------- */
  if (inAdmin) {
    document.body.classList.add("admin-page");
    if (page === "login.html" && isAdmin()) {
      location.replace("dashboard.html");
      return;
    }
    if (page !== "login.html" && !isAdmin()) {
      location.replace("login.html");
      return;
    }
  }

  /* ---------------------------------------------------------------- *
   * Shared UI bits: navbar auth button, logout
   * ---------------------------------------------------------------- */
  const logout = () => {
    localStorage.removeItem(USER_KEY);
    flash("You have been logged out.", "info");
    location.href = homeUrl;
  };

  if (!inAdmin) {
    // Student navbar: swap the Login button for Logout and greet the user.
    const authBtn = $$(".navbar-custom .btn-primary-custom").find((a) =>
      /(^|\/)login(-register)?\.html$/.test(a.getAttribute("href") || ""),
    );
    if (user && authBtn) {
      authBtn.textContent = "Logout";
      authBtn.href = "#logout";
      authBtn.addEventListener("click", (e) => { e.preventDefault(); logout(); });
      const hi = document.createElement("span");
      hi.className = "nav-greeting d-none d-lg-inline";
      hi.textContent = `Hi, ${user.name.split(" ")[0]}`;
      authBtn.before(hi);
    }
    // Logo (student pages) leads to the public landing page, so ask before logging out.
    if (user && inClient) {
      $$(".navbar-brand, .footer-brand").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          if (confirm("Going to the EduSphere landing page will log you out.\n\nDo you want to log out?")) {
            localStorage.removeItem(USER_KEY);
            location.href = a.getAttribute("href");
          }
        }),
      );
    }
    $$("[data-logout]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); logout(); }));
    $$("[data-user-name]").forEach((x) => (x.textContent = user?.name || "Student"));
    $$("[data-user-email]").forEach((x) => (x.textContent = user?.email || ""));

    // Already signed in? No need to see the login / signup pages.
    if (user && ["login.html", "signup.html", "login-register.html"].includes(page)) {
      location.replace("student-dashboard.html");
      return;
    }
  }

  /* ---------------------------------------------------------------- *
   * Forms: signup / login / contact / forgot password
   * ---------------------------------------------------------------- */
  const startSession = (u) => localStorage.setItem(USER_KEY, JSON.stringify({ id: u.id, name: u.name, email: u.email }));

  $$('[data-form="signup"]').forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = form.elements;
      const first = f.firstname.value.trim();
      const last = f.lastname.value.trim();
      const email = f.email.value.trim().toLowerCase();
      const password = f.password.value;

      if (!first || !last || !email || !password) return notice("Please complete all required fields.", "warning");
      if (!isEmail(email)) return notice("Please enter a valid email address.", "warning");
      if (password.length < 6) return notice("Password must contain at least 6 characters.", "warning");
      if (password !== f.confirm.value) return notice("Passwords do not match.", "danger");
      if (!f.terms?.checked) return notice("Please accept the Terms & Conditions.", "warning");
      if (db.users.some((x) => x.email.toLowerCase() === email))
        return notice("An account with this email already exists.", "danger");

      const u = {
        id: nextId(db.users, 100),
        name: `${first} ${last}`,
        email, password, phone: "", status: "Active",
        joined: new Date().toISOString(),
      };
      db.users.push(u);
      save();
      startSession(u);
      flash(`Welcome to EduSphere, ${first}!`);
      location.href = safeNext(params.get("next")) || "student-dashboard.html";
    }),
  );

  $$('[data-form="login"]').forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const u = db.users.find((x) => x.email.toLowerCase() === email && x.password === password);

      if (!u) return notice("Invalid email or password.", "danger");
      if (u.status === "Inactive") return notice("This account is inactive. Please contact support.", "warning");

      startSession(u);
      flash(`Welcome back, ${u.name.split(" ")[0]}!`);
      location.href = safeNext(params.get("next")) || "home.html";
    }),
  );

  $$('[data-form="contact"]').forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = form.elements;
      const msg = {
        id: nextId(db.messages, 1),
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        subject: f.subject.value.trim(),
        message: f.message.value.trim(),
        date: new Date().toISOString(),
      };
      if (!msg.name || !msg.email || !msg.message) return notice("Please fill in your name, email and message.", "warning");
      if (!isEmail(msg.email)) return notice("Please enter a valid email address.", "warning");
      db.messages.push(msg);
      save();
      location.href = "contact-success.html";
    }),
  );

  $$('[data-form="forgot"]').forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      if (!isEmail(email)) return notice("Please enter a valid email address.", "warning");
      notice("If this email is registered, reset instructions would be sent in a real application.", "info");
      form.reset();
    }),
  );

  $$('[data-form="admin-login"]').forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { email, password } = form.elements;
      if (email.value.trim().toLowerCase() === ADMIN_EMAIL && password.value === ADMIN_PASS) {
        sessionStorage.setItem(ADMIN_KEY, "yes");
        location.href = "dashboard.html";
      } else {
        notice(`Incorrect credentials. Use ${ADMIN_EMAIL} / ${ADMIN_PASS}.`, "danger");
      }
    }),
  );

  /* ---------------------------------------------------------------- *
   * Catalog rendering (home, catalog)
   * ---------------------------------------------------------------- */
  const hueOf = (s) => [...String(s)].reduce((h, c) => (h * 7 + c.charCodeAt(0)) % 360, 11);
  const thumb = (c, cls = "thumb") =>
    `<div class="${cls}" style="--hue:${hueOf(c.category)}"><span>${esc(c.category)}</span></div>`;

  const courseCard = (c, col = "col-6 col-lg-4") => `
    <div class="${col}">
      <a href="course-details.html?id=${c.id}" class="course-link">
        <div class="card-clean course-card">
          ${thumb(c)}
          <h6>${esc(c.name)}</h6>
          <p>${esc(c.description)}</p>
          <div class="d-flex justify-content-between mt-2">
            <span class="price">${money(c.price)}</span>
            <span class="small-muted">${esc(c.rating || "4.5")} ★</span>
          </div>
          <div class="small-muted mt-1">${esc(c.category)} · ${esc(c.level)} · ${esc(c.duration)}</div>
          ${isEnrolled(user, c.id) ? '<span class="badge-soft badge-ok mt-2 d-inline-block">Enrolled</span>' : ""}
        </div>
      </a>
    </div>`;

  // Home page
  const featured = $("[data-featured]");
  if (featured) {
    featured.innerHTML = [...activeCourses()]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 4)
      .map((c) => courseCard(c, "col-6 col-lg-3"))
      .join("") || '<p class="small-muted">No courses available yet.</p>';
  }

  const homeCats = $("[data-home-categories]");
  if (homeCats) {
    homeCats.innerHTML = activeCategories()
      .slice(0, 8)
      .map((cat) => {
        const n = activeCourses().filter((c) => c.category === cat.name).length;
        return `<div class="col-6 col-md-3"><a href="course-catalog.html?category=${encodeURIComponent(cat.name)}"
          class="category d-block text-dark text-center">${esc(cat.name)}<small class="d-block small-muted fw-normal">${n} course${n === 1 ? "" : "s"}</small></a></div>`;
      })
      .join("");
  }

  // Landing page counters
  $$("[data-stat-live]").forEach((el) => {
    const v = { courses: activeCourses().length, categories: activeCategories().length }[el.dataset.statLive];
    if (v !== undefined) el.textContent = v;
  });

  // Catalog page
  const grid = $("[data-course-grid]");
  if (grid) {
    const search = $("[data-course-search]");
    const level = $("[data-course-level]");
    const catBox = $("[data-category-list]");
    const count = $("[data-result-count]");
    const wanted = params.get("category") || "All";
    let selectedCategory = activeCategories().some((c) => c.name === wanted) ? wanted : "All";

    const drawCategories = () => {
      catBox.innerHTML = ["All", ...activeCategories().map((c) => c.name)]
        .map(
          (n) => `<button type="button" class="category-filter ${n === selectedCategory ? "active" : ""}"
            data-category-filter="${esc(n)}">${n === "All" ? "All Categories" : esc(n)}</button>`,
        )
        .join("");
    };

    const drawCourses = () => {
      const q = (search?.value || "").trim().toLowerCase();
      const lv = level?.value || "All Levels";
      const list = activeCourses().filter(
        (c) =>
          (selectedCategory === "All" || c.category === selectedCategory) &&
          (lv === "All Levels" || c.level === lv) &&
          `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(q),
      );
      grid.innerHTML = list.map((c) => courseCard(c)).join("");
      $("#no-courses").hidden = list.length > 0;
      if (count) count.textContent = `${list.length} course${list.length === 1 ? "" : "s"} found`;
    };

    catBox.addEventListener("click", (e) => {
      const b = e.target.closest("[data-category-filter]");
      if (!b) return;
      selectedCategory = b.dataset.categoryFilter;
      drawCategories();
      drawCourses();
    });
    search?.addEventListener("input", drawCourses);
    level?.addEventListener("change", drawCourses);
    drawCategories();
    drawCourses();
  }

  /* ---------------------------------------------------------------- *
   * Course details
   * ---------------------------------------------------------------- */
  const details = $("[data-course-details]");
  if (details) {
    const c = courseById(params.get("id"));
    if (!c || c.status !== "Active") {
      details.innerHTML = `<div class="empty-state"><h5>Course not found</h5>
        <p class="small-muted">This course doesn't exist or is no longer available.</p>
        <a href="course-catalog.html" class="btn btn-primary-custom">Browse courses</a></div>`;
    } else {
      document.title = `${c.name} | EduSphere`;
      const set = (k, v) => $$(`[data-course-${k}]`).forEach((x) => (x.textContent = v));
      set("name", c.name);
      set("category", c.category);
      set("price", money(c.price));
      set("desc", c.description);
      set("meta", `${c.level} · ${c.duration} · ${c.lessons || 12} lessons · Certificate included`);
      set("rating", `${c.rating || "4.5"} ★`);
      $("[data-course-thumb]").outerHTML = thumb(c, "thumb thumb-lg");

      const mods = c.modules?.length ? c.modules : DEFAULT_MODULES;
      const per = Math.max(1, Math.round((c.lessons || 12) / mods.length));
      $("[data-course-modules]").innerHTML = mods
        .map((m, i) => `<div class="module-row"><span><b>Module ${i + 1}</b> · ${esc(m)}</span>
          <span class="small-muted">${per} lessons</span></div>`)
        .join("");

      const cta = $("[data-course-cta]");
      if (isEnrolled(user, c.id)) {
        cta.textContent = "Go to My Courses";
        cta.href = "student-dashboard.html";
      } else {
        cta.href = `checkout.html?id=${c.id}`;
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * Checkout
   * ---------------------------------------------------------------- */
  const checkout = $("[data-checkout]");
  if (checkout) {
    const c = courseById(params.get("id"));
    if (!c || c.status !== "Active") {
      checkout.innerHTML = `<div class="empty-state"><h5>Nothing to check out</h5>
        <p class="small-muted">Please pick a course first.</p>
        <a href="course-catalog.html" class="btn btn-primary-custom">Browse courses</a></div>`;
    } else if (!user) {
      requireLogin();
      return;
    } else if (isEnrolled(user, c.id)) {
      flash("You are already enrolled in this course.", "info");
      location.replace("student-dashboard.html");
      return;
    } else {
      const tax = +(c.price * TAX_RATE).toFixed(2);
      const total = +(c.price + tax).toFixed(2);
      $("[data-sum-name]").textContent = c.name;
      $("[data-sum-meta]").textContent = `${c.level} · ${c.duration}`;
      $("[data-sum-price]").textContent = money2(c.price);
      $("[data-sum-tax]").textContent = money2(tax);
      $("[data-sum-total]").textContent = money2(total);

      const form = $("[data-checkout-form]");
      const f = form.elements;
      const [first, ...rest] = user.name.split(" ");
      f.firstname.value = first || "";
      f.lastname.value = rest.join(" ");
      f.email.value = user.email;
      f.phone.value = user.phone || "";

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = (n) => f[n].value.trim();
        if (!v("firstname") || !v("lastname") || !v("email") || !v("address") || !v("city") || !v("phone"))
          return notice("Please fill in all billing details.", "warning");
        if (!isEmail(v("email"))) return notice("Please enter a valid email address.", "warning");
        if (!isPhone(v("phone"))) return notice("Please enter a valid phone number.", "warning");
        if (isEnrolled(user, c.id)) return notice("You are already enrolled in this course.", "info");

        const order = {
          id: nextId(db.enrollments, 5001),
          userId: user.id,
          student: user.name,
          email: user.email,
          courseId: c.id,
          course: c.name,
          amount: total,
          payment: f.payment.value,
          status: "Enrolled",
          lessonsDone: 0,
          lessonsTotal: c.lessons || 12,
          date: new Date().toISOString(),
        };
        db.enrollments.push(order);
        if (!user.phone) user.phone = v("phone");
        save();
        sessionStorage.setItem(ORDER_KEY, JSON.stringify({ id: order.id, course: c.name, total }));
        location.href = "order-success.html";
      });
    }
  }

  const orderBox = $("[data-order-summary]");
  if (orderBox) {
    let o = null;
    try { o = JSON.parse(sessionStorage.getItem(ORDER_KEY)); } catch { /* ignore */ }
    orderBox.innerHTML = o
      ? `Order <b>#${esc(o.id)}</b> · ${esc(o.course)} · ${money2(o.total)}`
      : "Your enrollment has been recorded.";
  }

  /* ---------------------------------------------------------------- *
   * Student dashboard & profile (login required)
   * ---------------------------------------------------------------- */
  const needsStudent = $("[data-student-only]");
  if (needsStudent && !user) {
    requireLogin();
    return;
  }

  const miniThumb = (e) => {
    const c = courseById(e.courseId) || { category: e.course };
    return thumb(c, "thumb thumb-sm");
  };

  const myList = $("[data-my-courses]");
  if (myList && user) {
    const draw = () => {
      const mine = enrollmentsOf(user);
      const done = mine.filter((e) => e.status === "Completed").length;
      const avg = mine.length ? Math.round(mine.reduce((s, e) => s + progressOf(e), 0) / mine.length) : 0;
      const sum = $("[data-dash-summary]");
      if (sum)
        sum.innerHTML = [["Enrolled", mine.length], ["Completed", done], ["Avg. progress", avg + "%"]]
          .map(([l, v]) => `<div class="col-4"><div class="mini-stat"><strong>${v}</strong><span>${l}</span></div></div>`)
          .join("");

      myList.innerHTML = mine.length
        ? mine
            .map((e) => {
              const p = progressOf(e);
              const finished = e.status === "Completed" || p >= 100;
              return `<div class="col-12"><div class="card-clean p-3"><div class="row align-items-center g-3">
                <div class="col-3 col-md-1">${miniThumb(e)}</div>
                <div class="col-9 col-md-8">
                  <a href="course-details.html?id=${e.courseId}" class="fw-bold small text-dark">${esc(e.course)}</a>
                  ${finished ? '<span class="badge-soft badge-ok ms-1">Completed</span>' : ""}
                  <div class="progress mt-2" style="height:6px"><div class="progress-bar" style="width:${p}%"></div></div>
                  <span class="small-muted">${p}% complete · ${e.lessonsDone || 0}/${e.lessonsTotal || 12} lessons · enrolled ${fmtDate(e.date)}</span>
                </div>
                <div class="col-12 col-md-3 text-md-end">
                  ${finished
                    ? '<span class="small-muted">Certificate earned ✓</span>'
                    : `<button class="btn btn-primary-custom" data-next-lesson="${e.id}">Complete next lesson</button>`}
                </div></div></div></div>`;
            })
            .join("")
        : `<div class="col-12"><div class="empty-state"><h5>No courses yet</h5>
            <p class="small-muted">Enroll in a course and it will show up here.</p>
            <a href="course-catalog.html" class="btn btn-primary-custom">Browse courses</a></div></div>`;
    };

    myList.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-next-lesson]");
      if (!b) return;
      const e = db.enrollments.find((x) => x.id === Number(b.dataset.nextLesson));
      if (!e) return;
      e.lessonsDone = Math.min((e.lessonsDone || 0) + 1, e.lessonsTotal || 12);
      if (e.lessonsDone >= (e.lessonsTotal || 12)) {
        e.status = "Completed";
        notice(`🎉 You finished ${e.course}!`);
      } else {
        notice(`Lesson ${e.lessonsDone} of ${e.lessonsTotal || 12} completed.`);
      }
      save();
      draw();
    });
    draw();
  }

  const profile = $("[data-profile]");
  if (profile && user) {
    const mine = enrollmentsOf(user);
    const done = mine.filter((e) => e.status === "Completed");
    const avg = mine.length ? Math.round(mine.reduce((s, e) => s + progressOf(e), 0) / mine.length) : 0;
    const lessons = mine.reduce((s, e) => s + (e.lessonsDone || 0), 0);
    const spent = mine.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pad = (n) => String(n).padStart(2, "0");
    const put = (k, v) => $$(`[data-p="${k}"]`).forEach((x) => (x.textContent = v));

    // Profile photo: resized to 256px and stored with the user (data URL in localStorage).
    const avatarImg = $("[data-avatar]");
    const avatarInput = $("[data-avatar-input]");
    const avatarRemove = $("[data-avatar-remove]");
    const defaultAvatar = avatarImg?.getAttribute("src");
    const showAvatar = () => {
      if (!avatarImg) return;
      avatarImg.src = user.avatar || defaultAvatar;
      avatarRemove.hidden = !user.avatar;
    };
    showAvatar();
    $("[data-avatar-pick]")?.addEventListener("click", () => avatarInput.click());
    avatarRemove?.addEventListener("click", () => {
      delete user.avatar;
      save();
      showAvatar();
      notice("Profile photo removed.", "info");
    });
    avatarInput?.addEventListener("change", () => {
      const file = avatarInput.files[0];
      avatarInput.value = "";
      if (!file) return;
      if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return notice("Please choose a PNG, JPG, WEBP or GIF image.", "warning");
      if (file.size > 5 * 1024 * 1024) return notice("Image is too large (max 5 MB).", "warning");
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const side = Math.min(img.width, img.height); // centre-crop to a square
        const c = document.createElement("canvas");
        c.width = c.height = size;
        c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        URL.revokeObjectURL(url);
        user.avatar = c.toDataURL("image/jpeg", 0.85);
        save();
        showAvatar();
        notice("Profile photo updated.");
      };
      img.onerror = () => { URL.revokeObjectURL(url); notice("That file could not be read as an image.", "danger"); };
      img.src = url;
    });

    put("phone", user.phone || "Not added yet");
    put("joined", fmtDate(user.joined));
    put("enrolled", pad(mine.length));
    put("avg", avg + "%");
    put("lessons", pad(lessons));
    put("certs", pad(done.length));
    put("active", pad(mine.length - done.length));
    put("completed", pad(done.length));
    put("spent", money2(spent));
    put("overall", avg + "%");
    const completion = mine.length ? Math.round((done.length / mine.length) * 100) : 0;
    put("completion", completion + "%");
    $("[data-bar='overall']").style.width = avg + "%";
    $("[data-bar='completion']").style.width = completion + "%";

    $("[data-profile-courses]").innerHTML = mine.length
      ? mine
          .map((e) => `<div class="col-md-6"><div class="course-mini">${miniThumb(e)}
            <div class="mt-2"><div class="small fw-bold">${esc(e.course)}</div>
            <div class="small-muted">${progressOf(e)}% completed</div>
            <div class="progress mt-2" style="height:5px"><div class="progress-bar" style="width:${progressOf(e)}%"></div></div></div></div></div>`)
          .join("")
      : '<div class="col-12 small-muted">You have not enrolled in any course yet.</div>';

    const badges = [
      ["01", "First Step", "Enrolled in your first course", mine.length >= 1],
      ["02", "Halfway There", "Reached 50% in any course", mine.some((e) => progressOf(e) >= 50)],
      ["03", "Course Finisher", "Completed a course", done.length >= 1],
    ];
    $("[data-achievements]").innerHTML = badges
      .map(([n, t, d, ok]) => `<div class="achievement ${ok ? "" : "locked"}"><div class="achievement-icon">${ok ? n : "🔒"}</div>
        <div><div class="achievement-title">${t}</div><div class="achievement-text">${d}</div></div></div>`)
      .join("");
  }

  /* ---------------------------------------------------------------- *
   * Admin panel
   * ---------------------------------------------------------------- */
  if (inAdmin) {
    $$('.sidebar a[href="login.html"]').forEach((a) =>
      a.addEventListener("click", () => sessionStorage.removeItem(ADMIN_KEY)),
    );

    const badge = (s) => {
      const ok = ["Active", "Enrolled", "Completed"].includes(s);
      return `<span class="badge-soft ${ok ? "badge-ok" : "badge-off"}">${esc(s)}</span>`;
    };
    const countFor = (u) => liveEnrollments().filter((e) => e.userId === u.id).length;

    // One config per table: where its rows come from and how each row looks.
    const TABLES = {
      courses: {
        rows: () => db.courses,
        cells: (r) => [r.id, esc(r.name), esc(r.category), money(r.price), badge(r.status)],
        edit: "edit-course.html",
        noun: "course",
      },
      students: {
        rows: () => db.users,
        cells: (r) => [r.id, esc(r.name), esc(r.email), countFor(r), badge(r.status || "Active")],
        edit: "edit-student.html",
        noun: "student",
      },
      categories: {
        rows: () => db.categories,
        cells: (r) => [
          r.id, esc(r.name),
          db.courses.filter((c) => c.category === r.name).length,
          r.created ? fmtDate(r.created) : "-", badge(r.status || "Active"),
        ],
        edit: "add-category.html",
        noun: "category",
      },
      enrollments: {
        rows: () => [...db.enrollments].reverse(),
        cells: (r) => [
          `#${r.id}`, esc(r.student), esc(r.course), fmtDate(r.date), money2(r.amount), esc(r.payment || "-"),
          `<select class="form-select form-select-sm status-select" data-status="${r.id}">
            ${["Enrolled", "Completed", "Cancelled"].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>`,
        ],
        noun: "enrollment",
      },
    };

    const tbody = $("[data-admin-table]");
    if (tbody) {
      const type = tbody.dataset.adminTable;
      const cfg = TABLES[type];
      const searchBox = $("[data-admin-search]");
      const cols = tbody.closest("table").querySelectorAll("thead th").length;

      const draw = () => {
        const q = (searchBox?.value || "").trim().toLowerCase();
        const rows = cfg.rows().filter((r) =>
          !q || cfg.cells(r).join(" ").replace(/<[^>]*>/g, " ").toLowerCase().includes(q),
        );
        tbody.innerHTML = rows.length
          ? rows
              .map((r) => `<tr>${cfg.cells(r).map((c) => `<td>${c}</td>`).join("")}<td class="text-nowrap">
                ${cfg.edit ? `<a class="btn btn-outline-secondary btn-sm-custom" href="${cfg.edit}?id=${r.id}">Edit</a>` : ""}
                <button class="btn btn-outline-danger btn-sm-custom" data-delete="${r.id}">Delete</button></td></tr>`)
              .join("")
          : `<tr><td colspan="${cols}" class="text-center small-muted py-4">${q ? "No records match your search." : "No records yet."}</td></tr>`;
      };

      tbody.addEventListener("click", (e) => {
        const b = e.target.closest("[data-delete]");
        if (!b) return;
        const id = Number(b.dataset.delete);

        if (type === "courses") {
          const used = db.enrollments.filter((x) => x.courseId === id).length;
          if (used) return notice(`This course has ${used} enrollment(s). Set it to Inactive instead of deleting.`, "warning");
        }
        if (type === "categories") {
          const cat = db.categories.find((x) => x.id === id);
          const used = db.courses.filter((c) => c.category === cat?.name).length;
          if (used) return notice(`${used} course(s) use this category. Move or delete them first.`, "warning");
        }
        const extra = type === "students" ? " Their enrollments will be removed too." : "";
        if (!confirm(`Delete this ${cfg.noun}?${extra}`)) return;

        const key = type === "students" ? "users" : type;
        db[key] = db[key].filter((x) => x.id !== id);
        if (type === "students") db.enrollments = db.enrollments.filter((x) => x.userId !== id);
        save();
        draw();
        notice(`${cfg.noun[0].toUpperCase() + cfg.noun.slice(1)} deleted.`);
      });

      tbody.addEventListener("change", (e) => {
        const s = e.target.closest("[data-status]");
        if (!s) return;
        const en = db.enrollments.find((x) => x.id === Number(s.dataset.status));
        if (!en) return;
        en.status = s.value;
        if (s.value === "Completed") en.lessonsDone = en.lessonsTotal || 12;
        else if (en.lessonsDone >= (en.lessonsTotal || 12)) en.lessonsDone = Math.max(0, (en.lessonsTotal || 12) - 1);
        save();
        notice(`Order #${en.id} marked ${s.value}.`);
      });

      searchBox?.addEventListener("input", draw);
      draw();
    }

    /* ---- Add / edit forms (edit mode is chosen by ?id= in the URL) ---- */
    const FORMS = {
      course: { list: "courses", page: "manage-courses.html", label: "Course" },
      student: { list: "users", page: "manage-students.html", label: "Student" },
      category: { list: "categories", page: "manage-categories.html", label: "Category" },
    };
    const FIELD = { coursename: "name", fullname: "name", categoryname: "name" };

    $$("[data-admin-form]").forEach((form) => {
      const type = form.dataset.adminForm;
      const cfg = FORMS[type];
      const id = Number(params.get("id")) || null;
      const rec = id ? db[cfg.list].find((x) => x.id === id) : null;

      if (id && !rec) {
        flash(`${cfg.label} not found.`, "warning");
        location.replace(cfg.page);
        return;
      }

      // dropdowns that depend on data
      $$("select[data-options='categories']", form).forEach((sel) => {
        const names = activeCategories().map((c) => c.name);
        if (rec && rec.category && !names.includes(rec.category)) names.push(rec.category);
        sel.innerHTML = '<option value="">Select Category</option>' +
          names.map((n) => `<option>${esc(n)}</option>`).join("");
      });

      if (rec) {
        $$("[name]", form).forEach((el) => {
          const v = rec[FIELD[el.name] || el.name];
          if (v !== undefined && el.type !== "password") el.value = v;
        });
        $$("h5, .admin-top span:first-child").forEach((h) => (h.textContent = h.textContent.replace(/^Add/, "Edit")));
        document.title = document.title.replace(/^Add/, "Edit");
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = {};
        $$("input[name],select[name],textarea[name]", form).forEach((x) => (v[x.name] = x.value.trim()));
        const bad = (m) => notice(m, "warning");
        const dupName = (list, name) =>
          list.some((x) => x.id !== rec?.id && x.name.toLowerCase() === name.toLowerCase());

        if (type === "course") {
          if (!v.coursename) return bad("Course name is required.");
          if (!v.category) return bad("Please choose a category.");
          if (v.price === "" || isNaN(v.price) || Number(v.price) < 0) return bad("Enter a valid price (0 or more).");
          if (!v.level) return bad("Please choose a level.");
          if (dupName(db.courses, v.coursename)) return bad("A course with this name already exists.");

          const data = {
            name: v.coursename, category: v.category, price: Number(v.price),
            duration: v.duration || "Self-paced", level: v.level,
            description: v.description || "", status: v.status || "Active",
          };
          if (rec) Object.assign(rec, data);
          else db.courses.push({ id: nextId(db.courses, 1001), rating: 4.5, lessons: 12, modules: [], ...data });
        }

        if (type === "student") {
          const email = v.email.toLowerCase();
          if (!v.fullname) return bad("Full name is required.");
          if (!isEmail(email)) return bad("Please enter a valid email address.");
          if (db.users.some((x) => x.id !== rec?.id && x.email.toLowerCase() === email))
            return bad("Another student already uses this email.");
          if (v.phone && !isPhone(v.phone)) return bad("Please enter a valid phone number.");
          if (!rec && (v.password || "").length < 6) return bad("Password must be at least 6 characters.");
          if (rec && v.password && v.password.length < 6) return bad("Password must be at least 6 characters.");

          const data = { name: v.fullname, email, phone: v.phone || "", status: v.status || "Active" };
          if (v.password) data.password = v.password;
          if (rec) {
            Object.assign(rec, data);
            // keep order records in sync with the student's name / email
            db.enrollments.filter((x) => x.userId === rec.id).forEach((x) => { x.student = rec.name; x.email = rec.email; });
          } else {
            db.users.push({ id: nextId(db.users, 100), joined: new Date().toISOString(), ...data });
          }
        }

        if (type === "category") {
          if (!v.categoryname) return bad("Category name is required.");
          if (dupName(db.categories, v.categoryname)) return bad("A category with this name already exists.");
          const data = { name: v.categoryname, description: v.description || "", status: v.status || "Active" };
          if (rec) {
            // renaming a category must also rename it on its courses
            db.courses.forEach((c) => { if (c.category === rec.name) c.category = data.name; });
            Object.assign(rec, data);
          } else {
            db.categories.push({ id: nextId(db.categories, 1), created: new Date().toISOString(), ...data });
          }
        }

        save();
        flash(`${cfg.label} ${rec ? "updated" : "added"} successfully.`);
        location.href = cfg.page;
      });
    });

    /* ---- Dashboard & reports ---- */
    const months = (n = 6) => {
      const now = new Date();
      return Array.from({ length: n }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
        return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }) };
      });
    };
    const monthKey = (iso) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}`;
    };
    const drawBars = (el, items, fmt = (v) => v) => {
      if (!el) return;
      const max = Math.max(1, ...items.map((i) => i.value));
      el.innerHTML = `<div class="bars">${items
        .map((i) => `<div class="bar" title="${esc(i.label)}: ${esc(fmt(i.value))}">
          <em>${esc(fmt(i.value))}</em>
          <span style="height:${i.value ? Math.max(4, (i.value / max) * 100) : 1}%"></span>
          <small>${esc(i.label)}</small></div>`)
        .join("")}</div>`;
    };

    const live = liveEnrollments();
    const revenue = live.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const stats = {
      students: db.users.length,
      courses: activeCourses().length,
      revenue: money2(revenue),
      enrollments: live.length,
    };
    $$("[data-stat]").forEach((el) => (el.textContent = stats[el.dataset.stat] ?? "-"));

    const ms = months();
    drawBars($("[data-chart='enroll-month']"),
      ms.map((m) => ({ label: m.label, value: live.filter((e) => monthKey(e.date) === m.key).length })));
    drawBars($("[data-chart='revenue-month']"),
      ms.map((m) => ({
        label: m.label,
        value: Math.round(live.filter((e) => monthKey(e.date) === m.key).reduce((s, e) => s + Number(e.amount || 0), 0)),
      })), (v) => "$" + v);

    const perCourse = db.courses
      .map((c) => {
        const rows = live.filter((e) => e.courseId === c.id);
        return { c, n: rows.length, rev: rows.reduce((s, e) => s + Number(e.amount || 0), 0) };
      })
      .sort((a, b) => b.n - a.n || b.rev - a.rev);

    drawBars($("[data-chart='top-courses']"),
      perCourse.slice(0, 5).map((x) => ({ label: x.c.name, value: x.n })));

    const recent = [...db.enrollments].reverse().slice(0, 5);
    const recentList = $("[data-recent-list]");
    if (recentList)
      recentList.innerHTML = recent.length
        ? recent.map((e) => `<div class="recent-item"><span>${esc(e.student)}</span>
            <span class="small-muted">${esc(e.course)}</span></div>`).join("")
        : '<div class="small-muted">No enrollments yet.</div>';

    const recentTable = $("[data-recent-table]");
    if (recentTable)
      recentTable.innerHTML = recent.length
        ? recent.map((e) => `<tr><td>${esc(e.student)}</td><td>${esc(e.course)}</td><td>${fmtDate(e.date)}</td>
            <td>${badge(e.status)}</td></tr>`).join("")
        : '<tr><td colspan="4" class="text-center small-muted py-3">No enrollments yet.</td></tr>';

    const reportTable = $("[data-report-table]");
    if (reportTable)
      reportTable.innerHTML = perCourse.length
        ? perCourse.map((x) => `<tr><td>${esc(x.c.name)}</td><td>${x.n}</td><td>${money2(x.rev)}</td>
            <td>${badge(x.c.status)}</td></tr>`).join("")
        : '<tr><td colspan="4" class="text-center small-muted py-3">No courses yet.</td></tr>';

    /* ---- CSV export ---- */
    $$("[data-export]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!db.enrollments.length) return notice("There are no orders to export yet.", "warning");
        const head = ["Order ID", "Student", "Email", "Course", "Date", "Amount", "Payment", "Status"];
        const rows = db.enrollments.map((r) => [r.id, r.student, r.email, r.course, fmtDate(r.date), r.amount, r.payment, r.status]);
        // prefix risky leading characters so spreadsheets don't run them as formulas
        const cell = (x) => {
          let s = String(x ?? "");
          if (/^[=+\-@]/.test(s)) s = "'" + s;
          return `"${s.replace(/"/g, '""')}"`;
        };
        const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "edusphere-orders.csv";
        a.click();
        URL.revokeObjectURL(a.href);
        notice("Orders exported.");
      }),
    );
  }
})();
