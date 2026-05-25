"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "⊞" },
  { href: "/dashboard/translations", label: "Translations", icon: "🌐" },
  { href: "/dashboard/bot-memory", label: "Bot Memory", icon: "🤖" },
  { href: "/dashboard/projects", label: "Projects", icon: "📁" },
  { href: "/dashboard/media", label: "Media", icon: "🖼️" },
  { href: "/dashboard/roadmap", label: "Roadmap", icon: "🗺️" },
  { href: "/dashboard/changelog", label: "Changelog", icon: "📋" },
  { href: "/dashboard/thoughts", label: "Thoughts", icon: "✍️" },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <p className="text-xs text-gray-500 uppercase tracking-widest">Admin</p>
        <h1 className="text-white font-bold text-lg mt-1">Yusef Bach</h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-violet-600/20 text-violet-300 font-medium"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-gray-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Abmelden
        </button>
      </div>
    </aside>
  );
}
