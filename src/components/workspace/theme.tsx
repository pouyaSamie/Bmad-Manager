"use client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
const theme = createTheme({
  primaryColor: "indigo",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  defaultRadius: "md",
  fontSizes: { xs: "0.75rem", sm: "0.875rem", md: "1rem" },
  components: {
    Button: { defaultProps: { size: "md" } },
    TextInput: { defaultProps: { size: "md" } },
    Select: { defaultProps: { size: "md" } },
  },
});
export function WorkspaceTheme({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      cssVariablesResolver={() => ({
        variables: {},
        light: { "--mantine-color-dimmed": "#495057" },
        dark: { "--mantine-color-dimmed": "#ced4da" },
      })}
    >
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
