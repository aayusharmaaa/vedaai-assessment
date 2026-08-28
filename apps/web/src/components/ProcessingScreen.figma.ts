// url=https://www.figma.com/design/GEjt1rt1s7AXvkcr4t8muE/VedaAI-Hiring-Assignment
// source=src/components/ProcessingScreen.tsx
// component=ProcessingScreen
import figma from "figma";

const instance = figma.selectedInstance;
const label = instance.getString("Label");
const detail = instance.getString("Detail");

export default {
  example: figma.code`
    <ProcessingScreen
      progress={{ stage: "questions", percent: 32, label: "${label}", detail: "${detail}" }}
      onRetry={() => undefined}
      onCancel={() => undefined}
    />
  `,
  imports: ['import { ProcessingScreen } from "@/components/ProcessingScreen"'],
  id: "processing-screen",
};
