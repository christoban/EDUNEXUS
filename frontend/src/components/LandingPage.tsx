import Navbar from './landing/Navbar'
import HeroSection from './landing/HeroSection'
import StatsSection from './landing/StatsSection'
import FeaturesGrid from './landing/FeaturesGrid'
import DemoTabs from './landing/DemoTabs'
import PersonasSection from './landing/PersonasSection'
import PricingSection from './landing/PricingSection'
import FAQSection from './landing/FAQSection'
import CTASection from './landing/CTASection'
import Footer from './landing/Footer'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0A0F1E] font-sans text-white antialiased">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <FeaturesGrid />
      <DemoTabs />
      <PersonasSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  )
}
