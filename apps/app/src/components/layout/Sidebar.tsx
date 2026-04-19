"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GoHome } from "react-icons/go";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { RiSpeakLine } from "react-icons/ri";
import { LuHistory } from "react-icons/lu";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: GoHome },
  { name: "Voice Cloning", href: "/instant-voice-clone", icon: HiOutlineMicrophone },
  { name: "Text to Speech", href: "/text-to-speech", icon: RiSpeakLine },
  { name: "History", href: "/history", icon: LuHistory },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card min-h-screen flex flex-col py-5 px-3">
      {/* Brand Name */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <span className="text-2xl font-brand italic font-normal tracking-tight text-foreground">
          Tarang
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("text-lg", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
