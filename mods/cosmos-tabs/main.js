// The Cosmos tab bar: rounded glass tabs, each with a small planet dot. The shown tab glows
// with a starlight edge; an orbit spinner turns while an agent works, an SOS chip pulses
// when one needs you, a star when one arrived. "+ Launch", Files and Changes open as
// Herdr's do, the side panel remembered per space. Derived from matrix-tabs /
// herdr-traveler's traveler-tabs (Apache-2.0, Frank Lin), itself from Herdr's tabs mod.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, layout, settings } from "herdr";

const ORBIT = ["◜", "◝", "◞", "◟"];
const DOTS = ["#f2b16a", "#7ec8ff", "#c38cff", "#7ef0b0", "#ff8fa3", "#ffd479", "#9ad8d0"];

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = theme();
    const space = spaces().find((p) => p.active);
    const shown = space?.tabs ?? [];
    const ps = panes();
    const stop = (_e, cx) => cx.stop_propagation();
    const chip = (text, c) => div().flex_none().px(5).h(15).flex().items_center().rounded(8).bg(`${c}26`).border(1).border_color(`${c}88`)
      .text_size(8.5).font_semibold().text_color(c).child(text);
    const item = (c, i) => {
      const program = ps.find((p) => p.tab === c.id && p.program?.agent)?.program ?? ps.find((p) => p.tab === c.id)?.program;
      const name = c.named ? c.name : space?.name && shown.length === 1 ? space.name : program?.name ?? `Tab ${c.index}`;
      const on = c.active;
      return h_flex().id(`tab-${c.id}`).h(28).px(11).gap(7).items_center().flex_none().text_size(12).rounded(14)
        .border(1).border_color(on ? t.accent : t.border).bg(on ? t.selected : `${t.surface}cc`)
        .text_color(on ? t.foreground : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: c.index });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .child(div().size(9).flex_none().rounded(5).bg(DOTS[(c.index - 1) % DOTS.length]).when(on, (el) => el.border(1.5).border_color("#ffffff")))
        .child(div().max_w(180).truncate().when(on, (el) => el.font_semibold()).child(c.zoomed ? `${name} (zoomed)` : name))
        .when(c.status === "working", (el) => el.child(div().w(10).text_color(t.working).font_bold().child(ORBIT[0]).frames(ORBIT, 140)))
        .when(c.status === "blocked", (el) => el.child(chip("SOS", t.blocked).loop("opacity", { from: 0.35, to: 1, period: 650 })))
        .when(c.status === "done", (el) => el.child(div().text_color(t.done).child("✦")))
        .when(on, (el) => el.child(div().id(`close-${c.id}`).text_size(13).text_color(t.dim).hover((s) => s.text_color(t.blocked))
          .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child("×")));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = shared("workspace.panels") ?? ["files", "changes"];
    this.syncPanel(space, panel, body, enabled);
    const pill = (id, label, on, action) => div().id(id).h(26).px(11).flex_none().flex().items_center().rounded(13).text_size(11.5)
      .border(1).border_color(on ? t.accent : t.border).bg(on ? t.selected : "#00000000").text_color(on ? t.accent : t.muted)
      .hover((s) => s.text_color(t.accent).border_color(t.accent)).on_mouse_down("left", stop).on_click(action).child(label);
    const panelButton = (id) => {
      const on = panel && !panel.hidden && body?.active === id;
      return pill(`panel-${id}`, id === "files" ? "Files" : "Changes", on, () => {
        if (on) run("layout.hide", { id: "panel" });
        else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
      });
    };
    return h_flex().size_full().min_w(0).pr(10).pl(lightsPadding).gap(6).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().flex_none().gap(5).items_center().text_size(11).text_color(t.dim)
        .child(div().text_color(t.accent).child("◉")).child((space?.machine ?? "local")))
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(5).overflow_x_scrollbar().children(shown.map(item)))
      .child(pill("tab-new", "+ Launch", false, () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), (el) => el.child(panelButton("files")))
      .when(enabled.includes("changes"), (el) => el.child(panelButton("changes")))
      .when(w?.buttons, (el) => el.child(pill("minimize", "–", false, () => run("window.minimize")))
        .child(pill("maximize", "□", false, () => run("window.maximize")))
        .child(pill("close-window", "×", false, () => run("window.close"))));
  }
}
