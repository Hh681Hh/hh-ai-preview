/* Standalone presentation preview: never send commerce requests to a server. */
(()=>{
 const products=[{"id":"gpt-plus","name":"ChatGPT Plus","amountCents":13500,"period":"月","available":true},{"id":"gpt-pro-5x","name":"ChatGPT Pro 5x","amountCents":68800,"period":"月","available":true},{"id":"gpt-pro-20x","name":"ChatGPT Pro 20x","amountCents":128800,"period":"月","available":true}];
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
  const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  let data,status=200;
  if(method==='GET'&&url.pathname==='/api/payment-config')data={mode:'preview',ready:true,paymentReady:false,products,captchaRequired:false,channels:[{id:1,name:'USDT · 仅展示',provider_type:'bepusdt',interaction_mode:'redirect'}]};
  else if(method==='GET'&&url.pathname==='/api/account/me')data={user:null};
  else if(method==='GET'&&url.pathname==='/api/account/config')data={registration:true,verifyEmail:false,preview:true};
  else{status=403;data={error:'这是在线预览版，账户、订单、充值与付款暂未开放。请勿填写真实密码或转账。'};}
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 };
 const style=document.createElement('style');style.textContent='.preview-notice{padding:12px 20px;background:#171717;color:#fff;text-align:center;font:13px/1.6 system-ui;position:relative;z-index:100}.preview-notice strong{margin-right:12px}.preview-inline{padding:12px;background:#f1f1f1;color:#444;font-size:13px;border-radius:10px;margin:12px 0}';document.head.append(style);
 const banner=document.createElement('div');banner.className='preview-notice';banner.innerHTML='<strong>Hh AI · 在线预览</strong>可浏览商品与结算界面。账户、下单和充值暂未开放，请勿填写真实密码或转账。';document.body.prepend(banner);
 function update(){
  const caption=document.querySelector('.demo-caption');if(caption&&caption.textContent!=='在线预览 · 商品与价格仅供界面测试')caption.textContent='在线预览 · 商品与价格仅供界面测试';
  const button=document.querySelector('#create-payment');if(button){button.disabled=true;if(button.textContent!=='预览模式 · 暂不开放下单')button.textContent='预览模式 · 暂不开放下单';}
  document.querySelectorAll('#auth-dialog input,#auth-dialog button[type="submit"]').forEach(e=>{e.disabled=true;});
  const auth=document.querySelector('#auth-dialog');if(auth?.open&&!auth.querySelector('.preview-inline')){const n=document.createElement('p');n.className='preview-inline';n.textContent='这里只展示登录与注册界面，暂不收集账户信息。';auth.prepend(n);}
 }
 const observer=new MutationObserver(update);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});update();
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
})();
