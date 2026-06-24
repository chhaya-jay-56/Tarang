import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      appearance={{
        elements: {
          cardBox: "shadow-none border border-border bg-card",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton: "border-border bg-background text-foreground",
          formFieldInput: "bg-background border-border text-foreground",
          footerActionText: "text-muted-foreground",
          footerActionLink: "text-foreground",
        },
      }}
    />
  );
}
