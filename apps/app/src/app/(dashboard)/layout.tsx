import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-col flex-1 flex h-screen overflow-y-auto">
        <header className="flex shrink-0 items-center justify-end gap-3 p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 h-14">
          <Show when="signed-out">
            <SignInButton />
            <SignUpButton />
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </header>
        <main className="flex-1 p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
