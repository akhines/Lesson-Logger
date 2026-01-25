import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const BACKGROUND_COLORS = [
  { id: "bg-red", color: "#ef4444", name: "Red" },
  { id: "bg-orange", color: "#f97316", name: "Orange" },
  { id: "bg-amber", color: "#f59e0b", name: "Yellow" },
  { id: "bg-green", color: "#22c55e", name: "Green" },
  { id: "bg-teal", color: "#14b8a6", name: "Teal" },
  { id: "bg-blue", color: "#3b82f6", name: "Blue" },
  { id: "bg-purple", color: "#a855f7", name: "Purple" },
  { id: "bg-pink", color: "#ec4899", name: "Pink" },
  { id: "bg-slate", color: "#64748b", name: "Slate" },
  { id: "bg-rose", color: "#f43f5e", name: "Rose" },
  { id: "bg-cyan", color: "#06b6d4", name: "Cyan" },
  { id: "bg-lime", color: "#84cc16", name: "Lime" },
];

// SVG Icon renderers - all use white (#fff) as primary color for contrast
const IconRenderers: Record<string, () => JSX.Element> = {
  // Animals
  bear: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="12" cy="13" r="9" />
      <circle cx="9" cy="11" r="1.5" fill="#333" />
      <circle cx="15" cy="11" r="1.5" fill="#333" />
      <ellipse cx="12" cy="15" rx="2" ry="1.5" fill="#333" />
    </svg>
  ),
  bunny: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <ellipse cx="9" cy="6" rx="2" ry="5" />
      <ellipse cx="15" cy="6" rx="2" ry="5" />
      <circle cx="12" cy="15" r="7" />
      <circle cx="10" cy="14" r="1" fill="#333" />
      <circle cx="14" cy="14" r="1" fill="#333" />
      <ellipse cx="12" cy="17" rx="1.5" ry="1" fill="#ffb6c1" />
    </svg>
  ),
  cat: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <polygon points="5,5 8,12 2,12" />
      <polygon points="19,5 22,12 16,12" />
      <circle cx="12" cy="15" r="8" />
      <circle cx="9" cy="13" r="1.5" fill="#333" />
      <circle cx="15" cy="13" r="1.5" fill="#333" />
      <path d="M11 17 L12 18 L13 17" stroke="#333" strokeWidth="0.5" fill="none" />
    </svg>
  ),
  dog: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <ellipse cx="5" cy="10" rx="3" ry="4" />
      <ellipse cx="19" cy="10" rx="3" ry="4" />
      <circle cx="12" cy="14" r="8" />
      <circle cx="9" cy="12" r="1.5" fill="#333" />
      <circle cx="15" cy="12" r="1.5" fill="#333" />
      <ellipse cx="12" cy="16" rx="2.5" ry="2" fill="#333" />
    </svg>
  ),
  fox: () => (
    <svg viewBox="0 0 24 24" fill="#f97316" className="w-full h-full">
      <polygon points="4,4 9,14 2,14" />
      <polygon points="20,4 22,14 15,14" />
      <ellipse cx="12" cy="16" rx="8" ry="6" />
      <circle cx="9" cy="14" r="1" fill="#333" />
      <circle cx="15" cy="14" r="1" fill="#333" />
      <polygon points="12,16 10,19 14,19" fill="white" />
    </svg>
  ),
  owl: () => (
    <svg viewBox="0 0 24 24" fill="#8b4513" className="w-full h-full">
      <circle cx="12" cy="14" r="9" />
      <circle cx="8" cy="12" r="4" fill="white" />
      <circle cx="16" cy="12" r="4" fill="white" />
      <circle cx="8" cy="12" r="2" fill="#333" />
      <circle cx="16" cy="12" r="2" fill="#333" />
      <polygon points="12,15 10,18 14,18" fill="#f59e0b" />
    </svg>
  ),
  lion: () => (
    <svg viewBox="0 0 24 24" fill="#fbbf24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#c9a227" />
      <circle cx="12" cy="14" r="7" fill="#fbbf24" />
      <circle cx="9" cy="13" r="1.5" fill="#333" />
      <circle cx="15" cy="13" r="1.5" fill="#333" />
      <ellipse cx="12" cy="16" rx="1.5" ry="1" fill="#333" />
    </svg>
  ),
  panda: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <circle cx="6" cy="7" r="3" fill="#333" />
      <circle cx="18" cy="7" r="3" fill="#333" />
      <circle cx="12" cy="14" r="9" fill="white" />
      <ellipse cx="8" cy="12" rx="3" ry="2.5" fill="#333" />
      <ellipse cx="16" cy="12" rx="3" ry="2.5" fill="#333" />
      <circle cx="8" cy="12" r="1" fill="white" />
      <circle cx="16" cy="12" r="1" fill="white" />
      <ellipse cx="12" cy="16" rx="2" ry="1.5" fill="#333" />
    </svg>
  ),
  penguin: () => (
    <svg viewBox="0 0 24 24" fill="#1a1a2e" className="w-full h-full">
      <ellipse cx="12" cy="14" rx="8" ry="9" fill="#1a1a2e" />
      <ellipse cx="12" cy="15" rx="5" ry="6" fill="white" />
      <circle cx="9" cy="11" r="1.5" fill="white" />
      <circle cx="15" cy="11" r="1.5" fill="white" />
      <circle cx="9" cy="11" r="0.7" fill="#333" />
      <circle cx="15" cy="11" r="0.7" fill="#333" />
      <polygon points="12,14 10,16 14,16" fill="#f59e0b" />
    </svg>
  ),
  butterfly: () => (
    <svg viewBox="0 0 24 24" fill="#a855f7" className="w-full h-full">
      <ellipse cx="6" cy="8" rx="5" ry="6" />
      <ellipse cx="18" cy="8" rx="5" ry="6" />
      <ellipse cx="6" cy="16" rx="4" ry="5" fill="#c084fc" />
      <ellipse cx="18" cy="16" rx="4" ry="5" fill="#c084fc" />
      <rect x="11" y="4" width="2" height="16" rx="1" fill="#333" />
      <circle cx="12" cy="4" r="1.5" fill="#333" />
    </svg>
  ),
  unicorn: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      <polygon points="12,1 10,8 14,8" fill="#fbbf24" />
      <circle cx="12" cy="14" r="8" fill="white" />
      <circle cx="9" cy="13" r="1.5" fill="#333" />
      <circle cx="15" cy="13" r="1.5" fill="#333" />
      <path d="M9 17 Q12 19 15 17" stroke="#ec4899" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  fish: () => (
    <svg viewBox="0 0 24 24" fill="#06b6d4" className="w-full h-full">
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <polygon points="20,12 24,6 24,18" />
      <circle cx="7" cy="11" r="2" fill="white" />
      <circle cx="7" cy="11" r="1" fill="#333" />
    </svg>
  ),
  // Flowers
  sunflower: () => (
    <svg viewBox="0 0 24 24" fill="#fbbf24" className="w-full h-full">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="12"
          rx="3"
          ry="6"
          fill="#fbbf24"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="4" fill="#92400e" />
    </svg>
  ),
  rose: () => (
    <svg viewBox="0 0 24 24" fill="#e11d48" className="w-full h-full">
      <circle cx="12" cy="10" r="4" fill="#e11d48" />
      <circle cx="8" cy="12" r="3" fill="#be123c" />
      <circle cx="16" cy="12" r="3" fill="#be123c" />
      <circle cx="12" cy="15" r="3.5" fill="#f43f5e" />
      <rect x="11" y="16" width="2" height="6" fill="#16a34a" />
    </svg>
  ),
  tulip: () => (
    <svg viewBox="0 0 24 24" fill="#f472b6" className="w-full h-full">
      <ellipse cx="12" cy="8" rx="6" ry="8" fill="#f472b6" />
      <path d="M12 8 L8 4 L12 6 L16 4 Z" fill="#ec4899" />
      <rect x="11" y="14" width="2" height="8" fill="#16a34a" />
    </svg>
  ),
  hibiscus: () => (
    <svg viewBox="0 0 24 24" fill="#ec4899" className="w-full h-full">
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="8"
          rx="4"
          ry="6"
          fill="#ec4899"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill="#fbbf24" />
    </svg>
  ),
  blossom: () => (
    <svg viewBox="0 0 24 24" fill="#fcd34d" className="w-full h-full">
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <circle
          key={i}
          cx="12"
          cy="6"
          r="4"
          fill="#fcd34d"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill="#f59e0b" />
    </svg>
  ),
  lotus: () => (
    <svg viewBox="0 0 24 24" fill="#f9a8d4" className="w-full h-full">
      <ellipse cx="12" cy="14" rx="3" ry="6" fill="#f9a8d4" />
      <ellipse cx="8" cy="14" rx="3" ry="5" fill="#fbcfe8" />
      <ellipse cx="16" cy="14" rx="3" ry="5" fill="#fbcfe8" />
      <ellipse cx="5" cy="15" rx="2" ry="4" fill="#fce7f3" />
      <ellipse cx="19" cy="15" rx="2" ry="4" fill="#fce7f3" />
    </svg>
  ),
  cherry: () => (
    <svg viewBox="0 0 24 24" fill="#fce7f3" className="w-full h-full">
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="8"
          rx="3"
          ry="5"
          fill="#fce7f3"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2" fill="#fbbf24" />
    </svg>
  ),
  daisy: () => (
    <svg viewBox="0 0 24 24" fill="white" className="w-full h-full">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="6"
          rx="2"
          ry="5"
          fill="white"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill="#fbbf24" />
    </svg>
  ),
  // Nature
  tree: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <polygon points="12,2 4,12 8,12 4,18 20,18 16,12 20,12" fill="#16a34a" />
      <rect x="10" y="18" width="4" height="4" fill="#92400e" />
    </svg>
  ),
  evergreen: () => (
    <svg viewBox="0 0 24 24" fill="#166534" className="w-full h-full">
      <polygon points="12,1 6,8 8,8 4,14 7,14 3,20 21,20 17,14 20,14 16,8 18,8" fill="#166534" />
      <rect x="10" y="20" width="4" height="3" fill="#92400e" />
    </svg>
  ),
  palm: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <path d="M12,8 Q6,2 2,6" stroke="#16a34a" strokeWidth="3" fill="none" />
      <path d="M12,8 Q18,2 22,6" stroke="#16a34a" strokeWidth="3" fill="none" />
      <path d="M12,8 Q4,10 2,14" stroke="#22c55e" strokeWidth="3" fill="none" />
      <path d="M12,8 Q20,10 22,14" stroke="#22c55e" strokeWidth="3" fill="none" />
      <rect x="11" y="8" width="2" height="14" fill="#92400e" />
    </svg>
  ),
  cactus: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <rect x="10" y="6" width="4" height="16" rx="2" fill="#16a34a" />
      <rect x="4" y="10" width="6" height="3" rx="1.5" fill="#16a34a" />
      <rect x="4" y="8" width="3" height="5" rx="1.5" fill="#16a34a" />
      <rect x="14" y="12" width="6" height="3" rx="1.5" fill="#16a34a" />
      <rect x="17" y="10" width="3" height="5" rx="1.5" fill="#16a34a" />
    </svg>
  ),
  seedling: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <ellipse cx="8" cy="8" rx="5" ry="4" fill="#16a34a" transform="rotate(-30 8 8)" />
      <ellipse cx="16" cy="8" rx="5" ry="4" fill="#22c55e" transform="rotate(30 16 8)" />
      <rect x="11" y="8" width="2" height="14" fill="#16a34a" />
    </svg>
  ),
  leaf: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <ellipse cx="12" cy="10" rx="8" ry="10" fill="#16a34a" transform="rotate(-20 12 10)" />
      <path d="M12,2 L12,20" stroke="#15803d" strokeWidth="1.5" />
      <path d="M8,8 L12,12" stroke="#15803d" strokeWidth="1" />
      <path d="M16,8 L12,12" stroke="#15803d" strokeWidth="1" />
    </svg>
  ),
  maple: () => (
    <svg viewBox="0 0 24 24" fill="#dc2626" className="w-full h-full">
      <path d="M12,2 L10,6 L6,4 L8,8 L2,10 L6,12 L4,16 L9,14 L12,22 L15,14 L20,16 L18,12 L22,10 L16,8 L18,4 L14,6 Z" fill="#dc2626" />
    </svg>
  ),
  clover: () => (
    <svg viewBox="0 0 24 24" fill="#16a34a" className="w-full h-full">
      <circle cx="12" cy="7" r="4" fill="#16a34a" />
      <circle cx="7" cy="12" r="4" fill="#22c55e" />
      <circle cx="17" cy="12" r="4" fill="#22c55e" />
      <circle cx="12" cy="17" r="4" fill="#16a34a" />
      <rect x="11" y="16" width="2" height="6" fill="#15803d" />
    </svg>
  ),
};

// Icon categories for UI
const ANIMALS = [
  { id: "bear", name: "Bear" },
  { id: "bunny", name: "Bunny" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "fox", name: "Fox" },
  { id: "owl", name: "Owl" },
  { id: "lion", name: "Lion" },
  { id: "panda", name: "Panda" },
  { id: "penguin", name: "Penguin" },
  { id: "unicorn", name: "Unicorn" },
  { id: "butterfly", name: "Butterfly" },
  { id: "fish", name: "Fish" },
];

const FLOWERS = [
  { id: "sunflower", name: "Sunflower" },
  { id: "rose", name: "Rose" },
  { id: "tulip", name: "Tulip" },
  { id: "hibiscus", name: "Hibiscus" },
  { id: "blossom", name: "Blossom" },
  { id: "lotus", name: "Lotus" },
  { id: "cherry", name: "Cherry Blossom" },
  { id: "daisy", name: "Daisy" },
];

const NATURE = [
  { id: "tree", name: "Tree" },
  { id: "evergreen", name: "Evergreen" },
  { id: "palm", name: "Palm" },
  { id: "cactus", name: "Cactus" },
  { id: "seedling", name: "Seedling" },
  { id: "leaf", name: "Leaf" },
  { id: "maple", name: "Maple Leaf" },
  { id: "clover", name: "Clover" },
];

export interface AvatarConfig {
  backgroundColor: string;
  icon: string;
}

export const defaultAvatarConfig: AvatarConfig = {
  backgroundColor: "bg-blue",
  icon: "bear",
};

export function parseAvatarConfig(avatarString: string | null | undefined): AvatarConfig {
  if (!avatarString) return defaultAvatarConfig;
  try {
    const parsed = JSON.parse(avatarString);
    // Handle legacy avatar configs - if they have old properties, convert to new format
    if (parsed.skinTone || parsed.eyeStyle || parsed.hairStyle) {
      return {
        backgroundColor: parsed.backgroundColor || defaultAvatarConfig.backgroundColor,
        icon: defaultAvatarConfig.icon,
      };
    }
    return {
      backgroundColor: parsed.backgroundColor || defaultAvatarConfig.backgroundColor,
      icon: parsed.icon || defaultAvatarConfig.icon,
    };
  } catch {
    return defaultAvatarConfig;
  }
}

export function serializeAvatarConfig(config: AvatarConfig): string {
  return JSON.stringify(config);
}

interface AvatarDisplayProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export function AvatarDisplay({ config, size = 100, className }: AvatarDisplayProps) {
  const bgColor = BACKGROUND_COLORS.find(c => c.id === config.backgroundColor)?.color || "#3b82f6";
  const IconRenderer = IconRenderers[config.icon] || IconRenderers.bear;
  const iconSize = size * 0.6;

  return (
    <div
      className={cn("rounded-full flex items-center justify-center", className)}
      style={{ 
        backgroundColor: bgColor, 
        width: size, 
        height: size,
      }}
    >
      <div style={{ width: iconSize, height: iconSize }}>
        {IconRenderer()}
      </div>
    </div>
  );
}

interface AvatarBuilderProps {
  initialConfig?: AvatarConfig;
  onSave: (config: AvatarConfig) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export function AvatarBuilder({ initialConfig, onSave, onCancel, saving }: AvatarBuilderProps) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig || defaultAvatarConfig);

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderIconButton = (item: { id: string; name: string }) => {
    const IconRenderer = IconRenderers[item.id];
    if (!IconRenderer) return null;
    
    return (
      <button
        key={item.id}
        onClick={() => updateConfig("icon", item.id)}
        className={cn(
          "w-12 h-12 rounded-lg border-2 flex items-center justify-center bg-muted/50 p-1 hover-elevate active-elevate-2",
          config.icon === item.id ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
        )}
        title={item.name}
        data-testid={`icon-${item.id}`}
      >
        <div className="w-8 h-8">
          {IconRenderer()}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex flex-col items-center gap-4">
        <AvatarDisplay config={config} size={150} />
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-avatar">
              Cancel
            </Button>
          )}
          <Button onClick={() => onSave(config)} disabled={saving} data-testid="button-save-avatar">
            {saving ? "Saving..." : "Save Avatar"}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto max-h-[60vh]">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Background Color</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {BACKGROUND_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => updateConfig("backgroundColor", color.id)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 hover-elevate active-elevate-2",
                  config.backgroundColor === color.id ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
                )}
                style={{ backgroundColor: color.color }}
                title={color.name}
                data-testid={`color-${color.id}`}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Animals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ANIMALS.map(renderIconButton)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Flowers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {FLOWERS.map(renderIconButton)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Nature</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {NATURE.map(renderIconButton)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
