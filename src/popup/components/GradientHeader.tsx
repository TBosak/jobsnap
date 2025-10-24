interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradientVariant?: 'primary' | 'secondary' | 'tertiary';
}

export function GradientHeader({
  title,
  subtitle,
  action,
  gradientVariant = 'primary'
}: GradientHeaderProps) {
  const gradientClasses = {
    primary: 'bg-gradient-primary',
    secondary: 'bg-gradient-secondary',
    tertiary: 'bg-gradient-tertiary',
  };

  return (
    <header className={`
      ${gradientClasses[gradientVariant]}
      p-6
      rounded-t-xl
      flex items-center justify-between
    `}>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
