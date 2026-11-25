from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import subprocess

PAGE = """<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5;url=/"><title>Santa Claw Village</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#101b20;color:#f5f8f6;font:16px/1.55 system-ui}
main{width:min(100%,590px);overflow:hidden;border:1px solid #3e5752;border-radius:22px;background:#192b2a}
.scene{height:clamp(138px,32vw,234px);display:flex;align-items:end;justify-content:center;gap:9%;padding-bottom:28px;overflow:hidden;
background:radial-gradient(circle at 74% 22%,#f8edcc 0 15px,transparent 16px),radial-gradient(ellipse at 18% 108%,#e9f2ee 0 41%,transparent 42%),radial-gradient(ellipse at 86% 106%,#cbdfdb 0 46%,transparent 47%),linear-gradient(#133341,#527971)}
.house{width:67px;height:96px;flex-shrink:0;clip-path:polygon(50% 0,100% 40%,92% 40%,92% 100%,8% 100%,8% 40%,0 40%);background:linear-gradient(#faf8ea 40%,transparent 41%),linear-gradient(#ffd986 0 0) 29% 67%/12px 14px no-repeat,linear-gradient(#ffd986 0 0) 71% 67%/12px 14px no-repeat,#8f3432}
.house:first-child{transform:scale(.72);transform-origin:bottom}.house:last-child{transform:scale(.84);transform-origin:bottom}
section{padding:clamp(22px,6vw,40px)}small{color:#b8ea84;letter-spacing:.09em;font-weight:700}h1{font-size:clamp(2rem,7vw,3rem);line-height:1.08;margin:.25em 0}p{margin:.75em 0 0;color:#d5e4df}
progress{width:100%;height:12px;margin-top:18px;accent-color:#a8dc61}
</style>
<main><div class="scene" aria-hidden="true"><i class="house"></i><i class="house"></i><i class="house"></i></div>
<section><small>WORKSHOP PREVIEW</small><h1>Santa Claw Village</h1>%s</section></main></html>"""

class Waiting(BaseHTTPRequestHandler):
    def do_GET(self):
        state = subprocess.run(
            ["systemctl", "--user", "show", "-p", "ActiveState", "--value", "santa-claw-launchable.service"],
            capture_output=True, text=True,
        ).stdout.strip()
        if state == "failed":
            status = "<p><strong>Installation stopped.</strong> Open Santa Claw Setup in Brev for recovery.</p>"
        elif state in ("activating", "active"):
            status = ('<progress aria-label="Preparing your village"></progress>'
                      '<p><strong>Preparing your village.</strong> First setup can take six minutes or longer. '
                      'This preview refreshes automatically and opens the village when ready.</p>')
        else:
            status = ("<p>Open <strong>Santa Claw Setup</strong> in Brev to get started. "
                      "First setup takes several minutes.</p>")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(PAGE.replace("%s", status).encode())

ThreadingHTTPServer(("0.0.0.0", 4311), Waiting).serve_forever()
