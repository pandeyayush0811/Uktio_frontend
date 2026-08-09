// Builds the markup for a circular SVG "progress ring" showing a
// score out of 10 — used both as the small pill on report.html and
// the big summary ring on mistakes.html. Previously each page had its
// own copy of this circumference/stroke-dasharray math; pulled out
// here so there's one place to fix if the animation approach ever
// changes.
//
// viewBoxSize/center are passed explicitly (not derived from radius)
// because each usage has its own padding around the circle to leave
// room for the stroke width — deriving them from radius alone would
// silently change the pixel dimensions each page was designed around.
//
// Returns just the <svg>...</svg> markup — the caller wraps it in
// whatever container markup (pill vs full ring) fits that page, and
// is responsible for animating it in via animateScoreRing().
export function buildScoreRingSvg(score, { radius, center, viewBoxSize }) {
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - (Number(score) || 0) / 10);
  return `
    <svg viewBox="0 0 ${viewBoxSize} ${viewBoxSize}">
      <circle class="bg" cx="${center}" cy="${center}" r="${radius}"/>
      <circle class="fg" cx="${center}" cy="${center}" r="${radius}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"
        data-target-offset="${targetOffset}"/>
    </svg>`;
}

// Call after the ring markup is in the DOM to animate the fill in.
// `root` is any ancestor element — the ring's .fg circle is found
// inside it via querySelector.
export function animateScoreRing(root) {
  const circle = root.querySelector('.fg');
  if (!circle) return;
  requestAnimationFrame(() => { circle.style.strokeDashoffset = circle.dataset.targetOffset; });
}
