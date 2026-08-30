"""Database reset and seeding script wrapper."""

import subprocess
import sys


def main():
    print("Running database seed script via uv...")
    res = subprocess.run(["uv", "run", "python", "-m", "retainai.scripts.seed_database"], cwd="backend")
    sys.exit(res.returncode)


if __name__ == "__main__":
    main()
