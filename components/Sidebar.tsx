"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Server,
  Radio,
  Bell,
  Code2,
  Activity,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

const nav = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/infrastructure", icon: Server, label: "Infrastructure" },
  { href: "/streams", icon: Radio, label: "Kafka Streams" },
  { href: "/alerts", icon: Bell, label: "Alerts", badge: 2 },
  { href: "/scripts", icon: Code2, label: "Automation" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-[#161b22] border-r border-[#30363d] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#3fb950] rounded flex items-center justify-center">
            <Activity className="w-4 h-4 text-black" />
          </div>
          <span className="font-semibold text-sm">TradeSentinel</span>
        </div>
      </div>

      {/* Market status */}
      <div className="px-4 py-2.5 border-b border-[#30363d]">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-[#3fb950] pulse-green" />
          <span className="text-[#8b949e]">Market Session</span>
          <span className="ml-auto text-[#3fb950] font-semibold">OPEN</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2">
        <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-[#484f58] mb-1">
          Monitor
        </p>
        {nav.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors mb-0.5 group",
                active
                  ? "bg-[#21262d] text-[#e6edf3]"
                  : "text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]"
              )}
            >
              <Icon
                className={clsx(
                  "w-4 h-4",
                  active ? "text-[#58a6ff]" : "group-hover:text-[#58a6ff]"
                )}
              />
              <span>{label}</span>
              {badge && (
                <span className="ml-auto bg-[#f85149] text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  {badge}
                </span>
              )}
              {active && !badge && (
                <ChevronRight className="ml-auto w-3 h-3 text-[#484f58]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#30363d]">
        <p className="text-[10px] text-[#484f58]">TradeSentinel v1.0.0</p>
        <p className="text-[10px] text-[#484f58]">Capital Markets · Chicago</p>
      </div>
    </aside>
  );
}
