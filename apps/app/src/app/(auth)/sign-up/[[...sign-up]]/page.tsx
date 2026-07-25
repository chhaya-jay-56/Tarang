import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      appearance={{
        baseTheme: dark,
        elements: {
          cardBox: "shadow-none border border-border bg-card rounded-2xl",
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
