import { Component } from "solid-js";
import { useTransContext } from "@mbarzda/solid-i18next";

interface DefaultSettingsProps {
  title: string;
}

const DefaultSettings: Component<DefaultSettingsProps> = (props) => {
  const [t] = useTransContext();

  return (
    <div class="mb-8">
      <h2 class="text-xl font-semibold text-text-primary mb-5">
        {t(`settings.sections.${props.title}`)}
      </h2>
      <div class="text-text-secondary">
        {t("settings.default.underDevelopment")}
      </div>
    </div>
  );
};

export default DefaultSettings;
