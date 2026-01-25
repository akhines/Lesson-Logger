import { cn } from "@/lib/utils";
import { STUDENT_AVATARS } from "@shared/schema";

interface AvatarSelectorProps {
  value?: string;
  onChange: (avatar: string) => void;
  size?: "sm" | "md" | "lg";
}

const AVATAR_EMOJIS: Record<string, string> = {
  bear: "🐻",
  bunny: "🐰",
  cat: "🐱",
  dog: "🐶",
  elephant: "🐘",
  fox: "🦊",
  giraffe: "🦒",
  koala: "🐨",
  lion: "🦁",
  monkey: "🐵",
  owl: "🦉",
  panda: "🐼",
  penguin: "🐧",
  raccoon: "🦝",
  tiger: "🐯",
  unicorn: "🦄",
};

const AVATAR_COLORS: Record<string, string> = {
  bear: "#8B4513",
  bunny: "#FFB6C1",
  cat: "#FFA500",
  dog: "#D2691E",
  elephant: "#808080",
  fox: "#FF6347",
  giraffe: "#DAA520",
  koala: "#A9A9A9",
  lion: "#FFD700",
  monkey: "#CD853F",
  owl: "#8B4513",
  panda: "#000000",
  penguin: "#1a1a2e",
  raccoon: "#696969",
  tiger: "#FF8C00",
  unicorn: "#DDA0DD",
};

export function AvatarSelector({ value, onChange, size = "md" }: AvatarSelectorProps) {
  const sizeClasses = {
    sm: "h-10 w-10 text-xl",
    md: "h-14 w-14 text-2xl",
    lg: "h-20 w-20 text-4xl",
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {STUDENT_AVATARS.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onChange(avatar)}
          className={cn(
            "rounded-full flex items-center justify-center transition-all",
            sizeClasses[size],
            value === avatar
              ? "ring-2 ring-primary ring-offset-2 scale-110"
              : "hover:scale-105 opacity-70 hover:opacity-100"
          )}
          style={{ backgroundColor: `${AVATAR_COLORS[avatar]}20` }}
          data-testid={`avatar-${avatar}`}
        >
          <span>{AVATAR_EMOJIS[avatar]}</span>
        </button>
      ))}
    </div>
  );
}

export function StudentAvatar({ 
  avatar, 
  size = "md",
  className 
}: { 
  avatar?: string | null; 
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-lg",
    md: "h-12 w-12 text-2xl",
    lg: "h-16 w-16 text-3xl",
    xl: "h-24 w-24 text-5xl",
  };

  const defaultAvatar = "bear";
  const displayAvatar = avatar || defaultAvatar;
  const emoji = AVATAR_EMOJIS[displayAvatar] || AVATAR_EMOJIS[defaultAvatar];
  const bgColor = AVATAR_COLORS[displayAvatar] || AVATAR_COLORS[defaultAvatar];

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: `${bgColor}20` }}
    >
      <span>{emoji}</span>
    </div>
  );
}

export { AVATAR_EMOJIS, AVATAR_COLORS };
