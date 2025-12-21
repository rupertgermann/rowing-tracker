"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, Waves } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || "Failed to send reset email" });
        setIsLoading(false);
        return;
      }

      setEmailSent(true);
      setMessage({ type: 'success', text: data.message });
      
      // In development, show reset URL if email failed
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
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
          <Mail className="w-8 h-8 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
        <p className="text-slate-400 mt-2">
          Enter your email and we&apos;ll send you a reset link
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

      {resetUrl && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
          <p className="text-yellow-400 text-sm font-medium mb-2">Development Mode - Direct Reset Link:</p>
          <a 
            href={resetUrl}
            className="text-blue-400 hover:text-blue-300 text-sm break-all underline"
          >
            {resetUrl}
          </a>
        </div>
      )}

      {!emailSent ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
              placeholder="your@email.com"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 text-sm text-slate-300">
            <p className="mb-2">Check your email inbox for a password reset link.</p>
            <p className="text-slate-400">
              For local testing, check Mailpit at{" "}
              <a 
                href="http://localhost:8025" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                http://localhost:8025
              </a>
            </p>
          </div>

          <Button
            onClick={() => {
              setEmailSent(false);
              setEmail("");
              setMessage(null);
            }}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Send Another Email
          </Button>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link 
          href="/auth/login" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-300 text-sm">
          <Waves className="w-4 h-4" />
          <span>Rowing Tracker</span>
        </Link>
      </div>
    </div>
  );
}
