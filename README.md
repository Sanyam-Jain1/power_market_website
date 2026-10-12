# Zoltiq website

One-page marketing site: decision intelligence for India's electricity markets.

Everything lives in `index.html` (inline CSS and a small script that draws the "Why now" chart). No build step. Open the file in a browser or serve the folder with any static host (GitHub Pages, Netlify, Cloudflare Pages).

## Domain and hosting

The site is served at https://zoltiq.in. The `CNAME` file tells GitHub Pages which domain to answer on.

## Contact form

"Talk to us", "Send us a message" and the floating "Contact us" button open a contact dialog.
Messages are delivered to zoltiqenergy@gmail.com by FormSubmit (formsubmit.co), a free form-to-email service.
The first message ever sent triggers an activation email from FormSubmit to that inbox; click "Activate Form" once.
To change the address, edit `CONTACT_EMAIL` and the `mailto:` link in `index.html`.

## Content rules

- No figures, earnings claims or performance numbers. The price chart is an illustrative shape with no price values.
- No client logos, testimonials, partner names, team size or "trusted by" lines.
