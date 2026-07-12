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
import { LuLibrary, LuPlus } from "react-icons/lu";
import { TbWaveSine } from "react-icons/tb";
import { MdOutlineVideoSettings } from "react-icons/md";

export default function Home() {
  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      {/* Welcome */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
          Welcome to <span className="font-brand italic font-normal tracking-normal text-2xl sm:text-4xl ml-1">Tarang</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-lg">
          Your all-in-one platform for instant voice cloning and text-to-speech generation.
        </p>
      </div>

      {/* Products */}
      <section className="flex flex-col gap-4 sm:gap-5">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
          Products
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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

          {/* Voice Library Card */}
          <Card className="group hover:border-primary/30 transition-all">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <LuLibrary className="text-xl" />
              </div>
              <CardTitle>Voice Library</CardTitle>
              <CardDescription>
                Save and manage your voice collection. Create custom voices from reference audio for reuse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/voice-library">
                <Button variant="secondary" className="w-full justify-between">
                  Browse Library
                  <GoArrowRight className="text-base" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Voice Creation Card */}
          <Card className="group hover:border-primary/30 transition-all">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <LuPlus className="text-xl" />
              </div>
              <CardTitle>Create Voice</CardTitle>
              <CardDescription>
                Upload reference audio to create a reusable voice profile for cloning and TTS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/voice-creation">
                <Button variant="secondary" className="w-full justify-between">
                  Create Voice
                  <GoArrowRight className="text-base" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* TTS Card */}
          <Card className="group hover:border-primary/30 transition-all">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <RiSpeakLine className="text-xl" />
              </div>
              <CardTitle>Text to Speech</CardTitle>
              <CardDescription>
                Convert text into lifelike speech using your cloned voices or our premium library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/text-to-speech">
                <Button variant="secondary" className="w-full justify-between">
                  Try TTS Feature
                  <GoArrowRight className="text-base" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Voice Separation Card */}
          <Card className="group hover:border-primary/30 transition-all">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <TbWaveSine className="text-xl" />
              </div>
              <CardTitle>Voice Separation</CardTitle>
              <CardDescription>
                Separate vocals from instrumentals using AI. Upload any song and download clean stems.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/voice-separation">
                <Button variant="secondary" className="w-full justify-between">
                  Separate Audio
                  <GoArrowRight className="text-base" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* PVC Card — Coming Soon */}
          <Card className="group relative opacity-70 cursor-default">
            <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Coming Soon
            </div>
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <MdOutlineVideoSettings className="text-xl" />
              </div>
              <CardTitle>PVC</CardTitle>
              <CardDescription>
                Personalized Voice Conversion — transform any voice into another with natural quality. Coming soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full justify-between" disabled>
                Coming Soon
                <GoArrowRight className="text-base" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
