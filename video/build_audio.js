// Writes audio/timeline.json for audio/mix.py from video/timeline.js
const TL = require('./timeline.js');
const fs = require('fs'), path = require('path');
const out = {
  duration: TL.DURATION,
  music: { file: 'audio/music_bed.wav', gain_db: -21, duck: [] },
  events: TL.sfx,
};
fs.writeFileSync(path.resolve(__dirname, '../audio/timeline.json'), JSON.stringify(out, null, 1));
console.log('events', TL.sfx.length);
