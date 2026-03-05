'use client'
import { useQuery } from '@tanstack/react-query'
import { AnalyticsTable } from '../_components/AnalyticsTable'

export default function MoMPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['analytics-mom'],
    queryFn: () => fetch('/api/analytics/mom').then((r) => r.json()),
  })
  return <AnalyticsTable data={data} isLoading={isLoading} periodLabel="Month" exportFilename="mom.csv" />
}
