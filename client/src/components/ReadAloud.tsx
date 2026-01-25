import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";

interface ReadAloudProps {
  text: string;
  className?: string;
}

export function ReadAloud({ text, className }: ReadAloudProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.speechSynthesis) {
      setIsSupported(false);
    }
    
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    const handleEnd = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.addEventListener?.("end", handleEnd);
    return () => {
      window.speechSynthesis.removeEventListener?.("end", handleEnd);
    };
  }, []);

  const speak = () => {
    if (!window.speechSynthesis || !text) return;

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const pause = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const resume = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  };

  const stop = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  if (!isSupported || !text) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      {!isPlaying ? (
        <Button
          variant="outline"
          size="sm"
          onClick={speak}
          className="gap-2"
          data-testid="button-read-aloud"
        >
          <Volume2 className="h-4 w-4" />
          Read Aloud
        </Button>
      ) : (
        <>
          {isPaused ? (
            <Button
              variant="outline"
              size="sm"
              onClick={resume}
              className="gap-2"
              data-testid="button-resume-reading"
            >
              <Play className="h-4 w-4" />
              Resume
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={pause}
              className="gap-2"
              data-testid="button-pause-reading"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={stop}
            data-testid="button-stop-reading"
          >
            <VolumeX className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

interface ReadAloudTextProps {
  children: string;
  className?: string;
}

export function ReadAloudText({ children, className }: ReadAloudTextProps) {
  return (
    <div className={className}>
      <div className="mb-2">
        <ReadAloud text={children} />
      </div>
      <p>{children}</p>
    </div>
  );
}
