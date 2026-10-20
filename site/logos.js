/* Local retailer identification artwork; see LOGOS.md for sources. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SparnahLogos=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const files={"rewe": "logos/rewe.svg", "aldi": "logos/aldi.ico", "edeka": "logos/edeka.ico", "kaufland": "logos/kaufland.png", "lidl": "logos/lidl.svg", "netto": "logos/netto.svg", "norma": "logos/norma.png", "denns": "logos/denns.svg", "ebl": "logos/ebl.png", "mixmarkt": "logos/mixmarkt.ico", "fraenky": "logos/fraenky.png", "fristo": "logos/fristo.png"};
  return {files,source:store=>files[store?.retailerId||store?.id]||null};
});
