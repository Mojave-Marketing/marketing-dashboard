export default function ComingSoon({ title, description }) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-inner">
        <div className="coming-soon-badge">Coming Soon</div>
        <h2 className="coming-soon-title">{title}</h2>
        <p className="coming-soon-desc">{description}</p>
      </div>
    </div>
  );
}
