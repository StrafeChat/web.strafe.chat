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
  const [tosAgreed, setTosAgreed] = createSignal(false);
  const [error, setError] = createSignal("");
  const [step, setStep] = createSignal(1);
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const { register, isMobile } = useAuth();
  const [t] = useTransContext();
  const navigate = useNavigate();

  const handleNext = (e: Event) => {
    e.preventDefault();
    setError("");

    let valid = true;

    if (step() === 1) {
      if (!email() || !dateOfBirth()) {
        setError(t("auth.register.error.requiredFields"));
        valid = false;
      }
    } else if (step() === 2) {
      if (!password() || !confirmPassword()) {
        setError(t("auth.register.error.requiredFields"));
        valid = false;
      } else if (password() !== confirmPassword()) {
        setError(t("auth.register.error.passwordMismatch"));
        valid = false;
      }
    } else if (step() === 3) {
      if (!username() || !discriminator()) {
        setError(t("auth.register.error.requiredFields"));
        valid = false;
      } else if (
        discriminator().length !== 4 ||
        isNaN(parseInt(discriminator()))
      ) {
        setError("Discriminator must be exactly 4 numbers");
        valid = false;
      }
    } else if (step() === 4) {
      if (!tosAgreed()) {
        setError(t("auth.register.error.requiredFields"));
        valid = false;
      }
    }

    if (valid) {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (
      !email() ||
      !password() ||
      !confirmPassword() ||
      !dateOfBirth() ||
      !username() ||
      !discriminator() ||
      !tosAgreed()
    ) {
      setError(t("auth.register.error.requiredFields"));
      return;
    }

    if (password() !== confirmPassword()) {
      setError(t("auth.register.error.passwordMismatch"));
      return;
    }

    if (discriminator().length !== 4) {
      setError("Discriminator must be exactly 4 digits");
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
      if (result.message) {
        navigate("/verify-email", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
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
            ? "w-full max-w-md mx-auto bg-[#24283b]/95 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 pb-16 border border-[#414868] relative z-10 overflow-visible"
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

          <form
            class="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (step() === 4) handleSubmit(e);
            }}
          >
            <div
              class="relative overflow-hidden w-full"
              style="min-height: 300px;"
            >
              <div
                class="flex transition-transform duration-300 ease-in-out"
                style={`width: 400%; transform: translateX(-${(step() - 1) * 25}%);`}
              >
                <div class="w-[25%] flex-shrink-0 space-y-4">
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
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
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
                  <button
                    type="button"
                    onClick={handleNext}
                    class="w-full py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
                  >
                    {t("auth.register.next")}
                  </button>
                </div>
                <div class="w-[25%] flex-shrink-0 space-y-4">
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
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      for="confirmPassword"
                      class="block text-sm font-medium mb-2 text-gray-300"
                    >
                      Confirm Password*
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword()}
                      required
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
                    />
                  </div>
                  <div class="flex space-x-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      class="flex-1 py-2 px-4 bg-gray-600 rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      class="flex-1 py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      {t("auth.register.next")}
                    </button>
                  </div>
                </div>
                <div class="w-[25%] flex-shrink-0 space-y-4">
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
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
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
                      maxLength={4}
                      onInput={(e) => {
                        const value = e.currentTarget.value.replace(/\D/g, "");
                        setDiscriminator(value.slice(0, 4));
                      }}
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
                    />
                  </div>
                  <div class="flex space-x-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      class="flex-1 py-2 px-4 bg-gray-600 rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      class="flex-1 py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      {t("auth.register.next")}
                    </button>
                  </div>
                </div>
                <div class="w-[25%] flex-shrink-0 space-y-4">
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
                      class="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-white focus:outline-none"
                    />
                  </div>
                  <div class="flex items-center">
                    <div class="relative inline-block w-5 h-5 mr-2">
                      <input
                        type="checkbox"
                        id="tos"
                        checked={tosAgreed()}
                        onChange={(e) => setTosAgreed(e.currentTarget.checked)}
                        required
                        class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer peer z-10"
                      />
                      <span class="absolute top-0 left-0 h-5 w-5 bg-[#24283b] border border-[#414868] rounded-md peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 ease-in-out"></span>
                      <span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200 ease-in-out">
                        ✓
                      </span>
                    </div>
                    <label
                      for="tos"
                      class="text-sm text-gray-300 select-none cursor-pointer"
                    >
                      {t("auth.register.tos")}{" "}
                      <a
                        href="https://strafe.chat/terms"
                        class="text-[var(--primary)] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("auth.register.tosLink")}
                      </a>
                      {", "}
                      <a
                        href="https://strafe.chat/aup"
                        class="text-[var(--primary)] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("auth.register.aupLink")}
                      </a>
                      {", "}
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
                  <div class="flex space-x-4">
                    <button
                      type="button"
                      onClick={handleBack}
                      class="flex-1 py-2 px-4 bg-gray-600 rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      class="flex-1 py-2 px-4 bg-primary rounded-md hover:opacity-90 transition-opacity text-white"
                    >
                      {t("auth.register.submit")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
