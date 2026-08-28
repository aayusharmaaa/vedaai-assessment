// url=https://www.figma.com/design/GEjt1rt1s7AXvkcr4t8muE/VedaAI-Hiring-Assignment
// source=src/components/UploadScreen.tsx
// component=UploadScreen
import figma from "figma";

export default {
  example: figma.code`
    <UploadScreen
      onStart={(qp, as) => undefined}
      onSample={() => undefined}
      hasApiKey={true}
    />
  `,
  imports: ['import { UploadScreen } from "@/components/UploadScreen"'],
  id: "upload-screen",
};
