"""Run the Propongo2 development server."""

from app.main import run_server
from app.config import Config

print("\n ✨✨✨ 🔌 Server started ✨✨✨")
print(f"  👉  http://localhost:{Config.PORT}  👈\n")
run_server()
