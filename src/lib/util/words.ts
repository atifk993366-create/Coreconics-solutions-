const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const below100 = (n: number) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? "-" + ones[n % 10] : "");
const below1000 = (n: number) => (n >= 100 ? ones[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? below100(n % 100) : "");
/** Indian numbering: 1200 -> "One thousand two hundred rupees only" */
export function rupeesInWords(amount: number): string {
  const total = Math.round(Math.abs(amount) * 100); let rupees = Math.floor(total / 100); const paise = total % 100;
  if (rupees === 0 && paise === 0) return "Zero rupees only";
  const parts: string[] = []; const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5; const th = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(below1000(crore) + " crore"); if (lakh) parts.push(below100(lakh) + " lakh"); if (th) parts.push(below100(th) + " thousand"); if (rupees) parts.push(below1000(rupees));
  let s = parts.join(" ") || "zero"; s += " rupees"; if (paise) s += " and " + below100(paise) + " paise"; s += " only";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
