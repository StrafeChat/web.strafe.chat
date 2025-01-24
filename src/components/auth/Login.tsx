import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { LanguageSelector } from "../shared/LanguageSelector";

const Login = () => {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const { login, isMobile } = useAuth();
  const [t] = useTransContext();
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (!email() || !password()) {
      setError(t("auth.login.error.emptyFields"));
      return;
    }

    await login({
      email: email(),
      password: password(),
    }).catch((e) => {
      setError(e);
    });
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

      <div
        class={
          isMobile()
            ? "w-full max-w-md mx-auto bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 border border-[#414868] relative z-10"
            : "w-full max-w-md bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-8 border border-[#414868] relative z-10"
        }
      >
        <div class="space-y-1.5">
          <h2 class="text-2xl font-bold text-left text-white">
            {t("auth.login.title")}
          </h2>
          <p class="text-sm text-left text-gray-300 pb-5">
            {t("auth.login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label
                for="email"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.login.email")}
              </label>
              <input
                type="email"
                id="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="password"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.login.password")}
              </label>
              <input
                type="password"
                id="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
            >
              {t("auth.login.submit")}
            </button>

            <div class="text-left">
              <button
                type="button"
                onClick={() => navigate("/register")}
                class="text-sm hover:underline text-gray-300"
              >
                {t("auth.login.needAccount")}
              </button>
            </div>
          </form>
          {error() && (
            <div class="bg-red-500/20 text-red-200 px-4 py-3 rounded-md">
              {error()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
