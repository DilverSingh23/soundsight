/** Decorative skyline and aurora lines inspired by the SoundSight home design. */
export default function Nightscape() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 440 265"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      <defs>
        <linearGradient id="soundwave-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bda5ff" stopOpacity="0.08" />
          <stop offset="0.48" stopColor="#9278e6" stopOpacity="0.54" />
          <stop offset="1" stopColor="#7656be" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="skyline-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7365b0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7365b0" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d="M-36 206 C65 286 112 49 203 73 C286 92 287 232 361 196 C405 175 428 105 487 65 L487 273 L-36 273 Z"
        fill="url(#soundwave-fill)"
      />
      <path
        d="M-28 236 C58 285 105 60 198 67 C287 80 296 222 358 204 C406 189 437 106 478 77"
        stroke="#b6a5ff"
        strokeWidth="1.2"
        strokeOpacity="0.23"
      />
      <path
        d="M-24 243 C69 288 114 77 204 83 C292 94 297 238 367 212 C412 196 447 121 479 86"
        stroke="#d0bbff"
        strokeWidth="1"
        strokeOpacity="0.25"
      />
      <path
        d="M-24 252 C71 292 125 90 207 98 C283 113 311 255 370 224 C418 207 447 141 479 100"
        stroke="#c8b6ff"
        strokeWidth="0.9"
        strokeOpacity="0.21"
      />
      <circle cx="356" cy="88" r="11" fill="#e8d9ff" />
      <circle cx="58" cy="97" r="1.6" fill="#e9deff" fillOpacity="0.9" />
      <circle cx="285" cy="57" r="1.3" fill="#e9deff" fillOpacity="0.7" />
      <circle cx="394" cy="159" r="1.1" fill="#e9deff" fillOpacity="0.6" />
      <path
        d="M0 218h37v-15h37v15h28v-34h28v34h24v-11h36v11h48v-27h36v27h20v-52h18v-17h12v17h21v52h30v-30h29v30h23v-73h26v-15h19v88h28v47H0z"
        fill="url(#skyline-haze)"
      />
      <path
        d="M0 235h25v-15h30v15h40v-20h21v-21h20v41h35v-13h30v13h25v-28h28v-18h15v18h23v28h21v-14h25v14h24v-56h27v-21h18v77h45v40H0z"
        fill="#121128"
        fillOpacity="0.89"
      />
      <path d="M0 235h440v30H0z" fill="#121128" />
    </svg>
  );
}
