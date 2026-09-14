'use client';

import { CheckCircle2, XCircle, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ValidationItem } from '@/constants/iphone-check-list';
import { cn } from '@/lib/utils';

interface InspectionItemProps {
  item: ValidationItem;
  status: 'pending' | 'approved' | 'failed';
  onStatusChange: (status: 'approved' | 'failed') => void;
  onOpenProtocol: () => void;
  inputValue?: string;
  onInputChange?: (val: string) => void;
  disabled?: boolean;
}

export function InspectionItem({
  item,
  status,
  onStatusChange,
  onOpenProtocol,
  inputValue,
  onInputChange,
  disabled,
}: InspectionItemProps) {
  const isPending = status === 'pending';
  const isApproved = status === 'approved';
  const isFailed = status === 'failed';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-4 rounded-lg border transition-[background-color,border-color,opacity,filter]',
        isApproved && 'bg-green-500/5 border-green-500/20',
        isFailed && 'bg-red-500/5 border-red-500/20',
        isPending && 'bg-muted/30 border-border',
        disabled && 'opacity-40 grayscale pointer-events-none'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm leading-none">{item.label}</h4>
            {item.isCritical && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/10">
                Crítico
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{item.shortDesc}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={onOpenProtocol}
          >
            <Info className="h-4 w-4" />
          </Button>

          {item.type === 'link' && item.link && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => window.open(item.link, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              Validar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 pt-2 border-t border-border/50">
        <div className="flex-1 min-w-[140px]">
          {item.type === 'input' ? (
            <Input
              placeholder={item.inputPlaceholder}
              value={inputValue || ''}
              onChange={(e) => onInputChange?.(e.target.value)}
              className="h-8 text-xs w-full max-w-[200px]"
              disabled={disabled}
            />
          ) : (
            <div className="text-[10px] text-muted-foreground italic">
              {isPending ? 'Esperando validación...' : isApproved ? 'Aprobado' : 'Fallido'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant={isFailed ? 'destructive' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onStatusChange('failed')}
          >
            <XCircle className="h-4 w-4" />
          </Button>
          <Button
            variant={isApproved ? 'default' : 'outline'}
            size="sm"
            className={cn('h-8 w-8 p-0', isApproved && 'bg-green-600 hover:bg-green-700')}
            onClick={() => onStatusChange('approved')}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
