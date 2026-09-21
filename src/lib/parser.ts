import "server-only";
import "@/lib/pdf-polyfill";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

let workerWired = false;

/**
 * pdfjs-dist's fake-worker path `import()`s its worker bundle. Under Turbopack
 * that dynamic import is rewritten to a virtual module id that is never
 * emitted, so we hand pdfjs a self-contained data-URL module instead — Node's
 * native `import(dataUrl)` runs it directly on the main thread.
 */
function wirePdfWorker() {
  if (workerWired) return;
  workerWired = true;
  try {
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    const encoded = readFileSync(workerPath).toString("base64");
    GlobalWorkerOptions.workerSrc = `data:text/javascript;base64,${encoded}`;
    GlobalWorkerOptions.workerPort = null;
  } catch {
    // fall back to pdf-parse's default worker wiring
  }
}

export class UnsupportedPdfError extends Error {
  code = "UNSUPPORTED_PDF" as const;
}

export class ScannedPdfError extends Error {
  code = "NEEDS_OCR" as const;
}

export interface ParsedPdf {
  text: string;
  pages: number;
  needsOcr: boolean;
}

/**
 * Extracts plain text from a PDF buffer. Heuristically flags scanned PDFs
 * (minimal extractable text) so the pipeline can surface an OCR hint instead
 * of silently producing an empty syllabus. Chunks very large documents to the
 * first ~60 pages to keep parsing bounded.
 */
export async function extractPdfText(buffer: Buffer): Promise<ParsedPdf> {
  wirePdfWorker();
  try {
    // `last` here is an inclusive end page for `getText()` page selection.
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ first: 1, last: 60 });
      const text = result.text ?? "";
      const pages = result.pages?.length ?? 0;
      const needsOcr = text.replace(/\s/g, "").length < 120;
      return { text: text.slice(0, 200_000), pages, needsOcr };
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    if (
      err &&
      err instanceof Error &&
      (err.message.includes("Invalid PDF") ||
        err.message.includes("not from StandardFontDictionary") ||
        err.message.includes("Invalid file"))
    ) {
      throw new UnsupportedPdfError(err.message);
    }
    throw err;
  }
}