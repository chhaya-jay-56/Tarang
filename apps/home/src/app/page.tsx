"use client";

import Background from "@/components/Background/Background";
import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import ProductSection from "@/components/ProductSection/ProductSection";
import HowItWorks from "@/components/HowItWorks/HowItWorks";
import Contact from "@/components/Contact/Contact";
import Footer from "@/components/Footer/Footer";

export default function HomePage() {
  return (
    <>
      <Background />
      <Navbar />
      <div id="home">
        <Hero />
      </div>
      <ProductSection />
      <HowItWorks />
      <Contact />
      <Footer />
    </>
  );
}
