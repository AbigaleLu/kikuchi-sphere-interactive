# 菊池球 · FCC / BCC 交互教学模型

把晶带轴之间的关系，转到眼前。从低指数教学版认识主要晶向，再用 Austin P. Day 原图版探索更多高指数标注。

**[打开轻量教学模型](https://abigalelu.github.io/kikuchi-sphere-teaching/)** · [全清晰视图](https://abigalelu.github.io/kikuchi-sphere-teaching/index-drawings.html)

## 如何使用

1. 默认从 **低指数教学版 · FCC** 开始，选择 `[001]`、`[110]`、`[111]` 观察主要晶向。
2. 拖动旋转，在同一视角切换 FCC / BCC 或图纸版本。
3. 点击模型的一个面，查看并放大局部图案。
4. 需要更多标注时选择 **Austin P. Day 原图版**，并查阅作者的原始资料。
5. 使用“复制当前视图链接”分享结构、图纸、角度、缩放及所选面。

支持鼠标、触屏与键盘：方向键旋转，加减键缩放，Home 复位。图纸版本、晶体结构和预设晶向有对应的原生控件；完整晶向下拉列表暂时隐藏，仍可点选模型表面。

## 两种图纸

| 版本 | 用途 | 来源 |
| --- | --- | --- |
| 低指数教学版（默认） | 精简中心线与标注，入门和课堂演示 | 基于 Austin P. Day 的图纸和展开布局参考，Codex Astra 提供 AI 辅助 |
| Austin P. Day 原图版 | 查看所提供图纸中更多高指数标注 | Austin P. Day 的 FCC / BCC 图纸；最初资料由 NanoPort 工作人员提供 |

低指数版从各分量绝对值不超过 3 的候选晶面中按反射条件筛选，合并共线高次反射，仅标注保留中心线形成的部分晶带轴交点。它不保证列出所有低指数方向。

网页是 18 个正方形面、8 个三角形面组成的交互图纸模型，展示固定图案，不实时计算衍射花样或强度。原图版 BCC 的清晰度受源图分辨率限制。

## A4 打印

[下载低指数教学图纸](source/reference.pdf)：第 1 页 FCC，第 2 页 BCC，各两片；边长均为 26.404421 mm。A4 横向，按 **100% / 实际大小** 打印，并检查 25 mm 标尺。此 PDF 是本项目的教学改编，文件名仅因链接兼容保留。

## 本地使用与发布

下载整个仓库后可直接打开 `index-lite.html`，也可在仓库根目录运行 `python3 -m http.server 8765 --bind 127.0.0.1`。网页无第三方 JavaScript 或在线 API 依赖，GitHub Pages 使用 `main` 分支根目录，无需构建。

默认入口 `index.html` 打开轻量视图。`index-drawings.html` 为全清晰视图，两者使用同样的图纸选择、指南、打印入口与来源致谢。历史 `index-original.html` 指向轻量视图中的低指数教学版。带参数的分享链接保留图纸、结构、旋转四元数、缩放与选中面。

| 文件 | 内容 |
| --- | --- |
| `index-lite.html` / `viewer-lite.js` | 小图旋转、当前面高清、资源生命周期管理 |
| `index-drawings.html` / `viewer-drawings.js` | 所选组合的 26 面均为原分辨率 |
| `model-drawings.js` / `model-lite.js` | 几何与贴图对应关系 |
| `texture-loader-lite.js` | 图片请求取消、释放、格式回退 |
| `assets/lite/` | 共用图集及无损高清面 |
| `source/reference.pdf` | 同边长、统一字号的低指数 A4 教学版 |
| `scripts/sync-lite-page.cjs` | 从主界面同步轻量版 HTML，保持文案一致 |
| `viewer.js` / `model-data.js` | 保留的历史实现 |

### 轻量视图与全清晰视图

轻量视图只持有当前组合的整体图集和一个高清面。拖动结束后自动补充正面细节，也可点选其它面。更换图纸或结构会取消旧请求并释放已替换的 ImageBitmap；后台停止绘制并释放高清面。支持 WebP 不可用时的 JPEG / PNG 回退，以及 ImageBitmap 不可用时的普通图片解码。

首次默认 FCC **教学版**请求整体图集 438,524 字节 + 初始高清面 15,286 字节，共 **453,810 字节（约 0.454 MB）**。此前公布的 1.74 MB 对应 **Austin P. Day 原图版**默认 FCC，两者是图纸选择不同。

图集和一个高清面的稳定解码像素量约 9.52 MB；正方形高清面约 9.82 MB。这是像素量估算，不是 iPhone 浏览器实测总内存，还不包含画布、临时解码、缓存和浏览器开销。

全清晰视图按需载入当前组合的 26 张无损高清面，默认 FCC 教学版共 439,342 字节（约 0.439 MB）；其余三套切换时才请求。Austin P. Day 原图版 FCC / BCC 分别约 23.94 MB / 18.21 MB，适合需要同时查看多个面的细节且内存充足的设备。两个入口都共用已发布的 `assets/lite/` 高清资源，没有新增一套重复贴图。轻量版的优势主要是解码内存与首屏等待，不保证每套图纸的网络字节数都小于全清晰视图。

### 资源制作与验证

使用 Node.js 与 `sharp` 运行 `node scripts/build-lite.cjs` 重建资源。高清面保持源 PNG 分辨率并无损压缩；小尺寸图集用于旋转预览。源 PNG、JPG、PDF 保留。

使用 `@napi-rs/canvas` 运行 `node --test scripts/verify-lite.cjs`，11 项测试覆盖首屏请求、图片槽释放、快速切换、失败重试、格式与解码回退、后台恢复、全部 26 个晶向、分享恢复及跨视图切换。该验证为模拟浏览器环境，不代表真实 iPhone Safari 的内存和帧率实测。

页面文案更新后运行 `node scripts/sync-lite-page.cjs`，将共享界面同步到轻量入口。

## 来源与感谢

原始图纸与布局：**Austin P. Day**。教学改编与数字模型的 AI 辅助：**Codex Astra（OpenAI Codex，AI 辅助工具）**。特别感谢 **Thermo Fisher Scientific NanoPort 团队**慷慨提供最初图纸，并给予交流与帮助。

原作、改编范围、许可、无损资源转换及可引用的简短署名见 [ATTRIBUTION.md](ATTRIBUTION.md)。图纸与衍生贴图遵循 [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)。
