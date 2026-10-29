# V3.6 Research 聚焦卡片维护

当前为候选分支；部署必须另获本轮批准。V3.5 的精确文件快照授权不覆盖这些修改，`--release` 应当阻止本轮发布。

## 数据入口

- 正式书目信息：`data/publications.json`。作者顺序、DOI、日期、CCF 类别继续由原校验器与完整性记录保护。
- 双语全文与卡片：`data/publication_details.json`。可选的 `shortTitle_zh/en` 和 `oneLineContribution_zh/en` 必须成对填写；缺省时使用正式英文标题及已有双语 oneLine。短标题不是出版标题的替代品，完整英文标题在展开面板中始终可读。
- 分组顺序：`data/research_areas.json` 的 `papers`；必须与 `data/research_visuals.json` 的 `previews` 顺序一致。当前为 3/3/4；JS 不硬编码篇数，新论文可扩展。
- 双图：`previews[].figureRefs` 引用 `data/figures.json` 的语义 ID。一至两张，不可重复；所有者必须为同一论文。原型中的嵌入式图片和简写出版记录未导入正式数据。

## 新论文录入示例

`examples/new_publication.v36.blank.json` 是空白新论文草稿，不对应真实第十二篇文章，也不会被网站加载。填写书目信息、完整双语 detail、新的短标题及贡献字段、FigureRef、来源和真实审核依据。

```powershell
python scripts/new_publication.py --help
python scripts/new_publication.py --doi 真实DOI --slug new-paper --draft
# 或复制 examples/new_publication.v36.blank.json 后人工填入原文和公开元数据。
# images 须实际位于 assets/images/paper-figures；登记 figure owner/index/source/rights evidence。
# features.researchArea 与 publication.area 一致，figureRefs 只能引用本论文图。
python scripts/promote_publication.py --draft tmp/publication-drafts/new-paper.json
python scripts/build_site.py
python scripts/validate_publications.py --check-output
python scripts/check_research_data.py
python scripts/check_site.py --report-dir tmp/new-paper-qa
```

一次导入的 features 同时更新 Research 分组及图关联；构建自动生成中英文卡片、全部论文列表、详情永久链接、BibTeX 和 sitemap。若选择加入首页，还需真实图片和双语 highlight。未审核的新论文或未取得可用依据的新图片必须保持阻断；不得为了演示修改版权状态。

既有 `test_publication_pipeline.py` 在一次性副本中完成现有论文移除后重录、构建和双语输出检验，另有 12 项负例。它的成功路径是无图、非 Research 的元数据重录；不应将此称为新图片授权测试。V3.6 的 `check_research_data.py` 检查真实的十篇双语卡片、二十个图关联及五项新增负例。完整带新图的导入需要真实新论文及许可材料，此轮没有虚构这一输入。

## 交互状态

桌面宽度至少 960、窗口高度至少 700、有精细悬停指针时使用固定高度 sticky deck。每个自然滚动区间对应一个索引，整行 120ms 悬停覆盖该索引，移出整个卡片组或继续滚动后恢复位置驱动。切换只改变固定容器内部行高与透明度，不写入滚动补偿。显式点击及方向键通过一次原生平滑滚动定位；减少动画时为原生即时定位。

移动、触屏、矮窗口使用非 sticky 单项展开布局。Enter/Space 是原生 button 行为，方向键/Home/End 移动并激活；焦点位于正文控件或大图模态框时保留正文，避免隐藏键盘正在使用的链接。大图原始链接始终存在；支持原生 dialog 的浏览器增强为查看器，Esc/关闭后返回原控件。无 JS 时全部论文正文与图在真实 DOM 中展开。

## 验证

```powershell
python scripts/build_site.py
python scripts/check_research_data.py
python scripts/test_publication_pipeline.py
npm ci
python -m http.server 8096 --bind 127.0.0.1
# 另一终端：
npm run check:research:v36
```

历史 V3.5 / inline / stress 脚本的旧 DOM 选择器不适用于新 Research 布局；本轮应使用 V3.6 脚本。保留历史脚本供历史版本复现，不将其旧结果计入当前通过数。自动 axe 与浏览器模拟不能替代真实读屏器、物理手机或真实 Safari 验收。
