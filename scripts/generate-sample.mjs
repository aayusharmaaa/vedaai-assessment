/**
 * Generates the bundled demo: a printed question paper, a handwritten answer
 * sheet, and the pre-computed assessment result for both.
 *
 * The pages and their bounding boxes are emitted from the SAME layout pass, so
 * the demo's highlights are exact by construction rather than by eyeballing.
 *
 * Run: node scripts/generate-sample.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_DIR = join(ROOT, "public", "sample");

/** A4 at 150dpi. */
const W = 1240;
const H = 1754;

const INK = "#1a3a8f";
const RULE = "#c9d6e8";
const MARGIN_RULE = "#e79a9a";

const HAND = "'Segoe Script','Bradley Hand','Comic Sans MS','Chalkboard SE',cursive";
const PRINT = "'Times New Roman',Georgia,serif";
const PRINT_SANS = "Arial,Helvetica,sans-serif";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ------------------------------------------------------------------ *
 * Question paper
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  {
    number: "1",
    section: "Section A",
    kind: "mcq",
    maxMarks: 1,
    text: "Which of the following organelles is primarily involved in photosynthesis? A) Mitochondrion B) Chloroplast C) Ribosome D) Nucleus",
    print: [
      "1. Which of the following organelles is primarily involved in",
      "    photosynthesis?",
      "        A) Mitochondrion        B) Chloroplast",
      "        C) Ribosome                D) Nucleus",
    ],
  },
  {
    number: "2",
    section: "Section A",
    kind: "mcq",
    maxMarks: 1,
    text: "Which blood vessel carries blood away from the heart? A) Vein B) Artery C) Capillary D) Venule",
    print: [
      "2. Which blood vessel carries blood away from the heart?",
      "        A) Vein                          B) Artery",
      "        C) Capillary                  D) Venule",
    ],
  },
  {
    number: "3",
    section: "Section A",
    kind: "mcq",
    maxMarks: 1,
    text: "The green pigment that traps light energy in plants is called: A) Haemoglobin B) Chlorophyll C) Carotene D) Xanthophyll",
    print: [
      "3. The green pigment that traps light energy in plants is called:",
      "        A) Haemoglobin            B) Chlorophyll",
      "        C) Carotene                    D) Xanthophyll",
    ],
  },
  {
    number: "4",
    section: "Section B",
    kind: "long",
    maxMarks: 3,
    text: "Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process.",
    print: [
      "4. Explain the role of chloroplasts in photosynthesis, naming the main",
      "    pigments involved and briefly outlining the two major stages of the",
      "    process.",
    ],
  },
  {
    number: "5",
    section: "Section B",
    kind: "long",
    maxMarks: 3,
    text: "Describe the flow of blood through the human heart starting from the right atrium and ending at the aorta; include the names of the valves crossed.",
    print: [
      "5. Describe the flow of blood through the human heart starting from the",
      "    right atrium and ending at the aorta; include the names of the valves",
      "    crossed.",
    ],
  },
  {
    number: "6",
    section: "Section B",
    kind: "numerical",
    maxMarks: 3,
    text: "Write the balanced chemical equation for photosynthesis and state where the plant obtains each raw material from.",
    print: [
      "6. Write the balanced chemical equation for photosynthesis and state",
      "    where the plant obtains each raw material from.",
    ],
  },
  {
    number: "7 (a)",
    section: "Section C",
    kind: "diagram",
    maxMarks: 3,
    parentNumber: "7",
    text: "Draw a labelled diagram of an alveolus showing the capillary network and air space. Label the alveolar sac, the capillary, and the direction of gas exchange.",
    print: [
      "7. (a) Draw a labelled diagram of an alveolus showing the capillary",
      "            network and air space. Label the alveolar sac, the capillary, and",
      "            the direction of gas exchange.",
    ],
  },
  {
    number: "7 (b)",
    section: "Section C",
    kind: "short",
    maxMarks: 2,
    parentNumber: "7",
    text: "State two structural features of alveoli that make them efficient for gas exchange.",
    print: [
      "    (b) State two structural features of alveoli that make them efficient",
      "            for gas exchange.",
    ],
  },
  {
    number: "8",
    section: "Section C",
    kind: "diagram",
    maxMarks: 5,
    text: "Draw a neat labelled diagram of the human digestive system, labelling at least five organs, and state one function of the liver.",
    print: [
      "8. Draw a neat labelled diagram of the human digestive system, labelling",
      "    at least five organs, and state one function of the liver.",
    ],
  },
  {
    number: "9",
    section: "Section C",
    kind: "short",
    maxMarks: 3,
    text: "Differentiate between arteries and veins on the basis of wall thickness, presence of valves, and direction of blood flow.",
    print: [
      "9. Differentiate between arteries and veins on the basis of wall thickness,",
      "    presence of valves, and direction of blood flow.",
    ],
  },
  {
    number: "10",
    section: "Section C",
    kind: "short",
    maxMarks: 3,
    text: "What is transpiration? State two functions of transpiration in plants.",
    print: ["10. What is transpiration? State two functions of transpiration in plants."],
  },
];

function questionPaperPages() {
  const pages = [[], []];
  let page = 0;
  let y = 250;
  let lastSection = null;

  const push = (el) => pages[page].push(el);

  push(
    `<text x="${W / 2}" y="120" text-anchor="middle" font-family="${PRINT_SANS}" font-size="34" font-weight="700" fill="#111">DELHI PUBLIC SCHOOL, BOKARO STEEL CITY</text>`,
  );
  push(
    `<text x="${W / 2}" y="168" text-anchor="middle" font-family="${PRINT_SANS}" font-size="26" fill="#333">Class X &#8226; Biology &#8226; Unit Test</text>`,
  );
  push(
    `<text x="90" y="212" font-family="${PRINT_SANS}" font-size="21" fill="#444">Time: 1 hour</text>`,
  );
  push(
    `<text x="${W - 90}" y="212" text-anchor="end" font-family="${PRINT_SANS}" font-size="21" fill="#444">Maximum Marks: 28</text>`,
  );
  push(`<line x1="90" y1="228" x2="${W - 90}" y2="228" stroke="#999" stroke-width="2"/>`);

  for (const q of QUESTIONS) {
    const blockHeight = q.print.length * 40 + (q.section !== lastSection ? 70 : 0) + 26;

    if (y + blockHeight > H - 120 && page === 0) {
      page = 1;
      y = 140;
      lastSection = null;
    }

    if (q.section !== lastSection) {
      y += 34;
      pages[page].push(
        `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${PRINT_SANS}" font-size="24" font-weight="700" fill="#111">${esc(q.section)}</text>`,
      );
      y += 46;
      lastSection = q.section;
    }

    q.print.forEach((line, i) => {
      pages[page].push(
        `<text x="90" y="${y + i * 40}" font-family="${PRINT}" font-size="27" fill="#111" xml:space="preserve">${esc(line)}</text>`,
      );
    });

    pages[page].push(
      `<text x="${W - 90}" y="${y}" text-anchor="end" font-family="${PRINT}" font-size="25" fill="#111">[${q.maxMarks}]</text>`,
    );

    y += q.print.length * 40 + 26;
  }

  pages[0].push(
    `<text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="${PRINT_SANS}" font-size="20" fill="#777">Page 1 of 2</text>`,
  );
  pages[1].push(
    `<text x="${W / 2}" y="${H - 60}" text-anchor="middle" font-family="${PRINT_SANS}" font-size="20" fill="#777">Page 2 of 2</text>`,
  );

  return pages.map(
    (els) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="#ffffff"/>${els.join("")}</svg>`,
  );
}

/* ------------------------------------------------------------------ *
 * Answer sheet - a tiny layout engine that also reports bounding boxes
 * ------------------------------------------------------------------ */

const LINE_H = 48;
const TOP = 150;
const LEFT = 165;
const RIGHT = W - 80;

class AnswerPage {
  constructor(index) {
    this.index = index;
    this.els = [];
    this.blocks = [];
    this.y = TOP;
  }

  /** Ruled stationery, drawn behind everything. */
  background() {
    const lines = [];
    for (let y = TOP - 20; y < H - 60; y += LINE_H) {
      lines.push(
        `<line x1="70" y1="${y}" x2="${W - 60}" y2="${y}" stroke="${RULE}" stroke-width="2"/>`,
      );
    }
    lines.push(
      `<line x1="140" y1="60" x2="140" y2="${H - 60}" stroke="${MARGIN_RULE}" stroke-width="2.5"/>`,
    );
    return lines.join("");
  }

  /** Write handwriting lines, returning the vertical span consumed. */
  lines(texts, { size = 31, indent = 0 } = {}) {
    const startY = this.y;
    for (const t of texts) {
      this.els.push(
        `<text x="${LEFT + indent}" y="${this.y}" font-family="${HAND}" font-size="${size}" fill="${INK}" xml:space="preserve">${esc(t)}</text>`,
      );
      this.y += LINE_H;
    }
    return { top: startY - size, bottom: this.y - LINE_H + 14 };
  }

  raw(svg, height) {
    const startY = this.y;
    this.els.push(`<g transform="translate(0,${this.y})">${svg}</g>`);
    this.y += height;
    return { top: startY, bottom: this.y };
  }

  gap(px = LINE_H) {
    this.y += px;
  }

  /**
   * Record a block's box in normalised page space, padded slightly so the
   * highlight reads as a comfortable band rather than a tight crop.
   */
  record(id, spans, { left = LEFT - 30, right = RIGHT } = {}) {
    const top = Math.min(...spans.map((s) => s.top)) - 14;
    const bottom = Math.max(...spans.map((s) => s.bottom)) + 14;

    this.blocks.push({
      id,
      box: {
        x: +(left / W).toFixed(4),
        y: +(Math.max(top, 0) / H).toFixed(4),
        w: +((right - left) / W).toFixed(4),
        h: +((Math.min(bottom, H) - Math.max(top, 0)) / H).toFixed(4),
      },
    });
  }

  toSvg() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
      `<rect width="${W}" height="${H}" fill="#fdfcf7"/>${this.background()}${this.els.join("")}` +
      `<text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-family="${HAND}" font-size="24" fill="#8a93a6">${this.index + 1}</text>` +
      `</svg>`
    );
  }
}

/* --- small hand-drawn figures ------------------------------------- */

function plantDiagram() {
  return `
    <g stroke="${INK}" fill="none" stroke-width="2.5" stroke-linecap="round">
      <circle cx="330" cy="70" r="26"/>
      ${Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return `<line x1="${330 + Math.cos(a) * 36}" y1="${70 + Math.sin(a) * 36}" x2="${330 + Math.cos(a) * 50}" y2="${70 + Math.sin(a) * 50}"/>`;
      }).join("")}
      <line x1="330" y1="128" x2="330" y2="168" stroke-dasharray="6 6"/>
      <path d="M330 168 l-10 -14 l20 0 z" fill="${INK}"/>
      <line x1="620" y1="200" x2="620" y2="300"/>
      <path d="M600 210 q20 -34 40 0 q-20 -14 -40 0z" fill="${INK}" opacity="0.25"/>
      <path d="M600 250 q20 -34 40 0 q-20 -14 -40 0z" fill="${INK}" opacity="0.25"/>
      <path d="M620 300 l-26 34 M620 300 l26 34 M620 300 l0 40"/>
      <line x1="430" y1="240" x2="580" y2="240"/>
      <path d="M580 240 l-16 -8 l0 16 z" fill="${INK}"/>
      <line x1="660" y1="240" x2="820" y2="240"/>
      <path d="M820 240 l-16 -8 l0 16 z" fill="${INK}"/>
      <line x1="700" y1="350" x2="640" y2="330"/>
      <path d="M640 330 l16 -2 l-8 14 z" fill="${INK}"/>
    </g>
    <g font-family="${HAND}" font-size="26" fill="${INK}">
      <text x="380" y="80">Sunlight</text>
      <text x="250" y="250">Carbon</text>
      <text x="250" y="284">dioxide</text>
      <text x="830" y="250">Oxygen</text>
      <text x="712" y="358">Water</text>
    </g>`;
}

function alveolusDiagram() {
  return `
    <g stroke="${INK}" fill="none" stroke-width="2.5">
      <circle cx="330" cy="140" r="62"/>
      <circle cx="428" cy="96" r="44"/>
      <circle cx="440" cy="196" r="40"/>
      <line x1="250" y1="140" x2="200" y2="140"/>
      <path d="M200 140 q-40 -60 -90 -30" />
      <path d="M268 76 q90 -60 180 -10 q80 44 40 130 q-40 84 -150 60"
            stroke-dasharray="7 7"/>
      <line x1="520" y1="120" x2="600" y2="90"/>
      <path d="M600 90 l-18 -2 l6 16 z" fill="${INK}"/>
      <line x1="600" y1="180" x2="520" y2="180"/>
      <path d="M520 180 l18 -8 l0 16 z" fill="${INK}"/>
    </g>
    <g font-family="${HAND}" font-size="25" fill="${INK}">
      <text x="612" y="96">O2 in</text>
      <text x="612" y="188">CO2 out</text>
      <text x="240" y="252">Alveolar sac</text>
      <text x="470" y="268">Capillary</text>
      <text x="60" y="104">Bronchiole</text>
    </g>`;
}

function digestiveDiagram() {
  return `
    <g stroke="${INK}" fill="none" stroke-width="2.5" stroke-linecap="round">
      <ellipse cx="400" cy="60" rx="34" ry="42"/>
      <path d="M400 102 L400 190"/>
      <path d="M356 190 q44 -26 88 0 q10 60 -34 74 q-54 6 -54 -74z"/>
      <path d="M390 264 q-10 40 24 44"/>
      <path d="M330 330 h150 v34 h-150z"/>
      <path d="M348 364 q-14 90 44 96 q70 6 52 -96"/>
      <path d="M300 300 q-44 20 -30 70 q10 40 60 30" />
      <line x1="470" y1="212" x2="620" y2="212"/>
      <line x1="470" y1="330" x2="620" y2="330"/>
      <line x1="300" y1="318" x2="180" y2="300"/>
      <line x1="420" y1="60" x2="620" y2="60"/>
      <line x1="418" y1="440" x2="620" y2="430"/>
    </g>
    <g font-family="${HAND}" font-size="25" fill="${INK}">
      <text x="632" y="68">Mouth</text>
      <text x="632" y="220">Stomach</text>
      <text x="632" y="338">Small intestine</text>
      <text x="632" y="438">Large intestine</text>
      <text x="60" y="298">Liver</text>
      <text x="404" y="152" font-size="23">Oesophagus</text>
    </g>`;
}

/* --- the four answer pages ----------------------------------------- */

function answerSheetPages() {
  const pages = [0, 1, 2, 3].map((i) => new AnswerPage(i));

  // ---- Page 1 -----------------------------------------------------
  const p1 = pages[0];
  p1.els.push(
    `<text x="${LEFT - 30}" y="100" font-family="${HAND}" font-size="27" fill="#6b7280">Name: Ananya Verma        Roll No: 14        Class: X-B</text>`,
  );

  p1.record("p0-0", [p1.lines(["Q1.  B) Chloroplast"])]);
  p1.gap(18);
  p1.record("p0-1", [p1.lines(["Q2.  B) Artery"])]);
  p1.gap(18);

  // Q4 answered before Q3 (which is skipped) and running onto page 2.
  p1.record("p0-2", [
    p1.lines([
      "Q4.  Photosynthesis is the process used by green plants",
      "        to convert light energy into chemical energy. It takes",
      "        place inside the chloroplast of the plant cell. The main",
      "        pigment is chlorophyll, which is green in colour, and",
      "        the accessory pigments are carotenoids.",
    ]),
    p1.raw(plantDiagram(), 400),
  ]);

  // ---- Page 2 -----------------------------------------------------
  const p2 = pages[1];

  // Continuation of Q4 - no label, picks up mid-answer.
  p2.record("p1-0", [
    p2.lines([
      "There are two main stages :",
      "1. Light reaction - captures light energy in the grana",
      "     and makes ATP and NADPH.",
      "2. Dark reaction - uses that energy to make glucose",
      "     in the stroma.",
    ]),
  ]);
  p2.gap(24);

  // Q6 answered before Q5 - out of order.
  p2.record("p1-1", [
    p2.lines([
      "Q6.  6CO2 + 6H2O  --light/chlorophyll-->  C6H12O6 + 6O2",
      "        Carbon dioxide is taken from the air through the",
      "        stomata and water is absorbed from the soil by the",
      "        roots.",
    ]),
  ]);
  p2.gap(24);

  p2.record("p1-2", [
    p2.lines([
      "Q5.  Blood comes into the right atrium from the body.",
      "        Then it goes to the right ventricle and is pumped to",
      "        the lungs. From the lungs it comes back to the left",
      "        atrium, goes to the left ventricle and then out",
      "        through the aorta to the whole body.",
    ]),
  ]);

  // ---- Page 3 -----------------------------------------------------
  const p3 = pages[2];

  p3.record("p2-0", [
    p3.lines(["Q7(a)."]),
    p3.raw(alveolusDiagram(), 300),
  ]);
  p3.gap(30);

  p3.record("p2-1", [
    p3.lines([
      "Q7(b).  (i) The alveoli have very thin walls, only one",
      "               cell thick, so gases can diffuse quickly.",
      "          (ii) They are present in very large numbers, which",
      "               gives a very large surface area for exchange.",
    ]),
  ]);
  p3.gap(24);

  p3.record("p2-2", [
    p3.lines([
      "Q9.  Arteries have thick and elastic walls while veins",
      "        have thin walls. Veins have valves in them but",
      "        arteries do not have valves. Arteries carry blood",
      "        away from the heart and veins bring blood back",
      "        to the heart.",
    ]),
  ]);

  // ---- Page 4 -----------------------------------------------------
  const p4 = pages[3];

  p4.record("p3-0", [
    p4.lines(["Q8."]),
    p4.raw(digestiveDiagram(), 490),
    p4.lines([
      "The liver makes bile, which helps in the digestion of fats.",
    ]),
  ]);
  p4.gap(30);

  // An answer to a question that does not exist on this paper.
  p4.record("p3-1", [
    p4.lines([
      "Q12.  Osmosis is the movement of water molecules from",
      "          a dilute solution to a concentrated solution through",
      "          a semi-permeable membrane.",
    ]),
  ]);
  p4.gap(24);

  // Rough working - answers nothing.
  p4.record("p3-2", [
    p4.lines(["Rough work :", "6 x 2 = 12,   12 + 6 = 18"], { size: 27 }),
  ]);

  return pages;
}

/* ------------------------------------------------------------------ *
 * The pre-computed assessment result for the demo
 * ------------------------------------------------------------------ */

const ANSWER_TEXT = {
  "p0-0": { label: "Q1", text: "B) Chloroplast" },
  "p0-1": { label: "Q2", text: "B) Artery" },
  "p0-2": {
    label: "Q4",
    text: "Photosynthesis is the process used by green plants to convert light energy into chemical energy. It takes place inside the chloroplast of the plant cell. The main pigment is chlorophyll, which is green in colour, and the accessory pigments are carotenoids. [diagram: plant with sunlight, carbon dioxide, oxygen and water labelled]",
    diagram: true,
  },
  "p1-0": {
    label: null,
    text: "There are two main stages: 1. Light reaction - captures light energy in the grana and makes ATP and NADPH. 2. Dark reaction - uses that energy to make glucose in the stroma.",
    continues: true,
  },
  "p1-1": {
    label: "Q6",
    text: "6CO2 + 6H2O --light/chlorophyll--> C6H12O6 + 6O2. Carbon dioxide is taken from the air through the stomata and water is absorbed from the soil by the roots.",
  },
  "p1-2": {
    label: "Q5",
    text: "Blood comes into the right atrium from the body. Then it goes to the right ventricle and is pumped to the lungs. From the lungs it comes back to the left atrium, goes to the left ventricle and then out through the aorta to the whole body.",
  },
  "p2-0": {
    label: "Q7(a)",
    text: "[diagram: labelled alveolus showing alveolar sac, capillary network, bronchiole, with arrows for O2 in and CO2 out]",
    diagram: true,
  },
  "p2-1": {
    label: "Q7(b)",
    text: "(i) The alveoli have very thin walls, only one cell thick, so gases can diffuse quickly. (ii) They are present in very large numbers, which gives a very large surface area for exchange.",
  },
  "p2-2": {
    label: "Q9",
    text: "Arteries have thick and elastic walls while veins have thin walls. Veins have valves in them but arteries do not have valves. Arteries carry blood away from the heart and veins bring blood back to the heart.",
  },
  "p3-0": {
    label: "Q8",
    text: "[diagram: human digestive system labelled mouth, oesophagus, stomach, small intestine, large intestine, liver] The liver makes bile, which helps in the digestion of fats.",
    diagram: true,
  },
  "p3-1": {
    label: "Q12",
    text: "Osmosis is the movement of water molecules from a dilute solution to a concentrated solution through a semi-permeable membrane.",
  },
  "p3-2": { label: null, text: "Rough work: 6 x 2 = 12, 12 + 6 = 18" },
};

const GRADES = {
  "1": [1, "correct", "Correct - the chloroplast is the site of photosynthesis."],
  "2": [1, "correct", "Correct. Arteries carry blood away from the heart."],
  "4": [
    3,
    "correct",
    "A complete answer: you named chlorophyll and the carotenoids and set out both the light and dark reactions with the right locations (grana and stroma).",
  ],
  "5": [
    2,
    "partial",
    "The route through the four chambers is right, but the question asked for the valves crossed - you needed the tricuspid, pulmonary, bicuspid and aortic valves.",
  ],
  "6": [
    3,
    "correct",
    "The equation is balanced and correctly conditioned, and you sourced both raw materials properly (stomata for CO2, roots for water).",
  ],
  "7 (a)": [
    3,
    "correct",
    "Clear diagram - alveolar sac, capillary and the direction of gas exchange are all labelled correctly.",
  ],
  "7 (b)": [
    2,
    "correct",
    "Both features are right: the one-cell-thick wall for fast diffusion and the large number of alveoli for surface area.",
  ],
  "8": [
    4,
    "partial",
    "Five organs are labelled correctly and the bile function of the liver is right, but the pancreas is missing from your diagram.",
  ],
  "9": [
    3,
    "correct",
    "All three points of difference are correct and clearly stated.",
  ],
};

function buildResult(answerPages) {
  const questions = QUESTIONS.map((q, i) => ({
    id: `q${i}`,
    number: q.number,
    order: i,
    text: q.text,
    maxMarks: q.maxMarks,
    parentNumber: q.parentNumber ?? null,
    section: q.section,
    kind: q.kind,
  }));

  // Boxes, keyed by the id recorded during layout.
  const boxes = new Map();
  answerPages.forEach((page) => {
    page.blocks.forEach((b) => boxes.set(b.id, { page: page.index, bbox: b.box }));
  });

  // Stitch Q4's continuation into a single two-page answer block.
  const rawBlocks = Object.entries(ANSWER_TEXT).map(([id, v]) => ({
    id,
    writtenLabel: v.label ?? null,
    text: v.text,
    regions: [boxes.get(id)],
    continuesFromPrevious: Boolean(v.continues),
    hasDiagram: Boolean(v.diagram),
  }));

  const answerBlocks = [];
  for (const b of rawBlocks) {
    const prev = answerBlocks[answerBlocks.length - 1];
    if (b.continuesFromPrevious && !b.writtenLabel && prev) {
      prev.text = `${prev.text} ${b.text}`;
      prev.regions.push(...b.regions);
      continue;
    }
    answerBlocks.push({ ...b, regions: [...b.regions] });
  }

  const blockForNumber = {
    "1": ["p0-0"],
    "2": ["p0-1"],
    "4": ["p0-2"],
    "5": ["p1-2"],
    "6": ["p1-1"],
    "7 (a)": ["p2-0"],
    "7 (b)": ["p2-1"],
    "8": ["p3-0"],
    "9": ["p2-2"],
  };

  const results = questions.map((q) => {
    const ids = blockForNumber[q.number] ?? [];
    const g = GRADES[q.number];

    return {
      questionId: q.id,
      answerBlockIds: ids,
      status: ids.length ? "answered" : "unanswered",
      method: ids.length ? "label" : "none",
      confidence: ids.length ? 1 : 0,
      grade: g
        ? { awarded: g[0], max: q.maxMarks, verdict: g[1], feedback: g[2] }
        : {
            awarded: 0,
            max: q.maxMarks,
            verdict: "incorrect",
            feedback: "This question was not attempted.",
          },
    };
  });

  const unmatched = [
    {
      answerBlockId: "p3-1",
      reason: 'Labelled "Q12", which is not a question on this paper. The content is about osmosis, which this paper does not ask about.',
    },
    {
      answerBlockId: "p3-2",
      reason: "Rough working; it does not answer any question on the paper.",
    },
  ];

  const totalAwarded = results.reduce((s, r) => s + (r.grade?.awarded ?? 0), 0);
  const totalMax = questions.reduce((s, q) => s + q.maxMarks, 0);
  const answeredCount = results.filter((r) => r.status === "answered").length;

  return {
    questions,
    answerBlocks,
    results,
    unmatched,
    summary: {
      totalAwarded,
      totalMax,
      answeredCount,
      unansweredCount: results.length - answeredCount,
      unmatchedCount: unmatched.length,
      percentage: Math.round((totalAwarded / totalMax) * 100),
      remark:
        "Ananya has a strong grasp of photosynthesis - the equation, the pigments and both stages are accurate, and the diagrams are neat and correctly labelled. The gaps are in the circulatory system: the heart valves were not named, and two questions were left unattempted.",
      strengths: [
        "Photosynthesis: equation and both stages",
        "Neat, correctly labelled diagrams",
        "Clear artery vs vein comparison",
      ],
      improvements: [
        "Name the heart valves in the blood-flow path",
        "Attempt every question - Q3 and Q10 were skipped",
        "Include the pancreas in the digestive system diagram",
      ],
    },
    isMock: true,
  };
}

/* ------------------------------------------------------------------ */

mkdirSync(SAMPLE_DIR, { recursive: true });

const qpPages = questionPaperPages();
qpPages.forEach((svg, i) => writeFileSync(join(SAMPLE_DIR, `qp-${i + 1}.svg`), svg));

const asPages = answerSheetPages();
asPages.forEach((p, i) => writeFileSync(join(SAMPLE_DIR, `as-${i + 1}.svg`), p.toSvg()));

const result = buildResult(asPages);

const bundle = {
  questionPaperPages: qpPages.map((_, i) => ({
    index: i,
    dataUrl: `/sample/qp-${i + 1}.svg`,
    width: W,
    height: H,
  })),
  answerSheetPages: asPages.map((_, i) => ({
    index: i,
    dataUrl: `/sample/as-${i + 1}.svg`,
    width: W,
    height: H,
  })),
  result,
};

writeFileSync(join(ROOT, "src", "lib", "sample.json"), JSON.stringify(bundle, null, 2));

console.log(
  `[generate-sample] ${qpPages.length} question pages, ${asPages.length} answer pages, ` +
    `${result.questions.length} questions, ${result.answerBlocks.length} answer blocks, ` +
    `${result.unmatched.length} unmatched.`,
);
