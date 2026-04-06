# Omniweb Revenue Theme

A production-ready, high-converting Shopify Online Store 2.0 theme built for ecommerce revenue performance.

---

## Features

- **Online Store 2.0 architecture** — JSON templates, sections everywhere, blocks
- **Conversion-optimized product page** — sticky ATC, trust badges, social proof, FAQ accordion, related products
- **Cart drawer** — slide-in cart with quantity controls, upsell products, and order summary
- **Homepage sections** — hero banner, featured collection, collection list, image-with-text, testimonials, newsletter, FAQ, trust badges
- **Collection page** — sortable with live filters (color, size, price range), mobile sidebar
- **Mobile-first responsive** — tested at all breakpoints (320px–1600px+)
- **Merchant-editable** — every section is fully configurable from the Shopify theme editor
- **Performance** — lazy-loaded images, srcset, font-display: swap, minimal JS

---

## Theme Structure

```
omniweb-revenue-theme/
├── assets/
│   ├── theme.css                  ← Main stylesheet
│   └── theme.js                   ← Main JS bundle
├── config/
│   ├── settings_schema.json       ← Theme settings definitions
│   └── settings_data.json         ← Theme settings defaults
├── layout/
│   └── theme.liquid               ← Main layout (HTML shell)
├── locales/
│   └── en.default.json            ← Translation strings
├── sections/
│   ├── announcement-bar.liquid
│   ├── header.liquid
│   ├── footer.liquid
│   ├── hero-banner.liquid
│   ├── featured-collection.liquid
│   ├── collection-list.liquid
│   ├── image-with-text.liquid
│   ├── testimonials.liquid
│   ├── trust-badges.liquid
│   ├── faq.liquid
│   ├── newsletter.liquid
│   ├── upsell-crosssell.liquid
│   ├── main-product.liquid        ← Product page (OS2.0)
│   ├── main-collection.liquid     ← Collection page with filters
│   ├── main-cart.liquid           ← Cart page
│   ├── main-page.liquid
│   └── main-search.liquid
├── snippets/
│   ├── product-card.liquid        ← Reusable product card
│   ├── product-card-mini.liquid   ← Cart upsell mini card
│   ├── product-card-placeholder.liquid
│   ├── cart-drawer.liquid         ← Slide-in cart drawer
│   ├── quick-view-modal.liquid    ← Quick view modal shell
│   ├── stars.liquid               ← Star rating renderer
│   └── social-meta-tags.liquid    ← OG/Twitter meta tags
└── templates/
    ├── index.json                 ← Homepage
    ├── product.json               ← Product page
    ├── collection.json            ← Collection page
    ├── cart.json                  ← Cart page
    ├── page.json                  ← Generic page
    ├── search.json                ← Search results
    └── customers/
        ├── login.liquid
        └── register.liquid
```

---

## Installation

### Option 1: Shopify CLI (recommended)

1. Install [Shopify CLI](https://shopify.dev/docs/themes/tools/cli):
   ```bash
   npm install -g @shopify/cli @shopify/theme
   ```

2. Log in to your Shopify store:
   ```bash
   shopify auth login --store your-store.myshopify.com
   ```

3. Start local development:
   ```bash
   shopify theme dev --store your-store.myshopify.com
   ```

4. Push the theme to your store:
   ```bash
   shopify theme push
   ```

### Option 2: Shopify Admin (manual upload)

1. Zip the entire theme folder:
   ```bash
   zip -r omniweb-revenue-theme.zip omniweb-revenue-theme/
   ```

2. In Shopify Admin → **Online Store → Themes**, click **Add theme → Upload zip file**.

3. Upload `omniweb-revenue-theme.zip` and click **Publish**.

---

## Customization

All settings are available in the **Shopify Theme Editor** (Online Store → Themes → Customize):

### Global Settings
| Setting | Description |
|---|---|
| Colors | Primary, button, text, background, sale badge, star rating |
| Typography | Font pickers for heading and body, size, scale |
| Layout | Page max-width, section spacing |
| Header | Logo, sticky header toggle, search |
| Cart | Drawer vs. page, upsell collection |
| Product | Sticky ATC, quantity selector, reviews |
| Social Links | Instagram, Facebook, TikTok, Twitter, YouTube, Pinterest |

### Sections (all customizable in editor)
- **Announcement Bar** — text, link, colors
- **Hero Banner** — image, height, overlay, text, CTA buttons
- **Trust Badges** — icon, title, subtitle per badge
- **Featured Collection** — pick any collection, number of products, columns
- **Collection List** — category cards with images and custom titles
- **Image with Text** — position (left/right), feature bullet points, CTA
- **Testimonials** — star rating, quote, author, verified badge, aggregate rating
- **FAQ** — question/answer blocks with accordion behavior
- **Newsletter** — heading, CTA, success message, privacy text
- **Upsell / Cross-sell** — source collection, product count
- **Footer** — menu columns, newsletter form, social links, payment icons

---

## Performance Notes

- All product images use `srcset` with multiple sizes (300w, 600w, 900w, 1200w)
- Hero image loads with `fetchpriority="high"` and `loading="eager"`
- All other images use `loading="lazy"`
- Fonts use `font-display: swap` to prevent layout shift
- No external JS libraries — vanilla JS only (no jQuery, no frameworks)
- CSS custom properties used throughout for easy theming

---

## Browser Support

- Chrome, Firefox, Safari, Edge (current + 1 previous versions)
- iOS Safari 14+, Android Chrome 90+

---

## Extending the Theme

### Adding a new section
1. Create `sections/my-section.liquid`
2. Add `{% schema %}` block at the bottom with settings and presets
3. Add it to a template JSON file or let merchants add it via the editor

### Adding a new snippet
1. Create `snippets/my-snippet.liquid`
2. Render it anywhere with `{% render 'my-snippet', param: value %}`

### Adding translation strings
1. Add keys to `locales/en.default.json`
2. Use them with `{{ 'my.key' | t }}`

---

## License

© Omniweb. All rights reserved. For commercial use, a valid license is required.
