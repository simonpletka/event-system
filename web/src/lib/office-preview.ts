import ExcelJS from "exceljs";
import mammoth from "mammoth";

const MAX_ROWS = 500;
const MAX_COLUMNS = 50;

const STYLE = `
  body { margin: 0; padding: 32px; background: #fff; color: #1a1918; font: 14px/1.5 system-ui, sans-serif; }
  img { max-width: 100%; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  h2:first-child { margin-top: 0; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #d5d3d1; padding: 4px 8px; vertical-align: top; white-space: pre-wrap; }
  .sheet td { white-space: nowrap; }
  .note { color: #6b6967; font-size: 12px; }
`;

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${body}</body></html>`;
}

export async function wordToHtml(buffer: Buffer) {
  const { value } = await mammoth.convertToHtml({ buffer });
  return page(value);
}

export async function sheetToHtml(buffer: Buffer, truncatedNote: (rows: number) => string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sections = workbook.worksheets.map((sheet) => {
    const rows: string[] = [];
    const columns = Math.min(sheet.columnCount, MAX_COLUMNS);
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) return;
      const cells = Array.from({ length: columns }, (_, i) => `<td>${escapeHtml(row.getCell(i + 1).text ?? "")}</td>`);
      rows.push(`<tr>${cells.join("")}</tr>`);
    });
    const note = sheet.rowCount > MAX_ROWS ? `<p class="note">${escapeHtml(truncatedNote(MAX_ROWS))}</p>` : "";
    return `<h2>${escapeHtml(sheet.name)}</h2><table class="sheet">${rows.join("")}</table>${note}`;
  });
  return page(sections.join(""));
}
