function database() {
  return new Promise((resolve,reject)=>{const request=indexedDB.open('hidden-trails-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
export async function photosFor(key) {
  const db=await database();try{return await new Promise((resolve,reject)=>{const req=db.transaction('photos').objectStore('photos').getAll();req.onsuccess=()=>resolve(req.result.filter(p=>p.key===key));req.onerror=()=>reject(req.error);});}finally{db.close();}
}
export async function addPhoto(key,file) {
  if (!file.type.startsWith('image/') || file.size>8*1024*1024) throw Error('Choose an image smaller than 8 MB.');
  const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({id:crypto.randomUUID(),key,blob:file,at:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
export async function deletePhoto(id) {
  const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
