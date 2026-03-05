'use client'
import { useQuery } from '@tanstack/react-query'
import { AnalyticsTable } from '../_components/AnalyticsTable'

export default function YoYPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['analytics-yoy'],
    queryFn: () => fetch('/api/analytics/yoy').then((r) => r.json()),
  })
  return <AnalyticsTable data={data} isLoading={isLoading} periodLabel="Year" exportFilename="yoy.csv" />
}
