const UNITS: [number, string][] = [
  [1e24, '秭'], [1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '亿'], [1e4, '万'],
];

export function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  n = Math.abs(n);
  let out: string;
  if (n < 1000) {
    out = n < 10 && n !== Math.floor(n) ? n.toFixed(1) : Math.floor(n).toString();
  } else if (n < 1e4) {
    out = Math.floor(n).toLocaleString('en-US');
  } else {
    out = '';
    for (const [v, u] of UNITS) {
      if (n >= v) {
        const x = n / v;
        out = (x >= 100 ? x.toFixed(0) : x.toFixed(digits)) + u;
        break;
      }
    }
    if (!out) out = n.toExponential(2);
  }
  return neg ? '-' + out : out;
}

export function fmtRate(n: number): string {
  if (n < 10) return n.toFixed(1);
  return fmt(n, 1);
}

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function pct(n: number, d = 0): string {
  return (n * 100).toFixed(d) + '%';
}
