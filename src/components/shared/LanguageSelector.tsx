import { Component, createSignal } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";
import { USFlag, ESFlag, FRFlag } from "./Flags";
import { Dropdown, type DropdownOption } from "./Dropdown";

const languages: DropdownOption<string>[] = [
  { value: "en_us", label: "English", icon: USFlag },
  { value: "es_es", label: "Español", icon: ESFlag },
  { value: "fr_fr", label: "Français", icon: FRFlag },
];

export const LanguageSelector: Component = () => {
  const [, { changeLanguage }] = useTransContext();
  const [selectedLanguage, setSelectedLanguage] = createSignal(
    localStorage.getItem("sc_lang") || "en_us",
  );

  const handleLanguageChange = async (code: string) => {
    await changeLanguage(code);
    setSelectedLanguage(code);
    localStorage.setItem("sc_lang", code);
  };

  return (
    <Dropdown
      class="absolute top-4 right-4"
      options={languages}
      value={selectedLanguage()}
      onChange={handleLanguageChange}
    />
  );
};
