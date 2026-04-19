import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HiOutlineMicrophone } from "react-icons/hi2";
import { RiSpeakLine } from "react-icons/ri";
import { GoArrowRight } from "react-icons/go";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      {/* Welcome */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome to <span className="font-brand italic font-normal tracking-normal text-4xl ml-1">Tarang</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-lg">
          Your all-in-one platform for instant voice cloning and text-to-speech generation.
        </p>
      </div>

      {/* Products */}
      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Products
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* IVC Card */}
          <Card className="group hover:border-primary/30 transition-all">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <HiOutlineMicrophone className="text-xl" />
              </div>
              <CardTitle>Instant Voice Clone</CardTitle>
              <CardDescription>
                Clone any voice instantly with a short audio sample. Upload or record directly in the browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/instant-voice-clone">
                <Button variant="secondary" className="w-full justify-between">
                  Try IVC Feature
                  <GoArrowRight className="text-base" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* TTS Card */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center mb-3">
                <RiSpeakLine className="text-xl" />
              </div>
              <CardTitle>Text to Speech</CardTitle>
              <CardDescription>
                Convert text into lifelike speech using your cloned voices or our premium library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline" className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
