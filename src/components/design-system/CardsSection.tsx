import React from 'react';
import { Calendar, MapPin, User, Clock, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
function TaskCard() {
  return <div className="bg-surface rounded-lg shadow-e1 p-4 space-y-3 hover:shadow-e2 transition-shadow">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider font-medium bg-accent/20 text-accent">
            High
          </span>
          <h4 className="font-semibold text-ink">Replace fire extinguisher</h4>
        </div>
        <div className="w-12 h-12 rounded-lg bg-concrete/50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-accent" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">
        Annual fire safety compliance check requires replacement of unit in Block A corridor
      </p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          Block A
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          Due Today
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          John D.
        </span>
      </div>
    </div>;
}
function ComplianceCard() {
  return <div className="bg-surface rounded-lg shadow-e1 p-4 space-y-3 border-l-4 border-primary">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-ink">Gas Safety Certificate</h4>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary font-medium">Compliant</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Expires</span>
          <span className="font-mono text-xs">14 Mar 2025</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Properties</span>
          <span className="text-ink">12 of 12</span>
        </div>
      </div>
      <div className="h-1.5 bg-concrete rounded-full overflow-hidden">
        <div className="h-full w-full bg-primary rounded-full" />
      </div>
    </div>;
}
function ScheduleCard() {
  return <div className="bg-surface rounded-lg shadow-e1 p-4 flex gap-4">
      <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Dec</span>
        <span className="font-mono text-xl font-bold text-primary">08</span>
      </div>
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold text-ink">Quarterly inspection</h4>
        <p className="text-sm text-muted-foreground">Oak House - All units</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>09:00 - 12:00</span>
        </div>
      </div>
    </div>;
}
function PropertyCard() {
  return <div className="bg-surface rounded-lg shadow-e1 overflow-hidden hover:shadow-e2 transition-shadow">
      <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="font-display text-xl font-bold text-primary">OH</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-semibold text-ink">Oak House</h4>
        <p className="text-sm text-muted-foreground">24 Oak Street, London E1 6AN</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">8 Units</span>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Healthy</span>
          </div>
        </div>
      </div>
    </div>;
}
function BriefingCard() {
  return <div className="bg-primary/5 rounded-lg p-4 space-y-3 border border-primary/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary font-medium">AI Insight</span>
        </div>
        <button className="text-muted-foreground hover:text-ink">
          <span className="text-lg">⋯</span>
        </button>
      </div>
      <p className="text-sm text-ink leading-relaxed">
        Jane cannot find documents for boiler repair at Maple Court. Last uploaded 3 months ago but marked as missing in today's inspection.
      </p>
      <div className="flex gap-2">
        <button className="px-3 py-1.5 rounded-full bg-primary text-white font-mono text-[10px] uppercase tracking-wider">
          Action
        </button>
        <button className="px-3 py-1.5 rounded-full bg-concrete/50 text-ink/70 font-mono text-[10px] uppercase tracking-wider">
          Ignore
        </button>
        <button className="px-3 py-1.5 rounded-full bg-concrete/50 text-ink/70 font-mono text-[10px] uppercase tracking-wider">
          Share
        </button>
      </div>
    </div>;
}
export function CardsSection() {
  return <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Cards & Panels</h2>
        <p className="text-muted-foreground text-sm">Neumorphic E1 depth cards for various content types</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task Card</h3>
          <TaskCard className="bg-[#eeede8]/[0.61]" />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Compliance Card</h3>
          <ComplianceCard />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Schedule Card</h3>
          <ScheduleCard />
        </div>

        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Property Card</h3>
          <PropertyCard />
        </div>

        <div className="space-y-3 md:col-span-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Briefing / AI Insight Card</h3>
          <div className="max-w-md">
            <BriefingCard />
          </div>
        </div>
      </div>
    </section>;
}