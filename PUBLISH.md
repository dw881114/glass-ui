# 发布清单（给自己看的）

本目录已经是可直接推到 GitHub 的仓库结构：

```
glass-ui-repo/
├── glass-ui.js            # 插件本体（HACS 按 hacs.json 里的 filename 取这个文件）
├── hacs.json              # HACS 元数据
├── README.md              # 安装 / 配置文档
├── CHANGELOG.md
├── LICENSE                # MIT
├── PUBLISH.md             # 本文件
├── publish.ps1            # 一键推送 / 发版脚本
└── .github/workflows/     # HACS 校验
```

> 这台机器目前**没有装 git / gh**，所以我没法替你推。装好之后按下面做，或者把
> GitHub 账号名告诉我，我把 README / hacs.json 里的占位路径替换好。

## 0. 仓库已按 `dw881114` 填好

已填好：`README.md` 里的安装地址、`PUBLISH.md` 里的示例、`publish.ps1` 的默认 Owner。
只剩两个可选项：

1. `LICENSE` 的 `Glass UI authors` 可以换成你的名字（也可保留）
2. 仓库描述 / topics（GitHub 页面右侧 About，脚本会自动设）：
   - 描述：`iOS 26 liquid glass look for the Home Assistant dashboard, built on native HA controls.`
   - topics：`home-assistant` `hacs` `lovelace` `dashboard` `frontend` `liquid-glass`

## 1. 装工具 + 登录

```powershell
winget install Git.Git
winget install GitHub.cli
gh auth login          # 选 GitHub.com → HTTPS → 浏览器登录
```

## 2. 建仓库并推送

```powershell
cd D:\Documents\默认项目\glass-ui-repo
git init -b main
git add .
git commit -m "Glass UI 1.0.0"
gh repo create glass-ui --public --source . --push
```

（也可以先在网页上建空仓库，再 `git remote add origin ...` + `git push -u origin main`。）

## 3. 打 tag + 发 Release（HACS 必须有 Release）

```powershell
git tag v1.0.0
git push origin v1.0.0
gh release create v1.0.0 --title "Glass UI 1.0.0" --notes-file CHANGELOG.md
```

## 4. 让用户能装

**立即可用（不用审核）**：用户在自己的 HACS 里
`⋮ → 自定义存储库 → https://github.com/dw881114/glass-ui → 类别 Lovelace/仪表盘`，
然后 HACS → 前端 → Glass UI → 下载。

**上架 HACS 默认商店（要审核）**：

1. fork `hacs/default`
2. 在 `plugin` 这个文件里按字母序加一行：`"dw881114/glass-ui"`
3. 开 PR，标题类似 `Add Glass UI`
4. 审核要求（提前对齐，避免被打回）：
   - 仓库有 description + topics，README 有安装说明
   - 有 release（tag 形如 `v1.0.0`）且 `hacs.json` 里 `filename` 指向真实文件
   - 代码可读、非纯压缩产物，有 LICENSE
   - 仓库是"通用插件"，不是某个人的私人配置
5. 合并后 1～2 次 HACS 数据同步即可在默认商店搜到（通常 1～3 天）

## 5. 之后发版

改 `glass-ui.js` → 更新 `CHANGELOG.md` → 改版本号（tag）→

```powershell
git add -A; git commit -m "1.0.1"; git push
git tag v1.0.1; git push origin v1.0.1
gh release create v1.0.1 --title "Glass UI 1.0.1" --notes-file CHANGELOG.md
```

HACS 会按 Release 提示更新；用户端更新后刷新页面即可。

## 6. 关于"HA 官方商店"

Home Assistant **没有**面向前端插件的官方商店，社区的标准渠道就是 **HACS**；
真正的"官方应用商店"只收集成（Python，出现在「设备与服务」里），而本项目是纯前端资源，
所以正确的类别是 **HACS → 前端（Lovelace）**，不是集成。
