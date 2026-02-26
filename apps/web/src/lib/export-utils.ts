export type CsvColumn<Row> = {
  label: string;
  value: (row: Row) => string | number | boolean | null | undefined;
};

export type ExportFormat = "csv" | "excel" | "pdf";

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeFilename(base: string, extension: string) {
  const safeBase = base.trim().replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "export";
  return `${safeBase}.${extension}`;
}

function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const text = normalizeCellValue(column.value(row));
          return escapeCsvCell(text);
        })
        .join(","),
    )
    .join("\n");

  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename, blob);
}

export function downloadRowsAsCsv<Row>(filenameBase: string, rows: Row[], columns: CsvColumn<Row>[]) {
  downloadCsv(normalizeFilename(filenameBase, "csv"), toCsv(rows, columns));
}

export function downloadRowsAsExcel<Row>(filenameBase: string, rows: Row[], columns: CsvColumn<Row>[]) {
  const headers = columns.map((column) => `<th>${column.label}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = normalizeCellValue(column.value(row)).replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `<td>${value}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const table = `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
  const blob = new Blob([table], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(normalizeFilename(filenameBase, "xls"), blob);
}

export async function downloadRowsAsPdf<Row>(filenameBase: string, rows: Row[], columns: CsvColumn<Row>[], title?: string) {
  if (typeof window === "undefined") return;

  const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new JsPdf({ orientation: "landscape", unit: "pt", format: "a4" });

  const headers = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => normalizeCellValue(column.value(row))));

  if (title?.trim()) {
    document.setFontSize(12);
    document.text(title.trim(), 40, 32);
  }

  autoTable(document, {
    startY: title?.trim() ? 44 : 24,
    head: [headers],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
  });

  document.save(normalizeFilename(filenameBase, "pdf"));
}

export async function downloadRows<Row>(
  format: ExportFormat,
  filenameBase: string,
  rows: Row[],
  columns: CsvColumn<Row>[],
  title?: string,
) {
  if (format === "csv") {
    downloadRowsAsCsv(filenameBase, rows, columns);
    return;
  }

  if (format === "excel") {
    downloadRowsAsExcel(filenameBase, rows, columns);
    return;
  }

  await downloadRowsAsPdf(filenameBase, rows, columns, title);
}
