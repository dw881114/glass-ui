/*
 * ============================================================================
 *  glass-ui.js —— Home Assistant 首页「Liquid Glass」外观层（通用模板）
 * ============================================================================
 *
 *  只改外观，不动功能：
 *    ☰    自己画一个玻璃圆钮，点击派发 HA 原生的 hass-toggle-menu 事件
 *          （窄屏打开侧边栏抽屉，宽屏停靠/收起侧边栏，与 HA 原生 ☰ 同一条路径）
 *    ⋮    直接用 HA 原生右上角下拉按钮，只换图标和样式
 *    dock 直接用 HA 原生视图 tab（ha-tab-group），只把位置/样式改到底部胶囊
 *
 *  所以切页、当前页高亮、侧边栏、菜单全部走 HA 自己的逻辑。
 *
 * ---------------------------------------------------------------------------
 *  安装
 * ---------------------------------------------------------------------------
 *  1. 把本文件放到 /config/www/glass-ui/glass-ui.js
 *  2. 设置 → 仪表盘 → 右上 ⋮ → 资源 → 添加
 *       URL: /local/glass-ui/glass-ui.js?v=1
 *       类型: JavaScript 模块
 *  3. 刷新页面（改完样式记得把 ?v= 数字 +1）
 *
 *  卸载：删掉这条资源 + 删掉文件，仪表盘立刻回到原样（不改任何配置）。
 *
 * ---------------------------------------------------------------------------
 *  作用范围
 * ---------------------------------------------------------------------------
 *  CONFIG.dashboards 里写要生效的仪表盘 url_path（就是地址栏 /lovelace 的那一段）。
 *  只影响列出来的仪表盘；编辑仪表盘模式会自动还原成原生外观。
 */
(() => {
  if (window.__glassUiLoaded) return;
  window.__glassUiLoaded = true;

  // ==========================================================================
  //  配置（一般只需要改这一段；也支持外部覆盖，见下面的 applyOverrides）
  // ==========================================================================
  const DEFAULTS = {
    // 生效的仪表盘 url_path；["*"] = 所有仪表盘
    dashboards: ["lovelace"],

    // 顶栏标题：直接把视图 header 里那行 `# 标题` 挪到顶栏高度、强制居中（脱离文档流），
    // 其它内容就按没有标题时正常往下排。
    //   "auto" = 挪到顶栏；"none" = 不显示
    title: "auto",
    titleTextSize: 21, // 顶栏标题字号

    dock: {
      maxWidth: 396, // 胶囊最大宽度（窄屏会自动缩到 100% - 34px）
      height: 60, // 胶囊高度
      inset: 5, // 高亮块距离胶囊内沿的边距
      bottom: 1, // 距屏幕底部的距离（安卓 / 桌面）
      bottomDesktop: 5, // 桌面网页端专用：胶囊距视口底边 5px
      bottomIOS: 22, // iOS 单独给一个值：iPhone 的安全区有 34px，直接用会离底边太远
      // 安卓 / 桌面是否叠加 env(safe-area-inset-bottom)（安卓一般就是 0，留着无害）
      safeArea: true,
      radius: "auto", // "auto" = height / 2（标准胶囊）
      // 按住 / 拖动时高亮块变大：高度 = 胶囊高度 + pressGrowExtraHeight，左右各加宽 pressGrowExtraWidth
      pressGrowExtraWidth: 10,
      pressGrowExtraHeight: 5,
      // 按住多少毫秒开始放大；一旦开始横向拖动就立刻放大
      pressGrowDelay: 140,
      // 高亮块在 tab 之间移动的时长（ms）。原来 340ms，速度降 30% → 340 / 0.7 ≈ 486
      moveDuration: 486,
      // 放大 / 缩小的动画时长（ms）
      growDuration: 200,
      // 页面左右滑动切换相邻 tab 的最短距离（CSS px）
      pageSwipeThreshold: 60,
    },

    iconSize: 22, // 底部 dock 图标大小
    tabLabel: true, // 图标下面显示视图名
    tabLabelSize: 10, // 视图名字号

    topButtons: {
      size: 46, // ☰ / ⋮ 圆钮直径
      iconSize: 21, // ☰ / ⋮ 图标大小
    },

    replaceOverflowIcon: true, // 把原生右上角「+」换成 ⋮（菜单内容仍是 HA 原生的）
    addEditMenuItem: false, // 把「编辑仪表盘」补进 ⋮ 菜单（PC 胶囊里已有独立铅笔图标，默认不需要）
    overflowMenuOffset: "auto", // 菜单相对圆钮的垂直偏移："auto" = 直接盖住圆钮；数字 = px（正数往下）
    overflowMenuEdge: 10, // ⋮ 弹出菜单距视口边缘（顶 / 右等）的安全距离

  };

  // 覆盖配置的两种方式（都不用改这个文件，HACS 升级时也不会丢）：
  //   1. 资源 URL 加查询参数（手写资源最方便）
  //        /hacsfiles/glass-ui/glass-ui.js?dashboards=lovelace,home&tabLabel=0
  //   2. 在它之前加载的脚本里设置 window.GLASS_UI_CONFIG（深合并）
  //        window.GLASS_UI_CONFIG = { dashboards: ["lovelace", "home"], dock: { height: 64 } };
  function mergeConfig(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    const out = Array.isArray(base) ? base.slice() : { ...base };
    Object.keys(extra).forEach((k) => {
      const v = extra[k];
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        base[k] &&
        typeof base[k] === "object" &&
        !Array.isArray(base[k])
      ) {
        out[k] = mergeConfig(base[k], v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    });
    return out;
  }

  function configFromUrl() {
    let qs = "";
    try {
      const tag = Array.from(document.scripts || []).find(
        (s) => s.src && s.src.indexOf("glass-ui.js") !== -1
      );
      qs = tag && tag.src.indexOf("?") !== -1 ? tag.src.split("?")[1] : "";
    } catch (e) {
      /* ignore */
    }
    if (!qs) return null;
    const p = new URLSearchParams(qs);
    const out = {};
    const dash = p.get("dashboards");
    if (dash) out.dashboards = dash.split(",").map((s) => s.trim()).filter(Boolean);
    ["tabLabel", "addEditMenuItem"].forEach(
      (k) => {
        if (!p.has(k)) return;
        out[k] = !/^(0|false|no|off)$/i.test(p.get(k));
      }
    );
    ["iconSize", "tabLabelSize"].forEach((k) => {
      if (p.has(k) && !isNaN(Number(p.get(k)))) out[k] = Number(p.get(k));
    });
    return out;
  }

  const CONFIG = mergeConfig(
    mergeConfig(DEFAULTS, window.GLASS_UI_CONFIG || {}),
    configFromUrl() || {}
  );

  // ==========================================================================
  //  以下是实现，一般不用改
  // ==========================================================================

  const ICON_MENU = "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z";
  const ICON_DOTS =
    "M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z";
  const ICON_PENCIL =
    "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z";

  const dockRadius =
    CONFIG.dock.radius === "auto" ? CONFIG.dock.height / 2 : CONFIG.dock.radius;
  const tabHeight = CONFIG.dock.height - CONFIG.dock.inset * 2;

  // iOS 的 Home 指示条会带来 env(safe-area-inset-bottom) ≈ 34px，
  // 直接叠加底栏会明显上浮，所以 iOS 单独用 bottomIOS（默认 20px）。
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const dockBottom = isIOS
    ? `${CONFIG.dock.bottomIOS}px`
    : CONFIG.dock.safeArea
      ? `calc(${CONFIG.dock.bottom}px + env(safe-area-inset-bottom))`
      : `${CONFIG.dock.bottom}px`;

  // ⋮ 菜单的垂直偏移：auto = 往上挪一个按钮高度，直接盖住圆钮
  const menuDistance =
    CONFIG.overflowMenuOffset === "auto"
      ? -CONFIG.topButtons.size
      : Number(CONFIG.overflowMenuOffset) || 0;

  // 所有皮肤样式都挂在 :host([glass-on]) 下，去掉这个属性就完全恢复原生外观
  const P = ":host([glass-on])";

  const CSS = `
/* ==========================================================================
   几何参数（由 CONFIG 写入，可在浏览器里直接改着试）
   ========================================================================== */
:host([glass-on]) {
  --g-dock-w: ${CONFIG.dock.maxWidth}px;
  --g-dock-h: ${CONFIG.dock.height}px;
  --g-dock-pad: ${CONFIG.dock.inset}px;
  --g-dock-bottom: ${dockBottom};
  --g-dock-radius: ${dockRadius}px;
  --g-tab-h: ${tabHeight}px;
  --g-tab-radius: ${tabHeight / 2}px;
  --g-icon: ${CONFIG.iconSize}px;
  --g-btn: ${CONFIG.topButtons.size}px;
  --g-btn-icon: ${CONFIG.topButtons.iconSize}px;
  /* 顶栏按钮 / 标题在 .toolbar 内部定位；.header 已经用 padding-top 让出了刘海，
     所以这里用固定值，不能再叠加 env(safe-area-inset-top)，否则 iOS 会多下移一份。 */
  --g-bar-top: 10px;
  /* 侧栏抽屉是 fixed 到视口的，需要自己叠加安全区 */
  --g-edge-top: calc(5px + env(safe-area-inset-top, 0px));
  --g-edge-left: calc(10px + env(safe-area-inset-left, 0px));
}

@media (min-width: 871px) {
  :host([glass-on]) {
    --g-dock-bottom: ${CONFIG.dock.bottomDesktop ?? 5}px;
  }
}

/* ==========================================================================
   配色：暗色 / 亮色两套，跟随 HA 的深浅色设置
   ========================================================================== */
:host([glass-on]) {
  --g-scrim: linear-gradient(180deg, rgba(8,8,10,.86) 0%, rgba(8,8,10,.52) 58%, rgba(8,8,10,0) 100%);
  --g-btn-fg: #f5f5f7;
  --g-title: #ffffff;
  --g-title-shadow: 0 1px 3px rgba(0,0,0,.45);
  --g-dock-glass-surface: rgba(69, 69, 69, .50);
  --g-dock-surface-band: linear-gradient(180deg,
    rgba(69,69,69,.50) 0%, rgba(69,69,69,.50) 50%, rgba(69,69,69,.50) 100%);
  /* 侧栏（1.1.1）用的 tint / band */
  --g-dock-tint: rgba(14, 14, 18, .16);
  --g-dock-band: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.05) 50%, rgba(255,255,255,.035) 100%);
  --g-sidebar-tint: rgba(14, 14, 18, .90);
  --g-dock-filter: blur(5px) saturate(180%) brightness(1.10);
  --g-dock-inner: none;
  --g-dock-outer: 0 18px 40px -16px rgba(0,0,0,.70), 0 3px 10px rgba(0,0,0,.25);
  --g-dock-rim: linear-gradient(135deg,
    rgba(93,93,93,.80) 0%, rgba(93,93,93,.80) 25%,
    rgba(69,69,69,.80) 65%, rgba(93,93,93,.80) 100%);
  --g-rim: linear-gradient(135deg,
    rgba(255,255,255,.55) 0%, rgba(255,255,255,.33) 18%,
    rgba(255,255,255,.10) 42%, rgba(255,255,255,.06) 58%,
    rgba(255,255,255,.18) 82%, rgba(255,255,255,.40) 100%);
  --g-rim-w: .5px;
  --g-icon-color: #ffffff;
  --g-icon-active: var(--primary-color, var(--accent-color, #3b82f6));
  /* 高亮块跟侧栏选中按钮同款暗蓝：与 HA 的 ha-list-item-button.selected::before
     用同一个颜色变量和同一档透明度，深浅色自动跟随主题。 */
  --g-lens-bg: color-mix(
    in srgb,
    var(--sidebar-selected-icon-color, var(--primary-color, #009ac7))
      calc(var(--dark-divider-opacity, .12) * 100%),
    transparent
  );
  --g-lens-shadow: none;
}

:host([glass-on][glass-light]) {
  --g-scrim: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(255,255,255,.70) 58%, rgba(255,255,255,0) 100%);
  --g-btn-fg: #16171c;
  --g-title: #16171c;
  --g-title-shadow: 0 1px 2px rgba(255,255,255,.7);
  --g-dock-glass-surface: rgba(245, 245, 245, .50);
  --g-dock-surface-band: linear-gradient(180deg,
    rgba(245,245,245,.78) 0%, rgba(242,243,245,.74) 45%, rgba(238,240,243,.70) 100%);
  /* 侧栏（1.1.1）用的 tint / band */
  --g-dock-tint: rgba(255, 255, 255, .24);
  --g-dock-band: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 45%, rgba(255,255,255,0) 100%);
  --g-sidebar-tint: rgba(255, 255, 255, .90);
  --g-dock-filter: blur(5px) saturate(185%) brightness(1.02);
  --g-dock-inner: none;
  --g-dock-outer: 0 14px 32px -14px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.06);
  --g-dock-rim: linear-gradient(180deg,
    rgba(225,225,225,.98) 0%, rgba(223,224,225,.92) 55%,
    rgba(218,220,223,.88) 100%);
  --g-rim: linear-gradient(180deg,
    rgba(255,255,255,1) 0%, rgba(255,255,255,.85) 34%, rgba(0,0,0,.05) 78%, rgba(0,0,0,.09) 100%);
  --g-rim-w: .5px;
  --g-icon-color: #16171c;
  --g-icon-active: var(--primary-color, var(--accent-color, #3b82f6));
  /* 明亮模式也跟侧栏选中按钮保持一致（颜色 / 透明度都取自 HA 主题变量） */
  --g-lens-bg: color-mix(
    in srgb,
    var(--sidebar-selected-icon-color, var(--primary-color, #009ac7))
      calc(var(--dark-divider-opacity, .12) * 100%),
    transparent
  );
  --g-lens-shadow: none;
}

/* ==========================================================================
   顶栏
   ========================================================================== */
/* 非玻璃模式（编辑仪表盘）时藏掉注入的圆钮 */
/* 非玻璃模式（编辑仪表盘）时藏掉注入的元素 */
:host(:not([glass-on])) .glass-title,
:host(:not([glass-on])) .glass-menu { display: none !important; }

${P} .header {
  z-index: 28 !important;
  background: var(--g-scrim) !important;
  box-shadow: none !important;
  border: none !important;
}
/* HA 的 .toolbar 自带一条 1px 分隔线，去掉 */
${P} .toolbar {
  position: relative !important;
  z-index: 28 !important;
  border-bottom: none !important;
  /* HA 桌面工具栏默认右内边距 12px；收至 4px，让 ⋮ 外缘与屏幕保持 5px */
  padding-right: calc(9px + env(safe-area-inset-right, 0px)) !important;
}
/* 原生 ☰ 在桌面端本来就是空的，按侧栏状态显示自定义 .glass-menu */
${P} ha-menu-button { display: none !important; }

/* 菜单打开时的透明遮罩：点外面只关菜单，不点到底下的卡片 */
${P} .glass-menu-scrim {
  position: fixed !important;
  inset: 0 !important;
  z-index: 29 !important;
  background: transparent !important;
  pointer-events: auto !important;
  -webkit-tap-highlight-color: transparent;
}

/* 只有一个视图时 HA 会显示 main-title（左上角那行字），我们已有居中标题，藏掉 */
:host([glass-on][glass-no-tabs]) .toolbar .main-title {
  display: none !important;
}

/* ================= 子视图自己搭的底栏（HA 在子视图里不渲染 tab 栏） ================= */
${P} .glass-custom-dock {
  position: fixed !important;
  left: calc(var(--glass-left, 0px) + var(--glass-width, 100vw) / 2) !important;
  bottom: var(--g-dock-bottom) !important;
  transform: translateX(-50%) !important;
  width: var(--glass-dock-width, min(calc(var(--glass-width, 100vw) - 34px), var(--g-dock-w))) !important;
  height: var(--g-dock-h) !important;
  margin: 0 !important;
  padding: var(--g-dock-pad) !important;
  box-sizing: border-box !important;
  border-radius: var(--g-dock-radius) !important;
  background: transparent !important;
  -webkit-backdrop-filter: var(--g-dock-filter) !important;
  backdrop-filter: var(--g-dock-filter) !important;
  box-shadow: var(--g-dock-outer) !important;
  display: flex !important;
  align-items: center !important;
  z-index: 28 !important;
}
${P} .glass-custom-dock::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--g-dock-surface-band);
  pointer-events: none;
  z-index: 0;
}
${P} .glass-custom-dock::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--g-rim-w, 1px);
  background: var(--g-dock-rim);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 3;
}
${P} .glass-custom-dock .glass-custom-tab {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  min-width: 0;
  height: var(--g-tab-h);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--g-tab-radius);
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--g-icon-color);
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
${P} .glass-custom-dock .glass-custom-tab ha-icon {
  --mdc-icon-size: var(--g-icon) !important;
  color: inherit;
}
${P} .glass-custom-dock .glass-custom-tab:active {
  transform: scale(.96);
}
${P} .glass-custom-dock .glass-custom-tab[data-glass-active] {
  background: var(--g-lens-bg);
  color: var(--g-icon-active);
}

/* 顶栏标题（内容来自页面第一行的 h1，没有就用视图 title） */
${P} .glass-title {
  position: absolute !important;
  left: 50% !important;
  top: calc(50% + var(--g-bar-top) - 5px) !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: ${CONFIG.titleTextSize}px !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  letter-spacing: .5px !important;
  white-space: nowrap !important;
  color: var(--g-title) !important;
  text-shadow: var(--g-title-shadow) !important;
  pointer-events: none !important;
  z-index: 31 !important;
}

${P} .glass-menu {
  position: absolute;
  left: var(--g-edge-left);
  top: calc(50% + var(--g-bar-top) - 5px);
  transform: translateY(-50%);
  width: var(--g-btn);
  height: var(--g-btn);
  padding: 0;
  margin: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  /* 与底栏统一：同一套表面渐变、同样的模糊，边框和阴影见下方共用规则 */
  background: var(--g-dock-surface-band);
  -webkit-backdrop-filter: var(--g-dock-filter);
  backdrop-filter: var(--g-dock-filter);
  box-shadow: var(--g-dock-outer);
  color: var(--g-btn-fg);
  cursor: pointer;
  z-index: 30;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s ease;
}
:host([glass-sidebar-open]) .glass-menu {
  opacity: 0 !important;
  pointer-events: none !important;
}
:host([glass-overflow-open]) .action-items ha-dropdown ha-icon-button {
  opacity: 0 !important;
  pointer-events: none !important;
}
${P} .glass-menu svg {
  width: var(--g-btn-icon);
  height: var(--g-btn-icon);
  display: block;
  fill: currentColor;
}
${P} .glass-menu:active { transform: translateY(-50%) scale(.93); }

/* ☰ / ⋮ 与底栏共用同一条边框渐变，保证质感一致 */
${P} .glass-menu::after,
${P} .action-items ha-dropdown ha-icon-button::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  padding: var(--g-rim-w, 1px);
  background: var(--g-dock-rim);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

/* ☰ / ⋮ 也套用底栏的内侧高光：上下两端最亮、往中间迅速衰减。
   用子选择器限定「独立圆钮」的情况，胶囊内的图标按钮由胶囊统一提供高光。 */
:host([glass-on]:not([glass-light])) .glass-menu::before,
:host([glass-on]:not([glass-light])) .action-items > ha-dropdown ha-icon-button::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgba(105, 108, 113, .55),
    inset 0 0 2px 1px rgba(105, 108, 113, .28);
  -webkit-mask-image: linear-gradient(180deg,
    #000 0,
    transparent calc(50% - 10px),
    transparent calc(50% + 10px),
    #000 100%);
  mask-image: linear-gradient(180deg,
    #000 0,
    transparent calc(50% - 10px),
    transparent calc(50% + 10px),
    #000 100%);
}
:host([glass-on][glass-light]) .glass-menu::before,
:host([glass-on][glass-light]) .action-items > ha-dropdown ha-icon-button::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 1),
    inset 0 0 2px 1px rgba(255, 255, 255, .30);
  -webkit-mask-image: linear-gradient(180deg,
    #000 0,
    transparent 5px,
    transparent calc(100% - 5px),
    #000 100%);
  mask-image: linear-gradient(180deg,
    #000 0,
    transparent 5px,
    transparent calc(100% - 5px),
    #000 100%);
}

/* ==========================================================================
   右上 ⋮
   ========================================================================== */
${P} .action-items { margin-left: auto !important; }
/* 隐藏按钮栏里除下拉触发器以外的原生按钮。
   注意：不要用 #button-0 / #button-1 这些 id —— 窄屏下 HA 换了一套渲染，
   下拉触发器的 id 会变成 dashboardmenu，额外按钮也不存在。 */
${P} .action-items > ha-icon-button { display: none !important; }

${P} .action-items ha-dropdown ha-icon-button {
  position: relative !important;
  width: var(--g-btn) !important;
  height: var(--g-btn) !important;
  /* 移动端 toolbar 与视口对齐：右内边距 9px + 按钮外边距 1px = 10px */
  margin: 0 1px 0 0 !important;
  top: calc(var(--g-bar-top) - 5px) !important;
  padding: 0 !important;
  border-radius: 50% !important;
  background: var(--g-dock-surface-band) !important;
  -webkit-backdrop-filter: var(--g-dock-filter) !important;
  backdrop-filter: var(--g-dock-filter) !important;
  box-shadow: var(--g-dock-outer) !important;
  color: var(--g-btn-fg) !important;
  overflow: hidden;
}
/* 桌面端 HA 的 toolbar 右侧会多延伸一个滚动条槽宽；多内缩 10px，
   让圆钮离可视屏幕边缘仍与移动端一样保持 10px。 */
@media (min-width: 871px) {
  ${P} .action-items ha-dropdown ha-icon-button {
    margin-right: 11px !important;
  }
}
${P} .action-items ha-dropdown ha-icon-button ha-button {
  --ha-button-height: var(--g-btn);
  --ha-button-padding: 0;
  width: var(--g-btn);
  height: var(--g-btn);
  border-radius: 50%;
  background: transparent;
}

/* PC：把顶栏右侧 4 个原生控件（搜索 / 语音 / 编辑 / 更多）装进一个胶囊。
   控件节点本身被移入胶囊，所以图标与点击行为仍是 HA 原生的。 */
${P} .glass-actions-capsule {
  position: fixed;
  display: none;
  align-items: center;
  gap: 10px;
  padding: 0;
  margin: 0;
  border-radius: 999px;
  z-index: 31;
  overflow: hidden;
  -webkit-backdrop-filter: var(--g-dock-filter);
  backdrop-filter: var(--g-dock-filter);
  background: var(--g-dock-surface-band);
  box-shadow: var(--g-dock-outer);
}
/* 胶囊内不再给单个按钮画边框：四个按钮共用胶囊这一圈 */
${P} .glass-actions-capsule ha-icon-button::after,
${P} .glass-actions-capsule ha-icon-button::before {
  content: none !important;
  display: none !important;
  background: none !important;
}
/* 图标缩小 10%（原生 24px → 21.6px），靠按钮自身居中 */
${P} .glass-actions-capsule ha-icon-button {
  --mdc-icon-size: 21.6px;
}

/* 深色模式：边框内侧 3px 的高光渐变。
   最外圈 1px 亮灰(105,108,113)，向内约 2px 迅速衰减到底色；
   高光强度随“离垂直中线的高度”变化：上下两极最强，
   垂直中线 ±10px 范围内完全没有高光（左右顶点也落在该区间内）。 */
:host([glass-on]:not([glass-light])) .glass-actions-capsule::before,
:host([glass-on]:not([glass-light])) .toolbar ha-tab-group::part(base)::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgba(105, 108, 113, .55),
    inset 0 0 2px 1px rgba(105, 108, 113, .28);
  -webkit-mask-image: linear-gradient(180deg,
    #000 0,
    transparent calc(50% - 10px),
    transparent calc(50% + 10px),
    #000 100%);
  mask-image: linear-gradient(180deg,
    #000 0,
    transparent calc(50% - 10px),
    transparent calc(50% + 10px),
    #000 100%);
}

/* 明亮模式：边框内侧 3px 高光。
   最外圈 1px 纯白，向内约 2px 迅速衰减到底色；
   只有距离上下边缘 5px 之内有高光：边缘处为纯白，往里 5px 渐变到背景色，
   再往中线方向完全没有高光。 */
:host([glass-on][glass-light]) .glass-actions-capsule::before,
:host([glass-on][glass-light]) .toolbar ha-tab-group::part(base)::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 1),
    inset 0 0 2px 1px rgba(255, 255, 255, .30);
  -webkit-mask-image: linear-gradient(180deg,
    #000 0,
    transparent 5px,
    transparent calc(100% - 5px),
    #000 100%);
  mask-image: linear-gradient(180deg,
    #000 0,
    transparent 5px,
    transparent calc(100% - 5px),
    #000 100%);
}
${P} .glass-actions-capsule > ha-icon-button,
${P} .glass-actions-capsule > ha-dropdown {
  position: relative !important;
  top: 0 !important;
  margin: 0 !important;
  width: var(--g-btn) !important;
  height: 100% !important;
  flex: 0 0 auto !important;
  background: transparent !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
${P} .glass-actions-capsule > ha-dropdown ha-icon-button {
  top: 0 !important;
  margin: 0 !important;
  width: var(--g-btn) !important;
  height: var(--g-btn) !important;
  background: transparent !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}
${P} .glass-actions-capsule::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--g-rim-w, 1px);
  background: var(--g-dock-rim);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

/* ==========================================================================
   底部 dock
   ========================================================================== */
${P} .toolbar ha-tab-group {
  position: fixed !important;
  left: calc(var(--glass-left, 0px) + var(--glass-width, 100vw) / 2) !important;
  bottom: var(--g-dock-bottom) !important;
  transform: translateX(-50%) !important;
  width: var(--glass-dock-width, min(calc(var(--glass-width, 100vw) - 34px), var(--g-dock-w))) !important;
  height: var(--g-dock-h) !important;
  min-height: 0 !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  border-radius: var(--g-dock-radius) !important;
  background: transparent !important;
  -webkit-backdrop-filter: var(--g-dock-filter) !important;
  backdrop-filter: var(--g-dock-filter) !important;
  border: none !important;
  box-shadow: var(--g-dock-outer) !important;
  z-index: 28 !important;
  display: flex !important;
  align-items: center !important;
  overflow: visible !important;
  /* 底栏上不允许上下滚动页面；左右滑动交给长按拖动手势 */
  touch-action: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}

${P} .toolbar ha-tab-group::part(base) {
  position: relative !important;
  z-index: 1 !important;
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: var(--g-dock-radius) !important;
  background: var(--g-dock-surface-band) !important;
  box-shadow: var(--g-dock-inner) !important;
}

/* 高光边：渐变 + 只用 1px（0.5px 在手机上就是发丝线）。
   画在 part(base) 的 ::before 上、并压在 nav 下面：按住放大的黑色高亮块会盖住它
   （块在胶囊之上），而图标仍然在块之上 —— 层级：胶囊底色 < 高光边 < 黑块 < 图标。 */
${P} .toolbar ha-tab-group::part(base)::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--g-rim-w, 1px);
  background: var(--g-dock-rim);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
  z-index: 0;
}

/* nav 必须叠在高光边上面，否则那条边线会压在黑色高亮块上 */
${P} .toolbar ha-tab-group::part(nav) {
  position: relative !important;
  z-index: 1 !important;
}

/* 原生 tab 就嵌在 part=nav 里（不能隐藏它），.nav 是自适应高度，
   所以用纵向 flex 把它垂直居中 */
${P} .toolbar ha-tab-group::part(nav) {
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  background: none !important;
}

/* .nav / .tabs 是 tab 的滚动容器（overflow:auto），太矮会把高亮块裁掉一条。
   这里把 .tabs 撑到整个胶囊高度、只留 inset 边距。 */
${P} .toolbar ha-tab-group::part(tabs) {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  height: var(--g-dock-h) !important;
  padding: var(--g-dock-pad) !important;
  box-sizing: border-box !important;
  overflow: visible !important;
  border-bottom: none !important;
  background: none !important;
}

/* 每个 tab = 1/5 宽的胶囊。注意 HA 自带 margin-bottom:-2px，会把圆/投影切掉一条 */
${P} .toolbar ha-tab-group-tab {
  flex: 1 1 0 !important;
  width: auto !important;
  min-width: 0 !important;
  height: var(--g-tab-h) !important;
  margin: 0 !important;
  border-radius: var(--g-tab-radius) !important;
  display: grid !important;
  place-items: center !important;
  position: relative !important;
  z-index: 1 !important;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  border-bottom: none !important;
  color: var(--g-icon-color) !important;
  -webkit-tap-highlight-color: transparent;
  transition: transform .12s ease, color .22s ease;
}
${P} .toolbar ha-tab-group-tab::part(base) {
  padding: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
  width: 100% !important;
  height: 100% !important;
  border-radius: inherit !important;
  background: transparent !important;
  border-bottom: none !important;
}
/* HA 自己那行 tab 文字：我们已经在下面画了一份，避免视图没图标时出现两行 */
${P} .toolbar ha-tab-group-tab > span:not(.glass-tab-label):not(.glass-tint) {
  display: none !important;
}
/* 图标下面那行小字（内容 = 视图标题） */
${P} .glass-tab-label {
  display: block;
  max-width: 100%;
  font-size: ${CONFIG.tabLabelSize}px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: .2px;
  color: inherit;
  opacity: .92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
${P} .toolbar ha-tab-group-tab ha-icon {
  --mdc-icon-size: var(--g-icon) !important;
  --icon-primary-color: currentColor !important;
  color: inherit !important;
}
${P} .toolbar ha-tab-group-tab:active { transform: scale(.96); }
/* The lens moves under the pointer; don't scale the pressed tab during a drag.
   That pressed-state transform makes its icon/label appear to jump and snap back. */
${P} .toolbar ha-tab-group.glass-dragging ha-tab-group-tab:active {
  transform: none !important;
}

/* 子视图不进底栏 */
${P} .toolbar ha-tab-group-tab[data-glass-hidden] {
  display: none !important;
}

/* v1.1.1 tint behavior: show the accent glyph only inside the moving capsule clip. */
${P} .toolbar ha-tab-group-tab .glass-tint {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--g-icon-active);
  pointer-events: none;
  z-index: 2;
  clip-path: inset(0 100% 0 0);
  -webkit-clip-path: inset(0 100% 0 0);
}

/* dock 浮在内容上，底部留出空间，避免盖住最后一行 */
${P} hui-view-container {
  padding-bottom: calc(var(--g-dock-h) + 38px) !important;
}

`;

  const log = (...a) => console.log("[glass-ui]", ...a);

  function parts() {
    const ha = document.querySelector("home-assistant");
    const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector("home-assistant-main");
    const drawer = main && main.shadowRoot && main.shadowRoot.querySelector("ha-drawer");
    const panel = drawer && drawer.querySelector("ha-panel-lovelace");
    const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector("hui-root");
    return { ha, main, drawer, panel, root };
  }

  // Search the active drawer's light / open shadow DOM for the current page's
  // top-app-bar surface (dashboard and non-dashboard pages use different hosts).
  function findInTree(node, selector) {
    const seen = new Set();
    const walk = (current) => {
      if (!current || seen.has(current)) return null;
      seen.add(current);
      let found = null;
      try {
        found = current.querySelector && current.querySelector(selector);
      } catch (e) {
        /* ignore */
      }
      if (found) return found;
      if (current.shadowRoot) {
        found = walk(current.shadowRoot);
        if (found) return found;
      }
      for (const child of current.children || []) {
        found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(node);
  }

  // Android's status bar is outside the webpage. `theme-color` cannot make it
  // genuinely transparent in the Companion WebView, but matching its solid
  // color to the top edge of the active app bar makes it visually blend in.
  const isAndroid = /Android/i.test(navigator.userAgent);
  let statusColorContext = null;

  function parseStatusColor(value) {
    if (!value) return null;
    if (!statusColorContext) {
      statusColorContext = document.createElement("canvas").getContext("2d");
    }
    if (!statusColorContext) return null;
    statusColorContext.fillStyle = "#010203";
    statusColorContext.fillStyle = value;
    const normalized = statusColorContext.fillStyle;
    const hex = normalized.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      let value = hex[1];
      if (value.length === 3 || value.length === 4) {
        value = Array.from(value, (digit) => digit + digit).join("");
      }
      const hasAlpha = value.length === 8;
      const n = parseInt(value.slice(0, 6), 16);
      return {
        r: (n >> 16) & 255,
        g: (n >> 8) & 255,
        b: n & 255,
        a: hasAlpha ? parseInt(value.slice(6, 8), 16) / 255 : 1,
      };
    }
    const rgb = normalized.match(
      /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i
    );
    if (!rgb) return null;
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }

  function androidStatusBarColor(header, root) {
    const base =
      parseStatusColor(
        (root && getComputedStyle(root).getPropertyValue("--primary-background-color")) ||
          getComputedStyle(document.documentElement).getPropertyValue(
            "--primary-background-color"
          )
      ) || { r: 17, g: 17, b: 17, a: 1 };
    if (!header) return base;

    const style = getComputedStyle(header);
    const solid = parseStatusColor(style.backgroundColor);
    if (solid && solid.a >= 0.99) return solid;

    // For glass gradients, match the first (topmost) color stop.
    const stop = (style.backgroundImage || "").match(
      /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/i
    );
    const foreground = stop && parseStatusColor(stop[0]);
    if (!foreground) return solid && solid.a > 0 ? solid : base;
    const a = Math.max(0, Math.min(1, foreground.a));
    return {
      r: foreground.r * a + base.r * (1 - a),
      g: foreground.g * a + base.g * (1 - a),
      b: foreground.b * a + base.b * (1 - a),
      a: 1,
    };
  }

  function syncAndroidStatusBarColor(header, root) {
    if (!isAndroid) return;
    const color = androidStatusBarColor(header, root);
    const hex = "#" + [color.r, color.g, color.b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("");
    let metas = Array.from(
      document.head.querySelectorAll('meta[name="theme-color"]')
    );
    if (!metas.length) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
      metas = [meta];
    }
    metas.forEach((meta) => {
      if (meta.content !== hex) meta.content = hex;
    });
  }

  function isTargetDashboard() {
    if (CONFIG.dashboards.includes("*")) return true;
    const seg = location.pathname.split("/").filter(Boolean);
    return CONFIG.dashboards.includes(seg[0]);
  }

  function toggleSidebar() {
    const { main } = parts();
    if (!main) return;
    // 用 HA 自己的事件，不直接改 ha-drawer：
    //   窄屏(<=870px) → 打开/关闭侧边栏抽屉
    //   宽屏         → 停靠/收起侧边栏（与 HA 原生 ☰ 完全一致）
    main.dispatchEvent(
      new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
    );
  }

  // ---- 仅迁移旧版脚本留下的侧栏设置 --------------------------------------
  // 旧版曾强制把侧栏改成 always_hidden，并写入此标记。只对有旧标记的实例
  // 恢复一次 HA 默认 auto；之后永远不再写 dockedSidebar，尊重用户自己的设置。
  const SIDEBAR_FLAG = "glass-ui.sidebar-collapsed";
  let legacySidebarMigrated = false;

  function dockSidebar(value) {
    const ha = document.querySelector("home-assistant");
    if (!ha) return;
    ha.dispatchEvent(
      new CustomEvent("hass-dock-sidebar", {
        detail: { dock: value },
        bubbles: true,
        composed: true,
      })
    );
  }

  function migrateLegacySidebarMode() {
    if (legacySidebarMigrated) return;
    const { ha } = parts();
    if (!ha || !ha.hass || !ha.hass.dockedSidebar) return;
    legacySidebarMigrated = true;
    let ours = false;
    try {
      ours = localStorage.getItem(SIDEBAR_FLAG) === "1";
      if (ours) localStorage.removeItem(SIDEBAR_FLAG);
    } catch (e) {
      /* ignore */
    }
    if (ours && ha.hass.dockedSidebar === "always_hidden") {
      dockSidebar("auto");
    }
  }

  function currentView(panel) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
    const seg = location.pathname.split("/").filter(Boolean);
    const cur = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
    const i = views.findIndex((v) => v.path === cur);
    return (i === -1 ? views[0] : views[i]) || null;
  }

  // 深层 shadow 查询（hui-view-header → hui-markdown-card → ha-card → ha-markdown 这种嵌套）
  function deepQuery(root, selector, depth = 4) {
    if (!root) return null;
    const direct = root.querySelector(selector);
    if (direct) return direct;
    if (depth <= 0) return null;
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) {
        const found = deepQuery(el.shadowRoot, selector, depth - 1);
        if (found) return found;
      }
    }
    return null;
  }

  function findViewHeader(root) {
    const sr = root.shadowRoot;
    let header = sr.querySelector("hui-view-header");
    if (!header) {
      for (const el of sr.querySelectorAll(
        "hui-sections-view, hui-masonry-view, hui-panel-view, hui-view"
      )) {
        header = el.shadowRoot
          ? el.shadowRoot.querySelector("hui-view-header")
          : null;
        if (header) break;
      }
    }
    return header;
  }

  // 当前视图的 header 卡片里，除了 `# 标题` 那行还有没有别的内容
  function viewHasBody(panel) {
    const view = currentView(panel);
    const card = view && view.header && view.header.card;
    const content = card && typeof card.content === "string" ? card.content : "";
    if (!content.trim()) return false;
    const lines = content.split("\n");
    const hasHeading = /^#\s+/.test((lines[0] || "").trim());
    const body = hasHeading ? lines.slice(1).join("\n").trim() : content.trim();
    return body !== "";
  }

  // 顶栏标题：把视图 header 里那个 h1 节点**直接搬到**顶栏（.toolbar 里），
  // 顶栏标题取值：① 优先页面第一行的 h1（`# ...`）
  //              ② 没有就用视图 title
  //              ③ 都没有留空（每次都重新写，避免残留上一个页面的标题）
  function viewTitleText(panel) {
    const view = currentView(panel);
    if (!view) return "";
    const card = view.header && view.header.card;
    const content = card && typeof card.content === "string" ? card.content : "";
    const first = (content.split("\n")[0] || "").trim();
    const m = first.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
    return typeof view.title === "string" ? view.title.trim() : "";
  }

  function injectTitle(toolbar, panel, show = true) {
    let el = toolbar.querySelector(".glass-title");
    const text = show ? viewTitleText(panel) : "";
    if (!text) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.className = "glass-title";
      toolbar.appendChild(el);
    }
    if (el.textContent !== text) el.textContent = text;
  }

  // 卡片里除了标题没别的内容时，把这一整行收掉
  // （卡片的 wrapper 有 min-height，只隐藏卡片本身不够）
  function setCardRowHidden(header, hidden) {
    const card = header.shadowRoot
      ? header.shadowRoot.querySelector("hui-markdown-card")
      : null;
    if (!card) return;
    // 往上找"还包含其它兄弟节点（徽章）"的那一层，作为停止边界
    let row = null;
    let probe = card;
    let guard = 0;
    while (probe && probe.parentElement && probe.parentElement !== header && guard < 6) {
      const parent = probe.parentElement;
      if (parent.children.length > 1) {
        row = parent;
        break;
      }
      probe = parent;
      guard++;
    }
    let el = card;
    guard = 0;
    while (el && el !== row && el !== header && guard < 6) {
      if (hidden) el.style.setProperty("display", "none", "important");
      else el.style.removeProperty("display");
      el = el.parentElement;
      guard++;
    }
  }

  // header 里那行 h1 只是取文字用，显示时隐藏掉（不占高度）
  function syncViewTitle(root, panel, on) {
    const header = findViewHeader(root);
    if (!header) return;
    const md = deepQuery(header.shadowRoot || header, "ha-markdown", 5);

    if (md && md.shadowRoot) {
      const style = md.shadowRoot.querySelector("#glass-hide-h1");
      if (on && !style) {
        const s = document.createElement("style");
        s.id = "glass-hide-h1";
        s.textContent = "ha-markdown-element h1 { display: none !important; }";
        md.shadowRoot.appendChild(s);
      } else if (!on && style) {
        style.remove();
      }
    }

    if (!on) {
      setCardRowHidden(header, false);
      return;
    }
    setCardRowHidden(header, !viewHasBody(panel));
  }

  function injectStyle(root) {
    let style = root.shadowRoot.querySelector("#glass-ui-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "glass-ui-style";
      root.shadowRoot.appendChild(style);
    }
    // A Lovelace root can outlive a module reload. Refresh the existing
    // stylesheet so cached/older injected CSS cannot override the current tint.
    if (style.textContent !== CSS) style.textContent = CSS;
  }

  function injectMenuButton(toolbar) {
    if (toolbar.querySelector(".glass-menu")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "glass-menu";
    btn.setAttribute("aria-label", "打开侧边栏");
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_MENU}"></path></svg>`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleSidebar();
    });
    toolbar.appendChild(btn);
  }

  function syncMenuButton(toolbar, ha, isSubview) {
    const button = toolbar.querySelector(".glass-menu");
    const narrow = window.matchMedia("(max-width: 870px)").matches;
    const sidebarHidden = ha?.hass?.dockedSidebar === "always_hidden";
    const shouldShow = !isSubview && (narrow || sidebarHidden);

    if (shouldShow) {
      if (!button) injectMenuButton(toolbar);
    } else if (button) {
      button.remove();
    }
  }

  function restyleOverflow(toolbar) {
    if (!CONFIG.replaceOverflowIcon) return;
    const trigger = toolbar.querySelector(".action-items ha-dropdown ha-icon-button");
    if (trigger && trigger.path !== ICON_DOTS) trigger.path = ICON_DOTS;
  }

  // 菜单和圆钮贴太近，往下挪一点（wa-popup 的 distance）
  function offsetOverflowMenu(toolbar) {
    const dd = toolbar.querySelector(".action-items ha-dropdown");
    const popup = dd && dd.shadowRoot ? dd.shadowRoot.querySelector("wa-popup") : null;
    if (!popup) return;
    const want = String(menuDistance);
    if (popup.getAttribute("distance") !== want) {
      popup.setAttribute("distance", want);
    }
    const edge = String(CONFIG.overflowMenuEdge ?? 5);
    if (popup.getAttribute("shift-padding") !== edge) {
      popup.setAttribute("shift-padding", edge);
    }
  }

  // 菜单打开时铺一层透明遮罩：点菜单以外的地方只关菜单，不会点到下面的卡片
  const SIDEBAR_GLASS_STYLE_ID = "glass-sidebar-frame-style";
  const SIDEBAR_DOCKED_STYLE_ID = "glass-sidebar-docked-style";
  const SIDEBAR_PAGE_BG_STYLE_ID = "glass-sidebar-page-background-style";
  const SIDEBAR_BACKDROP_STYLE_ID = "glass-sidebar-backdrop-style";
  const SIDEBAR_CONTENT_STYLE_ID = "glass-sidebar-content-style";
  const SIDEBAR_GLASS_VARS = [
    "--g-dock-tint",
    "--g-sidebar-tint",
    "--g-dock-bottom",
    "--g-edge-top",
    "--g-edge-left",
    "--g-dock-filter",
    "--g-dock-band",
    "--g-dock-outer",
    "--g-rim",
    "--g-rim-w",
    "--g-dock-radius",
    "--g-sidebar-radius",
  ];
  const sidebarOriginalVars = new WeakMap();

  // Frame the native HA drawer without changing its contents or width.
  // Copy glass tokens from hui-root because the drawer is outside its shadow tree.
  function styleSidebarFrame(drawer, root, light) {
    if (!drawer || !drawer.shadowRoot) return;
    const wa = drawer.shadowRoot.querySelector("wa-drawer");
    // 三种侧栏状态都要装进同一套玻璃圆角框：
    //   modal             —— ☰ 呼出的悬浮抽屉（手机 / PC 收起侧栏时）
    //   docked (expanded) —— 宽屏常驻展开
    //   docked (collapsed)—— 宽屏常驻折叠成图标窄条
    const modal =
      drawer.getAttribute("type") === "modal" ||
      !!(wa && wa.getAttribute("type") === "modal");
    // docked 模式下没有 wa-drawer，CSS 变量放到 ha-drawer 上，
    // 这样它的 shadow 样式和 ha-sidebar 的 shadow 样式都能继承到。
    const target = modal ? wa : drawer;
    if (!target) return;
    if (root) {
      root.toggleAttribute("glass-sidebar-docked", !modal);
    }
    // Extend only the active page's top-bar background behind the floating
    // sidebar. Keep the toolbar and all its controls at their native positions.
    let pageHeader =
      root && root.shadowRoot && root.shadowRoot.querySelector(".header");
    if (!pageHeader) {
      const topAppBar = findInTree(drawer, "ha-top-app-bar-fixed");
      pageHeader =
        topAppBar &&
        topAppBar.shadowRoot &&
        (topAppBar.shadowRoot.querySelector("header") ||
          topAppBar.shadowRoot.querySelector(".top-app-bar"));
    }
    syncAndroidStatusBarColor(pageHeader, root);
    if (!modal && pageHeader) {
      const headerStyle = getComputedStyle(pageHeader);
      drawer.style.setProperty(
        "--g-page-header-bg",
        headerStyle.backgroundColor || "transparent"
      );
      drawer.style.setProperty(
        "--g-page-header-image",
        headerStyle.backgroundImage || "none"
      );
      drawer.style.setProperty(
        "--g-page-header-height",
        Math.round(pageHeader.getBoundingClientRect().height) + "px"
      );
    } else {
      drawer.style.removeProperty("--g-page-header-bg");
      drawer.style.removeProperty("--g-page-header-image");
      drawer.style.removeProperty("--g-page-header-height");
    }
    // 切模式时清掉另一种模式留下的样式 / 变量
    restoreSidebarFrame(drawer, modal);

    const rootStyle = root ? getComputedStyle(root) : null;
    const fallbackVars = {
      "--g-dock-tint": light ? "rgba(255, 255, 255, .24)" : "rgba(14, 14, 18, .16)",
      "--g-sidebar-tint": light ? "rgba(255, 255, 255, .90)" : "rgba(14, 14, 18, .90)",
      "--g-dock-bottom": window.matchMedia("(min-width: 871px)").matches
        ? String(CONFIG.dock.bottomDesktop ?? 5) + "px"
        : dockBottom,
      "--g-edge-top": "calc(5px + env(safe-area-inset-top, 0px))",
      "--g-edge-left": "calc(10px + env(safe-area-inset-left, 0px))",
      "--g-dock-filter": light
        ? "blur(5px) saturate(185%) brightness(1.02)"
        : "blur(5px) saturate(180%) brightness(1.10)",
      "--g-dock-band": light
        ? "linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 45%, rgba(255,255,255,0) 100%)"
        : "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.05) 50%, rgba(255,255,255,.035) 100%)",
      "--g-dock-outer": light
        ? "0 14px 32px -14px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.06)"
        : "0 18px 40px -16px rgba(0,0,0,.70), 0 3px 10px rgba(0,0,0,.25)",
      "--g-rim": light
        ? "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,.85) 34%, rgba(0,0,0,.05) 78%, rgba(0,0,0,.09) 100%)"
        : "linear-gradient(135deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.33) 18%, rgba(255,255,255,.10) 42%, rgba(255,255,255,.06) 58%, rgba(255,255,255,.18) 82%, rgba(255,255,255,.40) 100%)",
      "--g-rim-w": ".5px",
      "--g-dock-radius": String(dockRadius) + "px",
      "--g-sidebar-radius": "20px",
    };

    if (!sidebarOriginalVars.has(target)) {
      sidebarOriginalVars.set(
        target,
        new Map(
          SIDEBAR_GLASS_VARS.map((name) => [
            name,
            {
              value: target.style.getPropertyValue(name),
              priority: target.style.getPropertyPriority(name),
            },
          ])
        )
      );
    }
    SIDEBAR_GLASS_VARS.forEach((name) => {
      const value =
        (rootStyle && rootStyle.getPropertyValue(name).trim()) || fallbackVars[name];
      if (value && target.style.getPropertyValue(name) !== value) {
        target.style.setProperty(name, value);
      }
    });

    // 注意：常驻侧栏（PC）没有 wa-drawer，wa 为 null，这里必须先判空。
    if (modal && wa && wa.shadowRoot) {
      const sidebarShadow = wa.shadowRoot;
      const sidebarFrameEl = sidebarShadow.getElementById(SIDEBAR_GLASS_STYLE_ID);
      if (
        sidebarFrameEl &&
        !sidebarFrameEl.textContent.includes("--g-sidebar-tint")
      ) {
        sidebarFrameEl.remove();
      }
      if (!sidebarShadow.getElementById(SIDEBAR_GLASS_STYLE_ID)) {
      const frameStyle = document.createElement("style");
      frameStyle.id = SIDEBAR_GLASS_STYLE_ID;
      frameStyle.textContent = [
        ".drawer {",
        "  z-index: 30 !important;",
        "  inset: var(--g-edge-top) auto var(--g-dock-bottom) var(--g-edge-left) !important;",
        "  height: auto !important;",
        "  max-height: none !important;",
        "  border: none !important;",
        "  border-radius: var(--g-sidebar-radius, 20px) !important;",
        "  overflow: hidden !important;",
        // 与底栏统一：同一套表面渐变 / 边框渐变 / 外阴影
        "  background: var(--g-dock-band), var(--g-sidebar-tint, var(--g-dock-tint)) !important;",
        "  -webkit-backdrop-filter: none !important;",
        "  backdrop-filter: none !important;",
        "  box-shadow: var(--g-dock-outer) !important;",
        "}",
        ".drawer::before {",
        "  content: \"\";",
        "  position: absolute;",
        "  inset: 0;",
        "  border-radius: inherit;",
        "  padding: var(--g-rim-w, 1px);",
        "  background: var(--g-rim);",
        "  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);",
        "  -webkit-mask-composite: xor;",
        "  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);",
        "  mask-composite: exclude;",
        "  pointer-events: none;",
        "  z-index: 10;",
        "}",
        ".drawer > .body {",
        "  height: 100%;",
        "  min-height: 0;",
        "  border-radius: inherit;",
        "  background: transparent !important;",
        "}",
      ].join("\n");
        sidebarShadow.appendChild(frameStyle);
      }
    }

    // 常驻侧栏（展开 / 折叠窄条）没有 wa-drawer，直接给 ha-drawer 里的
    // .sidebar-shell 套同一套玻璃圆角框；内容宽度仍由 HA 的 --ha-sidebar-width 决定。
    const oldDockedStyle =
      !modal && drawer.shadowRoot.getElementById(SIDEBAR_DOCKED_STYLE_ID);
    if (
      oldDockedStyle &&
      (!oldDockedStyle.textContent.includes("--g-page-header-height") ||
        !oldDockedStyle.textContent.includes("--g-sidebar-tint"))
    ) {
      oldDockedStyle.remove();
    }
    if (!modal && !drawer.shadowRoot.getElementById(SIDEBAR_DOCKED_STYLE_ID)) {
      const dockedStyle = document.createElement("style");
      dockedStyle.id = SIDEBAR_DOCKED_STYLE_ID;
      dockedStyle.textContent = [
        // Extend the active header's background underneath the floating sidebar.
        // The bar itself and its controls remain untouched.
        ".layout::before {",
        "  content: \"\";",
        "  position: fixed;",
        "  inset: 0 auto auto 0;",
        "  width: calc(var(--ha-sidebar-width, 0px) + var(--g-edge-left, 0px));",
        "  height: var(--g-page-header-height, var(--header-height, 56px));",
        "  background: var(--g-page-header-image, none) var(--g-page-header-bg, var(--app-header-background-color, transparent));",
        "  pointer-events: none;",
        "  z-index: 5;",
        "}",
        ".sidebar-shell {",
        "  z-index: 30 !important;",
        "  inset: var(--g-edge-top) auto var(--g-dock-bottom) var(--g-edge-left) !important;",
        "  width: var(--ha-sidebar-width) !important;",
        "  height: auto !important;",
        "  border: none !important;",
        "  border-inline-end: none !important;",
        "  border-radius: var(--g-sidebar-radius, 20px) !important;",
        "  background: var(--g-dock-band), var(--g-sidebar-tint, var(--g-dock-tint)) !important;",
        "  -webkit-backdrop-filter: none !important;",
        "  backdrop-filter: none !important;",
        "  box-shadow: var(--g-dock-outer) !important;",
        "}",
        ".sidebar-shell::before {",
        "  content: \"\";",
        "  position: absolute;",
        "  inset: 0;",
        "  border-radius: inherit;",
        "  padding: var(--g-rim-w, 1px);",
        "  background: var(--g-rim);",
        "  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);",
        "  -webkit-mask-composite: xor;",
        "  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);",
        "  mask-composite: exclude;",
        "  pointer-events: none;",
        "  z-index: 10;",
        "}",
        ".app-content {",
        "  padding-inline-start: calc(var(--ha-sidebar-width) + var(--g-edge-left)) !important;",
        "}",
      ].join("\n");
      drawer.shadowRoot.appendChild(dockedStyle);
    }

    // Lovelace's configured background is a separate full-view layer. Extend
    // that layer left underneath the sidebar without moving cards or controls.
    if (root && root.shadowRoot) {
      let pageBgStyle = root.shadowRoot.getElementById(SIDEBAR_PAGE_BG_STYLE_ID);
      if (!pageBgStyle) {
        pageBgStyle = document.createElement("style");
        pageBgStyle.id = SIDEBAR_PAGE_BG_STYLE_ID;
        pageBgStyle.textContent = [
          ":host([glass-sidebar-docked]) hui-view-background {",
          "  left: calc(0px - var(--ha-sidebar-width, 0px) - var(--g-edge-left, 0px)) !important;",
          "  right: auto !important;",
          "  width: calc(100% + var(--ha-sidebar-width, 0px) + var(--g-edge-left, 0px)) !important;",
          "  max-width: none !important;",
          "}",
        ].join("\n");
        root.shadowRoot.appendChild(pageBgStyle);
      }
    }

    if (modal && !drawer.shadowRoot.getElementById(SIDEBAR_BACKDROP_STYLE_ID)) {
      const backdropStyle = document.createElement("style");
      backdropStyle.id = SIDEBAR_BACKDROP_STYLE_ID;
      backdropStyle.textContent = [
        "wa-drawer::part(dialog)::backdrop {",
        "  background: rgba(0, 0, 0, 0.25) !important;",
        "  -webkit-backdrop-filter: none !important;",
        "  backdrop-filter: none !important;",
        "}",
      ].join("\n");
      drawer.shadowRoot.appendChild(backdropStyle);
    }

    const sidebar = drawer.querySelector("ha-sidebar");
    const sidebarShadow = sidebar && sidebar.shadowRoot;
    if (sidebarShadow && !sidebarShadow.getElementById(SIDEBAR_CONTENT_STYLE_ID)) {
      const contentStyle = document.createElement("style");
      contentStyle.id = SIDEBAR_CONTENT_STYLE_ID;
      contentStyle.textContent = [
        ":host {",
        "  background: transparent !important;",
        // 抽屉外框已经用 --g-edge-* / --g-dock-bottom 让出了刘海和 Home 指示条，
        // 这里必须把 HA 侧栏内部的 safe-area 再归零，否则移动端上下会多留一份，
        // 顶端标题和底部账号会比电脑端离边缘更远。
        "  --safe-area-inset-top: 0px !important;",
        "  --safe-area-inset-bottom: 0px !important;",
        "  --safe-area-inset-left: 0px !important;",
        "  --safe-area-inset-right: 0px !important;",
        "  padding-bottom: 0 !important;",
        "}",
        ".menu {",
        "  background: transparent !important;",
        "  height: calc(var(--header-height, 56px) - 5px) !important;",
        "  padding-top: 0 !important;",
        "}",
        "ha-list-nav { margin-left: 0 !important; }",
      ].join("\n");
      sidebarShadow.appendChild(contentStyle);
    }
  }

  function restoreSidebarVars(el) {
    if (!el) return;
    const original = sidebarOriginalVars.get(el);
    if (!original) return;
    original.forEach(({ value, priority }, name) => {
      if (value) el.style.setProperty(name, value, priority);
      else el.style.removeProperty(name);
    });
    sidebarOriginalVars.delete(el);
  }

  // keepModal=true 时清掉常驻侧栏样式（当前是抽屉）；
  // keepModal=false 时清掉抽屉样式（当前是常驻侧栏）。
  function restoreSidebarFrame(drawer, keepModal) {
    const sr = drawer && drawer.shadowRoot;
    if (!sr) return;
    const wa = sr.querySelector("wa-drawer");
    if (keepModal) {
      const docked = sr.getElementById(SIDEBAR_DOCKED_STYLE_ID);
      if (docked) docked.remove();
      restoreSidebarVars(drawer);
    } else {
      const backdrop = sr.getElementById(SIDEBAR_BACKDROP_STYLE_ID);
      if (backdrop) backdrop.remove();
      const frame =
        wa && wa.shadowRoot && wa.shadowRoot.getElementById(SIDEBAR_GLASS_STYLE_ID);
      if (frame) frame.remove();
      restoreSidebarVars(wa);
    }
    // ha-sidebar 的内容样式三种模式共用，切模式时保留
  }

  let menuScrim = null;
  let menuObserver = null;
  let swallowUntil = 0;

  // 关菜单后短暂吞掉 click / touchend（iOS 会在 touchend 后补发 click）。
  // 注意不要拦 pointerdown / pointerup —— 那会连页面滑动一起卡住。
  ["click", "touchend"].forEach((type) => {
    window.addEventListener(
      type,
      (ev) => {
        if (Date.now() < swallowUntil) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      },
      true
    );
  });

  function syncMenuScrim(root, toolbar) {
    const dd = toolbar.querySelector(".action-items ha-dropdown");
    if (!dd) return;
    root.toggleAttribute("glass-overflow-open", dd.hasAttribute("open"));

    if (!menuObserver) {
      menuObserver = new MutationObserver(() => {
        const opened = dd.hasAttribute("open");
        root.toggleAttribute("glass-overflow-open", opened);
        if (opened) {
          if (!menuScrim || !menuScrim.isConnected) {
            menuScrim = document.createElement("div");
            menuScrim.className = "glass-menu-scrim";
            const closeIt = (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              // 只吞后续的 click / touchend，不拦 pointer 事件，否则页面滑动会被卡住
              swallowUntil = Date.now() + 400;
              closeOverflowMenu();
            };
            menuScrim.addEventListener("pointerdown", closeIt, true);
            menuScrim.addEventListener("touchstart", closeIt, {
              capture: true,
              passive: false,
            });
            menuScrim.addEventListener(
              "click",
              (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
              },
              true
            );
            root.shadowRoot.appendChild(menuScrim);
          }
        } else if (menuScrim) {
          // 立刻撤掉遮罩：留着会挡住页面滑动（那 400ms 只靠上面的 click/touchend 兜底）
          menuScrim.remove();
          menuScrim = null;
        }
      });
      menuObserver.observe(dd, { attributes: true, attributeFilter: ["open"] });
    }
  }

  function closeOverflowMenu() {
    const { root } = parts();
    const dd = root && root.shadowRoot
      ? root.shadowRoot.querySelector(".action-items ha-dropdown")
      : null;
    if (!dd) return;
    try {
      dd.open = false;
    } catch (e) {
      /* ignore */
    }
    dd.removeAttribute("open");
  }

  // 原生「编辑仪表盘」入口在某些宽度下（比如窄屏的 dashboardmenu）本来就带，
  // 这里用图标（铅笔）判断是否已经存在，避免出现两条
  function hasNativeEditItem(dd) {
    return Array.from(dd.querySelectorAll("ha-dropdown-item")).some((item) => {
      if (item.id === "glass-edit-item") return false;
      const icon = item.querySelector("ha-svg-icon");
      return !!icon && (icon.path || "").startsWith("M20.71,7.04");
    });
  }

  // 原生「编辑仪表盘」按钮被隐藏了时，可选择在 ⋮ 菜单里补一项（默认关闭：
  // PC 端已经是胶囊里的独立铅笔图标，菜单里不需要重复）。
  function injectEditItem(toolbar) {
    const dd = toolbar.querySelector(".action-items ha-dropdown");
    if (!dd) return;
    const ours = dd.querySelector("#glass-edit-item");
    if (!CONFIG.addEditMenuItem) {
      if (ours) ours.remove();
      return;
    }
    if (hasNativeEditItem(dd)) {
      if (ours) ours.remove();
      return;
    }
    if (ours) return;

    const item = document.createElement("ha-dropdown-item");
    item.id = "glass-edit-item";
    item.setAttribute("variant", "default");
    item.setAttribute("size", "m");
    item.setAttribute("role", "menuitem");
    const icon = document.createElement("ha-svg-icon");
    icon.setAttribute("slot", "icon");
    icon.path = ICON_PENCIL;
    item.appendChild(icon);
    item.appendChild(document.createTextNode("编辑仪表盘"));
    item.addEventListener("click", () => {
      location.assign(`${location.pathname}?edit=1`);
    });
    dd.appendChild(item);
  }

  // 底栏里实际要显示的 tab（排除子视图：subview 不进选项栏）
  function dockTabs(container) {
    return Array.from(container.querySelectorAll("ha-tab-group-tab")).filter(
      (t) => !t.hasAttribute("data-glass-hidden")
    );
  }

  function hideSubviewTabs(toolbar, panel) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) ||
      [];
    const subPaths = new Set(
      views.filter((v) => v.subview).map((v) => v.path)
    );
    if (!subPaths.size) {
      toolbar
        .querySelectorAll("ha-tab-group-tab[data-glass-hidden]")
        .forEach((t) => t.removeAttribute("data-glass-hidden"));
      return;
    }
    toolbar.querySelectorAll("ha-tab-group-tab").forEach((tab) => {
      const hide = subPaths.has(tab.getAttribute("data-path"));
      if (tab.hasAttribute("data-glass-hidden") !== hide) {
        tab.toggleAttribute("data-glass-hidden", hide);
      }
    });
  }

  function markActiveTab(toolbar) {
    const tabs = dockTabs(toolbar);
    if (!tabs.length) return;
    const seg = location.pathname.split("/").filter(Boolean);
    const cur = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
    let matched = false;
    tabs.forEach((tab) => {
      const hit = cur !== "" && tab.getAttribute("data-path") === cur;
      if (hit) matched = true;
      tab.toggleAttribute("data-glass-active", hit);
    });
    if (!matched) tabs[0].setAttribute("data-glass-active", "");
  }

  // 底栏文字取值：① 优先用视图自己的 title（编辑界面里那个「标题」）
  //                ② 没有 title 才看页面第一行是不是 `# 标题`（h1）
  //                ③ 再退到 HA 自己在 tab 上渲染的文字（视图没配 title 时 HA 会用 path）
  //                ④ 都没有就留空，不要拿别的页面的标题顶上
  function labelForPath(panel, path) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) ||
      [];
    const view = views.find((v) => v.path === path);
    if (!view) return "";

    const title = typeof view.title === "string" ? view.title.trim() : "";
    if (title) return title;

    const card = view.header && view.header.card;
    const content = card && typeof card.content === "string" ? card.content : "";
    const first = (content.split("\n")[0] || "").trim();
    const m = first.match(/^#\s+(.+)$/);
    return m ? m[1].trim() : "";
  }

  // 直接读 HA 自己渲染在 tab 里的图标 / 文字，保证和 HA 显示的一致：
  // 视图没配 icon 时 HA 就不画图标（我们也不该凭空补一个 dashboard 图标）；
  // 没配 title 时 HA 会在 tab 上渲染 path，我们也跟着用。
  function nativeTabIcon(tab) {
    const el = Array.from(tab.children).find((c) => c.tagName === "HA-ICON");
    if (!el) return "";
    return (typeof el.icon === "string" && el.icon) || el.getAttribute("icon") || "";
  }

  function nativeTabLabel(tab) {
    // HA 用 aria-label 记录这个 tab 的显示名（策略仪表盘里也是它算出来的标题）
    const aria = (tab.getAttribute("aria-label") || "").trim();
    if (aria) return aria;
    const el = Array.from(tab.children).find(
      (c) => c.tagName === "SPAN" && !c.classList.contains("glass-tab-label")
    );
    return el ? (el.textContent || "").trim() : "";
  }

  function iconForPath(panel, path) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
    const view = views.find((v) => v.path === path);
    return (view && view.icon) || "";
  }

  // Match v1.1.1: make one accent-colored copy, then reveal only the part
  // physically covered by the moving indicator. Native glyphs remain the base.
  function ensureTint(tab, icon, text) {
    let tint = tab.querySelector(":scope > .glass-tint");
    if (!tint) {
      tint = document.createElement("span");
      tint.className = "glass-tint";
      tint.setAttribute("aria-hidden", "true");
      tab.appendChild(tint);
    }
    const key = `${icon}|${text}`;
    if (tint.dataset.key === key) return;
    tint.dataset.key = key;
    tint.textContent = "";

    if (icon) {
      const ic = document.createElement("ha-icon");
      ic.icon = icon;
      tint.appendChild(ic);
    }

    if (CONFIG.tabLabel && text) {
      const label = document.createElement("span");
      label.className = "glass-tab-label";
      label.textContent = text;
      tint.appendChild(label);
    }
  }

  function injectTabLabels(toolbar, panel) {
    dockTabs(toolbar).forEach((tab) => {
      const path = tab.getAttribute("data-path");
      const text = labelForPath(panel, path) || nativeTabLabel(tab);
      const icon = iconForPath(panel, path) || nativeTabIcon(tab);
      // Remove the progress left by the newer in-place color-mix implementation.
      tab.style.removeProperty("--g-icon-active-progress");
      if (CONFIG.tabLabel) {
        let label = tab.querySelector(":scope > .glass-tab-label");
        if (!label) {
          label = document.createElement("span");
          label.className = "glass-tab-label";
          tab.appendChild(label);
        }
        if (label.textContent !== text) label.textContent = text;
      }
      ensureTint(tab, icon, text);
    });
  }

  // 一次性把底栏信息打到控制台，方便远程排查不同 HA / 不同仪表盘的差异
  let tabDiagSig = "";
  function logTabDiag(toolbar, panel) {
    const tabs = dockTabs(toolbar);
    const sig = tabs.map((t) => t.getAttribute("data-path")).join("|");
    if (!sig || tabDiagSig === sig) return;
    tabDiagSig = sig;
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
    log(
      "tabs",
      tabs.map((t) => {
        const path = t.getAttribute("data-path");
        const v = views.find((x) => x.path === path) || {};
        const lbl = t.querySelector(":scope > .glass-tab-label");
        return {
          path,
          title: v.title || "",
          icon: v.icon || "",
          haLabel: nativeTabLabel(t),
          haIcon: nativeTabIcon(t),
          shown: (lbl && lbl.textContent) || "",
        };
      })
    );
  }

  // 选中块：插在 ha-tab-group 的 shadow 里（.tabs 是 position:relative），
  // 靠 transform 平滑滑到当前 tab 下面。tab 自身只改图标颜色。
  let indicator = null;
  let dragState = null;
  let snapUntil = 0;
  let hoverRaf = 0;
  let pageTintUntil = 0;
  let pageTintTimer = 0;
  let suppressSwipeClick = null;
  let suppressDockClickUntil = 0;
  window.addEventListener(
    "click",
    (ev) => {
      if (Date.now() < suppressDockClickUntil) {
        const path = ev.composedPath ? ev.composedPath() : [ev.target];
        if (path.some((node) => node && node.tagName === "HA-TAB-GROUP-TAB")) {
          suppressDockClickUntil = 0;
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return;
        }
      }
      const guard = suppressSwipeClick;
      if (!guard) return;
      if (Date.now() > guard.until) {
        suppressSwipeClick = null;
        return;
      }
      if (
        Math.abs(ev.clientX - guard.x) <= 70 &&
        Math.abs(ev.clientY - guard.y) <= 70
      ) {
        suppressSwipeClick = null;
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    },
    true
  );
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOVE_MS = CONFIG.dock.moveDuration || 486;
  const GROW_MS = CONFIG.dock.growDuration || 200;
  const GROW_W = CONFIG.dock.pressGrowExtraWidth || 0;
  // 高度比胶囊高 pressGrowExtraHeight（格子本身比胶囊矮 2*inset，所以上下要多摊一点）
  const GROW_H = CONFIG.dock.height + (CONFIG.dock.pressGrowExtraHeight || 0);
  const GROW_H_OFF = Math.max(0, (GROW_H - tabHeight) / 2);
  const IND_TRANSITION = reduceMotion
    ? "none"
    : `transform ${MOVE_MS}ms cubic-bezier(.32,.72,0,1), width .18s ease, height .18s ease`;

  // 按住 / 拖动时高亮块变大（高了 5px、左右各宽 10px），底色 / 透明度不变
  // ==========================================================================
  //  玻璃遮罩（完整版）：snapdom 抓 HA 的 shadow DOM 纹理 + WebGL 折射采样。
  //  与测试页同一套 shader / 渲染器；差异只在 DOM 路径（HA 内容在 shadow DOM 里）。
  //  Liquid glass shaders / edge refraction from Zqysl/liquid-glass-webgl (MIT).
  // ==========================================================================
  const GLASS_VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const GLASS_BLUR_H = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_canvasSize;
uniform vec2 u_capsuleTopLeft;
uniform vec2 u_imageOffset;
uniform vec2 u_imageDrawSize;
uniform vec2 u_directionPx;
uniform int u_radius;
#define MAX_RADIUS 64
uniform float u_kernel[MAX_RADIUS];
vec3 sampleImage(vec2 uv) { return texture2D(u_image, clamp(uv, 0.0, 1.0)).rgb; }
void main() {
  vec2 domUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 localPx = domUv * u_canvasSize;
  vec2 containerPx = u_capsuleTopLeft + localPx;
  vec2 uv = (containerPx - u_imageOffset) / u_imageDrawSize;
  vec2 dirUv = u_directionPx / u_imageDrawSize;
  vec3 res = sampleImage(uv) * u_kernel[0];
  vec2 l = uv - dirUv;
  vec2 r = uv + dirUv;
  for (int i = 1; i < MAX_RADIUS; i++) {
    if (i < u_radius) {
      float w = u_kernel[i];
      res += sampleImage(l) * w;
      res += sampleImage(r) * w;
    }
    l -= dirUv;
    r += dirUv;
  }
  gl_FragColor = vec4(res, 1.0);
}`;

  const GLASS_BLUR_V = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_canvasSize;
uniform vec2 u_directionPx;
uniform int u_radius;
#define MAX_RADIUS 64
uniform float u_kernel[MAX_RADIUS];
vec3 sampleTex(vec2 uv) { return texture2D(u_tex, clamp(uv, 0.0, 1.0)).rgb; }
void main() {
  vec2 uv = v_uv;
  vec2 dirUv = u_directionPx / u_canvasSize;
  vec3 res = sampleTex(uv) * u_kernel[0];
  vec2 l = uv - dirUv;
  vec2 r = uv + dirUv;
  for (int i = 1; i < MAX_RADIUS; i++) {
    if (i < u_radius) {
      float w = u_kernel[i];
      res += sampleTex(l) * w;
      res += sampleTex(r) * w;
    }
    l -= dirUv;
    r += dirUv;
  }
  gl_FragColor = vec4(res, 1.0);
}`;

  const GLASS_COMPOSE = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_blurTex;
uniform sampler2D u_sharp;
uniform vec2 u_imageOffset;
uniform vec2 u_imageDrawSize;
uniform sampler2D u_overlay;
uniform sampler2D u_shell;
uniform vec2 u_canvasSize;
uniform vec2 u_capsuleTopLeft;
uniform vec2 u_foregroundCapsuleTopLeft;
uniform vec4 u_overlayRect;
uniform vec4 u_shellRect;
uniform vec2 u_shellScale;
uniform vec3 u_tintColor;
uniform vec3 u_rimTop;
uniform vec3 u_rimBottom;
uniform float u_rimAlpha;
uniform float u_borderPx;
uniform float u_edgeMapStartPx;
uniform float u_edgeMapMaxPx;
uniform vec2 u_capsuleCenterPx;
uniform vec2 u_capsuleHalfPx;
uniform vec2 u_capsuleScale;
uniform vec2 u_baseHalfPx;
uniform float u_baseRadiusPx;
uniform float u_ssaa;
float sdRoundBox(vec2 p, vec2 halfSize, float r) {
  r = clamp(r, 0.0, min(halfSize.x, halfSize.y));
  vec2 q = abs(p) - (halfSize - vec2(r));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
// 形变后的胶囊 = 未形变胶囊按 (sx, sy) 缩放。
// 把点变换回未形变空间求 SDF，再按缩放比换算回当前空间：
// 任意水平距离按 sx 缩放、任意垂直距离按 sy 缩放（圆角因此变成椭圆角）。
float lensDist(vec2 p) {
  vec2 scale = max(u_capsuleScale, vec2(1e-3));
  vec2 ps = p / scale;
  float d = sdRoundBox(ps, u_baseHalfPx, u_baseRadiusPx);
  return d * min(scale.x, scale.y);
}
vec2 lensNormal(vec2 p) {
  float e = 0.5;
  float dx = lensDist(p + vec2(e, 0.0)) - lensDist(p - vec2(e, 0.0));
  float dy = lensDist(p + vec2(0.0, e)) - lensDist(p - vec2(0.0, e));
  vec2 g = vec2(dx, dy);
  float lg = length(g);
  if (lg < 1e-4) return vec2(0.0, 1.0);
  return g / lg;
}
float lensOppositeDistance(vec2 p, vec2 n) {
  const int STEPS = 16;
  const int REFINE = 6;
  if (lensDist(p) >= 0.0) return 0.0;
  float t = 1.0;
  float lo = 0.0;
  float hi = 0.0;
  bool foundHi = false;
  for (int i = 0; i < STEPS; i++) {
    float d = lensDist(p - n * t);
    if (!foundHi) {
      if (d > 0.0) { hi = t; foundHi = true; }
      else { lo = t; t += max(1.0, abs(d)); }
    }
  }
  if (!foundHi) hi = max(lo + 1.0, length(u_capsuleHalfPx) * 4.0);
  for (int j = 0; j < REFINE; j++) {
    float mid = 0.5 * (lo + hi);
    float d = lensDist(p - n * mid);
    if (d < 0.0) lo = mid; else hi = mid;
  }
  return hi;
}
vec3 shade(vec2 localPx) {
  vec2 p = localPx - u_capsuleCenterPx;
  vec2 halfSize = u_capsuleHalfPx;
  float sdf = lensDist(p);
  float distIn = max(0.0, -sdf);
  float startPx = max(0.001, u_edgeMapStartPx);
  float u = clamp((startPx - distIn) / startPx, 0.0, 1.0);
  float t = 1.0 - pow(1.0 - u, 0.3333333333);
  float q = t * t;
  vec2 n = lensNormal(p);
  float maxDelta = lensOppositeDistance(p, n);
  float cappedMaxDelta = (u_edgeMapMaxPx > 0.0) ? min(maxDelta, u_edgeMapMaxPx) : maxDelta;
  float bendScalar = cappedMaxDelta * q;
  vec2 bend = vec2(n.x * 0.5, n.y * 0.15) * bendScalar;
  vec2 bgMappedP = p * vec2(1.0, 1.1) - bend;
  vec2 bgLocalPx = bgMappedP + u_capsuleCenterPx;
  vec2 bgDomUv = bgLocalPx / u_canvasSize;
  vec2 bgGlUv = vec2(bgDomUv.x, 1.0 - bgDomUv.y);
  vec3 bgBlurred = texture2D(u_blurTex, bgGlUv).rgb;
  // 只有底栏胶囊范围内才用模糊（对应底栏自身的 backdrop 模糊）；
  // 伸出底栏外的那部分页面保持清晰，边缘折射也因此对栏外内容有效。
  // 注意：u_capsuleTopLeft 是“相对截图像素原点”的坐标，而 u_shellRect 是视口坐标，
  // 比较底栏范围必须用视口原点（u_foregroundCapsuleTopLeft）。
  vec2 bgContainerPx = u_capsuleTopLeft + bgLocalPx;
  vec2 sharpUv = (bgContainerPx - u_imageOffset) / u_imageDrawSize;
  vec3 bgSharp = texture2D(u_sharp, clamp(sharpUv, 0.0, 1.0)).rgb;
  vec2 bgViewportPx = u_foregroundCapsuleTopLeft + bgLocalPx;
  vec2 dockHalf = 0.5 * u_shellRect.zw;
  float bgDockSdf = sdRoundBox(
    bgViewportPx - (u_shellRect.xy + dockHalf),
    dockHalf,
    min(dockHalf.x, dockHalf.y)
  );
  vec3 color = mix(bgSharp, bgBlurred, 1.0 - smoothstep(-1.5, 1.5, bgDockSdf));
  // Keep the dock capsule on its own texture so its lens magnification is
  // independent from the page-background mapping above.
  vec2 shellMappedP = p * u_shellScale - bend;
  vec2 shellLocalPx = shellMappedP + u_capsuleCenterPx;
  vec2 shellContainerPx = u_foregroundCapsuleTopLeft + shellLocalPx;
  vec2 shellTexturePx = shellContainerPx - u_shellRect.xy;
  if (
    shellTexturePx.x >= 0.0 &&
    shellTexturePx.y >= 0.0 &&
    shellTexturePx.x <= u_shellRect.z &&
    shellTexturePx.y <= u_shellRect.w
  ) {
    vec2 shellUv = shellTexturePx / u_shellRect.zw;
    vec4 shell = texture2D(u_shell, shellUv);
    color = mix(color, shell.rgb, shell.a);
  }
  // Sharp dock border. It is drawn analytically in the shell's own coordinate
  // space, so it bends with the refraction but never gets resampled/blurred by
  // the 1.1x shell texture magnification.
  vec2 shellHalf = 0.5 * u_shellRect.zw;
  vec2 dockRel = shellContainerPx - (u_shellRect.xy + shellHalf);
  float dockSdf = sdRoundBox(dockRel, shellHalf, min(shellHalf.x, shellHalf.y));
  float halfBorder = max(0.5, 0.5 * u_borderPx);
  float borderMask =
    1.0 - smoothstep(halfBorder - 0.75, halfBorder + 0.75, abs(dockSdf));
  if (borderMask > 0.0) {
    float rimT = clamp((dockRel.y + shellHalf.y) / max(1.0, 2.0 * shellHalf.y), 0.0, 1.0);
    vec3 rimRgb = mix(u_rimTop, u_rimBottom, rimT);
    color = mix(color, rimRgb, borderMask * u_rimAlpha);
  }
  // Match glass-ui-test: refract foreground glyphs only at the lens edge,
  // without scaling their interior.
  vec2 fgMappedP = p - bend;
  vec2 fgLocalPx = fgMappedP + u_capsuleCenterPx;
  vec2 containerPx = u_foregroundCapsuleTopLeft + fgLocalPx;
  vec2 overlayLocalPx = containerPx - u_overlayRect.xy;
  vec4 overlay = vec4(0.0);
  if (
    overlayLocalPx.x >= 0.0 &&
    overlayLocalPx.y >= 0.0 &&
    overlayLocalPx.x <= u_overlayRect.z &&
    overlayLocalPx.y <= u_overlayRect.w
  ) {
    vec2 overlayUv = overlayLocalPx / u_overlayRect.zw;
    overlay = texture2D(u_overlay, overlayUv);
    // The live dock keeps v1.1.1's clipped accent copy. The glass snapshot
    // excludes that copy and recolors the single native glyph sample here.
    overlay.rgb = u_tintColor;
  }
  return mix(color, overlay.rgb, overlay.a);
}
vec4 shadeWithCoverage(vec2 localPx) {
  vec2 p = localPx - u_capsuleCenterPx;
  vec2 halfSize = u_capsuleHalfPx;
  float sdf = lensDist(p);
  float coverage = 1.0 - smoothstep(-1.0, 1.0, sdf);
  // Accumulate premultiplied color so transparent edge pixels do not form a
  // dark/bright fringe when the canvas is composited over the live page.
  return vec4(shade(localPx) * coverage, coverage);
}
void main() {
  vec2 domUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 localPx = domUv * u_canvasSize;
  vec4 sampleColor = shadeWithCoverage(localPx);
  if (u_ssaa > 1.5) {
    sampleColor = shadeWithCoverage(localPx + vec2(0.125, 0.375)) * 0.25;
    sampleColor += shadeWithCoverage(localPx + vec2(0.375, -0.125)) * 0.25;
    sampleColor += shadeWithCoverage(localPx + vec2(-0.125, -0.375)) * 0.25;
    sampleColor += shadeWithCoverage(localPx + vec2(-0.375, 0.125)) * 0.25;
  }
  float alpha = sampleColor.a;
  vec3 color = alpha > 0.0001 ? sampleColor.rgb / alpha : vec3(0.0);
  gl_FragColor = vec4(color, alpha);
}`;

  function createGlassRenderer(canvas) {
    const gl = canvas.getContext("webgl", {
      alpha: true, premultipliedAlpha: false, antialias: true,
      depth: false, stencil: false, preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL not supported");

    function compile(type, source) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("createShader failed");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log || "shader compile error");
      }
      return shader;
    }
    function program(vert, frag) {
      const vs = compile(gl.VERTEX_SHADER, vert);
      const fs = compile(gl.FRAGMENT_SHADER, frag);
      const p = gl.createProgram();
      if (!p) throw new Error("createProgram failed");
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, "a_pos");
      gl.linkProgram(p);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(p);
        gl.deleteProgram(p);
        throw new Error(log || "program link error");
      }
      return p;
    }

    const KERNEL_MAX_RADIUS = 64;
    function buildKernel(radiusPx) {
      const r = Math.max(0, radiusPx);
      const radius = Math.min(KERNEL_MAX_RADIUS, Math.max(1, Math.floor(r) + 1));
      const sigma = Math.max(r * 0.5, 0.001);
      const kernel = new Float32Array(KERNEL_MAX_RADIUS);
      let sum = 0;
      for (let i = 0; i < radius; i++) {
        const w = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel[i] = w;
        sum += i === 0 ? w : 2 * w;
      }
      if (sum > 0) for (let i = 0; i < radius; i++) kernel[i] /= sum;
      return { radius, kernel };
    }

    const blurH = program(GLASS_VERT, GLASS_BLUR_H);
    const blurV = program(GLASS_VERT, GLASS_BLUR_V);
    const compose = program(GLASS_VERT, GLASS_COMPOSE);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function uniform(programObject, name) {
      return gl.getUniformLocation(programObject, name);
    }
    const u = {
      image: uniform(blurH, "u_image"),
      hCanvas: uniform(blurH, "u_canvasSize"),
      hTopLeft: uniform(blurH, "u_capsuleTopLeft"),
      hImageOffset: uniform(blurH, "u_imageOffset"),
      hImageSize: uniform(blurH, "u_imageDrawSize"),
      hDir: uniform(blurH, "u_directionPx"),
      hRadius: uniform(blurH, "u_radius"),
      hKernel: uniform(blurH, "u_kernel[0]"),
      vTex: uniform(blurV, "u_tex"),
      vCanvas: uniform(blurV, "u_canvasSize"),
      vDir: uniform(blurV, "u_directionPx"),
      vRadius: uniform(blurV, "u_radius"),
      vKernel: uniform(blurV, "u_kernel[0]"),
      cBlur: uniform(compose, "u_blurTex"),
      cShell: uniform(compose, "u_shell"),
      cCanvas: uniform(compose, "u_canvasSize"),
      cStart: uniform(compose, "u_edgeMapStartPx"),
      cMax: uniform(compose, "u_edgeMapMaxPx"),
      cSsaa: uniform(compose, "u_ssaa"),
      cSharp: uniform(compose, "u_sharp"),
      cImageOffset: uniform(compose, "u_imageOffset"),
      cImageSize: uniform(compose, "u_imageDrawSize"),
      cOverlay: uniform(compose, "u_overlay"),
      cTopLeft: uniform(compose, "u_capsuleTopLeft"),
      cForegroundTopLeft: uniform(compose, "u_foregroundCapsuleTopLeft"),
      cOverlayRect: uniform(compose, "u_overlayRect"),
      cShellRect: uniform(compose, "u_shellRect"),
      cShellScale: uniform(compose, "u_shellScale"),
      cTint: uniform(compose, "u_tintColor"),
      cCapsuleCenter: uniform(compose, "u_capsuleCenterPx"),
      cCapsuleHalf: uniform(compose, "u_capsuleHalfPx"),
      cCapsuleScale: uniform(compose, "u_capsuleScale"),
      cBaseHalf: uniform(compose, "u_baseHalfPx"),
      cBaseRadius: uniform(compose, "u_baseRadiusPx"),
      cRimTop: uniform(compose, "u_rimTop"),
      cRimBottom: uniform(compose, "u_rimBottom"),
      cRimAlpha: uniform(compose, "u_rimAlpha"),
      cBorderPx: uniform(compose, "u_borderPx"),
    };
    function texture() {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    }

    gl.activeTexture(gl.TEXTURE0);
    const imageTex = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));

    gl.activeTexture(gl.TEXTURE2);
    const tempTex = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const tempFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempTex, 0);

    gl.activeTexture(gl.TEXTURE1);
    const blurTex = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.useProgram(blurH); gl.uniform1i(u.image, 0);
    gl.useProgram(blurV); gl.uniform1i(u.vTex, 2);
    gl.activeTexture(gl.TEXTURE3);
    const overlayTex = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));
    gl.useProgram(compose);
    gl.uniform1i(u.cBlur, 1);
    gl.uniform1i(u.cOverlay, 3);
    gl.activeTexture(gl.TEXTURE4);
    const shellTex = texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]));
    gl.useProgram(compose);
    gl.uniform1i(u.cShell, 4);

    let lastW = 0, lastH = 0, blurSizeW = 1, blurSizeH = 1, imageW = 0, imageH = 0;

    function setImage(img) {
      imageW = img.naturalWidth || img.width;
      imageH = img.naturalHeight || img.height;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    }
    function setOverlay(source) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, overlayTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    function setShell(source) {
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, shellTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    function resize(wCss, hCss, dpr) {
      const w = Math.max(1, Math.round(wCss * dpr));
      const h = Math.max(1, Math.round(hCss * dpr));
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      canvas.width = w; canvas.height = h;
      blurSizeW = w; blurSizeH = h;
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tempTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blurSizeW, blurSizeH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, blurSizeW, blurSizeH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.viewport(0, 0, w, h);
    }
    function render(p) {
      const dpr = p.dpr;
      const blurRadiusPx = p.blurRadiusPx ?? 12;
      let drawW = p.containerW, drawH = p.containerH, offsetX = 0, offsetY = 0;
      if (imageW > 0 && imageH > 0 && p.containerW > 0 && p.containerH > 0) {
        const scale = Math.max(p.containerW / imageW, p.containerH / imageH);
        drawW = imageW * scale; drawH = imageH * scale;
        offsetX = (p.containerW - drawW) * 0.5;
        offsetY = (p.containerH - drawH) * 0.5;
      }
      const { radius: kernelRadius, kernel } = buildKernel(blurRadiusPx * dpr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tempFbo);
      gl.viewport(0, 0, blurSizeW, blurSizeH);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(blurH);
      gl.uniform2f(u.hCanvas, canvas.width, canvas.height);
      gl.uniform2f(u.hTopLeft, p.capsuleLeft * dpr, p.capsuleTop * dpr);
      gl.uniform2f(u.hImageOffset, offsetX * dpr, offsetY * dpr);
      gl.uniform2f(u.hImageSize, drawW * dpr, drawH * dpr);
      gl.uniform2f(u.hDir, 1, 0);
      gl.uniform1i(u.hRadius, kernelRadius);
      gl.uniform1fv(u.hKernel, kernel);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, blurSizeW, blurSizeH);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(blurV);
      gl.uniform2f(u.vCanvas, canvas.width, canvas.height);
      gl.uniform2f(u.vDir, 0, 1);
      gl.uniform1i(u.vRadius, kernelRadius);
      gl.uniform1fv(u.vKernel, kernel);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(compose);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      gl.uniform1i(u.cSharp, 0);
      gl.uniform2f(u.cImageOffset, offsetX * dpr, offsetY * dpr);
      gl.uniform2f(u.cImageSize, drawW * dpr, drawH * dpr);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, overlayTex);
      gl.uniform1i(u.cOverlay, 3);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, shellTex);
      gl.uniform1i(u.cShell, 4);
      gl.uniform2f(u.cTopLeft, p.capsuleLeft * dpr, p.capsuleTop * dpr);
      gl.uniform2f(
        u.cCapsuleCenter,
        p.capsuleCenterX * dpr,
        p.capsuleCenterY * dpr
      );
      gl.uniform2f(u.cCapsuleHalf, p.capsuleHalfW * dpr, p.capsuleHalfH * dpr);
      gl.uniform2f(u.cCapsuleScale, p.capsuleScaleX, p.capsuleScaleY);
      gl.uniform2f(u.cBaseHalf, p.baseHalfW * dpr, p.baseHalfH * dpr);
      gl.uniform1f(u.cBaseRadius, p.baseRadius * dpr);
      gl.uniform2f(
        u.cForegroundTopLeft,
        p.foregroundCapsuleLeft * dpr,
        p.foregroundCapsuleTop * dpr
      );
      gl.uniform4f(
        u.cOverlayRect,
        p.overlayLeft * dpr,
        p.overlayTop * dpr,
        p.overlayWidth * dpr,
        p.overlayHeight * dpr
      );
      gl.uniform4f(
        u.cShellRect,
        p.shellLeft * dpr,
        p.shellTop * dpr,
        p.shellWidth * dpr,
        p.shellHeight * dpr
      );
      gl.uniform2f(u.cShellScale, p.shellScaleX, p.shellScaleY);
      gl.uniform3f(u.cTint, p.tintR, p.tintG, p.tintB);
      gl.uniform3f(u.cRimTop, p.rimTopR, p.rimTopG, p.rimTopB);
      gl.uniform3f(u.cRimBottom, p.rimBottomR, p.rimBottomG, p.rimBottomB);
      gl.uniform1f(u.cRimAlpha, p.rimAlpha);
      gl.uniform1f(u.cBorderPx, p.borderPx * dpr);
      gl.uniform2f(u.cCanvas, canvas.width, canvas.height);
      gl.uniform1f(u.cStart, p.edgeMapStartPx * dpr);
      gl.uniform1f(u.cMax, p.edgeMapMaxPx * dpr);
      gl.uniform1f(u.cSsaa, p.ssaa || 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return { setImage, setOverlay, setShell, resize, render };
  }
  // snapdom 3.8.x supports open shadow roots and is loaded from beside glass-ui.js.
  let snapdomPromise = null;
  function loadSnapdom() {
    if (window.snapdom) return Promise.resolve(window.snapdom);
    if (snapdomPromise) return snapdomPromise;
    snapdomPromise = new Promise((resolve, reject) => {
      const ownScript = Array.from(document.scripts).find((s) => /glass-ui\.js(?:\?|$)/.test(s.src));
      const src = ownScript
        ? new URL("snapdom.min.js", ownScript.src).href
        : "/local/glass-ui/snapdom.min.js";
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => window.snapdom
        ? resolve(window.snapdom)
        : reject(new Error("snapdom did not initialize"));
      script.onerror = () => {
        snapdomPromise = null;
        reject(new Error("failed to load snapdom"));
      };
      document.head.appendChild(script);
    });
    return snapdomPromise;
  }

  let glassCover = null;
  let glassShadow = null;
  let glassRenderer = null;
  let glassTexture = null;
  let glassActive = false;
  let glassBusy = false;
  let glassOverlayBusy = false;
  let glassOverlayPending = false;
  let glassOverlayTimer = 0;
  let glassOverlayRefreshTimer = 0;
  let glassDirty = true;
  let glassDeferredCapture = false;
  let glassWarmupTimer = 0;
  let glassCaptureTimer = 0;
  let glassCaptureRevision = 0;
  let glassForceCapture = false;
  let glassScrollCaptureTimer = 0;
  let glassLastScrollCaptureAt = 0;
  let glassRetryTimer = 0;
  let glassRetryUntil = 0;
  let glassViewSettleTimer = 0;
  let glassObservedView = null;
  let glassViewCaptureTimer = 0;
  let glassLastCaptureAt = 0;
  let glassLastSwitchAt = 0;
  let glassViewMutations = [];
  let glassViewResize = null;
  let glassViewSeen = new WeakSet();
  let glassViewObservedCount = 0;
  const GLASS_VIEW_QUIET_MS = 260;
  const GLASS_VIEW_MAX_NODES = 4000;
  // 拖动时按横向加速度做挤压 / 拉伸（预设参数，后续可调）
  const GLASS_DRAG_SQUASH = {
    enabled: true,
    maxX: 0.15, // 满量程：长度 ±15%
    maxY: 0.20, // 满量程：高度 ∓20%
    accelFull: 1200, // 达到满量程的加速度，px/s²
    accelDead: 400, // 死区，小于该加速度不变形
    velSmoothMs: 85, // 速度平滑时间常数
    accelSmoothMs: 80, // 加速度平滑时间常数（越大越迟钝，越小越能抓到瞬时减速）
    velMin: 50, // 速度低于该值不刷新方向，px/s
    velGate: 150, // 参考速度低于该值不触发形变，px/s
    velGateFull: 350, // 参考速度高于该值才完全生效，px/s
    stopMs: 150, // 手指停住时速度衰减的时间常数（越大减速过程越长）
    refMs: 480, // 参考速度的衰减时间常数（保证停下后仍能维持形变判定）
    outputSmooth: 0.11, // 输出插值系数（越小越慢越顺）
    flipBoost: 1.8, // 形变方向翻转时的加速系数（让“变高/变扁”能及时出现）
    returnMs: 200, // 松手回弹时长（几何直出后仅作参考）
    // 点按切页专用：正常点一下的加速度远小于拖动，单独放宽门槛，
    // 让「一格」的位移也能拉到最大拉伸幅度。
    tapAccelFull: 900,
    tapVelGate: 40,
    tapVelGateFull: 120,
    tapOutputSmooth: 0.5,
  };
  let lensSquash = 0;
  let lensSquashVX = 0;
  let lensSquashAX = 0;
  let lensSquashDir = 1;
  let lensSquashLastX = null;
  let lensSquashLastT = 0;
  let lensSquashLastTick = 0;
  let lensSquashPrevVX = 0;
  let lensSquashSpeedRef = 0;
  let lensSquashRaf = 0;
  let lensDirBaseLeft = null;
  let lensDirBaseRight = null;
  let lensDirCenter = null;
  let lensDirPrev = 0;
  let lensLastLeft = 0;
  let lensLastRight = 0;
  let glassScale = 1;
  let glassRootRect = null;
  let glassTextureKey = "";
  let glassLastOverlay = null;
  let glassOverlayRect = null;
  let glassOverlaySourceEl = null;
  let glassOverlaySignature = "";
  let glassDockShellRect = null;
  let glassShellCanvas = null;
  const GLASS_DOCK_SCALE_X = 1.1;
  const GLASS_DOCK_SCALE_Y = 1.1;
  const GLASS_COARSE_POINTER = window.matchMedia("(pointer: coarse)").matches;

  function glassRenderScale() {
    return Math.min(3, Math.max(1, glassScale, window.devicePixelRatio || 1));
  }

  function roundRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function rectChanged(a, b, epsilon = 0.75) {
    return !a || !b ||
      Math.abs(a.left - b.left) > epsilon ||
      Math.abs(a.top - b.top) > epsilon ||
      Math.abs(a.width - b.width) > epsilon ||
      Math.abs(a.height - b.height) > epsilon;
  }

  function rectLayoutChanged(a, b, epsilon = 0.75) {
    // Ignore scroll-content height: HA cards can extend/reflow vertically while
    // the viewport and dock coordinates stay fixed.
    return !a || !b ||
      Math.abs(a.left - b.left) > epsilon ||
      Math.abs(a.top - b.top) > epsilon ||
      Math.abs(a.width - b.width) > epsilon;
  }

  // Build only the dock's surface/rim here. Never snapshot backdrop pixels into
  // this layer: all content beneath it must come from the blurred page texture.
  function buildDockShellLayer(tgRect, scale, radius, light) {
    if (!tgRect.width || !tgRect.height) return null;
    const shellScaleX = scale;
    const shellW = Math.max(1, Math.round(tgRect.width * scale));
    const shellH = Math.max(1, Math.round(tgRect.height * scale));
    const shell = document.createElement("canvas");
    shell.width = shellW;
    shell.height = shellH;
    const sctx = shell.getContext("2d");
    const r = radius * scale;
    sctx.save();
    roundRectPath(sctx, 0, 0, shellW, shellH, r);
    sctx.clip();
    const surface = sctx.createLinearGradient(0, 0, 0, shellH);
    if (light) {
      surface.addColorStop(0, "rgba(245,245,245,.50)");
      surface.addColorStop(0.45, "rgba(243,244,245,.50)");
      surface.addColorStop(1, "rgba(240,241,244,.50)");
    } else {
      surface.addColorStop(0, "rgba(69,69,69,.50)");
      surface.addColorStop(0.5, "rgba(69,69,69,.50)");
      surface.addColorStop(1, "rgba(69,69,69,.50)");
    }
    sctx.fillStyle = surface;
    sctx.fillRect(0, 0, shellW, shellH);
    sctx.restore();

    // 边框不画进这张纹理：纹理会被 1.1 倍放大并做双线性采样，0.5px 线会被糊开。
    // 遮罩里的边框改由 shader 用 SDF 直接描边（只跟随折射位移，保持锐利）。
    return {
      canvas: shell,
      rect: {
        // The dock is fixed to the viewport; keep shell coordinates in viewport
        // space so page scrolling cannot detach it from the glass lens.
        left: tgRect.left,
        top: tgRect.top,
        width: tgRect.width,
        height: tgRect.height,
      },
    };
  }

  function ensureGlassRenderer() {
    if (glassRenderer) return true;
    const canvas = document.createElement("canvas");
    canvas.className = "glass-lens-cover";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = [
      "position:fixed", "left:-10000px", "top:-10000px",
      "width:1px", "height:1px", "opacity:0",
      "border-radius:0px", "pointer-events:none",
      "z-index:2147483000", `transition:opacity ${GROW_MS}ms cubic-bezier(.32,.72,0,1)`,
    ].join(";");
    document.body.appendChild(canvas);
    glassCover = canvas;
    // 遮罩用不透明画布盖住底栏，底栏自身的 --g-dock-outer 阴影会被盖掉；
    // 这里补一层跟随胶囊形状的投影，让遮罩看起来浮在底栏之上。
    const shadow = document.createElement("div");
    shadow.className = "glass-lens-shadow";
    shadow.setAttribute("aria-hidden", "true");
    shadow.style.cssText = [
      "position:fixed", "left:-10000px", "top:-10000px",
      "width:1px", "height:1px", "opacity:0",
      "border-radius:999px", "pointer-events:none",
      "z-index:2147482999",
      `transition:opacity ${GROW_MS}ms cubic-bezier(.32,.72,0,1)`,
    ].join(";");
    document.body.appendChild(shadow);
    glassShadow = shadow;
    try {
      glassRenderer = createGlassRenderer(canvas);
      return true;
    } catch (err) {
      console.warn("[glass-ui] WebGL glass unavailable; keeping accent highlight", err);
      canvas.remove();
      shadow.remove();
      glassCover = null;
      glassShadow = null;
      return false;
    }
  }

  function getGlassParts() {
    const root = parts().root;
    const sr = root && root.shadowRoot;
    const tg = sr && sr.querySelector("ha-tab-group");
    const vc = sr && sr.querySelector("hui-view-container");
    const tabsEl = tg && tg.shadowRoot && tg.shadowRoot.querySelector(".tabs");
    return { root, tg, vc, tabsEl };
  }

  function getGlassKey(root, vc) {
    const viewport = root.getBoundingClientRect();
    return [
      location.pathname,
      Math.round(viewport.width),
      Math.round(viewport.height),
      root.hasAttribute("glass-light") ? "light" : "dark",
    ].join("|");
  }

  // Snapshot the actual HA view without the dock. Compose the blurred dock plate
  // and an independently sampled tab foreground, exactly like the test page.
  async function captureGlassBackground() {
    if (glassBusy || !ensureGlassRenderer()) return;
    // 点按过渡只有 ~1s：这期间不跑 snapdom（它会阻塞主线程），
    // 玻璃继续用上一帧，动画结束后再补拍。
    if (tapLensActive) {
      glassDirty = true;
      glassDeferredCapture = true;
      return;
    }
    const captureRevision = glassCaptureRevision;
    const { root, tg, vc, tabsEl } = getGlassParts();
    if (!root || !tg || !vc || !tabsEl) {
      // 底栏/视图还没准备好：排一次重试，否则遮罩会一直停在“只有高亮块”的状态。
      ensureGlassReady();
      return;
    }
    glassBusy = true;
    try {
      const snap = await loadSnapdom();
      const rootRect = vc.getBoundingClientRect();
      const tgRect = tg.getBoundingClientRect();
      const key = getGlassKey(root, vc);
      if (!glassDirty && glassTexture && key === glassTextureKey) {
        await captureGlassOverlay(snap, { root, tg, tabsEl, rootRect });
        if (captureRevision !== glassCaptureRevision) {
          glassDirty = true;
          glassForceCapture = true;
          return;
        }
        glassForceCapture = false;
        return;
      }
      const light = root.hasAttribute("glass-light");
      const captured = await snap.toCanvas(vc, { scale: 1 });
      if (captureRevision !== glassCaptureRevision) {
        glassDirty = true;
        glassForceCapture = true;
        return;
      }
      const current = getGlassParts();
      if (
        !vc.isConnected ||
        !tg.isConnected ||
        current.root !== root ||
        current.vc !== vc ||
        current.tg !== tg ||
        rectLayoutChanged(rootRect, vc.getBoundingClientRect()) ||
        rectChanged(tgRect, tg.getBoundingClientRect(), 2) ||
        getGlassKey(root, vc) !== key
      ) {
        // HA is still replacing/resizing the view. Discard this mixed-frame
        // snapshot; retry after the navigation settles instead of shifting icons.
        glassDirty = true;
        return;
      }

      // Normalize the snapshot itself to the capped sampling scale. Keeping the
      // original DPR-3 bitmap while clamping glassScale to 2 misplaces the dock
      // shell and foreground by one third on Android devices with DPR 3+.
      glassScale = Math.min(2, Math.max(1, captured.width / Math.max(1, rootRect.width)));
      const tex = document.createElement("canvas");
      tex.width = Math.max(1, Math.round(rootRect.width * glassScale));
      tex.height = Math.max(1, Math.round(rootRect.height * glassScale));
      const ctx = tex.getContext("2d");
      ctx.fillStyle = light ? "#eef0f4" : "#101114";
      ctx.fillRect(0, 0, tex.width, tex.height);
      ctx.drawImage(captured, 0, 0, captured.width, captured.height, 0, 0, tex.width, tex.height);

      const dr = tgRect;
      const rx = (dr.left - rootRect.left) * glassScale;
      const ry = (dr.top - rootRect.top) * glassScale;
      const rw = dr.width * glassScale;
      const rh = dr.height * glassScale;
      const radius = (parseFloat(getComputedStyle(root).getPropertyValue("--g-dock-radius")) || 30) * glassScale;

      // The browser's backdrop-filter isn't included in a DOM snapshot. Recreate
      // it clipped to the capsule, then composite HA's real translucent dock shell.
      if (rw > 0 && rh > 0) {
        const pad = 16 * glassScale;
        // Mirror the unmasked dock's filter directly. Canvas uses backing-store
        // pixels, so scale only its blur radius from CSS px to texture px.
        const dockFilter =
          getComputedStyle(root).getPropertyValue("--g-dock-filter").trim() ||
          "blur(5px) saturate(180%) brightness(1.10)";
        const textureDockFilter = dockFilter.replace(
          /blur\(\s*([\d.]+)px\s*\)/i,
          (_match, cssPx) => `blur(${Number(cssPx) * glassScale}px)`
        );
        const sx = Math.max(0, Math.floor(rx - pad));
        const sy = Math.max(0, Math.floor(ry - pad));
        const sw = Math.min(tex.width - sx, Math.ceil(rw + pad * 2));
        const sh = Math.min(tex.height - sy, Math.ceil(rh + pad * 2));
        if (sw > 0 && sh > 0) {
          const source = document.createElement("canvas");
          source.width = sw;
          source.height = sh;
          source.getContext("2d").drawImage(tex, sx, sy, sw, sh, 0, 0, sw, sh);
          ctx.save();
          roundRectPath(ctx, rx, ry, rw, rh, radius);
          ctx.clip();
          ctx.filter = textureDockFilter;
          ctx.drawImage(source, sx, sy);
          ctx.restore();
        }
      }

      if (tapLensActive) {
        // 点按过渡期间永远不把真实快照放进遮罩：保持纯色图层，结束再拍
        glassDirty = true;
        glassDeferredCapture = true;
        return;
      }
      const previousTexture = glassTexture;
      const previousTextureKey = glassTextureKey;
      const previousRootRect = glassRootRect;
      const previousScale = glassScale;
      const previousDockShellRect = glassDockShellRect;
      glassTexture = tex;
      glassTextureKey = key;
      glassDirty = false;
      let foreground = await captureGlassOverlay(snap, { root, tg, tabsEl, rootRect, tex });
      // If a throttled drag capture is already in flight, reuse the last stable
      // foreground mask to finish this scene. Its pending refresh will replace it.
      if (!foreground && glassLastOverlay) {
        foreground = glassLastOverlay;
        glassRenderer.setOverlay(foreground);
      }
      if (!foreground) {
        // Don't mark a background-only/partial snapshot as ready; keep the last
        // complete scene and retry so the dock shell is never missing in the lens.
        glassTexture = previousTexture;
        glassTextureKey = previousTextureKey;
        glassRootRect = previousRootRect;
        glassScale = previousScale;
        glassDockShellRect = previousDockShellRect;
        glassDirty = true;
        glassForceCapture = true;
        return;
      }
      if (captureRevision !== glassCaptureRevision) {
        glassTexture = previousTexture;
        glassTextureKey = previousTextureKey;
        glassRootRect = previousRootRect;
        glassScale = previousScale;
        glassDockShellRect = previousDockShellRect;
        glassDirty = true;
        glassForceCapture = true;
        return;
      }
      const shellLayer = buildDockShellLayer(tgRect, glassScale, radius, light);
      if (!shellLayer) {
        glassTexture = previousTexture;
        glassTextureKey = previousTextureKey;
        glassRootRect = previousRootRect;
        glassScale = previousScale;
        glassDockShellRect = previousDockShellRect;
        glassDirty = true;
        glassForceCapture = true;
        return;
      }
      glassRenderer.setImage(tex);
      glassRenderer.setShell(shellLayer.canvas);
      glassShellCanvas = shellLayer.canvas;
      // Keep the sampling origin paired with the texture actually bound to GL.
      glassRootRect = rootRect;
      glassDockShellRect = shellLayer.rect;
      glassDirty = false;
      glassForceCapture = false;
      glassLastCaptureAt = performance.now();
      if (glassActive) revealGlassCover();
    } catch (err) {
      console.warn("[glass-ui] texture capture failed; keeping accent highlight", err);
    } finally {
      glassBusy = false;
      if ((glassActive || glassForceCapture) && glassDirty) {
        clearTimeout(glassCaptureTimer);
        glassCaptureTimer = setTimeout(captureGlassBackground, 100);
      }
    }
  }

  async function captureGlassOverlay(knownSnap, supplied) {
    if (!glassRenderer) return;
    if (glassOverlayBusy) {
      glassOverlayPending = true;
      // Reuse the last stable glyph mask for this scene capture; the in-flight
      // snapshot will replace it as soon as it completes.
      return glassLastOverlay;
    }
    glassOverlayBusy = true;
    try {
      const snap = knownSnap || await loadSnapdom();
      const info = supplied || getGlassParts();
      const { root, tg, vc, tabsEl } = info;
      const rootRect = info.rootRect || (vc && vc.getBoundingClientRect()) || root.getBoundingClientRect();
      if (!tg || !tabsEl || !glassTexture) return;
      const baseTexture = glassTexture;
      const baseKey = glassTextureKey;
      const tabsRect = tabsEl.getBoundingClientRect();
      if (vc && getGlassKey(root, vc) !== baseKey) {
        if (!glassDirty) scheduleGlassCapture(120);
        return;
      }
      const targetScale = glassRenderScale();
      const tabSignature = dockTabs(tg)
        .map((tab) => [
          tab.getAttribute("data-path") || "",
          nativeTabIcon(tab),
          tab.querySelector(":scope > .glass-tab-label")?.textContent || "",
        ].join(":"))
        .join("|");
      const signature = [
        tabsRect.left,
        tabsRect.top,
        tabsRect.width,
        tabsRect.height,
        targetScale,
        root.hasAttribute("glass-light") ? "light" : "dark",
        tabSignature,
      ].join("|");
      if (
        glassLastOverlay &&
        glassOverlaySourceEl === tabsEl &&
        glassOverlaySignature === signature
      ) {
        glassOverlayRect = {
          left: tabsRect.left,
          top: tabsRect.top,
          width: tabsRect.width,
          height: tabsRect.height,
        };
        return glassLastOverlay;
      }
      const deviceScale = Math.max(1, window.devicePixelRatio || 1);
      let captureScale = Math.max(1, targetScale / deviceScale);
      const snapshotOptions = {
        scale: captureScale,
        exclude: [".glass-tint", ".glass-indicator"],
        excludeMode: "remove",
      };
      let foreground = await snap.toCanvas(tabsEl, snapshotOptions);
      // snapdom/browser combinations differ on whether `scale: 1` already
      // includes DPR. Measure the actual output and only recapture if it is
      // below the lens backing resolution.
      const actualScale = foreground.width / Math.max(1, tabsRect.width);
      if (actualScale < targetScale * 0.95) {
        captureScale = Math.min(
          4,
          captureScale * (targetScale / Math.max(0.5, actualScale))
        );
        snapshotOptions.scale = captureScale;
        foreground = await snap.toCanvas(tabsEl, snapshotOptions);
      }
      const current = getGlassParts();
      if (
        !tabsEl.isConnected ||
        current.root !== root ||
        current.tg !== tg ||
        current.tabsEl !== tabsEl ||
        glassTexture !== baseTexture ||
        glassTextureKey !== baseKey
      ) {
        if (glassActive) scheduleGlassCapture(80);
        return;
      }
      // Keep the dock foreground as its own high-resolution texture instead of
      // downsampling it into the page background (1× on mobile).
      glassRenderer.setOverlay(foreground);
      glassLastOverlay = foreground;
      glassOverlaySourceEl = tabsEl;
      glassOverlaySignature = signature;
      glassOverlayRect = {
        // Foreground/dock pixels are viewport-fixed, independent of the
        // scrolling coordinate space used by the page-background texture.
        left: tabsRect.left,
        top: tabsRect.top,
        width: tabsRect.width,
        height: tabsRect.height,
      };
      return foreground;
    } catch (err) {
      console.warn("[glass-ui] foreground capture failed", err);
    } finally {
      glassOverlayBusy = false;
      if (glassOverlayPending) {
        glassOverlayPending = false;
        clearTimeout(glassOverlayTimer);
        glassOverlayTimer = setTimeout(captureGlassOverlay, 80);
      }
    }
  }

  function scheduleGlassOverlayRefresh() {
    if (!glassActive || glassOverlayRefreshTimer) return;
    glassOverlayRefreshTimer = setTimeout(() => {
      glassOverlayRefreshTimer = 0;
      if (glassActive) captureGlassOverlay();
    }, 100);
  }

  function scheduleGlassCapture(delay = 100, force = false) {
    glassDirty = true;
    glassCaptureRevision++;
    if (force) glassForceCapture = true;
    // 点按玻璃动画期间不排队抓拍：snapdom 会卡住主线程，等过渡结束再补。
    if (tapLensActive) {
      glassDeferredCapture = true;
      clearTimeout(glassCaptureTimer);
      glassCaptureTimer = 0;
      return;
    }
    clearTimeout(glassCaptureTimer);
    glassCaptureTimer = setTimeout(() => {
      // 拖动遮罩本身不会改变页面内容，拖动期间不抓背景；
      // 标记为脏，松手后再补一张。
      if (dragState) {
        glassDirty = true;
        glassForceCapture = true;
        return;
      }
      if (glassActive || glassForceCapture) captureGlassBackground();
    }, delay);
  }

  // 页面内容变化（数据刷新、卡片重排、图片/字体加载）后，等画面稳定再拍。
  // HA 的卡片都在 shadow DOM 里，普通 MutationObserver 看不到，所以要深入 shadow
  // root 监听；尺寸变化用 ResizeObserver 兜住图片 / 布局变化。
  function glassViewChanged() {
    if (dragState || document.visibilityState === "hidden") return;
    clearTimeout(glassViewCaptureTimer);
    glassViewCaptureTimer = setTimeout(() => {
      glassViewCaptureTimer = 0;
      if (dragState) return;
      // 切页自带的 80ms / 450ms 两张已经覆盖渲染过程，这段时间内不再额外补拍。
      if (performance.now() - glassLastSwitchAt < 1100) return;
      // 刚拍过就顺延，避免切页那两张之外再多拍一张几乎相同的图。
      const since = performance.now() - glassLastCaptureAt;
      if (since < 500) {
        glassViewCaptureTimer = setTimeout(() => {
          glassViewCaptureTimer = 0;
          if (!dragState) scheduleGlassCapture(0, true);
        }, 500 - since);
        return;
      }
      scheduleGlassCapture(0, true);
    }, GLASS_VIEW_QUIET_MS);
  }

  function scanGlassView(node) {
    if (!node || node.nodeType !== 1 || glassViewSeen.has(node)) return;
    if (glassViewObservedCount > GLASS_VIEW_MAX_NODES) return;
    glassViewSeen.add(node);
    glassViewObservedCount++;
    if (glassViewResize) glassViewResize.observe(node);
    const sr = node.shadowRoot;
    if (sr && !glassViewSeen.has(sr)) {
      glassViewSeen.add(sr);
      const mo = new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach(scanGlassView);
        }
        glassViewChanged();
      });
      mo.observe(sr, { childList: true, subtree: true, characterData: true });
      glassViewMutations.push(mo);
    }
    for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
      scanGlassView(child);
    }
  }

  function teardownGlassViewObserver() {
    glassViewMutations.forEach((mo) => mo.disconnect());
    glassViewMutations = [];
    if (glassViewResize) glassViewResize.disconnect();
    glassViewResize = null;
    glassViewSeen = new WeakSet();
    glassViewObservedCount = 0;
    glassObservedView = null;
  }

  function observeGlassView(vc) {
    if (!vc || vc === glassObservedView) return;
    teardownGlassViewObserver();
    glassObservedView = vc;
    glassViewResize = new ResizeObserver(() => glassViewChanged());
    const rootMo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach(scanGlassView);
      }
      glassViewChanged();
    });
    rootMo.observe(vc, { childList: true, subtree: true, characterData: true });
    glassViewMutations.push(rootMo);
    scanGlassView(vc);
    // 字体加载完成会改变文字排版，补拍一次。
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => glassViewChanged()).catch(() => {});
    }
  }

  // ---- 拖动挤压 / 拉伸 ------------------------------------------------------
  // 形变只改胶囊的“几何”，不改画布内容的缩放：画布固定成带余量的外框，
  // 着色器按真实坐标采样页面，所以背景不会被拉伸，只是露出更大/更小的范围。
  function lensSquashFactors() {
    const enabled = GLASS_DRAG_SQUASH.enabled;
    const maxX = enabled ? GLASS_DRAG_SQUASH.maxX : 0;
    const maxY = enabled ? GLASS_DRAG_SQUASH.maxY : 0;
    const s = Math.max(-1, Math.min(1, lensSquash));
    // s>0：沿运动方向加速 → 拉长 + 压扁；s<0：减速 → 缩短 + 变高
    return { s, sx: 1 + s * maxX, sy: 1 - s * maxY, maxX, maxY };
  }

  function resetLensSquash() {
    lensSquash = 0;
    lensSquashVX = 0;
    lensSquashAX = 0;
    lensSquashLastX = null;
    lensSquashLastT = 0;
    if (glassActive) renderGlassCover();
  }

  function updateLensSquash(x, t) {
    if (!GLASS_DRAG_SQUASH.enabled) return;
    const cfg = GLASS_DRAG_SQUASH;
    if (lensSquashLastX === null) {
      lensSquashLastX = x;
      lensSquashLastT = t;
      return;
    }
    const dt = Math.max(4, Math.min(64, t - lensSquashLastT));
    const vx = ((x - lensSquashLastX) / dt) * 1000;
    lensSquashLastX = x;
    lensSquashLastT = t;
    // 只注入速度；加速度在 rAF 里算，这样“手指停住”也会产生减速。
    lensSquashVX += (vx - lensSquashVX) * (1 - Math.exp(-dt / cfg.velSmoothMs));
  }

  function applyLensSquashDynamics(dt) {
    const cfg = GLASS_DRAG_SQUASH;
    const speed = Math.abs(lensSquashVX);
    if (speed > cfg.velMin) lensSquashDir = lensSquashVX >= 0 ? 1 : -1;

    // 速度变化的参考值（衰减得慢）：用于“钝化”门槛，避免停止瞬间被关掉形变
    lensSquashSpeedRef = Math.max(
      speed,
      lensSquashSpeedRef * Math.exp(-dt / cfg.refMs)
    );

    const dv = lensSquashVX - lensSquashPrevVX;
    lensSquashPrevVX = lensSquashVX;
    const ax = (dv / dt) * 1000;
    lensSquashAX += (ax - lensSquashAX) * (1 - Math.exp(-dt / cfg.accelSmoothMs));

    const along = lensSquashAX * lensSquashDir;
    const dead = cfg.accelDead;
    // 点按切页：用更灵敏的满量程 / 速度门槛 / 输出速率，
    // 让正常点一下（一格）就能达到最大拉伸幅度。
    const full = Math.max(dead + 1, tapLensActive ? (cfg.tapAccelFull ?? cfg.accelFull) : cfg.accelFull);
    const mag = Math.abs(along);
    const norm = mag <= dead ? 0 : Math.min(1, (mag - dead) / (full - dead));

    const gateLo = tapLensActive ? (cfg.tapVelGate ?? cfg.velGate) : cfg.velGate;
    const gateHiFull = tapLensActive
      ? (cfg.tapVelGateFull ?? cfg.velGateFull)
      : cfg.velGateFull;
    const gateHi = Math.max(gateLo + 1, gateHiFull);
    let gate =
      lensSquashSpeedRef <= gateLo
        ? 0
        : Math.min(1, (lensSquashSpeedRef - gateLo) / (gateHi - gateLo));
    gate = gate * gate * (3 - 2 * gate);

    const target = (along >= 0 ? 1 : -1) * norm * gate;
    // 方向翻转（拉伸 ↔ 压缩）时给一点额外速率，避免从 +1 慢慢穿过 0 而错过减速窗口
    const flipping = target !== 0 && lensSquash !== 0 && Math.sign(target) !== Math.sign(lensSquash);
    const smooth = tapLensActive
      ? (cfg.tapOutputSmooth ?? cfg.outputSmooth)
      : cfg.outputSmooth;
    const rate = Math.min(1, smooth * (flipping ? cfg.flipBoost : 1));
    lensSquash += (target - lensSquash) * rate;
    if (Math.abs(lensSquash) < 0.002) lensSquash = 0;
  }

  function lensSquashTick(now) {
    if (!dragState && !tapLensActive) {
      lensSquashRaf = 0;
      return;
    }
    const cfg = GLASS_DRAG_SQUASH;
    const t = now || performance.now();
    const dt = Math.max(
      4,
      Math.min(64, lensSquashLastTick ? t - lensSquashLastTick : 16)
    );
    lensSquashLastTick = t;
    // 点按过渡：用高亮块的实际位移驱动速度 / 加速度
    if (tapLensActive && !dragState && indicator && indicator.isConnected) {
      const fill = indicator.firstElementChild;
      if (fill) {
        const r = fill.getBoundingClientRect();
        updateLensSquash(r.left + r.width / 2, t);
        tapLensObserve(r.left, t);
      }
    }
    // 没有新的 pointermove = 手指停住或被挡住：速度按指数衰减，产生真实的减速
    if (t - lensSquashLastT > 16) {
      lensSquashVX *= Math.exp(-dt / cfg.stopMs);
    }
    applyLensSquashDynamics(dt);
    if (glassActive && !tapLensFading) renderGlassCover();
    lensSquashRaf = requestAnimationFrame(lensSquashTick);
  }

  function startLensSquash() {
    lensDirCenter = null;
    lensSquashSpeedRef = 0;
    lensSquashPrevVX = 0;
    lensSquashLastTick = 0;
    resetLensSquash();
    // 可能还有上一步的“回弹衰减”在跑：先取消，否则主循环不会启动
    if (lensSquashRaf) cancelAnimationFrame(lensSquashRaf);
    lensSquashRaf = requestAnimationFrame(lensSquashTick);
  }

  function stopLensSquash() {
    if (lensSquashRaf) cancelAnimationFrame(lensSquashRaf);
    lensSquashRaf = 0;
    // 松手后让形变平滑回正，避免画布淡出时“跳”回原状
    const decay = () => {
      lensSquash += (0 - lensSquash) * 0.09;
      lensSquashVX *= 0.75;
      lensSquashAX *= 0.75;
      if (Math.abs(lensSquash) < 0.004) lensSquash = 0;
      if (lensSquash === 0) {
        lensSquashRaf = 0;
        if (glassActive) renderGlassCover();
        return;
      }
      if (glassActive) renderGlassCover();
      lensSquashRaf = requestAnimationFrame(decay);
    };
    lensSquashRaf = requestAnimationFrame(decay);
  }

  // ---- 点按切换 tab：高亮块滑动时临时变成玻璃 --------------------------------
  // 点其它图标 → 高亮块开始 CSS 位移时接管成玻璃；位移停稳、形变回弹后淡回强调色。
  let tapLensActive = false;
  let tapLensFading = false;
  let tapLensTargetIdx = -1;
  let tapLensTargetAt = 0;
  let tapLensTimer = 0;
  let tapLensStillSince = 0;
  let tapLensLastLeft = null;
  let tapLensStartLeft = null;
  let tapLensMoved = false;
  let tapLensBounds = null;
  // 点按玻璃比静止高亮块大多少（整体尺寸，含宽高）
  const TAP_LENS_GROW = 0.05;

  function tapLensGrowOffsets() {
    if (!indicator) return { x: 0, y: 0 };
    const w = indicator.offsetWidth || 0;
    const h = indicator.offsetHeight || 0;
    return { x: (w * TAP_LENS_GROW) / 2, y: (h * TAP_LENS_GROW) / 2 };
  }

  function beginTapLens() {
    if (!indicator || !indicator.isConnected) return;
    // 已经在拖着走了：交给拖动的放大逻辑
    if (dragState && dragState.grown) return;
    const fill = indicator.firstElementChild;
    if (!fill) return;
    clearTimeout(tapLensTimer);
    tapLensActive = true;
    tapLensFading = false;
    tapLensStillSince = 0;
    tapLensLastLeft = null;
    tapLensStartLeft = null;
    tapLensMoved = false;
    tapLensBounds = null;
    glassActive = true;
    // WebGL 就绪前先用 CSS 磨砂兜底，和按住时的回退一致
    fill.style.setProperty("background", "var(--g-dock-glass-surface)");
    fill.style.setProperty("-webkit-backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
    fill.style.setProperty("backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
    // 点按时的玻璃只比静止块大 5%（不套用拖动的放大尺寸）
    const grow = tapLensGrowOffsets();
    fill.style.left = `-${grow.x}px`;
    fill.style.right = `-${grow.x}px`;
    fill.style.top = `-${grow.y}px`;
    fill.style.bottom = `-${grow.y}px`;
    showTapLensFlat();
    startLensSquash();
    // 兜底：无论动画多慢，1.6s 后一定收尾
    tapLensTimer = setTimeout(beginTapLensFade, 1600);
  }

  // 到位并停止回弹 → 玻璃淡出、强调色块淡入
  function beginTapLensFade() {
    if (!tapLensActive || tapLensFading) return;
    clearTimeout(tapLensTimer);
    tapLensFading = true;
    const fill = indicator && indicator.firstElementChild;
    // 先把玻璃底下的高亮块恢复成强调色，再让画布淡出
    if (fill) {
      fill.style.setProperty("background", "var(--g-lens-bg)");
      fill.style.setProperty("-webkit-backdrop-filter", "none");
      fill.style.setProperty("backdrop-filter", "none");
      // 缩回正常高亮块大小（和淡出同时进行）
      fill.style.left = "0px";
      fill.style.right = "0px";
      fill.style.top = "0px";
      fill.style.bottom = "0px";
    }
    // 画布自带 opacity 过渡（GROW_MS），交给 CSS 淡出，和松手时一致
    if (glassCover) glassCover.style.opacity = "0";
    if (glassShadow) glassShadow.style.opacity = "0";
    tapLensTimer = setTimeout(finishTapLens, GROW_MS + 40);
  }

  function finishTapLens() {
    tapLensActive = false;
    tapLensFading = false;
    tapLensBounds = null;
    clearTimeout(tapLensTimer);
    glassActive = false;
    stopLensSquash();
    if (glassCover) glassCover.style.opacity = "0";
    if (glassShadow) glassShadow.style.opacity = "0";
    const fill = indicator && indicator.firstElementChild;
    if (fill) {
      fill.style.setProperty("background", "var(--g-lens-bg)");
      fill.style.setProperty("-webkit-backdrop-filter", "none");
      fill.style.setProperty("backdrop-filter", "none");
      fill.style.left = "0px";
      fill.style.right = "0px";
      fill.style.top = "0px";
      fill.style.bottom = "0px";
    }
    if (glassDeferredCapture) {
      glassDeferredCapture = false;
      scheduleGlassCapture(0, true);
    }
  }

  // 移交：只停掉点按模式，保留当前玻璃画面（按压 / 拖动接管）
  function releaseTapLensTracking() {
    tapLensActive = false;
    tapLensFading = false;
    clearTimeout(tapLensTimer);
  }

  // 马上放弃过渡（例如用户中途按下 dock）
  function cancelTapLens() {
    tapLensActive = false;
    tapLensFading = false;
    tapLensBounds = null;
    clearTimeout(tapLensTimer);
    glassActive = false;
    if (glassCover) glassCover.style.opacity = "0";
    if (glassShadow) glassShadow.style.opacity = "0";
    const fill = indicator && indicator.firstElementChild;
    if (fill) {
      fill.style.setProperty("background", "var(--g-lens-bg)");
      fill.style.setProperty("-webkit-backdrop-filter", "none");
      fill.style.setProperty("backdrop-filter", "none");
      fill.style.left = "0px";
      fill.style.right = "0px";
      fill.style.top = "0px";
      fill.style.bottom = "0px";
    }
  }

  // 每帧检查：确认真的开始移动 → 停稳 + 挤压回弹到接近 0 → 开始淡出
  function tapLensObserve(left, t) {
    if (!tapLensActive || tapLensFading) return;
    if (tapLensStartLeft === null) tapLensStartLeft = left;
    if (!tapLensMoved) {
      if (Math.abs(left - tapLensStartLeft) > 3) {
        tapLensMoved = true;
      } else {
        // 位移还没真正开始（CSS 过渡尚未推进），先别判断“停稳”
        tapLensLastLeft = left;
        tapLensStillSince = t;
        return;
      }
    }
    if (tapLensLastLeft === null || Math.abs(left - tapLensLastLeft) > 0.5) {
      tapLensLastLeft = left;
      tapLensStillSince = t;
      return;
    }
    if (!tapLensStillSince) tapLensStillSince = t;
    // 形变已经很轻微（视觉上基本回正）就收尾，不必等绝对值归零
    if (t - tapLensStillSince > 90 && Math.abs(lensSquash) < 0.12) {
      beginTapLensFade();
    }
  }

  // 每帧都要用的主题值：缓存几秒，避免每帧多次 getComputedStyle
  let glassTintCacheLight = null;
  let glassTintCacheAt = 0;
  let glassTintCacheValue = null;

  function glassTintColor(root) {
    const light = root.hasAttribute("glass-light");
    const now = performance.now();
    if (
      glassTintCacheValue &&
      glassTintCacheLight === light &&
      now - glassTintCacheAt < 3000
    ) {
      return glassTintCacheValue;
    }
    const tint = root.shadowRoot.querySelector(".glass-tint");
    const css = tint
      ? getComputedStyle(tint).color
      : getComputedStyle(root).getPropertyValue("--g-icon-active");
    glassTintCacheValue = parseStatusColor(css) || { r: 0, g: 154, b: 199 };
    glassTintCacheLight = light;
    glassTintCacheAt = now;
    return glassTintCacheValue;
  }

  let glassOuterCacheLight = null;
  let glassOuterCacheValue = "";

  function glassOuterShadow(root) {
    const light = root.hasAttribute("glass-light");
    if (glassOuterCacheLight === light && glassOuterCacheValue) {
      return glassOuterCacheValue;
    }
    const outer = getComputedStyle(root).getPropertyValue("--g-dock-outer").trim();
    glassOuterCacheValue = outer
      ? `${outer}, 0 6px 16px -6px rgba(0,0,0,.16)`
      : "0 10px 24px -8px rgba(0,0,0,.28), 0 2px 6px rgba(0,0,0,.08)";
    glassOuterCacheLight = light;
    return glassOuterCacheValue;
  }

  function renderGlassCover() {
    if (!glassActive || !glassCover || !glassRenderer || !glassTexture) return;
    const { root, vc, tg } = getGlassParts();
    const fill = indicator && indicator.firstElementChild;
    if (!root || !vc || !fill || !glassOverlayRect || !glassDockShellRect) return;
    // 遮罩打开期间如果页面已经切换（例如拖动切页），旧纹理属于上一页，
    // 继续绘制会露出旧页面内容：改成“页面底色占位”的玻璃，并重新抓拍。
    if (glassTextureKey && getGlassKey(root, vc) !== glassTextureKey) {
      scheduleGlassCapture(0, true);
      if (!tapLensActive) {
        // 按住 / 拖动时页面已经换了：退回页面底色占位，避免长时间显示别的页面
        showGlassPlaceholder();
        return;
      }
      // 点按过渡只有 ~0.5s：继续画上一帧，别让玻璃在滑动中途消失；
      // 新快照落地后 captureGlassBackground 会自动替换纹理。
    }
    const r = fill.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    // The texture is captured from hui-view-container, whose content height can
    // exceed hui-root while scrolling. Sampling must use that same coordinate
    // space or the lens shows unrelated cards instead of the dock layer.
    const textureRect = glassRootRect || vc.getBoundingClientRect();
    // 胶囊按形变后的尺寸绘制；画布保留余量，内容（背景/底栏/图标）都按真实坐标采样。
    const { s, sx, sy, maxY } = lensSquashFactors();
    const dockRect = tg ? tg.getBoundingClientRect() : null;
    // 拉伸边界 = 遮罩停在最左/最右 tab 时的左右边缘（含按住放大的外扩量）
    // 点按过渡期间底栏不会动：算一次缓存起来，省掉每帧多次 rect 读取。
    let boundLeft;
    let boundRight;
    if (tapLensActive && tapLensBounds) {
      boundLeft = tapLensBounds.left;
      boundRight = tapLensBounds.right;
    } else {
      const tabsForBounds = tg ? dockTabs(tg) : [];
      if (tabsForBounds.length) {
        const firstTab = tabsForBounds[0].getBoundingClientRect();
        const lastTab = tabsForBounds[tabsForBounds.length - 1].getBoundingClientRect();
        boundLeft = firstTab.left - GROW_W;
        boundRight = lastTab.right + GROW_W;
      } else {
        boundLeft = dockRect ? dockRect.left : r.left;
        boundRight = dockRect ? dockRect.right : r.left + r.width;
      }
      if (tapLensActive) tapLensBounds = { left: boundLeft, right: boundRight };
    }
    // 横向：形变中心 = 运动方向的前沿（左移用左边缘，右移用右边缘），
    // 长度变化全部由另一侧承担；方向翻转时用当前胶囊边界重新起步，避免跳位。
    const desiredW = Math.max(8, r.width * sx);
    const cx = r.left + r.width / 2;
    const neutral = Math.abs(s) < 0.02;
    if (lensDirCenter === null || Math.abs(cx - lensDirCenter) > 2 || neutral) {
      lensDirBaseLeft = r.left;
      lensDirBaseRight = r.left + r.width;
      lensDirCenter = cx;
      lensDirPrev = lensSquashDir;
    } else if (lensDirPrev !== lensSquashDir) {
      // 方向变了：以“变向瞬间”的胶囊左右边界作为新的初始位置
      if (lensLastRight - lensLastLeft > 1) {
        lensDirBaseLeft = lensLastLeft;
        lensDirBaseRight = lensLastRight;
      }
      lensDirPrev = lensSquashDir;
    }
    let lensLeft;
    let lensRight;
    if (lensSquashDir < 0) {
      lensLeft = lensDirBaseLeft;
      lensRight = lensLeft + desiredW;
    } else {
      lensRight = lensDirBaseRight;
      lensLeft = lensRight - desiredW;
    }
    if (lensLeft < boundLeft) {
      lensLeft = boundLeft;
      lensRight = lensLeft + desiredW;
    }
    if (lensRight > boundRight) {
      lensRight = boundRight;
      lensLeft = lensRight - desiredW;
    }
    lensLeft = Math.max(boundLeft, lensLeft);
    lensRight = Math.min(boundRight, lensRight);
    if (lensRight - lensLeft < 8) lensRight = lensLeft + 8;
    const lensW = lensRight - lensLeft;
    lensLastLeft = lensLeft;
    lensLastRight = lensRight;
    // 竖向只跟加速度挂钩，不受边界影响
    const lensH = Math.max(8, r.height * sy);
    const lensTop = r.top + (r.height - lensH) / 2;
    // 画布横向覆盖到边界（含 10px 外延），纵向留出高度变化的余量。
    const marginY = r.height * maxY;
    const canvasLeft = boundLeft;
    const canvasW = boundRight - boundLeft;
    const canvasTop = r.top - marginY;
    // 高度量化到 8px 网格：点按放大只让 r 变化几 px，避免每帧重建绘制缓冲
    const canvasH = Math.ceil((r.height + marginY * 2) / 8) * 8;
    glassCover.style.left = `${canvasLeft}px`;
    glassCover.style.top = `${canvasTop}px`;
    glassCover.style.width = `${canvasW}px`;
    glassCover.style.height = `${canvasH}px`;
    // 跟随胶囊的投影（遮罩是不透明画布，底栏自身阴影被盖住了）。
    if (glassShadow) {
      glassShadow.style.left = `${lensLeft}px`;
      glassShadow.style.top = `${lensTop}px`;
      glassShadow.style.width = `${lensW}px`;
      glassShadow.style.height = `${lensH}px`;
      const baseR = Math.min(r.width, r.height) / 2;
      const rx = Math.max(0, Math.min(baseR * (lensW / r.width), lensW / 2));
      const ry = Math.max(0, Math.min(baseR * (lensH / r.height), lensH / 2));
      glassShadow.style.borderRadius = `${rx}px / ${ry}px`;
      const outer = glassOuterShadow(root);
      const shadowCss = outer;
      if (glassShadow.style.boxShadow !== shadowCss) {
        glassShadow.style.boxShadow = shadowCss;
      }
    }
    // The shader supplies a smooth SDF edge; CSS clipping here would alias it twice.
    glassCover.style.borderRadius = "0px";
    const mobile = window.innerWidth <= 700 || GLASS_COARSE_POINTER;
    // 点按过渡期间降一档分辨率：手机 DPR 3 下像素量直接降到 ~2.25 分之一
    const dpr = tapLensActive
      ? Math.min(2, glassRenderScale())
      : glassRenderScale();
    // r 角用“静止时”的半径（px），形变只拉伸/收缩边，不改变圆角大小
    const radius = Math.min(r.width, r.height) / 2;
    const tintColor = glassTintColor(root);
    // 边框在 shader 里按 SDF 描边；颜色沿用底栏边框的上下两端（明亮 90%）。
    const light = root.hasAttribute("glass-light");
    const rim = light
      ? { top: [225, 225, 225], bottom: [218, 220, 223], alpha: 1 }
      : { top: [93, 93, 93], bottom: [69, 69, 69], alpha: 0.8 };
    // 遮罩内的页面要和底栏一样是模糊的，否则会显得“更透更清楚”。
    const dockFilter =
      getComputedStyle(root).getPropertyValue("--g-dock-filter").trim() || "";
    const blurMatch = dockFilter.match(/blur\(\s*([\d.]+)px/i);
    const blurPx = blurMatch ? Number(blurMatch[1]) : 0;
    glassRenderer.resize(canvasW, canvasH, dpr);
    glassRenderer.render({
      containerW: textureRect.width,
      containerH: textureRect.height,
      overlayLeft: glassOverlayRect.left,
      overlayTop: glassOverlayRect.top,
      overlayWidth: glassOverlayRect.width,
      overlayHeight: glassOverlayRect.height,
      shellLeft: glassDockShellRect.left,
      shellTop: glassDockShellRect.top,
      shellWidth: glassDockShellRect.width,
      shellHeight: glassDockShellRect.height,
      shellScaleX: GLASS_DOCK_SCALE_X,
      shellScaleY: GLASS_DOCK_SCALE_Y,
      tintR: tintColor.r / 255,
      tintG: tintColor.g / 255,
      tintB: tintColor.b / 255,
      rimTopR: rim.top[0] / 255,
      rimTopG: rim.top[1] / 255,
      rimTopB: rim.top[2] / 255,
      rimBottomR: rim.bottom[0] / 255,
      rimBottomG: rim.bottom[1] / 255,
      rimBottomB: rim.bottom[2] / 255,
      rimAlpha: rim.alpha,
      borderPx: 0.5,
      capsuleLeft: canvasLeft - textureRect.left,
      capsuleTop: canvasTop - textureRect.top,
      foregroundCapsuleLeft: canvasLeft,
      foregroundCapsuleTop: canvasTop,
      capsuleCenterX: lensLeft - canvasLeft + lensW / 2,
      capsuleCenterY: lensTop - canvasTop + lensH / 2,
      capsuleHalfW: lensW / 2,
      capsuleHalfH: lensH / 2,
      // 形变 = 未形变胶囊按 (sx, sy) 缩放：水平距离按 sx、垂直距离按 sy
      capsuleScaleX: r.width > 0 ? lensW / r.width : 1,
      capsuleScaleY: r.height > 0 ? lensH / r.height : 1,
      baseHalfW: r.width / 2,
      baseHalfH: r.height / 2,
      baseRadius: radius,
      dpr,
      blurRadiusPx: blurPx,
      edgeMapStartPx: radius * 0.3,
      edgeMapMaxPx: 0,
      ssaa: mobile ? 1 : 2,
    });
  }

  function revealGlassCover() {
    // 淡出回强调色的过程中，迟到的抓拍不能把画布又亮回来
    if (tapLensFading) return;
    if (!glassActive || !glassTexture || !glassCover || !glassRenderer) return;
    const fill = indicator && indicator.firstElementChild;
    if (!fill) return;
    glassCover.style.opacity = "1";
    if (glassShadow) glassShadow.style.opacity = "1";
    fill.style.setProperty("background", "transparent");
    fill.style.setProperty("-webkit-backdrop-filter", "none");
    fill.style.setProperty("backdrop-filter", "none");
    renderGlassCover();
  }

  // 页面已经换了时不能继续显示旧纹理：退回 CSS 实时磨砂，等新快照落地再显示。
  function hideGlassCover() {
    if (glassCover) glassCover.style.opacity = "0";
    if (glassShadow) glassShadow.style.opacity = "0";
    const fill = indicator && indicator.firstElementChild;
    if (!fill) return;
    fill.style.setProperty("background", "var(--g-dock-glass-surface)");
    fill.style.setProperty("-webkit-backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
    fill.style.setProperty("backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
  }

  // 按下后如果一直没有纹理（抓拍失败/被丢弃/底栏刚重建），持续重试，
  // 避免只剩放大的高亮块而没有玻璃遮罩。
  function ensureGlassReady() {
    if (!glassActive || glassTexture || glassRetryTimer) return;
    const now = performance.now();
    if (!glassRetryUntil) glassRetryUntil = now + 6000;
    if (now > glassRetryUntil) {
      glassRetryUntil = 0;
      return;
    }
    glassRetryTimer = setTimeout(() => {
      glassRetryTimer = 0;
      if (!glassActive || glassTexture) return;
      captureGlassBackground();
      ensureGlassReady();
    }, 150);
  }

  function stopGlassRetry() {
    clearTimeout(glassRetryTimer);
    glassRetryTimer = 0;
    glassRetryUntil = 0;
  }

  // 页面背景色（用于还没拿到快照时先填底）
  function glassPlaceholderColor(root, vc) {
    const pick = (value) =>
      value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)" ? value : null;
    const fromView = vc ? pick(getComputedStyle(vc).backgroundColor) : null;
    if (fromView) return fromView;
    const fromRoot = root ? pick(getComputedStyle(root).backgroundColor) : null;
    if (fromRoot) return fromRoot;
    return root && root.hasAttribute("glass-light") ? "#fafafa" : "#111214";
  }

  // 切页后、新快照还没好：立刻显示玻璃遮罩（外壳 + 图标沿用上一次），
  // 底栏之外的背景先用页面底色填充，等快照完成再替换成真实内容。
  function showGlassPlaceholder() {
    if (!glassRenderer || !glassCover) return;
    const { root, tg, vc, tabsEl } = getGlassParts();
    if (!root || !tg || !vc) return;
    const tgRect = tg.getBoundingClientRect();
    if (!tgRect.width || !tgRect.height) return;
    const light = root.hasAttribute("glass-light");
    const scale = glassScale || 1;
    const radius =
      (parseFloat(getComputedStyle(root).getPropertyValue("--g-dock-radius")) || 30) * scale;
    const shellLayer = buildDockShellLayer(tgRect, scale, radius, light);
    if (!shellLayer) return;
    const solid = document.createElement("canvas");
    solid.width = 8;
    solid.height = 8;
    const sctx = solid.getContext("2d");
    sctx.fillStyle = glassPlaceholderColor(root, vc);
    sctx.fillRect(0, 0, 8, 8);
    glassRenderer.setImage(solid);
    glassRenderer.setShell(shellLayer.canvas);
    glassShellCanvas = shellLayer.canvas;
    if (glassLastOverlay) glassRenderer.setOverlay(glassLastOverlay);
    glassTexture = solid;
    glassTextureKey = getGlassKey(root, vc);
    glassRootRect = vc.getBoundingClientRect();
    glassDockShellRect = shellLayer.rect;
    if (!glassOverlayRect && tabsEl) {
      const tabsRect = tabsEl.getBoundingClientRect();
      if (tabsRect.width > 1) {
        glassOverlayRect = {
          left: tabsRect.left,
          top: tabsRect.top,
          width: tabsRect.width,
          height: tabsRect.height,
        };
      }
    }
    glassDirty = true;
    glassForceCapture = true;
    revealGlassCover();
  }
  // 点按过渡专用：遮罩里不放页面截图，只铺两块纯色
  //   · 底栏范围 → 底栏玻璃底色
  //   · 其余位置 → 页面底色
  function showTapLensFlat() {
    if (!ensureGlassRenderer() || !glassCover) return;
    const { root, tg, vc, tabsEl } = getGlassParts();
    if (!root || !tg || !vc) return;
    const vcRect = vc.getBoundingClientRect();
    const tgRect = tg.getBoundingClientRect();
    if (vcRect.width < 4 || vcRect.height < 4 || tgRect.width < 4) return;
    const light = root.hasAttribute("glass-light");
    const scale = glassScale || 1;
    const radius =
      (parseFloat(getComputedStyle(root).getPropertyValue("--g-dock-radius")) || 30) * scale;
    const shellLayer = buildDockShellLayer(tgRect, scale, radius, light);
    if (!shellLayer) return;
    // 半分辨率就够了：只有两块纯色
    const w = Math.max(2, Math.round(vcRect.width / 2));
    const h = Math.max(2, Math.round((w * vcRect.height) / vcRect.width));
    const flat = document.createElement("canvas");
    flat.width = w;
    flat.height = h;
    const fctx = flat.getContext("2d");
    fctx.fillStyle = glassPlaceholderColor(root, vc);
    fctx.fillRect(0, 0, w, h);
    const dockColor = getComputedStyle(root)
      .getPropertyValue("--g-dock-glass-surface")
      .trim();
    if (dockColor) {
      const kx = w / vcRect.width;
      const ky = h / vcRect.height;
      const x = (tgRect.left - vcRect.left) * kx;
      const y = (tgRect.top - vcRect.top) * ky;
      const rw = tgRect.width * kx;
      const rh = tgRect.height * ky;
      fctx.save();
      roundRectPath(fctx, x, y, rw, rh, Math.min(rw, rh) / 2);
      fctx.fillStyle = dockColor;
      fctx.fill();
      fctx.restore();
    }
    glassRenderer.setImage(flat);
    glassRenderer.setShell(shellLayer.canvas);
    glassShellCanvas = shellLayer.canvas;
    if (glassLastOverlay) glassRenderer.setOverlay(glassLastOverlay);
    glassTexture = flat;
    glassTextureKey = getGlassKey(root, vc);
    glassRootRect = vcRect;
    glassDockShellRect = shellLayer.rect;
    if (!glassOverlayRect && tabsEl) {
      const tabsRect = tabsEl.getBoundingClientRect();
      if (tabsRect.width > 1) {
        glassOverlayRect = {
          left: tabsRect.left,
          top: tabsRect.top,
          width: tabsRect.width,
          height: tabsRect.height,
        };
      }
    }
    // 过渡结束后再用真实快照替换
    glassDirty = true;
    glassForceCapture = true;
    revealGlassCover();
  }

  function initGlassCover() {
    if (!ensureGlassRenderer()) return;
    const { root, vc } = getGlassParts();
    const keyChanged = root && vc && getGlassKey(root, vc) !== glassTextureKey;
    if (!glassTexture || glassDirty || keyChanged) {
      if (keyChanged || !glassTexture) {
        // 快照属于别的页面（或还没有快照）：马上用“页面底色占位”开出玻璃遮罩，
        // 等新快照完成后再替换成真实内容。
        glassDirty = true;
        showGlassPlaceholder();
      } else {
        // 同一页面的旧帧：先显示，等新快照替换（视觉上连续）。
        revealGlassCover();
      }
      captureGlassBackground();
      // 抓拍失败/被丢弃时继续重试，避免只剩放大的高亮块。
      ensureGlassReady();
      return;
    }
    revealGlassCover();
  }

  function warmGlassTexture() {
    if (!ensureGlassRenderer()) return;
    glassDirty = true;
    glassForceCapture = true;
    const { root, vc } = getGlassParts();
    const onScroll = scheduleGlassScrollCapture;
    [vc, root && findScrollHost(root)].forEach((target) => {
      if (!target || target.dataset.glassTextureEvents === "1") return;
      target.dataset.glassTextureEvents = "1";
      target.addEventListener("scroll", onScroll, { capture: true, passive: true });
    });
    observeGlassView(vc);
    captureGlassBackground();
  }

  // 滚动时先立即拍一张（保证随时按下都有当前背景），滚动停止后再补拍最后位置。
  function scheduleGlassScrollCapture() {
    if (dragState) return;
    const now = performance.now();
    if (now - glassLastScrollCaptureAt > 400) {
      glassLastScrollCaptureAt = now;
      scheduleGlassCapture(0, true);
    }
    clearTimeout(glassScrollCaptureTimer);
    glassScrollCaptureTimer = setTimeout(() => {
      glassScrollCaptureTimer = 0;
      glassLastScrollCaptureAt = performance.now();
      scheduleGlassCapture(0, true);
    }, 160);
  }

  // A swipe / scroll can move content beneath the lens; keep the cached scene current.
  window.addEventListener("resize", () => scheduleGlassCapture(120));
  window.addEventListener("scroll", scheduleGlassScrollCapture, {
    capture: true,
    passive: true,
  });

  // Tilt the same pixels as the standalone test: background glass, dock below it,
  // and a separately sampled native icon/label layer.
  function setLensGrow(tabs, on) {
    if (!indicator || !indicator.isConnected) return;
    const fill = indicator.firstElementChild;
    if (!fill) return;
    if (on) {
      // 放大接管玻璃：点按过渡从此交给按压 / 拖动逻辑
      releaseTapLensTracking();
      glassActive = true;
      // Instant CSS fallback while a newly navigated page's texture is warming.
      // The WebGL cover replaces this as soon as a complete scene is ready.
      fill.style.setProperty("background", "var(--g-dock-glass-surface)");
      fill.style.setProperty("-webkit-backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
      fill.style.setProperty("backdrop-filter", "blur(6px) saturate(1.85) brightness(1.1)");
      initGlassCover();
    } else if (tapLensActive) {
      // 点按玻璃还在滑：保留画布和玻璃填充，只把放大的偏移收回
      clearTimeout(glassOverlayRefreshTimer);
      glassOverlayRefreshTimer = 0;
    } else {
      glassActive = false;
      clearTimeout(glassOverlayRefreshTimer);
      glassOverlayRefreshTimer = 0;
      stopGlassRetry();
      if (glassCover) glassCover.style.opacity = "0";
      if (glassShadow) glassShadow.style.opacity = "0";
      fill.style.setProperty("background", "var(--g-lens-bg)");
      fill.style.setProperty("-webkit-backdrop-filter", "none");
      fill.style.setProperty("backdrop-filter", "none");
      // 拖动期间被推迟的抓拍，松手后再补上。
      if (glassDirty) scheduleGlassCapture(0, true);
    }
    const dx = on ? `-${GROW_W}px` : "0px";
    const dy = on ? `-${GROW_H_OFF}px` : "0px";
    // 点按玻璃接管期间保持放大状态，不要在这里缩回
    const writeOffsets = on || !tapLensActive;
    if (writeOffsets) {
      if (fill.style.left !== dx) fill.style.left = dx;
      if (fill.style.right !== dx) fill.style.right = dx;
      if (fill.style.top !== dy) fill.style.top = dy;
      if (fill.style.bottom !== dy) fill.style.bottom = dy;
    }
    if (tabs && tabs.length) trackHover(tabs, reduceMotion ? 0 : GROW_MS + 120);
  }

  // Tab/path navigation keeps the glass texture cache fresh after HA changes view.
  function goToPath(path) {
    if (!path) return false;
    const seg = location.pathname.split("/").filter(Boolean);
    const cur = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
    if (path === cur) return false;
    const base = seg.length ? `/${seg[0]}` : "";
    history.pushState(null, "", `${base}/${encodeURIComponent(path)}`);
    window.dispatchEvent(new CustomEvent("location-changed", {
      bubbles: true,
      composed: true,
      detail: { replace: false },
    }));
    return true;
  }
  function goToTab(tab) {
    return goToPath(tab && tab.getAttribute("data-path"));
  }

  // 通过 HA Companion 的原生 external bus 触发 iOS / Android Taptic；
  // 普通 Android 浏览器则退回 Vibration API。iOS Safari 没有 Web Vibration API。
  function emitDockHaptic() {
    const hasCompanionBridge = Boolean(
      window.externalAppV2 ||
        window.externalApp ||
        (window.webkit &&
          window.webkit.messageHandlers &&
          window.webkit.messageHandlers.externalBus)
    );

    if (hasCompanionBridge) {
      window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
      return true;
    }

    if (navigator && typeof navigator.vibrate === "function") {
      try {
        return navigator.vibrate(14);
      } catch (e) {
        /* vibration may be unavailable or blocked by the browser */
      }
    }
    return false;
  }

  // Follow v1.1.1's pill geometry. The growing fill contains the normal
  // highlighter and the glass replacement area, so both regions tint together.
  function indicatorSpan() {
    if (!indicator || !indicator.isConnected) return null;
    const t = getComputedStyle(indicator).transform;
    const m = t && t.match(/matrix\(([^)]+)\)/);
    const tx = m ? Number(m[1].split(",")[4]) : indicator.offsetLeft;
    const fill = indicator.firstElementChild;
    const dx = fill ? fill.offsetLeft : 0;
    const width = fill ? fill.offsetWidth : indicator.offsetWidth;
    const height = fill ? fill.offsetHeight : indicator.offsetHeight;
    return { x: tx + dx, w: width, rad: height / 2 };
  }

  // Match v1.1.1: clip the accent glyph to the rounded part of each tab covered
  // by the highlighter; the glass mask uses the same expanded fill geometry.
  function syncTint(tabs) {
    const span = indicatorSpan();
    if (!span || !tabs || !tabs.length) return;
    tabs.forEach((tab) => {
      const tint = tab.querySelector(":scope > .glass-tint");
      if (!tint) return;
      const left = tab.offsetLeft;
      const w = tab.offsetWidth || 1;
      const visL = Math.max(0, Math.min(w, span.x - left));
      const visR = Math.max(0, Math.min(w, span.x + span.w - left));
      const rl = visL > 0.5 ? span.rad : 0;
      const rr = w - visR > 0.5 ? span.rad : 0;
      const clip = `inset(0 ${Math.max(0, w - visR)}px 0 ${visL}px round ${rl}px ${rr}px ${rr}px ${rl}px)`;
      if (tint.style.clipPath !== clip) tint.style.clipPath = clip;
    });
  }

  // 高亮块正在做 CSS 动画（按下滑过去、松手吸附）时，跟一段时间
  function trackHover(tabs, ms) {
    cancelAnimationFrame(hoverRaf);
    if (!tabs || !tabs.length) return;
    const deadline = performance.now() + ms;
    const step = () => {
      if (!tabs[0] || !tabs[0].isConnected) return;
      syncTint(tabs);
      if (glassActive && !tapLensActive) renderGlassCover();
      if (performance.now() < deadline) hoverRaf = requestAnimationFrame(step);
    };
    hoverRaf = requestAnimationFrame(step);
  }

  // 手势：按下即生效（不需要长按），横向拖动时选中块跟手；
  // 拖动期间只移动遮罩，高亮所在 tab 只在松手时切换。
  // 图标颜色只跟"高亮块盖住哪一段"走，见 syncTint。
  function attachDockDrag(tg, tabsEl) {
    if (tg.dataset.glassDrag === "1") return;
    tg.dataset.glassDrag = "1";

    const metrics = (tabs) => {
      const first = tabs[0];
      return {
        cellW: first.offsetWidth || 1,
        pad: first.offsetLeft,
        top: first.offsetTop,
        left: tabsEl.getBoundingClientRect().left,
      };
    };

    const clampX = (clientX, tabs) => {
      const m = metrics(tabs);
      const x = clientX - m.left - m.cellW / 2;
      return {
        x: Math.max(m.pad, Math.min(x, m.pad + m.cellW * (tabs.length - 1))),
        m,
      };
    };

    // 图标颜色由模块级的 syncTint / trackHover 统一负责

    // 点按某个 tab：记下目标格。HA 有时要等视图渲染完才更新 tab 状态，
    // 所以不用固定时间窗，等它真正切到这一格时再接管成玻璃。
    tg.addEventListener(
      "click",
      (ev) => {
        const tab = (ev.composedPath() || []).find(
          (n) => n && n.tagName === "HA-TAB-GROUP-TAB"
        );
        if (!tab) return;
        const idx = dockTabs(tg).indexOf(tab);
        if (idx >= 0) {
          tapLensTargetIdx = idx;
          tapLensTargetAt = performance.now();
        }
      },
      true
    );

    // 手指停在某一格超过 200ms 就切过去（拖动过程中也生效）
    const armDwell = (state, idx) => {
      if (idx < 0 || !state.tabs[idx]) return;
      if (state.hoverIdx === idx) return;
      state.hoverIdx = idx;
      clearTimeout(state.dwellTimer);
    };

    tg.addEventListener(
      "pointerdown",
      (ev) => {
        if (!indicator || !indicator.isConnected) return;
        if (ev.pointerType === "mouse" && ev.button !== 0) return;
        // 手势进行中忽略后来落下的手指；也忽略非主指针（多指时的第二、第三根）
        if (dragState) return;
        if (ev.isPrimary === false) return;
        const tabs = dockTabs(tg);
        if (tabs.length < 2) return;
        // 找到按下的那一格（事件可能来自图标内部的 shadow 节点，也可能直接落在容器上）
        let pressedTab = (ev.composedPath() || []).find(
          (n) => n.tagName === "HA-TAB-GROUP-TAB"
        );
        const m = metrics(tabs);
        const rel = ev.clientX - m.left - m.pad;
        const hitIdx = Math.max(
          0,
          Math.min(tabs.length - 1, Math.round((rel - m.cellW / 2) / m.cellW))
        );
        if (!pressedTab) pressedTab = tabs[hitIdx];

        const state = {
          active: true,
          settled: false,
          grown: false,
          tg,
          startX: ev.clientX,
          startY: ev.clientY,
          tabs,
          pressedTab,
          pointerId: ev.pointerId,
          pointerType: ev.pointerType,
          settleTimer: 0,
          dwellTimer: 0,
          growTimer: 0,
          hoverIdx: -1,
          hapticFired: false,
        };
        dragState = state;
        tg.classList.add("glass-dragging");
        // 如果上一次点按的玻璃过渡还在，立即交还给按压逻辑
        cancelTapLens();
        startLensSquash();

        // 按住一小会儿（或开始横向拖动）就把高亮块放大，松手缩回
        state.growTimer = setTimeout(() => {
          if (dragState !== state) return;
          // 点按切页的玻璃保持 +5% 小尺寸，别被长按放大盖掉
          if (tapLensActive) return;
          state.grown = true;
          setLensGrow(state.tabs, true);
          if (!state.hapticFired && state.pointerType !== "mouse") {
            state.hapticFired = emitDockHaptic();
          }
        }, CONFIG.dock.pressGrowDelay || 140);

        // 按下的不是当前高亮那格：先把高亮滑过去，再开始跟手
        const cur = tabs.findIndex((t) => t.hasAttribute("data-glass-active"));
        const pressedIdx = tabs.indexOf(pressedTab);
        if (pressedIdx !== -1 && pressedIdx !== cur) {
          indicator.style.transition = IND_TRANSITION;
          indicator.style.transform = `translate(${pressedTab.offsetLeft}px, ${pressedTab.offsetTop}px)`;
          // 高亮块一开始移动就接管成玻璃（拖动 / 长按会随后接手）
          beginTapLens();
          state.settleTimer = setTimeout(
            () => {
              state.settled = true;
              indicator.style.transition = "none";
            },
            reduceMotion ? 0 : MOVE_MS
          );
        } else {
          state.settled = true;
          indicator.style.transition = "none";
        }

        try {
          tg.setPointerCapture(state.pointerId);
        } catch (e) {
          /* ignore */
        }
        armDwell(state, pressedIdx);
        // 高亮块滑向按下位置的过程中，颜色跟着一起变
        trackHover(tabs, reduceMotion ? 100 : MOVE_MS + 160);
      },
      { passive: true }
    );

    tg.addEventListener("pointermove", (ev) => {
      if (!dragState) return;
      if (ev.pointerId !== dragState.pointerId) return;
      ev.preventDefault();
      // 真的开始横拖了：立刻放大（不用等长按计时器）
      if (!dragState.grown) {
        const dx = Math.abs(ev.clientX - dragState.startX);
        const dy = Math.abs(ev.clientY - dragState.startY);
        if (dx > 4 && dx > dy) {
          clearTimeout(dragState.growTimer);
          dragState.grown = true;
          setLensGrow(dragState.tabs, true);
        }
      }
      // 还在做"滑到按下位置"的动画时，第一时间切成跟手
      if (!dragState.settled) {
        clearTimeout(dragState.settleTimer);
        dragState.settled = true;
        indicator.style.transition = "none";
      }
      const { x, m } = clampX(ev.clientX, dragState.tabs);
      indicator.style.transform = `translate(${x}px, ${m.top}px)`;
      updateLensSquash(ev.clientX, ev.timeStamp || performance.now());
      const idx = Math.max(
        0,
        Math.min(
          dragState.tabs.length - 1,
          Math.round((x - m.pad) / m.cellW)
        )
      );
      cancelAnimationFrame(hoverRaf);
      syncTint(dragState.tabs);
      renderGlassCover();
      scheduleGlassOverlayRefresh();
      armDwell(dragState, idx);
    });

    const finish = (ev) => {
      if (!dragState) return;
      if (ev.pointerId !== dragState.pointerId) return;
      const state = dragState;
      dragState = null;
      tg.classList.remove("glass-dragging");
      // 点按玻璃的循环还要继续跑（负责跟随位移和收尾），不能在这里停掉
      if (!tapLensActive) stopLensSquash();
      clearTimeout(state.settleTimer);
      clearTimeout(state.dwellTimer);
      clearTimeout(state.growTimer);
      cancelAnimationFrame(hoverRaf);

      const { x, m } = clampX(ev.clientX, state.tabs);
      const releaseIdx =
        state.hoverIdx >= 0
          ? state.hoverIdx
          : Math.round((x - m.pad) / m.cellW);
      const idx = Math.max(0, Math.min(state.tabs.length - 1, releaseIdx));
      const target = state.tabs[idx];
      const prevActiveIdx = state.tabs.findIndex((t) =>
        t.hasAttribute("data-glass-active")
      );

      // 松手：高亮块缩回原大小 + 吸到最近一格，两个动画同时跑
      setLensGrow(state.tabs, false);
      indicator.style.transition = IND_TRANSITION;
      indicator.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
      snapUntil = Date.now() + MOVE_MS + 400;
      const moved =
        Math.abs(ev.clientX - state.startX) > 4 ||
        Math.abs(ev.clientY - state.startY) > 4;
      // 点按别的图标（不是拖动）：吸附位移期间把高亮块接管成玻璃
      if (!moved && idx !== prevActiveIdx && !tapLensActive) {
        tapLensTargetIdx = -1;
        beginTapLens();
      }
      if (moved) {
        // Don't let HA's synthesized click select the original press target.
        suppressDockClickUntil = Date.now() + 600;
        suppressSwipeClick = {
          until: Date.now() + 700,
          x: ev.clientX,
          y: ev.clientY,
        };
      }
      const changed = goToTab(target);
      if (changed && !state.hapticFired) emitDockHaptic();
      // 吸附动画期间颜色继续跟着高亮块，动画结束停在目标格
      trackHover(state.tabs, reduceMotion ? 0 : MOVE_MS + 180);
    };

    // iOS 的 WebKit 有些版本会忽略 touch-action，这里再加一层保险：
    // 在底栏上滑动时彻底阻止页面滚动（非 passive 才拦得住）
    tg.addEventListener(
      "touchmove",
      (ev) => {
        // 多指（捏合缩放之类）也一并拦掉，避免背景乱动
        if (ev.cancelable) ev.preventDefault();
      },
      { passive: false }
    );
    // Safari 的捏合手势
    ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
      tg.addEventListener(
        type,
        (ev) => {
          if (ev.cancelable) ev.preventDefault();
        },
        { passive: false }
      );
    });

    tg.addEventListener("pointerup", finish);
    tg.addEventListener("lostpointercapture", (ev) => {
      if (dragState && ev.pointerId === dragState.pointerId) {
        cancelStaleDockDrag(tg, []);
      }
    });
    tg.addEventListener("pointercancel", (ev) => {
      if (!dragState) return;
      if (ev.pointerId !== dragState.pointerId) return;
      clearTimeout(dragState.settleTimer);
      clearTimeout(dragState.dwellTimer);
      clearTimeout(dragState.growTimer);
      cancelAnimationFrame(hoverRaf);
      const tabs = dragState.tabs;
      dragState = null;
      tg.classList.remove("glass-dragging");
      setLensGrow(tabs, false);
      if (indicator) {
        indicator.style.transition = IND_TRANSITION;
        // 取消手势：高亮块回到当前页那一格
        const active = tabs.find((t) => t.hasAttribute("data-glass-active"));
        if (active) {
          indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
        }
        snapUntil = Date.now() + MOVE_MS + 400;
      }
      trackHover(tabs, reduceMotion ? 0 : MOVE_MS + 180);
    });
    tg.addEventListener("contextmenu", (ev) => {
      if (dragState) ev.preventDefault();
    });
  }

  // 页面内容区左右滑动切换相邻视图；纵向页面滚动、卡片控件和横向滚动区域不受影响。
  function attachPageSwipe(root, panel, toolbar) {
    const container =
      root.shadowRoot && root.shadowRoot.querySelector("hui-view-container");
    if (!container || container.dataset.glassPageSwipe === "1") return;
    container.dataset.glassPageSwipe = "1";

    let touch = null;
    // Reserve the leftmost strip for iOS's native edge-swipe sidebar gesture.
    const sidebarEdgeSwipeWidth = 24;
    const interactiveSelector = [
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "option",
      "video",
      "audio",
      "[role='button']",
      "[role='slider']",
      "[role='switch']",
      "[contenteditable='true']",
      "[data-no-page-swipe]",
      "ha-slider",
      "ha-control-slider",
      "ha-icon-button",
      "ha-dropdown",
      "ha-tab-group",
    ].join(",");

    const isBlockedStart = (ev) => {
      const path = ev.composedPath ? ev.composedPath() : [ev.target];
      for (const node of path) {
        if (!node || typeof node.matches !== "function") continue;
        if (node.matches(interactiveSelector)) return true;
        // 保留卡片 / 内容自身的横向滚动（如图表时间轴、轮播卡片）
        const cs = getComputedStyle(node);
        if (
          node.scrollWidth > node.clientWidth + 8 &&
          (cs.overflowX === "auto" || cs.overflowX === "scroll")
        ) {
          return true;
        }
      }
      return false;
    };

    const adjacentTabs = () => {
      const native = dockTabs(toolbar);
      if (native.length) return native;
      return Array.from(
        root.shadowRoot.querySelectorAll(".glass-custom-dock .glass-custom-tab")
      );
    };

    const switchAdjacent = (direction, x, y) => {
      const view = currentView(panel);
      if (view && view.subview) return false;
      const tabs = adjacentTabs();
      const seg = location.pathname.split("/").filter(Boolean);
      const path = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
      const index = tabs.findIndex((tab) => tab.getAttribute("data-path") === path);
      if (index < 0) return false;
      const next = tabs[index + direction];
      if (!next) return false;
      const changed = goToTab(next);
      if (changed) {
        suppressSwipeClick = { until: Date.now() + 700, x, y };
        emitDockHaptic();
      }
      return changed;
    };

    container.addEventListener(
      "touchstart",
      (ev) => {
        if (ev.touches.length !== 1 || isBlockedStart(ev)) {
          touch = null;
          return;
        }
        const point = ev.changedTouches[0];
        if (!point) return;
        touch = {
          id: point.identifier,
          startX: point.clientX,
          startY: point.clientY,
          x: point.clientX,
          y: point.clientY,
          horizontal: false,
        };
      },
      { capture: true, passive: true }
    );

    container.addEventListener(
      "touchmove",
      (ev) => {
        if (!touch) return;
        if (ev.touches.length !== 1) {
          touch = null;
          return;
        }
        const point = Array.from(ev.touches).find((p) => p.identifier === touch.id);
        if (!point) return;
        touch.x = point.clientX;
        touch.y = point.clientY;
        const dx = touch.x - touch.startX;
        const dy = touch.y - touch.startY;

        // A rightward swipe beginning at the left screen edge belongs to HA's
        // drawer gesture. Drop it before the page-swipe handler can prevent it
        // or switch to the previous Lovelace tab.
        if (touch.startX <= sidebarEdgeSwipeWidth && dx > 0) {
          touch = null;
          return;
        }

        if (!touch.horizontal) {
          if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
          // 明确的纵向手势交给页面正常滚动
          if (Math.abs(dy) >= Math.abs(dx) * 1.15) {
            touch = null;
            return;
          }
          touch.horizontal = true;
        }

        // 只在确定是横向切页手势后阻止默认行为，纵向滚动不受影响
        if (ev.cancelable) ev.preventDefault();
      },
      { capture: true, passive: false }
    );

    container.addEventListener(
      "touchend",
      (ev) => {
        if (!touch) return;
        const state = touch;
        touch = null;
        if (!state.horizontal) return;
        const point =
          Array.from(ev.changedTouches || []).find((p) => p.identifier === state.id) ||
          state;
        const dx = point.clientX - state.startX;
        const dy = point.clientY - state.startY;
        if (
          Math.abs(dx) < (CONFIG.dock.pageSwipeThreshold || 60) ||
          Math.abs(dx) < Math.abs(dy) * 1.15
        ) {
          return;
        }
        if (ev.cancelable) ev.preventDefault();
        // 向左滑 -> 下一个 tab；向右滑 -> 上一个 tab
        switchAdjacent(dx < 0 ? 1 : -1, point.clientX, point.clientY);
      },
      { capture: true, passive: false }
    );

    container.addEventListener(
      "touchcancel",
      () => {
        touch = null;
      },
      { capture: true, passive: true }
    );
  }

  // 非子视图列表（子视图不进底栏）
  function nonSubviewViews(panel) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
    return views.filter((v) => !v.subview);
  }

  // HA 在子视图、以及"只有一个普通视图"时不渲染 tab 栏，这里用配置自己搭一个底栏
  // （只放非子视图）
  function syncSubviewDock(root, panel, needed) {
    let dock = root.shadowRoot.querySelector(".glass-custom-dock");
    if (!needed) {
      if (dock) dock.remove();
      return;
    }
    const views = nonSubviewViews(panel);
    if (!views.length) return;

    if (!dock) {
      dock = document.createElement("div");
      dock.className = "glass-custom-dock";
      root.shadowRoot.appendChild(dock);
    }

    const key = views.map((v) => `${v.path}:${v.icon || ""}:${v.title || ""}`).join("|");
    if (dock.dataset.key !== key) {
      dock.dataset.key = key;
      dock.textContent = "";

      views.forEach((view) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "glass-custom-tab";
        btn.setAttribute("data-path", view.path);
        btn.setAttribute("aria-label", view.title || view.path);

      const icon = document.createElement("ha-icon");
      icon.icon = view.icon || "mdi:view-dashboard";

      const label = document.createElement("span");
      label.className = "glass-tab-label";
      label.textContent = labelForPath(panel, view.path);

      btn.append(icon, label);
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        goToPath(view.path);
      });
      dock.appendChild(btn);
      });
    }

    // 当前页高亮
    const seg = location.pathname.split("/").filter(Boolean);
    const cur = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
    dock.querySelectorAll(".glass-custom-tab").forEach((btn) => {
      btn.toggleAttribute(
        "data-glass-active",
        btn.getAttribute("data-path") === cur
      );
    });
  }

  function cancelStaleDockDrag(tg, currentTabs) {
    const state = dragState;
    if (!state) return;
    const stale =
      state.tg !== tg ||
      state.tabs.some((tab) => !tab.isConnected || !currentTabs.includes(tab));
    if (!stale) return;

    dragState = null;
    clearTimeout(state.settleTimer);
    clearTimeout(state.dwellTimer);
    clearTimeout(state.growTimer);
    cancelAnimationFrame(hoverRaf);
    stopLensSquash();
    if (state.tg) state.tg.classList.remove("glass-dragging");
    if (indicator && indicator.isConnected) {
      setLensGrow(state.tabs, false);
    } else {
      glassActive = false;
      if (glassCover) glassCover.style.opacity = "0";
    }
    // The old pointer belongs to a replaced tab group. Let the freshly rendered
    // indicator snap to the current HA tab instead of writing stale coordinates.
    snapUntil = 0;
  }

  function syncIndicator(toolbar) {
    const tg = toolbar.querySelector("ha-tab-group");
    const tabsEl = tg && tg.shadowRoot && tg.shadowRoot.querySelector(".tabs");
    if (!tabsEl) {
      if (tg) cancelStaleDockDrag(tg, []);
      return;
    }
    const tabs = dockTabs(toolbar);
    cancelStaleDockDrag(tg, tabs);
    if (!tabs.length) return;

    // HA may render horizontal scroll arrows when it thinks the native tab row
    // overflows. The dock is a fixed-width capsule and must never show these
    // controls at any viewport width, so hide both scroll buttons inside its
    // shadow root (the tab labels themselves remain clipped/ellipsized).
    tg.shadowRoot.querySelectorAll(".scroll-button").forEach((button) => {
      if (button.style.getPropertyValue("display") !== "none") {
        button.style.setProperty("display", "none", "important");
      }
      if (!button.hasAttribute("aria-hidden")) {
        button.setAttribute("aria-hidden", "true");
      }
    });

    attachDockDrag(tg, tabsEl);

    // .nav 是 HA 自己的横向滚动容器（overflow:auto，没有 part 名），
    // 它会把放大的高亮块裁在胶囊高度以内 —— 必须摘掉裁剪，块才能越出胶囊。
    const navEl = tg.shadowRoot.querySelector(".nav");
    if (navEl && navEl.style.overflow !== "visible") {
      navEl.style.overflow = "visible";
    }

    // 拖动中 / 刚松手吸附中：不要用当前 tab 的位置覆盖手指的位置
    if ((dragState && dragState.active) || Date.now() < snapUntil) return;

    const idx = Math.max(
      0,
      tabs.findIndex((t) => t.hasAttribute("data-glass-active"))
    );
    const el = tabs[idx];
    if (!el.offsetWidth) return;
    const tabsRect = tabsEl.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    if (
      tabsRect.width < 2 ||
      tabsRect.height < 2 ||
      tabRect.width < 2 ||
      tabRect.height < 2 ||
      tabRect.right < tabsRect.left ||
      tabRect.left > tabsRect.right ||
      tabRect.bottom < tabsRect.top ||
      tabRect.top > tabsRect.bottom
    ) {
      // During HA view replacement, tab slots can briefly report zero/out-of-dock
      // coordinates. Keep the last valid indicator position until layout settles.
      return;
    }

    const x = el.offsetLeft;
    const y = el.offsetTop;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const radius = getComputedStyle(el).borderRadius;

    if (!indicator || !indicator.isConnected) {
      indicator = document.createElement("div");
      indicator.className = "glass-indicator";
      // 外层只管位置（transform 平移），内层只管放大 / 缩小，
      // 两套动画互不干扰（按住放大用的是更短的时长）
      indicator.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "z-index:0",
        "pointer-events:none",
        `transition:${IND_TRANSITION}`,
      ]
        .filter(Boolean)
        .join(";");
      indicator.style.borderRadius = radius;
      indicator.style.width = `${w}px`;
      indicator.style.height = `${h}px`;
      indicator.style.transform = `translate(${x}px, ${y}px)`;
      indicator.dataset.glassIdx = String(idx);

      const fill = document.createElement("div");
      fill.className = "glass-indicator-fill";
      fill.style.cssText = [
        "position:absolute",
        "top:0",
        "bottom:0",
        "left:0",
        "right:0",
        /* 胶囊形：999px 会被浏览器按"短边的一半"夹紧，宽高变化后仍是半圆端 */
        "border-radius:999px",
        "background:var(--g-lens-bg)",
        "box-shadow:var(--g-lens-shadow)",
        `transition:left ${GROW_MS}ms cubic-bezier(.32,.72,0,1), right ${GROW_MS}ms cubic-bezier(.32,.72,0,1), top ${GROW_MS}ms cubic-bezier(.32,.72,0,1), bottom ${GROW_MS}ms cubic-bezier(.32,.72,0,1)`,
        "will-change:left, right, top, bottom",
      ].join(";");
      indicator.appendChild(fill);

      tabsEl.appendChild(indicator);
      syncTint(tabs);
      clearTimeout(glassWarmupTimer);
      // Warm WebGL, background, shell and native glyph textures as soon as the
      // dock exists, not on the first press.
      glassWarmupTimer = setTimeout(warmGlassTexture, 0);
      return;
    }

    const widthStyle = `${w}px`;
    const heightStyle = `${h}px`;
    const transformStyle = `translate(${x}px, ${y}px)`;
    const geometryChanged =
      indicator.style.width !== widthStyle ||
      indicator.style.height !== heightStyle ||
      indicator.style.borderRadius !== radius;
    const positionChanged = indicator.style.transform !== transformStyle;
    indicator.style.width = widthStyle;
    indicator.style.height = heightStyle;
    indicator.style.borderRadius = radius;
    if (positionChanged) {
      const prevIdx =
        indicator.dataset.glassIdx === undefined
          ? idx
          : Number(indicator.dataset.glassIdx);
      // 点按了别的图标：先让位移开始，再把高亮块接管成玻璃
      const tapped =
        idx !== prevIdx &&
        idx === tapLensTargetIdx &&
        performance.now() - tapLensTargetAt < 2500;
      if (tapped) tapLensTargetIdx = -1;
      indicator.style.transform = transformStyle;
      if (tapped) beginTapLens();
    }
    indicator.dataset.glassIdx = String(idx);
    if (performance.now() < pageTintUntil) return;
    // A page switch can trigger several refreshes while HA renders the view.
    // Restart tint tracking only for a real indicator move/resize, not each pass.
    syncTint(tabs);
    if (positionChanged || geometryChanged) {
      trackHover(tabs, reduceMotion ? 0 : MOVE_MS + 180);
    }
  }

  // dock 要在「内容区」居中（宽屏有侧边栏时不能按窗口居中）
  // 同时按图标数量算胶囊宽度：≤4 个时按 4 格的宽度算格子，胶囊相应变窄
  function syncGeometry(root, toolbar, count = 0) {
    const r = toolbar.getBoundingClientRect();
    if (!r.width) return;
    if (root.style.getPropertyValue("--glass-left") !== `${r.left}px`) {
      root.style.setProperty("--glass-left", `${r.left}px`);
    }
    if (root.style.getPropertyValue("--glass-width") !== `${r.width}px`) {
      root.style.setProperty("--glass-width", `${r.width}px`);
    }

    const base = Math.min(r.width - 34, CONFIG.dock.maxWidth);
    const pad = CONFIG.dock.inset;
    const cols = Math.max(count, 4);
    let dockW = base;
    if (count > 0) {
      const cellW = (base - pad * 2) / cols;
      dockW = Math.min(base, cellW * count + pad * 2);
    }
    const want = `${Math.round(dockW)}px`;
    if (root.style.getPropertyValue("--glass-dock-width") !== want) {
      root.style.setProperty("--glass-dock-width", want);
    }
  }

  // --------------------------------------------------------------------------
  //  安卓"拉伸"（overscroll stretch）会把 fixed 元素一起拽走：底栏和 ☰ / ⋮ 上下跑。
  //  只写 overscroll-behavior 管不住 WebView 自己的原生拉伸，所以这里做两件事：
  //    1. html / body 关掉滚动与 overscroll —— 文档不再滚动，就没有可被拉伸的东西
  //    2. 把滚动搬进 hui-root 里包住 header + 视图的那层 div
  //  底栏和按钮是这层 div 的兄弟节点（fixed），无论内容怎么滑都不会动。
  //  离开目标仪表盘 / 进编辑模式时完整还原。
  //
  //  iOS 例外：不做任何锁滚动。iOS 的下拉刷新（Safari / HA App）依赖文档自身能拉，
  //  锁掉就没了；而且 iOS 的 overscroll 不会把 fixed 元素拽走，不需要这层保护。
  // --------------------------------------------------------------------------
  let scrollHost = null;
  let scrollHostStyle = null;
  let scrollLocked = false;
  let lastPath = "";

  function findScrollHost(root) {
    const kids = root.shadowRoot ? Array.from(root.shadowRoot.children) : [];
    return kids.find((el) => el.tagName === "DIV") || null;
  }

  function lockRootScroll(root) {
    if (isIOS) return;
    const host = findScrollHost(root);
    if (host && host !== scrollHost) {
      unlockHost();
      scrollHost = host;
      scrollHostStyle = host.getAttribute("style");
      host.style.setProperty("height", "100%");
      host.style.setProperty("overflow-x", "hidden");
      host.style.setProperty("overflow-y", "auto");
      host.style.setProperty("overscroll-behavior-y", "contain");
      host.style.setProperty("-webkit-overflow-scrolling", "touch");
    }
    if (!scrollLocked) {
      scrollLocked = true;
      [document.documentElement, document.body].forEach((el) => {
        if (!el) return;
        el.style.setProperty("height", "100%");
        el.style.setProperty("overflow", "hidden");
        el.style.setProperty("overscroll-behavior", "none");
        el.style.setProperty("overscroll-behavior-y", "none");
      });
    }
  }

  function unlockHost() {
    if (!scrollHost) return;
    if (scrollHostStyle === null) scrollHost.removeAttribute("style");
    else scrollHost.setAttribute("style", scrollHostStyle);
    scrollHost = null;
    scrollHostStyle = null;
  }

  function unlockRootScroll() {
    unlockHost();
    if (!scrollLocked) return;
    scrollLocked = false;
    [document.documentElement, document.body].forEach((el) => {
      if (!el) return;
      ["height", "overflow", "overscroll-behavior", "overscroll-behavior-y"].forEach(
        (p) => el.style.removeProperty(p)
      );
    });
  }

  let observedRoot = null;
  let resizeObserver = null;
  let dockCount = 0;
  let observedSidebarRoot = null;
  let observedSidebarDrawer = null;
  let sidebarDrawerObserver = null;

  function syncSidebarButtonState(root, drawer) {
    if (!root) return;
    const sync = () =>
      root.toggleAttribute("glass-sidebar-open", !!(drawer && drawer.hasAttribute("open")));
    sync();
    if (root === observedSidebarRoot && drawer === observedSidebarDrawer) return;
    if (sidebarDrawerObserver) sidebarDrawerObserver.disconnect();
    observedSidebarRoot = root;
    observedSidebarDrawer = drawer;
    sidebarDrawerObserver = null;
    if (drawer) {
      sidebarDrawerObserver = new MutationObserver(sync);
      sidebarDrawerObserver.observe(drawer, { attributes: true, attributeFilter: ["open"] });
    }
  }

  // ---- PC 顶栏动作胶囊：把 ⋮ 菜单条目摊成图标 ---------------------------------
  let glassActionsCapsule = null;
  let glassActionsSig = "";
  let glassActionsHost = null;
  let glassActionsObserver = null;
  let glassActionsObservedHost = null;
  let glassActionsSyncQueued = false;

  let glassActionsAnchor = null;
  // 被我们搬进过胶囊的节点（下拉菜单 / 按钮）。HA 重建后会出现一份不带标记的新节点，
  // 去重时优先保留它、丢掉我们的旧副本。
  const glassActionsOwned = new WeakSet();
  const glassActionsIsOwned = (node) => glassActionsOwned.has(node);

  function glassActionsDedupe(nodes) {
    if (nodes.length <= 1) return nodes[0] || null;
    const keep = nodes.find((n) => !glassActionsIsOwned(n)) || nodes[nodes.length - 1];
    nodes.forEach((node) => {
      if (node !== keep) node.remove();
    });
    return keep;
  }

  function glassActionsDedupeButtons(host) {
    if (!host) return;
    const byId = new Map();
    [...host.children].forEach((node) => {
      if (!node.id) return;
      const list = byId.get(node.id);
      if (list) list.push(node);
      else byId.set(node.id, [node]);
    });
    byId.forEach((list) => {
      if (list.length > 1) glassActionsDedupe(list);
    });
  }

  function syncActionsCapsule(root, toolbar) {
    const host = toolbar && toolbar.querySelector(".action-items");
    // HA 重建动作按钮 / 下拉菜单时立刻去重，不等 500ms 轮询：
    // 否则切换宽窄的那一小段时间里会同时看到两个 ⋮。
    if (host && glassActionsObservedHost !== host) {
      if (glassActionsObserver) glassActionsObserver.disconnect();
      glassActionsObservedHost = host;
      glassActionsObserver = new MutationObserver(() => {
        if (glassActionsSyncQueued) return;
        glassActionsSyncQueued = true;
        requestAnimationFrame(() => {
          glassActionsSyncQueued = false;
          safeRefresh();
        });
      });
      glassActionsObserver.observe(host, { childList: true });
    }
    const isDropdown = (node) => node && node.tagName === "HA-DROPDOWN";
    // HA 在 PC / 移动端切换时会重建下拉菜单（触发按钮 id 在 button-0 / dashboardmenu
    // 之间变化），旧节点可能已经被我们还回 .action-items，之后 HA 又新建一个。
    // 两处合起来去重：只要有不止一个下拉菜单，就保留 HA 新建的那份、销毁旧副本。
    const allDds = [
      ...(glassActionsCapsule
        ? [...glassActionsCapsule.children].filter(isDropdown)
        : []),
      ...(host ? [...host.children].filter(isDropdown) : []),
    ];
    const dd = glassActionsDedupe(allDds);
    // 按钮同理：同一个 id 只留一个，HA 新建的优先
    glassActionsDedupeButtons(host);
    const wide = window.matchMedia("(min-width: 871px)").matches;
    const enabled = wide && !!dd && !!root && root.hasAttribute("glass-on");
    if (!enabled) {
      if (glassActionsCapsule) {
        // 还原：把原生控件放回 action-items，胶囊隐藏
        [...glassActionsCapsule.children].forEach((node) => {
          if (host) host.appendChild(node);
        });
        glassActionsCapsule.style.display = "none";
        glassActionsDedupeButtons(host);
      }
      if (glassActionsHost) glassActionsHost.classList.remove("glass-actions-on");
      glassActionsAnchor = null;
      return;
    }
    // 首次启用（或胶囊被清空）时，用 ⋮ 当时的位置作为右端锚点；
    // 布局还没就绪（rect 为 0）就等下一次刷新，避免锚点算成屏幕外。
    if (!glassActionsCapsule || glassActionsHost !== host || !glassActionsCapsule.isConnected) {
      if (glassActionsCapsule) glassActionsCapsule.remove();
      glassActionsCapsule = null;
    }
    if (!glassActionsCapsule || glassActionsCapsule.children.length === 0) {
      // ha-dropdown 本身没有布局盒，位置以里面的触发按钮为准
      const anchorEl = dd.querySelector("ha-icon-button") || dd;
      const ddRect = anchorEl.getBoundingClientRect();
      if (ddRect.width < 1 || ddRect.height < 1 || ddRect.right < 1) {
        if (glassActionsCapsule) {
          glassActionsCapsule.remove();
          glassActionsCapsule = null;
        }
        return;
      }
      const cs = getComputedStyle(host);
      const btn = parseFloat(cs.getPropertyValue("--g-btn")) || 46;
      glassActionsAnchor = {
        right: Math.max(0, window.innerWidth - ddRect.right),
        top: ddRect.top,
        height: ddRect.height || btn,
        btn,
      };
      if (!glassActionsCapsule) {
        const el = document.createElement("div");
        el.className = "glass-actions-capsule";
        host.appendChild(el);
        glassActionsCapsule = el;
        glassActionsHost = host;
      }
    }
    const el = glassActionsCapsule;
    host.classList.add("glass-actions-on");
    // 只收桌面版这 3 个动作按钮：排除移动端变体（button-0 / dashboardmenu）
    // 以及 HA 重复渲染出来的同 id 节点，避免胶囊里出现两套图标。
    const isDesktopAction = (btn) =>
      btn &&
      btn.tagName === "HA-ICON-BUTTON" &&
      btn.id !== "button-0" &&
      btn.id !== "dashboardmenu";
    const direct = [...host.children].filter(isDesktopAction);
    let controls;
    if (direct.length) {
      const byId = new Map();
      direct.forEach((btn) => {
        const key = btn.id || `anon-${byId.size}`;
        if (!byId.has(key)) byId.set(key, btn);
      });
      controls = [...byId.values()];
    } else {
      // 已经收进胶囊的情况：沿用当前的 3 个按钮
      controls = [...el.children].filter((node) => node.tagName === "HA-ICON-BUTTON");
    }
    controls.push(dd);
    // HA 重建 toolbar 时旧节点会被换掉：清掉胶囊里已不在当前控件列表中的节点
    const keep = new Set(controls);
    [...el.children].forEach((node) => {
      if (!keep.has(node)) node.remove();
    });
    controls.forEach((node) => {
      if (node.parentElement !== el) el.appendChild(node);
      glassActionsOwned.add(node);
    });
    const anchor = glassActionsAnchor;
    if (!anchor) return;
    const count = el.children.length || 4;
    const gap = 10; // 与 CSS 里的 gap 保持一致
    el.style.display = "flex";
    el.style.top = anchor.top + "px";
    el.style.height = anchor.height + "px";
    el.style.right = anchor.right + "px";
    el.style.left = "auto";
    el.style.width = anchor.btn * count + gap * (count - 1) + "px";
  }

  function refresh() {
    const { root, panel, ha, drawer } = parts();
    const themes = ha && ha.hass && ha.hass.themes;
    const light = Boolean(themes && themes.darkMode === false);
    // 侧栏装饰失败不应影响整页皮肤，单独兜住异常。
    try {
      styleSidebarFrame(drawer, root, light);
    } catch (err) {
      log("sidebar frame failed", err);
    }
    if (!root || !root.shadowRoot) return;
    const toolbar = root.shadowRoot.querySelector(".toolbar");
    if (!toolbar) return;
    if (root.hasAttribute("glass-light") !== light) {
      root.toggleAttribute("glass-light", light);
    }

    // 编辑仪表盘模式：完全不动（只摘掉 glass-on，标题留在原位)
    const editing = !!root.shadowRoot.querySelector(".edit-mode");
    const targeted = isTargetDashboard();
    const on = targeted && !editing;
    if (root.hasAttribute("glass-on") !== on) {
      root.toggleAttribute("glass-on", on);
    }
    if (!on) {
      // 编辑模式 / 非目标仪表盘：标题样式摘掉，让它回到 header 里可编辑的位置
      toolbar.querySelectorAll(".glass-title").forEach((el) => el.remove());
      if (targeted) syncViewTitle(root, panel, false);
      unlockRootScroll();
      return;
    }

    migrateLegacySidebarMode();
    injectStyle(root);
    styleSidebarFrame(drawer, root, light);
    syncSidebarButtonState(root, drawer);
    syncActionsCapsule(root, toolbar);
    lockRootScroll(root);

    // 切页后新视图从页面顶部开始（滚动现在在内容层里，窗口不再是滚动容器）
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (scrollHost) scrollHost.scrollTop = 0;
    }

    // 子视图（view 配置里 subview: true）：HA 会隐藏 tab 栏、把 ☰ 换成返回箭头。
    // 只有一个普通视图时 HA 也不渲染 tab 栏（改成显示 main-title）。
    // 这两种情况都用我们自己搭的底栏。
    const curView = currentView(panel);
    const isSubview = !!(curView && curView.subview);
    const hasNativeTabs = !!toolbar.querySelector("ha-tab-group");
    const useCustomDock = isSubview || !hasNativeTabs;
    // 非子视图且没有原生 tab 时，HA 会在左边显示 main-title，我们已经有居中标题了
    root.toggleAttribute("glass-no-tabs", !isSubview && !hasNativeTabs);

    injectTitle(toolbar, panel, !isSubview);
    syncMenuButton(toolbar, ha, isSubview);
    restyleOverflow(toolbar);
    offsetOverflowMenu(toolbar);
    syncMenuScrim(root, toolbar);
    injectEditItem(toolbar);
    hideSubviewTabs(toolbar, panel);
    markActiveTab(toolbar);
    injectTabLabels(toolbar, panel);
    logTabDiag(toolbar, panel);
    syncIndicator(toolbar);
    syncSubviewDock(root, panel, useCustomDock);
    attachPageSwipe(root, panel, toolbar);
    dockCount = useCustomDock
      ? nonSubviewViews(panel).length
      : dockTabs(toolbar).length;
    syncGeometry(root, toolbar, dockCount);
    // 非子视图：隐藏 header 里那行 h1（文字已在顶栏显示），空卡片整行收掉
    syncViewTitle(root, panel, !isSubview);

    if (root !== observedRoot) {
      observedRoot = root;
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = new ResizeObserver(() => {
        const tb = root.shadowRoot && root.shadowRoot.querySelector(".toolbar");
        if (tb) syncGeometry(root, tb, dockCount);
      });
      resizeObserver.observe(toolbar);
    }
  }

  const safeRefresh = () => {
    try {
      refresh();
    } catch (err) {
      log("refresh failed", err);
    }
  };

  // 切页后视图是异步重建的，500ms 的轮询会让"标题"先露出来闪一下。
  // 这里在切页后的 400ms 内用 rAF 连续补刷（rAF 在绘制前执行，能赶在标题被画出来之前隐藏）
  let fastUntil = 0;
  let rafId = 0;
  let lastObservedLocationPath = location.pathname;
  const fastTick = () => {
    rafId = 0;
    safeRefresh();
    if (Date.now() < fastUntil) rafId = requestAnimationFrame(fastTick);
  };
  const fastCatchUp = () => {
    fastUntil = Date.now() + 400;
    if (!rafId) rafId = requestAnimationFrame(fastTick);
  };

  const onLocationChanged = () => {
    // If HA navigated/replaced the tab group while a pointer was captured, don't
    // leave the old drag class/indicator transform attached to the new page.
    if (dragState) cancelStaleDockDrag(dragState.tg, []);
    const path = location.pathname;
    if (path === lastObservedLocationPath) {
      safeRefresh();
      return;
    }
    lastObservedLocationPath = path;
    fastCatchUp();
    glassLastSwitchAt = performance.now();
    observeGlassView(getGlassParts().vc);
    // 切页后视图是异步重建的：先拍一张，等布局稳定后再补拍一张，
    // 这样下次按住遮罩时背景已经是新页面。
    scheduleGlassCapture(80, true);
    clearTimeout(glassViewSettleTimer);
    glassViewSettleTimer = setTimeout(() => {
      glassViewSettleTimer = 0;
      scheduleGlassCapture(0, true);
    }, 450);
    if (!dragState && Date.now() >= snapUntil) {
      // On a native page change, keep the existing tint still while HA and the
      // indicator settle; apply the final tint once instead of sweeping/flashing
      // it repeatedly during the repeated fast refreshes.
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
      pageTintUntil = performance.now() + MOVE_MS;
      clearTimeout(pageTintTimer);
      pageTintTimer = setTimeout(() => {
        pageTintUntil = 0;
        const { root } = parts();
        const toolbar = root && root.shadowRoot && root.shadowRoot.querySelector(".toolbar");
        if (toolbar) syncTint(dockTabs(toolbar));
      }, MOVE_MS + 20);
    }
    safeRefresh();
  };

  window.addEventListener("location-changed", onLocationChanged);
  window.addEventListener("popstate", onLocationChanged);
  window.addEventListener("resize", safeRefresh);
  document.addEventListener("visibilitychange", safeRefresh);
  setInterval(safeRefresh, 500);
  safeRefresh();
  log("loaded");
})();
