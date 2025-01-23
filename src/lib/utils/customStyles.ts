export const CUSTOM_CSS_KEY = "sc_custom_css";

export const applyCustomStyles = () => {
  try {
    console.log("[CustomStyles] Starting to apply custom styles");
    
    // Remove any previously added custom style
    const existingStyle = document.getElementById("custom-app-styles");
    if (existingStyle) {
      console.log("[CustomStyles] Removing existing style element");
      existingStyle.remove();
    }

    // Get stored custom CSS data
    const storedData = localStorage.getItem(CUSTOM_CSS_KEY);
    if (!storedData) {
      console.log("[CustomStyles] No stored custom styles found");
      return;
    }

    console.log("[CustomStyles] Found stored styles:", storedData);
    const { css, variables } = JSON.parse(storedData);

    // Create and apply new custom style
    const styleElement = document.createElement("style");
    styleElement.id = "custom-app-styles";

    // Apply CSS variables
    let cssVariablesString = ":root {\n";
    Object.entries(variables).forEach(([key, value]) => {
      cssVariablesString += `  ${key}: ${value};\n`;
    });
    cssVariablesString += "}\n\n";

    // Add custom CSS
    styleElement.textContent = cssVariablesString + css;
    console.log("[CustomStyles] Applying styles:", styleElement.textContent);

    document.head.appendChild(styleElement);
    console.log("[CustomStyles] Successfully applied custom styles");
  } catch (error) {
    console.error("[CustomStyles] Error applying custom styles:", error);
  }
};
