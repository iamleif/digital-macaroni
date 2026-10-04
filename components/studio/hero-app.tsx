import { Calendar, Check, Home, Inbox, Phone, Search, Settings, Users } from "./icons";
import h from "./home.module.css";

/** Today's calls at Northline, the fictional home-services business from the live demo. */
const calls = [
  { initials: "CB", name: "Chloe Bennett", tone: "a", intent: "Booking", outcome: "Visit booked · Thu 2–4 PM", time: "9:41 AM", length: "2:14", live: true },
  { initials: "MT", name: "Marcus Tran", tone: "b", intent: "Reschedule", outcome: "Moved to Fri 10–12", time: "9:12 AM", length: "1:38" },
  { initials: "PO", name: "Priya Oduya", tone: "c", intent: "Question", outcome: "Answered · service fees", time: "8:55 AM", length: "0:52" },
  { initials: "DR", name: "Dana Ruiz", tone: "d", intent: "Message", outcome: "Callback for Sam", time: "8:20 AM", length: "1:05", handoff: true },
  { initials: "JW", name: "James Whitfield", tone: "b", intent: "Booking", outcome: "Visit booked · Thu 8–10 AM", time: "7:48 AM", length: "2:41" },
];

const Wavebars = () => <span className={h.miniWave} aria-hidden="true">{[5, 9, 6, 11, 7, 10, 5].map((v, i) => <i key={i} style={{ height: v, animationDelay: `${i * -0.17}s` }} />)}</span>;

export function HeroApp() {
  return <div className={h.heroStage}>
    <div className={h.appShell} aria-hidden="true">
      <div className={h.appChrome}>
        <span className={h.dots}><i /><i /><i /></span>
        <span className={h.appAddress}>Northline · Front desk</span>
        <span className={h.appChromeEnd}>Sample data</span>
      </div>
      <div className={h.appBody}>
        <nav className={h.appRail}>
          <span className={h.appLogo}>N</span>
          <span><Home size={17} /></span>
          <span data-on><Phone size={17} /></span>
          <span><Calendar size={17} /></span>
          <span><Inbox size={17} /></span>
          <span><Users size={17} /></span>
          <span className={h.railEnd}><Settings size={17} /></span>
        </nav>
        <div className={h.appMain}>
          <div className={h.appHeader}>
            <div><small>Thursday, Oct 8</small><strong>Calls today</strong></div>
            <div className={h.appTools}>
              <span className={h.segmented}><b>All</b><span>Booked</span><span>Needs you</span></span>
              <span className={h.appSearch}><Search size={14} />Search calls</span>
            </div>
          </div>
          <div className={h.kpis}>
            <div><span>Answered</span><strong>24</strong><em>+6 vs last Thu</em></div>
            <div><span>Visits booked</span><strong>11</strong><em>$2,140 in jobs</em></div>
            <div><span>Picked up in</span><strong>0.8s</strong><em>Every call</em></div>
            <div><span>Sent to team</span><strong>2</strong><em>Callbacks</em></div>
          </div>
          <div className={h.callTable}>
            <div className={h.callHead}><span>Caller</span><span>Reason</span><span>Outcome</span><span>Time</span></div>
            {calls.map((c) => <div key={c.name} className={h.callRow} data-live={c.live || undefined}>
              <span className={h.caller}><i data-tone={c.tone}>{c.initials}</i><b>{c.name}</b></span>
              <span><em className={h.intent} data-intent={c.intent}>{c.intent}</em></span>
              <span className={h.outcome} data-handoff={c.handoff || undefined}>{c.live ? <><Wavebars />On the line · 01:12</> : <><Check size={13} />{c.outcome}</>}</span>
              <span className={h.callTime}>{c.time}<small>{c.length}</small></span>
            </div>)}
          </div>
        </div>
        <aside className={h.appDetail}>
          <div className={h.detailHead}><i data-tone="a">CB</i><div><b>Chloe Bennett</b><small>(206) 555-0148 · new customer</small></div></div>
          <p className={h.detailLabel}>Summary</p>
          <p className={h.detailSummary}>Furnace not igniting. Wants someone tomorrow afternoon. Address 48 Birch Lane.</p>
          <p className={h.detailLabel}>Ellie did</p>
          <ul className={h.toolList}>
            <li><Check size={12} />Checked the schedule<code>180ms</code></li>
            <li><Check size={12} />Read the time back<code>yes</code></li>
            <li data-pending><span className={h.spinner} />Booking the visit</li>
          </ul>
          <div className={h.bubble} data-side="caller">Can someone come tomorrow afternoon?</div>
          <div className={h.bubble} data-side="agent">Maya can be there between 2 and 4. Shall I book it?</div>
        </aside>
      </div>
    </div>

    <div className={h.liveCard} aria-hidden="true">
      <div className={h.liveTop}><span className={h.orbSmall} /><div><b>Ellie</b><small>Northline · on a call</small></div><span className={h.liveTimer}>01:12</span></div>
      <div className={h.bigWave}>{[10, 18, 13, 26, 20, 34, 24, 14, 22, 30, 38, 24, 16, 28, 34, 20, 26, 14, 10, 18, 12, 22, 16].map((v, i) => <i key={i} style={{ height: v, animationDelay: `${i * -0.11}s` }} />)}</div>
      <p>“Maya can be there between 2 and 4.”</p>
    </div>

    <div className={h.toast} aria-hidden="true"><span><Check size={14} /></span><div><b>Visit booked · NL-345</b><small>Maya · Thu 2–4 PM · by Ellie</small></div></div>
  </div>;
}
