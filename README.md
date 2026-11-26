# Glass UI for Home Assistant

把 Home Assistant 仪表盘换成 iOS 26 风格的「液态玻璃」外观：

- 左上玻璃 ☰、居中标题、右上 ⋮
- 底部玻璃胶囊 dock：按住 / 拖动时，放大的高亮会变成真正的液态玻璃，背景与图标 / 文字一起折射
- PC 顶栏右侧的搜索 / 语音助手 / 编辑三个原生按钮与 ⋮ 合并成一个玻璃胶囊
- 透明玻璃侧栏：常驻 / 抽屉统一 **20px 圆角**框，页面顶栏与背景延伸到侧栏下方，侧栏悬浮其上

**它只是外观层。** ☰ 走原生 `hass-toggle-menu`，⋮ 就是原生 `ha-dropdown`，dock 就是原生 `ha-tab-group` —— 切页、菜单、侧边栏全部是 HA 自己的逻辑，不会出现"点了没反应"或"按钮是假的"。

![Glass UI mobile view with a floating transparent sidebar](images/screenshot-dark.png)

*移动端抽屉示意图，展示玻璃侧栏浮在页面背景上；为突出框架，示意图省略了页面主体内容。*

- 适用：Home Assistant 2024.1+（2026.x 已实测）
- 不依赖 card-mod / kiosk-mode / 任何自定义卡片

---

## 安装

### 方式一：HACS（推荐）

1. HACS → 右上 ⋮ → **自定义存储库**
   - 存储库：`https://github.com/dw881114/glass-ui`
   - 类别：**Lovelace / 仪表盘（前端）**
2. HACS → **前端** → 搜索 **Glass UI** → 下载
3. 刷新页面（HACS 会自动加资源；没有的话在 设置 → 仪表盘 → 资源 里手动加
   `/hacsfiles/glass-ui/glass-ui.js`，类型 **JavaScript 模块**）

> 液态玻璃折射依赖同目录的 `snapdom.min.js`；HACS 会随脚本一并安装，请勿单独删除该文件。

### 方式二：手动

1. 把 `glass-ui.js` 和 `snapdom.min.js` 一起放到 `/config/www/glass-ui/`
2. 设置 → 仪表盘 → 右上 ⋮ → 资源 → 添加
   - URL：`/local/glass-ui/glass-ui.js`
   - 类型：**JavaScript 模块**
3. 刷新页面

手动安装时，改完 `glass-ui.js` 记得把资源 URL 的 `?v=` 数字 +1，否则页面会继续用缓存。

卸载：删掉资源 + 删掉文件即可，不会动任何仪表盘配置。

---

## 配置

默认只作用于 `url_path = lovelace`（默认「概览」仪表盘）。两种覆盖方式都不用改文件，升级也不会丢：

**1) 资源 URL 查询参数**（手写资源最方便）

```
/hacsfiles/glass-ui/glass-ui.js?dashboards=lovelace,home&tabLabel=0
```

| 参数 | 说明 |
|---|---|
| `dashboards` | 生效的仪表盘 url_path，逗号分隔；`*` = 全部 |
| `tabLabel` | `0` 关掉 dock 图标下面的文字 |
| `iconSize` / `tabLabelSize` | 图标 / 文字大小（px） |
| `addEditMenuItem` | `1` 在 ⋮ 菜单里补回「编辑仪表盘」（PC 胶囊里已有铅笔图标，默认不加） |

PC 上左上角菜单按钮只在 HA 侧栏设置为隐藏时显示；手机/窄屏的显示逻辑不变。侧栏常驻 / 折叠 / 隐藏完全遵循 HA 用户设置，脚本加载时不会强制切换。

**2) 在它之前加载的脚本里设置全局对象**（深合并，可改任意嵌套项）

```js
window.GLASS_UI_CONFIG = {
  dashboards: ["lovelace", "home"],
  dock: { height: 64, pressGrowExtraWidth: 12 },
  tabLabelSize: 11,
};
```

常用默认值：

```js
{
  dashboards: ["lovelace"],
  title: "auto",            // "auto" 标题挪到顶栏；"none" 不显示
  titleTextSize: 21,
  iconSize: 22,
  tabLabel: true,
  tabLabelSize: 10,
  dock: {
    maxWidth: 396,
    height: 60,
    inset: 5,
    bottom: 1,               // 安卓 / 窄屏
    bottomDesktop: 5,        // 桌面网页端底栏距屏幕底边
    bottomIOS: 22,           // iOS（Home 指示条安全区）
    safeArea: true,          // 安卓 / 桌面是否叠加 env(safe-area-inset-bottom)
    radius: "auto",          // "auto" = height / 2
    pressGrowExtraWidth: 10, // 按住时左右各加宽
    pressGrowExtraHeight: 5, // 按住时高度 = 胶囊高度 + 5
    pressGrowDelay: 140,     // 按住多少毫秒开始放大
    moveDuration: 486,
    growDuration: 200,
    pageSwipeThreshold: 60,  // 页面左右滑切到相邻 tab 的最短距离（px）
  },
  topButtons: { size: 46, iconSize: 21 },
  replaceOverflowIcon: true, // 原生「+」换成 ⋮（菜单内容仍是 HA 原生的）
  addEditMenuItem: false,
  overflowMenuOffset: "auto",
  overflowMenuEdge: 10,      // ⋮ 菜单距视口边缘的安全距离
}
```

---

## 交互

| 操作 | 行为 |
|---|---|
| 点 ☰ | 窄屏开侧边栏抽屉；宽屏停靠 / 收起侧边栏 |
| 侧栏抽屉 | 保持原生侧栏布局和宽度，20px 圆角外框距顶 5px + 安全区、距左 10px + 安全区、距底与 dock 一致，采用玻璃底色、模糊和边框；顶部标题区缩短 5px，分隔横线保持原屏幕位置，`Home Assistant` 在框顶与横线间垂直居中 |
| 常驻侧栏 | 侧栏未隐藏时（展开或折叠窄条），`ha-drawer` 的 `.sidebar-shell` 套用与抽屉完全相同的玻璃圆角框；内容区左内边距自动让出侧栏宽度 + 10px；当前页面的顶栏和 Lovelace 背景层向左延伸到侧栏下方，侧栏浮在背景上；不移动页面元素 |
| 点 ⋮ | 原生下拉菜单 |
| 顶栏按钮 / 菜单 | ☰ 左边距、⋮ 右边距各 10px + 安全区；按钮上沿距顶栏 10px（顶栏已避开刘海）；⋮ 菜单距视口顶部和右侧各 10px |
| PC 顶栏动作胶囊 | 屏宽 ≥ 871px 时，搜索 / 语音助手 / 编辑三个原生按钮与 ⋮ 收进同一个玻璃胶囊，靠右排列；图标与点击行为保持原生，⋮ 菜单内容不变 |
| 点 dock 图标 | 原生切页（当前版本切页无滑动动画） |
| dock 外观 | 无论屏幕宽度如何，都不显示底栏左右滚动箭头 |
| 桌面网页端 dock | 距视口底边 5px |
| 按住 / 拖动 dock | 按下后高亮块跟手横移；按住约 140ms（或一开始横拖）后放大成液态玻璃，`tint` 继续跟随高亮；拖动期间不切页，松手切到遮罩所在 tab 并恢复强调色块 |
| 页面左右滑动 | 左滑切到下一个 tab，右滑切到上一个；至少 60px；到边界不循环；从屏幕左边缘向右滑时优先交给侧栏抽屉 |
| 触觉反馈 | 长按、松手切页或页面横滑切页时反馈；HA Companion iOS / Android 使用原生 haptic bridge，普通 Android 浏览器使用 Vibration API（iOS Safari 不支持网页触觉反馈） |

- 页面横滑不会抢占纵向滚动；按钮、滑块等交互控件和横向滚动区域不触发切页；子视图不触发
- HA 生成的 dock 左右滚动箭头会隐藏，不随视口宽度出现

---

## 液态玻璃

长按 / 拖动 dock 时，放大的高亮不再只是一个强调色块，而是一层 WebGL 液态玻璃：

- **背景**：使用按下前对页面拍的快照（随包的 `snapdom` 负责取样 shadow DOM），做模糊、缩放与边缘折射；镜片轮廓用圆角 SDF 计算，边缘有轻微色散与高光
- **图标 / 文字**：单独用最高 3× 的高分辨率纹理，跟随同一套折射弯曲，所以放大后依然清晰，不会出现重影
- **外壳**：胶囊表面、边框和投影按当前深浅色主题独立生成，与静止时的 dock 保持同一套颜色
- **点按切换**：点其他图标时，滑动的强调色块也会临时变成玻璃，按位移加速度拉伸 / 压缩，到位回弹后淡回强调色；这段过渡只铺底栏色和页面底色，不显示页面截图，也不会为此触发抓拍

---

## 已知限制

- 只改外观，**不提供**任何卡片、实体或自动化。
- 依赖 HA 前端内部结构（`hui-root` / `ha-tab-group` 的 shadow DOM）。HA 大版本改版时可能需要跟进，见 CHANGELOG。
- 完整液态玻璃效果需要 WebGL2 与 `snapdom.min.js`；不可用时会退回到主题强调色高亮。
- 脚本遵循 HA 的侧栏设置，不会在加载时强制展开 / 收起；常驻、折叠或隐藏由用户在 HA 中决定。

## 更新记录

见 [CHANGELOG.md](CHANGELOG.md)。当前版本 **1.2.1**。

## 许可

Glass UI 使用 MIT 许可。随包提供的 `snapdom.min.js` 为 ZumerLab 的 MIT 许可软件，见 `LICENSE.snapdom`。
