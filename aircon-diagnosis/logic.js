(function () {
  "use strict";
  var LABELS = {replace:"買い替え", repair:"修理・点検", clean:"クリーニング"};
  var COLORS = {replace:"replace",repair:"repair",clean:"clean"};
  var LABEL_TEXT = {
    replace:"買い替えも含めて比較するとよさそうです。製造年、部品供給、修理見積もりを確認しましょう。",
    repair:"まず不具合の点検が優先です。原因が判明してから修理費と買い替え費を比較しましょう。",
    clean:"運転に異常がなければ、まず汚れを確認する方向です。清掃で直ると断定はできません。"
  };
  var AGE = {
    new:[-8,12,8], mid:[2,12,6], old:[23,4,-3], very_old:[42,-4,-5], unknown:[0,0,0]
  };
  var SYMPTOM = {
    smell:[-3,-7,48], dirt:[-6,-12,52], air:[8,30,17],
    poor:[18,43,-17], stop:[19,51,-23], leak:[8,43,-12],
    noise:[13,51,-20], none:[5,-15,12], maintenance:[5,-10,25]
  };
  var PERFORMANCE = {
    normal:[0,-4,12], weak:[7,14,5], none:[16,24,-12], unknown:[0,0,0]
  };
  var FILTER = {dirty:[0,0,23], clean:[0,0,-4], unknown:[0,0,0]};
  var WASH = {recent:[0,0,-15], some:[0,0,5], old:[0,0,15], never:[0,0,18], unknown:[0,0,0]};
  var QUOTE = {
    none:[0,0,0], under:[-5,24,0], medium:[4,9,0],
    high:[20,0,0], very_high:[38,-8,0], unavailable:[55,-20,0]
  };
  var REASONS = {
    new:"比較的新しいため、修理・清掃の余地を確認します。",
    old:"9年以上のため、部品供給と今後の使用年数も確認します。",
    very_old:"13年以上のため、修理費と買い替え費を比べる価値があります。",
    smell:"ニオイは汚れが原因のことがありますが、焦げ臭い場合は使用を中止してください。",
    dirt:"目に見える汚れは清掃を検討する根拠です。",
    air:"風量低下は汚れだけでなく、ファンや制御の不具合でも起こります。",
    poor:"冷え・暖まりの悪さは汚れ、冷媒系、機器の故障など複数の原因が考えられます。",
    stop:"エラーや途中停止があるため、清掃の前に原因確認が必要です。",
    leak:"水漏れがあるため、使用を中止し点検を優先してください。",
    noise:"異音・異常振動があるため、使用を中止し点検を優先してください。",
    none:"目立った故障症状はありません。",
    maintenance:"予防的なメンテナンス希望を反映しました。",
    filter_dirty:"フィルターの汚れは風量・効率に影響します。",
    wash_never:"専門業者による洗浄歴がない点を反映しました。",
    wash_old:"前回洗浄から3年以上経過している点を反映しました。",
    quote_high:"修理費が高くなる見込みのため、買い替えとの比較を重視します。",
    parts:"修理部品がない場合、買い替えの検討が必要です。"
  };
  function hasOwn(o,k) {return Object.prototype.hasOwnProperty.call(o,k);}
  function pct(score) {
    var weights=score.map(function(n){return Math.max(1,n);});
    var sum=weights.reduce(function(a,b){return a+b;},0);
    var floats=weights.map(function(n){return n*100/sum;});
    var values=floats.map(Math.floor);
    var order=[0,1,2].sort(function(a,b){return (floats[b]-values[b])-(floats[a]-values[a]);});
    var leftover=100-values.reduce(function(a,b){return a+b;},0);
    for(var i=0;i<leftover;i++)values[order[i%3]]++;
    return {replace:values[0],repair:values[1],clean:values[2]};
  }
  function calculate(v) {
    if (!v || !hasOwn(AGE,v.age) || !hasOwn(SYMPTOM,v.symptom)) return null;
    var safeValues = {
      performance:hasOwn(PERFORMANCE,v.performance)?v.performance:"unknown",
      filter:hasOwn(FILTER,v.filter)?v.filter:"unknown",
      wash:hasOwn(WASH,v.wash)?v.wash:"unknown",
      quote:hasOwn(QUOTE,v.quote)?v.quote:"none"
    };
    if(v.danger===true) return {
      status:"stop",pcts:null,leading:null,
      heading:"安全確認が最優先です",
      advice:"運転を中止し、無理に使わず販売店・メーカー・専門業者へ点検を依頼してください。焦げ臭さ、プラグ発熱、ブレーカーの反復作動は清掃の診断より先に確認が必要です。",
      reasons:["火災・感電の危険が疑われるため、3つの割合による判定は行いません。"]
    };
    var score=[20,20,20], reasons=[], keys=[];
    function apply(a){for(var i=0;i<3;i++)score[i]+=a[i];}
    apply(AGE[v.age]); apply(SYMPTOM[v.symptom]);
    apply(PERFORMANCE[safeValues.performance]);
    apply(FILTER[safeValues.filter]);
    apply(WASH[safeValues.wash]);
    apply(QUOTE[safeValues.quote]);
    if(v.age==="new") keys.push("new");
    if(v.age==="old") keys.push("old");
    if(v.age==="very_old") keys.push("very_old");
    if(hasOwn(REASONS,v.symptom))keys.push(v.symptom);
    if(safeValues.filter==="dirty")keys.push("filter_dirty");
    if(safeValues.wash==="never")keys.push("wash_never");
    if(safeValues.wash==="old")keys.push("wash_old");
    if(safeValues.quote==="high"||safeValues.quote==="very_high")keys.push("quote_high");
    if(safeValues.quote==="unavailable")keys.push("parts");
    keys.forEach(function(k){if(REASONS[k])reasons.push(REASONS[k]);});
    if(reasons.length===0)reasons.push("入力された情報から初期判断を算出しました。現場での確認が必要です。");
    var result=pct(score);
    var ordered=["replace","repair","clean"].sort(function(a,b){return result[b]-result[a];});
    var leader=ordered[0];
    var safety=v.symptom==="leak"||v.symptom==="noise";
    if(safety){
      leader="repair";
    }
    return {
      status:safety?"caution":"ok",pcts:result,leading:leader,
      heading:safety?"使用を中止して点検を優先":"まずは「"+LABELS[leader]+"」の方向が有力",
      advice:safety?"水漏れ・異音などの異常がある場合、クリーニングや買い替えの判断より安全点検を優先してください。":LABEL_TEXT[leader],
      reasons:reasons.slice(0,4)
    };
  }
  function init(){
    var root=document.getElementById("bc-diagnosis");
    if(!root)return;
    var names=["age","symptom","performance","filter","wash","quote"];
    var fields={};
    names.forEach(function(k){fields[k]=document.getElementById("q-"+k);});
    var danger=document.getElementById("q-danger");
    var results=document.getElementById("bc-results");
    var placeholder=document.getElementById("bc-placeholder");
    var title=document.getElementById("bc-result-title");
    var advice=document.getElementById("bc-advice");
    var notes=document.getElementById("bc-notes");
    var warning=document.getElementById("bc-warning");
    var bars=document.getElementById("bc-bars");
    var share=document.getElementById("bc-copy");
    var status=document.getElementById("bc-copy-status");
    var latest=null;
    function value(){var v={danger:danger.checked};names.forEach(function(k){v[k]=fields[k].value;});return v;}
    function show(){
      latest=calculate(value());
      status.textContent="";
      if(!latest){
        placeholder.hidden=false;results.hidden=true;return;
      }
      placeholder.hidden=true;results.hidden=false;
      title.textContent=latest.heading;
      advice.textContent=latest.advice;
      warning.hidden=latest.status==="ok";
      if(latest.status==="stop"){
        bars.hidden=true;
      }else{
        bars.hidden=false;
        ["replace","repair","clean"].forEach(function(k){
          var number=document.getElementById("bc-pct-"+k);
          var bar=document.getElementById("bc-bar-"+k);
          number.textContent=latest.pcts[k]+"%";
          bar.style.width=latest.pcts[k]+"%";
          bar.setAttribute("aria-valuenow",String(latest.pcts[k]));
        });
      }
      while(notes.firstChild)notes.removeChild(notes.firstChild);
      latest.reasons.forEach(function(s){var li=document.createElement("li");li.textContent=s;notes.appendChild(li);});
    }
    async function copy(){
      if(!latest)return;
      var v=value();
      function selected(k){var opts=fields[k].options;return opts[fields[k].selectedIndex].text;}
      var lines=[
        "【BCサービス エアコン相談・簡易診断】",
        "使用年数："+selected("age"),
        "主な症状："+selected("symptom"),
        "冷暖房の効き："+selected("performance"),
        "フィルター："+selected("filter"),
        "前回の洗浄："+selected("wash"),
        "修理見積："+selected("quote"),
        "危険な症状："+(v.danger?"あり":"チェックなし"),
        "簡易診断："+latest.heading
      ];
      if(latest.pcts)lines.push("買い替え："+latest.pcts.replace+"%／修理・点検："+latest.pcts.repair+"%／クリーニング："+latest.pcts.clean+"%");
      lines.push("※点数配分による目安で、実際の故障確率・修理可否ではありません。","写真・型番・エラー表示とともに相談したいです。");
      try{
        await navigator.clipboard.writeText(lines.join("\n"));
        status.textContent="コピーしました。LINEで貼り付けてください。";
      }catch(e){
        var ta=document.createElement("textarea");ta.value=lines.join("\n");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();
        var ok=document.execCommand("copy");document.body.removeChild(ta);
        status.textContent=ok?"コピーしました。LINEで貼り付けてください。":"コピーできませんでした。選択内容をLINEに直接お知らせください。";
      }
    }
    root.addEventListener("change",show);
    share.addEventListener("click",copy);
    document.getElementById("bc-reset").addEventListener("click",function(){
      fields.age.value="";fields.symptom.value="";
      fields.performance.value="unknown";fields.filter.value="unknown";
      fields.wash.value="unknown";fields.quote.value="none";
      danger.checked=false;show();fields.age.focus();
    });
    show();
  }
  if(typeof window!=="undefined")window.BCAirDiagnosis={calculate:calculate,version:"v0.1"};
  if(typeof document!=="undefined"){
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
    else init();
  }
})();
