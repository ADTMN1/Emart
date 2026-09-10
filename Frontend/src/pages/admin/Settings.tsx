import * as React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

export const AdminSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure admin settings</p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <SettingsIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-semibold">Settings Coming Soon</p>
          <p className="text-sm text-muted-foreground mt-2">
            Admin settings and configuration options will be available here
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
