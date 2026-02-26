"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchSignInMethodsForEmail,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";

const OTP_EMAIL_STORAGE_KEY = "noxera_super_admin_otp_email";

type LoginMethod = "password" | "google" | "otp";

type ProviderId = "password" | "google.com" | "emailLink";

function getLoginErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = (err as { message?: string })?.message?.toLowerCase() ?? "";

  if (code === "auth/invalid-credential") return "Invalid email/password. If this account was created with Google or OTP, use that method.";
  if (code === "auth/popup-closed-by-user") return "Google login popup was closed before completing sign-in.";
  if (code === "auth/popup-blocked") return "Popup was blocked by your browser. Please allow popups and retry.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized in Firebase Auth. Add localhost to Authorized domains.";
  if (code === "auth/operation-not-allowed") return "This sign-in method is disabled in Firebase Authentication settings.";
  if (code === "auth/account-exists-with-different-credential") return "Account exists with another sign-in method. Use OTP or password for this email first.";
  if (code === "auth/invalid-action-code") return "This OTP link is invalid or already used. Request a new OTP link.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
  if (code === "auth/network-request-failed") return "Network error. Check your connection and retry.";
  if (message.includes("failed to fetch")) return "Network/session request failed. Reload and retry, or use OTP sign-in.";
  return (err as { message?: string })?.message || "Failed to sign in. Please check your credentials.";
}

function getOperationNotAllowedMessage(method: LoginMethod | "reset") {
  if (method === "google") {
    return "Google sign-in is disabled in Firebase Authentication settings. Enable Google provider to use the primary login flow.";
  }
  if (method === "password" || method === "reset") {
    return "Password sign-in is disabled in Firebase Authentication settings. Enable Email/Password provider, or continue with Google.";
  }
  return "OTP sign-in is disabled in Firebase Authentication settings. Enable Email link under the Email/Password provider.";
}

function getProviderHint(methods: string[]): string {
  if (methods.length === 0) {
    return "Provider discovery is unavailable for this project. Continue with Google (recommended) or use your known method.";
  }

  const providers: string[] = [];
  if (methods.includes("google.com")) providers.push("Google");
  if (methods.includes("password")) providers.push("Password");
  if (methods.includes("emailLink")) providers.push("OTP email link");

  if (providers.length === 0) {
    return "This account uses a custom provider configuration.";
  }

  if (providers.length === 1) {
    return `Detected provider: ${providers[0]}.`;
  }

  return `Detected providers: ${providers.join(", ")}.`;
}

async function createSuperAdminSession(user: User) {
  const token = await user.getIdToken();
  let sessionResponse: Response;
  try {
    sessionResponse = await fetch("/api/super-admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new Error("Failed to reach session service. Please restart the app and retry.");
  }

  if (!sessionResponse.ok) {
    const payload = (await sessionResponse.json().catch(() => ({}))) as { message?: string };
    if (auth) {
      await signOut(auth);
    }
    throw new Error(payload.message ?? "You are signed in, but not authorized as a super admin.");
  }
}

export default function SuperAdminLoginPage() {
  const [method, setMethod] = useState<LoginMethod>("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providerHint, setProviderHint] = useState("");
  const [detectedMethods, setDetectedMethods] = useState<ProviderId[]>([]);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLinkDetected, setOtpLinkDetected] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const destination = useMemo(() => {
    const nextPath = searchParams.get("next");
    return nextPath && nextPath.startsWith("/super-admin") ? nextPath : "/super-admin";
  }, [searchParams]);

  const finishLogin = async (user: User) => {
    await createSuperAdminSession(user);
    router.push(destination);
    router.refresh();
  };

  const resolveProviderHint = async (emailValue: string) => {
    if (!auth) return;
    const cleanedEmail = emailValue.trim().toLowerCase();
    if (!cleanedEmail) {
      setProviderHint("");
      return;
    }

    setCheckingProviders(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, cleanedEmail);
      setDetectedMethods(methods as ProviderId[]);
      setProviderHint(getProviderHint(methods));
    } catch {
      setDetectedMethods([]);
      setProviderHint("");
    } finally {
      setCheckingProviders(false);
    }
  };

  useEffect(() => {
    if (!auth) return;
    const firebaseAuth = auth;

    const completeGoogleRedirect = async () => {
      try {
        const redirectResult = await getRedirectResult(firebaseAuth);
        if (redirectResult?.user) {
          setLoading(true);
          await finishLogin(redirectResult.user);
        }
      } catch (err) {
        setError(getLoginErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void completeGoogleRedirect();
  }, [destination, router]);

  const completeOtpSignIn = async (resolvedEmail: string) => {
    if (!auth || typeof window === "undefined") return;

    const cleanedEmail = resolvedEmail.trim().toLowerCase();
    if (!cleanedEmail) {
      throw new Error("Email is required to complete OTP sign-in.");
    }

    const credential = await signInWithEmailLink(auth, cleanedEmail, window.location.href);
    window.localStorage.removeItem(OTP_EMAIL_STORAGE_KEY);
    setOtpLinkDetected(false);
    await finishLogin(credential.user);
  };

  useEffect(() => {
    if (!auth || typeof window === "undefined") return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    setMethod("otp");
    setOtpLinkDetected(true);
    setNotice("OTP link detected. Complete sign-in to continue.");

    const storedEmail = window.localStorage.getItem(OTP_EMAIL_STORAGE_KEY);
    if (!storedEmail) return;

    setEmail(storedEmail);
    setLoading(true);
    setError("");
    void completeOtpSignIn(storedEmail)
      .catch((err: unknown) => {
        setError(getLoginErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [destination, router]);

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setLoading(false);
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishLogin(credential.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("password"));
        return;
      }

      if (code === "auth/invalid-credential") {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
          if (methods.length > 0 && !methods.includes("password")) {
            if (methods.includes("google.com")) {
              setError("This account is configured for Google sign-in. Use the Google tab.");
            } else if (methods.includes("emailLink")) {
              setError("This account is configured for OTP email-link sign-in. Use the OTP tab.");
            } else {
              setError("This account uses a different sign-in method. Use Google or OTP.");
            }
            return;
          }
        } catch {
          // Fall back to generic auth messaging if method lookup fails.
        }
      }

      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setNotice("");
    setLoading(true);

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cleanedEmail = email.trim().toLowerCase();
      if (cleanedEmail) {
        const methods = await fetchSignInMethodsForEmail(auth, cleanedEmail);
        if (methods.length > 0 && !methods.includes("google.com")) {
          if (methods.includes("password")) {
            throw new Error("This account is configured for password login. Use the Password tab.");
          }
          if (methods.includes("emailLink")) {
            throw new Error("This account is configured for OTP login. Use the OTP tab.");
          }
        }
      }

      try {
        const credential = await signInWithPopup(auth, provider);
        await finishLogin(credential.user);
      } catch (popupError) {
        const popupCode = (popupError as { code?: string })?.code ?? "";
        const popupMessage = (popupError as { message?: string })?.message?.toLowerCase() ?? "";
        if (
          popupMessage.includes("failed to fetch") ||
          popupCode === "auth/popup-blocked" ||
          popupCode === "auth/network-request-failed"
        ) {
          setNotice("Popup sign-in failed. Redirecting to Google sign-in...");
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupError;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("google"));
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setNotice("");

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError("Enter your email, then click reset password.");
      return;
    }

    setLoading(true);
    try {
      const methods = await fetchSignInMethodsForEmail(auth, cleanedEmail).catch(() => [] as string[]);
      if (methods.includes("google.com") && !methods.includes("password")) {
        setError("This account is configured for Google sign-in. Use the Google tab.");
        return;
      }
      if (methods.includes("emailLink") && !methods.includes("password")) {
        setError("This account is configured for OTP sign-in. Use the OTP tab.");
        return;
      }

      if (typeof window !== "undefined") {
        await sendPasswordResetEmail(auth, cleanedEmail, {
          url: `${window.location.origin}/super-admin/login`,
          handleCodeInApp: false,
        });
      } else {
        await sendPasswordResetEmail(auth, cleanedEmail);
      }
      setNotice("Password reset email sent. After resetting, return and sign in.");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("reset"));
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setLoading(false);
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError("Enter your email address to receive an OTP link.");
      setLoading(false);
      return;
    }

    try {
      if (typeof window === "undefined") {
        throw new Error("OTP flow requires a browser context.");
      }

      await sendSignInLinkToEmail(auth, cleanedEmail, {
        url: `${window.location.origin}/super-admin/login?next=${encodeURIComponent(destination)}`,
        handleCodeInApp: true,
      });

      window.localStorage.setItem(OTP_EMAIL_STORAGE_KEY, cleanedEmail);
      setNotice("OTP link sent. Check your email inbox/spam and open the link in this browser.");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("otp"));
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOtp = async () => {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      await completeOtpSignIn(email);
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const preferredMethodLabel = useMemo(() => {
    if (detectedMethods.includes("google.com")) return "Google";
    if (detectedMethods.includes("password")) return "Password";
    if (detectedMethods.includes("emailLink")) return "OTP";
    return "Google";
  }, [detectedMethods]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 font-sans antialiased text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black tracking-tighter shadow-2xl shadow-indigo-600/20 !text-white">N+</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tight">Noxera <span className="text-indigo-500">Plus</span></h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Super Admin Access Portal</p>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" />
            Primary Sign-In: Google
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => setMethod("password")}
              className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${method === "password" ? "bg-indigo-600 !text-white" : "text-slate-400 hover:text-white"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMethod("google")}
              className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${method === "google" ? "bg-indigo-600 !text-white" : "text-slate-400 hover:text-white"}`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => setMethod("otp")}
              className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${method === "otp" ? "bg-indigo-600 !text-white" : "text-slate-400 hover:text-white"}`}
            >
              OTP
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-xs font-semibold text-indigo-200">
              {notice}
            </div>
          )}

          {providerHint && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4 text-xs font-semibold text-slate-200">
              {checkingProviders ? "Checking provider..." : providerHint}
            </div>
          )}

          {!providerHint && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-xs font-semibold text-slate-300">
              Recommended for this workspace: <span className="font-black text-indigo-200">{preferredMethodLabel}</span>.
            </div>
          )}

          {method === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Master Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => void resolveProviderHint(email)}
                  placeholder="master@noxera.plus"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 !text-white"
              >
                {loading ? "Authenticating..." : "Secure Login"}
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={loading}
                className="w-full py-2 text-xs font-bold uppercase tracking-wider text-indigo-300 transition hover:text-indigo-200 disabled:opacity-60"
              >
                Reset Password
              </button>
            </form>
          )}

          {method === "google" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Use your Firebase-enabled Google account. Server-side super-admin authorization is enforced after sign-in.
              </p>
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={loading}
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Connecting..." : "Continue with Google"}
              </button>
            </div>
          )}

          {method === "otp" && (
            <div className="space-y-5">
              <form onSubmit={handleSendOtpLink} className="space-y-4">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Master Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => void resolveProviderHint(email)}
                    placeholder="master@noxera.plus"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-indigo-600 py-4 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 !text-white"
                >
                  {loading ? "Sending..." : "Send OTP Link"}
                </button>
              </form>

              {otpLinkDetected && (
                <button
                  type="button"
                  onClick={() => void handleCompleteOtp()}
                  disabled={loading}
                  className="w-full rounded-2xl border border-indigo-400/40 py-3 text-xs font-black uppercase tracking-widest text-indigo-200 transition hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Completing..." : "Complete OTP Sign-In"}
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs font-bold tracking-tight text-slate-500">
          Restricted access for Noxera Plus administrators only.
        </p>
      </div>
    </div>
  );
}
