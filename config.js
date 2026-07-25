const IconBuildsConfig = {
  site: {
    name: "IconBuilds",
    owner: "IconRealms",
    domain: "minestore.org",
    url: "https://minestore.org",
    basePath: "",
    logo: "/logo.png",
    favicon: "/logo.png",
    supportEmail: "icongens@gmail.com",
    discordUrl: "https://discord.gg/RaRuBJCqPX",
    copyright: "IconBuilds is an IconRealms marketplace. Not affiliated with Mojang or Microsoft."
  },
  api: {
    basePath: "/api",
    productionBasePath: "https://icon-builds.vercel.app/api",
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
      blue: "#f97316",
      cyan: "#fde68a",
      emerald: "#fbbf24",
      violet: "#f43f5e",
      pink: "#fb7185",
      amber: "#f59e0b"
    }
  },
  seo: {
    title: "IconBuilds | Minecraft Resources, Skripts, Plugins, Builds & Setups",
    description:
      "Browse official IconRealms Minecraft resources, including Skripts, plugins, server setups, builds, configurations, textures, models, and Discord bot setups.",
    keywords: [
      "minecraft resources",
      "minecraft plugins",
      "minecraft builds",
      "minecraft server setups",
      "minecraft skripts",
      "minecraft configurations",
      "minecraft textures",
      "minecraft models",
      "free minecraft resources",
      "premium minecraft resources",
      "discord bot setups",
      "iconrealms",
      "iconbuilds"
    ],
    robotsIndex: "index, follow, max-image-preview:large",
    robotsPrivate: "noindex, nofollow"
  },
  copy: {
    heroEyebrow: "Minecraft Resource Marketplace",
    heroTitle: "Minecraft resources for servers that need to stand out",
    heroBody:
      "Browse official IconRealms Minecraft builds, Skripts, plugins, server setups, configurations, textures, models, and Discord bot setups.",
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
    {
      id: "builds",
      name: "Builds",
      icon: "blocks",
      description: "Minecraft maps, hubs, spawns, arenas, lobbies, and server build resources.",
      seoTitle: "Minecraft Build Resources | Hubs, Spawns, Arenas & Maps | IconBuilds",
      seoDescription: "Browse official IconRealms Minecraft build resources, including hubs, spawns, arenas, maps, lobbies, and server builds for Minecraft communities."
    },
    {
      id: "skripts",
      name: "Skripts",
      icon: "code",
      description: "Minecraft Skript systems, commands, gameplay mechanics, and server features.",
      seoTitle: "Minecraft Skript Resources | Gameplay Systems & Server Features | IconBuilds",
      seoDescription: "Find official IconRealms Minecraft Skript resources for gameplay systems, commands, server features, Lifesteal, economy, utilities, and custom mechanics."
    },
    {
      id: "plugins",
      name: "Plugins",
      icon: "plug",
      description: "Minecraft plugin resources, server systems, utilities, and custom features.",
      seoTitle: "Minecraft Plugin Resources | Server Plugins & Systems | IconBuilds",
      seoDescription: "Browse official IconRealms Minecraft plugin resources, server plugins, utilities, custom systems, gameplay features, and premium Minecraft plugin downloads."
    },
    {
      id: "server-setups",
      name: "Server Setups",
      icon: "server",
      description: "Complete Minecraft server setups, premade layouts, launch packs, and server bases.",
      seoTitle: "Minecraft Server Setup Resources | Premade Server Setups | IconBuilds",
      seoDescription: "Browse official IconRealms Minecraft server setup resources, including premade server setups, launch packs, layouts, configs, and server bases."
    },
    {
      id: "configurations",
      name: "Configurations",
      icon: "settings",
      description: "Minecraft plugin configs, menus, ranks, crates, shops, rewards, and server settings.",
      seoTitle: "Minecraft Configuration Resources | Plugin Configs, Menus & Ranks | IconBuilds",
      seoDescription: "Find official IconRealms Minecraft configuration resources for plugin configs, menus, ranks, crates, shops, rewards, GUIs, and server settings."
    },
    {
      id: "textures-models",
      name: "Textures & Models",
      icon: "palette",
      description: "Minecraft texture packs, custom models, UI textures, icons, cosmetics, and visual assets.",
      seoTitle: "Minecraft Textures & Models | Texture Packs, Custom Models & Assets | IconBuilds",
      seoDescription: "Browse official IconRealms Minecraft textures and models, including texture packs, custom models, UI textures, icons, cosmetics, and visual assets."
    },
    {
      id: "discord-bot-setups",
      name: "Discord Bot Setups",
      icon: "bot",
      description: "Discord bot setups, command packs, automation files, moderation tools, and community systems.",
      seoTitle: "Discord Bot Setup Resources | Bot Files, Commands & Automation | IconBuilds",
      seoDescription: "Browse official IconRealms Discord bot setup resources, including bot files, commands, moderation tools, automation systems, and community server utilities."
    }
  ],
  filters: {
    minecraftVersions: [
      "26.1.2", "26.1.1", "26.1",
      "1.21.9", "1.21.8", "1.21.7", "1.21.6", "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
      "1.20.6", "1.20.5", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20",
      "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
      "1.18.2", "1.18.1", "1.18",
      "1.17.1", "1.17",
      "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1", "1.16",
      "1.15.2", "1.15.1", "1.15",
      "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14",
      "1.13.2", "1.13.1", "1.13",
      "1.12.2", "1.12.1", "1.12",
      "1.11.2", "1.11.1", "1.11",
      "1.10.2", "1.10",
      "1.9.4", "1.9.2", "1.9",
      "1.8.9", "1.8.8", "1.8",
      "Any"
    ],
    serverSoftware: ["Paper", "Purpur", "Spigot", "Bukkit", "Folia", "Velocity", "Waterfall", "BungeeCord", "Sponge", "Forge", "NeoForge", "Fabric", "Quilt", "Mohist", "Arclight", "Magma", "Pufferfish", "Minestom", "Nukkit", "PocketMine-MP", "Geyser", "Floodgate", "Discord", "Standalone", "Any"],
    compatibility: ["Java", "Bedrock", "Cross-Play", "Proxy", "Standalone", "Discord"]
  },
  resource: {
    ownershipLabels: ["IconRealms", "IconBuilds Team", "IconRealms Development", "IconRealms Build Team", "IconRealms Design Team"],
    coverImageLimit: 1,
    showcaseImageLimit: 4,
    descriptionImageLimit: 12,
    allowedFileExtensions: [".zip", ".jar", ".sk", ".schem", ".schematic", ".mcpack", ".mcaddon", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".yml", ".yaml", ".json"],
    extensionlessDownloadHosts: ["drive.google.com", "drive.usercontent.google.com"],
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
