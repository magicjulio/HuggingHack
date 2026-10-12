"""Tiny client for the ahujasid 'MCP for Blender' add-on (port 9876).
Usage: python3 bl.py ping | python3 bl.py code <file.py> | python3 bl.py cmd <type> [json-params]
"""
import json, socket, sys

def send(cmd, timeout=600):
    s = socket.create_connection(("127.0.0.1", 9876), timeout=timeout)
    s.sendall(json.dumps(cmd).encode())
    buf = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
        try:
            return json.loads(buf.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
    return json.loads(buf.decode())

if __name__ == "__main__":
    a = sys.argv[1]
    if a == "ping":
        r = send({"type": "ping"})
    elif a == "code":
        r = send({"type": "execute_code", "params": {"code": open(sys.argv[2]).read()}})
    else:
        r = send({"type": sys.argv[2], "params": json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}})
    res = r.get("result")
    if isinstance(res, dict) and "result" in res and set(res) <= {"executed", "result"}:
        print(r.get("status"), "\n" + str(res["result"]))
    else:
        print(json.dumps(r, indent=1)[:6000])
