export default function TVFrame({ children }) {
  return (
    <div className="tv-frame">
      <div className="tv-glow" />
      <div className="tv-screen">
        {children}
      </div>
    </div>
  );
}