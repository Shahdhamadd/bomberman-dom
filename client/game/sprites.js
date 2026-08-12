export function playerSvg(color) {
  return `<svg class="char" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="36.5" rx="11" ry="2.2" fill="rgba(0,0,0,.35)"/>
    <ellipse cx="14" cy="33" rx="4.4" ry="3" fill="#eef1f8"/>
    <ellipse cx="26" cy="33" rx="4.4" ry="3" fill="#eef1f8"/>
    <path d="M9 25 Q9 33 20 33 Q31 33 31 25 Z" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width="1"/>
    <path d="M20 5 Q33 5 33 18 Q33 23 28 24 L12 24 Q7 23 7 18 Q7 5 20 5 Z" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width="1"/>
    <path d="M12.5 9 Q9.5 12 10.5 16.5" stroke="rgba(255,255,255,.45)" stroke-width="2.3" fill="none" stroke-linecap="round"/>
    <rect x="12" y="14" width="16" height="9.2" rx="4.6" fill="#ffdcbf"/>
    <circle cx="17" cy="18.6" r="1.7" fill="#242a36"/>
    <circle cx="23" cy="18.6" r="1.7" fill="#242a36"/>
    <circle cx="14.7" cy="21" r="1.1" fill="rgba(255,120,120,.5)"/>
    <circle cx="25.3" cy="21" r="1.1" fill="rgba(255,120,120,.5)"/>
    <line x1="20" y1="5" x2="20" y2="1.6" stroke="${color}" stroke-width="1.8"/>
    <circle cx="20" cy="1.7" r="2.1" fill="${color}"/>
    <circle cx="19.3" cy="1.1" r=".8" fill="rgba(255,255,255,.55)"/>
  </svg>`;
}

export function bombSvg() {
  return `<svg class="char bomb-svg" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="35" rx="10" ry="2" fill="rgba(0,0,0,.3)"/>
    <circle cx="20" cy="23" r="12" fill="#20242e"/>
    <circle cx="15.5" cy="18.5" r="3.4" fill="rgba(255,255,255,.22)"/>
    <rect x="17" y="8.5" width="6" height="4" rx="1.4" fill="#3a4050"/>
    <path d="M20 9 Q27 5 24 1.6" stroke="#caa24d" stroke-width="1.7" fill="none" stroke-linecap="round"/>
    <circle class="spark" cx="24" cy="1.6" r="2.3" fill="#ffd23f"/>
  </svg>`;
}

export function powerupSvg(kind) {
  if (kind === "bomb") {
    return icon(
      `<circle cx="20" cy="22" r="9" fill="#20242e"/>
       <rect x="17.6" y="10" width="4.8" height="3.2" rx="1.1" fill="#20242e"/>
       <path d="M20 10 Q25 7 23 4" stroke="#20242e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       <circle cx="23" cy="4" r="1.7" fill="#20242e"/>`
    );
  }
  if (kind === "flame") {
    return icon(
      `<path d="M20 5 C25 11 27 15 27 20 a7 7 0 0 1-14 0 c0-3 1.5-5 3-7 c.8 2.6 2.8 2.6 2.8 .8 c0-3-1.8-5 1.2-9.6 Z" fill="#20242e"/>`
    );
  }
  return icon(`<path d="M23 4 L11 23 h7 l-2.5 13 L29 16 h-7 l3-12 Z" fill="#20242e"/>`);
}

function icon(inner) {
  return `<svg class="char" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
