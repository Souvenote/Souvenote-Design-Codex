import Navbar from "@/components/Navbar";
import { Hero } from "@/components/hero/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import GallerySection from "@/components/GallerySection";
import FAQAccordion from "@/components/FAQAccordion";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <GallerySection />
        <FAQAccordion />
      </main>
      <Footer />
    </>
  );
}
