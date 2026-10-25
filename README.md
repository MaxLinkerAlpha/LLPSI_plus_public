# LLPSI Plus

---

## 项目缘起 — Why？

### 核心矛盾

教材进阶节奏过快，单章节难度过高难以通读。

## 项目原则 — Principles

### 要做

- **方便的**
  - 学习者尽量不跳转第二个界面使用全部功能
  - HTML 版，点开链接即可学习
  - APP 版（？）
- **自明的**
  - 能用视频则用视频解释，次之则图，最次文字
    - 尽可能使用更简单的（或者说 N-1，而不是使用固定词表）拉丁语解释拉丁语
  - 无需「翻译」为其它语言，具象单词能从图中自明，抽象概念才考虑使用文字
- **N+1**
  - 下一章内容只比上一章难一点（含拓展读物），在学习者认识八成单词之前，不往后推；但一旦认识则应当毫不犹豫往后推
  - 每一个页面不呈现过多信息，隐藏学习者当前不需要的信息
- **80% 的质，但 800% 的量**
  - 只追求八成正确，哪怕剩下两成错得离谱
- **清晰的**
  - 只挑选那些清晰的读物书籍，避免 OCR 识别混乱
  - 有课文的，而非阅读材料作为辅助，被拆散放入书籍
- **新手向**
  - 面向新人而非中高阶学习者

### 不做

- **说教的**
  - 用非拉丁语讲解语法
  - 讲故事 / 直接展示实际效果，而不过多「讲解」，更不要说教（Tell stories, don't preach）
  - 图表只做查阅，绝不用来「讲解」，能用例句「直接展示」就用
- **学得法的**
  - 不提供详尽的语法解释 / 文本注释，这不是本项目的目的。如需请参考各大教材

## 快速简介 — What？

|                |                                                                              |
| :------------- | :--------------------------------------------------------------------------- |
| **主要** | 对 LLPSI 每章节进行难度分级，根据难度匹配拓展读物（N+1），避免出现卡章的情况 |
| **衍生** | LLPSI 电子化，一个网页读全系列                                               |

## 项目解决思路 — How？

### 面向实现

#### 难度计算

- 以 LLPSI 每章难度为标准
- 电子化 LLPSI：计算文本难度，自动按难度拆分读物章节（整本难度相近则不拆分），匹配 N+1 读者水平
- 必须先用带长音的 OCR 获取 OCR 文本

#### 自动匹配

上传读物自动 OCR、分板块，将相应板块匹配至对应学习章节——或者说至少得出一个难度评级。

### 面向普通用户

| 使用方式         | 说明                                                               |
| :--------------- | :----------------------------------------------------------------- |
| **方式 1** | 选定学习到的章节，查看该章节适配拓展读物                           |
| **方式 2** | 批量导入自有文本材料，系统自动 OCR、评估难度并精准匹配对应学习章节 |
| **方式 3** | 输入当前掌握水平，跳转相应 LLPSI 章节                              |

---

## 快速开始

```bash
# 本地打开 Web 端在线阅读（Bibliothēca）
cd web
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000/index.html
```

## 目录结构

```
LLPSI_plus/
├── Human_reader/         # 主语料库：切片引擎、入库元数据（intake/）、阅读单元（books/）
├── difficulty_algorithm/ # 难度评级算法 + LLPSI 词汇-章节映射表
├── OCR/                  # 全书 OCR 原文（带长音）
├── AI_reader/            # AI 生成扩展读物（带长音故事）
├── web/                  # Web 前端（目录页 + 阅读页，纯静态可部署）
├── scripts/              # 工具脚本
├── template/             # 前端模板
├── verify_latin/         # 拉丁语校验工具
└── source/               # 原始 PDF（不入库，不上传 GitHub）
```

## 当前状态

> 核心原则：遵循 LLPSI 教学法，拉丁释义拉丁、语境推导、N+1 循序渐进、带长音。

- ✅ **LLPSI 全文 OCR（带长音）**：作为难度计算的文本基础
- ✅ **难度算法**：以 LLPSI 56 章为基准尺评估任意拉丁语文本的难度等级，详见 [difficulty_algorithm/DIFFICULTY_ALGORITHM.md](difficulty_algorithm/DIFFICULTY_ALGORITHM.md)
- ✅ **AI 生成扩展读物**：带长音故事，含 imago 精修系列
- ✅ **Web 端在线阅读**：百本以上拉丁语读物、万余个按难度分级的阅读单元（持续扩充中），详见 [web/README.md](web/README.md)

---

## 致敬与致谢 — Grātiās Agimus

> 本项目收集并使用了大量开源拉丁语读物。长音（macron）标注是拉丁语学习的基石，而完整的长音文本离不开以下网站、作者与贡献者长期无私的工作。在此致以最诚挚的感谢（Grātiās maximās vōbīs agimus）。以下按来源分组列出，含网址与许可证，方便读者查阅原文与复用。

### 1. fabulaefaciles.com（公版书转录）

社区贡献者将公版书转录为电子文本，使用 **Alatius Latin Macronizer** 自动标注长音，再经人工校对，是本次收录质量最高的大宗来源（可信度 A 级）。

- 网址：https://www.fabulaefaciles.com
- 许可证：公版（转录 CC-BY）

### 2. Dickinson College Commentaries（DCC）

学者编辑的带注释、带词汇表、带长音的拉丁语读本，长音精度极高（可信度 S 级）。

- 网址：https://dcc.dickinson.edu
- 许可证：CC BY-NC-SA 4.0

### 3. Johan Winge — Alatii Recitationes

**Alatius Latin Macronizer** 长音标注工具的作者本人亲自校对的文本语料，是其 macronizer 的训练基准（可信度 S 级）。

- 网址：http://web.comhem.se/alatius/latin/
- 许可证：自由使用

### 4. fpsvogel — maccer

整合多源的 macronizer 训练语料，其中包含 **Laura Gibbs**（bestlatin.net）整理的拉丁寓言 *Ictibus Felicibus*，以及 DCC 的维吉尔选段等（可信度 A 级）。

- 网址：https://github.com/fpsvogel/maccer
- 许可证：多源

### 5. austintheriot — Nova Vulgata with macrons

为完整拉丁圣经（Nova Vulgata）标注长音的开放项目，是本项目圣经篇章的文本基础（可信度 B 级）。

- 网址：https://github.com/austintheriot/nova-vulgata-with-macrons
- 许可证：**不是公版** —— Nova Vulgata 文本版权归 Libreria Editrice Vaticana（梵蒂冈圣座）；本项目仅使用其社区长音标注版本作学习参考

### 6. Project Gutenberg

人类历史上最古老的电子书库，提供大量公版拉丁语原著。

- 网址：https://www.gutenberg.org
- 许可证：公版

### 7. Wikisource / Wikibooks / Wikiversity

维基系社区协作维护的拉丁语文本与教学页面，开放编辑、持续更新（可信度 D 级）。

- 网址：https://la.wikisource.org
- 许可证：CC BY-SA 3.0

### 8. Found in Antiquity（Magistra Hurt）

现代拉丁语教学博客，作者 Magistra Hurt 长期创作与分享拉丁语阅读材料（可信度 A 级）。

- 网址：https://foundinantiquity.com/
- 许可证：Creative Commons

### 9. GitHub 开源贡献者群

- **increpare**（metamorphosespdf）：奥维德《变形记》全 15 卷 PDF + 文本（公版，机器 macron 化，可信度 C 级）— https://github.com/increpare/metamorphosespdf
- **ADante08**（De-brevitate-vitae-macronized）：塞内加《论生命之短暂》长音版（可信度 C 级）— https://github.com/ADante08/De-brevitate-vitae-macronized
- **FergusJPWalsh**（sonnenschein）：Sonnenschein 教材《Ora Maritima》等学者人工完整 macron 化（可信度 S 级）— https://github.com/FergusJPWalsh/sonnenschein
- **DoctrinaLatina**（doctrina-latina）：圣咏与祷文（可信度 B 级）— https://github.com/DoctrinaLatina/doctrina-latina

### 10. 拉丁语教学社区

- **Lupus Alatus**：原创拉丁语短读（https://lupusalatus.com/reading/）
- **Magister Craft**：*Philemon et Baucis* 等原创故事（https://www.magistercraft.com/philemon-et-baucis）
- **Latinitium**：Halloween 系列恐怖主题拉丁语读本（https://latinitium.com/tag/halloween/）
- **JustinLearnsLatin**：拉丁语阅读清单与资源导航（https://www.justinlearnslatin.com/）

---

> 长音标注工具：[Alatius Latin Macronizer](https://alatius.com/macronizer/)，由 Johan Winge 开发，以上多个来源的长音均由其自动生成后再经人工校对。
>
> 若您也是拉丁语开源读物作者/维护者，希望本项目收录您的作品，欢迎联系我们。
>
> 本项目以**公版与开放许可文本**为主体；另有少量**在版教材选段**用于学习对照，
> 其著作权归各出版方所有，**不在本项目授权范围内**，详见 [NOTICE.md](NOTICE.md)。
> 如任何权利人认为收录超出可接受范围，联系我们后将在 48 小时内移除。
