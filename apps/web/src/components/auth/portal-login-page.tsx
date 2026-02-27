"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchSignInMethodsForEmail,
  getRedirectResult,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

type PortalType = "admin" | "super-admin";
type LoginMethod = "password" | "google" | "otp";
type ProviderId = "password" | "google.com" | "emailLink";
type BusyPhase =
  | "idle"
  | "password"
  | "google-popup"
  | "google-redirect"
  | "otp-send"
  | "otp-complete"
  | "reset"
  | "session"
  | "redirecting";

const GOOGLE_POPUP_TIMEOUT_MS = 20_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REDIRECT_BOOTSTRAP_PROGRESS = {
  label: "Checking for any pending Google redirect sign-in...",
  percent: 20,
};

const OTP_STORAGE_KEY: Record<PortalType, string> = {
  admin: "noxera_admin_otp_email",
  "super-admin": "noxera_super_admin_otp_email",
};

const portalConfig: Record<
  PortalType,
  {
    title: string;
    destinationPrefix: string;
    defaultDestination: string;
    sessionEndpoint: string;
    emailLabel: string;
    emailPlaceholder: string;
    resetReturnPath: string;
    loginHint: string;
    footerLinks: Array<{ href: string; label: string }>;
  }
> = {
  admin: {
    title: "Church Admin Access Portal",
    destinationPrefix: "/admin",
    defaultDestination: "/admin",
    sessionEndpoint: "/api/admin/session",
    emailLabel: "Admin Email",
    emailPlaceholder: "admin@church.org",
    resetReturnPath: "/login",
    loginHint: "Use your Firebase-enabled Google account. After sign-in we establish a secure tenant session.",
    footerLinks: [
      { href: "/signup", label: "Start Free Trial" },
      { href: "/", label: "Platform Home" },
      { href: "/super-admin/login", label: "Super Admin" },
    ],
  },
  "super-admin": {
    title: "Super Admin Access Portal",
    destinationPrefix: "/super-admin",
    defaultDestination: "/super-admin",
    sessionEndpoint: "/api/super-admin/session",
    emailLabel: "Master Email",
    emailPlaceholder: "master@noxera.plus",
    resetReturnPath: "/super-admin/login",
    loginHint: "Use your Firebase-enabled Google account. Server-side super-admin authorization is enforced.",
    footerLinks: [
      { href: "/", label: "Platform Home" },
      { href: "/signup", label: "Start Free Trial" },
      { href: "/login", label: "Church Admin" },
    ],
  },
};

const progressByPhase: Record<BusyPhase, { label: string; percent: number }> = {
  idle: { label: "", percent: 0 },
  password: { label: "Validating credentials and signing in...", percent: 40 },
  "google-popup": { label: "Opening secure Google sign-in popup...", percent: 30 },
  "google-redirect": { label: "Redirecting to Google sign-in...", percent: 45 },
  "otp-send": { label: "Sending OTP email link...", percent: 55 },
  "otp-complete": { label: "Completing OTP sign-in...", percent: 75 },
  reset: { label: "Sending password reset email...", percent: 55 },
  session: { label: "Establishing secure server session...", percent: 85 },
  redirecting: { label: "Redirecting to dashboard...", percent: 95 },
};

function buildGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

function isValidEmail(emailValue: string) {
  return EMAIL_REGEX.test(emailValue.trim().toLowerCase());
}

function getLoginErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = (err as { message?: string })?.message?.toLowerCase() ?? "";

  if (code === "auth/invalid-credential") return "Invalid email/password. If this account uses Google or OTP, switch methods.";
  if (code === "auth/popup-closed-by-user") return "Google login popup was closed before completion.";
  if (code === "auth/popup-blocked") return "Popup was blocked by your browser. Allow popups and retry.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized in Firebase Auth settings.";
  if (code === "auth/operation-not-allowed") return "This sign-in method is disabled in Firebase Authentication settings.";
  if (code === "auth/account-exists-with-different-credential") return "Account exists with another provider. Use the correct method.";
  if (code === "auth/invalid-action-code") return "This OTP link is invalid or already used. Request a new one.";
  if (code === "auth/user-disabled") return "This account has been disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait and try again.";
  if (code === "auth/network-request-failed" || message.includes("failed to fetch")) return "Network error. Check connection and retry.";
  return (err as { message?: string })?.message || "Unable to sign in.";
}

function getOperationNotAllowedMessage(method: LoginMethod | "reset") {
  if (method === "google") return "Google sign-in is disabled in Firebase Authentication settings.";
  if (method === "otp") return "OTP email-link sign-in is disabled in Firebase Authentication settings.";
  return "Password sign-in is disabled in Firebase Authentication settings.";
}

function getProviderHint(methods: string[]) {
  if (methods.length === 0) return "No account detected yet for this email.";

  const labels: string[] = [];
  if (methods.includes("google.com")) labels.push("Google");
  if (methods.includes("password")) labels.push("Password");
  if (methods.includes("emailLink")) labels.push("OTP email link");

  if (labels.length === 0) return "This account uses a custom provider configuration.";
  if (labels.length === 1) return `Detected provider: ${labels[0]}.`;
  return `Detected providers: ${labels.join(", ")}.`;
}

async function readApiErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    return payload.message ?? fallback;
  }
  const text = (await response.text().catch(() => "")).trim();
  return text || fallback;
}

async function createPortalSession(user: User, sessionEndpoint: string, enforceSignOut = false) {
  const token = await user.getIdToken();
  let sessionResponse: Response;
  try {
    sessionResponse = await fetch(sessionEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw new Error("Unable to reach session service. Please restart the app and retry.");
  }

  if (!sessionResponse.ok) {
    const message = await readApiErrorMessage(sessionResponse, "Sign-in succeeded, but session setup failed.");
    if (enforceSignOut && auth) {
      await signOut(auth).catch(() => undefined);
    }
    throw new Error(message);
  }
}

export function PortalLoginPage({ portal }: { portal: PortalType }) {
  const cfg = portalConfig[portal];
  const { personalization } = usePlatformPersonalization();
  const brandName = personalization.orgName?.trim() || "Noxera Plus";
  const [method, setMethod] = useState<LoginMethod>("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [providerHint, setProviderHint] = useState("");
  const [detectedMethods, setDetectedMethods] = useState<ProviderId[]>([]);
  const [checkingProviders, setCheckingProviders] = useState(false);
  const [busyPhase, setBusyPhase] = useState<BusyPhase>("idle");
  const [otpLinkDetected, setOtpLinkDetected] = useState(false);
  const [isBootstrappingRedirect, setIsBootstrappingRedirect] = useState(true);
  const [googlePopupPending, setGooglePopupPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isBusy = busyPhase !== "idle";
  const isAuthConfigured = Boolean(auth);
  const showProgress = isBusy || isBootstrappingRedirect;
  const progressState = isBusy ? progressByPhase[busyPhase] : REDIRECT_BOOTSTRAP_PROGRESS;

  const destination = useMemo(() => {
    const nextPath = searchParams.get("next");
    return nextPath && nextPath.startsWith(cfg.destinationPrefix) ? nextPath : cfg.defaultDestination;
  }, [cfg.defaultDestination, cfg.destinationPrefix, searchParams]);

  const switchMethod = (nextMethod: LoginMethod) => {
    setMethod(nextMethod);
    setError("");
    setNotice("");
  };

  const finishLogin = useCallback(
    async (user: User) => {
      setBusyPhase("session");
      await createPortalSession(user, cfg.sessionEndpoint, portal === "super-admin");
      setBusyPhase("redirecting");
      router.push(destination);
      router.refresh();
    },
    [cfg.sessionEndpoint, destination, portal, router],
  );

  const resolveProviderHint = async (emailValue: string) => {
    if (!auth) return;
    const cleanedEmail = emailValue.trim().toLowerCase();
    if (!cleanedEmail) {
      setProviderHint("");
      setDetectedMethods([]);
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
    if (!auth) {
      setIsBootstrappingRedirect(false);
      return;
    }
    const firebaseAuth = auth;
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setIsBootstrappingRedirect(false);
      }
    }, 5000);

    const completeGoogleRedirect = async () => {
      try {
        const redirectResult = await getRedirectResult(firebaseAuth);
        if (cancelled) return;
        if (redirectResult?.user) {
          setNotice("Google sign-in detected. Finalizing secure session...");
          await finishLogin(redirectResult.user);
        }
      } catch (err) {
        if (cancelled) return;
        setError(getLoginErrorMessage(err));
      } finally {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setIsBootstrappingRedirect(false);
        }
      }
    };

    void completeGoogleRedirect();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [finishLogin]);

  const completeOtpSignIn = useCallback(
    async (resolvedEmail: string) => {
      if (!auth || typeof window === "undefined") return;
      const cleanedEmail = resolvedEmail.trim().toLowerCase();
      if (!cleanedEmail) throw new Error("Email is required to complete OTP sign-in.");

      const credential = await signInWithEmailLink(auth, cleanedEmail, window.location.href);
      window.localStorage.removeItem(OTP_STORAGE_KEY[portal]);
      setOtpLinkDetected(false);
      await finishLogin(credential.user);
    },
    [finishLogin, portal],
  );

  useEffect(() => {
    if (!auth || typeof window === "undefined") return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    setMethod("otp");
    setOtpLinkDetected(true);
    setNotice("OTP link detected. Complete sign-in to continue.");
    setBusyPhase("otp-complete");

    const storedEmail = window.localStorage.getItem(OTP_STORAGE_KEY[portal]);
    if (!storedEmail) {
      setBusyPhase("idle");
      return;
    }

    setEmail(storedEmail);
    setError("");
    void completeOtpSignIn(storedEmail)
      .catch((err: unknown) => {
        setError(getLoginErrorMessage(err));
      })
      .finally(() => setBusyPhase("idle"));
  }, [completeOtpSignIn, portal]);

  const handlePasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyPhase("password");

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setBusyPhase("idle");
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanedEmail)) {
      setError("Enter a valid email address to continue.");
      setBusyPhase("idle");
      return;
    }

    if (!password.trim()) {
      setError("Enter your password to continue.");
      setBusyPhase("idle");
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanedEmail, password);
      await finishLogin(credential.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("password"));
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setBusyPhase("idle");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setNotice("");
    setBusyPhase("google-popup");
    setGooglePopupPending(false);

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setBusyPhase("idle");
      return;
    }

    try {
      const provider = buildGoogleProvider();

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
        const credential = (await Promise.race([
          signInWithPopup(auth, provider),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(Object.assign(new Error("Google popup timed out."), { code: "auth/popup-timeout" }));
            }, GOOGLE_POPUP_TIMEOUT_MS);
          }),
        ])) as Awaited<ReturnType<typeof signInWithPopup>>;
        await finishLogin(credential.user);
      } catch (popupError) {
        const popupCode = (popupError as { code?: string })?.code ?? "";
        const popupMessage = (popupError as { message?: string })?.message?.toLowerCase() ?? "";
        if (popupCode === "auth/popup-timeout") {
          setGooglePopupPending(true);
          setNotice("Google sign-in window is still open. Complete it there, close it, or continue with redirect sign-in.");
          return;
        }
        if (
          popupMessage.includes("failed to fetch") ||
          popupCode === "auth/popup-blocked" ||
          popupCode === "auth/network-request-failed"
        ) {
          setNotice("Popup sign-in failed. Redirecting to Google sign-in...");
          setBusyPhase("google-redirect");
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
      setBusyPhase("idle");
    }
  };

  const handleGoogleRedirectFallback = async () => {
    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      return;
    }

    try {
      setError("");
      setNotice("Redirecting to Google sign-in...");
      setBusyPhase("google-redirect");
      await signInWithRedirect(auth, buildGoogleProvider());
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setBusyPhase("idle");
    }
  };

  const handlePasswordReset = async () => {
    setError("");
    setNotice("");
    setBusyPhase("reset");

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setBusyPhase("idle");
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError("Enter your email, then click reset password.");
      setBusyPhase("idle");
      return;
    }
    if (!isValidEmail(cleanedEmail)) {
      setError("Enter a valid email before requesting password reset.");
      setBusyPhase("idle");
      return;
    }

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
          url: `${window.location.origin}${cfg.resetReturnPath}`,
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
      setBusyPhase("idle");
    }
  };

  const handleSendOtpLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyPhase("otp-send");

    if (!auth) {
      setError("Firebase Auth is not initialized (missing API key).");
      setBusyPhase("idle");
      return;
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      setError("Enter your email address to receive an OTP link.");
      setBusyPhase("idle");
      return;
    }
    if (!isValidEmail(cleanedEmail)) {
      setError("Enter a valid email address to receive an OTP link.");
      setBusyPhase("idle");
      return;
    }

    try {
      if (typeof window === "undefined") {
        throw new Error("OTP flow requires a browser context.");
      }

      await sendSignInLinkToEmail(auth, cleanedEmail, {
        url: `${window.location.origin}${cfg.resetReturnPath}?next=${encodeURIComponent(destination)}`,
        handleCodeInApp: true,
      });

      window.localStorage.setItem(OTP_STORAGE_KEY[portal], cleanedEmail);
      setNotice("OTP link sent. Check your email inbox/spam and open the link in this browser.");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError(getOperationNotAllowedMessage("otp"));
      } else {
        setError(getLoginErrorMessage(err));
      }
    } finally {
      setBusyPhase("idle");
    }
  };

  const handleCompleteOtp = async () => {
    setError("");
    setNotice("");
    setBusyPhase("otp-complete");

    try {
      await completeOtpSignIn(email);
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err));
    } finally {
      setBusyPhase("idle");
    }
  };

  const preferredMethodLabel = useMemo(() => {
    if (detectedMethods.includes("google.com")) return "Google";
    if (detectedMethods.includes("password")) return "Password";
    if (detectedMethods.includes("emailLink")) return "OTP";
    return "Google";
  }, [detectedMethods]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 antialiased text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-2xl font-black tracking-tighter !text-white"
            style={{ backgroundColor: personalization.brandPrimaryColor, boxShadow: "0 20px 40px rgba(var(--brand-primary-rgb), 0.22)" }}
          >
            {personalization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={personalization.logoUrl} alt="Platform logo" className="h-full w-full object-contain" />
            ) : (
              "N+"
            )}
          </div>
          <h1 className="text-4xl font-black uppercase italic tracking-tight">
            {brandName.split(" ")[0]} <span className="nx-brand-text">{brandName.split(" ").slice(1).join(" ")}</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{cfg.title}</p>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
            <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" />
            Primary Sign-In: Google
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
          {showProgress && (
            <div className="relative overflow-hidden rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3" role="status" aria-live="polite">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-300/10 to-indigo-500/0 [mask-image:linear-gradient(90deg,transparent,black,transparent)]" />
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-100">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-100/40 border-t-indigo-100" />
                {progressState.label}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-300 transition-all duration-500"
                  style={{ width: `${progressState.percent}%` }}
                />
              </div>
            </div>
          )}

          {!isAuthConfigured && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-xs font-semibold text-amber-100" role="alert">
              Firebase Auth is not configured. Add `NEXT_PUBLIC_FIREBASE_*` values in `apps/web/.env.local`, restart dev servers, and retry.
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
            {(["password", "google", "otp"] as LoginMethod[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchMethod(tab)}
                disabled={isBusy || !isAuthConfigured}
                className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${method === tab ? "bg-indigo-600 !text-white" : "text-slate-400 hover:text-white"} disabled:cursor-not-allowed disabled:opacity-60`}
                style={method === tab ? { backgroundColor: personalization.brandPrimaryColor } : undefined}
              >
                {tab}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-300" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-xs font-semibold text-indigo-200" role="status">
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
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{cfg.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  onBlur={() => void resolveProviderHint(email)}
                  placeholder={cfg.emailPlaceholder}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isBusy || !isAuthConfigured}
                className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 !text-white"
                style={{ backgroundColor: personalization.brandPrimaryColor, boxShadow: "0 20px 40px rgba(var(--brand-primary-rgb), 0.2)" }}
              >
                {busyPhase === "password" || busyPhase === "session" || busyPhase === "redirecting" ? "Authenticating..." : "Secure Login"}
              </button>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                disabled={isBusy || !isAuthConfigured}
                className="w-full py-2 text-xs font-bold uppercase tracking-wider text-indigo-300 transition hover:text-indigo-200 disabled:opacity-60"
              >
                Reset Password
              </button>
            </form>
          )}

          {method === "google" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">{cfg.loginHint}</p>
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={isBusy || !isAuthConfigured}
                className="w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black uppercase tracking-widest text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyPhase === "google-popup" || busyPhase === "google-redirect" || busyPhase === "session" || busyPhase === "redirecting"
                  ? "Connecting..."
                  : "Continue with Google"}
              </button>
              {googlePopupPending && (
                <button
                  type="button"
                  onClick={() => void handleGoogleRedirectFallback()}
                  disabled={isBusy || !isAuthConfigured}
                  className="w-full rounded-2xl border border-indigo-400/40 py-3 text-xs font-black uppercase tracking-widest text-indigo-100 transition hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue with Redirect Instead
                </button>
              )}
            </div>
          )}

          {method === "otp" && (
            <div className="space-y-5">
              <form onSubmit={handleSendOtpLink} className="space-y-4">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{cfg.emailLabel}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onBlur={() => void resolveProviderHint(email)}
                    placeholder={cfg.emailPlaceholder}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 px-5 py-4 text-sm font-bold transition-all placeholder-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
                <button
                type="submit"
                disabled={isBusy || !isAuthConfigured}
                className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 !text-white"
                style={{ backgroundColor: personalization.brandPrimaryColor, boxShadow: "0 20px 40px rgba(var(--brand-primary-rgb), 0.2)" }}
              >
                {busyPhase === "otp-send" ? "Sending..." : "Send OTP Link"}
              </button>
              </form>

              {otpLinkDetected && (
                <button
                  type="button"
                  onClick={() => void handleCompleteOtp()}
                  disabled={isBusy || !isAuthConfigured}
                  className="w-full rounded-2xl border border-indigo-400/40 py-3 text-xs font-black uppercase tracking-widest text-indigo-200 transition hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyPhase === "otp-complete" || busyPhase === "session" || busyPhase === "redirecting" ? "Completing..." : "Complete OTP Sign-In"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-center text-xs font-bold tracking-tight text-slate-500">
            Restricted access for {brandName} administrators only.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-400">
            {cfg.footerLinks.map((link, index) => (
              <span key={link.href} className="contents">
                {index > 0 ? <span>•</span> : null}
                <Link href={link.href} className="transition hover:text-indigo-300">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
