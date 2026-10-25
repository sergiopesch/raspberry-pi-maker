#!/usr/bin/env python3
"""Rebuild two reproducible owned distributions from SRI-verified public bytes."""
import base64
import copy
import gzip
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent
METADATA = json.loads((ROOT / 'sources.json').read_text())
VERSIONS = {
    'control': '12.2.1+sergiopesch.security.20261025',
    'patched': '12.2.1+sergiopesch.security.20261025',
}


def download(key):
    meta = METADATA[key]
    with urllib.request.urlopen(meta['dist']['tarball'], timeout=30) as response:
        data = response.read()
    algorithm, expected = meta['dist']['integrity'].split('-', 1)
    assert base64.b64encode(hashlib.new(algorithm, data).digest()).decode() == expected
    assert hashlib.sha1(data).hexdigest() == meta['dist']['shasum']
    return data


def members(data):
    result = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member in archive:
            assert member.isfile(), member.name
            assert member.name.startswith('package/') and '..' not in Path(member.name).parts
            assert member.name not in result
            result[member.name] = (copy.copy(member), archive.extractfile(member).read())
    return result


official = members(download('npm@12.2.1'))
replacements = {name: members(download(name + '@' + version)) for name, version in [
    ('undici', '6.29.1'), ('ip-address', '10.7.4'),
]}
assert 'package/npm-shrinkwrap.json' not in official and 'package/package-lock.json' not in official
for name, library in replacements.items():
    manifest = json.loads(library['package/package.json'][1])
    assert manifest['name'] == name and not manifest.get('dependencies')


def record(entry):
    member, data = entry
    return {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'mode': member.mode, 'type': 'file'}


def build(kind):
    owned = dict(official)
    package_info, package_bytes = owned['package/package.json']
    assert package_bytes.count(b'"version": "12.2.1"') == 1
    owned['package/package.json'] = (copy.copy(package_info), package_bytes.replace(
        b'"version": "12.2.1"', ('"version": "' + VERSIONS[kind] + '"').encode(), 1))
    if kind == 'patched':
        for library, replacement in replacements.items():
            prefix = 'package/node_modules/' + library + '/'
            owned = {name: value for name, value in owned.items() if not name.startswith(prefix)}
            for name, (info, data) in replacement.items():
                info = copy.copy(info)
                info.name = prefix + name.removeprefix('package/')
                owned[info.name] = (info, data)
    provenance = {
        'distribution': 'Owned downstream development-tooling distribution; not an official npm release.',
        'owner': 'sergiopesch', 'package': 'npm', 'version': VERSIONS[kind],
        'upstream': {'package': 'npm@12.2.1', 'dist': METADATA['npm@12.2.1']['dist']},
        'changes': [] if kind == 'control' else [
            {'bundled_path': 'node_modules/' + name, 'from': old, 'to': new,
             'official_dist': METADATA[name + '@' + new]['dist']}
            for name, old, new in [('undici', '6.29.0', '6.29.1'), ('ip-address', '10.7.2', '10.7.4')]
        ],
        'license_policy': 'This owned npm distribution remains redistributable under upstream Artistic-2.0, including recipients right to redistribute the modified source under that license. All upstream npm code and licenses are retained. Replacement libraries retain their complete official package contents and licenses.',
    }
    provenance_bytes = (json.dumps(provenance, indent=2, sort_keys=True) + '\n').encode()
    info = tarfile.TarInfo('package/OWNED-DISTRIBUTION.json')
    info.mode, info.mtime, info.uid, info.gid = 0o644, 0, 0, 0
    owned[info.name] = (info, provenance_bytes)
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0, compresslevel=9) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for name in sorted(owned):
                info, data = owned[name]
                info = copy.copy(info)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
    result = output.getvalue()
    filename = 'npm-12.2.1-sergiopesch-security-20261025' + ('-control' if kind == 'control' else '') + '.tgz'
    (ROOT / filename).write_bytes(result)
    deltas = []
    for name in sorted(set(official) | set(owned)):
        before = record(official[name]) if name in official else None
        after = record(owned[name]) if name in owned else None
        if before != after:
            allowed = name in ['package/package.json', 'package/OWNED-DISTRIBUTION.json'] or (
                kind == 'patched' and any(name.startswith('package/node_modules/' + library + '/') for library in replacements))
            assert allowed, name
            deltas.append({'path': name, 'before': before, 'after': after})
    assert any(name.endswith('/LICENSE') for name in official)
    for name, value in official.items():
        if 'license' in name.lower() and not any(name.startswith('package/node_modules/' + library + '/') for library in replacements):
            assert owned[name][1] == value[1]
    receipt = {
        'kind': kind, 'version': VERSIONS[kind], 'archive': filename, 'bytes': len(result),
        'sha256': hashlib.sha256(result).hexdigest(),
        'integrity': 'sha512-' + base64.b64encode(hashlib.sha512(result).digest()).decode(),
        'official_source_packages': {key: METADATA[key] for key in ['npm@12.2.1', 'undici@6.29.1', 'ip-address@10.7.4']},
        'members': {name: record(value) for name, value in sorted(owned.items())},
        'full_member_delta': deltas,
        'unchanged_official_members': sum(name in owned and record(value) == record(owned[name]) for name, value in official.items()),
        'all_changes_within_authorized_paths': True,
    }
    (ROOT / (kind + '-manifest.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


for kind in ['control', 'patched']:
    receipt = build(kind)
    # A second in-memory generation proves deterministic archive bytes.
    assert build(kind)['sha256'] == receipt['sha256']
    print(json.dumps({key: receipt[key] for key in ['kind', 'version', 'archive', 'bytes', 'sha256', 'integrity', 'unchanged_official_members']}))
