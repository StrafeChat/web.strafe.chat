import { createSignal, onMount } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useTransContext } from "@mbarzda/solid-i18next";
import { LanguageSelector } from "../shared/LanguageSelector";
import { API_ENDPOINTS } from "../../lib/providers/auth/AuthProvider";

const PasswordResetComplete = () => {
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [code, setCode] = createSignal("");
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
    console.log("Password Reset Complete URL Parameters:", { 
      email: emailParam, 
      userId: userIdParam, 
      code: codeParam,
      hash: window.location.hash
    });
    
    // Code is required for password reset completion
    if (!codeParam && !window.location.hash) {
      setError(t("auth.passwordResetComplete.error.invalidLink"));
      setTimeout(() => {
        navigate("/password-reset");
      }, 2000);
      return;
    }
    
    if (codeParam) {
      // Store the code
      setCode(codeParam);
      
    } else if (window.location.hash) {
      // Handle hash fragment from email links
      try {
        // Try to parse the hash as query parameters (some email clients convert ? to #)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashUserId = hashParams.get("userId");
        const hashCode = hashParams.get("code");
        
        console.log("Hash Parameters:", { userId: hashUserId, code: hashCode });
        
        if (hashCode) {
          // Store the code
          setCode(hashCode);
          
        } else {
          setError(t("auth.passwordResetComplete.error.invalidLink"));
          setTimeout(() => {
            navigate("/password-reset");
          }, 2000);
          return;
        }
      } catch (err) {
        console.error("Error parsing hash parameters:", err);
        setError(t("auth.passwordResetComplete.error.invalidLink"));
        setTimeout(() => {
          navigate("/password-reset");
        }, 2000);
        return;
      }
    } else {
      // Redirect to password reset request if no parameters provided
      navigate("/password-reset");
      return;
    }
    
    // Verify the code is still valid before allowing password reset
    if (codeParam) {
      verifyResetCode(codeParam);
    }
  });
  
  const verifyResetCode = async (codeValue: string) => {
    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.PASSWORD_RESET_VERIFY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: codeValue }),
      });

      const data = await response.json();

      if (!response.ok || data.valid !== true) {
        setError(t("auth.passwordResetComplete.error.invalidOrExpiredCode"));
        setTimeout(() => {
          navigate("/password-reset");
        }, 2000);
      }
    } catch (err) {
      setError(t("auth.passwordResetComplete.error.generic"));
      setTimeout(() => {
        navigate("/password-reset");
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password() || !confirmPassword()) {
      setError(t("auth.passwordResetComplete.error.emptyFields"));
      return;
    }

    if (password() !== confirmPassword()) {
      setError(t("auth.passwordResetComplete.error.passwordMismatch"));
      return;
    }

    // Enhanced password validation
    if (password().length < 8) {
      setError(t("auth.passwordResetComplete.error.passwordTooShort"));
      return;
    }
    
    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(password());
    const hasLowerCase = /[a-z]/.test(password());
    const hasNumbers = /[0-9]/.test(password());
    
    if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
      setError(t("auth.passwordResetComplete.error.passwordNotComplex"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.PASSWORD_RESET_COMPLETE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          code: code(),
          new_password: password()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(t("auth.passwordResetComplete.success"));
        // Redirect to login page after a short delay
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.error || t("auth.passwordResetComplete.error.generic"));
      }
    } catch (err) {
      setError(t("auth.passwordResetComplete.error.generic"));
    } finally {
      setLoading(false);
    }
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
            {t("auth.passwordResetComplete.title")}
          </h2>
          <p class="text-sm text-left text-gray-300 pb-5">
            {t("auth.passwordResetComplete.subtitle")}
          </p>

          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label
                for="password"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.passwordResetComplete.password")}
              </label>
              <input
                type="password"
                id="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="confirmPassword"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.passwordResetComplete.confirmPassword")}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading()}
              class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white disabled:opacity-50"
            >
              {loading() ? t("common.loading") : t("auth.passwordResetComplete.submit")}
            </button>
          </form>
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
        </div>
      </div>
    </div>
  );
};

export default PasswordResetComplete;