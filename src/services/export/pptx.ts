import "server-only";
import PptxGenJS from "pptxgenjs";

/**
 * Editable PPTX export (PptxGenJS). All copy is added as real text boxes and all
 * tables as native editable tables — never flattened imagery — so Lens 3 of the
 * OM review passes. Each slide carries the brand disclaimer + page number.
 */

export interface PptxBrand {
  name: string;
  broker?: string | null;
  contact?: string | null;
  disclaimer?: string | null;
  accent?: string; // hex without '#'
}

export interface PptxTable {
  headers: string[];
  rows: (string | number)[][];
}

export interface PptxSection {
  title: string;
  kicker?: string;
  paragraphs?: string[];
  table?: PptxTable;
  sources?: string[];
}

export interface PptxDocInput {
  name: string;
  address?: string | null;
  brand: PptxBrand;
  sections: PptxSection[];
}

const INK = "201E1D";
const PAPER = "FAF9F8";
const MUTED = "605D5D";

export interface PptxResult {
  buffer: Buffer;
  slideCount: number;
  editableText: true;
  editableTables: true;
}

export async function buildOmPptx(input: PptxDocInput): Promise<PptxResult> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "LETTER_P", width: 8.5, height: 11 });
  pptx.layout = "LETTER_P";
  const accent = input.brand.accent ?? "AE1800";

  const footer = (slide: PptxGenJS.Slide, pageNo: number) => {
    slide.addText(
      `${input.brand.name} · Offering Memorandum · ${input.name} · Demo data · ${pageNo}`,
      { x: 0.5, y: 10.4, w: 7.5, h: 0.3, fontFace: "Archivo", fontSize: 7, color: MUTED, align: "left" },
    );
    if (input.brand.disclaimer) {
      slide.addText(input.brand.disclaimer, { x: 0.5, y: 10.65, w: 7.5, h: 0.3, fontFace: "Archivo", fontSize: 6, color: MUTED });
    }
  };

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: PAPER };
  cover.addText(input.brand.name.toUpperCase(), { x: 0.6, y: 3.4, w: 7, h: 0.3, fontFace: "Archivo", fontSize: 10, color: accent, charSpacing: 3 });
  cover.addText(input.name, { x: 0.6, y: 3.8, w: 7.3, h: 1, fontFace: "Archivo", fontSize: 30, bold: true, color: INK });
  if (input.address) cover.addText(input.address, { x: 0.6, y: 4.9, w: 7.3, h: 0.4, fontFace: "Archivo", fontSize: 13, color: MUTED });
  footer(cover, 1);

  input.sections.forEach((section, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: PAPER };
    if (section.kicker) {
      slide.addText(section.kicker.toUpperCase(), { x: 0.6, y: 0.55, w: 7, h: 0.3, fontFace: "Archivo", fontSize: 10, color: accent, charSpacing: 3 });
    }
    slide.addText(section.title, { x: 0.6, y: 0.85, w: 7.3, h: 0.6, fontFace: "Archivo", fontSize: 22, bold: true, color: INK });

    let y = 1.7;
    for (const p of section.paragraphs ?? []) {
      slide.addText(p, { x: 0.6, y, w: 7.3, h: 0.8, fontFace: "Archivo", fontSize: 12, color: INK, valign: "top" });
      y += 0.9;
    }

    if (section.table) {
      const headerRow = section.table.headers.map((h) => ({
        text: h,
        options: { bold: true, color: PAPER, fill: { color: INK }, fontFace: "Archivo", fontSize: 9 },
      }));
      const bodyRows = section.table.rows.map((r) =>
        r.map((c) => ({ text: String(c), options: { fontFace: "Archivo", fontSize: 9, color: INK } })),
      );
      slide.addTable([headerRow, ...bodyRows], {
        x: 0.6,
        y,
        w: 7.3,
        border: { type: "solid", color: "D7D3D3", pt: 0.5 },
      });
    }

    if (section.sources?.length) {
      slide.addText(`Sources: ${section.sources.join(" · ")}`, { x: 0.6, y: 9.9, w: 7.3, h: 0.3, fontFace: "Archivo", fontSize: 7, color: MUTED });
    }
    footer(slide, idx + 2);
  });

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, slideCount: input.sections.length + 1, editableText: true, editableTables: true };
}
