const BL = require(process.cwd() + '/test/load');
const st = {}; for (const s of BL.STATS) st[s.id] = 90;
const p = { side: -1, d: BL.derive(st), energy: 100 };
for (let i = 0; i < 5; i++) {
  const pl = BL.planShot(p, [1.8, -3.5, 1.3], 'drive', { opp: { x: 0, y: 3.5 }, aimX: null, pressure: 0, stretch: 0 });
  console.log(pl.target, (pl.plan.theta * 57.3).toFixed(1), pl.plan.res.clear.toFixed(2), pl.plan.short, pl.plan.long, pl.plan.res.range.toFixed(2));
}
