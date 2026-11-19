# Glass UI for Home Assistant

把 Home Assistant 仪表盘换成 iOS 26 风格的「液态玻璃」外观：

- 左上玻璃 ☰
- 居中标题
- 右上 ⋮
- 底部玻璃胶囊 dock

**它只是外观层。** ☰ 走原生 `hass-toggle-menu`，⋮ 就是原生 `ha-dropdown`，dock 就是原生 `ha-tab-group` —— 切页、菜单、侧边栏全部是 HA 自己的逻辑，不会出现"点了没反应"或"按钮是假的"。

![Glass UI](images/screenshot-dark.png)

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

> 还没发布到 HACS 默认商店时，必须用「自定义存储库」添加，装好后一样能收到更新。

### 方式二：手动

1. 把 `glass-ui.js` 放到 `/config/www/glass-ui/glass-ui.js`
2. 设置 → 仪表盘 → 右上 ⋮ → 资源 → 添加
   - URL：`/local/glass-ui/glass-ui.js`
   - 类型：**JavaScript 模块**
3. 刷新页面

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
| `hideExtraActions` | `0` 保留搜索 / 语音助手 / 编辑三个按钮 |
| `collapseSidebarOnWide` | `0` 宽屏不收起侧边栏 |

PC 上左上角菜单按钮只在 HA 侧栏设置为隐藏时显示；手机/窄屏的显示逻辑不变。

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
  titleBarHeight: 56,
  iconSize: 22,
  tabLabel: true,
  tabLabelSize: 10,
  dock: {
    maxWidth: 396,
    height: 60,
    inset: 5,
    bottom: 1,              // 安卓 / 桌面
    bottomIOS: 22,          // iOS（Home 指示条安全区）
    pressGrowExtraWidth: 10, // 按住时左右各加宽
    pressGrowExtraHeight: 5, // 按住时高度 = 胶囊高度 + 5
    pressGrowDelay: 140,
    moveDuration: 486,
    growDuration: 200,
    pageSwipeThreshold: 60,  // 页面左右滑切到相邻 tab 的最短距离（px）
  },
  topButtons: { size: 46, iconSize: 21 },
  collapseSidebarOnWide: true,
}
```

---

## 交互

| 操作 | 行为 |
|---|---|
| 点 ☰ | 窄屏开侧边栏抽屉；宽屏停靠 / 收起侧边栏 |
| 点 ⋮ | 原生下拉菜单 |
| 点 dock 图标 | 切页（原生 tab 行为） |
| 按住 / 拖动 dock | 高亮块跟手横移 |
| 页面左右滑动 | 左滑切到下一个 tab，右滑切到上一个；至少 60px；到边界不循环 |
| 触觉反馈 | 长按、停留切页或页面横滑切页时反馈；HA Companion iOS / Android 使用原生 haptic bridge，普通 Android 浏览器使用 Vibration API（iOS Safari 不支持网页触觉反馈） |

- 页面横滑不会抢占纵向滚动；按钮、滑块等交互控件和横向滚动区域不触发切页；子视图不触发

---

## 已知限制

- 只改外观，**不提供**任何卡片、实体或自动化。
- 依赖 HA 前端内部结构（`hui-root` / `ha-tab-group` 的 shadow DOM）。HA 大版本改版时可能需要跟进，见 CHANGELOG。
- 宽屏下默认把侧边栏收起（`collapseSidebarOnWide`），不喜欢可以关掉。

## 许可

MIT
