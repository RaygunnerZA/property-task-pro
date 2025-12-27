import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useToast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordingComplete?: (audioUrl: string) => void;
}

export function AudioRecorder({ open, onOpenChange, onRecordingComplete }: AudioRecorderProps) {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  // Request microphone permission on mount
  useEffect(() => {
    if (open) {
      requestMicrophonePermission();
    } else {
      // Cleanup when dialog closes
      stopRecording();
      resetState();
    }
  }, [open]);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop()); // Stop immediately, we'll start again when recording
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setHasPermission(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to record audio.",
        variant: "destructive",
      });
    }
  };

  const startRecording = async () => {
    if (!orgId) {
      toast({
        title: "Error",
        description: "Organization not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Use webm format (better browser support)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4"; // Fallback

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await uploadAudio(audioBlob, mimeType);
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      toast({
        title: "Recording Error",
        description: err.message || "Failed to start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadAudio = async (audioBlob: Blob, mimeType: string) => {
    if (!orgId) return;

    setIsUploading(true);

    try {
      // Determine file extension
      const extension = mimeType.includes("webm") ? "webm" : "mp4";
      const fileName = `${orgId}/${Date.now()}.${extension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, audioBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: mimeType,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(fileName);

      const audioUrl = urlData.publicUrl;

      // Try to insert into audio_files table if it exists
      try {
        const { error: insertError } = await supabase
          .from("audio_files")
          .insert({
            org_id: orgId,
            file_url: audioUrl,
            file_name: fileName,
            file_size: audioBlob.size,
            mime_type: mimeType,
          } as any);

        if (insertError) {
          // Table might not exist, just log the URL
          console.log("Audio file uploaded. URL:", audioUrl);
          console.log("Note: audio_files table may not exist yet");
        } else {
          console.log("Audio file saved to audio_files table:", audioUrl);
        }
      } catch (tableError) {
        // Table doesn't exist, just log the URL
        console.log("Audio file uploaded. URL:", audioUrl);
        console.log("Note: audio_files table does not exist yet");
      }

      toast({
        title: "Recording Saved",
        description: "Your audio recording has been uploaded successfully.",
      });

      onRecordingComplete?.(audioUrl);
      resetState();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error uploading audio:", err);
      toast({
        title: "Upload Error",
        description: err.message || "Failed to upload audio recording",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop any active stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Audio</DialogTitle>
          <DialogDescription>
            Record a voice note or audio message
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          {hasPermission === false ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Microphone access is required to record audio.
              </p>
              <Button onClick={requestMicrophonePermission} variant="outline">
                Request Permission
              </Button>
            </div>
          ) : (
            <>
              {/* Recording Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isUploading}
                className={`
                  w-24 h-24 rounded-full flex items-center justify-center
                  transition-all duration-200
                  ${isRecording
                    ? "bg-destructive text-destructive-foreground shadow-lg scale-110"
                    : "bg-primary text-primary-foreground shadow-e1 hover:scale-105"
                  }
                  ${isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  active:scale-95
                `}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isUploading ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-10 w-10" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </button>

              {/* Recording Time */}
              {isRecording && (
                <div className="text-center">
                  <div className="text-2xl font-mono font-bold text-foreground">
                    {formatTime(recordingTime)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Recording...
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {isUploading && (
                <p className="text-sm text-muted-foreground text-center">
                  Uploading audio...
                </p>
              )}

              {!isRecording && !isUploading && recordingTime === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Click the microphone to start recording
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

