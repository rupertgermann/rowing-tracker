"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, CheckCircle, Waves } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'error', text: "Invalid reset link. Please request a new password reset." });
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords do not match" });
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: "Password must be at least 8 characters" });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || "Failed to reset password" });
        setIsLoading(false);
        return;
      }

      setResetSuccess(true);
      setMessage({ type: 'success', text: data.message });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (error) {
      setMessage({ type: 'error', text: "An error occurred. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
          {resetSuccess ? (
            <CheckCircle className="w-8 h-8 text-green-400" />
          ) : (
            <Lock className="w-8 h-8 text-blue-400" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {resetSuccess ? "Password Reset!" : "Reset Password"}
        </h1>
        <p className="text-slate-400 mt-2">
          {resetSuccess 
            ? "Redirecting to login..." 
            : "Enter your new password below"
          }
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/50 text-green-400' 
            : 'bg-red-500/10 border border-red-500/50 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {!resetSuccess && token && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
              placeholder="Confirm new password"
            />
          </div>

          <div className="text-xs text-slate-400">
            Password must be at least 8 characters long
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Reset Password
              </>
            )}
          </Button>
        </form>
      )}

      {resetSuccess && (
        <div className="text-center">
          <Link href="/auth/login">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3">
              Go to Login
            </Button>
          </Link>
        </div>
      )}

      {!token && (
        <div className="text-center">
          <Link href="/auth/forgot-password">
            <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
              Request New Reset Link
            </Button>
          </Link>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm">
          <Waves className="w-4 h-4" />
          <span>Rowing Tracker</span>
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8 shadow-xl max-w-md">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
