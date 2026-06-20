"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Waves, Loader2 } from "lucide-react";
import { Suspense } from "react";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An error occurred during authentication.",
  CredentialsSignin: "Invalid email or password.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Authentication Error</h1>
        <p className="text-slate-400 mt-2">{errorMessage}</p>
      </div>

      <div className="space-y-4">
        <Link href="/auth/login" prefetch={false}>
          <Button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
            Try Again
          </Button>
        </Link>

        <Link href="/" prefetch={false}>
          <Button
            variant="outline"
            className="w-full py-3 border-slate-600 text-slate-300 hover:bg-slate-700 font-medium rounded-lg transition-colors"
          >
            Go Home
          </Button>
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" prefetch={false} className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300">
          <Waves className="w-4 h-4" />
          <span>Rowing Tracker</span>
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
