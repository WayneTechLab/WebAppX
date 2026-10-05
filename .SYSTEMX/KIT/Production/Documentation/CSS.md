# CSS Implementation

Use `WebAPP/src/styles/wayne-tech-lab-brand.css` for production tokens and logo helpers.

```html
<a class="wtl-brand" href="/" aria-label="Wayne Tech Lab home">
  <img src="/brand/wtl-tech-lab.svg" alt="Wayne Tech Lab" />
</a>
```

```css
.wtl-brand img {
  display: block;
  width: min(100%, 36rem);
  height: auto;
}
```

For symbol-only use, include an accessible company name using `aria-label` or visually hidden text. Do not reproduce the logo with CSS shapes; use the supplied image or SVG export.
