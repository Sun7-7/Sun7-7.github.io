# V3.7 维护、事实边界与交互矩阵

## 数据权威与扩展

publications.json 是书目事实来源；作者、DOI、日期、标题、CCF 与数值 evidence 均未改。
publication_details.focusBrief.zh/en 含 problem / method / boundary。text 必须逐字存在于 evidenceRef.field 指定的同语言旧审校字段；sourceUrl 必须属于本论文正式来源。它是旧审校内容的摘录，不声称本轮重新核验了所有原始 PDF。没有新增结果或显著性主张。
figures.naturalSize 来自 PNG 宽高，readability 由比例计算；explanation 的 information / relationship 分别指向同 owner / index 的 caption / insight。图片像素、版权状态、credit 原样保留。
research_visuals.previews.layout 声明 defaultPrimary、primaryWeight、secondaryWeight；默认先按 framework / device / result / table 的角色优先级，再按天然比例。可人工调整，但不能跨论文引用或填无效权重。

## 状态与页面矩阵

- Research：文档滚动 → 当前论文；内图指针/键盘 → 临时主图；点击/触屏 → 保留主图；Reset / Esc → 默认。内图不触发外层展开或程序滚动。整组移出恢复保留图或默认。外层论文改变后恢复各论文默认图。
- Home：研究方向、精选条目的背景/边框轻聚焦。论文链接仍进入导读，独立放大控件进入原始科研图查看器。
- Publications：保持完整作者/出版记录与筛选，仅背景及焦点反馈；无大面积自动展开。
- Paper Detail：语义页内目录 + 同一原图查看器，原始永久 URL 不变。
- About / CV：链接、按钮、主题及打印保持同一节奏；履历优先，不做重型展开。
- Blog / Notes：清晰的条目/阅读链接与轻背景，保留旧笔记 URL 和 query 重定向。

桌面可读空间不足时使用非 sticky 阅读（宽度小于1100，或窗口高度小于750，或触屏）；避免为了维持固定舞台截去正文。图块切换仅改变固定舞台内部比例。图片 contain，无坐标轴裁切、无像素编辑。次图始终有图题、放大、原图和正式图源入口；完整图解在成为主图、查看器、无JS及打印时显示。

## 新增论文

继续用 examples/new_publication.v36.blank.json 和 scripts/new_publication.py 创建人工审阅草稿；补齐正式元数据、双语详情与真实图片/权利依据。可选补 focusBrief 和布局字段，不提供时自动使用原摘要及第一张图。
通过 promote_publication.py 导入后，build_site 自动生成双语列表、Research、详情、图块、引文、sitemap 和页内导览。不要手改生成 HTML。
test_v37_contract.py 在临时环境生成自有纯色 PNG 和明确 TEST ONLY 的合成论文，模拟审核并走全管线，验证后删除；它没有把合成记录/结果/权限写进正式 data。

## 发布

用户当前消息已明确要求直接部署，优先于附件里旧的候选限制。发布前生成新的精确文件快照授权，仍不把 pending 图许可改为 verified。release build 验证前后快照一致。新论文/新第三方图片继续受原门禁约束。

缺失输入：附件所提 qa/09、其他设计与状态规范未提供；实施基于实际收到的提示词、HTML 概念与 V3.6 源码。报告不得声称读过未提供文件。
