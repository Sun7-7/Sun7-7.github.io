#!/usr/bin/env python3
"""Generate bilingual static pages from site and publication data."""

from __future__ import annotations

import copy
import html
import json
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config.json"
PUBLICATIONS_PATH = ROOT / "data" / "publications.json"
PUBLICATION_DETAILS_PATH = ROOT / "data" / "publication_details.json"
PAPER_OUTPUT_DIR = ROOT / "papers"
EN_OUTPUT_DIR = ROOT / "en"
EN_PAPER_OUTPUT_DIR = EN_OUTPUT_DIR / "papers"

MONTH_ORDER = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}

LABELS = {
    "zh": {
        "menu": "菜单",
        "theme": "暗",
        "language": "EN",
        "publicationBrief": "论文导读",
        "conference": "Conference",
        "journal": "Journal",
        "profileSnapshot": "研究者速览",
        "agenda": "当前关注的问题",
        "workflow": "研究方法工具链",
        "coreClaim": "核心结论",
        "problem": "研究问题",
        "method": "方法概览",
        "why": "为什么重要",
        "pipeline": "技术路线",
        "evidence": "证据与结果",
        "contributions": "主要贡献",
        "readingNote": "阅读提示",
        "details": "论文介绍",
        "figures": "论文图表速览",
        "quickRead": "3 分钟读懂",
        "coreFigure": "核心图表",
        "moreFigures": "更多图表速览",
    },
    "en": {
        "menu": "Menu",
        "theme": "Dark",
        "language": "中文",
        "publicationBrief": "Paper Brief",
        "conference": "Conference",
        "journal": "Journal",
        "profileSnapshot": "Research Snapshot",
        "agenda": "Current Questions",
        "workflow": "Research Workflow",
        "coreClaim": "Core Claim",
        "problem": "Research Problem",
        "method": "Method Overview",
        "why": "Why It Matters",
        "pipeline": "Technical Route",
        "evidence": "Evidence and Results",
        "contributions": "Key Contributions",
        "readingNote": "Reading Note",
        "details": "Paper Brief",
        "figures": "Figure and Table Highlights",
        "quickRead": "Three-Minute Brief",
        "coreFigure": "Core Figure",
        "moreFigures": "Additional Figure Highlights",
    },
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def deep_update(base: dict, overlay: dict) -> dict:
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_update(base[key], value)
        else:
            base[key] = copy.deepcopy(value)
    return base


def localized_config(config: dict, lang: str) -> dict:
    local = copy.deepcopy(config)
    overlays = local.pop("i18n", {})
    if lang != "zh":
        deep_update(local, overlays.get(lang, {}))
    return local


def localized_detail(detail: dict, lang: str) -> dict:
    local = {k: copy.deepcopy(v) for k, v in detail.items() if k != "en"}
    if lang == "en":
        deep_update(local, detail.get("en", {}))
    return local


def load_publications() -> list[dict]:
    publications = load_json(PUBLICATIONS_PATH)
    return sorted(
        publications,
        key=lambda p: (int(p.get("year", 0)), MONTH_ORDER.get(p.get("month", ""), 0)),
        reverse=True,
    )


def load_publication_details() -> list[dict]:
    if not PUBLICATION_DETAILS_PATH.exists():
        return []
    details = load_json(PUBLICATION_DETAILS_PATH)
    return details if isinstance(details, list) else []


def detail_lookup(details: list[dict], lang: str) -> dict[str, dict]:
    lookup = {}
    for item in details:
        if item.get("doi") and item.get("slug"):
            lookup[str(item["doi"]).lower()] = localized_detail(item, lang)
    return lookup


def fill_templates(text: object, publications: list[dict]) -> str:
    return str(text).replace("{{publication_count}}", str(len(publications)))


def is_absolute_href(href: str) -> bool:
    return href.startswith(("http://", "https://", "mailto:", "data:", "#", "/"))


def prefix_local(href: str, prefix: str = "") -> str:
    if not href or is_absolute_href(href):
        return href
    return f"{prefix}{href}"


def external_attrs(item: dict) -> str:
    return ' target="_blank" rel="noopener"' if item.get("external") else ""


def favicon_href(config: dict) -> str:
    assets = config.get("assets", {})
    if assets.get("faviconHref"):
        return assets["faviconHref"]
    text = assets.get("faviconText") or config["site"].get("brandInitials", "QS")
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        f"<text y='.86em' x='.5em' text-anchor='middle' font-size='76' font-family='Arial'>{esc(text)}</text>"
        "</svg>"
    )
    return "data:image/svg+xml," + quote(svg, safe="")


def render_head(title: str, description: str, config: dict, asset_prefix: str) -> str:
    assets = config.get("assets", {})
    og = ""
    if assets.get("openGraphImage"):
        og = f'\n  <meta property="og:image" content="{esc(prefix_local(assets["openGraphImage"], asset_prefix))}">'
    favicon = favicon_href(config)
    if not favicon.startswith("data:"):
        favicon = prefix_local(favicon, asset_prefix)
    return f"""<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">{og}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{esc(prefix_local("css/style.css", asset_prefix))}">
  <link rel="icon" href="{esc(favicon)}">
</head>"""


def render_nav(active_page: str, config: dict, lang: str, nav_prefix: str, lang_href: str) -> str:
    links = []
    for item in config.get("navigation", []):
        cls = ' class="active"' if item.get("key") == active_page else ""
        href = prefix_local(item["href"], nav_prefix)
        links.append(
            f'        <li><a href="{esc(href)}" data-page="{esc(item["key"])}"{cls}>{esc(item["label"])}</a></li>'
        )
    brand = config["site"].get("brand", config["site"].get("name", "Qi Sun"))
    initials = config["site"].get("brandInitials", "QS")
    labels = LABELS[lang]
    return f"""<nav class="navbar">
    <div class="nav-inner">
      <a href="{esc(prefix_local("index.html", nav_prefix))}" class="nav-brand">
        <span class="brand-mark">{esc(initials)}</span>
        <span>{esc(brand)}</span>
      </a>
      <button class="menu-toggle" aria-label="{esc(labels["menu"])}">{esc(labels["menu"])}</button>
      <ul class="nav-links">
{chr(10).join(links)}
        <li class="nav-utility"><a class="lang-switch" href="{esc(lang_href)}">{esc(labels["language"])}</a></li>
        <li class="nav-utility"><button class="theme-toggle" onclick="toggleTheme()" aria-label="{esc(labels["theme"])}">{esc(labels["theme"])}</button></li>
      </ul>
    </div>
  </nav>"""


def render_footer(config: dict, link_prefix: str) -> str:
    links = []
    for item in config.get("footerLinks", []):
        links.append(
            f'        <li><a href="{esc(prefix_local(item["href"], link_prefix))}"{external_attrs(item)}>{esc(item["label"])}</a></li>'
        )
    return f"""<footer class="footer">
    <div class="footer-inner">
      <ul class="footer-links">
{chr(10).join(links)}
      </ul>
      <p class="footer-copy">{esc(config["site"].get("copyright", ""))}</p>
    </div>
  </footer>"""


def render_page(
    active_page: str,
    title: str,
    description: str,
    body: str,
    config: dict,
    lang: str,
    asset_prefix: str,
    nav_prefix: str,
    lang_href: str,
) -> str:
    language = config["site"].get("language", "zh-CN")
    return f"""<!DOCTYPE html>
<html lang="{esc(language)}">
{render_head(title, description, config, asset_prefix)}
<body data-page="{esc(active_page)}" data-lang="{esc(lang)}">
  {render_nav(active_page, config, lang, nav_prefix, lang_href)}

{body}

  {render_footer(config, nav_prefix)}

  <script src="{esc(prefix_local("js/main.js", asset_prefix))}"></script>
</body>
</html>
"""


def paper_detail_for(pub: dict, details_by_doi: dict[str, dict]) -> dict | None:
    return details_by_doi.get(str(pub.get("doi", "")).lower())


def paper_page_href(detail: dict) -> str:
    return f"papers/{detail['slug']}.html"


def publication_type(pub: dict, lang: str) -> str:
    return LABELS[lang]["conference"] if pub.get("type") == "inproceedings" else LABELS[lang]["journal"]


def render_tag_list(tags: list[str]) -> str:
    return "\n".join(f'          <span class="tag">{esc(tag)}</span>' for tag in tags)


def render_publication(
    pub: dict,
    lang: str,
    compact: bool = False,
    details_by_doi: dict[str, dict] | None = None,
    paper_link_prefix: str = "",
    asset_prefix: str = "",
) -> str:
    details_by_doi = details_by_doi or {}
    detail = paper_detail_for(pub, details_by_doi)
    highlight = pub.get("highlightAuthor", "Sun, Qi")
    author_html = ", ".join(
        f'<span class="highlight">{esc(author)}</span>' if author == highlight else esc(author)
        for author in pub.get("authors", [])
    )
    month = f" {esc(pub['month'])}" if pub.get("month") else ""
    pages = pub.get("pages") or "Article"
    class_name = "pub-item pub-item-compact" if compact else "pub-item"
    summary = f'\n          <p class="pub-summary">{esc(detail.get("oneLine", ""))}</p>' if detail else ""
    links = []
    labels = LABELS[lang]
    if detail:
        links.append(f'<a href="{esc(prefix_local(paper_page_href(detail), paper_link_prefix))}">{esc(labels["details"])}</a>')
    if pub.get("url"):
        links.append(f'<a href="{esc(pub["url"])}" target="_blank" rel="noopener">DOI: {esc(pub.get("doi", ""))}</a>')
    links_html = "\n            ".join(links)
    return f"""        <article class="{class_name} fade-in">
          <div class="pub-topline">
            <span class="pub-venue">{esc(pub.get("venue", ""))}</span>
            <span class="pub-year">{esc(pub.get("year", ""))}{month}</span>
          </div>
          <h3>{esc(pub.get("title", ""))}</h3>
          <p class="pub-authors">{author_html}</p>
          <p class="pub-details">{esc(publication_type(pub, lang))} · {esc(pub.get("publisher", ""))} · {esc(pages)}</p>{summary}
          <div class="pub-links">
            {links_html}
          </div>
        </article>"""


def render_publications(
    publications: list[dict],
    lang: str,
    compact: bool = False,
    details_by_doi: dict[str, dict] | None = None,
    paper_link_prefix: str = "",
    asset_prefix: str = "",
) -> str:
    return "\n".join(
        render_publication(pub, lang, compact, details_by_doi, paper_link_prefix, asset_prefix)
        for pub in publications
    )


def render_actions(actions: list[dict], link_prefix: str = "") -> str:
    buttons = []
    for action in actions:
        style = action.get("style", "secondary")
        buttons.append(
            f'        <a href="{esc(prefix_local(action["href"], link_prefix))}" class="btn btn-{esc(style)}">{esc(action["label"])}</a>'
        )
    return "\n".join(buttons)


def render_hero_background(config: dict, asset_prefix: str) -> str:
    assets = config.get("assets", {})
    src = assets.get("heroBackgroundImage")
    if not src:
        return ""
    return f'\n    <img class="hero-bg-image" src="{esc(prefix_local(src, asset_prefix))}" alt="{esc(assets.get("heroBackgroundAlt", ""))}">'


def render_profile_highlights(home: dict, config: dict, lang: str, asset_prefix: str) -> str:
    assets = config.get("assets", {})
    visual = ""
    if assets.get("researchMapImage"):
        map_src = prefix_local(assets["researchMapImage"], asset_prefix)
        if "?" not in map_src:
            map_src = f"{map_src}?v=20260513-light"
        visual = (
        f'        <img class="hero-map-image" src="{esc(map_src)}" '
            f'alt="{esc(assets.get("researchMapAlt", ""))}" loading="eager">'
        )
    items = []
    for item in home.get("heroAnchors") or home.get("profileHighlights", []):
        items.append(
            f"""        <a class="snapshot-item" href="#research">
          <span>{esc(item.get("label", ""))}</span>
          <strong>{esc(item.get("value", ""))}</strong>
        </a>"""
        )
    return f"""      <aside class="hero-snapshot" aria-label="{esc(LABELS[lang]["profileSnapshot"])}">
        <p>{esc(LABELS[lang]["profileSnapshot"])}</p>
{visual}
{chr(10).join(items)}
      </aside>"""


def render_research_cards(config: dict, asset_prefix: str) -> str:
    cards = []
    for area in config.get("researchAreas", []):
        icon = ""
        if area.get("icon"):
            icon = (
                f'<img class="interest-icon" src="{esc(prefix_local(area["icon"], asset_prefix))}" '
                'alt="" loading="lazy">'
            )
        cards.append(
            f"""      <article class="interest-card fade-in">
        <div class="interest-top">{icon}<h3>{esc(area.get("title", ""))}</h3></div>
        <p>{esc(area.get("summary", ""))}</p>
        <div class="tags">
{render_tag_list(area.get("tags", []))}
        </div>
      </article>"""
        )
    return "\n".join(cards)


def render_reader_paths(home: dict, nav_prefix: str) -> str:
    reader_paths = home.get("readerPaths", {})
    cards = []
    for item in reader_paths.get("items", []):
        cards.append(
            f"""      <article class="reader-card fade-in">
        <span>{esc(item.get("audience", ""))}</span>
        <h3>{esc(item.get("title", ""))}</h3>
        <p>{esc(item.get("text", ""))}</p>
        <a href="{esc(prefix_local(item.get("href", "#"), nav_prefix))}">{esc(item.get("action", ""))}</a>
      </article>"""
        )
    return f"""  <section class="section reader-section">
    <div class="section-header fade-in">
      <h2>{esc(reader_paths.get("title", ""))}</h2>
      <p>{esc(reader_paths.get("description", ""))}</p>
      <div class="section-line"></div>
    </div>
    <div class="reader-grid">
{chr(10).join(cards)}
    </div>
  </section>"""


def render_research_narrative(home: dict) -> str:
    narrative = home.get("researchNarrative", {})
    cards = []
    for item in narrative.get("items", []):
        cards.append(
            f"""      <article class="research-lens-card fade-in">
        <span>{esc(item.get("label", ""))}</span>
        <h3>{esc(item.get("title", ""))}</h3>
        <p>{esc(item.get("text", ""))}</p>
      </article>"""
        )
    if not cards:
        return ""
    return f"""    <div class="research-lens">
      <div class="research-lens-intro fade-in">
        <span>{esc(narrative.get("title", ""))}</span>
        <p>{esc(narrative.get("description", ""))}</p>
      </div>
      <div class="research-lens-grid">
{chr(10).join(cards)}
      </div>
    </div>"""


def render_agenda(home: dict) -> str:
    agenda = home.get("agenda", {})
    cards = []
    for item in agenda.get("items", []):
        cards.append(
            f"""      <article class="agenda-card fade-in">
        <h3>{esc(item.get("title", ""))}</h3>
        <p>{esc(item.get("summary", ""))}</p>
      </article>"""
        )
    return f"""  <section class="section section-compact">
    <div class="section-header fade-in">
      <h2>{esc(agenda.get("title", ""))}</h2>
      <p>{esc(agenda.get("description", ""))}</p>
      <div class="section-line"></div>
    </div>
    <div class="agenda-grid">
{chr(10).join(cards)}
    </div>
  </section>"""


def render_workflow(home: dict) -> str:
    workflow = home.get("workflow", {})
    steps = []
    for i, step in enumerate(workflow.get("steps", []), start=1):
        steps.append(
            f"""      <div class="workflow-step fade-in">
        <span>{i:02d}</span>
        <h3>{esc(step.get("label", ""))}</h3>
        <p>{esc(step.get("text", ""))}</p>
      </div>"""
        )
    return f"""  <section class="section section-muted">
    <div class="section-header fade-in">
      <h2>{esc(workflow.get("title", ""))}</h2>
      <div class="section-line"></div>
    </div>
    <div class="workflow-grid">
{chr(10).join(steps)}
    </div>
  </section>"""


def render_workflow_strip(home: dict) -> str:
    workflow = home.get("workflow", {})
    steps = []
    for i, step in enumerate(workflow.get("steps", []), start=1):
        steps.append(
            f"""      <div class="workflow-step workflow-step-compact fade-in">
        <span>{i:02d}</span>
        <h3>{esc(step.get("label", ""))}</h3>
        <p>{esc(step.get("text", ""))}</p>
      </div>"""
        )
    if not steps:
        return ""
    return f"""    <div class="workflow-strip">
      <div class="mini-section-title fade-in">{esc(workflow.get("title", ""))}</div>
      <div class="workflow-grid">
{chr(10).join(steps)}
      </div>
    </div>"""


def render_featured_publications(
    publications: list[dict],
    details_by_doi: dict[str, dict],
    lang: str,
    paper_link_prefix: str,
    asset_prefix: str,
) -> str:
    labels = LABELS[lang]
    cards = []
    for pub in publications:
        detail = paper_detail_for(pub, details_by_doi)
        if not detail:
            continue
        visual = (detail.get("visuals") or [{}])[0]
        visual_html = ""
        if visual.get("src"):
            visual_html = (
                f"""        <div class="featured-paper-media">
          <img src="{esc(prefix_local(visual["src"], asset_prefix))}" alt="{esc(visual.get("title", pub.get("title", "")))}" loading="lazy">
        </div>"""
            )
        month = f" {esc(pub['month'])}" if pub.get("month") else ""
        cards.append(
            f"""      <article class="featured-paper-card fade-in">
{visual_html}
        <div class="featured-paper-body">
          <div class="pub-topline">
            <span class="pub-venue">{esc(pub.get("venue", ""))}</span>
            <span class="pub-year">{esc(pub.get("year", ""))}{month}</span>
          </div>
          <h3>{esc(pub.get("title", ""))}</h3>
          <p>{esc(detail.get("oneLine", ""))}</p>
          <div class="featured-paper-insight">
            <span>{esc(visual.get("title", labels["coreFigure"]))}</span>
            <strong>{esc(visual.get("insight", ""))}</strong>
          </div>
          <div class="pub-links">
            <a href="{esc(prefix_local(paper_page_href(detail), paper_link_prefix))}">{esc(labels["details"])}</a>
            {f'<a href="{esc(pub["url"])}" target="_blank" rel="noopener">DOI</a>' if pub.get("url") else ""}
          </div>
        </div>
      </article>"""
        )
    return "\n".join(cards)


def render_closing_section(home: dict, nav_prefix: str) -> str:
    about = home.get("aboutBrief", {})
    blog = home.get("blogBrief", {})
    return f"""  <section class="section closing-section">
    <div class="closing-grid">
      <article class="closing-card fade-in">
        <span>Profile</span>
        <h2>{esc(about.get("title", ""))}</h2>
        <p>{esc(about.get("description", ""))}</p>
        <a href="{esc(prefix_local(about.get("actionHref", "about.html"), nav_prefix))}" class="btn btn-secondary">{esc(about.get("actionLabel", ""))}</a>
      </article>
      <article class="closing-card closing-card-accent fade-in">
        <span>Notes</span>
        <h2>{esc(blog.get("title", ""))}</h2>
        <p>{esc(blog.get("description", ""))}</p>
        <a href="{esc(prefix_local(blog.get("actionHref", "blog.html"), nav_prefix))}" class="btn btn-secondary">{esc(blog.get("actionLabel", ""))}</a>
      </article>
    </div>
  </section>"""


def build_home(
    config: dict,
    publications: list[dict],
    details_by_doi: dict[str, dict],
    lang: str,
    asset_prefix: str,
    nav_prefix: str,
    lang_href: str,
    paper_link_prefix: str,
) -> str:
    home = config["home"]
    research = home["researchSection"]
    selected_cfg = home["selectedPublications"]
    selected = publications[: int(config["site"].get("selectedPublicationCount", 4))]
    stats = "\n".join(
        f'        <div><strong>{esc(fill_templates(item["value"], publications))}</strong><span>{esc(fill_templates(item["label"], publications))}</span></div>'
        for item in home.get("stats", [])
    )
    body = f"""  <section class="hero hero-professional">
    <canvas id="neural-canvas" aria-hidden="true"></canvas>{render_hero_background(config, asset_prefix)}
    <div class="hero-inner hero-layout">
      <div class="hero-copy">
        <div class="hero-tag">
          <span class="pulse-dot"></span>
          {esc(home["eyebrow"])}
        </div>
        <h1>{esc(home["headline"])}</h1>
        <p class="hero-subtitle">{esc(home["subtitle"])}</p>
        <p class="hero-desc">{esc(home["description"])}</p>
        <div class="hero-actions">
{render_actions(home.get("actions", []), nav_prefix)}
        </div>
        <div class="hero-stats" aria-label="research overview">
{stats}
        </div>
        <div class="spike-viz" aria-hidden="true"></div>
      </div>
{render_profile_highlights(home, config, lang, asset_prefix)}
    </div>
  </section>

{render_reader_paths(home, nav_prefix)}

  <section id="{esc(research.get("id", "research"))}" class="section research-mainline">
    <div class="section-header fade-in">
      <h2>{esc(research["title"])}</h2>
      <p>{esc(research["description"])}</p>
      <div class="section-line"></div>
    </div>
{render_research_narrative(home)}
    <div class="interests-grid">
{render_research_cards(config, asset_prefix)}
    </div>
{render_workflow_strip(home)}
  </section>

  <section id="{esc(selected_cfg.get("id", "selected-publications"))}" class="section featured-section">
    <div class="section-header fade-in">
      <h2>{esc(selected_cfg["title"])}</h2>
      <p>{esc(selected_cfg["description"])}</p>
      <div class="section-line"></div>
    </div>
    <div class="featured-paper-grid">
{render_featured_publications(selected, details_by_doi, lang, paper_link_prefix, asset_prefix)}
    </div>
    <div class="section-actions fade-in">
      <a href="{esc(prefix_local(selected_cfg["actionHref"], nav_prefix))}" class="btn btn-secondary">{esc(selected_cfg["actionLabel"])}</a>
    </div>
  </section>

{render_closing_section(home, nav_prefix)}"""
    return render_page(
        "home",
        config["site"]["defaultTitle"],
        config["site"]["defaultDescription"],
        body,
        config,
        lang,
        asset_prefix,
        nav_prefix,
        lang_href,
    )


def build_publications(
    config: dict,
    publications: list[dict],
    details_by_doi: dict[str, dict],
    lang: str,
    asset_prefix: str,
    nav_prefix: str,
    lang_href: str,
    paper_link_prefix: str,
) -> str:
    page = config["pages"]["publications"]
    body = f"""  <main class="page-shell">
    <section class="page-hero fade-in">
      <p class="eyebrow">{esc(page["eyebrow"])}</p>
      <h1>{esc(page["heading"])}</h1>
      <p>{esc(page["intro"])}</p>
    </section>
    <section class="section page-section">
      <div class="pub-list">
{render_publications(publications, lang, details_by_doi=details_by_doi, paper_link_prefix=paper_link_prefix, asset_prefix=asset_prefix)}
      </div>
    </section>
  </main>"""
    return render_page("publications", page["title"], page["description"], body, config, lang, asset_prefix, nav_prefix, lang_href)


def render_avatar(config: dict, asset_prefix: str) -> str:
    assets = config.get("assets", {})
    if assets.get("avatarImage"):
        return (
            f'<div class="avatar"><img src="{esc(prefix_local(assets["avatarImage"], asset_prefix))}" '
            f'alt="{esc(assets.get("avatarAlt", ""))}"></div>'
        )
    initials = config["site"].get("brandInitials", "QS")
    return f'<div class="avatar" aria-hidden="true">{esc(initials)}</div>'


def render_about_sections(config: dict, publications: list[dict]) -> str:
    blocks = []
    for section in config["about"].get("sections", []):
        paragraphs = "\n".join(
            f"      <p>{esc(fill_templates(paragraph, publications))}</p>"
            for paragraph in section.get("paragraphs", [])
        )
        items = "\n".join(
            f"        <li>{esc(fill_templates(item, publications))}</li>"
            for item in section.get("items", [])
        )
        items_html = f'\n      <ul class="about-list">\n{items}\n      </ul>' if items else ""
        blocks.append(
            f"""      <section class="about-section about-section-card fade-in">
      <h2>{esc(section.get("title", ""))}</h2>
{paragraphs}{items_html}
      </section>"""
        )
    return "\n\n".join(blocks)


def render_about_badges(about: dict) -> str:
    badges = about.get("heroTags", [])
    if not badges:
        return ""
    return "\n".join(f'          <span>{esc(item)}</span>' for item in badges)


def render_about_focus_cards(about: dict) -> str:
    cards = []
    for item in about.get("focusCards", []):
        cards.append(
            f"""      <article class="about-focus-card fade-in">
        <span>{esc(item.get("label", ""))}</span>
        <h2>{esc(item.get("title", ""))}</h2>
        <p>{esc(item.get("text", ""))}</p>
      </article>"""
        )
    if not cards:
        return ""
    return f"""    <section class="about-focus-grid">
{chr(10).join(cards)}
    </section>"""


def render_contacts(config: dict, link_prefix: str) -> str:
    lines = []
    for item in config.get("contacts", []):
        lines.append(
            f'        {esc(item["label"])}: <a href="{esc(prefix_local(item["href"], link_prefix))}"{external_attrs(item)}>{esc(item["text"])}</a>'
        )
    return "<br>\n".join(lines)


def build_about(
    config: dict,
    publications: list[dict],
    lang: str,
    asset_prefix: str,
    nav_prefix: str,
    lang_href: str,
) -> str:
    about = config["about"]
    contact_title = "联系方式" if lang == "zh" else "Contact"
    body = f"""  <main class="about-page about-page-pro">
    <section class="about-hero fade-in">
      <div class="about-portrait-column">
        {render_avatar(config, asset_prefix)}
      </div>
      <div class="about-hero-copy">
        <p class="eyebrow">{esc(about["eyebrow"])}</p>
        <h1>{esc(about["heading"])}</h1>
        <p class="about-title">{esc(about["subtitle"])}</p>
        <p class="about-bio">{esc(about["bio"])}</p>
        <div class="about-badges">
{render_about_badges(about)}
        </div>
      </div>
    </section>

{render_about_focus_cards(about)}

    <div class="about-section-grid">
{render_about_sections(config, publications)}
    </div>

    <section class="about-contact-panel fade-in">
      <h2>{esc(contact_title)}</h2>
      <p>
{render_contacts(config, nav_prefix)}
      </p>
    </section>
  </main>"""
    return render_page("about", about["title"], about["description"], body, config, lang, asset_prefix, nav_prefix, lang_href)


def build_blog(config: dict, lang: str, asset_prefix: str, nav_prefix: str, lang_href: str) -> str:
    page = config["pages"]["blog"]
    body = f"""  <main class="page-shell">
    <section class="page-hero fade-in">
      <p class="eyebrow">{esc(page["eyebrow"])}</p>
      <h1>{esc(page["heading"])}</h1>
      <p>{esc(page["intro"])}</p>
    </section>
    <section class="section page-section">
      <div id="posts-container" class="posts-list">
        <!-- Posts loaded via JS -->
      </div>
    </section>
  </main>"""
    return render_page("blog", page["title"], page["description"], body, config, lang, asset_prefix, nav_prefix, lang_href)


def build_post(config: dict, lang: str, asset_prefix: str, nav_prefix: str, lang_href: str) -> str:
    page = config["pages"]["post"]
    body = f"""  <main class="post-page">
    <div class="post-header fade-in">
      <div class="post-meta">
        <span class="post-date"></span>
        <span class="post-category"></span>
      </div>
      <h1></h1>
    </div>
    <div id="post-content" class="post-content fade-in">
      <!-- Content loaded via JS -->
    </div>
    <div class="post-back fade-in">
      <a href="{esc(prefix_local("blog.html", nav_prefix))}" class="btn btn-secondary">{esc(page["backLabel"])}</a>
    </div>
  </main>"""
    return render_page("blog", page["title"], page["description"], body, config, lang, asset_prefix, nav_prefix, lang_href)


def render_report_cards(detail: dict, lang: str) -> str:
    labels = LABELS[lang]
    items = [
        (labels["coreClaim"], detail.get("coreClaim", "")),
        (labels["problem"], detail.get("problem", "")),
        (labels["method"], detail.get("method", "")),
        (labels["why"], detail.get("whyItMatters", "")),
    ]
    return "\n".join(
        f"""      <article class="paper-info-card fade-in">
        <span>{esc(title)}</span>
        <p>{esc(text)}</p>
      </article>"""
        for title, text in items
    )


def render_pipeline(detail: dict) -> str:
    steps = []
    for i, step in enumerate(detail.get("pipeline", []), start=1):
        steps.append(
            f"""      <div class="paper-step fade-in">
        <span>{i:02d}</span>
        <h3>{esc(step.get("label", ""))}</h3>
        <p>{esc(step.get("text", ""))}</p>
      </div>"""
        )
    return "\n".join(steps)


def render_evidence(detail: dict) -> str:
    cards = []
    for item in detail.get("evidence", []):
        cards.append(
            f"""      <div class="evidence-card fade-in">
        <span>{esc(item.get("metric", ""))}</span>
        <strong>{esc(item.get("value", ""))}</strong>
        <p>{esc(item.get("note", ""))}</p>
      </div>"""
        )
    return "\n".join(cards)


def render_visuals(detail: dict, asset_prefix: str, start_index: int = 0) -> str:
    cards = []
    for visual in detail.get("visuals", [])[start_index:]:
        src = visual.get("src", "")
        if not src:
            continue
        cards.append(
            f"""      <figure class="paper-visual-card fade-in">
        <div class="paper-visual-media">
          <img src="{esc(prefix_local(src, asset_prefix))}" alt="{esc(visual.get("title", ""))}" loading="eager">
        </div>
        <figcaption>
          <span>{esc(visual.get("title", ""))}</span>
          <p>{esc(visual.get("caption", ""))}</p>
          <strong>{esc(visual.get("insight", ""))}</strong>
        </figcaption>
      </figure>"""
        )
    return "\n".join(cards)


def render_paper_quick_read(detail: dict, labels: dict, asset_prefix: str) -> str:
    visuals = detail.get("visuals", [])
    visual = visuals[0] if visuals else {}
    figure = ""
    if visual.get("src"):
        figure = f"""      <figure class="paper-core-figure fade-in">
        <div class="paper-core-media">
          <img src="{esc(prefix_local(visual["src"], asset_prefix))}" alt="{esc(visual.get("title", labels["coreFigure"]))}" loading="eager">
        </div>
        <figcaption>
          <span>{esc(labels["coreFigure"])} · {esc(visual.get("title", ""))}</span>
          <p>{esc(visual.get("caption", ""))}</p>
        </figcaption>
      </figure>"""
    quick_items = [
        (labels["coreClaim"], detail.get("coreClaim", "")),
        (labels["method"], detail.get("method", "")),
        (labels["why"], detail.get("whyItMatters", "")),
    ]
    cards = "\n".join(
        f"""        <div class="quick-read-item">
          <span>{esc(title)}</span>
          <p>{esc(text)}</p>
        </div>"""
        for title, text in quick_items
        if text
    )
    return f"""    <section class="paper-quick-read">
{figure}
      <article class="paper-quick-panel fade-in">
        <span>{esc(labels["quickRead"])}</span>
        <h2>{esc(detail.get("oneLine", ""))}</h2>
        <div class="quick-read-list">
{cards}
        </div>
      </article>
    </section>"""


def build_publication_detail(
    config: dict,
    pub: dict,
    detail: dict,
    lang: str,
    asset_prefix: str,
    nav_prefix: str,
    lang_href: str,
    back_href: str,
) -> str:
    page = config["pages"].get("publicationDetail", {})
    labels = LABELS[lang]
    author_html = ", ".join(
        f'<span class="highlight">{esc(author)}</span>' if author == pub.get("highlightAuthor", "Sun, Qi") else esc(author)
        for author in pub.get("authors", [])
    )
    month = f" {esc(pub['month'])}" if pub.get("month") else ""
    doi_link = ""
    if pub.get("url"):
        doi_link = (
            f'        <a href="{esc(pub["url"])}" class="btn btn-primary" '
            f'target="_blank" rel="noopener">{esc(page.get("doiLabel", "DOI"))}</a>'
        )
    highlights = "\n".join(f"        <li>{esc(item)}</li>" for item in detail.get("highlights", []))
    visual_section = ""
    visual_cards = render_visuals(detail, asset_prefix, start_index=1)
    if visual_cards:
        visual_section = f"""
    <section class="paper-section">
      <div class="section-header fade-in">
        <h2>{esc(labels["moreFigures"])}</h2>
        <div class="section-line"></div>
      </div>
      <div class="paper-visual-grid">
{visual_cards}
      </div>
    </section>
"""
    body = f"""  <main class="paper-page paper-report-page">
    <section class="paper-hero fade-in">
      <a class="paper-back" href="{esc(back_href)}">{esc(page.get("backLabel", ""))}</a>
      <p class="eyebrow">{esc(labels["publicationBrief"])} · {esc(pub.get("year", ""))}{month}</p>
      <h1>{esc(pub.get("title", ""))}</h1>
      <p class="paper-authors">{author_html}</p>
      <p class="paper-lead">{esc(detail.get("oneLine", ""))}</p>
      <div class="tags paper-tags">
{render_tag_list(detail.get("keywords", []))}
      </div>
      <div class="hero-actions paper-actions">
{doi_link}
      </div>
    </section>

{render_paper_quick_read(detail, labels, asset_prefix)}

    <section class="paper-report-grid">
{render_report_cards(detail, lang)}
    </section>
{visual_section}

    <section class="paper-section">
      <div class="section-header fade-in">
        <h2>{esc(labels["pipeline"])}</h2>
        <div class="section-line"></div>
      </div>
      <div class="paper-pipeline">
{render_pipeline(detail)}
      </div>
    </section>

    <section class="paper-section">
      <div class="section-header fade-in">
        <h2>{esc(labels["evidence"])}</h2>
        <div class="section-line"></div>
      </div>
      <div class="evidence-grid">
{render_evidence(detail)}
      </div>
    </section>

    <section class="paper-section paper-two-col">
      <article class="paper-info-card fade-in">
        <span>{esc(labels["contributions"])}</span>
        <ul class="paper-list">
{highlights}
        </ul>
      </article>
      <article class="paper-info-card fade-in">
        <span>{esc(labels["readingNote"])}</span>
        <p>{esc(detail.get("discussion", ""))}</p>
      </article>
    </section>
  </main>"""
    title = f"{pub.get('title', 'Paper')} | {config['site'].get('brand', 'Qi Sun')}"
    description = detail.get("oneLine") or pub.get("title", "")
    return render_page("publications", title, description, body, config, lang, asset_prefix, nav_prefix, lang_href)


def write_main_pages(lang: str, config: dict, publications: list[dict], details_by_doi: dict[str, dict]) -> list[Path]:
    is_en = lang == "en"
    out_dir = EN_OUTPUT_DIR if is_en else ROOT
    out_dir.mkdir(parents=True, exist_ok=True)
    asset_prefix = "../" if is_en else ""
    nav_prefix = ""
    paper_link_prefix = ""
    lang_base = "../" if is_en else "en/"
    pages = {
        "index.html": build_home(config, publications, details_by_doi, lang, asset_prefix, nav_prefix, f"{lang_base}index.html", paper_link_prefix),
        "publications.html": build_publications(config, publications, details_by_doi, lang, asset_prefix, nav_prefix, f"{lang_base}publications.html", paper_link_prefix),
        "about.html": build_about(config, publications, lang, asset_prefix, nav_prefix, f"{lang_base}about.html"),
        "blog.html": build_blog(config, lang, asset_prefix, nav_prefix, f"{lang_base}blog.html"),
        "post.html": build_post(config, lang, asset_prefix, nav_prefix, f"{lang_base}post.html"),
    }
    paths = []
    for filename, content in pages.items():
        path = out_dir / filename
        path.write_text(content, encoding="utf-8")
        paths.append(path)
    return paths


def write_paper_pages(lang: str, config: dict, publications: list[dict], details_by_doi: dict[str, dict]) -> list[Path]:
    is_en = lang == "en"
    out_dir = EN_PAPER_OUTPUT_DIR if is_en else PAPER_OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    asset_prefix = "../../" if is_en else "../"
    nav_prefix = "../"
    paths = []
    for pub in publications:
        detail = paper_detail_for(pub, details_by_doi)
        if not detail:
            continue
        if is_en:
            lang_href = f"../../papers/{detail['slug']}.html"
            back_href = "../publications.html"
        else:
            lang_href = f"../en/papers/{detail['slug']}.html"
            back_href = "../publications.html"
        path = out_dir / f"{detail['slug']}.html"
        path.write_text(
            build_publication_detail(config, pub, detail, lang, asset_prefix, nav_prefix, lang_href, back_href),
            encoding="utf-8",
        )
        paths.append(path)
    return paths


def main() -> None:
    raw_config = load_json(CONFIG_PATH)
    publications = load_publications()
    raw_details = load_publication_details()
    generated = []
    paper_pages = []
    for lang in ("zh", "en"):
        config = localized_config(raw_config, lang)
        details_by_doi = detail_lookup(raw_details, lang)
        generated.extend(write_main_pages(lang, config, publications, details_by_doi))
        paper_pages.extend(write_paper_pages(lang, config, publications, details_by_doi))

    print(
        f"Generated {len(generated)} main pages and {len(paper_pages)} paper pages "
        "in Chinese and English."
    )


if __name__ == "__main__":
    main()
