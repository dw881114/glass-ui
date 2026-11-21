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
    titleBarHeight: 56, // 顶栏高度（标题和 ☰ / ⋮ 同高）
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
    hideExtraActions: true, // 隐藏原生 搜索 / 语音助手 / 编辑 三个按钮
    addEditMenuItem: true, // 在 ⋮ 菜单里补一项「编辑仪表盘」（HA 自己有时已带，则自动跳过）
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
    ["tabLabel", "hideExtraActions", "addEditMenuItem"].forEach(
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
  --g-edge-right: calc(10px + env(safe-area-inset-right, 0px));
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
  --g-btn-shadow: 0 3px 10px rgba(0,0,0,.35);
  --g-title: #ffffff;
  --g-title-shadow: 0 1px 3px rgba(0,0,0,.45);
  --g-dock-tint: rgba(14, 14, 18, .16);
  --g-sidebar-tint: rgba(14, 14, 18, .90);
  --g-dock-filter: blur(5px) saturate(180%) brightness(1.10);
  --g-dock-band: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.05) 50%, rgba(255,255,255,.035) 100%);
  --g-dock-inner: none;
  --g-dock-outer: 0 18px 40px -16px rgba(0,0,0,.70), 0 3px 10px rgba(0,0,0,.25);
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
  --g-lens-filter: none;
  --g-lens-shadow: none;
}

:host([glass-on][glass-light]) {
  --g-scrim: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(255,255,255,.70) 58%, rgba(255,255,255,0) 100%);
  --g-btn-fg: #16171c;
  --g-btn-shadow: 0 2px 8px rgba(0,0,0,.12);
  --g-title: #16171c;
  --g-title-shadow: 0 1px 2px rgba(255,255,255,.7);
  --g-dock-tint: rgba(255, 255, 255, .24);
  --g-sidebar-tint: rgba(255, 255, 255, .90);
  --g-dock-filter: blur(5px) saturate(185%) brightness(1.02);
  --g-dock-band: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 45%, rgba(255,255,255,0) 100%);
  --g-dock-inner: none;
  --g-dock-outer: 0 14px 32px -14px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.06);
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
  --g-lens-filter: none;
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
  background: var(--g-scrim) !important;
  box-shadow: none !important;
  border: none !important;
}
/* HA 的 .toolbar 自带一条 1px 分隔线，去掉 */
${P} .toolbar {
  position: relative !important;
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
  background: var(--g-dock-tint) !important;
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
  background: var(--g-dock-band);
  pointer-events: none;
  z-index: 0;
}
${P} .glass-custom-dock::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: var(--g-rim-w, 1px);
  background: var(--g-rim);
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
  background: var(--g-dock-band), var(--g-dock-tint);
  -webkit-backdrop-filter: var(--g-dock-filter);
  backdrop-filter: var(--g-dock-filter);
  box-shadow: var(--g-btn-shadow);
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

/* ☰ / ⋮ 的高光边也用底栏同一条渐变，保证质感一致 */
${P} .glass-menu::after,
${P} .action-items ha-dropdown ha-icon-button::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  padding: var(--g-rim-w, 1px);
  background: var(--g-rim);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
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
  background: var(--g-dock-band), var(--g-dock-tint) !important;
  -webkit-backdrop-filter: var(--g-dock-filter) !important;
  backdrop-filter: var(--g-dock-filter) !important;
  box-shadow: var(--g-btn-shadow) !important;
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
  background: var(--g-dock-tint) !important;
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
  background: var(--g-dock-band) !important;
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
  background: var(--g-rim);
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

/* 子视图不进底栏 */
${P} .toolbar ha-tab-group-tab[data-glass-hidden] {
  display: none !important;
}

/* 蓝色只出现在黑色高亮块覆盖到的范围内：
   每个 tab 上叠一层同样的图标+文字副本，用 clip-path 只露出被块盖住的那一段，
   其余部分保持未选中色。默认全裁掉，位置由 syncTint() 每帧写入。 */
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
    if (root.shadowRoot.querySelector("#glass-ui-style")) return;
    const style = document.createElement("style");
    style.id = "glass-ui-style";
    style.textContent = CSS;
    root.shadowRoot.appendChild(style);
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

    if (modal && !wa.shadowRoot.getElementById(SIDEBAR_GLASS_STYLE_ID)) {
      const frameStyle = document.createElement("style");
      frameStyle.id = SIDEBAR_GLASS_STYLE_ID;
      frameStyle.textContent = [
        ".drawer {",
        "  inset: var(--g-edge-top) auto var(--g-dock-bottom) var(--g-edge-left) !important;",
        "  height: auto !important;",
        "  max-height: none !important;",
        "  border: none !important;",
        "  border-radius: var(--g-sidebar-radius, 20px) !important;",
        "  overflow: hidden !important;",
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
      wa.shadowRoot.appendChild(frameStyle);
    }

    // 常驻侧栏（展开 / 折叠窄条）没有 wa-drawer，直接给 ha-drawer 里的
    // .sidebar-shell 套同一套玻璃圆角框；内容宽度仍由 HA 的 --ha-sidebar-width 决定。
    const oldDockedStyle =
      !modal && drawer.shadowRoot.getElementById(SIDEBAR_DOCKED_STYLE_ID);
    if (
      oldDockedStyle &&
      !oldDockedStyle.textContent.includes("--g-page-header-height")
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

  // 原生「编辑仪表盘」按钮被隐藏了，这里在 ⋮ 菜单里补一项
  function injectEditItem(toolbar) {
    if (!CONFIG.addEditMenuItem) return;
    const dd = toolbar.querySelector(".action-items ha-dropdown");
    if (!dd) return;

    const ours = dd.querySelector("#glass-edit-item");
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

  function injectTabLabels(toolbar, panel) {
    dockTabs(toolbar).forEach((tab) => {
      const path = tab.getAttribute("data-path");
      const text = labelForPath(panel, path) || nativeTabLabel(tab);
      if (CONFIG.tabLabel) {
        let label = tab.querySelector(":scope > .glass-tab-label");
        if (!label) {
          label = document.createElement("span");
          label.className = "glass-tab-label";
          tab.appendChild(label);
        }
        if (label.textContent !== text) label.textContent = text;
      }
      ensureTint(tab, iconForPath(panel, path) || nativeTabIcon(tab), text);
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

  // 底栏图标：优先用视图自己配置的 icon；没配就退回 HA 实际渲染的那个
  function iconForPath(panel, path) {
    const views =
      (panel && panel.lovelace && panel.lovelace.config && panel.lovelace.config.views) || [];
    const view = views.find((v) => v.path === path);
    return (view && view.icon) || "";
  }

  // 盖在高亮块上的蓝色副本（内容与真实图标/文字完全一致，靠 clip 只露出一部分）
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

    // 视图没配 icon 时 HA 本来就不显示图标，这里也不补（否则会多出一个错的图标）
    if (icon) {
      const ic = document.createElement("ha-icon");
      ic.icon = icon;
      tint.appendChild(ic);
    }

    if (CONFIG.tabLabel && text) {
      const lb = document.createElement("span");
      lb.className = "glass-tab-label";
      lb.textContent = text;
      tint.appendChild(lb);
    }
  }

  // 选中块：插在 ha-tab-group 的 shadow 里（.tabs 是 position:relative），
  // 靠 transform 平滑滑到当前 tab 下面。tab 自身只改图标颜色。
  let indicator = null;
  let dragState = null;
  let snapUntil = 0;
  let hoverRaf = 0;
  let suppressSwipeClick = null;
  window.addEventListener(
    "click",
    (ev) => {
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
  function setLensGrow(tabs, on) {
    if (!indicator || !indicator.isConnected) return;
    const fill = indicator.firstElementChild;
    if (!fill) return;
    const dx = on ? `-${GROW_W}px` : "0px";
    const dy = on ? `-${GROW_H_OFF}px` : "0px";
    if (fill.style.left !== dx) fill.style.left = dx;
    if (fill.style.right !== dx) fill.style.right = dx;
    if (fill.style.top !== dy) fill.style.top = dy;
    if (fill.style.bottom !== dy) fill.style.bottom = dy;
    // 蓝色裁剪跟着一起变宽
    if (tabs && tabs.length) trackHover(tabs, reduceMotion ? 0 : GROW_MS + 120);
  }

  // 切到某个视图：改 URL + 派发 location-changed（等价于 HA 内部的 navigate）
  function goToPath(path) {
    if (!path) return false;
    const seg = location.pathname.split("/").filter(Boolean);
    const cur = seg.length > 1 ? decodeURIComponent(seg[seg.length - 1]) : "";
    if (path === cur) return false;
    const base = seg.length ? `/${seg[0]}` : "";
    history.pushState(null, "", `${base}/${encodeURIComponent(path)}`);
    window.dispatchEvent(
      new CustomEvent("location-changed", {
        bubbles: true,
        composed: true,
        detail: { replace: false },
      })
    );
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

  // 图标颜色唯一依据：黑色高亮块此刻盖住了哪一段。
  // 被盖住的那一段变强调色，没盖住的那一段保持未选中色（见 CSS 的 .glass-tint）。
  // 返回的是"视觉上"的矩形：按住加高 / 加宽时取实际尺寸；圆角是胶囊的半圆端 = 高度/2。
  function indicatorSpan() {
    if (!indicator || !indicator.isConnected) return null;
    const t = getComputedStyle(indicator).transform;
    const m = t && t.match(/matrix\(([^)]+)\)/);
    const tx = m ? Number(m[1].split(",")[4]) : indicator.offsetLeft;
    const fill = indicator.firstElementChild;
    const dx = fill ? fill.offsetLeft : 0;
    const fw = fill ? fill.offsetWidth : indicator.offsetWidth;
    const fh = fill ? fill.offsetHeight : indicator.offsetHeight;
    return { x: tx + dx, w: fw, rad: fh / 2 };
  }

  // 按高亮块的实际位置给每个 tab 的蓝色副本算裁剪范围。
  // 裁剪区域和胶囊块的形状一致：块的两端是半圆，被格子边缘切开的那一侧是直线。
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
      // 只有"块自己的端头"才是圆角；被格子边界切掉的那一侧保持直角
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
      if (performance.now() < deadline) hoverRaf = requestAnimationFrame(step);
    };
    hoverRaf = requestAnimationFrame(step);
  }

  // 手势：按下即生效（不需要长按），横向拖动时选中块跟手；
  // 在某一格停留超过 200ms 自动切过去；松手吸到最近一格。
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

    // 手指停在某一格超过 200ms 就切过去（拖动过程中也生效）
    const armDwell = (state, idx) => {
      if (idx < 0 || !state.tabs[idx]) return;
      if (state.hoverIdx === idx) return;
      state.hoverIdx = idx;
      state.hapticFired = false;
      clearTimeout(state.dwellTimer);
      state.dwellTimer = setTimeout(() => {
        if (dragState !== state) return;
        const changed = goToTab(state.tabs[idx]);
        if (changed && !state.hapticFired) {
          state.hapticFired = emitDockHaptic();
        }
      }, 200);
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

        // 按住一小会儿（或开始横向拖动）就把高亮块放大，松手缩回
        state.growTimer = setTimeout(() => {
          if (dragState !== state) return;
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
      const idx = Math.max(
        0,
        Math.min(
          dragState.tabs.length - 1,
          Math.round((x - m.pad) / m.cellW)
        )
      );
      cancelAnimationFrame(hoverRaf);
      syncTint(dragState.tabs);
      armDwell(dragState, idx);
    });

    const finish = (ev) => {
      if (!dragState) return;
      if (ev.pointerId !== dragState.pointerId) return;
      const state = dragState;
      dragState = null;
      clearTimeout(state.settleTimer);
      clearTimeout(state.dwellTimer);
      clearTimeout(state.growTimer);
      cancelAnimationFrame(hoverRaf);

      const { x, m } = clampX(ev.clientX, state.tabs);
      const idx = Math.max(
        0,
        Math.min(state.tabs.length - 1, Math.round((x - m.pad) / m.cellW))
      );
      const target = state.tabs[idx];

      // 松手：高亮块缩回原大小 + 吸到最近一格，两个动画同时跑
      setLensGrow(state.tabs, false);
      indicator.style.transition = IND_TRANSITION;
      indicator.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
      snapUntil = Date.now() + MOVE_MS + 400;
      goToTab(target);
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
    tg.addEventListener("pointercancel", (ev) => {
      if (!dragState) return;
      if (ev.pointerId !== dragState.pointerId) return;
      clearTimeout(dragState.settleTimer);
      clearTimeout(dragState.dwellTimer);
      clearTimeout(dragState.growTimer);
      cancelAnimationFrame(hoverRaf);
      const tabs = dragState.tabs;
      dragState = null;
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

  function syncIndicator(toolbar) {
    const tg = toolbar.querySelector("ha-tab-group");
    const tabsEl = tg && tg.shadowRoot && tg.shadowRoot.querySelector(".tabs");
    if (!tabsEl) return;
    const tabs = dockTabs(toolbar);
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
      return;
    }

    indicator.style.width = `${w}px`;
    indicator.style.height = `${h}px`;
    indicator.style.borderRadius = radius;
    indicator.style.transform = `translate(${x}px, ${y}px)`;
    // 高亮块挪到新位置后，颜色跟着块走（切换页面时块有移动动画）
    syncTint(tabs);
    trackHover(tabs, reduceMotion ? 0 : MOVE_MS + 180);
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

  function refresh() {
    const { root, panel, ha, drawer } = parts();
    const themes = ha && ha.hass && ha.hass.themes;
    const light = Boolean(themes && themes.darkMode === false);
    styleSidebarFrame(drawer, root, light);
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
    fastCatchUp();
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
