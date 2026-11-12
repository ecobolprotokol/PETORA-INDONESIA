export class CsvFormatError extends Error {}

export function parseCsv(
  input: string,
  limits: { maxRows: number; maxColumns: number; maxCellLength: number },
): string[][] {
  input = input.replace(/^\uFEFF/u, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  function pushCell() {
    if (cell.length > limits.maxCellLength) {
      throw new CsvFormatError("Nilai pada CSV melebihi panjang yang diizinkan.");
    }
    row.push(cell);
    cell = "";
    closedQuote = false;
    if (row.length > limits.maxColumns) {
      throw new CsvFormatError("CSV memiliki terlalu banyak kolom.");
    }
  }

  function pushRow() {
    pushCell();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
      if (rows.length > limits.maxRows + 1) {
        throw new CsvFormatError("CSV memiliki terlalu banyak baris.");
      }
    }
    row = [];
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\n" && character !== "\r") {
      throw new CsvFormatError("Format tanda kutip CSV tidak valid.");
    }
    if (character === '"' && cell.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === ",") {
      pushCell();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      pushRow();
    } else {
      cell += character;
    }
  }
  if (quoted) {
    throw new CsvFormatError("CSV berisi tanda kutip yang belum ditutup.");
  }
  if (cell.length || row.length || closedQuote) {
    pushRow();
  }
  return rows;
}

export function encodeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const escaped = value.replaceAll('"', '""');
          return /[",\r\n]/u.test(value) ? `"${escaped}"` : escaped;
        })
        .join(","),
    )
    .join("\r\n");
}
