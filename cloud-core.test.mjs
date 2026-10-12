import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoCodec} from './cloud-core.js';
const photo='data:image/png;base64,aGVsbG8=';
const state={cur:4,t:{t3:'A memory'},p:{p3:[photo,photo]},m:{},mute:false};
test('uploads identical photos once and keeps notes',async()=>{
 const blobs=new Map();let uploads=0;
 const storage={upload:async(path,blob)=>{uploads++;blobs.set(path,blob)},download:async path=>blobs.get(path)};
 const codec=new PhotoCodec(storage);const remote=await codec.encode(state);
 assert.equal(uploads,1);assert.equal(remote.p.p3[0],remote.p.p3[1]);assert.match(remote.p.p3[0],/^aangi\/[a-f0-9]{64}\.png$/);
 assert.equal(remote.t.t3,state.t.t3);assert.equal(state.p.p3[0],photo);
 const anotherDevice=new PhotoCodec(storage);assert.deepEqual(await anotherDevice.decode(remote),state);
 await codec.encode(state);assert.equal(uploads,1);
});
test('rejects untrusted cloud paths without a download',async()=>{
 let calls=0;const codec=new PhotoCodec({download:async()=>calls++});
 await assert.rejects(()=>codec.decode({p:{p1:['https://evil.example/photo.jpg']}}),/Invalid cloud photo path/);assert.equal(calls,0);
});
test('upload failure keeps the local photo retryable',async()=>{
 let attempts=0;const codec=new PhotoCodec({upload:async()=>{if(++attempts===1)throw Error('offline')}});
 await assert.rejects(()=>codec.encode(state),/offline/);assert.equal(state.p.p3[0],photo);
 const result=await codec.encode(state);assert.equal(attempts,2);assert.equal(result.p.p3.length,2);
});
test('rejects remote image references in a local draft',async()=>{
 const codec=new PhotoCodec({});await assert.rejects(()=>codec.encode({p:{p1:['https://example.com/image.jpg']}}),/Invalid local photo/);
});

