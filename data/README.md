# Product portfolio preview

`products.json` is a static snapshot of the 34 products in the supplied WordPress XML export dated 2026-10-22. It is not a live Wix CMS connection. Imported images use the Elincou Wix Media Manager URLs; descriptions, category assignments, installation types and technical specifications come from the XML. No product claims or specifications were generated.

The preview is `products.html`. Serve the repository over HTTP so its JSON can load. The page shares the existing Gothic A1 typography, colour tokens and Elincou logo. Search and filters run in the browser, with OR within a filter group and AND between groups. Search, filters and sort are preserved in the URL. Comparisons are temporary, local to the page, and support two or three instruments.

Eight discipline filters mirror the old page: Biochemistry, ESR, Hematology, Hemostasis, Immunology, Microbiology, PCR and Urinalysis. Installation filters are Integrated and Stand Alone. Missing assignments are left empty; instruments with missing data remain visible in the unfiltered catalogue. The TDR-Z200 has no main image in the XML and uses an explicit unavailable-image state.

Manufacturer names are derived from the supplied manufacturer website URLs. The primary product video is the explicit external video URL when present, followed by YouTube and then the generic source video field. HTML is sanitised before rendering. The manufacturer comparison is a structured overview, not a claim of clinical equivalence.

## Wix handoff

The existing `Products` collection is the eventual data source. Map `title`, `slug`, `image`, `description`, `categories`, `installationTypes`, `manufacturerUrl`, `extraInformation`, `specifications`, `seriesTable`, `videoExternalUrl`, `youtubeUrl`, and `videoUrl`. Resolve the manufacturer label from its URL or add an explicit manufacturer field. The unrelated existing sample CMS item is not included in the XML snapshot.

Enquiry links lead to the existing homepage contact section. Manufacturer and product-video links open the supplied external resources. This preview does not create an enquiry backend, change the Wix page layout, or publish the Wix site.

## Dedicated product pages

Every product has its own statically rendered URL at `products/<slug>.html`, generated from the same dataset with `python scripts/build-product-pages.py`. These pages include source-backed overviews and specifications, available gallery views, product films and related instruments. Catalogue card links navigate to these pages. Gallery zoom and section navigation progressively enhance the static content. Product enquiries open a prefilled email to the address already used by the site's contact section.

## Product-page clarity revision

The product hero now uses the current CMS Card Description as a short summary. Long-form source details appear in a readable overview, followed by specifications and optional video. The same “Request product information” CTA opens a prefilled email from the hero, sticky navigation and final contact block. Mobile retains a fixed bottom enquiry button. Related items share a discipline; unrelated instruments are not used to fill empty slots. Gallery images remain grouped together, and no duplicate full-width gallery section is generated.
