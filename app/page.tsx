import { ResponsiveHero } from "@/components/responsive/responsive-hero"
import { ResponsivePredictions } from "@/components/responsive/responsive-predictions"
import { StatsSection } from "@/components/stats-section"
import { TrustBadges } from "@/components/trust-badges"
import { TestimonialsSection } from "@/components/testimonials-section"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
      <ResponsiveHero />
      <StatsSection />
      <ResponsivePredictions />
      <TrustBadges />
      <TestimonialsSection />
    </div>
  )
}
