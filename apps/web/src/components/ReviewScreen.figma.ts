// url=https://www.figma.com/design/GEjt1rt1s7AXvkcr4t8muE/VedaAI-Hiring-Assignment
// source=src/components/ReviewScreen.tsx
// component=ReviewScreen
import figma from "figma";

export default {
  example: figma.code`
    <ReviewScreen
      data={assessmentResult}
      answerPages={answerPages}
      onRestart={() => undefined}
    />
  `,
  imports: ['import { ReviewScreen } from "@/components/ReviewScreen"'],
  id: "review-screen",
};
