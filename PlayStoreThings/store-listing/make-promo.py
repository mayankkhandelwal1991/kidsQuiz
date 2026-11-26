#!/usr/bin/env python3
"""Make the 30-second promo video from src/promo.html (real app pages).

Needs the local web server (Apache) serving this repo and Google Chrome.
    python3 make-promo.py                 # both versions
Output (in video/):
    kids-quiz-promo-vertical.mp4          9:16, music   (Reels, Shorts)
    kids-quiz-promo-vertical-silent.mp4   9:16, no music (add trending audio in Instagram)
    kids-quiz-promo-landscape.mp4         16:9, music   (YouTube -> Google Play promo video)
How: Chrome plays promo.html on a virtual clock and a screenshot is taken every
40 ms (25 fps); then src/rec.html plays the frames into a canvas, adds an original
music track and records it to MP4 (H.264 video, Opus audio) with MediaRecorder.
"""
import base64, json, os, shutil, subprocess, sys, tempfile, time, urllib.request
import websocket

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get('BASE', 'http://localhost/mayank/MK/kidsQuiz')
SRC = BASE + '/PlayStoreThings/store-listing/src'
OUT = os.path.join(HERE, 'video')
FPS, SECS = 25, 30
BLOCK = 'MAP *.firebasedatabase.app 127.0.0.1, MAP *.firebaseio.com 127.0.0.1, MAP pagead2.googlesyndication.com 127.0.0.1, MAP *.doubleclick.net 127.0.0.1'


class Chrome:
    def __init__(self, port):
        self.prof = tempfile.mkdtemp(prefix='chrome-prof-')
        self.p = subprocess.Popen(['google-chrome', '--headless=new', '--no-sandbox', '--hide-scrollbars',
                                   '--user-data-dir=' + self.prof, '--disk-cache-size=1', '--remote-debugging-port=%d' % port,
                                   '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--host-resolver-rules=' + BLOCK, 'about:blank'],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try:
                tabs = json.load(urllib.request.urlopen('http://127.0.0.1:%d/json' % port)); break
            except Exception:
                time.sleep(0.25)
        self.ws = websocket.create_connection([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'], suppress_origin=True, timeout=300)
        self.i = 0

    def cmd(self, method, wait_event=None, **params):
        self.i += 1; mid = self.i; got = None
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        res = None
        while True:
            m = json.loads(self.ws.recv())
            if m.get('method') == wait_event: got = True
            if m.get('id') == mid: res = m.get('result', m.get('error'))
            if res is not None and (wait_event is None or got): return res

    def close(self):
        try: self.cmd('Browser.close')
        except Exception: pass
        try: self.p.wait(15)
        except Exception: self.p.terminate()
        shutil.rmtree(self.prof, ignore_errors=True)


def frames(name, w, h, query):
    d = os.path.join(OUT, '_frames_' + name)
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    c = Chrome(9341)
    try:
        c.cmd('Page.enable')
        c.cmd('Emulation.setDeviceMetricsOverride', width=w // 2, height=h // 2, deviceScaleFactor=2, mobile=True)
        c.cmd('Emulation.setVirtualTimePolicy', policy='pause')
        c.cmd('Page.navigate', url=SRC + '/promo.html' + query)
        # let the page and the three app screens load (virtual time waits for the network)
        c.cmd('Emulation.setVirtualTimePolicy', wait_event='Emulation.virtualTimeBudgetExpired', policy='pauseIfNetworkFetchesPending', budget=60)
        for n in range(FPS * SECS):
            c.cmd('Emulation.setVirtualTimePolicy', wait_event='Emulation.virtualTimeBudgetExpired', policy='pauseIfNetworkFetchesPending', budget=1000 / FPS)
            data = c.cmd('Page.captureScreenshot', format='jpeg', quality=88)['data']
            with open(os.path.join(d, '%05d.jpg' % (n + 1)), 'wb') as f: f.write(base64.b64decode(data))
            if n % 125 == 0: print('  frame', n, flush=True)
    finally:
        c.close()
    return d


def encode(name, w, h, music, outfile):
    c = Chrome(9342)
    try:
        c.cmd('Page.enable'); c.cmd('Runtime.enable')
        # keep the recorder page "visible", or Chrome pauses its timers after a few seconds
        c.cmd('Page.bringToFront'); c.cmd('Emulation.setFocusEmulationEnabled', enabled=True)
        c.cmd('Page.navigate', url=SRC + '/rec.html'); time.sleep(2)
        rel = '../video/_frames_' + name
        c.cmd('Runtime.evaluate', expression='window.__size=null; recordPromo(%s, %d, %d, %d, %s, "keep").then(n=>window.__size=n)' % (json.dumps(rel), FPS * SECS, w, h, 'true' if music else 'false'))
        size = None
        for _ in range(120):   # recording takes ~30 s (real time)
            time.sleep(2)
            size = c.cmd('Runtime.evaluate', expression='window.__size', returnByValue=True)['result'].get('value')
            if size: break
        # copy the video out of the page in 2 MB pieces (one big message stalls)
        with open(outfile, 'wb') as f:
            for a in range(0, size, 2 * 1024 * 1024):
                js = ('window.__blob.slice(%d,%d).arrayBuffer().then(b=>{let s="";const u=new Uint8Array(b);'
                      'for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)})') % (a, a + 2 * 1024 * 1024)
                f.write(base64.b64decode(c.cmd('Runtime.evaluate', expression=js, awaitPromise=True, returnByValue=True)['result']['value']))
        print('  wrote', os.path.relpath(outfile, HERE), '%.1f MB' % (os.path.getsize(outfile) / 1e6), flush=True)
    finally:
        c.close()


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('vertical frames…'); frames('v', 1080, 1920, '')
    encode('v', 1080, 1920, True, os.path.join(OUT, 'kids-quiz-promo-vertical.mp4'))
    encode('v', 1080, 1920, False, os.path.join(OUT, 'kids-quiz-promo-vertical-silent.mp4'))
    print('landscape frames…'); frames('l', 1920, 1080, '?land=1')
    encode('l', 1920, 1080, True, os.path.join(OUT, 'kids-quiz-promo-landscape.mp4'))
    for n in ('v', 'l'): shutil.rmtree(os.path.join(OUT, '_frames_' + n), ignore_errors=True)
    print('done')
