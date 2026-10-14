import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HealthInsight } from '../../services/insights'
import { Card } from '../ui/Card'

export function InsightCard({ insights }: { insights: HealthInsight[] }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 size-40 rounded-full bg-flux/10 blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex items-center gap-2 text-pulse">
          <Sparkles className="size-4" />
          <h3 className="font-display text-xl text-snow">Personal insights</h3>
          {insights.length > 0 && <Link to="/insights" className="ml-auto inline-flex items-center gap-1 text-sm text-pulse hover:text-snow">See all <ArrowRight className="size-4" /></Link>}
        </div>
        {insights.length === 0 ? (
          <p className="max-w-xl text-sm leading-7 text-haze">Add measurements over time to build personalized comparisons.</p>
        ) : (
          <ul className="space-y-4">
            {insights.slice(0, 3).map((insight) => (
              <li key={insight.id} className="border-l border-line pl-4">
                {insight.createdAt && <p className="text-xs text-haze">Based on readings through {new Date(insight.createdAt).toLocaleString()}</p>}
                <h4 className="mt-1 font-medium text-snow">{insight.title}</h4>
                <p className="mt-1 text-sm leading-6 text-snow">{insight.body}</p>
                {insight.details && <details className="mt-2 text-sm text-haze">
                  <summary className="w-fit cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-pulse">Why this insight?</summary>
                  <p className="mt-2 leading-6">{insight.details}</p>
                </details>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
