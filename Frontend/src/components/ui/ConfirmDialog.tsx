import * as React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'success';
  isLoading?: boolean;
  error?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  icon?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
  error,
  onConfirm,
  onCancel,
  icon,
}) => {
  if (!isOpen) return null;

  const variantConfig = {
    default: {
      bgColor: 'bg-blue-50/50 border-blue-200',
      titleColor: 'text-blue-900',
      buttonVariant: 'primary' as const,
      iconColor: 'text-blue-600',
    },
    danger: {
      bgColor: 'bg-red-50/50 border-red-200',
      titleColor: 'text-red-900',
      buttonVariant: 'destructive' as const,
      iconColor: 'text-red-600',
    },
    success: {
      bgColor: 'bg-green-50/50 border-green-200',
      titleColor: 'text-green-900',
      buttonVariant: 'default' as const,
      iconColor: 'text-green-600',
    },
  };

  const config = variantConfig[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className={cn('w-full max-w-md border-2', config.bgColor)}>
        <CardContent className="p-6">
          {/* Close button */}
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className={cn('p-3 rounded-full bg-white')}>
              {icon ? (
                <div className={cn(config.iconColor)}>{icon}</div>
              ) : variant === 'danger' ? (
                <AlertCircle className={cn('h-8 w-8', config.iconColor)} />
              ) : (
                <CheckCircle2 className={cn('h-8 w-8', config.iconColor)} />
              )}
            </div>
          </div>

          {/* Title */}
          <h3 className={cn('text-lg font-bold text-center mb-2', config.titleColor)}>
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-center text-foreground/80 mb-4">
            {description}
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50/50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              {cancelText}
            </Button>
            <Button
              variant={config.buttonVariant as any}
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 gap-2"
            >
              {isLoading && <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
