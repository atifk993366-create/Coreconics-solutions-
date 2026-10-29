// Safe formula engine — NO eval / Function. Parses a tiny expression language into an AST
// and evaluates it against a variable map. Used for every medical calculation (builtin + AI-written).
export type Val = number | string | boolean | null;
export type Node =
  | { t: "num"; v: number } | { t: "str"; v: string } | { t: "var"; n: string }
  | { t: "un"; op: "-" | "!"; a: Node } | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "call"; f: string; args: Node[] };

export class ExprError extends Error {}
export class MissingVar extends Error { constructor(public name: string) { super(`Missing value: ${name}`) } }

const MAX_LEN = 600, MAX_NODES = 250, MAX_DEPTH = 40;

function normalize(src: string): string {
  return src.replace(/×|✕|✖/g, "*").replace(/÷/g, "/").replace(/[−–—]/g, "-").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=").replace(/\band\b/gi, "&&").replace(/\bor\b/gi, "||").replace(/,(?=\d{3}\b)/g, "").trim();
}

interface Tok { k: "num" | "str" | "id" | "op" | "eof"; v: string }
function lex(s: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; if (s[j] === "e" || s[j] === "E") { if (/[0-9+\-]/.test(s[j + 1] ?? "")) { j += 2; while (j < s.length && /[0-9]/.test(s[j])) j++; } } out.push({ k: "num", v: s.slice(i, j) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; out.push({ k: "id", v: s.slice(i, j) }); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c) j++; if (j >= s.length) throw new ExprError("Unterminated string"); out.push({ k: "str", v: s.slice(i + 1, j) }); i = j + 1; continue; }
    const two = s.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) { out.push({ k: "op", v: two }); i += 2; continue; }
    if ("+-*/^()<>!,=".includes(c)) { out.push({ k: "op", v: c === "=" ? "==" : c }); i++; continue; }
    throw new ExprError(`Unexpected character '${c}'`);
  }
  out.push({ k: "eof", v: "" });
  return out;
}

export function parse(src: string): Node {
  if (typeof src !== "string" || !src.trim()) throw new ExprError("Empty formula");
  const s = normalize(src);
  if (s.length > MAX_LEN) throw new ExprError("Formula too long");
  const toks = lex(s); let p = 0, nodes = 0;
  const peek = () => toks[p]; const next = () => toks[p++];
  const isOp = (v: string) => peek().k === "op" && peek().v === v;
  const mk = <T extends Node>(n: T): T => { if (++nodes > MAX_NODES) throw new ExprError("Formula too complex"); return n; };
  function expr(d: number): Node { if (d > MAX_DEPTH) throw new ExprError("Formula too deeply nested"); return or(d); }
  function or(d: number): Node { let a = and(d); while (isOp("||")) { next(); a = mk({ t: "bin", op: "||", a, b: and(d) }); } return a; }
  function and(d: number): Node { let a = cmp(d); while (isOp("&&")) { next(); a = mk({ t: "bin", op: "&&", a, b: cmp(d) }); } return a; }
  function cmp(d: number): Node { let a = add(d); while (peek().k === "op" && ["<", ">", "<=", ">=", "==", "!="].includes(peek().v)) { const op = next().v; a = mk({ t: "bin", op, a, b: add(d) }); } return a; }
  function add(d: number): Node { let a = mul(d); while (isOp("+") || isOp("-")) { const op = next().v; a = mk({ t: "bin", op, a, b: mul(d) }); } return a; }
  function mul(d: number): Node { let a = unary(d); while (isOp("*") || isOp("/")) { const op = next().v; a = mk({ t: "bin", op, a, b: unary(d) }); } return a; }
  function unary(d: number): Node { if (isOp("-") || isOp("!")) { const op = next().v as "-" | "!"; return mk({ t: "un", op, a: unary(d + 1) }); } return pow(d); }
  function pow(d: number): Node { const a = primary(d); if (isOp("^")) { next(); return mk({ t: "bin", op: "^", a, b: unary(d + 1) }); } return a; }
  function primary(d: number): Node {
    const t = next();
    if (t.k === "num") { const v = Number(t.v); if (!isFinite(v)) throw new ExprError(`Bad number ${t.v}`); return mk({ t: "num", v }); }
    if (t.k === "str") return mk({ t: "str", v: t.v });
    if (t.k === "id") {
      if (isOp("(")) { next(); const args: Node[] = []; if (!isOp(")")) { do { args.push(expr(d + 1)); if (isOp(",")) next(); else break; } while (true); } if (!isOp(")")) throw new ExprError("Missing ')'"); next(); const f = t.v.toLowerCase(); if (!FUNCS[f]) throw new ExprError(`Unknown function '${t.v}'`); return mk({ t: "call", f, args }); }
      return mk({ t: "var", n: t.v.toUpperCase() });
    }
    if (t.k === "op" && t.v === "(") { const e = expr(d + 1); if (!isOp(")")) throw new ExprError("Missing ')'"); next(); return e; }
    throw new ExprError(`Unexpected '${t.v || "end"}'`);
  }
  const ast = expr(0);
  if (peek().k !== "eof") throw new ExprError(`Unexpected '${peek().v}'`);
  return ast;
}

export function collectVars(n: Node, acc = new Set<string>()): Set<string> {
  switch (n.t) { case "var": acc.add(n.n); break; case "un": collectVars(n.a, acc); break; case "bin": collectVars(n.a, acc); collectVars(n.b, acc); break; case "call": n.args.forEach(a => collectVars(a, acc)); }
  return acc;
}

const num = (v: Val): number => { if (typeof v === "number") return v; if (typeof v === "boolean") return v ? 1 : 0; if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) return Number(v); throw new ExprError("Not a number"); };
const truthy = (v: Val) => v !== null && v !== false && v !== 0 && v !== "";
type Fn = (args: Val[], rawArgs: Node[], ev: (n: Node) => Val) => Val;
const FUNCS: Record<string, Fn> = {
  round: a => { const d = a[1] === undefined ? 0 : num(a[1]); const m = 10 ** d; return Math.round((num(a[0]) + Number.EPSILON) * m) / m; },
  floor: a => Math.floor(num(a[0])), ceil: a => Math.ceil(num(a[0])), abs: a => Math.abs(num(a[0])),
  sqrt: a => Math.sqrt(num(a[0])), exp: a => Math.exp(num(a[0])), ln: a => Math.log(num(a[0])), log: a => Math.log(num(a[0])), log10: a => Math.log10(num(a[0])),
  pow: a => Math.pow(num(a[0]), num(a[1])), min: a => Math.min(...a.map(num)), max: a => Math.max(...a.map(num)),
  if: (_a, raw, ev) => (truthy(ev(raw[0])) ? ev(raw[1]) : raw[2] ? ev(raw[2]) : null),
};
// 'if' is lazy: args are evaluated only for the chosen branch (so missing vars in the other branch don't matter)
export function evaluate(ast: Node, vars: Record<string, Val>): Val {
  const ev = (n: Node): Val => {
    switch (n.t) {
      case "num": return n.v; case "str": return n.v;
      case "var": { const v = vars[n.n]; if (v === undefined || v === null || v === "") throw new MissingVar(n.n); return v; }
      case "un": { const a = ev(n.a); return n.op === "-" ? -num(a) : !truthy(a); }
      case "bin": {
        if (n.op === "&&") return truthy(ev(n.a)) && truthy(ev(n.b));
        if (n.op === "||") return truthy(ev(n.a)) || truthy(ev(n.b));
        const a = ev(n.a), b = ev(n.b);
        switch (n.op) {
          case "+": return num(a) + num(b); case "-": return num(a) - num(b); case "*": return num(a) * num(b);
          case "/": { const d = num(b); if (d === 0) throw new ExprError("Division by zero"); return num(a) / d; }
          case "^": return Math.pow(num(a), num(b));
          case "<": return num(a) < num(b); case ">": return num(a) > num(b); case "<=": return num(a) <= num(b); case ">=": return num(a) >= num(b);
          case "==": return typeof a === "string" || typeof b === "string" ? String(a) === String(b) : num(a) === num(b);
          case "!=": return typeof a === "string" || typeof b === "string" ? String(a) !== String(b) : num(a) !== num(b);
        }
        throw new ExprError("Bad operator");
      }
      case "call": { const f = FUNCS[n.f]; if (n.f === "if") return f([], n.args, ev); return f(n.args.map(ev), n.args, ev); }
    }
  };
  const r = ev(ast);
  if (typeof r === "number" && !isFinite(r)) throw new ExprError("Result is not a finite number");
  return r;
}

/** Validate a formula: parse + ensure every variable is in `allowed` (+ AGE/SEX built-ins). */
export function validateExpression(src: string, allowed: Iterable<string>): { ok: true; vars: string[] } | { ok: false; error: string } {
  try {
    const ast = parse(src); const ok = new Set([...allowed].map(s => s.toUpperCase()).concat(["AGE", "AGE_MONTHS", "SEX_M", "SEX_F"]));
    const vars = [...collectVars(ast)]; const bad = vars.filter(v => !ok.has(v));
    if (bad.length) return { ok: false, error: `Unknown parameter(s): ${bad.join(", ")}` };
    return { ok: true, vars };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
