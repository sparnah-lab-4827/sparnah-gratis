/* Budget guidance only: never passed to the offer matcher or price optimizer. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SparnahEstimates=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const reviewedAt='2026-10-20',reviewDue='2027-04-20';
  const sources={
    dairy:'https://www.aldi-sued.de/marken/milsani',
    butter:'https://www.aldi-sued.de/produkte/milchprodukte-eier/butter-margarine/k/1588161425467099',
    milk:'https://www.aldi-sued.de/produkt/milsani-frische-vollmilch-3-5-1-l-000000000330654001',
    baking:'https://www.aldi-sued.de/produkte/backzutaten-mehl-zucker/k/1588161425467155',
    pasta:'https://www.aldi-sued.de/marken/cucina',
    spread:'https://www.aldi-sued.de/produkte/backwaren-aufstriche-cerealien/nuss-schokocreme/k/1588161425467113',
    water:'https://www.aldi-sued.de/produkte/getraenke/mineralwasser/k/1588161425467192',
    rice:'https://www.aldi-sued.de/newsroom/alle-pressemitteilungen/marke-und-produkte/2026/gutes-fuer-alle-auch-im-neuen-Jahr-aldi-setzt-neuen-tiefpreis-fuer-grundnahrungsmittel'
  };
  // Each row is a researched online price example, NOT a measured market average.
  // cents are the reference pack price excluding deposit. Aliases are exact food names.
  const rows=[
    ['Frische Vollmilch 3,5 %',95,1000,'ml','milk',['milsani'],['Vollmilch','Frische Vollmilch','Milch 3,5 %','Frische Vollmilch 3,5 %']],
    ['Deutsche Markenbutter',119,250,'g','butter',['milsani'],['Butter','Deutsche Markenbutter','Markenbutter']],
    ['Irische Butter',179,250,'g','butter',['milsani'],['Irische Butter']],
    ['Bio-Süßrahmbutter',269,250,'g','butter',['bio','gut bio'],['Bio-Butter','Bio-Süßrahmbutter','Bio Butter Süßrahmbutter']],
    ['Butterschmalz',549,500,'g','butter',['milsani'],['Butterschmalz']],
    ['Reine Buttermilch',59,500,'g','dairy',['milsani'],['Buttermilch','Reine Buttermilch']],
    ['Emmentaler am Stück',349,400,'g','dairy',['milsani'],['Emmentaler am Stück']],
    ['Emmentaler Scheiben',229,250,'g','dairy',['milsani'],['Emmentaler','Emmentaler Scheiben']],
    ['H-Schmand',79,200,'g','dairy',['milsani'],['Schmand','H-Schmand']],
    ['Kaffeesahne 12 %',69,200,'g','dairy',['milsani'],['Kaffeesahne 12 %','Kaffeesahne Kännchen 12%']],
    ['Laktosefreie H-Sahne',99,200,'g','dairy',['milsani'],['Laktosefreie H-Sahne']],
    ['Naturjoghurt 3,5 %',89,600,'g','dairy',['milsani'],['Naturjoghurt 3,5 %','Milder Naturjoghurt 3,5 %']],
    ['Käse-Aufschnitt',189,250,'g','dairy',['milsani'],['Käse-Aufschnitt']],
    ['Maasdamer Scheiben',239,300,'g','dairy',['milsani'],['Maasdamer','Maasdamer Scheiben']],
    ['Weizenmehl Type 405',59,1000,'g','baking',['back family','goldähren'],['Weizenmehl Type 405','Qualitäts-Weizenmehl Type 405','Mehl Type 405']],
    ['Dinkelmehl Type 1050',109,1000,'g','baking',['back family'],['Dinkelmehl Type 1050','Dinkelmehl Dinkel Type 1050']],
    ['Dinkelvollkornmehl',109,1000,'g','baking',['back family'],['Dinkelvollkornmehl','Dinkelmehl Dinkelvollkorn']],
    ['Würfelzucker',139,1000,'g','baking',['diadem'],['Würfelzucker']],
    ['Puderzucker',49,250,'g','baking',['diadem'],['Puderzucker']],
    ...['Spaghetti','Penne','Fusilli','Farfalle'].map(name=>[name,69,500,'g','pasta',['cucina','cucina nobile'],[name]]),
    ['Lasagneblätter',119,500,'g','pasta',['cucina','cucina nobile'],['Lasagneblätter']],
    ['Mascarpone',179,250,'g','pasta',['cucina'],['Mascarpone']],
    ['Büffelmozzarella Minis',199,150,'g','pasta',['cucina'],['Büffelmozzarella Minis']],
    ['XXL-Pizzateig',129,550,'g','pasta',['cucina'],['XXL-Pizzateig']],
    ['Pinsa',199,230,'g','pasta',['cucina'],['Pinsa']],
    ['Nutella',399,450,'g','spread',['ferrero','nutella'],['Nutella']],
    ['Nuss-Nougat-Creme',199,400,'g','spread',['nusskati'],['Nuss-Nougat-Creme','Nuss Nougat Creme']],
    ['Erdnusscreme Creamy',170,340,'g','spread',['grandessa'],['Erdnusscreme Creamy']],
    ['Erdnusscreme Crunchy',170,340,'g','spread',['grandessa'],['Erdnusscreme Crunchy']],
    ['Mineralwasser Classic',29,1500,'ml','water',['quellbrunn'],['Mineralwasser Classic','Natürliches Mineralwasser Classic']],
    ['Mineralwasser Medium',29,1500,'ml','water',['quellbrunn'],['Mineralwasser Medium','Natürliches Mineralwasser Medium']],
    ['Parboiled Reis',139,1000,'g','rice',['bon-ri'],['Parboiled Reis','Parboiled-Reis']],
    ['Langkornreis im Kochbeutel',79,500,'g','rice',['bon-ri'],['Langkornreis im Kochbeutel','Langkornreis Kochbeutel']]
  ];
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,' ');
  const entries=rows.map(([label,cents,amount,unit,source,brands,aliases],i)=>({
    id:'guide-'+i,label,cents,pack:{min:amount,max:amount,unit},sourceUrl:sources[source],
    brands:brands.map(norm),aliases:aliases.map(norm),reviewedAt,reviewDue
  }));
  function estimate(product,qty=1,today=reviewedAt){
    if(!product||!Number.isInteger(qty)||qty<1||qty>99||today<reviewedAt)return null;
    const brand=norm(product.brand);
    // Only remove explicit quantities; do not discard preparation, flavour or diet words.
    const title=norm(String(product.title||'').replace(/\b(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/gi,''));
    const found=entries.find(row=>{
      if(brand&&!row.brands.includes(brand))return false;
      const titles=[title,...row.brands.filter(b=>title.startsWith(b+' ')).map(b=>title.slice(b.length+1))];
      if(!titles.some(t=>row.aliases.includes(t)))return false;
      if(product.line&&!titles.some(t=>t.includes(norm(product.line))))return false;
      const flags=[['bio','bio'],['lactoseFree','laktosefrei'],['glutenFree','glutenfrei'],['vegan','vegan']];
      if(flags.some(([flag,text])=>product[flag]===true&&!norm(row.label).includes(text)))return false;
      if(Array.isArray(product.dietaryLabels)&&product.dietaryLabels.some(x=>!norm(row.label).includes(norm(x))))return false;
      return true;
    });
    if(!found)return null;
    const sizes=[...String(product.title||'').matchAll(/\b(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/gi)];
    if(sizes.length>1)return null;
    const size=sizes[0],amount=size?Number(size[2].replace(',','.'))*Number(size[1]||1)*(/^(kg|l)$/i.test(size[3])?1000:1):null;
    const titlePack=size?{min:amount,max:amount,unit:/^(kg|g)$/i.test(size[3])?'g':'ml'}:null;
    const pack=product.pack||titlePack||found.pack;
    if(!Number.isFinite(pack.min)||pack.min<=0||pack.min!==pack.max||pack.unit!==found.pack.unit)return null;
    const ratio=pack.min/found.pack.min;
    if(ratio<0.5||ratio>2)return null;
    const cents=Math.round(found.cents*ratio/5)*5; // Display a rough budget, not cent-exact certainty.
    return {...found,referenceCents:found.cents,referencePack:found.pack,pack,cents,total:cents*qty,qty,
      assumedPack:!product.pack&&!titlePack,scaled:ratio!==1,stale:today>=reviewDue};
  }
  function summarize(unknown,today){
    const estimates=(unknown||[]).map(u=>({item:u.item,estimate:estimate(u.item.requestedProduct||u.item.product,u.item.qty,today)})).filter(x=>x.estimate);
    return {estimates,count:estimates.length,total:estimates.reduce((sum,x)=>sum+x.estimate.total,0),remaining:(unknown||[]).length-estimates.length};
  }
  return {entries,reviewedAt,reviewDue,estimate,summarize};
});
