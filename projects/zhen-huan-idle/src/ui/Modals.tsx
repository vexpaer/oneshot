import { useGame, choiceAvailable, choiceCost } from '../game/store';
import { EVENT_MAP } from '../game/data';
import { fmt, fmtTime } from '../game/format';

// 各类仪式的印章文字
const SEAL_TEXT: Record<string, string> = {
  promotion: '奉天\n承运',
  prestige: '甘露\n寺印',
  era: '凤印',
  rivalFallen: '六宫\n事',
  bedding: '敬事\n房',
  intro: '殿选',
};

export function CeremonyModal() {
  const c = useGame((s) => s.ceremony);
  const close = useGame((s) => s.closeCeremony);
  if (!c) return null;
  const color = c.type === 'rivalFallen' ? '#8d2419' : c.type === 'prestige' ? '#4a3f6b' : '#6b4b12';
  return (
    <div className="overlay" onClick={close}>
      <div className="scroll" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-[0.7rem] tracking-[0.6em] text-ink/60">{c.subtitle ?? ''}</div>
          <div className="brush text-5xl mt-2" style={{ color }}>{c.title}</div>
          <div className="mx-auto mt-3 w-16 h-px bg-vermilion/60" />
        </div>
        <div className="rise mt-6 text-[0.98rem] leading-8 whitespace-pre-line text-ink tracking-wide text-justify">{c.body}</div>
        {c.detail && <div className="rise mt-5 text-[0.78rem] leading-7 text-ink/70 whitespace-pre-line border-t border-ink/15 pt-3">{c.detail}</div>}
        <div className="rise mt-7 flex justify-center">
          <button className="paper-btn" onClick={close}>{c.type === 'intro' ? '入宫' : c.type === 'rivalFallen' ? '知道了' : '领旨谢恩'}</button>
        </div>
        <div className="seal">{SEAL_TEXT[c.type]}</div>
      </div>
    </div>
  );
}

export function EventModal() {
  const s = useGame();
  const id = s.activeEvent;
  if (!id) return null;
  const ev = EVENT_MAP[id];
  if (!ev) return null;
  return (
    <div className="overlay">
      <div className="scroll">
        <div className="text-[0.7rem] tracking-[0.6em] text-ink/60 text-center">第 {s.day} 日 · 宫中事</div>
        <div className="brush text-4xl text-center mt-2 text-vermilion">{ev.title}</div>
        <div className="mx-auto mt-3 w-16 h-px bg-vermilion/60" />
        <div className="rise mt-5 text-[0.98rem] leading-8 text-ink tracking-wide text-justify">{ev.text}</div>
        <div className="rise mt-6 space-y-2">
          {ev.choices.map((ch, i) => {
            const av = choiceAvailable(s, ch);
            const cost = choiceCost(s, ch);
            const costs: string[] = [];
            if (cost.scheme) costs.push(`心计 ${fmt(cost.scheme)}`);
            if (cost.silver) costs.push(`银两 ${fmt(cost.silver)}`);
            if (ch.requireAlly) costs.push(`需盟友`);
            return (
              <button key={i} className="paper-choice" disabled={!av.ok} onClick={() => s.chooseEvent(i)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.95rem] tracking-wide text-ink">{ch.label}</span>
                  <span className="text-[0.7rem] text-ink/60 shrink-0">
                    {ch.chance !== undefined ? `成算 ${Math.round(ch.chance * 100)}%` : ''}{costs.length ? ` · ${costs.join(' · ')}` : ''}
                  </span>
                </div>
                {(ch.hint || !av.ok) && <div className="text-[0.74rem] mt-1" style={{ color: av.ok ? 'rgba(43,35,32,0.6)' : '#8d2419' }}>{av.ok ? ch.hint : av.why}</div>}
              </button>
            );
          })}
        </div>
        <div className="seal">宫闱</div>
      </div>
    </div>
  );
}

export function EventResultModal() {
  const r = useGame((s) => s.eventResult);
  const close = useGame((s) => s.closeEventResult);
  if (!r) return null;
  return (
    <div className="overlay" onClick={close}>
      <div className="scroll" onClick={(e) => e.stopPropagation()}>
        <div className="brush text-3xl text-center text-ink">{r.title}</div>
        <div className="mx-auto mt-3 w-12 h-px bg-vermilion/60" />
        <div className="rise mt-5 text-[0.98rem] leading-8 text-ink tracking-wide text-justify">{r.text}</div>
        <div className="rise mt-6 flex justify-center"><button className="paper-btn" onClick={close}>继续</button></div>
      </div>
    </div>
  );
}

export function OfflineModal() {
  const r = useGame((s) => s.offlineReport);
  const close = useGame((s) => s.dismissOffline);
  if (!r) return null;
  return (
    <div className="overlay" onClick={close}>
      <div className="scroll" onClick={(e) => e.stopPropagation()}>
        <div className="text-[0.7rem] tracking-[0.6em] text-ink/60 text-center">离宫期间</div>
        <div className="brush text-4xl text-center mt-2 text-ink">回宫</div>
        <div className="rise mt-5 text-[0.98rem] leading-8 text-ink text-center">你离开了 {fmtTime(r.seconds)}。宫人们照旧当差，只是没有主子看着，只得平日一半的心力。</div>
        <div className="rise mt-4 grid grid-cols-3 gap-3 text-center">
          <div><div className="text-[0.7rem] tracking-[0.3em] text-ink/60">恩宠</div><div className="num text-xl text-vermilion">+{fmt(r.favor)}</div></div>
          <div><div className="text-[0.7rem] tracking-[0.3em] text-ink/60">银两</div><div className="num text-xl text-ink">+{fmt(r.silver)}</div></div>
          <div><div className="text-[0.7rem] tracking-[0.3em] text-ink/60">心计</div><div className="num text-xl text-ink">+{fmt(r.scheme)}</div></div>
        </div>
        <div className="rise mt-6 flex justify-center"><button className="paper-btn" onClick={close}>收下</button></div>
      </div>
    </div>
  );
}
