"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GoHome } from "react-icons/go";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { RiSpeakLine } from "react-icons/ri";
import { LuHistory, LuLibrary, LuPlus, LuPanelLeftClose } from "react-icons/lu";
import { TbWaveSine } from "react-icons/tb";
import { MdOutlineVideoSettings } from "react-icons/md";
import { useLayoutStore } from "@/stores/layoutStore";


interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Home", href: "/", icon: GoHome },
  { name: "Voice Cloning", href: "/instant-voice-clone", icon: HiOutlineMicrophone },
  { name: "Voice Library", href: "/voice-library", icon: LuLibrary },
  { name: "Voice Creation", href: "/voice-creation", icon: LuPlus },
  { name: "Text to Speech", href: "/text-to-speech", icon: RiSpeakLine },
  { name: "Voice Separation", href: "/voice-separation", icon: TbWaveSine },
  { name: "PVC", href: "/pvc", icon: MdOutlineVideoSettings, comingSoon: true },
  { name: "History", href: "/history", icon: LuHistory },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar, isCollapsed, toggleCollapse } = useLayoutStore();

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 shrink-0 border-r border-border bg-card flex flex-col py-5 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 lg:min-h-screen overflow-hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-60 lg:w-[72px] px-3 lg:px-2" : "w-60 px-3"
      )}>
        {/* Brand Name & Toggle */}
        <div className={cn(
          "flex items-center justify-between mb-8 relative",
          isCollapsed ? "px-3 lg:justify-center lg:px-0" : "px-3"
        )}>
          {/* Logo on the left */}
          <img 
            src="/Logo.svg" 
            alt="Tarang Logo" 
            className={cn(
              "h-9 w-auto shrink-0 transition-transform duration-200 hover:scale-105", 
              isCollapsed && "lg:cursor-pointer"
            )}
            onClick={isCollapsed ? toggleCollapse : undefined}
            title={isCollapsed ? "Expand sidebar" : undefined}
          />

          {/* Text in the absolute center (hidden when collapsed) */}
          <span
            onClick={isCollapsed ? toggleCollapse : undefined}
            className={cn(
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-brand italic font-normal tracking-tight text-foreground transition-all duration-500 ease-in-out text-2xl whitespace-nowrap",
              isCollapsed ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100 delay-150"
            )}>
            Tarang
          </span>

          {/* Toggle Button on the right */}
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative z-10"
              title="Close sidebar"
            >
              <LuPanelLeftClose className="text-lg" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <span
                  key={item.href}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium",
                    "text-muted-foreground/50 cursor-default select-none",
                    isCollapsed ? "gap-3 px-3 py-2.5 lg:justify-center lg:p-2.5" : "gap-3 px-3 py-2.5"
                  )}
                  title={isCollapsed ? `${item.name} (Soon)` : undefined}
                >
                  <Icon className="text-lg text-muted-foreground/50 shrink-0" />
                  <span className={cn("truncate transition-all duration-300", isCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100")}>{item.name}</span>
                  <span className={cn("ml-auto text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground transition-all duration-300", isCollapsed ? "lg:w-0 lg:opacity-0 lg:hidden" : "w-auto opacity-100")}>
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed ? "gap-3 px-3 py-2.5 lg:justify-center lg:p-2.5" : "gap-3 px-3 py-2.5"
                )}
              >
                <Icon className={cn("text-lg shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("truncate transition-all duration-300", isCollapsed ? "lg:w-0 lg:opacity-0 lg:hidden" : "w-auto opacity-100")}>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
