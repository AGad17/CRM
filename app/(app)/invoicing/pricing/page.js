import { redirect } from 'next/navigation'

// Pricing config moved to Settings → Pricing Config
export default function PricingConfigRedirectPage() {
  redirect('/settings/pricing')
}
