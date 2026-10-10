"""Download the official YAMNet v1 SavedModel once; no audio is uploaded."""
import argparse
from pathlib import Path
import tarfile
import tempfile
import urllib.request

MODEL_URL = "https://tfhub.dev/google/yamnet/1?tf-hub-format=compressed"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(".models/yamnet"))
    args = parser.parse_args()
    if (args.output / "saved_model.pb").is_file():
        print(f"Model already available at {args.output}")
        return
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        archive = Path(directory) / "yamnet.tar.gz"
        request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "SoundSight/0.1"})
        with urllib.request.urlopen(request, timeout=120) as response, archive.open("wb") as target:
            import shutil
            shutil.copyfileobj(response, target)
        with tarfile.open(archive) as model:
            model.extractall(args.output, filter="data")
    if not (args.output / "saved_model.pb").is_file():
        raise RuntimeError("Downloaded archive does not contain a YAMNet SavedModel.")
    print(f"Downloaded YAMNet to {args.output}")


if __name__ == "__main__":
    main()
