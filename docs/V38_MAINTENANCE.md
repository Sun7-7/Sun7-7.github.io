# V3.8 Research Area 导航维护

本轮为候选，基线 e7ef739；没有部署授权，不合并 main。入口、导航、桥接与篇数由 AREAS / VISUALS 生成，论文和图的数据完全沿用。

一级是同页目录 nav + anchor，活跃态 aria-current=location，不是 tablist。只有显式点击写 hash 并一次原生导航；scrollspy 只读取实际 section 几何并更新高亮/进度，不改变 hash 或滚动。ResizeObserver 测量导航高度，统一驱动 scroll-margin 与论文舞台偏移。外层仍由文档位置驱动，显式跨区期间取消旧 hover/intent，并保护不在视口中的论文状态；图焦点不会被导航 hover 改写。

hash 刷新、pageshow、popstate 恢复到对应标题。无JS锚点仍可用，导航在文档流内。移动两列入口，第三方向整行；不截断名称。设备补充说明采用原生 details，正文事实保留在DOM。普通阅读模式增大摘要和英文标题字号。次图增加来源于既有 role 的简短用途标签，原图/查看器保留。

自动计数测试：test_v38_contract 在临时环境导入合成第十二篇，Learning 自动从3改为4，生成双语入口、正文、引文、sitemap，结束销毁，正式11篇保持。

测试：check_area_v38 为24种视口/语言/主题组合，跨区正反漫游、直接跳转、history/hash、减少动画和无JS；check_site_v38 继承论文/图像及其他页回归。真实设备、Safari、读屏器和原生菜单缩放必须另测，不能以axe或viewport声称通过。
