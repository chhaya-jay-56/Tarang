"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar/TopBar";
import { ClerkAuthGuard } from "@/components/providers/ClerkAuthGuard/ClerkAuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkAuthGuard>
      <div className="flex min-h-screen w-full">
        <Sidebar />
        <div className="flex-col flex-1 flex h-screen overflow-y-auto overflow-x-hidden content-scroll">
          <TopBar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ClerkAuthGuard>
  );
}
