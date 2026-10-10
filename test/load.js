// Nạp các file game vào Node (không cần trình duyệt)
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['core', 'physics', 'stats', 'rules', 'shots', 'ai', 'match'];
for (const f of files) {
  const p = path.join(__dirname, '..', 'js', f + '.js');
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
module.exports = globalThis.BL;
