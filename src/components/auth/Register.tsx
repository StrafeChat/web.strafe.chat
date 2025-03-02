import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../../lib/providers/auth/AuthProvider";
import { useTransContext } from "@mbarzda/solid-i18next";
import { LanguageSelector } from "../shared/LanguageSelector";
import DatePicker from "../shared/DatePicker";

const Register = () => {
  const [username, setUsername] = createSignal("");
  const [discriminator, setDiscriminator] = createSignal("");
  const [displayName, setDisplayName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [dateOfBirth, setDateOfBirth] = createSignal(new Date());
  const [error, setError] = createSignal("");
  const { register, isMobile } = useAuth();
  const [t] = useTransContext();
  const navigate = useNavigate();

  // In Register.tsx, modify the handleSubmit function:

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (
      !username() ||
      !discriminator() ||
      !email() ||
      !password() ||
      !dateOfBirth()
    ) {
      setError(t("auth.register.error.requiredFields"));
      return;
    }

    const discNumber = parseInt(discriminator(), 10);
    if (isNaN(discNumber)) {
      setError("Discriminator must be a valid number");
      return;
    }

    const date = new Date(dateOfBirth());
    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const isoDate = utcDate.toISOString();

    const result = await register({
      email: email(),
      username: username(),
      discriminator: discNumber,
      display_name: displayName() || undefined,
      date_of_birth: isoDate,
      password: password(),
    });

    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error || t("auth.register.error.registrationFailed"));
    }
  };

  return (
    <div class="min-h-screen bg-[#1a1b26] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated turtle emojis */}
      <div class="fixed inset-0 opacity-40 pointer-events-none">
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

      {/* Dark gradient overlay */}
      <div class="absolute inset-0 bg-gradient-to-br from-[#1a1b26]/80 via-[#1a1b26]/60 to-[#1a1b26]/90 pointer-events-none"></div>

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
            {t("auth.register.title")}
          </h2>
          <p class="text-sm text-left text-gray-300 pb-5">
            {t("auth.register.subtitle")}
          </p>

          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label
                for="username"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.username")}*
              </label>
              <input
                type="text"
                id="username"
                value={username()}
                required
                onInput={(e) => setUsername(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="discriminator"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.discriminator")}*
              </label>
              <input
                type="text"
                id="discriminator"
                value={discriminator()}
                required
                onInput={(e) => setDiscriminator(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="displayName"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.displayName")}
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName()}
                onInput={(e) => setDisplayName(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="email"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.email")}*
              </label>
              <input
                type="email"
                id="email"
                value={email()}
                required
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="password"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.password")}*
              </label>
              <input
                type="password"
                id="password"
                value={password()}
                required
                onInput={(e) => setPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                for="dateOfBirth"
                class="block text-sm font-medium mb-2 text-gray-300"
              >
                {t("auth.register.dateOfBirth")}*
              </label>
              <DatePicker
                value={dateOfBirth()}
                onChange={(date) => setDateOfBirth(date)}
                minDate={new Date(1900, 0, 1)}
                maxDate={new Date()}
                class="w-full"
              />
            </div>

            <div class="flex items-center">
              <input
                type="checkbox"
                id="tos"
                required
                class="w-4 h-4 mr-2 rounded accent-[var(--primary)] cursor-pointer"
              />
              <label for="tos" class="text-sm text-gray-300 select-none">
                {t("auth.register.tos")}{" "}
                <a
                  href="https://strafe.chat/terms"
                  class="text-[var(--primary)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("auth.register.tosLink")}
                </a>{" "}
                {t("auth.register.and")}{" "}
                <a
                  href="https://strafe.chat/privacy"
                  class="text-[var(--primary)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("auth.register.privacyLink")}
                </a>
              </label>
            </div>

            <button
              type="submit"
              class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
            >
              {t("auth.register.submit")}
            </button>

            <div class="text-left">
              <button
                type="button"
                onClick={() => navigate("/login")}
                class="text-sm hover:underline text-gray-300"
              >
                {t("auth.register.haveAccount")}
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

export default Register;
