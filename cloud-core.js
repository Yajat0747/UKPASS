export class PhotoCodec{
 constructor(storage){this.storage=storage;this.cache=new Map()}
 async encode(state){const remote=structuredClone(state);remote.p={};
  for(const [key,list] of Object.entries(state.p||{})){remote.p[key]=[];for(const url of list){let path=this.cache.get(url);
   if(!path){if(!/^data:image\/(jpeg|png|webp);base64,/.test(url))throw Error('Invalid local photo');const blob=await(await fetch(url)).blob();
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    const ext=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';path='aangi/'+hash+'.'+ext;
    await this.storage.upload(path,blob);this.cache.set(url,path);this.cache.set(path,url)}remote.p[key].push(path)}
  }return remote;
 }
 async decode(remote){const state=structuredClone(remote);state.p={};
  for(const [key,list] of Object.entries(remote.p||{})){if(!Array.isArray(list))throw Error('Invalid photo list');state.p[key]=[];
   for(const path of list){if(typeof path!=='string'||!/^aangi\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(path))throw Error('Invalid cloud photo path');let url=this.cache.get(path);
    if(!url){const blob=await this.storage.download(path);if(!['image/jpeg','image/png','image/webp'].includes(blob.type))throw Error('Invalid cloud photo type');
     const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);url='data:'+blob.type+';base64,'+btoa(binary);this.cache.set(path,url);this.cache.set(url,path)}state.p[key].push(url)}
  }return state;
 }
}
