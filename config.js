onst IconBuildsConfig = {
  site: {
    name: "IconBuilds",
    owner: "IconRealms",
    domain: "minestore.org",
    url: "https://minestore.org",
    basePath: "",
    logo: "/logo.png",
    favicon: "/logo.png",
    supportEmail: "support@minestore.org",
    discordUrl: "https://discord.gg/HFyUfk458c",
    copyright: "IconBuilds is an IconRealms marketplace. Not affiliated with Mojang or Microsoft."
  },
  api: {
    basePath: "/api",
    productionBasePath: "/api",
    requestTimeoutMs: 25000
  },
  theme: {
    colors: {
      ink: "#070b12",
      inkSoft: "#101722",
      panel: "#151e2b",
      panelSoft: "#1b2636",
      border: "rgba(148, 163, 184, .22)",
      text: "#f8fbff",
      muted: "#9fb0c5",
      blue: "#734f96",
      cyan: "#cdb9e6",
      emerald: "#8d6bb0",
      violet: "#9d7bc4",
      pink: "#ec4899",
      amber: "#f59e0b"
    }
  },
  seo: {
    title: "IconBuilds | Premium Minecraft Resources by IconRealms",
    description:
      "Browse official IconRealms Minecraft plugins, builds, server setups, Skripts, configurations, graphics, textures, models, and Discord resources.",
    keywords: [
      "minecraft resources",
      "minecraft plugins",
      "minecraft builds",
      "minecraft server setups",
      "minecraft skripts",
      "minecraft configurations",
      "discord bot setups",
      "iconrealms",
      "iconbuilds"
    ],
    robotsIndex: "index, follow, max-image-preview:large",
    robotsPrivate: "noindex, nofollow"
  },
  copy: {
    heroEyebrow: "Minecraft Resource Marketplace",
    heroTitle: "Find the best resources for your Minecraft server",
    heroBody:
      "Browse official IconRealms plugins, builds, setups, graphics, textures, models, Skripts, and Discord resources.",
    searchPlaceholder: "Search resources...",
    recommendedTitle: "Recommended for You",
    recommendedFallback: "Official drops will appear here after an administrator publishes the first resources.",
    freeTitle: "Free Resources",
    paidTitle: "Premium Resources",
    emptyResources: "The catalog is being prepared. Published resources will appear here automatically.",
    whyTitle: "Why Buy Through IconBuilds?",
    categoriesTitle: "Browse by Category"
  },
  homepageSections: [
    { key: "recommended", enabled: true },
    { key: "free", enabled: true },
    { key: "paid", enabled: true },
    { key: "why", enabled: true },
    { key: "categories", enabled: true }
  ],
  categories: [
    { id: "plugins", name: "Plugins", icon: "plug", description: "Custom Minecraft plugin resources and systems." },
    { id: "server-setups", name: "Server Setups", icon: "server", description: "Complete server setups, layouts, and launch packs." },
    { id: "builds", name: "Builds", icon: "blocks", description: "Minecraft maps, hubs, spawns, arenas, and builds." },
    { id: "configurations", name: "Configurations", icon: "settings", description: "Configs for plugins, ranks, menus, crates, and systems." },
    { id: "graphics", name: "Graphics", icon: "image", description: "Banners, icons, thumbnails, and brand assets." },
    { id: "textures", name: "Textures", icon: "palette", description: "Texture packs, UI textures, icons, and custom assets." },
    { id: "models", name: "Models", icon: "cube", description: "Custom item, mob, prop, and cosmetic models." },
    { id: "skripts", name: "Skripts", icon: "code", description: "Skript systems and gameplay features." },
    { id: "discord-bot-setups", name: "Discord Bot Setups", icon: "bot", description: "Discord bot files, commands, and server automation." },
    { id: "discord-graphics", name: "Discord Graphics", icon: "spark", description: "Discord banners, icons, panels, and community artwork." }
  ],
  filters: {
    minecraftVersions: ["1.21.6", "1.21.5", "1.21.4", "1.21.1", "1.20.6", "1.20.4", "1.19.4", "1.18.2", "1.16.5", "Any"],
    serverSoftware: ["Bukkit", "Spigot", "Paper", "Purpur", "Folia", "Velocity", "BungeeCord", "Sponge", "Any"],
    compatibility: ["Java", "Bedrock", "Cross-Play", "Proxy", "Standalone", "Discord"]
  },
  resource: {
    ownershipLabels: ["IconRealms", "IconBuilds Team", "IconRealms Development", "IconRealms Build Team", "IconRealms Design Team"],
    coverImageLimit: 1,
    showcaseImageLimit: 4,
    descriptionImageLimit: 12,
    allowedFileExtensions: [".zip", ".jar", ".sk", ".schem", ".schematic", ".mcpack", ".mcaddon", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".yml", ".yaml", ".json"],
    maxFileBytes: 250 * 1024 * 1024,
    maxImageBytes: 5 * 1024 * 1024,
    currency: "USD"
  },
  reviews: {
    requireOwnership: true,
    allowHelpfulVotes: true,
    moderationRequired: false
  },
  registration: {
    enabled: true
  },
  maintenance: {
    enabled: false,
    message: "IconBuilds is temporarily under maintenance."
  },
  moderation: {
    replacement: "***",
    blockedWords: ["slur-placeholder"],
    blockedLinkDomains: ["grabify.link", "iplogger.org", "bit.ly/malware"],
    suspiciousExtensions: [".exe", ".bat", ".cmd", ".scr", ".msi", ".ps1", ".vbs", ".js", ".jar.exe"],
    maxLinksPerReview: 3
  },
  admins: {
    reservedUsernames: ["TheStickBoy", "ItzKuroYT"],
    emailEnvVar: "ADMIN_EMAILS"
  },
  stripe: {
    currency: "usd",
    successPath: "/checkout/success/",
    cancelPath: "/resources/"
  },
  footer: {
    links: [
      { label: "Terms", href: "/terms/" },
      { label: "Privacy", href: "/privacy/" },
      { label: "Refund Policy", href: "/refund/" },
      { label: "Community Guidelines", href: "/guidelines/" },
      { label: "Support", href: "/support/" },
      { label: "Contact", href: "/support/#contact" }
    ],
    socials: [
      { label: "Discord", href: "https://discord.gg/HFyUfk458c" }
    ]
  }
};

if (typeof window !== "undefined") window.IconBuildsConfig = IconBuildsConfig;
if (typeof module !== "undefined") module.exports = IconBuildsConfig;
