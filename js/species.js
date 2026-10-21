<!-- © 2026 凱波工作室 Kaibo Studio -->
/* Species templates (v1 lives in code; v2 → `species_templates` table with a version number).
   profile: species-specific profile fields stored in pet.attributes (JSON).
   checkin: daily/weekly quick check-in metrics stored in checkin.metrics (JSON).
     t: 'num' (unit, step, err = rough measurement resolution used to avoid over-reading small changes)
        'ord' ordinal scale (v numeric so it can be charted), 'cat' categorical (normal value = first), 'bool'
   reminderExamples: EXAMPLES ONLY, shown as suggestions. Not predictions, no intervals asserted. */
(function(){
const APPETITE={t:'ord',opts:[[0,'沒吃'],[1,'吃很少'],[2,'正常'],[3,'比平常多']]};
const ACTIVITY={t:'ord',opts:[[0,'很沒精神'],[1,'偏少'],[2,'正常'],[3,'很活潑']]};
const WATER={t:'ord',opts:[[1,'偏少'],[2,'正常'],[3,'偏多']]};
const m=(k,n,base)=>Object.assign({k,n},base);
const NEUTER={k:'neutered',n:'結紮',t:'select',opts:['未知','已結紮','未結紮']};
const SPECIES={
 dog:{n:'狗',i:'🐶',wUnit:'kg',
  profile:[NEUTER,{k:'coat',n:'毛色／外觀',t:'text'},{k:'size',n:'體型',t:'select',opts:['','小型','中型','大型']}],
  checkin:[m('weight','體重',{t:'num',unit:'kg',step:0.1,err:0.1,baseline:true}),m('appetite','食慾',APPETITE),m('water','飲水',WATER),
   m('stool','排便',{t:'cat',opts:['正常','偏軟','腹瀉','偏硬','沒排便','有血']}),m('activity','活動力',ACTIVITY),m('vomit','嘔吐',{t:'bool'}),m('cough','咳嗽',{t:'bool'})],
  reminderExamples:['疫苗','體內外驅蟲','心絲蟲預防','洗澡美容','剪指甲','健康檢查']},
 cat:{n:'貓',i:'🐱',wUnit:'kg',
  profile:[NEUTER,{k:'lifestyle',n:'生活方式',t:'select',opts:['','室內','可外出']},{k:'coat',n:'毛色／外觀',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'kg',step:0.01,err:0.05,baseline:true}),m('appetite','食慾',APPETITE),m('water','飲水',WATER),
   m('urine','尿團數',{t:'num',unit:'團',step:1,err:1}),m('stool','排便',{t:'cat',opts:['正常','偏軟','腹瀉','偏硬','沒排便','有血']}),
   m('vomit','嘔吐／毛球',{t:'bool'}),m('activity','活動力',ACTIVITY)],
  reminderExamples:['疫苗','體內外驅蟲','剪指甲','清洗貓砂盆','健康檢查']},
 rabbit:{n:'兔',i:'🐰',wUnit:'g',
  profile:[NEUTER,{k:'coat',n:'毛色／外觀',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:10,baseline:true}),m('appetite','食慾',APPETITE),m('hay','牧草量',{t:'ord',opts:[[0,'沒吃'],[1,'偏少'],[2,'正常']]}),
   m('droppings','便便',{t:'cat',opts:['正常','變小','變少','沒有','軟便']}),m('water','飲水',WATER),m('activity','活動力',ACTIVITY)],
  reminderExamples:['剪指甲','梳毛','健康檢查','清潔籠舍']},
 bird:{n:'鳥',i:'🐦',wUnit:'g',
  profile:[{k:'kind',n:'鳥種',t:'text'},{k:'sexMethod',n:'性別判定方式',t:'select',opts:['','DNA','外觀','未知']},{k:'band',n:'腳環號碼',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:1,baseline:true}),m('appetite','食慾',APPETITE),
   m('droppings','糞便',{t:'cat',opts:['正常','偏稀','顏色異常','變少','有血']}),m('fluffed','蓬毛',{t:'bool'}),m('vocal','叫聲',{t:'ord',opts:[[0,'沒叫'],[1,'偏少'],[2,'正常']]}),m('activity','活動力',ACTIVITY)],
  reminderExamples:['健康檢查','清潔鳥籠','檢查指甲與喙','更換棲木']},
 hamster:{n:'倉鼠',i:'🐹',wUnit:'g',
  profile:[{k:'coat',n:'毛色／外觀',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:1,baseline:true}),m('appetite','食慾',APPETITE),
   m('stool','便便',{t:'cat',opts:['正常','軟便','濕尾','沒有']}),m('water','飲水',WATER),m('activity','夜間活動',ACTIVITY)],
  reminderExamples:['更換墊料','清潔鼠籠','健康檢查']},
 guinea:{n:'天竺鼠',i:'🐹',wUnit:'g',
  profile:[NEUTER,{k:'coat',n:'毛色／外觀',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:10,baseline:true}),m('appetite','食慾',APPETITE),m('hay','牧草量',{t:'ord',opts:[[0,'沒吃'],[1,'偏少'],[2,'正常']]}),
   m('stool','便便',{t:'cat',opts:['正常','變小','變少','軟便','沒有']}),m('water','飲水',WATER),m('vitc','有補充維生素 C',{t:'bool'})],
  reminderExamples:['剪指甲','更換墊料','健康檢查']},
 reptile:{n:'爬蟲',i:'🦎',wUnit:'g',
  profile:[{k:'kind',n:'物種',t:'text'},{k:'enclosure',n:'飼養箱',t:'text'},{k:'uvb',n:'UVB 燈管更換日',t:'date'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:1,baseline:true}),m('ate','進食',{t:'cat',opts:['吃了','拒食','未餵食']}),
   m('hot','熱點溫度',{t:'num',unit:'°C',step:0.5,err:0.5}),m('cool','冷區溫度',{t:'num',unit:'°C',step:0.5,err:0.5}),m('humid','濕度',{t:'num',unit:'%',step:1,err:3}),
   m('shed','蛻皮',{t:'cat',opts:['無','蛻皮中','完成','不完整']}),m('stool','有排便',{t:'bool'})],
  reminderExamples:['更換 UVB 燈管','清潔飼養箱','餵食','補充鈣粉']},
 fish:{n:'魚',i:'🐠',wUnit:'',
  profile:[{k:'tank',n:'水量（公升）',t:'number'},{k:'count',n:'數量',t:'number'},{k:'filter',n:'過濾器',t:'text'}],
  checkin:[m('temp','水溫',{t:'num',unit:'°C',step:0.1,err:0.5}),m('ph','pH',{t:'num',unit:'',step:0.1,err:0.2}),m('change','有換水',{t:'bool'}),
   m('ate','進食',{t:'cat',opts:['正常','偏少','不吃']}),m('swim','游泳狀態',{t:'cat',opts:['正常','浮頭','沉底','側游','躲藏']}),m('deaths','死亡數',{t:'num',unit:'隻',step:1,err:0})],
  reminderExamples:['換水','清洗濾材','水質檢測']},
 other:{n:'其他',i:'🐾',wUnit:'g',
  profile:[{k:'kind',n:'物種',t:'text'}],
  checkin:[m('weight','體重',{t:'num',unit:'g',step:1,err:1,baseline:true}),m('appetite','食慾',APPETITE),m('activity','活動力',ACTIVITY),m('stool','排便',{t:'cat',opts:['正常','異常','沒有']})],
  reminderExamples:['健康檢查','清潔環境']}
};
/* Default quick-care check-in items per species (user can add/remove per pet). Care actions only, no medical advice. */
const CARE_DEFAULTS={dog:['🪥 刷牙','🛁 洗澡','💊 驅蟲','✂️ 剪指甲','🦮 散步'],cat:['🪥 刷牙','🪮 梳毛','💊 驅蟲','🧹 清貓砂'],
 rabbit:['🌾 補牧草','🪮 梳毛','✂️ 剪指甲','🧹 清籠子'],guinea:['🌾 補牧草','🍊 維生素C','✂️ 剪指甲','🧹 換墊料'],hamster:['🥕 餵食','💧 換水','🧹 換墊料'],
 bird:['🥣 餵食','💧 換水','🧹 清鳥籠','🛁 洗澡'],reptile:['🦗 餵食','💧 噴水','🧹 清飼養箱','💡 檢查燈具'],fish:['🍤 餵食','💧 換水','🧽 清濾材'],other:['🥣 餵食','💧 換水','🧹 清潔環境']};
window.PC=window.PC||{}; Object.assign(window.PC,{SPECIES,CARE_DEFAULTS});
})();
