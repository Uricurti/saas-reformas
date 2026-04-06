import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-bold text-content-primary leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-content-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
