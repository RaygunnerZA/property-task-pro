import { Sparkles } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';

export default function WorkAI() {
  return (
    <StandardPage
      title="AI Suggestions"
      icon={<Sparkles className="h-6 w-6" />}
      maxWidth="lg"
    >
      <EmptyState
        icon={Sparkles}
        title="AI-powered insights"
        description="Smart recommendations for task prioritization and property management"
      />
    </StandardPage>
  );
}
