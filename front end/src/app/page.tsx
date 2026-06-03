import { Hero } from "@/components/hero/Hero";
import { HomeAuthPreview } from "@/components/home/HomeAuthPreview";
import { HowItWorks } from "@/components/landing/HowItWorks";
import GallerySection from "@/components/GallerySection";
import FAQAccordion from "@/components/FAQAccordion";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <HomeAuthPreview />
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
