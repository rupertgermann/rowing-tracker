"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, Waves, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResendVerification = async () => {
    if (!email) return;
    
    setIsResending(true);
    try {
      // Trigger magic link email
      await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/dashboard"
      });
      setResent(true);
    } catch (error) {
      console.error("Failed to resend verification:", error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
          <Mail className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Check Your Email</h1>
        <p className="text-slate-400 mt-2">
          We&apos;ve sent a verification link to
        </p>
        {email && (
          <p className="text-blue-400 font-medium mt-1">{email}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <p className="font-medium mb-1">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Check your email inbox</li>
                <li>Click the verification link</li>
                <li>Sign in with your credentials</li>
              </ol>
            </div>
          </div>
        </div>

        {resent && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
            Verification email resent! Check your inbox.
          </div>
        )}

        <div className="text-center text-sm text-slate-400">
          Didn&apos;t receive the email?
          <Button
            variant="link"
            onClick={handleResendVerification}
            disabled={isResending || resent}
            className="text-blue-400 hover:text-blue-300 ml-1 p-0 h-auto"
          >
            {isResending ? "Sending..." : "Resend verification"}
          </Button>
        </div>

        <div className="pt-4 border-t border-slate-700">
          <Link href="/auth/login">
            <Button
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Back to Login
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm">
          <Waves className="w-4 h-4" />
          <span>Rowing Tracker</span>
        </Link>
      </div>

      <div className="mt-6 text-xs text-slate-500 text-center">
        <p>For local testing, check Mailpit at:</p>
        <a 
          href="http://localhost:8025" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          http://localhost:8025
        </a>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl max-w-md">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
