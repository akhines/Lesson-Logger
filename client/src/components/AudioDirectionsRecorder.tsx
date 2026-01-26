import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Upload, Trash2, Loader2 } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";

interface AudioDirectionsRecorderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (isUploading: boolean) => void;
}

export function AudioDirectionsRecorder({ value, onChange, onUploadingChange }: AudioDirectionsRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      console.log("Audio upload success, setting path:", response.objectPath);
      onChange(response.objectPath);
      toast({ title: "Audio uploaded successfully" });
    },
    onError: (error) => {
      console.error("Audio upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  // Notify parent when uploading state changes
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record audio directions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const togglePlayback = useCallback(() => {
    const audioUrl = recordedUrl || value;
    if (!audioUrl) return;
    
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [recordedUrl, value, isPlaying]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an audio file (MP3, WAV, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    await uploadFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile, toast]);

  const uploadRecording = useCallback(async () => {
    if (!recordedBlob) return;
    
    const extension = recordedBlob.type.includes('webm') ? 'webm' : 'mp4';
    const file = new File([recordedBlob], `audio-directions-${Date.now()}.${extension}`, {
      type: recordedBlob.type,
    });
    
    const result = await uploadFile(file);
    if (result) {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      setRecordedBlob(null);
      setRecordedUrl(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [recordedBlob, uploadFile, recordedUrl]);

  const clearAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setIsPlaying(false);
    onChange(null);
  }, [recordedUrl, onChange]);

  const hasAudio = Boolean(recordedUrl || value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isRecording ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
            disabled={isUploading}
            data-testid="button-start-recording"
          >
            <Mic className="h-4 w-4 mr-1" />
            Record
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
            data-testid="button-stop-recording"
          >
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
        )}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isRecording}
          data-testid="button-upload-audio"
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload MP3
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
          data-testid="input-audio-file"
        />
      </div>
      
      {(recordedBlob && !value) && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            data-testid="button-play-preview"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-sm text-muted-foreground flex-1">Recording ready</span>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={uploadRecording}
            disabled={isUploading}
            data-testid="button-save-recording"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {progress}%
              </>
            ) : (
              "Save"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearAudio}
            data-testid="button-discard-recording"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {value && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            data-testid="button-play-saved"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <span className="text-sm text-muted-foreground flex-1">Audio directions saved</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearAudio}
            data-testid="button-remove-audio"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {isRecording && (
        <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/20 rounded-md">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-700 dark:text-red-400">Recording...</span>
        </div>
      )}
    </div>
  );
}
