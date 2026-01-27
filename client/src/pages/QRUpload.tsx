import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle, Camera, X, FileImage, FileText, FileAudio, FileVideo } from "lucide-react";
import Uppy from "@uppy/core";
import AwsS3 from "@uppy/aws-s3";

interface TokenInfo {
  studentId: number;
  studentName: string;
  valid: boolean;
}

export default function QRUpload() {
  const [, params] = useRoute("/upload/:token");
  const token = params?.token;
  const { toast } = useToast();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/upload/${token}`)
      .then(res => {
        if (!res.ok) throw new Error("Invalid or expired upload link");
        return res.json();
      })
      .then(data => {
        setTokenInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <FileImage className="h-12 w-12 text-muted-foreground" />;
    if (file.type.startsWith("video/")) return <FileVideo className="h-12 w-12 text-muted-foreground" />;
    if (file.type.startsWith("audio/")) return <FileAudio className="h-12 w-12 text-muted-foreground" />;
    return <FileText className="h-12 w-12 text-muted-foreground" />;
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setUploading(true);
    try {
      const uppy = new Uppy({
        restrictions: {
          maxNumberOfFiles: 1,
          allowedFileTypes: ["image/*", "video/*", "audio/*", ".pdf", ".doc", ".docx"],
        },
      });

      uppy.use(AwsS3, {
        shouldUseMultipart: false,
        async getUploadParameters(file) {
          const res = await fetch(`/api/upload/${token}/presign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
            }),
          });
          if (!res.ok) throw new Error("Failed to get upload URL");
          const data = await res.json();
          return {
            method: "PUT" as const,
            url: data.url,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          };
        },
      });

      uppy.addFile({
        name: selectedFile.name,
        type: selectedFile.type,
        data: selectedFile,
      });

      const result = await uppy.upload();

      if (result?.successful && result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const response = uploadedFile.response as { uploadURL?: string } | undefined;
        const fileUrl = response?.uploadURL?.split("?")[0] || "";
        
        const saveRes = await fetch(`/api/upload/${token}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl,
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            title: title || selectedFile.name,
            description,
          }),
        });

        if (!saveRes.ok) throw new Error("Failed to save upload");

        setSuccess(true);
        toast({
          title: "Upload Complete",
          description: "Your work has been submitted for review!",
        });
      } else {
        throw new Error("Upload failed");
      }
    } catch (err: any) {
      toast({
        title: "Upload Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setTitle("");
    setDescription("");
    clearFile();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !tokenInfo?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
            <CardDescription>
              This upload link is invalid or has expired. Please ask your parent for a new QR code.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Great job, {tokenInfo.studentName}!</h2>
            <p className="text-muted-foreground">
              Your work has been uploaded and is waiting for review.
            </p>
            <Button onClick={resetForm} className="w-full" data-testid="button-upload-another">
              Upload Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Upload Your Work</CardTitle>
            <CardDescription>
              Hi {tokenInfo.studentName}! Take a photo or select a file to upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedFile ? (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                  data-testid="button-take-photo"
                >
                  <Camera className="h-8 w-8" />
                  <span>Take Photo</span>
                </Button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />

                <Button
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-choose-file"
                >
                  <Upload className="h-8 w-8" />
                  <span>Choose File</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border rounded-lg p-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={clearFile}
                    data-testid="button-clear-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4">
                      {getFileIcon(selectedFile)}
                      <span className="text-sm text-muted-foreground truncate max-w-full px-2">
                        {selectedFile.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    placeholder="What is this?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="input-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Notes (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Any notes about your work..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={uploading}
                  data-testid="button-submit-upload"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
