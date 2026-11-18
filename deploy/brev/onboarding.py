import hashlib
from email import policy
from email.parser import BytesParser
import tempfile
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


archive = directory / "source.tar.gz"
digest = "74e3a684cd80168c1425a1193f938dfee088b6fb4c44e74649e139f1089bde8d"
asset_size = 11777231
release = "https://github.com/Soragi/santa-claw-brev/releases/download/workshop-source-1f960e3/santa-claw-launchable-source.tar.gz"


def source_ready():
    if (Path.home() / "santa-claw-launchable" / (".verified-" + digest)).is_file():
        return True
    try:
        return archive.stat().st_size == asset_size and hashlib.sha256(archive.read_bytes()).hexdigest() == digest
    except OSError:
        return False


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
        if phase in ("source", "setup", "failed") and not source_ready():
            phase = "source"
        elif phase == "source":
            phase = "setup"
        source_form = f"""<h2>Load the workshop files</h2><p>Download the GitHub release file, or get it from your organizer. Upload it here to unlock model setup.</p>
        <p><a href="{release}" rel="noreferrer">Download workshop archive</a></p>
        <form method="post" action="/source/{nonce}" enctype="multipart/form-data"><label>Workshop archive<input required type="file" name="archive" accept=".gz"></label><button>Verify workshop archive</button></form>"""
        body = {"setup":form, "source":source_form, "failed":"<p>Installation stopped. Check the private installer diagnostics on this VM before retrying.</p>"+form,
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

    def upload_source(self):
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= asset_size + 16384:
                return self.send_error(413)
            with lock:
                if state in ("installing", "ready"):
                    return self.send_error(409)
                content_type = self.headers.get("Content-Type", "")
                if not content_type.startswith("multipart/form-data;"):
                    return self.send_error(415)
                header = ("Content-Type: " + content_type + "\r\n\r\n").encode("ascii")
                message = BytesParser(policy=policy.default).parsebytes(header + self.rfile.read(size))
                parts = list(message.iter_parts())
                if len(parts) != 1 or parts[0].get_param("name", header="content-disposition") != "archive":
                    return self.send_error(400)
                data = parts[0].get_payload(decode=True) or b""
                if hashlib.sha256(data).hexdigest() != digest:
                    return self.send_error(422, "Archive does not match the workshop release. Go back and select the linked file.")
                with tempfile.NamedTemporaryFile(dir=directory, delete=False) as staged:
                    staged.write(data)
                os.replace(staged.name, archive)
        except (ValueError, UnicodeError):
            return self.send_error(400)
        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()

    def do_POST(self):
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self.send_error(403)
        if self.path == "/source/" + nonce:
            return self.upload_source()
        if self.path != "/":
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
                if not source_ready():
                    return self.send_error(409, "Load the workshop archive first")
                state = "installing"
                threading.Thread(target=install,args=(runtime,model,key),daemon=True).start()
        self.send_response(303)
        self.send_header("Location","/")
        self.end_headers()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0",4312),Page).serve_forever()
