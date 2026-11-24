#!/usr/bin/env python3
"""Import Google Play Console statistics into Firebase (admin -> Growth page).

Play Console saves daily "bulk report" CSV files in a private Cloud Storage
bucket (Play Console -> Download reports -> Statistics -> "Copy Cloud Storage
URI", e.g. gs://pubsite_prod_rev_01234567890987654321). This script reads the
files for the last DAYS days and writes, per day:

    growth/manual/<YYYY-MM-DD>/installs     first-time installers (Daily User Installs)
    growth/manual/<YYYY-MM-DD>/uninstalls   Daily User Uninstalls
    growth/manual/<YYYY-MM-DD>/visitors     store listing visitors (if the store
                                            performance report is in the bucket)
    growth/manual/<YYYY-MM-DD>/src = "play"
    growth/meta/playImport = { at, days, files }

Only those fields are updated (PATCH), so ad spend / paid installs / notes
typed on the Growth page are kept.

Environment (GitHub Actions secrets, see admin/README-admin.md):
  PLAY_SA_JSON      service-account key (JSON text) invited in Play Console with
                    "View app information and download bulk reports"
  PLAY_BUCKET       the bucket, "pubsite_prod_rev_…" (a gs:// URI is fine too)
  FIREBASE_SA_JSON  service-account key of the Firebase project (Project
                    settings -> Service accounts -> Generate new private key).
                    Optional: defaults to PLAY_SA_JSON.
  FIREBASE_DB_URL   optional, defaults to the Kids Quiz database
  PLAY_PACKAGE      optional, defaults to com.mk.kidsquiz
  DAYS              optional, how many days back to import (default 35)

  python3 import_play_stats.py            # import
  python3 import_play_stats.py --dry-run  # read and print, write nothing
"""
import csv, io, json, os, re, sys, time, datetime as dt

PACKAGE = os.environ.get("PLAY_PACKAGE", "com.mk.kidsquiz")
DB_URL = os.environ.get("FIREBASE_DB_URL", "https://kidsgames-3987c-default-rtdb.asia-southeast1.firebasedatabase.app").rstrip("/")
DAYS = int(os.environ.get("DAYS", "35"))


# ---------------------------------------------------------------- parsing
def decode(raw: bytes) -> str:
    """Play reports are UTF-16 (with BOM); some are UTF-8."""
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("utf-16")


def rows(text: str):
    return list(csv.DictReader(io.StringIO(text)))


def col(header, *words):
    """First column whose lower-case name contains all the words."""
    for h in header:
        n = (h or "").lower()
        if all(w in n for w in words):
            return h
    return None


def num(v):
    try:
        return float(str(v).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def parse_installs(text: str) -> dict:
    """installs_<pkg>_<YYYYMM>_overview.csv -> {date: {installs, uninstalls}}"""
    r = rows(text)
    if not r:
        return {}
    h = list(r[0].keys())
    c_date = col(h, "date")
    c_in = col(h, "daily user installs") or col(h, "daily device installs")
    c_out = col(h, "daily user uninstalls") or col(h, "daily device uninstalls")
    out = {}
    for x in r:
        d = (x.get(c_date) or "").strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
            continue
        e = out.setdefault(d, {})
        if c_in:
            e["installs"] = e.get("installs", 0) + num(x.get(c_in))
        if c_out:
            e["uninstalls"] = e.get("uninstalls", 0) + num(x.get(c_out))
    return out


def parse_store(text: str) -> dict:
    """store_performance_<pkg>_<YYYYMM>_<dimension>.csv -> {date: {visitors}}
    The rows are split by country / traffic source; they are summed per day."""
    r = rows(text)
    if not r:
        return {}
    h = list(r[0].keys())
    c_date = col(h, "date")
    c_vis = col(h, "visitor")
    if not (c_date and c_vis):
        return {}
    out = {}
    for x in r:
        d = (x.get(c_date) or "").strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", d):
            out.setdefault(d, {"visitors": 0})["visitors"] += num(x.get(c_vis))
    return out


def merge(dst: dict, src: dict):
    for d, v in src.items():
        dst.setdefault(d, {}).update({k: int(round(n)) for k, n in v.items()})


# ---------------------------------------------------------------- Google
def credentials(env_name, scopes):
    from google.oauth2 import service_account
    info = json.loads(os.environ[env_name])
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


def read_reports(months):
    """Download this month's and last month's reports from the Play bucket.
    A file that is missing (404) is skipped; no permission (403) is reported
    in plain words instead of a traceback."""
    from google.cloud import storage
    from google.api_core import exceptions as gex
    bucket_name = re.sub(r"^gs://", "", os.environ["PLAY_BUCKET"]).strip("/").split("/")[0]
    cred = credentials("PLAY_SA_JSON", ["https://www.googleapis.com/auth/devstorage.read_only"])
    client = storage.Client(credentials=cred, project=cred.project_id)
    bucket = client.bucket(bucket_name)
    data, files, denied = {}, [], []

    def get(name):
        try:
            return bucket.blob(name).download_as_bytes()
        except gex.NotFound:
            print(f"  not there (yet): {name}")
        except gex.Forbidden:
            denied.append(name)
            print(f"  no permission: {name}")
        return None

    for m in months:
        name = f"stats/installs/installs_{PACKAGE}_{m}_overview.csv"
        raw = get(name)
        if raw is not None:
            merge(data, parse_installs(decode(raw)))
            files.append(name)
        # store listing visitors: one dimension only (country), else rows would be counted twice
        try:
            store = [b for b in client.list_blobs(bucket_name, prefix="stats/store_performance/")
                     if PACKAGE in b.name and m in b.name and b.name.endswith(".csv")]
        except gex.Forbidden:
            store = []   # listing needs a wider permission; installs still work without it
        except gex.NotFound:
            store = []
        store.sort(key=lambda b: (0 if "country" in b.name else 1, b.name))
        if store:
            raw = get(store[0].name)
            if raw is not None:
                merge(data, parse_store(decode(raw)))
                files.append(store[0].name)

    if denied and not files:
        sa = cred.service_account_email
        print(f"""
NO PERMISSION YET: {sa} cannot read the Play Console reports.
  1. Play Console -> Manage account -> Users and permissions -> {sa}
     -> ACCOUNT permissions (not only app permissions) -> tick
     "View app information and download bulk reports (read-only)" -> Apply changes.
  2. Google can take 24-48 hours after that before the reports can be read.
     Then run this workflow again.""", file=sys.stderr)
        sys.exit(2)
    return data, files


def firebase_patch(path, body, token):
    import requests
    r = requests.patch(f"{DB_URL}/{path}.json", params={"access_token": token}, data=json.dumps(body), timeout=30)
    r.raise_for_status()


def main():
    dry = "--dry-run" in sys.argv
    today = dt.date.today()
    first = today - dt.timedelta(days=DAYS)
    months = sorted({today.strftime("%Y%m"), first.strftime("%Y%m"), (today.replace(day=1) - dt.timedelta(days=1)).strftime("%Y%m")})
    data, files = read_reports(months)
    data = {d: v for d, v in data.items() if first.isoformat() <= d <= today.isoformat()}
    print(f"read {len(files)} file(s): {', '.join(files) or 'none'}")
    for d in sorted(data):
        print(d, data[d])
    if not files:
        print("No report files found. Check PLAY_BUCKET and that the service account was invited in Play Console "
              "(it can take up to 24 hours after inviting before the reports can be read).", file=sys.stderr)
        sys.exit(1)
    if dry:
        print("dry run: nothing written")
        return
    env = "FIREBASE_SA_JSON" if os.environ.get("FIREBASE_SA_JSON") else "PLAY_SA_JSON"
    cred = credentials(env, ["https://www.googleapis.com/auth/firebase.database", "https://www.googleapis.com/auth/userinfo.email"])
    from google.auth.transport.requests import Request
    cred.refresh(Request())
    now = int(time.time() * 1000)
    for d, v in sorted(data.items()):
        firebase_patch(f"growth/manual/{d}", dict(v, src="play", imported=now), cred.token)
    firebase_patch("growth/meta/playImport", {"at": now, "days": len(data), "files": files}, cred.token)
    print(f"wrote {len(data)} day(s) to Firebase growth/manual")


if __name__ == "__main__":
    main()
