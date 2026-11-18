"""Local, read-only Christmas training endpoint. Never handles attendee data."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class Inventory(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/':
            self.send_error(404); return
        body=json.dumps({'shop':'Santa’s North Pole Gift Shop','gifts':['toy train','storybook','teddy','puzzle','mittens']}).encode()
        self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self): self.send_error(405)
    def log_message(self,*args): pass
HTTPServer(('0.0.0.0',8080),Inventory).serve_forever()
