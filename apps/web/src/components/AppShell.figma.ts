// url=https://www.figma.com/design/GEjt1rt1s7AXvkcr4t8muE/VedaAI-Hiring-Assignment
// source=src/components/AppShell.tsx
// component=AppShell
import figma from "figma";

const instance = figma.selectedInstance;
const crumb = instance.getString("Breadcrumb");

export default {
  example: figma.code`
    <AppShell crumb="${crumb}">
      {children}
    </AppShell>
  `,
  imports: ['import { AppShell } from "@/components/AppShell"'],
  id: "app-shell",
  metadata: { nestable: true },
};
