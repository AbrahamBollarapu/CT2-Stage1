# storage.py — tiny Parquet helper with a simple lock per file
import os
from contextlib import contextmanager
from threading import Lock
import pandas as pd

DATA_DIR = os.environ.get("TS_DATA_DIR", "/data")
os.makedirs(DATA_DIR, exist_ok=True)

# filename -> threading.Lock
_LOCKS = {}

@contextmanager
def _locked(path: str):
    lock = _LOCKS.setdefault(path, Lock())
    with lock:
        yield

def _full_path(filename: str) -> str:
    return os.path.join(DATA_DIR, filename)

def save_parquet(df: pd.DataFrame, filename: str) -> None:
    path = _full_path(filename)
    with _locked(path):
        # Ensure stable column order/types
        if "timestamp" in df.columns:
            df = df.copy()
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        df.to_parquet(path, index=False, engine="pyarrow")

def read_parquet(filename: str) -> pd.DataFrame:
    path = _full_path(filename)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    df = pd.read_parquet(path, engine="pyarrow")
    # Normalize dtype for filters downstream
    if "timestamp" in df.columns:
        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df
