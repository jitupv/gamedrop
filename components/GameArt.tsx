// Pure CSS/SVG gameplay scenes - one per game. Used at hero size and as
// vault thumbnails; everything is percentage-positioned so it scales.

const TILT_TILES = [
  "c1", "c2", "c3", "c4", "c2",
  "c3", "c5", "c1", "c2", "c4",
  "c2", "c4", "c5", "c3", "c1",
];

export default function GameArt({ id }: { id: string }) {
  switch (id) {
    case "prism":
      return (
        <div className="art art-prism" aria-hidden="true">
          <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">
            <path
              d="M 20 60 L 150 60 L 150 150 L 260 150"
              fill="none"
              stroke="#ff2d6f"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="60" r="7" fill="#ff2d6f" />
            <line x1="136" y1="46" x2="164" y2="74" stroke="#eef0f5" strokeWidth="4" strokeLinecap="round" />
            <line x1="136" y1="164" x2="164" y2="136" stroke="#eef0f5" strokeWidth="4" strokeLinecap="round" />
            <circle cx="205" cy="150" r="10" fill="none" stroke="rgba(238,240,245,0.5)" strokeWidth="2" />
            <rect x="248" y="138" width="24" height="24" rx="5" fill="rgba(63,191,127,0.35)" stroke="#3fbf7f" strokeWidth="2" />
          </svg>
        </div>
      );
    case "tilt":
      return (
        <div className="art art-tilt" aria-hidden="true">
          <div className="tiles">
            {TILT_TILES.map((c, i) => (
              <i key={i} className={c} />
            ))}
          </div>
        </div>
      );
    case "orbit":
      return (
        <div className="art art-orbit" aria-hidden="true">
          <svg viewBox="0 0 320 200" preserveAspectRatio="none">
            <path
              d="M 30 170 Q 140 -40 290 120"
              fill="none"
              stroke="rgba(157,140,255,.5)"
              strokeWidth="2"
              strokeDasharray="2 7"
            />
          </svg>
          <i className="p1" />
          <i className="p2" />
        </div>
      );
    case "sonar":
      return (
        <div className="art art-sonar" aria-hidden="true">
          <i className="ping" />
          <i className="ping p2" />
          <i className="ping p3" />
          <i className="dot" />
          <i className="exit" />
          <i className="wall" style={{ left: "20%", top: "30%", width: "24%", height: "2.4%", animationDelay: ".25s" }} />
          <i className="wall" style={{ left: "56%", top: "42%", width: "1.4%", height: "22%", animationDelay: ".45s" }} />
          <i className="wall" style={{ left: "30%", top: "70%", width: "19%", height: "2.4%", animationDelay: ".35s" }} />
          <i className="wall" style={{ left: "68%", top: "24%", width: "16%", height: "2.4%", animationDelay: ".6s" }} />
          <i className="wall" style={{ left: "14%", top: "52%", width: "1.4%", height: "18%", animationDelay: ".5s" }} />
          <i className="wall" style={{ left: "76%", top: "58%", width: "1.4%", height: "20%", animationDelay: ".7s" }} />
        </div>
      );
    case "heist":
      return (
        <div className="art art-heist" aria-hidden="true">
          <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet">
            <g stroke="rgba(238,240,245,.07)" strokeWidth="1">
              {[40, 80, 120, 160, 200, 240, 280].map((x) => (
                <line key={`vx-${x}`} x1={x} y1="0" x2={x} y2="200" />
              ))}
              {[40, 80, 120, 160].map((y) => (
                <line key={`hy-${y}`} x1="0" y1={y} x2="320" y2={y} />
              ))}
            </g>

            <g fill="#343943" stroke="rgba(238,240,245,.12)" strokeWidth="1">
              <rect x="104" y="18" width="38" height="38" rx="6" />
              <rect x="104" y="62" width="38" height="38" rx="6" />
              <rect x="224" y="126" width="38" height="38" rx="6" />
            </g>

            <path
              d="M 42 154 L 82 154 L 82 116 L 184 116 L 184 68 L 242 68 L 278 108"
              fill="none"
              stroke="rgba(63,191,127,.7)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 8"
            />
            <rect
              x="151"
              y="82"
              width="72"
              height="66"
              rx="10"
              fill="none"
              stroke="rgba(255,111,97,.55)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />

            <g transform="translate(42 154)">
              <circle r="13" fill="#3fbf7f" />
              <rect x="-9" y="-4" width="18" height="7" rx="3.5" fill="#11151b" />
              <circle cx="-4" cy="-1" r="1.5" fill="#eef0f5" />
              <circle cx="4" cy="-1" r="1.5" fill="#eef0f5" />
            </g>

            <g transform="translate(187 82)">
              <circle r="12" fill="#ff6f61" />
              <path d="M -11 -7 Q 0 -17 11 -7 Z" fill="#eef0f5" opacity=".85" />
              <circle cx="-4" cy="0" r="1.5" fill="#1b1e24" />
              <circle cx="4" cy="0" r="1.5" fill="#1b1e24" />
            </g>

            <g transform="translate(184 116)">
              <path d="M 0 -14 L 14 0 L 0 16 L -14 0 Z" fill="#e6c26b" />
              <path d="M -14 0 L 14 0 M 0 -14 L -5 0 M 0 -14 L 5 0" stroke="#fff2bd" strokeWidth="1.5" fill="none" />
            </g>

            <g transform="translate(278 108)">
              <rect x="-24" y="-22" width="48" height="44" rx="7" fill="rgba(230,194,107,.18)" stroke="#e6c26b" strokeWidth="2" />
              <text x="0" y="5" textAnchor="middle" fill="#e6c26b" fontSize="12" fontWeight="800">EXIT</text>
            </g>
          </svg>
        </div>
      );
    case "rush":
      return (
        <div className="art art-rush" aria-hidden="true">
          <i className="road" />
          <i className="lane" />
          <i className="car c1" />
          <i className="car c2" />
        </div>
      );
    case "trace":
      return (
        <div className="art art-trace" aria-hidden="true">
          <svg viewBox="0 0 320 200" preserveAspectRatio="none">
            <path
              d="M 70 140 C 90 40, 200 30, 235 90 S 190 175, 120 150"
              fill="none"
              stroke="rgba(37,30,24,.28)"
              strokeWidth="3"
              strokeDasharray="8 8"
              strokeLinecap="round"
            />
            <path
              d="M 70 140 C 90 40, 180 35, 220 80"
              fill="none"
              stroke="#6fa8ff"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    default:
      return <div className="art" aria-hidden="true" />;
  }
}
