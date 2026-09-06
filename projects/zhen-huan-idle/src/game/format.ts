const UNITS: [number, string][] = [
  [1e32, '沟'],
  [1e28, '穰'],
  [1e24, '秭'],
  [1e20, '垓'],
  [1e16, '京'],
  [1e12, '兆'],
  [1e8, '亿'],
  [1e4, '万'],
];

export function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return '∞';
  const neg = n < 0;
  const a = Math.abs(n);
  let out: string;
  if (a < 1000) {
    out = a < 10 && a !== Math.floor(a) ? a.toFixed(1) : Math.floor(a).toString();
  } else if (a < 1e4) {
    out = Math.floor(a).toLocaleString('en-US');
  } else {
    out = a.toExponential(2);
    for (const [v, u] of UNITS) {
      if (a >= v) {
        const q = a / v;
        out = (q >= 100 ? q.toFixed(0) : q >= 10 ? q.toFixed(1) : q.toFixed(digits)) + u;
        break;
      }
    }
  }
  return neg ? '-' + out : out;
}

export function fmtInt(n: number): string {
  return fmt(Math.floor(n), 1);
}

export function fmtRate(n: number): string {
  if (n === 0) return '0';
  if (n < 10) return n.toFixed(2);
  return fmt(n);
}

export function fmtTime(sec: number): string {
  sec = Math.floor(sec);
  if (sec < 60) return `${sec}秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}时${m}分`;
}

export function cnNum(n: number): string {
  const d = '零一二三四五六七八九';
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  return String(n);
}
