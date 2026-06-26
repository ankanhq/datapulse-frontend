// Renders the current chart to a clean, slide-ready PNG on a WHITE background.
//
// The on-screen chart uses the app's dark theme, which looks wrong dropped into
// a slide deck or document. So instead of screenshotting the live canvas, we
// re-render the same Chart.js config off-screen with a light theme at a high
// pixel density, then composite a title and a subtle caption around it.

import { Chart } from "chart.js/auto";

export const CAPTION = "datapulse-frontend.vercel.app";

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Light-theme Chart.js options so the export reads well on white. Font sizes are
// the *base* sizes; renderChartToCanvas scales them up for the hi-res canvas.
function tickLimit(labelCount) {
  if (labelCount <= 8) return Math.max(labelCount, 2);
  if (labelCount <= 24) return 8;
  if (labelCount <= 80) return 7;
  return 6;
}

function lightOptions(type, labelCount = 0) {
  const text = "#1e293b"; // slate-800
  const sub = "#475569"; // slate-600
  const grid = "rgba(15,23,42,0.08)";

  const base = {
    responsive: false,
    maintainAspectRatio: false,
    animation: false,
    devicePixelRatio: 1,
    plugins: { legend: { labels: { color: text, font: { size: 13 } } } },
  };

  if (type === "doughnut") {
    base.plugins.legend.position = "bottom";
    return base;
  }

  base.scales = {
    x: {
      ticks: {
        autoSkip: true,
        color: sub,
        font: { size: labelCount > 40 ? 11 : 12 },
        maxRotation: 0,
        maxTicksLimit: tickLimit(labelCount),
        minRotation: 0,
      },
      grid: { color: grid },
    },
    y: { ticks: { color: sub, font: { size: 12 } }, grid: { color: grid } },
  };
  return base;
}

function dateFormatter(labels) {
  const dates = labels
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (dates.length < 2) return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" });

  const spanDays = (dates[dates.length - 1] - dates[0]) / 86_400_000;
  if (spanDays > 370) return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
  if (spanDays > 45) return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" });
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" });
}

function compactDateLabel(value, formatter) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return formatter.format(d);
}

function formatLabelsForExport(data, labelFormat) {
  if (labelFormat !== "date") return data;
  const formatter = dateFormatter(data.labels);
  return {
    ...data,
    labels: data.labels.map((label) => compactDateLabel(label, formatter)),
  };
}

function scaleFonts(opts, scale) {
  const legendFont = opts.plugins?.legend?.labels?.font;
  if (legendFont?.size) legendFont.size *= scale;
  for (const axis of Object.values(opts.scales || {})) {
    if (axis.ticks?.font?.size) axis.ticks.font.size *= scale;
  }
}

// The on-screen datasets use dark-theme accents (e.g. a near-black doughnut
// border that vanishes on white). Tweak a deep copy for the light export.
function recolorForLight(type, data, scale) {
  const clone = JSON.parse(JSON.stringify(data)); // datasets hold only primitives
  clone.datasets = clone.datasets.map((ds) => {
    const out = { ...ds };
    if (type === "doughnut") {
      out.borderColor = "#ffffff";
      out.borderWidth = 2 * scale;
    }
    if (type === "line") out.borderWidth = 2.5 * scale;
    return out;
  });
  return clone;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Render a chart config onto a white-background canvas with an optional title
 * and a corner caption. Returns the composited HTMLCanvasElement.
 */
export async function renderChartToCanvas({
  type,
  data,
  title,
  labelFormat,
  scale = 2,
  width = 880,
  height = 460,
}) {
  const pad = 28 * scale;
  const titleH = title ? 50 * scale : 18 * scale;
  const captionH = 30 * scale;
  const chartW = width * scale;
  const chartH = height * scale;

  const W = chartW + pad * 2;
  const H = titleH + chartH + captionH + pad;

  // 1. Render the chart itself to its own off-screen canvas.
  const chartCanvas = document.createElement("canvas");
  chartCanvas.width = chartW;
  chartCanvas.height = chartH;

  const exportData = formatLabelsForExport(data, labelFormat);
  const opts = lightOptions(type, exportData.labels?.length || 0);
  scaleFonts(opts, scale);

  const chart = new Chart(chartCanvas.getContext("2d"), {
    type,
    data: recolorForLight(type, exportData, scale),
    options: opts,
  });
  // animation:false renders synchronously, but wait a frame to be safe.
  await nextFrame();

  // 2. Composite onto the final white canvas.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  if (title) {
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.font = `600 ${22 * scale}px ${FONT_STACK}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, pad, pad + (titleH - pad) / 2);
  }

  ctx.drawImage(chartCanvas, pad, titleH, chartW, chartH);

  ctx.fillStyle = "#94a3b8"; // slate-400 — subtle
  ctx.font = `${12 * scale}px ${FONT_STACK}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(CAPTION, W - pad, titleH + chartH + captionH / 2);

  chart.destroy();
  return out;
}

function safeName(s) {
  return (s || "chart").trim().replace(/[^\w.-]+/g, "_").slice(0, 80) || "chart";
}

function triggerDownload(href, filename, revoke) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 0);
}

/** Download the current chart as a high-resolution PNG. */
export async function downloadChartPng(config) {
  const canvas = await renderChartToCanvas(config);
  triggerDownload(canvas.toDataURL("image/png"), `${safeName(config.title)}.png`);
}

const toBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

/**
 * Copy the chart image to the clipboard so it can be pasted straight into
 * slides / docs. Falls back to a download if the browser blocks clipboard
 * writes. Returns "copied" or "downloaded".
 */
export async function copyChartToClipboard(config) {
  const canvas = await renderChartToCanvas(config);
  const blob = await toBlob(canvas);
  if (!blob) throw new Error("Could not render chart image");

  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error("Clipboard image API unavailable");
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    triggerDownload(URL.createObjectURL(blob), `${safeName(config.title)}.png`, true);
    return "downloaded";
  }
}
