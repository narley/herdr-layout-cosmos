// The Cosmos chrome. The sidebar header is a live sky: a nebula, two star layers that
// twinkle out of step, a ringed giant drifting with its moon, and a comet that streaks by
// now and then, all native loops. With props.footer, the footer: settings, add machine,
// and "next contact", which jumps to the next agent that needs you.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout, agents } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 284) : window()?.platform === "macos" ? 76 : 44 });
}
const ART = "mods/cosmos-chrome";

export default class Chrome extends View {
  button(id, icon, action, t) {
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(13).text_color(t.foreground)
      .border(1).border_color(`${t.accent}55`).bg(`${t.canvas}99`)
      .hover((s) => s.border_color(t.accent).text_color(t.accent))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(13));
  }

  footer(t, collapsed) {
    const line = (id, glyph, label, color, action) => h_flex().id(id).h(24).px(8).gap(9).items_center().rounded(8)
      .text_color(color).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.accent)).on_click(action)
      .child(div().w(12).flex_none().text_color(t.accent).child(glyph)).when(!collapsed, (el) => el.child(label));
    const waiting = agents().filter((a) => a.status === "blocked" || a.status === "done").length;
    return v_flex().size_full().bg(`${t.chrome}e0`).border_t(1).border_color(t.border).px(6).py(6).gap(1).text_size(12.5)
      .child(line("settings", "✦", "Settings", t.muted, () => run("app.settings"))
        .when(Boolean(updates().app.ready), (el) => el.child(div().size(6).rounded(3).bg(t.accent))))
      .child(line("machine", "✦", "Add machine", t.muted, () => run("mod.open", { name: "machine-add" })))
      .child(line("contact", "◎", waiting ? `Next contact (${waiting})` : "Next contact", waiting ? t.foreground : t.dim,
        () => run("agent.next")).tooltip("Jump to the next agent that needs you"));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.footer) return this.footer(t, collapsed);
    const mac = window()?.platform === "macos";
    const fill = (src) => image(`${ART}/${src}`).absolute().top(0).left(0).size_full();
    const list = agents();
    const flying = list.filter((a) => a.status === "working").length;
    return div().id("sky").relative().size_full().overflow_hidden().bg(t.canvas)
      .child(fill("sky.svg"))
      .child(fill("twinkle-a.svg").loop("opacity", { from: 0.25, to: 1, period: 2600 }))
      .child(fill("twinkle-b.svg").loop("opacity", { from: 1, to: 0.15, period: 4100 }))
      .child(fill("comet.svg").loop("opacity", { from: -1.6, to: 1, period: 9000 }))
      .when(!collapsed, (el) => el.child(image(`${ART}/giant.svg`).absolute().right(18).w(78).h(78).loop("top", { from: 22, to: 30, period: 7000 })))
      .when(!collapsed, (el) => el.child(v_flex().absolute().left(16).bottom(12).gap(1)
        .child(div().text_size(25).font_bold().text_color(t.foreground).child("HERDR"))
        .child(h_flex().gap(6).items_center()
          .child(div().size(6).rounded(3).bg(flying ? t.working : t.accent).loop("opacity", { from: 0.3, to: 1, period: flying ? 900 : 2400 }))
          .child(div().text_size(10).font_semibold().text_color(t.accent).child("DEEP SPACE NETWORK")))))
      .child(h_flex().absolute().top(10).right(10).gap(6)
        .when(!collapsed, (el) => el.child(this.button("search", "search", () => run("mod.open", { name: "picker" }), t)))
        .when(!(collapsed && mac), (el) => el.child(this.button("sidebar-toggle", "sidebar", toggleSidebar, t))));
  }
}
