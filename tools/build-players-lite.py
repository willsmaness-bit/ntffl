#!/usr/bin/env python3
"""Build data/players-lite.json: team, position and injury status for players on
Sunday Scaries rosters only. Sleeper's /players/nfl is ~15 MB, so browsers never
load it. Run this (at most once a day, per Sleeper's guidance) and commit the output.
Usage: python3 tools/build-players-lite.py"""
import json, os, urllib.request, datetime
LEAGUE = '1398395736038641664'
def get(path):
    with urllib.request.urlopen('https://api.sleeper.app/v1' + path, timeout=60) as r:
        return json.load(r)
rosters = get(f'/league/{LEAGUE}/rosters')
ids = {pid for r in rosters for key in ('players', 'reserve', 'taxi') for pid in (r.get(key) or [])}
allp = get('/players/nfl')
out = {}
for pid in sorted(ids):
    p = allp.get(pid) or {}
    out[pid] = {
        'n': p.get('full_name') or ' '.join(x for x in (p.get('first_name'), p.get('last_name')) if x) or pid,
        'pos': p.get('position') or '',
        'team': p.get('team') or (pid if p.get('position') == 'DEF' else ''),
        'inj': p.get('injury_status') or '',
    }
doc = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'players': out}
path = os.path.join(os.path.dirname(__file__), '..', 'data', 'players-lite.json')
with open(path, 'w') as f:
    json.dump(doc, f, separators=(',', ':'))
print(len(out), 'players ->', os.path.normpath(path))
