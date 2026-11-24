'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = Number(process.env.PORT || 3000);
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const send = (res, status, obj) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(obj)); };
http.createServer(async (req,res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && (route === '/' || route === '/weapon.png')) {
    const image = route === '/weapon.png';
    res.writeHead(200, {'Content-Type': image ? 'image/png' : 'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(path.join(__dirname,'public', image ? 'weapon.png' : 'index.html')).pipe(res); return;
  }
  if (req.method !== 'POST' || route !== '/api/submit') return send(res,404,{error:'Not found.'});
  if (!token || !chatId) return send(res,503,{error:'The organizer has not configured Telegram yet.'});
  let raw = '';
  try {
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return send(res,413,{error:'Submission too large.'}); }
    const data = JSON.parse(raw);
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const weapon = typeof data.weapon === 'string' ? data.weapon.trim() : '';
    if (!name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !weapon || weapon.length > 150) return send(res,400,{error:'Please check your entries.'});
    const clean = x => x.replace(/[\r\n]+/g, ' ');
    const text = `Favorite Weapon Survey\nName: ${clean(name)}\nEmail: ${clean(email)}\nFavorite Weapon: ${clean(weapon)}`;
    const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text}),signal:AbortSignal.timeout(10000)});
    const result = await telegram.json();
    if (!telegram.ok || !result.ok) { console.error('Telegram delivery failed:',result.description || telegram.status); return send(res,502,{error:'Delivery failed. Please try again later.'}); }
    return send(res,200,{ok:true});
  } catch (e) { console.error('Submission error:', e.message); return send(res,500,{error:'Could not submit. Please try again.'}); }
}).listen(port,'0.0.0.0',()=>console.log(`Listening on port ${port}${token && chatId ? '' : ' (Telegram not configured)'}`));
