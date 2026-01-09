/**
 * MicroCreateMenu - Inline creation component
 * 
 * Design Constraints:
 * - Inline
 * - Small
 * - Text-first
 * - Never modal unless absolutely required
 * - Must feel like clarification, not setup
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, User, Users, MapPin, Package, Folder } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type EntityType = 'person' | 'team' | 'space' | 'asset' | 'category';

interface MicroCreateMenuProps {
  entityType: EntityType;
  entityLabel?: string;
  onInvitePerson?: () => void;
  onCreateTeam?: () => void;
  onCreateSpace?: () => void;
  onCreateAsset?: () => void;
  onCreateCategory?: () => void;
  className?: string;
}

const entityIcons: Record<EntityType, React.ElementType> = {
  person: User,
  team: Users,
  space: MapPin,
  asset: Package,
  category: Folder,
};

const entityLabels: Record<EntityType, string> = {
  person: 'person',
  team: 'team',
  space: 'space',
  asset: 'asset',
  category: 'category',
};

export const MicroCreateMenu: React.FC<MicroCreateMenuProps> = ({
  entityType,
  entityLabel,
  onInvitePerson,
  onCreateTeam,
  onCreateSpace,
  onCreateAsset,
  onCreateCategory,
  className
}) => {
  const [open, setOpen] = useState(false);
  const Icon = entityIcons[entityType];
  const label = entityLabel || entityLabels[entityType];

  const getOptions = () => {
    switch (entityType) {
      case 'person':
        return [
          { label: 'Choose existing', onClick: () => setOpen(false) },
          { label: 'Invite person', onClick: onInvitePerson },
          { label: 'Create team', onClick: onCreateTeam },
        ];
      case 'space':
        return [
          { label: 'Choose existing', onClick: () => setOpen(false) },
          { label: 'Create space', onClick: onCreateSpace },
        ];
      case 'asset':
        return [
          { label: 'Choose existing', onClick: () => setOpen(false) },
          { label: 'Create asset', onClick: onCreateAsset },
        ];
      case 'category':
        return [
          { label: 'Choose existing', onClick: () => setOpen(false) },
          { label: 'Create category', onClick: onCreateCategory },
        ];
      default:
        return [];
    }
  };

  const options = getOptions();

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">
        Can't find "{label}"
      </span>
      <div className="flex items-center gap-1">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => {
              option.onClick?.();
              setOpen(false);
            }}
            className={cn(
              'px-2 py-1 text-xs text-amber-700',
              'hover:bg-amber-50 rounded-[3px]',
              'transition-colors'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

