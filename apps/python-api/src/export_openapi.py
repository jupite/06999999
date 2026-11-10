import argparse
import json
from pathlib import Path

from site_api.main import app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[3] / "doc" / "api" / "python.openapi.json"
    document = json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not output.exists() or json.loads(output.read_text(encoding="utf-8")) != app.openapi():
            parser.exit(1, "Python OpenAPI is out of date. Run pnpm api:python:generate.\n")
    else:
        output.write_text(document, encoding="utf-8")


if __name__ == "__main__":
    main()
