interface FloatingActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;  // for aria-label (accessibility)
  position?: 'bottom-right' | 'bottom-left';
}

export function FloatingActionButton({
  icon: Icon,
  onClick,
  label,
  position = 'bottom-right'
}: FloatingActionButtonProps) {
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        fixed ${positionClasses[position]}
        h-14 w-14
        rounded-full
        bg-gradient-to-br from-lavender to-peach
        shadow-lg
        hover:shadow-xl
        hover:scale-105
        active:scale-95
        transition-all duration-base
        flex items-center justify-center
      `}
    >
      <Icon className="h-6 w-6 text-white" />
    </button>
  );
}
