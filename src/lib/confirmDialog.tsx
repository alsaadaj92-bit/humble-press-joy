import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { tap } from "@/lib/native";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * Native-friendly imperative confirm() replacement.
 * Uses shadcn AlertDialog + Capacitor Haptics — no browser modal.
 */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const options: ConfirmOptions =
    typeof opts === "string" ? { message: opts } : opts;

  return new Promise<boolean>((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    const cleanup = (result: boolean) => {
      // Delay unmount so exit animation plays
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 150);
      resolve(result);
    };

    function Host() {
      const [open, setOpen] = useState(false);
      useEffect(() => {
        setOpen(true);
        void tap("light");
      }, []);
      return (
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!next) {
              setOpen(false);
              cleanup(false);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title ?? "تأكيد"}</AlertDialogTitle>
              <AlertDialogDescription>{options.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setOpen(false);
                  cleanup(false);
                }}
              >
                {options.cancelText ?? "إلغاء"}
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  options.destructive
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={() => {
                  void tap("medium");
                  setOpen(false);
                  cleanup(true);
                }}
              >
                {options.confirmText ?? "متابعة"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    root.render(<Host />);
  });
}
