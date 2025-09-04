"use client";

import { ThemeProvider, createTheme } from "@aws-amplify/ui-react";

const medisysTheme = createTheme({
  name: "medisys",
  tokens: {
    colors: {
      // brand color for buttons/links
      brand: {
        primary: {
          80: { value: "var(--amplify-colors-brand-primary-80)" }, // main
          90: { value: "var(--amplify-colors-brand-primary-90)" }, // hover/focus
          100: { value: "var(--amplify-colors-brand-primary-100)" }, // active
        },
      },
    },
    radii: {
      small: { value: "8px" },
      medium: { value: "12px" },
      large: { value: "16px" },
    },
    shadows: { small: { value: "0 6px 16px rgba(0,0,0,0.08)" } },

    // ✅ component-level overrides live under tokens.components
    components: {
      button: {
        borderRadius: { value: "{radii.medium.value}" },
        primary: {
          backgroundColor: { value: "{colors.brand.primary.80}" },
          _hover: { backgroundColor: { value: "{colors.brand.primary.90}" } },
          _focus: { backgroundColor: { value: "{colors.brand.primary.90}" } },
          _active: { backgroundColor: { value: "{colors.brand.primary.100}" } },
        },
      },
      textfield: {
        _focus: { borderColor: { value: "{colors.brand.primary.80}" } },
      },
      selectfield: {
        _focus: { borderColor: { value: "{colors.brand.primary.80}" } },
      },
    },
  },
});

export default function AmplifyThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={medisysTheme} colorMode="light">
      {children}
    </ThemeProvider>
  );
}
