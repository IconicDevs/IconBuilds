(function () {
  const config = window.IconBuildsConfig;
  const app = document.querySelector("#app");

  const state = {
    resources: [],
    source: "loading",
    query: "",
    category: "",
    price: "",
    sort: "recommended",
    activeTab: "overview"
  };

  const routes = {
    "/": renderHome,
    "/resources": renderMarketplace,
    "/free": () => renderListingPage("Free Resources", "Free downloads from IconRealms will show here.", (r) => r.free),
    "/premium": () => renderListingPage("Premium Resources", "Paid resources from IconRealms will show here.", (r) => !r.free),
    "/support": () => renderSimplePage("Support", "Resource support, refunds, account help, and community links will live here."),
    "/login": () => renderSimplePage("Login", "Email/password and Google login connect here. Downloads and purchases require a verified account."),
    "/terms": () => renderSimplePage("Terms of Service", "Publish the production terms before launch."),
    "/privacy": () => renderSimplePage("Privacy Policy", "Publish the production privacy policy before launch."),
    "/refunds": () => renderSimplePage("Refund Policy", "Publish the production refund policy before launch."),
    "/community": () => renderSimplePage("Community Guidelines", "Publish the production community guidelines before launch."),
    "/contact": () => renderSimplePage("Contact", "Add official IconRealms contact options here."),
    "/admin": renderAdmin
  };

  init();

  async function init() {
    bindNavigation();
    await loadResources();
    renderCurrentRoute();
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === "/discord") return;
      event.preventDefault();
      history.pushState({}, "", url.pathname + url.search);
      renderCurrentRoute();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("popstate", renderCurrentRoute);
  }

  async function loadResources() {
    try {
      const response = await fetch("/api/resources");
      if (!response.ok) throw new Error("Resource API failed");
      const payload = await response.json();
      state.resources = Array.isArray(payload.resources) ? payload.resources : [];
      state.source = payload.source || "api";
    } catch (error) {
      state.resources = [];
      state.source = "offline";
    }
  }

  function renderCurrentRoute() {
    updateActiveNav();
    const path = window.location.pathname.replace(/\/$/, "") || "/";

    if (path.startsWith("/resources/")) {
      renderResourceDetail(path.split("/").pop());
      return;
    }

    const route = routes[path] || renderNotFound;
    route();
  }

  function updateActiveNav() {
    document.querySelectorAll(".main-nav a").forEach((link) => {
      const url = new URL(link.href);
      link.classList.toggle("active", url.pathname === window.location.pathname);
    });
  }

  function renderHome() {
    const featured = state.resources.filter((resource) => resource.featured);
    const free = state.resources.filter((resource) => resource.free);
    const premium = state.resources.filter((resource) => !resource.free);

    setMeta("IconBuilds | Official IconRealms Marketplace", "Premium Minecraft resources, built by IconRealms.");
    app.innerHTML = `
      <section class="page">
        <div class="shell hero">
          <div>
            <span class="eyebrow">${escapeHtml(config.hero.eyebrow)}</span>
            <h1>${escapeHtml(config.hero.heading)}</h1>
            <p>${escapeHtml(config.hero.description)}</p>
            <div class="hero-actions">
              <form class="search-box" data-search-form>
                <span aria-hidden="true">⌕</span>
                <input name="q" placeholder="Search plugins, builds, textures..." aria-label="Search resources">
              </form>
              <a class="button button-primary" href="/resources">Browse Resources</a>
            </div>
          </div>
          <div class="hero-board" aria-label="IconBuilds marketplace preview">
            <img class="hero-logo" src="${config.logo}" alt="">
            <div class="resource-shelf">
              <div class="shelf-item">
                <strong>Official releases only</strong>
                <span>Every listing is created, owned, licensed, or approved by IconRealms.</span>
              </div>
              <div class="shelf-item">
                <strong>Protected downloads</strong>
                <span>Free and paid resources require login before files are delivered.</span>
              </div>
              <div class="shelf-item">
                <strong>Plain, reliable stack</strong>
                <span>HTML, CSS, JavaScript, and Vercel serverless endpoints.</span>
              </div>
            </div>
          </div>
        </div>

        ${sectionBlock("Recommended for You", "Featured official resources appear here until account activity exists.", featured, "No resources have been published yet", "The marketplace is ready for the IconRealms team to publish its first official resource.")}
        ${sectionBlock("Free Resources", "Official free downloads will require login and protected delivery.", free, "No free resources yet", "Free IconRealms releases will show here once administrators publish them.")}
        ${sectionBlock("Premium Resources", "Paid resources will use verified checkout and protected library access.", premium, "No premium resources yet", "Premium IconRealms releases will show here once administrators publish them.")}
        ${benefitsBlock()}
        ${categoriesBlock()}
      </section>
    `;

    bindSearchForms();
  }

  function renderMarketplace() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    state.category = params.get("category") || "";
    state.price = params.get("price") || "";
    state.sort = params.get("sort") || "recommended";

    setMeta("Resources | IconBuilds", "Browse official IconBuilds resources from IconRealms.");
    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">Marketplace</span>
          <h1>Official Resources</h1>
          <p>Browse Minecraft and Discord resources published by the IconRealms team.</p>
        </div>
        <div class="shell section market-layout">
          <aside class="panel filters" aria-label="Resource filters">
            <div class="section-heading">
              <div>
                <h2>Filters</h2>
                <p>Search, narrow, and sort published resources.</p>
              </div>
            </div>
            <form data-filter-form>
              <label class="field">
                Search
                <input name="q" value="${escapeAttr(state.query)}" placeholder="Plugins, builds...">
              </label>
              <label class="field">
                Category
                <select name="category">
                  <option value="">All categories</option>
                  ${config.categories.map((category) => `<option value="${category.id}" ${state.category === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                Price
                <select name="price">
                  <option value="">Free and premium</option>
                  <option value="free" ${state.price === "free" ? "selected" : ""}>Free only</option>
                  <option value="premium" ${state.price === "premium" ? "selected" : ""}>Premium only</option>
                </select>
              </label>
              <label class="field">
                Sort
                <select name="sort">
                  ${sortOptions().map((option) => `<option value="${option.value}" ${state.sort === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
                </select>
              </label>
              <button class="button button-primary" type="submit">Apply filters</button>
            </form>
          </aside>
          <div>
            ${resourceGrid(filterResources(state.resources), "No published resources match this view", "Once administrators publish official resources, they will be searchable here.")}
          </div>
        </div>
      </section>
    `;

    document.querySelector("[data-filter-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const next = new URLSearchParams();
      ["q", "category", "price", "sort"].forEach((key) => {
        const value = String(form.get(key) || "").trim();
        if (value) next.set(key, value);
      });
      history.pushState({}, "", `/resources${next.toString() ? `?${next}` : ""}`);
      renderMarketplace();
    });
  }

  function renderListingPage(title, description, filter) {
    setMeta(`${title} | IconBuilds`, description);
    const resources = state.resources.filter(filter);
    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">Marketplace</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
        <div class="shell section">
          ${resourceGrid(resources, `No ${title.toLowerCase()} yet`, "Published resources from IconRealms will appear here.")}
        </div>
      </section>
    `;
  }

  function renderResourceDetail(slug) {
    const resource = state.resources.find((item) => item.slug === slug);
    if (!resource) {
      renderNotFound();
      return;
    }

    const category = getCategory(resource.categoryId);
    setMeta(`${resource.seoTitle || resource.title} | IconBuilds`, resource.seoDescription || resource.summary);

    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">${escapeHtml(category ? category.name : "Resource")}</span>
          <h1>${escapeHtml(resource.title)}</h1>
          <p>${escapeHtml(resource.summary)}</p>
        </div>

        <div class="shell section resource-layout">
          <article>
            <div class="resource-main-cover">
              ${resource.coverImage ? `<img src="${escapeAttr(resource.coverImage)}" alt="${escapeAttr(resource.imageAlt || resource.title)}">` : `<strong>${escapeHtml(resource.title)}</strong>`}
            </div>
            <div class="tabs" role="tablist">
              ${["overview", "dependencies", "updates", "reviews"].map((tab) => `<button class="tab ${state.activeTab === tab ? "active" : ""}" data-tab="${tab}" type="button">${capitalize(tab)}</button>`).join("")}
            </div>
            <div class="rich-content" data-tab-panel>
              ${tabContent(resource, state.activeTab)}
            </div>
          </article>

          <aside class="panel purchase-box">
            <h2>${resource.free ? "Download Resource" : "Buy a License"}</h2>
            <p class="notice">You must be logged in before downloading or purchasing. Files are delivered through protected endpoints.</p>
            <div class="meta">
              <span class="badge">${resource.free ? "Free" : money(resource.priceCents)}</span>
              <span>${resource.reviewCount ? `${resource.ratingAverage.toFixed(1)} rating` : "New listing"}</span>
            </div>
            <div class="hero-actions">
              <a class="button button-primary" href="/login">${resource.free ? "Login to download" : "Login to buy"}</a>
              <button class="button button-muted" type="button">Favorite</button>
              <button class="button button-muted" type="button" data-share="${escapeAttr(resource.slug)}">Share</button>
            </div>
            <dl class="details-list">
              <div><dt>Version</dt><dd>${escapeHtml(resource.currentVersion || "Not listed")}</dd></div>
              <div><dt>Ownership</dt><dd>${escapeHtml(resource.ownershipLabel || "IconRealms")}</dd></div>
              <div><dt>Supported versions</dt><dd>${escapeHtml((resource.supportedVersions || []).join(", ") || "Not listed")}</dd></div>
              <div><dt>Software</dt><dd>${escapeHtml((resource.supportedSoftware || []).join(", ") || "Not listed")}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    `;

    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        document.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
        document.querySelector("[data-tab-panel]").innerHTML = tabContent(resource, state.activeTab);
      });
    });

    const shareButton = document.querySelector("[data-share]");
    if (shareButton) {
      shareButton.addEventListener("click", async () => {
        const url = `${window.location.origin}/resources/${resource.slug}`;
        if (navigator.share) {
          await navigator.share({ title: resource.title, url });
        } else {
          await navigator.clipboard.writeText(url);
          shareButton.textContent = "Copied";
        }
      });
    }
  }

  function renderAdmin() {
    setMeta("Admin Resources | IconBuilds", "Protected IconBuilds resource management.");
    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">Protected Admin</span>
          <h1>Resource Management</h1>
          <p>This page is intentionally not linked in public navigation. The API still checks the admin key server-side.</p>
        </div>
        <div class="shell section admin-card">
          <p class="notice">Admin writes save to Vercel KV and mirror an encrypted, sanitized GitHub backup when environment variables are configured.</p>
          <form class="admin-form" data-admin-form>
            <label class="field wide">Admin API key <input name="adminKey" type="password" required autocomplete="off"></label>
            <label class="field">Title <input name="title" maxlength="80" required></label>
            <label class="field">Slug <input name="slug" placeholder="my-resource-name"></label>
            <label class="field wide">Summary <input name="summary" maxlength="180" required></label>
            <label class="field">Category <select name="categoryId" required><option value="">Select category</option>${config.categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join("")}</select></label>
            <label class="field">Status <select name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select></label>
            <label class="field">Payment <select name="free"><option value="true">Free</option><option value="false">Paid</option></select></label>
            <label class="field">Price <input name="price" type="number" min="0" step="0.01"></label>
            <label class="field">Version <input name="currentVersion" value="1.0.0" required></label>
            <label class="field">Ownership <select name="ownershipLabel">${config.ownershipLabels.map((label) => `<option>${escapeHtml(label)}</option>`).join("")}</select></label>
            <label class="field wide">Tags <input name="tags" placeholder="plugins, survival, economy"></label>
            <label class="field">Supported versions <input name="supportedVersions" placeholder="1.21.4, 1.20.6"></label>
            <label class="field">Supported software <input name="supportedSoftware" placeholder="Paper, Purpur"></label>
            <label class="field wide">Cover image URL <input name="coverImage" placeholder="/uploads/cover.png"></label>
            <label class="field wide">Rich description HTML <textarea name="descriptionHtml" placeholder="<h2>Overview</h2><p>...</p>"></textarea></label>
            <div class="wide hero-actions">
              <button class="button button-primary" type="submit">Save Resource</button>
              <span class="status-line" data-admin-status></span>
            </div>
          </form>
        </div>
      </section>
    `;

    document.querySelector("[data-admin-form]").addEventListener("submit", saveAdminResource);
  }

  async function saveAdminResource(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.querySelector("[data-admin-status]");
    const data = new FormData(form);
    const payload = {
      title: data.get("title"),
      slug: data.get("slug"),
      summary: data.get("summary"),
      categoryId: data.get("categoryId"),
      status: data.get("status"),
      free: data.get("free") === "true",
      priceCents: Math.round(Number(data.get("price") || 0) * 100),
      currentVersion: data.get("currentVersion"),
      ownershipLabel: data.get("ownershipLabel"),
      tags: splitList(data.get("tags")),
      supportedVersions: splitList(data.get("supportedVersions")),
      supportedSoftware: splitList(data.get("supportedSoftware")),
      coverImage: String(data.get("coverImage") || "").trim() || undefined,
      descriptionHtml: data.get("descriptionHtml")
    };

    status.className = "status-line";
    status.textContent = "Saving...";

    try {
      const response = await fetch("/api/admin-resources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": String(data.get("adminKey") || "")
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save resource.");
      status.className = "status-line success";
      status.textContent = "Saved. Published resources are now available and backed up.";
      form.reset();
      await loadResources();
    } catch (error) {
      status.className = "status-line error";
      status.textContent = error.message;
    }
  }

  function renderSimplePage(title, description) {
    setMeta(`${title} | IconBuilds`, description);
    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">IconBuilds</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
      </section>
    `;
  }

  function renderNotFound() {
    setMeta("Page Not Found | IconBuilds", "The page was not found.");
    app.innerHTML = `
      <section class="page">
        <div class="shell page-title">
          <span class="eyebrow">404</span>
          <h1>Page Not Found</h1>
          <p>The page may have moved, or the resource is not published.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="/resources">Browse resources</a>
          </div>
        </div>
      </section>
    `;
  }

  function sectionBlock(title, description, resources, emptyTitle, emptyMessage) {
    return `
      <section class="shell section">
        <div class="section-heading">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(description)}</p>
          </div>
          <a class="button button-muted" href="/resources">View all</a>
        </div>
        ${resourceGrid(resources, emptyTitle, emptyMessage)}
      </section>
    `;
  }

  function benefitsBlock() {
    const benefits = [
      ["Official Content", "Resources come from IconRealms or approved internal teams, with ownership shown clearly."],
      ["Protected Access", "Downloads are tied to verified accounts, accepted terms, and protected delivery endpoints."],
      ["Updates Stay Organized", "Libraries, version history, changelogs, and future updates are kept in one account area."],
      ["Tested Before Release", "Listings are reviewed before publishing so buyers know what they are getting."]
    ];
    return `
      <section class="shell section">
        <div class="section-heading">
          <div>
            <h2>Why Buy Through IconBuilds?</h2>
            <p>Practical trust points for people running real communities.</p>
          </div>
        </div>
        <div class="benefit-grid">
          ${benefits.map(([title, description]) => `<article class="benefit-card"><span class="category-icon">✓</span><h3>${title}</h3><p>${description}</p></article>`).join("")}
        </div>
      </section>
    `;
  }

  function categoriesBlock() {
    return `
      <section class="shell section">
        <div class="section-heading">
          <div>
            <h2>Categories</h2>
            <p>Edit these in <code>config.js</code> when IconBuilds expands.</p>
          </div>
        </div>
        <div class="category-grid">
          ${config.categories.map((category) => `<article class="category-card"><span class="category-icon">${escapeHtml(category.icon)}</span><h3>${escapeHtml(category.name)}</h3><p>${escapeHtml(category.description)}</p></article>`).join("")}
        </div>
      </section>
    `;
  }

  function resourceGrid(resources, emptyTitle, emptyMessage) {
    if (!resources.length) {
      return `<div class="empty-state"><span class="empty-mark">□</span><div><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyMessage)}</p></div></div>`;
    }
    return `<div class="resource-grid">${resources.map(resourceCard).join("")}</div>`;
  }

  function resourceCard(resource) {
    const category = getCategory(resource.categoryId);
    return `
      <a class="resource-card" href="/resources/${escapeAttr(resource.slug)}">
        <div class="cover">
          ${resource.coverImage ? `<img src="${escapeAttr(resource.coverImage)}" alt="${escapeAttr(resource.imageAlt || resource.title)}">` : `<span class="cover-placeholder">${escapeHtml(resource.title)}</span>`}
        </div>
        <div class="resource-card-body">
          <span class="badge">${escapeHtml(category ? category.name : "Resource")}</span>
          <h3>${escapeHtml(resource.title)}</h3>
          <p>${escapeHtml(resource.summary)}</p>
          <div class="meta">
            <span>${resource.free ? "Free" : money(resource.priceCents)}</span>
            <span>${resource.reviewCount ? `${resource.ratingAverage.toFixed(1)} rating` : "New"}</span>
          </div>
        </div>
      </a>
    `;
  }

  function filterResources(resources) {
    const filtered = resources.filter((resource) => {
      const query = state.query.toLowerCase();
      const matchesQuery =
        !query ||
        resource.title.toLowerCase().includes(query) ||
        resource.summary.toLowerCase().includes(query) ||
        (resource.tags || []).some((tag) => tag.toLowerCase().includes(query));
      const matchesCategory = !state.category || resource.categoryId === state.category;
      const matchesPrice =
        !state.price || (state.price === "free" && resource.free) || (state.price === "premium" && !resource.free);
      return matchesQuery && matchesCategory && matchesPrice;
    });

    return filtered.sort((a, b) => {
      if (state.sort === "newest") return dateValue(b.releaseDate) - dateValue(a.releaseDate);
      if (state.sort === "oldest") return dateValue(a.releaseDate) - dateValue(b.releaseDate);
      if (state.sort === "updated") return dateValue(b.lastUpdatedAt) - dateValue(a.lastUpdatedAt);
      if (state.sort === "downloads") return (b.downloads || 0) - (a.downloads || 0);
      if (state.sort === "rating") return (b.ratingAverage || 0) - (a.ratingAverage || 0);
      if (state.sort === "price-low") return (a.priceCents || 0) - (b.priceCents || 0);
      if (state.sort === "price-high") return (b.priceCents || 0) - (a.priceCents || 0);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }

  function tabContent(resource, tab) {
    if (tab === "dependencies") {
      if (!resource.dependencies || !resource.dependencies.length) {
        return "<p>This resource has no required dependencies.</p>";
      }
      return `<ul>${resource.dependencies.map((dependency) => `<li><strong>${escapeHtml(dependency.name)}</strong> ${dependency.required ? "Required" : "Optional"}${dependency.version ? `, ${escapeHtml(dependency.version)}` : ""}</li>`).join("")}</ul>`;
    }

    if (tab === "updates") {
      if (!resource.updates || !resource.updates.length) return "<p>No public updates have been posted yet.</p>";
      return resource.updates.map((update) => `<article><h2>${escapeHtml(update.version)} ${escapeHtml(update.title || "")}</h2><p>${escapeHtml(update.date || "")}</p><div>${sanitizeClientHtml(update.changelog || "")}</div></article>`).join("");
    }

    if (tab === "reviews") {
      return "<p>Reviews will appear here after logged-in customers submit them. IconBuilds does not show fake ratings or reviews.</p>";
    }

    return sanitizeClientHtml(resource.descriptionHtml || "<p>No description has been published yet.</p>");
  }

  function bindSearchForms() {
    document.querySelectorAll("[data-search-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const q = String(new FormData(form).get("q") || "").trim();
        history.pushState({}, "", `/resources${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        renderMarketplace();
      });
    });
  }

  function setMeta(title, description) {
    document.title = title;
    setMetaTag("description", description);
    setMetaProperty("og:title", title);
    setMetaProperty("og:description", description);
    setMetaProperty("og:url", window.location.href);
  }

  function setMetaTag(name, content) {
    const tag = document.querySelector(`meta[name="${name}"]`);
    if (tag) tag.setAttribute("content", content);
  }

  function setMetaProperty(property, content) {
    const tag = document.querySelector(`meta[property="${property}"]`);
    if (tag) tag.setAttribute("content", content);
  }

  function getCategory(id) {
    return config.categories.find((category) => category.id === id);
  }

  function sortOptions() {
    return [
      { value: "recommended", label: "Recommended" },
      { value: "newest", label: "Newest" },
      { value: "oldest", label: "Oldest" },
      { value: "updated", label: "Recently updated" },
      { value: "downloads", label: "Most downloaded" },
      { value: "rating", label: "Highest rated" },
      { value: "price-low", label: "Price: low to high" },
      { value: "price-high", label: "Price: high to low" }
    ];
  }

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function money(cents) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: config.currency
    }).format((cents || 0) / 100);
  }

  function dateValue(value) {
    return value ? new Date(value).getTime() || 0 : 0;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function sanitizeClientHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.querySelectorAll("script, iframe, object, embed, form, input, button, style, link, meta").forEach((node) => node.remove());
    template.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith("on") || value.startsWith("javascript:") || value.startsWith("data:")) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return template.innerHTML;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
