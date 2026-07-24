// Pure CSS/SVG gameplay scenes - one per game. Used at hero size and as
// vault thumbnails; everything is percentage-positioned so it scales.

const TILT_TILES = [
  "c1", "c2", "c3", "c4", "c2",
  "c3", "c5", "c1", "c2", "c4",
  "c2", "c4", "c5", "c3", "c1",
];

export default function GameArt({ id }: { id: string }) {
  switch (id) {
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
          <i className="floor" />
          <i className="gem" />
          <i className="cone" />
          <i className="guard" />
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
