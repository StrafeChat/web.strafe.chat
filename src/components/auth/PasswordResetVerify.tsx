import { createSignal, onMount } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useTransContext } from "@mbarzda/solid-i18next";
import { LanguageSelector } from "../shared/LanguageSelector";
import { API_ENDPOINTS } from "../../lib/providers/auth/AuthProvider";

const PasswordResetVerify = () => {
  const [code, setCode] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [userId, setUserId] = createSignal("");
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [t] = useTransContext();
  const navigate = useNavigate();
  const location = useLocation();

  onMount(() => {
    // Get parameters from URL query params
    const params = new URLSearchParams(location.search);
    const emailParam = params.get("email");
    const userIdParam = params.get("userId");
    const codeParam = params.get("code");
    
    // Log the URL parameters for debugging
    console.log("Password Reset URL Parameters:", { 
      email: emailParam, 
      userId: userIdParam, 
      code: codeParam,
      hash: window.location.hash
    });
    
    if (codeParam) {
      // If we have a code, we can proceed directly to verification
      // Store userId if available
      if (userIdParam) {
        setUserId(userIdParam);
      }
      
      // Store email if available
      if (emailParam) {
        setEmail(emailParam);
      }
      
      setCode(codeParam);
      handleVerification(codeParam);
    } else if (emailParam) {
      // If we only have email, store it for the form
      setEmail(emailParam);
    } else if (window.location.hash) {
      // Handle hash fragment from email links
      try {
        // Try to parse the hash as query parameters (some email clients convert ? to #)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashUserId = hashParams.get("userId");
        const hashCode = hashParams.get("code");
        
        console.log("Hash Parameters:", { userId: hashUserId, code: hashCode });
        
        if (hashCode) {
          // If we have a code from hash, proceed to verification
          setCode(hashCode);
          
          // Store userId if available
          if (hashUserId) {
            setUserId(hashUserId);
          }
          
          handleVerification(hashCode);
        } else {
          setError(t("auth.passwordResetVerify.error.invalidLink"));
        }
      } catch (err) {
        console.error("Error parsing hash parameters:", err);
        setError(t("auth.passwordResetVerify.error.invalidLink"));
      }
    } else {
      // Redirect to password reset request if no parameters provided
      navigate("/password-reset");
    }
  });

  const handleVerification = async (codeValue: string) => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch(API_ENDPOINTS.PASSWORD_RESET_VERIFY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          code: codeValue,
          // We don't need to send userId anymore as the backend uses code as primary key
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid === true) {
        setSuccess(t("auth.passwordResetVerify.success"));
        // Redirect to complete page after a short delay
        setTimeout(() => {
          const redirectUrl = `/password-reset/complete?code=${encodeURIComponent(codeValue)}`;
          // Add email parameter if available
          const redirectUrlWithEmail = email() ? `${redirectUrl}&email=${encodeURIComponent(email())}` : redirectUrl;
          navigate(redirectUrlWithEmail);
        }, 1500);
      } else {
        setError(data.error || t("auth.passwordResetVerify.error.generic"));
      }
    } catch (err) {
      setError(t("auth.passwordResetVerify.error.generic"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!code()) {
      setError(t("auth.passwordResetVerify.error.codeRequired"));
      return;
    }
    
    // We don't require userId anymore since code is the primary key
    handleVerification(code());
  };

  return (
    <div class="min-h-screen bg-[#1a1b26] flex items-center justify-center p-4 relative overflow-hidden">
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

      <div class="w-full max-w-md bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-8 border border-[#414868] relative z-10">
        <div class="space-y-1.5">
          <h2 class="text-2xl font-bold text-left text-white">
            {t("auth.passwordResetVerify.title")}
          </h2>
          <p class="text-sm text-left text-gray-300 pb-5">
            {t("auth.passwordResetVerify.subtitle")}
          </p>

          {!userId() && (
            <form onSubmit={handleSubmit} class="space-y-4">
              <div>
                <label
                  for="email"
                  class="block text-sm font-medium mb-2 text-gray-300"
                >
                  {t("auth.passwordResetVerify.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  value={email()}
                  disabled
                  class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b]/50 text-gray-400 focus:outline-none"
                />
              </div>

              <div>
                <label
                  for="code"
                  class="block text-sm font-medium mb-2 text-gray-300"
                >
                  {t("auth.passwordResetVerify.code")}
                </label>
                <input
                  type="text"
                  id="code"
                  value={code()}
                  onInput={(e) => setCode(e.currentTarget.value)}
                  class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading()}
                class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white disabled:opacity-50"
              >
                {loading() ? t("common.loading") : t("auth.passwordResetVerify.submit")}
              </button>

              <div class="text-left">
                <button
                  type="button"
                  onClick={() => navigate("/password-reset")}
                  class="text-sm hover:underline text-gray-300"
                >
                  {t("auth.passwordResetVerify.backToReset")}
                </button>
              </div>
            </form>
          )}
          {error() && (
            <div class="bg-red-500/20 text-red-200 px-4 py-3 rounded-md">
              {error()}
            </div>
          )}
          {success() && (
            <div class="bg-green-500/20 text-green-200 px-4 py-3 rounded-md">
              {success()}
            </div>
          )}
          {loading() && !error() && !success() && (
            <div class="bg-blue-500/20 text-blue-200 px-4 py-3 rounded-md">
              Verifying your reset code...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordResetVerify;