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
];

const SKIN_TONES = [
  { id: "skin-light", color: "#fde2c4", name: "Light" },
  { id: "skin-medium-light", color: "#e8c4a0", name: "Medium Light" },
  { id: "skin-medium", color: "#c8a080", name: "Medium" },
  { id: "skin-medium-dark", color: "#a07850", name: "Medium Dark" },
  { id: "skin-dark", color: "#6b4423", name: "Dark" },
];

const EYE_STYLES = [
  { id: "eyes-happy", name: "Happy", render: () => (
    <g>
      <ellipse cx="35" cy="42" rx="6" ry="7" fill="#1a1a2e" />
      <ellipse cx="65" cy="42" rx="6" ry="7" fill="#1a1a2e" />
      <circle cx="37" cy="40" r="2" fill="white" />
      <circle cx="67" cy="40" r="2" fill="white" />
    </g>
  )},
  { id: "eyes-round", name: "Round", render: () => (
    <g>
      <circle cx="35" cy="42" r="8" fill="white" stroke="#1a1a2e" strokeWidth="2" />
      <circle cx="65" cy="42" r="8" fill="white" stroke="#1a1a2e" strokeWidth="2" />
      <circle cx="35" cy="42" r="4" fill="#1a1a2e" />
      <circle cx="65" cy="42" r="4" fill="#1a1a2e" />
    </g>
  )},
  { id: "eyes-sleepy", name: "Sleepy", render: () => (
    <g>
      <path d="M28 42 Q35 38 42 42" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M58 42 Q65 38 72 42" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  )},
  { id: "eyes-wink", name: "Wink", render: () => (
    <g>
      <ellipse cx="35" cy="42" rx="6" ry="7" fill="#1a1a2e" />
      <circle cx="37" cy="40" r="2" fill="white" />
      <path d="M58 42 Q65 38 72 42" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  )},
  { id: "eyes-stars", name: "Stars", render: () => (
    <g>
      <text x="35" y="47" fontSize="16" textAnchor="middle" fill="#fbbf24">★</text>
      <text x="65" y="47" fontSize="16" textAnchor="middle" fill="#fbbf24">★</text>
    </g>
  )},
];

const MOUTH_STYLES = [
  { id: "mouth-smile", name: "Smile", render: () => (
    <path d="M40 62 Q50 72 60 62" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
  )},
  { id: "mouth-grin", name: "Grin", render: () => (
    <g>
      <path d="M38 60 Q50 75 62 60" fill="white" stroke="#1a1a2e" strokeWidth="2" />
      <path d="M38 60 Q50 65 62 60" fill="#1a1a2e" />
    </g>
  )},
  { id: "mouth-open", name: "Surprised", render: () => (
    <ellipse cx="50" cy="65" rx="8" ry="10" fill="#1a1a2e" />
  )},
  { id: "mouth-tongue", name: "Playful", render: () => (
    <g>
      <path d="M40 62 Q50 72 60 62" stroke="#1a1a2e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="68" rx="5" ry="6" fill="#ff6b6b" />
    </g>
  )},
  { id: "mouth-cat", name: "Cat", render: () => (
    <g>
      <path d="M42 62 L50 66 L58 62" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="50" y1="66" x2="50" y2="72" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" />
    </g>
  )},
];

const HAIR_STYLES = [
  { id: "hair-none", name: "None", render: () => null },
  { id: "hair-short", name: "Short", render: (color: string) => (
    <path d="M25 35 Q25 15 50 12 Q75 15 75 35 Q70 25 50 22 Q30 25 25 35" fill={color} />
  )},
  { id: "hair-spiky", name: "Spiky", render: (color: string) => (
    <g fill={color}>
      <path d="M30 30 L35 5 L45 28" />
      <path d="M40 28 L50 0 L60 28" />
      <path d="M55 28 L65 5 L70 30" />
      <path d="M25 35 Q25 20 50 18 Q75 20 75 35 Q70 28 50 25 Q30 28 25 35" />
    </g>
  )},
  { id: "hair-long", name: "Long", render: (color: string) => (
    <g fill={color}>
      <path d="M22 35 Q20 15 50 10 Q80 15 78 35 L78 70 Q75 75 70 70 L70 40 Q70 25 50 20 Q30 25 30 40 L30 70 Q25 75 22 70 Z" />
    </g>
  )},
  { id: "hair-curly", name: "Curly", render: (color: string) => (
    <g fill={color}>
      <circle cx="30" cy="20" r="10" />
      <circle cx="45" cy="15" r="10" />
      <circle cx="55" cy="15" r="10" />
      <circle cx="70" cy="20" r="10" />
      <circle cx="25" cy="32" r="8" />
      <circle cx="75" cy="32" r="8" />
      <path d="M25 35 Q25 25 50 22 Q75 25 75 35" />
    </g>
  )},
  { id: "hair-ponytail", name: "Ponytail", render: (color: string) => (
    <g fill={color}>
      <path d="M25 35 Q25 15 50 12 Q75 15 75 35 Q70 25 50 22 Q30 25 25 35" />
      <ellipse cx="75" cy="25" rx="5" ry="25" />
    </g>
  )},
];

const HAIR_COLORS = [
  { id: "hair-black", color: "#1a1a2e", name: "Black" },
  { id: "hair-brown", color: "#5c4033", name: "Brown" },
  { id: "hair-blonde", color: "#f4d03f", name: "Blonde" },
  { id: "hair-red", color: "#c0392b", name: "Red" },
  { id: "hair-blue", color: "#3498db", name: "Blue" },
  { id: "hair-purple", color: "#9b59b6", name: "Purple" },
  { id: "hair-pink", color: "#ff69b4", name: "Pink" },
];

export interface AvatarConfig {
  backgroundColor: string;
  skinTone: string;
  eyeStyle: string;
  mouthStyle: string;
  hairStyle: string;
  hairColor: string;
}

export const defaultAvatarConfig: AvatarConfig = {
  backgroundColor: "bg-blue",
  skinTone: "skin-medium-light",
  eyeStyle: "eyes-happy",
  mouthStyle: "mouth-smile",
  hairStyle: "hair-short",
  hairColor: "hair-brown",
};

export function parseAvatarConfig(avatarString: string | null | undefined): AvatarConfig {
  if (!avatarString) return defaultAvatarConfig;
  try {
    return JSON.parse(avatarString);
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
  const skinColor = SKIN_TONES.find(c => c.id === config.skinTone)?.color || "#fde2c4";
  const eyeStyle = EYE_STYLES.find(e => e.id === config.eyeStyle) || EYE_STYLES[0];
  const mouthStyle = MOUTH_STYLES.find(m => m.id === config.mouthStyle) || MOUTH_STYLES[0];
  const hairStyle = HAIR_STYLES.find(h => h.id === config.hairStyle) || HAIR_STYLES[0];
  const hairColor = HAIR_COLORS.find(c => c.id === config.hairColor)?.color || "#5c4033";

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={cn("rounded-full", className)}
    >
      <circle cx="50" cy="50" r="50" fill={bgColor} />
      <circle cx="50" cy="50" r="35" fill={skinColor} />
      {eyeStyle.render()}
      {mouthStyle.render()}
      {hairStyle.render(hairColor)}
    </svg>
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

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex flex-col items-center gap-4">
        <AvatarDisplay config={config} size={200} />
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
                  "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110",
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
            <CardTitle className="text-sm">Skin Tone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {SKIN_TONES.map(tone => (
              <button
                key={tone.id}
                onClick={() => updateConfig("skinTone", tone.id)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110",
                  config.skinTone === tone.id ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
                )}
                style={{ backgroundColor: tone.color }}
                title={tone.name}
                data-testid={`skin-${tone.id}`}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Eyes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {EYE_STYLES.map(eye => (
              <button
                key={eye.id}
                onClick={() => updateConfig("eyeStyle", eye.id)}
                className={cn(
                  "w-14 h-14 rounded-lg border-2 bg-muted flex items-center justify-center transition-transform hover:scale-105",
                  config.eyeStyle === eye.id ? "border-primary ring-2 ring-offset-2 ring-primary" : "border-border"
                )}
                title={eye.name}
                data-testid={`eye-${eye.id}`}
              >
                <svg width="40" height="40" viewBox="20 30 60 30">
                  {eye.render()}
                </svg>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Mouth</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {MOUTH_STYLES.map(mouth => (
              <button
                key={mouth.id}
                onClick={() => updateConfig("mouthStyle", mouth.id)}
                className={cn(
                  "w-14 h-14 rounded-lg border-2 bg-muted flex items-center justify-center transition-transform hover:scale-105",
                  config.mouthStyle === mouth.id ? "border-primary ring-2 ring-offset-2 ring-primary" : "border-border"
                )}
                title={mouth.name}
                data-testid={`mouth-${mouth.id}`}
              >
                <svg width="40" height="40" viewBox="30 50 40 35">
                  {mouth.render()}
                </svg>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Hair Style</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {HAIR_STYLES.map(hair => (
              <button
                key={hair.id}
                onClick={() => updateConfig("hairStyle", hair.id)}
                className={cn(
                  "w-14 h-14 rounded-lg border-2 bg-muted flex items-center justify-center transition-transform hover:scale-105",
                  config.hairStyle === hair.id ? "border-primary ring-2 ring-offset-2 ring-primary" : "border-border"
                )}
                title={hair.name}
                data-testid={`hair-${hair.id}`}
              >
                <svg width="40" height="40" viewBox="15 0 70 50">
                  {hair.render(HAIR_COLORS.find(c => c.id === config.hairColor)?.color || "#5c4033")}
                </svg>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Hair Color</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {HAIR_COLORS.map(color => (
              <button
                key={color.id}
                onClick={() => updateConfig("hairColor", color.id)}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-transform hover:scale-110",
                  config.hairColor === color.id ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent"
                )}
                style={{ backgroundColor: color.color }}
                title={color.name}
                data-testid={`haircolor-${color.id}`}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
