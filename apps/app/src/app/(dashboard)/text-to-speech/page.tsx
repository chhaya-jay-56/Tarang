import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiSpeakLine } from "react-icons/ri";

export default function TextToSpeechPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Text to Speech
        </h1>
        <p className="text-muted-foreground text-base">
          Generate high-quality speech from text.
        </p>
      </div>

      <Card className="border-dashed border-2 border-border bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4 py-16">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <RiSpeakLine className="text-xl text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-medium text-foreground">Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              This feature is currently under development. Stay tuned!
            </p>
          </div>
          <Button disabled variant="outline" className="mt-2">
            Coming Soon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
