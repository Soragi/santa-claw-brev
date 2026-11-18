import os
import re
import secrets
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

directory = Path(__file__).resolve().parent
completed = directory / "complete"
state = "ready" if completed.exists() else "setup"
lock = threading.Lock()
nonce = secrets.token_urlsafe(32)
model_default = "nvidia/nemotron-3.5-super-vl-120b-a12b"


def install(runtime, model, key):
    global state
    try:
        subprocess.run(["bash", str(directory / "install.sh")], check=True,
                       env={**os.environ, "SANTA_RUNTIME": runtime, "SANTA_MODEL": model,
                            "NVIDIA_INFERENCE_API_KEY": key}, stdin=subprocess.DEVNULL,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        completed.touch(mode=0o600)
        state = "ready"
    except subprocess.CalledProcessError as error:
        state = "source" if error.returncode == 41 else "failed"
    except OSError:
        state = "failed"


class Page(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != "/":
            return self.send_error(404)
        form = f"""<form method="post"><input type="hidden" name="nonce" value="{nonce}">
        <label>Agent runtime<select name="runtime"><option value="hermes">Hermes</option><option value="openclaw">OpenClaw</option></select></label>
        <label>NVIDIA Build model<input name="model" required maxlength="200" value="{model_default}"></label>
        <label>NVIDIA Build API key<input name="key" type="password" required autocomplete="off" maxlength="512"></label>
        <p><a href="https://build.nvidia.com/" target="_blank" rel="noreferrer">Get a key from NVIDIA Build ↗</a></p>
        <button>Start my workshop →</button></form>"""
        phase = state
        body = {"setup":form, "source":"<p>Application source unavailable. Ask the organizer to stage the verified workshop archive, then retry.</p>"+form, "failed":"<p>Installation stopped. Check the private installer diagnostics on this VM before retrying.</p>"+form,
                "installing":"<progress aria-label='Installing workshop'></progress><p>Open <strong>Santa Claw Village</strong> from your Brev instance.</p>",
                "ready":"<p>Your workshop is ready. Open <strong>Enter Santa Claw Village</strong> on your Brev instance page.</p>"}[phase]
        refresh = '<meta http-equiv="refresh" content="5">' if phase == "installing" else ""
        page = f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{refresh}
        <title>Santa Claw Workshop</title><style>*{{box-sizing:border-box}}body{{margin:0;background:radial-gradient(ellipse at top right,#213227,#101310 55%);min-height:100vh;color:#f6f8f4;font:18px/1.5 system-ui}}
        main{{max-width:640px;margin:6vh auto;padding:clamp(20px,5vw,54px);background:#191d19;border:1px solid #394437;border-top:4px solid #76b900;border-radius:12px}}h1{{font: bold clamp(2rem,5vw,3rem) system-ui;margin:.3em 0}}label{{display:block;margin:18px 0}}
        input,select,button{{display:block;width:100%;margin-top:5px;border:0;border-radius:8px;padding:13px;font:inherit}}
        button{{background:#9bda39;color:#372610;cursor:pointer;font-weight:bold}}a{{color:#b6ea63}}</style><main>
        <span style="color:#a8dc61">NVIDIA Build &nbsp; / &nbsp; CPU workshop</span><h1>Santa Claw Village</h1>{body}</main></html>"""
        self.send_response(200)
        self.send_header("Content-Type","text/html; charset=utf-8")
        self.send_header("Cache-Control","no-store")
        self.send_header("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(page.encode())

    def do_POST(self):
        if self.path != "/" or self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self.send_error(403)
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= 4096:
                return self.send_error(413)
            values = parse_qs(self.rfile.read(size).decode(), max_num_fields=4)
            runtime, model, key, token = (values[name][0] for name in ("runtime","model","key","nonce"))
            if not secrets.compare_digest(nonce,token) or runtime not in ("hermes","openclaw") or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}",model) or not re.fullmatch(r"[!-~]{1,512}",key):
                return self.send_error(400)
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        global state
        with lock:
            if state in ("setup","source","failed"):
                state = "installing"
                threading.Thread(target=install,args=(runtime,model,key),daemon=True).start()
        self.send_response(303)
        self.send_header("Location","/")
        self.end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0",4312),Page).serve_forever()
