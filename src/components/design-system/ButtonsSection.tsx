import React from 'react';
import { Button } from '@/components/filla/Button';
import { Plus, Camera, Trash2, ChevronRight, Loader2 } from 'lucide-react';

export function ButtonsSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Buttons</h2>
        <p className="text-muted-foreground text-sm">Neumorphic buttons with E1/E2/E3 elevation layers</p>
      </div>

      <div className="space-y-6">
        {/* Primary Buttons */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Primary</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg">Large Primary</Button>
            <Button variant="primary" size="md">Medium Primary</Button>
            <Button variant="primary" size="sm">Small</Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />}>With Icon</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </div>

        {/* Secondary Buttons */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Secondary</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg">Large Secondary</Button>
            <Button variant="secondary" size="md">Medium</Button>
            <Button variant="secondary" size="sm">Small</Button>
            <Button variant="secondary" icon={<ChevronRight className="w-4 h-4" />}>Continue</Button>
          </div>
        </div>

        {/* Ghost Buttons */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ghost</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" size="md">Ghost Button</Button>
            <Button variant="ghost" size="sm">Small Ghost</Button>
            <Button variant="ghost" icon={<Camera className="w-4 h-4" />}>Capture</Button>
          </div>
        </div>

        {/* Danger Buttons */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Danger</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" size="md">Delete</Button>
            <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>Remove Item</Button>
          </div>
        </div>

        {/* Signal/FAB Buttons */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">FAB / Signal</h3>
          <div className="flex flex-wrap gap-3 items-center">
            <Button variant="fab" className="w-14 h-14 rounded-full p-0 flex items-center justify-center">
              <Plus className="w-6 h-6" />
            </Button>
            <Button variant="signal" size="md">Signal Action</Button>
          </div>
        </div>

        {/* Loading State */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Loading States</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </Button>
            <Button variant="secondary" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
