/** Applies an expression to the mouth layer of a doll SVG. */
export function applyMouthExpression(svg, expression) {
  let mouthEl = svg.querySelector('#doll-mouth-expression');
  if (!mouthEl) {
    mouthEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mouthEl.id = 'doll-mouth-expression';
    const parentG = svg.querySelector('#face-feature') || svg.querySelector('#body') || svg;
    parentG.appendChild(mouthEl);
  }

  const faceFeatureG = svg.querySelector('#face-feature');
  const defaultSmile = svg.querySelector('#doll-mouth-default') ||
    svg.querySelector('path[d*="146 73"]') ||
    svg.querySelector('path[d="M146 73 C148 76 152 76 154 73"]');

  if (!expression || expression === 'neutral') {
    mouthEl.innerHTML = '';
    if (faceFeatureG) {
      for (const child of faceFeatureG.children) {
        if (child !== mouthEl) child.style.display = '';
      }
    } else {
      mouthEl.innerHTML = '<path d="M146 73 C148 75 152 75 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
    }
    if (defaultSmile) defaultSmile.style.display = '';
    return;
  }

  if (faceFeatureG) {
    for (const child of faceFeatureG.children) {
      if (child !== mouthEl) child.style.display = 'none';
    }
  }
  if (defaultSmile) defaultSmile.style.display = 'none';
  mouthEl.innerHTML = '';

  if (expression === 'smile') mouthEl.innerHTML = '<path d="M144 72 C147 77 153 77 156 72" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
  else if (expression === 'happy') mouthEl.innerHTML = '<path d="M144 71 C144 78 156 78 156 71 Z" fill="#e76f51" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/>';
  else if (expression === 'surprised') mouthEl.innerHTML = '<ellipse cx="150" cy="73.5" rx="3.2" ry="4.5" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/>';
  else if (expression === 'o_mouth') mouthEl.innerHTML = '<ellipse cx="150" cy="73.2" rx="2.5" ry="3.2" fill="#b84e50" stroke="#2d261e" stroke-width="1.8"/><circle cx="150" cy="73.2" r="1.2" fill="#3a1b1b"/>';
  else if (expression === 'talking') mouthEl.innerHTML = '<path d="M145 71 C145 77 155 77 155 71 Q 150 74 145 71 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><path d="M147 73 Q 150 75 153 73" fill="none" stroke="#fad2cf" stroke-width="1" stroke-linecap="round"/>';
  else if (expression === 'wide_open') mouthEl.innerHTML = '<path d="M143 69.5 C143 79 157 79 157 69.5 Q 150 72 143 69.5 Z" fill="#b84e50" stroke="#2d261e" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="150" cy="75.2" rx="3.5" ry="1.8" fill="#e76f51"/>';
  else mouthEl.innerHTML = '<path d="M146 73 C148 75 152 75 154 73" fill="none" stroke="#2d261e" stroke-width="2" stroke-linecap="round"/>';
}
