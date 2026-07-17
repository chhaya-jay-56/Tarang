import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background px-3 py-6 sm:p-8">
      <div className="flex w-full max-w-[1050px] overflow-hidden rounded-2xl sm:rounded-[2.5rem] bg-card shadow-2xl ring-1 ring-border animate-in fade-in zoom-in-95 duration-700 ease-out">
        
        {/* Left Side: Image and Branding inside a rounded container */}
        <div className="hidden lg:flex w-[45%] flex-col p-3">
          <div className="relative flex h-full w-full min-h-[600px] flex-col justify-between overflow-hidden rounded-[2rem] group">
            {/* Background Image */}
            <Image
              src="/auth-bg.jpg"
              alt="Authentication background"
              fill
              className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-105"
              priority
            />
            {/* Gradient Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90 transition-opacity duration-500 group-hover:opacity-90" />

            <div className="relative z-10 p-8 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both transition-all duration-700 ease-out group-hover:translate-y-[-8px]">
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-3 leading-snug drop-shadow-md group-hover:drop-shadow-xl transition-all duration-500">
                Create, clone, and manage expressive voices.
              </h1>
              <p className="text-sm text-zinc-300 drop-shadow-md group-hover:text-zinc-100 transition-colors duration-500">
                Sign in to continue to your voice workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex w-full lg:w-[55%] items-center justify-center px-4 py-6 sm:p-8 lg:p-12 animate-in fade-in slide-in-from-right-4 duration-700 delay-150 fill-mode-both">
          <div className="w-full max-w-sm flex flex-col items-center overflow-x-hidden">
             {/* Mobile branding — smaller text, tighter spacing */}
             <div className="mb-5 flex lg:hidden flex-col items-center justify-center text-center px-2">
               <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground leading-snug">
                 Create, clone, and manage expressive voices.
               </h1>
             </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
