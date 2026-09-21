// pdfjs-dist on Node requires the browser DOM geometry/canvas globals that
// @napi-rs/canvas provides. Must be imported before pdf-parse / pdfjs-dist
// so their module-level code can access DOMMatrix(), ImageData(), Path2D().
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

const g = globalThis as Record<string, unknown>;
if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = DOMMatrix;
if (typeof g.ImageData === "undefined") g.ImageData = ImageData;
if (typeof g.Path2D === "undefined") g.Path2D = Path2D;

export const pdfPolyfillsInstalled = true;