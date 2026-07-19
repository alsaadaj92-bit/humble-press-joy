import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function UploadFab() {
  const [dragging, setDragging] = useState(false);

  const notifyPhase = () =>
    toast({
      title: "الرفع سيتوفر في المرحلة 2",
      description:
        "سنربط هذا الزر بمزودي التخزين (تيليجرام / خادم محلي / File System API).",
    });

  return (
    <>
      {/* Drag overlay */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          notifyPhase();
        }}
        className={cn(
          "pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-primary/70 bg-primary/10 backdrop-blur-sm transition-opacity",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="rounded-2xl bg-card px-6 py-4 text-center shadow-2xl">
          <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-semibold">أفلت الصور هنا للرفع</p>
        </div>
      </div>

      {/* Invisible drop catcher covering entire viewport */}
      <div
        className="fixed inset-0 z-30"
        style={{ pointerEvents: dragging ? "auto" : "none" }}
        onDragOver={(e) => e.preventDefault()}
      />
      <div
        className="fixed inset-0 z-20"
        onDragEnter={() => setDragging(true)}
        style={{ pointerEvents: "none" }}
      />

      {/* FAB */}
      <button
        onClick={notifyPhase}
        className="fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 active:scale-95"
        style={{ boxShadow: "var(--shadow-fab)" }}
      >
        <Plus className="h-5 w-5" />
        <span>رفع صور</span>
      </button>
    </>
  );
}
