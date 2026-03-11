import { redirect } from 'next/navigation'

// Deal calculator removed — deals are now created exclusively via the pipeline close flow.
export default function DealCalculatorPage() {
  redirect('/pipeline')
}
