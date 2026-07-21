import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PptxDocInput } from "./pptx";

/**
 * PDF export through a provider abstraction with a documented LOCAL fallback.
 *
 * `getPdfProvider()` returns a remote provider only when explicitly configured;
 * otherwise it returns the local pdf-lib renderer, which always works offline.
 * No paid/cloud dependency is required.
 */

export interface PdfProvider {
  readonly name: string;
  render(input: PptxDocInput): Promise<Buffer>;
}

const INK = rgb(0.125, 0.118, 0.114);
const MUTED = rgb(0.376, 0.365, 0.365);
const ACCENT = rgb(0.682, 0.094, 0);

/** Local, offline PDF renderer. This is the documented fallback. */
export class LocalPdfProvider implements PdfProvider {
  readonly name = "local-pdf-lib";

  async render(input: PptxDocInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const width = 612;
    const height = 792;
    const margin = 54;

    const wrap = (text: string, size: number, maxWidth: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    };

    let pageNo = 0;
    const newPage = () => {
      pageNo += 1;
      const page = doc.addPage([width, height]);
      // footer
      const footerText = `${input.brand.name} · Offering Memorandum · ${input.name} · Demo data · ${pageNo}`;
      page.drawText(footerText, { x: margin, y: 40, size: 7, font, color: MUTED });
      if (input.brand.disclaimer) {
        for (const [i, l] of wrap(input.brand.disclaimer, 6, width - 2 * margin).slice(0, 2).entries()) {
          page.drawText(l, { x: margin, y: 30 - i * 8, size: 6, font, color: MUTED });
        }
      }
      return page;
    };

    // Cover
    let page = newPage();
    let y = height - 260;
    page.drawText(input.brand.name.toUpperCase(), { x: margin, y, size: 10, font: bold, color: ACCENT });
    y -= 34;
    page.drawText(input.name, { x: margin, y, size: 28, font: bold, color: INK });
    if (input.address) {
      y -= 26;
      page.drawText(input.address, { x: margin, y, size: 13, font, color: MUTED });
    }

    for (const section of input.sections) {
      page = newPage();
      y = height - margin;
      if (section.kicker) {
        page.drawText(section.kicker.toUpperCase(), { x: margin, y, size: 9, font: bold, color: ACCENT });
        y -= 16;
      }
      page.drawText(section.title, { x: margin, y, size: 18, font: bold, color: INK });
      y -= 26;
      for (const p of section.paragraphs ?? []) {
        for (const line of wrap(p, 11, width - 2 * margin)) {
          if (y < 80) {
            page = newPage();
            y = height - margin;
          }
          page.drawText(line, { x: margin, y, size: 11, font, color: INK });
          y -= 15;
        }
        y -= 8;
      }
      if (section.table) {
        const cols = section.table.headers;
        const colW = (width - 2 * margin) / cols.length;
        page.drawText(cols.join("  |  "), { x: margin, y, size: 8, font: bold, color: INK });
        y -= 14;
        for (const row of section.table.rows) {
          if (y < 80) {
            page = newPage();
            y = height - margin;
          }
          row.forEach((cell, i) => {
            page.drawText(String(cell).slice(0, 22), { x: margin + i * colW, y, size: 8, font, color: INK });
          });
          y -= 12;
        }
      }
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }
}

export function getPdfProvider(): PdfProvider {
  // A remote PDF provider could be selected here via env; the local renderer is
  // the always-available default and documented fallback.
  return new LocalPdfProvider();
}
