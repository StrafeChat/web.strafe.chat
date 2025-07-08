import { createSignal, onMount } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useTransContext } from "@mbarzda/solid-i18next";
import { LanguageSelector } from "../shared/LanguageSelector";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { BASE_URL } from "../../constants";

const EmailVerify = () => {
  const [, setToken] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [t] = useTransContext();
  const { isMobile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    // Get token from URL query params
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("token");
    
    if (tokenParam) {
      setToken(tokenParam);
      // Automatically verify the token
      handleVerification(tokenParam);
    } else {
      // No token means user was redirected here after registration
      // Show instructions to check email
      setSuccess("Registration successful! Please check your email for a verification link.");
    }
  });

  const handleVerification = async (tokenValue: string) => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(`${BASE_URL}/auth/verify-email?token=${tokenValue}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Email verified successfully! You can now log in.");
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        setError(data.error || "Email verification failed");
      }
    } catch (err) {
      console.error("Email verification error:", err);
      setError("An error occurred during email verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#1a1b26] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated turtle emojis */}
      <div class="absolute inset-0 opacity-40">
        <img
          src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
          alt="Turtle"
          class="absolute w-24 h-24 animate-swim-1"
          style={{ top: "20%", left: "10%" }}
        />
        <img
          src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
          alt="Turtle"
          class="absolute w-16 h-16 animate-swim-2"
          style={{ top: "60%", right: "15%" }}
        />
        <img
          src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
          alt="Turtle"
          class="absolute w-20 h-20 animate-swim-3"
          style={{ bottom: "15%", left: "30%" }}
        />
        <img
          src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
          alt="Turtle"
          class="absolute w-16 h-16 animate-swim-1"
          style={{ top: "40%", right: "30%" }}
        />
        <img
          src="https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f422.png"
          alt="Turtle"
          class="absolute w-24 h-24 animate-swim-2"
          style={{ bottom: "30%", right: "40%" }}
        />
      </div>

      <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90"></div>

      <div class="absolute top-1 right-1 z-50">
        <LanguageSelector />
      </div>

      <div
        class={
          isMobile()
            ? "w-full max-w-md mx-auto bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 border border-[#414868] relative z-10"
            : "w-full max-w-md bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-8 border border-[#414868] relative z-10"
        }
      >
        <div class="space-y-1.5">
          <h2 class="text-2xl font-bold text-left text-white">
            {t("auth.emailVerify.title", "Email Verification")}
          </h2>
          <p class="text-sm text-left text-gray-300 pb-5">
            {loading() ? t("auth.emailVerify.verifying", "Verifying your email address...") : t("auth.emailVerify.subtitle", "Please check your email for verification instructions.")}
          </p>

          <div class="space-y-4">
            {loading() && (
              <div class="text-center py-4">
                <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" role="status">
                  <span class="sr-only">
                    Loading...
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-300">
                  {t("auth.emailVerify.verifying", "Verifying your email...")}
                </p>
              </div>
            )}

            {success() && (
              <div class="bg-green-500/20 border border-green-500/30 rounded-md p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-green-200">
                      {success()}
                    </p>
                    {success().includes("verified successfully") && (
                      <p class="mt-1 text-sm text-green-300">
                        {t("auth.emailVerify.redirecting", "Redirecting to login page...")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error() && (
              <div class="bg-red-500/20 border border-red-500/30 rounded-md p-4">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-red-200">
                      {error()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!loading() && !success() && (
              <div class="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
                >
                  {t("auth.emailVerify.goToLogin", "Go to Login")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerify;