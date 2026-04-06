"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LottiePlayer } from "@/components/ui/lottie-player";
import { CheckCircle2, XCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token");
        return;
      }
      setStatus("loading");
      try {
        const resp = await api.verifyEmail(token);
        if (resp.success) {
          setStatus("success");
          setMessage("Email verified successfully.");
        } else {
          setStatus("error");
          setMessage(resp.error || "Verification failed");
        }
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Verification failed");
      }
    };
    run();
  }, [token]);

  const goToLogin = () => router.push("/login");

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center border rounded-2xl p-10 bg-card">
          {status === "loading" && (
            <>
              <LoadingSpinner size={40} className="mx-auto text-foreground" />
              <h1 className="mt-6 text-2xl font-semibold">Verifying your email…</h1>
              <p className="mt-2 text-muted-foreground">Please wait a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="mt-6 text-2xl font-semibold">Email Verified</h1>
              <p className="mt-2 text-muted-foreground">Your email has been verified.</p>
              <Button className="mt-6" onClick={goToLogin}>Go to Login</Button>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-600" />
              <h1 className="mt-6 text-2xl font-semibold">Verification failed</h1>
              <p className="mt-2 text-muted-foreground">{message}</p>
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={goToLogin}>Back to Login</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pending approval modal shown after successful verification */}
      <Dialog open={status === "success"} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-center">Account Pending Approval</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <LottiePlayer
              autoplay
              loop
              mode="normal"
              src="/Status-Animation.json"
              style={{ width: '200px', height: '200px' }}
            />
            <p className="text-center text-sm text-gray-600">
              Your account has been created and is pending admin approval. You will receive an email once approved.
            </p>
            <Button className="w-full" onClick={goToLogin}>Go to Login</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


