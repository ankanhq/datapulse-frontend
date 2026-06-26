// Builds a clean, presentation-ready ONE-PAGE PDF on a white background:
// dataset name + date, the key summary stats, and the current chart. Entirely
// client-side (jsPDF + the chart canvas), so it needs no backend support.

import { renderChartToCanvas, CAPTION } from "./chartExport";

const SLATE_900 = [15, 23, 42];
const SLATE_600 = [71, 85, 105];
const SLATE_400 = [148, 163, 184];
const PULSE = [26, 133, 255];
const BORDER = [226, 232, 240];

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

// One-line description of a column, matching the on-screen summary panel.
function colStat(col) {
  if (col.type === "number") {
    return `min ${fmt(col.min)}  ·  max ${fmt(col.max)}  ·  avg ${fmt(col.avg)}`;
  }
  // ASCII "to" rather than "→": jsPDF's standard Helvetica can't encode the
  // arrow, which knocks the whole line onto a broken per-glyph layout path.
  if (col.type === "date") return `${fmt(col.min)} to ${fmt(col.max)}`;
  return `${fmt(col.distinct)} distinct values`;
}

const today = () =>
  new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/**
 * Generate and download a one-page PDF report.
 * @param {object} args
 * @param {string} args.datasetName
 * @param {object} args.summary  { total_rows, total_columns, columns }
 * @param {object} args.chartConfig  { type, data, title }
 */
export async function downloadReport({ datasetName, summary, chartConfig }) {
  // Lazily loaded so jsPDF (and its html2canvas dep) stay out of the main bundle.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ---- Header: title + dataset name (left), date (right) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...SLATE_900);
  doc.text("DataPulse Report", margin, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_600);
  doc.text(today(), pageW - margin, y + 4, { align: "right" });

  y += 24;
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_600);
  doc.text(doc.splitTextToSize(datasetName, contentW)[0], margin, y);

  y += 16;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 22;

  // ---- Stat cards: total rows, columns, numeric columns ----
  const numericCount = summary.columns.filter((c) => c.type === "number").length;
  const cards = [
    ["Total rows", fmt(summary.total_rows)],
    ["Columns", fmt(summary.total_columns)],
    ["Numeric columns", fmt(numericCount)],
  ];
  const gap = 12;
  const cardW = (contentW - gap * (cards.length - 1)) / cards.length;
  const cardH = 54;
  cards.forEach(([label, value], i) => {
    const x = margin + i * (cardW + gap);
    doc.setDrawColor(...BORDER);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(x, y, cardW, cardH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_400);
    doc.text(label.toUpperCase(), x + 12, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...SLATE_900);
    doc.text(value, x + 12, y + 42);
  });
  y += cardH + 24;

  // The chart follows the column list, but never lower than maxChartTop, so it
  // always fits on the single page regardless of how many columns there are.
  const chartTargetW = contentW;
  const chartTargetH = 218;
  const captionH = 16;
  const maxChartTop = pageH - margin - chartTargetH - captionH;

  // ---- Columns section (capped so everything stays on one page) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_900);
  doc.text("Columns", margin, y);
  y += 16;

  const lineH = 16;
  const available = maxChartTop - 14 - y;
  const maxRows = Math.max(0, Math.floor(available / lineH));
  const shown = summary.columns.slice(0, maxRows);

  shown.forEach((col) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PULSE);
    doc.text(col.type.toUpperCase(), margin, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_900);
    const name = doc.splitTextToSize(col.name, 150)[0];
    doc.text(name, margin + 42, y + 8);

    doc.setTextColor(...SLATE_600);
    doc.text(colStat(col), margin + 200, y + 8, { align: "left" });
    y += lineH;
  });

  const hidden = summary.columns.length - shown.length;
  if (hidden > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_400);
    doc.text(`… and ${hidden} more column${hidden === 1 ? "" : "s"}`, margin, y + 8);
    y += lineH;
  }

  const chartY = Math.min(y + 20, maxChartTop);

  // ---- Chart (rendered on white at high res, then placed) ----
  const canvas = await renderChartToCanvas({
    ...chartConfig,
    title: undefined, // the PDF supplies its own heading; keep the image clean
    width: 880,
    height: Math.round((880 * chartTargetH) / chartTargetW),
  });
  const imgRatio = canvas.height / canvas.width;
  const drawH = chartTargetW * imgRatio;
  doc.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    margin,
    chartY,
    chartTargetW,
    drawH,
    undefined,
    "FAST"
  );

  // ---- Footer caption ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_400);
  doc.text(CAPTION, pageW - margin, pageH - 18, { align: "right" });

  const file =
    (datasetName || "datapulse")
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80) || "datapulse";
  doc.save(`${file}_report.pdf`);
}
