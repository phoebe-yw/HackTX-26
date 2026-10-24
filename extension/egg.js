function eggwardLook(look) {
  const shells = ["cream", "yolk", "mint", "lilac", "sky", "peach"];
  const accessories = ["none", "bow", "sprout", "glasses"];
  const shell = look && shells.includes(look.shell) ? look.shell : "cream";
  const accessory = look && accessories.includes(look.accessory) ? look.accessory : "none";
  return { shell, accessory };
}

function eggwardSvg(mood, look) {
  const safeMood = mood === "sideeye" || mood === "mad" ? mood : "fine";
  const chosen = eggwardLook(look);
  const fills = {
    cream: "#fffaf2",
    yolk: "#ffe08a",
    mint: "#b7f0c8",
    lilac: "#e4d4ff",
    sky: "#c9e7ff",
    peach: "#ffc7bc",
  };
  const pupilX = safeMood === "sideeye" ? 7 : 0;
  const brow =
    safeMood === "mad"
      ? `<path d="M42 78l24 10" stroke="#24170f" stroke-width="5" stroke-linecap="round"/><path d="M118 78l-24 10" stroke="#24170f" stroke-width="5" stroke-linecap="round"/>`
      : "";
  const mouth =
    safeMood === "mad"
      ? `<path d="M62 146c8 8 28 8 36 0" fill="none" stroke="#24170f" stroke-width="4" stroke-linecap="round"/>`
      : safeMood === "sideeye"
        ? `<path d="M66 148h28" stroke="#24170f" stroke-width="4" stroke-linecap="round"/>`
        : `<path d="M66 144c8 10 22 10 30 0" fill="none" stroke="#24170f" stroke-width="4" stroke-linecap="round"/>`;
  const curl =
    chosen.accessory === "sprout"
      ? ""
      : `<path d="M78 44c10 8 8 18 18 24" fill="none" stroke="#24170f" stroke-width="4" stroke-linecap="round"/>`;
  const accessory =
    chosen.accessory === "bow"
      ? `<path d="M104 50c-12 7-12 20 0 26 12-6 12-19 0-26z" fill="#ef4b3f" stroke="#24170f" stroke-width="3"/><path d="M104 50c12 7 12 20 0 26-12-6-12-19 0-26z" fill="#ef4b3f" stroke="#24170f" stroke-width="3"/><circle cx="104" cy="63" r="4.5" fill="#24170f"/>`
      : chosen.accessory === "sprout"
        ? `<path d="M80 52c2-16 8-26 2-38" fill="none" stroke="#2f7d4a" stroke-width="4" stroke-linecap="round"/><ellipse cx="96" cy="30" rx="13" ry="7" fill="#3caf62" stroke="#24170f" stroke-width="3" transform="rotate(-28 96 30)"/>`
        : chosen.accessory === "glasses"
          ? `<rect x="40" y="90" width="34" height="26" rx="8" fill="none" stroke="#24170f" stroke-width="4"/><rect x="86" y="90" width="34" height="26" rx="8" fill="none" stroke="#24170f" stroke-width="4"/><path d="M74 103h12" stroke="#24170f" stroke-width="4"/>`
          : "";
  return `<svg class="sprite ${safeMood === "mad" ? "mad" : "fine"}" viewBox="0 0 160 190" width="96" height="114" aria-label="Eggward">
    <ellipse cx="80" cy="112" rx="58" ry="70" fill="${fills[chosen.shell]}" stroke="#24170f" stroke-width="5"/>
    ${curl}
    ${chosen.accessory === "sprout" || chosen.accessory === "bow" ? accessory : ""}
    ${brow}
    <circle cx="58" cy="104" r="14" fill="#fff" stroke="#24170f" stroke-width="4"/>
    <circle cx="102" cy="104" r="14" fill="#fff" stroke="#24170f" stroke-width="4"/>
    <circle cx="${58 + pupilX}" cy="104" r="${safeMood === "mad" ? 4 : 6}" fill="#24170f"/>
    <circle cx="${102 + pupilX}" cy="104" r="${safeMood === "mad" ? 4 : 6}" fill="#24170f"/>
    <circle cx="48" cy="128" r="8" fill="#ffb4a8" opacity="${safeMood === "fine" ? 0.9 : 0.4}"/>
    <circle cx="112" cy="128" r="8" fill="#ffb4a8" opacity="${safeMood === "fine" ? 0.9 : 0.4}"/>
    ${mouth}
    ${chosen.accessory === "glasses" ? accessory : ""}
  </svg>`;
}
