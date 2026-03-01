import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useStudents } from "@/hooks/use-students";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Printer, ChevronLeft, ChevronRight, RotateCw, QrCode } from "lucide-react";
import type { Student } from "@shared/schema";

interface QrData {
  svg: string;
  uploadUrl: string;
  studentName: string;
}

export default function UploadStation() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: students, isLoading: studentsLoading } = useStudents();
  const [, setLocation] = useLocation();

  const urlParams = new URLSearchParams(window.location.search);
  const studentIdParam = urlParams.get("studentId");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrData, setQrData] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateInterval, setRotateIntervalMs] = useState(10000);

  const currentStudent: Student | undefined = students?.[currentIndex];

  useEffect(() => {
    if (!students?.length || !studentIdParam) return;
    const idx = students.findIndex(s => s.id === Number(studentIdParam));
    if (idx >= 0) setCurrentIndex(idx);
  }, [students, studentIdParam]);

  const loadQr = useCallback(async (student: Student) => {
    setQrLoading(true);
    setQrData(null);
    try {
      const res = await fetch(`/api/students/${student.id}/qr-code`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setQrData(data);
      }
    } catch {
      setQrData(null);
    } finally {
      setQrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentStudent) {
      loadQr(currentStudent);
    }
  }, [currentStudent, loadQr]);

  useEffect(() => {
    if (!autoRotate || !students || students.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % students.length);
    }, rotateInterval);
    return () => clearInterval(timer);
  }, [autoRotate, students, rotateInterval]);

  const goNext = () => {
    if (!students?.length) return;
    setCurrentIndex(prev => (prev + 1) % students.length);
  };

  const goPrev = () => {
    if (!students?.length) return;
    setCurrentIndex(prev => (prev - 1 + students.length) % students.length);
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading || studentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-upload-station" />
      </div>
    );
  }

  if (!user) {
    setLocation("/");
    return null;
  }

  if (!students?.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-display font-bold mb-2" data-testid="text-no-students">No Students Found</h1>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Add a student first to generate upload QR codes.
        </p>
        <Button onClick={() => setLocation("/students")} data-testid="button-go-students">
          Go to Students
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 print:p-0 print:bg-white">
      <div className="print:hidden absolute top-4 left-4">
        <Button variant="ghost" onClick={() => setLocation("/lesson-logging")} data-testid="button-back-lessons">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="print:hidden absolute top-4 right-4 flex items-center gap-3">
        <Button variant="outline" onClick={handlePrint} data-testid="button-print-qr">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="flex flex-col items-center max-w-lg w-full">
        <h1 className="text-3xl font-display font-bold mb-1 text-center print:text-black" data-testid="text-upload-station-title">
          Upload Station
        </h1>
        <p className="text-muted-foreground mb-6 text-center print:text-gray-600">
          Scan to upload student work
        </p>

        <Card className="w-full print:shadow-none print:border-none">
          <CardContent className="flex flex-col items-center p-8">
            <h2 className="text-2xl font-display font-semibold mb-6 print:text-black" data-testid="text-current-student-name">
              {currentStudent?.name}
            </h2>

            <div className="bg-white p-6 rounded-md mb-6 print:p-2" data-testid="qr-code-container">
              {qrLoading ? (
                <div className="flex items-center justify-center h-64 w-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrData ? (
                <div
                  dangerouslySetInnerHTML={{ __html: qrData.svg }}
                  className="[&>svg]:w-64 [&>svg]:h-64 print:[&>svg]:w-80 print:[&>svg]:h-80"
                  data-testid="qr-code-display"
                />
              ) : (
                <div className="flex items-center justify-center h-64 w-64 text-muted-foreground">
                  Failed to load QR code
                </div>
              )}
            </div>

            {qrData && (
              <p className="text-sm text-muted-foreground text-center mb-4 font-mono break-all print:text-black print:text-xs" data-testid="text-upload-url">
                {qrData.uploadUrl}
              </p>
            )}

            <div className="w-full border-t pt-6 mt-2 print:border-black">
              <h3 className="text-sm font-semibold text-center mb-3 uppercase tracking-wider text-muted-foreground print:text-black">
                How it works
              </h3>
              <ol className="space-y-2 text-sm text-muted-foreground print:text-black">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold print:bg-gray-200 print:text-black">1</span>
                  <span>Scan the QR code with your phone camera</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold print:bg-gray-200 print:text-black">2</span>
                  <span>Take a photo or choose a file to upload</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold print:bg-gray-200 print:text-black">3</span>
                  <span>Photos appear in your Evidence Inbox for review</span>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {students.length > 1 && (
          <div className="mt-6 flex flex-col items-center gap-4 print:hidden">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={goPrev} data-testid="button-prev-student">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[80px] text-center" data-testid="text-student-counter">
                {currentIndex + 1} of {students.length}
              </span>
              <Button variant="outline" size="icon" onClick={goNext} data-testid="button-next-student">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="auto-rotate"
                checked={autoRotate}
                onCheckedChange={setAutoRotate}
                data-testid="switch-auto-rotate"
              />
              <Label htmlFor="auto-rotate" className="text-sm text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-3 w-3" />
                Auto-rotate every 10s
              </Label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
