#target illustrator
try{
app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;
var doc = app.documents.add(DocumentColorSpace.RGB, 1080, 780);
doc.artboards[0].artboardRect = [0, 0, 1080, -780];
doc.artboards[0].name = "Plansza";
function col(v){var c=new RGBColor();c.red=v;c.green=v;c.blue=v;return c;}
var BLACK=col(0), WHITE=col(255);
var ox=0, oy=0, L=null;
function X(x){return ox+x;} function Y(y){return -(oy+y);}
function style(p,c){p.filled=true;p.fillColor=c||WHITE;p.stroked=false;return p;}
function rect(x,y,w,h,n){var p=L.pathItems.rectangle(Y(y),X(x),w,h);style(p);if(n)p.name=n;desel();return p;}
function ell(cx,cy,r,n){var p=L.pathItems.ellipse(Y(cy-r),X(cx-r),2*r,2*r);style(p);if(n)p.name=n;desel();return p;}
function tri(a,b,c,n){var p=L.pathItems.polygon(X(120),Y(120),20,3);style(p);
  // edycja punktow: przesuniecie 3 wierzcholkow wielokata w docelowe miejsca
  var t=[a,b,c];for(var i=0;i<3;i++){var q=p.pathPoints[i];var v=[X(t[i][0]),Y(t[i][1])];q.anchor=v;q.leftDirection=v;q.rightDirection=v;}
  if(n)p.name=n;return p;}
function desel(){var sel=doc.selection;for(var i=sel.length-1;i>=0;i--){try{sel[i].selected=false;}catch(e){}}}
function pf(items,cmd,name){desel();
  var g=items[0].parent.groupItems.add();
  for(var i=0;i<items.length;i++)items[i].move(g,ElementPlacement.PLACEATBEGINNING);
  g.selected=true;app.executeMenuCommand(cmd);app.executeMenuCommand('expandStyle');
  var r=doc.selection[0];
  if(r.typename=="GroupItem"&&r.pageItems.length==1){app.executeMenuCommand('ungroup');r=doc.selection[0];}
  r.name=name;desel();return r;}
var ADD='Live Pathfinder Add', SUB='Live Pathfinder Subtract', INT='Live Pathfinder Intersect';
function body(cx,top,bottom,n){ // tulow = prostokat + kolo -> Pathfinder Unite
  var r=rect(cx-20,top+20,40,bottom-top-20); var c=ell(cx,top+20,20); return pf([r,c],ADD,n);}
function tile(name){ // kafel: 3 narozniki r40 (punkty z uchwytami), prawy dolny ostry
  var k=40*0.5523, P=[[[40,0],[40-k,0],[40,0]],[[200,0],[200,0],[200+k,0]],[[240,40],[240,40-k],[240,40]],[[240,240],[240,240],[240,240]],[[40,240],[40,240],[40-k,240]],[[0,200],[0,200+k],[0,200]],[[0,40],[0,40],[0,40-k]]];
  var p=L.pathItems.add();p.closed=true;
  for(var i=0;i<P.length;i++){var q=p.pathPoints.add();q.anchor=[X(P[i][0][0]),Y(P[i][0][1])];q.leftDirection=[X(P[i][1][0]),Y(P[i][1][1])];q.rightDirection=[X(P[i][2][0]),Y(P[i][2][1])];}
  style(p,BLACK);p.name=name;desel();return p;}
function layer(name,x,y){ox=x;oy=y;L=doc.layers.add();L.name=name;}

// tlo
L=doc.layers[0];L.name="Tlo";var bg=L.pathItems.rectangle(0,0,1080,780);style(bg,WHITE);bg.name="Tlo_planszy";

// 01 Schody
layer("01_Schody",120,120);tile("Schody_kafel");
pf([rect(42,170,156,30),rect(94,130,104,70),rect(146,90,52,110)],ADD,"Schody_stopnie");
ell(66,76,18,"Schody_glowa");body(66,102,162,"Schody_tulow");

// 02 Winda
layer("02_Winda",420,120);tile("Winda_kafel");
tri([40,110],[80,110],[60,74],"Winda_strzalka_gora");tri([40,130],[80,130],[60,166],"Winda_strzalka_dol");
pf([rect(100,40,100,160),rect(120,60,60,140)],SUB,"Winda_kabina");
ell(150,114,18,"Winda_glowa");body(150,140,200,"Winda_tulow");

// 03 Toaleta (tulowia do scalenia Shape Builderem)
layer("03_Toaleta",720,120);tile("Toaleta_kafel");
ell(70,62,18,"Toaleta_M_glowa");rect(50,108,40,92,"Toaleta_M_tulow_prostokat");ell(70,108,20,"Toaleta_M_tulow_kolo");
ell(158,62,18,"Toaleta_K_glowa");
var kr=rect(138,108,40,92,"Toaleta_K_tulow_prostokat");
// edycja punktow: rozsuniecie dolnych punktow -> sukienka
for(var i=0;i<4;i++){var a=kr.pathPoints[i].anchor;if(Math.abs(a[1]-Y(200))<0.5){var nx=(a[0]<X(158))?X(124):X(192);var v=[nx,a[1]];kr.pathPoints[i].anchor=v;kr.pathPoints[i].leftDirection=v;kr.pathPoints[i].rightDirection=v;}}
ell(158,108,20,"Toaleta_K_tulow_kolo");

// 04 Wejscie
layer("04_Wejscie",120,420);tile("Wejscie_kafel");
var d=pf([rect(100,40,100,160),rect(120,60,60,140)],SUB,"Wejscie_drzwi");
pf([d,rect(100,100,20,40)],SUB,"Wejscie_drzwi");
pf([rect(40,110,92,20),tri([130,84],[172,120],[130,156])],ADD,"Wejscie_strzalka");

// 05 Restauracja
layer("05_Restauracja",420,420);tile("Restauracja_kafel");
pf([ell(130,120,40),ell(130,120,20)],SUB,"Restauracja_talerz");
var fh=L.pathItems.roundedRectangle(Y(70),X(50),20,130,10,10);style(fh);
var f=pf([rect(40,40,40,40),ell(60,80,20),fh],ADD,"Restauracja_widelec");
pf([f,rect(48,40,8,40),rect(64,40,8,40)],SUB,"Restauracja_widelec");
var kq=pf([rect(180,40,20,20),ell(180,60,20)],INT,"noz_ostrze");
var kh=L.pathItems.roundedRectangle(Y(55),X(180),20,145,10,10);style(kh);
var kt=rect(180,55,20,20);
pf([kq,kh,kt],ADD,"Restauracja_noz");

// 06 Garderoba
layer("06_Garderoba",720,420);tile("Garderoba_kafel");
function strokeIt(p){p.filled=false;p.stroked=true;p.strokeColor=WHITE;p.strokeWidth=20;p.strokeCap=StrokeCap.ROUNDENDCAP;p.strokeJoin=StrokeJoin.ROUNDENDJOIN;return p;}
var tr=tri([120,110],[190,170],[50,170],"Garderoba_wieszak");strokeIt(tr);
// haczyk: okrag rozciety (usuniety lewy-dolny luk) - edycja punktow
var e=L.pathItems.ellipse(Y(50),X(98),44,44);strokeIt(e);
var pts=[];for(var i=0;i<e.pathPoints.length;i++){var s=e.pathPoints[i];pts.push({a:s.anchor,l:s.leftDirection,r:s.rightDirection});}
var iL=0,iB=0;for(var i=0;i<4;i++){if(pts[i].a[0]<pts[iL].a[0])iL=i;if(pts[i].a[1]<pts[iB].a[1])iB=i;}
var dir=((iL+1)%4==iB)?-1:1; // kierunek od L przez gore do B
var h=L.pathItems.add();strokeIt(h);h.closed=false;h.name="Garderoba_haczyk";
var order=[];for(var k=0;k<4;k++)order.push((iL+dir*k+8)%4);
for(var k=0;k<4;k++){var o=pts[order[k]];var np=h.pathPoints.add();np.anchor=o.a;
  if(dir==1){np.leftDirection=o.l;np.rightDirection=o.r;}else{np.leftDirection=o.r;np.rightDirection=o.l;}}
h.pathPoints[0].leftDirection=h.pathPoints[0].anchor;
var last=h.pathPoints[3];last.rightDirection=last.anchor;
var st=h.pathPoints.add();st.anchor=[X(120),Y(110)];st.leftDirection=st.anchor;st.rightDirection=st.anchor;
e.remove();
desel();

}catch(e){alert('Blad: '+e+' linia '+e.line);}
