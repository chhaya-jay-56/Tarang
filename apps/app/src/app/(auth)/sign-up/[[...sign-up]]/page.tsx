import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
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
