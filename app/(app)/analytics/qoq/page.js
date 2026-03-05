'use client'
import { useQuery } from '@tanstack/react-query'
import { AnalyticsTable } from '../_components/AnalyticsTable'

export default function QoQPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['analytics-qoq'],
    queryFn: () => fetch('/api/analytics/qoq').then((r) => r.json()),
  })
  return <AnalyticsTable data={data} isLoading={isLoading} periodLabel="Quarter" exportFilename="qoq.csv" />
}
