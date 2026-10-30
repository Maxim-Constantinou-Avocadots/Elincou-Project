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
    video = url(p.get('videoExternalUrl') or p.get('youtubeUrl') or p.get('videoUrl'))
    enquiry = 'mailto:hello@elincou.com?subject=' + quote('Product enquiry | ' + p['title']) + '&body=' + quote('Hello Elincou,\n\nI would like to learn more about the ' + p['title'] + '.\n\nLaboratory / organisation:\nRequirements:\nPhone number:\n')
    tags = ''.join(f'<span><i></i>{esc(t)}</span>' for t in p['installationTypes'])
    manufacturer_link = f'<a class="manufacturer-link" href="{esc(url(p["manufacturerUrl"]))}" target="_blank" rel="noopener noreferrer">Manufacturer’s website ↗</a>' if url(p['manufacturerUrl']) else ''
    schema = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['title'], 'description': description, 'brand': {'@type': 'Brand', 'name': p['manufacturer']}, 'category': ' / '.join(p['categories'])}
    if p.get('image'):
        schema['image'] = p['image']
    schema_json = json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c')
    summary = p.get('cardDescription') or description
    overview_parts = [clean(p['description'])]
    if plain(p.get('extraInformation')) and plain(p['extraInformation']) != description:
        overview_parts.append(clean(p['extraInformation']))
    # Break dense source paragraphs at sentence boundaries, preserving the source wording.
    def readable_paragraph(match):
        content = match.group(1)
        if len(plain(content)) < 600 or re.search(r'<(?:img|table)', content):
            return '<p>' + content + '</p>'
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', plain(content))
        chunks = []
        current = ''
        for sentence in sentences:
            if len(current) + len(sentence) > 450 and current:
                chunks.append(current)
                current = ''
            current = (current + ' ' + sentence).strip()
        if current:
            chunks.append(current)
        return ''.join('<p>' + esc(chunk) + '</p>' for chunk in chunks)
    overview_html = re.sub(r'<p>(.*?)</p>', readable_paragraph, ''.join(overview_parts), flags=re.S)
    rows = []
    for item in specs:
        value = plain(item)
        if ':' in value:
            label, value = value.split(':', 1)
            rows.append(f'<div><dt>{esc(label.strip())}</dt><dd>{esc(value.strip())}</dd></div>')
        else:
            rows.append(f'<div class="spec-full"><dd>{clean(item)}</dd></div>')
    specifications = '<dl class="spec-rows">' + ''.join(rows) + '</dl>' if rows else ''
    if not rows and not p['seriesTable']:
        specifications = '<p class="spec-unavailable">Contact our team for technical specifications and available configurations.</p>'
    series_table = f'<div class="series-comparison"><p class="table-guidance">Compare the models in this series. Swipe or scroll across to see every model.</p><div class="technical-table" tabindex="0" role="region" aria-label="Model comparison table">{clean(p["seriesTable"])}</div></div>' if p['seriesTable'] else ''
    if video:
        poster = esc(p.get('extraImage') or p.get('image') or '')
        player = f'<video controls playsinline preload="none" poster="{poster}" aria-label="{title} manufacturer product video"><source src="{esc(video)}" type="video/mp4"><a href="{esc(video)}">Watch product video</a></video>' if urlparse(video).path.lower().endswith('.mp4') else f'<a class="inline-link" href="{esc(video)}" target="_blank" rel="noopener noreferrer">Watch manufacturer’s product video ↗</a>'
        video_section = f'<section class="information-section" id="video"><div class="section-heading"><span class="section-marker" aria-hidden="true"></span><h2>Product video</h2></div><p class="video-intro">See {title} in action in the manufacturer’s product film.</p><div class="video-player">{player}</div></section>'
    else:
        video_section = ''
    # Related instruments share a discipline; do not fill empty slots with unrelated equipment.
    related = [q for q in products if q['slug'] != p['slug'] and set(q['categories']) & set(p['categories'])][:3]
    related_cards = ''.join(f'<a class="related-instrument" href="{esc(q["slug"])}.html"><div class="related-image">{image(q.get("image"),q["title"])}</div><div><span class="eyebrow">{esc(q["manufacturer"])}</span><h3>{esc(q["title"])} {arrow()}</h3><p>{esc(q.get("cardDescription") or plain(q["description"]))}</p></div></a>' for q in related)
    related_section = f'<section class="related-section"><div class="related-heading"><div><span class="eyebrow">CONTINUE EXPLORING</span><h2>Related instruments</h2></div><a class="inline-link" href="../products.html">View all instruments {arrow()}</a></div><div class="related-grid">{related_cards}</div></section>' if related else ''
    context = {
        'title': title, 'meta_description': esc(summary[:160]), 'schema_json': schema_json,
        'arrow': arrow(), 'category': category, 'manufacturer': manufacturer,
        'category_breadcrumb': f'<a href="../products.html?category={quote(p["categories"][0])}#catalogue">{category}</a><span>/</span>' if p['categories'] else '',
        'main_image': image(p.get('image'),p['title'],'instrument-main-image',True),
        'enlarge_button': f'<button class="image-enlarge" aria-label="Enlarge {title} image">{arrow()}</button>' if p.get('image') else '',
        'thumbnails': thumbnails if len([g for g in gallery if g[0]]) > 1 else '',
        'gallery_hint': 'Select an image to explore' if len([g for g in gallery if g[0]]) > 1 else '',
        'summary': esc(summary), 'tags': tags,
        'metrics': f'<dl class="hero-facts">{metric_html}</dl>' if metrics else '',
        'enquiry': esc(enquiry), 'video_nav': '<a href="#video">Video</a>' if video_section else '',
        'overview': overview_html, 'specifications': specifications, 'series_table': series_table,
        'manufacturer_link': manufacturer_link, 'video_section': video_section,
        'related_section': related_section, 'enlarged_image': image(p.get('image'),p['title'],'enlarged-product-image')
    }
    template = (ROOT / 'templates/product-page.html').read_text()
    for key, value in context.items():
        template = template.replace('{{' + key + '}}', value)
    return template



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
