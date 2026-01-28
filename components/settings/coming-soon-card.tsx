import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComingSoonCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function ComingSoonCard({
  title,
  description,
  icon: Icon,
}: ComingSoonCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        <Badge variant="secondary" className="mt-4">
          Coming Soon
        </Badge>
      </CardContent>
    </Card>
  );
}
