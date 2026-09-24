import { useApp } from '../core/store';
import { COLLECTIBLES, SHOP } from '../economy/economy';
import { sfx } from '../core/audio';

export function Shop() {
  const { player, updatePlayer, setShopOpen, showToast } = useApp();
  if (!player) return null;

  const act = (id: string) => {
    const item = SHOP.find((s) => s.id === id)!;
    const owned = player.owned.includes(id);
    if (!owned) {
      if (player.coins < item.price) { showToast('צריך עוד מטבעות. אפשר להרוויח במסע היומי!'); return; }
      sfx.coin();
    } else sfx.tap();
    updatePlayer((p) => ({
      ...p,
      coins: owned ? p.coins : p.coins - item.price,
      owned: owned ? p.owned : [...p.owned, id],
      color: item.kind === 'color' ? item.value : p.color,
      hat: item.kind === 'hat' ? item.value : p.hat,
    }));
  };

  return (
    <div className="modal-back" onClick={() => setShopOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="חנות הדמות">
        <h2>🛍️ חנות הדמות</h2>
        <p className="muted">יש לך 🪙 {player.coins}</p>
        {(['color', 'hat'] as const).map((kind) => (
          <div key={kind}>
            <h3>{kind === 'color' ? 'צבע' : 'כובעים'}</h3>
            <div className="shop-grid">
              {SHOP.filter((s) => s.kind === kind).map((s) => {
                const owned = player.owned.includes(s.id);
                const worn = (kind === 'color' ? player.color : player.hat) === s.value;
                return (
                  <button key={s.id} className={`shop-item ${worn ? 'on' : ''}`} onClick={() => act(s.id)}>
                    {kind === 'color' ? <span className="dot big" style={{ background: s.value }} /> : <span className="hat-emoji">{({ none: '🙂', cap: '🧢', crown: '👑', miner: '⛑️', wizard: '🧙' } as Record<string, string>)[s.value]}</span>}
                    <span>{s.name}</span>
                    <small>{worn ? 'עליי ✓' : owned ? 'ללבוש' : `🪙 ${s.price}`}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <h3>האוסף שלי ({player.collectibles.length}/{COLLECTIBLES.length})</h3>
        <div className="collection">
          {COLLECTIBLES.map((c) => (
            <span key={c.id} className={player.collectibles.includes(c.id) ? 'got' : 'missing'} title={player.collectibles.includes(c.id) ? c.name : '???'}>
              {player.collectibles.includes(c.id) ? c.emoji : '❔'}
            </span>
          ))}
        </div>
        <p className="muted small">אוצרות מתגלים בהפתעה בסוף מסע יומי.</p>
        <button className="btn btn-ghost" onClick={() => setShopOpen(false)}>סגירה</button>
      </div>
    </div>
  );
}
