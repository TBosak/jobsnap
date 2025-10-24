import { calculateCompleteness } from '../../ui-shared/utils/profile-completeness';
import { ProgressRing } from './ProgressRing';
import type { ProfileRecord } from '../../ui-shared/schema';

interface ProfileCardProps {
  profile: ProfileRecord;
  isActive: boolean;
  onSelect: (profileId: string) => void;
}

export function ProfileCard({ profile, isActive, onSelect }: ProfileCardProps) {
  const completeness = calculateCompleteness(profile);

  return (
    <button
      onClick={() => onSelect(profile.id)}
      className={`
        w-full
        rounded-2xl
        border-2
        p-4
        flex items-center gap-4
        transition-all duration-base
        hover:shadow-lg hover:scale-105 active:scale-95
        ${isActive
          ? 'border-peach shadow-glow-active bg-peach/5'
          : 'border-slate-200 hover:border-mint hover:bg-mint/5'
        }
      `}
    >
      <ProgressRing percentage={completeness} size={56} />
      <div className="flex-1 text-left">
        <p className="font-semibold text-slate-800">{profile.name}</p>
        <p className="text-xs text-slate-500 mt-1">
          Updated {new Date(profile.updatedAt).toLocaleDateString()}
        </p>
      </div>
      {isActive && (
        <span className="text-xs font-semibold uppercase text-peach">
          Active
        </span>
      )}
    </button>
  );
}
