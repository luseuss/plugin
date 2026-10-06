"""Build a deterministic release archive and update metadata. Standard library only."""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build(repository, tag):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Expected a GitHub owner/repository')
    source = ROOT / 'ExpressionShelf_Web'
    manifest = ET.parse(source / 'CSXS/manifest.xml').getroot()
    version = manifest.attrib['ExtensionBundleVersion']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or tag != 'v' + version:
        raise ValueError('Release tag must match ExtensionBundleVersion: v' + version)
    if manifest.find('ExtensionList/Extension').attrib['Version'] != version:
        raise ValueError('Extension version mismatch')
    updater = (source / 'updater.js').read_text(encoding='utf-8')
    if "const CURRENT_VERSION = '" + version + "';" not in updater:
        raise ValueError('Updater version must match ExtensionBundleVersion')
    for name in ['index.html', 'app.js', 'updater.js', 'typo.js', 'host/host.jsx', 'host/typo.jsx', '설치하기.bat']:
        if not (source / name).is_file():
            raise ValueError('Missing package file: ' + name)
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    archive = out / 'ExpressionShelf_Web.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for file in sorted(source.rglob('*')):
            if not file.is_file() or 'tools' in file.relative_to(source).parts:
                continue
            if file.is_symlink():
                raise ValueError('Symlinks are not permitted')
            info = zipfile.ZipInfo('ExpressionShelf_Web/' + file.relative_to(source).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, file.read_bytes())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    data = {'schema': 1, 'version': version, 'repository': repository,
            'url': f'https://github.com/{repository}/releases/download/{tag}/{archive.name}',
            'sha256': digest, 'size': archive.stat().st_size,
            'extension_id': 'com.expressionshelf.web.panel'}
    (out / 'latest.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    (out / 'SHA256SUMS.txt').write_text(digest + '  ' + archive.name + '\n', encoding='ascii')
    print('Built', tag, archive.name, data['size'], 'bytes')
    return data

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    build(args.repository, args.tag)
