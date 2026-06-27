import { motion } from 'framer-motion';
import { WC_TABLE } from '../data.js';

export default function Standings() {
  const groups = Object.keys(WC_TABLE).sort();
  return (
    <div>
      <div className="section-h">Group standings</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {groups.map((g, gi) => {
          const t = WC_TABLE[g];
          return (
            <motion.div key={g} className="grp-card"
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: Math.min(gi * 0.04, 0.25), ease: [0.16, 1, 0.3, 1] }}>
              <div className="grp-h">Group {g}</div>
              <table className="stbl">
                <thead><tr>
                  <th className="pos">#</th><th className="tm">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
                </tr></thead>
                <tbody>
                  {t.table.map((r, i) => (
                    <tr key={r.team} className={i < 2 ? 'q' : ''}>
                      <td className="pos">{i + 1}</td>
                      <td className="tm">{r.team}</td>
                      <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td>
                      <td>{r.gd > 0 ? '+' + r.gd : r.gd}</td><td className="pts">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="st-res">
                {(t.results || []).map((r, i) => (
                  <div key={i}><b>{r.t1} {r.s1}-{r.s2} {r.t2}</b> <span style={{ color: 'var(--dm)' }}>· {r.date}</span></div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--dm)', marginTop: 6 }}>Top 2 of each group (highlighted) advance.</div>
    </div>
  );
}
