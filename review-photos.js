/* Photos stay in this browser's IndexedDB; the production upload API is not connected. */
(() => {
  'use strict';
  let dbPromise;
  const cardUrls=new Set();
  function database(){
    return dbPromise ||= new Promise((resolve,reject)=>{
      const request=indexedDB.open('rustehnika-review-photos',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('photos');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function save(files){
    if(!files.length)return [];
    const db=await database(),ids=files.map(()=>crypto.randomUUID());
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('photos','readwrite');
      files.forEach((file,i)=>tx.objectStore('photos').put(file,ids[i]));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
    return ids;
  }
  async function load(id){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const request=db.transaction('photos').objectStore('photos').get(id);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  function image(src,alt){const img=document.createElement('img');img.src=src;img.alt=alt;return img;}
  function view(photos,start){
    const modal=document.createElement('dialog');modal.className='review-photo-viewer';
    modal.setAttribute('aria-label','Фотографии к отзыву');
    modal.innerHTML='<button class="photo-close" aria-label="Закрыть фотографии">×</button><div class="photo-view-stage"><button class="review-arrow photo-prev" aria-label="Предыдущее фото">←</button><img class="photo-full" alt=""><button class="review-arrow photo-next" aria-label="Следующее фото">→</button></div><div class="photo-count" role="status" aria-live="polite"></div><div class="photo-thumbs"></div>';
    let index=start;const full=modal.querySelector('.photo-full'),strip=modal.querySelector('.photo-thumbs');
    function update(){
      full.src=photos[index].url;full.alt='Фото к отзыву '+(index+1);
      modal.querySelector('.photo-count').textContent=(index+1)+' из '+photos.length;
      modal.querySelector('.photo-prev').disabled=index===0;
      modal.querySelector('.photo-next').disabled=index===photos.length-1;
      [...strip.children].forEach((b,i)=>{b.setAttribute('aria-current',String(i===index));});
      strip.children[index]?.scrollIntoView({block:'nearest',inline:'nearest'});
    }
    photos.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Открыть фото '+(i+1));b.append(image(p.url,'Фото '+(i+1)));b.onclick=()=>{index=i;update()};strip.append(b)});
    modal.querySelector('.photo-close').onclick=()=>modal.close();
    modal.querySelector('.photo-prev').onclick=()=>{if(index>0){index--;update()}};
    modal.querySelector('.photo-next').onclick=()=>{if(index<photos.length-1){index++;update()}};
    modal.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();index=Math.max(0,Math.min(photos.length-1,index+(e.key==='ArrowRight'?1:-1)));update()}};
    modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close()}});
    modal.addEventListener('close',()=>modal.remove(),{once:true});
    document.body.append(modal);modal.showModal();update();
  }
  async function mount(card,review){
    if(!review.photoIds?.length)return;
    try{
      const files=await Promise.all(review.photoIds.map(load));if(!card.isConnected)return;
      const photos=files.filter(Boolean).map(file=>{const url=URL.createObjectURL(file);cardUrls.add(url);return {url}});
      if(!photos.length)return;
      const grid=document.createElement('div');grid.className='review-photo-grid';
      grid.setAttribute('aria-label','Фотографии к отзыву: '+photos.length);
      photos.slice(0,3).forEach((p,i)=>{
        const b=document.createElement('button');b.type='button';b.className='review-photo-tile';
        b.setAttribute('aria-label','Открыть фото '+(i+1)+' из '+photos.length);b.append(image(p.url,'Фото к отзыву '+(i+1)));
        if(i===2&&photos.length>3){const count=document.createElement('span');count.className='review-photo-more';count.textContent='+'+(photos.length-3);b.append(count)}
        b.onclick=()=>view(photos,i);grid.append(b);
      });
      card.append(grid);
    }catch{ /* Text remains available if browser photo storage is unavailable. */ }
  }
  function attach(form){
    const panel=document.createElement('div');panel.className='review-attachments';
    panel.innerHTML='<label class="photo-attach-button" for="review-files"><span aria-hidden="true">＋</span> Прикрепить фото</label><input id="review-files" class="photo-file-input" type="file" accept="image/*" multiple><div class="attachment-status" role="status" aria-live="polite"></div><div class="attachment-previews"></div>';
    form.querySelector('button[type=submit]').before(panel);
    const input=panel.querySelector('input'),previews=panel.querySelector('.attachment-previews'),status=panel.querySelector('.attachment-status');
    let entries=[],busy=false;
    function render(){
      previews.replaceChildren();status.textContent=entries.length?'Фото: '+entries.length:'';
      entries.forEach((entry,i)=>{
        const tile=document.createElement('div');tile.className='attachment-preview';tile.append(image(entry.url,entry.file.name));
        const remove=document.createElement('button');remove.type='button';remove.className='attachment-remove';remove.textContent='×';remove.setAttribute('aria-label','Удалить фото '+(i+1));
        remove.onclick=()=>{URL.revokeObjectURL(entry.url);entries.splice(i,1);render()};tile.append(remove);previews.append(tile);
      });
    }
    const submit=form.querySelector('button[type=submit]');
    input.onchange=async()=>{
      const files=[...input.files];input.value='';if(busy)return;busy=true;submit.disabled=true;input.disabled=true;let invalid=false;
      for(const file of files){
        if(!file.type.startsWith('image/')){invalid=true;continue}
        const url=URL.createObjectURL(file);
        try{await image(url,'').decode();entries.push({file,url})}catch{URL.revokeObjectURL(url);invalid=true}
      }
      render();if(invalid)status.textContent+=' Выберите изображения в формате, который поддерживает браузер.';
      busy=false;submit.disabled=false;input.disabled=false;
    };
    const cleanup=()=>{entries.forEach(e=>URL.revokeObjectURL(e.url));entries=[]};
    form.closest('dialog')?.addEventListener('close',cleanup,{once:true});
    return {save:()=>save(entries.map(e=>e.file)),cleanup};
  }
  window.ReviewPhotos={attach,mount,clearCards(){cardUrls.forEach(url=>URL.revokeObjectURL(url));cardUrls.clear()}};
})();
