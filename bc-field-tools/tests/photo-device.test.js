'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {toFile, sharePossible, shareOriginal} = require('../photo-device.js');
const photo = {blob:new Blob([Uint8Array.from([1,2,3,4])], {type:'image/jpeg'}),fileName:'現場.jpg',mimeType:'image/jpeg'};
test('photo original bytes remain intact', async () => {
  const output = toFile(photo);
  assert.equal(output.name, '現場.jpg');
  assert.deepEqual([...new Uint8Array(await output.arrayBuffer())], [1,2,3,4]);
});
test('share sheet return is not camera roll save', async () => {
  let payload;
  const nav={canShare:({files})=>files.length===1,share:async arg=>{payload=arg;}};
  assert.equal(sharePossible(photo,nav),true);
  assert.equal(await shareOriginal(photo,nav),'shared');
  assert.equal(payload.files[0].name,'現場.jpg');
});
test('share cancellation does not report saved', async () => {
  const nav={share:async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});}};
  assert.equal(await shareOriginal(photo,nav),'cancelled');
});
test('unsupported share and error are distinct', async () => {
  assert.equal(await shareOriginal(photo,{}),'unsupported');
  assert.equal(await shareOriginal(photo,{canShare:()=>false,share:async()=>{}}),'unsupported');
  assert.equal(await shareOriginal(photo,{share:async()=>{throw Error('failure');}}),'failed');
});
test('reject missing photo blob', () => assert.throws(()=>toFile({fileName:'x.jpg'}),/原本写真/));
