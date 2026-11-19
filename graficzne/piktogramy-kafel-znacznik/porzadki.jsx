var doc=app.activeDocument;
for(var l=0;l<doc.layers.length;l++){var L=doc.layers[l];L.locked=false;
  for(var i=0;i<L.pageItems.length;i++){var it=L.pageItems[i];it.locked=false;
    if(L.name=="03_Toaleta"&&(it.name==""||it.name.indexOf("tulow")>=0)&&it.typename=="PathItem"){
      var b=it.geometricBounds; var h=b[1]-b[3]; if(h>80){var cx=(b[0]+b[2])/2; it.name=(cx<720+114)?"Toaleta_M_tulow":"Toaleta_K_tulow";}}}}
doc.layers.getByName("Tlo").locked=true;
doc.selection=null;
