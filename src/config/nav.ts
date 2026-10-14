import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Settings,
  ShieldAlert,
  Sparkles,
  Timer,
  UserRound,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const appNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/health-data', label: 'Health Data', icon: HeartPulse },
  { to: '/analysis', label: 'Analysis', icon: Activity },
  { to: '/trends', label: 'Trends', icon: LineChart },
  { to: '/timeline', label: 'Timeline', icon: Timer },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/emergency', label: 'Emergency', icon: ShieldAlert },
  { to: '/settings', label: 'Settings', icon: Settings },
]
