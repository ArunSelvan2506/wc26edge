// Renders confirmed/probable starting XIs (+ subs) for a match. Data is
// best-effort from TheSportsDB; either side may be missing.
function freshAgo(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!isFinite(mins) || mins < 0) return '';
  if (mins < 60) return `· updated ${mins}m ago`;
  return `· updated ${Math.round(mins / 60)}h ago`;
}

function Side({ team, side }) {
  if (!side || !side.players || !side.players.length) {
    return (
      <div className="lu-side">
        <div className="lu-team">{team}</div>
        <div className="lu-empty">Lineup not posted yet</div>
      </div>
    );
  }
  const xi = side.players.filter(p => !p.sub);
  const subs = side.players.filter(p => p.sub);
  return (
    <div className="lu-side">
      <div className="lu-team">{side.name || team}{side.formation ? <span className="lu-form">{side.formation}</span> : null}</div>
      <ul className="lu-list">
        {(xi.length ? xi : side.players).map((p, i) => (
          <li key={i}><span className="lu-pos">{p.pos || ''}</span>{p.name}</li>
        ))}
      </ul>
      {subs.length > 0 && (
        <div className="lu-subs"><span className="lu-subs-h">Subs</span> {subs.map(p => p.name).join(', ')}</div>
      )}
    </div>
  );
}

export function Lineups({ lu, teamA, teamB }) {
  return (
    <div className="lineups">
      <div className="lu-hd">Starting XI <span className="lu-meta">{freshAgo(lu.fetched)}</span></div>
      <div className="lu-grid">
        <Side team={teamA} side={lu.a} />
        <Side team={teamB} side={lu.b} />
      </div>
      <div className="lu-src">Lineups are best-effort and may be probable until ~1h before kickoff.</div>
    </div>
  );
}
