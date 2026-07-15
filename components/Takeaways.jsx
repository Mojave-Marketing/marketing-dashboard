"use client";

export default function Takeaways({ takeaways }) {
  return (
    <>
      <h2 className="section-title">Leadership takeaways</h2>
      <div className="takeaways-grid">
        {takeaways.map((t, i) => (
          <div key={i} className="card takeaway-card">
            <h4>{t.title}</h4>
            <p>{t.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}
