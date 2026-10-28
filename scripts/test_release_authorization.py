"""Verify narrowly scoped owner approval without marking pending image rights verified."""
import json,shutil,tempfile
from pathlib import Path
from validate_publications import ROOT,validate,AUTHORIZATION_FILE

def main():
    results=[]
    with tempfile.TemporaryDirectory(prefix='qisun-release-test-') as tmp:
        site=Path(tmp)/'site'
        shutil.copytree(ROOT,site,ignore=shutil.ignore_patterns('.git','node_modules','tmp','__pycache__','test-results'))
        current=validate(site,release=True,check_output=True)
        assert current['owner_approved_snapshot'] and not current['errors']
        assert len(current['warnings'])==33
        results.append({'case':'approved_existing_snapshot','passed':True,'pending_rights_retained':33})
        app=site/'js/main.js';original=app.read_bytes();app.write_bytes(original+b'\n// later edit\n')
        assert validate(site,release=True)['errors'];app.write_bytes(original)
        results.append({'case':'later_source_edit_blocked','passed':True})
        asset=site/'assets/new-unapproved.svg';asset.write_text('<svg/>')
        assert validate(site,release=True)['errors'];asset.unlink()
        results.append({'case':'new_unapproved_asset_blocked','passed':True})
        figure=next((site/'assets/images/paper-figures').glob('*.png'));raw=figure.read_bytes();figure.write_bytes(raw+b'changed')
        assert validate(site,release=True)['errors'];figure.write_bytes(raw)
        results.append({'case':'changed_scientific_pixels_blocked','passed':True})
        approval=site/AUTHORIZATION_FILE;approval.unlink()
        assert validate(site,release=True)['errors']
        results.append({'case':'absent_owner_approval_blocked','passed':True})
    out=ROOT/'tmp/v35-release/logs';out.mkdir(parents=True,exist_ok=True)
    (out/'authorization_tests.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({'release_authorization_tests':len(results),'passed':True}))

if __name__=='__main__':main()
