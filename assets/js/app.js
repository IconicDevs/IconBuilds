const CONFIG = window.IconBuildsConfig;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const store = {
  get session() {
    try {
      return JSON.parse(localStorage.getItem("iconBuildsSession") || "null");
    } catch {
      return null;
    }
  },
  set session(value) {
    if (value) localStorage.setItem("iconBuildsSession", JSON.stringify(value));
    else localStorage.removeItem("iconBuildsSession");
  },
  get filters() {
    try {
      return JSON.parse(sessionStorage.getItem("iconBuildsFilters") || "{}");
    } catch {
      return {};
    }
  },
  set filters(value) {
    sessionStorage.setItem("iconBuildsFilters", JSON.stringify(value || {}));
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clean(value = "") {
  return String(value || "").trim();
}

function route(path = "/") {
  const base = CONFIG.site.basePath || "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function apiUrl(action, params = {}) {
  const base = CONFIG.api.productionBasePath || CONFIG.api.basePath || "/api";
  const search = new URLSearchParams({ action, ...params });
  return `${base}${base.includes("?") ? "&" : "?"}${search.toString()}`;
}

function authHeaders() {
  return store.session?.token ? { Authorization: `Bearer ${store.session.token}` } : {};
}

function toast(message) {
  $(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  window.setTimeout(() => node.remove(), /error|failed|denied|blocked|verify/i.test(message) ? 7800 : 4200);
}

async function request(action, payload = {}, method = "POST") {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CONFIG.api.requestTimeoutMs || 25000);
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      signal: controller.signal,
      cache: "no-store"
    };
    if (method !== "GET") options.body = JSON.stringify(payload);
    const url = method === "GET" ? apiUrl(action, payload) : apiUrl(action);
    const response = await fetch(url, options);
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("The API returned an unreadable response.");
    }
    if (!response.ok || json.error) {
      const error = new Error(json.error || "That action could not be completed.");
      error.status = response.status;
      throw error;
    }
    return json;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Network timeout. Please try again.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getState(extra = {}) {
  const state = await request("state", extra, "GET");
  if (state.user && store.session) store.session = { ...store.session, user: state.user };
  return state;
}

function isAdmin(user) {
  return user?.role === "admin" || user?.roles?.includes?.("admin");
}

function mustVerify(user) {
  return user && !user.emailVerified;
}

function pageName() {
  return document.body.dataset.page || "home";
}

function pageSlug() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[0] === "resources" && parts[1] ? decodeURIComponent(parts[1]) : "";
}

function categoryFromPath() {
  const slug = pageSlug();
  return CONFIG.categories.some((item) => item.id === slug) ? slug : "";
}

function setSeo(title, description, canonical, robots = "") {
  if (title) document.title = title;
  setMeta("description", description);
  if (robots) setMeta("robots", robots);
  let link = document.querySelector("link[rel='canonical']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.append(link);
  }
  if (canonical) link.href = canonical;
}

function setMeta(name, content) {
  if (!content) return;
  let node = document.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.name = name;
    document.head.append(node);
  }
  node.content = content;
}

function priceLabel(resource) {
  if (!resource || resource.free || Number(resource.priceCents || 0) <= 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: resource.currency || CONFIG.resource.currency || "USD" }).format(Number(resource.priceCents || 0) / 100);
}

function categoryById(id) {
  return CONFIG.categories.find((item) => item.id === id) || { id, name: id || "Uncategorized", icon: "box", description: "" };
}

function resourceUrl(resource) {
  return route(`/resources/${resource.slug || resource.id}/`);
}

function publicResources(state, options = {}) {
  let resources = (state.resources || []).filter((item) => item.status === "published");
  if (options.kind === "free") resources = resources.filter((item) => item.free || Number(item.priceCents || 0) <= 0);
  if (options.kind === "premium") resources = resources.filter((item) => !item.free && Number(item.priceCents || 0) > 0);
  return resources;
}

function sortResources(resources, sort = "recommended") {
  const sorted = [...resources];
  const byDate = (key) => (a, b) => new Date(b[key] || b.updatedAt || 0) - new Date(a[key] || a.updatedAt || 0);
  const avg = (item) => Number(item.averageRating || 0);
  const downloads = (item) => Number(item.downloadCount || 0);
  const purchases = (item) => Number(item.purchaseCount || 0);
  const price = (item) => Number(item.priceCents || 0);
  if (sort === "newest") sorted.sort(byDate("createdAt"));
  else if (sort === "oldest") sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  else if (sort === "updated") sorted.sort(byDate("updatedAt"));
  else if (sort === "downloads") sorted.sort((a, b) => downloads(b) - downloads(a));
  else if (sort === "selling") sorted.sort((a, b) => purchases(b) - purchases(a));
  else if (sort === "rating") sorted.sort((a, b) => avg(b) - avg(a));
  else if (sort === "price-low") sorted.sort((a, b) => price(a) - price(b));
  else if (sort === "price-high") sorted.sort((a, b) => price(b) - price(a));
  else sorted.sort((a, b) => Number(b.featured) - Number(a.featured) || downloads(b) - downloads(a) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return sorted;
}

function filterResources(resources, filters = {}) {
  const q = clean(filters.q).toLowerCase();
  return resources.filter((item) => {
    const haystack = [item.name, item.shortDescription, item.category, ...(item.tags || [])].join(" ").toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.price === "free" && !item.free) return false;
    if (filters.price === "paid" && (item.free || Number(item.priceCents || 0) <= 0)) return false;
    if (filters.rating && Number(item.averageRating || 0) < Number(filters.rating)) return false;
    if (filters.version && !(item.minecraftVersions || []).includes(filters.version)) return false;
    if (filters.software && !(item.serverSoftware || []).includes(filters.software)) return false;
    if (filters.compatibility && !(item.compatibility || []).includes(filters.compatibility)) return false;
    if (filters.minPrice && Number(item.priceCents || 0) < Number(filters.minPrice) * 100) return false;
    if (filters.maxPrice && Number(item.priceCents || 0) > Number(filters.maxPrice) * 100) return false;
    return true;
  });
}

function layout(state, content) {
  const user = state.user || store.session?.user || null;
  document.body.innerHTML = `<div class="site-shell">
    <header class="topbar">
      <div class="utility-bar">
        <div class="utility-inner">
          <span>Official IconRealms marketplace</span>
          <a href="${route("/resources/")}">Browse resources</a>
        </div>
      </div>
      <nav class="nav">
        <a class="brand" href="${route("/")}"><span class="brand-mark">IB</span><span>${escapeHtml(CONFIG.site.name)}</span></a>
        <form class="nav-search" id="navSearch">
          <input name="q" placeholder="Search resources">
          <button type="submit">Search</button>
        </form>
        <button class="nav-button mobile-toggle" type="button" aria-label="Open menu">Menu</button>
        <div class="nav-links">
          ${navLink("/", "Home")}
          ${navLink("/resources/", "Resources")}
          ${navLink("/free/", "Free")}
          ${navLink("/premium/", "Premium")}
          ${navLink("/support/", "Support")}
          ${user ? navLink("/account/", "Account") : navLink("/login/", "Login")}
          ${isAdmin(user) ? navLink("/admin/", "Admin") : ""}
          ${user ? `<button class="nav-button" id="logoutButton" type="button">Logout</button>` : `<a class="nav-button primary" href="${route("/signup/")}">Create account</a>`}
        </div>
      </nav>
      <div class="category-rail">
        <div class="category-rail-inner">
          ${CONFIG.categories.slice(0, 8).map((category) => `<a href="${route(`/resources/${category.id}/`)}">${escapeHtml(category.name)}</a>`).join("")}
        </div>
      </div>
    </header>
    <main id="app" class="page">${content}</main>
    <footer class="footer">
      <div class="footer-inner">
        <div><strong>${escapeHtml(CONFIG.site.owner)}</strong><span class="muted"> | ${escapeHtml(CONFIG.site.copyright)}</span></div>
        <div class="footer-links">${CONFIG.footer.links.map((link) => `<a href="${route(link.href)}">${escapeHtml(link.label)}</a>`).join("")}</div>
      </div>
    </footer>
  </div>`;
  $(".mobile-toggle")?.addEventListener("click", () => $(".nav-links")?.classList.toggle("open"));
  $("#navSearch")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = clean(new FormData(event.currentTarget).get("q"));
    location.href = route(`/resources/${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  });
  $("#logoutButton")?.addEventListener("click", () => {
    store.session = null;
    location.href = route("/");
  });
}

function navLink(href, label) {
  const active = location.pathname === route(href) || (href !== "/" && location.pathname.startsWith(route(href)));
  return `<a class="nav-link ${active ? "active" : ""}" href="${route(href)}">${escapeHtml(label)}</a>`;
}

function renderHome(state) {
  setSeo(CONFIG.seo.title, CONFIG.seo.description, CONFIG.site.url, CONFIG.seo.robotsIndex);
  const published = publicResources(state);
  const free = sortResources(publicResources(state, { kind: "free" })).slice(0, 3);
  const paid = sortResources(publicResources(state, { kind: "premium" })).slice(0, 3);
  const recommended = recommendations(state, published).slice(0, 4);
  const counts = marketplaceCounts(state);
  layout(state, `<section class="hero">
    <div class="hero-content">
      <p class="eyebrow">${escapeHtml(CONFIG.copy.heroEyebrow)}</p>
      <h1>${escapeHtml(CONFIG.copy.heroTitle)}</h1>
      <p>${escapeHtml(CONFIG.copy.heroBody)}</p>
      <form class="search-hero" id="homeSearch">
        <input id="homeSearchInput" placeholder="${escapeHtml(CONFIG.copy.searchPlaceholder)}">
        <button class="button primary" type="submit">Search</button>
      </form>
      ${categoryShelf()}
      <div class="hero-actions">
        <a class="button primary" href="${route("/resources/")}">Browse Resources</a>
        <a class="button" href="${route("/free/")}">Free Resources</a>
      </div>
      <div class="count-row">
        ${countPill("published", counts.published)}
        ${countPill("free", counts.free)}
        ${countPill("premium", counts.premium)}
        ${countPill("categories", counts.categories)}
      </div>
    </div>
    <div class="hero-art">${heroShowcase(state)}</div>
  </section>
  ${sectionResources(CONFIG.copy.recommendedTitle, recommended, CONFIG.copy.recommendedFallback, "/resources/")}
  ${sectionResources(CONFIG.copy.freeTitle, free, "Free resources will appear here after an admin publishes them.", "/free/")}
  ${sectionResources(CONFIG.copy.paidTitle, paid, "Premium resources will appear here after an admin publishes them.", "/premium/")}
  <section class="section">
    <div class="section-head"><div><h2 class="section-title">${escapeHtml(CONFIG.copy.whyTitle)}</h2><p class="section-copy">Official resources, protected access, and support from the team that distributes them.</p></div></div>
    <div class="grid four">
      ${benefit("Official Resources", "Resources are created, owned, licensed, or approved by IconRealms.")}
      ${benefit("Secure Purchases", "Stripe checkout confirms payment server-side before access is granted.")}
      ${benefit("Protected Downloads", "Users download through account-gated, temporary download endpoints.")}
      ${benefit("Updates & History", "Purchased and free resources stay attached to your account library.")}
    </div>
  </section>
  <section class="section">
    <div class="section-head"><div><h2 class="section-title">${escapeHtml(CONFIG.copy.categoriesTitle)}</h2><p class="section-copy">All categories are controlled in config.js.</p></div></div>
    <div class="grid three">${CONFIG.categories.map(categoryCard).join("")}</div>
  </section>`);
  $("#homeSearch")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = clean($("#homeSearchInput").value);
    location.href = route(`/resources/${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  });
}

function recommendations(state, resources) {
  const user = state.user;
  if (!user) return resources.filter((item) => item.featured);
  const history = [...(state.downloads || []), ...(state.purchases || [])].filter((item) => item.userId === user.id);
  const categories = new Set(history.map((item) => resources.find((resource) => resource.id === item.resourceId)?.category).filter(Boolean));
  if (!categories.size) return resources.filter((item) => item.featured);
  return resources.filter((item) => categories.has(item.category));
}

function sectionResources(title, resources, empty, browseHref) {
  return `<section class="section">
    <div class="section-head"><div><h2 class="section-title">${escapeHtml(title)}</h2><p class="section-copy">${resources.length ? "Official IconRealms resources ready to browse." : escapeHtml(empty)}</p></div><a class="button" href="${route(browseHref)}">View all</a></div>
    ${resources.length ? `<div class="resource-grid">${resources.map(resourceCard).join("")}</div>` : emptyShelf(title, empty, browseHref)}
  </section>`;
}

function emptyShelf(title, empty, browseHref = "/resources/") {
  return `<div class="empty-shelf">
    <div class="empty-shelf-copy">
      <span class="shelf-kicker">${escapeHtml(title)}</span>
      <h3>Official releases will show here</h3>
      <p>${escapeHtml(empty)}</p>
      <a class="button" href="${route(browseHref)}">Browse catalog</a>
    </div>
    <div class="empty-slots" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
  </div>`;
}

function benefit(title, body) {
  return `<article class="card benefit-card"><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(body)}</p></article>`;
}

function categoryCard(category) {
  return `<a class="card category-card" href="${route(`/resources/${category.id}/`)}">
    <span class="category-icon">${escapeHtml(category.icon.slice(0, 2).toUpperCase())}</span>
    <span><strong>${escapeHtml(category.name)}</strong><span class="muted">${escapeHtml(category.description)}</span></span>
  </a>`;
}

function resourceCard(resource) {
  const category = categoryById(resource.category);
  const image = resource.coverImage || "";
  return `<article class="resource-card">
    <a class="resource-cover" href="${resourceUrl(resource)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(resource.imageAlt || `${resource.name} cover image`)}">` : `<div class="resource-cover-placeholder"><span>${escapeHtml(category.name)}</span><strong>${escapeHtml(initials(resource.name))}</strong></div>`}</a>
    <div class="resource-body">
      <div class="badge-row">
        <span class="badge">${escapeHtml(category.name)}</span>
        <span class="badge price">${escapeHtml(priceLabel(resource))}</span>
        ${resource.featured ? `<span class="badge featured">Featured</span>` : ""}
      </div>
      <h3><a href="${resourceUrl(resource)}">${escapeHtml(resource.name)}</a></h3>
      <p class="muted">${escapeHtml(resource.shortDescription || "Official IconRealms resource.")}</p>
      <div class="resource-meta">
        <span>${stars(resource.averageRating || 0)} ${Number(resource.reviewCount || 0)} reviews</span>
        <span>${Number(resource.downloadCount || 0).toLocaleString()} downloads</span>
      </div>
      <div class="resource-meta">
        <span>v${escapeHtml(resource.currentVersion || "1.0.0")}</span>
        <span>${escapeHtml(formatDate(resource.updatedAt || resource.createdAt))}</span>
      </div>
    </div>
  </article>`;
}

function formatDate(value) {
  if (!value) return "Not dated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not dated";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function initials(value = "") {
  const words = String(value || CONFIG.site.name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "IB").toUpperCase();
}

function marketplaceCounts(state) {
  const resources = publicResources(state);
  return {
    published: resources.length,
    free: resources.filter((item) => item.free || Number(item.priceCents || 0) <= 0).length,
    premium: resources.filter((item) => !item.free && Number(item.priceCents || 0) > 0).length,
    categories: CONFIG.categories.length
  };
}

function countPill(label, value) {
  return `<div class="count-pill"><strong>${Number(value || 0).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`;
}

function homeCategoryTile(category, index) {
  return `<a class="showcase-tile tone-${index % 6}" href="${route(`/resources/${category.id}/`)}">
    <span>${escapeHtml(category.name)}</span>
    <small>${escapeHtml(category.description)}</small>
  </a>`;
}

function heroShowcase(state) {
  const resources = sortResources(publicResources(state)).slice(0, 3);
  if (resources.length) {
    return `<div class="hero-showcase-card">
      <div class="showcase-top"><span>Featured shelf</span><a href="${route("/resources/")}">View all</a></div>
      <div class="showcase-stack">${resources.map((resource) => resourceMiniRow(resource)).join("")}</div>
    </div>`;
  }
  return `<div class="hero-showcase-card">
    <div class="showcase-top"><span>Catalog shelves</span><a href="${route("/resources/")}">Open marketplace</a></div>
    <div class="showcase-grid">${CONFIG.categories.slice(0, 6).map(homeCategoryTile).join("")}</div>
    <div class="release-note"><strong>Awaiting first release</strong><span>Admins can publish official IconRealms resources from the protected admin panel.</span></div>
  </div>`;
}

function resourceMiniRow(resource) {
  return `<a class="resource-mini" href="${resourceUrl(resource)}">
    <span class="mini-cover">${initials(resource.name)}</span>
    <span><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(categoryById(resource.category).name)} - ${escapeHtml(priceLabel(resource))}</small></span>
  </a>`;
}

function categoryShelf() {
  return `<div class="category-shelf">${CONFIG.categories.slice(0, 6).map((category) => `<a class="chip" href="${route(`/resources/${category.id}/`)}">${escapeHtml(category.name)}</a>`).join("")}</div>`;
}

function renderMarketplace(state, kind = "") {
  const params = new URLSearchParams(location.search);
  const baseFilters = {
    q: params.get("q") || "",
    category: params.get("category") || categoryFromPath(),
    price: kind === "free" ? "free" : kind === "premium" ? "paid" : "",
    sort: params.get("sort") || "recommended"
  };
  const resources = sortResources(filterResources(publicResources(state), baseFilters), baseFilters.sort);
  const counts = marketplaceCounts(state);
  const heading = kind === "free" ? "Free Resources" : kind === "premium" ? "Premium Resources" : categoryFromPath() ? `${categoryById(categoryFromPath()).name} Resources` : "Resource Marketplace";
  setSeo(kind === "free" ? "Free Minecraft Resources | IconBuilds" : kind === "premium" ? "Premium Minecraft Resources | IconBuilds" : "Minecraft Resource Marketplace | IconBuilds", CONFIG.seo.description, `${CONFIG.site.url}${kind ? `/${kind}/` : "/resources/"}`, CONFIG.seo.robotsIndex);
  layout(state, `<section class="section">
    <div class="market-hero">
      <div>
        <p class="eyebrow">Marketplace</p>
        <h1 class="section-title">${escapeHtml(heading)}</h1>
        <p class="section-copy">Browse official IconRealms resources. No public uploads, no seller dashboards, and no fake marketplace numbers.</p>
      </div>
      <div class="count-row compact">
        ${countPill("published", counts.published)}
        ${countPill("free", counts.free)}
        ${countPill("premium", counts.premium)}
      </div>
    </div>
    <div class="market-layout">
      <aside class="filters panel">
        <form id="resourceFilters" class="form">
          <div class="field"><label>Search</label><input class="input" name="q" value="${escapeHtml(baseFilters.q)}" placeholder="Search resources"></div>
          <div class="field"><label>Category</label><select class="select" name="category"><option value="">All categories</option>${CONFIG.categories.map((cat) => `<option value="${cat.id}" ${cat.id === baseFilters.category ? "selected" : ""}>${escapeHtml(cat.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Free or paid</label><select class="select" name="price"><option value="">All</option><option value="free" ${baseFilters.price === "free" ? "selected" : ""}>Free</option><option value="paid" ${baseFilters.price === "paid" ? "selected" : ""}>Paid</option></select></div>
          <div class="form-grid"><div class="field"><label>Min price</label><input class="input" name="minPrice" type="number" min="0" step="1"></div><div class="field"><label>Max price</label><input class="input" name="maxPrice" type="number" min="0" step="1"></div></div>
          <div class="field"><label>Rating</label><select class="select" name="rating"><option value="">Any rating</option><option value="4">4+ stars</option><option value="3">3+ stars</option></select></div>
          <div class="field"><label>Minecraft version</label><select class="select" name="version"><option value="">Any version</option>${CONFIG.filters.minecraftVersions.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>Server software</label><select class="select" name="software"><option value="">Any software</option>${CONFIG.filters.serverSoftware.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>Compatibility</label><select class="select" name="compatibility"><option value="">Any compatibility</option>${CONFIG.filters.compatibility.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>Sort</label><select class="select" name="sort">
            ${[["recommended", "Recommended"], ["newest", "Newest"], ["oldest", "Oldest"], ["updated", "Recently updated"], ["downloads", "Most downloaded"], ["selling", "Best selling"], ["rating", "Highest rated"], ["price-low", "Price: low to high"], ["price-high", "Price: high to low"]].map(([value, label]) => `<option value="${value}" ${value === baseFilters.sort ? "selected" : ""}>${label}</option>`).join("")}
          </select></div>
          <button class="button primary" type="submit">Apply filters</button>
        </form>
      </aside>
      <div>
        <div class="market-toolbar">
          <span>${resources.length.toLocaleString()} matching resources</span>
          <div>${CONFIG.categories.slice(0, 4).map((category) => `<a class="chip small" href="${route(`/resources/${category.id}/`)}">${escapeHtml(category.name)}</a>`).join("")}</div>
        </div>
        ${resources.length ? `<div class="resource-grid">${resources.map(resourceCard).join("")}</div>` : emptyShelf("Marketplace", `${CONFIG.copy.emptyResources} Admins can publish resources from the protected admin panel.`, "/resources/")}
      </div>
    </div>
  </section>`);
  $("#resourceFilters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) if (clean(value)) next.set(key, value);
    location.href = `${location.pathname}?${next.toString()}`;
  });
}

function renderResourceDetail(state) {
  const slug = pageSlug() || new URLSearchParams(location.search).get("slug") || "";
  const resource = (state.resources || []).find((item) => item.slug === slug || item.id === slug);
  if (!resource || resource.status !== "published") {
    layout(state, `<div class="notice">That resource could not be found or has not been published.</div>`);
    return;
  }
  const tab = new URLSearchParams(location.search).get("tab") || "overview";
  const owned = ownsResource(state, resource.id);
  const images = [resource.coverImage, ...(resource.showcaseImages || [])].filter(Boolean);
  setSeo(resource.seoTitle || `${resource.name} | IconBuilds`, resource.seoDescription || resource.shortDescription || CONFIG.seo.description, `${CONFIG.site.url}/resources/${resource.slug}/`, CONFIG.seo.robotsIndex);
  layout(state, `<section class="section">
    <nav class="muted"><a href="${route("/resources/")}">Resources</a> / ${escapeHtml(categoryById(resource.category).name)} / ${escapeHtml(resource.name)}</nav>
    <div class="resource-layout">
      <article>
        <div class="section-head"><div><p class="eyebrow">${escapeHtml(categoryById(resource.category).name)}</p><h1 class="resource-title">${escapeHtml(resource.name)}</h1><p class="section-copy">${escapeHtml(resource.shortDescription || "")}</p></div></div>
        <div class="tabs">
          ${["overview", "dependencies", "updates", "reviews"].map((name) => `<a class="tab-button ${tab === name ? "active" : ""}" href="${resourceUrl(resource)}?tab=${name}">${name.charAt(0).toUpperCase() + name.slice(1)}</a>`).join("")}
        </div>
        ${resourceTab(resource, state, tab, images)}
      </article>
      <aside class="purchase-box">
        <div class="panel">
          <div class="price-line"><span>${resource.free ? "Download access" : "License"}</span><strong>${escapeHtml(priceLabel(resource))}</strong></div>
          <p class="muted">Published by ${escapeHtml(resource.ownershipLabel || "IconRealms")}.</p>
          <div class="badge-row">
            ${(resource.minecraftVersions || []).slice(0, 5).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}
            ${(resource.serverSoftware || []).slice(0, 4).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join("")}
          </div>
          <div class="form-actions" style="margin-top:14px">
            ${resource.free ? `<button class="button primary" data-add-free="${resource.id}">${owned ? "In Library" : "Add Free Resource"}</button>` : `<button class="button primary" data-checkout="${resource.id}">${owned ? "Purchased" : "Buy with Stripe"}</button>`}
            <button class="button" data-download="${resource.id}" ${owned ? "" : "disabled"}>Download</button>
            <button class="button" data-favorite="${resource.id}">Favorite</button>
          </div>
        </div>
        <div class="panel">
          <h3>Resource details</h3>
          <p class="muted">Version: ${escapeHtml(resource.currentVersion || "1.0.0")}</p>
          <p class="muted">Updated: ${escapeHtml(formatDate(resource.updatedAt))}</p>
          <p class="muted">Downloads: ${Number(resource.downloadCount || 0).toLocaleString()}</p>
          <p class="muted">Rating: ${stars(resource.averageRating || 0)} (${Number(resource.reviewCount || 0)} reviews)</p>
        </div>
      </aside>
    </div>
  </section>`);
  bindResourceActions();
}

function resourceTab(resource, state, tab, images) {
  if (tab === "dependencies") {
    const deps = resource.dependencies || [];
    return deps.length ? `<div class="grid">${deps.map((dep) => `<div class="panel"><h3>${escapeHtml(dep.name)}</h3><p class="muted">${escapeHtml(dep.required ? "Required" : "Optional")} ${dep.version ? `- ${escapeHtml(dep.version)}` : ""}</p><p>${escapeHtml(dep.description || "")}</p>${dep.url ? `<a class="button" href="${escapeHtml(dep.url)}" target="_blank" rel="noopener">Open dependency</a>` : ""}</div>`).join("")}</div>` : `<div class="empty">This resource has no required dependencies.</div>`;
  }
  if (tab === "updates") {
    const updates = [...(resource.updates || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return updates.length ? `<div class="grid">${updates.map((update) => `<div class="panel"><h3>v${escapeHtml(update.version)} - ${escapeHtml(update.title || "Update")}</h3><p class="muted">${escapeHtml(formatDate(update.date))}</p><div class="rich-text">${safeRichText(update.changelog || "")}</div></div>`).join("")}</div>` : `<div class="empty">No changelogs have been published yet.</div>`;
  }
  if (tab === "reviews") return reviewsMarkup(resource, state);
  return `<div class="gallery-main">${images[0] ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(resource.imageAlt || resource.name)}">` : `<div class="resource-cover-placeholder large"><span>${escapeHtml(categoryById(resource.category).name)}</span><strong>${escapeHtml(initials(resource.name))}</strong></div>`}</div>
    ${images.length > 1 ? `<div class="showcase-strip">${images.map((image) => `<button type="button"><img src="${escapeHtml(image)}" alt="${escapeHtml(resource.name)} showcase image"></button>`).join("")}</div>` : ""}
    ${resource.youtubeUrl ? `<div class="panel" style="margin-top:14px"><a class="button" href="${escapeHtml(resource.youtubeUrl)}" target="_blank" rel="noopener">Watch trailer</a></div>` : ""}
    <div class="panel rich-text" style="margin-top:14px">${safeRichText(resource.description || "No description has been published yet.")}</div>
    ${resource.installation ? `<div class="panel rich-text" style="margin-top:14px"><h2>Installation</h2>${safeRichText(resource.installation)}</div>` : ""}
    ${resource.supportInfo ? `<div class="panel rich-text" style="margin-top:14px"><h2>Support</h2>${safeRichText(resource.supportInfo)}</div>` : ""}
    ${resource.notices ? `<div class="panel rich-text" style="margin-top:14px"><h2>Important notices</h2>${safeRichText(resource.notices)}</div>` : ""}`;
}

function safeRichText(value = "") {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let list = "";
  let code = false;
  let codeLines = [];
  const inline = (text) => escapeHtml(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img class="rich-image" src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = "";
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) {
      if (code) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        code = false;
      } else {
        closeList();
        code = true;
      }
      continue;
    }
    if (code) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeList();
      html.push("<hr>");
    } else if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(2))}</h2>`);
    } else if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^\|.+\|$/.test(line)) {
      closeList();
      const cells = line.split("|").slice(1, -1).map((cell) => `<td>${inline(cell.trim())}</td>`).join("");
      html.push(`<table><tr>${cells}</tr></table>`);
    } else if (/^- /.test(line)) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  if (codeLines.length) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("");
}

function ownsResource(state, resourceId) {
  const userId = state.user?.id;
  if (!userId) return false;
  return (state.library || []).some((item) => item.userId === userId && item.resourceId === resourceId);
}

function reviewsMarkup(resource, state) {
  const reviews = (state.reviews || []).filter((item) => item.resourceId === resource.id && !item.hidden);
  const userReview = state.user ? reviews.find((item) => item.userId === state.user.id) : null;
  return `<div class="grid">
    ${state.user ? reviewForm(resource, userReview) : `<div class="empty">Log in to review this resource.</div>`}
    ${reviews.length ? reviews.map((review) => `<article class="panel"><h3>${stars(review.rating)} ${escapeHtml(review.title || "Review")}</h3><p class="muted">${escapeHtml(review.username || "User")} - ${escapeHtml(formatDate(review.updatedAt || review.createdAt))} ${review.verifiedPurchase ? "- Verified Purchase" : ""}${review.editedAt ? " - Edited" : ""}</p><p>${escapeHtml(review.comment || "")}</p><button class="button" data-report-review="${review.id}">Report</button></article>`).join("") : `<div class="empty">No public reviews yet.</div>`}
  </div>`;
}

function reviewForm(resource, review) {
  return `<form id="reviewForm" class="panel form">
    <h3>${review ? "Edit your review" : "Leave a review"}</h3>
    <div class="form-grid"><div class="field"><label>Rating</label><select class="select" name="rating">${[5,4,3,2,1].map((n) => `<option value="${n}" ${Number(review?.rating) === n ? "selected" : ""}>${n} stars</option>`).join("")}</select></div><div class="field"><label>Title</label><input class="input" name="title" value="${escapeHtml(review?.title || "")}" required></div></div>
    <div class="field"><label>Comment</label><textarea class="textarea" name="comment" required>${escapeHtml(review?.comment || "")}</textarea></div>
    <div class="form-actions"><button class="button primary" type="submit">${review ? "Save review" : "Post review"}</button>${review ? `<button class="button danger" data-delete-review="${review.id}" type="button">Delete review</button>` : ""}</div>
  </form>`;
}

function bindResourceActions() {
  $$("[data-checkout]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("createCheckout", { resourceId: button.dataset.checkout });
      location.href = result.url;
    } catch (error) {
      if (error.status === 401) location.href = route(`/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
      else toast(error.message);
    }
  }));
  $$("[data-add-free]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("addFreeResource", { resourceId: button.dataset.addFree, acceptedTerms: true });
      toast(result.message || "Resource added to your library.");
      boot();
    } catch (error) {
      if (error.status === 401) location.href = route(`/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
      else toast(error.message);
    }
  }));
  $$("[data-download]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("download", { resourceId: button.dataset.download });
      if (result.downloadUrl) location.href = result.downloadUrl;
      else toast(result.message || "Download is not configured yet.");
    } catch (error) {
      if (error.status === 401) location.href = route(`/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
      else toast(error.message);
    }
  }));
  $$("[data-favorite]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("favorite", { resourceId: button.dataset.favorite });
      toast(result.favorited ? "Added to favorites." : "Removed from favorites.");
    } catch (error) {
      if (error.status === 401) location.href = route(`/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
      else toast(error.message);
    }
  }));
  $("#reviewForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resourceId = currentResourceId();
    try {
      await request("saveReview", { resourceId, rating: form.get("rating"), title: form.get("title"), comment: form.get("comment") });
      toast("Review saved.");
      boot();
    } catch (error) {
      toast(error.message);
    }
  });
  $$("[data-delete-review]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await request("deleteReview", { reviewId: button.dataset.deleteReview });
      toast("Review deleted.");
      boot();
    } catch (error) {
      toast(error.message);
    }
  }));
  $$("[data-report-review]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await request("reportReview", { reviewId: button.dataset.reportReview });
      toast("Review reported.");
    } catch (error) {
      toast(error.message);
    }
  }));
}

function currentResourceId() {
  const slug = pageSlug();
  return window.__iconBuildsState?.resources?.find((item) => item.slug === slug || item.id === slug)?.id || "";
}

function renderLogin(state) {
  setSeo("Login | IconBuilds", "Login to IconBuilds.", `${CONFIG.site.url}/login/`, CONFIG.seo.robotsPrivate);
  const next = new URLSearchParams(location.search).get("next") || "/account/";
  layout(state, `<section class="section"><div class="grid two">
    <form id="loginForm" class="panel form">
      <h1 class="section-title">Login</h1>
      <div class="field"><label>Email or username</label><input class="input" name="login" autocomplete="username" required></div>
      <div class="field"><label>Password</label><input class="input" type="password" name="password" autocomplete="current-password" required></div>
      <button class="button primary" type="submit">Login</button>
      <a class="button" href="${apiUrl("googleStart", { next })}">Continue with Google</a>
      <p class="muted">Need an account? <a href="${route(`/signup/?next=${encodeURIComponent(next)}`)}">Create one</a>.</p>
    </form>
    <div class="panel"><h2>Account required for downloads</h2><p class="muted">Users must log in before purchasing, downloading free resources, reviewing, or managing a library.</p></div>
  </div></section>`);
  $("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const result = await request("login", { login: form.get("login"), password: form.get("password") });
      store.session = { token: result.token, user: result.user };
      location.href = result.user.emailVerified ? route(next) : route(`/verify/?next=${encodeURIComponent(next)}`);
    } catch (error) {
      toast(error.message);
    }
  });
}

function renderSignup(state) {
  setSeo("Sign Up | IconBuilds", "Create an IconBuilds account.", `${CONFIG.site.url}/signup/`, CONFIG.seo.robotsPrivate);
  const next = new URLSearchParams(location.search).get("next") || "/account/";
  layout(state, `<section class="section"><form id="signupForm" class="panel form">
    <h1 class="section-title">Create Account</h1>
    <div class="form-grid"><div class="field"><label>Username</label><input class="input" name="username" required></div><div class="field"><label>Email</label><input class="input" name="email" type="email" required></div></div>
    <div class="field"><label>Password</label><input class="input" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
    <label class="check-row"><input type="checkbox" name="emailOptIn"> Send me news, updates, and resource announcements.</label>
    <label class="check-row"><input type="checkbox" name="termsAccepted" required> I accept the IconBuilds Terms and resource rules.</label>
    <button class="button primary" type="submit">Create account</button>
    <a class="button" href="${apiUrl("googleStart", { next })}">Continue with Google</a>
  </form></section>`);
  $("#signupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const result = await request("register", {
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
        emailOptIn: form.get("emailOptIn") === "on",
        termsAccepted: form.get("termsAccepted") === "on"
      });
      store.session = { token: result.token, user: result.user };
      toast(result.message || "Verification email sent.");
      location.href = route(`/verify/?next=${encodeURIComponent(next)}`);
    } catch (error) {
      toast(error.message);
    }
  });
}

function renderVerify(state) {
  const user = state.user || store.session?.user;
  setSeo("Verify Email | IconBuilds", "Verify your IconBuilds email.", `${CONFIG.site.url}/verify/`, CONFIG.seo.robotsPrivate);
  if (!user) {
    layout(state, `<div class="notice">Log in or sign up before verifying your email.</div>`);
    return;
  }
  if (user.emailVerified) {
    layout(state, `<div class="notice">Your email is already verified. <a href="${route("/account/")}">Open your account.</a></div>`);
    return;
  }
  layout(state, `<section class="section"><div class="panel form">
    <h1 class="section-title">Email Verification</h1>
    <p class="section-copy">Enter the 6-digit code sent to <strong>${escapeHtml(user.email)}</strong>. You cannot access account downloads or purchases until this is complete.</p>
    <form id="verifyForm" class="form-grid"><input class="input" name="code" inputmode="numeric" maxlength="6" placeholder="000000" required><button class="button primary" type="submit">Verify email</button></form>
    <div class="row-actions"><button id="resendCode" class="button">Resend email</button><button id="refreshVerification" class="button">Refresh status</button><button id="logoutVerify" class="button">Logout</button></div>
    <form id="changeEmailForm" class="form-grid"><input class="input" type="email" name="email" placeholder="Change email address"><button class="button" type="submit">Change email</button></form>
  </div></section>`);
  $("#verifyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await request("verifyEmail", { code: new FormData(event.currentTarget).get("code") });
      store.session = { token: result.token, user: result.user };
      location.href = route(new URLSearchParams(location.search).get("next") || "/account/");
    } catch (error) {
      toast(error.message);
    }
  });
  $("#resendCode")?.addEventListener("click", async () => {
    try {
      const result = await request("resendVerification", {});
      toast(result.message || "Verification email sent.");
    } catch (error) {
      toast(error.message);
    }
  });
  $("#changeEmailForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await request("changeVerificationEmail", { email: new FormData(event.currentTarget).get("email") });
      store.session = { token: result.token, user: result.user };
      toast(result.message || "Email changed. Verification email sent.");
      boot();
    } catch (error) {
      toast(error.message);
    }
  });
  $("#refreshVerification")?.addEventListener("click", boot);
  $("#logoutVerify")?.addEventListener("click", () => {
    store.session = null;
    location.href = route("/");
  });
}

function renderAccount(state) {
  if (!state.user) {
    location.href = route(`/login/?next=${encodeURIComponent("/account/")}`);
    return;
  }
  if (mustVerify(state.user)) {
    location.href = route(`/verify/?next=${encodeURIComponent("/account/")}`);
    return;
  }
  const library = (state.library || []).filter((item) => item.userId === state.user.id);
  const resourcesById = new Map((state.resources || []).map((item) => [item.id, item]));
  layout(state, `<section class="section">
    <div class="section-head"><div><h1 class="section-title">Your Library</h1><p class="section-copy">Purchased and free resources added to your account.</p></div></div>
    <div class="grid three">
      ${library.length ? library.map((item) => resourceCard(resourcesById.get(item.resourceId) || { name: "Unavailable resource", free: true, category: "plugins", id: item.resourceId })).join("") : `<div class="empty">Your library is empty. Browse resources to add free resources or purchase premium ones.</div>`}
    </div>
  </section>
  <section class="section"><div class="grid two">
    <div class="panel"><h2>Purchase history</h2>${historyList(state.purchases, state.user.id, resourcesById, "purchase")}</div>
    <div class="panel"><h2>Download history</h2>${historyList(state.downloads, state.user.id, resourcesById, "download")}</div>
  </div></section>
  <section class="section"><div class="panel"><h2>Account Settings</h2><p class="muted">Email: ${escapeHtml(state.user.email)} (${state.user.emailVerified ? "verified" : "not verified"})</p><p class="muted">Role: ${escapeHtml(state.user.role || "user")}</p></div></section>`);
}

function historyList(items = [], userId, resourcesById, label) {
  const mine = items.filter((item) => item.userId === userId);
  return mine.length ? `<ul>${mine.map((item) => `<li>${escapeHtml(resourcesById.get(item.resourceId)?.name || item.resourceId)} - ${escapeHtml(formatDate(item.createdAt))}</li>`).join("")}</ul>` : `<p class="muted">No ${label} history yet.</p>`;
}

function renderAdmin(state) {
  if (!isAdmin(state.user)) {
    layout(state, `<div class="notice danger">Admin access is required.</div>`);
    return;
  }
  const draftCount = (state.resources || []).filter((item) => item.status !== "published").length;
  const publishedCount = (state.resources || []).filter((item) => item.status === "published").length;
  layout(state, `<section class="section">
    <div class="section-head"><div><p class="eyebrow">Protected Admin</p><h1 class="section-title">IconBuilds Admin</h1><p class="section-copy">Only server-side admin roles can create, upload, publish, update, or remove resources.</p></div></div>
    <div class="grid four">
      ${stat("Users", state.stats?.totalUsers || 0)}
      ${stat("Published", publishedCount)}
      ${stat("Drafts", draftCount)}
      ${stat("Revenue", formatMoney(state.stats?.revenueCents || 0))}
    </div>
  </section>
  <section class="section">
    <div class="grid two">
      <div class="panel">${adminResourceForm()}</div>
      <div class="panel"><h2>Resources</h2>${adminResourceTable(state.resources || [])}</div>
    </div>
  </section>
  <section class="section">
    <div class="grid two">
      <div class="panel"><h2>Users</h2>${adminUserTable(state.users || [])}</div>
      <div class="panel"><h2>Review Moderation</h2>${adminReviewTable(state.reviews || [])}</div>
    </div>
  </section>`);
  bindAdmin(state);
}

function stat(label, value) {
  return `<div class="card stat-card"><p class="muted">${escapeHtml(label)}</p><h3>${escapeHtml(String(value))}</h3></div>`;
}

function adminResourceForm(resource = {}) {
  return `<form id="resourceForm" class="form">
    <h2>${resource.id ? "Edit Resource" : "Create Resource"}</h2>
    <input type="hidden" name="id" value="${escapeHtml(resource.id || "")}">
    <div class="form-grid"><div class="field"><label>Name</label><input class="input" name="name" value="${escapeHtml(resource.name || "")}" required></div><div class="field"><label>Slug</label><input class="input" name="slug" value="${escapeHtml(resource.slug || "")}" placeholder="auto-generated if empty"></div></div>
    <div class="field"><label>Short description</label><input class="input" name="shortDescription" value="${escapeHtml(resource.shortDescription || "")}" required></div>
    <div class="form-grid"><div class="field"><label>Category</label><select class="select" name="category">${CONFIG.categories.map((cat) => `<option value="${cat.id}" ${resource.category === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`).join("")}</select></div><div class="field"><label>Ownership label</label><select class="select" name="ownershipLabel">${CONFIG.resource.ownershipLabels.map((label) => `<option ${resource.ownershipLabel === label ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></div></div>
    <div class="form-grid"><div class="field"><label>Free or paid</label><select class="select" name="free"><option value="true" ${resource.free ? "selected" : ""}>Free</option><option value="false" ${!resource.free ? "selected" : ""}>Paid</option></select></div><div class="field"><label>Price cents</label><input class="input" name="priceCents" type="number" min="0" value="${Number(resource.priceCents || 0)}"></div></div>
    <div class="form-grid"><div class="field"><label>Status</label><select class="select" name="status"><option value="draft" ${resource.status !== "published" ? "selected" : ""}>Draft</option><option value="published" ${resource.status === "published" ? "selected" : ""}>Published</option></select></div><label class="check-row"><input type="checkbox" name="featured" ${resource.featured ? "checked" : ""}> Featured</label></div>
    <div class="field"><label>Cover image URL</label><input class="input" name="coverImage" value="${escapeHtml(resource.coverImage || "")}"></div>
    <div class="field"><label>Showcase image URLs, one per line, max 4</label><textarea class="textarea" name="showcaseImages">${escapeHtml((resource.showcaseImages || []).join("\n"))}</textarea></div>
    <div class="form-grid"><div class="field"><label>YouTube trailer</label><input class="input" name="youtubeUrl" value="${escapeHtml(resource.youtubeUrl || "")}"></div><div class="field"><label>Protected file URL</label><input class="input" name="fileUrl" value="${escapeHtml(resource.fileUrl || "")}"></div></div>
    <div class="form-grid"><div class="field"><label>Current version</label><input class="input" name="currentVersion" value="${escapeHtml(resource.currentVersion || "1.0.0")}"></div><div class="field"><label>Tags, comma separated</label><input class="input" name="tags" value="${escapeHtml((resource.tags || []).join(", "))}"></div></div>
    <div class="form-grid"><div class="field"><label>Minecraft versions, comma separated</label><input class="input" name="minecraftVersions" value="${escapeHtml((resource.minecraftVersions || []).join(", "))}"></div><div class="field"><label>Server software, comma separated</label><input class="input" name="serverSoftware" value="${escapeHtml((resource.serverSoftware || []).join(", "))}"></div></div>
    <div class="field"><label>Compatibility, comma separated</label><input class="input" name="compatibility" value="${escapeHtml((resource.compatibility || []).join(", "))}"></div>
    <div class="field"><label>Full rich description</label><textarea class="textarea" name="description" placeholder="Markdown-style headings, lists, links, code blocks, and embedded image URLs are sanitized.">${escapeHtml(resource.description || "")}</textarea></div>
    <div class="field"><label>Dependencies JSON</label><textarea class="textarea" name="dependencies" placeholder='[{"name":"Vault","required":true,"version":"1.7","description":"Economy bridge","url":"https://..."}]'>${escapeHtml(JSON.stringify(resource.dependencies || [], null, 2))}</textarea></div>
    <div class="field"><label>Updates JSON</label><textarea class="textarea" name="updates" placeholder='[{"version":"1.0.1","title":"Patch","date":"2026-07-22","changelog":"Fixed..."}]'>${escapeHtml(JSON.stringify(resource.updates || [], null, 2))}</textarea></div>
    <div class="field"><label>Installation</label><textarea class="textarea" name="installation">${escapeHtml(resource.installation || "")}</textarea></div>
    <div class="field"><label>Support info</label><textarea class="textarea" name="supportInfo">${escapeHtml(resource.supportInfo || "")}</textarea></div>
    <div class="field"><label>SEO title</label><input class="input" name="seoTitle" value="${escapeHtml(resource.seoTitle || "")}"></div>
    <div class="field"><label>SEO description</label><input class="input" name="seoDescription" value="${escapeHtml(resource.seoDescription || "")}"></div>
    <div class="field"><label>Image alt text</label><input class="input" name="imageAlt" value="${escapeHtml(resource.imageAlt || "")}"></div>
    <button class="button primary" type="submit">Save resource</button>
  </form>`;
}

function adminResourceTable(resources) {
  return resources.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Status</th><th>Price</th><th></th></tr></thead><tbody>${resources.map((resource) => `<tr><td>${escapeHtml(resource.name)}</td><td>${escapeHtml(resource.status || "draft")}</td><td>${escapeHtml(priceLabel(resource))}</td><td><button class="button" data-edit-resource="${resource.id}">Edit</button> <button class="button" data-toggle-publish="${resource.id}">${resource.status === "published" ? "Unpublish" : "Publish"}</button> <button class="button danger" data-delete-resource="${resource.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No resources exist yet.</p>`;
}

function adminUserTable(users) {
  return users.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Verified</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role || "user")}</td><td>${user.emailVerified ? "Yes" : "No"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No users yet.</p>`;
}

function adminReviewTable(reviews) {
  return reviews.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Review</th><th>Status</th><th></th></tr></thead><tbody>${reviews.map((review) => `<tr><td>${escapeHtml(review.title || review.comment || review.id)}</td><td>${review.hidden ? "Hidden" : "Visible"}</td><td><button class="button" data-toggle-review="${review.id}">${review.hidden ? "Restore" : "Hide"}</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No reviews yet.</p>`;
}

function bindAdmin(state) {
  $("#resourceForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const resource = Object.fromEntries(form.entries());
    resource.free = resource.free === "true";
    resource.featured = form.get("featured") === "on";
    resource.priceCents = Number(resource.priceCents || 0);
    resource.showcaseImages = lines(resource.showcaseImages).slice(0, CONFIG.resource.showcaseImageLimit);
    resource.tags = csv(resource.tags);
    resource.minecraftVersions = csv(resource.minecraftVersions);
    resource.serverSoftware = csv(resource.serverSoftware);
    resource.compatibility = csv(resource.compatibility);
    try {
      resource.dependencies = JSON.parse(resource.dependencies || "[]");
      resource.updates = JSON.parse(resource.updates || "[]");
      const result = await request("admin", { command: "saveResource", resource });
      toast("Resource saved.");
      renderAdmin(result);
    } catch (error) {
      toast(error.message);
    }
  });
  $$("[data-edit-resource]").forEach((button) => button.addEventListener("click", () => {
    const resource = (state.resources || []).find((item) => item.id === button.dataset.editResource);
    $(".panel").innerHTML = adminResourceForm(resource);
    bindAdmin(state);
  }));
  $$("[data-toggle-publish]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("admin", { command: "togglePublishResource", id: button.dataset.togglePublish });
      renderAdmin(result);
    } catch (error) {
      toast(error.message);
    }
  }));
  $$("[data-delete-resource]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("Delete this resource permanently?")) return;
    try {
      const result = await request("admin", { command: "deleteResource", id: button.dataset.deleteResource });
      renderAdmin(result);
    } catch (error) {
      toast(error.message);
    }
  }));
  $$("[data-toggle-review]").forEach((button) => button.addEventListener("click", async () => {
    try {
      const result = await request("admin", { command: "toggleReview", id: button.dataset.toggleReview });
      renderAdmin(result);
    } catch (error) {
      toast(error.message);
    }
  }));
}

function lines(value = "") {
  return String(value || "").split(/\r?\n/).map(clean).filter(Boolean);
}

function csv(value = "") {
  return String(value || "").split(",").map(clean).filter(Boolean);
}

function formatMoney(cents = 0) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.resource.currency || "USD" }).format(Number(cents || 0) / 100);
}

function renderCheckoutSuccess(state) {
  layout(state, `<section class="section"><div class="panel"><h1 class="section-title">Confirming purchase</h1><p class="section-copy">We are checking Stripe before adding the resource to your library.</p><div id="checkoutStatus" class="notice">Working...</div></div></section>`);
  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (!sessionId) {
    $("#checkoutStatus").textContent = "Missing checkout session.";
    return;
  }
  request("checkoutSuccess", { sessionId }).then((result) => {
    $("#checkoutStatus").textContent = result.message || "Purchase confirmed.";
    window.setTimeout(() => location.href = route("/account/"), 1300);
  }).catch((error) => {
    $("#checkoutStatus").textContent = error.message;
  });
}

function renderStaticPage(state, key) {
  const pages = {
    terms: ["Terms of Service", "Use IconBuilds responsibly. Resources are distributed by IconRealms, accounts must remain secure, and purchases/downloads must not be abused or redistributed without permission."],
    privacy: ["Privacy Policy", "IconBuilds stores the information needed for accounts, verification, purchases, downloads, reviews, reports, support, and abuse prevention. We do not sell personal information."],
    refund: ["Refund Policy", "Digital resource purchases may be reviewed for refunds when access fails, the resource is materially misrepresented, or support cannot resolve a verified issue."],
    guidelines: ["Community Guidelines", "Reviews, reports, names, and comments must remain honest, safe, and respectful. Spam, scams, harassment, malware, piracy, and personal information are not allowed."],
    support: ["Support", `Need help with purchases, downloads, verification, or resource access? Email ${CONFIG.site.supportEmail} or join the IconRealms Discord.`],
    "not-found": ["Page Not Found", "That page does not exist or the resource has not been published."]
  };
  const [title, body] = pages[key] || pages["not-found"];
  setSeo(`${title} | IconBuilds`, body, `${CONFIG.site.url}/${key === "not-found" ? "" : `${key}/`}`, key === "not-found" ? CONFIG.seo.robotsPrivate : CONFIG.seo.robotsIndex);
  layout(state, `<section class="section"><div class="panel"><h1 class="section-title">${escapeHtml(title)}</h1><p class="section-copy">${escapeHtml(body)}</p></div></section>`);
}

async function boot() {
  const page = pageName();
  let state = { user: store.session?.user || null, resources: [], reviews: [], purchases: [], downloads: [], library: [], users: [], stats: {} };
  try {
    const extra = page === "resource" ? { resourceSlug: pageSlug() } : {};
    state = await getState(extra);
  } catch (error) {
    console.warn("IconBuilds state load failed", error);
  }
  window.__iconBuildsState = state;
  if (mustVerify(state.user) && !["verify", "login", "signup"].includes(page)) {
    location.href = route(`/verify/?next=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  if (page === "home") renderHome(state);
  else if (page === "resources") renderMarketplace(state);
  else if (page === "free") renderMarketplace(state, "free");
  else if (page === "premium") renderMarketplace(state, "premium");
  else if (page === "resource") renderResourceDetail(state);
  else if (page === "login") renderLogin(state);
  else if (page === "signup") renderSignup(state);
  else if (page === "verify") renderVerify(state);
  else if (page === "account") renderAccount(state);
  else if (page === "admin") renderAdmin(state);
  else if (page === "checkout-success") renderCheckoutSuccess(state);
  else renderStaticPage(state, page);
}

function stars(value) {
  const rating = Math.round(Number(value || 0));
  const full = "&#9733;";
  const empty = "&#9734;";
  return `${full.repeat(rating)}${empty.repeat(Math.max(0, 5 - rating))}`;
}

document.addEventListener("DOMContentLoaded", boot);
