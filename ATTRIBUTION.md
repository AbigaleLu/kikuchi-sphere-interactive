# 图纸来源、改编与致谢

## 原始图纸与展开布局：Austin P. Day

本项目参考 Austin P. Day 的 **Polyhedral cubic Kikuchi maps**，并使用项目维护者提供的 FCC / BCC 图纸构建数字模型。

- 原作品：[Polyhedral cubic Kikuchi maps](https://www.thingiverse.com/thing:969758)
- 原作者：Austin P. Day
- 许可：[Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported（CC BY-NC-SA 3.0）](https://creativecommons.org/licenses/by-nc-sa/3.0/)

网页中的 **Austin P. Day 原图版** 对应以下文件：

- `assets/FCCpage1.jpg`、`assets/FCCpage2.jpg`：FCC 展开图，两张组成一套。
- `assets/bcc_all2.jpg`：BCC 展开图，一张组成一套。
- `assets/drawings/*.png`：从上述图纸定位、裁切和插值得到的面贴图。未重新绘制其中的菊池线条。

“原图版”表示沿用所提供原图的内容，不表示覆盖全部可能的晶面或晶带轴。当前 BCC 原图分辨率限制了放大后的清晰度。

## 低指数教学版：Codex Astra 提供 AI 辅助

网页默认展示 **低指数教学版（Strict）**。这是一份基于 Austin P. Day 图纸和多面体展开布局参考的教学改编，不是 Austin P. Day 的原始 PDF。

`source/reference.pdf` 是 2026-09-04 完成的 FCC / BCC 两片式 A4 教学图纸：两种结构边长均为 26.404421 mm；FCC 为第 1 页，BCC 为第 2 页；字号统一，负指数使用上横杠。文件名为兼容既有链接而保留。

- SHA-256：`87057e4815f465ccb34594c8eeb3d0fa7445db52257c46e0bbd492df73991a9a`
- `assets/fcc-*.png`、`assets/bcc-*.png` 是该教学 PDF 的面贴图。
- Codex Astra（OpenAI Codex，AI 辅助工具）协助中心线重绘、标签与打印排版、多面体建模和网页实现。该署名说明 AI 辅助工作的来源，不把 AI 描述为原始图纸作者或独立权利人。

主要改编包括：筛选低指数晶面族、将共线高次反射合并为中心线、选择保留中心线交点的晶向标注、重新生成负指数上横杠标签、调整字号、加入无编号胶舌，以及统一 FCC / BCC 的 A4 排版与实体边长。网页进一步进行了几何登记、面贴图映射、交互旋转、单面预览和视图分享。

教学图纸和衍生贴图沿用 **CC BY-NC-SA 3.0**。它们不是所有低指数晶向的完整目录，也不是实时衍射模拟。

## 特别感谢：Thermo Fisher Scientific NanoPort 团队

感谢 Thermo Fisher Scientific NanoPort 工作人员慷慨提供最初的图纸，并在学习与交流中给予帮助。资料与交流支持是本项目的起点；图纸作者与权利归属仍按原作说明标注。

## 数字资源与再利用

`assets/lite/original-fcc/`、`assets/lite/original-bcc/` 对应低指数教学版；`assets/lite/new-fcc/`、`assets/lite/new-bcc/` 对应 Austin P. Day 原图版。内部目录名保留以兼容既有资源链接，并不表示图纸作者或发布时间。

轻量版旋转预览使用缩小图集，停止或选面后按需载入一个原分辨率、无损 WebP 高清面；全清晰视图使用同一批无损高清面。原始 PNG、JPG 与 PDF 均保留。资源由 `scripts/build-lite.cjs` 生成，格式转换不改变作者或许可。

转载、分享或改编这些图纸和贴图时，请保留原作者、作品名称、来源链接、许可链接及改编说明，遵守非商业性使用和相同方式共享条款。商业用途请另行取得相应权利人的许可。图纸许可不自动代替网站代码及第三方标识各自适用的权利说明。

致谢不表示 Austin P. Day、OpenAI 或 Thermo Fisher Scientific 对本项目的官方认可、赞助或背书。

可用于课件中的简短署名：

> 原始图纸与展开布局：Austin P. Day，Polyhedral cubic Kikuchi maps；低指数教学改编与数字模型的 AI 辅助：Codex Astra（OpenAI Codex）。感谢 Thermo Fisher Scientific NanoPort 团队提供最初资料与交流帮助。图纸及衍生贴图：CC BY-NC-SA 3.0。

在线使用时，请将原作者作品与 CC 许可链接一并保留。
