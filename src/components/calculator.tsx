"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui";

type Op = "+" | "−" | "×" | "÷";

function fmt(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-9)) {
    return value.toExponential(8);
  }
  return parseFloat(value.toPrecision(12)).toString();
}

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
  }
}

const NUMBER_KEYS = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+"];

export function Calculator({
  defaultOpen = true,
  className = "",
}: {
  defaultOpen?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true); // next digit starts a new number
  const [evaluated, setEvaluated] = useState(false);
  const [open, setOpen] = useState(defaultOpen);

  const actionsRef = useRef<Record<string, () => void>>({});

  function inputDigit(d: string) {
    if (display === "Error") {
      setDisplay(d);
      setFresh(false);
      setEvaluated(false);
      return;
    }
    if (fresh || evaluated) {
      setDisplay(d);
      setFresh(false);
      setEvaluated(false);
      return;
    }
    setDisplay(display.length >= 14 ? display : display === "0" ? d : display + d);
  }

  function inputDot() {
    if (display === "Error") {
      setDisplay("0.");
      setFresh(false);
      setEvaluated(false);
      return;
    }
    if (fresh || evaluated) {
      setDisplay("0.");
      setFresh(false);
      setEvaluated(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  }

  function rawValue(): number {
    const n = parseFloat(display);
    return Number.isNaN(n) ? 0 : n;
  }

  function chooseOperator(next: Op) {
    const val = Number.isNaN(parseFloat(display)) ? 0 : parseFloat(display);
    if (acc === null || fresh) {
      setAcc(val);
    } else if (op !== null && acc !== null) {
      const result = apply(acc, op, val);
      if (Number.isFinite(result)) {
        setAcc(result);
        setDisplay(fmt(result));
      } else {
        setAcc(null);
        setDisplay("Error");
      }
    }
    setOp(next);
    setFresh(true);
    setEvaluated(false);
  }

  function doEquals() {
    if (op === null || acc === null) return;
    const result = apply(acc, op, rawValue());
    setDisplay(Number.isFinite(result) ? fmt(result) : "Error");
    setAcc(null);
    setOp(null);
    setFresh(true);
    setEvaluated(true);
  }

  function doClear() {
    setDisplay("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
    setEvaluated(false);
  }

  function doBack() {
    if (display === "Error" || display === "0") return;
    const next = display.slice(0, -1);
    setDisplay(next === "" || next === "-" ? "0" : next);
    setEvaluated(false);
  }

  function doNeg() {
    const n = parseFloat(display);
    if (display === "Error" || Number.isNaN(n) || n === 0) return;
    setFresh(false);
    setDisplay(fmt(-n));
  }

  function doPercent() {
    const n = parseFloat(display);
    if (display === "Error" || Number.isNaN(n)) return;
    setFresh(true);
    setDisplay(fmt(n / 100));
  }

  useEffect(() => {
    actionsRef.current = {
      "0": () => inputDigit("0"),
      "1": () => inputDigit("1"),
      "2": () => inputDigit("2"),
      "3": () => inputDigit("3"),
      "4": () => inputDigit("4"),
      "5": () => inputDigit("5"),
      "6": () => inputDigit("6"),
      "7": () => inputDigit("7"),
      "8": () => inputDigit("8"),
      "9": () => inputDigit("9"),
      ".": inputDot,
      "+": () => chooseOperator("+"),
      "-": () => chooseOperator("−"),
      "*": () => chooseOperator("×"),
      "/": () => chooseOperator("÷"),
      "=": doEquals,
      Enter: doEquals,
      Backspace: doBack,
      Escape: doClear,
      "%": doPercent,
    };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action =
        actionsRef.current[e.key] ?? actionsRef.current[e.key.length === 1 ? e.key : ""];
      if (!action) return;
      e.preventDefault();
      action();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function press(label: string) {
    if (label === "C") return doClear();
    if (label === "⌫") return doBack();
    if (label === "%") return doPercent();
    if (label === "÷") return chooseOperator("÷");
    if (label === "×") return chooseOperator("×");
    if (label === "−") return chooseOperator("−");
    if (label === "+") return chooseOperator("+");
    if (label === "=") return doEquals();
    if (label === ".") return inputDot();
    inputDigit(label);
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-apex-gradient text-white">
            <CalcIcon size={16} />
          </span>
          <h2 className="text-sm font-semibold">Calculator</h2>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide calculator" : "Show calculator"}
          className="rounded-lg border border-line p-1.5 text-muted transition hover:text-foreground"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open ? (
        <div className="mt-4">
          <div
            role="status"
            aria-live="polite"
            className="flex h-14 items-center justify-end rounded-xl border border-line bg-surface px-4 font-mono text-2xl font-semibold tabular-nums tracking-tight overflow-hidden"
          >
            <span className="truncate text-foreground">{display}</span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {NUMBER_KEYS.map((label) => {
              const isOp = ["+", "−", "×", "÷"].includes(label);
              return (
                <button
                  key={label}
                  onClick={() => press(label)}
                  aria-label={label === "⌫" ? "Backspace" : label}
                  className={`h-12 rounded-xl text-base font-semibold transition active:scale-95 ${
                    isOp
                      ? "border border-apex/40 bg-apex/10 text-apex hover:bg-apex/20"
                      : "border border-line bg-surface hover:border-apex/40"
                  } ${label === "C" ? "text-rose-400 hover:border-rose-500/50" : ""}`}
                >
                  {label}
                </button>
              );
            })}

            <button
              onClick={doNeg}
              aria-label="Negate"
              className="h-12 rounded-xl border border-line bg-surface text-base font-semibold transition hover:border-apex/40 active:scale-95"
            >
              ±
            </button>
            <button
              onClick={() => inputDigit("0")}
              aria-label="0"
              className="h-12 rounded-xl border border-line bg-surface text-base font-semibold transition hover:border-apex/40 active:scale-95"
            >
              0
            </button>
            <button
              onClick={inputDot}
              aria-label="Decimal point"
              className="h-12 rounded-xl border border-line bg-surface text-base font-semibold transition hover:border-apex/40 active:scale-95"
            >
              .
            </button>
            <button
              onClick={doEquals}
              aria-label="Equals"
              className="h-12 rounded-xl bg-apex-gradient text-base font-bold text-white shadow-lg shadow-apex/25 transition hover:opacity-90 active:scale-95"
            >
              =
            </button>
          </div>

          <p className="mt-3 hidden text-center text-xs text-muted sm:block">
            Tip: your keyboard works too — digits, + − × ÷, Enter, Backspace, Esc.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted">Quick math for study breaks.</p>
      )}
    </Card>
  );
}

export function CalculatorToggle({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn w-full"
      >
        <CalcIcon size={16} /> {open ? "Close calculator" : "Open calculator"}
      </button>
      {open ? <Calculator className="mt-3" /> : null}
    </div>
  );
}