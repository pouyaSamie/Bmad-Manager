import type { Metadata } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { WorkspaceTheme } from "@/components/workspace/theme";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@xyflow/react/dist/style.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Bmad Manager",
  description:
    "Your workspace for BMad agents, connections, and workflow design",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <WorkspaceTheme>{children}</WorkspaceTheme>
      </body>
    </html>
  );
}
