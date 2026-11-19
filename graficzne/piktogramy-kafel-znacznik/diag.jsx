var out=[];
try{var doc=app.activeDocument;
for(var l=0;l<doc.layers.length;l++){var L=doc.layers[l];var s="L "+L.name+": ";
 for(var i=0;i<L.pageItems.length;i++){var it=L.pageItems[i];var b=it.geometricBounds;s+=it.typename.substr(0,4)+"'"+it.name+"'["+Math.round(b[0])+","+Math.round(b[1])+","+Math.round(b[2])+","+Math.round(b[3])+"] ";}
 out.push(s);}
}catch(e){out.push("ERR "+e+" line "+e.line);}
alert(out.join("\n"));
