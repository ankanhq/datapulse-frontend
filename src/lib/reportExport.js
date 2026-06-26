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

function prettyName(name) {
  return String(name || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function compactDateLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(d);
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function buildInsights(summary, chartConfig) {
  const meta = chartConfig.meta || {};
  const points = meta.points || [];
  const insights = [`${fmt(summary.total_rows)} rows across ${fmt(summary.total_columns)} columns are included in this report.`];
  const col = summary.columns.find((c) => c.name === meta.column);

  if (meta.chartType === "category_counts" && points.length) {
    const top = points.reduce((best, p) => ((p.count || 0) > (best.count || 0) ? p : best), points[0]);
    const total = points.reduce((sum, p) => sum + (Number(p.count) || 0), 0);
    const share = total ? `, representing ${pct((Number(top.count) || 0) / total)} of charted rows` : "";
    insights.push(`${top.label} contributes the largest ${prettyName(meta.column)} share${share}.`);
  } else if (meta.chartType === "numeric_histogram" && col) {
    insights.push(`${prettyName(meta.column)} ranges from ${fmt(col.min)} to ${fmt(col.max)}, with an average of ${fmt(col.avg)}.`);
  } else if (meta.chartType === "time_series" && points.length) {
    const values = points.map((p) => Number(p.value)).filter(Number.isFinite);
    if (values.length) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const peak = points.reduce((best, p) => (Number(p.value) > Number(best.value) ? p : best), points[0]);
      const series = meta.agg === "count" ? "Count" : chartConfig.data?.datasets?.[0]?.label || "Value";
      const spread = avg ? (max - min) / avg : 0;
      if (spread <= 0.1) {
        insights.push(`${series} remains relatively stable across the selected period.`);
      } else if (spread >= 0.25) {
        insights.push(`${series} varies significantly across the selected period.`);
      } else {
        insights.push(`${series} reaches its highest point around ${compactDateLabel(peak.time)}.`);
      }
    }
  }

  const numericCount = summary.columns.filter((c) => c.type === "number").length;
  if (insights.length < 3 && numericCount) {
    insights.push(`${numericCount} numeric column${numericCount === 1 ? "" : "s"} can support trend or distribution analysis.`);
  }
  return insights.slice(0, 3);
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
  const chartTargetH = 178;
  const chartHeadingH = 18;
  const insightsH = 66;
  const captionH = 16;
  const maxChartTop = pageH - margin - chartHeadingH - chartTargetH - captionH;

  // ---- Columns section (capped so everything stays on one page) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_900);
  doc.text("Columns", margin, y);
  y += 16;

  const lineH = 16;
  const available = maxChartTop - insightsH - 22 - y;
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

  const insights = buildInsights(summary, chartConfig);
  const insightsY = Math.min(y + 14, maxChartTop - insightsH - 8);

  doc.setDrawColor(...BORDER);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, insightsY, contentW, insightsH, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_900);
  doc.text("Key Insights", margin + 12, insightsY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_600);
  insights.forEach((line, i) => {
    doc.text(`• ${doc.splitTextToSize(line, contentW - 34)[0]}`, margin + 14, insightsY + 34 + i * 13);
  });

  const chartY = Math.min(insightsY + insightsH + 18, maxChartTop);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_900);
  const chartTitle = doc.splitTextToSize(chartConfig.title || "Current chart", contentW)[0];
  doc.text(chartTitle, margin, chartY);

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
    chartY + chartHeadingH,
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
