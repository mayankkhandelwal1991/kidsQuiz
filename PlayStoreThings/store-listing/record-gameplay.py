#!/usr/bin/env python3
"""Records short gameplay clips of the web games for the Instagram Reel maker
(admin/index.html → 🎬 Make video). Each clip is a WebP sprite sheet of frames
in images/reel/<id>.webp, listed in images/reel/clips.json.

A bot plays each game in headless Chrome (virtual time, so even slow 3D games
record smoothly at 12 fps). If the bot loses quickly it retries and keeps the
longest run. Firebase and ad domains are blocked, so nothing is written to the
live app data.

  BASE=http://localhost/mayank/MK/kidsQuiz python3 record-gameplay.py            # all games
  python3 record-gameplay.py car_race_3d egg_jump                                 # some games
Needs: google-chrome, python3 with Pillow and websocket-client.
"""
import os
import json, time, subprocess, urllib.request, websocket, base64, sys
class B:
    def __init__(s, port=9340, w=390, h=693):
        s.p = subprocess.Popen(['google-chrome','--headless=new','--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',f'--remote-debugging-port={port}',"--remote-allow-origins=*",'--autoplay-policy=no-user-gesture-required','--mute-audio',
          '--host-resolver-rules=MAP *.firebasedatabase.app 127.0.0.1, MAP *.firebaseio.com 127.0.0.1, MAP *.googlesyndication.com 127.0.0.1, MAP *.doubleclick.net 127.0.0.1',f'--window-size={w},{h}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for i in range(30):
            try: tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')); break
            except Exception: time.sleep(.3)
        tab=[t for t in tabs if t['type']=='page'][0]
        s.ws=websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=60); s.n=0
        s.cmd('Emulation.setDeviceMetricsOverride', width=w, height=h, deviceScaleFactor=1, mobile=True)
        s.cmd('Page.enable')
        s.cmd('Page.addScriptToEvaluateOnNewDocument', source="try{localStorage.setItem('kq_guest_session','1');localStorage.setItem('kq_nick','Aarav');localStorage.setItem('kq_last_class','3');localStorage.setItem('kq_sound','0')}catch(e){}")
    def cmd(s, m, **p):
        s.n+=1; s.ws.send(json.dumps({'id':s.n,'method':m,'params':p}))
        while True:
            r=json.loads(s.ws.recv())
            if r.get('id')==s.n: return r.get('result',{})
    def ev(s, e): return s.cmd('Runtime.evaluate', expression=e, awaitPromise=True, returnByValue=True).get('result',{}).get('value')
    def go(s, url, wait=4): s.cmd('Page.navigate', url=url); time.sleep(wait)
    def shot(s, q=80): return base64.b64decode(s.cmd('Page.captureScreenshot', format='jpeg', quality=q)['data'])
    def tap(s, x, y):
        s.cmd('Input.dispatchTouchEvent', type='touchStart', touchPoints=[{'x':x,'y':y}])
        s.cmd('Input.dispatchTouchEvent', type='touchEnd', touchPoints=[])
    def click(s, x, y):
        for t in ('mousePressed','mouseReleased'): s.cmd('Input.dispatchMouseEvent', type=t, x=x, y=y, button='left', clickCount=1)
    def key(s, k, code=None, kc=0):
        for t in ('keyDown','keyUp'): s.cmd('Input.dispatchKeyEvent', type=t, key=k, code=code or k, windowsVirtualKeyCode=kc)
    def close(s): s.p.kill()
def _advance(s, ms):
    s.n+=1; s.ws.send(json.dumps({'id':s.n,'method':'Emulation.setVirtualTimePolicy','params':{'policy':'advance','budget':ms}}))
    while True:
        r=json.loads(s.ws.recv())
        if r.get('method')=='Emulation.virtualTimeBudgetExpired': return
B.advance=_advance
import sys, time, io, random, json
from PIL import Image
base=os.environ.get('BASE','http://localhost/mayank/MK/kidsQuiz').rstrip('/')+'/games/'
K = "window.__k=(k,c,up)=>{const o={key:k,code:c||k,bubbles:true};document.dispatchEvent(new KeyboardEvent('keydown',o));if(up!==false)setTimeout(()=>document.dispatchEvent(new KeyboardEvent('keyup',o)),up||120)};"
G = {  # id: (file, bot JS run in page, or None; cdp tap list function)
 'egg_jump':     ('action/egg_jump.html',      "setInterval(()=>__k(' ','Space'),650)"),
 'flappy_bee':   ('action/flappy_bee.html',    "setInterval(()=>__k(' ','Space'),420)"),
 'fruit_catch':  ('action/fruit_catch.html',   "setInterval(()=>__k(Math.random()<.5?'ArrowLeft':'ArrowRight',null,350),500)"),
 'space_shooter':('action/space_shooter.html', "setInterval(()=>__k(Math.random()<.5?'ArrowLeft':'ArrowRight',null,300),450)"),
 'car_race_3d':  ('threed/car_race_3d.html',   "setInterval(()=>__k(Math.random()<.5?'ArrowLeft':'ArrowRight'),900)"),
 'endless_runner_3d':('threed/endless_runner_3d.html', "let i=0;setInterval(()=>__k(['ArrowLeft','ArrowUp','ArrowRight','ArrowUp'][i++%4]),800)"),
 'crossy_road_3d':('threed/crossy_road_3d.html', "setInterval(()=>__k('ArrowUp'),450)"),
 'game_2048':    ('puzzle/game_2048.html',     "let i=0;setInterval(()=>__k(['ArrowLeft','ArrowDown','ArrowRight','ArrowDown'][i++%4]),380)"),
 'tetris':       ('puzzle/tetris.html',        "let i=0;setInterval(()=>__k(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','ArrowDown'][i++%5]),300)"),
 'bubble_shooter':('puzzle/bubble_shooter.html', 'TAPS'),
 'memory_match': ('puzzle/memory_match.html',  'TAPS'),
 'balloon_pop':  ('action/balloon_pop.html',   'TAPS'),
 'whack_mole':   ('action/whack_mole.html',    'TAPS'),
 'basketball_3d':('threed/basketball_3d.html', 'TAPS'),
 # rebuilt / new games: bots that show the best moments
 'ant_attack':   ('strategy/ant_attack.html', "setTimeout(()=>{seeds=900;const K=['frog','bee','hedgehog'];let i=0;path.slice(1,-1).forEach(p=>[[42,42],[-42,42],[42,-42],[-42,-42]].some(([dx,dy])=>{const x=p[0]+dx,y=p[1]+dy;if(y<95||y>C.h-110||nearPath(x,y,34)||guards.some(q=>Math.hypot(q.x-x,q.y-y)<46))return false;guards.push({k:K[i++%3],x,y,px:x,py:y,cd:0,bob:0,ph:0,dir:1});return true}));wave=2;spd=2;drawShop();startWave();spawnQ.splice(2,0,{t:'queen',gap:0.6})},2700)"),
 'cricket_superover':('action/cricket_superover.html', "let __b=-1,__t=false;setInterval(()=>{if(G.state!=='play')return;if(phase==='runup'&&__b!==ballNo){__b=ballNo;__t=false}if(phase==='flight'&&!__t&&pt*del.dur>=del.dur-0.09){__t=true;tap()}},10)"),
 'snake_3d':     ('threed/snake_3d.html', "const __free=(n,body)=>!(n.x<0||n.y<0||n.x>=COLS||n.y>=ROWS||body.some(p=>p.x===n.x&&p.y===n.y)||rocks.some(r=>r.x===n.x&&r.y===n.y));const __room=(st,body)=>{const seen=new Set([st.x+','+st.y]),q=[st];let c=0;while(q.length&&c<200){const p=q.shift();c++;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},k=n.x+','+n.y;if(!seen.has(k)&&__free(n,body)){seen.add(k);q.push(n)}}}return c};const __step=step;step=function(){if(G.state==='play'){const h=snake[0],tg=gold||food,body=snake.slice(0,-1);const o=[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,y])=>!(x===-dir.x&&y===-dir.y)).map(([x,y])=>{const n={x:h.x+x,y:h.y+y},ok=__free(n,body);return{x,y,ok,room:ok?__room(n,body):0,d:Math.abs(n.x-tg.x)+Math.abs(n.y-tg.y)}}).filter(m=>m.ok).sort((a,b)=>((b.room>=snake.length)-(a.room>=snake.length))||(a.d-b.d)||(b.room-a.room))[0];queue=o?[{x:o.x,y:o.y}]:[]}__step()}"),
 'math_games':   ('brain/math_games.html', "setInterval(()=>{if(G.state!=='play'||lock)return;const b=[...document.querySelectorAll('.mg-o')].find(x=>+x.dataset.v===q.ans);if(b)b.click()},1300)"),
 'pattern_detective':('brain/pattern_detective.html', "setInterval(()=>{if(G.state!=='play'||lock)return;const b=[...document.querySelectorAll('.pd-o')].find(x=>q.opts[+x.dataset.k]===q.ans);if(b)b.click()},1300)"),
}
# every other game in data/games.json gets the generic bot (taps + arrow keys + space)
_R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for _g in json.load(open(os.path.join(_R, 'data', 'games.json')))['games']:
    _id = _g['file'].split('/')[-1].replace('.html', '')
    if _id not in G: G[_id] = (_g['file'], 'MIX')
MIX_JS = "let i=0;setInterval(()=>__k(['ArrowRight','ArrowUp',' ','ArrowLeft','ArrowDown'][i++%5],i%5==2?'Space':null),420)"
TAP_JS = """(()=>{const bad=/Play again|Play!|Home|🏠|🔊|🔇|⏸|Games|Share|Top players/;
 const c=[...document.querySelectorAll('button,.card,.cell,.tile,.opt,.option,.letter,.key,.mole,.hole,.balloon,[data-i],[data-idx],canvas')].filter(e=>{const r=e.getBoundingClientRect();return e.offsetParent!==null&&r.y>70&&r.width>12&&!bad.test(e.innerText||'')&&!e.closest('a')});
 if(!c.length)return null;const e=c[Math.floor(Math.random()*c.length)],r=e.getBoundingClientRect();
 if(e.tagName==='CANVAS'){const y0=Math.max(r.y,90);return [r.x+r.width*(.2+.6*Math.random()),y0+(r.bottom-y0)*(.3+.6*Math.random())]}
 return [r.x+r.width/2,r.y+r.height/2]})()"""
def run(gid, secs=4.0, fps=12, warm=2.2):
    f, bot = G[gid]; b = B(port=int(os.environ.get('PORT', '9340')))
    try:
        b.go(base + f + '?reel=1', 5)
        b.ev("(()=>{const p=[...document.querySelectorAll('button')].filter(e=>e.offsetParent&&/Play/.test(e.innerText));if(p.length)p[p.length-1].click()})()")
        time.sleep(1.2)
        if bot not in ('TAPS', 'MIX'): b.ev(K + bot)
        if bot == 'MIX': b.ev(K + MIX_JS)
        frames = []; step = int(1000 / fps); nframes = int(secs * fps); warmn = int(warm * fps)
        b.cmd('Emulation.setVirtualTimePolicy', policy='pause')
        for i in range(warmn + nframes):
            b.advance(step)
            if bot in ('TAPS', 'MIX') and i % 5 == 0:
                pt = b.ev(TAP_JS)
                x, y = pt if pt else (random.randint(60, 330), random.randint(250, 600))
                b.click(x, y)
            if i >= warmn and b.ev("!location.pathname.endsWith('/" + f.split('/')[-1] + "') || [...document.querySelectorAll('button,a')].some(e=>e.offsetParent&&/Play again|Try again/i.test(e.innerText))"): break
            if i >= warmn: frames.append(Image.open(io.BytesIO(b.shot(85))).convert('RGB'))
        return frames
    finally: b.close()
def best(gid, fps=12, secs=3.5):
    top = []
    for k in range(3):
        try: fr = run(gid, secs=secs, fps=fps, warm=2.2)
        except Exception: fr = []
        if len(fr) > len(top): top = fr
        if len(top) >= int(secs * fps): break
    return top
def sheet(gid, fr, cols=6, cw=300):
    ch = round(cw * fr[0].height / fr[0].width); rows = -(-len(fr) // cols)
    S = Image.new('RGB', (cols * cw, rows * ch), 'black')
    for i, f in enumerate(fr): S.paste(f.resize((cw, ch), Image.LANCZOS), ((i % cols) * cw, (i // cols) * ch))
    out = OUT + gid + '.webp'; S.save(out, 'WEBP', quality=72, method=6)
    return out, len(fr), cw, ch
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.environ.get('REEL_OUT') or os.path.join(ROOT, 'images', 'reel') + '/'
if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    man_path = OUT + 'clips.json'
    try: man = {c['id']: c for c in json.load(open(man_path))['clips']}
    except Exception: man = {}
    for gid in (sys.argv[1:] or list(G)):
        try: fr = best(gid)
        except Exception as e: print(gid, 'failed:', type(e).__name__, flush=True); continue
        print(gid, len(fr), 'frames', flush=True)
        if len(fr) < 24: print('  skipped (the bot lost too fast)'); continue
        out, n, cw, ch = sheet(gid, fr)
        man[gid] = {'id': gid, 'file': G[gid][0], 'n': n, 'cols': 6, 'cw': cw, 'ch': ch, 'fps': 12}
        json.dump({'clips': list(man.values())}, open(man_path, 'w'), indent=1)
        print('  ->', os.path.relpath(out, ROOT), flush=True)
