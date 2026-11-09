// FLEET: every agent is a spacecraft in the Deep Space Network.
// Each new session is assigned a random ship (one not already flying), drawn by
// ~/.config/herdr/cosmos/art.py: a solar-wing probe, a cargo hauler, a saucer, a ring
// station, an escape pod, an interceptor, a lander, a space plane, a comet racer, a manta
// glider. The assignment lives in shared "cosmos.fleet". Click a ship to change it; click the rest of its card to go to its pane.
// Claude Code sessions show telemetry from the `claude.stats` terminal label
// (~/.config/herdr/claude-desktop.sh on each machine):
//   FUEL  context left    O₂  the 5-hour quota left    CREDITS  spend
//   SIGNAL  the prompt cache    PROBES  running helpers (+1 for the session while it works)
// States: working IN FLIGHT (thrusters fire), blocked MAYDAY (a red beacon pulses),
// done ARRIVED, idle IN ORBIT (drifting).
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { hc, notify, agents, terminals, spaces, panes, openOverlay, run, setAgentOrder, theme, layout, shared, setShared } from "herdr";

const SHIPS = ["lumen", "atlas", "nova", "halo", "drift", "quasar", "pioneer", "orbiter", "comet", "zephyr"];
const SHIP_NAME = { lumen: "LUMEN PROBE", atlas: "ATLAS HAULER", nova: "NOVA SAUCER", halo: "HALO STATION", drift: "DRIFT POD",
  quasar: "QUASAR INTERCEPTOR", pioneer: "PIONEER LANDER", orbiter: "ORBITER", comet: "COMET RUNNER", zephyr: "ZEPHYR GLIDER" };
const SHORT = { lumen: "LUMEN", atlas: "ATLAS", nova: "NOVA", halo: "HALO", drift: "DRIFT", quasar: "QUASAR", pioneer: "PIONEER", orbiter: "ORBITER", comet: "COMET", zephyr: "ZEPHYR" };
const FLEET = "mods/cosmos-agents/fleet";
const CAST = "cosmos.fleet";
const MIN = "cards.min";   // { <terminal address>:<created_ms>: true } for minimised cards
const KEEP_CAST = 60;
const STATE = {
  detached: { word: "DETACHED", frames: null },
  working: { word: "IN FLIGHT", frames: null },
  blocked: { word: "MAYDAY", frames: ["MAYDAY", "MAYDAY", "      "] },
  done: { word: "ARRIVED ✦", frames: ["ARRIVED ✦", "ARRIVED ✧"] },
  idle: { word: "IN ORBIT", frames: null },
};
const STALE_S = 12 * 3600;
const SUB_FRESH_S = 90;
const BAR = 8;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function pickShip(taken, not) {
  const free = SHIPS.filter((s) => !taken.has(s) && s !== not);
  const pool = free.length ? free : SHIPS.filter((s) => s !== not);
  return pool[Math.floor(Math.random() * pool.length)];
}

function claudeStats(all, list) {
  const claude = new Set(list.filter((a) => a.app === "claude-code").map((a) => a.address));
  const out = new Map();
  for (const t of all) {
    const raw = t.labels?.["claude.stats"];
    if (!raw || !claude.has(t.address) || t.state !== "live") continue;
    try { out.set(t.address, JSON.parse(raw)); } catch {}
  }
  return out;
}

// What the context, usage limit and prompt cache readings mean, with the numbers behind them.
const tipTokens = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
const tipPad = (n) => String(n).padStart(2, "0");
const tipClock = (at) => { const d = new Date(at * 1000); return `${tipPad(d.getHours())}:${tipPad(d.getMinutes())}`; };
const tipDay = (at) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(at * 1000).getDay()]} ${tipClock(at)}`;
const tipUntil = (d) => (d >= 3600 ? `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m` : `${Math.max(1, Math.floor(d / 60))}m`);
function contextTip(label, s) {
  const pct = s.ctx?.pct ?? 0;
  const size = s.ctx?.size ?? 200000;
  const estimated = s.parent ? "\nThe window size is an estimate for background sessions." : "";
  return `${label}: context left in this session.\n${pct}% used, about ${tipTokens((size * pct) / 100)} of ${tipTokens(size)} tokens.\nWhen it runs low, Claude compacts the conversation.${estimated}`;
}
function limitTip(label, s, now) {
  const who = s.profile && s.profile !== "default" ? ` (${s.profile} account)` : "";
  const five = s.rl?.five_hour;
  const week = s.rl?.seven_day;
  const current = five && five.resets_at > now
    ? `${Math.round(five.used_percentage ?? 0)}% used, resets at ${tipClock(five.resets_at)} (in ${tipUntil(five.resets_at - now)}).`
    : "No current reading: Claude reports it with its next reply.";
  const weekly = week && week.resets_at > now ? `\n7-day limit: ${Math.round(week.used_percentage ?? 0)}% used, resets ${tipDay(week.resets_at)}.` : "";
  return `${label}: your 5-hour usage limit left${who}.\n${current}${weekly}`;
}
function cacheTip(label, s, now) {
  const warm = s.cache?.warm === true && s.cache.exp > now;
  return warm
    ? `${label}: this session's prompt cache.\nWarm for ${tipUntil(s.cache.exp - now)} more, until ${tipClock(s.cache.exp)}.\nA reply before then reuses it, which costs less.`
    : `${label}: this session's prompt cache.\nIt has expired.\nThe next reply rebuilds it, which costs more.`;
}

// Close and Delete worktree, shown on hover. session-actions asks before doing anything.
const actionInfo = (a, s) => ({ address: a.address, name: s?.name || a.address, bg: a.bg ?? null, sid: s?.sid ?? null, profile: s?.profile ?? null, dir: s?.dir ?? null });
function actionButtons(a, s, kids, t) {
  const chip = (id, label, tip, action) => div().id(`${id}-${a.address}`).size(18).flex().items_center().justify_center().rounded(4).border(1).border_color(t.dim).bg(t.popover)
    .cursor_pointer().hover((x) => x.bg(t.hover)).tooltip(tip)
    .on_click((_e, cx) => {
      cx.stop_propagation();
      openOverlay({ mod: "session-actions", kind: "dialog", modal: true, width: 480, height: 300, props: { action, session: actionInfo(a, s), kids: kids.map((k) => actionInfo(k, k.stats)) } });
    })
    .child(label);
  return h_flex().gap(4).child(chip("act-close", svg("mods/pane/close.svg").size(12).text_color(t.accent), "Close this session", "close"))
    .when(s?.loc === "wt" && Boolean(s?.dir), (el) => el.child(chip("act-wt", svg("mods/cosmos-agents/bin.svg").size(12).text_color(t.accent), "Close this session and delete its worktree", "worktree")));
}

// An attached session's pane can lose Claude (a restart, a crash) and fall back to a shell, while
// its old labels stay. Such a card is DETACHED, and clicking it reattaches: it only types when the
// pane is at a shell prompt, so anything else running there just gets focus.
const detachedFrom = (t) => {
  const fg = t.foreground;
  return Boolean(fg) && !(fg.argv ?? []).join(" ").includes("claude") && !/^\d+\.\d+\.\d+/.test(fg.name ?? "");
};
const atShell = (t) => /^-?(zsh|bash|fish|sh|dash)$/.test(String(t.foreground?.name ?? "").split("/").pop());
async function reattach(k) {
  run("pane.focus", { terminal: k.address });
  if (!k.shell || !/^[A-Za-z0-9_-]+$/.test(k.bg ?? "")) return;
  const profile = k.stats?.profile;
  const config = profile && profile !== "default" && /^[A-Za-z0-9_-]+$/.test(profile) ? `CLAUDE_CONFIG_DIR="$HOME/.claude-${profile}" ` : "";
  await hc(["keys", k.address, "ctrl+u"]);   // anything half-typed at the prompt
  const r = await hc(["send", k.address, `${config}claude attach ${k.bg}`]);
  if (r.code !== 0) notify({ title: "Couldn't reattach", body: (r.stderr || r.stdout || "").trim(), level: "error" });
}

// Attached background sessions (`claude --bg` in a child terminal labelled claude.bg), by
// their parent's address, as agent-shaped rows. Their stats label names the parent.
function bgChildren(all) {
  const out = new Map();
  for (const t of all) {
    const raw = t.labels?.["claude.stats"];
    if (!raw || !t.labels?.["claude.bg"] || t.state !== "live") continue;
    let s;
    try { s = JSON.parse(raw); } catch { continue; }
    if (!s.parent) continue;
    const machine = t.address.includes("/") ? `${t.address.split("/")[0]}/` : "";
    const key = `${machine}${s.parent}`;
    const status = detachedFrom(t) ? "detached" : s.state === "working" || s.state === "busy" ? "working" : /input|wait|block/.test(s.state ?? "") ? "blocked" : "idle";
    out.set(key, [...(out.get(key) ?? []), { address: t.address, app: "claude-code", status, shell: atShell(t), focused: false, bg: t.labels["claude.bg"], tab_name: s.name ?? t.address, stats: s }]);
  }
  for (const kids of out.values()) kids.sort((x, y) => String(x.stats.name ?? x.address).localeCompare(String(y.stats.name ?? y.address)));
  return out;
}

function nameOf(a, s, sp) {
  if (s?.name) return s.name;
  for (const space of sp) for (const tab of space.tabs ?? []) if (tab.id === a.tab) return tab.named ? tab.name : space.name;
  return a.space_name || a.tab_name || a.address;
}

const gauge = (v) => (v == null ? "▱".repeat(BAR) : "▰".repeat(Math.round((v / 100) * BAR)) + "▱".repeat(BAR - Math.round((v / 100) * BAR)));

// Everything a minimised card is hiding, for its tooltip.
function foldedTip(a, s, name, who, word, machine, now, kids) {
  if (a.status === "detached") return `${name}\nDetached. Click to reattach.`;
  const where = machine ? ` @${machine}` : "";
  const lines = [name, [who, word].filter(Boolean).join(" · ")];
  if (s) {
    lines.push(`${s.repo || "~"}${where}`);
    if (s.branch) lines.push(`${s.loc === "wt" ? "wt" : "br"}: ${s.branch}`);
    const spend = s.tokens != null && s.cost == null ? `${Math.floor(s.tokens / 1000)}k tok` : `$${(s.cost ?? 0).toFixed(2)}`;
    lines.push(`${s.model ?? "claude"}${s.effort ? ` ${s.effort}` : ""} · ${spend}`);
    const stale = now - (s.at ?? 0) > STALE_S ? " (old)" : "";
    const five = s.rl?.five_hour;
    lines.push(`FUEL: ${100 - (s.ctx?.pct ?? 0)}% left${stale}`);
    lines.push(`O₂: ${five && five.resets_at > now ? `${Math.round(100 - (five.used_percentage ?? 0))}% left${stale}` : "—"}`);
    const fresh = s.subs && now - (s.subs.at ?? 0) <= SUB_FRESH_S;
    const total = (fresh ? s.subs.n ?? 0 : 0) + (a.status === "working" ? 1 : 0);
    const d = s.cache?.warm === true ? s.cache.exp - now : 0;
    const link = [
      s.cache?.warm == null ? null : d > 0 ? `signal ${d >= 3600 ? `${Math.floor(d / 3600)}h${Math.floor((d % 3600) / 60)}m` : d >= 60 ? `${Math.floor(d / 60)}m` : "<1m"}` : "signal lost",
      total > 0 ? `${total} probe${total === 1 ? "" : "s"}` : null,
      s.rc ? "rc" : null,
    ].filter(Boolean);
    if (link.length) lines.push(link.join(" · "));
    if (fresh) for (const n of s.subs.helpers ?? s.subs.names ?? []) lines.push(`  ${n}`);
  } else {
    lines.push(`${a.app ?? a.program?.name ?? "program"}${where}`);
    lines.push(a.app === "claude-code" ? "acquiring signal…" : "no telemetry");
  }
  if (kids.length) lines.push("Attached:", ...kids.map((k) => `  ${k.stats?.name || k.address}: ${STATE[k.status]?.word ?? String(k.status ?? "").toUpperCase()}`));
  return lines.join("\n");
}

export default class Fleet extends View {
  init(_props, cx) {
    cx.timer.every(30000, (cx) => cx.notify());   // signal countdown and stale marks
  }

  castKey(a, s, term) {
    if (a.app === "claude-code") return s?.sid ? `sid:${s.sid}` : null;
    return `term:${a.address}:${term?.created_ms ?? ""}`;
  }

  castAll(list, stats, all) {
    const cast = { ...(shared(CAST) ?? {}) };
    const terms = new Map(all.map((t) => [t.address, t]));
    const keys = new Map(list.map((a) => [a.address, this.castKey(a, stats.get(a.address), terms.get(a.address))]));
    const live = new Set([...keys.values()].filter(Boolean));
    const taken = new Set([...live].map((k) => cast[k]?.ship).filter(Boolean));
    let dirty = false;
    for (const k of live) {
      if (cast[k] && SHIPS.includes(cast[k].ship)) continue;
      const ship = pickShip(taken);
      cast[k] = { ship, at: Date.now() };
      taken.add(ship);
      dirty = true;
    }
    const gone = Object.keys(cast).filter((k) => !live.has(k)).sort((x, y) => (cast[y].at ?? 0) - (cast[x].at ?? 0));
    for (const k of gone.slice(KEEP_CAST)) { delete cast[k]; dirty = true; }
    if (dirty) setShared(CAST, cast);
    this.terms = terms;
    this.keys = keys;
    this.cast = cast;
    this.taken = taken;
  }

  reroll(key) {
    const cast = { ...(shared(CAST) ?? {}) };
    cast[key] = { ship: pickShip(this.taken ?? new Set(), cast[key]?.ship), at: Date.now() };
    setShared(CAST, cast);
  }

  // The ship in a porthole of drifting stars; before a Claude session's first reply,
  // the porthole shows only a pulsing contact light (acquiring signal).
  avatar(a, color, t, small = false) {
    const key = this.keys?.get(a.address);
    const ship = key && this.cast?.[key]?.ship;
    const w = small ? 40 : 72, h = small ? 54 : 96;
    const layer = (src) => image(src).absolute().top(0).left(0).w(w).h(h);
    const port = div().relative().w(w).h(h).overflow_hidden().rounded(small ? 6 : 10).bg("#05060f")
      .child(image(`${FLEET}/stars.svg`).absolute().top(0).left(-8).w(w + 16).h(h).loop("left", { from: -10, to: 0, period: 14000 }));
    if (!ship) {
      return v_flex().w(w + 2).flex_none().border(1).border_color(`${color}55`).rounded(small ? 7 : 11).overflow_hidden()
        .child(port.child(div().absolute().left(w / 2 - 4).top(h / 2 - 4).size(8).rounded(4).bg(color).loop("opacity", { from: 0.2, to: 1, period: 1200 })));
    }
    const s = a.status;
    return v_flex().id(`ship-${a.address}`).w(w + 2).flex_none().border(1).border_color(`${color}66`).rounded(small ? 7 : 11).overflow_hidden()
      .when(!small, (el) => el.tooltip(`${SHIP_NAME[ship]} · click to change`).on_click((_e, cx) => { cx.stop_propagation(); this.reroll(key); }))
      .child(port
        .child(layer(`${FLEET}/${ship}.svg`).loop("top", { from: s === "working" ? -2 : 0, to: s === "working" ? 1 : 2.5, period: s === "working" ? 900 : 4200 }))
        .when(s === "working", (el) => el.child(layer(`${FLEET}/${ship}-fx.svg`).loop("opacity", { from: 0.55, to: 1, period: 160 })))
        .when(s === "blocked", (el) => el.child(layer(`${FLEET}/beacon.svg`).loop("opacity", { from: 0.15, to: 1, period: 650 }))))
      .when(!small, (el) => el.child(div().w_full().h(14).flex().items_center().justify_center().bg(`${color}1c`).border_t(1).border_color(`${color}40`)
        .text_size(8.5).font_semibold().text_color(color).child(SHORT[ship])));
  }

  // A minimised card belongs to its terminal's life: a reused terminal id starts expanded.
  minKey(address) {
    return `${address}:${this.terms?.get(address)?.created_ms ?? ""}`;
  }

  toggleMin(address) {
    const min = { ...(shared(MIN) ?? {}) };
    const key = this.minKey(address);
    if (min[key]) delete min[key];
    else min[key] = true;
    // a parent takes its attached sessions with it; each can still be opened on its own
    for (const k of this.allKids?.get(address) ?? []) { if (min[key]) min[this.minKey(k.address)] = true; else delete min[this.minKey(k.address)]; }
    const live = new Set([...(this.terms?.keys() ?? [])].map((k) => this.minKey(k)));
    for (const k of Object.keys(min)) if (!live.has(k)) delete min[k];
    setShared(MIN, min);
  }

  // Every card, attached sessions included. Expanding clears the lot, which also drops ended terminals.
  setAllMin(everyone, folded) {
    setShared(MIN, folded ? Object.fromEntries(everyone.map((a) => [this.minKey(a.address), true])) : {});
  }

  // In the header: expands when every card is minimised, otherwise minimises them all.
  minAllButton(everyone, t) {
    const min = shared(MIN) ?? {};
    const allFolded = everyone.every((a) => min[this.minKey(a.address)]);
    return div().id("card-min-all").size(16).flex_none().flex().items_center().justify_center().border(1).border_color(t.dim).rounded(5)
      .text_size(12).font_semibold().text_color(t.muted).cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.accent))
      .tooltip(allFolded ? "Expand all sessions" : "Minimise all sessions")
      .on_click((_e, cx) => { cx.stop_propagation(); this.setAllMin(everyone, !allFolded); })
      .child(allFolded ? "+" : "\u2013");
  }

  // Shown while the pointer is over the card.
  minButton(a, folded, t) {
    return div().id(`card-min-${a.address}`).size(16).flex_none().flex().items_center().justify_center().border(1).border_color(t.dim).rounded(5)
      .text_size(12).font_semibold().text_color(t.muted).cursor_pointer().hover((x) => x.bg(t.hover).text_color(t.accent))
      .tooltip(folded ? "Expand this session" : "Minimise this session")
      .on_click((_e, cx) => { cx.stop_propagation(); this.toggleMin(a.address); })
      .child(folded ? "+" : "\u2013");
  }

  // A minimised card's one line: avatar, name, attached sessions folded inside, status.
  // The tooltip is on the text, not the whole row, so the button keeps its own.
  foldedRow(a, name, who, status, tip, kids, t) {
    return [
      h_flex().id(`card-info-${a.address}`).flex_1().min_w(0).h_full().gap(7).items_center().tooltip(tip)
        .when(Boolean(who), (el) => el.child(div().flex_none().min_w(46).text_size(9.5).font_semibold().text_color(t.muted).child(who)))
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(12).text_color(t.foreground).child(name))
        .child(status),
      this.hoveredCard === a.address && this.minButton(a, true, t),
    ].filter(Boolean);
  }

  // One craft's row; a parent's box also holds its attached sessions, nested below it.
  card(a, s, now, t, sp, stats, kids = [], nested = false) {
    const st = STATE[a.status] ?? { word: String(a.status ?? "").toUpperCase() };
    const color = t[a.status] ?? t.dim;
    const blocked = a.status === "blocked";
    const machine = a.address.includes("/") ? a.address.split("/")[0] : "local";
    const old = s && now - (s.at ?? 0) > STALE_S;
    const row = (key, kids) => h_flex().id(`fl-${key}-${a.address}`).w_full().min_w(0).h(15).items_center().overflow_hidden().whitespace_nowrap().text_size(11).children(kids.filter(Boolean));
    const span = (text, c, bold) => div().flex_none().text_color(c).when(Boolean(bold), (e) => e.font_semibold()).child(text);
    const grow = (text, c) => div().flex_1().min_w(0).truncate().text_color(c).child(text);
    const folded = Boolean(shared(MIN)?.[this.minKey(a.address)]);
    const status = () => div().flex_none().px(5).h(15).flex().items_center().rounded(8).bg(`${color}22`).border(1).border_color(`${color}66`)
      .text_size(8.5).font_semibold().text_color(color).child(st.word).when(Boolean(st.frames), (e) => e.frames(st.frames, 420));
    const rows = [
      h_flex().w_full().min_w(0).gap(6).items_center()
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_size(12.5).text_color(t.foreground).child(nameOf(a, s, sp)))
        .child(status())
        .when(this.hoveredCard === a.address, (el) => el.child(this.minButton(a, false, t))),
    ];
    if (a.status === "detached") {
      rows.push(row("detached", [grow("Click to reattach", t.accent)]));
    } else if (s) {
      rows.push(row("where", [grow(s.repo || "~", t.muted), span(`◉ ${machine}`, t.dim)]));
      if (s.branch) rows.push(row("branch", [grow(`${s.loc === "wt" ? "wt" : "br"}: ${s.branch}`, t.muted)]));
      const credits = s.tokens != null && s.cost == null ? `${Math.floor(s.tokens / 1000)}k tok` : `$${(s.cost ?? 0).toFixed(2)}`;
      rows.push(row("model", [grow(`${s.model ?? "claude"}${s.effort ? ` ${s.effort}` : ""}`, t.muted), span(credits, t.done, true)]));
      const fuel = 100 - (s.ctx?.pct ?? 0);
      const five = s.rl?.five_hour;
      const o2 = five && five.resets_at > now ? 100 - (five.used_percentage ?? 0) : null;
      const level = (v) => (v == null ? t.dim : v < 10 ? t.blocked : v < 25 ? t.done : t.accent);
      const meter = (key, label, v) => row(key, [span(label, t.dim), span(gauge(v), level(v)),
        span(v == null ? "  —" : ` ${String(Math.round(v)).padStart(3)}%${old ? " old" : ""}`, v != null && v < 25 ? level(v) : t.muted)]);
      rows.push(meter("fuel", "FUEL ", fuel).tooltip(contextTip("FUEL", s)));
      rows.push(meter("o2", "O₂   ", o2).tooltip(limitTip("O₂", s, now)));
      let signal = null;
      if (s.cache?.warm === true && s.cache.exp > now) {
        const d = s.cache.exp - now;
        signal = span(`signal ${d >= 3600 ? `${Math.floor(d / 3600)}h${Math.floor((d % 3600) / 60)}m` : d >= 60 ? `${Math.floor(d / 60)}m` : "<1m"}`, d < 60 ? t.blocked : t.dim);
      } else if (s.cache?.warm != null) signal = span("signal lost", t.blocked);
      if (signal) signal = signal.id(`fl-signal-${a.address}`).tooltip(cacheTip("SIGNAL", s, now));
      const fresh = s.subs && now - (s.subs.at ?? 0) <= SUB_FRESH_S;
      const helpers = fresh ? s.subs.n ?? 0 : 0;
      const total = helpers + (a.status === "working" ? 1 : 0);
      const bits = [signal, total > 0 && span(`${total} probe${total === 1 ? "" : "s"}`, t.muted), s.rc && span("rc", t.ansi5)].filter(Boolean);
      if (bits.length) rows.push(row("link", bits.flatMap((b, i) => (i ? [span(" · ", t.dim), b] : [b]))));
      if (fresh) (s.subs.helpers ?? s.subs.names ?? []).slice(0, 3).forEach((n, i, arr) =>
        rows.push(row(`sub${i}`, [grow(`${i === arr.length - 1 && (s.subs.hn ?? helpers) <= arr.length ? "└" : "├"} ${n}`, t.dim)])));
    } else {
      rows.push(row("where", [grow(a.app ?? a.program?.name ?? "craft", t.muted), span(`◉ ${machine}`, t.dim)]));
      rows.push(row("wait", [span(a.app === "claude-code" ? "acquiring signal…" : "no telemetry", t.dim)]));
    }
    const head = h_flex()
      .id(`craft-head-${a.address}`)
      .relative()
      .w_full()
      .flex_none()
      .when(folded, (el) => el.h(28).px(8).gap(7).items_center())
      .when(!folded, (el) => el.p(7).gap(9).items_start())
      .rounded(12)
      .when(nested && blocked, (el) => el.bg(`${t.blocked}26`))
      // inside a group, a lighter border marks the selected session
      .when(nested || kids.length > 0, (el) => el.border(1).border_color(this.focusedTerm === a.address ? t.foreground : "#00000000"))
      .cursor_pointer()
      .hover((x) => x.bg(t.hover))
      .on_click(() => a.status === "detached" ? reattach(a) : run(nested ? "pane.focus" : "agent.focus", { terminal: a.address }))
      .on_hover((on, cx) => {
        if (on) this.hoveredCard = a.address;
        else if (this.hoveredCard === a.address) this.hoveredCard = null;
        cx.notify();
      })
      .when(folded, (el) => {
        const who = SHORT[this.cast?.[this.keys?.get(a.address)]?.ship];
        const full = nameOf(a, s, sp);
        return el.children(this.foldedRow(a, full, who, status(), foldedTip(a, s, full, SHIP_NAME[this.cast?.[this.keys?.get(a.address)]?.ship], st.word, machine, now, kids), kids, t));
      })
      .when(!folded, (el) => el.child(this.avatar(a, color, t))
        .child(v_flex().flex_1().min_w(0).gap(1).children(rows))
        .when(this.hoveredCard === a.address, (e) => e.child(actionButtons(a, s, kids, t).absolute().right(6).bottom(6))));
    if (nested) return head;

    const alarm = blocked || kids.some((k) => k.status === "blocked");
    // the group stays highlighted while the parent or any of its sessions is selected
    const active = a.focused || this.focusedTerm === a.address || kids.some((k) => k.address === this.focusedTerm);
    return v_flex()
      .id(`craft-${a.address}`)
      .w_full()
      .flex_none()
      .rounded(12)
      .bg(blocked ? `${t.blocked}26` : active ? `${t.raised}f2` : `${t.surface}f2`)
      .border(1)
      .border_color(alarm ? t.blocked : active ? t.accent : t.border)
      .child(head)
      .children(kids.map((k, i) => h_flex().id(`craft-kid-${k.address}`).w_full().min_w(0).items_start().border_t(1).border_color(t.border)
        .child(div().flex_none().w(14).pt(6).text_center().text_size(11).text_color(t.dim).child(i === kids.length - 1 ? "└" : "├"))
        .child(div().flex_1().min_w(0).child(this.card(k, stats.get(k.address), now, t, sp, stats, [], true)))));
  }

  render() {
    const t = theme();
    const all = terminals();
    const kids = bgChildren(all);
    this.allKids = kids;
    const flatKids = [...kids.values()].flat();
    const nestedAt = new Set(flatKids.map((k) => k.address));
    const list = agents().filter((a) => !nestedAt.has(a.address));
    const sp = spaces();
    setAgentOrder(list.map((a) => a.address));
    this.focusedTerm = panes().find((p) => p.focused)?.terminal ?? null;
    const stats = claudeStats(all, list);
    for (const k of flatKids) stats.set(k.address, k.stats);
    const everyone = [...list, ...flatKids];
    this.castAll(everyone, stats, all);
    if (narrow()) {
      return v_flex().size_full().gap(6).py(6).items_center()
        .children(list.map((a) => div().id(`cr-${a.address}`).cursor_pointer().on_click(() => run("agent.focus", { terminal: a.address }))
          .child(this.avatar(a, t[a.status] ?? t.dim, t, true))));
    }
    const now = Math.floor(Date.now() / 1000);
    const flying = everyone.filter((a) => a.status === "working").length;
    const mayday = everyone.filter((a) => a.status === "blocked").length;
    return v_flex().id("fleet").size_full().min_h(0).text_color(t.foreground).text_size(12)
      .child(h_flex().h(30).flex_none().px(12).gap(8).items_center().bg(`${t.chrome}d8`).border_t(1).border_b(1).border_color(t.border).text_size(11)
        .child(div().font_semibold().text_color(t.accent).child("FLEET"))
        .child(div().text_color(t.dim).child(`${list.length} craft`))
        .child(div().flex_1())
        .when(flying > 0, (el) => el.child(div().text_color(t.working).child(`${flying} in flight`)))
        .when(mayday > 0, (el) => el.child(div().text_color(t.blocked).font_semibold().child(`${mayday} mayday`)))
        .when(everyone.length > 0, (el) => el.child(this.minAllButton(everyone, t))))
      .child(v_flex().id("fleet-list").flex_1().min_h(0).gap(6).p(6).bg(`${t.canvas}b8`).overflow_y_scrollbar()
        .children(list.map((a) => this.card(a, stats.get(a.address), now, t, sp, stats, kids.get(a.address) ?? [])))
        .when(list.length === 0, (el) => el.child(div().p(8).text_size(11.5).text_color(t.dim).child("No craft in range. Launch an agent to see it here."))));
  }
}
