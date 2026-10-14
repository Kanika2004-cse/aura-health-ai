import { Activity, Droplets, Footprints, HeartPulse, Moon, Thermometer } from 'lucide-react'
import type { MetricCardData, MetricKey } from '../../types/health'
import { Card } from '../ui/Card'

const icons: Record<MetricKey, typeof HeartPulse> = {
  heartRate: HeartPulse,
  spo2: Droplets,
  bloodPressure: Activity,
  temperature: Thermometer,
  steps: Footprints,
  sleep: Moon,
}

export function MetricCard({ metric }: { metric: MetricCardData }) {
  const Icon = icons[metric.key]

  return (
    <Card className="group transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-haze">{metric.label}</p>
        <Icon className="size-4 text-pulse" strokeWidth={1.75} />
      </div>
      <p className="mt-4 font-display text-4xl tracking-[-0.05em] text-snow">
        {metric.value}
        <span className="ml-2 align-middle text-sm font-sans font-medium tracking-normal text-haze">
          {metric.unit}
        </span>
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-pulse-dim">{metric.hint}</p>
      <p className="mt-1 text-sm text-haze">{metric.trend}</p>
    </Card>
  )
}
