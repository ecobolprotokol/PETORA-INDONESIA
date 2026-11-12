const CODE39_PATTERNS: Record<string, string> = {
  "0": "000110100",
  "1": "100100001",
  "2": "001100001",
  "3": "101100000",
  "4": "000110001",
  "5": "100110000",
  "6": "001110000",
  "7": "000100101",
  "8": "100100100",
  "9": "001100100",
  A: "100001001",
  B: "001001001",
  C: "101001000",
  D: "000011001",
  E: "100011000",
  F: "001011000",
  G: "000001101",
  H: "100001100",
  I: "001001100",
  J: "000011100",
  K: "100000011",
  L: "001000011",
  M: "101000010",
  N: "000010011",
  O: "100010010",
  P: "001010010",
  Q: "000000111",
  R: "100000110",
  S: "001000110",
  T: "000010110",
  U: "110000001",
  V: "011000001",
  W: "111000000",
  X: "010010001",
  Y: "110010000",
  Z: "011010000",
  "-": "010000101",
  ".": "110000100",
  " ": "011000100",
  $: "010101000",
  "/": "010100010",
  "+": "010001010",
  "%": "000101010",
  "*": "010010100",
};
const MAX_LABEL_MODULES = 230;

function fullAsciiSymbols(value: string) {
  let encoded = "";
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code > 127) return null;
    if (code === 0) encoded += "%U";
    else if (code <= 26) encoded += `$${String.fromCharCode(64 + code)}`;
    else if (code <= 31) encoded += `%${String.fromCharCode(65 + code - 27)}`;
    else if (code <= 44) encoded += `/${String.fromCharCode(65 + code - 33)}`;
    else if (code === 45) encoded += "-";
    else if (code === 46) encoded += ".";
    else if (code === 47) encoded += "/O";
    else if (code <= 57) encoded += character;
    else if (code === 58) encoded += "/Z";
    else if (code <= 63) encoded += `%${String.fromCharCode(65 + code - 59 + 5)}`;
    else if (code === 64) encoded += "%V";
    else if (code <= 90) encoded += character;
    else if (code <= 95) encoded += `%${String.fromCharCode(65 + code - 91 + 10)}`;
    else if (code === 96) encoded += "%W";
    else if (code <= 122) encoded += `+${String.fromCharCode(code - 32)}`;
    else encoded += `%${String.fromCharCode(65 + code - 123 + 15)}`;
  }
  return encoded;
}

export function code39Modules(value: string): boolean[] | null {
  const encoded = fullAsciiSymbols(value);
  if (encoded === null) return null;
  const symbols = `*${encoded}*`;
  const modules: boolean[] = [];
  for (const [symbolIndex, symbol] of [...symbols].entries()) {
    const pattern = CODE39_PATTERNS[symbol];
    if (!pattern) return null;
    for (const [index, width] of [...pattern].entries()) {
      const wide = width === "1";
      const isBar = index % 2 === 0;
      modules.push(...Array.from({ length: wide ? 3 : 1 }, () => isBar));
    }
    if (symbolIndex !== symbols.length - 1) modules.push(false);
  }
  return modules.length + 20 <= MAX_LABEL_MODULES ? modules : null;
}
