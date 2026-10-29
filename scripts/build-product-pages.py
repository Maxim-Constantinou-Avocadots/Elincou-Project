"""Generate a dedicated static page for each source-backed portfolio product."""
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]


def esc(value):
    return html.escape(str(value or ''), quote=True)


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value or ''))).strip()


def url(value):
    return value if urlparse(value or '').scheme in ('https', 'http') else ''


class SafeHTML(HTMLParser):
    tags = {'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'sup', 'sub', 'h2', 'h3', 'h4', 'img', 'a', 'span'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'iframe', 'object'}:
            self.skip += 1
        if self.skip or tag not in self.tags:
            return
        kept = []
        for key, value in attrs:
            if (tag == 'img' and key == 'src') or (tag == 'a' and key == 'href'):
                if url(value):
                    kept.append((key, value))
            elif (tag == 'img' and key == 'alt') or (tag in {'td', 'th'} and key in {'colspan', 'rowspan'} and str(value).isdigit()):
                kept.append((key, value))
        if tag == 'img':
            kept.append(('loading', 'lazy'))
        if tag == 'a':
            kept.extend([('target', '_blank'), ('rel', 'noopener noreferrer')])
        self.out.append('<' + tag + ''.join(f' {k}="{esc(v)}"' for k, v in kept) + '>')

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'iframe', 'object'}:
            self.skip = max(0, self.skip - 1)
            return
        if not self.skip and tag in self.tags and tag not in {'img', 'br'}:
            self.out.append(f'</{tag}>')

    def handle_data(self, value):
        if not self.skip:
            self.out.append(esc(value))


def clean(value):
    parser = SafeHTML()
    parser.feed(value or '')
    return ''.join(parser.out)


def arrow():
    return '<svg aria-hidden="true"><use href="#arrow"/></svg>'


def globe(cls=''):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#globe"/></svg>'


def image(src, title, cls='', eager=False):
    if not url(src):
        return f'<div class="product-image-missing">{globe()}<span>Product image unavailable</span></div>'
    return f'<img class="{cls}" src="{esc(src)}" alt="{esc(title)}" width="800" height="650" {"fetchpriority=\"high\"" if eager else "loading=\"lazy\""} decoding="async">'


def build(p, index, products):
    title = esc(p['title'])
    category = esc(' / '.join(p['categories']) or 'Diagnostics')
    manufacturer = esc(p['manufacturer'])
    description = plain(p['description'])
    specs = re.findall(r'<li[^>]*>(.*?)</li>', p['specifications'], re.S | re.I)
    metrics = []
    for spec in specs:
        text = plain(spec)
        if ':' in text:
            key, value = text.split(':', 1)
            if len(key) < 36 and len(value) < 26 and re.search(r'\d', value):
                metrics.append((key.strip(), value.strip()))
    metrics = metrics[:3]
    metric_html = ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in metrics)
    gallery = [(p.get('image'), p['title'])]
    if p.get('extraImage') and p.get('extraImage') != p.get('image'):
        gallery.append((p['extraImage'], f"{p['title']} — additional view"))
    thumbnails = ''.join(f'<button class="gallery-thumb" data-gallery-src="{esc(src)}" data-gallery-alt="{esc(alt)}" aria-label="View {"main image" if i == 0 else "additional image"}" aria-pressed="{str(i == 0).lower()}">{image(src, alt)}</button>' for i, (src, alt) in enumerate(gallery) if src)
    related = [q for q in products if q['slug'] != p['slug'] and set(q['categories']) & set(p['categories'])][:3]
    if len(related) < 3:
        related.extend(q for q in products if q['slug'] != p['slug'] and q not in related and q['manufacturer'] == p['manufacturer'])
        related = related[:3]
    related_html = ''.join(f'<a class="related-instrument" href="{esc(q["slug"])}.html"><div class="related-image">{image(q.get("image"), q["title"])}</div><div><span class="eyebrow">{esc(q["manufacturer"])} / {esc(" / ".join(q["categories"]) or "Diagnostics")}</span><h3>{esc(q["title"])} {arrow()}</h3><p>{esc(plain(q["description"]))}</p></div></a>' for q in related)
    video = url(p.get('videoExternalUrl') or p.get('youtubeUrl') or p.get('videoUrl'))
    if video and urlparse(video).path.lower().endswith('.mp4'):
        video_html = f'<section class="instrument-video page-section" id="video"><div class="section-heading"><span class="eyebrow">(03) — IN MOTION</span><h2>A closer look<br>at {title}<span>.</span></h2><p>Explore the instrument through the manufacturer’s product film.</p></div><div class="video-player"><video controls playsinline preload="none" {f"poster=\"{esc(p.get('extraImage') or p.get('image'))}\"" if p.get('image') or p.get('extraImage') else ""}><source src="{esc(video)}" type="video/mp4"><a href="{esc(video)}">Watch the product video</a></video><span class="eyebrow">{manufacturer} / PRODUCT FILM</span></div></section>'
    elif video:
        video_html = f'<section class="video-link-section page-section" id="video"><span class="eyebrow">(03) — IN MOTION</span><h2>See {title} in action.</h2><a class="primary-button" href="{esc(video)}" target="_blank" rel="noopener noreferrer">Watch the product film {arrow()}</a></section>'
    else:
        video_html = ''
    spec_rows = ''.join(f'<li><span>{clean(s)}</span></li>' for s in specs)
    if spec_rows:
        spec_html = f'<ul class="specification-list">{spec_rows}</ul>'
    elif not p['seriesTable']:
        spec_html = '<p>For detailed technical specifications and configuration options, speak with our team or consult the manufacturer.</p>'
    else:
        spec_html = ''
    series_html = f'<div class="series-comparison"><h3>Compare the series.</h3><p class="table-guidance">Explore the model specifications below. Scroll across on smaller screens.</p><div class="technical-table" tabindex="0" role="region" aria-label="Series specifications table">{clean(p["seriesTable"])}</div></div>' if p['seriesTable'] else ''
    enquiry = 'mailto:hello@elincou.com?subject=' + quote('Product enquiry | ' + p['title']) + '&body=' + quote('Hello Elincou,\n\nI would like to learn more about the ' + p['title'] + '.\n\nLaboratory / organisation:\nRequirements:\nPhone number:\n')
    tags = ''.join(f'<span><i></i>{esc(t)}</span>' for t in p['installationTypes'])
    manufacturer_link = f'<a class="manufacturer-link" href="{esc(url(p["manufacturerUrl"]))}" target="_blank" rel="noopener noreferrer">Manufacturer’s website ↗</a>' if url(p['manufacturerUrl']) else ''
    schema = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['title'], 'description': description, 'brand': {'@type': 'Brand', 'name': p['manufacturer']}, 'category': ' / '.join(p['categories'])}
    if p.get('image'):
        schema['image'] = p['image']
    schema_json = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0E0E0E"><title>{title} — Elincou Diagnostics</title><meta name="description" content="{esc(description[:160])}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@300;400;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="../css/tokens.css"><link rel="stylesheet" href="../css/products.css"><link rel="stylesheet" href="../css/product-page.css"><script src="../js/product-page.js" defer></script><script type="application/ld+json">{schema_json}</script></head>
<body class="instrument-page"><a class="skip-link" href="#overview">Skip to product information</a><svg class="svg-defs" aria-hidden="true"><defs><symbol id="arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol><symbol id="globe" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><ellipse cx="50" cy="50" rx="46" ry="38.5"/><ellipse cx="50" cy="50" rx="46" ry="31"/><ellipse cx="50" cy="50" rx="46" ry="23.5"/><ellipse cx="50" cy="50" rx="46" ry="16"/><ellipse cx="50" cy="50" rx="46" ry="8.5"/><path d="M4 50h92"/></symbol><symbol id="cross" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol></defs></svg>
<header class="catalog-header"><a href="../index.html" aria-label="Elincou Diagnostics home"><img src="../assets/Logo/Elincou%20Logo.png" alt="Elincou Diagnostics" width="126" height="43"></a><nav aria-label="Main navigation"><a href="../index.html#expertise">What We Do</a><a href="../products.html" aria-current="page">Products <span class="nav-dot"></span></a><a href="../index.html#values">Our Approach</a><a class="nav-contact" href="#enquire">Let’s Talk {arrow()}</a></nav></header>
<main><nav class="product-breadcrumb" aria-label="Breadcrumb"><a href="../products.html">Products</a><span>/</span><a href="../products.html?category={quote(p['categories'][0]) if p['categories'] else ''}#catalogue">{category}</a><span>/</span><span aria-current="page">{title}</span><span class="product-reference eyebrow">EL / {index + 1:02d}</span></nav>
<section class="instrument-hero"><div class="instrument-gallery"><div class="gallery-label eyebrow"><span>{manufacturer} / {category}</span><span>PRECISION IN FOCUS</span></div><div class="gallery-stage">{globe('gallery-orbit')}<span class="gallery-registration gallery-registration--a" aria-hidden="true">+</span><span class="gallery-registration gallery-registration--b" aria-hidden="true">+</span>{image(p.get('image'), p['title'], 'instrument-main-image', True)}{f'<button class="image-enlarge" aria-label="Enlarge {title} image">{arrow()}</button>' if p.get('image') else ''}</div><div class="gallery-bottom"><div class="gallery-thumbnails">{thumbnails}</div><span class="eyebrow">{len([g for g in gallery if g[0]]):02d} VIEWS / {manufacturer}</span></div></div>
<div class="instrument-intro"><span class="eyebrow intro-category"><i></i>{category}</span><p class="instrument-brand">{manufacturer}</p><h1>{title}</h1><div class="intro-keyline brand-rule"><i></i><i></i><i></i></div><div class="instrument-description">{clean(p['description'])}</div><div class="instrument-tags">{tags}</div><a class="primary-button instrument-enquire" href="#enquire">Enquire about this instrument {arrow()}</a>{manufacturer_link}<div class="intro-footnote"><span class="eyebrow">THE RIGHT INSTRUMENT.<br>THE RIGHT PARTNER.</span>{globe()}</div></div></section>
{f'<dl class="instrument-metrics">{metric_html}<div class="metrics-caption"><span class="eyebrow">AT A GLANCE</span><p>Precision.<br>In every detail.</p></div></dl>' if metrics else ''}
<nav class="instrument-section-nav" aria-label="Product sections"><a class="back-to-products" href="../products.html">{arrow()}<span>All instruments</span></a><div><a href="#overview" class="is-active">Overview</a><a href="#specifications">Specifications</a>{'<a href="#video">Product film</a>' if video_html else ''}<a href="#related">Related instruments</a></div><a class="section-enquire" href="#enquire">Enquire {arrow()}</a></nav>
<section class="instrument-overview page-section" id="overview"><div class="section-heading"><span class="eyebrow">(01) — THE INSTRUMENT</span><h2>Designed around<br>your daily workflow<span>.</span></h2><span class="overview-manufacturer">{manufacturer} / {title}</span></div><div class="overview-body">{clean(p['extraInformation'] or p['description'])}<a href="#specifications" class="inline-link">Explore technical specifications {arrow()}</a></div></section>
{f'<figure class="instrument-wide-image">{image(p["extraImage"],p["title"]+" — a closer look")}<figcaption><span class="eyebrow">{title} / {manufacturer}</span><span class="eyebrow">A CLOSER LOOK AT WHAT’S POSSIBLE.</span></figcaption></figure>' if p.get('extraImage') else ''}
<section class="instrument-specifications page-section" id="specifications"><div class="section-heading"><span class="eyebrow">(02) — TECHNICAL DETAILS</span><h2>Every detail.<br>Clearly defined<span>.</span></h2><p>Explore the specifications for {title}.</p>{manufacturer_link}</div><div class="specifications-body">{spec_html}{series_html}</div></section>
{video_html}
<section class="instrument-enquiry page-section" id="enquire"><div><span class="eyebrow">THE NEXT STEP / {title}</span><h2>Let’s find your<br>perfect fit<span>.</span></h2><p>Tell us about your laboratory and your requirements.<br>We’ll help you explore {title} and the right configuration for your needs.</p><a class="primary-button primary-button--light" href="{esc(enquiry)}">Discuss {title} {arrow()}</a><span class="enquiry-note">Opens your email with the instrument details ready to go.</span></div>{globe('enquiry-globe')}</section>
<section class="related-section page-section" id="related"><div class="related-heading"><div><span class="eyebrow">(04) — CONTINUE EXPLORING</span><h2>More possibilities<br>for your laboratory<span>.</span></h2></div><a class="inline-link" href="../products.html">View all instruments {arrow()}</a></div><div class="related-grid">{related_html}</div></section>
</main><footer class="catalog-footer"><a href="../index.html"><img src="../assets/Logo/Elincou%20Logo.png" alt="Elincou Diagnostics" width="112" height="38"></a><span>Advancing diagnostics together.</span><small>© 2026 Elincou Diagnostics</small><a href="#">Back to top ↑</a></footer><dialog class="image-dialog" aria-label="Enlarged product image"><button class="dialog-close" aria-label="Close enlarged image"><svg><use href="#cross"/></svg></button>{image(p.get('image'), p['title'], 'enlarged-product-image')}<p>{title} / {manufacturer}</p></dialog></body></html>'''


def main():
    products = json.loads((ROOT / 'data/products.json').read_text())
    output = ROOT / 'products'
    output.mkdir(exist_ok=True)
    for index, product in enumerate(products):
        if not re.fullmatch(r'[a-z0-9-]+', product['slug']):
            raise ValueError('Unsafe product slug')
        (output / (product['slug'] + '.html')).write_text(build(product, index, products))
    print(f'Generated {len(products)} dedicated product pages.')


if __name__ == '__main__':
    main()
