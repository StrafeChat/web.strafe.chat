import { Component, createSignal } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { USFlag, ESFlag, FRFlag } from "../../shared/Flags";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  Icon: () => any;
}

const languages: Language[] = [
  { code: "en_us", name: "English", nativeName: "English", Icon: USFlag },
  { code: "es_es", name: "Spanish", nativeName: "Español", Icon: ESFlag },
  { code: "fr_fr", name: "French", nativeName: "Français", Icon: FRFlag },
];

const LanguageSettings: Component = () => {
  const [t, { changeLanguage }] = useTransContext();
  const [selectedLanguage, setSelectedLanguage] = createSignal(
    localStorage.getItem("sc_lang") || "en_us",
  );

  const handleLanguageChange = async (code: string) => {
    await changeLanguage(code);
    setSelectedLanguage(code);
    localStorage.setItem("sc_lang", code);
  };

  return (
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-text-primary mb-1">
        {t("settings.language.title")}
      </h2>
      <p class="text-text-secondary mb-5 text-xs">
        {t("settings.language.description")}
      </p>
      <div class="bg-background1 rounded-lg">
        <div class="divide-y divide-surface">
          {languages.map((language, index) => (
            <button
              class={`w-full px-4 py-3 flex items-center gap-4 hover:bg-opacity-80 transition-colors ${
                selectedLanguage() === language.code ? "bg-background" : ""
              } ${index === 0 ? "rounded-t-lg" : ""} ${
                index === languages.length - 1 ? "rounded-b-lg" : ""
              }`}
              onClick={() => handleLanguageChange(language.code)}
            >
              <div class="w-8 h-6 overflow-hidden rounded-sm">
                <language.Icon />
              </div>
              <div class="flex-1 text-left">
                <div class="text-text-primary">{language.name}</div>
                <div class="text-text-secondary text-sm">
                  {language.nativeName}
                </div>
              </div>
              {selectedLanguage() === language.code && (
                <div class="text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageSettings;
