export default function DashboardPage() {
  const areas = [
    { href: "/dashboard/translations", label: "Translations", desc: "DE / EN / AR Keys bearbeiten", icon: "🌐" },
    { href: "/dashboard/bot-memory", label: "Bot Memory", desc: "yusef_brain.md bearbeiten", icon: "🤖" },
    { href: "/dashboard/projects", label: "Projects", desc: "Projektkarten verwalten", icon: "📁" },
    { href: "/dashboard/media", label: "Media", desc: "Bilder & Dokumente", icon: "🖼️" },
    { href: "/dashboard/roadmap", label: "Roadmap", desc: "Einträge verwalten", icon: "🗺️" },
    { href: "/dashboard/changelog", label: "Changelog", desc: "Versionen & Updates", icon: "📋" },
    { href: "/dashboard/thoughts", label: "Thoughts", desc: "Blog-Posts schreiben", icon: "✍️" },
    { href: "/dashboard/maintenance", label: "Maintenance", desc: "Wartungsmodus Toggle", icon: "⚙️" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-2">Übersicht</h2>
      <p className="text-gray-400 mb-8">Willkommen im Portfolio Admin Panel.</p>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {areas.map((area) => (
          <a
            key={area.href}
            href={area.href}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-violet-600/50 hover:bg-gray-800/50 transition-all group"
          >
            <span className="text-2xl">{area.icon}</span>
            <h3 className="text-white font-semibold mt-3 group-hover:text-violet-300 transition-colors">
              {area.label}
            </h3>
            <p className="text-gray-500 text-sm mt-1">{area.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
