export type CsvColumn<Row> = {
  label: string;
  value: (row: Row) => string | number | boolean | null | undefined;
};

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((column) => {
          const raw = column.value(row);
          const text = raw === null || raw === undefined ? "" : String(raw);
          return escapeCsvCell(text);
        })
        .join(","),
    )
    .join("\n");

  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csvText: string) {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadRowsAsCsv<Row>(filename: string, rows: Row[], columns: CsvColumn<Row>[]) {
  downloadCsv(filename, toCsv(rows, columns));
}
