import { exists, writeFile } from "@tauri-apps/plugin-fs";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { downloadDir, join } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";

type ExportPdfOptions = {
  element: HTMLElement;
  title: string;
};

type ExportMermaidOptions = {
  svgElement: SVGSVGElement;
  defaultFileName: string;
};

type ExportResult = {
  cancelled: boolean;
  path?: string;
};

const EXPORT_LOG_PREFIX = "[pdf-export]";
const EXPORT_STYLE_ID = "miaoyan-export-style";
const EXPORT_TITLE_CLASS = "export-generated-title";

const logInfo = (step: string, payload?: unknown) => {
  if (payload === undefined) {
    console.info(`${EXPORT_LOG_PREFIX} ${step}`);
    return;
  }
  console.info(`${EXPORT_LOG_PREFIX} ${step}`, payload);
};

const logDebug = (step: string, payload?: unknown) => {
  if (payload === undefined) {
    console.log(`${EXPORT_LOG_PREFIX} ${step}`);
    return;
  }
  console.log(`${EXPORT_LOG_PREFIX} ${step}`, payload);
};

const logError = (step: string, error: unknown, payload?: unknown) => {
  console.error(`${EXPORT_LOG_PREFIX} ${step}`, {
    payload,
    error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
};

const clampFileName = (value: string, fallback: string) => {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "");
  return cleaned || fallback;
};

const buildDefaultName = (name: string, extension: string) => {
  const suffix = `.${extension}`;
  if (name.toLowerCase().endsWith(suffix)) return name;
  return `${name}${suffix}`;
};

const toTimestamp = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const injectExportStyle = () => {
  const previous = document.getElementById(EXPORT_STYLE_ID);
  previous?.remove();

  const style = document.createElement("style");
  style.id = EXPORT_STYLE_ID;
  style.textContent = `
    .pdf-export-content {
      padding: 28px 32px !important;
    }
    .pdf-export-content .toc,
    .pdf-export-content .table-of-contents,
    .pdf-export-content [data-toc="true"] {
      display: none !important;
    }
    .${EXPORT_TITLE_CLASS} {
      margin: 0 0 20px 0;
      font-size: 30px;
      font-weight: 700;
      line-height: 1.25;
      letter-spacing: -0.01em;
      color: var(--foreground);
      word-break: break-word;
    }
  `;
  document.head.appendChild(style);
  return style;
};

const waitForImagesLoaded = async (element: HTMLElement) => {
  const images = Array.from(element.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  }));
};

const insertExportTitle = (element: HTMLElement, title: string) => {
  const cleaned = title.trim();
  if (!cleaned) return null;
  const heading = document.createElement("h1");
  heading.className = EXPORT_TITLE_CLASS;
  heading.textContent = cleaned;
  element.prepend(heading);
  return heading;
};

const cleanupExportArtifacts = (styleNode?: HTMLElement | null, titleNode?: HTMLElement | null) => {
  titleNode?.remove();
  styleNode?.remove();
};

const resolvePdfTargetPath = async (title: string) => {
  const root = await downloadDir();
  const base = clampFileName(title || "Untitled", "Untitled");
  const preferredName = buildDefaultName(base, "pdf");
  let candidate = await join(root, preferredName);

  if (!(await exists(candidate))) {
    return candidate;
  }

  const withTimestamp = buildDefaultName(`${base}-${toTimestamp()}`, "pdf");
  candidate = await join(root, withTimestamp);
  return candidate;
};

const normalizeDialogPath = (target: string) => {
  // Some platforms may return a file:// URI from dialog plugin.
  if (target.startsWith("file://")) {
    try {
      return decodeURIComponent(target.replace(/^file:\/\//, ""));
    } catch {
      return target.replace(/^file:\/\//, "");
    }
  }
  return target;
};

const dataUrlToBytes = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Invalid data URL.");
  }
  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const replaceFileExt = (path: string, nextExt: string) => {
  const normalizedExt = nextExt.startsWith(".") ? nextExt : `.${nextExt}`;
  const index = path.lastIndexOf(".");
  if (index <= path.lastIndexOf("/") || index <= path.lastIndexOf("\\")) {
    return `${path}${normalizedExt}`;
  }
  return `${path.slice(0, index)}${normalizedExt}`;
};

const waitForRenderStable = async () => {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => setTimeout(resolve, 140));
};

const ensureMermaidRendered = async (element: HTMLElement) => {
  const hasMermaid = element.querySelector(".mermaid-container");
  if (!hasMermaid) return;

  const maxWait = 1500;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const pendingSvg = element.querySelector(".mermaid-container svg");
    if (pendingSvg) return;
    // Keep waiting until Mermaid has mounted its SVG.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
};

export const exportMarkdownToPdf = async ({ element, title }: ExportPdfOptions): Promise<ExportResult> => {
  logDebug("pdf:start", { title });
  logInfo("start", {
    exportTitle: title,
    pageTitle: document.title,
  });

  const targetPath = normalizeDialogPath(await resolvePdfTargetPath(title));
  logDebug("pdf:target-path", { targetPath });
  logInfo("target-path-ready", { targetPath });

  const root = document.documentElement;
  root.setAttribute("data-export-pdf", "true");
  logInfo("flag-set", { attr: "data-export-pdf" });

  const styleNode = injectExportStyle();
  logInfo("export-style-injected", { id: EXPORT_STYLE_ID });
  const titleNode = insertExportTitle(element, title);
  logInfo("export-title-inserted", { inserted: Boolean(titleNode) });

  try {
    element.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    logInfo("scrolled-top");

    await waitForRenderStable();
    await ensureMermaidRendered(element);
    await waitForImagesLoaded(element);
    logInfo("images-ready");

    const rect = element.getBoundingClientRect();
    const widthPx = Math.max(1, Math.ceil(rect.width));
    const heightPx = Math.max(1, Math.ceil(element.scrollHeight));
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#ffffff";
    logInfo("render-metrics", {
      widthPx,
      heightPx,
      backgroundColor,
      devicePixelRatio: window.devicePixelRatio,
    });

    const dataUrl = await toPng(element, {
      pixelRatio: 3,
      cacheBust: true,
      width: widthPx,
      height: heightPx,
      backgroundColor,
    });
    logDebug("pdf:snapshot-ready", { dataUrlLength: dataUrl.length });
    logInfo("snapshot-ready", { dataUrlLength: dataUrl.length });

    const pointsPerPx = 72 / 96;
    const pageWidthPt = widthPx * pointsPerPx;
    const pageHeightPt = heightPx * pointsPerPx;
    const pdf = new jsPDF({
      orientation: pageWidthPt >= pageHeightPt ? "landscape" : "portrait",
      unit: "pt",
      format: [pageWidthPt, pageHeightPt],
      compress: true,
    });
    logInfo("pdf-doc-created", {
      pageWidthPt,
      pageHeightPt,
      orientation: pageWidthPt >= pageHeightPt ? "landscape" : "portrait",
    });

    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidthPt, pageHeightPt, undefined, "FAST");
    const buffer = pdf.output("arraybuffer");
    const bytes = new Uint8Array(buffer);
    logDebug("pdf:bytes-ready", { byteLength: bytes.byteLength });
    logInfo("pdf-buffer-ready", { byteLength: bytes.byteLength });

    logDebug("pdf:write-start", { targetPath });
    await writeFile(targetPath, bytes);
    logDebug("pdf:write-done", { targetPath, byteLength: bytes.byteLength });
    logInfo("write-file-done", { targetPath, byteLength: bytes.byteLength });

    try {
      const fileExists = await exists(targetPath);
      logDebug("pdf:exists-check", { targetPath, fileExists });
      logInfo("post-write-exists", { targetPath, fileExists });
    } catch (existsError) {
      logError("post-write-exists-failed", existsError, { targetPath });
    }

    logDebug("pdf:success", { targetPath });
    return { cancelled: false, path: targetPath };
  } catch (error) {
    logDebug("pdf:failed", {
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    });
    logError("failed", error, { targetPath });
    throw error;
  } finally {
    cleanupExportArtifacts(styleNode, titleNode);
    logInfo("export-artifacts-cleaned");
    root.removeAttribute("data-export-pdf");
    logInfo("flag-cleared", { attr: "data-export-pdf" });
  }
};

export const exportMermaidSvgToPng = async ({ svgElement, defaultFileName }: ExportMermaidOptions): Promise<ExportResult> => {
  logDebug("mermaid:start", { defaultFileName });
  logInfo("mermaid-start", { defaultFileName });
  const safeName = buildDefaultName(clampFileName(defaultFileName, "diagram"), "png");
  const target = await save({
    title: "导出 Mermaid 图片",
    defaultPath: safeName,
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  logInfo("mermaid-save-dialog-result", { target, targetType: typeof target });

  if (!target) return { cancelled: true };
  if (typeof target !== "string") {
    throw new Error(`Unexpected save path type: ${typeof target}`);
  }
  const targetPath = normalizeDialogPath(target);
  logDebug("mermaid:target-path", { targetPath });
  logInfo("mermaid-target-normalized", { targetPath });

  const viewBox = svgElement.viewBox.baseVal;
  const width = Math.max(1, Math.round(viewBox?.width || svgElement.clientWidth || 1024));
  const height = Math.max(1, Math.round(viewBox?.height || svgElement.clientHeight || 768));
  const scale = 4;
  logInfo("mermaid-metrics", { width, height, scale });

  const serialized = new XMLSerializer().serializeToString(svgElement);

  try {
    try {
      const dataUrl = await toPng(svgElement as unknown as HTMLElement, {
        pixelRatio: scale,
        cacheBust: true,
        width,
        height,
        backgroundColor: "transparent",
      });
      logDebug("mermaid:png-dataurl-ready", { dataUrlLength: dataUrl.length });

      const pngBytes = dataUrlToBytes(dataUrl);
      logDebug("mermaid:bytes-ready", { byteLength: pngBytes.byteLength });
      logInfo("mermaid-bytes-ready", { byteLength: pngBytes.byteLength });
      logDebug("mermaid:write-start", { targetPath });
      await writeFile(targetPath, pngBytes);
      logDebug("mermaid:write-done", { targetPath, byteLength: pngBytes.byteLength });
      logInfo("mermaid-write-file-done", { targetPath, byteLength: pngBytes.byteLength });
    } catch (pngError) {
      logDebug("mermaid:png-failed-fallback-svg", {
        targetPath,
        error: pngError instanceof Error ? pngError.message : String(pngError),
      });

      const svgPath = replaceFileExt(targetPath, ".svg");
      const svgBytes = new TextEncoder().encode(serialized);
      logDebug("mermaid:svg-bytes-ready", { byteLength: svgBytes.byteLength, svgPath });
      await writeFile(svgPath, svgBytes);
      logDebug("mermaid:svg-write-done", { svgPath, byteLength: svgBytes.byteLength });

      try {
        const svgExists = await exists(svgPath);
        logDebug("mermaid:svg-exists-check", { svgPath, svgExists });
      } catch (existsError) {
        logError("mermaid-svg-exists-failed", existsError, { svgPath });
      }

      logDebug("mermaid:success-fallback-svg", { svgPath });
      return { cancelled: false, path: svgPath };
    }

    try {
      const fileExists = await exists(targetPath);
      logDebug("mermaid:exists-check", { targetPath, fileExists });
      logInfo("mermaid-post-write-exists", { targetPath, fileExists });
    } catch (existsError) {
      logError("mermaid-post-write-exists-failed", existsError, { targetPath });
    }

    logDebug("mermaid:success", { targetPath });
    return { cancelled: false, path: targetPath };
  } catch (error) {
    logDebug("mermaid:failed", {
      targetPath,
      error: error instanceof Error ? error.message : String(error),
    });
    logError("mermaid-failed", error, { targetPath });
    throw error;
  }
};
